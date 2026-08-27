'use server';

import { revalidatePath } from 'next/cache';

import { addPerson } from '@/lib/data/people';

export async function addPersonAction(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!orgId || !name) return;

  const title = String(formData.get('title') ?? '').trim();
  const hoursRaw = String(formData.get('hoursPerWeek') ?? '');
  const hoursPerWeek = hoursRaw ? Math.max(0, Math.min(40, Number(hoursRaw) || 0)) : undefined;

  await addPerson(orgId, { name, title, hoursPerWeek });

  // Re-render the roster page's Server Component with the new row, without a
  // full navigation — the point of a form action over a fetch call here.
  revalidatePath('/app/org/[slug]', 'page');
}
