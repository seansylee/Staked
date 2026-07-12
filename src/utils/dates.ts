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

// The check-in window closes at UTC midnight, not local midnight — that is
// where the money math flips a period to "missed". The helpers below expose
// that real boundary, rendered in the user's local time (e.g. "5 PM" in PT),
// so deadline labels never promise more time than the user actually has.

export function nextWindowBoundary(window: Window, referenceDate: Date = new Date()): Date {
  if (window === 'daily') {
    const d = utcMidnight(referenceDate);
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
  if (window === 'weekly') {
    const d = isoWeekMonday(referenceDate);
    d.setUTCDate(d.getUTCDate() + 7);
    return d;
  }
  const d = monthStart(referenceDate);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export function hoursUntilWindowEnd(window: Window, referenceDate: Date = new Date()): number {
  return (nextWindowBoundary(window, referenceDate).getTime() - referenceDate.getTime()) / 3_600_000;
}

export function daysUntilWindowEnd(window: Window, referenceDate: Date = new Date()): number {
  return Math.floor(hoursUntilWindowEnd(window, referenceDate) / 24);
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function localTimeLabel(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return 'midnight';
  const suffix = h < 12 ? 'AM' : 'PM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hr} ${suffix}` : `${hr}:${String(m).padStart(2, '0')} ${suffix}`;
}

// Phrases are composed after "by" in nudges: "by 5 PM", "by 9 AM tomorrow",
// "by Sun 5 PM", "by Jun 30".
export function windowEndLabel(window: Window, referenceDate: Date = new Date()): string {
  const boundary = nextWindowBoundary(window, referenceDate);
  const lastMoment = new Date(boundary.getTime() - 1);
  const time = localTimeLabel(boundary);
  const msLeft = boundary.getTime() - referenceDate.getTime();
  const sameLocalDay =
    lastMoment.getDate() === referenceDate.getDate() &&
    lastMoment.getMonth() === referenceDate.getMonth() &&
    lastMoment.getFullYear() === referenceDate.getFullYear();

  if (msLeft <= 26 * 3_600_000) {
    return sameLocalDay ? time : `${time} tomorrow`;
  }
  if (msLeft <= 7 * 86_400_000) {
    return `${DAY_NAMES[lastMoment.getDay()]} ${time}`;
  }
  return `${MONTH_NAMES[lastMoment.getMonth()]} ${lastMoment.getDate()}`;
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
