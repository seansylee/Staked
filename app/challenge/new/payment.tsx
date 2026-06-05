import { SafeAreaView } from 'react-native-safe-area-context';
import { useStripe } from '@stripe/stripe-react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { posthog } from '@/lib/posthog';
import { confirmChallengeStart, createPaymentIntent } from '@/api/payments';
import { colors, radius } from '@/constants/theme';
import { useChallengeStore } from '@/store/useChallengeStore';
import { formatCurrency } from '@/utils/formatting';

const PLATFORM_FEE_CENTS = 300;

export default function PaymentScreen() {
  const { draft, clearDraft, fetchChallenges } = useChallengeStore();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);

  if (!draft) {
    router.replace('/challenge/new/details');
    return null;
  }

  const totalCents = draft.stake_amount_cents + PLATFORM_FEE_CENTS;

  const handlePay = async () => {
    setLoading(true);
    try {
      const clientSecret = await createPaymentIntent(totalCents);
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Staked',
        returnURL: 'staked://payment-complete',
      });
      if (initError) throw new Error(initError.message);

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          posthog.capture('payment_failed', { error_code: presentError.code });
          Alert.alert('Payment Failed', presentError.message);
        }
        return;
      }

      const paymentIntentId = clientSecret.split('_secret_')[0];
      await confirmChallengeStart(paymentIntentId, draft);
      posthog.capture('challenge_created', {
        stake_cents: draft.stake_amount_cents,
        duration_days: draft.duration_days,
        goal_count: draft.goals.length,
      });
      await fetchChallenges();
      clearDraft();
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment failed. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.stepText}>3 / 3</Text>
        <Text style={styles.title}>Review & Pay</Text>

        <View style={styles.card}>
          <SummaryRow label="Challenge" value={draft.name} />
          <SummaryRow label="Duration" value={`${draft.duration_days} days`} />
          <SummaryRow label="Goals" value={`${draft.goals.length}`} />
        </View>

        <View style={styles.card}>
          {draft.goals.map((g, i) => (
            <Text key={i} style={styles.goalLine}>
              {g.name}  ·  {g.target_count}×/{g.goal_window}
            </Text>
          ))}
        </View>

        <View style={styles.card}>
          <SummaryRow label="Stake" value={formatCurrency(draft.stake_amount_cents)} />
          <SummaryRow label="Platform fee" value={formatCurrency(PLATFORM_FEE_CENTS)} />
          <View style={styles.divider} />
          <SummaryRow label="Total" value={formatCurrency(totalCents)} large />
        </View>

        <Text style={styles.note}>
          Stake is locked for {draft.duration_days} days. Protected funds are returned when the challenge ends.
        </Text>

        <Button
          title={`Pay ${formatCurrency(totalCents)} & Start`}
          onPress={handlePay}
          loading={loading}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({
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
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, large && rowStyles.valueLarge]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, color: colors.textSecondary },
  value: { fontSize: 14, fontWeight: '600', color: colors.text },
  valueLarge: { fontSize: 20, fontFamily: 'HelveticaNeue-CondensedBlack', letterSpacing: -0.5, transform: [{ scaleY: 1.35 }] },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48, gap: 12 },
  back: { paddingVertical: 12 },
  backText: { fontSize: 22, color: colors.textSecondary },
  stepText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: { fontSize: 28, fontFamily: 'HelveticaNeue-CondensedBlack', color: colors.text, letterSpacing: -0.5, transform: [{ scaleY: 1.35 }], marginBottom: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  goalLine: { fontSize: 14, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border },
  note: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
