'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { addExtractedSkills, createMyProfile, getMyPersonId } from '@/lib/data/people';
import { extractSkills } from '@/lib/skills/extract';

/**
 * Onboarding in one submit: create the caller's own person row, then read
 * whatever skills their pasted résumé mentions into it.
 *
 * The résumé is parsed here, on the server, from the raw text — the same
 * deterministic extractor the admin-side résumé box uses, so this needs no
 * API key and behaves identically with the network unplugged. Skills land as
 * `extracted`, which the engine already trusts below an endorsed or verified
 * level, and the page says so.
 */
export async function createMyProfileAction(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!orgId || !slug || !name) return;

  // Someone who already has a profile here should not get a second one.
  const existing = await getMyPersonId(orgId);
  if (existing) redirect(`/app/org/${slug}/people/${existing}`);

  const title = String(formData.get('title') ?? '').trim();
  const office = String(formData.get('office') ?? '').trim();
  const hoursRaw = String(formData.get('hoursPerWeek') ?? '');
  const hoursPerWeek = hoursRaw ? Math.max(0, Math.min(40, Number(hoursRaw) || 0)) : 0;
  const resume = String(formData.get('resume') ?? '');

  const personId = await createMyProfile(orgId, { name, title, office, hoursPerWeek });

  if (resume.trim()) {
    await addExtractedSkills(personId, extractSkills(resume));
  }

  revalidatePath('/app/org/[slug]', 'page');
  redirect(`/app/org/${slug}/people/${personId}?welcome=1`);
}
