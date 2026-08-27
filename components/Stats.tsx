'use client';

import { useEffect, useRef, useState } from 'react';

function useCountUp(target: number, run: boolean, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    let start: number | null = null;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / ms);
      // ease-out so the number settles rather than stopping dead
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    // requestAnimationFrame is throttled to nothing in a background or
    // non-compositing tab, so the count never advanced and every figure sat
    // at 0 — the page claimed an empty directory. A timer is not throttled
    // the same way: whatever happened to the animation, land on the real
    // number shortly after it should have finished.
    const settle = setTimeout(() => setN(target), ms + 150);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
    };
  }, [target, run, ms]);
  return n;
}

function Stat({ value, label, run, tone }: { value: number; label: string; run: boolean; tone: string }) {
  const n = useCountUp(value, run);
  return (
    <div className="text-center">
      <div className={`font-display text-[30px] leading-none font-bold sm:text-[38px] ${tone}`}>
        {n}
      </div>
      <div className="mt-2 text-[12px] text-muted">{label}</div>
    </div>
  );
}

export default function Stats({
  people,
  companies,
  skills,
  offices,
  timezones,
}: {
  people: number;
  companies: number;
  skills: number;
  offices: number;
  timezones: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setRun(true);
      return;
    }
    const io = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          setRun(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    const failsafe = setTimeout(() => setRun(true), 2500);
    return () => {
      io.disconnect();
      clearTimeout(failsafe);
    };
  }, []);

  return (
    <div ref={ref} className="relative overflow-hidden border-y border-line bg-panel/40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/media/band-desk-2.webp"
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover opacity-[0.13]"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, rgba(8,9,12,0.95) 0%, rgba(8,9,12,0.5) 50%, rgba(8,9,12,0.95) 100%)',
        }}
      />
      <div className="relative mx-auto grid max-w-[1180px] xl:max-w-[1400px] grid-cols-2 gap-y-9 px-5 py-12 sm:grid-cols-3 lg:grid-cols-5">
        <Stat value={people} label="people in the directory" run={run} tone="text-accent" />
        <Stat value={companies} label="companies" run={run} tone="text-good" />
        <Stat value={offices} label="offices" run={run} tone="text-info" />
        <Stat value={skills} label="skills in the graph" run={run} tone="text-ai" />
        <Stat value={timezones} label="timezones covered" run={run} tone="text-warn" />
      </div>
    </div>
  );
}
