import Link from 'next/link';
import { notFound } from 'next/navigation';

import AppShell from '@/components/app/AppShell';
import Avatar from '@/components/Avatar';
import { buttonClass, toneForRatio } from '@/components/ui';
import { hasDatabase } from '@/lib/env';
import { getDemoOrg } from '@/lib/data/orgs';
import { listInvitationTiles } from '@/lib/data/invitations';
import { chatIsOpen, listMessages } from '@/lib/data/messages';
import { getProject } from '@/lib/data/projects';
import { labelOf } from '@/lib/engine/graph';
import type { Person } from '@/lib/types';

import {
  deleteProjectAction,
  postMessageAction,
  renameProjectAction,
  revokeInvitationAction,
} from './actions';

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
  searchParams: Promise<{
    invited?: string;
    emailed?: string;
    revoked?: string;
    created?: string;
    renamed?: string;
  }>;
}) {
  const { id } = await params;
  const { invited, emailed, revoked, created, renamed } = await searchParams;

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

  const invitations = readOnly ? [] : await listInvitationTiles(project.id);
  const chatOpen = chatIsOpen(project.members);
  const messages = chatOpen ? await listMessages(project.id) : [];

  const { brief, roles, health, seats, declines } = project;
  const pct = Math.round(health.coverage * 100);
  // A decline the owner can still do something about — the demo org can't be
  // staffed at all, so there is nothing to surface there.
  const declineCount = readOnly ? 0 : Object.keys(declines).length;

  return (
    <AppShell
      notifications={0}
      action={
        <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted uppercase">
          {project.status}
        </span>
      }
    >
      <div>
        {/* The name was a static uppercase label, so a project created from a
            brief was stuck as "Untitled project" forever. It is the field
            itself now — type, press enter, done. */}
        {readOnly ? (
          <p className="text-[11px] tracking-wide text-faint uppercase">
            {project.name || 'Untitled project'}
          </p>
        ) : (
          <form action={renameProjectAction} className="flex items-center gap-2">
            <input type="hidden" name="projectId" value={project.id} />
            <input
              name="name"
              defaultValue={project.name}
              placeholder="Name this project"
              aria-label="Project name"
              className="-ml-2 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-[11px] tracking-wide text-faint uppercase outline-none transition-colors hover:border-line focus:border-accent focus:text-ink"
            />
            <button type="submit" className="shrink-0 text-[11px] text-accent hover:underline">
              Save
            </button>
          </form>
        )}
        <h1 className="mt-1 max-w-[46ch] font-display text-2xl font-bold text-balance">
          {brief.text}
        </h1>

        {/* Facts and actions were previously the same shape, sitting in the
            same row: "12 weeks" looked exactly like "Staffing options", so a
            label and a link were indistinguishable. Facts are plain text now;
            anything that navigates looks like a control. */}
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
          <span>{brief.durationWeeks} weeks</span>
          {brief.domain.map((d) => (
            <span key={d} className="capitalize before:mr-2 before:text-faint before:content-['·']">
              {d}
            </span>
          ))}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/project/${project.id}/compare`} className={buttonClass('secondary', 'sm')}>
            Compare with a keyword filter
          </Link>
          {!readOnly && (
            <Link href={`/project/${project.id}/staff`} className={buttonClass('secondary', 'sm')}>
              Review every seat
            </Link>
          )}
          {!readOnly && (
            <form action={deleteProjectAction} className="ml-auto">
              <input type="hidden" name="projectId" value={project.id} />
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-[12px] text-faint transition-colors hover:text-warn"
              >
                Delete project
              </button>
            </form>
          )}
        </div>

        {created && (
          <div className="mt-6 rounded-xl border border-line border-l-2 border-l-good bg-panel px-4 py-3.5">
            <p className="text-[13px] font-medium text-ink">This project is real now.</p>
            <p className="mt-1 text-[12px] text-muted">
              Open a seat to invite someone from your own roster.
            </p>
          </div>
        )}

        {renamed && (
          <div className="mt-6 rounded-xl border border-line border-l-2 border-l-good bg-panel px-4 py-3 text-[13px] text-ink">
            Renamed.
          </div>
        )}

        {invited && (
          <div className="mt-6 rounded-xl border border-line border-l-2 border-l-accent bg-panel px-4 py-3.5">
            <p className="text-[13px] font-medium text-ink">
              {emailed ? 'Invitation emailed' : 'Invitation ready to send'}
            </p>
            <p className="mt-1 text-[12px] text-muted">
              {emailed
                ? 'Sent. The seat is held until they answer.'
                : 'No email address on file — send them this link. It works without an account.'}
            </p>
            {/* Shown only when there is no mailbox to send to. When the mail
                went out, the link is in it, and repeating the token here just
                puts a credential on screen for no reader who needs it. */}
            {!emailed && (
              <Link
                href={`/invite/${invited}`}
                className="mt-2.5 block truncate rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] text-accent underline-offset-2 hover:underline"
              >
                /invite/{invited}
              </Link>
            )}
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
              Open the seat to see who fits now.
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
                {/* Colour follows the number. This was hard-coded green, so an
                    empty team reported 0% in the colour of success. */}
                <span
                  className={`font-display text-[15px] font-semibold ${
                    { neutral: 'text-ink', accent: 'text-accent', good: 'text-good', warn: 'text-warn' }[
                      toneForRatio(health.coverage)
                    ]
                  }`}
                >
                  {pct}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    { neutral: 'bg-line-strong', accent: 'bg-accent', good: 'bg-good', warn: 'bg-warn' }[
                      toneForRatio(health.coverage)
                    ]
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-faint">
                {health.filled} of {health.seats} seats filled &middot; {health.overlapHours} hrs/wk
                overlap
              </p>
              {health.filled >= 2 && (
                <p
                  className={`mt-1 text-[11px] ${
                    health.busFactor === 1 ? 'text-warn' : 'text-faint'
                  }`}
                >
                  Bus factor {health.busFactor}
                  {health.busFactor === 1
                    ? ' — one departure leaves a requirement uncovered'
                    : health.busFactor >= 2
                      ? ' — every covered requirement has backup'
                      : ''}
                </p>
              )}
              {health.stretch > 0 && (
                <p className="mt-1 text-[11px] text-accent">
                  {health.stretch} stretch {health.stretch === 1 ? 'assignment' : 'assignments'} —
                  paired with a senior in a skill they&rsquo;re still building
                </p>
              )}
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

        {/*
          Who was asked, and what they said. This lived in three places —
          a pending list, a decline map, and the seat rows — which is three
          places to look for one question. One grid of tiles, one answer,
          the status as a chip rather than a sentence.
        */}
        {invitations.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-[15px] font-semibold text-ink">Invitations</h2>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {invitations.map((inv) => (
                <li
                  key={inv.token}
                  className="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3"
                >
                  <Avatar
                    person={
                      {
                        name: inv.personName,
                        hue: inv.personHue,
                        ...(inv.personPhoto ? { photo: inv.personPhoto } : {}),
                      } as Person
                    }
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">{inv.personName}</p>
                    <p className="truncate text-[12px] text-muted">{inv.roleTitle}</p>

                    {/* Interact — the things you would actually do next, in
                        one row instead of scattered around the page. */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                      {inv.personEmail && (
                        <a
                          href={`mailto:${inv.personEmail}`}
                          className="truncate text-faint transition-colors hover:text-accent"
                        >
                          {inv.personEmail}
                        </a>
                      )}
                      {inv.status === 'accepted' && chatOpen && (
                        <a href="#conversation" className="text-accent hover:underline">
                          Chat
                        </a>
                      )}
                      {/* A decline is not a dead end — it sends you back to
                          the ranking for that one seat, recomputed against
                          the team as it now stands. */}
                      {inv.status === 'declined' && !readOnly && (
                        <Link
                          href={`/project/${project.id}/staff/${inv.roleId}`}
                          className="text-accent hover:underline"
                        >
                          Swap for someone else
                        </Link>
                      )}
                      {inv.status === 'sent' && !readOnly && (
                        <form action={revokeInvitationAction}>
                          <input type="hidden" name="projectId" value={project.id} />
                          <input type="hidden" name="roleId" value={inv.roleId} />
                          <button
                            type="submit"
                            className="text-muted transition-colors hover:text-warn"
                          >
                            Withdraw
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  <span
                    className={`shrink-0 self-start rounded-full border px-2 py-0.5 text-[10px] ${
                      inv.status === 'accepted'
                        ? 'border-good/40 text-good'
                        : inv.status === 'declined'
                          ? 'border-warn/40 text-warn'
                          : 'border-line text-faint'
                    }`}
                  >
                    {inv.status === 'accepted'
                      ? 'Accepted'
                      : inv.status === 'declined'
                        ? 'Declined'
                        : 'Sent'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <h2 id="conversation" className="scroll-mt-20 font-display text-[15px] font-semibold text-ink">Conversation</h2>
          {!chatOpen ? (
            <p className="mt-2 rounded-xl border border-line border-dashed bg-panel px-4 py-3 text-[12px] text-faint">
              Opens when someone accepts a seat.
            </p>
          ) : (
            <div className="mt-3 rounded-xl border border-line bg-panel">
              <ul className="max-h-[420px] space-y-3 overflow-y-auto px-4 py-4">
                {messages.length === 0 ? (
                  <li className="text-[12px] text-faint italic">
                    No messages yet. Say hello to the team.
                  </li>
                ) : (
                  messages.map((m) => (
                    <li key={m.id} className={m.mine ? 'text-right' : undefined}>
                      <p className="text-[11px] text-faint">
                        {m.authorName} &middot; {new Date(m.at).toLocaleString()}
                      </p>
                      <p
                        className={`mt-0.5 inline-block max-w-[80%] rounded-xl px-3 py-1.5 text-[13px] whitespace-pre-wrap ${
                          m.mine ? 'bg-accent text-panel' : 'bg-panel-2 text-ink'
                        }`}
                      >
                        {m.body}
                      </p>
                    </li>
                  ))
                )}
              </ul>
              {readOnly ? (
                <p className="border-t border-line px-4 py-3 text-[11px] text-faint">
                  Demo organisation — read only.
                </p>
              ) : (
                <form
                  action={postMessageAction}
                  className="flex gap-2 border-t border-line px-3 py-3"
                >
                  <input type="hidden" name="projectId" value={project.id} />
                  <input
                    type="text"
                    name="body"
                    required
                    maxLength={4000}
                    autoComplete="off"
                    placeholder="Message the team"
                    aria-label="Message the team"
                    className="min-w-0 flex-1 rounded-full border border-line bg-canvas px-4 py-2 text-[13px] outline-none transition-colors focus:border-accent"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-panel transition-opacity hover:opacity-90"
                  >
                    Send
                  </button>
                </form>
              )}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
