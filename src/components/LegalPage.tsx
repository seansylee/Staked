import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/constants/theme';

export interface LegalSection {
  heading?: string;
  body: string;
}

interface LegalPageProps {
  title: string;
  updated: string;
  sections: LegalSection[];
}

export function LegalPage({ title, updated, sections }: LegalPageProps) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/settings'))}
          style={styles.back}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.updated}>Last updated {updated}</Text>

        {sections.map((s, i) => (
          <View key={i}>
            {s.heading && <Text style={styles.heading}>{s.heading}</Text>}
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 64 },
  back: { paddingVertical: 12 },
  backText: { fontSize: 22, color: colors.textSecondary },
  title: {
    fontSize: 28,
    fontFamily: 'HelveticaNeue-CondensedBlack',
    color: colors.text,
    letterSpacing: -0.5,
    transform: [{ scaleY: 1.35 }],
  },
  updated: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: 20 },
  heading: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 18, marginBottom: 6 },
  body: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
});
