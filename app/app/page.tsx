import { redirect } from 'next/navigation';

import { listOrgsForUser } from '@/lib/data/orgs';
import { getCurrentUser } from '@/lib/supabase/server';

import { createOrgAction } from './actions';

/**
 * The signed-in home. Three states, and each one redirects out rather than
 * accumulating into one page that tries to handle all of them:
 *
 *   no session       -> /auth/sign-in, with next=/app so the round trip lands
 *                        back here
 *   no org yet       -> this page, showing the one thing there is to do:
 *                        create one
 *   already in an org -> straight to its roster
 *
 * Nobody can belong to more than one org yet, so "already in an org" always
 * means exactly one — the day someone can belong to several, this becomes an
 * org picker instead of a redirect.
 */
export default async function AppHome() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/sign-in?next=/app');

  const orgs = await listOrgsForUser();
  if (orgs.length > 0) redirect('/app/org/' + orgs[0].slug);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-xl font-semibold text-ink">Create your organisation</h1>
      <p className="mt-1 text-sm text-muted">
        Signed in as {user.email}. An organisation is the people you can build teams from — you
        become its first member.
      </p>

      <form action={createOrgAction} className="mt-6 space-y-3">
        <input
          type="text"
          name="name"
          required
          placeholder="Organisation name"
          aria-label="Organisation name"
          className="w-full rounded-full border border-line bg-panel px-4 py-2 text-[13px] outline-none transition-colors focus:border-accent"
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-panel transition-opacity hover:opacity-90"
        >
          Create
        </button>
      </form>
    </main>
  );
}
