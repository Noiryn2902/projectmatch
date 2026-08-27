'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { getMyRole } from '@/lib/data/orgs';
import {
  addExtractedSkills,
  claimPerson,
  endorseSkill,
  getMyPersonId,
  removeEndorsement,
} from '@/lib/data/people';
import { extractSkillsSmart } from '@/lib/skills/ai-extract';
import { DocumentError, readDocument } from '@/lib/skills/read-document';

const REVALIDATE = '/app/org/[slug]/people/[id]';

/**
 * Reads skills out of an uploaded or pasted résumé and adds the new ones to
 * a person, as `extracted` provenance. A file wins over the textarea when
 * both are present. Everything happens on the server; nothing is trusted
 * from the client but the bytes and the raw paste.
 */
export async function addResumeSkillsAction(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const personId = String(formData.get('personId') ?? '');
  if (!orgId || !slug || !personId) return;

  const role = await getMyRole(orgId);
  if (role !== 'owner' && role !== 'admin') {
    redirect(`/app/org/${slug}/people/${personId}?denied=1`);
  }

  let resume = String(formData.get('resume') ?? '');
  const upload = formData.get('file');
  if (upload instanceof File && upload.size > 0) {
    try {
      resume = await readDocument(upload);
    } catch (err) {
      const message = err instanceof DocumentError ? err.message : 'That file could not be read.';
      redirect(
        `/app/org/${slug}/people/${personId}?file_error=${encodeURIComponent(message)}`,
      );
    }
  }

  if (!resume.trim()) return;

  const read = await extractSkillsSmart(resume);
  const added = await addExtractedSkills(personId, read.skills);

  revalidatePath(REVALIDATE, 'page');
  redirect(`/app/org/${slug}/people/${personId}?added=${added}&by=${read.source}`);
}

/** "That row is me." Enforced by claim_person() — see migration 0005. */
export async function claimAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '');
  const personId = String(formData.get('personId') ?? '');
  if (!slug || !personId) return;

  let error: string | null = null;
  try {
    await claimPerson(personId);
  } catch (err) {
    error = err instanceof Error ? err.message : 'Could not claim the profile.';
  }

  revalidatePath(REVALIDATE, 'page');
  redirect(
    error
      ? `/app/org/${slug}/people/${personId}?claim_error=${encodeURIComponent(error)}`
      : `/app/org/${slug}/people/${personId}?claimed=1`,
  );
}

/** Vouch for, or stop vouching for, one of a colleague's skill levels. */
export async function endorseAction(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const personId = String(formData.get('personId') ?? '');
  const personSkillId = String(formData.get('personSkillId') ?? '');
  const on = String(formData.get('on') ?? '') === 'yes';
  if (!orgId || !slug || !personId || !personSkillId) return;

  const me = await getMyPersonId(orgId);
  if (!me) redirect(`/app/org/${slug}/people/${personId}?need_profile=1`);

  if (on) await endorseSkill(personSkillId, me);
  else await removeEndorsement(personSkillId, me);

  revalidatePath(REVALIDATE, 'page');
  redirect(`/app/org/${slug}/people/${personId}`);
}
