'use client';

import { useMemo, useState } from 'react';

import { normaliseRoster, type RowStatus } from '@/lib/import/roster';

import { commitImportAction } from './actions';

const SAMPLE = `name,title,department,office,hours,seniority,email
Rhea Menon,Staff Backend Engineer,Platform,Bengaluru,32,5,rhea@example.com
Daniel Okafor,Product Designer,Design,Remote,24,3,daniel@example.com
Ana Costa,Data Scientist,Insights,Lisbon,40,4,ana@example.com
Wei Zhang,Frontend Engineer,Web,Singapore,30,2,wei@example.com`;

const ROW_TINT: Record<RowStatus, string> = {
  ok: '',
  'dup-file': 'text-faint line-through decoration-line',
  'dup-roster': 'text-faint line-through decoration-line',
  invalid: 'text-warn',
};

const PREVIEW_LIMIT = 60;

export default function ImportForm({
  orgId,
  slug,
  existingNames,
}: {
  orgId: string;
  slug: string;
  existingNames: string[];
}) {
  const [text, setText] = useState('');

  const existingSet = useMemo(
    () => new Set(existingNames.map((n) => n.toLowerCase())),
    [existingNames],
  );
  const roster = useMemo(() => normaliseRoster(text, existingSet), [text, existingSet]);

  const hasInput = text.trim().length > 0;
  const unreadable = hasInput && roster.rows.length === 0;
  const { ok, dupRoster, dupFile, invalid } = roster.counts;

  return (
    <form action={commitImportAction} className="mt-6">
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="slug" value={slug} />

      <textarea
        name="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="name,title,hours&#10;Priya Nair,Backend Engineer,32&#10;…"
        aria-label="Roster rows"
        className="w-full resize-y rounded-xl border border-line bg-panel px-4 py-3 font-mono text-[12px] outline-none transition-colors focus:border-accent"
      />

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setText(SAMPLE)}
          className="text-[11px] text-accent underline underline-offset-2"
        >
          Load a sample
        </button>
        {text && (
          <button
            type="button"
            onClick={() => setText('')}
            className="text-[11px] text-faint underline underline-offset-2 hover:text-muted"
          >
            Clear
          </button>
        )}
      </div>

      {unreadable && (
        <p className="mt-4 text-[12px] text-warn">
          Couldn&rsquo;t find a header row and at least one row of people under it.
        </p>
      )}

      {roster.rows.length > 0 && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-1.5 text-[11px]">
            {roster.recognised.map((c) => (
              <span key={c} className="rounded-full border border-line px-2 py-0.5 text-muted">
                {c}
              </span>
            ))}
            {roster.ignored.length > 0 && (
              <span className="text-faint">ignored: {roster.ignored.join(', ')}</span>
            )}
          </div>

          <p className="mt-3 text-[12px] text-muted">
            <span className="font-medium text-ink">{ok}</span> to import
            {dupRoster > 0 && <> · {dupRoster} already on the roster</>}
            {dupFile > 0 && <> · {dupFile} repeated in the paste</>}
            {invalid > 0 && <> · {invalid} with no name</>}
          </p>

          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-panel text-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">Dept</th>
                  <th className="px-3 py-2 font-medium">Hrs</th>
                  <th className="px-3 py-2 font-medium">Lvl</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {roster.rows.slice(0, PREVIEW_LIMIT).map((r, i) => (
                  <tr key={i} className={`border-t border-line ${ROW_TINT[r.status]}`}>
                    <td className="px-3 py-1.5">{r.name || <span className="text-warn">—</span>}</td>
                    <td className="px-3 py-1.5">{r.title}</td>
                    <td className="px-3 py-1.5">{r.department}</td>
                    <td className="px-3 py-1.5 tabular-nums">{r.hoursPerWeek}</td>
                    <td className="px-3 py-1.5 tabular-nums">{r.seniority}</td>
                    <td className="px-3 py-1.5 text-faint">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {roster.rows.length > PREVIEW_LIMIT && (
            <p className="mt-1.5 text-[11px] text-faint">
              Showing the first {PREVIEW_LIMIT} of {roster.rows.length}.
            </p>
          )}

          <button
            type="submit"
            disabled={ok === 0}
            className="mt-5 w-full rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-panel transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {ok === 0 ? 'Nothing to import' : `Import ${ok} ${ok === 1 ? 'person' : 'people'}`}
          </button>
          <p className="mt-2 text-[11px] text-faint">
            Rows already on the roster or repeated in the paste are skipped, not merged. Skill
            levels, timezones and availability come later — claim-your-profile is the next slice.
          </p>
        </>
      )}
    </form>
  );
}
