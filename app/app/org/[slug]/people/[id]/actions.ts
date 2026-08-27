'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { getMyRole } from '@/lib/data/orgs';
import { addExtractedSkills } from '@/lib/data/people';
import { extractSkills } from '@/lib/skills/extract';

/**
 * Reads skills out of a pasted résumé and adds the new ones to a person, as
 * `extracted` provenance. Deterministic — no API key — matching the promise
 * the rest of the product makes. The text is parsed here, on the server;
 * nothing about it is trusted from the client but the raw paste.
 */
export async function addResumeSkillsAction(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const personId = String(formData.get('personId') ?? '');
  const resume = String(formData.get('resume') ?? '');
  if (!orgId || !slug || !personId || !resume.trim()) return;

  const role = await getMyRole(orgId);
  if (role !== 'owner' && role !== 'admin') {
    redirect(`/app/org/${slug}/people/${personId}?denied=1`);
  }

  const added = await addExtractedSkills(personId, extractSkills(resume));

  revalidatePath('/app/org/[slug]/people/[id]', 'page');
  redirect(`/app/org/${slug}/people/${personId}?added=${added}`);
}
