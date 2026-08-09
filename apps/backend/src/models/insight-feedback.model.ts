import { Schema, Types, model } from 'mongoose';

export type InsightFeedbackType = 'helpful' | 'not_helpful' | 'correction';

export interface InsightFeedbackRecord {
  babyId: Types.ObjectId;
  parentId: Types.ObjectId;
  insightId?: Types.ObjectId;
  type: InsightFeedbackType;
  comment?: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const insightFeedbackSchema = new Schema<InsightFeedbackRecord>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Parent', required: true, index: true },
    insightId: { type: Schema.Types.ObjectId, ref: 'AIInsight' },
    type: { type: String, enum: ['helpful', 'not_helpful', 'correction'], required: true },
    comment: { type: String, trim: true, maxlength: 2_000 },
    timestamp: { type: Date, required: true, default: Date.now }
  },
  { timestamps: true }
);

insightFeedbackSchema.index({ babyId: 1, timestamp: -1 });
insightFeedbackSchema.index({ insightId: 1, parentId: 1, timestamp: -1 });

export const InsightFeedbackModel = model<InsightFeedbackRecord>(
  'InsightFeedback',
  insightFeedbackSchema
);
