@AGENTS.md

# Staked — Project Context

## What This App Does

Staked is a financial commitment app. Users stake real money ($50–$2,500) when creating a challenge. They define goals (e.g. "Gym 3x/week"). Each day has a protection value (`stake / duration_days`). Completed goals protect funds; missed goals forfeit that day's value. At the end, protected funds are returned via Stripe refund.

This is an MVP to validate whether users will stake real money to improve follow-through. No social features, no AI, no automatic verification — manual check-ins only.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Expo SDK 56, managed workflow |
| Routing | Expo Router (file-based, `app/` directory) |
| State | Zustand (`src/store/`) |
| Backend | Supabase (Postgres + Realtime + Edge Functions) |
| Auth | Supabase Auth |
| Payments | Stripe via `@stripe/stripe-react-native` |
| Notifications | Expo Notifications |
| Analytics | PostHog |
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
    new/                3-step creation: details → goals → payment
    [id]/               Challenge detail (check-ins) + completion summary

src/
  constants/theme.ts    Dark color system, spacing, radius
  types/index.ts        All shared TypeScript types
  lib/
    supabase.ts         Supabase client singleton
    demo.ts             Demo mode mock data (EXPO_PUBLIC_DEMO_MODE=true)
    notifications.ts    Push token registration + daily reminder scheduling
    posthog.ts          PostHog client
  store/
    useAuthStore.ts     Session, user, profile — initialized in root layout
    useChallengeStore.ts Challenges, goals, check-ins, draft for creation flow
    useUIStore.ts       Toast state
  hooks/
    useCheckIn.ts       Optimistic +1 check-in with rollback on error
  api/
    payments.ts         Calls Supabase Edge Functions (create-payment-intent, etc.)
  utils/
    dates.ts            getWindowKey, countElapsedPeriods, elapsedDays
    protection.ts       computeProtection, computeGoalProgress (core financial logic)
    formatting.ts       formatCurrency, formatDate, pluralize
  components/
    ui/                 Button, Card, Input, ProgressBar, Badge
    challenge/          ChallengeCard, StakeSummaryPanel, GoalRow

supabase/
  migrations/001_initial_schema.sql   All tables, RLS policies, auto-profile trigger
  functions/
    create-payment-intent/    Returns Stripe client_secret for PaymentSheet
    confirm-challenge-start/  Verifies payment with Stripe, then creates challenge + goals in DB
    complete-challenge/       Server-side protection calc, issues Stripe refund, marks complete
```

---

## Design System

Dark, minimal, chic. Theme is in `src/constants/theme.ts`.

- Background: `#0F0F0F`
- Surface (cards): `#1A1A1A`, border `#2A2A2A`
- Text: `#F5F5F5` primary, `#888` secondary, `#444` muted
- Success: `#22C55E` (green), Danger: `#EF4444` (red)
- Primary button: white background / black text (inverted on dark)
- Money amounts: 52px bold on the vault panel, 36px on cards
- Labels: 11px uppercase, letter-spacing 0.6–1

---

## Core Financial Logic

**All monetary values stored in cents (INTEGER) — never floats.**

```
Daily Protection Value = stake_amount / duration_days

For each goal:
  - Count elapsed complete periods (daily/weekly/monthly)
  - Current in-flight period is NOT counted as missed
  - missedPeriods = elapsedPeriods - completedPeriods
  - missedDayEquivalents = missedPeriods × daysPerPeriod(window)

With multiple goals, each contributes missedDayEquivalents / goals.length
(missing one of two goals forfeits only half the stake)

forfeitedCents = min(totalMissedDayEquivalents × dpv, stake)
protectedCents = stake - forfeitedCents
```

`window_key` is stamped on every check-in at write time (e.g. `"2024-W23"` for weekly goals). This makes counting completions an O(1) indexed DB lookup.

Run tests: `npm test` (6 unit tests in `src/__tests__/protection.test.ts`)

---

## Supabase Schema (tables)

- `profiles` — extends auth.users, stores stripe_customer_id, push_token
- `challenges` — stake_amount (cents), duration_days, start_date, end_date, status
- `goals` — target_count, window (daily/weekly/monthly)
- `check_ins` — goal_id, challenge_id, window_key (stamped at write)
- `payments` — audit log for deposits and refunds

All tables have RLS (users see only their own data). Auto-trigger creates `profiles` row on signup.

---

## Stripe Payment Flow

1. App calls `create-payment-intent` Edge Function → gets `client_secret`
2. App presents Stripe PaymentSheet (native UI)
3. On success, app calls `confirm-challenge-start` Edge Function with payment_intent_id
4. Edge Function verifies status=succeeded with Stripe, then writes challenge+goals to DB
5. On completion, `complete-challenge` Edge Function runs protection calc server-side and issues refund

**The Stripe secret key only lives in Supabase Edge Function env — never in the app.**

---

## Environment Variables

Required in `.env` (gitignored):

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
EXPO_PUBLIC_POSTHOG_API_KEY=
EXPO_PUBLIC_DEMO_MODE=false
```

Supabase Edge Functions need these secrets (set via `supabase secrets set`):
```
STRIPE_SECRET_KEY=sk_...
```

---

## Demo Mode

Set `EXPO_PUBLIC_DEMO_MODE=true` in `.env` to run the app without any real API calls. `src/lib/demo.ts` provides mock challenges, goals, and check-ins. `useAuthStore` and `useChallengeStore` short-circuit to use mock data when this flag is set.

Run locally: `npx expo start --ios` (requires Node ≥20.13; use `nvm use 20`)

---

## What's Left to Ship

- [ ] Create Supabase project, run `supabase/migrations/001_initial_schema.sql`
- [ ] Set Stripe secret key: `supabase secrets set STRIPE_SECRET_KEY=sk_test_...`
- [ ] Deploy Edge Functions: `supabase functions deploy create-payment-intent` (×3)
- [ ] Fill in real keys in `.env`, set `EXPO_PUBLIC_DEMO_MODE=false`
- [ ] Smoke test: create challenge → pay with Stripe test card `4242 4242 4242 4242`
- [ ] TestFlight build: `eas build --platform ios --profile preview` (needs $99 Apple Dev account)

---

## Preferences & Decisions

- Commits after every meaningful phase
- No comments in code unless the WHY is non-obvious
- No extra abstractions — keep it direct
- Monetary values always in cents, convert to dollars only in formatting utils
- Edge Functions own all Stripe secret-key operations
- Demo mode must always work without credentials
