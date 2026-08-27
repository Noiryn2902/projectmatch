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
