import Link from 'next/link';

/**
 * Where you are, and the two ways out of it.
 *
 * The flow is five steps long and until now three of them were one-way: you
 * could go forward or you could abandon the whole thing, which is not a
 * choice anyone should have to make because they mistyped a brief. Back is
 * always a link to the step before, never a browser gesture — a step that
 * wrote to the database cannot be undone by history.
 */
export const STEPS = [
  'Brief',
  'Choose',
  'Team',
  'Ask',
  'Workspace',
] as const;

export default function StepBar({
  step,
  back,
  next,
}: {
  /** 1-indexed, matching STEPS. */
  step: number;
  back?: { href: string; label: string };
  next?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-2.5">
      {back ? (
        <Link
          href={back.href}
          className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent"
        >
          ← {back.label}
        </Link>
      ) : (
        <span className="w-px" />
      )}

      {/* Named dots rather than a progress bar: the point is which step this
          is, not what fraction of a job is done. */}
      <ol className="mx-auto hidden items-center gap-1.5 sm:flex">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const here = n === step;
          return (
            <li key={label} className="flex items-center gap-1.5">
              <span
                className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${
                  here
                    ? 'bg-accent/15 font-medium text-accent'
                    : done
                      ? 'text-muted'
                      : 'text-faint'
                }`}
              >
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${
                    here ? 'bg-accent' : done ? 'bg-muted' : 'bg-line-strong'
                  }`}
                />
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {next ? (
        <Link
          href={next.href}
          className="ml-auto rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent sm:ml-0"
        >
          {next.label} →
        </Link>
      ) : (
        <span className="ml-auto w-px sm:ml-0" />
      )}
    </div>
  );
}
