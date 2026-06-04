import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { colors, radius } from '@/constants/theme';
import { useChallengeStore } from '@/store/useChallengeStore';
import { formatCurrency, formatDate } from '@/utils/formatting';

export default function CompletionSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const challenges = useChallengeStore((s) => s.challenges);
  const goalsMap = useChallengeStore((s) => s.goalsMap);

  const challenge = challenges.find((c) => c.id === id);
  const goals = goalsMap[id] ?? [];

  if (!challenge || challenge.status !== 'completed') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.muted}>No summary available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const protectedCents = challenge.protected_amount_cents ?? 0;
  const forfeitedCents = challenge.forfeited_amount_cents ?? 0;
  const successRate = challenge.stake_amount > 0
    ? Math.round((protectedCents / challenge.stake_amount) * 100)
    : 100;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Complete</Text>
          <Text style={styles.heroName}>{challenge.name}</Text>
          <Text style={styles.heroRate}>{successRate}% protected</Text>
        </View>

        <View style={styles.card}>
          <Row label="Original Stake" value={formatCurrency(challenge.stake_amount)} />
          <Row label="Protected" value={formatCurrency(protectedCents)} valueColor={colors.success} />
          {forfeitedCents > 0 && (
            <Row label="Forfeited" value={formatCurrency(forfeitedCents)} valueColor={colors.danger} />
          )}
          <View style={styles.divider} />
          <Row
            label="Returned to you"
            value={formatCurrency(protectedCents)}
            valueColor={colors.success}
            large
          />
        </View>

        <View style={styles.card}>
          <Row label="Start" value={formatDate(challenge.start_date)} />
          <Row label="End" value={formatDate(challenge.end_date)} />
          <Row label="Duration" value={`${challenge.duration_days} days`} />
        </View>

        {goals.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Goals</Text>
            {goals.map((goal, i) => (
              <View key={goal.id} style={[styles.goalRow, i < goals.length - 1 && styles.goalRowBorder]}>
                <Text style={styles.goalName}>{goal.name}</Text>
                <Text style={styles.goalTarget}>{goal.target_count}×/{goal.goal_window}</Text>
              </View>
            ))}
          </View>
        )}

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
  valueLarge: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
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
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroName: { fontSize: 34, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  heroRate: { fontSize: 16, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  goalRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  goalName: { fontSize: 15, color: colors.text, fontWeight: '500' },
  goalTarget: { fontSize: 13, color: colors.textSecondary },
});
