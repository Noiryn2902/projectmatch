import Link from 'next/link';
import { notFound } from 'next/navigation';

import Avatar from '@/components/Avatar';
import { getDemoOrg } from '@/lib/data/orgs';
import { getProject } from '@/lib/data/projects';
import { listPeople } from '@/lib/data/people';
import { SEAT_FLOOR, rankCandidates, type Candidate } from '@/lib/engine/assemble';
import { labelOf } from '@/lib/engine/graph';
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

  const [pool, demoOrg] = await Promise.all([listPeople(project.orgId), getDemoOrg()]);

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
    <main className="pm-grain min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-5 py-3">
          <Link href={`/project/${project.id}`} className="text-[13px] text-muted hover:text-ink">
            &larr; Back to project
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[720px] px-5 py-10">
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
              The seat is open again. Below is the roster ranked against the team as it stands right
              now — whoever declined is kept in view but moved to the end.
            </p>
          </div>
        )}

        <p className="mt-5 text-[12px] text-muted">
          Among people who can hold this seat, ranked by what they add to the team as it already
          stands — not by how strong they look on their own. A{' '}
          <span className="text-faint">self-reported</span> tag means the engine has already
          discounted that person&rsquo;s levels: an endorsed or verified skill counts for more than
          one someone typed about themselves.
        </p>

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
              Shown because the roster is small. Their contribution to the wider team can still look
              high — that is a different question from whether they can do this job.
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
            ? 'This is the demo organisation — anyone can look at it, nobody can change it. Create your own organisation to staff a project for real.'
            : 'Inviting holds the seat but does not fill it. It is theirs once they accept, and reopens if they decline.'}
        </p>
      </div>
    </main>
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
  projectId,
  roleId,
  readOnly,
}: {
  candidate: Candidate;
  isSeated: boolean;
  hasDeclined: boolean;
  trust: Trust;
  projectId: string;
  roleId: string;
  readOnly: boolean;
}) {
  const fit = Math.round(candidate.roleMatch * 100);
  const contribution = Math.round(candidate.breakdown.gapFill * 100);
  const tag = TRUST_TAG[trust];

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
        </p>
        <p className="truncate text-[12px] text-muted">
          {candidate.person.title || 'No title yet'} &middot; {candidate.person.hoursPerWeek} hrs/wk
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
