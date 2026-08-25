import type { Brief, Person, Role, ScopeFilter, ScoreBreakdown, SortMode, TeamState } from '../types';
import { labelOf } from './graph';
import { marginalGain, roleMatch, scoreCandidate, allRequirements, coverage } from './score';

const SEAT_FLOOR = 0.35;

export interface Candidate {
  person: Person;
  breakdown: ScoreBreakdown;
  roleMatch: number;
}

export function membersOf(team: TeamState, pool: Person[]): Person[] {
  const byId = new Map(pool.map((p) => [p.id, p]));
  return Object.values(team)
    .filter((id): id is string => Boolean(id))
    .map((id) => byId.get(id))
    .filter((p): p is Person => Boolean(p));
}

function inScope(p: Person, scope: ScopeFilter): boolean {
  if (scope.companyId && p.companyId !== scope.companyId) return false;
  if (scope.office && p.office !== scope.office) return false;
  return true;
}

function matchesSearch(p: Person, q: string): boolean {
  if (!q.trim()) return true;
  const k = q.trim().toLowerCase();
  if (p.name.toLowerCase().includes(k)) return true;
  if (p.title.toLowerCase().includes(k)) return true;
  if (p.office.toLowerCase().includes(k)) return true;
  return p.skills.some((s) => labelOf(s.skillId).toLowerCase().includes(k));
}

export function rankCandidates(
  pool: Person[],
  role: Role,
  brief: Brief,
  team: TeamState,
  opts: {
    sort: SortMode;
    scope: ScopeFilter;
    search: string;
    minHours: number;
    seniority?: number[];
  },
): Candidate[] {
  const taken = new Set(Object.values(team).filter(Boolean) as string[]);
  const members = membersOf(team, pool);
  const meIsTaken = team[role.id];
  const levels = opts.seniority && opts.seniority.length > 0 ? new Set(opts.seniority) : null;

  const eligible = pool.filter(
    (p) =>
      p.openToProjects &&
      p.hoursPerWeek >= opts.minHours &&
      (!levels || levels.has(p.seniority)) &&
      (!taken.has(p.id) || p.id === meIsTaken) &&
      inScope(p, opts.scope) &&
      matchesSearch(p, opts.search),
  );

  const others = members.filter((m) => m.id !== meIsTaken);

  const scored: Candidate[] = eligible.map((person) => ({
    person,
    breakdown: scoreCandidate(person, role, brief, others),
    roleMatch: roleMatch(person, role),
  }));

  // Best fit shortlists to people who can credibly hold the seat, then ranks
  // purely on contribution. Ranking on the blended score while displaying only
  // the contribution made the list read as unsorted.
  if (opts.sort === 'bestFit') {
    const capable = scored.filter((c) => c.roleMatch >= SEAT_FLOOR);
    const list = capable.length >= 3 ? capable : scored;
    return list.sort(
      (a, b) => b.breakdown.gapFill - a.breakdown.gapFill || b.roleMatch - a.roleMatch,
    );
  }

  const cmp: Record<SortMode, (a: Candidate, b: Candidate) => number> = {
    bestFit: (a, b) => b.breakdown.gapFill - a.breakdown.gapFill,
    experience: (a, b) => b.person.yearsExp - a.person.yearsExp,
    availability: (a, b) => b.person.hoursPerWeek - a.person.hoursPerWeek,
    skillMatch: (a, b) => b.roleMatch - a.roleMatch,
    sameOffice: (a, b) =>
      a.person.office.localeCompare(b.person.office) || b.breakdown.total - a.breakdown.total,
  };

  return scored.sort(cmp[opts.sort]);
}

function emptyTeam(brief: Brief): TeamState {
  return Object.fromEntries(brief.roles.map((r) => [r.id, null]));
}

/** Greedy fill: each seat goes to whoever closes the most of what is still missing. */
export function autoFill(brief: Brief, pool: Person[], scope: ScopeFilter): TeamState {
  const team = emptyTeam(brief);
  const taken = new Set<string>();
  const eligible = pool.filter((p) => p.openToProjects && inScope(p, scope));

  const order = [...brief.roles].sort(
    (a, b) =>
      b.requirements.reduce((s, r) => s + r.weight, 0) -
      a.requirements.reduce((s, r) => s + r.weight, 0),
  );

  for (const role of order) {
    const members = membersOf(team, pool);
    let best: Person | null = null;
    let bestScore = -1;
    for (const p of eligible) {
      if (taken.has(p.id)) continue;
      const s = scoreCandidate(p, role, brief, members).total;
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }
    if (best) {
      team[role.id] = best.id;
      taken.add(best.id);
    }
  }

  return improve(team, brief, pool, scope);
}

/** Swap pass: try replacing each member, keep any swap that raises overall coverage. */
export function improve(
  team: TeamState,
  brief: Brief,
  pool: Person[],
  scope: ScopeFilter,
): TeamState {
  const reqs = allRequirements(brief);
  const eligible = pool.filter((p) => p.openToProjects && inScope(p, scope));
  const next: TeamState = { ...team };

  // A swap only counts as an improvement if the person can actually do the
  // job. Without this the optimiser happily seats a designer as the DBA.
  const objective = (t: TeamState) => {
    const m = membersOf(t, pool);
    const seatFit =
      brief.roles.reduce((s, r) => {
        const p = m.find((x) => x.id === t[r.id]);
        return s + (p ? roleMatch(p, r) : 0);
      }, 0) / Math.max(1, brief.roles.length);
    return 0.7 * coverage(reqs, m) + 0.3 * seatFit;
  };

  for (let pass = 0; pass < 3; pass++) {
    let improved = false;

    for (const role of brief.roles) {
      const taken = new Set(Object.values(next).filter(Boolean) as string[]);

      let bestId = next[role.id];
      let bestScore = objective(next);

      for (const p of eligible) {
        if (taken.has(p.id)) continue;
        if (roleMatch(p, role) < SEAT_FLOOR) continue;
        const trial: TeamState = { ...next, [role.id]: p.id };
        const score = objective(trial);
        if (score > bestScore + 0.001) {
          bestScore = score;
          bestId = p.id;
        }
      }

      if (bestId !== next[role.id]) {
        next[role.id] = bestId;
        improved = true;
      }
    }

    if (!improved) break;
  }

  return next;
}

export { marginalGain };
