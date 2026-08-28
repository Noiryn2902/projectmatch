import { labelOf } from './engine/graph';
import type { Brief, Person, TeamHealth } from './types';

/**
 * When this team can actually meet, and what to talk about.
 *
 * Pure arithmetic, deliberately — not a model call. A language model gets
 * timezone maths subtly wrong often enough to matter, and a wrong meeting
 * time is the one bug everybody notices. The interesting part was never the
 * reasoning anyway: it is that the product knows each person's offset at all,
 * because setup asked for it.
 *
 * Same shape as the original build's kickoff tab, moved out of the component
 * so it can be read, tested and reasoned about on its own.
 */

/** Local working day, in local hours. */
const WORK_START = 9;
const WORK_END = 18;

/** An hour is the assumed length of a kickoff. */
export const MEETING_MINUTES = 60;

export interface Window {
  /** UTC hours, fractional — 13.5 is 13:30 UTC. */
  start: number;
  end: number;
}

/**
 * Each person's 09:00–18:00 local, expressed in UTC, then intersected.
 *
 * Returns null when there is no hour of the day everyone is awake for — which
 * is a real answer, not a failure, and the interface says so rather than
 * proposing a time somebody would have to take at 3am.
 */
export function overlapWindow(members: Person[]): Window | null {
  if (members.length === 0) return null;

  let start = -Infinity;
  let end = Infinity;
  for (const p of members) {
    start = Math.max(start, WORK_START - p.utcOffset);
    end = Math.min(end, WORK_END - p.utcOffset);
  }

  if (!(end > start)) return null;
  return { start: Math.max(0, start), end: Math.min(24, end) };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 13.5 → "13:30". */
export const asClock = (h: number) => `${pad(Math.floor(h))}:${pad(Math.round((h % 1) * 60))}`;

/** A UTC instant in the basic ISO form iCalendar and Google both want. */
export const stamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours(),
  )}${pad(d.getUTCMinutes())}00Z`;

/**
 * Three candidate times: the middle of the shared window, on each of the next
 * three days. The middle rather than the edge because an overlap's boundary is
 * somebody's 09:00 sharp or 17:00 on the dot, and neither is a kind slot to
 * put a first meeting in.
 *
 * `from` is injectable so this is testable and so a server render and its
 * .ics agree on which day they mean.
 */
export function proposeSlots(win: Window | null, from = new Date()): Date[] {
  if (!win) return [];

  const base = new Date(from);
  base.setUTCHours(0, 0, 0, 0);
  base.setUTCDate(base.getUTCDate() + 1);

  const mid = win.start + Math.max(0, (win.end - win.start - 1) / 2);

  return [0, 1, 2].map((i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    d.setUTCHours(Math.floor(mid), Math.round((mid % 1) * 60), 0, 0);
    return d;
  });
}

/**
 * An agenda built from what this team actually is, rather than a template.
 *
 * The gaps line is the one that earns its place: the same analysis that says
 * the team is 89% covered can say which 11% needs an owner, and a kickoff is
 * exactly when that gets decided.
 */
export function agendaFor(brief: Brief, members: Person[], health: TeamHealth): string[] {
  /*
   * Only the gaps that name a skill become agenda items, and they use that
   * skill rather than the gap's own sentence. Gap.label is written to be read
   * on its own — "No coverage for UI design" — so interpolating it produced
   * "Decide who covers No coverage for UI design", which is what this
   * shipped as until someone read the generated .ics.
   *
   * The gaps with no skill behind them (thin overlap, no senior presence) are
   * real but they are not "who owns this" questions, so they stay out of a
   * list of things to assign.
   */
  const owners = health.gaps
    .filter((g) => g.skillId)
    .slice(0, 2)
    .map((g) => `Decide who covers ${labelOf(g.skillId!)} (10 min)`);

  return [
    `Walk the brief and the ${brief.durationWeeks}-week shape (10 min)`,
    `${members[0]?.name ?? 'The lead'} presents a week-1 cut (15 min)`,
    ...owners,
    `Agree the ${health.overlapHours} hr/wk working window and standup cadence (10 min)`,
  ];
}

export interface Meeting {
  title: string;
  start: Date;
  agenda: string[];
  attendees: string[];
}

const end = (m: Meeting) => new Date(m.start.getTime() + MEETING_MINUTES * 60_000);

/**
 * A Google Calendar compose URL — no OAuth, no calendar scope, no token to
 * store. It opens Google's own "new event" screen with everything filled in
 * and lets the person press save in their own account, which is both less
 * work and less access than a real integration would need.
 */
export function googleCalendarUrl(m: Meeting): string {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: m.title,
    dates: `${stamp(m.start)}/${stamp(end(m))}`,
    details: `Agenda\n${m.agenda.map((a, i) => `${i + 1}. ${a}`).join('\n')}`,
    ...(m.attendees.length > 0 ? { add: m.attendees.join(',') } : {}),
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** The same event as a file, for everyone not on Google. */
export function toIcs(m: Meeting): string {
  const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ProjectMatch//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${stamp(m.start)}-projectmatch`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(m.start)}`,
    `DTEND:${stamp(end(m))}`,
    `SUMMARY:${esc(m.title)}`,
    `DESCRIPTION:${esc(`Agenda\n${m.agenda.map((a, i) => `${i + 1}. ${a}`).join('\n')}`)}`,
    ...m.attendees.map((a) => `ATTENDEE;RSVP=TRUE:mailto:${a}`),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
