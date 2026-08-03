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

async function handleMessage(message: IncomingWhatsAppMessage): Promise<void> {
  const parent = await ParentModel.findOne({ phoneNumber: message.from });
  if (!parent)
    return sendWhatsAppMessage(
      message.from,
      'I could not find a Momaa family linked to this WhatsApp number. Please finish onboarding in the Momaa app.'
    );
  const baby = await BabyModel.findOne({ parentIds: parent._id }).sort({ updatedAt: -1 });
  if (!baby)
    return sendWhatsAppMessage(
      message.from,
      'Please add a baby profile in the Momaa app before logging updates here.'
    );
  if (message.mediaId) {
    try {
      const mediaUrl = await uploadWhatsAppMediaToCloudinary(message.mediaId);
      await createMediaMemory({
        babyId: String(baby._id),
        title: message.type === 'audio' ? 'WhatsApp voice note' : 'WhatsApp image',
        mediaUrl,
        source: 'whatsapp',
        occurredAt: message.timestamp
      });
    } catch (error) {
      console.error('WhatsApp media processing failed:', error);
    }
  }
  const intent = parseWhatsAppIntent(message.content);
  if (intent?.type === 'feed') {
    await createFeed({
      babyId: String(baby._id),
      amountMl: intent.amountMl,
      method: 'bottle',
      source: 'whatsapp',
      timestamp: message.timestamp
    });
    return sendWhatsAppMessage(message.from, `Logged a ${intent.amountMl} ml feed.`);
  }
  if (intent?.type === 'sleep_start') {
    await createSleep({
      babyId: String(baby._id),
      startTime: message.timestamp ?? new Date(),
      endTime: null,
      isActive: true,
      source: 'whatsapp'
    });
    return sendWhatsAppMessage(message.from, 'I started a sleep session.');
  }
  if (intent?.type === 'sleep_end') {
    const active = await SleepModel.findOne({ babyId: baby._id, isActive: true }).sort({
      startTime: -1
    });
    const ended = active
      ? await endSleep({ sleepId: String(active._id), endTime: message.timestamp })
      : null;
    return sendWhatsAppMessage(
      message.from,
      ended
        ? `Sleep session ended — ${ended.durationMinutes ?? 0} minutes recorded.`
        : 'I could not find an active sleep session to end.'
    );
  }
  if (intent?.type === 'diaper') {
    await createDiaper({
      babyId: String(baby._id),
      kind: 'wet',
      source: 'whatsapp',
      timestamp: message.timestamp
    });
    return sendWhatsAppMessage(message.from, 'Logged a diaper change.');
  }
  if (intent?.type === 'summary')
    return sendWhatsAppMessage(message.from, await buildRecentBabySummary(String(baby._id)));
  if (!message.content)
    return sendWhatsAppMessage(
      message.from,
      'I saved that as a memory. You can also send a note such as “Fed 90ml” to log an update.'
    );
  const chat = await respondToBabyChat({
    babyId: String(baby._id),
    parentId: String(parent._id),
    message: message.content
  });
  return sendWhatsAppMessage(message.from, chat.reply);
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
    next(error);
  }
});
