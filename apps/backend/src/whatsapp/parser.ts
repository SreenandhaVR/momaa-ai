export type WhatsAppMessageType = 'text' | 'audio' | 'image' | 'interactive' | 'unknown';
export interface IncomingWhatsAppMessage {
  from: string;
  type: WhatsAppMessageType;
  content: string;
  mediaId?: string;
  timestamp?: Date;
}

export function normalizeWhatsAppPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function parseWhatsAppWebhook(payload: unknown): IncomingWhatsAppMessage[] {
  const root = payload as {
    entry?: Array<{
      changes?: Array<{ value?: { messages?: Array<Record<string, unknown>> } }>;
    }>;
  };
  const output: IncomingWhatsAppMessage[] = [];
  for (const entry of root.entry ?? [])
    for (const change of entry.changes ?? [])
      for (const message of change.value?.messages ?? []) {
        const type = typeof message.type === 'string' ? message.type : 'unknown';
        const text = message.text as { body?: string } | undefined;
        const interactive = message.interactive as
          { button_reply?: { title?: string }; list_reply?: { title?: string } } | undefined;
        const media = message[type] as { id?: string; caption?: string } | undefined;
        output.push({
          from: normalizeWhatsAppPhone(String(message.from ?? '')),
          type:
            type === 'text' || type === 'audio' || type === 'image' || type === 'interactive'
              ? type
              : 'unknown',
          content:
            text?.body ??
            interactive?.button_reply?.title ??
            interactive?.list_reply?.title ??
            media?.caption ??
            '',
          mediaId: type === 'audio' || type === 'image' ? media?.id : undefined,
          timestamp: message.timestamp ? new Date(Number(message.timestamp) * 1_000) : undefined
        });
      }
  return output.filter((message) => message.from.length > 0);
}
