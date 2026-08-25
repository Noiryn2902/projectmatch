'use client';

import { useEffect } from 'react';
import type { Candidate } from '@/lib/engine/assemble';
import type { Role } from '@/lib/types';
import { labelOf, sim } from '@/lib/engine/graph';
import Avatar from './Avatar';

function tz(offset: number) {
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

const LEVEL = ['', 'Junior', 'Mid', 'Senior', 'Staff', 'Principal'];

export default function PersonDetail({
  candidate,
  role,
  companyName,
  seated,
  onToggle,
  onClose,
}: {
  candidate: Candidate;
  role: Role;
  companyName: string;
  seated: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { person, breakdown } = candidate;
  const adds = Math.round(breakdown.gapFill * 100);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const skills = [...person.skills]
    .map((s) => ({
      ...s,
      rel: Math.max(...role.requirements.map((r) => sim(s.skillId, r.skillId)), 0),
    }))
    .sort((a, b) => b.rel - a.rel || b.level - a.level);

  const bars: [string, number][] = [
    ['Closes the gap', breakdown.gapFill],
    ['Fits this role', candidate.roleMatch],
    ['Availability', breakdown.availability],
    ['Experience level', breakdown.experience],
    ['Domain interest', breakdown.interest],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-canvas/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={person.name}
        onClick={(e) => e.stopPropagation()}
        className="pm-in max-h-[92vh] w-full max-w-[640px] overflow-y-auto rounded-t-2xl border border-line-strong bg-panel shadow-[0_40px_100px_-30px_rgba(0,0,0,0.95)] sm:rounded-2xl"
      >
        <div className="flex items-start gap-4 border-b border-line p-5">
          <Avatar person={person} size={64} />

          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[20px] leading-tight font-semibold">{person.name}</h2>
            <p className="mt-1 text-[14px] text-muted">{person.title}</p>
            <p className="mt-1 text-[13px] text-faint">
              {companyName} · {person.office} · {tz(person.utcOffset)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg px-2 py-1 text-[18px] leading-none text-faint hover:bg-panel-2 hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
          {[
            [adds + '%', 'of the gap closed'],
            [person.yearsExp + ' yrs', LEVEL[person.seniority] + ' level'],
            [person.hoursPerWeek + ' hrs', 'free each week'],
          ].map(([big, small]) => (
            <div key={small} className="px-4 py-3.5 text-center">
              <div className="font-display text-[18px] font-semibold text-accent">{big}</div>
              <div className="mt-0.5 text-[11px] text-faint">{small}</div>
            </div>
          ))}
        </div>

        <div className="border-b border-line p-5">
          <h3 className="text-[12px] font-medium text-muted">Why this score</h3>
          <ul className="mt-3 space-y-2.5">
            {bars.map(([label, v]) => (
              <li key={label} className="flex items-center gap-3">
                <span className="w-[116px] shrink-0 text-[12px] text-muted">{label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                  <span
                    className="block h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: Math.round(v * 100) + '%' }}
                  />
                </span>
                <span className="w-9 shrink-0 text-right text-[12px] text-faint">
                  {Math.round(v * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-b border-line p-5">
          <h3 className="text-[12px] font-medium text-muted">
            Skills · {skills.length} on file, matched against this role
          </h3>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <li
                key={s.skillId}
                title={s.rel >= 0.7 ? 'Directly relevant to this role' : 'Not required here'}
                className={`rounded-md px-2 py-1 text-[11px] ${
                  s.rel >= 0.7 ? 'bg-accent-soft text-accent-ink' : 'bg-panel-2 text-muted'
                }`}
              >
                {labelOf(s.skillId)} <span className="opacity-50">{s.level}/5</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-5">
          <h3 className="text-[12px] font-medium text-muted">Get in touch</h3>
          <div className="mt-2.5 space-y-1.5 text-[13px]">
            <a
              className="block text-accent underline-offset-2 hover:underline"
              href={`mailto:${person.contact.email}`}
            >
              {person.contact.email}
            </a>
            <p className="text-muted">Slack {person.contact.slack}</p>
            <a
              className="block text-accent underline-offset-2 hover:underline"
              href={`https://${person.contact.linkedin}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              {person.contact.linkedin}
            </a>
            {person.contact.github && (
              <a
                className="block text-accent underline-offset-2 hover:underline"
                href={`https://${person.contact.github}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                {person.contact.github}
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onToggle();
              onClose();
            }}
            className={`mt-5 w-full rounded-xl px-4 py-2.5 text-[14px] font-medium transition-opacity ${
              seated
                ? 'border border-line text-muted hover:border-line-strong hover:text-ink'
                : 'bg-accent text-canvas hover:opacity-90'
            }`}
          >
            {seated ? `Remove from ${role.title}` : `Add to ${role.title}`}
          </button>
        </div>
      </div>
    </div>
  );
}
