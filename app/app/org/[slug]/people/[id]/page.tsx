import AppShell from '@/components/app/AppShell';
import { notFound } from 'next/navigation';

import Avatar from '@/components/Avatar';
import { getMyRole, getOrgBySlug } from '@/lib/data/orgs';
import {
  getMyPersonId,
  getPerson,
  getPersonAccount,
  getPersonSkillDetail,
} from '@/lib/data/people';
import { labelOf } from '@/lib/engine/graph';
import { ACCEPTED } from '@/lib/skills/read-document';
import type { SkillProvenance } from '@/lib/types';

import { addResumeSkillsAction, claimAction, endorseAction } from './actions';

const PROVENANCE: Record<SkillProvenance, { label: string; className: string }> = {
  verified: { label: 'verified', className: 'border-good/40 text-good' },
  endorsed: { label: 'endorsed', className: 'border-accent/40 text-accent' },
  extracted: { label: 'from résumé', className: 'border-line text-faint' },
  self: { label: 'self-reported', className: 'border-line text-faint' },
};

/**
 * One person on the roster — what the org knows, and where the numbers came
 * from. Two Phase 3 pieces live here: claiming (attaching your account to a
 * roster row, via migration 0005) and endorsing (vouching for a colleague's
 * level, which the engine then trusts more than a self-report). The résumé
 * box is the deterministic skill extractor.
 */
