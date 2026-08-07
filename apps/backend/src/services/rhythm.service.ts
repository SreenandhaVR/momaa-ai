import type { FeedingFrequencyPoint, RhythmConfidenceLevel, RhythmInsight } from '@momaa/types';
import { DiaperModel, FeedModel, GrowthModel, MemoryModel, SleepModel } from '../models/index.js';

const dayMs = 86_400_000;
const since = (days: number) => new Date(Date.now() - days * dayMs);

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}
function dayKey(date: Date, timeZone: string): string {
  return date.toLocaleDateString('en-CA', { timeZone });
}
function uniqueDays(dates: Date[], timeZone: string): number {
  return new Set(dates.map((date) => dayKey(date, timeZone))).size;
}
function confidence(days: number): RhythmConfidenceLevel {
  if (days < 3) return 'learning';
  if (days < 7) return 'low';
  if (days < 14) return 'medium';
  if (days < 30) return 'high';
  return 'very_high';
}
function localHour(date: Date, timeZone: string): number {
  const value = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone })
    .formatToParts(date)
    .find((part) => part.type === 'hour')?.value;
  return Number(value ?? 0);
}
function localMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
    timeZone
  }).formatToParts(date);
  return (
    Number(parts.find((part) => part.type === 'hour')?.value ?? 0) * 60 +
    Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  );
}
function learning(type: RhythmInsight['type'], count: number, babyName: string): RhythmInsight {
  return {
    type,
    dataPointCount: count,
    confidenceLevel: 'learning',
    insight: `I’m still learning ${babyName}'s rhythm — there isn’t much data yet, so this is a gentle starting point rather than a prediction.`
  };
}
function dayPart(hour: number): string {
  return hour < 6
    ? 'overnight'
    : hour < 12
      ? 'in the morning'
      : hour < 17
        ? 'in the afternoon'
        : hour < 21
          ? 'in the evening'
          : 'at night';
}
function timeBand(hour: number): string {
  const start = Math.floor(hour / 3) * 3;
  const end = (start + 3) % 24;
  const format = (value: number) =>
    `${value === 0 ? 12 : value > 12 ? value - 12 : value}${value < 12 ? 'am' : 'pm'}`;
  return `${format(start)}–${format(end)}`;
}

