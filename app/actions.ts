'use server';

import { redirect } from 'next/navigation';

import { createOrg, getMyOrg } from '@/lib/data/orgs';
import { listCandidatePool } from '@/lib/data/people';
import { createProject, getProject } from '@/lib/data/projects';
import { getCurrentUser } from '@/lib/supabase/server';
import { fallbackBrief } from '@/lib/ai/fallback';
import type { Brief } from '@/lib/types';

/**
 * Where the demo stops being a demo.
 *
 * The landing page builds a team out of sixty fictional people, in the
 * browser, to show what the scoring does. Locking it used to open a
 * simulated workspace — channels, a fake assistant, chat that synced between
 * two tabs on one machine and nowhere else. That was a dead end dressed as a
 * product, and it sat next to a real backend that already did all of it
 * properly.
 *
 * This is the join. Locking now takes the brief you actually wrote and
 * creates a real project in your own organisation: real roles, real seats,
 * real invitations that reach real people. The fictional sixty do not come
 * with you — they were the illustration, your roster is the thing.
 */
export async function lockTeamAction(formData: FormData) {
  const text = String(formData.get('brief') ?? '').trim();
  if (text.length < 8) return;

  const user = await getCurrentUser();
  if (!user) {
    // Come back and finish the moment they are signed in.
    redirect(`/auth/sign-in?next=${encodeURIComponent('/app?brief=' + encodeURIComponent(text))}`);
  }

  // An org is the container a project needs. Someone arriving straight off
  // the landing page will not have one yet, so make it rather than bouncing
  // them to a form and losing the brief they just wrote.
  let org = await getMyOrg();
  if (!org) {
    const named = (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | undefined;
    const owner = named?.trim() || user.email?.split('@')[0] || 'My';
    await createOrg(`${owner}'s workspace`);
    org = await getMyOrg();
  }
  if (!org) redirect('/app');

  /*
   * A project needs people to staff it from, and an empty roster is the one
   * failure this step cannot recover from on its own. Landing someone on the
   * asking step with four cards reading "Nobody chosen" and no explanation is
   * what used to happen — the org was empty and nothing said so.
   */
  const pool = await listCandidatePool(org.id);
  if (pool.length === 0) {
    redirect(`/app/org/${org.slug}?empty=1`);
  }

  // The roles the builder was actually showing, carried across verbatim.
  // Re-deriving them here was a real bug: the demo may have had Gemini read
  // the brief, and re-running the deterministic parser silently replaced
  // those roles with different ones, so the project you landed on was not
  // the project you had just been looking at.
  let roles: Brief['roles'] | null = null;
  try {
    const raw = String(formData.get('roles') ?? '');
    if (raw) roles = JSON.parse(raw) as Brief['roles'];
  } catch {
    // Malformed — fall through to parsing the text, which always works.
  }

  const parsed = fallbackBrief(text);
  const brief: Brief = {
    text,
    ...parsed,
    ...(roles && roles.length > 0 ? { roles } : {}),
  };

  // Deliberately unnamed. Slicing the brief for a name reads fine on a
  // tile and is never what anyone would have called the thing, and an
  // auto-name is indistinguishable from a chosen one — which leaves no way
  // to tell whether the naming step has been answered. An empty name *is*
  // that signal, and every surface already falls back to "Untitled project".
  const projectId = await createProject(org.id, brief, '');

  // The team they picked, carried into the asking step — but only when it
  // was picked from a real roster. On the public demo these ids belong to
  // fictional people who exist in a JSON file and nowhere else, so they are
  // dropped and the asking step falls back to the engine's own picks.
  if (String(formData.get('real') ?? '') === '1') {
    let picks = '';
    try {
      const picked = JSON.parse(String(formData.get('team') ?? '{}')) as Record<
        string,
        string | null
      >;

      /*
       * The role ids the builder was using are its own — invented in the
       * browser, or handed back by Gemini. create_project throws them away
       * and mints real ones. Passing the browser's ids to the next step was
       * therefore guaranteed to match nothing, which is why a team of four
       * arrived as a page of empty cards with two engine guesses on it: every
       * pick silently missed, and the fallback filled what it could.
       *
       * position is the join. create_project inserts roles in brief order and
       * numbers them as it goes; getProject sorts by that number. So the nth
       * role here is the nth role there, and the title check catches it if
       * that ever stops being true.
       */
      const created = await getProject(projectId);
      const pairs = brief.roles
        .map((role, i) => {
          const personId = picked[role.id];
          const dbRole = created?.roles[i];
          if (!personId || !dbRole || dbRole.title !== role.title) return null;
          return `${dbRole.id}:${personId}`;
        })
        .filter((p): p is string => p !== null);

      picks = pairs.join(',');
    } catch {
      // Unparseable — fall through to the asking step with no pre-selection.
    }

    if (picks) {
      redirect(`/project/${projectId}/invite?picks=${encodeURIComponent(picks)}`);
    }
  }

  redirect(`/project/${projectId}/invite`);

}
