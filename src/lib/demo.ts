import { Challenge, CheckIn } from '@/types';

export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

const today = new Date();
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => fmt(new Date(today.getTime() - n * 86_400_000));
const daysFromNow = (n: number) => fmt(new Date(today.getTime() + n * 86_400_000));

export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@staked.app',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: daysAgo(30),
};

export const DEMO_CHALLENGES: Challenge[] = [
  {
    id: 'c1',
    user_id: 'demo-user',
    name: 'Summer Fitness',
    stake_amount: 30000,
    platform_fee: 300,
    duration_days: 90,
    start_date: daysAgo(28),
    end_date: daysFromNow(62),
    status: 'active',
    target_count: 3,
    goal_window: 'weekly',
    stripe_payment_intent_id: 'pi_demo',
    stripe_refund_id: null,
    protected_amount_cents: null,
    forfeited_amount_cents: null,
    charity_id: 'clean-water',
    quit_penalty_cents: null,
    refund_status: null,
    created_at: daysAgo(28),
  },
  {
    id: 'c2',
    user_id: 'demo-user',
    name: 'Deep Work Streak',
    stake_amount: 10000,
    platform_fee: 300,
    duration_days: 30,
    start_date: daysAgo(10),
    end_date: daysFromNow(20),
    status: 'active',
    target_count: 1,
    goal_window: 'daily',
    stripe_payment_intent_id: 'pi_demo2',
    stripe_refund_id: null,
    protected_amount_cents: null,
    forfeited_amount_cents: null,
    charity_id: 'food-bank',
    quit_penalty_cents: null,
    refund_status: null,
    created_at: daysAgo(10),
  },
];

function isoWeekKey(d: Date): string {
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
function weekAgo(n: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() - n * 7);
  return isoWeekKey(d);
}
function dayAgo(n: number): string {
  return fmt(new Date(today.getTime() - n * 86_400_000));
}

const w0 = isoWeekKey(today);
const w1 = weekAgo(1);
const w2 = weekAgo(2);
const w3 = weekAgo(3);
const todayKey = fmt(today);

let ciId = 0;
const ci = (challengeId: string, windowKey: string): CheckIn => ({
  id: `ci${++ciId}`,
  challenge_id: challengeId,
  user_id: 'demo-user',
  logged_at: today.toISOString(),
  window_key: windowKey,
});

export const DEMO_CHECK_INS: CheckIn[] = [
  // Summer Fitness — 3× per week, 3 past perfect weeks, current week 2/3
  ci('c1', w3), ci('c1', w3), ci('c1', w3),
  ci('c1', w2), ci('c1', w2), ci('c1', w2),
  ci('c1', w1), ci('c1', w1), ci('c1', w1),
  ci('c1', w0), ci('c1', w0),

  // Deep Work — 1× per day, 5 past days complete, today done
  ci('c2', dayAgo(5)),
  ci('c2', dayAgo(4)),
  ci('c2', dayAgo(3)),
  ci('c2', dayAgo(2)),
  ci('c2', dayAgo(1)),
  ci('c2', todayKey),
];
