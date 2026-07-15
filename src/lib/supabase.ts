import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { DEMO_MODE } from './demo';

let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
let supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  if (!DEMO_MODE) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — copy .env.example to .env or enable EXPO_PUBLIC_DEMO_MODE.'
    );
  }
  // Demo mode must boot without credentials; stores short-circuit before any
  // request, so the client only needs to construct.
  supabaseUrl = 'https://demo.invalid.supabase.co';
  supabaseAnonKey = 'demo-anon-key';
}

// Deep-link targets for Supabase auth emails. Both must be in the project's
// Redirect URL allowlist (Dashboard → Authentication → URL Configuration).
export const AUTH_CALLBACK_URL = 'staked://auth/callback';
export const AUTH_RESET_URL = 'staked://auth/reset';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
