import { redirect } from 'next/navigation';

import PhotoField from '@/components/PhotoField';
import { AVATAR_ACCEPTED } from '@/lib/data/avatars';
import { getMyOrg } from '@/lib/data/orgs';
import { getMyPersonId, getPerson } from '@/lib/data/people';
import { getCurrentUser } from '@/lib/supabase/server';

import OnboardingShell from '../Shell';
import { setupMeAction } from '../actions';

/**
 * Step three: your details, already filled in where the résumé said so.
 *
 * This used to come before the résumé, which meant typing a name and a job
 * title that the document on the next screen was about to state anyway. Now
 * the résumé goes first and this is the correction pass — every field is
 * pre-filled from what was read, and every field is editable, because a
 * suggestion you cannot overrule is just a mistake you have to live with.
 *
 * Two fields are never pre-filled on principle. Gender is not in the text and
 * is not derivable from a name, and an address is not a city — guessing
 * either would be inventing personal data about someone.
 */
export default async function OnboardingYouPage({
  searchParams,
}: {
  searchParams: Promise<{ empty?: string; photo_error?: string; read?: string; by?: string }>;
}) {
  const { empty, photo_error: photoError, read, by } = await searchParams;
  const readCount = Number(read ?? 0);

  const user = await getCurrentUser();
  if (!user) redirect('/auth/sign-in?next=/onboarding/you');

  const org = await getMyOrg();
  if (!org) redirect('/onboarding');

  // The résumé step creates the row, so by here there is one to read from.
  const personId = await getMyPersonId(org.id);
  if (!personId) redirect('/onboarding/skills');
  const me = await getPerson(personId);

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fromAccount =
    ((meta.full_name ?? meta.name ?? meta.user_name) as string | undefined)?.trim() ?? '';
  const ghAccount = (meta.user_name as string | undefined)?.trim() ?? '';

  const name = me?.name && me.name !== fromAccount ? me.name : (me?.name ?? fromAccount);
  const readSomething = Boolean(me?.contact.email || me?.contact.phone || me?.office);

  const photoSrc = me?.photo
    ? me.photo.startsWith('http')
      ? me.photo
      : '/media/people/' + me.photo
    : null;
  const initials = (me?.name ?? name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const field =
    'mt-1.5 w-full rounded-xl border border-line bg-panel px-4 py-2.5 text-[14px] outline-none transition-colors focus:border-accent';
  const label = 'block text-[12px] text-muted';

  return (
    <OnboardingShell
      step={2}
      wide
      title="Your details"
      hint={
        readSomething
          ? 'Read off your résumé. Change anything that is wrong.'
          : 'Only the name is required.'
      }
    >
      {/*
        Two things you attach on the left, everything you type on the right.
        A file input sitting in the middle of a run of text fields reads as
        another text field until you land on it, and the résumé in particular
        was invisible where it used to be — on a step that skips itself for
        anyone who already has a profile.

        Under 640px the whole thing stacks: the attachments first, because
        they are the ones that fill in the fields below them.
      */}
      {/* Reading a résumé and then saying nothing about it looks like nothing
          happened — and the fields it filled in below are easy to mistake for
          defaults. This says where they came from. */}
      {readCount > 0 && (
        <p className="mt-4 rounded-xl border border-line border-l-2 border-l-good bg-panel px-4 py-3 text-[13px] text-ink">
          {by === 'ai' ? 'Gemini read' : 'We matched'} {readCount} skill
          {readCount === 1 ? '' : 's'} out of your résumé.
        </p>
      )}

      <form action={setupMeAction} className="mt-6">
        <div className="grid gap-6 sm:grid-cols-[190px_1fr]">
          <div>
            <label htmlFor="photo" className={label}>
              Photograph
            </label>
            <div className="mt-2">
              <PhotoField
                accept={AVATAR_ACCEPTED}
                current={photoSrc}
                initials={initials}
                hue={me?.hue ?? 0}
              />
            </div>
            {photoError && <p className="mt-1.5 text-[12px] text-warn">{photoError}</p>}
          </div>

          <div>
            <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className={label}>
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  autoFocus
                  defaultValue={name}
                  autoComplete="name"
                  className={field}
                />
              </div>

              <div>
                <label htmlFor="title" className={label}>
                  What you do
                </label>
                <input
                  id="title"
                  name="title"
                  defaultValue={me?.title ?? ''}
                  placeholder="Backend engineer"
                  autoComplete="organization-title"
                  className={field}
                />
              </div>

              <div>
                <label htmlFor="email" className={label}>
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={me?.contact.email ?? user.email ?? ''}
                  autoComplete="email"
                  className={field}
                />
              </div>

              <div>
                <label htmlFor="phone" className={label}>
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={me?.contact.phone ?? ''}
                  placeholder="+91 555 0142"
                  autoComplete="tel"
                  className={field}
                />
              </div>

              <div>
                <label htmlFor="office" className={label}>
                  Where you work
                </label>
                <input
                  id="office"
                  name="office"
                  defaultValue={me?.office ?? ''}
                  placeholder="Bengaluru, or Remote"
                  className={field}
                />
              </div>

              <div>
                <label htmlFor="qualification" className={label}>
                  Qualification
                </label>
                <input
                  id="qualification"
                  name="qualification"
                  maxLength={200}
                  defaultValue={me?.qualification ?? ''}
                  placeholder="B.Tech Computer Science, VIT, 2021"
                  className={field}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 text-[11px] tracking-wide text-faint uppercase">
              <span className="h-px flex-1 bg-line" />
              optional
              <span className="h-px flex-1 bg-line" />
            </div>

            <div className="mt-4 grid gap-x-4 gap-y-4 sm:grid-cols-2">
              <div>
                <label htmlFor="gender" className={label}>
                  Gender
                </label>
                <input
                  id="gender"
                  name="gender"
                  maxLength={60}
                  defaultValue={me?.gender ?? ''}
                  placeholder="However you describe it"
                  className={field}
                />
              </div>

              <div>
                <label htmlFor="address" className={label}>
                  Address
                </label>
                <input
                  id="address"
                  name="address"
                  maxLength={300}
                  defaultValue={me?.address ?? ''}
                  autoComplete="street-address"
                  className={field}
                />
              </div>

              <div>
                <label htmlFor="linkedin" className={label}>
                  LinkedIn
                </label>
                <input
                  id="linkedin"
                  name="linkedin"
                  type="url"
                  defaultValue={me?.contact.linkedin ?? ''}
                  placeholder="https://linkedin.com/in/you"
                  className={field}
                />
              </div>

              <div>
                <label htmlFor="github" className={label}>
                  GitHub
                </label>
                <input
                  id="github"
                  name="github"
                  defaultValue={me?.contact.github ?? ghAccount}
                  placeholder="username"
                  className={field}
                />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-5 text-[11px] text-faint">
          Gender is shown on your profile and read by nothing. Your address is shown only to you
          and an admin.
        </p>

        {empty && <p className="mt-3 text-[12px] text-warn">A name, at least.</p>}

        <button
          type="submit"
          className="mt-5 w-full rounded-xl bg-accent px-4 py-3 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          Next
        </button>
      </form>
    </OnboardingShell>
  );
}
