import { uploadToCloudinary } from '../services/cloudinary.service.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for WhatsApp media handling.`);
  return value;
}

export async function downloadWhatsAppMedia(
  mediaId: string
): Promise<{ buffer: Buffer; mimeType: string }> {
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
  return {
    buffer: Buffer.from(await downloadResponse.arrayBuffer()),
    mimeType: metadata.mime_type ?? 'application/octet-stream'
  };
}

export async function uploadWhatsAppMediaToCloudinary(mediaId: string): Promise<string> {
  const media = await downloadWhatsAppMedia(mediaId);
  return uploadToCloudinary(media.buffer, media.mimeType, 'auto');
}
