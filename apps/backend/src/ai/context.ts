import { DiaperModel, FeedModel, SleepModel } from '../models/index.js';

export async function buildRecentBabySummary(babyId: string): Promise<string> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [feeds, sleeps, diapers] = await Promise.all([
    FeedModel.find({ babyId, timestamp: { $gte: since } }),
    SleepModel.find({ babyId, startTime: { $gte: since } }),
    DiaperModel.find({ babyId, timestamp: { $gte: since } })
  ]);
  const totalMl = feeds.reduce((total, feed) => total + (feed.amountMl ?? 0), 0);
  const sleepMinutes = sleeps.reduce((total, sleep) => total + (sleep.durationMinutes ?? 0), 0);
  const diaperCounts = diapers.reduce<Record<string, number>>((counts, diaper) => {
    counts[diaper.kind] = (counts[diaper.kind] ?? 0) + 1;
    return counts;
  }, {});
  return `Last 24 hours (recorded data): ${feeds.length} feeds${totalMl ? `, ${totalMl} ml total` : ''}; ${sleeps.length} sleep sessions${sleepMinutes ? `, ${sleepMinutes} minutes total` : ''}; ${diapers.length} diaper changes${
    Object.keys(diaperCounts).length
      ? ` (${Object.entries(diaperCounts)
          .map(([kind, count]) => `${count} ${kind}`)
          .join(', ')})`
      : ''
  }.`;
}
