import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'momaa.auth.tokens';
const defaultApiBaseUrl =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultApiBaseUrl;
export type Tokens = { accessToken: string; refreshToken: string };

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** SecureStore is native-only. Browsers use localStorage so Expo web can run too. */
function webStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

export async function saveTokens(tokens: Tokens): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.setItem(TOKEN_KEY, JSON.stringify(tokens));
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
}
export async function loadTokens(): Promise<Tokens | null> {
  if (Platform.OS === 'web') {
    const value = webStorage()?.getItem(TOKEN_KEY);
    return value ? (JSON.parse(value) as Tokens) : null;
  }
  const value = await SecureStore.getItemAsync(TOKEN_KEY);
  return value ? (JSON.parse(value) as Tokens) : null;
}
export async function clearTokens(): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  token?: string
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers
    }
  });
  const body = (await response.json().catch(() => null)) as T & { error?: { message?: string } };
  if (!response.ok)
    throw new ApiRequestError(body?.error?.message ?? 'Something went wrong.', response.status);
  return body;
}
