import { z } from 'zod';
import { getAIProvider } from '../ai/provider.js';

export const intentSchema = z
  .object({
    type: z.enum([
      'feed',
      'sleep_start',
      'sleep_end',
      'diaper',
      'medicine',
      'vaccination_note',
      'growth_note',
      'summary_request',
      'unknown'
    ]),
    confidence: z.number().min(0).max(1),
    amountMl: z.number().positive().max(2_000).optional(),
    diaperKind: z.enum(['wet', 'dirty', 'mixed']).optional(),
    medicineName: z.string().trim().min(1).max(200).optional(),
    dose: z.string().trim().min(1).max(100).optional(),
    vaccinationName: z.string().trim().min(1).max(200).optional(),
    weightKg: z.number().positive().max(100).optional(),
    heightCm: z.number().positive().max(200).optional(),
    note: z.string().trim().min(1).max(1_000).optional()
  })
  .strict();

export type ExtractedWhatsAppIntent = z.infer<typeof intentSchema>;

export function buildIntentPrompt(message: string): string {
  return `INTENT_EXTRACTION\nYou extract a single Momaa baby-log intent. Return ONLY one JSON object, with no markdown or prose.\n\nIncoming WhatsApp message:\n${JSON.stringify(message)}\n\nSchema:\n{\n  "type": "feed" | "sleep_start" | "sleep_end" | "diaper" | "medicine" | "vaccination_note" | "growth_note" | "summary_request" | "unknown",\n  "confidence": number from 0 to 1,\n  "amountMl"?: positive number (feed only),\n  "diaperKind"?: "wet" | "dirty" | "mixed",\n  "medicineName"?: string, "dose"?: string,\n  "vaccinationName"?: string,\n  "weightKg"?: positive number, "heightCm"?: positive number,\n  "note"?: string\n}\n\nRules: use unknown when the message is ambiguous or not a clear logging/request intent. Never invent quantities, medicine names, vaccination names, or measurements. Feed requires amountMl; medicine requires medicineName and dose; vaccination_note requires vaccinationName; growth_note requires weightKg or heightCm. summary_request has no event fields. Confidence reflects how clearly the message supports the intent.`;
}

function completeIntent(intent: ExtractedWhatsAppIntent): boolean {
  if (intent.type === 'feed') return intent.amountMl !== undefined;
  if (intent.type === 'medicine') return Boolean(intent.medicineName);
  if (intent.type === 'vaccination_note') return Boolean(intent.vaccinationName);
  if (intent.type === 'growth_note')
    return intent.weightKg !== undefined || intent.heightCm !== undefined;
  return true;
}

/** Calls the shared provider and safely reduces malformed output to unknown. */
export async function extractWhatsAppIntent(message: string): Promise<ExtractedWhatsAppIntent> {
  try {
    const output = await getAIProvider().generateResponse(
      [{ role: 'user', content: buildIntentPrompt(message) }],
      'This is a structured extraction task. Return only valid JSON.'
    );
    const parsed = intentSchema.safeParse(JSON.parse(output));
    if (!parsed.success || !completeIntent(parsed.data)) return { type: 'unknown', confidence: 0 };
    return parsed.data;
  } catch {
    return { type: 'unknown', confidence: 0 };
  }
}
