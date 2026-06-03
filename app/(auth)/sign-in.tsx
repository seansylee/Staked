import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { z } from 'zod';
import { registerForPushNotifications } from '@/lib/notifications';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export default function SignInScreen() {
  const [loading, setLoading] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await signIn(data.email, data.password);
      registerForPushNotifications();
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed. Please try again.';
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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to check your stake.</Text>
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
                placeholder="Your password"
                secureTextEntry
                value={value}
                onChangeText={onChange}
                error={errors.password?.message}
              />
            )}
          />
          <Button title="Sign In" onPress={handleSubmit(onSubmit)} loading={loading} style={styles.btn} />
        </View>

        <TouchableOpacity onPress={() => router.replace('/(auth)/sign-up')} style={styles.switchRow}>
          <Text style={styles.switchText}>
            No account?{' '}
            <Text style={styles.switchLink}>Create one</Text>
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
  title: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  subtitle: { fontSize: 16, color: colors.textSecondary },
  form: { gap: 20 },
  btn: { marginTop: 8 },
  switchRow: { marginTop: 28, alignItems: 'center' },
  switchText: { fontSize: 14, color: colors.textSecondary },
  switchLink: { color: colors.text, fontWeight: '600' },
});
