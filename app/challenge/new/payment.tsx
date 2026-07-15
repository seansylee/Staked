import { SafeAreaView } from 'react-native-safe-area-context';
import {
  PlatformPay,
  PlatformPayButton,
  useStripe,
  usePlatformPay,
} from '@stripe/stripe-react-native';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { posthog } from '@/lib/posthog';
import { DEMO_MODE } from '@/lib/demo';
import { useUIStore } from '@/store/useUIStore';
import { getCharityById } from '@/lib/charities';
import { ApiError, confirmChallengeStart, createPaymentIntent } from '@/api/payments';
import { colors, radius } from '@/constants/theme';
import { useChallengeStore } from '@/store/useChallengeStore';
import { ChallengeDraft } from '@/types';
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
  const {
    draft,
    clearDraft,
    fetchChallenges,
    addDemoChallenge,
    pendingPayment,
    setPendingPayment,
    pendingConfirmation,
    setPendingConfirmation,
  } = useChallengeStore();
  const showToast = useUIStore((s) => s.showToast);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { isPlatformPaySupported, confirmPlatformPayPayment } = usePlatformPay();
  const [loading, setLoading] = useState(false);
  const [walletSupported, setWalletSupported] = useState(false);
  const completing = useRef(false);

  useEffect(() => {
    if (DEMO_MODE) return;
    isPlatformPaySupported({ googlePay: { testEnv: true } })
      .then(setWalletSupported)
      .catch(() => setWalletSupported(false));
  }, [isPlatformPaySupported]);

  useEffect(() => {
    if (!draft && !pendingConfirmation && !completing.current) {
      router.replace('/challenge/new/details');
    }
  }, [draft, pendingConfirmation]);

  if (!draft && !pendingConfirmation) return null;

  // A paid-but-unconfirmed challenge takes precedence: the card was already
  // charged for pendingConfirmation.draft, so that's the challenge to finish.
  const activeDraft = (pendingConfirmation?.draft ?? draft) as ChallengeDraft;
  const alreadyPaid = !!pendingConfirmation;

  const totalCents = activeDraft.stake_amount_cents + PLATFORM_FEE_CENTS;
  const charity = getCharityById(activeDraft.charity_id);
  const windowLabel =
    activeDraft.goal_window === 'daily' ? 'day' : activeDraft.goal_window === 'weekly' ? 'week' : 'month';

  // One payment intent per draft+amount, reused across retries and sheet
  // cancellations — a retry can never create a second charge.
  const getOrCreateIntent = async () => {
    if (pendingPayment && pendingPayment.amountCents === totalCents) {
      return pendingPayment;
    }
    const handle = await createPaymentIntent(totalCents);
    const pending = { ...handle, amountCents: totalCents };
    setPendingPayment(pending);
    return pending;
  };

  const finishCreation = async (paymentIntentId: string, draftToConfirm: ChallengeDraft) => {
    try {
      await confirmChallengeStart(paymentIntentId, draftToConfirm);
    } catch (err) {
      // 409 = this payment already created its challenge (an earlier retry
      // landed) — that's success, not failure.
      if (!(err instanceof ApiError && err.status === 409)) throw err;
    }
    setPendingConfirmation(null);
    posthog.capture('challenge_created', {
      stake_cents: draftToConfirm.stake_amount_cents,
      duration_days: draftToConfirm.duration_days,
      goal_window: draftToConfirm.goal_window,
      target_count: draftToConfirm.target_count,
    });
    await fetchChallenges();
    const stakeDollars = Math.round(draftToConfirm.stake_amount_cents / 100);
    showToast(`🔥 ${draftToConfirm.name} is live! $${stakeDollars} is on the line — make it count.`);
    completing.current = true;
    clearDraft();
    router.replace('/(tabs)');
  };

  const alertSetupPending = () => {
    Alert.alert(
      'Payment received',
      "Your payment went through, but the challenge couldn't be created yet. Tap “Finish Setup” to complete it — you will not be charged again."
    );
  };

  const handleFinishSetup = async () => {
    if (!pendingConfirmation) return;
    setLoading(true);
    try {
      await finishCreation(pendingConfirmation.paymentIntentId, pendingConfirmation.draft);
    } catch {
      alertSetupPending();
    } finally {
      setLoading(false);
    }
  };

  const handleWalletPay = async () => {
    setLoading(true);
    let paid = false;
    try {
      const intent = await getOrCreateIntent();
      const { error } = await confirmPlatformPayPayment(intent.clientSecret, {
        applePay: {
          merchantCountryCode: 'US',
          currencyCode: 'USD',
          cartItems: [
            { label: 'Stake (refundable)', amount: dollars(activeDraft.stake_amount_cents), paymentType: PlatformPay.PaymentType.Immediate },
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
      paid = true;
      setPendingConfirmation({ paymentIntentId: intent.paymentIntentId, draft: activeDraft });
      setPendingPayment(null);
      await finishCreation(intent.paymentIntentId, activeDraft);
    } catch (err: unknown) {
      if (paid) {
        alertSetupPending();
      } else {
        const message = err instanceof Error ? err.message : 'Payment failed. Please try again.';
        Alert.alert('Error', message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    setLoading(true);
    let paid = false;
    try {
      if (DEMO_MODE) {
        addDemoChallenge(activeDraft);
        posthog.capture('challenge_created', {
          stake_cents: activeDraft.stake_amount_cents,
          duration_days: activeDraft.duration_days,
          goal_window: activeDraft.goal_window,
          target_count: activeDraft.target_count,
          demo: true,
        });
        const stakeDollars = Math.round(activeDraft.stake_amount_cents / 100);
        showToast(`🔥 ${activeDraft.name} is live! $${stakeDollars} is on the line — make it count.`);
        completing.current = true;
        clearDraft();
        router.replace('/(tabs)');
        return;
      }

      const intent = await getOrCreateIntent();
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: intent.clientSecret,
        merchantDisplayName: 'Staked',
        returnURL: 'staked://payment-complete',
        appearance: sheetAppearance,
        applePay: {
          merchantCountryCode: 'US',
          cartItems: [
            { label: 'Stake (refundable)', amount: dollars(activeDraft.stake_amount_cents), paymentType: 'Immediate' },
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
      if (initError) {
        // The stored intent may be unusable (e.g. cancelled server-side) —
        // drop it so the next attempt starts fresh.
        setPendingPayment(null);
        throw new Error(initError.message);
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          posthog.capture('payment_failed', { error_code: presentError.code });
          Alert.alert('Payment Failed', presentError.message);
        }
        return;
      }

      paid = true;
      setPendingConfirmation({ paymentIntentId: intent.paymentIntentId, draft: activeDraft });
      setPendingPayment(null);
      await finishCreation(intent.paymentIntentId, activeDraft);
    } catch (err: unknown) {
      if (paid) {
        alertSetupPending();
      } else {
        const message = err instanceof Error ? err.message : 'Payment failed. Please try again.';
        Alert.alert('Error', message);
      }
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
          <SummaryRow label="Challenge" value={activeDraft.name} />
          <SummaryRow label="Duration" value={`${activeDraft.duration_days} days`} />
          <SummaryRow label="Goal" value={`${activeDraft.target_count}× per ${windowLabel}`} />
          {charity && <SummaryRow label="Charity" value={`${charity.emoji} ${charity.name}`} />}
        </View>

        <View style={styles.card}>
          <SummaryRow label="Stake" value={formatCurrency(activeDraft.stake_amount_cents)} />
          <SummaryRow label="Platform fee" value={formatCurrency(PLATFORM_FEE_CENTS)} />
          <View style={styles.divider} />
          <SummaryRow label="Total" value={formatCurrency(totalCents)} large />
        </View>

        <Text style={styles.note}>
          Staked holds your stake for {activeDraft.duration_days} days. Protected funds are returned
          to you when the challenge ends
          {charity
            ? `; anything forfeited is donated to ${charity.name} at the end of the month.`
            : '.'}
        </Text>

        {alreadyPaid ? (
          <>
            <View style={styles.paidBox}>
              <Text style={styles.paidTitle}>✓ Payment received</Text>
              <Text style={styles.paidBody}>
                One last step didn&apos;t finish. Tap below to create your challenge — you will not
                be charged again.
              </Text>
            </View>
            <Button title="Finish Setup — Already Paid" onPress={handleFinishSetup} loading={loading} />
          </>
        ) : (
          <>
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
          </>
        )}
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
  paidBox: {
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success,
    padding: 14,
    gap: 4,
  },
  paidTitle: { fontSize: 13, fontWeight: '700', color: colors.success },
  paidBody: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
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
