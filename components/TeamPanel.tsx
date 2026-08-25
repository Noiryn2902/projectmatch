'use client';

import type { Brief, Person, TeamHealth, TeamState } from '@/lib/types';

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
}) {
  const byId = new Map(pool.map((p) => [p.id, p]));
  const pct = Math.round(health.coverage * 100);

  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold">Your team</h2>
        <span className="text-[12px] text-muted">
          {health.filled} of {health.seats} seats
        </span>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-[12px]">
          <span className="text-muted">Requirements covered</span>
          <span className="font-display font-semibold text-accent">{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-faint">
          {health.overlapHours} hrs a week the whole team is awake together
        </p>
      </div>

      <ul className="mt-4 space-y-1">
        {brief.roles.map((role) => {
          const person = team[role.id] ? byId.get(team[role.id]!) : undefined;
          const active = role.id === activeRoleId;
          return (
            <li key={role.id}>
              <div
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
                  active ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-panel-2'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onPickRole(role.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-[13px] font-medium">{role.title}</span>
                  <span
                    className={`block truncate text-[12px] ${
                      person ? 'text-muted' : 'text-faint italic'
                    }`}
                  >
                    {person ? person.name : 'empty seat'}
                  </span>
                </button>
                {person && (
                  <button
                    type="button"
                    onClick={() => onClear(role.id)}
                    aria-label={`Remove ${person.name} from ${role.title}`}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-faint hover:bg-panel hover:text-warn"
                  >
                    swap
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onAutoFill}
        disabled={busy}
        className="mt-3 w-full rounded-lg border border-accent bg-accent px-3 py-2 text-[13px] text-panel transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Working…' : 'Auto-fill best team'}
      </button>

      <div className="mt-4 border-t border-line pt-3">
        <h3 className="text-[12px] font-medium text-muted">
          {health.gaps.length > 0 ? 'Still missing' : 'Nothing obvious missing'}
        </h3>
        {health.gaps.length === 0 ? (
          <p className="mt-1.5 text-[12px] text-faint">
            Every requirement is covered and the hours line up.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {health.gaps.map((g) => (
              <li key={g.label} className="flex gap-2 text-[12px]">
                <span
                  aria-hidden
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                    g.severity === 'high' ? 'bg-warn' : 'bg-line-strong'
                  }`}
                />
                <span className={g.severity === 'high' ? 'text-warn' : 'text-muted'}>{g.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
