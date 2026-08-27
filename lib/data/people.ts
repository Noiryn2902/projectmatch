import 'server-only';

import { hasDatabase } from '../env';
import peopleSeed from '../seed/people.json';
import { createServerSupabase, getCurrentUser } from '../supabase/server';
import type { Person, PersonSkill, SkillProvenance } from '../types';

/**
 * The people repository.
 *
 * This is the seam that keeps the engine pure. Whatever the source, what comes
 * out is a plain `Person[]` — so `rankCandidates` and everything under
 * lib/engine never learn that a database exists, and the 51 engine tests keep
 * running in milliseconds against fixtures.
 *
 * With no credentials configured this returns the seeded sixty, unchanged.
 */

interface SkillRow {
  skill_id: string;
  level: number;
  provenance: SkillProvenance;
  last_used_at: string | null;
  endorsements: { id: string }[] | null;
}

interface PersonRow {
  id: string;
  org_id: string;
  name: string;
  title: string;
  office: string;
  utc_offset: number | string;
  years_exp: number;
  seniority: number;
  hours_per_week: number;
  interests: string[] | null;
  email: string | null;
  slack: string | null;
  linkedin: string | null;
  github: string | null;
  photo: string | null;
  hue: number;
  open_to_projects: boolean;
  person_skills: SkillRow[] | null;
}

const SELECT = `
  id, org_id, name, title, office, utc_offset, years_exp, seniority,
  hours_per_week, interests, email, slack, linkedin, github, photo, hue,
  open_to_projects,
  person_skills ( skill_id, level, provenance, last_used_at, endorsements ( id ) )
`;

function toPerson(row: PersonRow): Person {
  const skills: PersonSkill[] = (row.person_skills ?? []).map((s) => {
    // A colleague vouching for a level is stronger corroboration than a
    // self-report or a résumé scrape — so a self/extracted skill with at
    // least one endorsement is read by the engine as 'endorsed'. A verified
    // level, or a seeded one with no provenance at all, is left as it is.
    const endorsed = (s.endorsements?.length ?? 0) > 0;
    const provenance: SkillProvenance =
      endorsed && (s.provenance === 'self' || s.provenance === 'extracted')
        ? 'endorsed'
        : s.provenance;

    return {
      skillId: s.skill_id,
      level: s.level,
      provenance,
      ...(s.last_used_at ? { lastUsedAt: s.last_used_at } : {}),
    };
  });

  return {
    id: row.id,
    name: row.name,
    title: row.title,
    // One org is one company. The seeded data's six companies collapse into
    // the demo org when it is imported — see the open question in
    // docs/IMPROVEMENTS.md before changing this.
    companyId: row.org_id,
    office: row.office,
    // Postgres hands numeric() back as a string.
    utcOffset: Number(row.utc_offset),
    yearsExp: row.years_exp,
    seniority: row.seniority,
    skills,
    interests: row.interests ?? [],
    hoursPerWeek: row.hours_per_week,
    contact: {
      email: row.email ?? '',
      slack: row.slack ?? '',
      linkedin: row.linkedin ?? '',
      ...(row.github ? { github: row.github } : {}),
    },
    openToProjects: row.open_to_projects,
    ...(row.photo ? { photo: row.photo } : {}),
    hue: row.hue,
  };
}

/** Everyone in an org, or the whole seeded pool when there is no database. */
export async function listPeople(orgId?: string): Promise<Person[]> {
  if (!hasDatabase) return peopleSeed as Person[];

  const supabase = await createServerSupabase();
  const base = supabase.from('people').select(SELECT).is('deleted_at', null);
  const { data, error } = orgId ? await base.eq('org_id', orgId) : await base;

  if (error) throw new Error('Could not load people: ' + error.message);
  return (data as unknown as PersonRow[]).map(toPerson);
}

/**
 * Adds one person to an org's roster. Relies on ordinary RLS — the
 * `people_insert` policy — rather than a privileged path: an admin of the
 * org can do this, and nobody else can, which is exactly what should be true
 * and is worth having the database enforce rather than just this function.
 */
export async function addPerson(
  orgId: string,
  input: { name: string; title?: string; hoursPerWeek?: number },
): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('people').insert({
    org_id: orgId,
    name: input.name,
    title: input.title ?? '',
    hours_per_week: input.hoursPerWeek ?? 0,
  });

  if (error) throw new Error('Could not add person: ' + error.message);
}

export interface ImportRow {
  name: string;
  title?: string;
  email?: string;
  department?: string;
  office?: string;
  hoursPerWeek?: number;
  seniority?: number;
  skills?: { skillId: string; level: number }[];
}

