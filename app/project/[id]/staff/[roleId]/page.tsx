import AppShell from '@/components/app/AppShell';
import { notFound } from 'next/navigation';

import Avatar from '@/components/Avatar';
import { capacityVerdict } from '@/lib/capacity';
import { getCommitments } from '@/lib/data/allocations';
import { getDemoOrg } from '@/lib/data/orgs';
import { getProject } from '@/lib/data/projects';
import { listPeople } from '@/lib/data/people';
import { SEAT_FLOOR, rankCandidates, type Candidate } from '@/lib/engine/assemble';
import { diagnoseRole } from '@/lib/engine/feasibility';
import { labelOf } from '@/lib/engine/graph';
import { stretchPairs } from '@/lib/engine/growth';
import { coveringProvenance } from '@/lib/engine/score';

import { fillSeatAction, inviteAction } from './actions';

/**
 * Where the engine finally meets real data.
 *
 * Every slice before this one was plumbing — a database, a session, a row.
 * This is the first page where `rankCandidates` runs against a real org's
 * roster and a real project's seats, and where the product's actual claim
 * becomes visible on live data: candidates are ordered by what they *add to
 * this team as it currently stands*, not by how good they look alone. Seat
 * the strongest frontend developer and the next frontend developer's
 * contribution collapses, because the gap they would have filled is gone.
 *
 * The engine is imported and called directly here. It takes plain
 * `Person[]` and a plain `Brief` and knows nothing about Postgres, which is
 * why the same 51 tests still cover it unchanged.
 */
