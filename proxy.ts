import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { SUPABASE_ANON_KEY, SUPABASE_URL, hasDatabase } from '@/lib/env';

/**
 * Session refresh at the network boundary.
 *
 * Note the filename. Next 16 deprecated `middleware.ts` and renamed the
 * convention to `proxy.ts`, exporting `proxy` rather than `middleware`. Every
 * Supabase SSR auth guide currently in circulation puts this in middleware,
 * and all of them are wrong for this version.
 *
 * The job here is narrow and should stay narrow: call getUser() so an expiring
 * token is refreshed and the new cookies ride out on the response. Route
 * protection is decided in the routes themselves, where the reason for a
 * redirect is visible next to the thing being protected.
 */
export async function proxy(request: NextRequest) {
  // Without credentials the application runs on seeded data and there is no
  // session to refresh.
  if (!hasDatabase) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimisation, which never
    // carry a session and should not pay for a round trip.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|woff2?)$).*)',
  ],
};
