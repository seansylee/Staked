import { Challenge, CheckIn, Goal } from '@/types';

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
    stripe_payment_intent_id: 'pi_demo',
    stripe_refund_id: null,
    protected_amount_cents: null,
    forfeited_amount_cents: null,
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
    stripe_payment_intent_id: 'pi_demo2',
    stripe_refund_id: null,
    protected_amount_cents: null,
    forfeited_amount_cents: null,
    created_at: daysAgo(10),
  },
];

export const DEMO_GOALS: Goal[] = [
  { id: 'g1', challenge_id: 'c1', name: 'Gym', target_count: 3, window: 'weekly', created_at: daysAgo(28) },
  { id: 'g2', challenge_id: 'c1', name: 'Run', target_count: 2, window: 'weekly', created_at: daysAgo(28) },
  { id: 'g3', challenge_id: 'c2', name: 'Deep Work Session', target_count: 1, window: 'daily', created_at: daysAgo(10) },
];

// Simulate a mostly-good performance: gym 2/3 this week, run 2/2, deep work 1/1 today
const currentWeekKey = (() => {
  const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
})();
const todayKey = fmt(today);

export const DEMO_CHECK_INS: CheckIn[] = [
  // Gym: 2/3 this week
  { id: 'ci1', goal_id: 'g1', challenge_id: 'c1', user_id: 'demo-user', logged_at: today.toISOString(), window_key: currentWeekKey },
  { id: 'ci2', goal_id: 'g1', challenge_id: 'c1', user_id: 'demo-user', logged_at: today.toISOString(), window_key: currentWeekKey },
  // Run: 2/2 this week (complete)
  { id: 'ci3', goal_id: 'g2', challenge_id: 'c1', user_id: 'demo-user', logged_at: today.toISOString(), window_key: currentWeekKey },
  { id: 'ci4', goal_id: 'g2', challenge_id: 'c1', user_id: 'demo-user', logged_at: today.toISOString(), window_key: currentWeekKey },
  // Deep work: 1/1 today (complete)
  { id: 'ci5', goal_id: 'g3', challenge_id: 'c2', user_id: 'demo-user', logged_at: today.toISOString(), window_key: todayKey },
];
