import { StripeProvider } from '@stripe/stripe-react-native';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastBanner } from '@/components/ui/ToastBanner';
import { useAuthStore } from '@/store/useAuthStore';

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <SafeAreaProvider>
      <StripeProvider
        publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
        merchantIdentifier="merchant.com.staked.app"
      >
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} />
          <ToastBanner />
        </View>
      </StripeProvider>
    </SafeAreaProvider>
  );
}