function feedingInsight(
  feeds: Array<{ timestamp: Date }>,
  timeZone: string,
  babyName: string
): RhythmInsight {
  const days = uniqueDays(
    feeds.map((feed) => feed.timestamp),
    timeZone
  );
  if (feeds.length < 2) return learning('feeding', feeds.length, babyName);
  const ordered = [...feeds].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const intervals = ordered
    .slice(1)
    .map(
      (feed, index) => (feed.timestamp.getTime() - ordered[index].timestamp.getTime()) / 3_600_000
    )
    .filter((hours) => hours <= 12);
  const average = intervals.reduce((sum, value) => sum + value, 0) / Math.max(intervals.length, 1);
  const spread = standardDeviation(intervals);
  const low = Math.max(1, Math.round(average - Math.min(spread, 1)));
  const high = Math.max(low, Math.round(average + Math.min(spread, 1)));
  const parts = new Map<string, number>();
  for (const feed of feeds) {
    const part = dayPart(localHour(feed.timestamp, timeZone));
    parts.set(part, (parts.get(part) ?? 0) + 1);
  }
  const common = [...parts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'through the day';
  const interval =
    intervals.length === 0
      ? 'at varying intervals'
      : low === high
        ? `about every ${low} hour${low === 1 ? '' : 's'}`
        : `about every ${low}–${high} hours`;
  return {
    type: 'feeding',
    dataPointCount: feeds.length,
    confidenceLevel: confidence(days),
    insight: `I noticed ${babyName} has been feeding ${interval}, most often ${common}. Based on recent patterns, this may shift from day to day.`
  };
}
function sleepInsight(
  sleeps: Array<{ startTime: Date }>,
  timeZone: string,
  babyName: string
): RhythmInsight {
  const days = uniqueDays(
    sleeps.map((sleep) => sleep.startTime),
    timeZone
  );
  if (sleeps.length < 2) return learning('sleep', sleeps.length, babyName);
  const minutes = [...sleeps]
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    .map((sleep) => localMinutes(sleep.startTime, timeZone));
  const split = Math.ceil(minutes.length / 2);
  const earlier = standardDeviation(minutes.slice(0, split));
  const recent = standardDeviation(minutes.slice(split));
  const overall = standardDeviation(minutes);
  const consistency =
    overall <= 45
      ? 'fairly consistent'
      : overall <= 90
        ? 'showing some variation'
        : 'varying quite a bit';
  const direction =
    recent < earlier * 0.8
      ? 'and has been becoming more consistent lately'
      : recent > earlier * 1.2
        ? 'and has been less consistent lately'
        : 'and has stayed at a similar level of consistency';
  return {
    type: 'sleep',
    dataPointCount: sleeps.length,
    confidenceLevel: confidence(days),
    insight: `I noticed ${babyName}'s recorded sleep starts are ${consistency} ${direction}. This describes logged timing only, not sleep quality or a health recommendation.`
  };
}
function activeInsight(timestamps: Date[], timeZone: string, babyName: string): RhythmInsight {
  const days = uniqueDays(timestamps, timeZone);
  if (timestamps.length < 2) return learning('active_hours', timestamps.length, babyName);
  const bands = new Map<string, number>();
  for (const timestamp of timestamps) {
    const band = timeBand(localHour(timestamp, timeZone));
    bands.set(band, (bands.get(band) ?? 0) + 1);
  }
  const common = [...bands.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([band]) => band);
  return {
    type: 'active_hours',
    dataPointCount: timestamps.length,
    confidenceLevel: confidence(days),
    insight: `Based on recent feed, diaper, and memory entries, ${babyName} seems most active around ${common.join(' and ')}. This is an observation from what has been logged.`
  };
}
function growthInsight(
  growth: Array<{ recordedAt: Date; weightKg?: number; heightCm?: number }>,
  timeZone: string,
  babyName: string
): RhythmInsight {
  const days = uniqueDays(
    growth.map((entry) => entry.recordedAt),
    timeZone
  );
  if (growth.length < 2) return learning('growth', growth.length, babyName);
  const ordered = [...growth].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const descriptions: string[] = [];
  for (const [field, label] of [
    ['weightKg', 'weight'],
    ['heightCm', 'length']
  ] as const) {
    const values = ordered
      .map((entry) => entry[field])
      .filter((value): value is number => typeof value === 'number');
    if (values.length >= 2)
      descriptions.push(
        values.at(-1)! > values[0]
          ? `${label} entries have increased`
          : values.at(-1)! < values[0]
            ? `${label} entries have decreased`
            : `${label} entries have stayed similar`
      );
  }
  return {
    type: 'growth',
    dataPointCount: growth.length,
    confidenceLevel: confidence(days),
    insight: `I noticed ${babyName}'s ${descriptions.join(' and ') || 'growth entries are still limited'} compared with earlier entries. This is a personal log trend, not a percentile or medical assessment.`
  };
}

export async function buildRhythm(input: {
  babyId: string;
  babyName: string;
  timeZone: string;
}): Promise<{ insights: RhythmInsight[]; feedingFrequency: FeedingFrequencyPoint[] }> {
  const [feeds, sleeps, diapers, memories, growth] = await Promise.all([
    FeedModel.find({ babyId: input.babyId, timestamp: { $gte: since(7) } })
      .select('timestamp')
      .lean(),
    SleepModel.find({ babyId: input.babyId, startTime: { $gte: since(14) } })
      .select('startTime')
      .lean(),
    DiaperModel.find({ babyId: input.babyId, timestamp: { $gte: since(14) } })
      .select('timestamp')
      .lean(),
    MemoryModel.find({ babyId: input.babyId, occurredAt: { $gte: since(14) } })
      .select('occurredAt')
      .lean(),
    GrowthModel.find({ babyId: input.babyId }).select('recordedAt weightKg heightCm').lean()
  ]);
  const now = new Date();
  const feedingFrequency = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(now.getTime() - (6 - offset) * dayMs);
    const key = dayKey(date, input.timeZone);
    return {
      date: key,
      count: feeds.filter((feed) => dayKey(feed.timestamp, input.timeZone) === key).length
    };
  });
  return {
    insights: [
      feedingInsight(feeds, input.timeZone, input.babyName),
      sleepInsight(sleeps, input.timeZone, input.babyName),
      activeInsight(
        [
          ...feeds.map((item) => item.timestamp),
          ...diapers.map((item) => item.timestamp),
          ...memories.map((item) => item.occurredAt)
        ],
        input.timeZone,
        input.babyName
      ),
      growthInsight(growth, input.timeZone, input.babyName)
    ],
    feedingFrequency
  };
}
