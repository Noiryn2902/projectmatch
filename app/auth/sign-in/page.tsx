import Link from 'next/link';

import { hasDatabase } from '@/lib/env';

import SignInForm from './SignInForm';

/**
 * The door for an account that already exists.
 *
 * Sign up is a separate page next to this one. The mechanism behind both is
 * identical — Supabase makes the user on first sight either way — but the two
 * arrivals are not the same person, and one page that tried to be both read
 * as neither.
 *
 * Signing in is required to act: invite someone, edit a profile, staff a real
 * project. It is never required to look. The demo org is readable by anyone,
 * and the link back to it is the actual guest path, not a consolation prize.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <Link href="/" className="font-display text-[15px] font-bold tracking-tight">
        Project<span className="text-accent">Match</span>
      </Link>

      <h1 className="mt-8 text-xl font-semibold text-ink">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Sign in to the account you already have.</p>

      {!hasDatabase ? (
        <p className="mt-6 rounded-lg border border-line bg-panel p-4 text-sm text-muted">
          No database is configured for this deployment, so accounts are not available here.{' '}
          <Link href="/" className="text-accent underline underline-offset-2">
            Browse the demo instead
          </Link>
          .
        </p>
      ) : (
        <>
          <SignInForm initialError={error} mode="in" next={next ?? '/'} />

          <p className="mt-7 text-center text-sm text-muted">
            First time here?{' '}
            <Link href="/auth/sign-up" className="text-accent underline underline-offset-2">
              Create an account
            </Link>
          </p>
          <p className="mt-2 text-center text-[12px] text-faint">
            Or{' '}
            <Link href="/" className="underline underline-offset-2 hover:text-muted">
              browse the demo
            </Link>{' '}
            without one.
          </p>
        </>
      )}
    </main>
  );
}
