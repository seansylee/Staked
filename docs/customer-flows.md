# Staked — Customer Flows & Use Cases

Every flow a customer can encounter, with the exact screens, money mechanics, and
edge cases behind each one. Sources of truth: `app/` screens, `src/utils/protection.ts`
(client calc), `supabase/functions/` (server calc — always authoritative for money).

Last verified against the codebase: 2026-07-12.

---

## The core loop (30-second version)

```
Sign up → Create challenge (stake $50–$2,500) → Pay via Stripe
   → Check in every day/week/month → each completed window protects money,
     each missed window forfeits (stake ÷ duration_days) × days-per-window
   → Challenge ends → Claim → Stripe refunds the protected amount
   → Forfeited money is donated to the user's chosen charity (monthly batch)
```

Money is held in Staked's Stripe balance the whole time. There is no wallet, no
payout account, no partial withdrawals. One payment in, at most one refund out.

---

## 1. Onboarding & authentication

### 1.1 First launch
- `app/index.tsx` redirects: no session → Welcome screen; session → Dashboard.
- Welcome: "$taked — Put real money behind your commitments." Two paths:
  **Get Started** (sign-up) or **Sign In**.

### 1.2 Sign up
- Email + password (min 8 chars, zod-validated inline).
- On success: PostHog `user_signed_up`, push-notification permission prompt
  (`registerForPushNotifications`), straight to Dashboard.
- A DB trigger auto-creates the `profiles` row.
- Failure (email taken, weak password, network): alert with the Supabase error,
  PostHog `sign_up_failed`.

> ⚠️ **Known gap:** the app assumes sign-up returns a live session, but the live
> Supabase project has **email confirmation enabled** (verified 2026-07-11: REST
> sign-up returns `confirmation_sent_at` and no access token). A fresh production
> sign-up lands on the Dashboard signed-out — empty state, no explanation, no
> "check your email" screen. Fix before TestFlight: either disable confirm-email
> in Supabase Auth settings for the MVP, or add a confirmation-pending screen.

### 1.3 Sign in
- Email + password. Wrong credentials → alert. Success → Dashboard, push
  token re-registered.

### 1.4 Session persistence & sign out
- Supabase session persists across launches; users skip auth entirely.
- Sign out lives in Settings, behind a confirm dialog → Welcome screen.
- Settings otherwise shows only account email and app version.

---

## 2. Creating a challenge (3 steps)

### Step 1 — Details (`challenge/new/details`)
- Name (≤60 chars), stake (presets $50/$100/$250/$500/$1,000 or custom
  $50–$2,500), duration (30/60/90 presets, 1–365 allowed), goal cadence
  (daily / weekly / monthly), target count per window (1–99, presets 1/2/3/5).
- Live preview of the daily protection value (stake ÷ duration).
- The draft persists in the store — backing out and returning keeps the values.

### Step 2 — Charity (`challenge/new/charity`)
- Pick where forfeited money goes (3 hard-coded charities for MVP).
- Choice is persisted server-side on the challenge (`charity_id`).

### Step 3 — Review & Pay (`challenge/new/payment`)
- Summary of challenge + cost breakdown: **stake + $3 platform fee = total**.
  The stake is refundable; the $3 fee is not (refunds only ever cover the stake).
- Copy states the escrow model: "Staked holds your stake for N days… anything
  forfeited is donated to {charity} at the end of the month."
- Payment methods:
  - **Apple Pay / Google Pay** express button (shown when the device supports it;
    real-device wallet charges need the Apple Merchant ID + Stripe cert — see
    CLAUDE.md; the simulator shows the button but can't complete).
  - **Card** via Stripe PaymentSheet (dark-themed to match the app).
- Server-side (`confirm-challenge-start`) re-verifies everything before the
  challenge row is written: payment intent status is `succeeded`, stake matches
  `paymentIntent.amount − fee`, stake $50–$2,500, duration 1–365, target ≥ 1,
  valid window enum. A payment intent can create **exactly one** challenge
  (unique constraint — replays get 409).
- Success: toast "🔥 {name} is live! $X is on the line", Dashboard. The challenge
  starts **today** (UTC) — the current window is live immediately.

**Payment edge cases a customer can hit:**

| Scenario | What happens |
|---|---|
| Taps X / swipes away the sheet | Silent return to review screen; no charge |
| Card declined | "Payment Failed" alert with Stripe's reason; can retry |
| Wallet auth fails/cancelled | Same — cancel is silent, real errors alert |
| Network drops **after** charge but before challenge creation | Alert; draft intact. ⚠️ **Known gap:** retrying the Pay button creates a *new* payment intent → the customer is charged twice, and the first (orphaned) charge must be refunded manually in the Stripe dashboard. No automatic recovery yet. |
| Kills app mid-payment | Payment intent may complete at Stripe with no challenge → same orphaned-charge situation |

---

## 3. Living with an active challenge

### 3.1 Dashboard (`(tabs)/index`)
- Empty state: "No active challenges" + Create Challenge button.
- One card per active challenge: protected amount (big number), progress bar,
  status pill, and a nudge row when the current window isn't done.
- Status pill logic (in priority order):
  - ⚡ "Finish strong" — window incomplete and close to the boundary
    (≤6h daily / ≤60h weekly / ≤72h monthly)
  - 🔥 / 💪 "N day/week streak" — 4+ / 2–3 consecutive completed windows
  - ✅ "All done" — current window target met
  - 🎯 "1 streak going" / 💰 "In progress"
- Nudge row: `2× by 5 PM  $10.00 at stake` — the at-stake amount is warm amber
  (`#A07840`), never red. Red only appears once money is actually gone.
- **Ended challenges** flip to a green claim card (see §4.1) and sort to the top.

### 3.2 The check-in window and its boundary (important!)
- The financial boundary is **UTC midnight** — 5 PM PT / 8 PM ET. All deadline
  labels show that real boundary in the customer's local time ("by 5 PM",
  "by Sun 4 PM"), so what they read is what the money math does.
