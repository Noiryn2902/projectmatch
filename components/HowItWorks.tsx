'use client';

import Reveal from './Reveal';

/** Small CSS-only illustrations. No images to load, nothing to go missing. */

function BriefArt() {
  return (
    <div className="rounded-lg border border-line bg-canvas p-3">
      <div className="space-y-1.5">
        <span className="block h-1.5 w-[85%] rounded-full bg-line-strong" />
        <span className="block h-1.5 w-[68%] rounded-full bg-line-strong" />
        <span className="block h-1.5 w-[40%] rounded-full bg-line-strong" />
      </div>
      <div className="mt-3 flex justify-end">
        <span className="rounded-md bg-accent px-2.5 py-1 text-[9px] font-medium text-canvas">
          Build my team
        </span>
      </div>
    </div>
  );
}

function RolesArt() {
  return (
    <div className="rounded-lg border border-line bg-canvas p-3">
      <div className="flex flex-wrap gap-1.5">
        {['Frontend engineer', 'Product designer', 'ML engineer', 'Domain expert'].map((r, i) => (
          <span
            key={r}
            className={`rounded-full px-2 py-1 text-[9px] ${
              i === 0 ? 'bg-accent-soft text-accent-ink' : 'bg-panel-2 text-muted'
            }`}
          >
            {r}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[9px] text-faint">4 roles · 6 weeks · Customer support</p>
    </div>
  );
}

function TeamArt() {
  return (
    <div className="rounded-lg border border-line bg-canvas p-3">
      <div className="flex items-baseline justify-between text-[9px]">
        <span className="text-muted">Requirements covered</span>
        <span className="font-display text-[12px] font-semibold text-accent">91%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
        <span className="block h-full w-[91%] rounded-full bg-accent" />
      </div>
      <div className="mt-3 space-y-1.5">
        <p className="flex gap-1.5 text-[9px] text-warn">
          <span className="mt-1 size-1 shrink-0 rounded-full bg-warn" />
          No coverage for PostgreSQL
        </p>
        <p className="flex gap-1.5 text-[9px] text-muted">
          <span className="mt-1 size-1 shrink-0 rounded-full bg-line-strong" />
          Team overlap is only 3 hrs per week
        </p>
      </div>
    </div>
  );
}

const STEPS = [
  {
    n: '01',
    title: 'Describe the project',
    body: 'Two lines in plain English. What you are building, roughly how long, and anything that has to be true when it is done.',
    art: <BriefArt />,
  },
  {
    n: '02',
    title: 'AI reads it into roles',
    body: 'Gemini turns the brief into weighted requirements: which roles, which skills, what level, how many hours a week each seat needs.',
    art: <RolesArt />,
  },
  {
    n: '03',
    title: 'The engine builds the team',
    body: 'Each seat goes to whoever closes the most of what is still missing. Then it tells you what the team it just built still cannot do.',
    art: <TeamArt />,
  },
];

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1180px] px-5 py-20">
      <Reveal>
        <h2 className="font-display text-[26px] leading-tight font-bold tracking-tight sm:text-[32px]">
          How it works
        </h2>
        <p className="mt-2 max-w-[520px] text-[14px] leading-relaxed text-muted">
          Three steps, and only one of them involves you doing any work.
        </p>
      </Reveal>

      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 120}>
            <li className="h-full rounded-xl border border-line bg-panel p-5">
              <span className="font-display text-[12px] font-semibold tracking-widest text-accent">
                {s.n}
              </span>
              <h3 className="mt-3 font-display text-[17px] font-semibold">{s.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{s.body}</p>
              <div className="mt-5">{s.art}</div>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
