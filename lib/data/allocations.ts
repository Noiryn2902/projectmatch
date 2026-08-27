import 'server-only';

import { createServerSupabase } from '../supabase/server';

/**
 * What each person is already committed to.
 *
 * `hoursPerWeek` on a person is a ceiling that, until now, meant nothing —
 * someone could be seated on every project at once and the engine never
 * noticed. This derives real commitment straight from filled seats: the sum
 * of `hours_needed` across every seat a person currently holds, org-wide.
 * No `allocations` rows to keep in sync, so it cannot drift.
 */

export interface Commitment {
  hours: number;
  projects: number;
}

export async function getCommitments(orgId: string): Promise<Map<string, Commitment>> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('seats')
    .select('person_id, project_id, project_roles!inner ( hours_needed ), projects!inner ( org_id )')
    .eq('state', 'filled')
    .eq('projects.org_id', orgId)
    .not('person_id', 'is', null);

  if (error) throw new Error('Could not load current commitments: ' + error.message);

  const rows = (data ?? []) as unknown as {
    person_id: string;
    project_id: string;
    project_roles: { hours_needed: number } | null;
  }[];

  const byPerson = new Map<string, { hours: number; projects: Set<string> }>();
  for (const r of rows) {
    if (!r.person_id) continue;
    const entry = byPerson.get(r.person_id) ?? { hours: 0, projects: new Set<string>() };
    entry.hours += r.project_roles?.hours_needed ?? 0;
    entry.projects.add(r.project_id);
    byPerson.set(r.person_id, entry);
  }

  const out = new Map<string, Commitment>();
  for (const [id, e] of byPerson) out.set(id, { hours: e.hours, projects: e.projects.size });
  return out;
}
