import {
  BabyModel,
  DiaperModel,
  FeedModel,
  GrowthModel,
  MemoryModel,
  MedicineModel,
  SleepModel,
  VaccinationModel
} from '../models/index.js';
import { buildRhythm } from '../services/rhythm.service.js';
import type { RhythmInsight } from '@momaa/types';

export type BabyMemoryEventType =
  | 'feed'
  | 'sleep'
  | 'diaper'
  | 'medicine'
  | 'vaccination'
  | 'growth'
  | 'memory';

export type BabyMemoryEvent = {
  type: BabyMemoryEventType;
  occurredAt: Date;
  summary: string;
  source: string;
};

export type BabyMemoryProfile = {
  firstName: string;
  dateOfBirth: Date;
  sex?: string;
  medicalNotes?: string;
};

export type BabyMemoryFeedback = {
  summary: string;
  createdAt: Date;
};

/**
 * Stable contract for all future AI channels. Patterns and feedback are empty
 * during the foundation phase; later phases can populate them without changing
 * the callers or the prompt renderer.
 */
export type BabyMemoryContext = {
  version: 'v1';
  profile: BabyMemoryProfile;
  recentEvents: BabyMemoryEvent[];
  patterns: string[];
  parentFeedback: BabyMemoryFeedback[];
  generatedAt: Date;
};

export type BabyMemoryOptions = {
  since?: Date;
  eventLimit?: number;
  timeZone?: string;
};

export type BuildBabyMemoryContextInput = {
  babyId: string;
  timeZone: string;
};

export interface BabyMemoryRepository {
  loadProfile(babyId: string): Promise<BabyMemoryProfile | null>;
  loadRecentEvents(babyId: string, since: Date): Promise<BabyMemoryEvent[]>;
}

export type BabyMemoryPatternAdapter = (input: {
  babyId: string;
  babyName: string;
  timeZone: string;
}) => Promise<string[]>;

const defaultEventLimit = 40;
const defaultWindowMs = 72 * 60 * 60 * 1_000;
const maxContextLineLength = 320;

function formatNumber(value: number | undefined, unit: string): string | undefined {
  return value === undefined ? undefined : `${value}${unit}`;
}

export const mongoBabyMemoryRepository: BabyMemoryRepository = {
  async loadProfile(babyId) {
    const baby = await BabyModel.findById(babyId).lean();
    if (!baby) return null;
    return {
      firstName: baby.firstName,
      dateOfBirth: baby.dateOfBirth,
      sex: baby.sex,
      medicalNotes: baby.medicalNotes
    };
  },
  async loadRecentEvents(babyId, since) {
    const [feeds, sleeps, diapers, medicines, vaccinations, growth, memories] = await Promise.all([
      FeedModel.find({ babyId, timestamp: { $gte: since } }).lean(),
      SleepModel.find({ babyId, startTime: { $gte: since } }).lean(),
      DiaperModel.find({ babyId, timestamp: { $gte: since } }).lean(),
      MedicineModel.find({ babyId, administeredAt: { $gte: since } }).lean(),
      VaccinationModel.find({ babyId, administeredAt: { $gte: since } }).lean(),
      GrowthModel.find({ babyId, recordedAt: { $gte: since } }).lean(),
      MemoryModel.find({ babyId, occurredAt: { $gte: since } }).lean()
    ]);
    return [
      ...feeds.map((event) => ({
        type: 'feed' as const,
        occurredAt: event.timestamp,
        summary: `Feed${event.amountMl === undefined ? '' : `: ${event.amountMl}ml`}${event.method ? ` (${event.method})` : ''}`,
        source: event.source
      })),
      ...sleeps.map((event) => ({
        type: 'sleep' as const,
        occurredAt: event.startTime,
        summary: `Sleep${event.durationMinutes === undefined ? ' started' : `: ${event.durationMinutes} minutes`}`,
        source: event.source
      })),
      ...diapers.map((event) => ({
        type: 'diaper' as const,
        occurredAt: event.timestamp,
        summary: `${event.kind} diaper change`,
        source: event.source
      })),
      ...medicines.map((event) => ({
        type: 'medicine' as const,
        occurredAt: event.administeredAt,
        summary: `Medicine: ${event.name}${event.dosage ? ` (${event.dosage})` : ''}`,
        source: event.source
      })),
      ...vaccinations.map((event) => ({
        type: 'vaccination' as const,
        occurredAt: event.administeredAt,
        summary: `Vaccination: ${event.name}`,
        source: event.source
      })),
      ...growth.map((event) => ({
        type: 'growth' as const,
        occurredAt: event.recordedAt,
        summary: `Growth: ${[
          formatNumber(event.weightKg, 'kg'),
          formatNumber(event.heightCm, 'cm'),
          formatNumber(event.headCircumferenceCm, 'cm head circumference')
        ]
          .filter(Boolean)
          .join(', ') || 'measurement recorded'}`,
        source: event.source
      })),
      ...memories.map((event) => ({
        type: 'memory' as const,
        occurredAt: event.occurredAt,
        summary: `Memory: ${event.description ?? event.title}`,
        source: event.source
      }))
    ];
  }
};

