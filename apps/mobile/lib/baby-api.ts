import * as ImagePicker from 'expo-image-picker';
import type { Baby } from '@momaa/types';
import { apiRequest, API_BASE_URL } from './api';

export async function createBaby(
  input: { firstName: string; dateOfBirth: string; sex?: string },
  token?: string
): Promise<Baby> {
  const result = await apiRequest<{ data: Baby }>(
    '/babies',
    { method: 'POST', body: JSON.stringify(input) },
    token
  );
  return result.data;
}
export async function uploadBabyPhoto(
  babyId: string,
  asset: ImagePicker.ImagePickerAsset,
  token?: string
): Promise<Baby> {
  const form = new FormData();
  form.append('photo', {
    uri: asset.uri,
    name: asset.fileName ?? 'baby-photo.jpg',
    type: asset.mimeType ?? 'image/jpeg'
  } as never);
  const response = await fetch(`${API_BASE_URL}/babies/${babyId}/photo`, {
    method: 'POST',
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form
  });
  const body = (await response.json()) as { data?: Baby; error?: { message?: string } };
  if (!response.ok || !body.data) throw new Error(body.error?.message ?? 'Could not upload photo.');
  return body.data;
}

export async function uploadBabyMedia(
  babyId: string,
  file: { uri: string; name: string; type: string },
  token?: string
): Promise<{ mediaUrl: string; title: string }> {
  const form = new FormData();
  form.append('media', file as never);
  const response = await fetch(`${API_BASE_URL}/babies/${babyId}/media`, {
    method: 'POST',
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form
  });
  const body = (await response.json()) as {
    data?: { mediaUrl: string; title: string };
    error?: { message?: string };
  };
  if (!response.ok || !body.data)
    throw new Error(body.error?.message ?? 'Could not upload attachment.');
  return body.data;
}
