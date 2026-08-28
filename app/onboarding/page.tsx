import { redirect } from 'next/navigation';

import { createOrg, getMyOrg } from '@/lib/data/orgs';
import { getCurrentUser } from '@/lib/supabase/server';

/**
 * Setup starts at the résumé. There is no step for naming anything.
 *
 * A workspace has to exist for people and projects to belong to — it is what
 * the database hangs permissions off, so it cannot not exist. But asking
 * somebody to name it before they have seen the product was making them do
 * the schema's paperwork: it produced a second, empty workspace, every
 * default silently moved to it, and new projects landed somewhere with
 * nobody in it to staff from.
 *
 * So it is made here, once, quietly, and never mentioned again.
 */
export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/sign-in?next=/onboarding');

  if (!(await getMyOrg())) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const named = (meta.full_name ?? meta.name ?? meta.user_name) as string | undefined;
    const owner = named?.trim() || user.email?.split('@')[0] || 'My';
    await createOrg(`${owner}'s workspace`);
  }

  redirect('/onboarding/skills');
}
