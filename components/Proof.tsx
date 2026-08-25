'use client';

import type { Company, Person } from '@/lib/types';
import Avatar from './Avatar';

/**
 * Illustrative scenarios, attributed to real entries in the directory so the
 * faces and job titles line up with people you can actually go and find.
 * The note at the foot of the section says these are not real endorsements.
 */
const QUOTES: { id: string; quote: string }[] = [
  {
    id: 'p03',
    quote:
      'We had three backend engineers volunteer and nobody who could design the thing. ProjectMatch scored the fourth backend engineer at zero and put a designer at the top instead. That is the call we kept getting wrong by ourselves.',
  },
  {
    id: 'p02',
    quote:
      'It told us the four of us shared three hours a week before we started, not six weeks in when the project was already failing. We moved two people and fixed it on day one.',
  },
  {
    id: 'p01',
    quote:
      'I wrote two lines about the project and got a roster with a domain expert I would never have thought to look for. She was in a different office and I had never met her.',
  },
  {
    id: 'p08',
    quote:
      'What sold me was that it listed what the team still could not do. Every other tool I have used shows you a confident percentage and stops there.',
  },
  {
    id: 'p06',
    quote:
      'Searching my own office first and then widening was the part I actually used. I found someone two desks away before I went looking anywhere else.',
  },
  {
    id: 'p09',
    quote:
      'Every suggestion came with the reason attached and a way to contact the person. No dead ends, no wondering why the algorithm liked someone.',
  },
];

export default function Proof({
  people,
  companies,
}: {
  people: Person[];
  companies: Company[];
}) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? id;

  const cards = QUOTES.map((q) => ({ ...q, person: byId.get(q.id) })).filter(
    (q): q is typeof q & { person: Person } => Boolean(q.person),
  );

  return (
    <section className="mx-auto max-w-[1180px] px-5 py-20">
      <h2 className="font-display text-[26px] leading-tight font-bold tracking-tight sm:text-[32px]">
        What teams get out of it
      </h2>
      <p className="mt-2 max-w-[520px] text-[14px] leading-relaxed text-muted">
        The same question every time: not who is good, but who is missing.
      </p>

      <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ id, quote, person }) => (
          <li
            key={id}
            className="flex flex-col rounded-xl border border-line bg-panel p-5 transition-colors hover:border-line-strong"
          >
            <p className="flex-1 text-[14px] leading-relaxed text-ink/90">{quote}</p>
            <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
              <Avatar person={person} size={40} />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{person.name}</p>
                <p className="truncate text-[12px] text-faint">
                  {person.title} · {companyName(person.companyId)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-[11px] text-faint">
        Illustrative scenarios. The people and companies named here are generated and fictional,
        the same as the rest of the directory.
      </p>
    </section>
  );
}
