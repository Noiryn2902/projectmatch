'use client';

import type { Candidate } from '@/lib/engine/assemble';
import type { Role } from '@/lib/types';
import { labelOf, sim } from '@/lib/engine/graph';
import Avatar from './Avatar';

/**
 * A tile carries the brief only: who they are, what they add, and the skills
 * that matter for this seat. Contact details live in the detail view, so the
 * grid stays scannable instead of turning into a wall of links.
 */
export default function PersonCard({
  candidate,
  role,
  companyName,
  seated,
  onToggle,
  onExplore,
  rationale,
  rationaleLoading,
}: {
  candidate: Candidate;
  role: Role;
  companyName: string;
  seated: boolean;
  onToggle: () => void;
  onExplore: () => void;
  rationale?: string | null;
  rationaleLoading?: boolean;
}) {
  const { person, breakdown } = candidate;
  const adds = Math.round(breakdown.gapFill * 100);

  const relevant = [...person.skills]
    .map((s) => ({
      ...s,
      rel: Math.max(...role.requirements.map((r) => sim(s.skillId, r.skillId)), 0),
    }))
    .sort((a, b) => b.rel - a.rel || b.level - a.level)
    .slice(0, 3);

  return (
    <li
      className={`pm-in flex flex-col rounded-xl border bg-panel p-4 transition-colors ${
        seated ? 'border-accent bg-accent-soft/30' : 'border-line hover:border-line-strong'
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar person={person} size={44} />

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[15px] leading-tight font-semibold">
            {person.name}
          </h3>
          <p className="mt-0.5 truncate text-[12.5px] text-muted">{person.title}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-faint">
            {person.yearsExp} yrs · {person.hoursPerWeek} hrs/wk · {person.office}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div
            className={`font-display text-[16px] leading-none font-semibold ${
              adds >= 10 ? 'text-accent' : 'text-faint'
            }`}
          >
            {adds}%
          </div>
          <div className="mt-0.5 text-[10.5px] whitespace-nowrap text-faint">gap closed</div>
        </div>
      </div>

      {(rationale || rationaleLoading) && (
        <p
          className={`mt-3 border-l-2 border-ai pl-3 text-[12px] leading-relaxed text-ai ${
            rationaleLoading && !rationale ? 'pm-pulse' : ''
          }`}
        >
          {rationale ?? 'Generating rationale…'}
        </p>
      )}

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {relevant.map((s) => (
          <li
            key={s.skillId}
            className={`rounded-md px-1.5 py-0.5 text-[10.5px] ${
              s.rel >= 0.7 ? 'bg-accent-soft text-accent-ink' : 'bg-panel-2 text-muted'
            }`}
          >
            {labelOf(s.skillId)} <span className="opacity-50">{s.level}/5</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center gap-2 pt-4">
        <button
          type="button"
          onClick={onExplore}
          className="flex-1 rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          Explore
        </button>
        <button
          type="button"
          onClick={onToggle}
          className={`flex-1 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
            seated
              ? 'border-line text-muted hover:border-line-strong hover:text-ink'
              : 'border-accent text-accent hover:bg-accent hover:text-canvas'
          }`}
        >
          {seated ? 'Remove' : 'Add'}
        </button>
      </div>

      <p className="mt-2 text-center text-[10.5px] text-faint">
        {companyName} · {Math.round(candidate.roleMatch * 100)}% role match
      </p>
    </li>
  );
}
