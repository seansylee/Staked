@AGENTS.md

# Staked — Project Context

## What This App Does

Staked is a financial commitment app. Users stake real money ($50–$2,500) when creating a challenge. They define a single goal (e.g. "Gym 3x/week"). Each day has a protection value (`stake / duration_days`). Completing the goal protects funds; missing it forfeits that day's value. At the end, protected funds are returned via Stripe refund.

This is an MVP to validate whether users will stake real money to improve follow-through. No social features, no AI, no automatic verification — manual check-ins only.

---

## Current Status

**Backend is live and connected. Single-goal model shipped (commit `e99ed29`). Quit-challenge feature shipped (commit `4d082d2`).**

- ✅ Supabase project live: `https://xctocyxiwnjdltxqlqyl.supabase.co`
- ✅ Database migrations 001–009 all applied to the live DB **and recorded in the remote migration history** (verified 2026-07-13 — `npx supabase migration list --linked` shows local and remote in sync)
- ✅ Supabase MCP server connected (`.mcp.json`, OAuth) — can inspect/apply migrations, deploy Edge Functions, run SQL, and check advisors without the CLI
- ✅ All 7 Edge Functions deployed to Supabase (includes `handle-stripe-webhook`, `quit-challenge`, `delete-account`, `settle-ended-challenges`)
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

**Fixed 2026-07-11 — the five open UX/trust gaps (all previously listed as known-open):**
1. **Claim CTA:** ended-but-unsettled challenges now render a green "Ready to claim" card state, sorted to the top of the dashboard (`ChallengeCard` + `isChallengeComplete`).
2. **Refund status surfaced:** `refund_status` added to the `Challenge` type; `RefundStatusNote` shows pending/failed/sent on both summary screens (hidden when refund is $0); History now includes quit challenges (they used to vanish entirely) with a QUIT EARLY tag, failed-refund flag, and a link to the quit summary.
3. **UTC boundary honesty:** deadline labels and at-risk nudges are computed from the real UTC financial boundary and rendered in local time ("by 5 PM", "by Sun 4 PM") via `nextWindowBoundary`/`hoursUntilWindowEnd`/`windowEndLabel` in `src/utils/dates.ts`. The financial boundary itself is unchanged (still UTC midnight, by design). Also fixed the doubled "by by Sun" nudge text.
4. **Reminders wired up:** dead `scheduleDailyReminder` replaced with `syncChallengeReminders` (called from the store on fetch/complete/quit): repeating check-in reminder 2h before the UTC boundary (daily-window challenges only), claim notification at challenge end, follow-up nudge 3 days later. Stable notification identifiers make the sync idempotent.
5. **Server-stamped check-ins (migration 007):** a BEFORE INSERT trigger stamps `window_key` + `logged_at` from `now()` at UTC (formats match the JS calc exactly, incl. ISO week `IYYY-"W"IW`) and rejects check-ins for challenges the user doesn't own / not active / outside the date range. **Live-verified 2026-07-11** with a throwaway user: forged backdated window_key was overridden, pre-start and foreign-challenge inserts rejected. Migration history in sync 001–007.

Also fixed: `tsc --noEmit` was broken at the config level (TS 6 `baseUrl` deprecation) and hid real type errors — typecheck is green now; run it before committing.

**Fixed 2026-07-13 — RLS lockdown (migration 008, applied + live-verified via the Supabase MCP):**
1. The known-open `FOR ALL` policy problem was worse than documented: it existed on **all four tables**, and the UPDATE path **was** money-exploitable — an authenticated user could rewrite `challenges.start_date`/`end_date`/`stake_amount` on a legitimately-paid challenge before settling, or rewrite `check_ins.window_key` after insert (the 007 trigger is BEFORE INSERT only), backdating check-ins to protect forfeited funds.
2. Policies are now: `challenges`/`payments` SELECT-only; `check_ins` SELECT + INSERT (no UPDATE/DELETE → `window_key` immutable once stamped); `profiles` SELECT + UPDATE (client updates only `push_token` after migration 009; `create-payment-intent` writes `stripe_customer_id` via the service role). All use `(SELECT auth.uid())` (per-statement caching, clears advisor 0003).
3. **Prerequisite discovered during this fix:** the old "Edge Functions use the service role" claim was false — only the webhook did; the other functions wrote with the *user's* JWT. `confirm-challenge-start`, `complete-challenge`, and `quit-challenge` now do all DB reads/writes through a `supabaseAdmin` (service role) client, keeping the anon+JWT client only for `auth.getUser()`; ownership is enforced by explicit `user_id` filters. Redeployed before the migration so prod never broke in between.
4. Also in 008: `stamp_check_in` gets `SET search_path = ''` with schema-qualified references (advisor 0011); `handle_new_user`/`stamp_check_in` EXECUTE revoked from anon/authenticated/PUBLIC (advisors 0028/0029 — triggers still fire, EXECUTE is only checked at creation); covering indexes on `check_ins.user_id` + `payments.user_id` (advisor 0001, also serve the RLS filters).
5. Live-verified as a simulated authenticated user (rollback-wrapped): forged challenge INSERT → RLS violation; challenge UPDATE / check_in UPDATE → 0 rows; forged payments INSERT → RLS violation; check-in INSERT still works with the trigger overriding a forged backdated key; own-profile UPDATE works. All three redeployed functions boot (anon-JWT smoke test → clean 401 from the auth check). Advisors clean, migration list in sync 001–008, tests 18/18, typecheck green.

