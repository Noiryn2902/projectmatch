import Link from 'next/link';
import { notFound } from 'next/navigation';

import Avatar from '@/components/Avatar';
import { getProject } from '@/lib/data/projects';
import { listPeople } from '@/lib/data/people';
import type { Person } from '@/lib/types';
import { autoFill, membersOf } from '@/lib/engine/assemble';
import { teamHealth } from '@/lib/engine/health';
import { keywordTeam } from '@/lib/engine/keyword';

/**
 * The counterfactual: the same brief and the same roster, staffed two ways —
 * a keyword filter, and the engine — side by side. Everything the engine
 * does that a filter cannot is visible here in one screen: it counts what a
 * person *adds* to the team being built, it knows adjacent skills, it sees
 * availability, and it will not seat a second person on a skill the first
 * already covers.
 *
 * Public on the demo org, on purpose — this is the page that makes the case.
 */
export default async function ComparePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await getProject(id);
  if (!project) notFound();

  const pool = await listPeople(project.orgId);
  const scope = { companyId: null, office: null };

  const kwTeam = keywordTeam(project.brief, pool, scope);
  const enTeam = autoFill(project.brief, pool, scope);

  const kw = teamHealth(project.brief, membersOf(kwTeam, pool), project.roles.length);
  const en = teamHealth(project.brief, membersOf(enTeam, pool), project.roles.length);
  const byId = new Map(pool.map((p) => [p.id, p]));

  const changed = project.roles.filter((r) => kwTeam[r.id] !== enTeam[r.id]);

  const deltas: string[] = [];
  const dCov = Math.round((en.coverage - kw.coverage) * 100);
  if (dCov !== 0) deltas.push(`${dCov > 0 ? '+' : ''}${dCov} points of requirement coverage`);
  if (en.busFactor > kw.busFactor)
    deltas.push(`bus factor ${kw.busFactor} → ${en.busFactor} (fewer single points of failure)`);
  if (en.overlapHours !== kw.overlapHours)
    deltas.push(`${en.overlapHours - kw.overlapHours > 0 ? '+' : ''}${en.overlapHours - kw.overlapHours} hrs/wk of overlapping availability`);
  if (en.stretch > kw.stretch)
    deltas.push(`${en.stretch - kw.stretch} more ${en.stretch - kw.stretch === 1 ? 'person' : 'people'} in a growth pairing`);

  return (
    <main className="pm-grain min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[900px] items-center justify-between px-5 py-3">
          <Link href={`/project/${project.id}`} className="text-[13px] text-muted hover:text-ink">
            &larr; Back to project
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[900px] px-5 py-10">
        <p className="text-[11px] tracking-wide text-faint uppercase">Same brief, same roster</p>
        <h1 className="mt-1 max-w-[46ch] font-display text-xl font-semibold text-balance">
          {project.brief.text}
        </h1>
        <p className="mt-2 text-[12px] text-muted">
          A keyword filter matches skill words and sorts by seniority. The engine scores what each
          person adds to the team as it is built, knows adjacent skills, and weighs availability.
        </p>

        <div className="mt-6 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead className="bg-panel">
              <tr className="text-[11px] tracking-wide text-faint uppercase">
                <th className="px-4 py-2.5 font-medium">Seat</th>
                <th className="px-4 py-2.5 font-medium">Keyword filter</th>
                <th className="px-4 py-2.5 font-medium">ProjectMatch engine</th>
              </tr>
            </thead>
            <tbody>
              {project.roles.map((role) => {
                const kwP = kwTeam[role.id] ? byId.get(kwTeam[role.id]!) : null;
                const enP = enTeam[role.id] ? byId.get(enTeam[role.id]!) : null;
                const diff = kwTeam[role.id] !== enTeam[role.id];
                return (
                  <tr
                    key={role.id}
                    className={`border-t border-line ${diff ? 'bg-accent-soft/40' : ''}`}
                  >
                    <td className="px-4 py-2.5 text-muted">{role.title}</td>
                    <td className="px-4 py-2.5">
                      <Cell person={kwP} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Cell person={enP} highlight={diff} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-panel text-[12px]">
              <tr className="border-t border-line-strong">
                <td className="px-4 py-2.5 text-faint">Requirements covered</td>
                <td className="px-4 py-2.5 tabular-nums">{Math.round(kw.coverage * 100)}%</td>
                <td className="px-4 py-2.5 font-semibold tabular-nums text-good">
                  {Math.round(en.coverage * 100)}%
                </td>
              </tr>
              <tr className="border-t border-line">
                <td className="px-4 py-2.5 text-faint">Bus factor</td>
                <td className="px-4 py-2.5 tabular-nums">{kw.busFactor}</td>
                <td className="px-4 py-2.5 tabular-nums">{en.busFactor}</td>
              </tr>
              <tr className="border-t border-line">
                <td className="px-4 py-2.5 text-faint">Overlapping hours/wk</td>
                <td className="px-4 py-2.5 tabular-nums">{kw.overlapHours}</td>
                <td className="px-4 py-2.5 tabular-nums">{en.overlapHours}</td>
              </tr>
              <tr className="border-t border-line">
                <td className="px-4 py-2.5 text-faint">Growth pairings</td>
                <td className="px-4 py-2.5 tabular-nums">{kw.stretch}</td>
                <td className="px-4 py-2.5 tabular-nums">{en.stretch}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-6 rounded-xl border border-line border-l-2 border-l-accent bg-panel px-4 py-3.5">
          <p className="text-[13px] font-medium text-ink">
            {changed.length === 0
              ? 'On this brief the two agree on every seat.'
              : `The engine staffed ${changed.length} of ${project.roles.length} seats differently.`}
          </p>
          {deltas.length > 0 && (
            <p className="mt-1.5 text-[12px] text-muted">
              For the same people, that is {deltas.join(', ')}.
            </p>
          )}
          {changed.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[12px] text-muted">
              {changed.map((r) => {
                const k = kwTeam[r.id] ? byId.get(kwTeam[r.id]!)?.name : 'no one';
                const e = enTeam[r.id] ? byId.get(enTeam[r.id]!)?.name : 'no one';
                return (
                  <li key={r.id}>
                    <span className="text-faint">{r.title}:</span> {k} → <span className="text-ink">{e}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

function Cell({ person, highlight }: { person: Person | null | undefined; highlight?: boolean }) {
  if (!person) return <span className="text-faint italic">no fit</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <Avatar person={person} size={20} />
      <span className={highlight ? 'font-medium text-ink' : undefined}>{person.name}</span>
    </span>
  );
}
