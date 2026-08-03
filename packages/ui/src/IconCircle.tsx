import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
export function IconCircle({
  children,
  active = false
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return <View style={[styles.circle, active && styles.active]}>{children}</View>;
}
const styles = StyleSheet.create({
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  active: { backgroundColor: '#FFF4CC' }
});
