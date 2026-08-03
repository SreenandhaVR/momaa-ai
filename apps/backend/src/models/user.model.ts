import { Schema, Types, model } from 'mongoose';

export interface UserRecord {
  email?: string;
  phoneNumber?: string;
  displayName: string;
  avatarUrl?: string;
  parentId?: Types.ObjectId;
  lastActiveAt?: Date;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserRecord>(
  {
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    phoneNumber: { type: String, trim: true, unique: true, sparse: true },
    displayName: { type: String, required: true, trim: true },
    avatarUrl: { type: String, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Parent' },
    lastActiveAt: { type: Date },
    passwordHash: { type: String, required: true, select: false }
  },
  { timestamps: true }
);

export const UserModel = model<UserRecord>('User', userSchema);
