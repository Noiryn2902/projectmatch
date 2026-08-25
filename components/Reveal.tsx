'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Fades children up as they scroll into view.
 *
 * Has a hard safety timer: if IntersectionObserver never fires, for any
 * reason, everything reveals anyway. Content must never be able to get
 * stuck invisible behind an animation.
 */
export default function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const reveal = () => setShown(true);

    if (!el || typeof IntersectionObserver === 'undefined') {
      reveal();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          reveal();
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    );
    io.observe(el);

    const failsafe = setTimeout(reveal, 2500);
    return () => {
      io.disconnect();
      clearTimeout(failsafe);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(18px)',
        filter: shown ? 'none' : 'blur(4px)',
        transition: `opacity .7s cubic-bezier(.16,1,.3,1) ${delay}ms, transform .7s cubic-bezier(.16,1,.3,1) ${delay}ms, filter .7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
