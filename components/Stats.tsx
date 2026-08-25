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
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return n;
}

function Stat({ value, label, run }: { value: number; label: string; run: boolean }) {
  const n = useCountUp(value, run);
  return (
    <div className="text-center">
      <div className="font-display text-[30px] leading-none font-bold text-accent sm:text-[38px]">
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
    <div ref={ref} className="border-y border-line bg-panel/40">
      <div className="mx-auto grid max-w-[1180px] xl:max-w-[1400px] grid-cols-2 gap-y-9 px-5 py-12 sm:grid-cols-3 lg:grid-cols-5">
        <Stat value={people} label="people in the directory" run={run} />
        <Stat value={companies} label="companies" run={run} />
        <Stat value={offices} label="offices" run={run} />
        <Stat value={skills} label="skills in the graph" run={run} />
        <Stat value={timezones} label="timezones covered" run={run} />
      </div>
    </div>
  );
}
