import { Window } from '@/types';

export function getWindowKey(date: Date, window: Window): string {
  if (window === 'daily') {
    return date.toISOString().slice(0, 10);
  }
  if (window === 'weekly') {
    // ISO 8601 week: Monday-based
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7; // Sunday = 0 → 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum); // nearest Thursday
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }
  // monthly
  const m = date.getMonth() + 1;
  return `${date.getFullYear()}-${String(m).padStart(2, '0')}`;
}

// Returns the Monday of the ISO week containing `date`
function isoWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay() || 7; // Sunday → 7
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Returns start of month
function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Count how many complete periods have elapsed since `startDate`.
 * The current in-flight period is NOT counted — only closed periods.
 */
export function countElapsedPeriods(
  startDate: string,
  window: Window,
  referenceDate: Date = new Date()
): number {
  const start = new Date(startDate + 'T00:00:00');

  if (window === 'daily') {
    const msPerDay = 86_400_000;
    const elapsed = Math.floor((referenceDate.getTime() - start.getTime()) / msPerDay);
    return Math.max(0, elapsed);
  }

  if (window === 'weekly') {
    const startWeekMonday = isoWeekMonday(start);
    const refWeekMonday = isoWeekMonday(referenceDate);
    const msPerWeek = 7 * 86_400_000;
    const weeks = Math.floor(
      (refWeekMonday.getTime() - startWeekMonday.getTime()) / msPerWeek
    );
    return Math.max(0, weeks);
  }

  // monthly
  const startMonth = monthStart(start);
  const refMonth = monthStart(referenceDate);
  const months =
    (refMonth.getFullYear() - startMonth.getFullYear()) * 12 +
    (refMonth.getMonth() - startMonth.getMonth());
  return Math.max(0, months);
}

/**
 * Return all elapsed window keys from `startDate` up to (but not including)
 * the current in-flight period.
 */
export function getElapsedWindowKeys(
  startDate: string,
  window: Window,
  referenceDate: Date = new Date()
): string[] {
  const start = new Date(startDate + 'T00:00:00');
  const keys: string[] = [];

  if (window === 'daily') {
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    const today = new Date(referenceDate);
    today.setHours(0, 0, 0, 0);
    while (cur < today) {
      keys.push(getWindowKey(cur, 'daily'));
      cur.setDate(cur.getDate() + 1);
    }
    return keys;
  }

  if (window === 'weekly') {
    const startWeekMonday = isoWeekMonday(start);
    const refWeekMonday = isoWeekMonday(referenceDate);
    const cur = new Date(startWeekMonday);
    while (cur < refWeekMonday) {
      keys.push(getWindowKey(cur, 'weekly'));
      cur.setDate(cur.getDate() + 7);
    }
    return keys;
  }

  // monthly
  const cur = monthStart(start);
  const refMonth = monthStart(referenceDate);
  while (cur < refMonth) {
    keys.push(getWindowKey(cur, 'monthly'));
    cur.setMonth(cur.getMonth() + 1);
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

export function daysRemaining(endDate: string, referenceDate: Date = new Date()): number {
  const end = new Date(endDate + 'T23:59:59');
  const diff = end.getTime() - referenceDate.getTime();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export function elapsedDays(startDate: string, referenceDate: Date = new Date()): number {
  const start = new Date(startDate + 'T00:00:00');
  const diff = referenceDate.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}
