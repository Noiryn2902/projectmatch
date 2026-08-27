import Link from 'next/link';

import type { Org } from '@/lib/types';

/**
 * One shell for every signed-in page.
 *
 * Nine pages had grown nine hand-rolled headers, each with its own back
 * link, and none of them agreed on where "back" went. The result was that
 * every page had to explain itself in a paragraph, because nothing about
 * the structure was obvious. A persistent nav does that work instead, and
 * most of the prose came out with it.
 */

export interface ShellTab {
  href: string;
  label: string;
  /** Matched as a prefix, so child routes keep their parent tab lit. */
  match?: string;
}

export default function AppShell({
  org,
  tabs = [],
  active,
  action,
  back,
  notifications = 0,
  children,
}: {
  org?: Pick<Org, 'name' | 'slug'> | null;
  tabs?: ShellTab[];
  /** Which tab is current, by href. */
  active?: string;
  /** One page-level action, rendered at the end of the nav. */
  action?: React.ReactNode;
  /** Where a nested page came from. Above the content, not in the nav. */
  back?: { href: string; label: string };
  notifications?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="pm-grain min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[960px] items-center gap-4 px-5 py-2.5">
          <Link href="/app" className="font-display text-[15px] font-bold tracking-tight">
            Project<span className="text-accent">Match</span>
          </Link>

          {org && (
            <>
              <span aria-hidden className="text-line-strong">
                /
              </span>
              <Link
                href={`/app/org/${org.slug}`}
                className="max-w-[160px] truncate text-[13px] font-medium text-ink hover:text-accent"
              >
                {org.name}
              </Link>
            </>
          )}

          <nav className="ml-auto flex items-center gap-1">
            {tabs.map((t) => {
              const on = active === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={on ? 'page' : undefined}
                  className={`rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                    on ? 'bg-panel-2 font-medium text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}

            <Link
              href="/app"
              title={notifications > 0 ? `${notifications} waiting on you` : 'Nothing waiting'}
              aria-label={
                notifications > 0 ? `${notifications} items waiting on you` : 'Notifications'
              }
              className="relative ml-1 grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-panel-2 hover:text-ink"
            >
              <svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden="true">
                <path d="M8 1.5a4 4 0 0 0-4 4v2.6L2.8 10.3a.6.6 0 0 0 .5.9h9.4a.6.6 0 0 0 .5-.9L12 8.1V5.5a4 4 0 0 0-4-4Zm0 12.5a2 2 0 0 0 1.9-1.4H6.1A2 2 0 0 0 8 14Z" />
              </svg>
              {notifications > 0 && (
                <span className="absolute top-1 right-1 grid size-3.5 place-items-center rounded-full bg-accent text-[9px] font-bold text-canvas">
                  {notifications > 9 ? '9+' : notifications}
                </span>
              )}
            </Link>

            {action && <span className="ml-1">{action}</span>}

            <form action="/auth/sign-out" method="post" className="ml-1">
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-panel-2 hover:text-ink"
              >
                <svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden="true">
                  <path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6v-1.5H3.5v-9H6V2Zm4.3 3.2 2.5 2.3a.7.7 0 0 1 0 1l-2.5 2.3-1-1.1 1.1-1H6.5V7.3h3.9l-1.1-1 1-1.1Z" />
                </svg>
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[960px] px-5 py-8">
        {back && (
          <Link
            href={back.href}
            className="mb-5 inline-block text-[13px] text-muted transition-colors hover:text-ink"
          >
            &larr; {back.label}
          </Link>
        )}
        {children}
      </main>
    </div>
  );
}
