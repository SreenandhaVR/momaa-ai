import { StyleSheet, Text, View } from 'react-native';
export function ConfidenceBadge({
  level
}: {
  level: 'learning' | 'low' | 'medium' | 'high' | 'very_high';
}) {
  const label = level === 'very_high' ? 'Very high' : level[0].toUpperCase() + level.slice(1);
  return (
    <View style={styles.badge}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 99,
    backgroundColor: '#FFF4CC',
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  label: { color: '#6B7280', fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' }
});
