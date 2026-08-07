import { useQuery } from '@tanstack/react-query';
import type { RhythmConfidenceLevel, RhythmResponse } from '@momaa/types';
import { Card } from '@momaa/ui';
import { VictoryAxis, VictoryChart, VictoryLine, VictoryTheme } from 'victory-native';
import { ActivityIndicator, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { useBabies } from '../../lib/babies';

const badgeStyle: Record<RhythmConfidenceLevel, string> = {
  learning: 'bg-gray-100 text-gray-600',
  low: 'bg-yellow-100 text-yellow-700',
  medium: 'bg-yellow-200 text-yellow-800',
  high: 'bg-yellow-400 text-yellow-950',
  very_high: 'bg-green-100 text-green-800'
};
const confidenceLabel: Record<RhythmConfidenceLevel, string> = {
  learning: 'Learning',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  very_high: 'Very High'
};
const titleFor = {
  feeding: 'Feeding rhythm',
  sleep: 'Sleep rhythm',
  active_hours: 'Active hours',
  growth: 'Growth trend'
};

export default function RhythmScreen() {
  const token = useAuthStore((state) => state.tokens?.accessToken);
  const { data: babies } = useBabies();
  const baby = babies?.[0];
  const rhythm = useQuery({
    queryKey: ['rhythm', baby?.id],
    enabled: Boolean(baby && token),
    queryFn: () => apiRequest<RhythmResponse>(`/babies/${baby!.id}/rhythm`, {}, token)
  });
  const frequency = rhythm.data?.meta.feedingFrequency ?? [];
  const chartData = frequency.map((point) => ({ x: point.date.slice(5), y: point.count }));
  const allLearning = rhythm.data?.data.every((item) => item.confidenceLevel === 'learning');

  return (
    <Screen>
      <View className="pt-8">
        <Text className="font-jakarta-bold text-3xl text-text-primary">Rhythm</Text>
        <Text className="mt-2 font-jakarta text-text-secondary">
          Gentle patterns from {baby?.firstName ?? 'your baby'}’s recent logs.
        </Text>
        {!baby ? (
          <Text className="mt-6 font-jakarta text-text-secondary">
            Create a baby profile on Dashboard to begin learning their rhythm.
          </Text>
        ) : null}
        {baby && rhythm.isLoading ? <ActivityIndicator className="mt-10" color="#D4A017" /> : null}
        {baby && rhythm.data ? (
          <View className="mt-6">
            <Card>
              <Text className="font-jakarta-bold text-lg text-text-primary">
                Feeds in the last 7 days
              </Text>
              <VictoryChart
                height={210}
                padding={{ top: 28, bottom: 42, left: 42, right: 22 }}
                theme={VictoryTheme.material}
              >
                <VictoryAxis
                  style={{
                    tickLabels: { fontSize: 9, fill: '#6B7280' },
                    axis: { stroke: '#E5E7EB' },
                    grid: { stroke: 'transparent' }
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  tickFormat={(value) => `${value}`}
                  style={{
                    tickLabels: { fontSize: 9, fill: '#6B7280' },
                    axis: { stroke: '#E5E7EB' },
                    grid: { stroke: '#F3F4F6' }
                  }}
                />
                <VictoryLine
                  data={chartData}
                  interpolation="monotoneX"
                  style={{ data: { stroke: '#D4A017', strokeWidth: 3 } }}
                />
              </VictoryChart>
            </Card>
            {allLearning ? (
              <Text className="mt-5 px-2 font-jakarta text-base leading-6 text-text-secondary">
                Still learning {baby.firstName}’s rhythm — check back in a few days as you add
                feeds, sleep, and other moments.
              </Text>
            ) : null}
            <View className="mt-4 gap-3">
              {rhythm.data.data.map((item) => (
                <Card key={item.type}>
                  <View className="flex-row items-center justify-between">
                    <Text className="font-jakarta-bold text-base text-text-primary">
                      {titleFor[item.type]}
                    </Text>
                    <Text
                      className={`rounded-full px-3 py-1 font-jakarta-bold text-xs ${badgeStyle[item.confidenceLevel]}`}
                    >
                      {confidenceLabel[item.confidenceLevel]}
                    </Text>
                  </View>
                  <Text className="mt-3 font-jakarta text-sm leading-6 text-text-secondary">
                    {item.insight}
                  </Text>
                  <Text className="mt-3 font-jakarta text-xs text-text-secondary">
                    {item.dataPointCount} logged data point{item.dataPointCount === 1 ? '' : 's'}
                  </Text>
                </Card>
              ))}
            </View>
          </View>
        ) : null}
        {rhythm.isError ? (
          <Text className="mt-6 font-jakarta text-text-secondary">
            We couldn’t load rhythm patterns just now. Please try again soon.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