**Deeper re-audit 2026-07-13 (second pass, migration 009):** went past the advisors into the actual reachable surface.
- **Found + fixed — `profiles` column-write gap:** 008's profiles UPDATE policy plus Supabase's default all-column UPDATE grant let a user rewrite their own `stripe_customer_id` and `email` — both of which `create-payment-intent` trusts (reuses `stripe_customer_id` as the PaymentIntent's Stripe customer; `email` as the customer email). Confirmed reachable live. Migration 009 `REVOKE UPDATE ON profiles` + `GRANT UPDATE (push_token)` — RLS can't scope columns, only grants can. Moved the `stripe_customer_id` write in `create-payment-intent` to the service role and redeployed (deployed build verified byte-equal to repo). Live-verified: `push_token` update still works, any other-column update now `42501 permission denied`.
- **Verified clean (no action):** `STRIPE_WEBHOOK_SECRET` is set (webhook returns 400 sig-check, not 500 missing); `http`/`pg_net` extensions not installed (no in-DB SSRF); no storage buckets; no views; only the two known functions, both with pinned `search_path`; blanket table grants on challenges/payments/check_ins are inert (no UPDATE/DELETE policy exists, so RLS denies regardless — left at Supabase default). **Auth-critical regression check:** signed up a throwaway user through the public REST endpoint after the 008 EXECUTE-revoke — `handle_new_user` trigger still fired and created the `profiles` row (EXECUTE is only checked at trigger creation, not fire time); user cascade-deleted afterward.

**Production-hardening pass 2026-07-14 (full-stack, all live-verified):**
1. **App shell:** branded icon/splash/adaptive/favicon assets generated (navy + cream `$` slab — replaced Expo placeholders), `userInterfaceStyle: dark`, splash on `#0E1019`, `ITSAppUsesNonExemptEncryption=false`, light StatusBar, root ErrorBoundary, tab icons (`@expo/vector-icons` + `expo-splash-screen` installed), dead `App.tsx`/`index.ts` template files deleted, `+not-found` + `payment-complete` routes (Stripe returnURL no longer 404s), eslint react-hooks plugin.
2. **Auth flows (top-ranked gap fixed):** PKCE flow; sign-up with confirm-email-enabled now routes to a "check your inbox" screen (resend w/ cooldown, already-registered detection); confirmation + recovery emails deep-link back (`staked://auth/callback`, `staked://auth/reset` → `app/auth/*` exchange screens); forgot/reset-password screens; sign-out wipes challenge store + cancels all reminders (cross-account privacy); PostHog identify/reset + no-op client when key is a placeholder; push registration never throws. **One-time dashboard step still required:** add both `staked://` URLs to Authentication → URL Configuration → Redirect URLs.
3. **Double-charge killed (gap #2):** one PaymentIntent per draft+amount reused across retries/cancels; after a successful charge a persisted `pendingConfirmation` {intent, draft} flips the payment screen to "Finish Setup — Already Paid" (only retries the confirm; 409 replay = success); Dashboard silently recovers pending confirmations on mount (survives app kill; hydration-aware). `create-payment-intent` (v5) now rejects non-integer/out-of-range totals (integer $53–$2,503). `api/payments` unwraps Edge Function error bodies into `ApiError {message, status}` — alerts show real reasons now.
4. **Fetch resilience:** `fetchChallenges` keeps stale data + sets `fetchError` instead of rendering "No active challenges" on a network blip; Dashboard error state/banner + retry; pull-to-refresh on Dashboard + History; History fetches on cold start; error toasts render red.
5. **Real charities:** seven verified 4-star 501(c)(3)s w/ EINs (GiveDirectly, AMF, St. Jude/ALSAC, MSF, charity: water, Feeding America, Nature Conservancy) in `src/lib/charities.ts`; legacy ids (`clean-water`/`food-bank`/`reforestation`) map to real orgs; non-affiliation disclaimer on the picker; charity now shown on the challenge detail screen.
6. **Account deletion (App Store 5.1.1(v)):** `delete-account` Edge Function (live-verified: 409 with active challenge; 200 + full auth→profiles→challenges cascade + Stripe customer cleanup after) + Settings UI with double confirm. Settings also gained Contact Support (mailto `src/constants/support.ts`) and in-app Terms/Privacy (`app/legal/*` — accurate to app behavior; needs counsel before real money).
7. **Auto-settlement (gap #4):** `settle-ended-challenges` Edge Function settles active challenges ended ≥7 days ago (same shared calc + `settle-{id}` idempotency + conditional update; safe under races/replays by construction) — live-tested both paths incl. a real Stripe refund for a month-old unclaimed test challenge. Migration `20260715053554_schedule_auto_settlement` (in remote history; local file matches) enables pg_cron + pg_net (registered under `extensions`, EXECUTE revoked from client roles) and schedules a daily 03:17 UTC job; Vault holds `project_url` + `anon_key` (public values, kept out of the repo anyway). Cron plumbing verified end-to-end (Vault → pg_net → function 200).
8. **Webhook race found & fixed during verification:** the challenge-side `refund_status` mirror write was unchecked and a live race left a challenge `pending` while its payments row said `succeeded`. Webhook (v4) now fails loudly so Stripe redelivers, and the daily settle job sweeps any remaining payments↔challenges drift (`reconciled` in its summary).

Deployed function versions as of 2026-07-14: create-payment-intent v5, confirm-challenge-start (unchanged), complete-challenge (unchanged), quit-challenge (unchanged), handle-stripe-webhook v4 (`--no-verify-jwt`), delete-account v1, settle-ended-challenges v2. All deploys done via the Supabase MCP; deployed builds verified against the repo.

**Known open:**
- Supabase Auth "leaked password protection" (HaveIBeenPwned check) is disabled — dashboard-only toggle: Dashboard → Authentication → Providers → Email.
- Redirect-URL allowlist for the two `staked://` deep links — dashboard-only (Authentication → URL Configuration).
- UTC-boundary deadlines are honest in the UI but still a product-level surprise for US evening users; per-user timezone anchoring is the eventual fix (client+server+trigger in one pass).
- Legal pages are drafts pending counsel; commercial co-venture registration may be required in some US states once real money flows to named charities.

**Next step:** Set up PostHog (real API key in `.env`; app-side instrumentation incl. identify is complete), add the two redirect URLs in the Supabase dashboard, then TestFlight build (`eas build --platform ios --profile preview` — needs $99 Apple Developer account; no `eas.json` yet, so run `eas build:configure` first; then put the EAS projectId in app.json so push tokens work in dev builds).

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
    notifications.ts    Push token registration + syncChallengeReminders (check-in + claim reminders, idempotent by identifier)
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
    dates.ts            getWindowKey, getElapsedWindowKeys, challengeEndExclusive, elapsedDays, nextWindowBoundary, hoursUntilWindowEnd, windowEndLabel, localTimeLabel
    protection.ts       computeProtection, computeGoalProgress, computeDashboardStatus (core financial logic)
    formatting.ts       formatCurrency, formatDate, pluralize
  components/
    ui/                 Button, Card, Input, ProgressBar, Badge
    challenge/          ChallengeCard, StakeSummaryPanel, GoalRow, RefundStatusNote

supabase/
  migrations/           001–009 + 20260715053554 (004 merges goals into challenges, 005 adds quit, 006 unique payment_intent, 007 server-stamps check-in window_key, 008 locks RLS to read-only + hardens functions, 009 restricts profiles UPDATE to push_token, 20260715053554 schedules auto-settlement via pg_cron/pg_net)
  functions/
    _shared/protection.ts     Server-side protection calc — mirrors src/utils/dates.ts + protection.ts, keep in sync
    create-payment-intent/    Returns Stripe client_secret for PaymentSheet (validates integer $53–$2,503 total)
    confirm-challenge-start/  Verifies payment with Stripe, then creates challenge in DB
    complete-challenge/       Server-side protection calc, issues Stripe refund, marks complete
    handle-stripe-webhook/    Reconciles async refund.updated events from Stripe (deployed --no-verify-jwt — public endpoint, auth via Stripe signature)
    quit-challenge/           Server-side protection calc, 20% early-exit penalty on protected funds, issues Stripe refund, marks 'quit'
    delete-account/           In-app account deletion (App Store 5.1.1(v)); 409 while challenges active; cascades + Stripe customer cleanup
    settle-ended-challenges/  Daily auto-settlement of unclaimed ended challenges + refund-status drift reconciliation (pg_cron, migration 20260715053554)
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

`window_key` is stamped on every check-in at write time (e.g. `"2024-W23"` for weekly goals). This makes counting completions an O(1) indexed DB lookup. Since migration 007 the stamp is **server-side** (BEFORE INSERT trigger, UTC `now()`) — the client still computes it for optimistic UI/demo mode, but the DB value is authoritative and client-sent values are overwritten.

**Important:** `goal_window` lives directly on the `challenges` table (not a separate `goals` table — that was merged in migration 004).

**All period-boundary math is explicit-UTC** (dates parsed as `T00:00:00Z`, UTC getters throughout) so the client (`src/utils/dates.ts` + `protection.ts`) and the server (`supabase/functions/_shared/protection.ts`, imported by both `complete-challenge` and `quit-challenge`) always produce identical numbers regardless of runtime timezone. If you touch one side, mirror it on the other — the test suite runs green under `TZ=UTC`, `TZ=America/Los_Angeles`, and `TZ=Pacific/Kiritimati`.

Display helpers (`windowEndLabel`, `hoursUntilWindowEnd`, the at-risk nudge) compute against the real UTC boundary and render it in the user's local time — "by 5 PM" in PT, not "tonight" — so labels never promise more time than the money math allows.

Run tests: `npm test` (18 unit tests in `src/__tests__/protection.test.ts` + `dates.test.ts`; keep them green under `TZ=UTC`, `TZ=America/Los_Angeles`, and `TZ=Pacific/Kiritimati`)

---

## Supabase Schema (tables)

- `profiles` — extends auth.users, stores stripe_customer_id, push_token
- `challenges` — stake_amount (cents), duration_days, start_date, end_date, status (`active`/`completed`/`cancelled`/`quit`), target_count, goal_window, charity_id, refund_status (`pending`/`succeeded`/`failed`, added in 003), quit_penalty_cents (added in 005), stripe_payment_intent_id UNIQUE (006 — one challenge per payment)
- `check_ins` — challenge_id, window_key + logged_at (server-stamped by trigger since 007; client values ignored); no `goal_id` (goals table removed in 004)
- `payments` — audit log for deposits and refunds

All tables have RLS (users see only their own data). Since migration 008 client JWTs are **read-only** on `challenges`/`payments`; the only client writes are `check_ins` INSERT (trigger-validated) and the own `profiles` row (UPDATE). All other writes happen in Edge Functions via the service role. Auto-trigger creates `profiles` row on signup.

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

Step 2 of creation (`app/challenge/new/charity.tsx`) lets the user pick where forfeited funds go. **Real charities since 2026-07-14** — seven 4-star 501(c)(3)s in `src/lib/charities.ts` with EINs and websites (verified via Charity Navigator July 2026); a legacy-id map keeps pre-existing rows rendering. The choice is stored on `ChallengeDraft.charity_id` / `Challenge.charity_id`, surfaced on the review screen and the challenge detail screen, and persisted server-side (migration 002, `confirm-challenge-start`).

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
- [x] Email-confirmation onboarding, forgot/reset password, deep-link plumbing (2026-07-14)
- [x] Double-charge fix: payment-intent reuse + persisted confirm recovery (2026-07-14)
- [x] Real charities, account deletion, legal screens, auto-settlement (2026-07-14)
- [ ] Supabase dashboard: add `staked://auth/callback` + `staked://auth/reset` to redirect URLs; enable leaked-password protection
- [ ] Set up PostHog account and add real API key to `.env`
- [ ] TestFlight build: `eas build --platform ios --profile preview` (needs $99 Apple Developer account; run `eas build:configure` first)
- [ ] Legal review of Terms/Privacy + charity-promotion (commercial co-venture) compliance before live mode
- [ ] Switch Stripe from test mode to live mode when ready for real money

---

## Dashboard Card Behaviour

When a challenge has ended but is unsettled (`isChallengeComplete`), the card flips to a claim state — green border, "🎉 Ready to claim" pill, "Tap to claim your $X refund" — and sorts to the top of the dashboard. Otherwise `ChallengeCard` uses `computeDashboardStatus` to show:
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
