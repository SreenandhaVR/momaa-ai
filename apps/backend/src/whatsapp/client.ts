type Sender = (to: string, text: string) => Promise<void>;
let senderForTesting: Sender | undefined;

type MetaSendResponse = {
  messages?: Array<{ id?: string }>;
};

type WhatsAppPayload = {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text' | 'template';
  text?: { preview_url: false; body: string };
  template?: {
    name: string;
    language: { code: string };
    components: Array<{
      type: 'body';
      parameters: Array<{ type: 'text'; text: string }>;
    }>;
  };
};

export type WhatsAppSendResult = {
  messageId?: string;
  recipient: string;
  status: number;
};

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

function maskToken(value?: string): string {
  if (!value) return 'not configured';
  if (value.length <= 8) return 'configured (masked)';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function configurationStatus(): Record<string, unknown> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const verificationTemplateName = process.env.WHATSAPP_VERIFICATION_TEMPLATE_NAME;
  return {
    accessTokenConfigured: Boolean(accessToken),
    accessTokenMasked: maskToken(accessToken),
    phoneNumberId: phoneNumberId ?? 'not configured',
    verifyTokenConfigured: Boolean(verifyToken),
    businessAccountId: businessAccountId ?? 'not configured',
    verificationTemplateConfigured: Boolean(verificationTemplateName)
  };
}

function payloadForLogs(payload: WhatsAppPayload): WhatsAppPayload {
  if (payload.type !== 'template') return payload;
  return {
    ...payload,
    template: payload.template
      ? {
          ...payload.template,
          components: payload.template.components.map((component) => ({
            ...component,
            parameters: component.parameters.map((parameter) => ({
              ...parameter,
              text: '[redacted]'
            }))
          }))
        }
      : undefined
  };
}

export function setWhatsAppSenderForTesting(sender?: Sender): void {
  senderForTesting = sender;
}

async function sendWhatsAppPayload(
  to: string,
  payload: Omit<WhatsAppPayload, 'to'>
): Promise<WhatsAppSendResult> {
  if (senderForTesting) {
    // The injected sender is test-only; exposing its rendered body lets tests
    // complete the OTP loop without weakening production logging.
    const text =
      payload.type === 'text'
        ? (payload.text?.body ?? '')
        : (payload.template?.components[0]?.parameters[0]?.text ?? '');
    await senderForTesting(to, text);
    return { recipient: to, status: 200 };
  }
  console.info(
    JSON.stringify({
      scope: 'whatsapp.send',
      event: 'configuration_checked',
      environment: configurationStatus()
    })
  );
  const phoneNumberId = required('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = required('WHATSAPP_ACCESS_TOKEN');
  const recipient = to.replace(/\D/g, '');
  if (!recipient) throw new Error('A valid WhatsApp recipient phone number is required.');
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  const requestPayload: WhatsAppPayload = { ...payload, to: recipient };

  console.info(
    JSON.stringify({
      scope: 'whatsapp.send',
      event: 'request_prepared',
      url,
      phoneNumberId,
      recipientE164: `+${recipient}`,
      payload: payloadForLogs(requestPayload),
      headers: {
        Authorization: `Bearer ${maskToken(accessToken)}`,
        'Content-Type': 'application/json'
      },
      environment: configurationStatus()
    })
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: 'whatsapp.send',
        event: 'network_error',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
    );
    throw error;
  }

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
        recipientE164: `+${recipient}`,
        response: details
      })
    );
    throw new WhatsAppSendError(response.status, details);
  }
  const messageId = (details as MetaSendResponse | null)?.messages?.[0]?.id;
  console.info(
    JSON.stringify({
      scope: 'whatsapp.send',
      event: 'succeeded',
      status: response.status,
      recipientE164: `+${recipient}`,
      messageId: messageId ?? null,
      response: details
    })
  );
  return { messageId, recipient, status: response.status };
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<WhatsAppSendResult> {
  return sendWhatsAppPayload(to, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    type: 'text',
    text: { preview_url: false, body: text }
  });
}

/** Sends an approved Meta template so verification also works outside the 24-hour conversation window. */
export async function sendWhatsAppVerificationCode(
  to: string,
  code: string
): Promise<WhatsAppSendResult> {
  const templateName = required('WHATSAPP_VERIFICATION_TEMPLATE_NAME');
  const language = process.env.WHATSAPP_VERIFICATION_TEMPLATE_LANGUAGE ?? 'en_US';
  return sendWhatsAppPayload(to, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }]
    }
  });
}
