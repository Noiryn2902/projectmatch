import type { Person, Role } from '../types';
import { labelOf, sim } from './graph';
import { roleMatch, satisfaction } from './score';
import { SEAT_FLOOR } from './assemble';

/**
 * Why a seat cannot be filled, and what is cheapest to change.
 *
 * When no one on the roster can hold a seat the product used to just say so.
 * A real optimiser says which requirements are the problem, whether anyone is
 * close, and by how much — which is what turns "nobody fits" into "hire one
 * person with Airflow, or drop the level on SQL, or extend the timeline".
 * Runs entirely on coverage maths that already exists.
 */

const COVERED = 0.5;

export interface RequirementReach {
  skillId: string;
  label: string;
  minLevel: number;
  weight: number;
  /** Best single-person satisfaction on the roster, 0..1. */
  best: number;
  /**
   * The nearest person and their own level in the closest matching skill.
   * `null` when nobody has anything related at all — a true blank.
   */
  closest: { name: string; level: number } | null;
}

export interface RoleDiagnosis {
  /** True if at least one person clears the seat floor on the whole role. */
  staffable: boolean;
  /** Requirements nobody on the roster covers, hardest first. */
  unmet: RequirementReach[];
}

export function diagnoseRole(pool: Person[], role: Role, floor = SEAT_FLOOR): RoleDiagnosis {
  const open = pool.filter((p) => p.openToProjects);
  const staffable = open.some((p) => roleMatch(p, role) >= floor);

  const unmet: RequirementReach[] = [];

  for (const req of role.requirements) {
    let best = 0;
    let closest: RequirementReach['closest'] = null;

    for (const p of open) {
      const s = satisfaction(p, req);
      if (s <= best) continue;
      best = s;

      // Report their level in the skill that actually drives the match — the
      // one most similar to the requirement — not the highest level among
      // every loosely related skill they happen to list.
      let nearestSim = 0;
      let nearestLevel = 0;
      for (const ps of p.skills) {
        const sm = sim(ps.skillId, req.skillId);
        if (sm > nearestSim || (sm === nearestSim && ps.level > nearestLevel)) {
          nearestSim = sm;
          nearestLevel = ps.level;
        }
      }
      closest = nearestSim > 0 ? { name: p.name, level: nearestLevel } : null;
    }

    if (best < COVERED) {
      unmet.push({
        skillId: req.skillId,
        label: labelOf(req.skillId),
        minLevel: req.minLevel,
        weight: req.weight,
        best,
        closest,
      });
    }
  }

  unmet.sort((a, b) => b.weight - a.weight || a.best - b.best);
  return { staffable, unmet };
}
