'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Company, Person, Skill } from '@/lib/types';
import Avatar from './Avatar';

function tz(offset: number) {
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

const LEVEL = ['', 'Junior', 'Mid', 'Senior', 'Staff', 'Principal'];

/**
 * Browse the directory by skill family, with no brief involved. This is the
 * plain "who is in here" view: no scoring, because scoring only means
 * something once there is a team to contribute to.
 */
export default function Directory({
  categoryId,
  categoryLabel,
  people,
  skills,
  companies,
  onClose,
}: {
  categoryId: string;
  categoryLabel: string;
  people: Person[];
  skills: Skill[];
  companies: Company[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selected) setSelected(null);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, selected]);

  const labelOf = useMemo(
    () => Object.fromEntries(skills.map((s) => [s.id, s.label])) as Record<string, string>,
    [skills],
  );
  const parentOf = useMemo(
    () => Object.fromEntries(skills.map((s) => [s.id, s.parent])) as Record<string, string>,
    [skills],
  );
  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? id;

  const members = useMemo(() => {
    const k = q.trim().toLowerCase();
    return people
      .filter((p) => p.skills.some((s) => parentOf[s.skillId] === categoryId))
      .filter(
        (p) =>
          !k ||
          p.name.toLowerCase().includes(k) ||
          p.title.toLowerCase().includes(k) ||
          p.office.toLowerCase().includes(k) ||
          p.skills.some((s) => (labelOf[s.skillId] ?? '').toLowerCase().includes(k)),
      )
      .map((p) => ({
        person: p,
        inCategory: p.skills
          .filter((s) => parentOf[s.skillId] === categoryId)
          .sort((a, b) => b.level - a.level),
      }))
      .sort(
        (a, b) =>
          Math.max(...b.inCategory.map((s) => s.level)) -
            Math.max(...a.inCategory.map((s) => s.level)) || b.person.yearsExp - a.person.yearsExp,
      );
  }, [people, parentOf, categoryId, q, labelOf]);

  const active = selected ? people.find((p) => p.id === selected) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-canvas/85 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${categoryLabel} directory`}
        onClick={(e) => e.stopPropagation()}
        className="pm-in mt-0 flex h-full w-full max-w-[1100px] flex-col border-x border-line bg-canvas sm:mt-8 sm:h-[calc(100%-2rem)] sm:rounded-t-2xl sm:border-t"
      >
        <div className="flex items-start gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] tracking-[0.2em] text-accent uppercase">Directory</p>
            <h2 className="mt-1.5 font-display text-[22px] leading-tight font-bold">
              {categoryLabel}
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              {members.length} {members.length === 1 ? 'person' : 'people'} with skills in this
              family
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close directory"
            className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[13px] text-muted hover:border-line-strong hover:text-ink"
          >
            Close
          </button>
        </div>

        <div className="border-b border-line px-5 py-3">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by name, title, skill or office"
            aria-label="Filter these people"
            className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-[13px] outline-none focus:border-accent"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {members.length === 0 ? (
            <p className="py-16 text-center text-[14px] text-muted">Nobody matches that filter.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {members.map(({ person, inCategory }) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(person.id)}
                    className="flex h-full w-full flex-col rounded-xl border border-line bg-panel p-4 text-left transition-colors hover:border-accent hover:bg-panel-2"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar person={person} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-[15px] leading-tight font-semibold">
                          {person.name}
                        </p>
                        <p className="mt-0.5 truncate text-[12.5px] text-muted">{person.title}</p>
                        <p className="mt-0.5 truncate text-[11.5px] text-faint">
                          {companyName(person.companyId)} · {person.office}
                        </p>
                      </div>
                    </div>

                    <ul className="mt-3 flex flex-wrap gap-1">
                      {inCategory.slice(0, 4).map((s) => (
                        <li
                          key={s.skillId}
                          className="rounded bg-accent-soft px-1.5 py-0.5 text-[10.5px] text-accent-ink"
                        >
                          {labelOf[s.skillId]} <span className="opacity-60">{s.level}/5</span>
                        </li>
                      ))}
                    </ul>

                    <p className="mt-auto pt-3 text-[11.5px] text-faint">
                      {person.yearsExp} yrs · {person.hoursPerWeek} hrs/wk ·{' '}
                      {person.openToProjects ? (
                        <span className="text-good">open to projects</span>
                      ) : (
                        <span className="text-warn">not available</span>
                      )}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {active && (
        <div
          className="fixed inset-0 z-60 flex items-end justify-center bg-canvas/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setSelected(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={active.name}
            onClick={(e) => e.stopPropagation()}
            className="pm-in max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl border border-line-strong bg-panel shadow-[0_40px_100px_-30px_rgba(0,0,0,0.95)] sm:rounded-2xl"
          >
            <div className="flex items-start gap-4 border-b border-line p-5">
              <Avatar person={active} size={64} />
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[20px] leading-tight font-semibold">
                  {active.name}
                </h3>
                <p className="mt-1 text-[14px] text-muted">{active.title}</p>
                <p className="mt-1 text-[13px] text-faint">
                  {companyName(active.companyId)} · {active.office} · {tz(active.utcOffset)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close profile"
                className="shrink-0 rounded-lg px-2 py-1 text-[18px] leading-none text-faint hover:bg-panel-2 hover:text-ink"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
              {[
                [active.yearsExp + ' yrs', LEVEL[active.seniority] + ' level'],
                [active.hoursPerWeek + ' hrs', 'free each week'],
                [active.skills.length + '', 'skills on file'],
              ].map(([big, small]) => (
                <div key={small} className="px-3 py-3.5 text-center">
                  <div className="font-display text-[17px] font-semibold text-accent">{big}</div>
                  <div className="mt-0.5 text-[11px] text-faint">{small}</div>
                </div>
              ))}
            </div>

            <div className="border-b border-line p-5">
              <h4 className="text-[12px] font-medium text-muted">Every skill, with level</h4>
              <ul className="mt-3 space-y-2">
                {[...active.skills]
                  .sort((a, b) => b.level - a.level)
                  .map((s) => (
                    <li key={s.skillId} className="flex items-center gap-3">
                      <span className="w-[130px] shrink-0 truncate text-[12.5px] text-muted">
                        {labelOf[s.skillId]}
                      </span>
                      <span className="flex flex-1 gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span
                            key={n}
                            className={`h-1.5 flex-1 rounded-full ${
                              n <= s.level ? 'bg-good' : 'bg-panel-2'
                            }`}
                          />
                        ))}
                      </span>
                      <span className="w-8 shrink-0 text-right text-[12px] text-faint">
                        {s.level}/5
                      </span>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="p-5">
              <h4 className="text-[12px] font-medium text-muted">Get in touch</h4>
              <div className="mt-2.5 space-y-1.5 text-[13px]">
                <a
                  className="block text-accent underline-offset-2 hover:underline"
                  href={`mailto:${active.contact.email}`}
                >
                  {active.contact.email}
                </a>
                <p className="text-muted">Slack {active.contact.slack}</p>
                <a
                  className="block text-accent underline-offset-2 hover:underline"
                  href={`https://${active.contact.linkedin}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {active.contact.linkedin}
                </a>
                {active.contact.github && (
                  <a
                    className="block text-accent underline-offset-2 hover:underline"
                    href={`https://${active.contact.github}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {active.contact.github}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
