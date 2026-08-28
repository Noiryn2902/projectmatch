'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { describeProject } from '@/lib/data/projects';

/** Saves the name and description, then opens the workspace. */
export async function describeProjectAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  if (!projectId) return;

  const name = String(formData.get('name') ?? '').trim();
  const brief = String(formData.get('brief') ?? '').trim();
  if (!name) redirect(`/project/${projectId}/name?empty=1`);

  await describeProject(projectId, name, brief);

  revalidatePath('/app');
  redirect(`/project/${projectId}`);
}
