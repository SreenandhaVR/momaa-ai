/** Framework-agnostic primitives shared by the API and client applications. */
export type EntityId = string;
export type ISODateString = string;

export interface Entity {
  id: EntityId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type EventSource = 'app' | 'whatsapp' | 'import' | 'system';
export type FeedMethod = 'breast' | 'bottle';
export type DiaperKind = 'wet' | 'dirty' | 'mixed';
export type MedicineAdministrationMethod = 'oral' | 'topical' | 'inhaled' | 'injection' | 'other';
export type ConversationChannel = 'whatsapp' | 'in_app';
export type ConversationSender = 'parent' | 'assistant' | 'system';
export type NotificationChannel = 'push' | 'whatsapp' | 'email' | 'in_app';
export type NotificationStatus = 'pending' | 'sent' | 'read' | 'failed';
export type ConfidenceLevel = 'learning' | 'low' | 'medium' | 'high' | 'very_high';

export interface User extends Entity {
  email?: string;
  phoneNumber?: string;
  displayName: string;
  avatarUrl?: string;
  parentId?: EntityId;
  lastActiveAt?: ISODateString;
}

export interface Parent extends Entity {
  userId: EntityId;
  firstName: string;
  lastName?: string;
  relationshipToBaby?: string;
  phoneNumber?: string;
  babyIds: EntityId[];
  timezone: string;
}

export interface WhatsAppLink extends Entity {
  phoneNumber: string;
  status: 'pending' | 'verified';
  verifiedAt?: ISODateString;
  verificationExpiresAt?: ISODateString;
}

export interface Baby extends Entity {
  parentIds: EntityId[];
  firstName: string;
  lastName?: string;
  dateOfBirth: ISODateString;
  sex?: 'female' | 'male' | 'intersex' | 'unspecified';
  photoUrl?: string;
  medicalNotes?: string;
}

export interface Feed extends Entity {
  babyId: EntityId;
  amountMl?: number;
  method: FeedMethod;
  timestamp: ISODateString;
  durationMinutes?: number;
  side?: 'left' | 'right' | 'both';
  source: EventSource;
  notes?: string;
}

export interface Sleep extends Entity {
  babyId: EntityId;
  startTime: ISODateString;
  endTime?: ISODateString;
  durationMinutes?: number;
  isActive: boolean;
  source: EventSource;
  notes?: string;
}

export interface Diaper extends Entity {
  babyId: EntityId;
  kind: DiaperKind;
  timestamp: ISODateString;
  source: EventSource;
  notes?: string;
}

export interface Medicine extends Entity {
  babyId: EntityId;
  name: string;
  dosage: string;
  administrationMethod: MedicineAdministrationMethod;
  administeredAt: ISODateString;
  prescribedBy?: string;
  source: EventSource;
  notes?: string;
}

export interface Vaccination extends Entity {
  babyId: EntityId;
  name: string;
  administeredAt: ISODateString;
  doseNumber?: number;
  provider?: string;
  nextDueAt?: ISODateString;
  source: EventSource;
  notes?: string;
}

export interface Growth extends Entity {
  babyId: EntityId;
  recordedAt: ISODateString;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  source: EventSource;
  notes?: string;
}

export interface Memory extends Entity {
  babyId: EntityId;
  title: string;
  description?: string;
  occurredAt: ISODateString;
  mediaUrls: string[];
  source: EventSource;
}

export interface Conversation extends Entity {
  parentId: EntityId;
  babyId?: EntityId;
  channel: ConversationChannel;
  messages: ConversationMessage[];
  lastMessageAt: ISODateString;
}

export interface ConversationMessage {
  id: EntityId;
  sender: ConversationSender;
  text: string;
  sentAt: ISODateString;
  metadata?: Record<string, unknown>;
}

export interface AIInsight extends Entity {
  babyId: EntityId;
  title: string;
  summary: string;
  category: 'pattern' | 'recommendation' | 'alert' | 'milestone';
  confidence: ConfidenceLevel;
  generatedAt: ISODateString;
  relatedEventIds: EntityId[];
  isDismissed: boolean;
}

export interface Notification extends Entity {
  userId: EntityId;
  babyId?: EntityId;
  title: string;
  body: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  scheduledFor?: ISODateString;
  sentAt?: ISODateString;
  readAt?: ISODateString;
  data?: Record<string, string>;
}

export interface Settings extends Entity {
  userId: EntityId;
  timezone: string;
  locale: string;
  notificationChannels: NotificationChannel[];
  quietHours?: { start: string; end: string };
  allowAIInsights: boolean;
}

export type TimelineEventType =
  'feed' | 'sleep' | 'diaper' | 'medicine' | 'vaccination' | 'growth' | 'memory';

interface TimelineEventBase<TType extends TimelineEventType, TEvent> {
  id: EntityId;
  babyId: EntityId;
  type: TType;
  eventId: EntityId;
  occurredAt: ISODateString;
  source: EventSource;
  event: TEvent;
}

/** A normalized, discriminated union for rendering a baby's unified timeline. */
export type TimelineEvent =
  | TimelineEventBase<'feed', Feed>
  | TimelineEventBase<'sleep', Sleep>
  | TimelineEventBase<'diaper', Diaper>
  | TimelineEventBase<'medicine', Medicine>
  | TimelineEventBase<'vaccination', Vaccination>
  | TimelineEventBase<'growth', Growth>
  | TimelineEventBase<'memory', Memory>;

export interface RhythmSample {
  bpm: number;
  confidence: number;
  recordedAt: ISODateString;
}

export type HealthStatus = 'ok';
