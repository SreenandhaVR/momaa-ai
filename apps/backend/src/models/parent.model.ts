import { Schema, Types, model } from 'mongoose';

export interface ParentRecord {
  userId: Types.ObjectId;
  firstName: string;
  lastName?: string;
  relationshipToBaby?: string;
  phoneNumber?: string;
  isPhoneVerified: boolean;
  babyIds: Types.ObjectId[];
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

const parentSchema = new Schema<ParentRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    relationshipToBaby: { type: String, trim: true },
    // Digits only: country code + national number (for example 919876543210).
    phoneNumber: { type: String, trim: true, unique: true, sparse: true, match: /^[1-9]\d{7,14}$/ },
    isPhoneVerified: { type: Boolean, required: true, default: false },
    babyIds: [{ type: Schema.Types.ObjectId, ref: 'Baby' }],
    // Keep the parent's IANA timezone so UI and WhatsApp reply text can be
    // localized while all event timestamps remain stored as UTC Dates.
    timezone: { type: String, required: true, default: 'Asia/Kolkata' }
  },
  { timestamps: true }
);

export const ParentModel = model<ParentRecord>('Parent', parentSchema);
