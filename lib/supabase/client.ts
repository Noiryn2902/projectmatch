'use client';

import { createBrowserClient } from '@supabase/ssr';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../env';

/**
 * The browser client. This is the one deliberate exception to "no database in
 * the browser" — it exists so client components can call auth methods that
 * only make sense from the browser (signInWithOtp, signInWithOAuth, the
 * redirect-driven parts of the flow) and, later, so realtime chat can open a
 * socket. It carries the same anon key and the same row level security as
 * everything else; nothing it does bypasses a policy.
 *
 * Ordinary data reads and writes still belong on the server, through
 * lib/supabase/server.ts.
 */
export function createBrowserSupabase() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
