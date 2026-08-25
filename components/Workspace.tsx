'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Brief, Person, Role, TeamHealth } from '@/lib/types';
import { initials, useUser } from '@/lib/session';
import { live, type ChatMessage, type LiveMode } from '@/lib/live';
import Avatar from './Avatar';

type Tab = 'chat' | 'people' | 'kickoff' | 'setup';

const TABS: { id: Tab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'people', label: 'People' },
  { id: 'kickoff', label: 'Kickoff' },
  { id: 'setup', label: 'Setup' },
];

const CHANNELS = [
  { id: 'general', desc: 'Everyone on the project' },
  { id: 'kickoff', desc: 'Scheduling and agenda' },
  { id: 'design', desc: 'UI, brand, design system' },
];

const WORK_START = 9;
const WORK_END = 18;

/**
 * Local working hours converted to UTC, then intersected across the team.
 *
 * This is arithmetic rather than a model call on purpose: a language model gets
 * timezone maths subtly wrong, and a wrong meeting time is the one bug someone
 * will catch during a demo.
 */
function overlapWindow(members: Person[]) {
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
const asClock = (h: number) => `${pad(Math.floor(h))}:${pad(Math.round((h % 1) * 60))}`;
const stamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours(),
  )}${pad(d.getUTCMinutes())}00Z`;

export default function Workspace({
  brief,
  members,
  roles,
  health,
  onBack,
}: {
  brief: Brief;
  members: Person[];
  roles: Role[];
  health: TeamHealth;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<Tab>('chat');
  const signedIn = useUser();
  const myName = signedIn?.name ?? 'You';

  const roleTitle = useCallback(
    (i: number, p: Person) => roles[i]?.title ?? p.title,
    [roles],
  );

  const [note, setNote] = useState('');
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNote = useCallback((text: string) => {
    setNote(text);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(''), 2500);
  }, []);

  /* ------------------------------ chat ------------------------------ */
  const [channel, setChannel] = useState('general');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<LiveMode | null>(null);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const seen = useRef(new Set<string>());
  const endRef = useRef<HTMLDivElement>(null);

  const addMessage = useCallback((m: ChatMessage) => {
    const key = String(m.id ?? `${m.author}|${m.at}|${m.body}`);
    if (seen.current.has(key)) return;
    seen.current.add(key);
    setMessages((prev) => [...prev, m].sort((a, b) => a.at - b.at));
  }, []);

  useEffect(() => {
    let alive = true;
    live
      .init(addMessage, (names, typing) => {
        if (typing && typing !== myName) showNote(`${typing} is typing…`);
        if (names) setOnline(names);
      })
      .then((m) => {
        if (!alive) return;
        setMode(m);
        live.setName(myName);
      });
    return () => {
      alive = false;
      live.dispose();
    };
  }, [addMessage, myName, showNote]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, channel, tab]);

  const shown = useMemo(
    () => messages.filter((m) => m.channel === channel),
    [messages, channel],
  );

  async function post(m: ChatMessage) {
    try {
      const echoes = await live.send(m);
      if (!echoes) addMessage(m);
    } catch (e) {
      addMessage(m);
      showNote(e instanceof Error ? `Not synced: ${e.message}` : 'Not synced');
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    // Pin the channel: a late assistant reply must not land in a different one.
    const target = channel;

    await post({ channel: target, author: myName, role: 'Founder', body, at: Date.now() });
    if (!/@assistant/i.test(body)) return;

    showNote('assistant is thinking…');
    let reply = 'I could not reach the model just now. Ask me again in a moment.';
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assistant',
          payload: {
            question: body.replace(/@assistant/gi, '').trim(),
            brief: brief.text,
            roster: members
              .map(
                (p, i) =>
                  `${p.name} (${roleTitle(i, p)}, ${p.hoursPerWeek} hrs/wk, ${p.office})`,
              )
              .join('; '),
            gaps: health.gaps.map((g) => g.label).join(', ') || 'none',
            coverage: Math.round(health.coverage * 100),
          },
        }),
      });
      const json = await res.json();
      if (json?.ok && json.data?.reply) reply = json.data.reply;
    } catch {
      /* keep the standby reply */
    }

    await post({
      channel: target,
      author: 'assistant',
      role: 'Gemini',
      body: reply,
      at: Date.now(),
    });
    setNote('');
  }

  /* ----------------------------- kickoff ----------------------------- */
  const win = useMemo(() => overlapWindow(members), [members]);
  const [slot, setSlot] = useState(0);

  const slots = useMemo(() => {
    if (!win) return [] as Date[];
    const base = new Date();
    base.setUTCHours(0, 0, 0, 0);
    base.setUTCDate(base.getUTCDate() + 1);
    const mid = win.start + Math.max(0, (win.end - win.start - 1) / 2);
    return [0, 1, 2].map((i) => {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + i);
      d.setUTCHours(Math.floor(mid), Math.round((mid % 1) * 60), 0, 0);
      return d;
    });
  }, [win]);

  const attendees = useMemo(
    () => members.map((p) => p.contact.email).filter(Boolean),
    [members],
  );

  const agenda = useMemo(
    () => [
      `Walk the brief and the ${brief.durationWeeks}-week shape (10 min)`,
      `${members[0]?.name ?? 'The lead'} presents a week-1 cut (15 min)`,
      ...health.gaps.slice(0, 2).map((g) => `Decide who covers ${g.label} (10 min)`),
      `Agree the ${health.overlapHours} hr/wk working window and standup cadence (10 min)`,
    ],
    [brief.durationWeeks, members, health.gaps, health.overlapHours],
  );

  const calendarUrl = useMemo(() => {
    const s = slots[slot];
    if (!s) return '#';
    const e = new Date(s.getTime() + 60 * 60000);
    const q = new URLSearchParams({
      action: 'TEMPLATE',
      text: 'Project kickoff',
      dates: `${stamp(s)}/${stamp(e)}`,
      details: `Agenda\n${agenda.map((a, i) => `${i + 1}. ${a}`).join('\n')}`,
      add: attendees.join(','),
    });
    return `https://calendar.google.com/calendar/render?${q}`;
  }, [slots, slot, agenda, attendees]);

  function downloadIcs() {
    const s = slots[slot];
    if (!s) return;
    const e = new Date(s.getTime() + 60 * 60000);
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ProjectMatch//EN',
      'BEGIN:VEVENT',
      `UID:${stamp(s)}-projectmatch`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(s)}`,
      `DTEND:${stamp(e)}`,
      'SUMMARY:Project kickoff',
      `DESCRIPTION:Agenda\\n${agenda.map((a, i) => `${i + 1}. ${a}`).join('\\n')}`,
      ...attendees.map((a) => `ATTENDEE;RSVP=TRUE:mailto:${a}`),
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kickoff.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showNote('kickoff.ics downloaded');
  }

  /* ------------------------------ setup ------------------------------ */
  const [links, setLinks] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<number, boolean>>({ 0: true });

  const tasks = useMemo(
    () => [
      { t: 'Lock the team', s: `${health.filled} of ${health.seats} roles filled` },
      { t: 'Send intro notes', s: 'Contact details are on the People tab' },
      {
        t: 'Book the kickoff',
        s: win
          ? `Use the ${asClock(win.start)}–${asClock(win.end)} UTC window`
          : 'No shared window — someone takes it out of hours',
      },
      ...health.gaps.map((g) => ({
        t: `Cover ${g.label}`,
        s: 'Nobody on the team owns it yet',
      })),
    ],
    [health, win],
  );
  const doneCount = Object.values(done).filter(Boolean).length;

  function copy(text: string, msg: string) {
    navigator.clipboard
      ?.writeText(text)
      .then(() => showNote(msg))
      .catch(() => showNote('Copy failed'));
  }

  function mailAll() {
    const body = Object.entries(links)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    window.location.href = `mailto:${attendees.join(',')}?subject=${encodeURIComponent(
      'Project kickoff',
    )}&body=${encodeURIComponent(
      `Hi all — you have each been matched to this project.\n\n${body}`,
    )}`;
  }

  return (
    <div className="pm-grain min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto max-w-[1080px] px-5 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-good-soft text-[15px] text-good">
              ✓
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-[18px] font-semibold">Team workspace</h1>
              <p className="text-[12px] text-muted">
                {health.filled} of {health.seats} roles · {Math.round(health.coverage * 100)}%
                covered · {health.overlapHours} hrs/wk overlap
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
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg border border-line px-3 py-1.5 text-[13px] text-muted hover:border-accent hover:text-accent"
              >
                Back to team
              </button>
            </div>
          </div>

          <nav className="mt-3.5 flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`border-b-2 px-4 py-2.5 text-[14px] font-medium transition-colors ${
                  tab === t.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-5 py-6">
        {tab === 'chat' && (
          <div className="grid gap-4 md:grid-cols-[190px_1fr]">
            <aside className="hidden rounded-xl border border-line bg-panel p-2.5 md:block">
              <p className="px-2 py-1 text-[10.5px] tracking-[0.07em] text-faint uppercase">
                Channels
              </p>
              {CHANNELS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChannel(c.id)}
                  className={`mt-0.5 flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-[13.5px] transition-colors ${
                    channel === c.id
                      ? 'bg-accent-soft font-semibold text-accent'
                      : 'text-muted hover:bg-panel-2 hover:text-ink'
                  }`}
                >
                  # {c.id}
                  <span className="ml-auto text-[11px] text-faint">
                    {messages.filter((m) => m.channel === c.id).length || ''}
                  </span>
                </button>
              ))}

              <p className="mt-4 px-2 py-1 text-[10.5px] tracking-[0.07em] text-faint uppercase">
                Members
              </p>
              {members.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-muted"
                >
                  <Avatar person={p} size={22} />
                  <span className="truncate">{p.name.split(' ')[0]}</span>
                  {online.has(p.name) && (
                    <span aria-label="online" className="ml-auto size-1.5 rounded-full bg-good" />
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-muted">
                <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-accent text-[9px] font-bold text-canvas">
                  AI
                </span>
                assistant
              </div>
            </aside>

            <div className="flex h-[min(66vh,580px)] flex-col rounded-xl border border-line bg-panel">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                <b className="text-[14.5px]"># {channel}</b>
                <span className="text-[12px] text-faint">
                  {CHANNELS.find((c) => c.id === channel)?.desc}
                </span>
                <span
                  title={
                    mode === 'supabase'
                      ? 'Connected to Supabase Realtime — syncs across devices'
                      : 'No Supabase config — syncs across windows on this machine only'
                  }
                  className="ml-auto flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-[11.5px] text-muted"
                >
                  <span
                    className={`size-[7px] rounded-full ${
                      mode === 'supabase' ? 'bg-good' : mode === 'local' ? 'bg-accent' : 'bg-faint'
                    }`}
                  />
                  {mode === 'supabase'
                    ? `live${online.size ? ` · ${online.size} online` : ''}`
                    : mode === 'local'
                      ? 'live · this device'
                      : 'connecting…'}
                </span>
              </div>

              <div className="flex-1 space-y-4 overflow-auto px-4 py-4">
                {shown.length === 0 && (
                  <p className="pt-6 text-center text-[13px] text-faint">
                    Nothing here yet. Say hello, or ask{' '}
                    <b className="text-accent">@assistant</b> what the team is still missing.
                  </p>
                )}
                {shown.map((m, i) => {
                  const bot = m.author === 'assistant';
                  const person = members.find((p) => p.name === m.author);
                  return (
                    <div key={String(m.id ?? i)} className="flex gap-3">
                      {bot ? (
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-canvas">
                          AI
                        </span>
                      ) : person ? (
                        <Avatar person={person} size={32} />
                      ) : (
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-panel-2 text-[11px] font-bold text-muted">
                          {initials(m.author)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-[13.5px] font-semibold">{m.author}</span>
                          {m.role && (
                            <span className={`text-[11px] ${bot ? 'text-ai' : 'text-accent'}`}>
                              {m.role}
                            </span>
                          )}
                          <span className="text-[11px] text-faint">
                            {new Date(m.at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p
                          className={`mt-0.5 text-[13.5px] leading-relaxed break-words ${
                            bot
                              ? 'rounded-r-lg border border-l-2 border-line border-l-accent bg-canvas px-3 py-2 text-muted'
                              : ''
                          }`}
                        >
                          {m.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <p className="min-h-[18px] px-4 text-[11.5px] text-faint italic">{note}</p>

              <div className="flex items-end gap-2 border-t border-line p-3">
                <textarea
                  rows={1}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    live.typing(myName);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={`Message #${channel}…  (try @assistant what are we still missing?)`}
                  aria-label={`Message ${channel}`}
                  className="max-h-[110px] min-h-[40px] flex-1 resize-none rounded-lg border border-line bg-canvas px-3 py-2.5 text-[13.5px] outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={send}
                  className="rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-canvas hover:opacity-90"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'people' && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={mailAll}
                className="rounded-lg border border-line px-3 py-2 text-[13px] text-muted hover:border-accent hover:text-accent"
              >
                Email everyone
              </button>
              <button
                type="button"
                onClick={() =>
                  copy(
                    members
                      .map((p, i) => `${p.name} — ${roleTitle(i, p)} — ${p.contact.email}`)
                      .join('\n'),
                    'Roster copied',
                  )
                }
                className="rounded-lg border border-line px-3 py-2 text-[13px] text-muted hover:border-accent hover:text-accent"
              >
                Copy roster
              </button>
              {note && <span className="text-[12px] text-good">{note}</span>}
            </div>

            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {members.map((p, i) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4"
                >
                  <div className="flex gap-3">
                    <Avatar person={p} size={42} />
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold">{p.name}</p>
                      <p className="text-[12.5px] font-semibold text-accent">
                        {roleTitle(i, p)}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-muted">
                        {p.title} · {p.hoursPerWeek} hrs/wk · {p.office} (UTC
                        {p.utcOffset >= 0 ? '+' : ''}
                        {p.utcOffset})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[12px] text-muted">
                    <span className="truncate">{p.contact.email}</span>
                    <button
                      type="button"
                      onClick={() => copy(p.contact.email, 'Email copied')}
                      className="ml-auto shrink-0 text-faint hover:text-accent"
                    >
                      copy
                    </button>
                  </div>

                  <a
                    href={`mailto:${p.contact.email}?subject=${encodeURIComponent(
                      'Joining the project',
                    )}`}
                    className="mt-auto rounded-lg border border-accent px-3 py-2 text-center text-[13px] font-medium text-accent hover:bg-accent-soft"
                  >
                    Email {p.name.split(' ')[0]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'kickoff' && (
          <div className="rounded-xl border border-line bg-panel p-5">
            {!win ? (
              <p className="text-[14px] text-warn">
                These timezones have no shared working hours. Someone will have to take the call
                outside their day.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-3">
                  <h3 className="font-display text-[16px] font-semibold">
                    Everyone is awake between
                  </h3>
                  <span className="rounded-full border border-good/30 bg-good-soft px-3 py-1 text-[12.5px] font-semibold text-good">
                    {asClock(win.start)} – {asClock(win.end)} UTC
                  </span>
                </div>
                <p className="mt-1 mb-5 text-[12.5px] text-faint">
                  Computed from each person&apos;s timezone and a 9–18 local working day. Outside
                  this band someone is asleep.
                </p>

                <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
                  <div className="relative">
                    {members.map((p) => {
                      const s = ((WORK_START - p.utcOffset + 24) % 24) / 24;
                      const w = (WORK_END - WORK_START) / 24;
                      return (
                        <div key={p.id} className="mb-1.5 flex items-center gap-2.5">
                          <span className="w-16 shrink-0 truncate text-right text-[12px] text-muted">
                            {p.name.split(' ')[0]}
                          </span>
                          <span className="relative h-5 flex-1 overflow-hidden rounded bg-canvas">
                            <i
                              className="absolute inset-y-0 rounded bg-line-strong"
                              style={{ left: `${s * 100}%`, width: `${w * 100}%` }}
                            />
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2.5">
                      <span className="w-16 shrink-0" />
                      <span className="relative h-3.5 flex-1">
                        {[0, 6, 12, 18, 24].map((h) => (
                          <span
                            key={h}
                            className="absolute -translate-x-1/2 text-[10.5px] text-faint"
                            style={{ left: `${(h / 24) * 100}%` }}
                          >
                            {pad(h)}
                          </span>
                        ))}
                      </span>
                    </div>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute top-0 rounded border-x-2 border-good bg-good/15"
                      style={{
                        marginLeft: 74,
                        left: `calc((100% - 74px) * ${win.start / 24})`,
                        width: `calc((100% - 74px) * ${(win.end - win.start) / 24})`,
                        height: members.length * 26,
                      }}
                    />
                    <p className="mt-3 flex items-center gap-2 text-[12px] text-faint">
                      <span className="size-2 rounded-[2px] border border-good bg-good/50" />
                      Green band = everyone available · times in UTC
                    </p>
                  </div>

                  <div>
                    {slots.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSlot(i)}
                        className={`mb-2.5 w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                          slot === i
                            ? 'border-accent bg-accent-soft'
                            : 'border-line bg-canvas hover:border-line-strong'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-bold">
                            {s.toLocaleDateString([], {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              timeZone: 'UTC',
                            })}{' '}
                            · {pad(s.getUTCHours())}:{pad(s.getUTCMinutes())} UTC
                          </span>
                          {i === 0 && (
                            <span className="rounded-full bg-good-soft px-2 py-0.5 text-[10.5px] font-bold text-good">
                              BEST FIT
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {members.map((p) => {
                            // Offsets like +5.5 mean the local minutes differ from
                            // the UTC minutes, so convert the whole time, not the hour.
                            const mins =
                              (((s.getUTCHours() * 60 + s.getUTCMinutes() + p.utcOffset * 60) %
                                1440) +
                                1440) %
                              1440;
                            return (
                              <span
                                key={p.id}
                                className="rounded border border-line bg-panel px-1.5 py-0.5 text-[11px] text-muted"
                              >
                                <b className="font-semibold text-ink">{p.name.split(' ')[0]}</b>{' '}
                                {pad(Math.floor(mins / 60))}:{pad(Math.round(mins % 60))}
                              </span>
                            );
                          })}
                        </div>
                      </button>
                    ))}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={calendarUrl}
                        target="_blank"
                        rel="noopener"
                        className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-center text-[13.5px] font-semibold text-canvas hover:opacity-90"
                      >
                        Add to Google Calendar
                      </a>
                      <button
                        type="button"
                        onClick={downloadIcs}
                        className="flex-1 rounded-lg border border-line px-4 py-2.5 text-[13.5px] font-medium text-muted hover:border-accent hover:text-accent"
                      >
                        Download .ics
                      </button>
                    </div>

                    <div className="mt-3.5 rounded-r-lg border border-l-2 border-line border-l-accent bg-canvas px-3 py-2.5">
                      <p className="text-[10.5px] tracking-[0.05em] text-faint uppercase">
                        Suggested agenda · 60 min
                      </p>
                      <ol className="mt-1.5 list-decimal pl-4 text-[12.5px] leading-relaxed text-muted">
                        {agenda.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'setup' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-line bg-panel p-5">
              <h3 className="font-display text-[15px] font-semibold">Set up your workspace</h3>
              <p className="mt-1 mb-3 text-[12.5px] text-faint">
                Paste links once — they are included when you email everyone.
              </p>
              {['Slack', 'GitHub', 'Figma', 'Tracker', 'Kickoff'].map((k) => (
                <div
                  key={k}
                  className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-b-0"
                >
                  <span className="w-16 shrink-0 text-[13.5px] font-medium">{k}</span>
                  <input
                    value={links[k] ?? ''}
                    onChange={(e) => setLinks((l) => ({ ...l, [k]: e.target.value }))}
                    placeholder="https://…"
                    aria-label={`${k} link`}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2.5 py-2 text-[12.5px] outline-none focus:border-accent"
                  />
                  <span className="w-4 shrink-0 text-[14px] text-good">
                    {links[k]?.trim() ? '✓' : ''}
                  </span>
                </div>
              ))}
            </section>

            <section className="rounded-xl border border-line bg-panel p-5">
              <h3 className="font-display text-[15px] font-semibold">First week checklist</h3>
              <p className="mt-1 mb-3 text-[12.5px] text-faint">
                Generated from your brief — {brief.durationWeeks} weeks, {health.seats} roles.
              </p>
              {tasks.map((t, i) => (
                <label
                  key={t.t}
                  className="flex cursor-pointer items-start gap-3 border-b border-line py-2.5 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={!!done[i]}
                    onChange={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
                    className="mt-0.5 size-4 accent-[var(--good)]"
                  />
                  <span className={done[i] ? 'text-faint line-through' : ''}>
                    <span className="block text-[13.5px]">{t.t}</span>
                    <span className="block text-[12px] text-faint no-underline">{t.s}</span>
                  </span>
                </label>
              ))}
              <div className="mt-4 flex items-center gap-2.5 text-[12.5px] text-muted">
                <span>
                  {doneCount} of {tasks.length} done
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                  <i
                    className="block h-full rounded-full bg-good transition-all duration-300"
                    style={{ width: `${(doneCount / tasks.length) * 100}%` }}
                  />
                </span>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
