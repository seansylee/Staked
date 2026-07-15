import { supabase } from './supabase';

type LinkParams = Record<string, string | string[] | undefined>;

function param(params: LinkParams, key: string): string | null {
  const v = params[key];
  return typeof v === 'string' ? v : null;
}

export interface ExchangeResult {
  ok: boolean;
  message?: string;
}

// Handles the deep link Supabase redirects to after a confirmation or
// password-reset email (PKCE flow: ?code=... on success, error_* on failure).
// The code can only be exchanged by the client that initiated the flow — if
// the user opened the email on another device, we surface a sign-in hint.
export async function exchangeCodeFromLink(params: LinkParams): Promise<ExchangeResult> {
  const errorDescription = param(params, 'error_description');
  if (errorDescription) {
    return { ok: false, message: errorDescription.replace(/\+/g, ' ') };
  }

  const code = param(params, 'code');
  if (!code) {
    return { ok: false, message: 'This link is missing its confirmation code.' };
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return {
      ok: false,
      message:
        'This link could not be verified on this device. If you opened it elsewhere, just sign in with your email and password.',
    };
  }
  return { ok: true };
}
