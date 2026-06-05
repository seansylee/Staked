import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/theme';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.wordmark}>Staked</Text>
          <Text style={styles.tagline}>
            Put real money behind{'\n'}your commitments.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button title="Get Started" onPress={() => router.push('/(auth)/sign-up')} />
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')} style={styles.signInBtn}>
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 64,
    gap: 16,
  },
  wordmark: {
    fontSize: 64,
    fontFamily: 'HelveticaNeue-CondensedBlack',
    color: colors.text,
    letterSpacing: -0.5,
    transform: [{ scaleY: 1.35 }],
  },
  tagline: {
    fontSize: 22,
    color: colors.textSecondary,
    lineHeight: 32,
    fontWeight: '400',
  },
  actions: { gap: 12 },
  signInBtn: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
