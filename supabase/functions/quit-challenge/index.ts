import Stripe from 'https://esm.sh/stripe@14';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { computeProtectionCents } from '../_shared/protection.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
});

const QUIT_PENALTY_RATE = 0.20;

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

  const penaltyCents = Math.round(protectedCents * QUIT_PENALTY_RATE);
  const refundCents = protectedCents - penaltyCents;
  const totalForfeitedCents = forfeitedCents + penaltyCents;

  // Stripe rejects zero-amount refunds — with nothing protected there is no
  // refund to issue, so settle the challenge directly.
  let refundId: string | null = null;
  if (refundCents > 0) {
    // Shared settle-* key with complete-challenge: a retry returns the same
    // refund instead of creating a second one, and a concurrent complete
    // (different amount, same key) is rejected by Stripe outright.
    const refund = await stripe.refunds.create(
      { payment_intent: challenge.stripe_payment_intent_id, amount: refundCents },
      { idempotencyKey: `settle-${challenge_id}` }
    );
    refundId = refund.id;
  }

  const { data: updatedChallenge, error: updateError } = await supabase
    .from('challenges')
    .update({
      status: 'quit',
      protected_amount_cents: refundCents,
      forfeited_amount_cents: totalForfeitedCents,
      quit_penalty_cents: penaltyCents,
      stripe_refund_id: refundId,
      refund_status: refundId ? 'pending' : 'succeeded',
    })
    .eq('id', challenge_id)
    .eq('status', 'active')
    .select()
    .single();

  if (updateError || !updatedChallenge) {
    const { data: current } = await supabase
      .from('challenges')
      .select('status')
      .eq('id', challenge_id)
      .single();
    if (current && current.status !== 'active') {
      return new Response('Challenge already settled', { status: 409 });
    }
    console.error('Settlement write failed after refund', challenge_id, refundId, updateError);
    return new Response('Refund issued but challenge update failed — retry to reconcile', {
      status: 500,
    });
  }

  if (refundId) {
    const { error: paymentError } = await supabase.from('payments').insert({
      challenge_id,
      user_id: user.id,
      type: 'refund',
      amount_cents: refundCents,
      stripe_id: refundId,
      status: 'pending',
    });
    if (paymentError) {
      console.error('Payments audit insert failed', challenge_id, refundId, paymentError);
    }
  }

  return new Response(
    JSON.stringify({ challenge: updatedChallenge, refundCents, penaltyCents, forfeitedCents }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
