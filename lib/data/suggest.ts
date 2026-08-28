import 'server-only';

import type { Person } from '../types';
import { SEAT_FLOOR, rankCandidates } from '../engine/assemble';
import { listPeople } from './people';
import type { ProjectDetail } from './projects';

/**
 * Who the engine would put in each open seat, from this org's own roster.
 *
 * The landing-page builder picks from sixty fictional people, so the team you
 * assemble there cannot be carried into a real project — those people are not
 * in anybody's database. This is the honest equivalent: the same scoring, the
 * same seat floor, run against people who actually exist, and offered rather
 * than assigned.
 *
 * Seats are walked in order and each pick is removed from the pool, so the
 * suggestions form a coherent team rather than proposing one strong
 * generalist for every seat at once.
 */
export interface Suggestion {
  person: Person;
  fit: number;
}

export async function suggestForOpenSeats(
  project: ProjectDetail,
): Promise<Map<string, Suggestion>> {
  const out = new Map<string, Suggestion>();

  const openRoles = project.roles.filter((r) => project.seats[r.id]?.state === 'open');
  if (openRoles.length === 0) return out;

  const pool = await listPeople(project.orgId);
  const taken = new Set(
    Object.values(project.seats)
      .map((s) => s.person?.id)
      .filter(Boolean) as string[],
  );

  for (const role of openRoles) {
    const ranked = rankCandidates(
      pool.filter((p) => !taken.has(p.id)),
      role,
      project.brief,
      project.team,
      { sort: 'bestFit', scope: { companyId: null, office: null }, search: '', minHours: 0 },
    );
    const best = ranked.find((c) => c.roleMatch >= SEAT_FLOOR);
    if (best) {
      out.set(role.id, { person: best.person, fit: best.roleMatch });
      taken.add(best.person.id);
    }
  }

  return out;
}
