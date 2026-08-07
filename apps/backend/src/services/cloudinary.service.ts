import { createHash } from 'node:crypto';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for uploads.`);
  return value;
}

export async function uploadToCloudinary(
  buffer: Buffer,
  mimeType: string,
  resourceType: 'image' | 'auto' = 'image'
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1_000);
  const apiSecret = required('CLOUDINARY_API_SECRET');
  const signature = createHash('sha1').update(`timestamp=${timestamp}${apiSecret}`).digest('hex');
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), 'baby-photo.jpg');
  form.append('api_key', required('CLOUDINARY_API_KEY'));
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${required('CLOUDINARY_CLOUD_NAME')}/${resourceType}/upload`,
    { method: 'POST', body: form }
  );
  if (!response.ok) throw new Error(`Cloudinary upload failed with status ${response.status}.`);
  const payload = (await response.json()) as { secure_url?: string };
  if (!payload.secure_url) throw new Error('Cloudinary returned no secure URL.');
  return payload.secure_url;
}

export const uploadImageToCloudinary = (buffer: Buffer, mimeType: string) =>
  uploadToCloudinary(buffer, mimeType, 'image');