- A check-in logged at 6 PM PT lands in **tomorrow's** window. The UI won't
  mislead (labels are honest), but customers in the Americas effectively have
  early-evening deadlines. Accepted MVP trade-off; a per-user timezone boundary
  is the eventual fix.
- Weekly windows are ISO weeks (Mon–Sun, UTC). Monthly = calendar month (UTC).

### 3.3 Logging a check-in (`challenge/[id]`)
- "Log it" button per challenge; dots show progress toward the window target;
  flips to "✓ Done" (green, disabled) at target.
- Optimistic UI: count bumps instantly, rolls back with a toast on failure.
- The server stamps `window_key` and `logged_at` at insert time (migration 007)
  — client-supplied values are overwritten, so past/future windows cannot be
  backfilled even with direct API calls. The DB also rejects check-ins on
  challenges that are not the caller's, not active, not started, or ended.
- Extra check-ins beyond the target are allowed and harmless (only "≥ target"
  matters).
- Check-ins are **not undoable** in the UI (no delete flow).

### 3.4 Missing a window
- Nothing happens visually until the window **closes**. Once closed and short of
  target, that window's value is forfeited:
  `forfeit = (stake ÷ duration_days) × days-per-window` (1 / 7 / 30).
- The in-flight window never counts — neither for nor against — so the protected
  number can only drop after a boundary passes.
- The detail screen's vault panel shows Protected vs At Risk in real time.
- Forfeits are capped at the stake — a disastrous run ends at $0, never negative.

### 3.5 Reminders (local notifications, opt-in via iOS/Android permission)
| Notification | When | Condition |
|---|---|---|
| "{name} closes at 5 PM. Log it to protect your stake." | Daily, 2h before the UTC boundary | Has ≥1 active **daily** challenge (weekly/monthly get no nag — deliberate) |
| "Challenge complete 🎉 — claim your refund" | The moment the challenge ends | Active challenge reaches end |
| "Your refund is waiting" | 3 days after end | Still unclaimed |

- Denied notification permission = no reminders, everything else works.
- Settling a challenge cancels its pending claim reminders on next sync.

---

## 4. Ending a challenge — the happy path (completion)

### 4.1 Challenge ends
- After the final day (end_date is inclusive; boundary is UTC midnight after it),
  the dashboard card turns green: "🎉 Ready to claim / Tap to claim your $X
  refund", sorted to the top. Claim notifications fire (§3.5).
- Check-in UI disappears from the detail screen; a "Complete Challenge" button
  appears instead.
- **Settling late costs nothing** — windows after end_date never count as missed.
- ⚠️ Hard deadline: Stripe cannot refund a charge older than ~180 days. A
  customer who ignores the app for 6 months loses the refund path entirely.

### 4.2 Claiming
- "Complete Challenge" → confirm dialog → `complete-challenge` Edge Function:
  recomputes protection **server-side** (never trusts the client), issues a
  Stripe refund for the protected amount, marks the challenge `completed`.
- Completion summary screen: success rate ("83% protected"), stake / protected /
  forfeited breakdown, "Returned to you", dates, and a live refund-status note.
- Calling complete before the end date (only possible via API) → 400.

### 4.3 Refund lifecycle (applies to quit too)
| `refund_status` | Customer sees |
|---|---|
| `pending` | "Refund processing — funds typically appear in 5–10 business days." |
| `succeeded` (via Stripe `refund.updated` webhook) | "✓ Refund sent to your original payment method." |
| `failed` | Red box: "Refund failed — your money is safe, contact support." Also flagged on the History card. |

