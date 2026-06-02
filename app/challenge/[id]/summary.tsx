import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useChallengeStore } from '@/store/useChallengeStore';
import { formatCurrency, formatDate } from '@/utils/formatting';

export default function CompletionSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const challenges = useChallengeStore((s) => s.challenges);
  const goalsMap = useChallengeStore((s) => s.goalsMap);
  const checkInsMap = useChallengeStore((s) => s.checkInsMap);

  const challenge = challenges.find((c) => c.id === id);
  const goals = goalsMap[id] ?? [];

  if (!challenge || challenge.status !== 'completed') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.notFound}>No summary available</Text>
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
          <Text style={styles.emoji}>{successRate >= 80 ? '🏆' : successRate >= 50 ? '💪' : '📈'}</Text>
          <Text style={styles.heroTitle}>Challenge Complete</Text>
          <Text style={styles.heroSubtitle}>{challenge.name}</Text>
        </View>

        <Card style={styles.summaryCard}>
          <SummaryRow label="Original Stake" value={formatCurrency(challenge.stake_amount)} />
          <SummaryRow
            label="Protected Funds"
            value={formatCurrency(protectedCents)}
            valueColor="#16a34a"
          />
          {forfeitedCents > 0 && (
            <SummaryRow
              label="Forfeited"
              value={formatCurrency(forfeitedCents)}
              valueColor="#dc2626"
            />
          )}
          <View style={styles.divider} />
          <SummaryRow
            label="Returned to you"
            value={formatCurrency(protectedCents)}
            valueColor="#16a34a"
            large
          />
        </Card>

        <Card style={styles.datesCard}>
          <SummaryRow label="Start Date" value={formatDate(challenge.start_date)} />
          <SummaryRow label="End Date" value={formatDate(challenge.end_date)} />
          <SummaryRow label="Duration" value={`${challenge.duration_days} days`} />
          <SummaryRow label="Success Rate" value={`${successRate}%`} />
        </Card>

        {goals.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Goals</Text>
            {goals.map((goal) => (
              <View key={goal.id} style={styles.goalRow}>
                <Text style={styles.goalName}>{goal.name}</Text>
                <Text style={styles.goalTarget}>{goal.target_count}x/{goal.window}</Text>
              </View>
            ))}
          </Card>
        )}

        <Button title="Back to Dashboard" onPress={() => router.replace('/(tabs)')} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  valueColor = '#1a1a1a',
  large = false,
}: {
  label: string;
  value: string;
  valueColor?: string;
  large?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, large && styles.rowLabelLarge]}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor }, large && styles.rowValueLarge]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  scroll: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 48, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: 16, color: '#666' },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  emoji: { fontSize: 56 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#1a1a1a' },
  heroSubtitle: { fontSize: 16, color: '#666' },
  summaryCard: { gap: 12 },
  datesCard: { gap: 12 },
  divider: { height: 1, backgroundColor: '#f0f0f0' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14, color: '#666' },
  rowLabelLarge: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  rowValue: { fontSize: 15, fontWeight: '600' },
  rowValueLarge: { fontSize: 22, fontWeight: '800' },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  goalName: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  goalTarget: { fontSize: 14, color: '#666' },
});
