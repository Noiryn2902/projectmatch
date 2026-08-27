import type { Brief, Person, ScopeFilter, TeamState } from '../types';

/**
 * What a keyword filter picks. The strawman — and the whole persuasion case.
 *
 * This is how staffing is done without an engine: match the role's required
 * skill *words* against the words on each person, take whoever has the most,
 * fill the next seat with whoever has the most of that seat's words, and so
 * on. No skill graph, so "Next.js" does not count for "React". No levels
 * beyond present/absent. No availability. No awareness of who is already on
 * the team — so the second-best frontend developer still looks great for the
 * frontend seat even though the first one already covers it.
 *
 * `autoFill` beats this on coverage, on key-person risk, and on overlap, for
 * the same brief and the same roster. That comparison is the pitch.
 */
export function keywordTeam(brief: Brief, pool: Person[], scope: ScopeFilter): TeamState {
  const team: TeamState = Object.fromEntries(brief.roles.map((r) => [r.id, null]));

  const eligible = pool.filter(
    (p) =>
      p.openToProjects &&
      (!scope.companyId || p.companyId === scope.companyId) &&
      (!scope.office || p.office === scope.office),
  );

  // How a "find people for this project" search actually works: every skill
  // word anywhere in the brief goes into one query, and people are ranked by
  // how many of those words they carry, then by seniority. The brief's own
  // structure — which skill belongs to which seat — is lost.
  const allWanted = new Set(brief.roles.flatMap((r) => r.requirements.map((req) => req.skillId)));
  const hitsOf = (p: Person) => p.skills.reduce((n, s) => n + (allWanted.has(s.skillId) ? 1 : 0), 0);

  const ranked = [...eligible].sort(
    (a, b) => hitsOf(b) - hitsOf(a) || b.seniority - a.seniority || a.id.localeCompare(b.id),
  );

  // Walk the seats in brief order, giving each to the highest-ranked person
  // left who carries at least one of that seat's words.
  const taken = new Set<string>();
  for (const role of brief.roles) {
    const wanted = new Set(role.requirements.map((req) => req.skillId));
    const pick = ranked.find(
      (p) => !taken.has(p.id) && p.skills.some((s) => wanted.has(s.skillId)),
    );
    if (pick) {
      team[role.id] = pick.id;
      taken.add(pick.id);
    }
  }

  return team;
}
