import { Button } from '@momaa/ui';
import { Text, View } from 'react-native';
import { useAuthStore } from '../../lib/auth-store';
import { Screen } from '../../components/Screen';
export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  return (
    <Screen>
      <View className="pt-8">
        <Text className="font-jakarta-bold text-3xl text-text-primary">Profile</Text>
        <Text className="mt-2 font-jakarta text-text-secondary">
          {user?.displayName ?? 'Momaa parent'}
        </Text>
        <Button variant="secondary" onPress={() => void signOut()} style={{ marginTop: 28 }}>
          Sign out
        </Button>
      </View>
    </Screen>
  );
}
