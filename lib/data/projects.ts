import 'server-only';

import { teamHealth } from '../engine/health';
import type { Brief, Person, Role, TeamHealth, TeamState } from '../types';
import { createServerSupabase } from '../supabase/server';
import { getPeopleByIds } from './people';

/**
 * The projects repository.
 *
 * This is the read half of what makes a team a real, linkable thing rather
 * than state that lives in one browser tab and dies on refresh. The write
 * half — turning a submitted brief into a row here — needs a real org to
 * write into, which does not exist until Phase 1 (org membership). Until
 * then this seam is proven against one project seeded directly into the
 * demo org by scripts/migrate-seed.mjs, the same way the demo people are.
 *
 * There is no seeded-data fallback here, unlike people.ts. A project is
 * inherently a database thing — nothing before Phase 0 had a concept of a
 * persisted, URL-addressable project — so calling this without a database
 * configured is a programming error, not a degraded mode.
 */

export interface ProjectSummary {
  id: string;
  orgId: string;
  name: string;
  status: 'draft' | 'staffing' | 'active' | 'closed';
  createdAt: string;
}

export interface SeatView {
  state: 'open' | 'invited' | 'filled';
  person: Person | null;
}

export interface ProjectDetail extends ProjectSummary {
  brief: Brief;
  roles: Role[];
  /**
   * Filled seats only. Someone who has been invited but has not answered is
   * deliberately absent: they are not on the team yet, and counting them
   * would inflate coverage with a commitment nobody has made. `seats` below
   * carries the fuller picture for the interface.
   */
  team: TeamState;
  members: Person[];
  health: TeamHealth;
  /** Every seat by role id, including who is merely invited. */
  seats: Record<string, SeatView>;
  /** Spoken for but unconfirmed — excluded from candidate lists elsewhere. */
  invitedPersonIds: string[];
}

interface RequirementRow {
  skill_id: string;
  min_level: number;
  weight: number;
}

interface RoleRow {
  id: string;
  title: string;
  hours_needed: number;
  position: number;
  requirements: RequirementRow[] | null;
}

interface SeatRow {
  id: string;
  role_id: string;
  person_id: string | null;
  state: 'open' | 'invited' | 'filled';
}

interface ProjectRow {
  id: string;
  org_id: string;
  name: string;
  brief_text: string;
  duration_weeks: number;
  domain: string[] | null;
  status: ProjectSummary['status'];
  created_at: string;
  project_roles: RoleRow[] | null;
}

const SELECT = `
  id, org_id, name, brief_text, duration_weeks, domain, status, created_at,
  project_roles ( id, title, hours_needed, position, requirements ( skill_id, min_level, weight ) )
`;

/**
 * One project, fully assembled: the brief the engine understands, who fills
 * each seat, and the same health computation the builder shows live — run
 * here from the persisted state rather than from in-memory selections.
 */
