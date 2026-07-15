import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { ChallengeDraft, CompletionSummary, QuitSummary } from '@/types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// functions.invoke wraps non-2xx responses in a FunctionsHttpError whose
// .message is just "Edge Function returned a non-2xx status code" — the real
// reason (e.g. "Payment not completed", 409 conflicts) is in the response
// body. Unwrap it so alerts show something actionable and callers can branch
// on status.
async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response;
      let message = `Request failed (${res.status})`;
      try {
        const text = await res.text();
        if (text) {
          try {
            const json = JSON.parse(text);
            message = json.error ?? json.message ?? text;
          } catch {
            message = text;
          }
        }
      } catch {
        // keep the default message
      }
      throw new ApiError(message, res.status);
    }
    throw error;
  }
  return data as T;
}

export interface PaymentIntentHandle {
  paymentIntentId: string;
  clientSecret: string;
}

export async function createPaymentIntent(amountCents: number): Promise<PaymentIntentHandle> {
  const data = await invoke<{ client_secret: string }>('create-payment-intent', {
    amount_cents: amountCents,
  });
  return {
    clientSecret: data.client_secret,
    paymentIntentId: data.client_secret.split('_secret_')[0],
  };
}

export async function confirmChallengeStart(
  paymentIntentId: string,
  draft: ChallengeDraft
): Promise<string> {
  const data = await invoke<{ challenge_id: string }>('confirm-challenge-start', {
    payment_intent_id: paymentIntentId,
    challenge: draft,
  });
  return data.challenge_id;
}

export async function completeChallenge(challengeId: string): Promise<CompletionSummary> {
  return invoke<CompletionSummary>('complete-challenge', { challenge_id: challengeId });
}

export async function quitChallenge(challengeId: string): Promise<QuitSummary> {
  return invoke<QuitSummary>('quit-challenge', { challenge_id: challengeId });
}
