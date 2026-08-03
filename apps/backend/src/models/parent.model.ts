import { Schema, Types, model } from 'mongoose';

export interface ParentRecord {
  userId: Types.ObjectId;
  firstName: string;
  lastName?: string;
  relationshipToBaby?: string;
  phoneNumber?: string;
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
    phoneNumber: { type: String, trim: true, unique: true, sparse: true },
    babyIds: [{ type: Schema.Types.ObjectId, ref: 'Baby' }],
    timezone: { type: String, required: true, default: 'UTC' }
  },
  { timestamps: true }
);

export const ParentModel = model<ParentRecord>('Parent', parentSchema);
