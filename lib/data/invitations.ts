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
