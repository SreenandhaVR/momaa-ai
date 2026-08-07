import { create } from 'zustand';
import type { Parent, User } from '@momaa/types';
import { apiRequest, clearTokens, loadTokens, saveTokens, type Tokens } from './api';

type AuthResponse = { data: { user: User; parent: Parent; tokens: Tokens } };
type AuthState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  user?: User;
  parent?: Parent;
  tokens?: Tokens;
  hydrate: () => Promise<void>;
  login: (input: { email?: string; phoneNumber?: string; password: string }) => Promise<void>;
  register: (input: {
    displayName: string;
    email?: string;
    phoneNumber?: string;
    password: string;
    firstName: string;
    lastName?: string;
    timezone: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  setParent: (parent: Parent) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  hydrate: async () => {
    const tokens = await loadTokens();
    set(tokens ? { status: 'signedIn', tokens } : { status: 'signedOut' });
  },
  login: async (input) => {
    const result = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    await saveTokens(result.data.tokens);
    set({ status: 'signedIn', ...result.data });
  },
  register: async (input) => {
    const result = await apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    await saveTokens(result.data.tokens);
    set({ status: 'signedIn', ...result.data });
  },
  signOut: async () => {
    await clearTokens();
    set({ status: 'signedOut', user: undefined, parent: undefined, tokens: undefined });
  },
  setParent: (parent) => set({ parent })
}));
