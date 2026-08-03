import type { ReactNode } from 'react';
import { SafeAreaView, View } from 'react-native';
export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-5">{children}</View>
    </SafeAreaView>
  );
}
