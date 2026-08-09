import { MOMAA_SYSTEM_PROMPT } from './prompt.js';

export type AIMessage = { role: 'user' | 'assistant'; content: string };
export type VisionImageInput = { buffer: Buffer; mimeType: string };
export interface AIProvider {
  generateResponse(messages: AIMessage[], context: string): Promise<string>;
  /** Optional so existing text-only test providers remain valid. */
  analyzeImage?(image: VisionImageInput, prompt: string): Promise<string>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly details: {
      provider: 'openai' | 'gemini' | 'groq';
      endpoint: string;
      model: string;
      status?: number;
      responseBody?: unknown;
    }
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the configured AI provider.`);
  return value;
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function openAIOutputText(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const output = (body as { output?: unknown }).output;
  if (!Array.isArray(output)) return undefined;
  return output
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) return [];
      return content.flatMap((part) => {
        if (!part || typeof part !== 'object') return [];
        const value = part as { type?: unknown; text?: unknown };
        return value.type === 'output_text' && typeof value.text === 'string' ? [value.text] : [];
      });
    })
    .join('')
    .trim();
}

function asDataUrl(image: VisionImageInput): string {
  return `data:${image.mimeType};base64,${image.buffer.toString('base64')}`;
}

export class OpenAIProvider implements AIProvider {
  async generateResponse(messages: AIMessage[], context: string): Promise<string> {
    const endpoint = 'https://api.openai.com/v1/responses';
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${required('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          store: false,
          instructions: `${MOMAA_SYSTEM_PROMPT}\n\nRecent baby data:\n${context}`,
          input: messages.map((message) => ({
            role: message.role,
            content: [{ type: 'input_text', text: message.content }]
          }))
        })
      });
      const bodyText = await response.text();
      const body = parseBody(bodyText);
      if (!response.ok)
        throw new AIProviderError(`OpenAI API request failed with HTTP ${response.status}.`, {
          provider: 'openai', endpoint, model, status: response.status, responseBody: body
        });
      const text = openAIOutputText(body);
      if (!text)
        throw new AIProviderError('OpenAI returned no output text.', {
          provider: 'openai', endpoint, model, status: response.status, responseBody: body
        });
      return text;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(error instanceof Error ? error.message : 'OpenAI request failed.', {
        provider: 'openai', endpoint, model
      });
    }
  }

  async analyzeImage(image: VisionImageInput, prompt: string): Promise<string> {
    const endpoint = 'https://api.openai.com/v1/responses';
    const model = process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${required('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          store: false,
          input: [{ role: 'user', content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: asDataUrl(image), detail: 'low' }
          ] }]
        })
      });
      const bodyText = await response.text();
      const body = parseBody(bodyText);
      if (!response.ok)
        throw new AIProviderError(`OpenAI vision request failed with HTTP ${response.status}.`, {
          provider: 'openai', endpoint, model, status: response.status, responseBody: body
        });
      const text = openAIOutputText(body);
      if (!text) throw new AIProviderError('OpenAI returned no vision output text.', { provider: 'openai', endpoint, model, status: response.status, responseBody: body });
      return text;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(error instanceof Error ? error.message : 'OpenAI vision request failed.', { provider: 'openai', endpoint, model });
    }
  }
}

export class GroqProvider implements AIProvider {
  async generateResponse(messages: AIMessage[], context: string): Promise<string> {
    const endpoint = 'https://api.groq.com/openai/v1/responses';
    const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${required('GROQ_API_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          store: false,
          instructions: `${MOMAA_SYSTEM_PROMPT}\n\nRecent baby data:\n${context}`,
          input: messages.map((message) => ({
            role: message.role,
            content: [{ type: 'input_text', text: message.content }]
          }))
        })
      });
      const bodyText = await response.text();
      const body = parseBody(bodyText);
      if (!response.ok)
        throw new AIProviderError(`Groq API request failed with HTTP ${response.status}.`, {
          provider: 'groq', endpoint, model, status: response.status, responseBody: body
        });
      const text = openAIOutputText(body);
      if (!text)
        throw new AIProviderError('Groq returned no output text.', {
          provider: 'groq', endpoint, model, status: response.status, responseBody: body
        });
      return text;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(error instanceof Error ? error.message : 'Groq request failed.', {
        provider: 'groq', endpoint, model
      });
    }
  }

  async analyzeImage(image: VisionImageInput, prompt: string): Promise<string> {
    const endpoint = 'https://api.groq.com/openai/v1/responses';
    const model = process.env.GROQ_VISION_MODEL ?? 'qwen/qwen3.6-27b';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${required('GROQ_API_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          store: false,
          input: [{ role: 'user', content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: asDataUrl(image), detail: 'low' }
          ] }]
        })
      });
      const bodyText = await response.text();
      const body = parseBody(bodyText);
      if (!response.ok)
        throw new AIProviderError(`Groq vision request failed with HTTP ${response.status}.`, {
          provider: 'groq', endpoint, model, status: response.status, responseBody: body
        });
      const text = openAIOutputText(body);
      if (!text) throw new AIProviderError('Groq returned no vision output text.', { provider: 'groq', endpoint, model, status: response.status, responseBody: body });
      return text;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(error instanceof Error ? error.message : 'Groq vision request failed.', { provider: 'groq', endpoint, model });
    }
  }
}

export class GeminiProvider implements AIProvider {
  async generateResponse(messages: AIMessage[], context: string): Promise<string> {
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${required('GEMINI_API_KEY')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: `${MOMAA_SYSTEM_PROMPT}\n\nRecent baby data:\n${context}` }]
          },
          contents: messages.map((message) => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: message.content }]
          }))
        })
      }
    );
    if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}.`);
    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();
    if (!text) throw new Error('Gemini returned no text response.');
    return text;
  }

  async analyzeImage(image: VisionImageInput, prompt: string): Promise<string> {
    const model = process.env.GEMINI_VISION_MODEL ?? process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${required('GEMINI_API_KEY')}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [
          { text: prompt },
          { inline_data: { mime_type: image.mimeType, data: image.buffer.toString('base64') } }
        ] }]
      })
    });
    const bodyText = await response.text();
    const body = parseBody(bodyText);
    if (!response.ok)
      throw new AIProviderError(`Gemini vision request failed with HTTP ${response.status}.`, {
        provider: 'gemini', endpoint, model, status: response.status, responseBody: body
      });
    const candidates = body as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = candidates.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
    if (!text) throw new AIProviderError('Gemini returned no vision output text.', { provider: 'gemini', endpoint, model, status: response.status, responseBody: body });
    return text;
  }
}

let testProvider: AIProvider | undefined;
export function setAIProviderForTesting(provider?: AIProvider): void {
  testProvider = provider;
}
export function getAIProvider(): AIProvider {
  if (testProvider) return testProvider;
  const provider = process.env.AI_PROVIDER;
  if (provider === 'openai') return new OpenAIProvider();
  if (provider === 'gemini') return new GeminiProvider();
  if (provider === 'groq') return new GroqProvider();
  throw new Error('AI_PROVIDER must be set to "openai", "gemini", or "groq".');
}
