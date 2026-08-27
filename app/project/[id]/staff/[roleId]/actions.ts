'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { inviteToSeat } from '@/lib/data/invitations';
import { sendInvitationEmail } from '@/lib/email/invitation';
import { setSeatPerson } from '@/lib/data/projects';

export async function fillSeatAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  const roleId = String(formData.get('roleId') ?? '');
  // Empty means "remove whoever is sitting here" — the same form does both,
  // so the button can toggle without a second action.
  const personId = String(formData.get('personId') ?? '') || null;

  if (!projectId || !roleId) return;

  await setSeatPerson(roleId, personId);

  redirect('/project/' + projectId);
}

/**
 * Asks rather than assigns. Sends the invitation link by email when there is
 * an address to send it to and email is configured; otherwise the link is
 * shown on the project page to be carried by hand. Either way the token is
 * in the query so the link is always recoverable — a bounced or
 * unconfigured send never strands an invitation.
 */
export async function inviteAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  const roleId = String(formData.get('roleId') ?? '');
  const personId = String(formData.get('personId') ?? '');

  if (!projectId || !roleId || !personId) return;

  const token = await inviteToSeat(roleId, personId);

  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const { emailed } = await sendInvitationEmail(token, `${proto}://${host}/invite/${token}`);

  redirect(`/project/${projectId}?invited=${token}${emailed ? '&emailed=1' : ''}`);
}
