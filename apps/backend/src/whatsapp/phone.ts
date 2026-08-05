import { ApiError } from '../errors.js';

/**
 * Canonical storage format for WhatsApp identities. Meta supplies the same
 * number without the leading `+` in webhook payloads.
 */
export function normalizeE164PhoneNumber(value: string): string {
  const normalized = value.trim().replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(normalized))
    throw new ApiError(
      400,
      'INVALID_WHATSAPP_NUMBER',
      'Enter a valid WhatsApp number in international E.164 format, for example +919876543210.'
    );
  return normalized;
}

export function metaSenderToE164(value: string): string {
  return normalizeE164PhoneNumber(`+${value.replace(/\D/g, '')}`);
}
