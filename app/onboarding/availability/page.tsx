import { redirect } from 'next/navigation';

import { getMyOrg } from '@/lib/data/orgs';
import { getMyPersonId, getPerson } from '@/lib/data/people';
import { getCurrentUser } from '@/lib/supabase/server';

import OnboardingShell from '../Shell';
import { setupAvailabilityAction } from '../actions';

/**
 * Step four: the two numbers the engine actually reads about availability.
 *
 * Hours decide whether taking a seat would put you over capacity; the offset
 * decides how much of the day a team shares. Overlap is a real input to team
 * health, which is why this asks rather than reading a browser clock — that
 * clock lies the moment anyone travels, and a wrong offset quietly degrades
 * every team the person is scored into.
 */

/** Offsets people actually work at, rather than all 38 of them. */
const ZONES: { value: string; label: string }[] = [
  { value: '-8', label: 'UTC-8 · Los Angeles' },
  { value: '-6', label: 'UTC-6 · Mexico City, Chicago' },
  { value: '-5', label: 'UTC-5 · New York, Toronto' },
  { value: '-3', label: 'UTC-3 · São Paulo' },
  { value: '0', label: 'UTC+0 · London, Lisbon, Accra' },
  { value: '1', label: 'UTC+1 · Berlin, Lagos, Paris' },
  { value: '2', label: 'UTC+2 · Cairo, Athens' },
  { value: '3', label: 'UTC+3 · Nairobi, Istanbul' },
  { value: '4', label: 'UTC+4 · Dubai' },
  { value: '5.5', label: 'UTC+5:30 · India' },
  { value: '7', label: 'UTC+7 · Jakarta, Bangkok' },
  { value: '8', label: 'UTC+8 · Singapore, Beijing' },
  { value: '9', label: 'UTC+9 · Tokyo, Seoul' },
  { value: '10', label: 'UTC+10 · Sydney' },
  { value: '12', label: 'UTC+12 · Auckland' },
];

export default async function OnboardingAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ photo_error?: string }>;
}) {
  const { photo_error: photoError } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect('/auth/sign-in?next=/onboarding/availability');

  const org = await getMyOrg();
  if (!org) redirect('/onboarding');

  const personId = await getMyPersonId(org.id);
  if (!personId) redirect('/onboarding/you');

  // Only offer the GitHub read if a handle survived the details step.
  const me = await getPerson(personId);
  const handle = me?.contact.github?.trim() ?? '';

  return (
    <OnboardingShell
      step={3}
      title="How much, and when?"
      hint="Both change later. Nobody is put on a team without being asked."
    >
      {photoError && (
        <p className="mt-4 rounded-xl border border-line border-l-2 border-l-warn bg-panel px-4 py-3 text-[13px] text-ink">
          {photoError} Everything else was saved.
        </p>
      )}

      <form action={setupAvailabilityAction} className="mt-6 space-y-4">
        <div>
          <label htmlFor="hoursPerWeek" className="block text-[12px] text-muted">
            Hours a week you can give a project
          </label>
          <input
            id="hoursPerWeek"
            name="hoursPerWeek"
            type="number"
            min={0}
            max={40}
            defaultValue={20}
            autoFocus
            className="mt-1.5 w-full rounded-xl border border-line bg-panel px-4 py-2.5 text-[14px] outline-none transition-colors focus:border-accent"
          />
          <p className="mt-1 text-[11px] text-faint">
            Used to warn you before a seat takes you over.
          </p>
        </div>

        <div>
          <label htmlFor="utcOffset" className="block text-[12px] text-muted">
            Your timezone
          </label>
          <select
            id="utcOffset"
            name="utcOffset"
            defaultValue="5.5"
            className="mt-1.5 w-full rounded-xl border border-line bg-panel px-4 py-2.5 text-[14px] outline-none transition-colors focus:border-accent"
          >
            {ZONES.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-faint">
            How many hours a team shares in a day is part of how it is scored.
          </p>
        </div>

        {handle && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-panel px-4 py-3">
            <input
              type="checkbox"
              name="useGitHub"
              value="1"
              defaultChecked
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span className="text-[12px] text-muted">
              Also read <span className="text-ink">github.com/{handle}</span> for skills — public
              repositories only, languages and topics.
            </span>
          </label>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-accent px-4 py-3 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          Finish
        </button>
      </form>
    </OnboardingShell>
  );
}
