import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { DEMO_MODE, DEMO_USER } from '@/lib/demo';
import { posthog } from '@/lib/posthog';
import { AUTH_CALLBACK_URL, AUTH_RESET_URL, supabase } from '@/lib/supabase';
import { useChallengeStore } from '@/store/useChallengeStore';
import { Profile } from '@/types';

export interface SignUpResult {
  needsEmailConfirmation: boolean;
  // With email-enumeration protection on, Supabase "succeeds" for an address
  // that already has an account but returns a user with no identities.
  maybeExistingAccount: boolean;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;

  initialize: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  setProfile: (profile: Profile) => void;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data;
}

function identifyUser(user: User): void {
  posthog.identify(user.id, user.email ? { email: user.email } : undefined);
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,

  initialize: async () => {
    if (DEMO_MODE) {
      set({
        session: { access_token: 'demo', token_type: 'bearer', expires_in: 9999, refresh_token: 'demo', user: DEMO_USER as unknown as User } as Session,
        user: DEMO_USER as unknown as User,
        profile: { id: DEMO_USER.id, email: DEMO_USER.email, full_name: 'Demo User', stripe_customer_id: null, push_token: null, created_at: DEMO_USER.created_at },
        isLoading: false,
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ session, user: session?.user ?? null });

      if (session?.user) {
        identifyUser(session.user);
        set({ profile: await fetchProfile(session.user.id) });
      }
    } finally {
      set({ isLoading: false });
    }

    supabase.auth.onAuthStateChange((event, session) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        if (event === 'SIGNED_IN') {
          identifyUser(session.user);
        }
        fetchProfile(session.user.id).then((profile) => set({ profile }));
      } else {
        set({ profile: null });
        if (event === 'SIGNED_OUT') {
          posthog.reset();
          useChallengeStore.getState().reset();
        }
      }
    });
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: AUTH_CALLBACK_URL },
    });
    if (error) throw error;
    return {
      needsEmailConfirmation: !data.session,
      maybeExistingAccount: data.user?.identities?.length === 0,
    };
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    posthog.reset();
    useChallengeStore.getState().reset();
    set({ session: null, user: null, profile: null });
  },

  resendConfirmation: async (email) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: AUTH_CALLBACK_URL },
    });
    if (error) throw error;
  },

  requestPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: AUTH_RESET_URL,
    });
    if (error) throw error;
  },

  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  setProfile: (profile) => set({ profile }),
}));
