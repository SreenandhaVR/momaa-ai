import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

export function Button({
  children,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style
}: {
  children: ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.base, styles[variant], disabled && styles.disabled, style]}
    >
      {loading ? (
        <View style={styles.loadingContent}>
          <ActivityIndicator color="#2C2C2C" size="small" />
          <Text style={[styles.label, variant === 'ghost' && styles.ghostLabel]}>{children}</Text>
        </View>
      ) : (
        <Text style={[styles.label, variant === 'ghost' && styles.ghostLabel]}>{children}</Text>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  primary: { backgroundColor: '#FFD54F' },
  secondary: { backgroundColor: '#FFF8E8', borderWidth: 1, borderColor: '#ECE7DA' },
  ghost: { backgroundColor: 'transparent' },
  label: {
    color: '#2C2C2C',
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.1
  },
  ghostLabel: { color: '#6B7280' },
  loadingContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disabled: { opacity: 0.5 }
});
