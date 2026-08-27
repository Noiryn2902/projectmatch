import Link from 'next/link';

import type { Company, Person } from '@/lib/types';
import peopleData from '@/lib/seed/people.json';
import companiesData from '@/lib/seed/companies.json';
import Difference from '@/components/Difference';
import SiteFooter from '@/components/SiteFooter';
import SiteNav, { type Viewer } from '@/components/SiteNav';
import { getDemoOrg } from '@/lib/data/orgs';
import { listProjects } from '@/lib/data/projects';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/lib/supabase/server';

/**
 * The front door.
 *
 * This used to be the whole product: a 3,800-line client bundle with an
 * in-page team builder, a directory, a workspace, and eight marketing
 * sections, because there was nowhere else for any of it to live. There is
 * now — /app is the real thing — so this page has one job, which is to say
 * what the idea is and get out of the way.
 *
 * Three things kept, deliberately:
 *   - Difference, the 0% / 12% proof. It is the argument, not decoration.
 *   - A link straight into a real project, so the product can be judged
 *     without signing in. Sign-in is required to *act*, never to *look*.
 *   - The counterfactual panel, which is the strongest single artifact here.
 *
 * Proof.tsx is gone. It carried invented testimonials attributed to
 * fictional people, which was fine while everything on screen was openly
 * fictional and is a liability now that real organisations have accounts.
 */

function toViewer(user: { email?: string; user_metadata?: Record<string, unknown> }): Viewer {
  const meta = user.user_metadata ?? {};
  const named = (meta.full_name ?? meta.name ?? meta.user_name) as string | undefined;
  return {
    name: named?.trim() || user.email?.split('@')[0] || 'You',
    email: user.email ?? '',
  };
}

const STEPS = [
  {
    n: '1',
    title: 'Describe the work',
    body: 'Two lines about the project. It is read into roles and the skills each one needs.',
  },
  {
    n: '2',
    title: 'See who adds most',
    body: 'Everyone is scored on what they add to the team as it stands — not on how good they look alone.',
  },
  {
    n: '3',
    title: 'Ask them',
    body: 'Each seat goes out as an invitation. Nobody joins a team without agreeing to it.',
  },
];

export default async function Page() {
  const user = await getCurrentUser();

  // A real project to point at, so "see it working" is not a screenshot.
  let demoProjectId: string | null = null;
  if (hasDatabase) {
    try {
      const demo = await getDemoOrg();
      if (demo) demoProjectId = (await listProjects(demo.id))[0]?.id ?? null;
    } catch {
      // The landing page must render with the database unreachable.
    }
  }

  const seeItHref = demoProjectId ? `/project/${demoProjectId}` : '/auth/sign-in?next=/app';

  return (
    <>
      <SiteNav viewer={user ? toViewer(user) : null} />

      <main>
        <section className="mx-auto max-w-[1100px] px-5 pt-20 pb-16">
          <p className="text-[12px] tracking-wide text-faint uppercase">Team formation</p>
          <h1 className="mt-3 max-w-[18ch] font-display text-[clamp(2.4rem,6vw,4rem)] leading-[1.05] font-bold text-balance">
            The best person is not the best <span className="text-accent">addition</span>.
          </h1>
          <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-muted">
            Describe a project in two lines and get a team back — scored on what each person adds to
            the team being built, with an honest list of what that team still cannot do.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={user ? '/app' : '/auth/sign-in?next=/app'}
              className="rounded-full bg-accent px-6 py-3 text-[15px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              {user ? 'Go to your workspace' : 'Start free'}
            </Link>
            <Link
              href={seeItHref}
              className="rounded-full border border-line-strong px-6 py-3 text-[15px] font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              See it on a real project
            </Link>
            <span className="text-[13px] text-faint">No sign-in needed to look around.</span>
          </div>
        </section>

        {/* The argument. Untouched — this is the thing worth reading. */}
        <Difference people={peopleData as Person[]} />

        <section className="border-t border-line">
          <div className="mx-auto max-w-[1100px] px-5 py-16">
            <div className="grid gap-8 sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n}>
                  <span className="grid size-7 place-items-center rounded-full bg-accent-soft font-display text-[13px] font-bold text-accent">
                    {s.n}
                  </span>
                  <h2 className="mt-3 font-display text-[17px] font-semibold text-ink">{s.title}</h2>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {demoProjectId && (
          <section className="border-t border-line">
            <div className="mx-auto max-w-[1100px] px-5 py-16">
              <div className="rounded-2xl border border-line border-l-2 border-l-accent bg-panel px-6 py-7">
                <h2 className="font-display text-[20px] font-semibold text-balance text-ink">
                  Same brief, same people, two ways of choosing.
                </h2>
                <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-muted">
                  A keyword filter matches skill words and sorts by seniority. The engine scores
                  contribution to the team being built. On the same roster that is a{' '}
                  <span className="text-ink">20-point difference in coverage</span> — see it
                  side by side.
                </p>
                <Link
                  href={`/project/${demoProjectId}/compare`}
                  className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
                >
                  Filter vs engine
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter companies={companiesData as Company[]} />
    </>
  );
}
