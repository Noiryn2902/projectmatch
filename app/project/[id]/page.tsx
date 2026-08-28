import Link from 'next/link';
import { notFound } from 'next/navigation';

import Avatar from '@/components/Avatar';
import { hasDatabase } from '@/lib/env';
import { getDemoOrg, listOrgsForUser } from '@/lib/data/orgs';
import { listInvitationTiles } from '@/lib/data/invitations';
import { ASSISTANT, chatIsOpen, listMessages } from '@/lib/data/messages';
import { getProject } from '@/lib/data/projects';
import { listCandidatePool } from '@/lib/data/people';
import { SEAT_FLOOR, rankCandidates } from '@/lib/engine/assemble';
import { labelOf } from '@/lib/engine/graph';
import {
  agendaFor,
  asClock,
  googleCalendarUrl,
  overlapWindow,
  proposeSlots,
} from '@/lib/meeting';
import type { Brief, Person, TeamHealth } from '@/lib/types';

import {
  deleteProjectAction,
  postMessageAction,
  renameProjectAction,
  revokeInvitationAction,
} from './actions';
import { inviteAction } from './staff/[roleId]/actions';

/**
 * The workspace — step five, and the page you live in once a team exists.
 *
 * The layout is the one from the original build, because it was right: a
 * header that says at a glance how the team is doing, tabs so one concern is
 * on screen at a time, and the people always visible down the side. What was
 * wrong with it was underneath — channels that did not exist, an assistant
 * that was not there, chat that synced between two tabs on one machine and
 * called itself live. Same shape, real data.
 */

type Tab = 'chat' | 'people' | 'seats' | 'kickoff' | 'setup';
const TABS: { id: Tab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'people', label: 'People' },
  { id: 'seats', label: 'Seats' },
  { id: 'kickoff', label: 'Kickoff' },
  { id: 'setup', label: 'Setup' },
];

