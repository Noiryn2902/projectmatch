import type { Brief, Company, Person } from '@/lib/types';
import peopleData from '@/lib/seed/people.json';
import companiesData from '@/lib/seed/companies.json';
import { fallbackBrief } from '@/lib/ai/fallback';
import TeamBuilder from '@/components/TeamBuilder';
import { getCurrentUser } from '@/lib/supabase/server';
import type { Viewer } from '@/components/SiteNav';

const EXAMPLE =
  'Internal tool that turns customer support tickets into weekly theme reports. Roughly 6 weeks. It needs to actually ship, not stay a prototype.';

/** The display name Supabase carries from whichever provider signed them in. */
function toViewer(user: { email?: string; user_metadata?: Record<string, unknown> }): Viewer {
  const meta = user.user_metadata ?? {};
  const named = (meta.full_name ?? meta.name ?? meta.user_name) as string | undefined;
  return {
    name: named?.trim() || user.email?.split('@')[0] || 'You',
    email: user.email ?? '',
  };
}

export default async function Page() {
  // Read deterministically on the server so the first paint is a working team
  // rather than an empty form. No API call needed to see the product.
  const brief: Brief = { text: EXAMPLE, ...fallbackBrief(EXAMPLE) };

  // Real identity, resolved server-side against a verified session. The
  // landing page stays public — this only decides whether the nav offers a
  // way in or a way back to work.
  const user = await getCurrentUser();

  return (
    <TeamBuilder
      people={peopleData as Person[]}
      companies={companiesData as Company[]}
      initialBrief={brief}
      viewer={user ? toViewer(user) : null}
    />
  );
}
