# Escrow Feasibility & Donation Model

Decision record for how Staked holds stakes and disburses forfeited funds.

## TL;DR

Staked does **not** use a true legal escrow account (not a Stripe product, and a
regulated activity). It uses a **charge-and-refund** flow plus a **platform-donates
("Option A")** model for forfeited funds. This is the MVP-appropriate choice: it
avoids money-transmitter / MSB classification while still delivering the user-facing
promise of "stake your money, lose it to charity if you slip."

## What actually happens to the money

1. `create-payment-intent` charges the user's full stake + $3 fee immediately into
   the **platform's** Stripe balance (funds are commingled, not segregated).
2. The challenge runs (30–90 days). Funds simply sit in the platform balance — this
   is the "holding" period.
3. `complete-challenge` computes the protected amount server-side and **refunds** it
   to the user's original card. The forfeited remainder stays in the platform balance.
4. Staked donates the accumulated forfeited funds to the chosen charities in a
   **monthly batch**, out of band. There is no per-challenge Stripe payout.

The user's chosen charity is recorded on `challenges.charity_id`
(migration `002_add_charity_id.sql`) for donation reporting/attribution.

## Why not "true escrow"?

- **True escrow** = segregated trust funds held by a neutral, licensed third party,
  released on conditions. Stripe is not a licensed escrow agent, and its ToS prohibits
  using a standard account to hold/transmit other people's money. Real escrow would
  need a licensed provider (Escrow.com, a bank trust account) or money-transmitter
  licenses — out of scope for an MVP.
- **Manual capture / card auth holds** (the textbook escrow primitive) are unusable
  here: card authorizations expire in ~7 days, far short of a 30–90 day challenge. We
  must capture upfront.

## Why Option A (platform-donates) over Option B (Stripe Connect)?

Paying users' forfeited money out to third-party charities on their behalf can make
the platform a **money transmitter (MSB)** — a regulatory line, not a code problem.

- **Option A (chosen):** Forfeited funds become platform revenue; the platform then
  chooses to donate. The platform owns the money, so it isn't transmitting on behalf
  of users. Simplest, lowest compliance burden. Word marketing carefully ("we hold
  your funds and donate them") and note the tax treatment (revenue, then donation).
- **Option B (future):** Stripe Connect onboards each charity as a connected account
  (KYC) and uses `Transfer`s to route forfeited funds per challenge. Stripe absorbs
  most money-movement compliance, but it requires real charity onboarding + webhooks.
  Graduate to this when charity payouts must be real, auditable, and at volume.

## Known gaps / follow-ups

- **No Stripe webhook handler.** `complete-challenge` assumes the refund succeeds
  synchronously; refunds can fail or settle async. A webhook reconciliation Edge
  Function is the most important robustness follow-up before real money.
- **Charities are dummy data** (`src/lib/charities.ts`) — no `charities` table, no FK
  on `charity_id` yet.
- **No automated monthly donation tooling** — the batch donation is currently a manual,
  off-platform operation.
