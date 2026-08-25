'use client';

import { useMemo } from 'react';
import type { Person, Skill } from '@/lib/types';
import Reveal from './Reveal';

const I = 'size-6 stroke-[1.5]';

const ICONS: Record<string, React.ReactNode> = {
  frontend: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={I}>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M2 9h20M8 22h8" />
    </svg>
  ),
  backend: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={I}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  ),
  devops: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={I}>
      <path d="M12 2 3 7v10l9 5 9-5V7z" />
      <path d="m3 7 9 5 9-5M12 12v10" />
    </svg>
  ),
  mobile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={I}>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  ),
  ml: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={I}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="m7 7 3 3m4 0 3-3M7 17l3-3m4 0 3 3" />
    </svg>
  ),
  'data-eng': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={I}>
      <path d="M3 6h18M6 12h12M9 18h6" />
      <circle cx="3" cy="6" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={I}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  design: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={I}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="9" r="1.4" />
      <circle cx="15.5" cy="10" r="1.4" />
      <path d="M12 21c2 0 2-2 3.5-2S18 17 18 15" />
    </svg>
  ),
  product: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={I}>
      <path d="M3 7h18v13H3zM8 7V4h8v3" />
      <path d="M3 12h18" />
    </svg>
  ),
  quality: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={I}>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  comms: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={I}>
      <path d="M21 12a8 8 0 0 1-8 8H4l2.5-2.5A8 8 0 1 1 21 12Z" />
      <path d="M8.5 11h7M8.5 14.5h4" />
    </svg>
  ),
  domain: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={I}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" />
    </svg>
  ),
};

const ORDER: [string, string][] = [
  ['design', 'text-accent'],
  ['backend', 'text-good'],
  ['data-eng', 'text-ai'],
  ['devops', 'text-accent'],
  ['frontend', 'text-good'],
  ['product', 'text-ai'],
  ['quality', 'text-accent'],
  ['analytics', 'text-good'],
  ['ml', 'text-ai'],
  ['mobile', 'text-accent'],
  ['comms', 'text-good'],
  ['domain', 'text-ai'],
];

export default function Categories({
  people,
  skills,
}: {
  people: Person[];
  skills: Skill[];
}) {
  // Counted from the directory itself, so these can never drift from the data.
  const counts = useMemo(() => {
    const parent = Object.fromEntries(skills.map((s) => [s.id, s.parent]));
    const acc: Record<string, Set<string>> = {};
    for (const [g] of ORDER) acc[g] = new Set();
    for (const p of people) {
      for (const s of p.skills) {
        const g = parent[s.skillId];
        if (g && acc[g]) acc[g].add(p.id);
      }
    }
    return acc;
  }, [people, skills]);

  const labels = useMemo(
    () => Object.fromEntries(skills.map((s) => [s.id, s.label])),
    [skills],
  );

  return (
    <section className="mx-auto max-w-[1180px] px-5 py-20">
      <Reveal>
        <h2 className="font-display text-[26px] leading-tight font-bold tracking-tight sm:text-[32px]">
          Every kind of work a team needs
        </h2>
        <p className="mt-2 max-w-[520px] text-[14px] leading-relaxed text-muted">
          Twelve families of skill, connected by a graph so neighbouring skills still count.
        </p>
      </Reveal>

      <ul className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ORDER.map(([id, tone], i) => (
          <Reveal key={id} delay={(i % 4) * 70}>
            <li className="h-full rounded-xl border border-line bg-panel p-5 transition-colors hover:border-line-strong">
              <span className={tone}>{ICONS[id]}</span>
              <p className="mt-4 text-[14px] leading-snug font-medium">{labels[id] ?? id}</p>
              <p className="mt-1 text-[12px] text-faint">{counts[id]?.size ?? 0} people</p>
            </li>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
