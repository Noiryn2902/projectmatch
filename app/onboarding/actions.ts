'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { AvatarError, clearAvatar, setAvatar } from '@/lib/data/avatars';
import { createOrg, getMyOrg } from '@/lib/data/orgs';
import {
  addExtractedSkills,
  createMyProfile,
  getMyPersonId,
  getPerson,
  setAvailability,
  updatePersonDetails,
} from '@/lib/data/people';
import { extractSkillsSmart } from '@/lib/skills/ai-extract';
import { extractContact } from '@/lib/skills/contact';
import { skillsFromGitHub } from '@/lib/skills/github';
import { DocumentError, readDocument } from '@/lib/skills/read-document';
import { getCurrentUser } from '@/lib/supabase/server';

/**
 * Setup, one step at a time: organisation, résumé, details, availability.
 *
 * This used to be a single submit that founded an organisation, created a
 * person, read a résumé and extracted skills — so a bad PDF threw away the
 * name and hours someone had just typed. Splitting it means each step is
 * saved when you finish it, and the steps that can fail are the ones you are
 * allowed to skip.
 */

/** Step one: the organisation. */
export async function setupOrgAction(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/onboarding?empty=1');

  await createOrg(name);
  revalidatePath('/app');
  redirect('/onboarding/skills');
}

/**
 * Step two: the résumé, which is also where the person row is created.
 *
 * Reading has to come before the details form, because filling that form in
 * is the point of reading. So this makes the row from whatever the document
 * stated — name, email, phone, city — and the next screen shows all of it
 * back, editable. Nothing here is final: it is a first draft of a profile
 * that its owner immediately gets to correct.
 */
export async function setupSkillsAction(formData: FormData) {
  const org = await getMyOrg();
  if (!org) redirect('/onboarding');

  if (await getMyPersonId(org.id)) redirect('/onboarding/you');

  let resume = String(formData.get('resume') ?? '');
  const upload = formData.get('file');
  if (upload instanceof File && upload.size > 0) {
    try {
      resume = await readDocument(upload);
    } catch (err) {
      const message = err instanceof DocumentError ? err.message : 'That file could not be read.';
      redirect('/onboarding/skills?file_error=' + encodeURIComponent(message));
    }
  }

  // Nothing to read — go and type it.
  if (!resume.trim()) redirect('/onboarding/you?skipped=1');

  const found = extractContact(resume);

  // A name is required by the schema and by every list that renders one, so
  // fall back through what is actually known rather than writing an empty
  // string and calling it a profile.
  const user = await getCurrentUser();
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const fromAccount = (meta.full_name ?? meta.name ?? meta.user_name) as string | undefined;
  const name = found.name ?? fromAccount?.trim() ?? user?.email?.split('@')[0] ?? 'Unnamed';

  const personId = await createMyProfile(org.id, {
    name,
    office: found.location ?? '',
  });

  /*
   * Everything else the document stated, in as a plain update:
   * createMyProfile deliberately knows nothing about résumés.
   *
   * Seniority matters more here than it looks. It is not decoration — the
   * engine filters on it, sorts on it, uses it to decide who could mentor
   * whom, and averages it into team health. Leaving every new profile at the
   * schema default of 1 quietly told the engine that a nine-year principal
   * engineer was a graduate.
   */
  await updatePersonDetails(personId, {
    name,
    title: found.title ?? '',
    office: found.location ?? '',
    hoursPerWeek: 0,
    qualification: found.qualification ?? '',
    ...(found.email ? { email: found.email } : {}),
    ...(found.phone ? { phone: found.phone } : {}),
    ...(found.yearsExp !== undefined ? { yearsExp: found.yearsExp } : {}),
    ...(found.seniority !== undefined ? { seniority: found.seniority } : {}),
  });

  const read = await extractSkillsSmart(resume);
  const added = await addExtractedSkills(personId, read.skills);

  revalidatePath('/app');
  redirect('/onboarding/you?read=' + added + '&by=' + read.source);
}

/**
 * Step three: the details, as corrected.
 *
 * Every field on that form is written, including the ones left blank —
 * clearing something the résumé got wrong is a legitimate edit, and a save
 * that silently kept the old value would make it impossible.
 */
export async function setupMeAction(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/onboarding/you?empty=1');

  const org = await getMyOrg();
  if (!org) redirect('/onboarding');

  const str = (key: string) => String(formData.get(key) ?? '').trim();

  // Skipped the résumé, so there is no row yet.
  let personId = await getMyPersonId(org.id);
  if (!personId) personId = await createMyProfile(org.id, { name });

  // yearsExp and seniority are deliberately absent: this form does not show
  // them, and updatePersonDetails only writes the keys it is given, so what
  // the résumé worked out survives this save.
  await updatePersonDetails(personId, {
    name,
    title: str('title'),
    office: str('office'),
    hoursPerWeek: 0,
    qualification: str('qualification').slice(0, 200),
    email: str('email'),
    phone: str('phone'),
    address: str('address'),
    gender: str('gender'),
    linkedin: str('linkedin'),
    github: str('github'),
  });

  // The photo goes last, so a rejected image costs nobody the details they
  // just corrected: everything above is saved by this point, and the next
  // step is reachable either way.
  const photo = formData.get('photo');
  if (photo instanceof File && photo.size > 0) {
    try {
      await setAvatar(personId, photo);
    } catch (err) {
      const message =
        err instanceof AvatarError ? err.message : 'That image could not be uploaded.';
      redirect('/onboarding/availability?photo_error=' + encodeURIComponent(message));
    }
  } else if (String(formData.get('removePhoto') ?? '') === '1') {
    // The cross was clicked and nothing new was chosen. Removal happens on
    // submit, not on click, so it is undoable right up to this point.
    await clearAvatar(personId);
  }

  revalidatePath('/app');
  redirect('/onboarding/availability');
}

/**
 * Step four, and the end of it. Hours and timezone — plus GitHub, if a handle
 * survived the details step and the box is ticked — then out to the profile
 * all of this built.
 */
export async function setupAvailabilityAction(formData: FormData) {
  const org = await getMyOrg();
  if (!org) redirect('/onboarding');

  const personId = await getMyPersonId(org.id);
  if (!personId) redirect('/onboarding/you');

  await setAvailability(personId, {
    hoursPerWeek: Number(formData.get('hoursPerWeek') ?? 0) || 0,
    utcOffset: Number(formData.get('utcOffset') ?? 0) || 0,
  });

  /*
   * GitHub is opt in twice over: a handle typed on the details step, and this
   * box ticked here. Public API only — and a failure (a bad handle, GitHub
   * down, a rate limit) must not strand someone on the last screen of setup,
   * which is why it is caught and dropped rather than surfaced.
   */
  if (String(formData.get('useGitHub') ?? '') === '1') {
    const me = await getPerson(personId);
    const handle = me?.contact.github?.trim();
    if (handle) {
      try {
        const gh = await skillsFromGitHub(handle);
        await addExtractedSkills(personId, gh.skills);
      } catch {
        // The optional half of an optional step. Silence is the right answer.
      }
    }
  }

  revalidatePath('/app');
  redirect('/app/org/' + org.slug + '/people/' + personId + '?welcome=1');
}
