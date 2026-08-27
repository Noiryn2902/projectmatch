'use server';

import { redirect } from 'next/navigation';

import { inviteToSeat } from '@/lib/data/invitations';
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
 * Asks rather than assigns. Redirects to the project with the token in the
 * query, because until email delivery exists somebody has to carry the link
 * to the recipient by hand — and pretending otherwise would hide the one
 * piece of this that is not yet real.
 */
export async function inviteAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  const roleId = String(formData.get('roleId') ?? '');
  const personId = String(formData.get('personId') ?? '');

  if (!projectId || !roleId || !personId) return;

  const token = await inviteToSeat(roleId, personId);

  redirect(`/project/${projectId}?invited=${token}`);
}
