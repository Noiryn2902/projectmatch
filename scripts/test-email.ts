/**
 * Invitation email construction — pure string work, so checkable without a
 * mail provider. The one that matters is escaping: a brief or a personal note
 * is user-controlled text and must not be able to inject markup into the
 * HTML body.
 *
 *   npx tsx scripts/test-email.ts
 */
import { buildInvitationEmail } from '../lib/email/build';

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

const base = {
  personName: 'Priya Nair',
  orgName: 'Test Co',
  roleTitle: 'Backend Engineer',
  projectBrief: 'A tool that turns support tickets into weekly theme reports.',
  message: null as string | null,
  link: 'https://example.com/invite/abc123',
};

console.log('\nInvitation email');

const plain = buildInvitationEmail(base);
check('the subject names the org', plain.subject.includes('Test Co'));
check('the link is in the text body', plain.text.includes(base.link));
check('the link is in the html body', plain.html.includes(base.link));
check('the role appears', plain.html.includes('Backend Engineer'));
check('no personal note means no note markup', !plain.html.includes('&ldquo;'));

const withNote = buildInvitationEmail({ ...base, message: 'We loved your last project.' });
check('a personal note is included when present', withNote.text.includes('We loved your last project.'));

const nasty = buildInvitationEmail({
  ...base,
  projectBrief: 'Ship <script>alert(1)</script> fast',
  message: '<img src=x onerror=alert(1)>',
});
check('a script tag in the brief is escaped', !nasty.html.includes('<script>'));
check('an img tag in the note is escaped', !nasty.html.includes('<img src=x'));
check('the escaped brief is still readable', nasty.html.includes('&lt;script&gt;'));

console.log('\n' + '='.repeat(52));
if (failures.length === 0) {
  console.log(`${passed}/${passed} checks passed`);
  console.log('Invitation email construction holds.');
} else {
  console.log(`${passed} passed, ${failures.length} FAILED`);
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
