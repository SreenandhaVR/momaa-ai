import { useQuery } from '@tanstack/react-query';
import type { Baby } from '@momaa/types';
import { apiRequest } from './api';
import { useAuthStore } from './auth-store';

export function useBabies() {
  const token = useAuthStore((state) => state.tokens?.accessToken);
  return useQuery({
    queryKey: ['babies'],
    enabled: Boolean(token),
    queryFn: () => apiRequest<{ data: Baby[] }>('/babies', {}, token).then((result) => result.data)
  });
}
