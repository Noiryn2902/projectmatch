import Link from 'next/link';

import { hasDatabase } from '@/lib/env';

import SignInForm from './SignInForm';

/**
 * Signing in is required to act — invite someone, edit a profile, build a
 * project inside a real org. It is never required to look. The demo org is
 * readable by anyone, and the link back to it below is not a consolation
 * prize; it is the actual guest path.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-xl font-semibold text-ink">Sign in</h1>
      <p className="mt-1 text-sm text-muted">
        Needed to invite people, edit a profile, or staff a real project.
      </p>

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
          <SignInForm initialError={error} />
          <p className="mt-8 text-center text-sm text-muted">
            Just looking?{' '}
            <Link href="/" className="text-accent underline underline-offset-2">
              Browse the demo organisation
            </Link>{' '}
            without an account.
          </p>
        </>
      )}
    </main>
  );
}
