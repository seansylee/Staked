import Stripe from 'https://esm.sh/stripe@14';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { computeProtectionCents } from '../_shared/protection.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  const { challenge_id } = await req.json();
  if (!challenge_id) return new Response('Missing challenge_id', { status: 400 });

  const { data: challenge, error: challengeError } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', challenge_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (challengeError || !challenge) {
    return new Response('Challenge not found', { status: 404 });
  }

  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('window_key')
    .eq('challenge_id', challenge_id);

  const { protectedCents, forfeitedCents } = computeProtectionCents(
    challenge,
    checkIns ?? [],
    new Date()
  );

  const refund = await stripe.refunds.create({
    payment_intent: challenge.stripe_payment_intent_id,
    amount: protectedCents,
  });

  const { data: updatedChallenge } = await supabase
    .from('challenges')
    .update({
      status: 'completed',
      protected_amount_cents: protectedCents,
      forfeited_amount_cents: forfeitedCents,
      stripe_refund_id: refund.id,
      refund_status: 'pending',
    })
    .eq('id', challenge_id)
    .select()
    .single();

  await supabase.from('payments').insert({
    challenge_id,
    user_id: user.id,
    type: 'refund',
    amount_cents: protectedCents,
    stripe_id: refund.id,
    status: 'pending',
  });

  return new Response(
    JSON.stringify({ challenge: updatedChallenge, protectedCents, forfeitedCents }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