export default async function StaffSeatPage({
  params,
}: {
  params: Promise<{ id: string; roleId: string }>;
}) {
  const { id, roleId } = await params;

  const project = await getProject(id);
  if (!project) notFound();

  const role = project.roles.find((r) => r.id === roleId);
  if (!role) notFound();

  const [pool, demoOrg, commitments] = await Promise.all([
    listPeople(project.orgId),
    getDemoOrg(),
    getCommitments(project.orgId),
  ]);

  // Someone already awaiting an answer on another seat of this project is
  // spoken for. The engine only knows about *filled* seats — an invitation is
  // not a commitment, so it must not count toward coverage — which leaves
  // this exclusion to the caller.
  const invitedElsewhere = new Set(
    project.invitedPersonIds.filter((pid) => pid !== project.seats[role.id]?.person?.id),
  );
  const available = pool.filter((p) => !invitedElsewhere.has(p.id));

  const ranked = rankCandidates(available, role, project.brief, project.team, {
    sort: 'bestFit',
    scope: { companyId: null, office: null },
    search: '',
    minHours: 0,
  });

  // Candidates who would be a stretch assignment here: junior in a skill
  // this project's current members are strong in — someone to learn from.
  const growsHere = new Set(
    project.members.length > 0
      ? stretchPairs(project.members).map((p) => p.learnerId)
      : [],
  );
  const wouldGrow = (person: (typeof pool)[number]) =>
    project.members.length > 0 &&
    stretchPairs([person, ...project.members]).some(
      (p) => p.learnerId === person.id && !growsHere.has(person.id),
    );

  // If this seat is open because someone declined it, that person still
  // appears in the ranking — a small roster can't afford to hide anyone — but
  // asking them again is not the next move, so they sink to the bottom and
  // lose the Invite button. The ranking itself is already computed fresh
  // against `project.team` as it stands right now; the decline is just what
  // sent the owner back here to look at it.
  const decline = project.declines[role.id];
  const declinedIds = new Set(decline?.personIds ?? []);

  /*
   * Two different questions, and conflating them produced a genuinely wrong
   * ranking here before:
   *
   *   roleMatch — can this person credibly hold *this* seat?
   *   gapFill   — how much of what the *whole team* still lacks do they close?
   *
   * gapFill is the product's real idea, and it is what should order people
   * once they are plausible for the seat. But it is computed across every
   * requirement in the brief, so a designer who fully covers the design role
   * scores exactly as highly as a frontend engineer when you are looking at
   * the frontend seat — identical numbers, completely different suitability.
   * Ranking on it alone put a product designer at the top of a backend seat.
   *
   * So: split on the engine's own floor, rank by contribution within each
   * group, and never let someone who cannot hold the seat outrank someone
   * who can. rankCandidates applies this floor itself, but only when at
   * least three people clear it — on a small roster it falls back to
   * everyone, which is where this went wrong.
   */
  const candidates = [...ranked].sort((a, b) => {
    const aDecl = declinedIds.has(a.person.id);
    const bDecl = declinedIds.has(b.person.id);
    if (aDecl !== bDecl) return aDecl ? 1 : -1;
    const aFits = a.roleMatch >= SEAT_FLOOR;
    const bFits = b.roleMatch >= SEAT_FLOOR;
    if (aFits !== bFits) return aFits ? -1 : 1;
    return b.breakdown.gapFill - a.breakdown.gapFill || b.roleMatch - a.roleMatch;
  });

  const qualified = candidates.filter((c) => c.roleMatch >= SEAT_FLOOR);
  const stretch = candidates.filter((c) => c.roleMatch < SEAT_FLOOR);

  // Whoever currently holds this seat, filled or merely invited.
  const seatedId = project.seats[role.id]?.person?.id ?? null;

  // The demo org is readable by anyone and writable by nobody — that is the
  // policy, and it is correct. So don't offer a button here that the database
  // will refuse: say why instead, rather than letting an RLS rejection
  // surface as a 500.
  const readOnly = demoOrg !== null && project.orgId === demoOrg.id;

  return (
    <AppShell back={{ href: `/project/${project.id}`, label: "Back to project" }}>
      <div>
        <p className="text-[11px] tracking-wide text-faint uppercase">Staffing</p>
        <h1 className="mt-1 font-display text-lg font-semibold text-ink">{role.title}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {role.requirements.map((req) => (
            <span
              key={req.skillId}
              className="rounded-full border border-line px-2 py-0.5 text-[11px] text-faint"
            >
              {labelOf(req.skillId)}
            </span>
          ))}
        </div>

        {decline && (
          <div className="mt-5 rounded-xl border border-line border-l-2 border-l-warn bg-panel px-4 py-3.5">
            <p className="text-[13px] font-medium text-ink">
              {decline.personName} declined this seat
              {decline.personIds.length > 1 &&
                `, along with ${decline.personIds.length - 1} other${
                  decline.personIds.length - 1 === 1 ? '' : 's'
                }`}
              .
            </p>
            <p className="mt-1 text-[12px] text-muted">
              Re-ranked against the team as it now stands.
            </p>
          </div>
        )}

        <p className="mt-5 text-[12px] text-muted">
          Ranked by what they <span className="text-ink">add to this team</span>, not how good they
          look alone.
        </p>

        {qualified.length === 0 && <Infeasibility diagnosis={diagnoseRole(available, role)} />}

        <section className="mt-4 rounded-xl border border-line bg-panel">
          {qualified.length === 0 ? (
            <p className="p-4 text-[13px] text-faint italic">
              Nobody on the roster can credibly hold this seat yet.
            </p>
          ) : (
            <ul>
              {qualified.slice(0, 12).map((c) => (
                <CandidateRow
                  key={c.person.id}
                  candidate={c}
                  isSeated={c.person.id === seatedId}
                  hasDeclined={declinedIds.has(c.person.id)}
                  trust={coveringProvenance(c.person, role.requirements)}
                  growth={wouldGrow(c.person)}
                  committed={commitments.get(c.person.id)}
                  roleHours={role.hoursNeeded}
                  projectId={project.id}
                  roleId={role.id}
                  readOnly={readOnly}
                />
              ))}
            </ul>
          )}
        </section>

        {stretch.length > 0 && (
          <>
            <h2 className="mt-8 text-[13px] font-medium text-ink">Below the bar for this seat</h2>
            <p className="mt-1 text-[12px] text-muted">
              They may still add a lot to the team — a different question from doing this job.
            </p>
            <section className="mt-3 rounded-xl border border-line border-dashed bg-panel opacity-75">
              <ul>
                {stretch.slice(0, 8).map((c) => (
                  <CandidateRow
                    key={c.person.id}
                    candidate={c}
                    isSeated={c.person.id === seatedId}
                    hasDeclined={declinedIds.has(c.person.id)}
                    trust={coveringProvenance(c.person, role.requirements)}
                  growth={wouldGrow(c.person)}
                    committed={commitments.get(c.person.id)}
                    roleHours={role.hoursNeeded}
                    projectId={project.id}
                    roleId={role.id}
                    readOnly={readOnly}
                  />
                ))}
              </ul>
            </section>
          </>
        )}

        <p className="mt-3 text-[11px] text-faint">
          {readOnly
            ? 'Demo organisation — read only.'
            : 'Inviting holds the seat. It is theirs once they accept.'}
        </p>
      </div>
    </AppShell>
  );
}

/**
 * When the seat cannot be filled from the roster, say what is actually
 * missing and what is cheapest to change — rather than a dead end.
 */
