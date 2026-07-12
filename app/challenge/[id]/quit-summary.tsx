import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RefundStatusNote } from '@/components/challenge/RefundStatusNote';
import { Button } from '@/components/ui/Button';
import { colors, radius } from '@/constants/theme';
import { useChallengeStore } from '@/store/useChallengeStore';
import { formatCurrency, formatDate } from '@/utils/formatting';

export default function QuitSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const challenges = useChallengeStore((s) => s.challenges);

  const challenge = challenges.find((c) => c.id === id);

  if (!challenge || challenge.status !== 'quit') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.muted}>No summary available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const refundCents = challenge.protected_amount_cents ?? 0;
  const penaltyCents = challenge.quit_penalty_cents ?? 0;
  const missedForfeitCents = (challenge.forfeited_amount_cents ?? 0) - penaltyCents;
  const windowLabel = challenge.goal_window === 'daily' ? 'day' : challenge.goal_window === 'weekly' ? 'week' : 'month';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Challenge Ended Early</Text>
          <Text style={styles.heroName}>{challenge.name}</Text>
          <Text style={styles.heroSub}>
            {challenge.refund_status === 'failed'
              ? 'There was a problem with your refund'
              : 'Your refund is on the way'}
          </Text>
        </View>

        <View style={styles.card}>
          <Row label="Original Stake" value={formatCurrency(challenge.stake_amount)} />
          {missedForfeitCents > 0 && (
            <Row label="Missed check-ins" value={`− ${formatCurrency(missedForfeitCents)}`} valueColor={colors.danger} />
          )}
          <Row label="Early-exit penalty (20%)" value={`− ${formatCurrency(penaltyCents)}`} valueColor={colors.danger} />
          <View style={styles.divider} />
          <Row
            label="Returned to you"
            value={formatCurrency(refundCents)}
            valueColor={colors.success}
            large
          />
        </View>

        <View style={styles.card}>
          <Row label="Start" value={formatDate(challenge.start_date)} />
          <Row label="Goal" value={`${challenge.target_count}× per ${windowLabel}`} />
          <Row label="Duration" value={`${challenge.duration_days} days`} />
        </View>

        <RefundStatusNote challenge={challenge} />

        <Button title="Back to Dashboard" onPress={() => router.replace('/(tabs)')} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  valueColor = colors.text,
  large = false,
}: {
  label: string;
  value: string;
  valueColor?: string;
  large?: boolean;
}) {
  return (
    <View style={rowStyles.row}>
      <Text style={[rowStyles.label, large && rowStyles.labelLarge]}>{label}</Text>
      <Text style={[rowStyles.value, { color: valueColor }, large && rowStyles.valueLarge]}>
        {value}
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  label: { fontSize: 14, color: colors.textSecondary },
  labelLarge: { fontSize: 15, fontWeight: '600', color: colors.text },
  value: { fontSize: 15, fontWeight: '600' },
  valueLarge: { fontSize: 24, fontFamily: 'HelveticaNeue-CondensedBlack', letterSpacing: -0.5, transform: [{ scaleY: 1.35 }] },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 48, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: { color: colors.textSecondary },
  hero: { paddingBottom: 24, gap: 6 },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroName: {
    fontSize: 34,
    fontFamily: 'HelveticaNeue-CondensedBlack',
    color: colors.text,
    letterSpacing: -0.5,
    transform: [{ scaleY: 1.35 }],
  },
  heroSub: { fontSize: 16, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
});
