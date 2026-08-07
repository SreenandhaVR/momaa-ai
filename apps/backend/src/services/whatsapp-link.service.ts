import bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { ApiError } from '../errors.js';
import { WhatsAppLinkModel } from '../models/index.js';
import type { WhatsAppLinkRecord } from '../models/whatsapp-link.model.js';
import { sendWhatsAppVerificationCode } from '../whatsapp/client.js';
import { normalizeE164PhoneNumber } from '../whatsapp/phone.js';

const verificationLifetimeMs = 10 * 60 * 1_000;
const maximumVerificationAttempts = 5;

function createVerificationCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

function codeExpired(link: { verificationExpiresAt?: Date }): boolean {
  return !link.verificationExpiresAt || link.verificationExpiresAt.getTime() <= Date.now();
}

export async function createWhatsAppLink(input: {
  userId: string;
  parentId: string;
  phoneNumber: string;
}): Promise<WhatsAppLinkRecord> {
  const phoneE164 = normalizeE164PhoneNumber(input.phoneNumber);
  const existing = await WhatsAppLinkModel.findOne({ phoneE164 });
  if (existing)
    throw new ApiError(
      409,
      'WHATSAPP_NUMBER_IN_USE',
      'This WhatsApp number is already linked to a Momaa account.'
    );

  const code = createVerificationCode();
  const link = await WhatsAppLinkModel.create({
    userId: input.userId,
    parentId: input.parentId,
    phoneE164,
    status: 'pending',
    verificationCodeHash: await bcrypt.hash(code, 12),
    verificationExpiresAt: new Date(Date.now() + verificationLifetimeMs),
    verificationAttempts: 0
  });

  try {
    await sendWhatsAppVerificationCode(phoneE164, code);
    return link;
  } catch (error) {
    await link.deleteOne();
    throw error;
  }
}

export async function verifyWhatsAppLink(input: {
  linkId: string;
  userId: string;
  parentId: string;
  code: string;
}): Promise<WhatsAppLinkRecord> {
  const link = await WhatsAppLinkModel.findOne({
    _id: input.linkId,
    userId: input.userId,
    parentId: input.parentId
  }).select('+verificationCodeHash');
  if (!link) throw new ApiError(404, 'NOT_FOUND', 'WhatsApp link not found.');
  if (link.status === 'verified') return link;
  if (codeExpired(link))
    throw new ApiError(
      400,
      'VERIFICATION_EXPIRED',
      'This verification code has expired. Request a new one.'
    );
  if (link.verificationAttempts >= maximumVerificationAttempts)
    throw new ApiError(
      429,
      'VERIFICATION_ATTEMPTS_EXCEEDED',
      'Too many incorrect codes. Request a new verification code.'
    );

  const valid =
    typeof link.verificationCodeHash === 'string' &&
    (await bcrypt.compare(input.code, link.verificationCodeHash));
  if (!valid) {
    link.verificationAttempts += 1;
    await link.save();
    throw new ApiError(400, 'INVALID_VERIFICATION_CODE', 'The verification code is incorrect.');
  }

  link.status = 'verified';
  link.verifiedAt = new Date();
  link.verificationCodeHash = undefined;
  link.verificationExpiresAt = undefined;
  link.verificationAttempts = 0;
  await link.save();
  return link;
}

export async function updateWhatsAppLink(input: {
  linkId: string;
  userId: string;
  parentId: string;
  phoneNumber: string;
}): Promise<WhatsAppLinkRecord> {
  const link = await WhatsAppLinkModel.findOne({
    _id: input.linkId,
    userId: input.userId,
    parentId: input.parentId
  }).select('+verificationCodeHash');
  if (!link) throw new ApiError(404, 'NOT_FOUND', 'WhatsApp link not found.');

  const phoneE164 = normalizeE164PhoneNumber(input.phoneNumber);
  const conflict = await WhatsAppLinkModel.exists({ phoneE164, _id: { $ne: link._id } });
  if (conflict)
    throw new ApiError(
      409,
      'WHATSAPP_NUMBER_IN_USE',
      'This WhatsApp number is already linked to a Momaa account.'
    );

  const previous = link.toObject();
  const code = createVerificationCode();
  link.phoneE164 = phoneE164;
  link.status = 'pending';
  link.verifiedAt = undefined;
  link.verificationCodeHash = await bcrypt.hash(code, 12);
  link.verificationExpiresAt = new Date(Date.now() + verificationLifetimeMs);
  link.verificationAttempts = 0;
  await link.save();
  try {
    await sendWhatsAppVerificationCode(phoneE164, code);
    return link;
  } catch (error) {
    link.phoneE164 = previous.phoneE164;
    link.status = previous.status;
    link.verifiedAt = previous.verifiedAt;
    link.verificationCodeHash = previous.verificationCodeHash;
    link.verificationExpiresAt = previous.verificationExpiresAt;
    link.verificationAttempts = previous.verificationAttempts;
    await link.save();
    throw error;
  }
}

export async function unlinkWhatsAppLink(input: {
  linkId: string;
  userId: string;
  parentId: string;
}): Promise<void> {
  const result = await WhatsAppLinkModel.deleteOne({
    _id: input.linkId,
    userId: input.userId,
    parentId: input.parentId
  });
  if (result.deletedCount !== 1) throw new ApiError(404, 'NOT_FOUND', 'WhatsApp link not found.');
}

export async function findVerifiedWhatsAppLink(
  phoneE164: string
): Promise<WhatsAppLinkRecord | null> {
  return WhatsAppLinkModel.findOneAndUpdate(
    { phoneE164, status: 'verified' },
    { $set: { lastInboundMessageAt: new Date() } },
    { returnDocument: 'after' }
  );
}

/** Used by the webhook to distinguish an unknown sender from an unverified one. */
export async function findWhatsAppLink(phoneE164: string): Promise<WhatsAppLinkRecord | null> {
  return WhatsAppLinkModel.findOneAndUpdate(
    { phoneE164 },
    { $set: { lastInboundMessageAt: new Date() } },
    { returnDocument: 'after' }
  );
}
