import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { DEMO_MODE, DEMO_USER } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;

  initialize: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setProfile: (profile: Profile) => void;
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

    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null });

    if (session?.user) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      set({ profile: data });
    }

    set({ isLoading: false });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        set({ profile: data });
      } else {
        set({ profile: null });
      }
    });
  },

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },

  setProfile: (profile) => set({ profile }),
}));
