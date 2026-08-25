'use client';

import type { Person } from '@/lib/types';
import Avatar from './Avatar';
import Reveal from './Reveal';

const POINTS = [
  {
    title: 'It scores contribution, not similarity',
    body: 'Add a frontend developer and the next frontend developer drops to 0%, because you already have that covered. A directory ranks people one at a time, so it cannot know.',
    figure: (
      <div className="space-y-2">
        {[
          ['Principal frontend engineer', '0%', false],
          ['Junior product designer', '12%', true],
        ].map(([label, pct, good]) => (
          <div key={label as string} className="flex items-center justify-between gap-3">
            <span className="truncate text-[11.5px] text-muted">{label}</span>
            <span
              className={`font-display text-[13px] font-semibold ${
                good ? 'text-accent' : 'text-faint'
              }`}
            >
              {pct}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Skills are a graph, not tags',
    body: 'Someone who wrote Next.js still counts when your brief says React. A keyword filter loses them entirely.',
    figure: (
      <div className="space-y-1.5 font-mono text-[11px]">
        {[
          ['React ~ Next.js', '0.70'],
          ['React ~ Vue', '0.45'],
          ['React ~ PostgreSQL', '0.20'],
          ['React ~ UI design', '0.00'],
        ].map(([pair, v]) => (
          <div key={pair} className="flex justify-between gap-3">
            <span className="text-muted">{pair}</span>
            <span className={Number(v) >= 0.45 ? 'text-accent' : 'text-faint'}>{v}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Availability is an input, not a checkbox',
    body: 'Two people can be perfect on paper and never be awake at the same time. It intersects the whole team and tells you before you start.',
    figure: (
      <div>
        <div className="flex gap-1">
          {Array.from({ length: 24 }).map((_, h) => (
            <span
              key={h}
              className={`h-6 flex-1 rounded-[2px] ${
                h >= 13 && h < 16 ? 'bg-accent' : 'bg-panel-2'
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-warn">Team overlap is only 3 hrs per week</p>
      </div>
    ),
  },
  {
    title: 'It tells you what it cannot do',
    body: 'Every other tool shows a confident green number. This one names the holes it could not fill, which is the useful half.',
    figure: (
      <div className="space-y-1.5">
        {[
          ['No coverage for PostgreSQL', true],
          ['No coverage for Monitoring', false],
          ['Entirely senior, no junior capacity', false],
        ].map(([label, high]) => (
          <p key={label as string} className="flex gap-2 text-[11.5px]">
            <span
              className={`mt-1.5 size-1.5 shrink-0 rounded-full ${high ? 'bg-warn' : 'bg-line-strong'}`}
            />
            <span className={high ? 'text-warn' : 'text-muted'}>{label}</span>
          </p>
        ))}
      </div>
    ),
  },
];

export default function Difference({ people }: { people: Person[] }) {
  const faces = people.filter((p) => p.photo).slice(0, 14);

  return (
    <section className="border-t border-line bg-panel/30">
      <div className="mx-auto max-w-[1180px] px-5 py-20">
        <Reveal>
          <h2 className="font-display text-[26px] leading-tight font-bold tracking-tight sm:text-[32px]">
            Why this is not a search box
          </h2>
          <p className="mt-2 max-w-[560px] text-[14px] leading-relaxed text-muted">
            Four things a filtered list structurally cannot do, however good its interface is.
          </p>
        </Reveal>

        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {POINTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 110}>
              <li className="h-full rounded-xl border border-line bg-panel p-5">
                <h3 className="font-display text-[16px] font-semibold">{p.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{p.body}</p>
                <div className="mt-5 rounded-lg border border-line bg-canvas p-3.5">{p.figure}</div>
              </li>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={120}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4 rounded-xl border border-line bg-panel px-5 py-6">
            <div className="flex -space-x-2.5">
              {faces.map((p) => (
                <span key={p.id} className="rounded-full ring-2 ring-panel">
                  <Avatar person={p} size={34} />
                </span>
              ))}
            </div>
            <p className="text-[13px] text-muted">
              Every person is opt-in, carries their own availability, and ends in a way to contact
              them.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
