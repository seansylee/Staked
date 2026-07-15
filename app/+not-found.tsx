import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { colors } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Nothing here</Text>
        <Text style={styles.subtitle}>That link doesn&apos;t match any screen.</Text>
        <Link href="/(tabs)" style={styles.link}>
          Back to Dashboard
        </Link>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary },
  link: { marginTop: 16, fontSize: 15, fontWeight: '600', color: colors.text, textDecorationLine: 'underline' },
});
