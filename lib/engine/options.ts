import type { Brief, Person, ScopeFilter, TeamState } from '../types';
import { autoFill, defaultObjective, improve, membersOf } from './assemble';
import { teamHealth } from './health';
import { allRequirements, coverage, coveringCount } from './score';

/**
 * More than one answer, with the tradeoff named.
 *
 * The product used to hand back a single team. Real staffing decisions have
 * options — the fastest team, or the one where no requirement rests on one
 * person, or the one that leaves everyone with slack. This runs the same
 * assembly pass with a few different objectives and reports how the results
 * differ, which turns the product from an oracle into an advisor. Pure engine.
 */

export interface TeamOption {
  key: string;
  label: string;
  /** How this option differs from the best-coverage team. Empty for that one. */
  tradeoff: string;
  team: TeamState;
  coverage: number;
  busFactor: number;
  /** Average spare hours per week across seated members, for their seat. */
  spareHours: number;
}

const COVERED = 0.5;

function stats(team: TeamState, brief: Brief, pool: Person[]) {
  const members = membersOf(team, pool);
  const cov = coverage(allRequirements(brief), members);
  const busFactor = teamHealth(brief, members, brief.roles.length).busFactor;

  let spare = 0;
  let seated = 0;
  for (const r of brief.roles) {
    const p = members.find((x) => x.id === team[r.id]);
    if (!p) continue;
    spare += Math.max(0, p.hoursPerWeek - r.hoursNeeded);
    seated++;
  }
  return { cov, busFactor, spareHours: seated ? Math.round(spare / seated) : 0 };
}

/** min covering count across the weighted requirements a team covers, capped at 2, normalised. */
function busNorm(team: TeamState, brief: Brief, pool: Person[]): number {
  const m = membersOf(team, pool);
  const weighted = allRequirements(brief).filter((r) => r.weight >= 2);
  const covered = weighted.filter((r) => coveringCount(m, r, COVERED) > 0);
  if (covered.length === 0) return 0;
  const bf = Math.min(...covered.map((r) => coveringCount(m, r, COVERED)));
  return Math.min(bf, 2) / 2;
}

function spareNorm(team: TeamState, brief: Brief, pool: Person[]): number {
  const m = membersOf(team, pool);
  let sum = 0;
  let n = 0;
  for (const r of brief.roles) {
    const p = m.find((x) => x.id === team[r.id]);
    if (!p) continue;
    sum += Math.max(0, Math.min(1, (p.hoursPerWeek - r.hoursNeeded) / Math.max(1, p.hoursPerWeek)));
    n++;
  }
  return n ? sum / n : 0;
}

const sig = (t: TeamState) =>
  Object.entries(t)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v ?? '-')
    .join(',');

function tradeoffVs(
  base: ReturnType<typeof stats>,
  opt: ReturnType<typeof stats>,
): string {
  const parts: string[] = [];
  const dCov = Math.round((opt.cov - base.cov) * 100);
  if (dCov <= -1) parts.push(`${-dCov} pts less coverage`);
  else if (dCov >= 1) parts.push(`${dCov} pts more coverage`);
  else parts.push('same coverage');

  if (opt.busFactor >= 2 && base.busFactor < 2) parts.push('no single point of failure');
  else if (opt.busFactor < base.busFactor) parts.push('a new single point of failure');

  const dSpare = opt.spareHours - base.spareHours;
  if (dSpare >= 3) parts.push(`${dSpare} more spare hrs/wk per person`);
  else if (dSpare <= -3) parts.push(`${-dSpare} fewer spare hrs/wk per person`);

  return parts.join(', ');
}

export function proposeTeams(brief: Brief, pool: Person[], scope: ScopeFilter): TeamOption[] {
  const base = autoFill(brief, pool, scope);
  const baseStats = stats(base, brief, pool);

  const options: TeamOption[] = [
    {
      key: 'best-coverage',
      label: 'Best coverage',
      tradeoff: '',
      team: base,
      coverage: baseStats.cov,
      busFactor: baseStats.busFactor,
      spareHours: baseStats.spareHours,
    },
  ];

  const seen = new Set([sig(base)]);
  const defObj = defaultObjective(brief, pool);

  const variants: { key: string; label: string; obj: (t: TeamState) => number }[] = [
    {
      key: 'resilient',
      label: 'No single point of failure',
      obj: (t) => 0.7 * defObj(t) + 0.3 * busNorm(t, brief, pool),
    },
    {
      key: 'light',
      label: 'Lightest load',
      obj: (t) => 0.78 * defObj(t) + 0.22 * spareNorm(t, brief, pool),
    },
  ];

  for (const v of variants) {
    const team = improve(base, brief, pool, scope, v.obj);
    const s = sig(team);
    if (seen.has(s)) continue;
    seen.add(s);
    const st = stats(team, brief, pool);
    options.push({
      key: v.key,
      label: v.label,
      tradeoff: tradeoffVs(baseStats, st) || 'a different mix, same headline numbers',
      team,
      coverage: st.cov,
      busFactor: st.busFactor,
      spareHours: st.spareHours,
    });
  }

  return options;
}
