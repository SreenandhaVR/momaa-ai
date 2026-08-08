import { Router } from 'express';
import { ApiError } from '../errors.js';
import { BabyModel, ParentModel, SleepModel } from '../models/index.js';
import { findWhatsAppLink } from '../services/whatsapp-link.service.js';
import { claimWhatsAppPairingCode } from '../services/whatsapp-pairing.service.js';
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
import { processWhatsAppIntent } from './intent.service.js';
import { uploadWhatsAppMediaToCloudinary } from './media.js';
import { metaSenderToE164 } from './phone.js';
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
      senderE164: `+${message.from}`,
      hasContent: Boolean(message.content),
      hasMedia: Boolean(message.mediaId),
      ...details
    })
  );
}

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const details = 'details' in error ? error.details : undefined;
    const validationErrors =
      'errors' in error && typeof error.errors === 'object' ? error.errors : undefined;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(validationErrors === undefined ? {} : { validationErrors }),
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

async function reply(message: IncomingWhatsAppMessage, text: string): Promise<boolean> {
  if (!text.trim()) throw new Error('WhatsApp reply text must not be empty.');
  logMessage(message, 'reply_generated', { reply: text });
  logMessage(message, 'outgoing_reply_attempted', { replyLength: text.length });
  try {
    const result = await sendWhatsAppMessage(message.from, text);
    logMessage(message, 'outgoing_reply_succeeded', {
      metaStatus: result.status,
      messageId: result.messageId ?? null
    });
    return true;
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: 'whatsapp.webhook',
        event: 'outgoing_reply_failed',
        ...describeError(error)
      })
    );
    return false;
  }
}

async function handleMessage(message: IncomingWhatsAppMessage): Promise<boolean> {
  logMessage(message, 'message_received', { incomingText: message.content });
  const phoneE164 = metaSenderToE164(message.from);
  const pairingMatch = message.content?.trim().match(/^link\s+(\d{6})$/i);
  if (pairingMatch) {
    logMessage(message, 'pairing_code_received');
    try {
      const link = await claimWhatsAppPairingCode({ code: pairingMatch[1], phoneE164 });
      logMessage(message, 'pairing_succeeded', { parentId: String(link.parentId), phoneE164 });
      return reply(
        message,
        'Your WhatsApp number is linked to Momaa. You can now send updates such as “fed 90ml”.'
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          scope: 'whatsapp.webhook',
          event: 'pairing_failed',
          ...describeError(error)
        })
      );
      return reply(
        message,
        error instanceof ApiError
          ? error.message
          : 'I could not link this number. Create a new pairing code in Momaa and try again.'
      );
    }
  }
  const link = await findWhatsAppLink(phoneE164);
  logMessage(message, 'whatsapp_link_lookup_completed', {
    phoneE164,
    found: Boolean(link),
    verified: link?.status === 'verified'
  });
  if (!link) {
    logMessage(message, 'parent_lookup_completed', { found: false, reason: 'number_not_linked' });
    return reply(
      message,
      "This number isn't linked to a Momaa account yet — open the app and link your WhatsApp number in Profile settings to get started."
    );
  }
  if (link.status !== 'verified') {
    logMessage(message, 'unverified_number_blocked', {
      phoneE164,
      parentId: String(link.parentId)
    });
    return reply(
      message,
      'Your WhatsApp number is pending verification. Open Momaa Profile and enter the verification code we sent.'
    );
  }
  const parent = await ParentModel.findOne({ _id: link.parentId, userId: link.userId });
  logMessage(message, 'parent_lookup_completed', {
    found: Boolean(parent),
    familyId: parent ? String(parent._id) : null
  });
  if (!parent)
    return reply(
      message,
      'Your linked Momaa account is no longer available. Please relink your WhatsApp number from the Momaa app.'
    );
  if (!parent.isPhoneVerified) {
    logMessage(message, 'unverified_parent_phone_blocked', {
      phoneE164,
      parentId: String(parent._id)
    });
    return reply(
      message,
      'Your WhatsApp number needs verification in Momaa Profile before it can log health updates.'
    );
  }
  const baby = await BabyModel.findOne({ parentIds: parent._id }).sort({ updatedAt: -1 });
  logMessage(message, 'baby_lookup_completed', {
    found: Boolean(baby),
    babyId: baby ? String(baby._id) : null
  });
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
      console.error(
        JSON.stringify({
          scope: 'whatsapp.webhook',
          event: 'media_processing_failed',
          ...describeError(error)
        })
      );
    }
  }
  logMessage(message, 'intent_extraction_called', { incomingText: message.content });
  const extracted = await processWhatsAppIntent({
    babyId: String(baby._id),
    message: message.content,
    occurredAt: message.timestamp,
    timeZone: parent.timezone
  });
  logMessage(message, 'intent_extraction_result', {
    detectedIntent: extracted.intent.type,
    confidence: extracted.intent.confidence,
    parsedAmountMl: extracted.intent.amountMl ?? null,
    babyId: String(baby._id),
    familyId: String(parent._id)
  });
  if (extracted.reply) return reply(message, extracted.reply);

  // During rollout, retain the small deterministic parser only if the model
  // explicitly returned unknown/low confidence. Ambiguous messages still fall
  // through to normal chat rather than creating an event.
  const intent = parseWhatsAppIntent(message.content);
  if (intent) logMessage(message, 'intent_regex_fallback_used', { detectedIntent: intent.type });
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
    return reply(message, `Logged feeding: ${intent.amountMl} ml 🍼`);
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
    const messages = parseWhatsAppWebhook(request.body);
    console.info(
      JSON.stringify({
        scope: 'whatsapp.webhook',
        event: 'webhook_received',
        messageCount: messages.length
      })
    );
    for (const message of messages) {
      const outboundReplySent = await handleMessage(message);
      logMessage(message, 'message_processing_completed', { outboundReplySent });
    }
    console.info(JSON.stringify({ scope: 'whatsapp.webhook', event: 'webhook_completed' }));
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