/**
 * Adds many people to a roster in one insert, plus their skills in a second.
 *
 * Same RLS as addPerson — the `people_insert` and `person_skills_write`
 * policies let an org admin write for the org and nobody else — so a
 * non-admin caller gets a clean refusal rather than a partial import.
 * Deliberately not a SECURITY DEFINER function: there is no bootstrapping
 * deadlock here the way there was for creating an org, so ordinary RLS is
 * the right and only gate.
 *
 * Skills land with `provenance = 'self'` and `source = 'roster import'` — an
 * admin pasting a spreadsheet is asserting a level, not verifying it, and
 * the engine's `skillTrust` already discounts exactly that.
 */
export async function importPeople(orgId: string, rows: ImportRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const supabase = await createServerSupabase();
  const { data: inserted, error } = await supabase
    .from('people')
    .insert(
      rows.map((r) => ({
        org_id: orgId,
        name: r.name,
        title: r.title ?? '',
        email: r.email || null,
        department: r.department ?? '',
        office: r.office ?? '',
        hours_per_week: r.hoursPerWeek ?? 0,
        seniority: r.seniority ?? 1,
      })),
    )
    .select('id, name');

  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('row-level security')) {
      throw new Error('Only an organisation admin can import a roster.');
    }
    throw new Error('Could not import the roster: ' + error.message);
  }

  const created = (inserted ?? []) as { id: string; name: string }[];

  // Attribute skills by name — the caller has already de-duplicated names
  // within the batch, so this mapping is unambiguous for these rows.
  const idByName = new Map(created.map((p) => [p.name.toLowerCase(), p.id]));
  const skillRows = rows.flatMap((r) => {
    const personId = idByName.get(r.name.toLowerCase());
    if (!personId || !r.skills?.length) return [];
    return r.skills.map((s) => ({
      person_id: personId,
      skill_id: s.skillId,
      level: s.level,
      provenance: 'self' as const,
      source: 'roster import',
    }));
  });

  if (skillRows.length > 0) {
    const { error: skillErr } = await supabase.from('person_skills').insert(skillRows);
    // A person with no skills is still a real roster entry — do not fail the
    // whole import over the skills half, but do surface it.
    if (skillErr) throw new Error('People were added, but their skills were not: ' + skillErr.message);
  }

  return created.length;
}

/**
 * A specific set of people, in no particular order. Built for the projects
 * repository — resolving who fills each seat — so that seam has exactly one
 * place doing the row-to-Person mapping rather than a second copy of it.
 */
export async function getPeopleByIds(ids: string[]): Promise<Person[]> {
  if (ids.length === 0) return [];

  if (!hasDatabase) {
    const byId = new Map((peopleSeed as Person[]).map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is Person => Boolean(p));
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('people')
    .select(SELECT)
    .in('id', ids)
    .is('deleted_at', null);

  if (error) throw new Error('Could not load people: ' + error.message);
  return (data as unknown as PersonRow[]).map(toPerson);
}

/**
 * Adds skills read out of a résumé to a person, as `extracted` provenance.
 *
 * Skips any skill the person already has — an extracted level must never
 * overwrite one a colleague endorsed or the org verified. Ordinary
 * `person_skills_write` RLS applies: an org admin, or the person themselves.
 * Returns how many were actually new.
 */
export async function addExtractedSkills(
  personId: string,
  skills: { skillId: string; level: number }[],
  source: 'résumé' | 'github' = 'résumé',
): Promise<number> {
  if (skills.length === 0) return 0;

  const supabase = await createServerSupabase();

  const { data: existing, error: readErr } = await supabase
    .from('person_skills')
    .select('skill_id')
    .eq('person_id', personId);
  if (readErr) throw new Error('Could not read existing skills: ' + readErr.message);

  const have = new Set((existing ?? []).map((r) => (r as { skill_id: string }).skill_id));
  const fresh = skills.filter((s) => !have.has(s.skillId));
  if (fresh.length === 0) return 0;

  const { error } = await supabase.from('person_skills').insert(
    fresh.map((s) => ({
      person_id: personId,
      skill_id: s.skillId,
      level: s.level,
      provenance: 'extracted' as const,
      source,
    })),
  );

  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('row-level security')) {
      throw new Error('Only an organisation admin can edit this roster.');
    }
    throw new Error('Could not add the skills: ' + error.message);
  }

  return fresh.length;
}

/**
 * Creates the caller's *own* person row in an org and returns its id.
 *
 * Distinct from `addPerson`, which an admin uses to add somebody else: this
 * sets `user_id` to the caller and stamps `claimed_at`, so the row is theirs
 * from the moment it exists and never needs claiming. The `people_insert`
 * policy allows exactly this — `is_org_member(org_id) and user_id = auth.uid()`
 * — so no privileged path is involved.
 */
