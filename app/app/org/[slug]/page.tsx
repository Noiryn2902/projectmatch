import Link from 'next/link';
import { notFound } from 'next/navigation';

import AppShell from '@/components/app/AppShell';
import Avatar from '@/components/Avatar';
import { getMyWork } from '@/lib/data/me';
import { getOrgBySlug } from '@/lib/data/orgs';
import { getMyPersonId, listPeople } from '@/lib/data/people';
import { listProjects } from '@/lib/data/projects';

import { addPersonAction } from './actions';

/**
 * The org: its projects, and the roster they get staffed from.
 *
 * A 404 here does double duty: it is what a genuinely unknown slug produces,
 * and it is also what RLS silently returns for an org you are not a member
 * of — getOrgBySlug cannot tell those two apart, and it should not be able
 * to, because "that org does not exist" and "you cannot see that org" ought
 * to look identical to someone probing from the outside.
 */
export default async function OrgRosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ imported?: string; import_denied?: string }>;
}) {
  const { slug } = await params;
  const { imported, import_denied: importDenied } = await searchParams;

  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const [people, projects, myPersonId, work] = await Promise.all([
    listPeople(org.id),
    listProjects(org.id),
    getMyPersonId(org.id),
    getMyWork(org.id),
  ]);
  const importedCount = imported ? Number(imported) : 0;

  return (
    <AppShell
      org={org}
      notifications={work.invitations.length}
      tabs={[
        { href: '/app', label: 'Home' },
        { href: `/app/org/${org.slug}`, label: 'Organisation' },
      ]}
      active={`/app/org/${org.slug}`}
      action={
        <Link
          href={`/app/org/${org.slug}/new`}
          className="rounded-full bg-accent px-3 py-1.5 text-[12px] font-semibold text-canvas hover:opacity-90"
        >
          New project
        </Link>
      }
    >
      <div>
        {!myPersonId && (
          <Link
            href={`/app/org/${org.slug}/me`}
            className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-line border-l-2 border-l-accent bg-panel px-4 py-3.5 transition-colors hover:border-accent"
          >
            <span>
              <span className="block text-[13px] font-medium text-ink">
                You are not on this roster yet
              </span>
              <span className="mt-0.5 block text-[12px] text-muted">
                Add yourself so teams can find you.
              </span>
            </span>
            <span className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-panel">
              Add me
            </span>
          </Link>
        )}

        <h1 className="font-display text-lg font-semibold text-ink">Projects</h1>

        <section className="mt-5 rounded-xl border border-line bg-panel">
          {projects.length === 0 ? (
            <p className="p-4 text-[13px] text-faint italic">No projects yet.</p>
          ) : (
            <ul>
              {projects.map((proj) => (
                <li key={proj.id} className="border-b border-line last:border-b-0">
                  <Link
                    href={`/project/${proj.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-panel-2"
                  >
                    <span className="min-w-0 truncate text-[13px] font-medium">
                      {proj.name || 'Untitled project'}
                    </span>
                    <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted uppercase">
                      {proj.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-10 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Roster</h2>
          <div className="flex items-baseline gap-3">
            <span className="text-[12px] text-muted">
              {people.length} {people.length === 1 ? 'person' : 'people'}
            </span>
            <Link
              href={`/app/org/${org.slug}/import`}
              className="text-[12px] text-accent underline underline-offset-2"
            >
              Import
            </Link>
          </div>
        </div>

        {importedCount > 0 && (
          <div className="mt-4 rounded-xl border border-line border-l-2 border-l-good bg-panel px-4 py-3 text-[13px] text-ink">
            Imported {importedCount} {importedCount === 1 ? 'person' : 'people'} into the roster.
          </div>
        )}
        {importDenied && (
          <div className="mt-4 rounded-xl border border-line border-l-2 border-l-warn bg-panel px-4 py-3 text-[13px] text-ink">
            Importing a roster is limited to organisation admins.
          </div>
        )}

        <section className="mt-5 rounded-xl border border-line bg-panel">
          {people.length === 0 ? (
            <p className="p-4 text-[13px] text-faint italic">Nobody here yet.</p>
          ) : (
            <ul>
              {people.map((p) => (
                <li key={p.id} className="border-b border-line last:border-b-0">
                  <Link
                    href={`/app/org/${org.slug}/people/${p.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-panel-2"
                  >
                    <Avatar person={p} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium">{p.name}</p>
                      <p className="truncate text-[12px] text-muted">
                        {p.title || 'No title yet'}
                        {p.office && <span className="text-faint"> &middot; {p.office}</span>}
                      </p>
                    </div>
                    {/* A roster is only a contact list if you can reach people. */}
                    {p.contact.email && (
                      <span className="hidden shrink-0 truncate text-[11px] text-faint sm:block sm:max-w-[190px]">
                        {p.contact.email}
                      </span>
                    )}
                    <span className="shrink-0 text-[11px] text-faint">{p.hoursPerWeek} hrs/wk</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-4 rounded-xl border border-line bg-panel p-4">
          <h2 className="text-[13px] font-medium">Add someone</h2>
          <form action={addPersonAction} className="mt-3 space-y-2.5">
            <input type="hidden" name="orgId" value={org.id} />
            <input
              type="text"
              name="name"
              required
              placeholder="Name"
              aria-label="Name"
              className="w-full rounded-full border border-line bg-canvas px-4 py-2 text-[13px] outline-none transition-colors focus:border-accent"
            />
            <div className="flex gap-2.5">
              <input
                type="text"
                name="title"
                placeholder="Title"
                aria-label="Title"
                className="min-w-0 flex-1 rounded-full border border-line bg-canvas px-4 py-2 text-[13px] outline-none transition-colors focus:border-accent"
              />
              <input
                type="number"
                name="hoursPerWeek"
                min={0}
                max={40}
                placeholder="Hrs/wk"
                aria-label="Hours per week"
                className="w-24 rounded-full border border-line bg-canvas px-4 py-2 text-[13px] outline-none transition-colors focus:border-accent"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-panel transition-opacity hover:opacity-90"
            >
              Add to roster
            </button>
          </form>
          <p className="mt-3 text-[11px] text-faint">
            Or{' '}
            <Link
              href={`/app/org/${org.slug}/import`}
              className="text-accent underline underline-offset-2"
            >
              import a whole roster
            </Link>{' '}
            from a spreadsheet.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
