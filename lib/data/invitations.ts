import 'server-only';

import { randomBytes } from 'node:crypto';

import { createAdminSupabase } from '../supabase/admin';
import { createServerSupabase } from '../supabase/server';

/**
 * Invitations — the difference between assigning someone and asking them.
 */

export type InvitationStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'revoked';

/** What respond_to_invitation() can tell us. */
export type RespondOutcome =
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'seat_taken'
  | 'not_found'
  | `already_${InvitationStatus}`;

export interface InvitationView {
  id: string;
  status: InvitationStatus;
  message: string | null;
  expiresAt: string;
  personName: string;
  personEmail: string | null;
  roleTitle: string;
  projectId: string;
  projectBrief: string;
  orgName: string;
}

/**
 * 32 bytes of randomness, base64url so it survives a URL untouched. This is
 * the only thing standing between a stranger and someone else's invitation,
 * so it is not a uuid and not sequential.
 */
const newToken = () => randomBytes(32).toString('base64url');

/** Invites a person to a seat. Returns the token to build the link from. */
export async function inviteToSeat(
  roleId: string,
  personId: string,
  message?: string,
): Promise<string> {
  const supabase = await createServerSupabase();
  const token = newToken();

  const { error } = await supabase.rpc('invite_to_seat', {
    p_role_id: roleId,
    p_person_id: personId,
    p_token: token,
    p_message: message ?? null,
  });

  if (error) {
    // The partial unique index in 0001 allows only one pending invitation per
    // seat — this is the "two people invited the same candidate" case, caught
    // by the database rather than by hoping the application checked first.
    if (error.code === '23505' || error.message.includes('duplicate key')) {
      throw new Error('Someone has already been invited to this seat.');
    }
    throw new Error('Could not send the invitation: ' + error.message);
  }

  return token;
}

/**
 * Reads an invitation by its token, for the acceptance page.
 *
 * Uses the admin client deliberately: the recipient may have no account, and
 * therefore no permission to read any of these rows. The token is what
 * authorises this, which is why it is the only input and why it is long.
 */
export async function getInvitationByToken(token: string): Promise<InvitationView | null> {
  const db = createAdminSupabase();

  const { data, error } = await db
    .from('invitations')
    .select(
      `id, status, message, expires_at,
       people ( name, email ),
       seats ( project_roles ( title ), projects ( id, brief_text, orgs ( name ) ) )`,
    )
    .eq('token', token)
    .maybeSingle();

  if (error) throw new Error('Could not load the invitation: ' + error.message);
  if (!data) return null;

  const row = data as unknown as {
    id: string;
    status: InvitationStatus;
    message: string | null;
    expires_at: string;
    people: { name: string; email: string | null } | null;
    seats: {
      project_roles: { title: string } | null;
      projects: { id: string; brief_text: string; orgs: { name: string } | null } | null;
    } | null;
  };

  return {
    id: row.id,
    status: row.status,
    message: row.message,
    expiresAt: row.expires_at,
    personName: row.people?.name ?? 'Someone',
    personEmail: row.people?.email ?? null,
    roleTitle: row.seats?.project_roles?.title ?? 'a role',
    projectId: row.seats?.projects?.id ?? '',
    projectBrief: row.seats?.projects?.brief_text ?? '',
    orgName: row.seats?.projects?.orgs?.name ?? 'an organisation',
  };
}

/**
 * Accept or decline. Every interesting case — expired, already answered, seat
 * filled by someone else in the meantime — is decided inside one transaction
 * in the database rather than by reading, deciding here, and writing back.
 */
export async function respondToInvitation(
  token: string,
  accept: boolean,
): Promise<RespondOutcome> {
  const db = createAdminSupabase();

  const { data, error } = await db.rpc('respond_to_invitation', {
    p_token: token,
    p_accept: accept,
  });

  if (error) throw new Error('Could not record your answer: ' + error.message);
  return data as RespondOutcome;
}

/** The pending invitation on a seat, if there is one. */
export async function getPendingInvitationForRole(roleId: string): Promise<{ token: string } | null> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('invitations')
    .select('token, seats!inner(role_id)')
    .eq('seats.role_id', roleId)
    .eq('status', 'pending')
    .maybeSingle();

  if (error) throw new Error('Could not load the invitation: ' + error.message);
  return data ? { token: (data as { token: string }).token } : null;
}

export interface PendingInvitation {
  token: string;
  personName: string;
  roleId: string;
  roleTitle: string;
  sentAt: string;
  expiresAt: string;
}

