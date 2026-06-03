import { Tabs } from 'expo-router';
import { colors } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 4,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: () => null }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: () => null }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: () => null }} />
    </Tabs>
  );
}
