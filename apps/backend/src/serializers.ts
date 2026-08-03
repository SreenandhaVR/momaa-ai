import type { Baby, Parent, User } from '@momaa/types';
import type { Types } from 'mongoose';
import type { BabyRecord } from './models/baby.model.js';
import type { ParentRecord } from './models/parent.model.js';
import type { UserRecord } from './models/user.model.js';

type Stored<T> = T & { _id: Types.ObjectId };
const iso = (value: Date): string => value.toISOString();

export function serializeUser(user: Stored<UserRecord>): User {
  return {
    id: String(user._id),
    email: user.email,
    phoneNumber: user.phoneNumber,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    parentId: user.parentId ? String(user.parentId) : undefined,
    lastActiveAt: user.lastActiveAt ? iso(user.lastActiveAt) : undefined,
    createdAt: iso(user.createdAt),
    updatedAt: iso(user.updatedAt)
  };
}

export function serializeParent(parent: Stored<ParentRecord>): Parent {
  return {
    id: String(parent._id),
    userId: String(parent.userId),
    firstName: parent.firstName,
    lastName: parent.lastName,
    relationshipToBaby: parent.relationshipToBaby,
    phoneNumber: parent.phoneNumber,
    babyIds: parent.babyIds.map(String),
    timezone: parent.timezone,
    createdAt: iso(parent.createdAt),
    updatedAt: iso(parent.updatedAt)
  };
}

export function serializeBaby(baby: Stored<BabyRecord>): Baby {
  return {
    id: String(baby._id),
    parentIds: baby.parentIds.map(String),
    firstName: baby.firstName,
    lastName: baby.lastName,
    dateOfBirth: iso(baby.dateOfBirth),
    sex: baby.sex,
    photoUrl: baby.photoUrl,
    medicalNotes: baby.medicalNotes,
    createdAt: iso(baby.createdAt),
    updatedAt: iso(baby.updatedAt)
  };
}
