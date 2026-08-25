'use client';

import type { Candidate } from '@/lib/engine/assemble';
import type { Role } from '@/lib/types';
import { labelOf, sim } from '@/lib/engine/graph';

function initials(name: string) {
  const p = name.split(' ');
  return (p[0][0] + (p[1]?.[0] ?? '')).toUpperCase();
}

function tz(offset: number) {
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

export default function PersonCard({
  candidate,
  role,
  companyName,
  seated,
  onToggle,
}: {
  candidate: Candidate;
  role: Role;
  companyName: string;
  seated: boolean;
  onToggle: () => void;
}) {
  const { person, breakdown } = candidate;
  const adds = Math.round(breakdown.gapFill * 100);

  const relevant = [...person.skills]
    .map((s) => ({
      ...s,
      rel: Math.max(...role.requirements.map((r) => sim(s.skillId, r.skillId)), 0),
    }))
    .sort((a, b) => b.rel - a.rel || b.level - a.level)
    .slice(0, 5);

  return (
    <li
      className={`pm-in rounded-xl border bg-panel p-4 transition-colors ${
        seated ? 'border-accent' : 'border-line hover:border-line-strong'
      }`}
    >
      <div className="flex flex-wrap gap-3">
        <div
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold"
          style={{
            background: `oklch(0.88 0.07 ${person.hue})`,
            color: `oklch(0.32 0.09 ${person.hue})`,
          }}
        >
          {initials(person.name)}
        </div>

        <div className="min-w-[60%] flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-[15px] font-semibold">{person.name}</span>
            {seated && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent-ink">
                in this seat
              </span>
            )}
          </div>

          <p className="text-[13px] text-muted">{person.title}</p>
          <p className="mt-0.5 text-[12px] text-faint">
            {companyName} · {person.office} · {tz(person.utcOffset)} · {person.yearsExp} yrs
          </p>

          <ul className="mt-2 flex flex-wrap gap-1.5">
            {relevant.map((s) => (
              <li
                key={s.skillId}
                className={`rounded-md px-1.5 py-0.5 text-[11px] ${
                  s.rel >= 0.7
                    ? 'bg-accent-soft text-accent-ink'
                    : 'bg-panel-2 text-muted'
                }`}
              >
                {labelOf(s.skillId)}
                <span className="opacity-55"> {s.level}/5</span>
              </li>
            ))}
          </ul>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
            <a className="underline-offset-2 hover:text-accent hover:underline" href={`mailto:${person.contact.email}`}>
              {person.contact.email}
            </a>
            <span>{person.contact.slack}</span>
            <a
              className="underline-offset-2 hover:text-accent hover:underline"
              href={`https://${person.contact.linkedin}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              LinkedIn
            </a>
            {person.contact.github && (
              <a
                className="underline-offset-2 hover:text-accent hover:underline"
                href={`https://${person.contact.github}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                GitHub
              </a>
            )}
          </div>
        </div>

        {/* Wraps to a full-width row under the card on narrow screens, so the
            name and skills keep a readable column at 380px. */}
        <div className="flex w-full shrink-0 items-center justify-between gap-3 border-t border-line pt-2.5 sm:w-auto sm:flex-col sm:items-end sm:justify-start sm:border-0 sm:pt-0">
          <div className="flex items-baseline gap-2 sm:block sm:text-right">
            <div
              className={`font-display text-[15px] font-semibold ${
                adds >= 10 ? 'text-accent' : 'text-faint'
              }`}
            >
              adds {adds}%
            </div>
            {/* Ranking weighs seat fit too, so show it or the order looks wrong. */}
            <div className="text-[11px] text-faint">fits seat {Math.round(candidate.roleMatch * 100)}%</div>
            <div className="text-[11px] text-faint">{person.hoursPerWeek} hrs/wk free</div>
          </div>

          <button
            type="button"
            onClick={onToggle}
            className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors ${
              seated
                ? 'border-line text-muted hover:border-line-strong hover:text-ink'
                : 'border-accent bg-accent text-panel hover:opacity-90'
            }`}
          >
            {seated ? 'Remove' : 'Add'}
          </button>
        </div>
      </div>
    </li>
  );
}