export async function createMyProfile(
  orgId: string,
  input: { name: string; title?: string; hoursPerWeek?: number; office?: string },
): Promise<string> {
  const supabase = await createServerSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('You have to be signed in to create a profile.');

  const { data, error } = await supabase
    .from('people')
    .insert({
      org_id: orgId,
      user_id: user.id,
      name: input.name,
      title: input.title ?? '',
      office: input.office ?? '',
      hours_per_week: input.hoursPerWeek ?? 0,
      email: user.email ?? null,
      claimed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') throw new Error('You already have a profile in this organisation.');
    if (error.code === '42501' || error.message.toLowerCase().includes('row-level security')) {
      throw new Error('You are not a member of that organisation.');
    }
    throw new Error('Could not create your profile: ' + error.message);
  }

  return (data as { id: string }).id;
}

/**
 * Attaches the signed-in account to a roster row, through claim_person() —
 * see supabase/migrations/0005_claim_person.sql for why this is a
 * SECURITY DEFINER function and not an ordinary update.
 */
export async function claimPerson(personId: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('claim_person', { p_person_id: personId });
  if (error) throw new Error(error.message.replace(/^.*?: /, ''));
}

/** Whether a roster row has been attached to an account, and to whom. */
export async function getPersonAccount(
  personId: string,
): Promise<{ claimed: boolean; userId: string | null }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('people')
    .select('user_id')
    .eq('id', personId)
    .maybeSingle();

  if (error) throw new Error('Could not load the profile: ' + error.message);
  const userId = (data as { user_id: string | null } | null)?.user_id ?? null;
  return { claimed: userId !== null, userId };
}

/** The caller's own claimed person row id in an org, or null. */
export async function getMyPersonId(orgId: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('people')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error('Could not load your profile: ' + error.message);
  return data ? (data as { id: string }).id : null;
}

export interface SkillDetail {
  personSkillId: string;
  skillId: string;
  level: number;
  provenance: SkillProvenance;
  endorsementCount: number;
  endorsedByMe: boolean;
}

/**
 * One person's skills with the endorsement picture the person page needs —
 * how many people have endorsed each, and whether the viewer is one of them.
 * Kept separate from `toPerson` so the engine-facing `Person` stays a plain
 * shape and this richer view is only paid for where it is shown.
 */
export async function getPersonSkillDetail(
  personId: string,
  viewerPersonId: string | null,
): Promise<SkillDetail[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('person_skills')
    .select('id, skill_id, level, provenance, endorsements ( endorsed_by )')
    .eq('person_id', personId);

  if (error) throw new Error('Could not load skills: ' + error.message);

  const rows = (data ?? []) as unknown as {
    id: string;
    skill_id: string;
    level: number;
    provenance: SkillProvenance;
    endorsements: { endorsed_by: string }[] | null;
  }[];

  return rows
    .map((r) => {
      const ends = r.endorsements ?? [];
      return {
        personSkillId: r.id,
        skillId: r.skill_id,
        level: r.level,
        provenance: r.provenance,
        endorsementCount: ends.length,
        endorsedByMe: viewerPersonId ? ends.some((e) => e.endorsed_by === viewerPersonId) : false,
      };
    })
    .sort((a, b) => b.level - a.level);
}

/**
 * Endorses one of another person's skill rows. `endorsed_by` is the
 * endorser's own person row; the `endorsements_write` policy in 0001 refuses
 * a self-endorsement and anyone without a person row of their own.
 */
export async function endorseSkill(personSkillId: string, endorserPersonId: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('endorsements')
    .insert({ person_skill_id: personSkillId, endorsed_by: endorserPersonId });

  if (error) {
    if (error.code === '23505') return; // already endorsed — idempotent
    if (error.code === '42501' || error.message.toLowerCase().includes('row-level security')) {
      throw new Error('You can only endorse a colleague once, and never your own skill.');
    }
    throw new Error('Could not record the endorsement: ' + error.message);
  }
}

/** Withdraws the caller's endorsement of a skill row. */
export async function removeEndorsement(
  personSkillId: string,
  endorserPersonId: string,
): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('endorsements')
    .delete()
    .eq('person_skill_id', personSkillId)
    .eq('endorsed_by', endorserPersonId);

  if (error) throw new Error('Could not withdraw the endorsement: ' + error.message);
}

/** One person, or null if they do not exist or are not visible to the caller. */
export async function getPerson(id: string): Promise<Person | null> {
  if (!hasDatabase) {
    return (peopleSeed as Person[]).find((p) => p.id === id) ?? null;
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('people')
    .select(SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error('Could not load person: ' + error.message);
  return data ? toPerson(data as unknown as PersonRow) : null;
}

/**
 * Updates the details a person owns about themselves.
 *
 * Ordinary RLS: `people_update` allows your own row, or any row in an org
 * you administer, and refuses the demo org outright. No privileged path, so
 * the same rule that governs every other write governs this one.
 */
export async function updatePersonDetails(
  personId: string,
  input: { name: string; title: string; office: string; hoursPerWeek: number },
): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('people')
    .update({
      name: input.name,
      title: input.title,
      office: input.office,
      hours_per_week: input.hoursPerWeek,
    })
    .eq('id', personId);

  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('row-level security')) {
      throw new Error('You can only edit your own profile.');
    }
    throw new Error('Could not save your changes: ' + error.message);
  }
}