export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{
    added?: string;
    denied?: string;
    claimed?: string;
    claim_error?: string;
    need_profile?: string;
    file_error?: string;
    welcome?: string;
    read?: string;
    by?: string;
  }>;
}) {
  const { slug, id } = await params;
  const sp = await searchParams;

  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const person = await getPerson(id);
  if (!person || person.companyId !== org.id) notFound();

  const [role, myPersonId, account] = await Promise.all([
    getMyRole(org.id),
    getMyPersonId(org.id),
    getPersonAccount(person.id),
  ]);
  const canEdit = role === 'owner' || role === 'admin';
  const isMe = myPersonId !== null && myPersonId === person.id;
  const canEndorse = myPersonId !== null && !isMe;
  const canClaim = !account.claimed && myPersonId === null;

  const skills = await getPersonSkillDetail(person.id, myPersonId);

  return (
    <AppShell back={{ href: `/app/org/${slug}`, label: org.name }}>
      <div>
        <div className="flex items-center gap-4">
          <Avatar person={person} size={52} />
          <div>
            <h1 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
              {person.name}
              {isMe && (
                <span className="rounded-full border border-accent/40 px-2 py-0 text-[11px] font-normal text-accent">
                  you
                </span>
              )}
            </h1>
            <p className="text-[13px] text-muted">{person.title || 'No title yet'}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
          {person.office && <span>{person.office}</span>}
          <span>{person.hoursPerWeek} hrs/wk</span>
          <span>seniority {person.seniority}</span>
          <span>
            UTC{person.utcOffset >= 0 ? '+' : ''}
            {person.utcOffset}
          </span>
        </div>

        {sp.welcome && (
          <Banner tone="good">
            <span className="font-medium">You are on the roster.</span>{' '}
            {Number(sp.read ?? 0) > 0 && (
              <>
                {sp.by === 'ai' ? 'Gemini read' : 'We matched'} {sp.read} skill
                {Number(sp.read) === 1 ? '' : 's'} out of your résumé
                {sp.by === 'ai' ? '' : ' (the AI was unavailable, so this was the direct match)'}.{' '}
              </>
            )}
            They are marked <span className="text-faint">from résumé</span> — a colleague endorsing
            one tells the engine to weight it higher. From here you can be matched to projects, and
            every seat reaches you as an invitation you can decline.
          </Banner>
        )}
        {sp.claimed && (
          <Banner tone="good">This profile is now yours. You can endorse colleagues from here.</Banner>
        )}
        {sp.claim_error && <Banner tone="warn">{sp.claim_error}</Banner>}
        {sp.need_profile && (
          <Banner tone="warn">
            Claim your own profile in this organisation before endorsing anyone else.
          </Banner>
        )}
        {sp.added !== undefined && (
          <Banner tone="good">
            {Number(sp.added) === 0
              ? 'Nothing new — every skill the résumé evidenced was already on file.'
              : `${sp.by === 'ai' ? 'Gemini read' : 'Matched'} ${sp.added} new skill${
                  Number(sp.added) === 1 ? '' : 's'
                } out of the résumé.`}
          </Banner>
        )}
        {sp.denied && <Banner tone="warn">Editing the roster is limited to organisation admins.</Banner>}
        {sp.file_error && <Banner tone="warn">{sp.file_error}</Banner>}

        {canClaim && (
          <form action={claimAction} className="mt-6">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="personId" value={person.id} />
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line border-l-2 border-l-accent bg-panel px-4 py-3.5">
              <p className="text-[13px] text-ink">
                Is this you? Claiming links your account to this roster entry.
              </p>
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-panel transition-opacity hover:opacity-90"
              >
                This is me
              </button>
            </div>
          </form>
        )}

        <h2 className="mt-8 font-display text-[15px] font-semibold text-ink">Skills</h2>
        {skills.length === 0 ? (
          <p className="mt-2 text-[13px] text-faint italic">
            None on file yet — this person will not appear in any ranking until they have some.
          </p>
        ) : (
          <ul className="mt-3 rounded-xl border border-line bg-panel">
            {skills.map((s) => {
              const tag = PROVENANCE[s.provenance];
              return (
                <li
                  key={s.personSkillId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-4 py-2.5 last:border-b-0"
                >
                  <span className="flex-1 text-[13px]">{labelOf(s.skillId)}</span>

                  {s.endorsementCount > 0 && (
                    <span className="text-[11px] text-faint">
                      {s.endorsementCount} endorsement{s.endorsementCount === 1 ? '' : 's'}
                    </span>
                  )}
                  <span className={`rounded-full border px-1.5 text-[10px] ${tag.className}`}>
                    {tag.label}
                  </span>
                  <span className="w-14 text-right text-[12px] tabular-nums text-muted">
                    level {s.level}
                  </span>

                  {canEndorse && (
                    <form action={endorseAction}>
                      <input type="hidden" name="orgId" value={org.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="personId" value={person.id} />
                      <input type="hidden" name="personSkillId" value={s.personSkillId} />
                      <input type="hidden" name="on" value={s.endorsedByMe ? 'no' : 'yes'} />
                      <button
                        type="submit"
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          s.endorsedByMe
                            ? 'border-accent/40 text-accent hover:border-accent'
                            : 'border-line text-muted hover:border-line-strong hover:text-ink'
                        }`}
                      >
                        {s.endorsedByMe ? 'Endorsed' : 'Endorse'}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {canEndorse && skills.length > 0 && (
          <p className="mt-2 text-[11px] text-faint">
            Endorsing tells the engine to trust that level more.
          </p>
        )}

        {canEdit && (
          <section className="mt-8 rounded-xl border border-line bg-panel p-4">
            <h2 className="text-[13px] font-medium">Add skills from a résumé</h2>
            <p className="mt-1 text-[12px] text-muted">
              Upload a PDF or Word file, or paste the text. Recognised skills are added as{' '}
              <span className="text-faint">from résumé</span> — the engine weights them below an
              endorsed or verified level. Skills already on file are left untouched.
            </p>
            <form action={addResumeSkillsAction} className="mt-3">
              <input type="hidden" name="orgId" value={org.id} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="personId" value={person.id} />
              <input
                name="file"
                type="file"
                accept={ACCEPTED}
                aria-label="Résumé file"
                className="mb-3 block w-full text-[11px] text-muted file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-[11px] file:font-medium file:text-panel hover:file:opacity-90"
              />
              <textarea
                name="resume"
                rows={6}
                placeholder="…or paste résumé / bio text here"
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
    </AppShell>
  );
}

function Banner({ tone, children }: { tone: 'good' | 'warn'; children: React.ReactNode }) {
  return (
    <div
      className={`mt-6 rounded-xl border border-line border-l-2 bg-panel px-4 py-3 text-[13px] text-ink ${
        tone === 'good' ? 'border-l-good' : 'border-l-warn'
      }`}
    >
      {children}
    </div>
  );
}
