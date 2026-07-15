import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Button } from '@/components/ui/Button';
import { exchangeCodeFromLink } from '@/lib/authLink';
import { colors } from '@/constants/theme';
import { useUIStore } from '@/store/useUIStore';

// Target of staked://auth/callback — the email-confirmation link.
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const showToast = useUIStore((s) => s.showToast);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    exchangeCodeFromLink(params).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        showToast('Email confirmed — welcome to Staked!');
        router.replace('/(tabs)');
      } else {
        setErrorMessage(result.message ?? 'Confirmation failed.');
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {errorMessage ? (
        <>
          <Text style={styles.title}>Link didn&apos;t work</Text>
          <Text style={styles.body}>{errorMessage}</Text>
          <Button
            title="Go to Sign In"
            onPress={() => router.replace('/(auth)/sign-in')}
            style={styles.button}
          />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.textSecondary} />
          <Text style={styles.body}>Confirming your email…</Text>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  button: { alignSelf: 'stretch', marginTop: 12 },
});
