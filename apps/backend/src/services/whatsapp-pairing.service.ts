import { createHmac, randomInt } from 'node:crypto';
import { ApiError } from '../errors.js';
import { WhatsAppLinkModel, WhatsAppPairingCodeModel } from '../models/index.js';
import type { WhatsAppLinkRecord } from '../models/whatsapp-link.model.js';

const pairingLifetimeMs = 10 * 60 * 1_000;
const maximumPairingAttempts = 5;

function pairingSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is required to create WhatsApp pairing codes.');
  return secret;
}

function digest(code: string): string {
  return createHmac('sha256', pairingSecret()).update(code).digest('hex');
}

function newCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

export async function createWhatsAppPairingCode(input: {
  userId: string;
  parentId: string;
}): Promise<{ code: string; expiresAt: Date }> {
  const code = newCode();
  const expiresAt = new Date(Date.now() + pairingLifetimeMs);
  await WhatsAppPairingCodeModel.findOneAndUpdate(
    { userId: input.userId, parentId: input.parentId },
    { $set: { codeDigest: digest(code), expiresAt, attempts: 0 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { code, expiresAt };
}

export async function claimWhatsAppPairingCode(input: {
  code: string;
  phoneE164: string;
}): Promise<WhatsAppLinkRecord> {
  const codeDigest = digest(input.code);
  const pairing = await WhatsAppPairingCodeModel.findOne({ codeDigest }).select('+codeDigest');
  if (!pairing || pairing.expiresAt.getTime() <= Date.now())
    throw new ApiError(400, 'INVALID_PAIRING_CODE', 'This pairing code is invalid or has expired.');
  if (pairing.attempts >= maximumPairingAttempts)
    throw new ApiError(429, 'PAIRING_ATTEMPTS_EXCEEDED', 'Too many incorrect pairing attempts. Create a new code in Momaa.');

  const existing = await WhatsAppLinkModel.findOne({ phoneE164: input.phoneE164 });
  if (existing) {
    if (String(existing.parentId) === String(pairing.parentId)) return existing;
    throw new ApiError(409, 'WHATSAPP_NUMBER_IN_USE', 'This WhatsApp number is already linked to another Momaa account.');
  }

  try {
    const link = await WhatsAppLinkModel.create({
      userId: pairing.userId,
      parentId: pairing.parentId,
      phoneE164: input.phoneE164,
      status: 'verified',
      verifiedAt: new Date(),
      verificationAttempts: 0
    });
    await pairing.deleteOne();
    return link;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000)
      throw new ApiError(409, 'WHATSAPP_NUMBER_IN_USE', 'This WhatsApp number is already linked to another Momaa account.');
    throw error;
  }
}
