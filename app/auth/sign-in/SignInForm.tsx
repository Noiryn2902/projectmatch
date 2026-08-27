'use client';

import { useState } from 'react';

import { createBrowserSupabase } from '@/lib/supabase/client';
import type { Provider } from '@supabase/supabase-js';

type Status = 'idle' | 'sending' | 'sent' | { redirecting: Provider };

const OAUTH_PROVIDERS: { id: Provider; label: string; icon: React.ReactNode }[] = [
  {
    id: 'google',
    label: 'Continue with Google',
    icon: (
      <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18Z"
        />
        <path
          fill="#FBBC05"
          d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33Z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
        />
      </svg>
    ),
  },
  {
    id: 'linkedin_oidc',
    label: 'Continue with LinkedIn',
    icon: (
      <svg viewBox="0 0 16 16" className="size-4 fill-current text-[#0A66C2]" aria-hidden="true">
        <path d="M14.82 0H1.18C.53 0 0 .52 0 1.16v13.68C0 15.48.53 16 1.18 16h13.64c.65 0 1.18-.52 1.18-1.16V1.16C16 .52 15.47 0 14.82 0ZM4.75 13.4H2.38V6h2.37v7.4Zm-1.19-8.4a1.37 1.37 0 1 1 0-2.75 1.37 1.37 0 0 1 0 2.75Zm10.84 8.4h-2.37V9.8c0-.86-.02-1.97-1.2-1.97-1.2 0-1.39.94-1.39 1.91v3.66H7.06V6h2.28v1.01h.03c.32-.6 1.09-1.2 2.24-1.2 2.39 0 2.83 1.57 2.83 3.62v3.97Z" />
      </svg>
    ),
  },
];

/**
 * Three paths in, all ending at /auth/callback: a magic link mailed to an
 * address, or an OAuth redirect through GitHub, Google, or LinkedIn. None of
 * them need a password, which is the whole point — this is the thing that
 * makes an invitation, an edit, or a profile claim mean something, and a
 * password to forget is not part of that.
 *
 * Google and LinkedIn use the same signInWithOAuth call as GitHub, so they
 * share one handler rather than three near-identical copies of it.
 *
 * Phone/SMS sign-in is deliberately not offered. Supabase does not send SMS
 * itself — it needs a paid provider wired in — and Indian numbers additionally
 * require DLT registration with the telecom regulator before an OTP SMS can
 * be sent at all. Email already reaches any phone with a mail app, for free.
 */
export default function SignInForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState(initialError ?? '');

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStatus('sending');

    const supabase = createBrowserSupabase();
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/auth/callback' },
    });

    if (sendError) {
      setError(sendError.message);
      setStatus('idle');
    } else {
      setStatus('sent');
    }
  }

  async function withProvider(provider: Provider) {
    setError('');
    setStatus({ redirecting: provider });

    const supabase = createBrowserSupabase();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/auth/callback' },
    });

    if (oauthError) {
      setError(oauthError.message);
      setStatus('idle');
    }
    // On success the browser navigates away to the provider — nothing left to do.
  }

  if (status === 'sent') {
    return (
      <div className="mt-6 rounded-lg border border-line bg-panel p-4 text-sm text-ink">
        Check <span className="font-medium">{email}</span> for a sign-in link. It expires shortly,
        so use it soon after it arrives.
      </div>
    );
  }

  const redirecting = typeof status === 'object' ? status.redirecting : null;

  return (
    <div className="mt-6 space-y-3">
      {OAUTH_PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => withProvider(p.id)}
          disabled={redirecting !== null}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-line-strong disabled:opacity-60"
        >
          {p.icon}
          {redirecting === p.id ? 'Redirecting…' : p.label}
        </button>
      ))}

      <button
        type="button"
        onClick={() => withProvider('github')}
        disabled={redirecting !== null}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-line-strong disabled:opacity-60"
      >
        <svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
        {redirecting === 'github' ? 'Redirecting…' : 'Continue with GitHub'}
      </button>

      <div className="flex items-center gap-3 py-1 text-[11px] tracking-wide text-muted uppercase">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={sendMagicLink} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          aria-label="Email address"
          className="w-full rounded-full border border-line bg-panel px-4 py-2 text-[13px] outline-none transition-colors focus:border-accent"
        />
        <button
          type="submit"
          disabled={status === 'sending' || !email}
          className="w-full rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-panel transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {status === 'sending' ? 'Sending…' : 'Send a sign-in link'}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-[13px] text-warn">
          {error}
        </p>
      )}
    </div>
  );
}
