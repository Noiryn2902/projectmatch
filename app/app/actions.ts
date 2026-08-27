'use server';

import { redirect } from 'next/navigation';

import { createOrg } from '@/lib/data/orgs';

export async function createOrgAction(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;

  const org = await createOrg(name);

  // Straight into building your own profile rather than an empty roster. An
  // owner with no person row of their own cannot be staffed, cannot endorse
  // anyone, and does not appear in a single ranking — so the first thing to
  // do after founding an org is to join it.
  redirect(`/app/org/${org.slug}/me`);
}
