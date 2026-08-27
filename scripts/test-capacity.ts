/**
 * Capacity verdict — the rule for whether a person has room for one more
 * seat. Pure arithmetic, checkable without a database.
 *
 *   npx tsx scripts/test-capacity.ts
 */
import { capacityVerdict } from '../lib/capacity';

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

console.log('\nCapacity verdict');

check('plenty of room reads clear', capacityVerdict(10, 8, 40) === 'clear');
check('landing exactly on the ceiling is not over', capacityVerdict(32, 8, 40) !== 'over');
check('being fully booked to the ceiling reads tight', capacityVerdict(32, 8, 40) === 'tight');
check('just over 90% of the ceiling reads tight', capacityVerdict(30, 7, 40) === 'tight');
check('past the ceiling reads over', capacityVerdict(35, 10, 40) === 'over');
check('already over stays over even adding nothing', capacityVerdict(45, 1, 40) === 'over');
check('no ceiling recorded means nothing to judge', capacityVerdict(80, 20, 0) === 'clear');
check('a fresh person with a light seat is clear', capacityVerdict(0, 5, 20) === 'clear');
check('a fresh person with a seat over their ceiling is over', capacityVerdict(0, 30, 20) === 'over');

console.log('\n' + '='.repeat(52));
if (failures.length === 0) {
  console.log(`${passed}/${passed} checks passed`);
  console.log('Capacity verdict holds.');
} else {
  console.log(`${passed} passed, ${failures.length} FAILED`);
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
