import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getMyRole, getOrgBySlug } from '@/lib/data/orgs';
import { listPeople } from '@/lib/data/people';

import ImportForm from './ImportForm';

/**
 * Roster import — the answer to cold start. A marketplace with eight
 * strangers is worthless; an org that pastes one spreadsheet has its whole
 * company on day one.
 *
 * Admin-only, and gated here rather than only at the insert: a member who is
 * not an admin can add themselves and no one else (that is the
 * `people_insert` policy), so there is nothing for them to do on this page.
 * They are sent back to the roster instead of shown a form the database
 * would reject.
 */
export default async function ImportRosterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const role = await getMyRole(org.id);
  if (role !== 'owner' && role !== 'admin') redirect(`/app/org/${slug}`);

  const people = await listPeople(org.id);
  const existingNames = people.map((p) => p.name);

  return (
    <main className="pm-grain min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-5 py-3">
          <Link href={`/app/org/${slug}`} className="text-[13px] text-muted hover:text-ink">
            &larr; {org.name}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[720px] px-5 py-10">
        <p className="text-[11px] tracking-wide text-faint uppercase">Roster</p>
        <h1 className="mt-1 font-display text-lg font-semibold text-ink">Import from a spreadsheet</h1>
        <p className="mt-2 text-[12px] text-muted">
          Paste rows from Excel, Google Sheets, or a CSV export. Keep the header row — a{' '}
          <code className="text-accent">name</code> column is all that is required. Recognised
          alongside it: title, email, department, office, hours, seniority, and{' '}
          <code className="text-accent">skills</code> (one quoted cell like{' '}
          <span className="text-faint">&ldquo;react:4, postgres:3&rdquo;</span>, matched against the
          82-skill vocabulary).
        </p>

        <ImportForm orgId={org.id} slug={slug} existingNames={existingNames} />
      </div>
    </main>
  );
}
