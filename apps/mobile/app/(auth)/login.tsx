import { useMutation } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { Button } from '@momaa/ui';
import { useAuthStore } from '../../lib/auth-store';

export default function LoginScreen() {
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useMutation({
    mutationFn: () => login({ email, password }),
    onSuccess: () => router.replace('/(tabs)' as never),
    onError: (error) =>
      Alert.alert('Could not sign in', error instanceof Error ? error.message : 'Please try again.')
  });
  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="font-jakarta-bold text-3xl tracking-tight text-text-primary">
          Welcome to Momaa
        </Text>
        <Text className="mt-3 font-jakarta text-base leading-6 text-text-secondary">
          Your calm companion for the everyday moments.
        </Text>
        <View className="mt-10 gap-4">
          <TextInput
            className="rounded-input border border-border bg-card px-5 py-4 font-jakarta text-text-primary"
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            className="rounded-input border border-border bg-card px-5 py-4 font-jakarta text-text-primary"
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
          />
          <Button onPress={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </View>
        <Link
          href={'/(auth)/register' as never}
          className="mt-7 text-center font-jakarta text-text-secondary"
        >
          New here? <Text className="font-jakarta-bold text-text-primary">Create an account</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
