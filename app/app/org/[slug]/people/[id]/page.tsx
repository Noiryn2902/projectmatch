import Link from 'next/link';
import { notFound } from 'next/navigation';

import Avatar from '@/components/Avatar';
import { getMyRole, getOrgBySlug } from '@/lib/data/orgs';
import { getPerson } from '@/lib/data/people';
import { labelOf } from '@/lib/engine/graph';
import type { SkillProvenance } from '@/lib/types';

import { addResumeSkillsAction } from './actions';

const PROVENANCE: Record<SkillProvenance, { label: string; className: string }> = {
  verified: { label: 'verified', className: 'border-good/40 text-good' },
  endorsed: { label: 'endorsed', className: 'border-accent/40 text-accent' },
  extracted: { label: 'from résumé', className: 'border-line text-faint' },
  self: { label: 'self-reported', className: 'border-line text-faint' },
};

/**
 * One person on the roster — what the org knows about them, and where those
 * skill levels came from. The résumé box is the deterministic half of
 * Phase 3's skill import: it matches pasted text against the 82-skill
 * vocabulary and adds what it finds as `extracted`, which the engine already
 * trusts less than a verified level. An AI pass to sharpen the levels is the
 * other half, not built here.
 */
export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ added?: string; denied?: string }>;
}) {
  const { slug, id } = await params;
  const { added, denied } = await searchParams;

  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const person = await getPerson(id);
  if (!person || person.companyId !== org.id) notFound();

  const role = await getMyRole(org.id);
  const canEdit = role === 'owner' || role === 'admin';

  const skills = [...person.skills].sort((a, b) => b.level - a.level);

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
        <div className="flex items-center gap-4">
          <Avatar person={person} size={52} />
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">{person.name}</h1>
            <p className="text-[13px] text-muted">{person.title || 'No title yet'}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
          {person.office && <span>{person.office}</span>}
          <span>{person.hoursPerWeek} hrs/wk</span>
          <span>seniority {person.seniority}</span>
          <span>UTC{person.utcOffset >= 0 ? '+' : ''}{person.utcOffset}</span>
        </div>

        {added !== undefined && (
          <div className="mt-6 rounded-xl border border-line border-l-2 border-l-good bg-panel px-4 py-3 text-[13px] text-ink">
            {Number(added) === 0
              ? 'Nothing new — every skill the résumé mentioned was already on file.'
              : `Added ${added} skill${Number(added) === 1 ? '' : 's'} from the résumé.`}
          </div>
        )}
        {denied && (
          <div className="mt-6 rounded-xl border border-line border-l-2 border-l-warn bg-panel px-4 py-3 text-[13px] text-ink">
            Editing the roster is limited to organisation admins.
          </div>
        )}

        <h2 className="mt-8 font-display text-[15px] font-semibold text-ink">Skills</h2>
        {skills.length === 0 ? (
          <p className="mt-2 text-[13px] text-faint italic">
            None on file yet — this person will not appear in any ranking until they have some.
          </p>
        ) : (
          <ul className="mt-3 rounded-xl border border-line bg-panel">
            {skills.map((s) => {
              const tag = s.provenance ? PROVENANCE[s.provenance] : null;
              return (
                <li
                  key={s.skillId}
                  className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
                >
                  <span className="flex-1 text-[13px]">{labelOf(s.skillId)}</span>
                  {tag && (
                    <span className={`rounded-full border px-1.5 text-[10px] ${tag.className}`}>
                      {tag.label}
                    </span>
                  )}
                  <span className="w-16 text-right text-[12px] tabular-nums text-muted">
                    level {s.level}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {canEdit && (
          <section className="mt-8 rounded-xl border border-line bg-panel p-4">
            <h2 className="text-[13px] font-medium">Add skills from a résumé</h2>
            <p className="mt-1 text-[12px] text-muted">
              Paste the text. Recognised skills are added as{' '}
              <span className="text-faint">from résumé</span> — the engine weights them below an
              endorsed or verified level. Skills already on file are left untouched.
            </p>
            <form action={addResumeSkillsAction} className="mt-3">
              <input type="hidden" name="orgId" value={org.id} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="personId" value={person.id} />
              <textarea
                name="resume"
                required
                rows={7}
                placeholder="Paste résumé or bio text…"
                aria-label="Résumé text"
                className="w-full resize-y rounded-xl border border-line bg-canvas px-4 py-3 text-[12px] outline-none transition-colors focus:border-accent"
              />
              <button
                type="submit"
                className="mt-2 w-full rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-panel transition-opacity hover:opacity-90"
              >
                Read skills from text
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
