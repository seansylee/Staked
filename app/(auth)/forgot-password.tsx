import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await requestPasswordReset(data.email);
      setSentTo(data.email);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not send the reset email.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.sentContent}>
          <Text style={styles.emoji}>📬</Text>
          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.subtitle}>
            If an account exists for <Text style={styles.email}>{sentTo}</Text>, a reset link is on
            its way. Open it on this phone to set a new password.
          </Text>
          <Button title="Back to Sign In" onPress={() => router.replace('/(auth)/sign-in')} style={styles.btn} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>We&apos;ll email you a reset link.</Text>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Email"
                placeholder="you@example.com"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                autoCorrect={false}
                value={value}
                onChangeText={onChange}
                error={errors.email?.message}
              />
            )}
          />
          <Button title="Send Reset Link" onPress={handleSubmit(onSubmit)} loading={loading} style={styles.btn} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  kav: { flex: 1, paddingHorizontal: 28 },
  back: { paddingTop: 8, paddingBottom: 32 },
  backText: { fontSize: 22, color: colors.textSecondary },
  header: { gap: 8, marginBottom: 40 },
  title: { fontSize: 32, fontFamily: 'HelveticaNeue-CondensedBlack', color: colors.text, letterSpacing: -0.5, transform: [{ scaleY: 1.35 }] },
  subtitle: { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
  email: { color: colors.text, fontWeight: '600' },
  form: { gap: 20 },
  btn: { marginTop: 8 },
  sentContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  emoji: { fontSize: 44 },
});
