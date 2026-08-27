/**
 * Pulling known skills out of free text — a résumé, a bio, a GitHub profile.
 *
 * Pure and deterministic: it scans for the 82 vocabulary skills by their
 * label and aliases and reports what it finds, at a flat level. It never
 * invents a skill that is not in the graph, and it does not try to read a
 * level out of prose — that guess is exactly the unreliable part, and it is
 * what an AI pass would be for. Everything found here lands as `extracted`
 * provenance, which the engine already trusts less than a verified level.
 *
 * This is the deterministic floor the résumé-import feature stands on; it
 * works with no API key, the same promise the rest of the product makes.
 */
import { SKILLS } from '../engine/graph';

export interface ExtractedSkill {
  skillId: string;
  level: number;
}

/** Non-alphanumeric runs collapse to a single space; case folded. */
const normalise = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

/**
 * Every vocabulary skill whose label or an alias appears as a whole phrase
 * in the text. Deduplicated, capped, level fixed at 3.
 */
export function extractSkills(text: string, cap = 40): ExtractedSkill[] {
  if (!text.trim()) return [];
  const haystack = normalise(text);

  const found: ExtractedSkill[] = [];
  const seen = new Set<string>();

  for (const skill of SKILLS) {
    if (seen.has(skill.id)) continue;
    const candidates = [skill.label, skill.id, ...skill.aliases]
      .map(normalise)
      .filter((c) => c.trim().length >= 3);

    if (candidates.some((c) => haystack.includes(c))) {
      seen.add(skill.id);
      found.push({ skillId: skill.id, level: 3 });
      if (found.length >= cap) break;
    }
  }

  return found;
}
