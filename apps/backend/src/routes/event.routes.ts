import type { Model, Types } from 'mongoose';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { ApiError, asyncHandler } from '../errors.js';
import {
  AIInsightModel,
  BabyModel,
  DiaperModel,
  FeedModel,
  GrowthModel,
  MedicineModel,
  MemoryModel,
  SleepModel,
  TimelineEventModel,
  VaccinationModel
} from '../models/index.js';
import {
  removeTimelineEvent,
  syncTimelineEvent,
  type TimelineSourceType
} from '../services/timeline.service.js';
import { validateBody } from '../validation.js';
import {
  createDiaper,
  createFeed,
  createSleep,
  endSleep
} from '../services/event-creation.service.js';

type Stored = Record<string, unknown> & {
  _id: Types.ObjectId;
  babyId: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};
type GenericModel = Model<Record<string, unknown>>;
const date = z.string().datetime({ offset: true });
const source = z.enum(['app', 'whatsapp', 'import', 'system']);
const optionalText = z.string().trim().max(5_000).optional();

function hasFields(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}
function param(value: string | string[] | undefined): string {
  if (typeof value !== 'string')
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid route parameter.');
  return value;
}
function dates(input: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const output = { ...input };
  for (const field of fields)
    if (typeof output[field] === 'string') output[field] = new Date(output[field] as string);
  return output;
}
function serialize(document: unknown): Record<string, unknown> {
  const value = document as { toObject: () => Record<string, unknown> };
  const raw = value.toObject();
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(raw)) {
    if (key === '_id' || key === '__v') continue;
    result[key] = item instanceof Date ? item.toISOString() : item;
  }
  result.id = String(raw._id);
  return result;
}
async function ensureBabyAccess(babyId: string, parentId: string): Promise<void> {
  const baby = await BabyModel.findOne({ _id: babyId, parentIds: parentId });
  if (!baby) throw new ApiError(404, 'NOT_FOUND', 'Baby profile not found.');
}

interface ResourceConfig {
  model: GenericModel;
  createSchema: z.ZodObject<z.ZodRawShape>;
  updateSchema: z.ZodObject<z.ZodRawShape>;
  dateFields: string[];
  timeline?: { type: TimelineSourceType; occurredAt: string };
}

const feedBody = z
  .object({
    amountMl: z.number().positive().optional(),
    method: z.enum(['breast', 'bottle']),
    timestamp: date,
    durationMinutes: z.number().int().nonnegative().optional(),
    side: z.enum(['left', 'right', 'both']).optional(),
    source,
    notes: optionalText
  })
  .strict();
const sleepBody = z
  .object({
    startTime: date,
    endTime: date.nullable().optional(),
    durationMinutes: z.number().int().nonnegative().optional(),
    isActive: z.boolean(),
    source,
    notes: optionalText
  })
  .strict();
const diaperBody = z
  .object({ kind: z.enum(['wet', 'dirty', 'mixed']), timestamp: date, source, notes: optionalText })
  .strict();
const medicineBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    dosage: z.string().trim().min(1).max(100),
    administrationMethod: z.enum(['oral', 'topical', 'inhaled', 'injection', 'other']),
    administeredAt: date,
    prescribedBy: z.string().trim().max(200).optional(),
    source,
    notes: optionalText
  })
  .strict();
const vaccinationBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    administeredAt: date,
    doseNumber: z.number().int().positive().optional(),
    provider: z.string().trim().max(200).optional(),
    nextDueAt: date.optional(),
    source,
    notes: optionalText
  })
  .strict();
const growthBody = z
  .object({
    recordedAt: date,
    weightKg: z.number().nonnegative().optional(),
    heightCm: z.number().nonnegative().optional(),
    headCircumferenceCm: z.number().nonnegative().optional(),
    source,
    notes: optionalText
  })
  .strict();
const memoryBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: optionalText,
    occurredAt: date,
    mediaUrls: z.array(z.string().url().max(2_000)).default([]),
    source
  })
  .strict();
const insightBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    summary: z.string().trim().min(1).max(5_000),
    category: z.enum(['pattern', 'recommendation', 'alert', 'milestone']),
    confidence: z.enum(['learning', 'low', 'medium', 'high', 'very_high']),
    generatedAt: date,
    relatedEventIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).default([]),
    isDismissed: z.boolean().default(false)
  })
  .strict();
