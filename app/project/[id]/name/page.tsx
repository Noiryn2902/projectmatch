import Link from 'next/link';
import { notFound } from 'next/navigation';

import StepBar from '@/components/StepBar';

import { getProject } from '@/lib/data/projects';
import { hasDatabase } from '@/lib/env';

import { describeProjectAction } from './actions';

/**
 * Step four and a half: what is this called.
 *
 * Deliberately the smallest page in the product — two fields and a button,
 * nothing else on screen. It sits between asking people and the workspace
 * because that is the first moment a name is worth having: before the team
 * exists it is a brief, and after this it is a place with a door.
 */
export default async function NameProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ empty?: string }>;
}) {
  const { id } = await params;
  const { empty } = await searchParams;

  if (!hasDatabase) notFound();

  const project = await getProject(id);
  if (!project) notFound();

  // The auto-name is a slice of the brief, ending in an ellipsis. Offering it
  // back as a default would just get accepted, so the field starts empty and
  // the brief sits underneath as the reminder of what this is.
  return (
    <div className="pm-grain min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[900px] items-center justify-between gap-3 px-5 py-3">
          <Link href="/" className="font-display text-[15px] font-bold tracking-tight">
            Project<span className="text-accent">Match</span>
          </Link>
          <Link href="/app" className="text-[12px] text-faint transition-colors hover:text-ink">
            All projects
          </Link>
        </div>
        <div className="mx-auto max-w-[900px]">
          <StepBar
            step={5}
            back={{ href: `/project/${project.id}/invite`, label: 'Back to your team' }}
          />
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col justify-center px-6 py-16">
      <p className="text-[11px] tracking-wide text-faint uppercase">Almost there</p>
      <h1 className="mt-1 font-display text-2xl font-bold text-ink">Give it a name</h1>
      <p className="mt-2 text-[13px] text-muted">
        Your team will see this when they accept. You can change it later.
      </p>

      <form action={describeProjectAction} className="mt-6 space-y-3">
        <input type="hidden" name="projectId" value={project.id} />

        <input
          type="text"
          name="name"
          required
          autoFocus
          maxLength={120}
          placeholder="Onboarding revamp"
          aria-label="Project name"
          className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-[15px] outline-none transition-colors focus:border-accent"
        />

        <textarea
          name="brief"
          rows={4}
          maxLength={2000}
          defaultValue={project.brief.text}
          aria-label="What this project is"
          className="w-full resize-y rounded-xl border border-line bg-panel px-4 py-3 text-[13px] leading-relaxed outline-none transition-colors focus:border-accent"
        />

        {empty && <p className="text-[12px] text-warn">It needs a name to continue.</p>}

        <button
          type="submit"
          className="w-full rounded-xl bg-accent px-4 py-3 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          Open the workspace
        </button>
      </form>
      </main>
    </div>
  );
}
