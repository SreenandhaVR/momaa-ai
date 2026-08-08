import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Baby } from '@momaa/types';
import { Button, Card } from '@momaa/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { useBabies } from '../../lib/babies';

type DashboardData = {
  data: {
    baby: Baby;
    insight: { summary?: string } | null;
    upcomingVaccinations: Array<{ id: string; name?: string; nextDueAt?: string }>;
    growth: Array<{ weightKg?: number; heightCm?: number; recordedAt?: string }>;
    recentTimeline: Array<{ id: string; type?: string; occurredAt?: string }>;
  };
};
type Action = 'feeds' | 'sleep' | 'diapers' | 'medicines';
export default function DashboardScreen() {
  const token = useAuthStore((state) => state.tokens?.accessToken);
  const user = useAuthStore((state) => state.user);
  const babies = useBabies();
  const baby = babies.data?.[0];
  const client = useQueryClient();
  const [action, setAction] = useState<Action>();
  const [amount, setAmount] = useState('90');
  const [medicine, setMedicine] = useState('');
  const dashboard = useQuery({
    queryKey: ['dashboard', baby?.id],
    enabled: Boolean(baby && token),
    queryFn: () => apiRequest<DashboardData>(`/babies/${baby!.id}/dashboard`, {}, token)
  });
  const quickLog = useMutation({
    mutationFn: async () => {
      if (!baby || !action) return;
      const now = new Date().toISOString();
      const body =
        action === 'feeds'
          ? { method: 'bottle', amountMl: Number(amount), timestamp: now, source: 'app' }
          : action === 'sleep'
            ? { startTime: now, isActive: true, source: 'app' }
            : action === 'diapers'
              ? { kind: 'wet', timestamp: now, source: 'app' }
              : {
                  name: medicine || 'Medicine',
                  dosage: 'Not specified',
                  administrationMethod: 'oral',
                  administeredAt: now,
                  source: 'app'
                };
      return apiRequest(
        `/babies/${baby.id}/${action}`,
        { method: 'POST', body: JSON.stringify(body) },
        token
      );
    },
    onSuccess: () => {
      setAction(undefined);
      void client.invalidateQueries({ queryKey: ['dashboard', baby?.id] });
      void client.invalidateQueries({ queryKey: ['timeline'] });
    },
    onError: (error) =>
      Alert.alert(
        'Could not save update',
        error instanceof Error ? error.message : 'Please try again.'
      )
  });
  const data = dashboard.data?.data;
  const latestGrowth = data?.growth[0];
  const previousGrowth = data?.growth[1];
  return (
    <Screen>
      <View className="pt-8">
        <Text className="font-jakarta text-text-secondary">
          Good day, {user?.displayName?.split(' ')[0] ?? 'parent'}
        </Text>
        <Text className="mt-1 font-jakarta-bold text-3xl text-text-primary">
          {baby ? `${baby.firstName}’s day` : 'Your family'}
        </Text>
        {babies.isLoading ? <View className="mt-6 h-40 rounded-input bg-section" /> : null}
        {!baby && !babies.isLoading ? (
          <Card style={{ marginTop: 24 }}>
            <Text className="font-jakarta-bold text-lg text-text-primary">Let’s add your baby</Text>
            <Text className="mt-2 font-jakarta text-text-secondary">
              Set up a profile to start logging everyday moments.
            </Text>
            <Button onPress={() => router.push('/onboarding' as never)} style={{ marginTop: 16 }}>
              Create baby profile
            </Button>
          </Card>
        ) : null}
        {baby ? (
          <>
            <Card style={{ marginTop: 20 }}>
              <Text className="font-jakarta-bold text-xl text-text-primary">{baby.firstName}</Text>
              <Text className="mt-1 font-jakarta text-text-secondary">
                Born {new Date(baby.dateOfBirth).toLocaleDateString()}
              </Text>
              <Button
                onPress={() =>
                  router.push({ pathname: '/expression', params: { babyId: baby.id } } as never)
                }
                style={{ marginTop: 12 }}
              >
                Check on {baby.firstName}
              </Button>
            </Card>
            <Card style={{ marginTop: 14, backgroundColor: '#FFF4CC' }}>
              <Text className="font-jakarta-bold text-text-primary">Today’s Momaa insight</Text>
              <Text className="mt-2 font-jakarta leading-6 text-text-secondary">
                {data?.insight?.summary ??
                  'Still learning your family’s rhythm. Add a few moments and Momaa will surface gentle patterns here.'}
              </Text>
            </Card>
            <Text className="mt-6 font-jakarta-bold text-lg text-text-primary">Quick log</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {(['feeds', 'sleep', 'diapers', 'medicines'] as Action[]).map((item) => (
                <Button key={item} variant="secondary" onPress={() => setAction(item)}>
                  {item === 'feeds'
                    ? 'Feed'
                    : item === 'sleep'
                      ? 'Sleep'
                      : item === 'diapers'
                        ? 'Diaper'
                        : 'Medicine'}
                </Button>
              ))}
            </View>
            <Text className="mt-6 font-jakarta-bold text-lg text-text-primary">
              Upcoming reminders
            </Text>
            {data?.upcomingVaccinations.length ? (
              data.upcomingVaccinations.map((item) => (
                <Card key={item.id} style={{ marginTop: 10 }}>
                  <Text className="font-jakarta text-text-primary">
                    {item.name} ·{' '}
                    {item.nextDueAt
                      ? new Date(item.nextDueAt).toLocaleDateString()
                      : 'Date to be confirmed'}
                  </Text>
                </Card>
              ))
            ) : (
              <Text className="mt-2 font-jakarta text-text-secondary">
                No upcoming vaccination reminders yet.
              </Text>
            )}
            <Text className="mt-6 font-jakarta-bold text-lg text-text-primary">Recent moments</Text>
            {dashboard.isLoading ? (
              <View className="mt-3 h-28 rounded-input bg-section" />
            ) : data?.recentTimeline.length ? (
              data.recentTimeline.map((event) => (
                <Card key={event.id} style={{ marginTop: 10 }}>
                  <Text className="font-jakarta-bold capitalize text-text-primary">
                    {event.type}
                  </Text>
                  <Text className="mt-1 font-jakarta text-text-secondary">
                    {event.occurredAt
                      ? new Date(event.occurredAt).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit'
                        })
                      : ''}
                  </Text>
                </Card>
              ))
            ) : (
              <Text className="mt-2 font-jakarta text-text-secondary">
                No events yet — try a quick log above.
              </Text>
            )}
            <Text className="mt-6 font-jakarta-bold text-lg text-text-primary">
              Growth snapshot
            </Text>
            <Text className="mt-2 font-jakarta text-text-secondary">
              {latestGrowth
                ? `${latestGrowth.weightKg ? `${latestGrowth.weightKg} kg` : ''}${latestGrowth.heightCm ? ` · ${latestGrowth.heightCm} cm` : ''}${previousGrowth?.weightKg && latestGrowth.weightKg ? (latestGrowth.weightKg >= previousGrowth.weightKg ? ' · moving up from the previous entry' : ' · changed from the previous entry') : ''}`
                : 'Add a growth entry to see a gentle personal trend.'}
            </Text>
          </>
        ) : null}
      </View>
      <Modal
        visible={Boolean(action)}
        transparent
        animationType="slide"
        onRequestClose={() => setAction(undefined)}
      >
        <View className="flex-1 justify-end bg-black/30">
          <View className="rounded-t-sheet bg-background p-6">
            <Text className="font-jakarta-bold text-xl text-text-primary">
              Log{' '}
              {action === 'feeds'
                ? 'a feed'
                : action === 'sleep'
                  ? 'sleep'
                  : action === 'diapers'
                    ? 'a diaper'
                    : 'medicine'}
            </Text>
            {action === 'feeds' ? (
              <TextInput
                className="mt-4 rounded-input border border-border bg-card px-4 py-3 font-jakarta text-text-primary"
                keyboardType="number-pad"
                value={amount}
                onChangeText={setAmount}
                placeholder="Amount (ml)"
              />
            ) : null}
            {action === 'medicines' ? (
              <TextInput
                className="mt-4 rounded-input border border-border bg-card px-4 py-3 font-jakarta text-text-primary"
                value={medicine}
                onChangeText={setMedicine}
                placeholder="Medicine name"
              />
            ) : null}
            <Button
              loading={quickLog.isPending}
              onPress={() => quickLog.mutate()}
              style={{ marginTop: 16 }}
            >
              Save
            </Button>
            <Button variant="ghost" onPress={() => setAction(undefined)} style={{ marginTop: 8 }}>
              Cancel
            </Button>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
