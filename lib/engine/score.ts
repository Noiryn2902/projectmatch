import type { Brief, Person, PersonSkill, Requirement, Role, ScoreBreakdown, SkillProvenance } from '../types';
import { sim } from './graph';

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

/**
 * How much to believe a stated skill level, 0..1, from who asserted it.
 * A level nobody has corroborated is a claim, not a measurement, so the
 * engine scales it down rather than trusting it whole — this is what keeps
 * "everyone is a five" from quietly turning the scoring into noise once real
 * people fill their own profiles in.
 *
 * Missing provenance is left at full trust on purpose. The seeded demo data
 * predates the field, and reading "unknown" as "unverified" would move every
 * number in the live demo. Only an explicit provenance is ever discounted.
 */
const PROVENANCE_TRUST: Record<SkillProvenance, number> = {
  verified: 1,
  endorsed: 0.9,
  extracted: 0.75,
  self: 0.6,
};

export function skillTrust(ps: PersonSkill): number {
  return ps.provenance ? PROVENANCE_TRUST[ps.provenance] : 1;
}

/** Weakest to strongest, for reducing a set of provenances to its weakest link. */
const TRUST_ORDER: SkillProvenance[] = ['self', 'extracted', 'endorsed', 'verified'];

/**
 * The weakest provenance among the skills this person actually brings to a
 * set of requirements — the honest thing to show beside a score the engine
 * has already discounted. `'unknown'` when the covering skills carry no
 * provenance at all (the seeded pool, which the engine trusts whole);
 * `'none'` when nothing the person has contributes.
 */
export function coveringProvenance(
  person: Person,
  reqs: Requirement[],
): SkillProvenance | 'unknown' | 'none' {
  const provs: (SkillProvenance | 'unknown')[] = [];
  for (const ps of person.skills) {
    if (reqs.some((r) => sim(ps.skillId, r.skillId) > 0)) provs.push(ps.provenance ?? 'unknown');
  }
  if (provs.length === 0) return 'none';
  const known = provs.filter((p): p is SkillProvenance => p !== 'unknown');
  if (known.length === 0) return 'unknown';
  return known.reduce((w, p) => (TRUST_ORDER.indexOf(p) < TRUST_ORDER.indexOf(w) ? p : w));
}

/** How well one person satisfies one requirement, 0..1. */
export function satisfaction(person: Person, req: Requirement): number {
  let best = 0;
  for (const ps of person.skills) {
    const s = sim(ps.skillId, req.skillId);
    if (s === 0) continue;
    // Discount an unverified level before it is measured against the bar,
    // then let level clear the bar, then similarity scales it. A merely
    // adjacent skill can never count as fully covering the requirement.
    const level = ps.level * skillTrust(ps);
    const v = clamp(Math.min(level / req.minLevel, 1) * s);
    if (v > best) best = v;
  }
  return best;
}

/**
 * How many members individually clear the bar on a requirement.
 *
 * `coverage()` only asks whether *someone* covers each requirement — it takes
 * the max. This asks how many, which is the difference between a team that
 * survives one person leaving and one that does not. One person covering
 * Kubernetes and three covering it score identically until you count them.
 */
export function coveringCount(members: Person[], req: Requirement, bar = 0.5): number {
  let n = 0;
  for (const m of members) if (satisfaction(m, req) >= bar) n++;
  return n;
}

/** Weighted share of requirements a group of people covers, 0..1. */
export function coverage(reqs: Requirement[], members: Person[]): number {
  let num = 0;
  let den = 0;
  for (const r of reqs) {
    let best = 0;
    for (const m of members) {
      const v = satisfaction(m, r);
      if (v > best) best = v;
    }
    num += r.weight * best;
    den += r.weight;
  }
  return den === 0 ? 0 : num / den;
}

export function allRequirements(brief: Brief): Requirement[] {
  return brief.roles.flatMap((r) => r.requirements);
}

const workWindow = (p: Person): [number, number] => [9 - p.utcOffset, 17 - p.utcOffset];

/** Hours per week the whole group is actually awake at the same time. */
export function teamOverlapHours(members: Person[]): number {
  if (members.length === 0) return 0;
  let lo = -Infinity;
  let hi = Infinity;
  for (const m of members) {
    const [a, b] = workWindow(m);
    lo = Math.max(lo, a);
    hi = Math.min(hi, b);
  }
  const weekly = Math.max(0, hi - lo) * 5;
  const cap = Math.min(...members.map((m) => m.hoursPerWeek));
  return Math.round(Math.min(weekly, cap));
}

/**
 * The whole idea, in one number: the share of what the team is still
 * missing that this person would close. A second frontend dev lands near
 * zero once you already have one.
 */
export function marginalGain(person: Person, brief: Brief, members: Person[]): number {
  const reqs = allRequirements(brief);
  const before = coverage(reqs, members);
  const remaining = 1 - before;
  if (remaining <= 0.0001) return 0;
  const after = coverage(reqs, [...members, person]);
  return clamp((after - before) / remaining);
}

/** How much this one person covers this one role, ignoring the team. */
export function roleMatch(person: Person, role: Role): number {
  return coverage(role.requirements, [person]);
}

function redundancy(person: Person, members: Person[]): number {
  if (members.length === 0) return 0;
  const top = [...person.skills].sort((a, b) => b.level - a.level).slice(0, 5);
  if (top.length === 0) return 0;
  let covered = 0;
  for (const ps of top) {
    const already = members.some((m) =>
      m.skills.some((ms) => sim(ms.skillId, ps.skillId) >= 0.7 && ms.level >= ps.level - 1),
    );
    if (already) covered++;
  }
  return covered / top.length;
}

function interestFit(person: Person, brief: Brief): number {
  if (brief.domain.length === 0) return 0.5;
  let best = 0;
  for (const d of brief.domain) {
    for (const i of person.interests) {
      const s = i === d ? 1 : sim(i, d);
      if (s > best) best = s;
    }
  }
  return clamp(0.25 + best * 0.75);
}

function experienceFit(person: Person, role: Role): number {
  const target =
    role.requirements.reduce((a, r) => a + r.minLevel, 0) / Math.max(1, role.requirements.length);
  return clamp(1 - Math.abs(person.seniority - target) / 4);
}

export function scoreCandidate(
  person: Person,
  role: Role,
  brief: Brief,
  members: Person[],
): ScoreBreakdown {
  const gapFill = marginalGain(person, brief, members);
  const fitsSeat = roleMatch(person, role);

  const hoursScore = clamp(person.hoursPerWeek / Math.max(1, role.hoursNeeded));
  const overlapScore = clamp(teamOverlapHours([...members, person]) / 5);
  const availability = 0.6 * hoursScore + 0.4 * overlapScore;

  const experience = experienceFit(person, role);
  const interest = interestFit(person, brief);
  const red = redundancy(person, members);

  // gapFill still leads, so complementarity drives the ranking. fitsSeat
  // stops the optimiser parking a designer in the backend chair.
  const total = clamp(
    0.34 * gapFill +
      0.26 * fitsSeat +
      0.16 * availability +
      0.12 * experience +
      0.12 * interest -
      0.2 * red,
  );

  return { gapFill, availability, experience, interest, redundancy: red, total };
}
