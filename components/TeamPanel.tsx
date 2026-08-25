'use client';

import type { Brief, Person, TeamHealth, TeamState } from '@/lib/types';
import Avatar from './Avatar';

export default function TeamPanel({
  brief,
  team,
  pool,
  health,
  activeRoleId,
  onPickRole,
  onClear,
  onAutoFill,
  busy,
  onFindCover,
}: {
  brief: Brief;
  team: TeamState;
  pool: Person[];
  health: TeamHealth;
  activeRoleId: string;
  onPickRole: (id: string) => void;
  onClear: (roleId: string) => void;
  onAutoFill: () => void;
  busy: boolean;
  onFindCover?: (label: string) => void;
}) {
  const byId = new Map(pool.map((p) => [p.id, p]));
  const pct = Math.round(health.coverage * 100);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-panel">
        <div className="border-b border-line px-4 py-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-semibold">Team</h2>
            <span className="text-[12px] text-muted">
              {health.filled} of {health.seats}
            </span>
          </div>

          <div className="mt-2.5 flex items-baseline justify-between text-[12px]">
            <span className="text-muted">Requirements covered</span>
            <span className="font-display text-[15px] font-semibold text-good">{pct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
            <div
              className="h-full rounded-full bg-good transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-faint">
            {health.overlapHours} hrs per week of overlapping availability
          </p>
        </div>

        <ul>
          {brief.roles.map((role) => {
            const person = team[role.id] ? byId.get(team[role.id]!) : undefined;
            const active = role.id === activeRoleId;
            return (
              <li key={role.id} className="border-b border-line last:border-b-0">
                <div
                  className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
                    active ? 'bg-accent-soft' : 'hover:bg-panel-2'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onPickRole(role.id)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    aria-current={active ? 'true' : undefined}
                  >
                    {person ? (
                      <Avatar person={person} size={28} />
                    ) : (
                      <span
                        aria-hidden
                        className="size-7 shrink-0 rounded-full border border-dashed border-line-strong"
                      />
                    )}
                    <span className="min-w-0">
                      {/* Gemini writes role titles like "Backend and Infrastructure
                          Engineer", which will not fit one line in a 300px rail. */}
                      <span className="block text-[13px] leading-snug font-medium">{role.title}</span>
                      <span
                        className={`block truncate text-[12px] ${
                          person ? 'text-muted' : 'text-faint italic'
                        }`}
                      >
                        {person ? person.name : 'Unfilled'}
                      </span>
                    </span>
                  </button>

                  {person && (
                    <button
                      type="button"
                      onClick={() => onClear(role.id)}
                      aria-label={`Remove ${person.name} from ${role.title}`}
                      className="shrink-0 rounded px-2 py-1 text-[11px] text-faint hover:bg-panel hover:text-warn"
                    >
                      Replace
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="p-3">
          <button
            type="button"
            onClick={onAutoFill}
            disabled={busy}
            className="relative flex w-full items-center gap-3 overflow-hidden rounded-xl bg-accent px-3.5 py-3 text-left transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy && (
              <span
                aria-hidden
                className="pm-sweep absolute inset-0 bg-gradient-to-r from-transparent via-white/45 to-transparent"
              />
            )}

            <span
              aria-hidden
              className="relative grid size-8 shrink-0 place-items-center rounded-lg bg-canvas/15"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-[17px] text-canvas"
              >
                <circle cx="4.5" cy="5.5" r="1.9" />
                <circle cx="4.5" cy="18.5" r="1.9" />
                <circle cx="19" cy="12" r="2.3" />
                <path d="M6.4 6.6 16.8 11M6.4 17.4 16.8 13" />
              </svg>
            </span>

            <span className="relative min-w-0">
              <span className="block text-[13.5px] leading-tight font-medium text-canvas">
                {busy ? 'Assembling…' : health.filled === 0 ? 'Assemble the team' : 'Rebuild the team'}
              </span>
              <span className="mt-0.5 block text-[11px] leading-tight text-canvas/70">
                Fills every seat by contribution
              </span>
            </span>
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-line border-l-2 border-l-accent bg-panel px-4 py-3.5">
        <h3 className="text-[13px] font-medium">
          {health.gaps.length > 0 ? 'Still uncovered' : 'No gaps detected'}
        </h3>
        {health.gaps.length === 0 ? (
          <p className="mt-2 text-[12px] text-faint">
            Every requirement is covered and availability aligns.
          </p>
        ) : (
          <>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {health.gaps.map((g) => (
                <button
                  key={g.label}
                  type="button"
                  onClick={() => onFindCover?.(g.label)}
                  className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                    g.severity === 'high'
                      ? 'border-warn/40 bg-warn-soft text-warn hover:border-warn'
                      : 'border-accent/40 bg-accent-soft text-accent hover:border-accent'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] text-faint">
              Click a gap to find someone who covers it.
            </p>
          </>
        )}
      </section>

    </div>
  );
}
