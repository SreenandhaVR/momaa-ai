import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-long-enough';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-long-enough';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.WHATSAPP_VERIFY_TOKEN = 'test-whatsapp-verify-token';

const { app } = await import('../dist/app.js');
const { connectDatabase, disconnectDatabase } = await import('../dist/database.js');
const { setAIProviderForTesting } = await import('../dist/ai/provider.js');
const { setWhatsAppSenderForTesting } = await import('../dist/whatsapp/client.js');

let mongo;
let accessToken = '';
let refreshToken = '';
let babyId = '';
const providerCalls = [];
const whatsappReplies = [];

setAIProviderForTesting({
  async generateResponse(messages, context) {
    providerCalls.push({ messages, context });
    return 'Based on recent patterns, it may help to keep tracking how your baby is doing.';
  }
});
setWhatsAppSenderForTesting(async (to, text) => whatsappReplies.push({ to, text }));

before(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri());
});

after(async () => {
  await disconnectDatabase();
  if (mongo) await mongo.stop();
  setAIProviderForTesting();
  setWhatsAppSenderForTesting();
});

test('registers, authenticates, and manages a baby profile end-to-end', async () => {
  const verification = await request(app).get('/api/webhook/whatsapp').query({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'test-whatsapp-verify-token',
    'hub.challenge': 'challenge-accepted'
  });
  assert.equal(verification.status, 200);
  assert.equal(verification.text, 'challenge-accepted');

  const register = await request(app).post('/api/auth/register').send({
    displayName: 'Ava Parent',
    email: 'ava@example.com',
    phoneNumber: '+1 (555) 123-4567',
    password: 'secure-password-123',
    firstName: 'Ava',
    timezone: 'Asia/Kolkata'
  });
  assert.equal(register.status, 201);
  assert.equal(register.body.data.user.email, 'ava@example.com');
  assert.ok(register.body.data.parent.id);
  accessToken = register.body.data.tokens.accessToken;
  refreshToken = register.body.data.tokens.refreshToken;

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'ava@example.com', password: 'secure-password-123' });
  assert.equal(login.status, 200);
  assert.ok(login.body.data.tokens.accessToken);

  const refreshed = await request(app).post('/api/auth/refresh').send({ refreshToken });
  assert.equal(refreshed.status, 200);
  assert.ok(refreshed.body.data.tokens.accessToken);

  const created = await request(app)
    .post('/api/babies')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      firstName: 'Noah',
      dateOfBirth: '2025-01-15T00:00:00.000Z',
      sex: 'male'
    });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.firstName, 'Noah');
  assert.equal(created.body.data.parentIds.length, 1);
  babyId = created.body.data.id;

  const list = await request(app).get('/api/babies').set('Authorization', `Bearer ${accessToken}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 1);

  const found = await request(app)
    .get(`/api/babies/${babyId}`)
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(found.status, 200);
  assert.equal(found.body.data.id, babyId);

  const updated = await request(app)
    .patch(`/api/babies/${babyId}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ medicalNotes: 'No known allergies.' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.medicalNotes, 'No known allergies.');

  for (const message of ['Fed 90ml', 'Baby has been crying for an hour', "show today's summary"]) {
    const chat = await request(app)
      .post(`/api/babies/${babyId}/chat`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message });
    assert.equal(chat.status, 200);
    assert.equal(chat.body.data.urgent, false);
    assert.match(chat.body.data.reply, /Based on recent patterns/);
  }
  assert.equal(providerCalls.length, 3);
  assert.match(providerCalls[2].context, /Last 24 hours/);
  assert.equal(providerCalls[2].messages.length, 5);

  const urgentChat = await request(app)
    .post(`/api/babies/${babyId}/chat`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ message: 'My baby is not breathing and has blue lips' });
  assert.equal(urgentChat.status, 200);
  assert.equal(urgentChat.body.data.urgent, true);
  assert.match(urgentChat.body.data.reply, /emergency/i);
  assert.equal(providerCalls.length, 3);

  const webhook = await request(app)
    .post('/api/webhook/whatsapp')
    .send({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '15551234567',
                    type: 'text',
                    text: { body: 'Fed 90ml' },
                    timestamp: '1737046800'
                  }
                ]
              }
            }
          ]
        }
      ]
    });
  assert.equal(webhook.status, 200);
  assert.equal(whatsappReplies.at(-1).text, 'Logged a 90 ml feed.');
  const whatsappFeeds = await request(app)
    .get(`/api/babies/${babyId}/feeds`)
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(whatsappFeeds.body.data.length, 1);
  assert.equal(whatsappFeeds.body.data[0].amountMl, 90);

  const eventCases = [
    {
      collection: 'feeds',
      body: {
        method: 'bottle',
        amountMl: 120,
        timestamp: '2025-01-16T08:00:00.000Z',
        source: 'app'
      },
      update: { amountMl: 130 }
    },
    {
      collection: 'sleeps',
      body: {
        startTime: '2025-01-16T09:00:00.000Z',
        endTime: '2025-01-16T10:00:00.000Z',
        isActive: false,
        source: 'app'
      },
      update: { notes: 'Morning nap' }
    },
    {
      collection: 'diapers',
      body: { kind: 'wet', timestamp: '2025-01-16T11:00:00.000Z', source: 'app' },
      update: { notes: 'Normal' }
    },
    {
      collection: 'medicines',
      body: {
        name: 'Vitamin D',
        dosage: '1 ml',
        administrationMethod: 'oral',
        administeredAt: '2025-01-16T12:00:00.000Z',
        source: 'app'
      },
      update: { notes: 'After lunch' }
    },
    {
      collection: 'vaccinations',
      body: { name: 'Example vaccine', administeredAt: '2025-01-16T13:00:00.000Z', source: 'app' },
      update: { provider: 'Clinic' }
    },
    {
      collection: 'growth',
      body: { recordedAt: '2025-01-16T14:00:00.000Z', weightKg: 6.2, source: 'app' },
      update: { heightCm: 62 }
    },
    {
      collection: 'memories',
      body: {
        title: 'First smile',
        occurredAt: '2025-01-16T15:00:00.000Z',
        mediaUrls: [],
        source: 'app'
      },
      update: { description: 'A lovely afternoon.' }
    }
  ];

  for (const eventCase of eventCases) {
    const createdEvent = await request(app)
      .post(`/api/babies/${babyId}/${eventCase.collection}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(eventCase.body);
    assert.equal(createdEvent.status, 201, eventCase.collection);
    const eventId = createdEvent.body.data.id;

    const listedEvents = await request(app)
      .get(`/api/babies/${babyId}/${eventCase.collection}`)
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(listedEvents.status, 200, eventCase.collection);
    assert.equal(
      listedEvents.body.data.length,
      eventCase.collection === 'feeds' ? 2 : 1,
      eventCase.collection
    );

    const patchedEvent = await request(app)
      .patch(`/api/${eventCase.collection}/${eventId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(eventCase.update);
    assert.equal(patchedEvent.status, 200, eventCase.collection);

    if (eventCase.collection === 'feeds') {
      const timeline = await request(app)
        .get(`/api/babies/${babyId}/timeline?date=2025-01-16`)
        .set('Authorization', `Bearer ${accessToken}`);
      assert.equal(timeline.status, 200);
      assert.ok(timeline.body.data.some((entry) => entry.type === 'feed'));
    }

    const deletedEvent = await request(app)
      .delete(`/api/${eventCase.collection}/${eventId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(deletedEvent.status, 204, eventCase.collection);
  }

  const sleepStart = await request(app)
    .post(`/api/babies/${babyId}/sleep/start`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ startTime: '2025-01-16T16:00:00.000Z', source: 'app' });
  assert.equal(sleepStart.status, 201);
  const sleepEnd = await request(app)
    .post(`/api/sleep/${sleepStart.body.data.id}/end`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ endTime: '2025-01-16T17:30:00.000Z' });
  assert.equal(sleepEnd.status, 200);
  assert.equal(sleepEnd.body.data.durationMinutes, 90);

  const unauthorized = await request(app).get('/api/babies');
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.body.error.code, 'UNAUTHORIZED');
});
