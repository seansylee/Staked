import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';

const RESEND_COOLDOWN_S = 30;

export default function ConfirmEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const resendConfirmation = useAuthStore((s) => s.resendConfirmation);
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_S);
    timer.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1 && timer.current) clearInterval(timer.current);
        return Math.max(0, s - 1);
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (!email || cooldown > 0) return;
    setSending(true);
    try {
      await resendConfirmation(email);
      startCooldown();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not resend the email.';
      Alert.alert('Error', message);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>📬</Text>
        <Text style={styles.title}>Check your inbox</Text>
        <Text style={styles.body}>
          We sent a confirmation link to{'\n'}
          <Text style={styles.email}>{email ?? 'your email'}</Text>
        </Text>
        <Text style={styles.hint}>
          Open it on this phone to jump straight in. Confirmed it somewhere else? Just sign in below.
        </Text>

        <Button
          title="I've confirmed — Sign In"
          onPress={() => router.replace('/(auth)/sign-in')}
          style={styles.signInBtn}
        />

        <TouchableOpacity onPress={handleResend} disabled={sending || cooldown > 0} style={styles.resend}>
          <Text style={[styles.resendText, (sending || cooldown > 0) && styles.resendDisabled]}>
            {cooldown > 0 ? `Resend email (${cooldown}s)` : sending ? 'Sending…' : 'Resend email'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  emoji: { fontSize: 44 },
  title: {
    fontSize: 32,
    fontFamily: 'HelveticaNeue-CondensedBlack',
    color: colors.text,
    letterSpacing: -0.5,
    transform: [{ scaleY: 1.35 }],
  },
  body: { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
  email: { color: colors.text, fontWeight: '600' },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginTop: 4 },
  signInBtn: { marginTop: 24 },
  resend: { alignItems: 'center', paddingVertical: 14 },
  resendText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  resendDisabled: { color: colors.textMuted },
});
