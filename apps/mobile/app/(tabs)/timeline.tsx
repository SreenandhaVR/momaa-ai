import { useQuery } from '@tanstack/react-query';
import type { TimelineEvent } from '@momaa/types';
import { Card } from '@momaa/ui';
import { ActivityIndicator, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { useBabies } from '../../lib/babies';

export default function TimelineScreen() {
  const token = useAuthStore((state) => state.tokens?.accessToken);
  const { data: babies } = useBabies();
  const baby = babies?.[0];
  const timeline = useQuery({
    queryKey: ['timeline', baby?.id],
    enabled: Boolean(baby && token),
    queryFn: () =>
      apiRequest<{ data: TimelineEvent[] }>(`/babies/${baby!.id}/timeline`, {}, token).then(
        (result) => result.data
      )
  });
  const today = new Date().toLocaleDateString();
  const events = timeline.data?.filter(
    (event) => new Date(event.occurredAt).toLocaleDateString() === today
  );
  return (
    <Screen>
      <View className="pt-8">
        <Text className="font-jakarta-bold text-3xl text-text-primary">Timeline</Text>
        <Text className="mt-2 font-jakarta text-text-secondary">
          Today’s moments for {baby?.firstName ?? 'your family'}.
        </Text>
        {timeline.isLoading ? <ActivityIndicator className="mt-8" color="#FFD54F" /> : null}
        {timeline.isError ? (
          <Text className="mt-6 font-jakarta text-error">Could not load the timeline.</Text>
        ) : null}
        {!baby ? (
          <Text className="mt-6 font-jakarta text-text-secondary">
            Create a baby profile on Dashboard to see a timeline.
          </Text>
        ) : null}
        {events?.length === 0 ? (
          <Text className="mt-6 font-jakarta text-text-secondary">
            No events recorded today. Try a quick log from Dashboard.
          </Text>
        ) : null}
        {events?.map((event) => (
          <Card key={event.id} style={{ marginTop: 14 }}>
            <Text className="font-jakarta-bold capitalize text-text-primary">{event.type}</Text>
            <Text className="mt-1 font-jakarta text-text-secondary">
              {new Date(event.occurredAt).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit'
              })}
            </Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
