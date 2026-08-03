import { useQuery } from '@tanstack/react-query';
import type { TimelineEvent } from '@momaa/types';
import { Card } from '@momaa/ui';
import { Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { useBabies } from '../../lib/babies';

export default function RhythmScreen() {
  const token = useAuthStore((state) => state.tokens?.accessToken);
  const { data: babies } = useBabies();
  const baby = babies?.[0];
  const events = useQuery({ queryKey: ['rhythm', baby?.id], enabled: Boolean(baby && token), queryFn: () => apiRequest<{ data: TimelineEvent[] }>(`/babies/${baby!.id}/timeline?date=${new Date().toISOString().slice(0, 10)}`, {}, token).then((result) => result.data) });
  const feedCount = events.data?.filter((event) => event.type === 'feed').length ?? 0;
  const sleepCount = events.data?.filter((event) => event.type === 'sleep').length ?? 0;
  const diaperCount = events.data?.filter((event) => event.type === 'diaper').length ?? 0;
  return <Screen><View className="pt-8"><Text className="font-jakarta-bold text-3xl text-text-primary">Rhythm</Text><Text className="mt-2 font-jakarta text-text-secondary">A simple view of {baby?.firstName ?? 'your baby'}’s day.</Text>{!baby ? <Text className="mt-6 font-jakarta text-text-secondary">Create a baby profile on Dashboard to view daily activity.</Text> : <View className="mt-6 gap-3"><Card><Text className="font-jakarta text-text-secondary">Feeds today</Text><Text className="mt-1 font-jakarta-bold text-3xl text-text-primary">{feedCount}</Text></Card><Card><Text className="font-jakarta text-text-secondary">Sleep sessions today</Text><Text className="mt-1 font-jakarta-bold text-3xl text-text-primary">{sleepCount}</Text></Card><Card><Text className="font-jakarta text-text-secondary">Diaper changes today</Text><Text className="mt-1 font-jakarta-bold text-3xl text-text-primary">{diaperCount}</Text></Card></View>}</View></Screen>;
}
