import type { Brief, Person } from '../lib/types';
import peopleData from '../lib/data/people.json';
import { fallbackBrief } from '../lib/ai/fallback';
import { autoFill, membersOf, rankCandidates } from '../lib/engine/assemble';
import { teamHealth } from '../lib/engine/health';
import { marginalGain, coverage, allRequirements } from '../lib/engine/score';
import { labelOf, sim } from '../lib/engine/graph';

const pool = peopleData as Person[];
const scope = { companyId: null, office: null };

const text =
  'Internal tool that turns customer support tickets into weekly theme reports. Roughly 6 weeks. It needs to actually ship, not stay a prototype.';
const brief: Brief = { text, ...fallbackBrief(text) };

console.log('=== BRIEF ===');
console.log('duration:', brief.durationWeeks, 'weeks   domain:', brief.domain.join(', ') || 'none');
console.log('roles:', brief.roles.map((r) => r.title).join(' | '));

console.log('\n=== SKILL GRAPH SANITY ===');
const pairs: [string, string][] = [
  ['react', 'nextjs'],
  ['react', 'vue'],
  ['react', 'postgres'],
  ['llm', 'nlp'],
  ['figma', 'ui-design'],
  ['react', 'ui-design'],
];
for (const [a, b] of pairs) {
  console.log('  ' + labelOf(a).padEnd(12) + ' ~ ' + labelOf(b).padEnd(12) + ' = ' + sim(a, b));
}

console.log('\n=== AUTO-FILLED TEAM ===');
const team = autoFill(brief, pool, scope);
const members = membersOf(team, pool);
for (const r of brief.roles) {
  const p = pool.find((x) => x.id === team[r.id]);
  console.log(
    '  ' + r.title.padEnd(20) + (p ? p.name.padEnd(20) + p.title + '  ' + p.hoursPerWeek + 'h  ' + p.office : 'UNFILLED'),
  );
}

const health = teamHealth(brief, members, brief.roles.length);
console.log('\ncoverage: ' + Math.round(health.coverage * 100) + '%   overlap: ' + health.overlapHours + ' hrs/week');
console.log('gaps:');
for (const g of health.gaps) console.log('  [' + g.severity + '] ' + g.label);

console.log('\n=== THE CORE CLAIM: does a duplicate add nothing? ===');
const feRole = brief.roles.find((r) => r.id === 'frontend') ?? brief.roles[0];
const empty = { companyId: null, office: null };
const fes = rankCandidates(pool, feRole, brief, {}, { sort: 'skillMatch', scope: empty, search: '', minHours: 0 });
const seated = fes[0].person;
const teamWithOne = [seated];

const nextFe = fes.find((c) => c.person.id !== seated.id)!.person;
const bestDesigner = pool
  .filter((p) => p.title.toLowerCase().includes('designer') && p.openToProjects)
  .sort((a, b) => marginalGain(b, brief, teamWithOne) - marginalGain(a, brief, teamWithOne))[0];

const show = (p: Person, note: string) =>
  console.log(
    '  ' +
      note.padEnd(22) +
      p.name.padEnd(20) +
      p.title.padEnd(28) +
      'adds ' +
      Math.round(marginalGain(p, brief, teamWithOne) * 100) +
      '%',
  );

console.log('seat 1 taken by: ' + seated.name + ' (' + seated.title + ')');
show(nextFe, 'next best same-skill');
show(bestDesigner, 'best designer');

console.log('\n=== GREEDY vs SWAP PASS ===');
const reqs = allRequirements(brief);
const greedyOnly: Record<string, string | null> = {};
const taken = new Set<string>();
for (const role of brief.roles) {
  const c = rankCandidates(pool, role, brief, greedyOnly, { sort: 'bestFit', scope, search: '', minHours: 0 }).find(
    (x) => !taken.has(x.person.id),
  );
  if (c) {
    greedyOnly[role.id] = c.person.id;
    taken.add(c.person.id);
  }
}
console.log('  greedy only : ' + Math.round(coverage(reqs, membersOf(greedyOnly, pool)) * 100) + '%');
console.log('  after swaps : ' + Math.round(coverage(reqs, members) * 100) + '%');
