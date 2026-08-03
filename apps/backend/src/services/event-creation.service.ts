import { DiaperModel, FeedModel, MemoryModel, SleepModel } from '../models/index.js';
import { syncTimelineEvent } from './timeline.service.js';
import type { Types } from 'mongoose';

function eventSnapshot(document: {
  _id: Types.ObjectId;
  toObject: () => Record<string, unknown>;
}): Record<string, unknown> {
  const raw = document.toObject();
  const event: Record<string, unknown> = { id: String(raw._id) };
  for (const [key, value] of Object.entries(raw))
    if (key !== '_id' && key !== '__v')
      event[key] = value instanceof Date ? value.toISOString() : value;
  return event;
}

export async function createFeed(input: {
  babyId: string;
  amountMl?: number;
  method: 'breast' | 'bottle';
  timestamp?: Date;
  durationMinutes?: number;
  side?: 'left' | 'right' | 'both';
  source: 'app' | 'whatsapp' | 'import' | 'system';
  notes?: string;
}) {
  const feed = await FeedModel.create({ ...input, timestamp: input.timestamp ?? new Date() });
  await syncTimelineEvent({
    babyId: feed.babyId,
    type: 'feed',
    eventId: feed._id,
    occurredAt: feed.timestamp,
    source: feed.source,
    event: eventSnapshot(feed)
  });
  return feed;
}

export async function createDiaper(input: {
  babyId: string;
  kind: 'wet' | 'dirty' | 'mixed';
  timestamp?: Date;
  source: 'app' | 'whatsapp' | 'import' | 'system';
  notes?: string;
}) {
  const diaper = await DiaperModel.create({ ...input, timestamp: input.timestamp ?? new Date() });
  await syncTimelineEvent({
    babyId: diaper.babyId,
    type: 'diaper',
    eventId: diaper._id,
    occurredAt: diaper.timestamp,
    source: diaper.source,
    event: eventSnapshot(diaper)
  });
  return diaper;
}

export async function createSleep(input: {
  babyId: string;
  startTime: Date;
  endTime?: Date | null;
  durationMinutes?: number;
  isActive: boolean;
  source: 'app' | 'whatsapp' | 'import' | 'system';
  notes?: string;
}) {
  const durationMinutes =
    input.durationMinutes ??
    (input.endTime
      ? Math.round((input.endTime.getTime() - input.startTime.getTime()) / 60_000)
      : undefined);
  const sleep = await SleepModel.create({ ...input, durationMinutes });
  await syncTimelineEvent({
    babyId: sleep.babyId,
    type: 'sleep',
    eventId: sleep._id,
    occurredAt: sleep.startTime,
    source: sleep.source,
    event: eventSnapshot(sleep)
  });
  return sleep;
}

export async function endSleep(input: { sleepId: string; endTime?: Date }) {
  const sleep = await SleepModel.findOne({ _id: input.sleepId, isActive: true });
  if (!sleep) return null;
  const endTime = input.endTime ?? new Date();
  if (endTime < sleep.startTime) throw new Error('endTime cannot be before startTime.');
  sleep.endTime = endTime;
  sleep.isActive = false;
  sleep.durationMinutes = Math.round((endTime.getTime() - sleep.startTime.getTime()) / 60_000);
  await sleep.save();
  await syncTimelineEvent({
    babyId: sleep.babyId,
    type: 'sleep',
    eventId: sleep._id,
    occurredAt: sleep.startTime,
    source: sleep.source,
    event: eventSnapshot(sleep)
  });
  return sleep;
}

export async function createMediaMemory(input: {
  babyId: string;
  title: string;
  mediaUrl: string;
  source: 'app' | 'whatsapp' | 'import' | 'system';
  occurredAt?: Date;
}) {
  return MemoryModel.create({
    babyId: input.babyId,
    title: input.title,
    mediaUrls: [input.mediaUrl],
    occurredAt: input.occurredAt ?? new Date(),
    source: input.source
  });
}
