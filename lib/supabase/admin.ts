import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, hasServiceRole } from '../env';

/**
 * The privileged client. It bypasses row level security entirely, so it exists
 * for exactly two jobs:
 *
 *   - accepting an invitation by token, where the recipient has no account yet
 *     and therefore no permissions to read the row that describes them;
 *   - writing the audit log, which no actor is allowed to edit.
 *
 * Anything else should use the request-scoped client in ./server.ts and let
 * the database enforce who can see what. If you are reaching for this to make
 * a query "just work", the policy is wrong, not the client.
 */
export function createAdminSupabase() {
  if (!hasServiceRole) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. The admin client cannot be used ' +
        'without it, and it must never be exposed with a NEXT_PUBLIC_ prefix.',
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
