import type { Brief, Company, Person } from '@/lib/types';
import peopleData from '@/lib/seed/people.json';
import companiesData from '@/lib/seed/companies.json';
import { fallbackBrief } from '@/lib/ai/fallback';
import TeamBuilder from '@/components/TeamBuilder';

const EXAMPLE =
  'Internal tool that turns customer support tickets into weekly theme reports. Roughly 6 weeks. It needs to actually ship, not stay a prototype.';

export default function Page() {
  // Read deterministically on the server so the first paint is a working team
  // rather than an empty form. No API call needed to see the product.
  const brief: Brief = { text: EXAMPLE, ...fallbackBrief(EXAMPLE) };

  return (
    <TeamBuilder
      people={peopleData as Person[]}
      companies={companiesData as Company[]}
      initialBrief={brief}
    />
  );
}
