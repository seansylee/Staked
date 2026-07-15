import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { z } from 'zod';
import { posthog } from '@/lib/posthog';
import { registerForPushNotifications } from '@/lib/notifications';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof schema>;

export default function SignUpScreen() {
  const [loading, setLoading] = useState(false);
  const signUp = useAuthStore((s) => s.signUp);

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const result = await signUp(data.email, data.password);
      posthog.capture('user_signed_up');

      if (result.maybeExistingAccount) {
        Alert.alert(
          'Account may already exist',
          'If this email is already registered you won’t receive a new confirmation. Try signing in instead.',
          [
            { text: 'Sign In', onPress: () => router.replace('/(auth)/sign-in') },
            { text: 'OK', style: 'cancel' },
          ]
        );
        return;
      }

      if (result.needsEmailConfirmation) {
        router.replace({ pathname: '/(auth)/confirm-email', params: { email: data.email } });
        return;
      }

      registerForPushNotifications();
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign up failed. Please try again.';
      posthog.capture('sign_up_failed', { error: message });
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Start holding yourself accountable.</Text>
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
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Password"
                placeholder="Min. 8 characters"
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                value={value}
                onChangeText={onChange}
                error={errors.password?.message}
              />
            )}
          />
          <Button title="Create Account" onPress={handleSubmit(onSubmit)} loading={loading} style={styles.btn} />
        </View>

        <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')} style={styles.switchRow}>
          <Text style={styles.switchText}>
            Already have an account?{' '}
            <Text style={styles.switchLink}>Sign In</Text>
          </Text>
        </TouchableOpacity>
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
  subtitle: { fontSize: 16, color: colors.textSecondary },
  form: { gap: 20 },
  btn: { marginTop: 8 },
  switchRow: { marginTop: 28, alignItems: 'center' },
  switchText: { fontSize: 14, color: colors.textSecondary },
  switchLink: { color: colors.text, fontWeight: '600' },
});
