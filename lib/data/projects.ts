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

/**
 * A seat that is open right now and whose most recent invitation was declined.
 *
 * This is what turns a decline from a silent database update into something
 * the product acts on: the owner comes back to a seat that says who said no
 * and a way straight into a fresh ranking, rather than having to notice the
 * seat is open again and work out why.
 */
export interface DeclineView {
  /** The most recent person to decline this seat. */
  personName: string;
  respondedAt: string;
  /** Everyone who has declined this seat — used to push them down the re-rank. */
  personIds: string[];
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
  /**
   * Open seats whose last invitation was declined, by role id. The cue for
   * the interface to propose someone else against the team as it now stands.
   */
  declines: Record<string, DeclineView>;
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

  // A decline only matters while the seat is still open. Once it has been
  // re-invited or filled another way the decline is history, not a to-do.
  const openSeats = roleRows
    .map((r) => ({ roleId: r.id, seat: seatByRole.get(r.id) }))
    .filter((x): x is { roleId: string; seat: SeatRow } => x.seat?.state === 'open');

  const declines: Record<string, DeclineView> = {};
  if (openSeats.length > 0) {
    const seatToRole = new Map(openSeats.map((x) => [x.seat.id, x.roleId]));
    const { data: declinedRows, error: declErr } = await supabase
      .from('invitations')
      .select('seat_id, person_id, responded_at, people ( name )')
      .in(
        'seat_id',
        openSeats.map((x) => x.seat.id),
      )
      .eq('status', 'declined')
      .order('responded_at', { ascending: false });
    if (declErr) throw new Error('Could not load invitation history: ' + declErr.message);

    const declRows = (declinedRows ?? []) as unknown as {
      seat_id: string;
      person_id: string;
      responded_at: string;
      people: { name: string } | null;
    }[];

    // Rows arrive most-recent-first, so the first one seen per seat is the
    // latest decline; the rest just accumulate the ids to push down the rank.
    for (const dr of declRows) {
      const roleId = seatToRole.get(dr.seat_id);
      if (!roleId) continue;
      const existing = declines[roleId];
      if (existing) {
        if (!existing.personIds.includes(dr.person_id)) existing.personIds.push(dr.person_id);
      } else {
        declines[roleId] = {
          personName: dr.people?.name ?? 'Someone',
          respondedAt: dr.responded_at,
          personIds: [dr.person_id],
        };
      }
    }
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
    declines,
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

/**
 * Name and description, from the naming step and from Setup alike.
 *
 * The same write serves both because they are the same act: the naming step
 * is simply the first time anyone does it. A project arrives from the builder
 * with no name at all, and having one is what marks that step answered — so
 * this is also what stops the flow routing back through it.
 *
 * The brief is left alone when the field comes back empty. Roles were derived
 * from it at creation and are not re-derived here: editing the description
 * changes what the project says it is, not who it needs.
 */
export async function describeProject(
  projectId: string,
  name: string,
  briefText: string,
): Promise<void> {
  const supabase = await createServerSupabase();
  const trimmed = briefText.trim();

  const { error } = await supabase
    .from('projects')
    .update({
      name: name.trim().slice(0, 120),
      ...(trimmed ? { brief_text: trimmed.slice(0, 2000) } : {}),
    })
    .eq('id', projectId);

  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('row-level security')) {
      throw new Error('Only a member of this organisation can edit it.');
    }
    throw new Error('Could not save the project: ' + error.message);
  }
}

/**
 * Renames a project. Ordinary `projects_write` RLS — an org member on a
 * non-demo project — is the only gate, same as every other write here.
 */
export async function renameProject(projectId: string, name: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('projects')
    .update({ name: name.slice(0, 120) })
    .eq('id', projectId);

  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('row-level security')) {
      throw new Error('Only a member of this organisation can rename it.');
    }
    throw new Error('Could not rename the project: ' + error.message);
  }
}

/**
 * Deletes a project outright. Roles, requirements, seats, invitations and
 * messages all go with it — that is the `on delete cascade` in 0001 doing
 * the work, rather than five deletes here that could half-succeed.
 */
export async function deleteProject(projectId: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('projects').delete().eq('id', projectId);

  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('row-level security')) {
      throw new Error('Only a member of this organisation can delete it.');
    }
    throw new Error('Could not delete the project: ' + error.message);
  }
}

export interface ProjectCard extends ProjectSummary {
  brief: string;
  seats: number;
  filled: number;
  waiting: number;
  /** Coverage 0..1, computed from who actually holds a seat. */
  coverage: number;
  /** Everyone seated, for the faces on the tile. */
  members: Person[];
  /** The role you hold here, if you hold one. */
  myRole: string | null;
}

/**
 * Everything a project tile needs, for a whole org, without one query per
 * project.
 *
 * The dashboard used to show a name and the word "Open", which told you
 * nothing and made a grid of six projects unreadable. A tile should answer
 * "what state is this in" at a glance: who is on it, how far along the
 * staffing is, and whether anything is waiting on someone.
 */
export async function listProjectCards(
  orgId: string,
  myPersonId: string | null,
): Promise<ProjectCard[]> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('projects')
    .select(
      `id, org_id, name, brief_text, duration_weeks, domain, status, created_at,
       project_roles ( id, title, hours_needed, position, requirements ( skill_id, min_level, weight ),
         seats ( person_id, state ) )`,
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw new Error('Could not load projects: ' + error.message);

  type SeatEmbed = { person_id: string | null; state: string };
  /*
   * seats.role_id carries a unique constraint, so PostgREST reads
   * project_roles → seats as a to-*one* relation and embeds a bare object
   * rather than a one-element array. `?? []` covered the null case and hid
   * this for as long as no project had a seat; the moment one did, .filter
   * was being called on an object.
   *
   * Accept either shape rather than betting on which one the API decides
   * this is — the constraint could be relaxed one day, and this stays right
   * both ways.
   */
  type CardRoleRow = RoleRow & { seats: SeatEmbed[] | SeatEmbed | null };
  const seatsOf = (r: CardRoleRow): SeatEmbed[] =>
    Array.isArray(r.seats) ? r.seats : r.seats ? [r.seats] : [];
  const rows = (data ?? []) as unknown as (Omit<ProjectRow, 'project_roles'> & {
    project_roles: CardRoleRow[] | null;
  })[];

  // One lookup for every seated person across every project, rather than a
  // round trip per tile.
  const everyone = [
    ...new Set(
      rows.flatMap((p) =>
        (p.project_roles ?? []).flatMap((r) =>
          seatsOf(r)
            .filter((s) => s.state === 'filled' && s.person_id)
            .map((s) => s.person_id as string),
        ),
      ),
    ),
  ];
  const people = await getPeopleByIds(everyone);
  const byId = new Map(people.map((p) => [p.id, p]));

  return rows.map((row) => {
    const roleRows = row.project_roles ?? [];
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

    const members: Person[] = [];
    let waiting = 0;
    let myRole: string | null = null;

    for (const r of roleRows) {
      const seat = seatsOf(r)[0];
      if (!seat) continue;
      if (seat.state === 'invited') waiting++;
      if (seat.state === 'filled' && seat.person_id) {
        const p = byId.get(seat.person_id);
        if (p) members.push(p);
        if (seat.person_id === myPersonId) myRole = r.title;
      }
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
      brief: row.brief_text,
      seats: roles.length,
      filled: members.length,
      waiting,
      coverage: teamHealth(brief, members, roles.length).coverage,
      members,
      myRole,
    };
  });
}
