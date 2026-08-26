/**
 * Environment resolution, in one place, so no other file has to guess whether
 * a key exists.
 *
 * The database is additive. With nothing configured the application still runs
 * against the deterministic seeded data — that is not an emergency fallback,
 * it is how the project runs on a fresh clone, in CI, and on any machine that
 * has never seen a Supabase key.
 *
 * The URL and anon key are public on purpose: the browser needs both to open a
 * realtime socket, which is the one deliberate exception to keeping the
 * database behind the backend. They are not secrets, and row level security
 * assumes they are known. The service role key is a different matter and is
 * never exposed with a NEXT_PUBLIC_ prefix.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Server only. Referencing this from a client component is a bug. */
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** True once a project is configured. Decides seeded data versus Postgres. */
export const hasDatabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** True when the server can act outside any one user's permissions. */
export const hasServiceRole = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
