import Stripe from 'https://esm.sh/stripe@14';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
});

type WindowType = 'daily' | 'weekly' | 'monthly';

function getWindowKey(date: Date, window: WindowType): string {
  if (window === 'daily') return date.toISOString().slice(0, 10);
  if (window === 'weekly') {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }
  const m = date.getMonth() + 1;
  return `${date.getFullYear()}-${String(m).padStart(2, '0')}`;
}

function isoWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function countElapsedPeriods(startDate: string, window: WindowType, ref: Date): number {
  const start = new Date(startDate + 'T00:00:00');
  if (window === 'daily') {
    return Math.max(0, Math.floor((ref.getTime() - start.getTime()) / 86_400_000));
  }
  if (window === 'weekly') {
    const sm = isoWeekMonday(start);
    const rm = isoWeekMonday(ref);
    return Math.max(0, Math.floor((rm.getTime() - sm.getTime()) / (7 * 86_400_000)));
  }
  const sm = monthStart(start);
  const rm = monthStart(ref);
  return Math.max(0, (rm.getFullYear() - sm.getFullYear()) * 12 + (rm.getMonth() - sm.getMonth()));
}

function daysPerPeriod(window: WindowType): number {
  return window === 'daily' ? 1 : window === 'weekly' ? 7 : 30;
}

interface Challenge {
  stake_amount: number;
  duration_days: number;
  start_date: string;
  target_count: number;
  goal_window: WindowType;
}

interface CheckIn { window_key: string; }

function computeProtectionCents(
  challenge: Challenge,
  checkIns: CheckIn[],
  ref: Date = new Date()
): { protectedCents: number; forfeitedCents: number } {
  const { stake_amount, duration_days, start_date, target_count, goal_window } = challenge;
  const dpv = stake_amount / duration_days;

  const countByKey: Record<string, number> = {};
  for (const ci of checkIns) {
    countByKey[ci.window_key] = (countByKey[ci.window_key] ?? 0) + 1;
  }

  const elapsed = countElapsedPeriods(start_date, goal_window, ref);
  let completedPeriods = 0;
  for (const count of Object.values(countByKey)) {
    if (count >= target_count) completedPeriods++;
  }
  completedPeriods = Math.min(completedPeriods, elapsed);
  const missedPeriods = elapsed - completedPeriods;
  const missedDays = Math.min(missedPeriods * daysPerPeriod(goal_window), duration_days);

  const forfeitedCents = Math.min(Math.round(missedDays * dpv), stake_amount);
  return { protectedCents: stake_amount - forfeitedCents, forfeitedCents };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  const { challenge_id } = await req.json();
  if (!challenge_id) return new Response('Missing challenge_id', { status: 400 });

  const { data: challenge, error: challengeError } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', challenge_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (challengeError || !challenge) {
    return new Response('Challenge not found', { status: 404 });
  }

  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('window_key')
    .eq('challenge_id', challenge_id);

  const { protectedCents, forfeitedCents } = computeProtectionCents(
    challenge,
    checkIns ?? [],
    new Date()
  );

  const refund = await stripe.refunds.create({
    payment_intent: challenge.stripe_payment_intent_id,
    amount: protectedCents,
  });

  const { data: updatedChallenge } = await supabase
    .from('challenges')
    .update({
      status: 'completed',
      protected_amount_cents: protectedCents,
      forfeited_amount_cents: forfeitedCents,
      stripe_refund_id: refund.id,
      refund_status: 'pending',
    })
    .eq('id', challenge_id)
    .select()
    .single();

  await supabase.from('payments').insert({
    challenge_id,
    user_id: user.id,
    type: 'refund',
    amount_cents: protectedCents,
    stripe_id: refund.id,
    status: 'pending',
  });

  return new Response(
    JSON.stringify({ challenge: updatedChallenge, protectedCents, forfeitedCents }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
