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
  updatePersonDetails,
} from '@/lib/data/people';
import { AvatarError, setAvatar } from '@/lib/data/avatars';
import { extractSkillsSmart } from '@/lib/skills/ai-extract';
import { GitHubError, skillsFromGitHub } from '@/lib/skills/github';
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

/** Replaces a profile photo. Ownership is checked in setAvatar, under RLS. */
export async function setAvatarAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '');
  const personId = String(formData.get('personId') ?? '');
  const file = formData.get('photo');
  if (!slug || !personId || !(file instanceof File) || file.size === 0) return;

  let error: string | null = null;
  try {
    await setAvatar(personId, file);
  } catch (err) {
    error = err instanceof AvatarError ? err.message : 'Could not update the photo.';
  }

  revalidatePath(REVALIDATE, 'page');
  redirect(
    error
      ? `/app/org/${slug}/people/${personId}?file_error=${encodeURIComponent(error)}`
      : `/app/org/${slug}/people/${personId}?photo=1`,
  );
}

/**
 * Pulls skills off a public GitHub profile. The username is typed in by the
 * person, the API is public, and nothing needs an extra OAuth scope — see
 * lib/skills/github.ts for why this import is sanctioned where scraping is
 * not.
 */
export async function importGitHubAction(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const personId = String(formData.get('personId') ?? '');
  const handle = String(formData.get('handle') ?? '').trim();
  if (!orgId || !slug || !personId || !handle) return;

  const role = await getMyRole(orgId);
  const mine = await getMyPersonId(orgId);
  const allowed = role === 'owner' || role === 'admin' || mine === personId;
  if (!allowed) redirect(`/app/org/${slug}/people/${personId}?denied=1`);

  let added = 0;
  let error: string | null = null;
  try {
    const result = await skillsFromGitHub(handle);
    added = await addExtractedSkills(personId, result.skills, 'github');
  } catch (err) {
    error = err instanceof GitHubError ? err.message : 'Could not read that GitHub profile.';
  }

  revalidatePath(REVALIDATE, 'page');
  redirect(
    error
      ? `/app/org/${slug}/people/${personId}?file_error=${encodeURIComponent(error)}`
      : `/app/org/${slug}/people/${personId}?added=${added}&by=github`,
  );
}

/** Saves edited profile details. RLS decides whether the write is allowed. */
export async function updateDetailsAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '');
  const personId = String(formData.get('personId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!slug || !personId || !name) return;

  const hoursRaw = String(formData.get('hoursPerWeek') ?? '');
  let error: string | null = null;
  try {
    await updatePersonDetails(personId, {
      name,
      title: String(formData.get('title') ?? '').trim(),
      office: String(formData.get('office') ?? '').trim(),
      hoursPerWeek: hoursRaw ? Math.max(0, Math.min(40, Number(hoursRaw) || 0)) : 0,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : 'Could not save your changes.';
  }

  revalidatePath(REVALIDATE, 'page');
  redirect(
    error
      ? `/app/org/${slug}/people/${personId}?file_error=${encodeURIComponent(error)}`
      : `/app/org/${slug}/people/${personId}?saved=1`,
  );
}
