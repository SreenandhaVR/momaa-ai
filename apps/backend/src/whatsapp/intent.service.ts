import { buildRecentBabySummary } from '../ai/context.js';
import { SleepModel } from '../models/index.js';
import {
  createDiaper,
  createFeed,
  createGrowth,
  createMedicine,
  createSleep,
  createVaccination,
  endSleep
} from '../services/event-creation.service.js';
import { extractWhatsAppIntent, type ExtractedWhatsAppIntent } from './intent-extractor.js';

const highConfidence = 0.75;

function loggedTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export async function processWhatsAppIntent(input: {
  babyId: string;
  message: string;
  occurredAt?: Date;
}): Promise<{ intent: ExtractedWhatsAppIntent; reply?: string }> {
  const intent = await extractWhatsAppIntent(input.message);
  if (intent.type === 'unknown' || intent.confidence < highConfidence) return { intent };
  const occurredAt = input.occurredAt ?? new Date();
  if (intent.type === 'feed') {
    await createFeed({
      babyId: input.babyId,
      amountMl: intent.amountMl,
      method: 'bottle',
      source: 'whatsapp',
      timestamp: occurredAt
    });
    return { intent, reply: `Got it — logged ${intent.amountMl}ml at ${loggedTime(occurredAt)}.` };
  }
  if (intent.type === 'sleep_start') {
    await createSleep({
      babyId: input.babyId,
      startTime: occurredAt,
      endTime: null,
      isActive: true,
      source: 'whatsapp'
    });
    return { intent, reply: `Got it — started a sleep session at ${loggedTime(occurredAt)}.` };
  }
  if (intent.type === 'sleep_end') {
    const active = await SleepModel.findOne({ babyId: input.babyId, isActive: true }).sort({
      startTime: -1
    });
    if (!active) return { intent, reply: "I couldn't find an active sleep session to end." };
    const ended = await endSleep({ sleepId: String(active._id), endTime: occurredAt });
    return {
      intent,
      reply: `Got it — ended the sleep session${ended?.durationMinutes ? ` after ${ended.durationMinutes} minutes` : ''}.`
    };
  }
  if (intent.type === 'diaper') {
    await createDiaper({
      babyId: input.babyId,
      kind: intent.diaperKind ?? 'wet',
      source: 'whatsapp',
      timestamp: occurredAt
    });
    return { intent, reply: `Got it — logged a ${intent.diaperKind ?? 'wet'} diaper change.` };
  }
  if (intent.type === 'medicine') {
    await createMedicine({
      babyId: input.babyId,
      name: intent.medicineName!,
      dosage: intent.dose ?? 'Not specified',
      administeredAt: occurredAt,
      source: 'whatsapp'
    });
    return {
      intent,
      reply: `Got it — logged ${intent.medicineName}${intent.dose ? ` (${intent.dose})` : ''}.`
    };
  }
  if (intent.type === 'vaccination_note') {
    await createVaccination({
      babyId: input.babyId,
      name: intent.vaccinationName!,
      administeredAt: occurredAt,
      source: 'whatsapp',
      notes: intent.note
    });
    return { intent, reply: `Got it — saved the ${intent.vaccinationName} vaccination note.` };
  }
  if (intent.type === 'growth_note') {
    await createGrowth({
      babyId: input.babyId,
      recordedAt: occurredAt,
      weightKg: intent.weightKg,
      heightCm: intent.heightCm,
      source: 'whatsapp',
      notes: intent.note
    });
    return { intent, reply: 'Got it — saved that growth measurement.' };
  }
  if (intent.type === 'summary_request')
    return { intent, reply: await buildRecentBabySummary(input.babyId) };
  return { intent };
}
