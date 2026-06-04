import { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';
import { DEMO_CHECK_INS, DEMO_CHALLENGES, DEMO_GOALS, DEMO_MODE } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { Challenge, ChallengeDraft, CheckIn, Goal, GoalDraft } from '@/types';
import { getWindowKey } from '@/utils/dates';

interface ChallengeState {
  challenges: Challenge[];
  goalsMap: Record<string, Goal[]>; // challenge_id → goals
  checkInsMap: Record<string, CheckIn[]>; // challenge_id → check-ins
  isLoading: boolean;
  draft: ChallengeDraft | null;
  _channel: RealtimeChannel | null;

  fetchChallenges: () => Promise<void>;
  subscribeToCheckIns: (challengeId: string) => void;
  unsubscribeAll: () => void;
  setDraft: (draft: Partial<ChallengeDraft>) => void;
  updateDraftGoals: (goals: GoalDraft[]) => void;
  clearDraft: () => void;
  addCheckIn: (goalId: string, challengeId: string) => Promise<void>;
  setChallengeCompleted: (challenge: Challenge) => void;
}

const DEFAULT_DRAFT: ChallengeDraft = {
  name: '',
  stake_amount_cents: 10000, // $100
  duration_days: 30,
  goals: [],
};

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  challenges: [],
  goalsMap: {},
  checkInsMap: {},
  isLoading: false,
  draft: null,
  _channel: null,

  fetchChallenges: async () => {
    if (DEMO_MODE) {
      const goalsMap: Record<string, Goal[]> = {};
      const checkInsMap: Record<string, CheckIn[]> = {};
      for (const g of DEMO_GOALS) {
        if (!goalsMap[g.challenge_id]) goalsMap[g.challenge_id] = [];
        goalsMap[g.challenge_id].push(g);
      }
      for (const ci of DEMO_CHECK_INS) {
        if (!checkInsMap[ci.challenge_id]) checkInsMap[ci.challenge_id] = [];
        checkInsMap[ci.challenge_id].push(ci);
      }
      set({ challenges: DEMO_CHALLENGES, goalsMap, checkInsMap, isLoading: false });
      return;
    }

    set({ isLoading: true });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ isLoading: false }); return; }

    const { data: challenges } = await supabase
      .from('challenges')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!challenges) { set({ isLoading: false }); return; }

    const ids = challenges.map((c) => c.id);

    const [{ data: goals }, { data: checkIns }] = await Promise.all([
      supabase.from('goals').select('*').in('challenge_id', ids),
      supabase.from('check_ins').select('*').in('challenge_id', ids),
    ]);

    const goalsMap: Record<string, Goal[]> = {};
    const checkInsMap: Record<string, CheckIn[]> = {};

    for (const g of goals ?? []) {
      if (!goalsMap[g.challenge_id]) goalsMap[g.challenge_id] = [];
      goalsMap[g.challenge_id].push(g);
    }
    for (const ci of checkIns ?? []) {
      if (!checkInsMap[ci.challenge_id]) checkInsMap[ci.challenge_id] = [];
      checkInsMap[ci.challenge_id].push(ci);
    }

    set({ challenges, goalsMap, checkInsMap, isLoading: false });
  },

  subscribeToCheckIns: (challengeId) => {
    const { _channel } = get();
    if (_channel) _channel.unsubscribe();

    const channel = supabase
      .channel(`check_ins:${challengeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'check_ins', filter: `challenge_id=eq.${challengeId}` },
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

  updateDraftGoals: (goals) => {
    const current = get().draft ?? DEFAULT_DRAFT;
    set({ draft: { ...current, goals } });
  },

  clearDraft: () => set({ draft: null }),

  addCheckIn: async (goalId, challengeId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const goals = get().goalsMap[challengeId] ?? [];
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    const now = new Date();
    const windowKey = getWindowKey(now, goal.goal_window);

    // Optimistic update
    const optimisticCheckIn: CheckIn = {
      id: `optimistic-${Date.now()}`,
      goal_id: goalId,
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
        goal_id: goalId,
        challenge_id: challengeId,
        user_id: user.id,
        window_key: windowKey,
      })
      .select()
      .single();

    if (error || !data) {
      // Roll back optimistic update
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

    // Replace optimistic entry with real one
    set((state) => ({
      checkInsMap: {
        ...state.checkInsMap,
        [challengeId]: (state.checkInsMap[challengeId] ?? []).map((ci) =>
          ci.id === optimisticCheckIn.id ? (data as CheckIn) : ci
        ),
      },
    }));
  },

  setChallengeCompleted: (updatedChallenge) => {
    set((state) => ({
      challenges: state.challenges.map((c) =>
        c.id === updatedChallenge.id ? updatedChallenge : c
      ),
    }));
  },
}));
