import type { Person } from '../types';
import { labelOf, sim } from './graph';

/**
 * Staffing is also how people grow, and nothing else models it.
 *
 * A junior placed next to a senior who is strong in the same skill is a
 * stretch assignment — the junior has someone to learn from on the work
 * itself. `health.ts` already warns when a team has no senior presence; this
 * is the inverse, a signal worth optimising *for*: a team that covers the
 * brief *and* develops its people is a better team than one that only covers
 * the brief.
 */

export interface StretchPair {
  learnerId: string;
  learnerName: string;
  mentorId: string;
  mentorName: string;
  skillId: string;
  label: string;
}

/** A skill the learner is still building — low absolute level, and junior. */
const LEARNING_CEILING = 2;
/** How far ahead a mentor must be, in skill level and in seniority. */
const LEVEL_LEAD = 2;
const SENIORITY_LEAD = 1;
/** Same skill, or close enough that watching still teaches. */
const NEAR = 0.7;

/**
 * Every (learner, mentor, skill) stretch pairing on a team. One learner may
 * appear more than once — different skills, different mentors — but a given
 * skill is only paired to its strongest available mentor.
 */
export function stretchPairs(members: Person[]): StretchPair[] {
  const pairs: StretchPair[] = [];

  for (const learner of members) {
    for (const ls of learner.skills) {
      if (ls.level > LEARNING_CEILING) continue;

      let best: { mentor: Person; level: number } | null = null;
      for (const mentor of members) {
        if (mentor.id === learner.id) continue;
        if (mentor.seniority < learner.seniority + SENIORITY_LEAD) continue;
        for (const ms of mentor.skills) {
          if (sim(ms.skillId, ls.skillId) < NEAR) continue;
          if (ms.level < ls.level + LEVEL_LEAD) continue;
          if (!best || ms.level > best.level) best = { mentor, level: ms.level };
        }
      }

      if (best) {
        pairs.push({
          learnerId: learner.id,
          learnerName: learner.name,
          mentorId: best.mentor.id,
          mentorName: best.mentor.name,
          skillId: ls.skillId,
          label: labelOf(ls.skillId),
        });
      }
    }
  }

  return pairs;
}

/** How many distinct people on the team have at least one place to grow. */
export function stretchCount(members: Person[]): number {
  return new Set(stretchPairs(members).map((p) => p.learnerId)).size;
}
