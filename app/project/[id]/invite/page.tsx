import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import Avatar from '@/components/Avatar';
import StepBar from '@/components/StepBar';
import { getDemoOrg, listOrgsForUser } from '@/lib/data/orgs';
import { listInvitationTiles } from '@/lib/data/invitations';
import { getProject } from '@/lib/data/projects';
import { listCandidatePool } from '@/lib/data/people';
import { SEAT_FLOOR, rankCandidates } from '@/lib/engine/assemble';
import { hasDatabase } from '@/lib/env';
import type { Person } from '@/lib/types';

import { sendInvitesAction } from './actions';

/**
 * Step four: asking.
 *
 * One card per seat, showing who is going to be asked — the people picked in
 * step three when they came from a real roster, otherwise the engine's own
 * choice from it. Nothing has been sent when this page loads; that is the
 * point of the step. You write the note, you look at the team once more, and
 * then you send.
 *
 * A card that has already been answered stops being a proposal and becomes a
 * record: sent, accepted, or declined, with a way back into the ranking for
 * that one seat if the answer was no.
 */
export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ picks?: string; sent?: string }>;
}) {
  const { id } = await params;
  const { picks, sent } = await searchParams;

  if (!hasDatabase) notFound();

  const project = await getProject(id);
  if (!project) notFound();

  const demoOrg = await getDemoOrg();
  if (demoOrg && project.orgId === demoOrg.id) redirect(`/project/${project.id}`);

  const orgs = await listOrgsForUser();
  const org = orgs.find((o) => o.id === project.orgId) ?? orgs[0];

  const [pool, answered] = await Promise.all([
    listCandidatePool(project.orgId),
    listInvitationTiles(project.id),
  ]);
  const byId = new Map(pool.map((p) => [p.id, p]));

  // Newest first out of the query, and a seat can have been asked more than
  // once — so keep the first sighting of each role and let the later, older
  // rows fall away. Building the map the obvious way does the opposite, and
  // a re-invited seat would show the decline it had already moved past.
  const answeredByRole = new Map<string, (typeof answered)[number]>();
  for (const a of answered) if (!answeredByRole.has(a.roleId)) answeredByRole.set(a.roleId, a);

  // What step three chose, if it came through.
  const chosen = new Map<string, string>();
  for (const pair of (picks ?? '').split(',')) {
    const [roleId, personId] = pair.split(':');
    if (roleId && personId) chosen.set(roleId, personId);
  }

  // Arriving with picks means someone has just been through the ranking, so
  // their answer stands — including the seats they left alone, which show as
  // empty rather than quietly acquiring a stranger. Arriving without any
  // (a revisit, or Skip on the way out) is the case where a suggestion is
  // worth something.
  const suggest = chosen.size === 0;

  // Every seat still waiting on someone, with who we mean to ask.
  const taken = new Set<string>();
  const cards = project.roles.map((role) => {
    const already = answeredByRole.get(role.id);
    const seat = project.seats[role.id];

    let person: Person | null = null;
    let fit: number | null = null;

    if (!already && seat?.state === 'open') {
      const pickedId = chosen.get(role.id);
      const picked = pickedId ? byId.get(pickedId) : undefined;
      if (picked && !taken.has(picked.id)) {
        person = picked;
      } else if (suggest) {
        const ranked = rankCandidates(
          pool.filter((p) => !taken.has(p.id)),
          role,
          project.brief,
          project.team,
          { sort: 'bestFit', scope: { companyId: null, office: null }, search: '', minHours: 0 },
        );
        const best = ranked.find((c) => c.roleMatch >= SEAT_FLOOR);
        person = best?.person ?? null;
      }
      if (person) {
        taken.add(person.id);
        fit = rankCandidates([person], role, project.brief, project.team, {
          sort: 'bestFit',
          scope: { companyId: null, office: null },
          search: '',
          minHours: 0,
        })[0]?.roleMatch ?? null;
      }
    }

    return { role, already, person, fit, seated: seat?.person ?? null };
  });

  // The picks as this page is actually showing them — your choices from step
  // three plus whatever the engine filled in. Carried into a re-pick so
  // changing one seat never costs you the other five.
  const livePicks = cards
    .filter((c) => c.person)
    .map((c) => `${c.role.id}:${c.person!.id}`)
    .join(',');

  const toSend = cards.filter((c) => !c.already && c.person);
  const allAnswered = cards.every((c) => c.already || c.seated);

  // An unnamed project has not been through the naming step, so that is
  // where onward goes — once, and never again after it has a name. status is
  // no help: create_project stamps every new project 'staffing'.
  const onward = project.name.trim()
    ? `/project/${project.id}`
    : `/project/${project.id}/name`;

  return (
    <div className="pm-grain min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[900px] items-center justify-between gap-3 px-5 py-3">
          <Link href="/" className="font-display text-[15px] font-bold tracking-tight">
            Project<span className="text-accent">Match</span>
          </Link>
          <Link
            href="/app"
            className="text-[12px] text-faint transition-colors hover:text-ink"
          >
            All projects
          </Link>
        </div>
        {/* Back returns to the ranking with every pick intact, so coming here
            to look is not a decision. */}
        <div className="mx-auto max-w-[900px]">
          <StepBar
            step={4}
            back={{
              href: `/project/${project.id}/staff/${project.roles[0]?.id ?? ''}?back=invite&picks=${encodeURIComponent(livePicks)}`,
              label: 'Choose again',
            }}
            next={{ href: onward, label: allAnswered ? 'Workspace' : 'Skip for now' }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-5 py-10">
        <p className="text-[11px] tracking-wide text-faint uppercase">Step 4 of 5 — asking</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">Ask your team</h1>
        <p className="mt-2 max-w-[60ch] text-[13px] text-muted">
          Nothing has been sent yet. Each of these gets a link they can accept or decline — it
          works even if they have never signed in.
        </p>

        {sent && (
          <div className="mt-6 rounded-xl border border-line border-l-2 border-l-good bg-panel px-4 py-3 text-[13px] text-ink">
            {sent === '0'
              ? 'Nothing went out — those seats may already have an invitation.'
              : `${sent} ${Number(sent) === 1 ? 'invitation' : 'invitations'} sent.`}
          </div>
        )}

        <form action={sendInvitesAction} className="mt-6">
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="picks" value={livePicks} />

          <label htmlFor="message" className="block text-[13px] font-medium text-ink">
            A note to send with it
          </label>
          <p className="mt-0.5 text-[12px] text-muted">
            Introduce yourself and the work. Goes to everyone, unless a card overrides it.
          </p>
          <textarea
            id="message"
            name="message"
            rows={3}
            maxLength={500}
            placeholder="We're starting this next month and I'd like you on it because…"
            className="mt-2 w-full resize-y rounded-xl border border-line bg-panel px-4 py-3 text-[13px] outline-none transition-colors focus:border-accent"
          />

          <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {cards.map(({ role, already, person, fit, seated }) => (
              <li
                key={role.id}
                className="flex flex-col rounded-xl border border-line bg-panel p-4"
              >
                <div className="flex items-start gap-3">
                  {person || already || seated ? (
                    <Avatar
                      person={
                        person ??
                        seated ??
                        ({
                          name: already!.personName,
                          hue: already!.personHue,
                          ...(already!.personPhoto ? { photo: already!.personPhoto } : {}),
                        } as Person)
                      }
                      size={40}
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="size-10 shrink-0 rounded-full border border-dashed border-line-strong"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {person?.name ?? seated?.name ?? already?.personName ?? 'Nobody chosen'}
                    </p>
                    <p className="truncate text-[12px] text-muted">{role.title}</p>
                    {fit !== null && (
                      <p className="text-[11px] text-faint">{Math.round(fit * 100)}% role fit</p>
                    )}
                  </div>

                  {already ? (
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${
                        already.status === 'accepted'
                          ? 'border-good/40 text-good'
                          : already.status === 'declined'
                            ? 'border-warn/40 text-warn'
                            : 'border-line text-faint'
                      }`}
                    >
                      {already.status === 'accepted'
                        ? 'Accepted'
                        : already.status === 'declined'
                          ? 'Declined'
                          : 'Sent'}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] text-faint">
                      Not sent
                    </span>
                  )}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  {(person || already) && org && (
                    <Link
                      href={`/app/org/${org.slug}/people/${person?.id ?? already!.personId}`}
                      className="text-accent hover:underline"
                    >
                      Explore
                    </Link>
                  )}
                  {/* Back into the ranking for this one seat, carrying every
                      other pick so nothing else has to be chosen twice. */}
                  <Link
                    href={`/project/${project.id}/staff/${role.id}?back=invite&picks=${encodeURIComponent(livePicks)}`}
                    className="text-muted hover:text-ink"
                  >
                    {already?.status === 'declined'
                      ? 'Choose someone else'
                      : person
                        ? 'Change'
                        : 'Choose someone'}
                  </Link>
                </div>

                {/* A personal line for this one, when the shared note is not
                    quite right. Optional, and the shared text covers it. */}
                {person && !already && (
                  <>
                    <input type="hidden" name="pair" value={`${role.id}:${person.id}`} />
                    <input
                      name={`note:${person.id}`}
                      maxLength={500}
                      placeholder={`Something just for ${person.name.split(' ')[0]} (optional)`}
                      aria-label={`Personal note for ${person.name}`}
                      className="mt-2.5 w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-[12px] outline-none transition-colors focus:border-accent"
                    />
                    <button
                      type="submit"
                      name="only"
                      value={`${role.id}:${person.id}`}
                      className="mt-2 self-start rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent"
                    >
                      Ask just {person.name.split(' ')[0]}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>

          {toSend.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-xl bg-accent px-5 py-2.5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
              >
                Send {toSend.length} {toSend.length === 1 ? 'invitation' : 'invitations'}
              </button>
              <span className="text-[12px] text-faint">
                They each get a link to accept or decline.
              </span>
            </div>
          )}

          {toSend.length === 0 && cards.every((c) => !c.already && !c.seated) && (
            <div className="mt-6 rounded-xl border border-line border-l-2 border-l-warn bg-panel px-4 py-3.5">
              <p className="text-[13px] font-medium text-ink">Nobody is chosen yet.</p>
              <p className="mt-1 text-[12px] text-muted">
                {pool.length === 0
                  ? 'There is nobody on this organisation\u2019s roster to choose from — add people first, then come back.'
                  : 'Pick someone for each role using “Choose someone” above, then send.'}
              </p>
              <Link
                href={
                  pool.length === 0
                    ? `/app/org/${org?.slug ?? ''}`
                    : `/project/${project.id}/staff/${project.roles[0]?.id ?? ''}?back=invite&picks=`
                }
                className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-panel transition-opacity hover:opacity-90"
              >
                {pool.length === 0 ? 'Add people to the roster →' : 'Choose the team →'}
              </Link>
            </div>
          )}

          {toSend.length === 0 && cards.some((c) => c.already || c.seated) && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={onward}
                className="rounded-xl bg-accent px-5 py-2.5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
              >
                Open the workspace →
              </Link>
              <span className="text-[12px] text-faint">Everyone has been asked.</span>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
