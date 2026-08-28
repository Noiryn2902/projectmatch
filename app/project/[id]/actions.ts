'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { revokeInvitation } from '@/lib/data/invitations';
import { postAssistantMessage, postMessage } from '@/lib/data/messages';
import { assistantReply } from '@/lib/assistant';
import { deleteProject, describeProject, getProject } from '@/lib/data/projects';

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

  /*
   * Mentioning the assistant gets an answer from the engine, in the channel,
   * straight after your own message.
   *
   * Deliberately not a model call. "What are we still missing" has an exact
   * answer in TeamHealth — the same requirements the ranking scores against —
   * and handing that question to a language model swaps a correct answer for
   * a plausible one, in the one place a team will quote it back to each other.
   */
  if (/@assistant/i.test(body)) {
    const project = await getProject(projectId);
    if (project) {
      const open = project.roles.filter((r) => project.seats[r.id]?.state === 'open').length;
      await postAssistantMessage(
        projectId,
        assistantReply(body, {
          health: project.health,
          members: project.members,
          roles: project.roles,
          open,
        }),
      );
    }
  }

  revalidatePath('/project/[id]', 'page');
}

/**
 * Saves the name and the description from Setup. Both at once, because they
 * sit in one form and saving half of what someone typed is its own bug.
 */
export async function renameProjectAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const brief = String(formData.get('brief') ?? '').trim();
  if (!projectId || !name) return;

  await describeProject(projectId, name, brief);
  revalidatePath('/project/[id]', 'page');
  revalidatePath('/app');
  redirect(`/project/${projectId}?tab=setup&renamed=1`);
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
