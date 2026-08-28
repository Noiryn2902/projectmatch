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

  // A line of context from the person doing the asking. The invitation page
  // has always rendered this; there was simply never a box to type it in.
  const message = String(formData.get('message') ?? '')
    .trim()
    .slice(0, 500);

  const token = await inviteToSeat(roleId, personId, message || undefined);

  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const { emailed } = await sendInvitationEmail(token, `${proto}://${host}/invite/${token}`);

  redirect(`/project/${projectId}?invited=${token}${emailed ? '&emailed=1' : ''}`);
}

/**
 * Picking, not asking.
 *
 * The same ranking serves two arrivals. From the workspace, choosing someone
 * means inviting them then and there. From step four, it means swapping one
 * card — the person a colleague declined for the next best one — and going
 * back to the list, where the note gets written and everything goes out
 * together. Sending here instead would fire an invitation with no message
 * attached and drop them out of the flow they were halfway through.
 */
export async function chooseForInviteAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  const roleId = String(formData.get('roleId') ?? '');
  const personId = String(formData.get('personId') ?? '');

  if (!projectId || !roleId || !personId) return;

  // Replace this seat's pick and keep every other one intact.
  const kept = String(formData.get('picks') ?? '')
    .split(',')
    .filter((p) => p.includes(':') && !p.startsWith(`${roleId}:`));
  const picks = [...kept, `${roleId}:${personId}`].join(',');

  redirect(`/project/${projectId}/invite?picks=${encodeURIComponent(picks)}`);
}
