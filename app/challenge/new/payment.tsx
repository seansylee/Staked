import { SafeAreaView } from 'react-native-safe-area-context';
import {
  PlatformPay,
  PlatformPayButton,
  useStripe,
  usePlatformPay,
} from '@stripe/stripe-react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { posthog } from '@/lib/posthog';
import { DEMO_MODE } from '@/lib/demo';
import { getCharityById } from '@/lib/charities';
import { confirmChallengeStart, createPaymentIntent } from '@/api/payments';
import { colors, radius } from '@/constants/theme';
import { useChallengeStore } from '@/store/useChallengeStore';
import { formatCurrency } from '@/utils/formatting';

const PLATFORM_FEE_CENTS = 300;

const dollars = (cents: number) => (cents / 100).toFixed(2);

const sheetAppearance = {
  colors: {
    primary: colors.white,
    background: colors.bg,
    componentBackground: colors.surface,
    componentBorder: colors.border,
    componentDivider: colors.border,
    primaryText: colors.text,
    secondaryText: colors.textSecondary,
    componentText: colors.text,
    placeholderText: colors.textMuted,
    icon: colors.textSecondary,
    error: colors.danger,
  },
  shapes: { borderRadius: radius.md, borderWidth: 1 },
  primaryButton: {
    colors: { background: colors.white, text: colors.black, border: colors.white },
    shapes: { borderRadius: radius.md },
  },
} as const;

export default function PaymentScreen() {
  const { draft, clearDraft, fetchChallenges, addDemoChallenge } = useChallengeStore();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { isPlatformPaySupported, confirmPlatformPayPayment } = usePlatformPay();
  const [loading, setLoading] = useState(false);
  const [walletSupported, setWalletSupported] = useState(false);

  useEffect(() => {
    if (DEMO_MODE) return;
    isPlatformPaySupported({ googlePay: { testEnv: true } })
      .then(setWalletSupported)
      .catch(() => setWalletSupported(false));
  }, [isPlatformPaySupported]);

  useEffect(() => {
    if (!draft) router.replace('/challenge/new/details');
  }, [draft]);

  if (!draft) return null;

  const totalCents = draft.stake_amount_cents + PLATFORM_FEE_CENTS;
  const charity = getCharityById(draft.charity_id);

  const finalizeChallenge = async (paymentIntentId: string) => {
    const challengeId = await confirmChallengeStart(paymentIntentId, draft);
    posthog.capture('challenge_created', {
      stake_cents: draft.stake_amount_cents,
      duration_days: draft.duration_days,
      goal_count: draft.goals.length,
    });
    await fetchChallenges();
    clearDraft();
    router.replace('/(tabs)');
    router.push(`/challenge/${challengeId}`);
  };

  const handleWalletPay = async () => {
    setLoading(true);
    try {
      const clientSecret = await createPaymentIntent(totalCents);
      const { error, paymentIntent } = await confirmPlatformPayPayment(clientSecret, {
        applePay: {
          merchantCountryCode: 'US',
          currencyCode: 'USD',
          cartItems: [
            { label: 'Stake (refundable)', amount: dollars(draft.stake_amount_cents), paymentType: PlatformPay.PaymentType.Immediate },
            { label: 'Platform fee', amount: dollars(PLATFORM_FEE_CENTS), paymentType: PlatformPay.PaymentType.Immediate },
            { label: 'Staked', amount: dollars(totalCents), paymentType: PlatformPay.PaymentType.Immediate },
          ],
        },
        googlePay: {
          merchantCountryCode: 'US',
          currencyCode: 'USD',
          testEnv: true,
        },
      });
      if (error) {
        if (error.code !== 'Canceled') {
          posthog.capture('payment_failed', { error_code: error.code, method: 'wallet' });
          Alert.alert('Payment Failed', error.message);
        }
        return;
      }
      await finalizeChallenge(paymentIntent!.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment failed. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    setLoading(true);
    try {
      if (DEMO_MODE) {
        const challengeId = addDemoChallenge(draft);
        posthog.capture('challenge_created', {
          stake_cents: draft.stake_amount_cents,
          duration_days: draft.duration_days,
          goal_count: draft.goals.length,
          demo: true,
        });
        clearDraft();
        router.replace('/(tabs)');
        router.push(`/challenge/${challengeId}`);
        return;
      }

      const clientSecret = await createPaymentIntent(totalCents);
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Staked',
        returnURL: 'staked://payment-complete',
        appearance: sheetAppearance,
        applePay: {
          merchantCountryCode: 'US',
          cartItems: [
            { label: 'Stake (refundable)', amount: dollars(draft.stake_amount_cents), paymentType: 'Immediate' },
            { label: 'Platform fee', amount: dollars(PLATFORM_FEE_CENTS), paymentType: 'Immediate' },
            { label: 'Staked', amount: dollars(totalCents), paymentType: 'Immediate' },
          ],
        },
        googlePay: {
          merchantCountryCode: 'US',
          testEnv: true,
          currencyCode: 'USD',
        },
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
      await finalizeChallenge(paymentIntentId);
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

        <Text style={styles.stepText}>4 / 4</Text>
        <Text style={styles.title}>Review & Pay</Text>

        <View style={styles.card}>
          <SummaryRow label="Challenge" value={draft.name} />
          <SummaryRow label="Duration" value={`${draft.duration_days} days`} />
          <SummaryRow label="Goals" value={`${draft.goals.length}`} />
          {charity && <SummaryRow label="Charity" value={`${charity.emoji} ${charity.name}`} />}
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
          Stake is locked for {draft.duration_days} days. Protected funds are returned when the challenge ends
          {charity ? `; anything forfeited goes to ${charity.name}.` : '.'}
        </Text>

        {walletSupported && (
          <>
            <PlatformPayButton
              type={PlatformPay.ButtonType.Pay}
              appearance={PlatformPay.ButtonStyle.White}
              disabled={loading}
              onPress={handleWalletPay}
              style={styles.walletButton}
            />
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>
          </>
        )}

        <Button
          title={`Pay ${formatCurrency(totalCents)} & Start`}
          onPress={handlePay}
          loading={loading}
        />

        <Text style={styles.methods}>
          {walletSupported
            ? 'One-tap with Apple Pay or Google Pay, or pay by card'
            : 'Pay securely with card, Apple Pay, or Google Pay'}
        </Text>
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
  methods: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  walletButton: {
    width: '100%',
    height: 50,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
