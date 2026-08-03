import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Baby } from '@momaa/types';
import { Button, Card } from '@momaa/ui';
import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { useBabies } from '../../lib/babies';

export default function DashboardScreen() {
  const token = useAuthStore((state) => state.tokens?.accessToken);
  const babies = useBabies();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const createBaby = useMutation({
    mutationFn: () =>
      apiRequest<{ data: Baby }>(
        '/babies',
        {
          method: 'POST',
          body: JSON.stringify({
            firstName: firstName.trim(),
            dateOfBirth: new Date(`${dateOfBirth}T00:00:00.000Z`).toISOString()
          })
        },
        token
      ),
    onSuccess: () => {
      setFirstName('');
      setDateOfBirth('');
      void queryClient.invalidateQueries({ queryKey: ['babies'] });
    },
    onError: (error) => Alert.alert('Could not save baby profile', error instanceof Error ? error.message : 'Please try again.')
  });
  return (
    <Screen>
      <View className="pt-8">
        <Text className="font-jakarta-bold text-3xl tracking-tight text-text-primary">Dashboard</Text>
        <Text className="mt-2 font-jakarta text-base leading-6 text-text-secondary">Your family, all in one calm place.</Text>
        {babies.isLoading ? <ActivityIndicator className="mt-8" color="#FFD54F" /> : null}
        {babies.isError ? <Text className="mt-6 font-jakarta text-error">Could not load baby profiles. Check that the API is running.</Text> : null}
        {babies.data?.map((baby) => (
          <Card key={baby.id} style={{ marginTop: 20 }}>
            <Text className="font-jakarta-bold text-xl text-text-primary">{baby.firstName}{baby.lastName ? ` ${baby.lastName}` : ''}</Text>
            <Text className="mt-2 font-jakarta text-text-secondary">Born {new Date(baby.dateOfBirth).toLocaleDateString()}</Text>
            <Button onPress={() => router.push({ pathname: '/expression', params: { babyId: baby.id } } as never)} style={{ marginTop: 16 }}>Check on {baby.firstName}</Button>
          </Card>
        ))}
        {!babies.isLoading && !babies.data?.length ? (
          <Card style={{ marginTop: 24 }}>
            <Text className="font-jakarta-bold text-lg text-text-primary">Add your baby</Text>
            <Text className="mt-2 font-jakarta leading-6 text-text-secondary">Create a profile to begin tracking feeds, sleep, and everyday moments.</Text>
            <TextInput className="mt-5 rounded-input border border-border bg-background px-4 py-3 font-jakarta text-text-primary" placeholder="Baby's first name" placeholderTextColor="#9CA3AF" value={firstName} onChangeText={setFirstName} />
            <TextInput className="mt-3 rounded-input border border-border bg-background px-4 py-3 font-jakarta text-text-primary" placeholder="Date of birth (YYYY-MM-DD)" placeholderTextColor="#9CA3AF" value={dateOfBirth} onChangeText={setDateOfBirth} />
            <Button onPress={() => createBaby.mutate()} disabled={!firstName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || createBaby.isPending} style={{ marginTop: 14 }}>
              {createBaby.isPending ? 'Saving…' : 'Create baby profile'}
            </Button>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
