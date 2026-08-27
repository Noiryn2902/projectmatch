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
