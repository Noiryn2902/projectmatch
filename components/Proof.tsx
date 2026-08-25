'use client';

/**
 * Illustrative scenarios, attributed to the same fictional companies that
 * populate the directory. Nothing here is a real endorsement, and the note
 * at the foot of the section says so.
 */
const QUOTES: { quote: string; name: string; role: string; company: string }[] = [
  {
    quote:
      'We had three backend engineers volunteer and nobody who could design the thing. ProjectMatch scored the fourth backend engineer at zero and put a designer at the top instead. That is the call we kept getting wrong by ourselves.',
    name: 'Wei Webb',
    role: 'Staff platform engineer',
    company: 'Orbit Financial',
  },
  {
    quote:
      'It told us the four of us shared three hours a week before we started, not six weeks in when the project was already failing. We moved two people and fixed it on day one.',
    name: 'Nadia Khalil',
    role: 'Principal backend engineer',
    company: 'Lumen Education',
  },
  {
    quote:
      'I wrote two lines about the project and got a roster with a domain expert I would never have thought to look for. She was in a different office and I had never met her.',
    name: 'Diego Larsen',
    role: 'Senior frontend engineer',
    company: 'Verdant Climate',
  },
  {
    quote:
      'What sold me was that it listed what the team still could not do. Every other tool I have used shows you a confident percentage and stops there.',
    name: 'Hannah Krishnan',
    role: 'Senior product designer',
    company: 'Northwind Labs',
  },
  {
    quote:
      'Searching my own office first and then widening was the part I actually used. I found someone two desks away before I went looking anywhere else.',
    name: 'Priya Raman',
    role: 'Senior engineer',
    company: 'Kestrel Health',
  },
  {
    quote:
      'Every suggestion came with the reason attached and a way to contact the person. No dead ends, no wondering why the algorithm liked someone.',
    name: 'Daniel Volkov',
    role: 'Staff product manager',
    company: 'Atlas Logistics',
  },
];

export default function Proof() {
  return (
    <section className="mx-auto max-w-[1180px] px-5 py-20">
      <h2 className="font-display text-[26px] leading-tight font-bold tracking-tight sm:text-[32px]">
        What teams get out of it
      </h2>
      <p className="mt-2 max-w-[520px] text-[14px] leading-relaxed text-muted">
        The same question every time: not who is good, but who is missing.
      </p>

      <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUOTES.map((q) => (
          <li
            key={q.name}
            className="flex flex-col rounded-xl border border-line bg-panel p-5 transition-colors hover:border-line-strong"
          >
            <p className="flex-1 text-[14px] leading-relaxed text-ink/90">{q.quote}</p>
            <div className="mt-5 border-t border-line pt-3.5">
              <p className="text-[13px] font-medium">{q.name}</p>
              <p className="mt-0.5 text-[12px] text-faint">
                {q.role} · {q.company}
              </p>
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
