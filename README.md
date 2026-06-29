# Staked

A financial commitment app for iOS. Put real money on the line to follow through on your goals.

## What It Does

Staked lets you stake real money ($50–$2,500) against a personal goal. Each day has a protection value equal to your stake divided by the challenge duration. Complete your goal and your money is protected; miss it and that day's value is forfeited. At the end, protected funds are refunded via Stripe.

This is a manual check-in MVP — no AI verification, no social layer. Just a financial contract with yourself.

## How It Works

1. **Create a challenge** — set a goal, stake amount, and duration
2. **Pay via Stripe** — funds are held; Apple Pay and Google Pay supported
3. **Log check-ins daily** — each logged day protects that day's value
4. **Challenge ends** — protected amount is refunded; forfeited funds go to your chosen charity

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Expo SDK 56 (managed workflow) |
| Routing | Expo Router (file-based) |
| State | Zustand |
| Backend | Supabase (Postgres + Edge Functions) |
| Auth | Supabase Auth |
| Payments | Stripe (`@stripe/stripe-react-native`) |
| Language | TypeScript (strict) |

## Project Structure

```
app/                    Screens (Expo Router)
  (auth)/               Welcome, sign-up, sign-in
  (tabs)/               Dashboard, History, Settings
  challenge/new/        4-step creation: details → goals → charity → payment
  challenge/[id]/       Check-ins and completion summary

src/
  api/                  Edge Function calls (Stripe payment flow)
  components/           Reusable UI and challenge components
  hooks/                useCheckIn (optimistic with rollback)
  lib/                  Supabase client, charities, demo mode, notifications
  store/                Auth, challenges, UI (Zustand)
  utils/                Protection math, date windows, formatting
  constants/theme.ts    Dark navy design system

supabase/
  migrations/           Postgres schema + RLS policies
  functions/            Edge Functions (Stripe operations, webhook handler)
```

## Running Locally

Requires Node ≥ 20.13.

```bash
nvm use 20
npx expo start --ios
```

For local UI development without credentials, set `EXPO_PUBLIC_DEMO_MODE=true` in `.env`. Demo mode pre-populates the store with mock challenges and check-ins so all screens render without a Supabase or Stripe connection.

## Environment Variables

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
EXPO_PUBLIC_POSTHOG_API_KEY=
EXPO_PUBLIC_DEMO_MODE=false
```

The Stripe secret key lives only in Supabase Edge Function environment variables — never in the app.

## Financial Logic

All monetary values are stored in cents. Protection is calculated server-side on challenge completion:

```
daily_protection_value = stake / duration_days
forfeited = min(missed_day_equivalents × daily_protection_value, stake)
refund = stake - forfeited
```

With multiple goals, each goal contributes proportionally — missing one of two goals forfeits half the day's value.

## Stripe Payment Flow

1. App calls `create-payment-intent` Edge Function → receives `client_secret`
2. Stripe PaymentSheet presented natively (supports Apple Pay / Google Pay)
3. On success, app calls `confirm-challenge-start` with `payment_intent_id`
4. Edge Function verifies payment with Stripe, writes challenge + goals to DB
5. On completion, `complete-challenge` runs protection calc server-side and issues refund
6. `refund.updated` webhook reconciles final refund status

## Running Tests

```bash
npm test
```

Six unit tests covering the core protection and date-window logic in `src/__tests__/protection.test.ts`.