/** Every unanswered invitation on a project, for the staffing side to manage. */
export async function listPendingInvitations(projectId: string): Promise<PendingInvitation[]> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('invitations')
    .select(
      `token, sent_at, expires_at,
       people ( name ),
       seats!inner ( role_id, project_id, project_roles ( title ) )`,
    )
    .eq('seats.project_id', projectId)
    .eq('status', 'pending')
    .order('sent_at', { ascending: true });

  if (error) throw new Error('Could not load pending invitations: ' + error.message);

  const rows = (data ?? []) as unknown as {
    token: string;
    sent_at: string;
    expires_at: string;
    people: { name: string } | null;
    seats: { role_id: string; project_roles: { title: string } | null } | null;
  }[];

  return rows.map((r) => ({
    token: r.token,
    personName: r.people?.name ?? 'Someone',
    roleId: r.seats?.role_id ?? '',
    roleTitle: r.seats?.project_roles?.title ?? 'a role',
    sentAt: r.sent_at,
    expiresAt: r.expires_at,
  }));
}

/**
 * Withdraws the pending invitation on a role's seat and reopens the seat.
 *
 * Two RLS-checked writes rather than one function: there is no
 * `SECURITY DEFINER` reason here (the caller is an org member acting on their
 * own project) and no migration is worth one revoke. The invitation is
 * marked first — if the seat update then failed, the recoverable state is a
 * seat still showing 'invited' with nothing pending on it, which re-inviting
 * clears, rather than a live invitation to a seat that has moved on.
 */
export async function revokeInvitation(roleId: string): Promise<void> {
  const supabase = await createServerSupabase();

  const { data: seat, error: seatErr } = await supabase
    .from('seats')
    .select('id')
    .eq('role_id', roleId)
    .maybeSingle();
  if (seatErr) throw new Error('Could not find the seat: ' + seatErr.message);
  if (!seat) throw new Error('No seat exists for that role.');

  const seatId = (seat as { id: string }).id;

  const { error: invErr } = await supabase
    .from('invitations')
    .update({ status: 'revoked', responded_at: new Date().toISOString() })
    .eq('seat_id', seatId)
    .eq('status', 'pending');
  if (invErr) throw new Error('Could not withdraw the invitation: ' + invErr.message);

  const { error: reopenErr } = await supabase
    .from('seats')
    .update({ person_id: null, state: 'open', filled_at: null })
    .eq('id', seatId)
    .eq('state', 'invited');
  if (reopenErr) throw new Error('Invitation withdrawn, but the seat did not reopen: ' + reopenErr.message);
}

export interface InvitationTile {
  token: string;
  personId: string;
  personName: string;
  personEmail: string | null;
  personPhoto: string | null;
  personTitle: string;
  personHue: number;
  roleTitle: string;
  roleId: string;
  status: 'sent' | 'accepted' | 'declined';
  at: string;
}

/**
 * Every invitation on a project, in the three states anyone cares about:
 * sent and waiting, accepted, declined.
 *
 * The project page had this spread across a "pending" list, a decline map
 * and the seat rows, which is three places to look for one question — who
 * did we ask, and what did they say. One query, one list, one answer.
 */
export async function listInvitationTiles(projectId: string): Promise<InvitationTile[]> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('invitations')
    .select(
      `token, status, sent_at, responded_at,
       people ( id, name, email, photo, title, hue ),
       seats!inner ( role_id, project_id, project_roles ( title ) )`,
    )
    .eq('seats.project_id', projectId)
    .in('status', ['pending', 'accepted', 'declined'])
    .order('sent_at', { ascending: false });

  if (error) throw new Error('Could not load invitations: ' + error.message);

  const rows = (data ?? []) as unknown as {
    token: string;
    status: string;
    sent_at: string;
    responded_at: string | null;
    people: {
      id: string;
      name: string;
      email: string | null;
      photo: string | null;
      title: string;
      hue: number;
    } | null;
    seats: { role_id: string; project_roles: { title: string } | null } | null;
  }[];

  return rows
    .filter((r) => r.people && r.seats)
    .map((r) => ({
      token: r.token,
      personId: r.people!.id,
      personName: r.people!.name,
      personEmail: r.people!.email,
      personPhoto: r.people!.photo,
      personTitle: r.people!.title,
      personHue: r.people!.hue,
      roleTitle: r.seats!.project_roles?.title ?? 'a role',
      roleId: r.seats!.role_id,
      status: r.status === 'pending' ? 'sent' : (r.status as 'accepted' | 'declined'),
      at: r.responded_at ?? r.sent_at,
    }));
}