- **$0 protected** (fully missed challenge): no Stripe refund is attempted, the
  challenge settles cleanly, and no refund-status note is shown.
- Double-settlement is impossible: settlement uses a Stripe idempotency key and
  a conditional status update — a concurrent second attempt gets 409.

---

## 5. Ending a challenge early (quit)

- "Quit Challenge" link on the detail screen (only while the challenge is
  running) → dialog with the exact math:
  - protected so far → minus **20% early-exit penalty** → net refund.
  - The dialog's numbers come from the client calc, which mirrors the server
    exactly (verified); the server still recomputes and is authoritative.
- Confirm → `quit-challenge`: partial Stripe refund of
  `protected − 20% penalty`, status `quit`, then the "Challenge Ended Early"
  summary: stake, missed check-ins, penalty, amount returned, refund status.
- Edge cases:
  - **Quit on day 1:** current window is in-flight → nothing missed → refund is
    80% of the full stake.
  - **Quit with $0 protected:** zero-refund path, settles cleanly, no refund note.
  - **Double-tap / two devices:** one succeeds, the other gets 409; exactly one
    Stripe refund (live-tested with truly concurrent requests).
- Quitting is irreversible and the dialog says so.

---

## 6. History (`(tabs)/history`)

- Lists completed **and** quit challenges (quit ones carry a "QUIT EARLY" tag).
- Each card: staked / returned / forfeited amounts; a red "Refund failed —
  contact support" line when applicable.
- Tapping opens the matching summary (completion or quit).
- Cancelled challenges (status exists in the DB, no flow produces it yet) would
  not appear anywhere.

---

## 7. Money-state reference

| Challenge status | How it got there | Money position |
|---|---|---|
| `active`, before end | Paid & created | Full stake held; protected portion shrinks only when windows are missed |
| `active`, after end | Ended, unclaimed | Frozen at final calc; waiting on the customer to claim (180-day Stripe clock ticking) |
| `completed` | Claimed | Protected refunded (see refund lifecycle); forfeited stays with platform → monthly charity batch |
| `quit` | Quit early | Protected × 80% refunded; forfeited + 20% penalty → charity batch |
| `cancelled` | *(no flow yet)* | — |

The $3 platform fee is kept in all outcomes. Charity donation is the
platform-donates model (Option A): no per-challenge payout, one monthly batch,
no money-transmitter exposure. See `docs/escrow-feasibility.md`.

---

## 8. Abuse / forgery surface (what a hostile "customer" can and can't do)

| Attempt | Outcome |
|---|---|
| Backfill yesterday's missed check-in via API | DB trigger overwrites `window_key` with server UTC now — lands in today's window |
| Pre-fill future windows | Same — impossible |
| Check in on someone else's challenge | Rejected (`challenge not found` under RLS) |
| Check in after challenge end / before start / on settled challenge | Rejected by trigger |
| Reuse one payment intent for two challenges | 409 (unique constraint) |
| Forge draft values at confirm time (stake mismatch, 400-day duration…) | 400 (server-side validation) |
| Complete before end date for a full refund (skipping quit penalty) | 400 |
| Concurrent double-quit for two refunds | One 200, one 409, one refund |
| Insert a `challenges` row directly without paying | ⚠️ **Currently possible** (RLS policy is FOR ALL). Not money-exploitable — settlement refunds the recorded payment intent, which is null/fake — but it creates garbage data. Fix: restrict policy to SELECT. |

---

## 9. Cross-cutting states

- **Offline / flaky network:** dashboard shows stale store data; check-ins roll
  back with an error toast; payment and settlement calls fail with alerts and
  can be retried (except the paid-but-unconfirmed gap in §2).
- **Deep links:** `challenge/[id]` routes are deep-linkable; back button falls
  back to the dashboard instead of crashing when there's no history.
- **Multiple active challenges:** fully supported; each card/nudge/reminder is
  independent, but the daily reminder collapses into one notification
  ("2 challenges close at 5 PM").
- **Demo mode** (`EXPO_PUBLIC_DEMO_MODE=true`, dev only): entire creation flow
  works with mock data and no credentials; Stripe and Supabase are bypassed;
  reminders are skipped.

## 10. Open gaps affecting customers (ranked)

1. **Sign-up with email confirmation enabled strands the user** (§1.2) — blocks
   real onboarding; fix before TestFlight.
2. **Double-charge on retry after pay-then-confirm failure** (§2) — rare but
   costs real money and requires manual Stripe cleanup.
3. **UTC boundary = early-evening deadline in the Americas** (§3.2) — honest in
   the UI now, but still a product-level surprise.
4. **180-day unclaimed refund expiry** (§4.1) — reminders mitigate; no
   server-side auto-settle yet.
5. **Unpaid challenge inserts via API** (§8) — data hygiene, not money.
