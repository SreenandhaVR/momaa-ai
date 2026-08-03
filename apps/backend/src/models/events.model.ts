import { Schema, Types, model } from 'mongoose';

const source = {
  type: String,
  enum: ['app', 'whatsapp', 'import', 'system'],
  required: true
} as const;
const babyId = { type: Schema.Types.ObjectId, ref: 'Baby', required: true } as const;

export interface FeedRecord {
  babyId: Types.ObjectId;
  amountMl?: number;
  method: 'breast' | 'bottle';
  timestamp: Date;
  durationMinutes?: number;
  side?: 'left' | 'right' | 'both';
  source: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface SleepRecord {
  babyId: Types.ObjectId;
  startTime: Date;
  endTime?: Date | null;
  durationMinutes?: number;
  isActive: boolean;
  source: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface DiaperRecord {
  babyId: Types.ObjectId;
  kind: 'wet' | 'dirty' | 'mixed';
  timestamp: Date;
  source: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface MedicineRecord {
  babyId: Types.ObjectId;
  name: string;
  dosage: string;
  administrationMethod: string;
  administeredAt: Date;
  prescribedBy?: string;
  source: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface VaccinationRecord {
  babyId: Types.ObjectId;
  name: string;
  administeredAt: Date;
  doseNumber?: number;
  provider?: string;
  nextDueAt?: Date;
  source: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface GrowthRecord {
  babyId: Types.ObjectId;
  recordedAt: Date;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  source: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface MemoryRecord {
  babyId: Types.ObjectId;
  title: string;
  description?: string;
  occurredAt: Date;
  mediaUrls: string[];
  source: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface TimelineEventRecord {
  babyId: Types.ObjectId;
  type: string;
  eventId: Types.ObjectId;
  occurredAt: Date;
  source: string;
  event: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
export interface AIInsightRecord {
  babyId: Types.ObjectId;
  title: string;
  summary: string;
  category: string;
  confidence: string;
  generatedAt: Date;
  relatedEventIds: Types.ObjectId[];
  isDismissed: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface NotificationRecord {
  userId: Types.ObjectId;
  babyId?: Types.ObjectId;
  title: string;
  body: string;
  channel: string;
  status: string;
  scheduledFor?: Date;
  sentAt?: Date;
  readAt?: Date;
  data?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}
export interface SettingsRecord {
  userId: Types.ObjectId;
  timezone: string;
  locale: string;
  notificationChannels: string[];
  quietHours?: { start: string; end: string };
  allowAIInsights: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface ConversationRecord {
  parentId: Types.ObjectId;
  babyId?: Types.ObjectId;
  channel: string;
  messages: {
    id: string;
    sender: string;
    text: string;
    sentAt: Date;
    metadata?: Record<string, unknown>;
  }[];
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const options = { timestamps: true } as const;
export const FeedModel = model<FeedRecord>(
  'Feed',
  new Schema<FeedRecord>(
    {
      babyId,
      amountMl: { type: Number, min: 0 },
      method: { type: String, enum: ['breast', 'bottle'], required: true },
      timestamp: { type: Date, required: true },
      durationMinutes: { type: Number, min: 0 },
      side: { type: String, enum: ['left', 'right', 'both'] },
      source,
      notes: { type: String, trim: true }
    },
    options
  )
);
export const SleepModel = model<SleepRecord>(
  'Sleep',
  new Schema<SleepRecord>(
    {
      babyId,
      startTime: { type: Date, required: true },
      endTime: { type: Date, default: null },
      durationMinutes: { type: Number, min: 0 },
      isActive: { type: Boolean, required: true, default: false },
      source,
      notes: { type: String, trim: true }
    },
    options
  )
);
export const DiaperModel = model<DiaperRecord>(
  'Diaper',
  new Schema<DiaperRecord>(
    {
      babyId,
      kind: { type: String, enum: ['wet', 'dirty', 'mixed'], required: true },
      timestamp: { type: Date, required: true },
      source,
      notes: { type: String, trim: true }
    },
    options
  )
);
export const MedicineModel = model<MedicineRecord>(
  'Medicine',
  new Schema<MedicineRecord>(
    {
      babyId,
      name: { type: String, required: true, trim: true },
      dosage: { type: String, required: true, trim: true },
      administrationMethod: {
        type: String,
        enum: ['oral', 'topical', 'inhaled', 'injection', 'other'],
        required: true
      },
      administeredAt: { type: Date, required: true },
      prescribedBy: { type: String, trim: true },
      source,
      notes: { type: String, trim: true }
    },
    options
  )
);
export const VaccinationModel = model<VaccinationRecord>(
  'Vaccination',
  new Schema<VaccinationRecord>(
    {
      babyId,
      name: { type: String, required: true, trim: true },
      administeredAt: { type: Date, required: true },
      doseNumber: { type: Number, min: 1 },
      provider: { type: String, trim: true },
      nextDueAt: { type: Date },
      source,
      notes: { type: String, trim: true }
    },
    options
  )
);
export const GrowthModel = model<GrowthRecord>(
  'Growth',
  new Schema<GrowthRecord>(
    {
      babyId,
      recordedAt: { type: Date, required: true },
      weightKg: { type: Number, min: 0 },
      heightCm: { type: Number, min: 0 },
      headCircumferenceCm: { type: Number, min: 0 },
      source,
      notes: { type: String, trim: true }
    },
    options
  )
);
export const MemoryModel = model<MemoryRecord>(
  'Memory',
  new Schema<MemoryRecord>(
    {
      babyId,
      title: { type: String, required: true, trim: true },
      description: { type: String, trim: true },
      occurredAt: { type: Date, required: true },
      mediaUrls: [{ type: String }],
      source
    },
    options
  )
);
export const TimelineEventModel = model<TimelineEventRecord>(
  'TimelineEvent',
  new Schema<TimelineEventRecord>(
    {
      babyId,
      type: { type: String, enum: ['feed', 'sleep', 'diaper', 'medicine'], required: true },
      eventId: { type: Schema.Types.ObjectId, required: true },
      occurredAt: { type: Date, required: true },
      source,
      event: { type: Schema.Types.Mixed, required: true }
    },
    options
  )
);
export const AIInsightModel = model<AIInsightRecord>(
  'AIInsight',
  new Schema<AIInsightRecord>(
    {
      babyId,
      title: { type: String, required: true, trim: true },
      summary: { type: String, required: true, trim: true },
      category: {
        type: String,
        enum: ['pattern', 'recommendation', 'alert', 'milestone'],
        required: true
      },
      confidence: {
        type: String,
        enum: ['learning', 'low', 'medium', 'high', 'very_high'],
        required: true
      },
      generatedAt: { type: Date, required: true },
      relatedEventIds: [{ type: Schema.Types.ObjectId }],
      isDismissed: { type: Boolean, default: false }
    },
    options
  )
);
export const NotificationModel = model<NotificationRecord>(
  'Notification',
  new Schema<NotificationRecord>(
    {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      babyId: { type: Schema.Types.ObjectId, ref: 'Baby' },
      title: { type: String, required: true, trim: true },
      body: { type: String, required: true, trim: true },
      channel: { type: String, enum: ['push', 'whatsapp', 'email', 'in_app'], required: true },
      status: { type: String, enum: ['pending', 'sent', 'read', 'failed'], default: 'pending' },
      scheduledFor: Date,
      sentAt: Date,
      readAt: Date,
      data: { type: Map, of: String }
    },
    options
  )
);
export const SettingsModel = model<SettingsRecord>(
  'Settings',
  new Schema<SettingsRecord>(
    {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
      timezone: { type: String, required: true },
      locale: { type: String, required: true },
      notificationChannels: [{ type: String, enum: ['push', 'whatsapp', 'email', 'in_app'] }],
      quietHours: { start: String, end: String },
      allowAIInsights: { type: Boolean, default: true }
    },
    options
  )
);
export const ConversationModel = model<ConversationRecord>(
  'Conversation',
  new Schema<ConversationRecord>(
    {
      parentId: { type: Schema.Types.ObjectId, ref: 'Parent', required: true },
      babyId: { type: Schema.Types.ObjectId, ref: 'Baby' },
      channel: { type: String, enum: ['whatsapp', 'in_app'], required: true },
      messages: [
        {
          id: { type: String, required: true },
          sender: { type: String, enum: ['parent', 'assistant', 'system'], required: true },
          text: { type: String, required: true },
          sentAt: { type: Date, required: true },
          metadata: Schema.Types.Mixed
        }
      ],
      lastMessageAt: { type: Date, required: true }
    },
    options
  )
);

for (const collection of [
  FeedModel,
  SleepModel,
  DiaperModel,
  MedicineModel,
  VaccinationModel,
  GrowthModel,
  MemoryModel,
  AIInsightModel
])
  collection.schema.index({ babyId: 1, createdAt: -1 });
TimelineEventModel.schema.index({ babyId: 1, occurredAt: -1 });
