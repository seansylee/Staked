import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Button } from '@/components/ui/Button';
import { exchangeCodeFromLink } from '@/lib/authLink';
import { colors } from '@/constants/theme';

// Target of staked://auth/reset — the password-recovery link. A successful
// exchange creates a recovery session; the reset screen then sets the new
// password via updateUser.
export default function AuthResetScreen() {
  const params = useLocalSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    exchangeCodeFromLink(params).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        router.replace('/(auth)/reset-password');
      } else {
        setErrorMessage(result.message ?? 'This reset link is invalid or expired.');
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
            title="Request a new link"
            onPress={() => router.replace('/(auth)/forgot-password')}
            style={styles.button}
          />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.textSecondary} />
          <Text style={styles.body}>Verifying reset link…</Text>
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
