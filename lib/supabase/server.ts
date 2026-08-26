import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { SUPABASE_ANON_KEY, SUPABASE_URL, hasDatabase } from '../env';

/**
 * The request-scoped client. Everything it reads and writes runs as the signed
 * in user, with row level security applied — so a bug in application code
 * cannot hand back another organisation's roster.
 *
 * `cookies()` is async in Next 16. That is a breaking change from every
 * Supabase SSR guide written against Next 14 or 15, and it is the reason this
 * function is async rather than a plain constructor.
 */
export async function createServerSupabase() {
  if (!hasDatabase) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY, or call this only when hasDatabase is true.',
    );
  }

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components get a read-only cookie store. Session refresh
          // happens in proxy.ts before the render begins, so a write that
          // cannot land here has already been handled there.
        }
      },
    },
  });
}

/**
 * The signed-in user, or null. Reads through Supabase Auth rather than
 * trusting a cookie's contents — getUser() verifies with the auth server,
 * getSession() does not.
 */
export async function getCurrentUser() {
  if (!hasDatabase) return null;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
