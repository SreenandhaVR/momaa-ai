import { randomUUID } from 'node:crypto';
import {
  buildBabyMemoryContext,
  renderBabyMemoryContext,
  useBabyMemoryContext
} from '../ai/baby-memory.js';
import { buildRecentBabySummary } from '../ai/context.js';
import { AIProviderError, getAIProvider, type AIMessage } from '../ai/provider.js';
import { checkUrgentRedFlags } from '../ai/safety.js';
import { ApiError } from '../errors.js';
import { BabyModel, ConversationModel, ParentModel } from '../models/index.js';

async function babyMemoryChatContext(input: { babyId: string; parentId: string }): Promise<string> {
  const parent = await ParentModel.findById(input.parentId).select('timezone').lean();
  const memory = await buildBabyMemoryContext({
    babyId: input.babyId,
    timeZone: parent?.timezone ?? 'UTC'
  });
  // A memory assembly failure or missing profile retains the established
  // aggregate summary instead of blocking the parent from receiving a reply.
  return memory
    ? renderBabyMemoryContext(memory, parent?.timezone ?? 'UTC')
    : buildRecentBabySummary(input.babyId);
}

export async function respondToBabyChat(input: {
  babyId: string;
  parentId: string;
  message: string;
}): Promise<{ reply: string; urgent: boolean }> {
  const baby = await BabyModel.findOne({ _id: input.babyId, parentIds: input.parentId });
  if (!baby) throw new ApiError(404, 'NOT_FOUND', 'Baby profile not found.');
  const conversation = await ConversationModel.findOne({
    parentId: input.parentId,
    babyId: baby._id
  }).sort({ lastMessageAt: -1 });
  const safety = checkUrgentRedFlags(input.message);
  let reply = safety.response;
  if (!reply) {
    const history: AIMessage[] = (conversation?.messages ?? []).slice(-10).map((item) => ({
      role: item.sender === 'assistant' ? 'assistant' : 'user',
      content: item.text
    }));
    try {
      reply = await getAIProvider().generateResponse(
        [...history, { role: 'user', content: input.message }],
        // Safety has already returned above. Context is assembled only for
        // ordinary chat messages and never before the emergency check.
        useBabyMemoryContext()
          ? await babyMemoryChatContext({ babyId: String(baby._id), parentId: input.parentId })
          // Disabled: this is the exact established call, with no Baby Memory
          // reader, Rhythm query, or additional profile query on this branch.
          : await buildRecentBabySummary(String(baby._id))
      );
    } catch (error) {
      if (error instanceof AIProviderError) {
        console.error('[ai] Provider failure', {
          message: error.message,
          stack: error.stack,
          ...error.details
        });
        const providerMessage =
          typeof error.details.responseBody === 'object' &&
          error.details.responseBody !== null &&
          'error' in error.details.responseBody &&
          typeof error.details.responseBody.error === 'object' &&
          error.details.responseBody.error !== null &&
          'message' in error.details.responseBody.error &&
          typeof error.details.responseBody.error.message === 'string'
            ? error.details.responseBody.error.message
            : error.message;
        throw new ApiError(
          error.details.status === 401 || error.details.status === 403 ? 502 : 503,
          'AI_PROVIDER_ERROR',
          providerMessage,
          error.details
        );
      }
      console.error('[ai] Unexpected provider failure:', error);
      throw new ApiError(
        503,
        'AI_UNAVAILABLE',
        error instanceof Error ? error.message : 'Momaa AI is temporarily unavailable.'
      );
    }
  }
  const now = new Date();
  const pair = [
    { id: randomUUID(), sender: 'parent', text: input.message, sentAt: now },
    { id: randomUUID(), sender: 'assistant', text: reply, sentAt: now }
  ];
  if (conversation) {
    conversation.messages.push(...pair);
    conversation.lastMessageAt = now;
    await conversation.save();
  } else
    await ConversationModel.create({
      parentId: input.parentId,
      babyId: baby._id,
      channel: 'in_app',
      messages: pair,
      lastMessageAt: now
    });
  return { reply, urgent: safety.urgent };
}
