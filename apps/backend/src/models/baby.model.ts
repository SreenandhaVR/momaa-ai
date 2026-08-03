import { Schema, Types, model } from 'mongoose';

export interface BabyRecord {
  parentIds: Types.ObjectId[];
  firstName: string;
  lastName?: string;
  dateOfBirth: Date;
  sex?: 'female' | 'male' | 'intersex' | 'unspecified';
  photoUrl?: string;
  medicalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const babySchema = new Schema<BabyRecord>(
  {
    parentIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Parent' }],
      required: true,
      validate: {
        validator: (parentIds: Types.ObjectId[]) => parentIds.length > 0,
        message: 'A baby must have at least one parent or caregiver.'
      }
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    dateOfBirth: { type: Date, required: true },
    sex: { type: String, enum: ['female', 'male', 'intersex', 'unspecified'] },
    photoUrl: { type: String, trim: true },
    medicalNotes: { type: String, trim: true }
  },
  { timestamps: true }
);

babySchema.index({ parentIds: 1, dateOfBirth: -1 });

export const BabyModel = model<BabyRecord>('Baby', babySchema);
