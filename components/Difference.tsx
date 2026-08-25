'use client';

import { useEffect, useRef, useState } from 'react';
import type { Person } from '@/lib/types';
import Avatar from './Avatar';
import Reveal from './Reveal';

/** Fires once the element has been on screen, with a failsafe so nothing stalls. */
function useOnScreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    const t = setTimeout(() => setOn(true), 2500);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  return { ref, on };
}

function Bar({ label, pct, on, delay, dim }: { label: string; pct: number; on: boolean; delay: number; dim?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-muted">{label}</span>
        <span
          className={`font-display text-[20px] font-semibold tabular-nums ${
            dim ? 'text-faint' : 'text-accent'
          }`}
        >
          {on ? pct : 0}%
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel-2">
        <span
          className={`block h-full rounded-full ${dim ? 'bg-line-strong' : 'bg-accent'}`}
          style={{
            width: on ? `${Math.max(pct, 1.5)}%` : '0%',
            transition: `width 1s cubic-bezier(.16,1,.3,1) ${delay}ms`,
          }}
        />
      </div>
    </div>
  );
}

function ContributionArt() {
  const { ref, on } = useOnScreen<HTMLDivElement>();
  return (
    <div ref={ref} className="space-y-6">
      <Bar label="Another principal frontend engineer" pct={0} on={on} delay={0} dim />
      <Bar label="A junior product designer" pct={12} on={on} delay={220} />
      <p className="text-[12.5px] leading-relaxed text-faint">
        Same directory, same brief. The senior engineer is the better candidate and the worse
        choice.
      </p>
    </div>
  );
}

function GraphArt() {
  const { ref, on } = useOnScreen<HTMLDivElement>();
  const rows: [string, number][] = [
    ['Next.js', 0.7],
    ['Vue', 0.45],
    ['PostgreSQL', 0.2],
    ['UI design', 0],
  ];
  return (
    <div ref={ref} className="space-y-3.5">
      {rows.map(([label, v], i) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-[86px] shrink-0 text-right font-mono text-[12px] text-muted">
            {label}
          </span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
            <span
              className={`block h-full rounded-full ${v >= 0.45 ? 'bg-accent' : 'bg-line-strong'}`}
              style={{
                width: on ? `${v * 100}%` : '0%',
                transition: `width .9s cubic-bezier(.16,1,.3,1) ${i * 130}ms`,
              }}
            />
          </span>
          <span
            className={`w-9 shrink-0 font-mono text-[12px] ${v >= 0.45 ? 'text-accent' : 'text-faint'}`}
          >
            {v.toFixed(2)}
          </span>
        </div>
      ))}
      <p className="pt-1 text-[12.5px] leading-relaxed text-faint">
        How closely each skill matches a brief that asked for React.
      </p>
    </div>
  );
}

