'use server';

import { redirect } from 'next/navigation';

import { respondToInvitation } from '@/lib/data/invitations';

export async function respondAction(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const accept = String(formData.get('accept') ?? '') === 'yes';
  if (!token) return;

  const outcome = await respondToInvitation(token, accept);

  // Redirect rather than render in place, so a refresh does not re-submit the
  // answer — and so the outcome survives being shared or bookmarked.
  redirect(`/invite/${token}?outcome=${outcome}`);
}
