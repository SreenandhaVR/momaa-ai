import { createHash } from 'node:crypto';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for WhatsApp media handling.`);
  return value;
}

export async function uploadWhatsAppMediaToCloudinary(mediaId: string): Promise<string> {
  const token = required('WHATSAPP_ACCESS_TOKEN');
  const metadataResponse = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!metadataResponse.ok)
    throw new Error(`WhatsApp media lookup failed with status ${metadataResponse.status}.`);
  const metadata = (await metadataResponse.json()) as { url?: string; mime_type?: string };
  if (!metadata.url) throw new Error('WhatsApp media lookup returned no URL.');
  const downloadResponse = await fetch(metadata.url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!downloadResponse.ok)
    throw new Error(`WhatsApp media download failed with status ${downloadResponse.status}.`);
  const timestamp = Math.floor(Date.now() / 1_000);
  const apiSecret = required('CLOUDINARY_API_SECRET');
  const signature = createHash('sha1').update(`timestamp=${timestamp}${apiSecret}`).digest('hex');
  const form = new FormData();
  form.append(
    'file',
    new Blob([await downloadResponse.arrayBuffer()], {
      type: metadata.mime_type ?? 'application/octet-stream'
    }),
    mediaId
  );
  form.append('api_key', required('CLOUDINARY_API_KEY'));
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  const cloudinary = await fetch(
    `https://api.cloudinary.com/v1_1/${required('CLOUDINARY_CLOUD_NAME')}/auto/upload`,
    { method: 'POST', body: form }
  );
  if (!cloudinary.ok) throw new Error(`Cloudinary upload failed with status ${cloudinary.status}.`);
  const result = (await cloudinary.json()) as { secure_url?: string };
  if (!result.secure_url) throw new Error('Cloudinary returned no secure URL.');
  return result.secure_url;
}
