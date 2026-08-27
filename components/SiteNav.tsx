'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Top chrome for the landing page: an announcement strip and a sticky nav.
 *
 * Identity here is the real one. `viewer` comes from the server, resolved by
 * Supabase Auth against a verified session — not a name typed into a modal
 * and kept in localStorage, which is what this used to do. A signed-in
 * visitor gets a way into their workspace; a signed-out one gets the real
 * sign-in page, where GitHub, Google and a mailed link are the options.
 */
const LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'For teams', href: '#for-teams' },
];

export interface Viewer {
  name: string;
  email: string;
}

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase();
}

export default function SiteNav({ viewer }: { viewer?: Viewer | null }) {
  const [strip, setStrip] = useState(true);

  return (
    <>
      {strip && (
        <div className="relative z-30 border-b border-accent/20 bg-gradient-to-r from-accent/15 to-accent/5">
          <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-5 py-2 text-[13px]">
            <p className="min-w-0 flex-1 truncate">
              New — briefs are read by Gemini and scored on team contribution, not résumés.
            </p>
            <button
              type="button"
              onClick={() => setStrip(false)}
              aria-label="Dismiss announcement"
              className="shrink-0 text-faint hover:text-ink"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <nav className="sticky top-0 z-30 border-b border-white/10 bg-canvas/65 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1180px] items-center gap-6 px-5 py-3">
          <Link href="/" className="font-display text-[17px] font-bold tracking-tight whitespace-nowrap">
            Project<span className="text-accent">Match</span>
          </Link>

          <div className="hidden gap-6 sm:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[14px] whitespace-nowrap text-muted transition-colors hover:text-ink"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            {viewer ? (
              <>
                <Link
                  href="/app"
                  title={viewer.email}
                  className="flex items-center gap-2.5"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-accent text-[13px] font-bold text-canvas">
                    {initials(viewer.name)}
                  </span>
                  <span className="hidden text-[14px] font-medium sm:inline">
                    {viewer.name.split(' ')[0]}
                  </span>
                </Link>
                <Link
                  href="/app"
                  className="rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-canvas hover:opacity-90"
                >
                  Workspace
                </Link>
                {/* A plain form post, so signing out does not depend on JS. */}
                <form action="/auth/sign-out" method="post">
                  <button
                    type="submit"
                    className="rounded-full border border-line-strong px-4 py-2 text-[13px] font-medium hover:border-accent hover:text-accent"
                  >
                    Log out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/auth/sign-in?next=/app"
                  className="rounded-full border border-line-strong px-4 py-2 text-[13px] font-medium hover:border-accent hover:text-accent"
                >
                  Log in
                </Link>
                <Link
                  href="/auth/sign-in?next=/app"
                  className="rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-canvas hover:opacity-90"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
