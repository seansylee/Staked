@AGENTS.md

# Staked — Project Context

## What This App Does

Staked is a financial commitment app. Users stake real money ($50–$2,500) when creating a challenge. They define a single goal (e.g. "Gym 3x/week"). Each day has a protection value (`stake / duration_days`). Completing the goal protects funds; missing it forfeits that day's value. At the end, protected funds are returned via Stripe refund.

This is an MVP to validate whether users will stake real money to improve follow-through. No social features, no AI, no automatic verification — manual check-ins only.

---

## Current Status

**Backend is live and connected. Single-goal model shipped (commit `e99ed29`). Quit-challenge feature shipped (commit `4d082d2`).**

- ✅ Supabase project live: `https://xctocyxiwnjdltxqlqyl.supabase.co`
- ✅ Database migrations 001–006 all applied to the live DB **and recorded in the remote migration history** (verified 2026-07-10 — `npx supabase migration list --linked` shows local and remote in sync)
- ✅ All 5 Edge Functions deployed to Supabase (includes `handle-stripe-webhook` and `quit-challenge`)
- ✅ Stripe secret key set as Supabase secret (`STRIPE_SECRET_KEY`)
- ✅ `.env` filled with real keys, `EXPO_PUBLIC_DEMO_MODE=false`
- ✅ App running locally (`npx expo start --ios`, requires `nvm use 20`)
- ✅ UI revamp complete — new theme, font, dashboard streak/nudge system
- ✅ Quit-challenge flow smoke-tested end-to-end on 2026-07-03 (confirm dialog → Stripe refund → DB update → webhook reconciliation → summary screen)
- ✅ Complete-challenge flow smoke-tested end-to-end on 2026-07-09 (payment → challenge → check-ins → refund calc → Stripe refund → automatic webhook reconciliation). Quit flow re-verified same session after the calc refactor; charity_id persistence verified.

**Fixed 2026-07-09 — protection-calc bugs (all in one pass, client + server):**
1. **Timezone discrepancy (was the "known open bug"):** all period-boundary math (day/week/month) is now explicit-UTC on both sides. The Edge Functions share one calc module, `supabase/functions/_shared/protection.ts`, which mirrors `src/utils/dates.ts` + `protection.ts` — keep the two in sync if touching either.
2. **Late-settlement docking:** periods after `end_date` counted as missed, so pressing Complete two days late forfeited two extra days. Reference date is now capped at end of challenge.
3. **In-flight masking:** a completed current (not yet closed) window counted toward `completedPeriods`, hiding one missed past period at quit time. Only closed periods count now.
4. **Penalty bypass:** `complete-challenge` never checked `end_date` — a direct API call on day 1 refunded 100% of protected funds, skipping the 20% quit penalty. Now rejects with 400 until the challenge has ended.

