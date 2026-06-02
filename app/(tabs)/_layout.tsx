import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { borderTopColor: '#f0f0f0' },
        tabBarActiveTintColor: '#1a1a1a',
        tabBarInactiveTintColor: '#aaa',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: () => null }}
      />
    </Tabs>
  );
}
