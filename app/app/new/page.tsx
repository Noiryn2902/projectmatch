import { redirect } from 'next/navigation';

import TeamBuilder from '@/components/TeamBuilder';
import type { Viewer } from '@/components/SiteNav';
import { getMyOrg } from '@/lib/data/orgs';
import { listCandidatePool } from '@/lib/data/people';
import { fallbackBrief } from '@/lib/ai/fallback';
import { getCurrentUser } from '@/lib/supabase/server';
import type { Brief, Company } from '@/lib/types';

/**
 * Steps one to three, over your own roster.
 *
 * The landing page runs the same builder against sixty fictional people, to
 * show a stranger what the scoring does without an account. That was fine
 * until it became the only way in: the team you assembled there could never
 * survive the jump to a real project, because Hannah and Diego do not exist
 * in anybody's database. So the people you pick here are your colleagues,
 * which makes the obvious expectation — that the team you chose is the team
 * you go on to ask — actually true.
 *
 * Same component, different pool. The engine does not know the difference
 * and neither does the interface.
 */
export default async function NewProjectPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/sign-in?next=/app/new');

  const org = await getMyOrg();
  if (!org) redirect('/app');

  const people = await listCandidatePool(org.id);

  // Nobody to staff from yet — the roster is the prerequisite, so send them
  // to fill it rather than to an empty ranking.
  if (people.length === 0) redirect(`/app/org/${org.slug}?empty=1`);

  const EXAMPLE = 'A tool that helps a small team track weekly OKRs and flags ones going off track.';
  const brief: Brief = { text: EXAMPLE, ...fallbackBrief(EXAMPLE) };

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const named = (meta.full_name ?? meta.name ?? meta.user_name) as string | undefined;
  const viewer: Viewer = {
    name: named?.trim() || user.email?.split('@')[0] || 'You',
    email: user.email ?? '',
  };

  // The builder shows company chips; inside one org there is only the one.
  const companies: Company[] = [{ id: org.id, name: org.name, offices: org.offices }];

  return (
    <TeamBuilder
      people={people}
      companies={companies}
      initialBrief={brief}
      viewer={viewer}
      real
    />
  );
}
