import type { Skill, SkillId } from '../types';
import skillsData from '../seed/skills.json';

export const SKILLS = skillsData as Skill[];

const BY_ID = new Map<SkillId, Skill>(SKILLS.map((s) => [s.id, s]));
const BY_ALIAS = new Map<string, SkillId>();
for (const s of SKILLS) {
  BY_ALIAS.set(s.label.toLowerCase(), s.id);
  BY_ALIAS.set(s.id.toLowerCase(), s.id);
  for (const a of s.aliases) BY_ALIAS.set(a.toLowerCase(), s.id);
}

export function getSkill(id: SkillId): Skill | undefined {
  return BY_ID.get(id);
}

export function labelOf(id: SkillId): string {
  return BY_ID.get(id)?.label ?? id;
}

/** Resolve free text ("react.js", "User Research") to a known skill id. */
export function resolveSkill(text: string): SkillId | null {
  const k = text.trim().toLowerCase();
  if (BY_ALIAS.has(k)) return BY_ALIAS.get(k)!;
  const squashed = k.replace(/[\s._-]/g, '');
  for (const [alias, id] of BY_ALIAS) {
    if (alias.replace(/[\s._-]/g, '') === squashed) return id;
  }
  return null;
}

const simCache = new Map<string, number>();

/**
 * Similarity between two skills, 0..1.
 * This is what lets "Next.js" still count when the brief asks for "React".
 */
export function sim(a: SkillId, b: SkillId): number {
  if (a === b) return 1;
  const key = a < b ? a + '|' + b : b + '|' + a;
  const hit = simCache.get(key);
  if (hit !== undefined) return hit;

  const sa = BY_ID.get(a);
  const sb = BY_ID.get(b);
  let score = 0;

  if (sa && sb) {
    if (sa.aliases.includes(b) || sb.aliases.includes(a)) score = 0.95;
    else if (sa.parent === b || sb.parent === a) score = 0.75;
    else if (sa.related.includes(b) || sb.related.includes(a)) score = 0.7;
    else if (sa.parent && sa.parent === sb.parent) score = 0.45;
    else {
      const ga = sa.parent ? BY_ID.get(sa.parent)?.parent : undefined;
      const gb = sb.parent ? BY_ID.get(sb.parent)?.parent : undefined;
      if (ga && ga === gb) score = 0.2;
    }
  }

  simCache.set(key, score);
  return score;
}
