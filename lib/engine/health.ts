import type { Brief, Gap, Person, TeamHealth } from '../types';
import { labelOf } from './graph';
import { allRequirements, coverage, satisfaction, teamOverlapHours } from './score';

/**
 * The honest half of the product: what the team covers, and what it does not.
 */
export function teamHealth(brief: Brief, members: Person[], seats: number): TeamHealth {
  const reqs = allRequirements(brief);
  const cov = coverage(reqs, members);
  const overlapHours = teamOverlapHours(members);

  const gaps: Gap[] = [];

  const uncovered = reqs
    .map((r) => ({
      req: r,
      best: members.reduce((m, p) => Math.max(m, satisfaction(p, r)), 0),
    }))
    .filter((x) => x.best < 0.5)
    .sort((a, b) => b.req.weight - a.req.weight || a.best - b.best);

  const seen = new Set<string>();
  for (const u of uncovered) {
    if (seen.has(u.req.skillId)) continue;
    seen.add(u.req.skillId);
    gaps.push({
      label: 'No coverage for ' + labelOf(u.req.skillId),
      severity: u.req.weight >= 3 ? 'high' : 'medium',
    });
    if (gaps.length >= 3) break;
  }

  if (members.length >= 2 && overlapHours < 5) {
    gaps.push({
      label: 'Team overlap is only ' + overlapHours + ' hrs per week',
      severity: 'high',
    });
  }

  if (members.length >= 3) {
    const avg = members.reduce((a, p) => a + p.seniority, 0) / members.length;
    if (avg < 2.2) gaps.push({ label: 'No senior presence on the team', severity: 'medium' });
    if (avg > 4.3) gaps.push({ label: 'Entirely senior, no junior capacity', severity: 'medium' });
  }

  const thin = members.filter((p) => p.hoursPerWeek <= 3);
  if (thin.length > 0) {
    gaps.push({
      label: thin[0].name + ' is limited to ' + thin[0].hoursPerWeek + ' hrs per week',
      severity: 'medium',
    });
  }

  return { coverage: cov, filled: members.length, seats, overlapHours, gaps: gaps.slice(0, 4) };
}
