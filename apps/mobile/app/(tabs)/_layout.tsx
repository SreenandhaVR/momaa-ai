import { Tabs } from 'expo-router';
import {
  MessageCircle,
  Music2,
  UserRound,
  CalendarDays,
  LayoutDashboard
} from 'lucide-react-native';
import { View } from 'react-native';

const tabIcon =
  (Icon: typeof LayoutDashboard) =>
  ({ focused }: { focused: boolean }) => (
    <View
      className={`h-11 w-14 items-center justify-center rounded-full ${focused ? 'bg-section' : 'bg-transparent'}`}
    >
      <Icon size={22} color={focused ? '#2C2C2C' : '#9CA3AF'} strokeWidth={2} />
    </View>
  );

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#2C2C2C',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          height: 84,
          paddingTop: 8,
          borderTopColor: '#ECE7DA',
          backgroundColor: '#FFFFFF'
        },
        tabBarLabelStyle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11 }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarIcon: tabIcon(LayoutDashboard) }}
      />
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarIcon: tabIcon(MessageCircle) }} />
      <Tabs.Screen name="rhythm" options={{ title: 'Rhythm', tabBarIcon: tabIcon(Music2) }} />
      <Tabs.Screen
        name="timeline"
        options={{ title: 'Timeline', tabBarIcon: tabIcon(CalendarDays) }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon(UserRound) }} />
    </Tabs>
  );
}
