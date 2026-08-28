import Link from 'next/link';

/**
 * The setup flow's own chrome — deliberately not AppShell.
 *
 * AppShell is for a product you are already inside: an org name, tabs, a
 * notification bell. None of that exists yet at this point and showing it
 * empty was most of what made the old two-step gate feel like a form to
 * survive. This is one question per screen, three dots, and a way out.
 */
export default function OnboardingShell({
  step,
  of = 3,
  title,
  hint,
  skip,
  wide = false,
  children,
}: {
  /** 1-indexed. */
  step: number;
  /** How many steps in total. */
  of?: number;
  title: string;
  hint?: string;
  /** Where "I'll do this later" goes, when this step can honestly be skipped. */
  skip?: { href: string; label: string };
  /**
   * A wider column, for the one step with enough fields to pair up.
   *
   * Every other step asks one or two things and a narrow measure suits them.
   * The details step asks ten, and stacking ten single-file turns a form you
   * could take in at a glance into a scroll.
   */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="pm-grain flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="font-display text-[15px] font-bold tracking-tight">
          Project<span className="text-accent">Match</span>
        </Link>
        {skip && (
          <Link href={skip.href} className="text-[12px] text-faint transition-colors hover:text-ink">
            {skip.label}
          </Link>
        )}
      </header>

      <main
        className={`mx-auto flex w-full flex-1 flex-col justify-center px-6 pb-20 ${
          wide ? 'max-w-2xl' : 'max-w-sm'
        }`}
      >
        {/* Three dots, no numbers, no "Step 2 of 3" sentence above every
            heading. The dots say it. */}
        <div className="flex gap-1.5" aria-label={`Step ${step} of ${of}`}>
          {Array.from({ length: of }, (_, i) => i + 1).map((n) => (
            <span
              key={n}
              aria-hidden
              className={`h-1 flex-1 rounded-full transition-colors ${
                n <= step ? 'bg-accent' : 'bg-line'
              }`}
            />
          ))}
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold text-balance text-ink">{title}</h1>
        {hint && <p className="mt-2 text-[13px] text-muted">{hint}</p>}

        {children}
      </main>
    </div>
  );
}
