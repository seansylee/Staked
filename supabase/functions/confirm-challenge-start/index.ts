import Stripe from 'https://esm.sh/stripe@14';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
});

// RLS makes challenges/payments read-only for user JWTs (migration 008), so
// writes must use the service role — ownership comes from the verified user id.
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const PLATFORM_FEE_CENTS = 300;
const MIN_STAKE_CENTS = 5000; // $50
const MAX_STAKE_CENTS = 250000; // $2,500

// The client form enforces these too, but the draft arrives from the network —
// a forged draft could otherwise claim any stake or break the protection calc
// (duration 0 divides by zero, target_count 0 auto-completes every period).
function draftError(draft: Record<string, unknown>): string | null {
  if (typeof draft.name !== 'string' || !draft.name.trim() || draft.name.trim().length > 80) {
    return 'Invalid name';
  }
  const stake = draft.stake_amount_cents;
  if (!Number.isInteger(stake) || (stake as number) < MIN_STAKE_CENTS || (stake as number) > MAX_STAKE_CENTS) {
    return 'Invalid stake amount';
  }
  const days = draft.duration_days;
  if (!Number.isInteger(days) || (days as number) < 1 || (days as number) > 365) {
    return 'Invalid duration';
  }
  const target = draft.target_count;
  if (!Number.isInteger(target) || (target as number) < 1 || (target as number) > 100) {
    return 'Invalid target count';
  }
  if (!['daily', 'weekly', 'monthly'].includes(draft.goal_window as string)) {
    return 'Invalid goal window';
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { payment_intent_id, challenge: draftChallenge } = await req.json();
  if (!payment_intent_id || !draftChallenge) {
    return new Response('Missing required fields', { status: 400 });
  }

  const validationError = draftError(draftChallenge);
  if (validationError) {
    return new Response(validationError, { status: 400 });
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
  if (paymentIntent.status !== 'succeeded') {
    return new Response('Payment not completed', { status: 400 });
  }

  if (paymentIntent.metadata.user_id !== user.id) {
    return new Response('Unauthorized', { status: 403 });
  }

  if (paymentIntent.amount !== draftChallenge.stake_amount_cents + PLATFORM_FEE_CENTS) {
    return new Response('Payment amount does not match stake', { status: 400 });
  }

  const today = new Date();
  const startDate = today.toISOString().slice(0, 10);
  const endDate = new Date(today.getTime() + (draftChallenge.duration_days - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data: challenge, error: challengeError } = await supabaseAdmin
    .from('challenges')
    .insert({
      user_id: user.id,
      name: draftChallenge.name,
      stake_amount: draftChallenge.stake_amount_cents,
      platform_fee: PLATFORM_FEE_CENTS,
      duration_days: draftChallenge.duration_days,
      start_date: startDate,
      end_date: endDate,
      target_count: draftChallenge.target_count,
      goal_window: draftChallenge.goal_window,
      charity_id: draftChallenge.charity_id ?? null,
      stripe_payment_intent_id: payment_intent_id,
    })
    .select()
    .single();

  if (challengeError || !challenge) {
    if (challengeError?.code === '23505') {
      return new Response('Payment already used for another challenge', { status: 409 });
    }
    console.error('Challenge insert failed', payment_intent_id, challengeError);
    return new Response('Failed to create challenge', { status: 500 });
  }

  await supabaseAdmin.from('payments').insert({
    challenge_id: challenge.id,
    user_id: user.id,
    type: 'deposit',
    amount_cents: paymentIntent.amount,
    stripe_id: payment_intent_id,
    status: 'succeeded',
  });

  return new Response(
    JSON.stringify({ challenge_id: challenge.id }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
