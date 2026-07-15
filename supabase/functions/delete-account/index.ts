import Stripe from 'https://esm.sh/stripe@14';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Permanently deletes the caller's account (App Store guideline 5.1.1(v)
// requires in-app deletion). Refused while any challenge is active — money
// is still held for those, and deletion would orphan the refund path.
// auth.users → profiles → challenges → check_ins/payments all cascade.
// A refund that is still pending at deletion time continues at Stripe and
// reaches the card; only the webhook reconciliation becomes a no-op (404s
// until Stripe stops retrying), which is acceptable.
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

  const { data: activeChallenges, error: activeError } = await supabaseAdmin
    .from('challenges')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1);

  if (activeError) {
    console.error('Active-challenge check failed', user.id, activeError);
    return new Response('Could not verify account state', { status: 500 });
  }
  if (activeChallenges && activeChallenges.length > 0) {
    return new Response(
      'You have an active challenge with money staked. Complete or quit it before deleting your account.',
      { status: 409 }
    );
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('Account deletion failed', user.id, deleteError);
    return new Response('Account deletion failed', { status: 500 });
  }

  // Best-effort: remove the Stripe customer object (PII). Charge and refund
  // records are retained by Stripe for financial audit either way.
  if (profile?.stripe_customer_id) {
    try {
      await stripe.customers.del(profile.stripe_customer_id);
    } catch (err) {
      console.error('Stripe customer cleanup failed', profile.stripe_customer_id, err);
    }
  }

  return new Response(JSON.stringify({ deleted: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
