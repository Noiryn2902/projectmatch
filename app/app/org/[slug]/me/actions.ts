'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { addExtractedSkills, createMyProfile, getMyPersonId } from '@/lib/data/people';
import { extractSkillsSmart } from '@/lib/skills/ai-extract';
import { DocumentError, readDocument } from '@/lib/skills/read-document';

/**
 * Onboarding in one submit: create the caller's own person row, then read
 * whatever skills their résumé evidences into it.
 *
 * The résumé arrives either as an uploaded file or as pasted text; a file
 * wins when both are present, since choosing one is a deliberate act and the
 * textarea may just hold a half-finished draft. Either way it is read here,
 * on the server. Gemini does the reading when a key is configured —
 * constrained to the 82-skill vocabulary and re-checked against it on the way
 * back — and the deterministic matcher catches it when the model is
 * unavailable, so this works with the network unplugged.
 *
 * Skills land as `extracted`, which the engine trusts below an endorsed or
 * verified level, and the page says so.
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

  // Read the document *before* creating anything, so an unreadable file
  // sends them back to a form they can fix rather than leaving a half-made
  // profile behind.
  let resume = String(formData.get('resume') ?? '');
  const upload = formData.get('file');
  if (upload instanceof File && upload.size > 0) {
    try {
      resume = await readDocument(upload);
    } catch (err) {
      const message =
        err instanceof DocumentError ? err.message : 'That file could not be read.';
      redirect(`/app/org/${slug}/me?file_error=${encodeURIComponent(message)}`);
    }
  }

  const qualification = String(formData.get('qualification') ?? '').trim().slice(0, 200);
  const personId = await createMyProfile(orgId, { name, title, office, hoursPerWeek, qualification });

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
