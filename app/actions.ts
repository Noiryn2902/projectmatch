'use server';

import { redirect } from 'next/navigation';

import { createOrg, listOrgsForUser } from '@/lib/data/orgs';
import { createProject } from '@/lib/data/projects';
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
  let orgs = await listOrgsForUser();
  if (orgs.length === 0) {
    const named = (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | undefined;
    const owner = named?.trim() || user.email?.split('@')[0] || 'My';
    await createOrg(`${owner}'s organisation`);
    orgs = await listOrgsForUser();
  }
  const org = orgs[0];
  if (!org) redirect('/app');

  // The same deterministic parser the builder itself used, so the roles on
  // the real project are the roles they were just looking at.
  const brief: Brief = { text, ...fallbackBrief(text) };
  const projectId = await createProject(org.id, brief, text.slice(0, 60));

  redirect(`/project/${projectId}?created=1`);
}
