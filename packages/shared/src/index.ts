import type { RhythmSample } from '@momaa/types';

export function calculateAverageBpm(samples: readonly RhythmSample[]): number | null {
  if (samples.length === 0) return null;

  return samples.reduce((total, sample) => total + sample.bpm, 0) / samples.length;
}
