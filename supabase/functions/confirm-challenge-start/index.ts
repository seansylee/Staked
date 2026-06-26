import Stripe from 'https://esm.sh/stripe@14';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
});

const PLATFORM_FEE_CENTS = 300;

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

  const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
  if (paymentIntent.status !== 'succeeded') {
    return new Response('Payment not completed', { status: 400 });
  }

  if (paymentIntent.metadata.user_id !== user.id) {
    return new Response('Unauthorized', { status: 403 });
  }

  const today = new Date();
  const startDate = today.toISOString().slice(0, 10);
  const endDate = new Date(today.getTime() + (draftChallenge.duration_days - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data: challenge, error: challengeError } = await supabase
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
    return new Response('Failed to create challenge', { status: 500 });
  }

  await supabase.from('payments').insert({
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
