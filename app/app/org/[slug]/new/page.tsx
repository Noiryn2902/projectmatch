import { notFound } from 'next/navigation';

import { getOrgBySlug } from '@/lib/data/orgs';

import { createProjectAction } from './actions';

const PLACEHOLDER =
  'What are you building, roughly how long, and anything that has to be true when it is done.';

/**
 * The write path, at last — a brief submitted here becomes a real project
 * row, not React state that dies on refresh. It uses the same deterministic
 * parser (fallbackBrief) the live builder falls back to when the AI is
 * unavailable, called directly server-side rather than round-tripping
 * through /api/ai from a Server Action calling its own API — this route
 * works with no GEMINI_API_KEY configured at all, same as the rest of the
 * product promises.
 */
export default async function NewProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-[11px] tracking-wide text-faint uppercase">{org.name}</p>
      <h1 className="mt-1 text-xl font-semibold text-ink">Describe the project</h1>
      <p className="mt-1 text-sm text-muted">
        Read into roles and skill requirements automatically. You can adjust the team once it
        exists.
      </p>

      <form action={createProjectAction} className="mt-6 space-y-3">
        <input type="hidden" name="orgId" value={org.id} />
        <textarea
          name="text"
          required
          minLength={8}
          rows={5}
          placeholder={PLACEHOLDER}
          aria-label="Project brief"
          className="w-full resize-none rounded-xl border border-line bg-panel px-4 py-3 text-[13px] outline-none transition-colors focus:border-accent"
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-panel transition-opacity hover:opacity-90"
        >
          Create project
        </button>
      </form>
    </main>
  );
}
