import Link from 'next/link';

/**
 * Reached by a bad URL, and — deliberately — by every `notFound()` a page
 * calls when row level security returns nothing. An org you are not a member
 * of and an org that does not exist look identical here, which is the point:
 * the difference should not be visible to someone probing from outside.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <p className="text-[11px] tracking-wide text-faint uppercase">ProjectMatch</p>
      <h1 className="mt-1 font-display text-xl font-semibold text-balance text-ink">
        There is nothing here.
      </h1>
      <p className="mt-2 text-sm text-muted">
        The link may be mistyped, or point at something in an organisation you are not a member of.
      </p>

      <div className="mt-6 flex gap-2.5">
        <Link
          href="/"
          className="flex-1 rounded-lg bg-accent px-4 py-2 text-center text-[13px] font-medium text-panel transition-opacity hover:opacity-90"
        >
          Back to start
        </Link>
        <Link
          href="/app"
          className="flex-1 rounded-lg border border-line px-4 py-2 text-center text-[13px] font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          Your workspace
        </Link>
      </div>
    </main>
  );
}
