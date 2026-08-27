import Link from 'next/link';
import { redirect } from 'next/navigation';

import AppShell from '@/components/app/AppShell';
import Avatar from '@/components/Avatar';
import { listOrgsForUser } from '@/lib/data/orgs';
import { getMyWork } from '@/lib/data/me';
import { getPerson } from '@/lib/data/people';
import { listProjects } from '@/lib/data/projects';
import { getCurrentUser } from '@/lib/supabase/server';

import { createOrgAction } from './actions';

/**
 * The signed-in home, and the answer to "what am I looking at".
 *
 * It used to be a bare create-organisation form that redirected straight to
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
  const [work, projects] = await Promise.all([getMyWork(org.id), listProjects(org.id)]);
  const me = work.personId ? await getPerson(work.personId) : null;

  return (
    <AppShell
      org={org}
      notifications={work.invitations.length}
      tabs={[
        { href: '/app', label: 'Home' },
        { href: `/app/org/${org.slug}`, label: 'Organisation' },
      ]}
      active="/app"
      action={
        <Link
          href={`/app/org/${org.slug}/new`}
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
          href={`/app/org/${org.slug}/me`}
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

      <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_260px]">
        <section>
          <h2 className="text-[11px] tracking-wide text-faint uppercase">Your teams</h2>
          {work.teams.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-line bg-panel px-4 py-5 text-[13px] text-faint">
              {me
                ? 'Nothing yet. Teams you accept a seat on appear here.'
                : 'Add yourself to the roster and teams you join will appear here.'}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {work.teams.map((t) => (
                <li key={t.projectId}>
                  <Link
                    href={`/project/${t.projectId}`}
                    className="block rounded-xl border border-line bg-panel px-4 py-3.5 transition-colors hover:border-line-strong"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium text-ink">{t.projectName}</span>
                      <span className="shrink-0 text-[11px] text-faint uppercase">{t.status}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted">{t.brief}</span>
                    <span className="mt-1.5 block text-[11px] text-faint">
                      You are {t.roleTitle} &middot; {t.hoursNeeded} hrs/wk
                      {t.teammates > 0 &&
                        ` · with ${t.teammates} other${t.teammates === 1 ? '' : 's'}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          {me && (
            <Link
              href={`/app/org/${org.slug}/people/${me.id}`}
              className="block rounded-xl border border-line bg-panel p-4 transition-colors hover:border-line-strong"
            >
              <span className="flex items-center gap-3">
                <Avatar person={me} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink">{me.name}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {me.title || 'No title yet'}
                  </span>
                </span>
              </span>
              <span className="mt-3 block text-[11px] text-faint">
                {me.skills.length} skill{me.skills.length === 1 ? '' : 's'} &middot;{' '}
                {me.hoursPerWeek} hrs/wk free
              </span>
            </Link>
          )}

          <section className="rounded-xl border border-line bg-panel p-4">
            <h2 className="text-[11px] tracking-wide text-faint uppercase">{org.name}</h2>
            <p className="mt-2 text-[13px] text-ink">
              {projects.length} project{projects.length === 1 ? '' : 's'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/app/org/${org.slug}`}
                className="rounded-lg border border-line px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                Roster
              </Link>
              <Link
                href={`/app/org/${org.slug}/import`}
                className="rounded-lg border border-line px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                Import people
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

/** No organisation yet — one field, one button, nothing else on screen. */
function Onboard({ email }: { email: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <p className="text-[11px] tracking-wide text-faint uppercase">Step 1 of 2</p>
      <h1 className="mt-1 font-display text-2xl font-bold text-ink">Name your organisation</h1>
      <p className="mt-2 text-sm text-muted">
        The people you build teams from. Signed in as {email}.
      </p>

      <form action={createOrgAction} className="mt-6 space-y-3">
        <input
          type="text"
          name="name"
          required
          autoFocus
          placeholder="Acme Inc."
          aria-label="Organisation name"
          className="w-full rounded-full border border-line bg-panel px-4 py-2.5 text-[14px] outline-none transition-colors focus:border-accent"
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-accent px-4 py-3 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
