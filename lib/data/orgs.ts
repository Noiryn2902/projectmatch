import 'server-only';

import { hasDatabase } from '../env';
import companiesSeed from '../seed/companies.json';
import { createServerSupabase } from '../supabase/server';
import type { Company, Org } from '../types';

/**
 * The organisation repository.
 *
 * The demo org matters more than it looks. It is what a signed-out visitor
 * sees, so the product can be looked at without an account, and it is readable
 * by everyone and writable by nobody — enforced by policy in the schema rather
 * than by remembering to check.
 */

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  offices: string[] | null;
  is_demo: boolean;
}

const toOrg = (row: OrgRow): Org => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  offices: row.offices ?? [],
  isDemo: row.is_demo,
});

/** Stands in for the demo org when running on seeded data alone. */
const SEEDED_DEMO: Org = {
  id: 'demo',
  name: 'Demo organisation',
  slug: 'demo',
  offices: [...new Set((companiesSeed as Company[]).flatMap((c) => c.offices))],
  isDemo: true,
};

export async function getDemoOrg(): Promise<Org | null> {
  if (!hasDatabase) return SEEDED_DEMO;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('orgs')
    .select('id, name, slug, offices, is_demo')
    .eq('is_demo', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error('Could not load the demo organisation: ' + error.message);
  return data ? toOrg(data as OrgRow) : null;
}

/** Every org the signed-in user belongs to. Empty when signed out. */
export async function listOrgsForUser(): Promise<Org[]> {
  if (!hasDatabase) return [];

  const supabase = await createServerSupabase();
  // Membership is enforced by row level security, so this needs no filter of
  // its own — an org the caller is not a member of simply does not come back.
  const { data, error } = await supabase
    .from('orgs')
    .select('id, name, slug, offices, is_demo')
    .eq('is_demo', false)
    .order('name');

  if (error) throw new Error('Could not load organisations: ' + error.message);
  return (data as OrgRow[]).map(toOrg);
}
