'use server';

import { redirect } from 'next/navigation';

import { revokeInvitation } from '@/lib/data/invitations';

/**
 * Withdraws a pending invitation from the project page's management list and
 * reopens the seat. Redirects back to the project so a refresh does not
 * replay the action.
 */
export async function revokeInvitationAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  const roleId = String(formData.get('roleId') ?? '');
  if (!projectId || !roleId) return;

  await revokeInvitation(roleId);

  redirect(`/project/${projectId}?revoked=1`);
}
