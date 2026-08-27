import Link from 'next/link';
import { notFound } from 'next/navigation';

import Avatar from '@/components/Avatar';
import { getProject } from '@/lib/data/projects';
import { listPeople } from '@/lib/data/people';
import { membersOf } from '@/lib/engine/assemble';
import { proposeTeams } from '@/lib/engine/options';

/**
 * The advisory view: two or three whole teams the roster could field for
 * this brief, with the tradeoff between them named. It proposes; the
 * per-seat pages under this one are where a choice is acted on.
 */
export default async function StaffOptionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await getProject(id);
  if (!project) notFound();

  const pool = await listPeople(project.orgId);
  const options = proposeTeams(project.brief, pool, { companyId: null, office: null });

  return (
    <main className="pm-grain min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[860px] items-center justify-between px-5 py-3">
          <Link href={`/project/${project.id}`} className="text-[13px] text-muted hover:text-ink">
            &larr; Back to project
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[860px] px-5 py-10">
        <p className="text-[11px] tracking-wide text-faint uppercase">Staffing options</p>
        <h1 className="mt-1 max-w-[46ch] font-display text-xl font-semibold text-balance">
          {project.brief.text}
        </h1>
        <p className="mt-2 text-[12px] text-muted">
          {options.length === 1
            ? 'The roster fields one sensible team for this brief.'
            : `${options.length} teams the roster could field, and what you trade between them. Nothing is assigned — open a seat to act.`}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {options.map((opt) => {
            const members = membersOf(opt.team, pool);
            return (
              <section key={opt.key} className="rounded-xl border border-line bg-panel p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-[15px] font-semibold text-ink">{opt.label}</h2>
                  <span className="font-display text-[15px] font-semibold text-good">
                    {Math.round(opt.coverage * 100)}%
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-faint">
                  bus factor {opt.busFactor} &middot; {opt.spareHours} spare hrs/wk per person
                </p>
                {opt.tradeoff && (
                  <p className="mt-2 text-[12px] text-muted">
                    <span className="text-faint">vs best coverage:</span> {opt.tradeoff}
                  </p>
                )}

                <ul className="mt-3 space-y-1.5">
                  {project.roles.map((role) => {
                    const person = members.find((m) => m.id === opt.team[role.id]);
                    return (
                      <li key={role.id} className="flex items-center gap-2 text-[12px]">
                        {person ? (
                          <Avatar person={person} size={20} />
                        ) : (
                          <span className="size-5 shrink-0 rounded-full border border-dashed border-line-strong" />
                        )}
                        <span className="text-muted">{role.title}</span>
                        <span className="ml-auto text-ink">
                          {person?.name ?? <span className="text-faint italic">no fit</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-line bg-panel px-4 py-3">
          <p className="text-[12px] text-muted">
            Act on any seat individually:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {project.roles.map((role) => (
              <Link
                key={role.id}
                href={`/project/${project.id}/staff/${role.id}`}
                className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                {role.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
