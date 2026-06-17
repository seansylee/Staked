import Stripe from 'https://esm.sh/stripe@14';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
});

// Uses service role to bypass RLS — this endpoint is called by Stripe, not a user
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing stripe-signature', { status: 400 });

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) return new Response('Webhook secret not configured', { status: 500 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err}`, { status: 400 });
  }

  if (event.type === 'refund.updated') {
    const refund = event.data.object as Stripe.Refund;
    await handleRefundUpdated(refund);
  }

  // Return 200 quickly — Stripe retries on non-2xx
  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

async function handleRefundUpdated(refund: Stripe.Refund) {
  if (refund.status !== 'succeeded' && refund.status !== 'failed') return;

  // Update the payments audit row
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .update({ status: refund.status })
    .eq('stripe_id', refund.id)
    .eq('type', 'refund')
    .select('challenge_id')
    .single();

  if (paymentError || !payment) {
    // Not a refund we issued — ignore
    console.error('Payment row not found for refund', refund.id, paymentError);
    return;
  }

  // Mirror refund_status onto the challenge for easy querying
  await supabase
    .from('challenges')
    .update({ refund_status: refund.status })
    .eq('id', payment.challenge_id);

  if (refund.status === 'failed') {
    console.error(
      'Refund failed for challenge',
      payment.challenge_id,
      'refund_id',
      refund.id,
      'failure_reason',
      refund.failure_reason
    );
  }
}
