import Link from 'next/link';

import { hasDatabase } from '@/lib/env';

import SignInForm from '../sign-in/SignInForm';

/**
 * The door for a first visit.
 *
 * Same three methods as signing in, because there is no separate "create
 * account" call to make — the only difference is the words on the buttons.
 *
 * Both land on the home page. Sending new accounts straight to setup made it
 * a gate, which is the exact thing that was wrong with the old two-step
 * onboarding: setup is reached from Find work, when someone wants it.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <Link href="/" className="font-display text-[15px] font-bold tracking-tight">
        Project<span className="text-accent">Match</span>
      </Link>

      <h1 className="mt-8 text-xl font-semibold text-ink">Create your account</h1>
      <p className="mt-1 text-sm text-muted">No password. Pick one and you are in.</p>

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
          <SignInForm initialError={error} mode="up" next="/" />

          <p className="mt-7 text-center text-sm text-muted">
            Already have an account?{' '}
            <Link href="/auth/sign-in" className="text-accent underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
