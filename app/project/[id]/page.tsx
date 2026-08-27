import Link from 'next/link';
import { notFound } from 'next/navigation';

import Avatar from '@/components/Avatar';
import { hasDatabase } from '@/lib/env';
import { getDemoOrg } from '@/lib/data/orgs';
import { listPendingInvitations } from '@/lib/data/invitations';
import { getProject } from '@/lib/data/projects';
import { labelOf } from '@/lib/engine/graph';

import { revokeInvitationAction } from './actions';

/**
 * The first real, URL-addressable project page.
 *
 * This is a read view, deliberately. Two things are missing that the
 * in-memory builder has — editing the team, and chat — and both are missing
 * for the same reason: they need a real signed-in identity behind them, which
 * Phase 0's auth work makes possible but which nothing has been wired up to
 * yet. Building an editable team or a chat panel on top of the old
 * localStorage identity here would re-entrench exactly the thing Phase 0 is
 * replacing. Those come with Phase 1 (org membership) and Phase 2
 * (invitations), once there is someone real to attribute an edit or a
 * message to.
 */
export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invited?: string; emailed?: string; revoked?: string }>;
}) {
  const { id } = await params;
  const { invited, emailed, revoked } = await searchParams;

  if (!hasDatabase) {
    // Nothing before this route had a concept of a persisted project — there
    // is no seeded-data fallback to degrade to, so say so plainly rather than
    // pretend a broken query is a missing project.
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-lg font-semibold text-ink">No database configured</h1>
        <p className="mt-2 text-sm text-muted">
          This deployment has no database, so there is no persisted project to show.{' '}
          <Link href="/" className="text-accent underline underline-offset-2">
            Try the live builder instead
          </Link>
          .
        </p>
      </main>
    );
  }

  const project = await getProject(id);
  if (!project) notFound();

  // Same reasoning as the staffing page: the demo org is readable by anyone
  // and writable by nobody, so don't offer a way in to a page whose only
  // action the database will refuse.
  const demoOrg = await getDemoOrg();
  const readOnly = demoOrg !== null && project.orgId === demoOrg.id;

  const pending = readOnly ? [] : await listPendingInvitations(project.id);

  const { brief, roles, health, seats, declines } = project;
  const pct = Math.round(health.coverage * 100);
  // A decline the owner can still do something about — the demo org can't be
  // staffed at all, so there is nothing to surface there.
  const declineCount = readOnly ? 0 : Object.keys(declines).length;

  return (
    <main className="pm-grain min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[860px] items-center justify-between px-5 py-3">
          <Link href="/" className="font-display text-[17px] font-bold tracking-tight">
            Project<span className="text-accent">Match</span>
          </Link>
          <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted uppercase">
            {project.status}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[860px] px-5 py-10">
        <p className="text-[11px] tracking-wide text-faint uppercase">
          {project.name || 'Untitled project'}
        </p>
        <h1 className="mt-1 max-w-[46ch] font-display text-2xl font-bold text-balance">
          {brief.text}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted">
          <span>{brief.durationWeeks} weeks</span>
          {brief.domain.map((d) => (
            <span key={d} className="rounded-full border border-line px-2 py-0.5 capitalize">
              {d}
            </span>
          ))}
        </div>

        {invited && (
          <div className="mt-6 rounded-xl border border-line border-l-2 border-l-accent bg-panel px-4 py-3.5">
            <p className="text-[13px] font-medium text-ink">
              {emailed ? 'Invitation emailed' : 'Invitation ready to send'}
            </p>
            <p className="mt-1 text-[12px] text-muted">
              {emailed
                ? 'The link is on its way to their inbox. Here it is too, in case you need to pass it along another way.'
                : 'No email went out — either there is no address on file or email is not configured here. Copy this link to the person you are inviting; it works for someone with no account.'}
            </p>
            <code className="mt-2.5 block overflow-x-auto rounded-lg border border-line bg-canvas px-3 py-2 text-[11px] break-all text-accent">
              /invite/{invited}
            </code>
          </div>
        )}

        {declineCount > 0 && (
          <div className="mt-6 rounded-xl border border-line border-l-2 border-l-warn bg-panel px-4 py-3.5">
            <p className="text-[13px] font-medium text-ink">
              {declineCount === 1
                ? 'A seat was declined and is open again'
                : `${declineCount} seats were declined and are open again`}
            </p>
            <p className="mt-1 text-[12px] text-muted">
              Open one below to see the roster re-ranked against the team as it now stands.
            </p>
          </div>
        )}

        {revoked && (
          <div className="mt-6 rounded-xl border border-line border-l-2 border-l-warn bg-panel px-4 py-3.5 text-[13px] text-ink">
            Invitation withdrawn. The seat is open again.
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_260px]">
          <section className="rounded-xl border border-line bg-panel">
            <ul>
              {roles.map((role) => {
                const seat = seats[role.id] ?? { state: 'open' as const, person: null };
                const person = seat.person;
                const awaiting = seat.state === 'invited';
                const declined = seat.state === 'open' ? declines[role.id] : undefined;
                return (
                  <li key={role.id} className="border-b border-line px-4 py-3 last:border-b-0">
                    <div className="flex items-center gap-3">
                      {person ? (
                        <span className={awaiting ? 'opacity-50' : undefined}>
                          <Avatar person={person} size={32} />
                        </span>
                      ) : (
                        <span
                          aria-hidden
                          className="size-8 shrink-0 rounded-full border border-dashed border-line-strong"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium">{role.title}</p>
                        <p
                          className={`truncate text-[12px] ${
                            seat.state === 'filled'
                              ? 'text-muted'
                              : declined
                                ? 'text-warn'
                                : 'text-faint italic'
                          }`}
                        >
                          {awaiting && person
                            ? person.name + ' — invited, awaiting reply'
                            : person
                              ? person.name
                              : declined
                                ? `${declined.personName} declined — seat reopened`
                                : 'Open seat'}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-faint">
                        {role.hoursNeeded} hrs/wk
                      </span>
                      <Link
                        href={`/project/${project.id}/staff/${role.id}`}
                        className={`shrink-0 rounded-lg border px-3 py-1.5 text-[12px] transition-colors ${
                          declined
                            ? 'border-warn/40 text-warn hover:border-warn'
                            : 'border-line text-muted hover:border-line-strong hover:text-ink'
                        }`}
                      >
                        {readOnly
                          ? 'See ranking'
                          : declined
                            ? 'Ask someone else'
                            : seat.state === 'filled'
                              ? 'Change'
                              : 'Find someone'}
                      </Link>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-11">
                      {role.requirements.map((req) => (
                        <span
                          key={req.skillId}
                          className="rounded-full border border-line px-2 py-0.5 text-[11px] text-faint"
                        >
                          {labelOf(req.skillId)}
                        </span>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl border border-line bg-panel p-4">
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="text-muted">Requirements covered</span>
                <span className="font-display text-[15px] font-semibold text-good">{pct}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
                <div
                  className="h-full rounded-full bg-good transition-all duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-faint">
                {health.filled} of {health.seats} seats filled &middot; {health.overlapHours} hrs/wk
                overlap
              </p>
            </section>

            <section className="rounded-xl border border-line border-l-2 border-l-accent bg-panel px-4 py-3.5">
              <h2 className="text-[13px] font-medium">
                {health.gaps.length > 0 ? 'Still uncovered' : 'No gaps detected'}
              </h2>
              {health.gaps.length === 0 ? (
                <p className="mt-2 text-[12px] text-faint">
                  Every requirement is covered and availability aligns.
                </p>
              ) : (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {health.gaps.map((g) => (
                    <span
                      key={g.label}
                      className={`rounded-full border px-2.5 py-1 text-[12px] ${
                        g.severity === 'high'
                          ? 'border-warn/40 bg-warn-soft text-warn'
                          : 'border-accent/40 bg-accent-soft text-accent'
                      }`}
                    >
                      {g.label}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>

        {pending.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-[15px] font-semibold text-ink">Awaiting a reply</h2>
            <p className="mt-1 text-[12px] text-muted">
              These seats are held, not filled. Withdrawing one reopens it immediately.
            </p>
            <ul className="mt-3 rounded-xl border border-line bg-panel">
              {pending.map((inv) => (
                <li
                  key={inv.token}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium">
                      {inv.personName}{' '}
                      <span className="font-normal text-muted">&middot; {inv.roleTitle}</span>
                    </p>
                    <code className="mt-1 block overflow-x-auto text-[11px] break-all text-accent">
                      /invite/{inv.token}
                    </code>
                  </div>
                  <span className="shrink-0 text-[11px] text-faint">
                    expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                  <form action={revokeInvitationAction} className="shrink-0">
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="roleId" value={inv.roleId} />
                    <button
                      type="submit"
                      className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:border-warn/40 hover:text-warn"
                    >
                      Withdraw
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
