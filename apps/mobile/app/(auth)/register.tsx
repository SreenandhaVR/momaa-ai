import { useMutation } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { Button } from '@momaa/ui';
import { useAuthStore } from '../../lib/auth-store';

export default function RegisterScreen() {
  const register = useAuthStore((state) => state.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      register({
        displayName: name,
        firstName: name.split(' ')[0] || name,
        email: email || undefined,
        phoneNumber: phoneNumber || undefined,
        password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      }),
    onSuccess: () => router.replace('/onboarding' as never),
    onError: (error) =>
      Alert.alert(
        'Could not create account',
        error instanceof Error ? error.message : 'Please try again.'
      )
  });
  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="font-jakarta-bold text-3xl tracking-tight text-text-primary">
          Create your account
        </Text>
        <Text className="mt-3 font-jakarta text-base leading-6 text-text-secondary">
          We’ll help you hold onto the little things.
        </Text>
        <View className="mt-8 gap-3">
          <TextInput
            className="rounded-input border border-border bg-card px-5 py-4 font-jakarta text-text-primary"
            placeholder="Your name"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            className="rounded-input border border-border bg-card px-5 py-4 font-jakarta text-text-primary"
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email (or use phone)"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            className="rounded-input border border-border bg-card px-5 py-4 font-jakarta text-text-primary"
            keyboardType="phone-pad"
            placeholder="WhatsApp phone number"
            placeholderTextColor="#9CA3AF"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
          <TextInput
            className="rounded-input border border-border bg-card px-5 py-4 font-jakarta text-text-primary"
            secureTextEntry
            placeholder="Password (8+ characters)"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
          />
          <Button
            onPress={() => mutation.mutate()}
            disabled={!name || !password || (!email && !phoneNumber) || mutation.isPending}
          >
            {mutation.isPending ? 'Creating account…' : 'Create account'}
          </Button>
        </View>
        <Link
          href={'/(auth)/login' as never}
          className="mt-6 text-center font-jakarta text-text-secondary"
        >
          Already have an account?{' '}
          <Text className="font-jakarta-bold text-text-primary">Sign in</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
