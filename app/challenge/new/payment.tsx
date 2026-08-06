import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CustomerSheet,
  CustomerSheetResult,
  PlatformPay,
  PlatformPayButton,
  useStripe,
  usePlatformPay,
} from '@stripe/stripe-react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SwipeStatus, SwipeToConfirm } from '@/components/ui/SwipeToConfirm';
import { posthog } from '@/lib/posthog';
import { DEMO_MODE } from '@/lib/demo';
import { getCharityById } from '@/lib/charities';
import {
  ApiError,
  confirmChallengeStart,
  createCustomerSession,
  createPaymentIntent,
  CustomerSessionHandle,
} from '@/api/payments';
import { colors, radius } from '@/constants/theme';
import { useChallengeStore } from '@/store/useChallengeStore';
import { ChallengeDraft } from '@/types';
import { formatCurrency } from '@/utils/formatting';

interface SelectedPaymentMethod {
  id: string;
  brand?: string;
  last4?: string;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
  const { confirmPayment } = useStripe();
  const { isPlatformPaySupported, confirmPlatformPayPayment } = usePlatformPay();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<SwipeStatus>('idle');
  const [walletSupported, setWalletSupported] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<SelectedPaymentMethod | null>(null);
  const [customerSession, setCustomerSession] = useState<CustomerSessionHandle | null>(null);
  const [customerSheetVisible, setCustomerSheetVisible] = useState(false);
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

