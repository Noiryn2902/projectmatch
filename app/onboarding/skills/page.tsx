import { redirect } from 'next/navigation';

import { getMyOrg } from '@/lib/data/orgs';
import { getMyPersonId } from '@/lib/data/people';
import { ACCEPTED } from '@/lib/skills/read-document';
import { getCurrentUser } from '@/lib/supabase/server';

import OnboardingShell from '../Shell';
import { setupSkillsAction } from '../actions';

/**
 * Step two: the résumé, and it goes first among the personal steps on
 * purpose.
 *
 * It is the one screen that can fill in the next one. Asking for a name, a
 * job title, an email and a phone number before reading the document that
 * states all four is asking someone to do a machine's work — so this runs
 * first, and the details step becomes a correction pass rather than a form.
 *
 * Skippable, and skipping costs nothing: everything it would have filled in
 * is on the next screen anyway, empty and typeable.
 */
export default async function OnboardingSkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ file_error?: string }>;
}) {
  const { file_error: fileError } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect('/auth/sign-in?next=/onboarding/skills');

  const org = await getMyOrg();
  if (!org) redirect('/onboarding');

  // Already been through it — the details step is where they belong.
  if (await getMyPersonId(org.id)) redirect('/onboarding/you');

  return (
    <OnboardingShell
      step={1}
      title="Start with your résumé"
      hint="We read your skills out of it, and fill in the next step for you."
      skip={{ href: '/onboarding/you?skipped=1', label: 'Skip' }}
    >
      {fileError && (
        <p className="mt-4 rounded-xl border border-line border-l-2 border-l-warn bg-panel px-4 py-3 text-[13px] text-ink">
          {fileError}
        </p>
      )}

      <form action={setupSkillsAction} className="mt-6 space-y-3">
        <label
          htmlFor="file"
          className="block cursor-pointer rounded-xl border border-dashed border-line-strong bg-panel px-4 py-6 text-center transition-colors hover:border-accent"
        >
          <span className="block text-[13px] font-medium text-ink">PDF, Word, or text</span>
          <span className="mt-1 block text-[11px] text-faint">
            LinkedIn: More → Save to PDF, then drop it here.
          </span>
          <input
            id="file"
            name="file"
            type="file"
            accept={ACCEPTED}
            className="mt-3 block w-full text-[11px] text-muted file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-[11px] file:font-medium file:text-panel hover:file:opacity-90"
          />
        </label>

        <details className="group">
          <summary className="cursor-pointer list-none text-[12px] text-muted transition-colors hover:text-ink">
            or paste it instead
          </summary>
          <label htmlFor="resume" className="sr-only">
            Résumé text
          </label>
          <textarea
            id="resume"
            name="resume"
            rows={6}
            placeholder="Six years building web apps with React and TypeScript. Node services on Postgres and Redis…"
            className="mt-2 w-full resize-y rounded-xl border border-line bg-panel px-3.5 py-3 text-[12px] outline-none transition-colors focus:border-accent"
          />
        </details>

        <button
          type="submit"
          className="w-full rounded-xl bg-accent px-4 py-3 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          Read it
        </button>

        {/* The one claim worth making here, because it is the one people
            reasonably worry about. */}
        <p className="text-center text-[11px] text-faint">
          Your own file, read on our server. Nothing is scraped, skills we don&rsquo;t recognise
          are dropped rather than guessed at, and every detail it finds is yours to correct on the
          next screen.
        </p>
      </form>
    </OnboardingShell>
  );
}
