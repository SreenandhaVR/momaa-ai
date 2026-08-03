import type { ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ECE7DA'
  }
});
