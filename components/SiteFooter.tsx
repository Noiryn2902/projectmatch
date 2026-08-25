'use client';

import type { Company } from '@/lib/types';

const COLUMNS: { head: string; items: string[] }[] = [
  {
    head: 'How it works',
    items: [
      'Write a two-line brief',
      'AI reads it into roles',
      'The engine fills each seat',
      'Swap anyone, watch it recalculate',
    ],
  },
  {
    head: 'What it scores',
    items: [
      'Contribution to the team',
      'Fit for the specific role',
      'Hours and timezone overlap',
      'Experience and domain interest',
    ],
  },
  {
    head: 'The data',
    items: [
      '60 opt-in profiles',
      '82 skills in a graph',
      'Levelled 1 to 5, not tags',
      'Generated, never scraped',
    ],
  },
];

export default function SiteFooter({ companies }: { companies: Company[] }) {
  return (
    <footer className="border-t border-line bg-panel/40">
      <div className="mx-auto max-w-[1180px] xl:max-w-[1400px] px-5 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-[18px] font-bold tracking-tight">
              Project<span className="text-accent">Match</span>
            </p>
            <p className="mt-3 max-w-[240px] text-[13px] leading-relaxed text-muted">
              Scored on what each person adds to the team, not how good they look alone.
            </p>
            <a
              href="https://github.com/Noiryn2902/projectmatch"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-4 inline-block text-[13px] text-accent underline-offset-2 hover:underline"
            >
              Source on GitHub
            </a>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.head}>
              <p className="text-[13px] font-medium">{col.head}</p>
              <ul className="mt-3.5 space-y-2.5">
                {col.items.map((it) => (
                  <li key={it} className="text-[13px] leading-relaxed text-muted">
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-line pt-8">
          <p className="text-[11px] tracking-[0.18em] text-faint uppercase">
            Companies in the directory
          </p>
          <ul className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
            {companies.map((c) => (
              <li key={c.id} className="font-display text-[15px] font-semibold text-muted">
                {c.name}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-faint">
            Every company and person here is generated and fictional. Nothing on this page is a
            real endorsement.
          </p>
        </div>

        <p className="mt-10 text-[11px] leading-relaxed text-faint">
          Matching runs locally in the browser on deterministic scoring. Gemini reads the brief and
          writes the rationale, and does not select the team. Built for PromptWars.
        </p>
      </div>
    </footer>
  );
}
