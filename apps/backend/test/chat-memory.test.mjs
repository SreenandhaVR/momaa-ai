import assert from 'node:assert/strict';
import test from 'node:test';

const { respondToBabyChat } = await import('../dist/services/chat.service.js');
const { setAIProviderForTesting } = await import('../dist/ai/provider.js');
const { setBabyMemoryContextBuilderForTesting } = await import('../dist/ai/baby-memory.js');
const { BabyModel, ConversationModel, DiaperModel, FeedModel, ParentModel, SleepModel } =
  await import('../dist/models/index.js');

const originals = {
  babyFindOne: BabyModel.findOne,
  conversationFindOne: ConversationModel.findOne,
  conversationCreate: ConversationModel.create,
  feedFind: FeedModel.find,
  sleepFind: SleepModel.find,
  diaperFind: DiaperModel.find,
  parentFindById: ParentModel.findById
};
const baby = { _id: 'baby-1', firstName: 'Noah' };

function installModelFakes() {
  BabyModel.findOne = async () => baby;
  ConversationModel.findOne = () => ({ sort: async () => null });
  ConversationModel.create = async () => null;
  FeedModel.find = async () => [];
  SleepModel.find = async () => [];
  DiaperModel.find = async () => [];
  ParentModel.findById = () => ({ select: () => ({ lean: async () => ({ timezone: 'Asia/Kolkata' }) }) });
}

function restoreModelFakes() {
  BabyModel.findOne = originals.babyFindOne;
  ConversationModel.findOne = originals.conversationFindOne;
  ConversationModel.create = originals.conversationCreate;
  FeedModel.find = originals.feedFind;
  SleepModel.find = originals.sleepFind;
  DiaperModel.find = originals.diaperFind;
  ParentModel.findById = originals.parentFindById;
  setAIProviderForTesting();
  setBabyMemoryContextBuilderForTesting();
}

test('flag-off respondToBabyChat uses the unchanged legacy summary and never invokes Baby Memory', async () => {
  const originalFlag = process.env.USE_BABY_MEMORY_CONTEXT;
  const calls = [];
  let memoryBuilderCalls = 0;
  installModelFakes();
  process.env.USE_BABY_MEMORY_CONTEXT = 'false';
  setAIProviderForTesting({
    async generateResponse(messages, context) {
      calls.push({ messages, context });
      return 'Legacy reply.';
    }
  });
  setBabyMemoryContextBuilderForTesting(async () => {
    memoryBuilderCalls += 1;
    throw new Error('Baby Memory must not be reached when the flag is off.');
  });
  try {
    const result = await respondToBabyChat({
      babyId: 'baby-1', parentId: 'parent-1', message: 'How is Noah doing today?'
    });
    assert.equal(result.reply, 'Legacy reply.');
    assert.equal(memoryBuilderCalls, 0);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].context, 'Last 24 hours (recorded data): 0 feeds; 0 sleep sessions; 0 diaper changes.');
  } finally {
    restoreModelFakes();
    if (originalFlag === undefined) delete process.env.USE_BABY_MEMORY_CONTEXT;
    else process.env.USE_BABY_MEMORY_CONTEXT = originalFlag;
  }
});

test('flag-on respondToBabyChat includes Baby Memory, while safety prevents memory and provider calls', async () => {
  const originalFlag = process.env.USE_BABY_MEMORY_CONTEXT;
  const providerCalls = [];
  const builderCalls = [];
  installModelFakes();
  process.env.USE_BABY_MEMORY_CONTEXT = 'true';
  setAIProviderForTesting({
    async generateResponse(messages, context) {
      providerCalls.push({ messages, context });
      return 'Memory reply.';
    }
  });
  setBabyMemoryContextBuilderForTesting(async (input) => {
    builderCalls.push(input);
    return {
      version: 'v1',
      profile: { firstName: 'Noah', dateOfBirth: new Date('2025-01-15T00:00:00.000Z') },
      recentEvents: [{
        type: 'feed', occurredAt: new Date('2026-08-09T08:00:00.000Z'),
        summary: 'Feed: 90ml (bottle)', source: 'app'
      }],
      patterns: ['Feeding rhythm (medium confidence): Based on recent patterns, feeds are often in the morning.'],
      parentFeedback: [],
      generatedAt: new Date('2026-08-09T09:00:00.000Z')
    };
  });
  try {
    const normal = await respondToBabyChat({
      babyId: 'baby-1', parentId: 'parent-1', message: 'How is Noah doing today?'
    });
    assert.equal(normal.reply, 'Memory reply.');
    assert.deepEqual(builderCalls, [{ babyId: 'baby-1', timeZone: 'Asia/Kolkata' }]);
    assert.equal(providerCalls.length, 1);
    assert.match(providerCalls[0].context, /Baby Memory context/);
    assert.match(providerCalls[0].context, /Feed: 90ml/);

    const emergency = await respondToBabyChat({
      babyId: 'baby-1', parentId: 'parent-1', message: 'My baby is choking'
    });
    assert.equal(emergency.urgent, true);
    assert.match(emergency.reply, /emergency/i);
    assert.equal(builderCalls.length, 1, 'safety must return before Baby Memory assembly');
    assert.equal(providerCalls.length, 1, 'safety must return before a provider call');
  } finally {
    restoreModelFakes();
    if (originalFlag === undefined) delete process.env.USE_BABY_MEMORY_CONTEXT;
    else process.env.USE_BABY_MEMORY_CONTEXT = originalFlag;
  }
});
