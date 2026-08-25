'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { clearUser, initials, setUser, useUser } from '@/lib/session';

/**
 * Top chrome for the landing page: an announcement strip and a sticky nav.
 *
 * There is no server and no password. Signing in records a display name so the
 * workspace can attribute messages to someone, and nothing more. A password
 * field here would be theatre — it would imply a credential store that does not
 * exist.
 */
const LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'For teams', href: '#for-teams' },
];

export default function SiteNav() {
  const user = useUser();
  const [strip, setStrip] = useState(true);
  const [mode, setMode] = useState<'login' | 'signup' | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (mode && !d.open) {
      d.showModal();
      nameRef.current?.focus();
    }
    if (!mode && d.open) d.close();
  }, [mode]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    if (!name || !email) return;
    const u = { name, email };
    setUser(u);
    setMode(null);
  }

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
            {user ? (
              <>
                <span
                  title={user.email}
                  className="grid size-8 place-items-center rounded-full bg-accent text-[13px] font-bold text-canvas"
                >
                  {initials(user.name)}
                </span>
                <span className="hidden text-[14px] font-medium sm:inline">
                  {user.name.split(' ')[0]}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearUser();
                  }}
                  className="rounded-full border border-line-strong px-4 py-2 text-[13px] font-medium hover:border-accent hover:text-accent"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="rounded-full border border-line-strong px-4 py-2 text-[13px] font-medium hover:border-accent hover:text-accent"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-canvas hover:opacity-90"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <dialog
        ref={dialog}
        onClose={() => setMode(null)}
        className="m-auto w-[min(92vw,380px)] rounded-2xl border border-line-strong bg-panel p-7 text-ink backdrop:bg-black/65 backdrop:backdrop-blur-sm"
      >
        <h3 className="font-display text-[20px] font-semibold">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h3>
        <p className="mt-1.5 text-[13px] text-muted">
          {mode === 'login'
            ? 'Enter your details to pick up where you left off.'
            : 'No password needed — your briefs stay on this device.'}
        </p>

        <form onSubmit={submit}>
          <label htmlFor="nm" className="mt-4 block text-[12px] text-muted">
            Your name
          </label>
          <input
            id="nm"
            name="name"
            ref={nameRef}
            required
            autoComplete="name"
            placeholder="Tarun Sharma"
            className="mt-1.5 w-full rounded-lg border border-line-strong bg-canvas px-3 py-2.5 text-[14px] outline-none focus:border-accent"
          />
          <label htmlFor="em" className="mt-3.5 block text-[12px] text-muted">
            Email
          </label>
          <input
            id="em"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="mt-1.5 w-full rounded-lg border border-line-strong bg-canvas px-3 py-2.5 text-[14px] outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="mt-5 w-full rounded-lg bg-accent px-4 py-3 text-[14px] font-semibold text-canvas hover:opacity-90"
          >
            {mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setMode(null)}
          className="mt-2.5 w-full py-1 text-[13px] text-faint hover:text-ink"
        >
          Cancel
        </button>
      </dialog>
    </>
  );
}
