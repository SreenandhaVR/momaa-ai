import assert from 'node:assert/strict';
import test from 'node:test';

const { ApiError } = await import('../dist/errors.js');
const { createInsightFeedback } = await import('../dist/services/insight-feedback.service.js');

const timestamp = new Date('2026-08-09T10:00:00.000Z');

test('creates attributed feedback for a baby owned by the authenticated parent', async () => {
  const created = [];
  const result = await createInsightFeedback(
    {
      babyId: 'baby-1',
      parentId: 'parent-1',
      insightId: '64f123456789012345678901',
      type: 'helpful',
      comment: 'This matched today.',
      timestamp
    },
    {
      async parentOwnsBaby() { return true; },
      async insightBelongsToBaby() { return true; },
      async create(input) {
        created.push(input);
        return { ...input, babyId: input.babyId, parentId: input.parentId, createdAt: timestamp, updatedAt: timestamp };
      }
    }
  );
  assert.equal(created.length, 1);
  assert.equal(result.type, 'helpful');
  assert.equal(result.comment, 'This matched today.');
  assert.equal(result.timestamp.toISOString(), timestamp.toISOString());
});

test('rejects feedback when the parent does not belong to the baby', async () => {
  await assert.rejects(
    createInsightFeedback(
      { babyId: 'baby-1', parentId: 'other-parent', type: 'not_helpful' },
      {
        async parentOwnsBaby() { return false; },
        async insightBelongsToBaby() { return true; },
        async create() { throw new Error('must not create'); }
      }
    ),
    (error) => error instanceof ApiError && error.status === 404 && error.code === 'NOT_FOUND'
  );
});

test('rejects an insight reference that belongs to a different baby', async () => {
  await assert.rejects(
    createInsightFeedback(
      { babyId: 'baby-1', parentId: 'parent-1', insightId: '64f123456789012345678901', type: 'correction' },
      {
        async parentOwnsBaby() { return true; },
        async insightBelongsToBaby() { return false; },
        async create() { throw new Error('must not create'); }
      }
    ),
    (error) => error instanceof ApiError && error.status === 404 && error.message.includes('AI insight')
  );
});
