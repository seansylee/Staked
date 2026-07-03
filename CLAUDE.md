@AGENTS.md

# Staked — Project Context

## What This App Does

Staked is a financial commitment app. Users stake real money ($50–$2,500) when creating a challenge. They define a single goal (e.g. "Gym 3x/week"). Each day has a protection value (`stake / duration_days`). Completing the goal protects funds; missing it forfeits that day's value. At the end, protected funds are returned via Stripe refund.

This is an MVP to validate whether users will stake real money to improve follow-through. No social features, no AI, no automatic verification — manual check-ins only.

---

## Current Status

**Backend is live and connected. Single-goal model shipped (commit `e99ed29`). Quit-challenge feature shipped (commit `4d082d2`).**

- ✅ Supabase project live: `https://xctocyxiwnjdltxqlqyl.supabase.co`
- ✅ Database migrations 001–005 all applied to the live DB (**005 adds quit support** — `quit_penalty_cents` column + `'quit'` status)
- ✅ All 5 Edge Functions deployed to Supabase (includes `handle-stripe-webhook` and `quit-challenge`)
- ✅ Stripe secret key set as Supabase secret (`STRIPE_SECRET_KEY`)
- ✅ `.env` filled with real keys, `EXPO_PUBLIC_DEMO_MODE=false`
- ✅ App running locally (`npx expo start --ios`, requires `nvm use 20`)
- ✅ UI revamp complete — new theme, font, dashboard streak/nudge system
- ✅ Quit-challenge flow smoke-tested end-to-end on 2026-07-03 (confirm dialog → Stripe refund → DB update → webhook reconciliation → summary screen)

**Recently fixed (2026-07-03) — two live-infra bugs that had silently broken the entire refund path since deployment:**
1. Migration `003_add_refund_status.sql` was committed but never actually applied to the live DB, even though 004/005 landed on top of the gap. Every `complete-challenge` / `quit-challenge` refund write was failing after the Stripe refund had already fired, leaving challenges stuck `active` with an untracked Stripe refund. Applied directly to the live DB — **run `npx supabase migration list --linked` and diff against `supabase/migrations/` after any future migration work to make sure this doesn't happen again.**
2. `handle-stripe-webhook` was deployed with the Supabase default `verify_jwt: true`, so the platform gateway 401'd every call from Stripe (Stripe sends `stripe-signature`, not a Supabase JWT) before the function code ever ran. Redeployed with `--no-verify-jwt`. **Any Edge Function called by something other than the app itself (webhooks, cron, etc.) needs `--no-verify-jwt` — the app-facing functions (`create-payment-intent`, `confirm-challenge-start`, `complete-challenge`, `quit-challenge`) should keep the default `verify_jwt: true`.**

**Known open bug:** the quit-challenge confirmation dialog shows a protection/refund amount computed client-side (`src/utils/protection.ts`) that can disagree with what the server (`supabase/functions/quit-challenge/index.ts`, a separate duplicated calc) actually refunds — observed off by one day's protection value ($83.33/$66.66 promised vs $80/$64 actually refunded). Root cause: both sides parse `start_date + 'T00:00:00'` with no timezone offset, so `countElapsedPeriods` resolves "midnight" in whatever timezone the runtime happens to be in — the device's local zone on the client, UTC on the Deno Edge Function server. Near a day boundary this shifts the elapsed-periods `floor()` by one. Fix by parsing as UTC explicitly (`T00:00:00Z`) on both sides, or by having the client trust the server's number instead of precomputing its own. **A user-facing dollar amount should never differ from what's actually charged — fix before shipping.**

**Next step:** Re-verify `complete-challenge` (normal, non-quit completion + refund) — this was never finished in the original smoke test session and predates both infra fixes above, so it should be re-run fresh. Then fix the protection-calc discrepancy above.

**After that:** TestFlight build for real device testing (`eas build --platform ios --profile preview` — needs $99 Apple Developer account).

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
    dates.ts            getWindowKey, countElapsedPeriods, elapsedDays, windowEndLabel, daysUntilWindowEnd
    protection.ts       computeProtection, computeGoalProgress, computeDashboardStatus (core financial logic)
    formatting.ts       formatCurrency, formatDate, pluralize
  components/
    ui/                 Button, Card, Input, ProgressBar, Badge
    challenge/          ChallengeCard, StakeSummaryPanel, GoalRow

supabase/
  migrations/           001–005 (004 merges goals table into challenges, 005 adds quit support)
  functions/
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

  - Count elapsed complete periods (daily/weekly/monthly)
  - Current in-flight period is NOT counted as missed
  - missedPeriods = elapsedPeriods - completedPeriods
  - missedDayEquivalents = missedPeriods × daysPerPeriod(goal_window)

forfeitedCents = min(missedDayEquivalents × dpv, stake)
protectedCents = stake - forfeitedCents
```

`window_key` is stamped on every check-in at write time (e.g. `"2024-W23"` for weekly goals). This makes counting completions an O(1) indexed DB lookup.

**Important:** `goal_window` lives directly on the `challenges` table (not a separate `goals` table — that was merged in migration 004).

**Caution:** `countElapsedPeriods` parses `start_date + 'T00:00:00'` with no timezone suffix, so "midnight" resolves in whatever local timezone the runtime is in. The client (`src/utils/dates.ts`) and the server duplicate in `supabase/functions/quit-challenge/index.ts` can therefore disagree near a day boundary — see the known bug in Current Status above. Parse as UTC explicitly if touching this logic.

Run tests: `npm test` (6 unit tests in `src/__tests__/protection.test.ts`)

---

## Supabase Schema (tables)

- `profiles` — extends auth.users, stores stripe_customer_id, push_token
- `challenges` — stake_amount (cents), duration_days, start_date, end_date, status (`active`/`completed`/`cancelled`/`quit`), target_count, goal_window, charity_id, refund_status (`pending`/`succeeded`/`failed`, added in 003), quit_penalty_cents (added in 005)
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

See the client/server protection-calc discrepancy noted in Current Status — the confirmation dialog's numbers can disagree with the actual refund.

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
- [ ] Smoke test normal completion → `complete-challenge` refund → webhook reconciliation (never finished — re-run now that the migration/webhook-auth bugs are fixed)
- [ ] Fix client/server protection-calc discrepancy in quit-challenge (see Current Status)
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
