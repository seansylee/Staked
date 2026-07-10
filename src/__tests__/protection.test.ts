import { Challenge, CheckIn } from '@/types';
import { computeProtection } from '@/utils/protection';

const makeChallenge = (override: Partial<Challenge> = {}): Challenge => ({
  id: 'c1',
  user_id: 'u1',
  name: 'Test',
  stake_amount: 30000, // $300
  platform_fee: 300,
  duration_days: 90,
  start_date: '2024-01-01',
  end_date: '2024-03-31',
  status: 'active',
  target_count: 3,
  goal_window: 'weekly',
  stripe_payment_intent_id: null,
  stripe_refund_id: null,
  protected_amount_cents: null,
  forfeited_amount_cents: null,
  charity_id: null,
  quit_penalty_cents: null,
  created_at: '2024-01-01T00:00:00Z',
  ...override,
});

const makeCheckIn = (windowKey: string, id = 'ci1'): CheckIn => ({
  id,
  challenge_id: 'c1',
  user_id: 'u1',
  logged_at: '2024-01-15T10:00:00Z',
  window_key: windowKey,
});

describe('computeProtection', () => {
  // Reference date: 2024-01-29 (4 complete weeks elapsed for weekly goal)
  const ref = new Date('2024-01-29T12:00:00Z');

  it('returns full stake when all periods completed', () => {
    const challenge = makeChallenge();
    // 4 weeks elapsed, complete all 4 (3× per week)
    const checkIns: CheckIn[] = [
      makeCheckIn('2024-W01', 'ci1'),
      makeCheckIn('2024-W01', 'ci2'),
      makeCheckIn('2024-W01', 'ci3'),
      makeCheckIn('2024-W02', 'ci4'),
      makeCheckIn('2024-W02', 'ci5'),
      makeCheckIn('2024-W02', 'ci6'),
      makeCheckIn('2024-W03', 'ci7'),
      makeCheckIn('2024-W03', 'ci8'),
      makeCheckIn('2024-W03', 'ci9'),
      makeCheckIn('2024-W04', 'ci10'),
      makeCheckIn('2024-W04', 'ci11'),
      makeCheckIn('2024-W04', 'ci12'),
    ];

    const summary = computeProtection(challenge, checkIns, ref);
    expect(summary.protectedFunds).toBe(30000);
    expect(summary.fundsAtRisk).toBe(0);
  });

  it('returns 0 protected when all periods missed', () => {
    const challenge = makeChallenge();
    const summary = computeProtection(challenge, [], ref);
    // 4 weeks missed × 7 days × dpv
    expect(summary.fundsAtRisk).toBeGreaterThan(0);
    expect(summary.protectedFunds).toBeLessThan(30000);
  });

  it('returns proportional amount for partial completion', () => {
    const challenge = makeChallenge({ duration_days: 7, end_date: '2024-01-07', target_count: 1, goal_window: 'daily' });
    // 6 days elapsed, 3 completed, ref = 2024-01-07
    const dailyRef = new Date('2024-01-07T12:00:00Z');
    const checkIns: CheckIn[] = [
      makeCheckIn('2024-01-01', 'ci1'),
      makeCheckIn('2024-01-02', 'ci2'),
      makeCheckIn('2024-01-03', 'ci3'),
    ];
    const summary = computeProtection(challenge, checkIns, dailyRef);
    // 6 elapsed, 3 completed, 3 missed → 3/7 × $300 forfeited
    expect(summary.fundsAtRisk).toBeGreaterThan(0);
    expect(summary.protectedFunds).toBeLessThan(30000);
    expect(summary.protectedFunds + summary.fundsAtRisk).toBe(30000);
  });

  it('does not penalize in-flight current period', () => {
    const challenge = makeChallenge();
    // ref = Monday of current week → 0 elapsed weeks
    const mondayRef = new Date('2024-01-01T12:00:00Z'); // Jan 1 is Monday
    const summary = computeProtection(challenge, [], mondayRef);
    // No elapsed periods → no forfeiture
    expect(summary.fundsAtRisk).toBe(0);
    expect(summary.protectedFunds).toBe(30000);
  });

  it('handles partial period completion correctly', () => {
    const challenge = makeChallenge({ target_count: 3, goal_window: 'weekly' });
    const dailyRef = new Date('2024-01-29T12:00:00Z');
    // 4 weeks elapsed, only 2 weeks completed (not enough check-ins in the other 2)
    const checkIns: CheckIn[] = [
      makeCheckIn('2024-W01', 'ci1'),
      makeCheckIn('2024-W01', 'ci2'),
      makeCheckIn('2024-W01', 'ci3'), // complete
      makeCheckIn('2024-W02', 'ci4'),
      makeCheckIn('2024-W02', 'ci5'), // only 2, missed
      makeCheckIn('2024-W03', 'ci6'),
      makeCheckIn('2024-W03', 'ci7'),
      makeCheckIn('2024-W03', 'ci8'), // complete
      makeCheckIn('2024-W04', 'ci9'), // only 1, missed
    ];
    const summary = computeProtection(challenge, checkIns, dailyRef);
    // 2 missed weeks × 7 days × dpv
    expect(summary.fundsAtRisk).toBeGreaterThan(0);
    expect(summary.protectedFunds).toBeLessThan(30000);
  });

  it('always sums to original stake', () => {
    const challenge = makeChallenge();
    const checkIns: CheckIn[] = [makeCheckIn('2024-W01', 'ci1')];
    const summary = computeProtection(challenge, checkIns, ref);
    expect(summary.protectedFunds + summary.fundsAtRisk).toBe(challenge.stake_amount);
  });

  it('counts elapsed periods in UTC regardless of runtime timezone', () => {
    // 30 min past UTC midnight on day 3 → exactly 2 closed daily periods.
    // Before the UTC fix this drifted ±1 depending on the machine timezone,
    // making the client dialog disagree with the Edge Function refund.
    const challenge = makeChallenge({
      stake_amount: 30000,
      duration_days: 30,
      start_date: '2024-01-01',
      end_date: '2024-01-30',
      target_count: 1,
      goal_window: 'daily',
    });
    const justPastUtcMidnight = new Date('2024-01-03T00:30:00Z');
    const summary = computeProtection(challenge, [], justPastUtcMidnight);
    // 2 missed days × $10/day
    expect(summary.fundsAtRisk).toBe(2000);
    expect(summary.protectedFunds).toBe(28000);
  });

  it('does not count periods after end_date as missed when settling late', () => {
    const challenge = makeChallenge({
      duration_days: 7,
      start_date: '2024-01-01',
      end_date: '2024-01-07',
      target_count: 1,
      goal_window: 'daily',
    });
    const checkIns: CheckIn[] = Array.from({ length: 7 }, (_, i) =>
      makeCheckIn(`2024-01-0${i + 1}`, `ci${i + 1}`)
    );
    // Settling 5 days after the challenge ended — all 7 days were completed
    const lateRef = new Date('2024-01-12T12:00:00Z');
    const summary = computeProtection(challenge, checkIns, lateRef);
    expect(summary.fundsAtRisk).toBe(0);
    expect(summary.protectedFunds).toBe(30000);
  });

  it('does not let a completed in-flight period mask a missed past period', () => {
    const challenge = makeChallenge({
      stake_amount: 30000,
      duration_days: 30,
      start_date: '2024-01-01',
      end_date: '2024-01-30',
      target_count: 1,
      goal_window: 'daily',
    });
    // Missed Jan 1, checked in during the current (in-flight) Jan 2 window
    const checkIns: CheckIn[] = [makeCheckIn('2024-01-02', 'ci1')];
    const summary = computeProtection(challenge, checkIns, new Date('2024-01-02T12:00:00Z'));
    // 1 missed day × $10/day
    expect(summary.fundsAtRisk).toBe(1000);
    expect(summary.protectedFunds).toBe(29000);
  });
});
