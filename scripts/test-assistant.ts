import { assistantReply, type Context } from '../lib/assistant';
import type { Person, Role, TeamHealth } from '../lib/types';

/**
 * What @assistant says, checked against known inputs.
 *
 * Worth a script rather than a glance because every reply lands in a team's
 * chat log where people quote it back at each other. A wrong number here is a
 * wrong decision later.
 */

const person = (name: string, utcOffset: number): Person =>
  ({ id: name, name, utcOffset, seniority: 3, contact: { email: `${name}@x.com` } }) as Person;

const role = (id: string): Role => ({ id }) as Role;

const health = (over: Partial<TeamHealth>): TeamHealth =>
  ({
    coverage: 0.61,
    filled: 2,
    seats: 4,
    overlapHours: 5,
    busFactor: 1,
    gaps: [],
    ...over,
  }) as TeamHealth;

const struggling: Context = {
  members: [person('Tomas', 5.5), person('Hassan', 5.5)],
  roles: [role('1'), role('2'), role('3'), role('4')],
  open: 2,
  health: health({
    gaps: [
      { label: 'No coverage for UI design', severity: 'high' },
      { label: 'Only Tomas Iyer covers API design', severity: 'high' },
      { label: 'Team overlap is only 5 hrs per week', severity: 'medium' },
    ],
  }),
};

const healthy: Context = {
  ...struggling,
  open: 0,
  health: health({ coverage: 1, gaps: [], busFactor: 2, filled: 4 }),
};

const split: Context = {
  ...struggling,
  members: [person('A', 5.5), person('B', -5)],
};

let failed = 0;
function check(label: string, reply: string, must: string[]) {
  const missing = must.filter((m) => !reply.includes(m));
  if (missing.length > 0) {
    failed++;
    console.log(`  FAIL  ${label}\n        missing ${JSON.stringify(missing)}\n        got: ${reply}`);
  } else {
    console.log(`  pass  ${label}`);
  }
}

console.log('\n@assistant\n');

check('names the coverage and the open seats', assistantReply('what are we still missing?', struggling), [
  '61%',
  '2 seats are still open',
  'No coverage for UI design',
]);

check('separates high severity from the rest', assistantReply('where are we weak', struggling), [
  'gaps that matter most',
  'Also worth knowing',
]);

check('names the single point of failure', assistantReply('who are we depending on?', struggling), [
  'Bus factor is 1',
  'Only Tomas Iyer covers API design',
]);

check('gives a real meeting window', assistantReply('when can we meet?', struggling), [
  'UTC works for everyone',
  '5 hours a week',
]);

check('admits when there is no window', assistantReply('when can we meet?', split), [
  'no hour of the day everyone is awake for',
]);

check('summarises on status', assistantReply('status', struggling), [
  '2 of 4 seats accepted',
  '61% of the brief covered',
]);

check('says nothing is missing when nothing is', assistantReply('what are we missing', healthy), [
  'Nothing I can see',
  '100%',
]);

check('clears the risk answer when the team is spread', assistantReply('any risk?', healthy), [
  'Nothing rests on a single person',
]);

check('refuses to guess at an unknown question', assistantReply('write me a poem', struggling), [
  'I can only tell you a few things',
]);

check('strips the mention before matching', assistantReply('@assistant status', struggling), [
  'seats accepted',
]);

console.log(
  failed === 0 ? '\nAll assistant replies check out.\n' : `\n${failed} failed.\n`,
);
process.exit(failed === 0 ? 0 : 1);
