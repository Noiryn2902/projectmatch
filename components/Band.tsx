'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Full-width image band with a slow continuous drift and text over a scrim.
 *
 * The drift is a CSS animation rather than a scroll handler on purpose. A
 * scroll-driven parallax silently does nothing wherever scroll events are not
 * delivered, and a landing page that looks static on someone else's machine is
 * worse than one that never promised motion. This moves regardless.
 *
 * The scrim is sized to the copy rather than blanketing the picture, the same
 * approach as the hero: dark where the words are, image everywhere else.
 */
export default function Band({
  src,
  kicker,
  line,
  height = 'h-[300px] sm:h-[380px]',
}: {
  src: string;
  kicker: string;
  line: string;
  height?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((x) => x.isIntersecting)) setShown(true);
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    // Text must never be able to stay hidden if the observer does not fire.
    const failsafe = setTimeout(() => setShown(true), 2500);
    return () => {
      io.disconnect();
      clearTimeout(failsafe);
    };
  }, []);

  return (
    <div ref={ref} className={`relative w-full overflow-hidden border-y border-line ${height}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className="pm-drift absolute inset-0 h-full w-full object-cover"
      />

      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(62% 52% at 50% 50%, rgba(8,9,12,0.86) 0%, rgba(8,9,12,0.6) 55%, rgba(8,9,12,0.1) 100%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(8,9,12,0.7) 0%, rgba(8,9,12,0.15) 30%, rgba(8,9,12,0.15) 70%, rgba(8,9,12,0.75) 100%)',
        }}
      />

      <div className="relative flex h-full items-center justify-center px-6">
        <div
          className="max-w-[620px] text-center"
          style={{
            opacity: shown ? 1 : 0,
            transform: shown ? 'none' : 'translateY(16px)',
            transition:
              'opacity .8s cubic-bezier(.16,1,.3,1), transform .8s cubic-bezier(.16,1,.3,1)',
          }}
        >
          <p className="pm-legible font-display text-[11px] tracking-[0.22em] text-accent uppercase">
            {kicker}
          </p>
          <p className="pm-legible mt-4 font-display text-[22px] leading-snug font-semibold text-white sm:text-[30px]">
            {line}
          </p>
        </div>
      </div>
    </div>
  );
}
