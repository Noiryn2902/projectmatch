import 'server-only';

import { createServerSupabase } from '../supabase/server';
import { getMyPersonId } from './people';

/**
 * Everything the signed-in person needs to see about themselves, in one
 * place: the teams they are actually on, and the seats waiting on their
 * answer.
 *
 * Until now every query in the product asked "who fits this seat" — the
 * staffing side's question. Nobody had asked the other one: what am I on,
 * and what is being asked of me. That is the whole difference between a
 * tool your manager uses about you and a tool you use.
 */

export interface MyTeam {
  projectId: string;
  projectName: string;
  brief: string;
  status: string;
  roleTitle: string;
  hoursNeeded: number;
  /** How many seats on that project are filled, for a sense of the team. */
  teammates: number;
}

export interface MyInvitation {
  token: string;
  projectId: string;
  projectName: string;
  brief: string;
  roleTitle: string;
  expiresAt: string;
}

export interface MyWork {
  personId: string | null;
  teams: MyTeam[];
  invitations: MyInvitation[];
}

const EMPTY: MyWork = { personId: null, teams: [], invitations: [] };

export async function getMyWork(orgId: string): Promise<MyWork> {
  const personId = await getMyPersonId(orgId);
  if (!personId) return EMPTY;

  const supabase = await createServerSupabase();

  const [seatsRes, invRes] = await Promise.all([
    supabase
      .from('seats')
      .select('project_id, project_roles ( title, hours_needed ), projects ( id, name, brief_text, status )')
      .eq('person_id', personId)
      .eq('state', 'filled'),
    supabase
      .from('invitations')
      .select('token, expires_at, seats ( project_roles ( title ), projects ( id, name, brief_text ) )')
      .eq('person_id', personId)
      .eq('status', 'pending')
      .order('sent_at', { ascending: false }),
  ]);

  if (seatsRes.error) throw new Error('Could not load your teams: ' + seatsRes.error.message);
  if (invRes.error) throw new Error('Could not load your invitations: ' + invRes.error.message);

  const seatRows = (seatsRes.data ?? []) as unknown as {
    project_id: string;
    project_roles: { title: string; hours_needed: number } | null;
    projects: { id: string; name: string; brief_text: string; status: string } | null;
  }[];

  // One extra query for how many people sit alongside them, rather than one
  // per project.
  const projectIds = [...new Set(seatRows.map((r) => r.project_id))];
  const counts = new Map<string, number>();
  if (projectIds.length > 0) {
    const { data: filled } = await supabase
      .from('seats')
      .select('project_id')
      .in('project_id', projectIds)
      .eq('state', 'filled');
    for (const row of (filled ?? []) as { project_id: string }[]) {
      counts.set(row.project_id, (counts.get(row.project_id) ?? 0) + 1);
    }
  }

  const teams: MyTeam[] = seatRows
    .filter((r) => r.projects)
    .map((r) => ({
      projectId: r.projects!.id,
      projectName: r.projects!.name || 'Untitled project',
      brief: r.projects!.brief_text,
      status: r.projects!.status,
      roleTitle: r.project_roles?.title ?? 'a role',
      hoursNeeded: r.project_roles?.hours_needed ?? 0,
      // Minus themselves.
      teammates: Math.max(0, (counts.get(r.project_id) ?? 1) - 1),
    }));

  const invRows = (invRes.data ?? []) as unknown as {
    token: string;
    expires_at: string;
    seats: {
      project_roles: { title: string } | null;
      projects: { id: string; name: string; brief_text: string } | null;
    } | null;
  }[];

  const invitations: MyInvitation[] = invRows
    .filter((r) => r.seats?.projects)
    .map((r) => ({
      token: r.token,
      projectId: r.seats!.projects!.id,
      projectName: r.seats!.projects!.name || 'Untitled project',
      brief: r.seats!.projects!.brief_text,
      roleTitle: r.seats!.project_roles?.title ?? 'a role',
      expiresAt: r.expires_at,
    }));

  return { personId, teams, invitations };
}

export interface Notice {
  kind: 'invitation' | 'decline' | 'message';
  text: string;
  href: string;
  at: string;
}

/**
 * What has happened that you would want to know about.
 *
 * Three sources, deliberately: a seat waiting on your answer, a seat you
 * offered that someone turned down, and conversation on a team you are on.
 * The bell counts what is *actionable* — invitations — while the list also
 * carries what is merely news, because a count that includes chatter trains
 * people to ignore it.
 */
export async function getNotices(orgId: string, limit = 8): Promise<Notice[]> {
  const personId = await getMyPersonId(orgId);
  if (!personId) return [];

  const supabase = await createServerSupabase();
  const notices: Notice[] = [];

  const { data: invited } = await supabase
    .from('invitations')
    .select('token, sent_at, seats ( project_roles ( title ), projects ( name ) )')
    .eq('person_id', personId)
    .eq('status', 'pending')
    .order('sent_at', { ascending: false })
    .limit(limit);

  for (const r of (invited ?? []) as unknown as {
    token: string;
    sent_at: string;
    seats: { project_roles: { title: string } | null; projects: { name: string } | null } | null;
  }[]) {
    notices.push({
      kind: 'invitation',
      text: `You were asked to take the ${r.seats?.project_roles?.title ?? 'a'} seat on ${
        r.seats?.projects?.name || 'a project'
      }`,
      href: `/invite/${r.token}`,
      at: r.sent_at,
    });
  }

  // Declines on projects in this org. RLS already limits invitations to ones
  // attached to a project you can see, so no extra ownership filter is needed.
  const { data: declined } = await supabase
    .from('invitations')
    .select('responded_at, people ( name ), seats ( project_id, project_roles ( title ) )')
    .eq('status', 'declined')
    .not('responded_at', 'is', null)
    .order('responded_at', { ascending: false })
    .limit(limit);

  for (const r of (declined ?? []) as unknown as {
    responded_at: string;
    people: { name: string } | null;
    seats: { project_id: string; project_roles: { title: string } | null } | null;
  }[]) {
    if (!r.seats) continue;
    notices.push({
      kind: 'decline',
      text: `${r.people?.name ?? 'Someone'} declined the ${
        r.seats.project_roles?.title ?? 'a'
      } seat`,
      href: `/project/${r.seats.project_id}`,
      at: r.responded_at,
    });
  }

  return notices.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
