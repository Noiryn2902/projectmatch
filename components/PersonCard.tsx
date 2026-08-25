'use client';

import type { Candidate } from '@/lib/engine/assemble';
import type { Role } from '@/lib/types';
import { labelOf, sim } from '@/lib/engine/graph';
import Avatar from './Avatar';

/**
 * One tile, one action. The whole card opens the profile and the only button
 * is the one that changes the team, so a grid of these does not read as
 * forty competing controls.
 *
 * Everything above the button row is fixed height per line, so tiles line up
 * across the grid whether or not a card carries a rationale.
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
      className={`pm-in flex flex-col overflow-hidden rounded-xl border transition-colors ${
        seated ? 'border-accent bg-accent-soft/25' : 'border-line bg-panel hover:border-line-strong'
      }`}
    >
      <button
        type="button"
        onClick={onExplore}
        aria-label={`Open ${person.name}'s profile`}
        className="flex flex-1 flex-col p-4 text-left"
      >
        <div className="flex items-start gap-3">
          <Avatar person={person} size={42} />

          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-[15px] leading-tight font-semibold">
              {person.name}
            </h3>
            <p className="mt-0.5 truncate text-[12.5px] text-muted">{person.title}</p>
            <p className="mt-1 truncate text-[11.5px] text-faint">
              {companyName} · {person.office}
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-faint">
              {person.yearsExp} yrs · {person.hoursPerWeek} hrs/wk ·{' '}
              {Math.round(candidate.roleMatch * 100)}% role fit
            </p>
          </div>

          <div className="shrink-0 text-right">
            <div
              className={`font-display text-[16px] leading-none font-semibold ${
                adds >= 10 ? 'text-good' : 'text-faint'
              }`}
            >
              {adds}%
            </div>
            <div className="mt-1 text-[10.5px] whitespace-nowrap text-faint">gap closed</div>
          </div>
        </div>

        <ul className="mt-3 flex flex-wrap gap-1">
          {relevant.map((s) => (
            <li
              key={s.skillId}
              className={`rounded px-1.5 py-0.5 text-[10.5px] ${
                s.rel >= 0.7 ? 'bg-accent-soft text-accent-ink' : 'bg-panel-2 text-muted'
              }`}
            >
              {labelOf(s.skillId)} <span className="opacity-55">{s.level}/5</span>
            </li>
          ))}
        </ul>

        {/* Clamped so a card carrying a rationale stays the same height as one
            that does not, which is what made the grid look ragged. */}
        {(rationale || rationaleLoading) && (
          <p
            className={`mt-3 line-clamp-2 border-l-2 border-ai pl-2.5 text-[11.5px] leading-relaxed text-ai ${
              rationaleLoading && !rationale ? 'pm-pulse' : ''
            }`}
          >
            {rationale ?? 'Generating rationale…'}
          </p>
        )}
      </button>

      <div className="mt-auto flex items-center gap-2 border-t border-line px-4 py-3">
        <span className="flex-1 text-[11px] text-faint">
          {seated ? 'On the team' : 'Tap the card for the full profile'}
        </span>
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-lg px-4 py-1.5 text-[12.5px] font-medium transition-colors ${
            seated
              ? 'border border-line text-muted hover:border-line-strong hover:text-ink'
              : 'bg-accent text-canvas hover:opacity-90'
          }`}
        >
          {seated ? 'Remove' : 'Add'}
        </button>
      </div>
    </li>
  );
}
