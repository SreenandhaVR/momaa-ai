import '../global.css';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_700Bold,
  useFonts
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../lib/auth-store';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [fontsLoaded] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_700Bold });
  const hydrate = useAuthStore((state) => state.hydrate);
  const status = useAuthStore((state) => state.status);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  if (!fontsLoaded || status === 'loading')
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#FFD54F" />
      </View>
    );
  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
