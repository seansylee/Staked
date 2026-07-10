// Server-side mirror of src/utils/dates.ts + src/utils/protection.ts.
// All period-boundary math is UTC-based so the client and this module produce
// identical numbers regardless of runtime timezone. Keep both in sync.

export type WindowType = 'daily' | 'weekly' | 'monthly';

export interface ChallengeCalc {
  stake_amount: number;
  duration_days: number;
  start_date: string;
  end_date: string;
  target_count: number;
  goal_window: WindowType;
}

export interface CheckInCalc {
  window_key: string;
}

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getWindowKey(date: Date, window: WindowType): string {
  if (window === 'daily') {
    return date.toISOString().slice(0, 10);
  }
  if (window === 'weekly') {
    // ISO 8601 week: Monday-based
    const d = utcMidnight(date);
    const dayNum = d.getUTCDay() || 7; // Sunday = 0 → 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum); // nearest Thursday
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }
  // monthly
  const m = date.getUTCMonth() + 1;
  return `${date.getUTCFullYear()}-${String(m).padStart(2, '0')}`;
}

function isoWeekMonday(date: Date): Date {
  const d = utcMidnight(date);
  const day = d.getUTCDay() || 7; // Sunday → 7
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d;
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function getElapsedWindowKeys(startDate: string, window: WindowType, referenceDate: Date): string[] {
  const start = new Date(startDate + 'T00:00:00Z');
  const keys: string[] = [];

  if (window === 'daily') {
    const cur = new Date(start);
    const today = utcMidnight(referenceDate);
    while (cur < today) {
      keys.push(getWindowKey(cur, 'daily'));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return keys;
  }

  if (window === 'weekly') {
    const startWeekMonday = isoWeekMonday(start);
    const refWeekMonday = isoWeekMonday(referenceDate);
    const cur = new Date(startWeekMonday);
    while (cur < refWeekMonday) {
      keys.push(getWindowKey(cur, 'weekly'));
      cur.setUTCDate(cur.getUTCDate() + 7);
    }
    return keys;
  }

  // monthly
  const cur = monthStart(start);
  const refMonth = monthStart(referenceDate);
  while (cur < refMonth) {
    keys.push(getWindowKey(cur, 'monthly'));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return keys;
}

function daysPerPeriod(window: WindowType): number {
  return window === 'daily' ? 1 : window === 'weekly' ? 7 : 30;
}

// First instant after the challenge's final day (end_date is inclusive)
export function challengeEndExclusive(endDate: string): number {
  return new Date(endDate + 'T00:00:00Z').getTime() + 86_400_000;
}

export function computeProtectionCents(
  challenge: ChallengeCalc,
  checkIns: CheckInCalc[],
  referenceDate: Date = new Date()
): { protectedCents: number; forfeitedCents: number } {
  const { stake_amount, duration_days, start_date, end_date, target_count, goal_window } = challenge;
  const dpv = stake_amount / duration_days;

  // Periods after the challenge end never count as missed — the payout must
  // not depend on how long after end_date the user settles.
  const endExclusive = challengeEndExclusive(end_date);
  const ref = referenceDate.getTime() > endExclusive ? new Date(endExclusive) : referenceDate;

  const countByKey: Record<string, number> = {};
  for (const ci of checkIns) {
    countByKey[ci.window_key] = (countByKey[ci.window_key] ?? 0) + 1;
  }

  // Only closed periods count — a completed in-flight period must not mask a
  // missed past one.
  const elapsedKeys = getElapsedWindowKeys(start_date, goal_window, ref);
  let completedPeriods = 0;
  for (const key of elapsedKeys) {
    if ((countByKey[key] ?? 0) >= target_count) completedPeriods++;
  }
  const missedPeriods = elapsedKeys.length - completedPeriods;
  const missedDays = Math.min(missedPeriods * daysPerPeriod(goal_window), duration_days);

  const forfeitedCents = Math.min(Math.round(missedDays * dpv), stake_amount);
  return { protectedCents: stake_amount - forfeitedCents, forfeitedCents };
}
