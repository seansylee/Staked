import { Window } from '@/types';

// All period-boundary math is UTC-based so this file and its server-side
// mirror (supabase/functions/_shared/protection.ts) produce identical numbers
// regardless of runtime timezone. Keep both in sync.

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function getWindowKey(date: Date, window: Window): string {
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

// Returns the UTC-midnight Monday of the ISO week containing `date`
function isoWeekMonday(date: Date): Date {
  const d = utcMidnight(date);
  const day = d.getUTCDay() || 7; // Sunday → 7
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d;
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Return all elapsed window keys from `startDate` up to (but not including)
 * the current in-flight period. The current period is never counted — only
 * closed periods.
 */
export function getElapsedWindowKeys(
  startDate: string,
  window: Window,
  referenceDate: Date = new Date()
): string[] {
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

export function daysUntilWindowEnd(window: Window, referenceDate: Date = new Date()): number {
  if (window === 'daily') {
    const midnight = new Date(referenceDate);
    midnight.setHours(23, 59, 59, 999);
    return Math.ceil((midnight.getTime() - referenceDate.getTime()) / 3_600_000) / 24;
  }
  if (window === 'weekly') {
    // ISO week ends Sunday
    const day = referenceDate.getDay(); // 0=Sun
    const daysLeft = day === 0 ? 0 : 7 - day;
    return daysLeft;
  }
  // monthly
  const lastDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  return lastDay.getDate() - referenceDate.getDate();
}

export function windowEndLabel(window: Window, referenceDate: Date = new Date()): string {
  if (window === 'daily') return 'tonight';
  if (window === 'weekly') {
    const days = daysUntilWindowEnd('weekly', referenceDate);
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const endDay = new Date(referenceDate);
    endDay.setDate(endDay.getDate() + days);
    return `by ${names[endDay.getDay()]}`;
  }
  const lastDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  const daysLeft = lastDay.getDate() - referenceDate.getDate();
  return `${daysLeft}d left in month`;
}

// First instant after the challenge's final day (end_date is inclusive)
export function challengeEndExclusive(endDate: string): number {
  return new Date(endDate + 'T00:00:00Z').getTime() + 86_400_000;
}

export function daysRemaining(endDate: string, referenceDate: Date = new Date()): number {
  const diff = challengeEndExclusive(endDate) - referenceDate.getTime();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export function elapsedDays(startDate: string, referenceDate: Date = new Date()): number {
  const start = new Date(startDate + 'T00:00:00Z');
  const diff = referenceDate.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}
