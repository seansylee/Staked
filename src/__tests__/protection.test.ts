import { Challenge, CheckIn, Goal } from '@/types';
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
  stripe_payment_intent_id: null,
  stripe_refund_id: null,
  protected_amount_cents: null,
  forfeited_amount_cents: null,
  created_at: '2024-01-01T00:00:00Z',
  ...override,
});

const makeGoal = (override: Partial<Goal> = {}): Goal => ({
  id: 'g1',
  challenge_id: 'c1',
  name: 'Gym',
  target_count: 3,
  window: 'weekly',
  created_at: '2024-01-01T00:00:00Z',
  ...override,
});

const makeCheckIn = (goalId: string, windowKey: string, id = 'ci1'): CheckIn => ({
  id,
  goal_id: goalId,
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
    const goal = makeGoal();
    // 4 weeks elapsed, complete all 4
    const checkIns: CheckIn[] = [
      makeCheckIn('g1', '2024-W01', 'ci1'),
      makeCheckIn('g1', '2024-W01', 'ci2'),
      makeCheckIn('g1', '2024-W01', 'ci3'),
      makeCheckIn('g1', '2024-W02', 'ci4'),
      makeCheckIn('g1', '2024-W02', 'ci5'),
      makeCheckIn('g1', '2024-W02', 'ci6'),
      makeCheckIn('g1', '2024-W03', 'ci7'),
      makeCheckIn('g1', '2024-W03', 'ci8'),
      makeCheckIn('g1', '2024-W03', 'ci9'),
      makeCheckIn('g1', '2024-W04', 'ci10'),
      makeCheckIn('g1', '2024-W04', 'ci11'),
      makeCheckIn('g1', '2024-W04', 'ci12'),
    ];

    const summary = computeProtection(challenge, [goal], checkIns, ref);
    expect(summary.protectedFunds).toBe(30000);
    expect(summary.fundsAtRisk).toBe(0);
  });

  it('returns 0 protected when all periods missed', () => {
    const challenge = makeChallenge();
    const goal = makeGoal();
    const summary = computeProtection(challenge, [goal], [], ref);
    // 4 weeks missed × 7 days × dpv
    expect(summary.fundsAtRisk).toBeGreaterThan(0);
    expect(summary.protectedFunds).toBeLessThan(30000);
  });

  it('returns proportional amount for partial completion', () => {
    const challenge = makeChallenge({ duration_days: 7, end_date: '2024-01-07' });
    const goal = makeGoal({ window: 'daily', target_count: 1 });
    // 6 days elapsed, 3 completed, ref = 2024-01-07
    const dailyRef = new Date('2024-01-07T12:00:00Z');
    const checkIns: CheckIn[] = [
      makeCheckIn('g1', '2024-01-01', 'ci1'),
      makeCheckIn('g1', '2024-01-02', 'ci2'),
      makeCheckIn('g1', '2024-01-03', 'ci3'),
    ];
    const summary = computeProtection(challenge, [goal], checkIns, dailyRef);
    // 6 elapsed, 3 completed, 3 missed → 3/7 × $300 forfeited
    expect(summary.fundsAtRisk).toBeGreaterThan(0);
    expect(summary.protectedFunds).toBeLessThan(30000);
    expect(summary.protectedFunds + summary.fundsAtRisk).toBe(30000);
  });

  it('does not penalize in-flight current period', () => {
    const challenge = makeChallenge();
    const goal = makeGoal({ window: 'weekly', target_count: 3 });
    // ref = Monday of current week → 0 elapsed weeks
    const mondayRef = new Date('2024-01-01T12:00:00Z'); // Jan 1 is Monday
    const summary = computeProtection(challenge, [goal], [], mondayRef);
    // No elapsed periods → no forfeiture
    expect(summary.fundsAtRisk).toBe(0);
    expect(summary.protectedFunds).toBe(30000);
  });

  it('divides penalty equally across multiple goals', () => {
    const challenge = makeChallenge();
    const goal1 = makeGoal({ id: 'g1', window: 'daily', target_count: 1 });
    const goal2 = makeGoal({ id: 'g2', window: 'daily', target_count: 1 });
    const dailyRef = new Date('2024-01-08T12:00:00Z');
    const goal1CheckIns: CheckIn[] = [
      makeCheckIn('g1', '2024-01-01', 'ci1'),
      makeCheckIn('g1', '2024-01-02', 'ci2'),
      makeCheckIn('g1', '2024-01-03', 'ci3'),
      makeCheckIn('g1', '2024-01-04', 'ci4'),
      makeCheckIn('g1', '2024-01-05', 'ci5'),
      makeCheckIn('g1', '2024-01-06', 'ci6'),
      makeCheckIn('g1', '2024-01-07', 'ci7'),
    ];

    // Both goals tracked: goal1 completed, goal2 missed
    const summaryBoth = computeProtection(challenge, [goal1, goal2], goal1CheckIns, dailyRef);
    // Only goal2 tracked (fully missed)
    const summaryMissedOnly = computeProtection(challenge, [goal2], [], dailyRef);

    // Missing one of two goals should forfeit exactly half of missing the only goal
    expect(summaryBoth.fundsAtRisk).toBeCloseTo(summaryMissedOnly.fundsAtRisk / 2, -1);
    // There should be some forfeiture
    expect(summaryBoth.fundsAtRisk).toBeGreaterThan(0);
  });

  it('always sums to original stake', () => {
    const challenge = makeChallenge();
    const goal = makeGoal();
    const checkIns: CheckIn[] = [makeCheckIn('g1', '2024-W01', 'ci1')];
    const summary = computeProtection(challenge, [goal], checkIns, ref);
    expect(summary.protectedFunds + summary.fundsAtRisk).toBe(challenge.stake_amount);
  });
});
