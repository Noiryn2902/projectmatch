'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { addExtractedSkills, createMyProfile, getMyPersonId } from '@/lib/data/people';
import { extractSkillsSmart } from '@/lib/skills/ai-extract';

/**
 * Onboarding in one submit: create the caller's own person row, then read
 * whatever skills their pasted résumé evidences into it.
 *
 * The résumé is read here, on the server, from the raw text. Gemini does the
 * reading when a key is configured — constrained to the 82-skill vocabulary
 * and re-checked against it on the way back — and the deterministic matcher
 * catches it when the model is unavailable, so this works with the network
 * unplugged. Either way the skills land as `extracted`, which the engine
 * trusts below an endorsed or verified level, and the page says so.
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

  let added = 0;
  let source: 'ai' | 'fallback' = 'fallback';
  if (resume.trim()) {
    const read = await extractSkillsSmart(resume);
    source = read.source;
    added = await addExtractedSkills(personId, read.skills);
  }

  revalidatePath('/app/org/[slug]', 'page');
  redirect(`/app/org/${slug}/people/${personId}?welcome=1&read=${added}&by=${source}`);
}