export async function getProject(id: string): Promise<ProjectDetail | null> {
  const supabase = await createServerSupabase();

  const { data: project, error } = await supabase
    .from('projects')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error('Could not load the project: ' + error.message);
  if (!project) return null;

  const row = project as unknown as ProjectRow;
  const roleRows = [...(row.project_roles ?? [])].sort((a, b) => a.position - b.position);

  const { data: seatRows, error: seatsErr } = await supabase
    .from('seats')
    .select('id, role_id, person_id, state')
    .in(
      'role_id',
      roleRows.map((r) => r.id),
    );
  if (seatsErr) throw new Error('Could not load seats: ' + seatsErr.message);

  const seatByRole = new Map((seatRows as SeatRow[]).map((s) => [s.role_id, s]));

  const roles: Role[] = roleRows.map((r) => ({
    id: r.id,
    title: r.title,
    hoursNeeded: r.hours_needed,
    requirements: (r.requirements ?? []).map((req) => ({
      skillId: req.skill_id,
      minLevel: req.min_level,
      weight: req.weight,
    })),
  }));

  // Only a filled seat puts someone on the team. An invited seat is held, not
  // taken — the difference is the whole point of asking rather than assigning.
  const team: TeamState = {};
  const invitedPersonIds: string[] = [];
  for (const r of roleRows) {
    const seat = seatByRole.get(r.id);
    team[r.id] = seat?.state === 'filled' ? (seat.person_id ?? null) : null;
    if (seat?.state === 'invited' && seat.person_id) invitedPersonIds.push(seat.person_id);
  }

  const filledIds = Object.values(team).filter((id): id is string => Boolean(id));
  // One round trip for everyone the interface needs to name, seated or merely
  // asked, rather than a second query for the invited.
  const people = await getPeopleByIds([...filledIds, ...invitedPersonIds]);
  const personById = new Map(people.map((m) => [m.id, m]));
  // Preserve seat order rather than the arbitrary order getPeopleByIds returns.
  const orderedMembers = filledIds
    .map((id) => personById.get(id))
    .filter((p): p is Person => Boolean(p));

  const seats: Record<string, SeatView> = {};
  for (const r of roleRows) {
    const seat = seatByRole.get(r.id);
    seats[r.id] = {
      state: seat?.state ?? 'open',
      person: seat?.person_id ? (personById.get(seat.person_id) ?? null) : null,
    };
  }

  const brief: Brief = {
    text: row.brief_text,
    roles,
    durationWeeks: row.duration_weeks,
    domain: row.domain ?? [],
  };

  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    brief,
    roles,
    team,
    members: orderedMembers,
    health: teamHealth(brief, orderedMembers, roles.length),
    seats,
    invitedPersonIds,
  };
}

/** Every project in an org, most recent first. */
export async function listProjects(orgId: string): Promise<ProjectSummary[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('projects')
    .select('id, org_id, name, status, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw new Error('Could not load projects: ' + error.message);
  return (data as { id: string; org_id: string; name: string; status: ProjectSummary['status']; created_at: string }[]).map(
    (r) => ({ id: r.id, orgId: r.org_id, name: r.name, status: r.status, createdAt: r.created_at }),
  );
}

/**
 * Seats a person, or empties the seat when personId is null.
 *
 * Ordinary RLS-governed updates — the `seats_all` policy already requires org
 * membership and refuses the demo org outright, which is exactly the check
 * that should run here. No privileged path.
 *
 * Note what this deliberately does *not* do yet: it seats someone directly,
 * without asking them. That is Phase 2's whole subject — an invitation the
 * person can accept or decline, with the engine re-ranking on a decline — and
 * the `state` column already carries 'invited' for it. Until then, filling a
 * seat is an assertion by whoever runs the org, not an agreement.
 */
export async function setSeatPerson(roleId: string, personId: string | null): Promise<void> {
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('seats')
    .update({
      person_id: personId,
      state: personId ? 'filled' : 'open',
      filled_at: personId ? new Date().toISOString() : null,
    })
    .eq('role_id', roleId);

  if (error) throw new Error('Could not update the seat: ' + error.message);
}

/**
 * The write path: turns a submitted brief into a real, persisted, linkable
 * project inside a real org — through create_project(), see
 * supabase/migrations/0003_create_project.sql for why this is one database
 * function rather than four sequential inserts from here.
 */
export async function createProject(
  orgId: string,
  brief: Brief,
  name = '',
): Promise<string> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase.rpc('create_project', {
    p_org_id: orgId,
    p_name: name,
    p_brief_text: brief.text,
    p_duration_weeks: brief.durationWeeks,
    p_domain: brief.domain,
    p_roles: brief.roles.map((r) => ({
      title: r.title,
      hoursNeeded: r.hoursNeeded,
      requirements: r.requirements.map((req) => ({
        skillId: req.skillId,
        minLevel: req.minLevel,
        weight: req.weight,
      })),
    })),
  });

  if (error) throw new Error('Could not create the project: ' + error.message);
  return data as string;
}
