import { Redirect } from 'expo-router';
import { useAuthStore } from '../lib/auth-store';
export default function Index() {
  const status = useAuthStore((state) => state.status);
  return <Redirect href={(status === 'signedIn' ? '/(tabs)' : '/(auth)/login') as never} />;
}
