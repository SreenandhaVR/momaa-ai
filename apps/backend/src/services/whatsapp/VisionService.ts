import { getAIProvider } from '../../ai/provider.js';

export type WhatsAppImageCategory =
  | 'baby-asleep'
  | 'baby-crying'
  | 'bottle'
  | 'medicine'
  | 'skin-concern'
  | 'other';

export type WhatsAppImageAnalysis = {
  caption: string;
  category: WhatsAppImageCategory;
  confidence: number;
};

export interface VisionServiceContract {
  analyzeImage(imageBuffer: Buffer): Promise<WhatsAppImageAnalysis>;
}

const categories = new Set<WhatsAppImageCategory>([
  'baby-asleep', 'baby-crying', 'bottle', 'medicine', 'skin-concern', 'other'
]);

const prompt = `Analyze this baby-care photo for Momaa. Return ONLY valid JSON with this exact shape:
{"caption":"short factual visual description","category":"baby-asleep|baby-crying|bottle|medicine|skin-concern|other","confidence":0.0}

Use skin-concern only when the photo visibly appears to show a skin change such as redness, rash, or irritation. Do not diagnose, name a condition, or say that anything is safe, normal, or harmless. If the image is unclear or does not fit a category, choose other. Caption must be observational, concise, and non-medical.`;

function parseAnalysis(output: string): WhatsAppImageAnalysis {
  const json = output.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const value: unknown = JSON.parse(json);
  if (!value || typeof value !== 'object') throw new Error('Vision response was not an object.');
  const candidate = value as Record<string, unknown>;
  const caption = typeof candidate.caption === 'string' ? candidate.caption.trim() : '';
  const category = candidate.category;
  const confidence = candidate.confidence;
  if (!caption || caption.length > 300 || typeof category !== 'string' || !categories.has(category as WhatsAppImageCategory))
    throw new Error('Vision response did not match the expected schema.');
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1)
    throw new Error('Vision response confidence must be between 0 and 1.');
  return { caption, category: category as WhatsAppImageCategory, confidence };
}

export class VisionService implements VisionServiceContract {
  async analyzeImage(imageBuffer: Buffer): Promise<WhatsAppImageAnalysis> {
    if (!imageBuffer.length) throw new Error('Image is empty.');
    if (imageBuffer.length > 4 * 1024 * 1024)
      throw new Error('Image is too large for inline vision analysis.');
    const provider = getAIProvider();
    if (!provider.analyzeImage)
      throw new Error('The configured AI provider does not support image analysis.');
    return parseAnalysis(await provider.analyzeImage({ buffer: imageBuffer, mimeType: 'image/jpeg' }, prompt));
  }
}

export function whatsappImageReply(analysis: WhatsAppImageAnalysis): string {
  switch (analysis.category) {
    case 'baby-asleep':
      return "It looks like your baby may be asleep. I've saved this photo to their memories.";
    case 'bottle':
      return "Looks like a feeding bottle. I've saved this photo to their memories.";
    case 'medicine':
      return "Looks like medicine. I've saved this photo to their memories.";
    case 'skin-concern':
      return "I notice some redness or a skin change — I can't diagnose from a photo. If it persists or your baby seems unwell, it's worth checking with your pediatrician.";
    case 'baby-crying':
      return "Thanks for sharing this photo — I've saved it to your baby's memories.";
    default:
      return "Thanks for sharing this photo — I've saved it to your baby's memories.";
  }
}
