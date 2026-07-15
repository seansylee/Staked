import AsyncStorage from '@react-native-async-storage/async-storage';
import { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ApiError, confirmChallengeStart } from '@/api/payments';
import { DEMO_CHECK_INS, DEMO_CHALLENGES, DEMO_MODE } from '@/lib/demo';
import { clearAllReminders, syncChallengeReminders } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useUIStore } from '@/store/useUIStore';
import { Challenge, ChallengeDraft, CheckIn } from '@/types';
import { getWindowKey } from '@/utils/dates';

// A payment intent created for the current draft; reused across retries and
// sheet cancellations so one challenge can never charge twice.
export interface PendingPayment {
  paymentIntentId: string;
  clientSecret: string;
  amountCents: number;
}

// Stripe charged the card but confirm-challenge-start hasn't succeeded yet.
// Persisted so the charge is never orphaned, even across an app kill.
export interface PendingConfirmation {
  paymentIntentId: string;
  draft: ChallengeDraft;
}

interface ChallengeState {
  challenges: Challenge[];
  checkInsMap: Record<string, CheckIn[]>; // challenge_id → check-ins
  isLoading: boolean;
  draft: ChallengeDraft | null;
  pendingPayment: PendingPayment | null;
  pendingConfirmation: PendingConfirmation | null;
  _channel: RealtimeChannel | null;

  fetchChallenges: () => Promise<void>;
  reset: () => void;
  subscribeToCheckIns: (challengeId: string) => void;
  unsubscribeAll: () => void;
  setDraft: (draft: Partial<ChallengeDraft>) => void;
  clearDraft: () => void;
  setPendingPayment: (pending: PendingPayment | null) => void;
  setPendingConfirmation: (pending: PendingConfirmation | null) => void;
  recoverPendingConfirmation: () => Promise<void>;
  addCheckIn: (challengeId: string) => Promise<void>;
  addDemoChallenge: (draft: ChallengeDraft) => string;
  setChallengeCompleted: (challenge: Challenge) => void;
  setChallengeQuit: (challenge: Challenge) => void;
}

const DEFAULT_DRAFT: ChallengeDraft = {
  name: '',
  stake_amount_cents: 10000,
  duration_days: 30,
  target_count: 1,
  goal_window: 'daily',
  charity_id: null,
};

function buildDemoCheckInsMap() {
  const checkInsMap: Record<string, CheckIn[]> = {};
  for (const ci of DEMO_CHECK_INS) {
    if (!checkInsMap[ci.challenge_id]) checkInsMap[ci.challenge_id] = [];
    checkInsMap[ci.challenge_id].push(ci);
  }
  return checkInsMap;
}

const demoCheckInsMap = DEMO_MODE ? buildDemoCheckInsMap() : null;