const editable = <T extends z.ZodObject<z.ZodRawShape>>(schema: T) =>
  schema.partial().refine(hasFields, 'Provide at least one field to update.');

const resources: Record<string, ResourceConfig> = {
  feeds: {
    model: FeedModel as unknown as GenericModel,
    createSchema: feedBody,
    updateSchema: editable(feedBody),
    dateFields: ['timestamp'],
    timeline: { type: 'feed', occurredAt: 'timestamp' }
  },
  sleeps: {
    model: SleepModel as unknown as GenericModel,
    createSchema: sleepBody,
    updateSchema: editable(sleepBody),
    dateFields: ['startTime', 'endTime'],
    timeline: { type: 'sleep', occurredAt: 'startTime' }
  },
  diapers: {
    model: DiaperModel as unknown as GenericModel,
    createSchema: diaperBody,
    updateSchema: editable(diaperBody),
    dateFields: ['timestamp'],
    timeline: { type: 'diaper', occurredAt: 'timestamp' }
  },
  medicines: {
    model: MedicineModel as unknown as GenericModel,
    createSchema: medicineBody,
    updateSchema: editable(medicineBody),
    dateFields: ['administeredAt'],
    timeline: { type: 'medicine', occurredAt: 'administeredAt' }
  },
  vaccinations: {
    model: VaccinationModel as unknown as GenericModel,
    createSchema: vaccinationBody,
    updateSchema: editable(vaccinationBody),
    dateFields: ['administeredAt', 'nextDueAt']
  },
  growth: {
    model: GrowthModel as unknown as GenericModel,
    createSchema: growthBody,
    updateSchema: editable(growthBody),
    dateFields: ['recordedAt']
  },
  memories: {
    model: MemoryModel as unknown as GenericModel,
    createSchema: memoryBody,
    updateSchema: editable(memoryBody),
    dateFields: ['occurredAt']
  },
  'ai-insights': {
    model: AIInsightModel as unknown as GenericModel,
    createSchema: insightBody,
    updateSchema: editable(insightBody),
    dateFields: ['generatedAt']
  }
};

async function synchronize(config: ResourceConfig, document: Stored): Promise<void> {
  if (!config.timeline) return;
  const event = serialize(document);
  const occurredAt = document[config.timeline.occurredAt];
  await syncTimelineEvent({
    babyId: document.babyId,
    type: config.timeline.type,
    eventId: document._id,
    occurredAt: occurredAt as Date,
    source: String(document.source),
    event
  });
}

const endSleepBody = z.object({ endTime: date.optional() }).strict();
const startSleepBody = z
  .object({ startTime: date.optional(), source: source.default('app'), notes: optionalText })
  .strict();
const timelineQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
});

export const eventRouter: Router = Router();
eventRouter.use(requireAuth);

eventRouter.post(
  '/babies/:babyId/sleep/start',
  validateBody(startSleepBody),
  asyncHandler(async (request, response) => {
    const babyId = param(request.params.babyId);
    await ensureBabyAccess(babyId, request.auth!.parentId);
    const input = request.body as z.infer<typeof startSleepBody>;
    const sleep = await createSleep({
      babyId,
      startTime: input.startTime ? new Date(input.startTime) : new Date(),
      endTime: null,
      isActive: true,
      source: input.source,
      notes: input.notes
    });
    response.status(201).json({ data: serialize(sleep) });
  })
);

eventRouter.post(
  '/sleep/:id/end',
  validateBody(endSleepBody),
  asyncHandler(async (request, response) => {
    const sleep = await SleepModel.findOne({ _id: param(request.params.id), isActive: true });
    if (!sleep) throw new ApiError(404, 'NOT_FOUND', 'Active sleep session not found.');
    await ensureBabyAccess(String(sleep.babyId), request.auth!.parentId);
    const input = request.body as z.infer<typeof endSleepBody>;
    const ended = await endSleep({
      sleepId: String(sleep._id),
      endTime: input.endTime ? new Date(input.endTime) : undefined
    });
    if (!ended) throw new ApiError(404, 'NOT_FOUND', 'Active sleep session not found.');
    response.json({ data: serialize(ended) });
  })
);

