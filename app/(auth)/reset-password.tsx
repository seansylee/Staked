import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordScreen() {
  const [loading, setLoading] = useState(false);
  const session = useAuthStore((s) => s.session);
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const showToast = useUIStore((s) => s.showToast);

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await updatePassword(data.password);
      showToast('Password updated — you’re all set.');
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not update the password.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  // Reachable only through a verified recovery link (which creates a session).
  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.subtitle}>This screen needs a valid reset link.</Text>
          <Button
            title="Request a new link"
            onPress={() => router.replace('/(auth)/forgot-password')}
            style={styles.btn}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <View style={styles.header}>
          <Text style={styles.title}>New password</Text>
          <Text style={styles.subtitle}>Set a new password for your account.</Text>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <Input
                label="New Password"
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
          <Controller
            control={control}
            name="confirm"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Confirm Password"
                placeholder="Repeat it"
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                value={value}
                onChangeText={onChange}
                error={errors.confirm?.message}
              />
            )}
          />
          <Button title="Update Password" onPress={handleSubmit(onSubmit)} loading={loading} style={styles.btn} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  kav: { flex: 1, paddingHorizontal: 28, paddingTop: 48 },
  centered: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 16 },
  header: { gap: 8, marginBottom: 40 },
  title: { fontSize: 32, fontFamily: 'HelveticaNeue-CondensedBlack', color: colors.text, letterSpacing: -0.5, transform: [{ scaleY: 1.35 }] },
  subtitle: { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
  form: { gap: 20 },
  btn: { marginTop: 8 },
});
