'use server';

import { redirect } from 'next/navigation';

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
