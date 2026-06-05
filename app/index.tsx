import { Redirect } from 'expo-router';
import { DEMO_MODE } from '@/lib/demo';
import { useAuthStore } from '@/store/useAuthStore';

export default function Index() {
  const { session, isLoading } = useAuthStore();

  if (isLoading) return null;

  if (DEMO_MODE) {
    return <Redirect href="/(tabs)" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
}
