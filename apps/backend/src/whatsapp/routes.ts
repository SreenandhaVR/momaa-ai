import { Router } from 'express';
import { BabyModel, ParentModel, SleepModel } from '../models/index.js';
import { buildRecentBabySummary } from '../ai/context.js';
import { respondToBabyChat } from '../services/chat.service.js';
import {
  createDiaper,
  createFeed,
  createMediaMemory,
  createSleep,
  endSleep
} from '../services/event-creation.service.js';
import { sendWhatsAppMessage } from './client.js';
import { parseWhatsAppIntent } from './intents.js';
import { uploadWhatsAppMediaToCloudinary } from './media.js';
import { parseWhatsAppWebhook, type IncomingWhatsAppMessage } from './parser.js';

function logMessage(
  message: IncomingWhatsAppMessage,
  event: string,
  details: Record<string, unknown> = {}
): void {
  console.info(
    JSON.stringify({
      scope: 'whatsapp.webhook',
      event,
      messageType: message.type,
      senderLast4: message.from.slice(-4),
      hasContent: Boolean(message.content),
      hasMedia: Boolean(message.mediaId),
      ...details
    })
  );
}

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const details = 'details' in error ? error.details : undefined;
    return {
      name: error.name,
      message: error.message,
      ...(details === undefined ? {} : { details })
    };
  }
  return { error };
}

async function createEvent<T>(
  message: IncomingWhatsAppMessage,
  type: string,
  action: () => Promise<T>
): Promise<T> {
  logMessage(message, 'event_creation_attempted', { type });
  try {
    const result = await action();
    logMessage(message, 'event_creation_succeeded', { type });
    return result;
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: 'whatsapp.webhook',
        event: 'event_creation_failed',
        type,
        ...describeError(error)
      })
    );
    throw error;
  }
}

async function reply(message: IncomingWhatsAppMessage, text: string): Promise<void> {
  logMessage(message, 'outgoing_reply_attempted', { replyLength: text.length });
  try {
    await sendWhatsAppMessage(message.from, text);
    logMessage(message, 'outgoing_reply_succeeded');
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: 'whatsapp.webhook',
        event: 'outgoing_reply_failed',
        ...describeError(error)
      })
    );
  }
}

async function handleMessage(message: IncomingWhatsAppMessage): Promise<void> {
  logMessage(message, 'message_received');
  const parent = await ParentModel.findOne({ phoneNumber: message.from });
  logMessage(message, 'parent_lookup_completed', { found: Boolean(parent) });
  if (!parent)
    return reply(
      message,
      'I could not find a Momaa family linked to this WhatsApp number. Please finish onboarding in the Momaa app.'
    );
  const baby = await BabyModel.findOne({ parentIds: parent._id }).sort({ updatedAt: -1 });
  logMessage(message, 'baby_lookup_completed', { found: Boolean(baby) });
  if (!baby)
    return reply(
      message,
      'Please add a baby profile in the Momaa app before logging updates here.'
    );
  if (message.mediaId) {
    try {
      const mediaUrl = await uploadWhatsAppMediaToCloudinary(message.mediaId);
      await createEvent(message, 'media_memory', () =>
        createMediaMemory({
          babyId: String(baby._id),
          title: message.type === 'audio' ? 'WhatsApp voice note' : 'WhatsApp image',
          mediaUrl,
          source: 'whatsapp',
          occurredAt: message.timestamp
        })
      );
    } catch (error) {
      console.error('WhatsApp media processing failed:', error);
    }
  }
  logMessage(message, 'intent_extraction_called');
  const intent = parseWhatsAppIntent(message.content);
  logMessage(message, 'intent_extraction_result', { intent: intent?.type ?? null });
  if (intent?.type === 'feed') {
    await createEvent(message, 'feed', () =>
      createFeed({
        babyId: String(baby._id),
        amountMl: intent.amountMl,
        method: 'bottle',
        source: 'whatsapp',
        timestamp: message.timestamp
      })
    );
    return reply(message, `Logged a ${intent.amountMl} ml feed.`);
  }
  if (intent?.type === 'sleep_start') {
    await createEvent(message, 'sleep_start', () =>
      createSleep({
        babyId: String(baby._id),
        startTime: message.timestamp ?? new Date(),
        endTime: null,
        isActive: true,
        source: 'whatsapp'
      })
    );
    return reply(message, 'I started a sleep session.');
  }
  if (intent?.type === 'sleep_end') {
    const active = await SleepModel.findOne({ babyId: baby._id, isActive: true }).sort({
      startTime: -1
    });
    const ended = active
      ? await createEvent(message, 'sleep_end', () =>
          endSleep({ sleepId: String(active._id), endTime: message.timestamp })
        )
      : null;
    return reply(
      message,
      ended
        ? `Sleep session ended — ${ended.durationMinutes ?? 0} minutes recorded.`
        : 'I could not find an active sleep session to end.'
    );
  }
  if (intent?.type === 'diaper') {
    await createEvent(message, 'diaper', () =>
      createDiaper({
        babyId: String(baby._id),
        kind: 'wet',
        source: 'whatsapp',
        timestamp: message.timestamp
      })
    );
    return reply(message, 'Logged a diaper change.');
  }
  if (intent?.type === 'summary')
    return reply(message, await buildRecentBabySummary(String(baby._id)));
  if (!message.content)
    return reply(
      message,
      'I saved that as a memory. You can also send a note such as “Fed 90ml” to log an update.'
    );
  const chat = await respondToBabyChat({
    babyId: String(baby._id),
    parentId: String(parent._id),
    message: message.content
  });
  return reply(message, chat.reply);
}

export const whatsappRouter: Router = Router();
whatsappRouter.get('/webhook/whatsapp', (request, response) => {
  const mode = request.query['hub.mode'];
  const token = request.query['hub.verify_token'];
  const challenge = request.query['hub.challenge'];
  if (
    mode === 'subscribe' &&
    token === process.env.WHATSAPP_VERIFY_TOKEN &&
    typeof challenge === 'string'
  )
    return response.status(200).type('text/plain').send(challenge);
  return response.sendStatus(403);
});
whatsappRouter.post('/webhook/whatsapp', async (request, response, next) => {
  try {
    for (const message of parseWhatsAppWebhook(request.body)) await handleMessage(message);
    response.sendStatus(200);
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: 'whatsapp.webhook',
        event: 'message_handling_failed',
        ...describeError(error)
      })
    );
    next(error);
  }
});
