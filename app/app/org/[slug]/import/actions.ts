'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { getMyRole } from '@/lib/data/orgs';
import { importPeople, listPeople } from '@/lib/data/people';
import { normaliseRoster } from '@/lib/import/roster';

/**
 * Commits a pasted roster. The text is re-parsed here from scratch: the
 * preview the browser drew is a convenience, not an input to trust, so only
 * the raw paste crosses back and the server decides again which rows are
 * importable.
 */
export async function commitImportAction(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const text = String(formData.get('text') ?? '');
  if (!orgId || !slug || !text.trim()) return;

  const role = await getMyRole(orgId);
  if (role !== 'owner' && role !== 'admin') {
    // The database would refuse the insert anyway; saying so here is just the
    // civil version of the same answer.
    redirect(`/app/org/${slug}?import_denied=1`);
  }

  const existing = await listPeople(orgId);
  const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));

  const { rows } = normaliseRoster(text, existingNames);
  const toInsert = rows
    .filter((r) => r.status === 'ok')
    .map((r) => ({
      name: r.name,
      title: r.title,
      email: r.email,
      department: r.department,
      office: r.office,
      hoursPerWeek: r.hoursPerWeek,
      seniority: r.seniority,
    }));

  const added = await importPeople(orgId, toInsert);

  revalidatePath('/app/org/[slug]', 'page');
  redirect(`/app/org/${slug}?imported=${added}`);
}
