export type Window = 'daily' | 'weekly' | 'monthly';

export type ChallengeStatus = 'active' | 'completed' | 'cancelled' | 'quit';

export type RefundStatus = 'pending' | 'succeeded' | 'failed';

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
  target_count: number;
  goal_window: Window;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  protected_amount_cents: number | null;
  forfeited_amount_cents: number | null;
  charity_id: string | null;
  quit_penalty_cents: number | null;
  refund_status: RefundStatus | null;
  created_at: string;
}

export interface CheckIn {
  id: string;
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

export interface ChallengeDraft {
  name: string;
  stake_amount_cents: number;
  duration_days: number;
  target_count: number;
  goal_window: Window;
  charity_id: string | null;
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
  protectedCents: number;
  forfeitedCents: number;
}

export interface QuitSummary {
  challenge: Challenge;
  refundCents: number;
  penaltyCents: number;
  forfeitedCents: number;
}
