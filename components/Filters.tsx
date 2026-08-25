'use client';

import type { Company, ScopeFilter } from '@/lib/types';

const HOURS = [
  { v: 0, label: 'Any' },
  { v: 5, label: '5+' },
  { v: 10, label: '10+' },
  { v: 15, label: '15+' },
];

const LEVELS = [
  { v: 1, label: 'Junior' },
  { v: 2, label: 'Mid' },
  { v: 3, label: 'Senior' },
  { v: 4, label: 'Staff' },
  { v: 5, label: 'Principal' },
];

export default function Filters({
  companies,
  scope,
  onScope,
  minHours,
  onMinHours,
  seniority,
  onSeniority,
  resultCount,
}: {
  companies: Company[];
  scope: ScopeFilter;
  onScope: (s: ScopeFilter) => void;
  minHours: number;
  onMinHours: (h: number) => void;
  seniority: number[];
  onSeniority: (s: number[]) => void;
  resultCount: number;
}) {
  const offices = companies.find((c) => c.id === scope.companyId)?.offices ?? [];
  const dirty = minHours > 0 || seniority.length > 0 || scope.companyId !== null;

  function toggleLevel(v: number) {
    onSeniority(seniority.includes(v) ? seniority.filter((x) => x !== v) : [...seniority, v]);
  }

  return (
    <section className="rounded-xl border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-display text-[15px] font-semibold">Filters</h2>
        {dirty && (
          <button
            type="button"
            onClick={() => {
              onMinHours(0);
              onSeniority([]);
              onScope({ companyId: null, office: null });
            }}
            className="text-[12px] text-accent underline-offset-2 hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-4 px-4 py-3.5">
        <div>
          <h3 className="text-[12px] font-medium text-muted">Weekly availability</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {HOURS.map((h) => (
              <button
                key={h.v}
                type="button"
                onClick={() => onMinHours(h.v)}
                aria-pressed={minHours === h.v}
                className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                  minHours === h.v
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line text-muted hover:border-line-strong'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-[12px] font-medium text-muted">Seniority</h3>
          <div className="mt-2 space-y-1">
            {LEVELS.map((l) => (
              <label
                key={l.v}
                className="flex cursor-pointer items-center gap-2 text-[13px] text-muted hover:text-ink"
              >
                <input
                  type="checkbox"
                  checked={seniority.includes(l.v)}
                  onChange={() => toggleLevel(l.v)}
                  className="size-3.5 accent-[var(--accent)]"
                />
                {l.label}
              </label>
            ))}
          </div>
        </div>

        {offices.length > 0 && (
          <div>
            <h3 className="text-[12px] font-medium text-muted">Office</h3>
            <select
              value={scope.office ?? ''}
              onChange={(e) => onScope({ ...scope, office: e.target.value || null })}
              className="mt-2 w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[13px]"
              aria-label="Office"
            >
              <option value="">All offices</option>
              {offices.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="border-t border-line pt-3 text-[12px] text-faint">
          {resultCount} {resultCount === 1 ? 'candidate' : 'candidates'}
        </p>
      </div>
    </section>
  );
}
