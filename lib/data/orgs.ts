import 'server-only';

import { hasDatabase } from '../env';
import companiesSeed from '../seed/companies.json';
import { createServerSupabase, getCurrentUser } from '../supabase/server';
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

/** One real org by slug, or null if it does not exist or is not visible to the caller. */
export async function getOrgBySlug(slug: string): Promise<Org | null> {
  if (!hasDatabase) return null;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('orgs')
    .select('id, name, slug, offices, is_demo')
    .eq('slug', slug)
    .eq('is_demo', false)
    .maybeSingle();

  if (error) throw new Error('Could not load the organisation: ' + error.message);
  return data ? toOrg(data as OrgRow) : null;
}

export type OrgRole = 'owner' | 'admin' | 'member';

/**
 * The signed-in user's role in an org, or null if they are not a member (or
 * not signed in). Used to decide whether to show admin-only paths like roster
 * import before the database would refuse the write anyway — the refusal is
 * still the real gate, this just avoids walking someone into a dead end.
 */
export async function getMyRole(orgId: string): Promise<OrgRole | null> {
  if (!hasDatabase) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw new Error('Could not load your membership: ' + error.message);
  return data ? (data as { role: OrgRole }).role : null;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'org';
}

/**
 * Creates a real org with the signed-in user as its founding owner, via the
 * create_org() database function — see supabase/migrations/0002_create_org.sql
 * for why this cannot be two ordinary inserts: nobody can become the first
 * member of an org through the normal membership policy, because that policy
 * requires an admin to already exist.
 */
export async function createOrg(name: string): Promise<Org> {
  const supabase = await createServerSupabase();
  const slug = slugify(name);

  const { data: orgId, error } = await supabase.rpc('create_org', {
    p_name: name,
    p_slug: slug,
  });

  if (error) {
    if (error.message.includes('duplicate key') || error.code === '23505') {
      throw new Error('That name is already taken. Try a different one.');
    }
    throw new Error('Could not create the organisation: ' + error.message);
  }

  return { id: orgId as string, name, slug, offices: [], isDemo: false };
}
