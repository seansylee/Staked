import Stripe from 'https://esm.sh/stripe@14';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
});

// --- Shared computation logic (mirrored from client) ---

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

interface Goal { id: string; target_count: number; window: WindowType; }
interface CheckIn { goal_id: string; window_key: string; }
interface Challenge { stake_amount: number; duration_days: number; start_date: string; end_date: string; }

function computeProtectionCents(
  challenge: Challenge,
  goals: Goal[],
  checkIns: CheckIn[],
  ref: Date = new Date()
): { protectedCents: number; forfeitedCents: number } {
  const stake = challenge.stake_amount;
  const dpv = stake / challenge.duration_days;

  const checkInMap: Record<string, Record<string, number>> = {};
  for (const ci of checkIns) {
    if (!checkInMap[ci.goal_id]) checkInMap[ci.goal_id] = {};
    checkInMap[ci.goal_id][ci.window_key] = (checkInMap[ci.goal_id][ci.window_key] ?? 0) + 1;
  }

  let totalMissedDayEquivalents = 0;

  for (const goal of goals) {
    const elapsed = countElapsedPeriods(challenge.start_date, goal.window, ref);
    const byKey = checkInMap[goal.id] ?? {};
    let completed = 0;
    for (const count of Object.values(byKey)) {
      if (count >= goal.target_count) completed++;
    }
    completed = Math.min(completed, elapsed);
    const missed = elapsed - completed;
    totalMissedDayEquivalents += Math.min(missed * daysPerPeriod(goal.window), challenge.duration_days) / (goals.length || 1);
  }

  const forfeitedCents = Math.min(Math.round(totalMissedDayEquivalents * dpv), stake);
  return { protectedCents: stake - forfeitedCents, forfeitedCents };
}

// --- Edge Function ---

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

  const [{ data: goals }, { data: checkIns }] = await Promise.all([
    supabase.from('goals').select('*').eq('challenge_id', challenge_id),
    supabase.from('check_ins').select('*').eq('challenge_id', challenge_id),
  ]);

  const { protectedCents, forfeitedCents } = computeProtectionCents(
    challenge,
    goals ?? [],
    checkIns ?? [],
    new Date()
  );

  // Issue Stripe refund for protected amount
  const refund = await stripe.refunds.create({
    payment_intent: challenge.stripe_payment_intent_id,
    amount: protectedCents,
  });

  // Update challenge
  const { data: updatedChallenge } = await supabase
    .from('challenges')
    .update({
      status: 'completed',
      protected_amount_cents: protectedCents,
      forfeited_amount_cents: forfeitedCents,
      stripe_refund_id: refund.id,
    })
    .eq('id', challenge_id)
    .select()
    .single();

  // Record refund payment
  await supabase.from('payments').insert({
    challenge_id,
    user_id: user.id,
    type: 'refund',
    amount_cents: protectedCents,
    stripe_id: refund.id,
    status: 'succeeded',
  });

  return new Response(
    JSON.stringify({ challenge: updatedChallenge, protectedCents, forfeitedCents }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
