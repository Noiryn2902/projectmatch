/**
 * The invitation email body — pure. No IO, no server-only import, so it can
 * be checked on its own and the escaping in particular can be pinned down:
 * the brief and the personal note are user-controlled text and must never be
 * able to inject markup into the HTML.
 */

export interface InvitationEmailInput {
  personName: string;
  orgName: string;
  roleTitle: string;
  projectBrief: string;
  message: string | null;
  link: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildInvitationEmail(input: InvitationEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { personName, orgName, roleTitle, projectBrief, message, link } = input;

  const subject = `${orgName} would like you on a project`;

  const text = [
    `Hi ${personName},`,
    ``,
    `${orgName} has held the ${roleTitle} seat on a project for you:`,
    ``,
    `  ${projectBrief}`,
    ...(message ? [``, `Their note: "${message}"`] : []),
    ``,
    `Accept or decline here — no account needed:`,
    link,
    ``,
    `Declining is a real answer. The seat reopens and the team is worked out again without you.`,
  ].join('\n');

  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.5">
  <p style="font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#888;margin:0 0 4px">ProjectMatch</p>
  <p style="margin:0 0 12px">Hi ${esc(personName)},</p>
  <p style="margin:0 0 12px">${esc(orgName)} has held the <strong>${esc(roleTitle)}</strong> seat on a project for you:</p>
  <blockquote style="margin:0 0 12px;padding:10px 14px;border-left:2px solid #5b5bd6;background:#f6f6f8;font-size:14px">${esc(projectBrief)}</blockquote>
  ${message ? `<p style="margin:0 0 12px;font-style:italic;color:#555">&ldquo;${esc(message)}&rdquo;</p>` : ''}
  <p style="margin:0 0 16px">
    <a href="${esc(link)}" style="display:inline-block;background:#5b5bd6;color:#fff;text-decoration:none;padding:9px 18px;border-radius:8px;font-size:14px;font-weight:500">Accept or decline</a>
  </p>
  <p style="margin:0;font-size:12px;color:#888">No account needed. Declining is a real answer — the seat reopens and the team is worked out again without you.</p>
</div>`.trim();

  return { subject, text, html };
}
