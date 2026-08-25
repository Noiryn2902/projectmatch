'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Brief, Company, Person, ScopeFilter, SortMode, TeamState } from '@/lib/types';
import { autoFill, membersOf, rankCandidates } from '@/lib/engine/assemble';
import { teamHealth } from '@/lib/engine/health';
import { labelOf, sim } from '@/lib/engine/graph';
import PersonCard from './PersonCard';
import TeamPanel from './TeamPanel';

const SORTS: { id: SortMode; label: string }[] = [
  { id: 'bestFit', label: 'Best fit' },
  { id: 'experience', label: 'Most experience' },
  { id: 'availability', label: 'Most available' },
  { id: 'skillMatch', label: 'Closest skills' },
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
  const [briefText, setBriefText] = useState(initialBrief.text);
  const [brief, setBrief] = useState<Brief>(initialBrief);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  const [scope, setScope] = useState<ScopeFilter>({ companyId: null, office: null });
  const [sort, setSort] = useState<SortMode>('bestFit');
  const [search, setSearch] = useState('');
  const [minHours, setMinHours] = useState(0);
  const [busy, setBusy] = useState(false);

  const [team, setTeam] = useState<TeamState>(() =>
    autoFill(initialBrief, people, { companyId: null, office: null }),
  );
  const [activeRoleId, setActiveRoleId] = useState(initialBrief.roles[0]?.id ?? '');

  const [reason, setReason] = useState<{ id: string; text: string } | null>(null);
  const [reasonLoading, setReasonLoading] = useState(false);
  const reasonCache = useRef(new Map<string, string>());

  const companyName = useCallback(
    (id: string) => companies.find((c) => c.id === id)?.name ?? id,
    [companies],
  );

  const activeRole = brief.roles.find((r) => r.id === activeRoleId) ?? brief.roles[0];
  const members = useMemo(() => membersOf(team, people), [team, people]);
  const health = useMemo(
    () => teamHealth(brief, members, brief.roles.length),
    [brief, members],
  );

  const candidates = useMemo(() => {
    if (!activeRole) return [];
    return rankCandidates(people, activeRole, brief, team, { sort, scope, search, minHours });
  }, [people, activeRole, brief, team, sort, scope, search, minHours]);

  const offices = useMemo(() => {
    const c = companies.find((x) => x.id === scope.companyId);
    return c ? c.offices : [];
  }, [companies, scope.companyId]);

  const top = candidates[0];

  // Ask Gemini why the top candidate is the pick. The choice itself is already
  // made by the engine, so this is explanation only and never changes the order.
  useEffect(() => {
    if (!top || !activeRole) {
      setReason(null);
      return;
    }
    const key = `${activeRole.id}:${top.person.id}:${members.length}`;
    const cached = reasonCache.current.get(key);
    if (cached) {
      setReason({ id: key, text: cached });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setReasonLoading(true);
      const covers = [...top.person.skills]
        .map((s) => ({ s, rel: Math.max(...activeRole.requirements.map((r) => sim(s.skillId, r.skillId)), 0) }))
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
          setReason({ id: key, text: json.data.reason });
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
      setError('Tell me a little more about the project.');
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
      if (!json?.ok) throw new Error(json?.error ?? 'Could not read that brief.');

      const next: Brief = { text: briefText, ...json.data };
      setBrief(next);
      setSource(json.source ?? null);
      setActiveRoleId(next.roles[0]?.id ?? '');
      reasonCache.current.clear();
      setTeam(autoFill(next, people, scope));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong reading that brief.');
    } finally {
      setAnalyzing(false);
    }
  }

  function runAutoFill() {
    setBusy(true);
    // Yield a frame so the button state paints before the engine runs.
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

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="font-display text-[17px] font-bold tracking-tight">ProjectMatch</h1>
            <p className="truncate text-[11px] text-faint">
              Scored on what a person adds, not how good they look alone
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <select
              aria-label="Company scope"
              value={scope.companyId ?? ''}
              onChange={(e) =>
                setScope({ companyId: e.target.value || null, office: null })
              }
              className="rounded-lg border border-line bg-panel px-2 py-1.5 text-[12px]"
            >
              <option value="">Anywhere</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {offices.length > 0 && (
              <select
                aria-label="Office scope"
                value={scope.office ?? ''}
                onChange={(e) => setScope((s) => ({ ...s, office: e.target.value || null }))}
                className="rounded-lg border border-line bg-panel px-2 py-1.5 text-[12px]"
              >
                <option value="">All offices</option>
                {offices.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        <section className="rounded-2xl border border-line bg-panel p-4">
          <label htmlFor="brief" className="text-[12px] text-muted">
            Describe your project, briefly
          </label>
          <textarea
            id="brief"
            rows={3}
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
              className="rounded-lg border border-accent bg-accent px-4 py-2 text-[13px] text-panel transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {analyzing ? 'Reading the brief…' : 'Find my team'}
            </button>

            <button
              type="button"
              onClick={() => setBriefText(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])}
              className="rounded-lg border border-line px-3 py-2 text-[13px] text-muted hover:border-line-strong hover:text-ink"
            >
              Try another example
            </button>

            <span className="text-[11px] text-faint">
              {brief.roles.length} roles · {brief.durationWeeks} weeks
              {brief.domain.length > 0 && ' · ' + brief.domain.map(labelOf).join(', ')}
              {source && ` · read by ${source}`}
            </span>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_330px]">
          <div className="order-last lg:order-first">
            <div className="flex flex-wrap gap-1.5">
              {brief.roles.map((r) => {
                const filled = Boolean(team[r.id]);
                const active = r.id === activeRoleId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveRoleId(r.id)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                      active
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line text-muted hover:border-line-strong'
                    }`}
                  >
                    {r.title}
                    <span className={filled ? 'text-accent' : 'text-faint'}> {filled ? '·' : '○'}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSort(s.id)}
                  className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                    sort === s.id
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line text-muted hover:border-line-strong'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search a name, skill or office"
                aria-label="Search people"
                className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-1.5 text-[13px] outline-none focus:border-accent"
              />
              <label className="flex items-center gap-1.5 text-[12px] text-muted">
                min
                <select
                  value={minHours}
                  onChange={(e) => setMinHours(Number(e.target.value))}
                  className="rounded-lg border border-line bg-panel px-2 py-1.5 text-[12px]"
                  aria-label="Minimum free hours per week"
                >
                  {[0, 5, 10, 15].map((h) => (
                    <option key={h} value={h}>
                      {h === 0 ? 'any hrs' : h + ' hrs/wk'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {activeRole && top && sort === 'bestFit' && (
              <div className="mt-3 rounded-xl border border-accent bg-accent-soft p-3">
                <p className="text-[11px] font-medium text-accent-ink">
                  Recommended for {activeRole.title.toLowerCase()}
                </p>
                <p className={`mt-1 text-[13px] leading-relaxed text-accent-ink ${reasonLoading && !reason ? 'pm-pulse' : ''}`}>
                  {reason?.text ??
                    (reasonLoading
                      ? 'Working out why…'
                      : `${top.person.name} closes ${Math.round(top.breakdown.gapFill * 100)}% of what this team is still missing.`)}
                </p>
              </div>
            )}

            <p className="mt-3 text-[12px] text-faint">
              {candidates.length} {candidates.length === 1 ? 'person' : 'people'} available
              {sort === 'bestFit' && ', ranked by what they add to this team'}
            </p>

            {candidates.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-line p-6 text-center">
                <p className="text-[13px] text-muted">Nobody matches those filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setMinHours(0);
                    setScope({ companyId: null, office: null });
                  }}
                  className="mt-2 text-[13px] text-accent underline underline-offset-2"
                >
                  Clear the filters
                </button>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {candidates.slice(0, 24).map((c) => (
                  <PersonCard
                    key={c.person.id}
                    candidate={c}
                    role={activeRole}
                    companyName={companyName(c.person.companyId)}
                    seated={team[activeRole.id] === c.person.id}
                    onToggle={() => toggle(c.person.id)}
                  />
                ))}
              </ul>
            )}

            {candidates.length > 24 && (
              <p className="mt-3 text-center text-[12px] text-faint">
                {candidates.length - 24} more further down the ranking
              </p>
            )}
          </div>

          <aside className="order-first lg:order-last lg:sticky lg:top-[76px] lg:self-start">
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
          </aside>
        </div>

        <footer className="mt-10 border-t border-line pt-4 text-[11px] text-faint">
          Everyone here is generated and fictional. No real people, nothing scraped. All matching
          runs in your browser on plain arithmetic; Gemini only reads the brief and writes the
          explanation, it never picks the team.
        </footer>
      </main>
    </div>
  );
}
