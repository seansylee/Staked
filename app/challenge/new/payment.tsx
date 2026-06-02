import { useStripe } from '@stripe/stripe-react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { posthog } from '@/lib/posthog';
import { Card } from '@/components/ui/Card';
import { confirmChallengeStart, createPaymentIntent } from '@/api/payments';
import { useChallengeStore } from '@/store/useChallengeStore';
import { formatCurrency } from '@/utils/formatting';

const PLATFORM_FEE_CENTS = 300; // $3.00

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

      // Payment succeeded — extract payment intent ID from client secret
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>Step 3 of 3</Text>
        </View>

        <Text style={styles.title}>Review & Pay</Text>

        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Challenge</Text>
            <Text style={styles.summaryValue}>{draft.name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>{draft.duration_days} days</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Goals</Text>
            <Text style={styles.summaryValue}>{draft.goals.length}</Text>
          </View>

          <View style={styles.divider} />

          {draft.goals.map((g, i) => (
            <Text key={i} style={styles.goalItem}>
              • {g.name} — {g.target_count}x/{g.window}
            </Text>
          ))}
        </Card>

        <Card style={styles.priceCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Stake</Text>
            <Text style={styles.summaryValue}>{formatCurrency(draft.stake_amount_cents)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Platform fee</Text>
            <Text style={styles.summaryValue}>{formatCurrency(PLATFORM_FEE_CENTS)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total charged today</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalCents)}</Text>
          </View>
        </Card>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            Your stake is locked for {draft.duration_days} days. Protected funds are returned
            when the challenge ends.
          </Text>
        </View>

        <Button
          title={`Pay ${formatCurrency(totalCents)} & Start`}
          onPress={handlePay}
          loading={loading}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48, gap: 16 },
  back: {},
  backText: { fontSize: 16, color: '#555' },
  stepIndicator: {},
  stepText: { fontSize: 13, color: '#999', fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a' },
  summaryCard: { gap: 12 },
  priceCard: { gap: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryValue: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', textAlign: 'right', flex: 1, marginLeft: 16 },
  divider: { height: 1, backgroundColor: '#f0f0f0' },
  goalItem: { fontSize: 14, color: '#555', lineHeight: 22 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  note: { backgroundColor: '#f8f8f8', borderRadius: 12, padding: 14 },
  noteText: { fontSize: 13, color: '#666', lineHeight: 20 },
});
