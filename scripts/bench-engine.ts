/**
 * Engine scale benchmark.
 *
 * 60 people is nothing. This runs the real ranking and assembly passes over
 * synthetic rosters up to 10,000 and prints how long each takes, so
 * "Efficiency" is a number someone measured rather than a claim. Pure — the
 * engine has no IO, so this is just calling it in a loop and reading a clock.
 *
 *   npx tsx scripts/bench-engine.ts
 */
import { fallbackBrief } from '../lib/ai/fallback';
import { autoFill, rankCandidates } from '../lib/engine/assemble';
import { diagnoseRole } from '../lib/engine/feasibility';
import { teamHealth } from '../lib/engine/health';
import { proposeTeams } from '../lib/engine/options';
import { SKILLS } from '../lib/engine/graph';
import type { Brief, Person } from '../lib/types';

// A tiny deterministic PRNG so every run measures the same work.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const SKILL_IDS = SKILLS.map((s) => s.id);

function makePool(n: number): Person[] {
  const rand = rng(42);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const people: Person[] = [];
  for (let i = 0; i < n; i++) {
    const count = 3 + Math.floor(rand() * 6);
    const skills = new Map<string, number>();
    for (let k = 0; k < count; k++) skills.set(pick(SKILL_IDS), 1 + Math.floor(rand() * 5));
    people.push({
      id: 'p' + i,
      name: 'Person ' + i,
      title: '',
      companyId: 'c' + (i % 12),
      office: 'o' + (i % 8),
      utcOffset: [-8, -5, 0, 1, 5.5, 8][i % 6],
      yearsExp: Math.floor(rand() * 20),
      seniority: 1 + Math.floor(rand() * 5),
      skills: [...skills].map(([skillId, level]) => ({ skillId, level })),
      interests: [],
      hoursPerWeek: 10 + Math.floor(rand() * 30),
      contact: { email: '', slack: '', linkedin: '' },
      openToProjects: rand() > 0.15,
      hue: Math.floor(rand() * 360),
    });
  }
  return people;
}

const TEXT =
  'Internal tool that turns customer support tickets into weekly theme reports. Six weeks. It needs to ship.';
const brief: Brief = { text: TEXT, ...fallbackBrief(TEXT) };
const role = brief.roles[0];
const scope = { companyId: null, office: null };

function ms(fn: () => void): number {
  const t = performance.now();
  fn();
  return Math.round((performance.now() - t) * 100) / 100;
}

console.log('\n  n        rankCandidates   autoFill   proposeTeams   diagnoseRole   teamHealth');
console.log('  ' + '-'.repeat(78));

for (const n of [100, 1000, 10000]) {
  const pool = makePool(n);
  const emptyTeam = Object.fromEntries(brief.roles.map((r) => [r.id, null]));

  const tRank = ms(() =>
    rankCandidates(pool, role, brief, emptyTeam, { sort: 'bestFit', scope, search: '', minHours: 0 }),
  );
  const tFill = ms(() => autoFill(brief, pool, scope));
  const tOpts = ms(() => proposeTeams(brief, pool, scope));
  const tDiag = ms(() => diagnoseRole(pool, role));
  const tHealth = ms(() => teamHealth(brief, pool.slice(0, brief.roles.length), brief.roles.length));

  console.log(
    `  ${String(n).padEnd(8)} ${String(tRank + ' ms').padEnd(16)} ${String(tFill + ' ms').padEnd(10)} ` +
      `${String(tOpts + ' ms').padEnd(14)} ${String(tDiag + ' ms').padEnd(14)} ${tHealth} ms`,
  );
}

console.log('\n  Pure synchronous TypeScript, one thread, no IO.\n');