export default async function ProjectWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    invited?: string;
    emailed?: string;
    revoked?: string;
    created?: string;
    renamed?: string;
    slot?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  if (!hasDatabase) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-lg font-semibold text-ink">No database configured</h1>
        <p className="mt-2 text-sm text-muted">
          <Link href="/" className="text-accent underline underline-offset-2">
            Try the live builder instead
          </Link>
        </p>
      </main>
    );
  }

  const project = await getProject(id);
  if (!project) notFound();

  const demoOrg = await getDemoOrg();
  const readOnly = demoOrg !== null && project.orgId === demoOrg.id;

  /*
   * The slug for links out to a person's profile has to be *this project's*
   * org, which is not always the demo one. It was reading demoOrg.slug
   * unconditionally, so on any real project the People tab pointed at
   * /app/org/demo/people/<id> — an id that does not exist in that org — and
   * on a deployment with no demo org at all it produced /app/org//people/<id>.
   */
  const orgs = readOnly ? [] : await listOrgsForUser();
  const orgSlug =
    orgs.find((o) => o.id === project.orgId)?.slug ?? demoOrg?.slug ?? '';

  const { brief, roles, health, seats, declines, members } = project;
  const pct = Math.round(health.coverage * 100);
  const open = roles.filter((r) => seats[r.id]?.state === 'open').length;

  // Everything is here, but only one tab renders. Seats leads while the team
  // is still being built; chat once there is a team to talk to.
  const fallback: Tab = open > 0 ? 'seats' : 'chat';
  const tab: Tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as Tab) : fallback;

  const invitations = readOnly ? [] : await listInvitationTiles(project.id);
  const chatOpen = chatIsOpen(members, roles.length);
  const messages = tab === 'chat' && chatOpen ? await listMessages(project.id) : [];

  // The engine's pick from this org's roster for each open seat, offered
  // rather than assigned.
  const suggestions = new Map<string, { person: Person; fit: number }>();
  if (!readOnly && open > 0) {
    const pool = await listCandidatePool(project.orgId);
    const taken = new Set(
      Object.values(seats)
        .map((s) => s.person?.id)
        .filter(Boolean) as string[],
    );
    for (const role of roles) {
      if (seats[role.id]?.state !== 'open') continue;
      const ranked = rankCandidates(
        pool.filter((p) => !taken.has(p.id)),
        role,
        brief,
        project.team,
        { sort: 'bestFit', scope: { companyId: null, office: null }, search: '', minHours: 0 },
      );
      const best = ranked.find((c) => c.roleMatch >= SEAT_FLOOR);
      if (best) {
        suggestions.set(role.id, { person: best.person, fit: best.roleMatch });
        taken.add(best.person.id);
      }
    }
  }

  const href = (t: Tab) => `/project/${project.id}?tab=${t}`;

  return (
    <div className="pm-grain min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto max-w-[1080px] px-5 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="font-display text-[15px] font-bold tracking-tight whitespace-nowrap"
            >
              Project<span className="text-accent">Match</span>
            </Link>
            <span aria-hidden className="text-line-strong">
              /
            </span>

            <span
              className={`grid size-8 shrink-0 place-items-center rounded-full text-[15px] ${
                open === 0 ? 'bg-good-soft text-good' : 'bg-panel-2 text-faint'
              }`}
            >
              {open === 0 ? '✓' : open}
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-display text-[18px] font-semibold">
                {project.name || 'Untitled project'}
              </h1>
              <p className="text-[12px] text-muted">
                {health.filled} of {health.seats} roles · {pct}% covered · {health.overlapHours}{' '}
                hrs/wk overlap
              </p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden -space-x-2 sm:flex">
                {members.map((p) => (
                  <span key={p.id} className="rounded-full ring-2 ring-canvas">
                    <Avatar person={p} size={28} />
                  </span>
                ))}
              </div>
              <Link
                href="/app"
                className="rounded-lg border border-line px-3 py-1.5 text-[13px] text-muted hover:border-accent hover:text-accent"
              >
                All projects
              </Link>
            </div>
          </div>

          <nav className="mt-3.5 flex gap-1">
            {TABS.map((t) => (
              <Link
                key={t.id}
                href={href(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`border-b-2 px-4 py-2.5 text-[14px] font-medium transition-colors ${
                  tab === t.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {t.label}
                {t.id === 'seats' && open > 0 && (
                  <span className="ml-1.5 text-[11px] text-faint">{open}</span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-5 py-6">
        {sp.created && (
          <Banner tone="good">
            Your project is real now. Invite people to the open seats below.
          </Banner>
        )}
        {sp.renamed && <Banner tone="good">Saved.</Banner>}
        {sp.revoked && <Banner tone="warn">Invitation withdrawn. The seat is open again.</Banner>}
        {sp.invited && (
          <Banner tone="good">
            {sp.emailed
              ? 'Invitation emailed. The seat is held until they answer.'
              : 'Invitation ready — no email on file, so pass the link on from People.'}
          </Banner>
        )}

        {/* ------------------------------------------------------------ chat */}
        {tab === 'chat' && (
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="rounded-xl border border-line bg-panel p-4">
              <p className="text-[11px] tracking-wide text-faint uppercase">On this team</p>
              <ul className="mt-2.5 space-y-2">
                {members.length === 0 && (
                  <li className="text-[12px] text-faint">Nobody yet.</li>
                )}
                {members.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <Avatar person={p} size={22} />
                    <span className="min-w-0 truncate text-[13px]">{p.name}</span>
                  </li>
                ))}
              </ul>
            </aside>

            <section className="flex min-h-[420px] flex-col rounded-xl border border-line bg-panel">
              {!chatOpen ? (
                <p className="m-auto max-w-[40ch] p-8 text-center text-[13px] text-faint">
                  Chat opens when everyone has accepted — {members.length} of {roles.length} so
                  far.
                  {open > 0 && ` ${open} seat${open === 1 ? '' : 's'} still to fill.`}
                </p>
              ) : (
                <>
                  <ul className="flex-1 space-y-3 overflow-y-auto p-4">
                    {messages.length === 0 ? (
                      <li className="pt-10 text-center text-[13px] text-faint">
                        Nothing here yet. Say hello, or ask{' '}
                        <span className="text-accent">@assistant</span> what the team is still
                        missing.
                      </li>
                    ) : (
                      messages.map((m) => {
                        const bot = m.authorName === ASSISTANT;
                        return (
                          <li
                            key={m.id}
                            className={m.mine && !bot ? 'text-right' : undefined}
                          >
                            <p className="flex items-center gap-1.5 text-[11px] text-faint">
                              {bot && (
                                <span className="rounded-full border border-accent/40 px-1.5 text-[10px] text-accent">
                                  AI
                                </span>
                              )}
                              {m.authorName} · {new Date(m.at).toLocaleString()}
                            </p>
                            <p
                              className={`mt-0.5 inline-block max-w-[80%] rounded-xl px-3 py-1.5 text-[13px] whitespace-pre-wrap ${
                                bot
                                  ? 'border border-accent/25 bg-accent/10 text-ink'
                                  : m.mine
                                    ? 'bg-accent text-panel'
                                    : 'bg-panel-2 text-ink'
                              }`}
                            >
                              {m.body}
                            </p>
                          </li>
                        );
                      })
                    )}
                  </ul>

                  {readOnly ? (
                    <p className="border-t border-line px-4 py-3 text-[11px] text-faint">
                      Demo organisation — read only.
                    </p>
                  ) : (
                    <form
                      action={postMessageAction}
                      className="flex gap-2 border-t border-line p-3"
                    >
                      <input type="hidden" name="projectId" value={project.id} />
                      <input
                        name="body"
                        required
                        autoComplete="off"
                        placeholder="Message the team…  (try @assistant what are we missing?)"
                        aria-label="Message the team"
                        className="min-w-0 flex-1 rounded-full border border-line bg-canvas px-4 py-2 text-[13px] outline-none focus:border-accent"
                      />
                      <button
                        type="submit"
                        className="shrink-0 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-panel hover:opacity-90"
                      >
                        Send
                      </button>
                    </form>
                  )}
                </>
              )}
            </section>
          </div>
        )}

        {/* ---------------------------------------------------------- people */}
        {tab === 'people' && (
          <div>
            {invitations.length === 0 && members.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-panel px-4 py-8 text-center text-[13px] text-faint">
                Nobody has been asked yet. Open Seats to invite someone.
              </p>
            ) : (
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {invitations.map((inv) => (
                  <li
                    key={inv.token}
                    className="flex items-start gap-3 rounded-xl border border-line bg-panel p-4"
                  >
                    <Avatar
                      person={
                        {
                          name: inv.personName,
                          hue: inv.personHue,
                          ...(inv.personPhoto ? { photo: inv.personPhoto } : {}),
                        } as Person
                      }
                      size={40}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{inv.personName}</p>
                      <p className="truncate text-[12px] text-muted">{inv.roleTitle}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        {inv.personEmail && (
                          <a
                            href={`mailto:${inv.personEmail}`}
                            className="truncate text-faint hover:text-accent"
                          >
                            {inv.personEmail}
                          </a>
                        )}
                        <Link
                          href={`/app/org/${orgSlug}/people/${inv.personId}`}
                          className="text-accent hover:underline"
                        >
                          Explore
                        </Link>
                        {inv.status === 'sent' && (
                          <a
                            href={`/invite/${inv.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline"
                            title="Opens the accept-or-decline page. No account needed."
                          >
                            Open invite ↗
                          </a>
                        )}
                        {inv.status === 'declined' && !readOnly && (
                          <Link
                            href={`/project/${project.id}/staff/${inv.roleId}`}
                            className="text-accent hover:underline"
                          >
                            Choose someone else
                          </Link>
                        )}
                        {inv.status === 'sent' && !readOnly && (
                          <form action={revokeInvitationAction}>
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="roleId" value={inv.roleId} />
                            <button type="submit" className="text-muted hover:text-warn">
                              Withdraw
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                    <StatusChip status={inv.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------- seats */}
        {tab === 'seats' && (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
            <section className="min-w-0 rounded-xl border border-line bg-panel">
              <ul>
                {roles.map((role) => {
                  const seat = seats[role.id] ?? { state: 'open' as const, person: null };
                  const person = seat.person;
                  const awaiting = seat.state === 'invited';
                  const declined = seat.state === 'open' ? declines[role.id] : undefined;
                  const pick = suggestions.get(role.id);

                  return (
                    <li key={role.id} className="border-b border-line px-4 py-3.5 last:border-b-0">
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
                              ? `${person.name} — asked, waiting`
                              : person
                                ? person.name
                                : declined
                                  ? `${declined.personName} declined`
                                  : 'Open'}
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
                          {readOnly ? 'See ranking' : declined ? 'Choose again' : 'See everyone'}
                        </Link>
                      </div>

                      {/* One click to ask the engine's pick, from your roster. */}
                      {!person && pick && !readOnly && (
                        <form
                          action={inviteAction}
                          className="mt-2.5 ml-11 flex items-center gap-2 rounded-lg bg-panel-2 px-3 py-2"
                        >
                          <input type="hidden" name="projectId" value={project.id} />
                          <input type="hidden" name="roleId" value={role.id} />
                          <input type="hidden" name="personId" value={pick.person.id} />
                          <Avatar person={pick.person} size={20} />
                          <span className="min-w-0 truncate text-[12px] text-muted">
                            {pick.person.name}
                            <span className="text-faint">
                              {' '}
                              · {Math.round(pick.fit * 100)}% fit
                            </span>
                          </span>
                          <button
                            type="submit"
                            className="ml-auto shrink-0 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-medium text-panel hover:opacity-90"
                          >
                            Ask them
                          </button>
                        </form>
                      )}

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
                  <div className="h-full rounded-full bg-good" style={{ width: `${pct}%` }} />
                </div>
                {health.filled >= 2 && (
                  <p
                    className={`mt-2 text-[11px] ${
                      health.busFactor === 1 ? 'text-warn' : 'text-faint'
                    }`}
                  >
                    Bus factor {health.busFactor}
                    {health.busFactor === 1 && ' — one departure uncovers a requirement'}
                  </p>
                )}
                {health.stretch > 0 && (
                  <p className="mt-1 text-[11px] text-accent">
                    {health.stretch} learning on the job
                  </p>
                )}
              </section>

              {health.gaps.length > 0 && (
                <section className="rounded-xl border border-line border-l-2 border-l-accent bg-panel px-4 py-3.5">
                  <h2 className="text-[13px] font-medium">Still uncovered</h2>
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
                </section>
              )}

              <Link
                href={`/project/${project.id}/compare`}
                className="block rounded-xl border border-line bg-panel px-4 py-3 text-center text-[12px] text-accent hover:border-accent"
              >
                Compare with a keyword filter
              </Link>
            </aside>
          </div>
        )}

        {/* --------------------------------------------------------- kickoff */}
        {tab === 'kickoff' && (
          <Kickoff
            members={members}
            brief={brief}
            health={health}
            projectId={project.id}
            slot={Math.min(2, Math.max(0, Number(sp.slot ?? 0) || 0))}
          />
        )}

        {/* ----------------------------------------------------------- setup */}
        {tab === 'setup' && (
          <div className="max-w-[520px] space-y-4">
            <section className="rounded-xl border border-line bg-panel p-4">
              <h2 className="text-[13px] font-medium">Name and brief</h2>
              <form action={renameProjectAction} className="mt-3 space-y-3">
                <input type="hidden" name="projectId" value={project.id} />
                <input
                  name="name"
                  defaultValue={project.name}
                  placeholder="Name this project"
                  aria-label="Project name"
                  disabled={readOnly}
                  className="w-full rounded-full border border-line bg-canvas px-4 py-2 text-[13px] outline-none focus:border-accent disabled:opacity-50"
                />
                <textarea
                  name="brief"
                  rows={5}
                  maxLength={2000}
                  defaultValue={brief.text}
                  placeholder="What this project is"
                  aria-label="Project description"
                  disabled={readOnly}
                  className="w-full resize-y rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-[12px] leading-relaxed outline-none focus:border-accent disabled:opacity-50"
                />
                <p className="text-[11px] text-faint">
                  Editing this changes what the project says it is. The roles it already has stay
                  as they are.
                </p>
                {!readOnly && (
                  <button
                    type="submit"
                    className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-panel hover:opacity-90"
                  >
                    Save
                  </button>
                )}
              </form>
            </section>

            {!readOnly && (
              <section className="rounded-xl border border-line bg-panel p-4">
                <h2 className="text-[13px] font-medium">Delete</h2>
                <p className="mt-1 text-[12px] text-muted">
                  Removes the project, its seats, invitations and messages.
                </p>
                <form action={deleteProjectAction} className="mt-3">
                  <input type="hidden" name="projectId" value={project.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-line px-4 py-2 text-[13px] text-muted transition-colors hover:border-warn/40 hover:text-warn"
                  >
                    Delete project
                  </button>
                </form>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Kickoff: when can this team actually meet, and what should they cover.
 *
 * Restored from the original build, with the maths lifted into lib/meeting.ts
 * and the picked slot moved into the URL — which means the whole panel is a
 * server render with no client state, and the three time buttons are links
 * that survive a refresh and a shared URL.
 *
 * Google Calendar is a compose link rather than an integration on purpose. A
 * real sync would need OAuth, a calendar scope, and a stored refresh token
 * per person, to do something the person can do in one click in their own
 * account. The .ics covers everyone not on Google.
 */
function Kickoff({
  members,
  brief,
  health,
  projectId,
  slot,
}: {
  members: Person[];
  brief: Brief;
  health: TeamHealth;
  projectId: string;
  slot: number;
}) {
  const win = overlapWindow(members);
  const slots = proposeSlots(win);
  const agenda = agendaFor(brief, members, health);
  const attendees = members.map((p) => p.contact.email).filter(Boolean);
  const picked = slots[slot];

  const href = (i: number) => `/project/${projectId}?tab=kickoff&slot=${i}`;

  return (
    <div className="grid max-w-[820px] gap-4 md:grid-cols-2">
      <section className="rounded-xl border border-line bg-panel p-4 md:col-span-2">
        <h2 className="text-[13px] font-medium">When everyone is awake</h2>
        {win ? (
          <>
            <p className="mt-1.5 font-display text-[22px] font-semibold text-good">
              {asClock(win.start)}–{asClock(win.end)} UTC
            </p>
            <p className="mt-1 text-[12px] text-muted">
              Each person&rsquo;s 09:00–18:00 local, overlapped. Worked out from the timezones on
              their profiles, not guessed.
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint">
              {members.map((p) => (
                <li key={p.id}>
                  {p.name.split(' ')[0]} · UTC{p.utcOffset >= 0 ? '+' : ''}
                  {p.utcOffset}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-[13px] text-warn">No hour of the day suits everyone.</p>
            <p className="mt-1 text-[12px] text-muted">
              This team spans too many timezones for a shared working window, so any meeting is
              somebody&rsquo;s early morning or late evening. Worth knowing before it is booked
              rather than after.
            </p>
          </>
        )}
      </section>

      {win && (
        <section className="rounded-xl border border-line bg-panel p-4">
          <h2 className="text-[13px] font-medium">Pick a time</h2>
          <p className="mt-1 text-[12px] text-muted">
            The middle of the window, on the next three days.
          </p>
          <ul className="mt-3 space-y-2">
            {slots.map((d, i) => (
              <li key={i}>
                <Link
                  href={href(i)}
                  aria-current={i === slot ? 'true' : undefined}
                  className={`block rounded-lg border px-3 py-2 text-[13px] transition-colors ${
                    i === slot
                      ? 'border-accent bg-accent/10 text-ink'
                      : 'border-line text-muted hover:border-line-strong hover:text-ink'
                  }`}
                >
                  {d.toUTCString().slice(0, 16)} · {asClock(d.getUTCHours() + d.getUTCMinutes() / 60)}{' '}
                  UTC
                </Link>
              </li>
            ))}
          </ul>

          {picked && (
            <div className="mt-4 space-y-2">
              <a
                href={googleCalendarUrl({
                  title: `${brief.text.slice(0, 40)} — kickoff`,
                  start: picked,
                  agenda,
                  attendees,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg bg-accent px-4 py-2 text-center text-[13px] font-medium text-panel transition-opacity hover:opacity-90"
              >
                Add to Google Calendar
              </a>
              <a
                href={`/project/${projectId}/kickoff.ics?slot=${slot}`}
                className="block rounded-lg border border-line px-4 py-2 text-center text-[13px] text-muted transition-colors hover:border-accent hover:text-accent"
              >
                Download .ics
              </a>
              <p className="text-[11px] text-faint">
                {attendees.length > 0
                  ? `${attendees.length} of ${members.length} have an email on file and will be invited.`
                  : 'Nobody has an email on file, so the invite goes out with no attendees.'}
              </p>
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border border-line bg-panel p-4">
        <h2 className="text-[13px] font-medium">Agenda</h2>
        <p className="mt-1 text-[12px] text-muted">
          Built from this brief and what the team is still missing.
        </p>
        <ol className="mt-3 space-y-2">
          {agenda.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-[13px]">
              <span className="text-faint tabular-nums">{i + 1}.</span>
              <span className="text-ink">{item}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function StatusChip({ status }: { status: 'sent' | 'accepted' | 'declined' }) {
  const map = {
    accepted: { label: 'Accepted', cls: 'border-good/40 text-good' },
    declined: { label: 'Declined', cls: 'border-warn/40 text-warn' },
    sent: { label: 'Sent', cls: 'border-line text-faint' },
  } as const;
  const { label, cls } = map[status];
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${cls}`}>{label}</span>
  );
}

function Banner({ tone, children }: { tone: 'good' | 'warn'; children: React.ReactNode }) {
  return (
    <div
      className={`mb-4 rounded-xl border border-line border-l-2 bg-panel px-4 py-3 text-[13px] text-ink ${
        tone === 'good' ? 'border-l-good' : 'border-l-warn'
      }`}
    >
      {children}
    </div>
  );
}
