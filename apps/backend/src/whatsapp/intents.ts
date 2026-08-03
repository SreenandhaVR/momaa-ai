export type WhatsAppIntent =
  | { type: 'feed'; amountMl: number }
  | { type: 'sleep_start' }
  | { type: 'sleep_end' }
  | { type: 'diaper' }
  | { type: 'summary' };

export function parseWhatsAppIntent(text: string): WhatsAppIntent | null {
  const message = text.trim();
  const feed = /\b(?:fed|gave|give)\s+(\d{1,4})\s*(?:m\s*l|ml)\b/i.exec(message);
  if (feed) return { type: 'feed', amountMl: Number(feed[1]) };
  if (
    /\b(?:started?|begin|start)\s+(?:sleeping|a\s*nap)|\b(?:baby\s+)?(?:is\s+)?sleeping\b/i.test(
      message
    )
  )
    return { type: 'sleep_start' };
  if (
    /\b(?:woke\s+up|woken\s+up|ended\s+(?:the\s+)?(?:nap|sleep)|stopped\s+sleeping)\b/i.test(
      message
    )
  )
    return { type: 'sleep_end' };
  if (/\b(?:changed?(?:\s+(?:the\s+)?)?diaper|diaper\s+changed?)\b/i.test(message))
    return { type: 'diaper' };
  if (
    /\b(?:show|what(?:'s|\s+is))\s+(?:me\s+)?today'?s\s+summary\b|\btoday'?s\s+summary\b/i.test(
      message
    )
  )
    return { type: 'summary' };
  return null;
}