**Fixed 2026-07-09 — more live-infra drift (third incident of repo-says-X / prod-says-Y):**
1. Migration `002_add_charity_id.sql` was never applied to the live DB (`challenges.charity_id` didn't exist), and the deployed `confirm-challenge-start` was a stale build from before charity persistence — the two bugs masked each other, so creation "worked" but silently dropped the user's charity choice. Applied 002 and redeployed the function; both verified live.
2. The remote migration history table was completely empty (schema had been applied by hand). Repaired with `npx supabase migration repair --status applied ...` — `npx supabase migration list --linked` now shows 001–005 in sync, and `npx supabase db push` works normally for future migrations. **After any migration or Edge Function change, verify both: `migration list --linked` matches `supabase/migrations/`, and the deployed function build isn't stale.**

**Hardened 2026-07-10 — money-path edge cases (all live-tested, including a real concurrent double-quit):**
1. **Zero-refund settle:** a fully-missed challenge (protected = 0) used to crash on Stripe's zero-amount refund rejection and stay `active` forever. Both settlement functions now skip Stripe and set `refund_status: 'succeeded'` directly.
2. **Double-settlement:** settlement was SELECT → refund → UPDATE with no locking. Now both functions share a Stripe idempotency key (`settle-{challenge_id}`) and the UPDATE is conditional on `status = 'active'` (loser gets 409). Verified with two truly concurrent quits: one 200, one 409, exactly one Stripe refund.
3. **Silent partial failure:** DB errors after the refund fired were ignored (200 with `challenge: null`). Now checked; returns 500 with the refund id logged. A retry heals it via the idempotency key.
4. **Payment reuse / forged drafts:** migration 006 adds a unique constraint on `challenges.stripe_payment_intent_id` (replay → 409), and `confirm-challenge-start` validates the draft server-side (stake $50–2,500 and must equal `paymentIntent.amount − fee`, duration 1–365, target_count ≥ 1, window enum).
5. **Webhook retry:** unknown refund ids now return 404 so Stripe retries (heals the event-beats-insert race); previously a 200 meant `refund_status` stuck `pending` forever.

**Known open UX issues (deliberate, not yet fixed):** the financial day boundary is UTC midnight (5pm PT) — evening check-ins land in the next window and the 7pm-local reminder fires after the boundary; no claim CTA/notification when a challenge ends (Stripe refunds become impossible ~180 days after charge); `refund_status: 'failed'` isn't surfaced in the UI; `scheduleDailyReminder` is never called (dead code); check-in `window_key` is client-supplied so past windows can be backfilled via the API.

**Next step:** Set up PostHog (real API key in `.env`), then TestFlight build for real device testing (`eas build --platform ios --profile preview` — needs $99 Apple Developer account).

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Expo SDK 56, managed workflow |
| Routing | Expo Router (file-based, `app/` directory) |
| State | Zustand (`src/store/`) |
| Backend | Supabase (Postgres + Realtime + Edge Functions) |
| Auth | Supabase Auth |
| Payments | Stripe via `@stripe/stripe-react-native` (test mode) |
| Notifications | Expo Notifications |
| Analytics | PostHog (key not yet set — placeholder in .env) |
| Language | TypeScript (strict), path alias `@/*` → `src/*` |

---

## Project Structure

```
app/                    Expo Router screens
  _layout.tsx           Root layout — SafeAreaProvider, StripeProvider, auth init
  index.tsx             Redirect: no session → (auth)/welcome, session → (tabs)
  (auth)/               Welcome, sign-up, sign-in
  (tabs)/               Dashboard, History, Settings (bottom tab navigator)
  challenge/
    new/                3-step creation: details → charity → payment
    [id]/               Challenge detail (check-ins) + completion summary

src/
  constants/theme.ts    Dark color system, spacing, radius
  types/index.ts        All shared TypeScript types
  lib/
    supabase.ts         Supabase client singleton
    charities.ts        Dummy charity list (forfeited funds destination) + getCharityById
    demo.ts             Demo mode mock data (EXPO_PUBLIC_DEMO_MODE=true)
    notifications.ts    Push token registration + daily reminder scheduling
    posthog.ts          PostHog client
  store/
    useAuthStore.ts     Session, user, profile — initialized in root layout
    useChallengeStore.ts Challenges, check-ins, draft for creation flow
    useUIStore.ts       Toast state
  hooks/
    useCheckIn.ts       Optimistic +1 check-in with rollback on error
  api/
    payments.ts         Calls Supabase Edge Functions (create-payment-intent, etc.)
  utils/
    dates.ts            getWindowKey, getElapsedWindowKeys, challengeEndExclusive, elapsedDays, windowEndLabel, daysUntilWindowEnd
    protection.ts       computeProtection, computeGoalProgress, computeDashboardStatus (core financial logic)
    formatting.ts       formatCurrency, formatDate, pluralize
  components/
    ui/                 Button, Card, Input, ProgressBar, Badge
    challenge/          ChallengeCard, StakeSummaryPanel, GoalRow

supabase/
  migrations/           001–006 (004 merges goals into challenges, 005 adds quit, 006 unique payment_intent)
  functions/
    _shared/protection.ts     Server-side protection calc — mirrors src/utils/dates.ts + protection.ts, keep in sync
    create-payment-intent/    Returns Stripe client_secret for PaymentSheet
    confirm-challenge-start/  Verifies payment with Stripe, then creates challenge in DB
    complete-challenge/       Server-side protection calc, issues Stripe refund, marks complete
    handle-stripe-webhook/    Reconciles async refund.updated events from Stripe (deployed --no-verify-jwt — public endpoint, auth via Stripe signature)
    quit-challenge/           Server-side protection calc, 20% early-exit penalty on protected funds, issues Stripe refund, marks 'quit'
```

---

## Design System

Dark navy, warm cream text. Theme is in `src/constants/theme.ts`.

- Background: `#0E1019` (deep navy-black)
- Surface (cards): `#161929`, border `#232740`
- Text: `#F7F9E5` primary (warm cream), `#9B9D85` secondary, `#545649` muted
- Success: `#22C55E` (green), Danger: `#EF4444` (red)
- Primary button: white background / black text (inverted on dark)
- Money amounts: `HelveticaNeue-CondensedBlack`, `scaleY: 1.35`, `letterSpacing: -0.5`
  - 52px on the vault panel, 36px on cards
- Display font (all headings + amounts): `HelveticaNeue-CondensedBlack` with `transform: [{ scaleY: 1.35 }]`
- Body/UI font: system default (no custom font)
- Labels: 11px uppercase, letter-spacing 0.6–1
- At-risk nudge color: `#A07840` (warm amber — not red, intentionally calm)

---

## Core Financial Logic

**All monetary values stored in cents (INTEGER) — never floats.**

```
Daily Protection Value = stake_amount / duration_days

  - Enumerate closed (elapsed) periods since start_date — the current
    in-flight period is excluded entirely (not missed, not completed)
  - Reference date is capped at end of end_date, so periods after the
    challenge never count as missed no matter how late the user settles
  - completedPeriods = closed periods with ≥ target_count check-ins
  - missedPeriods = closedPeriods - completedPeriods
  - missedDayEquivalents = missedPeriods × daysPerPeriod(goal_window)

forfeitedCents = min(missedDayEquivalents × dpv, stake)
protectedCents = stake - forfeitedCents
```

`window_key` is stamped on every check-in at write time (e.g. `"2024-W23"` for weekly goals). This makes counting completions an O(1) indexed DB lookup.

**Important:** `goal_window` lives directly on the `challenges` table (not a separate `goals` table — that was merged in migration 004).

**All period-boundary math is explicit-UTC** (dates parsed as `T00:00:00Z`, UTC getters throughout) so the client (`src/utils/dates.ts` + `protection.ts`) and the server (`supabase/functions/_shared/protection.ts`, imported by both `complete-challenge` and `quit-challenge`) always produce identical numbers regardless of runtime timezone. If you touch one side, mirror it on the other — the test suite runs green under `TZ=UTC`, `TZ=America/Los_Angeles`, and `TZ=Pacific/Kiritimati`.

Display-only helpers (`windowEndLabel`, `daysUntilWindowEnd`, the at-risk nudge) intentionally stay in device-local time — "tonight" means the user's tonight; the financial boundary is UTC midnight.

Run tests: `npm test` (9 unit tests in `src/__tests__/protection.test.ts`)

---

## Supabase Schema (tables)

- `profiles` — extends auth.users, stores stripe_customer_id, push_token
- `challenges` — stake_amount (cents), duration_days, start_date, end_date, status (`active`/`completed`/`cancelled`/`quit`), target_count, goal_window, charity_id, refund_status (`pending`/`succeeded`/`failed`, added in 003), quit_penalty_cents (added in 005), stripe_payment_intent_id UNIQUE (006 — one challenge per payment)
- `check_ins` — challenge_id, window_key (stamped at write); no `goal_id` (goals table removed in 004)
- `payments` — audit log for deposits and refunds

All tables have RLS (users see only their own data). Auto-trigger creates `profiles` row on signup.

---

## Stripe Payment Flow

1. App calls `create-payment-intent` Edge Function → gets `client_secret`
2. App presents Stripe PaymentSheet (native UI)
3. On success, app calls `confirm-challenge-start` Edge Function with payment_intent_id
4. Edge Function verifies status=succeeded with Stripe, then writes challenge to DB
5. On completion, `complete-challenge` Edge Function runs protection calc server-side, issues refund, and records payment as `pending`
6. Stripe fires `refund.updated` webhook → `handle-stripe-webhook` Edge Function reconciles payment and challenge `refund_status` to `succeeded` or `failed`

**The Stripe secret key only lives in Supabase Edge Function env — never in the app.**

**Webhook setup (one-time):** In the Stripe dashboard, create a webhook pointing to `https://xctocyxiwnjdltxqlqyl.supabase.co/functions/v1/handle-stripe-webhook` listening for `refund.updated`. Copy the signing secret and run:
```bash
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref xctocyxiwnjdltxqlqyl
```

### Wallet payments (Apple Pay / Google Pay)

PaymentSheet is Stripe's pre-built UI — it renders Apple Pay / Google Pay as express options at the top of the sheet when enabled. Both are turned on in `app/challenge/new/payment.tsx`:

- `initPaymentSheet` passes `applePay` (with an itemized `cartItems` summary), `googlePay`, and an `appearance` object that themes the sheet to the dark navy palette.
- `StripeProvider` (`app/_layout.tsx`) and the `@stripe/stripe-react-native` config plugin (`app.json`) set `merchantIdentifier: "merchant.com.staked.app"` — Apple Pay requires this. Create the matching Merchant ID in the Apple Developer portal + a Stripe Apple Pay certificate before a real device build; the simulator shows the button but cannot complete a wallet charge.
- `enableGooglePay: true` in the config plugin; `googlePay.testEnv: true` keeps it in Stripe test mode.
- Demo mode (`EXPO_PUBLIC_DEMO_MODE=true`) bypasses Stripe entirely — `handlePay` calls `addDemoChallenge(draft)` so the full creation flow works locally without credentials.

### Charity selection

Step 3 of creation (`app/challenge/new/charity.tsx`) lets the user pick where forfeited funds go. **Dummy charity data for now** — three hard-coded charities in `src/lib/charities.ts`. The choice is stored on `ChallengeDraft.charity_id` / `Challenge.charity_id`, surfaced on the review screen, and **now persisted server-side**: migration `002_add_charity_id.sql` adds the `challenges.charity_id` column and `confirm-challenge-start` writes it.

**Donation model = Option A (platform-donates).** Forfeited funds stay in the platform's Stripe balance; Staked donates to the chosen charity in a monthly batch. There is **no per-challenge Stripe payout to charities** — that deliberately avoids money-transmitter / MSB exposure. UI copy reflects this ("Staked holds your stake… anything forfeited is donated to {charity} at the end of the month"). A real `charities` table with Stripe Connect accounts + automated transfers is the future Option B path, still TODO. See `docs/escrow-feasibility.md`.

---

## Quit Challenge Flow

Users can end an active challenge early from the challenge detail screen (`app/challenge/[id]/index.tsx`) via a "Quit Challenge" link, which opens a confirmation dialog showing the protected amount, a 20% early-exit penalty, and the net refund, then calls `quit-challenge`.

1. App calls `quit-challenge` Edge Function with `challenge_id`
2. Function re-derives protection server-side from `challenges` + `check_ins` (does **not** trust client-sent numbers), applies `QUIT_PENALTY_RATE = 0.20` to the protected amount, issues a partial Stripe refund for `protectedCents - penaltyCents`
3. Updates `challenges`: `status = 'quit'`, `protected_amount_cents`, `forfeited_amount_cents` (original forfeit + penalty), `quit_penalty_cents`, `stripe_refund_id`, `refund_status = 'pending'`
4. Inserts a `payments` row (`type: 'refund'`, `status: 'pending'`)
5. Same `handle-stripe-webhook` reconciles `refund_status` to `succeeded`/`failed` once Stripe's `refund.updated` event lands
6. App shows the "Challenge Ended Early" summary screen (original stake, missed check-ins, early-exit penalty, amount returned)

The confirmation dialog's numbers come from the client-side calc, which is an exact UTC mirror of the server's (see Core Financial Logic) — verified to agree as of 2026-07-09.

---

## Environment Variables

`.env` is gitignored. Current state — all real keys are set:

```
EXPO_PUBLIC_SUPABASE_URL=https://xctocyxiwnjdltxqlqyl.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<set>
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=<set, pk_test_...>
EXPO_PUBLIC_POSTHOG_API_KEY=placeholder_posthog_key   ← not yet configured
EXPO_PUBLIC_DEMO_MODE=false
```

Supabase Edge Function secrets (already deployed):
```
STRIPE_SECRET_KEY=sk_test_...   ← set via supabase secrets set
```

To redeploy Edge Functions (note `--no-verify-jwt` on the webhook only — see Current Status):
```bash
export SUPABASE_ACCESS_TOKEN=<personal access token>
npx supabase functions deploy create-payment-intent --project-ref xctocyxiwnjdltxqlqyl
npx supabase functions deploy confirm-challenge-start --project-ref xctocyxiwnjdltxqlqyl
npx supabase functions deploy complete-challenge --project-ref xctocyxiwnjdltxqlqyl
npx supabase functions deploy quit-challenge --project-ref xctocyxiwnjdltxqlqyl
npx supabase functions deploy handle-stripe-webhook --project-ref xctocyxiwnjdltxqlqyl --no-verify-jwt
```

---

## Demo Mode

Set `EXPO_PUBLIC_DEMO_MODE=true` in `.env` to run without any real API calls. `src/lib/demo.ts` provides mock challenges, goals, and check-ins. `useAuthStore` and `useChallengeStore` short-circuit to use mock data when this flag is set.

Run locally: `npx expo start --ios` (requires Node ≥20.13 — run `nvm use 20` first)

---

## What's Left to Ship

- [x] Smoke test sign-up → create challenge → pay → check-in
- [x] Smoke test quit-challenge → refund → webhook reconciliation (2026-07-03)
- [x] Smoke test normal completion → `complete-challenge` refund → webhook reconciliation (2026-07-09)
- [x] Fix client/server protection-calc discrepancy in quit-challenge (2026-07-09 — UTC everywhere, shared server calc module)
- [ ] Set up PostHog account and add real API key to `.env`
- [ ] TestFlight build: `eas build --platform ios --profile preview` (needs $99 Apple Developer account)
- [ ] Switch Stripe from test mode to live mode when ready for real money

---

## Dashboard Card Behaviour

`ChallengeCard` uses `computeDashboardStatus` to show:
- Streak pill (emoji + "N week/day streak") — bottom-right of the dollar amount
- Per-goal nudges below the progress bar: `GoalName Nx by <deadline>  $X at stake`
  - Nudge color for at-stake amount: `#A07840` (warm amber)
  - No red on the dashboard — red only appears when money is actually forfeited
- Emoji logic: 🔥 ≥4 streak, 💪 2–3 streak, ✅ all complete, ⚡ at risk, 🎯 1 streak, 💰 in progress
- `computeDashboardStatus` lives in `src/utils/protection.ts`
- `windowEndLabel` / `daysUntilWindowEnd` live in `src/utils/dates.ts`

## GoalRow Check-in Button

`src/components/challenge/GoalRow.tsx` — "Log it" pill button (white) per goal. When the period target is met it flips to "✓ Done" (green, disabled). Dot indicators (filled = completed, empty = remaining) show progress at a glance.

## Demo Mode Details

- `EXPO_PUBLIC_DEMO_MODE=true` — set in `.env` for local UI dev without credentials
- Store is pre-populated at init time (no need for `fetchChallenges` to run first)
- `addCheckIn` works in demo mode without Supabase auth
- Demo data includes 3 weeks of historical check-ins for Summer Fitness and 5 past days for Deep Work, so streak/nudge logic renders meaningfully
- Deep links work in demo mode (store is pre-populated, no "Challenge not found")
- Back button uses `router.canGoBack() ? router.back() : router.replace('/(tabs)')` to prevent GO_BACK crash on deep links

## Preferences & Decisions

- Commits after every meaningful phase, always push to origin
- No comments in code unless the WHY is non-obvious
- No extra abstractions — keep it direct
- Monetary values always in cents, convert to dollars only in formatting utils
- Edge Functions own all Stripe secret-key operations
- Demo mode must always work without credentials
- Node version: use `nvm use 20` (v20.20.2) — project requires ≥20.13
- Stripe import is a lazy `require` on native only (`_layout.tsx`) — keeps the file web-safe if needed later
