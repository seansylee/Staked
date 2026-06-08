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
  addDemoChallenge: (draft: ChallengeDraft) => string;
  setChallengeCompleted: (challenge: Challenge) => void;
}

const DEFAULT_DRAFT: ChallengeDraft = {
  name: '',
  stake_amount_cents: 10000, // $100
  duration_days: 30,
  goals: [],
  charity_id: null,
};

function buildDemoMaps() {
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
  return { goalsMap, checkInsMap };
}

const demoInit = DEMO_MODE ? buildDemoMaps() : null;

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  challenges: DEMO_MODE ? DEMO_CHALLENGES : [],
  goalsMap: demoInit?.goalsMap ?? {},
  checkInsMap: demoInit?.checkInsMap ?? {},
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
    const goals = get().goalsMap[challengeId] ?? [];
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    const now = new Date();
    const windowKey = getWindowKey(now, goal.goal_window);

    if (DEMO_MODE) {
      const demoCheckIn: CheckIn = {
        id: `demo-${Date.now()}`,
        goal_id: goalId,
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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
      stripe_payment_intent_id: 'pi_demo_new',
      stripe_refund_id: null,
      protected_amount_cents: null,
      forfeited_amount_cents: null,
      charity_id: draft.charity_id,
      created_at: now.toISOString(),
    };

    const goals: Goal[] = draft.goals.map((g, i) => ({
      id: `${id}-g${i}`,
      challenge_id: id,
      name: g.name,
      target_count: g.target_count,
      goal_window: g.goal_window,
      created_at: now.toISOString(),
    }));

    set((state) => ({
      challenges: [challenge, ...state.challenges],
      goalsMap: { ...state.goalsMap, [id]: goals },
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
  },
}));
