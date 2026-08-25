'use client';

import { useState } from 'react';
import type { Person } from '@/lib/types';

function initials(name: string) {
  const p = name.split(' ');
  return (p[0][0] + (p[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Photo when one exists for this person, initials when it does not. Every
 * face is generated and fictional, same as the rest of the directory.
 */
export default function Avatar({
  person,
  size = 40,
  className = '',
}: {
  person: Person;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = person.photo ? `/media/people/${person.photo}` : null;

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.34),
        background: `oklch(0.42 0.07 ${person.hue})`,
        color: `oklch(0.93 0.05 ${person.hue})`,
      }}
    >
      {initials(person.name)}
    </span>
  );
}
