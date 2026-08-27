import 'server-only';

import { hasDatabase } from '../env';
import peopleSeed from '../seed/people.json';
import { createServerSupabase } from '../supabase/server';
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
  person_skills ( skill_id, level, provenance, last_used_at )
`;

function toPerson(row: PersonRow): Person {
  const skills: PersonSkill[] = (row.person_skills ?? []).map((s) => ({
    skillId: s.skill_id,
    level: s.level,
    provenance: s.provenance,
    ...(s.last_used_at ? { lastUsedAt: s.last_used_at } : {}),
  }));

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