export const useChallengeStore = create<ChallengeState>()(
  persist(
    (set, get) => ({
      challenges: DEMO_MODE ? DEMO_CHALLENGES : [],
      checkInsMap: demoCheckInsMap ?? {},
      isLoading: false,
      draft: null,
      pendingPayment: null,
      pendingConfirmation: null,
      _channel: null,

      fetchChallenges: async () => {
        if (DEMO_MODE) {
          set({
            challenges: DEMO_CHALLENGES,
            checkInsMap: buildDemoCheckInsMap(),
            isLoading: false,
          });
          return;
        }

        set({ isLoading: true });
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          set({ isLoading: false });
          return;
        }

        const { data: challenges } = await supabase
          .from('challenges')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!challenges) {
          set({ isLoading: false });
          return;
        }

        const ids = challenges.map((c) => c.id);

        const { data: checkIns } = await supabase
          .from('check_ins')
          .select('*')
          .in('challenge_id', ids);

        const checkInsMap: Record<string, CheckIn[]> = {};
        for (const ci of checkIns ?? []) {
          if (!checkInsMap[ci.challenge_id]) checkInsMap[ci.challenge_id] = [];
          checkInsMap[ci.challenge_id].push(ci);
        }

        set({ challenges, checkInsMap, isLoading: false });
        syncChallengeReminders(challenges);
      },

      // Wipes user-scoped state on sign-out so the next account never sees the
      // previous user's challenges, and stale reminders don't keep firing.
      reset: () => {
        const { _channel } = get();
        if (_channel) _channel.unsubscribe();
        clearAllReminders();
        set({
          challenges: [],
          checkInsMap: {},
          isLoading: false,
          draft: null,
          pendingPayment: null,
          pendingConfirmation: null,
          _channel: null,
        });
      },

      subscribeToCheckIns: (challengeId) => {
        const { _channel } = get();
        if (_channel) _channel.unsubscribe();

        const channel = supabase
          .channel(`check_ins:${challengeId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'check_ins',
              filter: `challenge_id=eq.${challengeId}`,
            },
            (payload) => {
              const newCheckIn = payload.new as CheckIn;
              set((state) => ({
                checkInsMap: {
                  ...state.checkInsMap,
                  [challengeId]: [...(state.checkInsMap[challengeId] ?? []), newCheckIn],
                },
              }));
            }
          )
          .subscribe();

        set({ _channel: channel });
      },

      unsubscribeAll: () => {
        const { _channel } = get();
        if (_channel) _channel.unsubscribe();
        set({ _channel: null });
      },

      setDraft: (partial) => {
        const current = get().draft ?? DEFAULT_DRAFT;
        set({ draft: { ...current, ...partial } });
      },

      clearDraft: () => set({ draft: null }),

      setPendingPayment: (pending) => set({ pendingPayment: pending }),

      setPendingConfirmation: (pending) => set({ pendingConfirmation: pending }),

      // Heals a paid-but-unconfirmed challenge (network drop or app kill between
      // the Stripe charge and confirm-challenge-start). Safe to call repeatedly:
      // the server accepts one challenge per payment intent, so the worst case is
      // a 409 meaning the challenge already exists.
      recoverPendingConfirmation: async () => {
        const pending = get().pendingConfirmation;
        if (!pending || DEMO_MODE) return;
        try {
          await confirmChallengeStart(pending.paymentIntentId, pending.draft);
          set({ pendingConfirmation: null });
          useUIStore
            .getState()
            .showToast(`🔥 ${pending.draft.name} is live! Your payment went through.`);
          await get().fetchChallenges();
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            // Challenge already exists for this payment — recovered on an
            // earlier attempt.
            set({ pendingConfirmation: null });
            await get().fetchChallenges();
            return;
          }
          if (err instanceof ApiError && err.status < 500) {
            // 4xx: the payment never actually succeeded (or the draft is
            // invalid). Retrying can never fix it — drop the pending state.
            set({ pendingConfirmation: null });
            return;
          }
          // Network / 5xx: keep it and try again next time.
        }
      },

      addCheckIn: async (challengeId) => {
        const challenge = get().challenges.find((c) => c.id === challengeId);
        if (!challenge) return;

        const now = new Date();
        const windowKey = getWindowKey(now, challenge.goal_window);

        if (DEMO_MODE) {
          const demoCheckIn: CheckIn = {
            id: `demo-${Date.now()}`,
            challenge_id: challengeId,
            user_id: 'demo-user',
            logged_at: now.toISOString(),
            window_key: windowKey,
          };
          set((state) => ({
            checkInsMap: {
              ...state.checkInsMap,
              [challengeId]: [...(state.checkInsMap[challengeId] ?? []), demoCheckIn],
            },
          }));
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const optimisticCheckIn: CheckIn = {
          id: `optimistic-${Date.now()}`,
          challenge_id: challengeId,
          user_id: user.id,
          logged_at: now.toISOString(),
          window_key: windowKey,
        };

        set((state) => ({
          checkInsMap: {
            ...state.checkInsMap,
            [challengeId]: [...(state.checkInsMap[challengeId] ?? []), optimisticCheckIn],
          },
        }));

        const { data, error } = await supabase
          .from('check_ins')
          .insert({
            challenge_id: challengeId,
            user_id: user.id,
            window_key: windowKey,
          })
          .select()
          .single();

        if (error || !data) {
          set((state) => ({
            checkInsMap: {
              ...state.checkInsMap,
              [challengeId]: (state.checkInsMap[challengeId] ?? []).filter(
                (ci) => ci.id !== optimisticCheckIn.id
              ),
            },
          }));
          throw error ?? new Error('Failed to log check-in');
        }

        set((state) => ({
          checkInsMap: {
            ...state.checkInsMap,
            [challengeId]: (state.checkInsMap[challengeId] ?? []).map((ci) =>
              ci.id === optimisticCheckIn.id ? (data as CheckIn) : ci
            ),
          },
        }));
      },

      addDemoChallenge: (draft) => {
        const id = `demo-${Date.now()}`;
        const now = new Date();
        const start = now.toISOString().slice(0, 10);
        const end = new Date(now.getTime() + draft.duration_days * 86_400_000)
          .toISOString()
          .slice(0, 10);

        const challenge: Challenge = {
          id,
          user_id: 'demo-user',
          name: draft.name,
          stake_amount: draft.stake_amount_cents,
          platform_fee: 300,
          duration_days: draft.duration_days,
          start_date: start,
          end_date: end,
          status: 'active',
          target_count: draft.target_count,
          goal_window: draft.goal_window,
          stripe_payment_intent_id: 'pi_demo_new',
          stripe_refund_id: null,
          protected_amount_cents: null,
          forfeited_amount_cents: null,
          charity_id: draft.charity_id,
          quit_penalty_cents: null,
          refund_status: null,
          created_at: now.toISOString(),
        };

        set((state) => ({
          challenges: [challenge, ...state.challenges],
          checkInsMap: { ...state.checkInsMap, [id]: [] },
        }));

        return id;
      },

      setChallengeCompleted: (updatedChallenge) => {
        set((state) => ({
          challenges: state.challenges.map((c) =>
            c.id === updatedChallenge.id ? updatedChallenge : c
          ),
        }));
        syncChallengeReminders(get().challenges);
      },

      setChallengeQuit: (updatedChallenge) => {
        set((state) => ({
          challenges: state.challenges.map((c) =>
            c.id === updatedChallenge.id ? updatedChallenge : c
          ),
        }));
        syncChallengeReminders(get().challenges);
      },
    }),
    {
      name: 'staked-challenges',
      storage: createJSONStorage(() => AsyncStorage),
      // Only creation-flow state persists: a paid-but-unconfirmed payment
      // must survive an app kill. Challenges/check-ins are refetched, and
      // _channel is a live object.
      partialize: (s) => ({
        draft: s.draft,
        pendingPayment: s.pendingPayment,
        pendingConfirmation: s.pendingConfirmation,
      }),
    }
  )
);
