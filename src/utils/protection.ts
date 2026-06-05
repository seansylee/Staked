import { Challenge, CheckIn, Goal, GoalProgress, ProtectionSummary, Window } from '@/types';
import {
  countElapsedPeriods,
  daysRemaining,
  elapsedDays,
  getElapsedWindowKeys,
  getWindowKey,
  windowEndLabel,
} from './dates';

export interface GoalNudge {
  goalName: string;
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
  nudges: GoalNudge[];
}

export function computeDashboardStatus(
  challenge: Challenge,
  goals: Goal[],
  checkIns: CheckIn[],
  referenceDate: Date = new Date()
): DashboardStatus {
  const checkInMap: Record<string, Record<string, number>> = {};
  for (const ci of checkIns) {
    if (!checkInMap[ci.goal_id]) checkInMap[ci.goal_id] = {};
    checkInMap[ci.goal_id][ci.window_key] = (checkInMap[ci.goal_id][ci.window_key] ?? 0) + 1;
  }

  const isGoalComplete = (goal: Goal, key: string) =>
    (checkInMap[goal.id]?.[key] ?? 0) >= goal.target_count;

  const allCurrentComplete = goals.every(g =>
    isGoalComplete(g, getWindowKey(referenceDate, g.goal_window))
  );

  // Streak: consecutive past closed periods where all goals were met.
  // Use the coarsest window present as the period unit.
  const primaryWindow: Window = goals.some(g => g.goal_window === 'monthly')
    ? 'monthly' : goals.some(g => g.goal_window === 'weekly')
    ? 'weekly' : 'daily';

  const pastKeys = getElapsedWindowKeys(challenge.start_date, primaryWindow, referenceDate);
  let streak = 0;
  for (let i = pastKeys.length - 1; i >= 0; i--) {
    const periodKey = pastKeys[i];
    const allDone = goals.every(g => isGoalComplete(g, periodKey));
    if (allDone) streak++;
    else break;
  }

  // Upcoming risk: any incomplete goal whose current period ends soon
  const isAtRisk = !allCurrentComplete && goals.some(goal => {
    const key = getWindowKey(referenceDate, goal.goal_window);
    if (isGoalComplete(goal, key)) return false;
    if (goal.goal_window === 'daily') return referenceDate.getHours() >= 18;
    if (goal.goal_window === 'weekly') {
      const day = referenceDate.getDay(); // 0=Sun, 5=Fri, 6=Sat
      return day === 0 || day >= 5;
    }
    if (goal.goal_window === 'monthly') {
      const daysInMonth = new Date(
        referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0
      ).getDate();
      return daysInMonth - referenceDate.getDate() <= 3;
    }
    return false;
  });

  let emoji: string;
  let statusText: string;

  if (isAtRisk) {
    emoji = '⚡';
    statusText = 'Finish strong';
  } else if (streak >= 4) {
    emoji = '🔥';
    statusText = `${streak} ${primaryWindow === 'daily' ? 'day' : primaryWindow === 'weekly' ? 'week' : 'month'} streak`;
  } else if (streak >= 2) {
    emoji = '💪';
    statusText = `${streak} ${primaryWindow === 'daily' ? 'day' : primaryWindow === 'weekly' ? 'week' : 'month'} streak`;
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
  const nudges: GoalNudge[] = goals
    .filter(g => !isGoalComplete(g, getWindowKey(referenceDate, g.goal_window)))
    .map(g => {
      const key = getWindowKey(referenceDate, g.goal_window);
      const done = checkInMap[g.id]?.[key] ?? 0;
      const needed = g.target_count - done;
      const atRiskCents = Math.round(daysPerPeriod(g.goal_window) * dpv / goals.length);
      return {
        goalName: g.name,
        needed,
        deadline: windowEndLabel(g.goal_window, referenceDate),
        atRiskCents,
      };
    });

  return { streak, isAtRisk, allCurrentComplete, emoji, statusText, nudges };
}

interface GoalPeriodSummary {
  goalId: string;
  totalElapsedPeriods: number;
  completedPeriods: number;
  missedPeriods: number;
}

function daysPerPeriod(window: Window): number {
  if (window === 'daily') return 1;
  if (window === 'weekly') return 7;
  return 30;
}

function computeGoalPeriodSummary(
  goal: Goal,
  checkInCountByWindowKey: Record<string, number>,
  elapsedPeriods: number
): GoalPeriodSummary {
  let completedPeriods = 0;
  for (const count of Object.values(checkInCountByWindowKey)) {
    if (count >= goal.target_count) completedPeriods++;
  }
  // completedPeriods can't exceed elapsed periods (guard against extra keys)
  completedPeriods = Math.min(completedPeriods, elapsedPeriods);
  return {
    goalId: goal.id,
    totalElapsedPeriods: elapsedPeriods,
    completedPeriods,
    missedPeriods: elapsedPeriods - completedPeriods,
  };
}

export function computeProtection(
  challenge: Challenge,
  goals: Goal[],
  checkIns: CheckIn[],
  referenceDate: Date = new Date()
): ProtectionSummary {
  const stake = challenge.stake_amount;
  const dpv = stake / challenge.duration_days; // daily protection value in cents

  // Group check-ins by goal_id → window_key → count
  const checkInMap: Record<string, Record<string, number>> = {};
  for (const ci of checkIns) {
    if (!checkInMap[ci.goal_id]) checkInMap[ci.goal_id] = {};
    const key = ci.window_key;
    checkInMap[ci.goal_id][key] = (checkInMap[ci.goal_id][key] ?? 0) + 1;
  }

  let totalMissedDayEquivalents = 0;

  for (const goal of goals) {
    const elapsed = countElapsedPeriods(challenge.start_date, goal.goal_window, referenceDate);
    const summary = computeGoalPeriodSummary(
      goal,
      checkInMap[goal.id] ?? {},
      elapsed
    );
    const missedDays = Math.min(
      summary.missedPeriods * daysPerPeriod(goal.goal_window),
      challenge.duration_days
    );
    // Each goal contributes an equal share of the stake
    totalMissedDayEquivalents += missedDays / (goals.length || 1);
  }

  const forfeitedCents = Math.min(Math.round(totalMissedDayEquivalents * dpv), stake);
  const protectedCents = stake - forfeitedCents;
  const elapsed = elapsedDays(challenge.start_date, referenceDate);
  const completionPercent = Math.min(
    Math.round((elapsed / challenge.duration_days) * 100),
    100
  );

  return {
    originalStake: stake,
    protectedFunds: protectedCents,
    fundsAtRisk: forfeitedCents,
    elapsedDays: Math.min(elapsed, challenge.duration_days),
    totalDays: challenge.duration_days,
    completionPercent,
  };
}

export function computeGoalProgress(
  goal: Goal,
  checkIns: CheckIn[],
  referenceDate: Date = new Date()
): GoalProgress {
  const currentKey = getWindowKey(referenceDate, goal.goal_window);
  const currentCount = checkIns.filter(
    (ci) => ci.goal_id === goal.id && ci.window_key === currentKey
  ).length;

  const windowLabel =
    goal.goal_window === 'daily' ? 'Today' : goal.goal_window === 'weekly' ? 'This Week' : 'This Month';

  return {
    goal,
    currentCount,
    targetCount: goal.target_count,
    windowLabel,
    isCompleted: currentCount >= goal.target_count,
  };
}

export function isChallengeComplete(challenge: Challenge): boolean {
  const today = new Date();
  const end = new Date(challenge.end_date + 'T23:59:59');
  return today > end && challenge.status === 'active';
}

export function daysRemainingForChallenge(challenge: Challenge): number {
  return daysRemaining(challenge.end_date);
}
