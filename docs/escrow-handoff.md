# Escrow / Donation Model — Handoff

Status of the **Option A (platform-donates)** escrow model and the steps still
required to make it live. See `docs/escrow-feasibility.md` for the why.

## ✅ Done in this branch (`claude/escrow-stripe-feasibility-nsnj6l`)

- `supabase/migrations/002_add_charity_id.sql` — adds `challenges.charity_id` (TEXT).
- `confirm-challenge-start/index.ts` — persists `draft.charity_id` on the challenge row.
- `app/challenge/new/charity.tsx` + `app/challenge/new/payment.tsx` — copy updated to the
  "Staked holds your stake… forfeited funds donated to {charity} at the end of the month" framing.
- `docs/escrow-feasibility.md` — decision record.
- `CLAUDE.md` — charity section updated to reflect persistence + donation model.

## 🔧 Required to ship (manual — not done by code changes alone)

These touch live infrastructure and must be run by someone with the Supabase access token.

1. **Apply migration 002 to the live DB.** The column does not exist in production yet;
   without it the redeployed `confirm-challenge-start` will fail inserting `charity_id`.
   ```bash
   export SUPABASE_ACCESS_TOKEN=<personal access token>
   npx supabase db push --project-ref xctocyxiwnjdltxqlqyl
   # or paste supabase/migrations/002_add_charity_id.sql into the Supabase SQL editor
   ```
2. **Redeploy the edge function** (it now writes `charity_id`):
   ```bash
   npx supabase functions deploy confirm-challenge-start --project-ref xctocyxiwnjdltxqlqyl
   ```
3. **Verify** end-to-end: create a challenge with a charity selected, confirm the
   `challenges` row has the expected `charity_id`.

## 🟡 Recommended next (not in this branch)

1. **Stripe webhook reconciliation Edge Function** — highest priority before real money.
   `complete-challenge` currently assumes the refund succeeds synchronously; refunds can
   fail or settle async. Add a `stripe-webhook` function that:
   - verifies the Stripe signature (`STRIPE_WEBHOOK_SECRET` as a new Supabase secret),
   - handles `charge.refunded` / `refund.updated` / `payment_intent.payment_failed`,
   - reconciles `payments.status` and `challenges.status` accordingly.
2. **Monthly donation tooling** — a report/job that sums forfeited funds per `charity_id`
   over the month so the team can make the batch donation. Currently manual/off-platform.
3. **Real charities** — replace the dummy `src/lib/charities.ts` list with a `charities`
   table and add a FK on `challenges.charity_id`.
4. **Option B (Stripe Connect)** — only when per-challenge automated payouts to charities
   are needed. Requires Connect onboarding (KYC per charity) + the webhook handler above.
   See `docs/escrow-feasibility.md`.
