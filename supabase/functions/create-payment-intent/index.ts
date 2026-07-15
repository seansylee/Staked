import Stripe from 'https://esm.sh/stripe@14';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
});

// Clients can only UPDATE profiles.push_token (migration 009); writing
// stripe_customer_id needs the service role. Ownership is enforced by the
// verified user id in the filter below.
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

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

  let amount_cents: unknown;
  try {
    ({ amount_cents } = await req.json());
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  // $50 stake + $3 fee … $2,500 stake + $3 fee. Without the upper bound a
  // hostile client could mint an arbitrarily large PaymentIntent and charge a
  // card for an amount confirm-challenge-start would then reject — an
  // orphaned charge needing a manual refund.
  const MIN_TOTAL_CENTS = 5300;
  const MAX_TOTAL_CENTS = 250300;
  if (
    !Number.isInteger(amount_cents) ||
    (amount_cents as number) < MIN_TOTAL_CENTS ||
    (amount_cents as number) > MAX_TOTAL_CENTS
  ) {
    return new Response('Invalid amount', { status: 400 });
  }

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    await supabaseAdmin
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
  }

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: 'usd',
      customer: customerId,
      metadata: { user_id: user.id },
      automatic_payment_methods: { enabled: true },
    });
  } catch (err) {
    console.error('Stripe error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(
    JSON.stringify({ client_secret: paymentIntent.client_secret }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
