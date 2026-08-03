type Sender = (to: string, text: string) => Promise<void>;
let senderForTesting: Sender | undefined;

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
  const response = await fetch(
    `https://graph.facebook.com/v20.0/${required('WHATSAPP_PHONE_NUMBER_ID')}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${required('WHATSAPP_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: text }
      })
    }
  );
  if (!response.ok) throw new Error(`WhatsApp send failed with status ${response.status}.`);
}
