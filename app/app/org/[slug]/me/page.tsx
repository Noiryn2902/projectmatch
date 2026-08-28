import AppShell from '@/components/app/AppShell';
import { notFound, redirect } from 'next/navigation';

import { getOrgBySlug } from '@/lib/data/orgs';
import { getMyPersonId } from '@/lib/data/people';
import { ACCEPTED } from '@/lib/skills/read-document';
import { getCurrentUser } from '@/lib/supabase/server';

import { createMyProfileAction } from './actions';

const PLACEHOLDER = `Paste your résumé, LinkedIn summary, or a few lines about your work.

Six years building web apps with React and TypeScript. Node.js services on
PostgreSQL and Redis. Comfortable with Docker and CI. Some exposure to NLP.`;

/**
 * Onboarding: the step that turns an account into a person the engine can
 * actually see.
 *
 * Signing in proves who you are; it does not put you on a roster. Until this
 * row exists you cannot be staffed, cannot endorse a colleague, and appear in
 * no ranking. So this asks for the minimum — a name, how much time you have —
 * and offers the résumé shortcut for the part that would otherwise be forty
 * checkboxes.
 *
 * Nothing here is scraped. It is your own text, pasted by you, matched
 * against the same 82-skill vocabulary the rest of the product uses, and
 * anything unrecognised is dropped rather than guessed at.
 */
export default async function MyProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ file_error?: string }>;
}) {
  const { slug } = await params;
  const { file_error: fileError } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect(`/auth/sign-in?next=/app/org/${slug}/me`);

  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  // Already on this roster — nothing to onboard.
  const mine = await getMyPersonId(org.id);
  if (mine) redirect(`/app/org/${slug}/people/${mine}`);

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const suggested =
    ((meta.full_name ?? meta.name ?? meta.user_name) as string | undefined)?.trim() ||
    user.email?.split('@')[0] ||
    '';

  return (
    <AppShell back={{ href: `/app/org/${slug}`, label: org.name }}>
      <div>
        <h1 className="font-display text-2xl font-bold text-balance text-ink">
          Add yourself to {org.name}
        </h1>
        <p className="mt-2 text-[13px] text-muted">
          This is the profile teams get matched against. Without it you appear in no ranking.
        </p>

        {fileError && (
          <div className="mt-6 rounded-xl border border-line border-l-2 border-l-warn bg-panel px-4 py-3 text-[13px] text-ink">
            {fileError} Your details were not saved — fill them in again below.
          </div>
        )}

        <form action={createMyProfileAction} className="mt-7 space-y-4">
          <input type="hidden" name="orgId" value={org.id} />
          <input type="hidden" name="slug" value={slug} />

          <div>
            <label htmlFor="name" className="block text-[12px] text-muted">
              Your name
            </label>
            <input
              id="name"
              name="name"
              required
              defaultValue={suggested}
              autoComplete="name"
              className="mt-1.5 w-full rounded-full border border-line bg-panel px-4 py-2.5 text-[14px] outline-none transition-colors focus:border-accent"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <div>
              <label htmlFor="title" className="block text-[12px] text-muted">
                What you do
              </label>
              <input
                id="title"
                name="title"
                placeholder="Backend engineer"
                autoComplete="organization-title"
                className="mt-1.5 w-full rounded-full border border-line bg-panel px-4 py-2.5 text-[14px] outline-none transition-colors focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="hoursPerWeek" className="block text-[12px] text-muted">
                Hours a week
              </label>
              <input
                id="hoursPerWeek"
                name="hoursPerWeek"
                type="number"
                min={0}
                max={40}
                defaultValue={20}
                className="mt-1.5 w-full rounded-full border border-line bg-panel px-4 py-2.5 text-[14px] outline-none transition-colors focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="office" className="block text-[12px] text-muted">
              Where you work <span className="text-faint">(optional)</span>
            </label>
            <input
              id="office"
              name="office"
              placeholder="Bengaluru, or Remote"
              className="mt-1.5 w-full rounded-full border border-line bg-panel px-4 py-2.5 text-[14px] outline-none transition-colors focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="qualification" className="block text-[12px] text-muted">
              Qualification <span className="text-faint">(optional)</span>
            </label>
            <input
              id="qualification"
              name="qualification"
              maxLength={200}
              placeholder="B.Tech Computer Science, VIT, 2021"
              className="mt-1.5 w-full rounded-full border border-line bg-panel px-4 py-2.5 text-[14px] outline-none transition-colors focus:border-accent"
            />
          </div>

          <div className="rounded-xl border border-line border-l-2 border-l-accent bg-panel p-4">
            <p className="text-[13px] font-medium text-ink">Your skills, the fast way</p>
            <p className="mt-1 text-[12px] text-muted">
              Upload your résumé and Gemini reads the skills out of it, instead of asking you to
              tick eighty boxes. It can only answer with skills from our 82-skill vocabulary and
              every answer is checked against it again — nothing is invented.
            </p>

            <label
              htmlFor="file"
              className="mt-3 block cursor-pointer rounded-lg border border-dashed border-line-strong bg-canvas px-4 py-5 text-center transition-colors hover:border-accent"
            >
              <span className="block text-[13px] font-medium text-ink">
                Upload a PDF, Word file, or text file
              </span>
              <span className="mt-1 block text-[11px] text-faint">
                Bringing your LinkedIn? Open your profile, hit <em>More → Save to PDF</em>, and drop
                that here. It is your own export — we never scrape anyone&rsquo;s profile.
              </span>
              <input
                id="file"
                name="file"
                type="file"
                accept={ACCEPTED}
                className="mt-3 block w-full text-[11px] text-muted file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-[11px] file:font-medium file:text-panel hover:file:opacity-90"
              />
            </label>

            <div className="my-3 flex items-center gap-3 text-[11px] tracking-wide text-faint uppercase">
              <span className="h-px flex-1 bg-line" />
              or paste it
              <span className="h-px flex-1 bg-line" />
            </div>

            <label htmlFor="resume" className="sr-only">
              Résumé text
            </label>
            <textarea
              id="resume"
              name="resume"
              rows={6}
              placeholder={PLACEHOLDER}
              className="w-full resize-y rounded-lg border border-line bg-canvas px-3.5 py-3 text-[12px] outline-none transition-colors focus:border-accent"
            />
            <p className="mt-2 text-[11px] text-faint">
              These land as <span className="text-muted">from résumé</span>. The engine weights them
              below a level a colleague has endorsed or the organisation has verified — you can be
              endorsed later, and your score goes up when you are.
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-4 py-3 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            Create my profile
          </button>
          <p className="text-center text-[11px] text-faint">
            You will never be added to a team without being asked. Every seat goes out as an
            invitation you can accept or decline.
          </p>
        </form>
      </div>
    </AppShell>
  );
}
