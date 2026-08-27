import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * The shared vocabulary.
 *
 * Before this file the same shapes — a panel with a coloured left border, a
 * pill, a stat with a bar — were re-declared inline on every page, each time
 * with slightly different padding, radius and type size. That is why the app
 * read as several products stitched together. Everything visual should come
 * from here, so a change lands everywhere at once.
 *
 * Tone is semantic, never decorative: `warn` means something is wrong,
 * `good` means it is handled, `accent` means the machine is talking. A value
 * decides its own tone (see `toneForRatio`) so that 0% can never render green.
 */

export type Tone = 'neutral' | 'accent' | 'good' | 'warn';

const CARD_TONE: Record<Tone, string> = {
  neutral: 'border-line',
  accent: 'border-line border-l-2 border-l-accent',
  good: 'border-line border-l-2 border-l-good',
  warn: 'border-line border-l-2 border-l-warn',
};

const TEXT_TONE: Record<Tone, string> = {
  neutral: 'text-ink',
  accent: 'text-accent',
  good: 'text-good',
  warn: 'text-warn',
};

const BADGE_TONE: Record<Tone, string> = {
  neutral: 'border-line bg-panel-2 text-muted',
  accent: 'border-accent/35 bg-accent-soft text-accent',
  good: 'border-good/30 bg-good-soft text-good',
  warn: 'border-warn/35 bg-warn-soft text-warn',
};

/** Nothing covered is not a success. Colour follows the number, not the author. */
export function toneForRatio(ratio: number): Tone {
  if (ratio >= 0.8) return 'good';
  if (ratio >= 0.4) return 'accent';
  return 'warn';
}

/* ------------------------------- surfaces ------------------------------- */

export function Card({
  tone = 'neutral',
  className = '',
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-xl border bg-panel ${CARD_TONE[tone]} ${className}`}>{children}</div>
  );
}

/** A short piece of prose the app wants to say out loud. */
export function Note({
  tone = 'accent',
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Card tone={tone} className="px-4 py-3.5">
      {title && <p className={`text-[13.5px] font-semibold ${TEXT_TONE[tone]}`}>{title}</p>}
      <div className={`text-[13px] leading-relaxed text-muted ${title ? 'mt-1.5' : ''}`}>
        {children}
      </div>
    </Card>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="font-display text-[16px] font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-faint">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  kicker,
  title,
  description,
  back,
  actions,
  children,
}: {
  kicker?: string;
  title: string;
  description?: string;
  back?: { href: string; label: string };
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-4 inline-block text-[13px] text-muted transition-colors hover:text-accent"
        >
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {kicker && (
            <p className="text-[11px] tracking-[0.16em] text-faint uppercase">{kicker}</p>
          )}
          <h1 className="mt-1.5 font-display text-[26px] leading-tight font-bold text-balance text-ink">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-muted">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}

/* -------------------------------- atoms -------------------------------- */

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] whitespace-nowrap ${BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const BTN_VARIANT = {
  primary: 'bg-accent text-canvas hover:opacity-90',
  secondary: 'border border-line-strong text-ink hover:border-accent hover:text-accent',
  ghost: 'text-muted hover:text-ink',
} as const;

const BTN_SIZE = {
  sm: 'px-3 py-1.5 text-[13px]',
  md: 'px-4 py-2.5 text-[14px]',
} as const;

export function buttonClass(
  variant: keyof typeof BTN_VARIANT = 'secondary',
  size: keyof typeof BTN_SIZE = 'md',
) {
  return `${BTN_BASE} ${BTN_VARIANT[variant]} ${BTN_SIZE[size]}`;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BTN_VARIANT;
  size?: keyof typeof BTN_SIZE;
}) {
  return <button {...props} className={`${buttonClass(variant, size)} ${className}`} />;
}

/* -------------------------------- data --------------------------------- */

/**
 * A number with its meaning attached. `ratio` drives the colour, so a stat
 * cannot claim success it has not earned.
 */
export function Stat({
  label,
  value,
  ratio,
  sub,
  bar = true,
}: {
  label: string;
  value: string;
  ratio?: number;
  sub?: string;
  bar?: boolean;
}) {
  const tone = ratio === undefined ? 'neutral' : toneForRatio(ratio);
  const fill = { neutral: 'bg-line-strong', accent: 'bg-accent', good: 'bg-good', warn: 'bg-warn' }[
    tone
  ];
  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-muted">{label}</span>
        <span className={`font-display text-[17px] font-bold ${TEXT_TONE[tone]}`}>{value}</span>
      </div>
      {bar && ratio !== undefined && (
        <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-panel-2">
          <i
            className={`block h-full rounded-full ${fill}`}
            style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }}
          />
        </span>
      )}
      {sub && <p className="mt-2 text-[12px] text-faint">{sub}</p>}
    </Card>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="px-6 py-10 text-center">
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {children && (
        <div className="mx-auto mt-1.5 max-w-[46ch] text-[13px] leading-relaxed text-muted">
          {children}
        </div>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  );
}
