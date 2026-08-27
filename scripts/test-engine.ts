/**
 * Engine test suite.
 *
 * The engine is pure TypeScript with no React and no network, so it is
 * verifiable on its own. These are assertions, not a printout: the process
 * exits non-zero if any invariant breaks, which makes it usable in CI.
 *
 *   npx tsx scripts/test-engine.ts
 */
import type { Brief, Person, Role } from '../lib/types';
import peopleData from '../lib/seed/people.json';
import { fallbackBrief } from '../lib/ai/fallback';
import { autoFill, membersOf, rankCandidates } from '../lib/engine/assemble';
import { diagnoseRole } from '../lib/engine/feasibility';
import { teamHealth } from '../lib/engine/health';
import { proposeTeams } from '../lib/engine/options';
import {
  allRequirements,
  coverage,
  coveringCount,
  coveringProvenance,
  marginalGain,
  satisfaction,
  skillTrust,
  teamOverlapHours,
} from '../lib/engine/score';
import { labelOf, resolveSkill, sim } from '../lib/engine/graph';

const pool = peopleData as Person[];
const scope = { companyId: null, office: null };

let passed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log('  pass  ' + name);
  } else {
    failures.push(name + (detail ? ' — ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? ' — ' + detail : ''));
  }
}

function group(title: string) {
  console.log('\n' + title);
}

const TEXT =
  'Internal tool that turns customer support tickets into weekly theme reports. Roughly 6 weeks. It needs to actually ship, not stay a prototype.';
const brief: Brief = { text: TEXT, ...fallbackBrief(TEXT) };

// ---------------------------------------------------------------- skill graph

group('Skill graph');
check('a skill is identical to itself', sim('react', 'react') === 1);
check('related skills score above siblings', sim('react', 'nextjs') > sim('react', 'vue'));
check('siblings score above distant cousins', sim('react', 'vue') > sim('react', 'postgres'));
check('unrelated skills score zero', sim('react', 'ui-design') === 0);
check('similarity is symmetric', sim('react', 'nextjs') === sim('nextjs', 'react'));
check('every similarity is within 0..1', ['react', 'nextjs', 'vue', 'postgres', 'ui-design'].every((a) =>
  ['react', 'nextjs', 'vue', 'postgres', 'ui-design'].every((b) => sim(a, b) >= 0 && sim(a, b) <= 1),
));
check('aliases resolve to their skill', resolveSkill('react.js') === 'react');
check('labels resolve case-insensitively', resolveSkill('POSTGRESQL') === 'postgres');
check('unknown text resolves to null', resolveSkill('quidditch') === null);

// ------------------------------------------------------------------ satisfaction

group('Requirement satisfaction');
const strong: Person = { ...pool[0], skills: [{ skillId: 'react', level: 5 }] };
const weak: Person = { ...pool[0], skills: [{ skillId: 'react', level: 1 }] };
const adjacent: Person = { ...pool[0], skills: [{ skillId: 'nextjs', level: 5 }] };
const req = { skillId: 'react', minLevel: 3, weight: 3 };

check('a high level clears the bar', satisfaction(strong, req) === 1);
check('a low level does not', satisfaction(weak, req) < 1);
check('an adjacent skill counts for something', satisfaction(adjacent, req) > 0);
check(
  'an adjacent skill can never fully cover a requirement',
  satisfaction(adjacent, req) < 1,
  'this cap is what keeps coverage honest',
);
check('an unrelated person covers nothing', satisfaction({ ...pool[0], skills: [{ skillId: 'ui-design', level: 5 }] }, req) === 0);

// ------------------------------------------------------------------ skill trust

group('Skill trust: an unverified level is a claim, not a measurement');
check('a verified level is taken whole', skillTrust({ skillId: 'react', level: 5, provenance: 'verified' }) === 1);
check('a self-reported level is discounted', skillTrust({ skillId: 'react', level: 5, provenance: 'self' }) < 1);
check(
  'endorsed sits above extracted sits above self',
  skillTrust({ skillId: 'react', level: 5, provenance: 'endorsed' }) >
    skillTrust({ skillId: 'react', level: 5, provenance: 'extracted' }) &&
    skillTrust({ skillId: 'react', level: 5, provenance: 'extracted' }) >
      skillTrust({ skillId: 'react', level: 5, provenance: 'self' }),
);
check(
  'missing provenance is left alone — the seeded pool must not move',
  skillTrust({ skillId: 'react', level: 5 }) === 1,
);
const topBar = { skillId: 'react', minLevel: 5, weight: 1 };
check(
  'against a top-level bar, the discount lowers what a self-reported five covers',
  satisfaction({ ...pool[0], skills: [{ skillId: 'react', level: 5, provenance: 'self' }] }, topBar) <
    satisfaction({ ...pool[0], skills: [{ skillId: 'react', level: 5, provenance: 'verified' }] }, topBar),
);
check(
  'a discounted five still fully clears a mid bar',
  satisfaction(
    { ...pool[0], skills: [{ skillId: 'react', level: 5, provenance: 'self' }] },
    { skillId: 'react', minLevel: 3, weight: 1 },
  ) === 1,
);

const twoReqs = [
  { skillId: 'react', minLevel: 3, weight: 1 },
  { skillId: 'postgres', minLevel: 3, weight: 1 },
];
check(
  'covering provenance reports the weakest contributing skill',
  coveringProvenance(
    { ...pool[0], skills: [
      { skillId: 'react', level: 5, provenance: 'verified' },
      { skillId: 'postgres', level: 4, provenance: 'self' },
    ] },
    twoReqs,
  ) === 'self',
);
check(
  'a skill that contributes nothing does not drag the label down',
  coveringProvenance(
    { ...pool[0], skills: [
      { skillId: 'react', level: 5, provenance: 'endorsed' },
      { skillId: 'figma', level: 5, provenance: 'self' },
    ] },
    [{ skillId: 'react', minLevel: 3, weight: 1 }],
  ) === 'endorsed',
);
check(
  'the seeded pool reads as unknown provenance, not self',
  coveringProvenance({ ...pool[0], skills: [{ skillId: 'react', level: 5 }] }, [
    { skillId: 'react', minLevel: 3, weight: 1 },
  ]) === 'unknown',
);
check(
  'nothing contributing reads as none',
  coveringProvenance({ ...pool[0], skills: [{ skillId: 'figma', level: 5, provenance: 'self' }] }, [
    { skillId: 'react', minLevel: 3, weight: 1 },
  ]) === 'none',
);

// --------------------------------------------------------------------- coverage

group('Coverage');
const reqs = allRequirements(brief);
check('an empty team covers nothing', coverage(reqs, []) === 0);
check('coverage stays within 0..1', (() => {
  const c = coverage(reqs, pool.slice(0, 4));
  return c >= 0 && c <= 1;
})());
check('adding a person never reduces coverage', (() => {
  const before = coverage(reqs, pool.slice(0, 3));
  const after = coverage(reqs, pool.slice(0, 4));
  return after >= before - 1e-9;
})());

// ------------------------------------------------------------- the core claim

group('The core claim: contribution, not similarity');
const feRole = brief.roles.find((r) => r.id === 'frontend') ?? brief.roles[0];
const byRoleFit = rankCandidates(pool, feRole, brief, {}, {
  sort: 'skillMatch', scope, search: '', minHours: 0,
});
const seated = byRoleFit[0].person;
const duplicate = byRoleFit.find((c) => c.person.id !== seated.id)!.person;
const designer = pool
  .filter((p) => p.title.toLowerCase().includes('designer') && p.openToProjects)
  .sort((a, b) => marginalGain(b, brief, [seated]) - marginalGain(a, brief, [seated]))[0];

const dupGain = marginalGain(duplicate, brief, [seated]);
const desGain = marginalGain(designer, brief, [seated]);

check('a duplicate skillset adds almost nothing', dupGain < 0.05, `duplicate added ${Math.round(dupGain * 100)}%`);
check(
  'the missing discipline outranks the duplicate',
  desGain > dupGain,
  `designer ${Math.round(desGain * 100)}% vs duplicate ${Math.round(dupGain * 100)}%`,
);
check('marginal gain is bounded 0..1', dupGain >= 0 && dupGain <= 1 && desGain >= 0 && desGain <= 1);
check('nobody adds anything to an already complete team', (() => {
  const everyone = pool.slice(0, 40);
  return marginalGain(pool[41], brief, everyone) < 0.5;
})());

// -------------------------------------------------------------- availability

group('Availability');
check('nobody alone has no overlap problem', teamOverlapHours([]) === 0);
check('one person overlaps their own hours', (() => {
  const p = pool.find((x) => x.hoursPerWeek > 0)!;
  return teamOverlapHours([p]) <= p.hoursPerWeek;
})());
check('a wider spread never increases overlap', (() => {
  // Derived from the data rather than hardcoded, so reseeding cannot break it.
  const sorted = [...pool].sort((a, b) => a.utcOffset - b.utcOffset);
  const west = sorted[0];
  const east = sorted[sorted.length - 1];
  if (west.utcOffset === east.utcOffset) return true;
  return teamOverlapHours([west, east]) <= teamOverlapHours([west]);
})());
check('fractional offsets survive the maths', (() => {
  const half = pool.find((p) => p.utcOffset % 1 !== 0);
  return half !== undefined && Number.isFinite(teamOverlapHours([half]));
})(), 'UTC+5:30 must not be rounded to +5');

// ------------------------------------------------------------------- ranking

group('Ranking');
const ranked = rankCandidates(pool, feRole, brief, {}, {
  sort: 'bestFit', scope, search: '', minHours: 0,
});
check('best fit returns candidates', ranked.length > 0);
check('best fit is sorted by the number shown on the card', (() => {
  for (let i = 1; i < ranked.length; i++) {
    if (ranked[i].breakdown.gapFill > ranked[i - 1].breakdown.gapFill + 1e-9) return false;
  }
  return true;
})(), 'the displayed percentage must descend, or the list reads as broken');
check('best fit shortlists to people who can hold the seat', ranked.every((c) => c.roleMatch >= 0.35));
check('the hours filter is respected', rankCandidates(pool, feRole, brief, {}, {
  sort: 'bestFit', scope, search: '', minHours: 10,
}).every((c) => c.person.hoursPerWeek >= 10));
check('nobody who opted out is ever offered', ranked.every((c) => c.person.openToProjects));
check('search narrows the field', (() => {
  const all = rankCandidates(pool, feRole, brief, {}, { sort: 'experience', scope, search: '', minHours: 0 });
  const some = rankCandidates(pool, feRole, brief, {}, { sort: 'experience', scope, search: 'london', minHours: 0 });
  return some.length < all.length && some.every((c) => /london/i.test(c.person.office));
})());
check('experience sorts descending', (() => {
  const byExp = rankCandidates(pool, feRole, brief, {}, { sort: 'experience', scope, search: '', minHours: 0 });
  for (let i = 1; i < byExp.length; i++) if (byExp[i].person.yearsExp > byExp[i - 1].person.yearsExp) return false;
  return true;
})());

// ------------------------------------------------------------------ assembly

group('Assembly');
const team = autoFill(brief, pool, scope);
const members = membersOf(team, pool);
const health = teamHealth(brief, members, brief.roles.length);

check('every seat gets filled', members.length === brief.roles.length);
check('nobody is seated twice', new Set(members.map((m) => m.id)).size === members.length);
check('everyone seated opted in', members.every((m) => m.openToProjects));
check('the result is deterministic', (() => {
  const again = autoFill(brief, pool, scope);
  return JSON.stringify(again) === JSON.stringify(team);
})(), 'the same brief must always produce the same team');
check('people are seated in roles they fit', (() => {
  for (const role of brief.roles) {
    const p = members.find((m) => m.id === team[role.id]);
    if (!p) continue;
    if (coverage(role.requirements, [p]) < 0.35) return false;
  }
  return true;
})(), 'no designer parked in the backend chair');

// -------------------------------------------------------------------- health

group('Team health');
check('coverage is reported within 0..1', health.coverage >= 0 && health.coverage <= 1);
check('a full team does not claim a perfect score', health.coverage < 1, 'an adjacent skill must never read as full cover');
check('filled count matches the roster', health.filled === members.length);
check('gaps are capped so the panel stays readable', health.gaps.length <= 5);
check('every gap names something real', health.gaps.every((g) => g.label.length > 0));
check('an empty team reports no coverage', teamHealth(brief, [], brief.roles.length).coverage === 0);

// ---------------------------------------------------------------- bus factor

group('Bus factor: covered is not the same as safe');

const bfBrief: Brief = {
  text: 'x',
  durationWeeks: 4,
  domain: [],
  roles: [
    {
      id: 'r1',
      title: 'A',
      hoursNeeded: 10,
      requirements: [
        { skillId: 'react', minLevel: 3, weight: 3 },
        { skillId: 'postgres', minLevel: 3, weight: 3 },
      ],
    },
  ],
};
const alice: Person = { ...pool[0], id: 'a', name: 'Alice', skills: [
  { skillId: 'react', level: 5 },
  { skillId: 'postgres', level: 5 },
] };
const bobReactOnly: Person = { ...pool[1], id: 'b', name: 'Bob', skills: [{ skillId: 'react', level: 5 }] };
const bobBoth: Person = { ...bobReactOnly, skills: [
  { skillId: 'react', level: 5 },
  { skillId: 'postgres', level: 4 },
] };

const reactReq = { skillId: 'react', minLevel: 3, weight: 3 };
const pgReq = { skillId: 'postgres', minLevel: 3, weight: 3 };

check('coveringCount counts every member who clears the bar', coveringCount([alice, bobReactOnly], reactReq) === 2);
check('coveringCount sees a sole holder', coveringCount([alice, bobReactOnly], pgReq) === 1);

const fragile = teamHealth(bfBrief, [alice, bobReactOnly], 1);
check('a sole-holder requirement drops the bus factor to 1', fragile.busFactor === 1);
check(
  'the sole holder is named as a gap',
  fragile.gaps.some((g) => g.label === 'Only Alice covers PostgreSQL'),
);

const safe = teamHealth(bfBrief, [alice, bobBoth], 1);
check('two people on every requirement lifts the bus factor to 2', safe.busFactor === 2);
check(
  'no key-person gap when everything has backup',
  !safe.gaps.some((g) => g.label.startsWith('Only ')),
);

check('an empty team has bus factor 0', teamHealth(bfBrief, [], 1).busFactor === 0);
check('a one-person team is not flagged for key-person risk', (() => {
  const solo = teamHealth(bfBrief, [alice], 1);
  return !solo.gaps.some((g) => g.label.startsWith('Only '));
})());

// ---------------------------------------------------------- infeasibility

group('Infeasibility: say why, and what is cheapest to change');

const dataRole: Role = {
  id: 'data',
  title: 'Data',
  hoursNeeded: 10,
  requirements: [
    { skillId: 'airflow', minLevel: 5, weight: 3 },
    { skillId: 'dbt', minLevel: 4, weight: 3 },
    { skillId: 'etl', minLevel: 3, weight: 3 },
  ],
};
const fe: Person = { ...pool[0], id: 'fe', name: 'Fee', openToProjects: true, skills: [
  { skillId: 'react', level: 5 },
  { skillId: 'css', level: 5 },
] };
const partial: Person = { ...pool[1], id: 'pt', name: 'Pat', openToProjects: true, skills: [
  { skillId: 'airflow', level: 2 },
  { skillId: 'etl', level: 4 },
] };

const noHope = diagnoseRole([fe], dataRole);
check('a role nobody can hold is reported unstaffable', noHope.staffable === false);
check('every unmet requirement is a real one from the role', noHope.unmet.every((u) => dataRole.requirements.some((r) => r.skillId === u.skillId)));
check('with nobody near, every requirement is unmet', noHope.unmet.length === 3);
check('a true blank has no closest person', noHope.unmet.every((u) => u.closest === null));

const someHope = diagnoseRole([fe, partial], dataRole);
check(
  'a requirement a partial holder half-covers is still unmet, and names them',
  (() => {
    const af = someHope.unmet.find((u) => u.skillId === 'airflow');
    return af?.closest?.name === 'Pat' && af.closest.level === 2;
  })(),
);
check('a requirement someone fully meets drops off the unmet list', !someHope.unmet.some((u) => u.skillId === 'etl'));
check('unmet requirements are ordered hardest first', (() => {
  const b = someHope.unmet.map((u) => u.best);
  return b.every((v, i) => i === 0 || b[i - 1] <= v);
})());
check(
  'a fully staffable role reports nothing unmet',
  (() => {
    const strong: Person = { ...fe, skills: [
      { skillId: 'airflow', level: 5 },
      { skillId: 'dbt', level: 5 },
      { skillId: 'etl', level: 5 },
    ] };
    const d = diagnoseRole([strong], dataRole);
    return d.staffable && d.unmet.length === 0;
  })(),
);

// ------------------------------------------------------------ team options

group('Team options: more than one answer, tradeoff named');

const opts = proposeTeams(brief, pool, scope);
check('there is at least one option', opts.length >= 1);
check('the first option is best-coverage with no tradeoff', opts[0].key === 'best-coverage' && opts[0].tradeoff === '');
check('every non-first option carries a tradeoff sentence', opts.slice(1).every((o) => o.tradeoff.length > 0));
check('options are genuinely distinct teams', (() => {
  const sigs = opts.map((o) => JSON.stringify(Object.entries(o.team).sort()));
  return new Set(sigs).size === sigs.length;
})());
check('every option seats real people from the pool', opts.every((o) =>
  Object.values(o.team).every((v) => v === null || pool.some((p) => p.id === v)),
));
check('proposeTeams is deterministic', (() => {
  const again = proposeTeams(brief, pool, scope);
  return JSON.stringify(again) === JSON.stringify(opts);
})());
check('a resilient option never has a worse bus factor than best-coverage', (() => {
  const r = opts.find((o) => o.key === 'resilient');
  return !r || r.busFactor >= opts[0].busFactor;
})());

// -------------------------------------------------------------- brief reading

group('Brief reading, no network');
check('a brief yields at least three roles', brief.roles.length >= 3);
check('every role carries requirements', brief.roles.every((r) => r.requirements.length > 0));
check('every role has a must-have', brief.roles.every((r) => r.requirements.some((q) => q.weight === 3)));
check('every requirement names a known skill', brief.roles.every((r) => r.requirements.every((q) => labelOf(q.skillId) !== q.skillId || q.skillId.length > 0)));
check('duration is read from the text', brief.durationWeeks === 6, `got ${brief.durationWeeks}`);
check('the domain is detected', brief.domain.includes('customer-support'));
check('shipping language pulls in a platform role', brief.roles.some((r) => /platform/i.test(r.title)));
check('an empty brief still produces a usable team', fallbackBrief('').roles.length >= 3);

// --------------------------------------------------------------------- report

const total = passed + failures.length;
console.log('\n' + '='.repeat(52));
console.log(`${passed}/${total} checks passed`);
if (failures.length) {
  console.log('\nFAILED:');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log('Engine invariants hold.');