  const openPaymentMethodPicker = async () => {
    try {
      const session = customerSession ?? (await createCustomerSession());
      if (!customerSession) setCustomerSession(session);
      setCustomerSheetVisible(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load payment methods.';
      Alert.alert('Error', message);
    }
  };

  const handleCustomerSheetResult = ({ error, paymentMethod: pm }: CustomerSheetResult) => {
    setCustomerSheetVisible(false);
    if (error) {
      if (error.code !== 'Canceled') Alert.alert('Error', error.message);
      return;
    }
    if (pm) {
      setPaymentMethod({ id: pm.id, brand: pm.Card?.brand, last4: pm.Card?.last4 });
    }
  };

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

  // Returns the created challenge's id. On a 409 (this payment already
  // created its challenge on an earlier retry) that's success, not failure —
  // the id just has to be recovered from the freshly-fetched store instead.
  const finishCreation = async (
    paymentIntentId: string,
    draftToConfirm: ChallengeDraft
  ): Promise<string> => {
    let challengeId: string | null = null;
    try {
      challengeId = await confirmChallengeStart(paymentIntentId, draftToConfirm);
    } catch (err) {
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
    if (!challengeId) {
      challengeId =
        useChallengeStore.getState().challenges.find((c) => c.stripe_payment_intent_id === paymentIntentId)
          ?.id ?? null;
    }
    if (!challengeId) throw new Error('Challenge created but could not be located.');
    return challengeId;
  };

  // Marks completing.current immediately (so the draft-guard effect doesn't
  // race a redirect while navigation is in flight), then hands off to the
  // dedicated confirmation screen — its own moment, not an overlay on this one.
  const navigateToConfirmation = (challengeId: string) => {
    completing.current = true;
    clearDraft();
    router.replace({ pathname: '/challenge/new/confirmed', params: { id: challengeId } });
  };

  const alertSetupPending = () => {
    Alert.alert(
      'Payment received',
      "Your payment went through, but the challenge couldn't be created yet. Tap “Finish Setup” to complete it — you will not be charged again."
    );
  };

  const handleFinishSetup = async () => {
    if (!pendingConfirmation) return;
    setStatus('processing');
    setLoading(true);
    try {
      const challengeId = await finishCreation(pendingConfirmation.paymentIntentId, pendingConfirmation.draft);
      navigateToConfirmation(challengeId);
    } catch {
      setStatus('idle');
      alertSetupPending();
    } finally {
      setLoading(false);
    }
  };

  const handleWalletPay = async () => {
    setStatus('processing');
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
        setStatus('idle');
        return;
      }
      paid = true;
      setPendingConfirmation({ paymentIntentId: intent.paymentIntentId, draft: activeDraft });
      setPendingPayment(null);
      const challengeId = await finishCreation(intent.paymentIntentId, activeDraft);
      navigateToConfirmation(challengeId);
    } catch (err: unknown) {
      if (paid) {
        alertSetupPending();
      } else {
        const message = err instanceof Error ? err.message : 'Payment failed. Please try again.';
        Alert.alert('Error', message);
      }
      setStatus('idle');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!DEMO_MODE && !paymentMethod) {
      // Guarded by SwipeToConfirm's `disabled` prop — this shouldn't fire,
      // but bail out rather than confirm with no payment method.
      return;
    }
    setStatus('processing');
    setLoading(true);
    let paid = false;
    try {
      if (DEMO_MODE) {
        const challengeId = addDemoChallenge(activeDraft);
        posthog.capture('challenge_created', {
          stake_cents: activeDraft.stake_amount_cents,
          duration_days: activeDraft.duration_days,
          goal_window: activeDraft.goal_window,
          target_count: activeDraft.target_count,
          demo: true,
        });
        navigateToConfirmation(challengeId);
        return;
      }

      const intent = await getOrCreateIntent();
      const { error: confirmError } = await confirmPayment(intent.clientSecret, {
        paymentMethodType: 'Card',
        paymentMethodData: { paymentMethodId: paymentMethod!.id },
      });
      if (confirmError) {
        posthog.capture('payment_failed', { error_code: confirmError.code });
        Alert.alert('Payment Failed', confirmError.message);
        setStatus('idle');
        return;
      }

      paid = true;
      setPendingConfirmation({ paymentIntentId: intent.paymentIntentId, draft: activeDraft });
      setPendingPayment(null);
      const challengeId = await finishCreation(intent.paymentIntentId, activeDraft);
      navigateToConfirmation(challengeId);
    } catch (err: unknown) {
      if (paid) {
        alertSetupPending();
      } else {
        const message = err instanceof Error ? err.message : 'Payment failed. Please try again.';
        Alert.alert('Error', message);
      }
      setStatus('idle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SwipeToConfirm
      label={
        alreadyPaid
          ? 'Swipe up to finish setup'
          : !DEMO_MODE && !paymentMethod
            ? 'Select a payment method to continue'
            : `Swipe up to pay ${formatCurrency(totalCents)} & start`
      }
      status={status}
      disabled={!alreadyPaid && !DEMO_MODE && !paymentMethod}
      onConfirm={alreadyPaid ? handleFinishSetup : handlePay}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
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

          {!alreadyPaid && !DEMO_MODE && (
            <TouchableOpacity
              style={styles.paymentMethodRow}
              onPress={openPaymentMethodPicker}
              disabled={loading}
            >
              <Text style={styles.paymentMethodLabel}>Payment method</Text>
              <View style={styles.paymentMethodValue}>
                <Text style={styles.paymentMethodText}>
                  {paymentMethod
                    ? `${paymentMethod.brand ? capitalize(paymentMethod.brand) : 'Card'} •••• ${paymentMethod.last4}`
                    : 'Add a payment method'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          )}

          <Text style={styles.note}>
            Staked holds your stake for {activeDraft.duration_days} days. Protected funds are returned
            to you when the challenge ends
            {charity
              ? `; anything forfeited is donated to ${charity.name} at the end of the month.`
              : '.'}
          </Text>
        </ScrollView>

        <View style={styles.ctaArea}>
          {alreadyPaid ? (
            <View style={styles.paidBox}>
              <Text style={styles.paidTitle}>✓ Payment received</Text>
              <Text style={styles.paidBody}>
                One last step didn&apos;t finish. Swipe up below to create your challenge — you
                will not be charged again.
              </Text>
            </View>
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

              <Text style={styles.methods}>
                {walletSupported
                  ? 'One-tap with Apple Pay or Google Pay, or pay by card'
                  : 'Pay securely with card, Apple Pay, or Google Pay'}
              </Text>
            </>
          )}
        </View>
      </SafeAreaView>

      {customerSession && (
        <CustomerSheet.Component
          visible={customerSheetVisible}
          customerId={customerSession.customerId}
          customerEphemeralKeySecret={customerSession.ephemeralKeySecret}
          setupIntentClientSecret={customerSession.setupIntentClientSecret}
          merchantDisplayName="Staked"
          returnURL="staked://payment-complete"
          appearance={sheetAppearance}
          onResult={handleCustomerSheetResult}
        />
      )}
    </SwipeToConfirm>
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
  scrollArea: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 12 },
  ctaArea: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
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
  paymentMethodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentMethodLabel: { fontSize: 14, color: colors.textSecondary },
  paymentMethodValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  paymentMethodText: { fontSize: 14, fontWeight: '600', color: colors.text },
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
