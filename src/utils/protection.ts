import { Challenge, CheckIn, ProtectionSummary, Window } from '@/types';
import {
  countElapsedPeriods,
  daysRemaining,
  elapsedDays,
  getElapsedWindowKeys,
  getWindowKey,
  windowEndLabel,
} from './dates';

export interface GoalNudge {
  needed: number;
  deadline: string;
  atRiskCents: number;
}

export interface DashboardStatus {
  streak: number;
  isAtRisk: boolean;
  allCurrentComplete: boolean;
  emoji: string;
  statusText: string;
  nudge: GoalNudge | null;
}

export function computeDashboardStatus(
  challenge: Challenge,
  checkIns: CheckIn[],
  referenceDate: Date = new Date()
): DashboardStatus {
  const { goal_window, target_count } = challenge;

  const countByKey: Record<string, number> = {};
  for (const ci of checkIns) {
    countByKey[ci.window_key] = (countByKey[ci.window_key] ?? 0) + 1;
  }

  const currentKey = getWindowKey(referenceDate, goal_window);
  const currentCount = countByKey[currentKey] ?? 0;
  const allCurrentComplete = currentCount >= target_count;

  const pastKeys = getElapsedWindowKeys(challenge.start_date, goal_window, referenceDate);
  let streak = 0;
  for (let i = pastKeys.length - 1; i >= 0; i--) {
    if ((countByKey[pastKeys[i]] ?? 0) >= target_count) streak++;
    else break;
  }

  const isAtRisk = !allCurrentComplete && (() => {
    if (goal_window === 'daily') return referenceDate.getHours() >= 18;
    if (goal_window === 'weekly') {
      const day = referenceDate.getDay();
      return day === 0 || day >= 5;
    }
    const daysInMonth = new Date(
      referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0
    ).getDate();
    return daysInMonth - referenceDate.getDate() <= 3;
  })();

  const periodLabel = goal_window === 'daily' ? 'day' : goal_window === 'weekly' ? 'week' : 'month';

  let emoji: string;
  let statusText: string;

  if (isAtRisk) {
    emoji = '⚡';
    statusText = 'Finish strong';
  } else if (streak >= 4) {
    emoji = '🔥';
    statusText = `${streak} ${periodLabel} streak`;
  } else if (streak >= 2) {
    emoji = '💪';
    statusText = `${streak} ${periodLabel} streak`;
  } else if (allCurrentComplete) {
    emoji = '✅';
    statusText = 'All done';
  } else if (streak === 1) {
    emoji = '🎯';
    statusText = '1 streak going';
  } else {
    emoji = '💰';
    statusText = 'In progress';
  }

  const dpv = challenge.stake_amount / challenge.duration_days;
  const nudge: GoalNudge | null = !allCurrentComplete ? {
    needed: target_count - currentCount,
    deadline: windowEndLabel(goal_window, referenceDate),
    atRiskCents: Math.round(daysPerPeriod(goal_window) * dpv),
  } : null;

  return { streak, isAtRisk, allCurrentComplete, emoji, statusText, nudge };
}

function daysPerPeriod(window: Window): number {
  if (window === 'daily') return 1;
  if (window === 'weekly') return 7;
  return 30;
}

export function computeProtection(
  challenge: Challenge,
  checkIns: CheckIn[],
  referenceDate: Date = new Date()
): ProtectionSummary {
  const { goal_window, target_count, stake_amount, duration_days, start_date } = challenge;
  const dpv = stake_amount / duration_days;

  const countByKey: Record<string, number> = {};
  for (const ci of checkIns) {
    countByKey[ci.window_key] = (countByKey[ci.window_key] ?? 0) + 1;
  }

  const elapsed = countElapsedPeriods(start_date, goal_window, referenceDate);
  let completedPeriods = 0;
  for (const count of Object.values(countByKey)) {
    if (count >= target_count) completedPeriods++;
  }
  completedPeriods = Math.min(completedPeriods, elapsed);
  const missedPeriods = elapsed - completedPeriods;
  const missedDays = Math.min(missedPeriods * daysPerPeriod(goal_window), duration_days);

  const forfeitedCents = Math.min(Math.round(missedDays * dpv), stake_amount);
  const protectedCents = stake_amount - forfeitedCents;
  const elapsedD = elapsedDays(start_date, referenceDate);
  const completionPercent = Math.min(Math.round((elapsedD / duration_days) * 100), 100);

  return {
    originalStake: stake_amount,
    protectedFunds: protectedCents,
    fundsAtRisk: forfeitedCents,
    elapsedDays: Math.min(elapsedD, duration_days),
    totalDays: duration_days,
    completionPercent,
  };
}

export function computeGoalProgress(
  challenge: Challenge,
  checkIns: CheckIn[],
  referenceDate: Date = new Date()
): { currentCount: number; targetCount: number; windowLabel: string; isCompleted: boolean } {
  const { goal_window, target_count } = challenge;
  const currentKey = getWindowKey(referenceDate, goal_window);
  const currentCount = checkIns.filter((ci) => ci.window_key === currentKey).length;
  const windowLabel = goal_window === 'daily' ? 'Today' : goal_window === 'weekly' ? 'This Week' : 'This Month';
  return { currentCount, targetCount: target_count, windowLabel, isCompleted: currentCount >= target_count };
}

export function isChallengeComplete(challenge: Challenge): boolean {
  const today = new Date();
  const end = new Date(challenge.end_date + 'T23:59:59');
  return today > end && challenge.status === 'active';
}

export function daysRemainingForChallenge(challenge: Challenge): number {
  return daysRemaining(challenge.end_date);
}
