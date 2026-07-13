-- 008 gave the client a profiles UPDATE policy so the app can save push_token,
-- but Supabase's default table grants include UPDATE on every column — so the
-- policy also let a user rewrite their own stripe_customer_id and email, both
-- of which create-payment-intent trusts (it reuses stripe_customer_id as the
-- Stripe customer for the PaymentIntent, and email as the customer email).
-- Column-level privileges are the only way to scope an UPDATE to specific
-- columns; RLS policies can't. Restrict the client to push_token; the
-- stripe_customer_id write moves to the service role in create-payment-intent.
REVOKE UPDATE ON profiles FROM anon, authenticated;
GRANT UPDATE (push_token) ON profiles TO authenticated;
