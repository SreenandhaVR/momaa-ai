import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { ApiError, asyncHandler } from '../errors.js';
import { BabyModel, ConversationModel, NotificationModel, SettingsModel } from '../models/index.js';
import { validateBody } from '../validation.js';

const date = z.string().datetime({ offset: true });
const channels = z.enum(['push', 'whatsapp', 'email', 'in_app']);
const serialize = (document: { toObject: () => Record<string, unknown> }) => {
  const raw = document.toObject();
  const output: Record<string, unknown> = { id: String(raw._id) };
  for (const [key, value] of Object.entries(raw))
    if (key !== '_id' && key !== '__v')
      output[key] = value instanceof Date ? value.toISOString() : value;
  return output;
};
async function ownBaby(babyId: string | undefined, parentId: string): Promise<void> {
  if (!babyId) return;
  if (!(await BabyModel.exists({ _id: babyId, parentIds: parentId })))
    throw new ApiError(404, 'NOT_FOUND', 'Baby profile not found.');
}

const notificationBody = z
  .object({
    babyId: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .optional(),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(2_000),
    channel: channels,
    status: z.enum(['pending', 'sent', 'read', 'failed']).default('pending'),
    scheduledFor: date.optional(),
    sentAt: date.optional(),
    readAt: date.optional(),
    data: z.record(z.string(), z.string()).optional()
  })
  .strict();
const settingsBody = z
  .object({
    timezone: z.string().trim().min(1).max(100),
    locale: z.string().trim().min(1).max(50),
    notificationChannels: z.array(channels),
    quietHours: z
      .object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) })
      .optional(),
    allowAIInsights: z.boolean()
  })
  .strict();
const conversationBody = z
  .object({
    babyId: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .optional(),
    channel: z.enum(['whatsapp', 'in_app']),
    messages: z.array(
      z.object({
        id: z.string().min(1),
        sender: z.enum(['parent', 'assistant', 'system']),
        text: z.string().min(1),
        sentAt: date,
        metadata: z.record(z.string(), z.unknown()).optional()
      })
    ),
    lastMessageAt: date
  })
  .strict();
const hasFields = (value: Record<string, unknown>) => Object.keys(value).length > 0;

export const supportRouter: Router = Router();
supportRouter.use(requireAuth);

supportRouter.get(
  '/notifications',
  asyncHandler(async (request, response) =>
    response.json({
      data: (
        await NotificationModel.find({ userId: request.auth!.userId }).sort({ createdAt: -1 })
      ).map(serialize)
    })
  )
);
supportRouter.post(
  '/notifications',
  validateBody(notificationBody),
  asyncHandler(async (request, response) => {
    const input = request.body as z.infer<typeof notificationBody>;
    await ownBaby(input.babyId, request.auth!.parentId);
    const notification = await NotificationModel.create({
      ...input,
      userId: request.auth!.userId,
      scheduledFor: input.scheduledFor && new Date(input.scheduledFor),
      sentAt: input.sentAt && new Date(input.sentAt),
      readAt: input.readAt && new Date(input.readAt)
    });
    response.status(201).json({ data: serialize(notification) });
  })
);
supportRouter.patch(
  '/notifications/:id',
  validateBody(notificationBody.partial().refine(hasFields)),
  asyncHandler(async (request, response) => {
    const input = request.body as Partial<z.infer<typeof notificationBody>>;
    await ownBaby(input.babyId, request.auth!.parentId);
    const notification = await NotificationModel.findOneAndUpdate(
      { _id: request.params.id, userId: request.auth!.userId },
      input,
      { returnDocument: 'after', includeResultMetadata: false, runValidators: true }
    );
    if (!notification) throw new ApiError(404, 'NOT_FOUND', 'Notification not found.');
    response.json({ data: serialize(notification) });
  })
);
supportRouter.delete(
  '/notifications/:id',
  asyncHandler(async (request, response) => {
    const deleted = await NotificationModel.findOneAndDelete({
      _id: request.params.id,
      userId: request.auth!.userId
    });
    if (!deleted) throw new ApiError(404, 'NOT_FOUND', 'Notification not found.');
    response.status(204).send();
  })
);

supportRouter.get(
  '/settings',
  asyncHandler(async (request, response) => {
    const settings = await SettingsModel.findOne({ userId: request.auth!.userId });
    response.json({ data: settings ? serialize(settings) : null });
  })
);
supportRouter.put(
  '/settings',
  validateBody(settingsBody),
  asyncHandler(async (request, response) => {
    const settings = await SettingsModel.findOneAndUpdate(
      { userId: request.auth!.userId },
      { ...request.body, userId: request.auth!.userId },
      {
        upsert: true,
        returnDocument: 'after',
        includeResultMetadata: false,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );
    response.json({ data: serialize(settings) });
  })
);
supportRouter.patch(
  '/settings',
  validateBody(settingsBody.partial().refine(hasFields)),
  asyncHandler(async (request, response) => {
    const settings = await SettingsModel.findOneAndUpdate(
      { userId: request.auth!.userId },
      request.body,
      { returnDocument: 'after', includeResultMetadata: false, runValidators: true }
    );
    if (!settings) throw new ApiError(404, 'NOT_FOUND', 'Settings not found.');
    response.json({ data: serialize(settings) });
  })
);
supportRouter.delete(
  '/settings',
  asyncHandler(async (request, response) => {
    await SettingsModel.deleteOne({ userId: request.auth!.userId });
    response.status(204).send();
  })
);

supportRouter.get(
  '/conversations',
  asyncHandler(async (request, response) =>
    response.json({
      data: (
        await ConversationModel.find({ parentId: request.auth!.parentId }).sort({
          lastMessageAt: -1
        })
      ).map(serialize)
    })
  )
);
supportRouter.post(
  '/conversations',
  validateBody(conversationBody),
  asyncHandler(async (request, response) => {
    const input = request.body as z.infer<typeof conversationBody>;
    await ownBaby(input.babyId, request.auth!.parentId);
    const conversation = await ConversationModel.create({
      ...input,
      parentId: request.auth!.parentId,
      lastMessageAt: new Date(input.lastMessageAt),
      messages: input.messages.map((message) => ({ ...message, sentAt: new Date(message.sentAt) }))
    });
    response.status(201).json({ data: serialize(conversation) });
  })
);
supportRouter.patch(
  '/conversations/:id',
  validateBody(conversationBody.partial().refine(hasFields)),
  asyncHandler(async (request, response) => {
    const input = request.body as Partial<z.infer<typeof conversationBody>>;
    await ownBaby(input.babyId, request.auth!.parentId);
    const conversation = await ConversationModel.findOneAndUpdate(
      { _id: request.params.id, parentId: request.auth!.parentId },
      input,
      { returnDocument: 'after', includeResultMetadata: false, runValidators: true }
    );
    if (!conversation) throw new ApiError(404, 'NOT_FOUND', 'Conversation not found.');
    response.json({ data: serialize(conversation) });
  })
);
supportRouter.delete(
  '/conversations/:id',
  asyncHandler(async (request, response) => {
    const deleted = await ConversationModel.findOneAndDelete({
      _id: request.params.id,
      parentId: request.auth!.parentId
    });
    if (!deleted) throw new ApiError(404, 'NOT_FOUND', 'Conversation not found.');
    response.status(204).send();
  })
);
