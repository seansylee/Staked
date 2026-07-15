-- Auto-settlement: pg_cron invokes the settle-ended-challenges Edge Function
-- daily, so challenges that ended >= 7 days ago and were never claimed get
-- refunded automatically (Stripe refunds become impossible ~180 days after
-- the charge). The function is idempotent — settle-{id} Stripe idempotency
-- keys plus a conditional status update — so re-runs and races with a
-- user-initiated claim are safe.
--
-- pg_net adds outbound-HTTP-from-the-DB surface; EXECUTE is revoked from
-- client roles so only the postgres/cron context can use it.
--
-- Prerequisite (one-time, kept out of the repo on purpose): two Vault
-- entries the cron command reads —
--   select vault.create_secret('<project url>', 'project_url');
--   select vault.create_secret('<anon key>',   'anon_key');

CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Registered under `extensions` (advisor 0014); its functions still live in
-- the self-managed `net` schema.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA net FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'settle-ended-challenges-daily',
  '17 3 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/settle-ended-challenges',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
