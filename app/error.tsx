'use client';

import Link from 'next/link';

/**
 * The last thing between an unhandled exception and a blank page.
 *
 * Every server component in this app can throw — a repository surfaces a
 * Postgres error rather than swallowing it, which is the right call, and
 * means something has to catch it at the boundary. Without this the visitor
 * gets Next's default, or in production a bare page with nothing on it.
 *
 * It offers a retry because most of what lands here is transient: a dropped
 * connection, a stale PostgREST schema cache after a migration, a cold
 * start.
 */
export default function Error({
  error,
  reset,
}: {
  // `digest` is Next's server-side error id — the only handle on what
  // actually failed, since the message itself is withheld in production.
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <p className="text-[11px] tracking-wide text-faint uppercase">ProjectMatch</p>
      <h1 className="mt-1 font-display text-xl font-semibold text-balance text-ink">
        Something went wrong on our side.
      </h1>
      <p className="mt-2 text-sm text-muted">
        This is usually momentary. Try again — if it keeps happening, the page you came from is the
        useful thing to report.
      </p>

      {error.digest && (
        <p className="mt-4 rounded-lg border border-line bg-panel px-3 py-2 font-mono text-[11px] text-faint">
          reference {error.digest}
        </p>
      )}

      <div className="mt-6 flex gap-2.5">
        <button
          type="button"
          onClick={reset}
          className="flex-1 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-panel transition-opacity hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="flex-1 rounded-lg border border-line px-4 py-2 text-center text-[13px] font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          Back to start
        </Link>
      </div>
    </main>
  );
}
