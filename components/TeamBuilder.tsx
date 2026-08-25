'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Brief, Company, Person, ScopeFilter, SortMode, TeamState } from '@/lib/types';
import { autoFill, membersOf, rankCandidates } from '@/lib/engine/assemble';
import { teamHealth } from '@/lib/engine/health';
import { labelOf, sim } from '@/lib/engine/graph';
import PersonCard from './PersonCard';
import TeamPanel from './TeamPanel';
import Filters from './Filters';

const SORTS: { id: SortMode; label: string }[] = [
  { id: 'bestFit', label: 'Best fit for this team' },
  { id: 'skillMatch', label: 'Closest skills' },
  { id: 'experience', label: 'Most experience' },
  { id: 'availability', label: 'Most available' },
  { id: 'sameOffice', label: 'By office' },
];

const EXAMPLES = [
  'Internal tool that turns customer support tickets into weekly theme reports. Roughly 6 weeks. It needs to actually ship, not stay a prototype.',
  'A mobile app that helps nurses hand over patient notes between shifts. Three months, hospital pilot first.',
  'Carbon reporting dashboard for mid-size logistics firms. Four months. Needs real data pipelines and something regulators will accept.',
];

export default function TeamBuilder({
  people,
  companies,
  initialBrief,
}: {
  people: Person[];
  companies: Company[];
  initialBrief: Brief;
}) {
  // Nothing but the input shows until the user has actually asked for something.
  const [started, setStarted] = useState(false);
  const [briefText, setBriefText] = useState('');
  const [brief, setBrief] = useState<Brief>(initialBrief);
  const [briefOpen, setBriefOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  const [scope, setScope] = useState<ScopeFilter>({ companyId: null, office: null });
  const [sort, setSort] = useState<SortMode>('bestFit');
  const [search, setSearch] = useState('');
  const [minHours, setMinHours] = useState(0);
  const [seniority, setSeniority] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const [team, setTeam] = useState<TeamState>(() =>
    autoFill(initialBrief, people, { companyId: null, office: null }),
  );
  const [activeRoleId, setActiveRoleId] = useState(initialBrief.roles[0]?.id ?? '');

  const [reason, setReason] = useState<string | null>(null);
  const [reasonLoading, setReasonLoading] = useState(false);
  const reasonCache = useRef(new Map<string, string>());

  const companyName = useCallback(
    (id: string) => companies.find((c) => c.id === id)?.name ?? id,
    [companies],
  );

  const activeRole = brief.roles.find((r) => r.id === activeRoleId) ?? brief.roles[0];
  const members = useMemo(() => membersOf(team, people), [team, people]);
  const health = useMemo(() => teamHealth(brief, members, brief.roles.length), [brief, members]);

  const candidates = useMemo(() => {
    if (!activeRole) return [];
    return rankCandidates(people, activeRole, brief, team, { sort, scope, search, minHours, seniority });
  }, [people, activeRole, brief, team, sort, scope, search, minHours, seniority]);

  const top = candidates[0];
  const filtered =
    search.trim() !== '' || minHours > 0 || scope.companyId !== null || seniority.length > 0;

  // Gemini explains the engine's pick. It never reorders anything.
  useEffect(() => {
    if (!top || !activeRole) {
      setReason(null);
      return;
    }
    const key = `${activeRole.id}:${top.person.id}:${members.length}`;
    const cached = reasonCache.current.get(key);
    if (cached) {
      setReason(cached);
      return;
    }

    setReason(null);
    let cancelled = false;
    const timer = setTimeout(async () => {
      setReasonLoading(true);
      const covers = [...top.person.skills]
        .map((s) => ({
          s,
          rel: Math.max(...activeRole.requirements.map((r) => sim(s.skillId, r.skillId)), 0),
        }))
        .filter((x) => x.rel >= 0.6)
        .sort((a, b) => b.rel - a.rel)
        .slice(0, 3)
        .map((x) => labelOf(x.s.skillId))
        .join(', ');

      try {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'explain',
            payload: {
              name: top.person.name,
              title: top.person.title,
              role: activeRole.title,
              gapPct: Math.round(top.breakdown.gapFill * 100),
              hours: top.person.hoursPerWeek,
              office: top.person.office,
              covers,
              missing: health.gaps[0]?.label ?? '',
            },
          }),
        });
        const json = await res.json();
        if (!cancelled && json?.ok && json.data?.reason) {
          reasonCache.current.set(key, json.data.reason);
          setReason(json.data.reason);
        }
      } catch {
        if (!cancelled) setReason(null);
      } finally {
        if (!cancelled) setReasonLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [top, activeRole, members.length, health.gaps]);

  async function analyze() {
    if (briefText.trim().length < 8) {
      setError('Please add a little more detail about the project.');
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'brief', payload: { text: briefText } }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? 'The brief could not be read.');

      const next: Brief = { text: briefText, ...json.data };
      setBrief(next);
      setSource(json.source ?? null);
      setActiveRoleId(next.roles[0]?.id ?? '');
      reasonCache.current.clear();
      setTeam(autoFill(next, people, scope));
      setBriefOpen(false);
      setStarted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The brief could not be processed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  function runAutoFill() {
    setBusy(true);
    requestAnimationFrame(() => {
      setTeam(autoFill(brief, people, scope));
      setBusy(false);
    });
  }

  function toggle(personId: string) {
    if (!activeRole) return;
    setTeam((t) => ({
      ...t,
      [activeRole.id]: t[activeRole.id] === personId ? null : personId,
    }));
  }

  if (!started) {
    return (
      <div className="pm-grain relative min-h-screen overflow-hidden">
        <div className="absolute inset-0">
          {/* Poster carries the frame on its own, so the page is complete
              before the clip loads and stays complete if it never does. */}
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/media/hero.webp"
            aria-hidden="true"
            className="h-full w-full scale-105 object-cover opacity-90"
          >
            <source src="/media/hero.mp4" type="video/mp4" />
          </video>

          {/* Scrim sits darkest where the copy lands, not at the edges. The
              monitor rows are the brightest part of the plate. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(58% 36% at 50% 43%, rgba(6,9,16,0.60) 0%, rgba(6,9,16,0.44) 55%, rgba(6,9,16,0.16) 82%, rgba(6,9,16,0) 100%)',
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(6,9,16,0.42) 0%, rgba(6,9,16,0.05) 26%, rgba(6,9,16,0.05) 58%, rgba(6,9,16,0.58) 88%, rgba(6,9,16,0.94) 100%)',
            }}
          />
        </div>

        <div className="relative grid min-h-screen place-items-center px-5 py-14">
          <div className="w-full max-w-[640px]">
            <p className="pm-rise pm-d1 pm-legible text-center text-[11px] tracking-[0.22em] text-accent uppercase">
              Team formation
            </p>

            <h1 className="pm-rise pm-d2 pm-legible mt-4 text-center font-display text-[34px] leading-[1.05] font-bold tracking-tight text-white sm:text-[46px]">
              Describe the project.
              <br />
              <span className="text-accent">Get the team.</span>
            </h1>

            <p className="pm-rise pm-d3 pm-legible mx-auto mt-5 max-w-[460px] text-center text-[15px] leading-relaxed font-medium text-white">
              Scored on what each person adds to the team, not how good they look alone. With an
              honest account of what the team still lacks.
            </p>

            <div className="pm-rise pm-d4 mt-9">
              <div className="rounded-2xl border border-line-strong bg-panel/92 p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl transition-colors focus-within:border-accent">
                <textarea
                  rows={4}
                  autoFocus
                  value={briefText}
                  onChange={(e) => {
                    setBriefText(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) analyze();
                  }}
                  placeholder="What are you building, roughly how long, and anything that has to be true when it is done."
                  aria-label="Describe your project"
                  className="w-full resize-none bg-transparent p-3 text-[15px] leading-relaxed outline-none placeholder:text-faint"
                />
                <div className="flex items-center justify-between gap-3 px-2 pb-1">
                  <span className="text-[11px] text-faint">
                    {briefText.trim().length > 0 ? 'Ctrl + Enter to submit' : 'No account required'}
                  </span>
                  <button
                    type="button"
                    onClick={analyze}
                    disabled={analyzing}
                    className="relative overflow-hidden rounded-xl bg-accent px-5 py-2.5 text-[14px] font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {analyzing && (
                      <span
                        aria-hidden
                        className="pm-sweep absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent"
                      />
                    )}
                    <span className="relative">
                      {analyzing ? 'Analysing brief…' : 'Build my team'}
                    </span>
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="mt-3 text-center text-[13px] text-warn">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pm-grain min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-5 py-3 sm:gap-6">
          <button
            type="button"
            onClick={() => setStarted(false)}
            aria-label="Start a new project brief"
            className="font-display text-[17px] font-bold tracking-tight whitespace-nowrap"
          >
            Project<span className="text-accent">Match</span>
          </button>

          <div className="min-w-0 flex-1">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a name, skill or office"
              aria-label="Search people"
              className="w-full rounded-full border border-line bg-panel px-4 py-2 text-[13px] outline-none transition-colors focus:border-accent"
            />
          </div>

          <select
            aria-label="Company scope"
            value={scope.companyId ?? ''}
            onChange={(e) => setScope({ companyId: e.target.value || null, office: null })}
            className="shrink-0 rounded-lg border border-line bg-panel px-2.5 py-2 text-[12px]"
          >
            <option value="">Anywhere</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-5 py-6">
        <section className="rounded-xl border border-line bg-panel">
          {briefOpen ? (
            <div className="p-4">
              <label htmlFor="brief" className="text-[12px] text-muted">
                Describe your project, briefly
              </label>
              <textarea
                id="brief"
                rows={3}
                autoFocus
                value={briefText}
                onChange={(e) => {
                  setBriefText(e.target.value);
                  if (error) setError(null);
                }}
                className="mt-2 w-full resize-none rounded-lg border border-line bg-canvas p-3 text-[14px] leading-relaxed outline-none focus:border-accent"
                placeholder="What are you building, roughly how long, and anything that has to be true when it is done."
              />
              {error && (
                <p role="alert" className="mt-2 text-[12px] text-warn">
                  {error}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={analyze}
                  disabled={analyzing}
                  className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-panel transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {analyzing ? 'Analysing brief…' : 'Rebuild team'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setBriefText(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])
                  }
                  className="rounded-lg border border-line px-3 py-2 text-[13px] text-muted hover:border-line-strong hover:text-ink"
                >
                  Another example
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBriefOpen(false);
                    setBriefText(brief.text);
                    setError(null);
                  }}
                  className="px-2 py-2 text-[13px] text-faint hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-[14px] leading-relaxed">{brief.text}</p>
                <p className="mt-1.5 text-[12px] text-faint">
                  {brief.roles.length} roles · {brief.durationWeeks} weeks
                  {brief.domain.length > 0 && ' · ' + brief.domain.map(labelOf).join(', ')}
                  {source && ` · read by ${source}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBriefOpen(true)}
                className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[13px] text-muted hover:border-accent hover:text-accent"
              >
                Edit brief
              </button>
            </div>
          )}
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-4 lg:sticky lg:top-[72px] lg:self-start">
            <TeamPanel
              brief={brief}
              team={team}
              pool={people}
              health={health}
              activeRoleId={activeRoleId}
              onPickRole={setActiveRoleId}
              onClear={(roleId) => setTeam((t) => ({ ...t, [roleId]: null }))}
              onAutoFill={runAutoFill}
              busy={busy}
            />
            <Filters
              companies={companies}
              scope={scope}
              onScope={setScope}
              minHours={minHours}
              onMinHours={setMinHours}
              seniority={seniority}
              onSeniority={setSeniority}
              resultCount={candidates.length}
            />
          </aside>

          <section className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
              <div>
                <h2 className="font-display text-[18px] font-semibold">
                  {activeRole?.title ?? 'Candidates'}
                </h2>
                <p className="mt-0.5 text-[12px] text-faint">
                  {candidates.length} {candidates.length === 1 ? 'candidate' : 'candidates'}
                  {sort === 'bestFit' && ' · ranked by contribution to this team'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12px]"
                  aria-label="Sort candidates"
                >
                  {SORTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {candidates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-10 text-center">
                <p className="text-[14px] text-muted">No candidates match these filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setMinHours(0);
                    setScope({ companyId: null, office: null });
                  }}
                  className="mt-2 text-[13px] text-accent underline underline-offset-2"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-line bg-panel">
                <ul>
                  {candidates.slice(0, 20).map((c, i) => {
                    // The rationale belongs to the top-ranked candidate and sits
                    // inside their card, rather than repeating it in a banner above.
                    const isTop = i === 0 && sort === 'bestFit' && !filtered;
                    return (
                      <PersonCard
                        key={c.person.id}
                        candidate={c}
                        role={activeRole}
                        companyName={companyName(c.person.companyId)}
                        seated={team[activeRole.id] === c.person.id}
                        onToggle={() => toggle(c.person.id)}
                        rationale={isTop ? reason : null}
                        rationaleLoading={isTop && reasonLoading}
                      />
                    );
                  })}
                </ul>
              </div>
            )}

            {candidates.length > 20 && (
              <p className="mt-4 text-center text-[12px] text-faint">
                {candidates.length - 20} further candidates below this ranking
              </p>
            )}
          </section>
        </div>

        <footer className="mt-12 border-t border-line pt-4 text-[11px] leading-relaxed text-faint">
          All profiles are generated and fictional. Matching runs locally in the browser on
          deterministic scoring. Gemini reads the brief and writes the rationale; it does not
          select the team.
        </footer>
      </main>
    </div>
  );
}
