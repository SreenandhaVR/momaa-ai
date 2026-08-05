import { Schema, Types, model } from 'mongoose';

export type WhatsAppLinkStatus = 'pending' | 'verified';

export interface WhatsAppLinkRecord {
  userId: Types.ObjectId;
  parentId: Types.ObjectId;
  /** Globally unique, canonical E.164 number, e.g. +919876543210. */
  phoneE164: string;
  status: WhatsAppLinkStatus;
  verificationCodeHash?: string;
  verificationExpiresAt?: Date;
  verificationAttempts: number;
  verifiedAt?: Date;
  lastInboundMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const whatsappLinkSchema = new Schema<WhatsAppLinkRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Parent', required: true, index: true },
    phoneE164: {
      type: String,
      required: true,
      unique: true,
      match: /^\+[1-9]\d{7,14}$/
    },
    status: { type: String, enum: ['pending', 'verified'], required: true, default: 'pending' },
    verificationCodeHash: { type: String, select: false },
    verificationExpiresAt: { type: Date },
    verificationAttempts: { type: Number, required: true, default: 0, min: 0 },
    verifiedAt: { type: Date },
    lastInboundMessageAt: { type: Date }
  },
  { timestamps: true }
);

whatsappLinkSchema.index({ parentId: 1, status: 1 });

export const WhatsAppLinkModel = model<WhatsAppLinkRecord>('WhatsAppLink', whatsappLinkSchema);
