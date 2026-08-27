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

export interface ProjectDetail extends ProjectSummary {
  brief: Brief;
  roles: Role[];
  team: TeamState;
  members: Person[];
  health: TeamHealth;
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

  const team: TeamState = {};
  for (const r of roleRows) {
    team[r.id] = seatByRole.get(r.id)?.person_id ?? null;
  }

  const filledIds = Object.values(team).filter((id): id is string => Boolean(id));
  const members = await getPeopleByIds(filledIds);
  const memberById = new Map(members.map((m) => [m.id, m]));
  // Preserve seat order rather than the arbitrary order getPeopleByIds returns.
  const orderedMembers = filledIds.map((id) => memberById.get(id)).filter((p): p is Person => Boolean(p));

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
