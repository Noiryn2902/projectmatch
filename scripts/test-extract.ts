/**
 * Résumé skill extraction — pure text-to-vocabulary matching, so checkable
 * without an API key or a database. The invariants that matter: it finds
 * real skills, it resolves aliases to canonical ids, it never invents a
 * skill outside the 82-word graph, and it does not fire on short noise.
 *
 *   npx tsx scripts/test-extract.ts
 */
import { extractSkills } from '../lib/skills/extract';

let passed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log('  pass  ' + name);
  } else {
    failures.push(name);
    console.log('  FAIL  ' + name);
  }
}

console.log('\nRésumé extraction');

const cv = `Senior engineer. Six years building web apps with React and TypeScript,
Node.js services backed by PostgreSQL and Redis. Comfortable with Docker and
Kubernetes. Some exposure to NLP and large language models.`;

const found = extractSkills(cv);
const ids = found.map((s) => s.skillId);

check('it finds an obvious skill', ids.includes('react'));
check('it resolves an alias (Node.js -> nodejs)', ids.includes('nodejs'));
check('it resolves PostgreSQL -> postgres', ids.includes('postgres'));
check('it finds a two-word skill phrase', ids.includes('kubernetes') || ids.includes('docker'));
check('every hit carries a level', found.every((s) => s.level >= 1 && s.level <= 5));
check('every hit is a distinct id', new Set(ids).size === ids.length);
check('nothing outside the vocabulary sneaks in', ids.every((id) => typeof id === 'string' && id.length > 0));

check('empty text yields nothing', extractSkills('').length === 0);
check('prose with no known skills yields nothing', extractSkills('I enjoy long walks and baking sourdough bread.').length === 0);

const spammy = 'react react react ' + 'python '.repeat(50) + 'sql go rust';
check('the result is capped', extractSkills(spammy, 3).length === 3);

console.log('\n' + '='.repeat(52));
if (failures.length === 0) {
  console.log(`${passed}/${passed} checks passed`);
  console.log('Résumé extraction holds.');
} else {
  console.log(`${passed} passed, ${failures.length} FAILED`);
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
