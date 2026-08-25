'use client';

import type { Brief, Person, TeamHealth, TeamState } from '@/lib/types';

function initials(name: string) {
  const p = name.split(' ');
  return (p[0][0] + (p[1]?.[0] ?? '')).toUpperCase();
}

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
            <span className="font-display text-[15px] font-semibold text-accent">{pct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
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
                      <span
                        aria-hidden
                        className="grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold"
                        style={{
                          background: `oklch(0.88 0.07 ${person.hue})`,
                          color: `oklch(0.32 0.09 ${person.hue})`,
                        }}
                      >
                        {initials(person.name)}
                      </span>
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

        <div className="px-3 py-3">
          <button
            type="button"
            onClick={onAutoFill}
            disabled={busy}
            className="w-full rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-panel transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Optimising…' : 'Auto-fill team'}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-panel px-4 py-3.5">
        <h3 className="text-[13px] font-medium">
          {health.gaps.length > 0 ? 'Coverage gaps' : 'No gaps detected'}
        </h3>
        {health.gaps.length === 0 ? (
          <p className="mt-2 text-[12px] text-faint">
            Every requirement is covered and availability aligns.
          </p>
        ) : (
          <ul className="mt-2.5 space-y-2">
            {health.gaps.map((g) => (
              <li key={g.label} className="flex gap-2.5 text-[12px]">
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
      </section>
    </div>
  );
}
