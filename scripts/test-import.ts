/**
 * Roster import parsing — assertions over pure string logic.
 *
 * normaliseRoster() is what stands between a messy spreadsheet paste and the
 * database, so its behaviour on quoted commas, delimiter sniffing, unknown
 * columns, and the three kinds of duplicate is worth pinning down. No
 * database, no React — same shape as the engine suite.
 *
 *   npx tsx scripts/test-import.ts
 */
import { normaliseRoster, parseDelimited, parseSkillCell } from '../lib/import/roster';

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

// -------------------------------------------------------------- delimited text

group('Delimited text');

check(
  'a quoted field keeps its comma',
  parseDelimited('name,title\n"Doe, Jane",Engineer')[1][0] === 'Doe, Jane',
);
check(
  'a doubled quote is one literal quote',
  parseDelimited('name\n"She said ""hi"""')[1][0] === 'She said "hi"',
);
check(
  'tabs win when there are more of them than commas',
  parseDelimited('name\ttitle\nJane\tHead, Product')[1][1] === 'Head, Product',
);
check('blank lines are dropped', parseDelimited('name\n\n\nJane\n').length === 2);
check(
  'a quoted newline stays inside the field',
  parseDelimited('name,note\nJane,"line one\nline two"')[1][1] === 'line one\nline two',
);

// ------------------------------------------------------------------- normalise

group('Roster normalisation');

const basic = normaliseRoster(
  `Full Name,Job Title,Hrs,Level,Team,Nickname
Priya Nair,Backend Engineer,32,4,Platform,Pri
Sam Doe,,60,9,,`,
);

check('a header alias maps to the canonical field', basic.recognised.includes('name'));
check('title alias is recognised', basic.recognised.includes('title'));
check('hours alias is recognised', basic.recognised.includes('hoursPerWeek'));
check('an unknown column is reported as ignored', basic.ignored.includes('Nickname'));
check('hours are clamped to the allowed range', basic.rows[1].hoursPerWeek === 40);
check('seniority is clamped to 1..5', basic.rows[1].seniority === 5);
check('a present-but-empty title is just empty', basic.rows[1].title === '');
check('two good rows both count as ok', basic.counts.ok === 2);

const dups = normaliseRoster(
  `name,title
Ana Costa,Data
ana costa,Data Scientist
,Nobody
Bo Lang,First
Bo Lang,Second`,
  new Set(['ana costa']),
);
check('a name already on the roster is dup-roster', dups.rows[0].status === 'dup-roster');
check('a case-different repeat of it is also caught', dups.rows[1].status === 'dup-roster');
check('a row with no name is invalid', dups.rows[2].status === 'invalid');
check('the first sight of a fresh name is ok', dups.rows[3].status === 'ok');
check('a later in-file repeat is dup-file', dups.rows[4].status === 'dup-file');
check(
  'the counts add up',
  dups.counts.dupRoster === 2 &&
    dups.counts.invalid === 1 &&
    dups.counts.dupFile === 1 &&
    dups.counts.ok === 1,
);

const soft = normaliseRoster(`name,email\nJo,not-an-email`);
check('a malformed email warns but still imports', soft.rows[0].status === 'ok' && soft.rows[0].note !== '');

// -------------------------------------------------------------------- skills

group('Skill cells');

const sc = parseSkillCell('react:4, node.js 3; sql');
check('a colon level is read', sc.skills.some((s) => s.skillId === 'react' && s.level === 4));
check('a space level is read', sc.skills.some((s) => s.skillId === 'nodejs' && s.level === 3));
check('a bare skill defaults to level 3', sc.skills.some((s) => s.skillId === 'sql' && s.level === 3));
check('an alias resolves to its canonical id', !sc.skills.some((s) => s.skillId === 'node.js'));

const sc2 = parseSkillCell('React, react 5, quidditch, ');
check('a repeated skill is only counted once', sc2.skills.filter((s) => s.skillId === 'react').length === 1);
check('an unknown word is reported, not guessed', sc2.unknown.includes('quidditch'));
check('an empty token is skipped', sc2.skills.length === 1);

const withSkills = normaliseRoster(
  `name,skills
Nadia,"typescript:5, postgres:3, wizardry"`,
);
check('recognised skills ride along on the row', withSkills.rows[0].skills.length === 2);
check('the skills column is recognised', withSkills.recognised.includes('skills'));
check('unrecognised skill words are held on the row', withSkills.rows[0].unknownSkills.includes('wizardry'));
check('the row note counts the skills', withSkills.rows[0].note.includes('2 skills'));
check('a row with skills is still importable', withSkills.rows[0].status === 'ok');

check('text with no data rows yields nothing', normaliseRoster('name,title').rows.length === 0);
check('empty input yields nothing', normaliseRoster('').rows.length === 0);

// ---------------------------------------------------------------------- report

console.log('\n' + '='.repeat(52));
if (failures.length === 0) {
  console.log(`${passed}/${passed} checks passed`);
  console.log('Roster import parsing holds.');
} else {
  console.log(`${passed} passed, ${failures.length} FAILED`);
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
