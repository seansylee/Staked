import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.logo}>Staked</Text>
          <Text style={styles.tagline}>
            Put real money behind your{'\n'}commitments. Follow through.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button title="Create Account" onPress={() => router.push('/(auth)/sign-up')} />
          <Button
            title="Sign In"
            variant="ghost"
            onPress={() => router.push('/(auth)/sign-in')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: 40,
    paddingTop: 80,
  },
  hero: { gap: 16 },
  logo: { fontSize: 48, fontWeight: '800', color: '#1a1a1a', letterSpacing: -2 },
  tagline: { fontSize: 20, color: '#555', lineHeight: 30 },
  actions: { gap: 12 },
});
