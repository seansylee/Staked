import { StripeProvider } from '@stripe/stripe-react-native';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}>
      <Stack screenOptions={{ headerShown: false }} />
    </StripeProvider>
  );
}
