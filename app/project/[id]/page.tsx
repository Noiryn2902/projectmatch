import Link from 'next/link';
import { notFound } from 'next/navigation';

import Avatar from '@/components/Avatar';
import { hasDatabase } from '@/lib/env';
import { getDemoOrg } from '@/lib/data/orgs';
import { getProject } from '@/lib/data/projects';
import { labelOf } from '@/lib/engine/graph';

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
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  const { brief, roles, team, members, health } = project;
  const memberById = new Map(members.map((m) => [m.id, m]));
  const pct = Math.round(health.coverage * 100);

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

        <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_260px]">
          <section className="rounded-xl border border-line bg-panel">
            <ul>
              {roles.map((role) => {
                const person = team[role.id] ? memberById.get(team[role.id]!) : undefined;
                return (
                  <li key={role.id} className="border-b border-line px-4 py-3 last:border-b-0">
                    <div className="flex items-center gap-3">
                      {person ? (
                        <Avatar person={person} size={32} />
                      ) : (
                        <span
                          aria-hidden
                          className="size-8 shrink-0 rounded-full border border-dashed border-line-strong"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium">{role.title}</p>
                        <p
                          className={`truncate text-[12px] ${person ? 'text-muted' : 'text-faint italic'}`}
                        >
                          {person ? person.name : 'Open seat'}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-faint">
                        {role.hoursNeeded} hrs/wk
                      </span>
                      <Link
                        href={`/project/${project.id}/staff/${role.id}`}
                        className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-ink"
                      >
                        {readOnly ? 'See ranking' : person ? 'Change' : 'Find someone'}
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
      </div>
    </main>
  );
}
