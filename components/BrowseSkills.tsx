'use client';

import { useState } from 'react';

import type { Company, Person, Skill } from '@/lib/types';
import Categories from './Categories';
import Directory from './Directory';

/**
 * Categories and the directory modal it opens, kept together.
 *
 * The landing page is a server component now, so the "which category did you
 * click" state cannot live there. This is the smallest possible client
 * boundary: two components that already existed, one piece of state between
 * them, and nothing else pulled across the line.
 */
export default function BrowseSkills({
  people,
  skills,
  companies,
}: {
  people: Person[];
  skills: Skill[];
  companies: Company[];
}) {
  const [browsing, setBrowsing] = useState<{ id: string; label: string } | null>(null);

  return (
    <>
      <Categories
        people={people}
        skills={skills}
        onPick={(id, label) => setBrowsing({ id, label })}
      />
      {browsing && (
        <Directory
          categoryId={browsing.id}
          categoryLabel={browsing.label}
          people={people}
          skills={skills}
          companies={companies}
          onClose={() => setBrowsing(null)}
        />
      )}
    </>
  );
}
