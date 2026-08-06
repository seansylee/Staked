import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { getCharityById } from '@/lib/charities';
import { colors, radius } from '@/constants/theme';
import { useChallengeStore } from '@/store/useChallengeStore';
import { formatCurrency } from '@/utils/formatting';

// Landed on after a successful payment (real or demo). Deliberately a
// separate screen rather than an in-place reveal, so the confirmation
// gets its own moment instead of competing with the review form.
export default function ChallengeConfirmedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const challenge = useChallengeStore((s) => s.challenges.find((c) => c.id === id));

  if (!challenge) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.muted}>Challenge not found</Text>
          <Button title="Back to Dashboard" onPress={() => router.replace('/(tabs)')} />
        </View>
      </SafeAreaView>
    );
  }

  const charity = getCharityById(challenge.charity_id);
  const windowLabel =
    challenge.goal_window === 'daily' ? 'day' : challenge.goal_window === 'weekly' ? 'week' : 'month';
  const totalCents = challenge.stake_amount + challenge.platform_fee;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Ionicons name="checkmark" size={32} color={colors.white} />
          </View>
          <Text style={styles.heroLabel}>Order Complete</Text>
          <Text style={styles.heroName}>{challenge.name}</Text>
          <Text style={styles.heroSubtitle}>
            {formatCurrency(challenge.stake_amount)} is on the line — make it count.
          </Text>
        </View>

        <View style={styles.card}>
          <Row label="Stake (refundable)" value={formatCurrency(challenge.stake_amount)} />
          <Row label="Platform fee" value={formatCurrency(challenge.platform_fee)} />
          <View style={styles.divider} />
          <Row label="Total charged" value={formatCurrency(totalCents)} large />
        </View>

        <View style={styles.card}>
          <Row label="Duration" value={`${challenge.duration_days} days`} />
          <Row label="Goal" value={`${challenge.target_count}× per ${windowLabel}`} />
          {charity && <Row label="Charity" value={`${charity.emoji} ${charity.name}`} />}
        </View>

        <Button title="Done" onPress={() => router.replace('/(tabs)')} />
        <Button
          title="View Challenge"
          variant="secondary"
          onPress={() => router.replace(`/challenge/${challenge.id}`)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  large = false,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <View style={rowStyles.row}>
      <Text style={[rowStyles.label, large && rowStyles.labelLarge]}>{label}</Text>
      <Text style={[rowStyles.value, large && rowStyles.valueLarge]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  label: { fontSize: 14, color: colors.textSecondary },
  labelLarge: { fontSize: 15, fontWeight: '600', color: colors.text },
  value: { fontSize: 15, fontWeight: '600', color: colors.text },
  valueLarge: {
    fontSize: 24,
    fontFamily: 'HelveticaNeue-CondensedBlack',
    letterSpacing: -0.5,
    transform: [{ scaleY: 1.35 }],
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 48, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 24 },
  muted: { color: colors.textSecondary },
  hero: { alignItems: 'center', paddingBottom: 20, gap: 6 },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroName: {
    fontSize: 32,
    fontFamily: 'HelveticaNeue-CondensedBlack',
    color: colors.text,
    letterSpacing: -0.5,
    transform: [{ scaleY: 1.35 }],
    textAlign: 'center',
  },
  heroSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
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
