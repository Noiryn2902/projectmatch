import { NextResponse, type NextRequest } from 'next/server';

import { hasDatabase } from '@/lib/env';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * POST-only, and reachable from a plain `<form method="post">` — signing out
 * should not depend on client-side JavaScript having loaded.
 */
export async function POST(request: NextRequest) {
  if (hasDatabase) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL('/', request.url));
}
