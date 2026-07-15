import { StripeProvider } from '@stripe/stripe-react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastBanner } from '@/components/ui/ToastBanner';
import { colors } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';

// Expo Router renders this on any uncaught render error instead of a white
// screen. Money state lives on the server, so a reload is always safe.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={errorStyles.container}>
      <Text style={errorStyles.title}>Something went wrong</Text>
      <Text style={errorStyles.body}>
        Your money and check-ins are safe on our servers. Reload to pick up where you left off.
      </Text>
      <Text style={errorStyles.detail}>{error.message}</Text>
      <TouchableOpacity style={errorStyles.button} onPress={retry} activeOpacity={0.7}>
        <Text style={errorStyles.buttonText}>Reload</Text>
      </TouchableOpacity>
    </View>
  );
}

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
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
          <ToastBanner />
        </View>
      </StripeProvider>
    </SafeAreaProvider>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  detail: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  button: {
    marginTop: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: { color: colors.black, fontWeight: '700', fontSize: 15 },
});