function HoursArt() {
  const { ref, on } = useOnScreen<HTMLDivElement>();
  const lit = [13, 14, 15];
  return (
    <div ref={ref}>
      <div className="flex items-end gap-[3px]">
        {Array.from({ length: 24 }).map((_, h) => {
          const isLit = lit.includes(h);
          return (
            <span
              key={h}
              className={`flex-1 rounded-[2px] ${isLit ? 'bg-accent' : 'bg-panel-2'}`}
              style={{
                height: on ? (isLit ? 42 : 16) : 6,
                transition: `height .7s cubic-bezier(.16,1,.3,1) ${h * 26}ms`,
              }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
        <span>00:00</span>
        <span>12:00</span>
        <span>23:00</span>
      </div>
      <p className="mt-4 text-[12.5px] leading-relaxed text-faint">
        Four people across Bengaluru, London and Lagos. The lit hours are the only ones all four
        are awake for.
      </p>
    </div>
  );
}

function GapsArt() {
  const { ref, on } = useOnScreen<HTMLDivElement>();
  const gaps: [string, boolean][] = [
    ['No coverage for PostgreSQL', true],
    ['No coverage for Monitoring', false],
    ['Entirely senior, no junior capacity', false],
    ['Team overlap is only 3 hrs per week', true],
  ];
  return (
    <div ref={ref}>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-muted">Requirements covered</span>
        <span className="font-display text-[22px] font-semibold text-good">91%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel-2">
        <span
          className="block h-full rounded-full bg-good"
          style={{ width: on ? '91%' : '0%', transition: 'width 1.1s cubic-bezier(.16,1,.3,1)' }}
        />
      </div>
      <ul className="mt-5 space-y-2.5">
        {gaps.map(([label, high], i) => (
          <li
            key={label}
            className="flex gap-2.5 text-[13px]"
            style={{
              opacity: on ? 1 : 0,
              transform: on ? 'none' : 'translateX(-8px)',
              transition: `opacity .5s ease ${400 + i * 110}ms, transform .5s ease ${400 + i * 110}ms`,
            }}
          >
            <span
              className={`mt-1.5 size-1.5 shrink-0 rounded-full ${high ? 'bg-warn' : 'bg-line-strong'}`}
            />
            <span className={high ? 'text-warn' : 'text-muted'}>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ROWS = [
  {
    eyebrow: 'Contribution',
    title: 'It scores what a person adds, not how good they look',
    body: 'Add a frontend developer and the next frontend developer is worth nothing to you, however senior. A directory ranks people one at a time, so it can never know what you already have.',
    art: <ContributionArt />,
  },
  {
    eyebrow: 'Skill graph',
    title: 'Skills are a graph, not a list of tags',
    body: 'Someone who wrote Next.js still counts when your brief says React. Someone who wrote UI design does not. A keyword filter cannot tell the difference between those two cases.',
    art: <GraphArt />,
  },
  {
    eyebrow: 'Availability',
    title: 'Availability is an input, not a checkbox',
    body: 'Two people can be perfect on paper and never be awake at the same time. Every profile carries hours and a timezone, so the whole team gets intersected before you commit to it.',
    art: <HoursArt />,
  },
  {
    eyebrow: 'Honesty',
    title: 'It tells you what it could not do',
    body: 'Every other tool shows a confident number and stops. This one names the holes it failed to fill, which is the half you actually need before you start.',
    art: <GapsArt />,
  },
];

export default function Difference({ people }: { people: Person[] }) {
  const faces = people.filter((p) => p.photo).slice(0, 16);

  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-[1100px] xl:max-w-[1320px] px-5 py-20">
        <Reveal>
          <h2 className="max-w-[620px] font-display text-[28px] leading-[1.15] font-bold tracking-tight sm:text-[36px]">
            Why this is not a search box
          </h2>
          <p className="mt-3 max-w-[540px] text-[15px] leading-relaxed text-muted">
            Four things a filtered list structurally cannot do, however good its interface is.
          </p>
        </Reveal>

        <div className="mt-16 space-y-16 sm:space-y-24">
          {ROWS.map((r, i) => (
            <Reveal key={r.eyebrow}>
              <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
                <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                  <span className="font-display text-[11px] tracking-[0.2em] text-accent uppercase">
                    {r.eyebrow}
                  </span>
                  <h3 className="mt-3 font-display text-[21px] leading-snug font-semibold sm:text-[24px]">
                    {r.title}
                  </h3>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{r.body}</p>
                </div>
                <div
                  className={`rounded-xl border border-line bg-panel p-6 ${
                    i % 2 === 1 ? 'md:order-1' : ''
                  }`}
                >
                  {r.art}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={100}>
          <div className="mt-20 flex flex-col items-center gap-5 rounded-xl border border-line bg-panel px-6 py-8 text-center">
            <div className="flex -space-x-3">
              {faces.map((p, i) => (
                <span
                  key={p.id}
                  className="rounded-full ring-2 ring-panel"
                  style={{ zIndex: faces.length - i }}
                >
                  <Avatar person={p} size={40} />
                </span>
              ))}
            </div>
            <p className="max-w-[480px] text-[14px] leading-relaxed text-muted">
              Every person is opt-in, carries their own availability, and ends in a way to contact
              them.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
