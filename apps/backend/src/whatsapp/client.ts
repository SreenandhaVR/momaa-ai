type Sender = (to: string, text: string) => Promise<void>;
let senderForTesting: Sender | undefined;

export class WhatsAppSendError extends Error {
  constructor(
    public readonly status: number,
    public readonly details: unknown
  ) {
    super(`WhatsApp send failed with status ${status}.`);
    this.name = 'WhatsAppSendError';
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for WhatsApp.`);
  return value;
}

export function setWhatsAppSenderForTesting(sender?: Sender): void {
  senderForTesting = sender;
}
export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  if (senderForTesting) return senderForTesting(to, text);
  const phoneNumberId = required('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = required('WHATSAPP_ACCESS_TOKEN');
  const recipient = to.replace(/\D/g, '');
  if (!recipient) throw new Error('A valid WhatsApp recipient phone number is required.');
  console.info(
    JSON.stringify({
      scope: 'whatsapp.send',
      event: 'request',
      phoneNumberIdConfigured: Boolean(phoneNumberId),
      accessTokenConfigured: Boolean(accessToken),
      recipientLast4: recipient.slice(-4)
    })
  );
  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: { preview_url: false, body: text }
    })
  });
  const responseText = await response.text();
  let details: unknown = responseText;
  try {
    details = responseText ? (JSON.parse(responseText) as unknown) : null;
  } catch {
    // Keep the raw response text when Meta does not return JSON.
  }
  if (!response.ok) {
    console.error(
      JSON.stringify({
        scope: 'whatsapp.send',
        event: 'failed',
        status: response.status,
        recipientLast4: recipient.slice(-4),
        meta: details
      })
    );
    throw new WhatsAppSendError(response.status, details);
  }
  console.info(
    JSON.stringify({
      scope: 'whatsapp.send',
      event: 'succeeded',
      status: response.status,
      recipientLast4: recipient.slice(-4),
      meta: details
    })
  );
}
