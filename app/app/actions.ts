'use server';

import { redirect } from 'next/navigation';

import { createOrg } from '@/lib/data/orgs';

export async function createOrgAction(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;

  const org = await createOrg(name);
  redirect('/app/org/' + org.slug);
}
