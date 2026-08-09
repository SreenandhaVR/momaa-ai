import assert from 'node:assert/strict';
import test from 'node:test';

const { createRhythmPatternAdapter, readBabyMemory, renderBabyMemoryContext } = await import('../dist/ai/baby-memory.js');

const profile = {
  firstName: 'Aanya',
  dateOfBirth: new Date('2026-03-12T00:00:00.000Z'),
  sex: 'female'
};
const events = [
  { type: 'feed', occurredAt: new Date('2026-08-08T12:00:00.000Z'), summary: 'Feed: 90ml (bottle)', source: 'whatsapp' },
  { type: 'diaper', occurredAt: new Date('2026-08-08T12:30:00.000Z'), summary: 'wet diaper change', source: 'app' },
  { type: 'sleep', occurredAt: new Date('2026-08-08T13:00:00.000Z'), summary: 'Sleep started', source: 'whatsapp' }
];

test('builds a bounded chronological Baby Memory context without MongoDB', async () => {
  const calls = [];
  const context = await readBabyMemory(
    'baby-1',
    { since: new Date('2026-08-05T00:00:00.000Z'), eventLimit: 2 },
    {
      async loadProfile(id) {
        calls.push(['profile', id]);
        return profile;
      },
      async loadRecentEvents(id, since) {
        calls.push(['events', id, since.toISOString()]);
        return events;
      }
    }
  );
  assert.deepEqual(calls, [
    ['profile', 'baby-1'],
    ['events', 'baby-1', '2026-08-05T00:00:00.000Z']
  ]);
  assert.equal(context.version, 'v1');
  assert.equal(context.recentEvents.length, 2);
  assert.equal(context.recentEvents[0].type, 'sleep');
  assert.deepEqual(context.patterns, []);
  assert.deepEqual(context.parentFeedback, []);
});

test('renders factual, bounded context and has an honest empty-event state', async () => {
  const populated = await readBabyMemory('baby-1', {}, {
    async loadProfile() { return profile; },
    async loadRecentEvents() { return events; }
  });
  const text = renderBabyMemoryContext(populated, 'Asia/Kolkata');
  assert.match(text, /Baby Memory context/);
  assert.match(text, /Name: Aanya/);
  assert.match(text, /Sleep started/);
  assert.match(text, /Known patterns:\n- None generated yet\./);

  const empty = await readBabyMemory('baby-1', {}, {
    async loadProfile() { return profile; },
    async loadRecentEvents() { return []; }
  });
  assert.match(renderBabyMemoryContext(empty), /No recent recorded events yet/);
});

test('returns null when the requested baby does not exist', async () => {
  const context = await readBabyMemory('missing', {}, {
    async loadProfile() { return null; },
    async loadRecentEvents() { return []; }
  });
  assert.equal(context, null);
});

test('reuses Rhythm insight output through the Baby Memory pattern adapter', async () => {
  const calls = [];
  const adapter = createRhythmPatternAdapter(async (input) => {
    calls.push(input);
    return {
      insights: [
        {
          type: 'feeding',
          confidenceLevel: 'medium',
          dataPointCount: 12,
          insight: 'I noticed Aanya has been feeding about every 3 hours, most often in the afternoon.'
        }
      ],
      feedingFrequency: []
    };
  });
  const context = await readBabyMemory('baby-1', { timeZone: 'Asia/Kolkata' }, {
    async loadProfile() { return profile; },
    async loadRecentEvents() { return events; }
  }, adapter);
  assert.deepEqual(calls, [{ babyId: 'baby-1', babyName: 'Aanya', timeZone: 'Asia/Kolkata' }]);
  assert.deepEqual(context.patterns, [
    'Feeding rhythm (medium confidence): I noticed Aanya has been feeding about every 3 hours, most often in the afternoon.'
  ]);
  assert.match(renderBabyMemoryContext(context), /Feeding rhythm \(medium confidence\)/);
});

test('bounds unusually long memory text before it reaches an AI prompt', async () => {
  const context = await readBabyMemory('baby-1', {}, {
    async loadProfile() { return { ...profile, medicalNotes: 'a'.repeat(1_000) }; },
    async loadRecentEvents() { return [{ ...events[0], summary: 'b'.repeat(1_000) }]; }
  });
  const text = renderBabyMemoryContext(context);
  assert.ok(text.length < 1_000);
  assert.match(text, /…/);
});
