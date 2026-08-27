import { NextResponse, type NextRequest } from 'next/server';

import { hasDatabase } from '@/lib/env';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Where every sign-in method lands: the link in a magic-link email, and the
 * redirect back from GitHub OAuth. Both hand back a `code` that this route
 * exchanges for a session.
 *
 * This has to be a Route Handler rather than a Server Component, because only
 * a Route Handler (or a Server Action) can *write* cookies — a Server
 * Component's cookie store is read-only. The session this exchange produces
 * is exactly that kind of write.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!hasDatabase) {
    return NextResponse.redirect(origin + '/auth/sign-in?error=Not configured');
  }

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(origin + next);
    }
    return NextResponse.redirect(
      origin + '/auth/sign-in?error=' + encodeURIComponent(error.message),
    );
  }

  return NextResponse.redirect(origin + '/auth/sign-in?error=Missing code');
}
