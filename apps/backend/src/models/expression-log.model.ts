import { Schema, model, type Types } from 'mongoose';

export type ExpressionLabel = 'calm' | 'happy' | 'distressed' | 'crying' | 'sleepy' | 'confused' | 'unknown';
export interface ExpressionLogRecord {
  baby: Types.ObjectId; loggedBy: Types.ObjectId; label: ExpressionLabel; confidence: number;
  rawProviderLabels: Array<{ label: string; confidence: number }>;
  source: 'manual-check' | 'whatsapp' | 'auto-monitor'; imageRef?: string; createdAt: Date;
}
const schema = new Schema<ExpressionLogRecord>({
  baby: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
  loggedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  label: { type: String, enum: ['calm','happy','distressed','crying','sleepy','confused','unknown'], required: true },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  rawProviderLabels: [{ label: { type: String, required: true }, confidence: { type: Number, required: true, min: 0, max: 1 } }],
  source: { type: String, enum: ['manual-check','whatsapp','auto-monitor'], default: 'manual-check' },
  imageRef: { type: String }
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ baby: 1, createdAt: -1 });
export const ExpressionLogModel = model<ExpressionLogRecord>('ExpressionLog', schema);
