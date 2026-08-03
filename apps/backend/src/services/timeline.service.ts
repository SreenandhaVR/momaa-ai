import type { Types } from 'mongoose';
import { TimelineEventModel } from '../models/index.js';

export type TimelineSourceType = 'feed' | 'sleep' | 'diaper' | 'medicine';

export async function syncTimelineEvent(input: {
  babyId: Types.ObjectId;
  type: TimelineSourceType;
  eventId: Types.ObjectId;
  occurredAt: Date;
  source: string;
  event: Record<string, unknown>;
}): Promise<void> {
  await TimelineEventModel.findOneAndUpdate({ type: input.type, eventId: input.eventId }, input, {
    upsert: true,
    returnDocument: 'after',
    setDefaultsOnInsert: true
  });
}

export async function removeTimelineEvent(
  type: TimelineSourceType,
  eventId: Types.ObjectId
): Promise<void> {
  await TimelineEventModel.deleteOne({ type, eventId });
}
