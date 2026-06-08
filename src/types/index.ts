export type Window = 'daily' | 'weekly' | 'monthly';

export type ChallengeStatus = 'active' | 'completed' | 'cancelled';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  stripe_customer_id: string | null;
  push_token: string | null;
  created_at: string;
}

export interface Challenge {
  id: string;
  user_id: string;
  name: string;
  stake_amount: number; // cents
  platform_fee: number; // cents
  duration_days: number;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  status: ChallengeStatus;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  protected_amount_cents: number | null;
  forfeited_amount_cents: number | null;
  charity_id: string | null;
  created_at: string;
}

export interface Goal {
  id: string;
  challenge_id: string;
  name: string;
  target_count: number;
  goal_window: Window;
  created_at: string;
}

export interface CheckIn {
  id: string;
  goal_id: string;
  challenge_id: string;
  user_id: string;
  logged_at: string;
  window_key: string;
}

export interface Payment {
  id: string;
  challenge_id: string;
  user_id: string;
  type: 'deposit' | 'refund' | 'fee';
  amount_cents: number;
  stripe_id: string;
  status: 'pending' | 'succeeded' | 'failed';
  created_at: string;
}

// UI / computation types

export interface GoalDraft {
  name: string;
  target_count: number;
  goal_window: Window;
}

export interface ChallengeDraft {
  name: string;
  stake_amount_cents: number;
  duration_days: number;
  goals: GoalDraft[];
  charity_id: string | null;
}

export interface GoalProgress {
  goal: Goal;
  currentCount: number;
  targetCount: number;
  windowLabel: string;
  isCompleted: boolean;
}

export interface ProtectionSummary {
  originalStake: number; // cents
  protectedFunds: number; // cents
  fundsAtRisk: number; // cents
  elapsedDays: number;
  totalDays: number;
  completionPercent: number; // 0–100
}

export interface CompletionSummary {
  challenge: Challenge;
  originalStake: number; // cents
  protectedFunds: number; // cents
  forfeitedFunds: number; // cents
  goalBreakdown: { goal: Goal; completedPeriods: number; totalPeriods: number }[];
}
