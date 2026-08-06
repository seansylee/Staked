import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { FEATURED_CHARITIES } from '@/lib/charities';
import { colors, radius } from '@/constants/theme';
import { useChallengeStore } from '@/store/useChallengeStore';

export default function CharityScreen() {
  const { draft, setDraft } = useChallengeStore();
  const [selected, setSelected] = useState<string | null>(draft?.charity_id ?? null);

  useEffect(() => {
    if (!draft) router.replace('/challenge/new/details');
  }, [draft]);

  if (!draft) return null;

  const onNext = () => {
    if (!selected) return;
    setDraft({ charity_id: selected });
    router.replace('/challenge/new/payment');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.stepText}>2 / 3</Text>
        <Text style={styles.title}>Pick a Charity</Text>
        <Text style={styles.subtitle}>
          If you miss a goal, that money is held by Staked and donated to the cause you choose
          at the end of the month.
        </Text>

        {FEATURED_CHARITIES.map((c) => {
          const isActive = selected === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              activeOpacity={0.8}
              style={[styles.card, isActive && styles.cardActive]}
              onPress={() => setSelected(c.id)}
            >
              <Text style={styles.emoji}>{c.emoji}</Text>
              <View style={styles.cardBody}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.tagline}>{c.tagline}</Text>
                <Text style={styles.description}>{c.description}</Text>
                <Text style={styles.meta}>
                  501(c)(3) · EIN {c.ein} · {c.website}
                </Text>
              </View>
              <View style={[styles.radio, isActive && styles.radioActive]}>
                {isActive && <Text style={styles.radioCheck}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.disclaimer}>
          Staked donates 100% of forfeited stakes in a monthly batch. Charities listed are
          independent organizations, not affiliated with or endorsing Staked.
        </Text>

        <Button title="Next: Review →" onPress={onNext} disabled={!selected} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48, gap: 14 },
  back: { paddingVertical: 12 },
  backText: { fontSize: 22, color: colors.textSecondary },
  stepText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: { fontSize: 28, fontFamily: 'HelveticaNeue-CondensedBlack', color: colors.text, letterSpacing: -0.5, transform: [{ scaleY: 1.35 }] },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: -8, lineHeight: 21 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardActive: { borderColor: colors.white, backgroundColor: colors.surfaceHigh },
  emoji: { fontSize: 30 },
  cardBody: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  tagline: { fontSize: 13, color: colors.textSecondary },
  description: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: 2 },
  meta: { fontSize: 10, color: colors.textMuted, marginTop: 4, letterSpacing: 0.2 },
  disclaimer: { fontSize: 11, color: colors.textMuted, lineHeight: 16, textAlign: 'center', paddingHorizontal: 8 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { backgroundColor: colors.white, borderColor: colors.white },
  radioCheck: { fontSize: 14, color: colors.black, fontWeight: '700' },
});
