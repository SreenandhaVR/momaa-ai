import { Schema, Types, model } from 'mongoose';

export interface WhatsAppPairingCodeRecord {
  userId: Types.ObjectId;
  parentId: Types.ObjectId;
  /** HMAC digest only; the plaintext six-digit code is never stored. */
  codeDigest: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const whatsappPairingCodeSchema = new Schema<WhatsAppPairingCodeRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Parent', required: true, index: true },
    codeDigest: { type: String, required: true, unique: true, index: true, select: false },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    attempts: { type: Number, required: true, default: 0, min: 0 }
  },
  { timestamps: true }
);

whatsappPairingCodeSchema.index({ userId: 1, parentId: 1 }, { unique: true });

export const WhatsAppPairingCodeModel = model<WhatsAppPairingCodeRecord>(
  'WhatsAppPairingCode',
  whatsappPairingCodeSchema
);