function Infeasibility({ diagnosis }: { diagnosis: ReturnType<typeof diagnoseRole> }) {
  const { unmet } = diagnosis;
  if (unmet.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-line border-l-2 border-l-warn bg-panel px-4 py-3.5">
      <p className="text-[13px] font-medium text-ink">
        This seat cannot be filled from the roster as it stands.
      </p>
      <ul className="mt-2 space-y-1">
        {unmet.map((u) => {
          const short = u.closest ? Math.max(1, u.minLevel - u.closest.level) : 0;
          return (
            <li key={u.skillId} className="text-[12px] text-muted">
              <span className="text-ink">{u.label}</span>{' '}
              {u.closest
                ? `— ${u.closest.name} is closest, ${short} level${short === 1 ? '' : 's'} short of the ${u.minLevel} this seat needs`
                : '— nobody on the roster has it or anything close'}
            </li>
          );
        })}
      </ul>
      <p className="mt-2.5 text-[11px] text-faint">
        Cheapest fixes: bring someone in with{' '}
        {unmet.map((u) => u.label).join(', ')}; lower the level bar on this role; or drop a
        requirement the project can do without.
      </p>
    </div>
  );
}

/**
 * Both numbers, always, because either one alone misleads: fit without
 * contribution hides the whole point of the product, and contribution without
 * fit is what let a designer top the ranking for a backend seat.
 */
type Trust = ReturnType<typeof coveringProvenance>;

const TRUST_TAG: Partial<Record<Trust, { label: string; className: string }>> = {
  verified: { label: 'verified', className: 'border-good/40 text-good' },
  endorsed: { label: 'endorsed', className: 'border-accent/40 text-accent' },
  extracted: { label: 'from résumé', className: 'border-line text-faint' },
  self: { label: 'self-reported', className: 'border-line text-faint' },
};

function CandidateRow({
  candidate,
  isSeated,
  hasDeclined,
  trust,
  committed,
  roleHours,
  growth,
  projectId,
  roleId,
  readOnly,
}: {
  candidate: Candidate;
  isSeated: boolean;
  hasDeclined: boolean;
  trust: Trust;
  committed?: { hours: number; projects: number };
  roleHours: number;
  growth: boolean;
  projectId: string;
  roleId: string;
  readOnly: boolean;
}) {
  const fit = Math.round(candidate.roleMatch * 100);
  const contribution = Math.round(candidate.breakdown.gapFill * 100);
  const tag = TRUST_TAG[trust];

  const load = committed?.hours ?? 0;
  const verdict = capacityVerdict(load, roleHours, candidate.person.hoursPerWeek);

  return (
    <li className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <Avatar person={candidate.person} size={32} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[13px] font-medium">
          {candidate.person.name}
          {tag && (
            <span className={`rounded-full border px-1.5 py-0 text-[10px] font-normal ${tag.className}`}>
              {tag.label}
            </span>
          )}
          {growth && (
            <span className="rounded-full border border-accent/40 px-1.5 py-0 text-[10px] font-normal text-accent">
              growth
            </span>
          )}
          {verdict !== 'clear' && (
            <span
              className={`rounded-full border px-1.5 py-0 text-[10px] font-normal ${
                verdict === 'over' ? 'border-warn/40 text-warn' : 'border-line text-faint'
              }`}
            >
              {verdict === 'over' ? 'over capacity' : 'near capacity'}
            </span>
          )}
        </p>
        <p className="truncate text-[12px] text-muted">
          {candidate.person.title || 'No title yet'} &middot; {candidate.person.hoursPerWeek} hrs/wk
          {load > 0 &&
            ` · ${load} committed across ${committed?.projects} project${
              committed?.projects === 1 ? '' : 's'
            }`}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={`font-display text-[15px] font-semibold ${fit >= 35 ? 'text-good' : 'text-warn'}`}
        >
          {fit}%
        </p>
        <p className="text-[10px] text-faint">fit</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-display text-[15px] font-semibold text-ink">{contribution}%</p>
        <p className="text-[10px] text-faint">adds</p>
      </div>

      {readOnly ? (
        isSeated && (
          <span className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted">
            Seated
          </span>
        )
      ) : isSeated ? (
        <form action={fillSeatAction} className="shrink-0">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="roleId" value={roleId} />
          <input type="hidden" name="personId" value="" />
          <button
            type="submit"
            className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-muted transition-opacity hover:opacity-90"
          >
            Remove
          </button>
        </form>
      ) : hasDeclined ? (
        <span className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[12px] text-faint">
          Declined
        </span>
      ) : (
        <form action={inviteAction} className="shrink-0">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="roleId" value={roleId} />
          <input type="hidden" name="personId" value={candidate.person.id} />
          <button
            type="submit"
            className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-panel transition-opacity hover:opacity-90"
          >
            Invite
          </button>
        </form>
      )}
    </li>
  );
}
