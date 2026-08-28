import Link from 'next/link';
import { redirect } from 'next/navigation';

import AppShell from '@/components/app/AppShell';
import Avatar from '@/components/Avatar';
import { listOrgsForUser } from '@/lib/data/orgs';
import { getMyWork, getNotices } from '@/lib/data/me';
import { getPerson } from '@/lib/data/people';
import { listProjectCards } from '@/lib/data/projects';
import { getCurrentUser } from '@/lib/supabase/server';

import { deleteProjectAction } from '../project/[id]/actions';

/**
 * The signed-in home, and the answer to "what am I looking at".
 *
 * It used to be a bare create-workspace form that redirected straight to
 * the roster the moment you had an org — which meant that after day one
 * there was no home at all, and every route was reachable only by knowing
 * its URL. This answers the questions a person actually arrives with: what
 * is being asked of me, what am I on, and what can I do next.
 */
export default async function AppHome() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/sign-in?next=/app');

  const orgs = await listOrgsForUser();
  if (orgs.length === 0) return <Onboard email={user.email ?? ''} />;

  const org = orgs[0];
  const [work, notices] = await Promise.all([getMyWork(org.id), getNotices(org.id)]);
  const cards = await listProjectCards(org.id, work.personId);
  const me = work.personId ? await getPerson(work.personId) : null;

  return (
    <AppShell
      org={org}
      notifications={work.invitations.length}
      notices={notices}
      tabs={[
        { href: '/app', label: 'Home' },
        { href: `/app/org/${org.slug}`, label: 'People' },
      ]}
      active="/app"
      action={
        <Link
          href="/app/new"
          className="rounded-full bg-accent px-3 py-1.5 text-[12px] font-semibold text-canvas hover:opacity-90"
        >
          New project
        </Link>
      }
    >
      <h1 className="font-display text-2xl font-bold text-ink">
        {me ? `Hello, ${me.name.split(' ')[0]}` : 'Welcome'}
      </h1>

      {/* The thing that needs an answer comes first, and nothing else
          competes with it until it is dealt with. */}
      {work.invitations.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[11px] tracking-wide text-faint uppercase">Waiting on you</h2>
          <ul className="mt-2 space-y-2">
            {work.invitations.map((inv) => (
              <li key={inv.token}>
                <Link
                  href={`/invite/${inv.token}`}
                  className="flex items-center gap-3 rounded-xl border border-line border-l-2 border-l-accent bg-panel px-4 py-3.5 transition-colors hover:border-accent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink">
                      {inv.roleTitle} on {inv.projectName}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted">{inv.brief}</span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-panel">
                    Respond
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!me && (
        <Link
          href="/onboarding/you"
          className="mt-6 flex items-center gap-3 rounded-xl border border-line border-l-2 border-l-accent bg-panel px-4 py-3.5 transition-colors hover:border-accent"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium text-ink">Finish your profile</span>
            <span className="mt-0.5 block text-[12px] text-muted">
              Upload a résumé and we read your skills out of it. Until then no team can find you.
            </span>
          </span>
          <span className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-panel">
            Add me
          </span>
        </Link>
      )}

      {/* min-w-0 on the grid child: without it a long project name forces the
          column wider than the viewport and the whole page scrolls sideways,
          which is exactly what was happening. */}
      {/*
        Big tiles and a plus. Nothing else lives here: the workspace is
        where projects are, and anything that is not a project is a
        distraction from choosing one.
      */}
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((p) => {
          const pct = Math.round(p.coverage * 100);
          const open = p.seats - p.filled;
          return (
            <li
              key={p.id}
              className="group relative min-w-0 rounded-2xl border border-line bg-panel transition-colors hover:border-line-strong"
            >
              <Link href={`/project/${p.id}`} className="block p-5">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate font-display text-[15px] font-semibold text-ink">
                    {p.name || 'Untitled project'}
                  </span>
                  {p.myRole && (
                    <span className="shrink-0 rounded-full border border-accent/40 px-1.5 text-[10px] text-accent">
                      you
                    </span>
                  )}
                </span>

                <span className="mt-1.5 line-clamp-2 block text-[12px] leading-snug text-muted">
                  {p.brief}
                </span>

                <span className="mt-4 flex items-center gap-1.5">
                  {p.members.slice(0, 5).map((m) => (
                    <Avatar key={m.id} person={m} size={26} />
                  ))}
                  {p.filled === 0 && (
                    <span className="text-[11px] text-faint">Nobody seated yet</span>
                  )}
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums text-faint">
                    {p.filled}/{p.seats}
                  </span>
                </span>

                <span className="mt-2.5 block h-1 overflow-hidden rounded-full bg-panel-2">
                  <span
                    className="block h-full rounded-full bg-good"
                    style={{ width: pct + '%' }}
                  />
                </span>

                <span className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[11px] text-faint">
                  <span>{pct}% covered</span>
                  {open > 0 && <span>· {open} open</span>}
                  {p.waiting > 0 && <span className="text-accent">· {p.waiting} waiting</span>}
                </span>
              </Link>

              {/* Hidden until the tile is hovered or something in it takes
                  focus: every project needs these, none of them needs to be
                  shouting while you are choosing which project to open. */}
              <div className="absolute top-4 right-4 flex items-center gap-2.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Link
                  href={`/project/${p.id}?tab=setup`}
                  aria-label={'Edit ' + (p.name || 'project')}
                  className="text-[11px] text-faint transition-colors hover:text-accent"
                >
                  Edit
                </Link>
                <form action={deleteProjectAction}>
                  <input type="hidden" name="projectId" value={p.id} />
                  <input type="hidden" name="orgSlug" value={org.slug} />
                  <button
                    type="submit"
                    aria-label={'Delete ' + (p.name || 'project')}
                    className="text-[11px] text-faint transition-colors hover:text-warn"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </li>
          );
        })}

        <li className="min-w-0">
          <Link
            href="/app/new"
            className="flex h-full min-h-[180px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong p-5 text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <span aria-hidden className="text-[26px] leading-none">+</span>
            <span className="text-[13px] font-medium">New project</span>
            <span className="text-[11px] text-faint">Start from a brief</span>
          </Link>
        </li>
      </ul>

    </AppShell>
  );
}

/**
 * No workspace yet.
 *
 * This used to be "Step 1 of 2" with a form on it, which turned signing up
 * into a two-screen gate before anyone had seen anything. Setup is its own
 * flow now, entered by choice — so this is a door, not a form.
 */
function Onboard({ email }: { email: string }) {
  return (
    <main className="pm-grain mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <Link href="/" className="font-display text-[15px] font-bold tracking-tight">
        Project<span className="text-accent">Match</span>
      </Link>

      <h1 className="mt-8 font-display text-2xl font-bold text-ink">You&rsquo;re in.</h1>
      <p className="mt-2 text-sm text-muted">
        Three short questions and you can start building teams. Signed in as {email}.
      </p>

      <Link
        href="/onboarding"
        className="mt-6 block rounded-xl bg-accent px-4 py-3 text-center text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
      >
        Set up
      </Link>
      <Link
        href="/"
        className="mt-3 text-center text-[12px] text-faint transition-colors hover:text-ink"
      >
        Look around first
      </Link>
    </main>
  );
}
