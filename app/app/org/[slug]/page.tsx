import { notFound } from 'next/navigation';

import Avatar from '@/components/Avatar';
import { getOrgBySlug } from '@/lib/data/orgs';
import { listPeople } from '@/lib/data/people';

import { addPersonAction } from './actions';

/**
 * The roster. Deliberately plain — a list and a one-row form — because the
 * point of this slice is proving the pipe works end to end (sign in, own an
 * org, grow its roster, have the database and RLS actually mean it) rather
 * than building the roster experience CSV import deserves. That is next.
 *
 * A 404 here does double duty: it is what a genuinely unknown slug produces,
 * and it is also what RLS silently returns for an org you are not a member
 * of — getOrgBySlug cannot tell those two apart, and it should not be able
 * to, because "that org does not exist" and "you cannot see that org" ought
 * to look identical to someone probing from the outside.
 */
export default async function OrgRosterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const people = await listPeople(org.id);

  return (
    <main className="pm-grain min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto max-w-[720px] px-5 py-3">
          <span className="font-display text-[17px] font-bold tracking-tight">{org.name}</span>
        </div>
      </header>

      <div className="mx-auto max-w-[720px] px-5 py-10">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-lg font-semibold text-ink">Roster</h1>
          <span className="text-[12px] text-muted">
            {people.length} {people.length === 1 ? 'person' : 'people'}
          </span>
        </div>

        <section className="mt-5 rounded-xl border border-line bg-panel">
          {people.length === 0 ? (
            <p className="p-4 text-[13px] text-faint italic">Nobody here yet.</p>
          ) : (
            <ul>
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  <Avatar person={p} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium">{p.name}</p>
                    <p className="truncate text-[12px] text-muted">{p.title || 'No title yet'}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-faint">{p.hoursPerWeek} hrs/wk</span>
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
            One at a time, for now. Importing a whole roster from a spreadsheet is next.
          </p>
        </section>
      </div>
    </main>
  );
}
