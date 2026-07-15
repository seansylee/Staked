import Stripe from 'https://esm.sh/stripe@14';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { challengeEndExclusive, computeProtectionCents } from '../_shared/protection.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Auto-settles challenges that ended ≥ GRACE_DAYS ago and were never claimed,
// so unclaimed refunds can't run into Stripe's ~180-day refund limit.
// Invoked by pg_cron daily (see migration 010).
//
// Deliberately safe to trigger by any caller the gateway lets through: it
// only settles challenges whose payout is already frozen (post-end windows
// never count), refunds go to the owner's original payment method, the
// settle-{id} Stripe idempotency key dedupes retries, and the conditional
// status update loses cleanly to a concurrent user-initiated claim.
const GRACE_DAYS = 7;
const BATCH_LIMIT = 25;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const cutoff = new Date(Date.now() - (GRACE_DAYS + 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data: challenges, error: listError } = await supabaseAdmin
    .from('challenges')
    .select('*')
    .eq('status', 'active')
    .lt('end_date', cutoff)
    .limit(BATCH_LIMIT);

  if (listError) {
    console.error('settle-ended-challenges: list failed', listError);
    return new Response('List failed', { status: 500 });
  }

  let settled = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const challenge of challenges ?? []) {
    try {
      // Defense in depth alongside the SQL filter.
      if (Date.now() < challengeEndExclusive(challenge.end_date) + GRACE_DAYS * 86_400_000) {
        skipped++;
        continue;
      }

      const { data: checkIns } = await supabaseAdmin
        .from('check_ins')
        .select('window_key')
        .eq('challenge_id', challenge.id);

      const { protectedCents, forfeitedCents } = computeProtectionCents(
        challenge,
        checkIns ?? [],
        new Date()
      );

      let refundId: string | null = null;
      if (protectedCents > 0) {
        const refund = await stripe.refunds.create(
          { payment_intent: challenge.stripe_payment_intent_id, amount: protectedCents },
          { idempotencyKey: `settle-${challenge.id}` }
        );
        refundId = refund.id;
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('challenges')
        .update({
          status: 'completed',
          protected_amount_cents: protectedCents,
          forfeited_amount_cents: forfeitedCents,
          stripe_refund_id: refundId,
          refund_status: refundId ? 'pending' : 'succeeded',
        })
        .eq('id', challenge.id)
        .eq('status', 'active')
        .select()
        .single();

      if (updateError || !updated) {
        // Lost to a concurrent user claim, or the write failed after the
        // refund. The idempotency key makes tomorrow's retry safe.
        console.error('settle-ended-challenges: update failed', challenge.id, refundId, updateError);
        failures.push(challenge.id);
        continue;
      }

      if (refundId) {
        const { error: paymentError } = await supabaseAdmin.from('payments').insert({
          challenge_id: challenge.id,
          user_id: challenge.user_id,
          type: 'refund',
          amount_cents: protectedCents,
          stripe_id: refundId,
          status: 'pending',
        });
        if (paymentError) {
          console.error('settle-ended-challenges: payments insert failed', challenge.id, paymentError);
        }
      }

      settled++;
    } catch (err) {
      console.error('settle-ended-challenges: challenge failed', challenge.id, err);
      failures.push(challenge.id);
    }
  }

  // Drift sweep: if a refund.updated webhook delivery updated the payments
  // row but its challenge mirror write was lost (races with settlement have
  // been observed live), refund_status sticks on "pending" forever. Copy the
  // settled payments status over.
  let reconciled = 0;
  const { data: drifted } = await supabaseAdmin
    .from('challenges')
    .select('id, stripe_refund_id')
    .eq('refund_status', 'pending')
    .not('stripe_refund_id', 'is', null);

  for (const challenge of drifted ?? []) {
    try {
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('status')
        .eq('stripe_id', challenge.stripe_refund_id)
        .eq('type', 'refund')
        .single();
      if (payment && (payment.status === 'succeeded' || payment.status === 'failed')) {
        const { error: mirrorError } = await supabaseAdmin
          .from('challenges')
          .update({ refund_status: payment.status })
          .eq('id', challenge.id);
        if (!mirrorError) reconciled++;
      }
    } catch (err) {
      console.error('settle-ended-challenges: reconcile failed', challenge.id, err);
    }
  }

  const summary = { settled, skipped, reconciled, failed: failures };
  console.log('settle-ended-challenges:', JSON.stringify(summary));
  return new Response(JSON.stringify(summary), {
    headers: { 'Content-Type': 'application/json' },
  });
});
