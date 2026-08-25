'use client';

import type { Candidate } from '@/lib/engine/assemble';
import type { Role } from '@/lib/types';
import { labelOf, sim } from '@/lib/engine/graph';

function initials(name: string) {
  const p = name.split(' ');
  return (p[0][0] + (p[1]?.[0] ?? '')).toUpperCase();
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
    .slice(0, 4);

  return (
    <li
      className={`pm-in border-b border-line px-5 py-5 transition-colors last:border-b-0 ${
        seated ? 'bg-accent-soft/40' : 'hover:bg-panel-2/50'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold"
          style={{
            background: `oklch(0.88 0.07 ${person.hue})`,
            color: `oklch(0.32 0.09 ${person.hue})`,
          }}
        >
          {initials(person.name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-display text-[16px] leading-tight font-semibold">
                {person.name}
                {seated && (
                  <span className="ml-2 align-middle rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium tracking-wide text-panel">
                    on the team
                  </span>
                )}
              </h3>
              <p className="mt-1 text-[13px] text-muted">{person.title}</p>
              <p className="mt-0.5 text-[12px] text-faint">
                {companyName} · {person.office} · {person.yearsExp} yrs
              </p>
            </div>

            <div className="shrink-0 text-right">
              <div
                className={`font-display text-[17px] leading-none font-semibold ${
                  adds >= 10 ? 'text-accent' : 'text-faint'
                }`}
              >
                {adds}%
              </div>
              <div className="mt-1 text-[11px] whitespace-nowrap text-faint">of the gap</div>
            </div>
          </div>

          <ul className="mt-3 flex flex-wrap gap-1.5">
            {relevant.map((s) => (
              <li
                key={s.skillId}
                className={`rounded-md px-2 py-1 text-[11px] ${
                  s.rel >= 0.7 ? 'bg-accent-soft text-accent-ink' : 'bg-panel-2 text-muted'
                }`}
              >
                {labelOf(s.skillId)} <span className="opacity-50">{s.level}/5</span>
              </li>
            ))}
          </ul>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-faint">
              {person.hoursPerWeek} hrs/wk free · fits this seat{' '}
              {Math.round(candidate.roleMatch * 100)}%
            </p>

            <div className="flex items-center gap-3">
              <a
                className="text-[12px] text-faint underline-offset-2 hover:text-accent hover:underline"
                href={`mailto:${person.contact.email}`}
              >
                Email
              </a>
              <span className="text-[12px] text-faint">{person.contact.slack}</span>
              <a
                className="text-[12px] text-faint underline-offset-2 hover:text-accent hover:underline"
                href={`https://${person.contact.linkedin}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                LinkedIn
              </a>
              <button
                type="button"
                onClick={onToggle}
                className={`rounded-lg border px-4 py-1.5 text-[13px] font-medium transition-colors ${
                  seated
                    ? 'border-line text-muted hover:border-line-strong hover:text-ink'
                    : 'border-accent text-accent hover:bg-accent hover:text-panel'
                }`}
              >
                {seated ? 'Remove' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