eventRouter.get(
  '/babies/:babyId/timeline',
  asyncHandler(async (request, response) => {
    const babyId = param(request.params.babyId);
    await ensureBabyAccess(babyId, request.auth!.parentId);
    const parsed = timelineQuery.safeParse(request.query);
    if (!parsed.success) throw parsed.error;
    const filter: Record<string, unknown> = { babyId };
    if (parsed.data.date) {
      const start = new Date(`${parsed.data.date}T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      filter.occurredAt = { $gte: start, $lt: end };
    }
    const events = await TimelineEventModel.find(filter).sort({ occurredAt: -1 });
    response.json({ data: events.map(serialize) });
  })
);

eventRouter.post(
  '/babies/:babyId/:collection',
  asyncHandler(async (request, response, next) => {
    const collection = param(request.params.collection);
    const babyId = param(request.params.babyId);
    const config = resources[collection];
    if (!config) return next(new ApiError(404, 'NOT_FOUND', 'Event resource not found.'));
    return validateBody(config.createSchema)(request, response, async (error) => {
      if (error) return next(error);
      try {
        await ensureBabyAccess(babyId, request.auth!.parentId);
        const input = dates(request.body as Record<string, unknown>, config.dateFields);
        if (
          collection === 'sleeps' &&
          input.endTime instanceof Date &&
          input.startTime instanceof Date &&
          input.durationMinutes === undefined
        )
          input.durationMinutes = Math.round(
            (input.endTime.getTime() - input.startTime.getTime()) / 60_000
          );
        const created =
          collection === 'feeds'
            ? await createFeed({ ...(input as Parameters<typeof createFeed>[0]), babyId })
            : collection === 'diapers'
              ? await createDiaper({ ...(input as Parameters<typeof createDiaper>[0]), babyId })
              : collection === 'sleeps'
                ? await createSleep({ ...(input as Parameters<typeof createSleep>[0]), babyId })
                : await config.model.create({ ...input, babyId });
        if (!['feeds', 'diapers', 'sleeps'].includes(collection))
          await synchronize(config, created as unknown as Stored);
        response.status(201).json({ data: serialize(created) });
      } catch (caught) {
        next(caught);
      }
    });
  })
);

eventRouter.get(
  '/babies/:babyId/:collection',
  asyncHandler(async (request, response, next) => {
    const collection = param(request.params.collection);
    const babyId = param(request.params.babyId);
    const config = resources[collection];
    if (!config) return next(new ApiError(404, 'NOT_FOUND', 'Event resource not found.'));
    await ensureBabyAccess(babyId, request.auth!.parentId);
    const events = await config.model.find({ babyId }).sort({ createdAt: -1 });
    response.json({ data: events.map(serialize) });
  })
);

eventRouter.patch(
  '/:collection/:id',
  asyncHandler(async (request, response, next) => {
    const collection = param(request.params.collection);
    const id = param(request.params.id);
    const config = resources[collection];
    if (!config) return next(new ApiError(404, 'NOT_FOUND', 'Event resource not found.'));
    return validateBody(config.updateSchema)(request, response, async (error) => {
      if (error) return next(error);
      try {
        const existing = await config.model.findById(id);
        if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Event not found.');
        await ensureBabyAccess(
          String((existing as unknown as Stored).babyId),
          request.auth!.parentId
        );
        const updated = await config.model.findByIdAndUpdate(
          id,
          dates(request.body as Record<string, unknown>, config.dateFields),
          { returnDocument: 'after', runValidators: true, includeResultMetadata: false }
        );
        if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Event not found.');
        await synchronize(config, updated as unknown as Stored);
        response.json({ data: serialize(updated) });
      } catch (caught) {
        next(caught);
      }
    });
  })
);

eventRouter.delete(
  '/:collection/:id',
  asyncHandler(async (request, response, next) => {
    const collection = param(request.params.collection);
    const id = param(request.params.id);
    const config = resources[collection];
    if (!config) return next(new ApiError(404, 'NOT_FOUND', 'Event resource not found.'));
    const existing = await config.model.findById(id);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Event not found.');
    await ensureBabyAccess(String((existing as unknown as Stored).babyId), request.auth!.parentId);
    await config.model.deleteOne({ _id: id });
    if (config.timeline)
      await removeTimelineEvent(config.timeline.type, (existing as unknown as Stored)._id);
    response.status(204).send();
  })
);
