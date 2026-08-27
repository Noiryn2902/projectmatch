'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { revokeInvitation } from '@/lib/data/invitations';
import { postMessage } from '@/lib/data/messages';
import { deleteProject, renameProject } from '@/lib/data/projects';

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

/**
 * Posts a chat message and re-renders the project page with it. No redirect —
 * the page is already where the conversation is, and revalidating the route
 * is enough to show the new row.
 */
export async function postMessageAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  const body = String(formData.get('body') ?? '');
  if (!projectId || !body.trim()) return;

  await postMessage(projectId, body);

  revalidatePath('/project/[id]', 'page');
}

/** Renames the project from the inline field in its header. */
export async function renameProjectAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!projectId || !name) return;

  await renameProject(projectId, name);
  revalidatePath('/project/[id]', 'page');
  redirect(`/project/${projectId}?renamed=1`);
}

/** Deletes the project. Everything under it cascades in the database. */
export async function deleteProjectAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  const orgSlug = String(formData.get('orgSlug') ?? '');
  if (!projectId) return;

  await deleteProject(projectId);
  revalidatePath('/app/org/[slug]', 'page');
  redirect(orgSlug ? `/app/org/${orgSlug}?deleted=1` : '/app');
}
