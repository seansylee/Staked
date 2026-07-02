import { supabase } from '@/lib/supabase';
import { ChallengeDraft, CompletionSummary, QuitSummary } from '@/types';

export async function createPaymentIntent(amountCents: number): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    body: { amount_cents: amountCents },
  });
  if (error) throw error;
  return data.client_secret as string;
}

export async function confirmChallengeStart(
  paymentIntentId: string,
  draft: ChallengeDraft
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('confirm-challenge-start', {
    body: { payment_intent_id: paymentIntentId, challenge: draft },
  });
  if (error) throw error;
  return data.challenge_id as string;
}

export async function completeChallenge(challengeId: string): Promise<CompletionSummary> {
  const { data, error } = await supabase.functions.invoke('complete-challenge', {
    body: { challenge_id: challengeId },
  });
  if (error) throw error;
  return data as CompletionSummary;
}

export async function quitChallenge(challengeId: string): Promise<QuitSummary> {
  const { data, error } = await supabase.functions.invoke('quit-challenge', {
    body: { challenge_id: challengeId },
  });
  if (error) throw error;
  return data as QuitSummary;
}