const rhythmTitle: Record<RhythmInsight['type'], string> = {
  feeding: 'Feeding rhythm',
  sleep: 'Sleep rhythm',
  active_hours: 'Active hours',
  growth: 'Growth trend'
};

/**
 * Converts the existing Rhythm service's safe, observational insight output
 * into compact Baby Memory facts. It deliberately does not calculate patterns
 * itself, so mobile Rhythm and AI chat have one source of truth.
 */
export function createRhythmPatternAdapter(
  rhythmBuilder: typeof buildRhythm = buildRhythm
): BabyMemoryPatternAdapter {
  return async ({ babyId, babyName, timeZone }) => {
    const rhythm = await rhythmBuilder({ babyId, babyName, timeZone });
    return rhythm.insights.map(
      (insight) => `${rhythmTitle[insight.type]} (${insight.confidenceLevel} confidence): ${insight.insight}`
    );
  };
}

export const rhythmPatternAdapter = createRhythmPatternAdapter();

export async function readBabyMemory(
  babyId: string,
  options: BabyMemoryOptions = {},
  repository: BabyMemoryRepository = mongoBabyMemoryRepository,
  patternAdapter?: BabyMemoryPatternAdapter
): Promise<BabyMemoryContext | null> {
  const since = options.since ?? new Date(Date.now() - defaultWindowMs);
  const eventLimit = options.eventLimit ?? defaultEventLimit;
  const [profile, events] = await Promise.all([
    repository.loadProfile(babyId),
    repository.loadRecentEvents(babyId, since)
  ]);
  if (!profile) return null;
  const resolvedPatternAdapter =
    patternAdapter ?? (repository === mongoBabyMemoryRepository ? rhythmPatternAdapter : undefined);
  let patterns: string[] = [];
  if (resolvedPatternAdapter) {
    try {
      patterns = await resolvedPatternAdapter({
        babyId,
        babyName: profile.firstName,
        timeZone: options.timeZone ?? 'UTC'
      });
    } catch (error) {
      // Pattern context is additive; a temporary Rhythm failure must never
      // block a chat response that can still rely on recorded events.
      console.warn('[baby-memory] Rhythm pattern adapter failed.', error);
    }
  }
  return {
    version: 'v1',
    profile,
    recentEvents: events
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
      .slice(0, eventLimit),
    patterns,
    parentFeedback: [],
    generatedAt: new Date()
  };
}

let babyMemoryContextBuilderForTesting:
  | ((input: BuildBabyMemoryContextInput) => Promise<BabyMemoryContext | null>)
  | undefined;

/** The production entry point used by chat once the feature flag is enabled. */
export async function buildBabyMemoryContext(
  input: BuildBabyMemoryContextInput
): Promise<BabyMemoryContext | null> {
  if (babyMemoryContextBuilderForTesting) return babyMemoryContextBuilderForTesting(input);
  return readBabyMemory(input.babyId, { timeZone: input.timeZone });
}

/** Test-only seam that proves the flag-off path never assembles Baby Memory. */
export function setBabyMemoryContextBuilderForTesting(
  builder?: (input: BuildBabyMemoryContextInput) => Promise<BabyMemoryContext | null>
): void {
  babyMemoryContextBuilderForTesting = builder;
}

function truncate(value: string, maximum = maxContextLineLength): string {
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}

function displayTime(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone
  }).format(value);
}

/** Renders bounded, factual context suitable for the existing AI provider. */
export function renderBabyMemoryContext(context: BabyMemoryContext, timeZone = 'UTC'): string {
  const eventLines = context.recentEvents.length
    ? context.recentEvents.map((event) =>
        `- ${displayTime(event.occurredAt, timeZone)}: ${truncate(event.summary)} (recorded via ${event.source})`
      )
    : ['- No recent recorded events yet.'];
  const profileLines = [
    `Name: ${context.profile.firstName}`,
    `Date of birth: ${context.profile.dateOfBirth.toISOString().slice(0, 10)}`,
    ...(context.profile.sex ? [`Sex: ${context.profile.sex}`] : []),
    ...(context.profile.medicalNotes
      ? [`Parent-provided medical notes: ${truncate(context.profile.medicalNotes)}`]
      : [])
  ];
  const patternLines = context.patterns.length
    ? context.patterns.map((pattern) => `- ${truncate(pattern)}`)
    : ['- None generated yet.'];
  return [
    'Baby Memory context (recorded information only; do not invent missing events or medical facts).',
    'Baby profile:',
    ...profileLines.map((line) => `- ${line}`),
    'Recent events:',
    ...eventLines,
    'Known patterns:',
    ...patternLines,
    'Parent feedback: none recorded yet.'
  ].join('\n');
}

/** Feature flag reserved for the later chat integration. Defaults to current behavior. */
export function useBabyMemoryContext(): boolean {
  return process.env.USE_BABY_MEMORY_CONTEXT === 'true';
}
