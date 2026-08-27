import 'server-only';

import { getInvitationByToken } from '../data/invitations';
import { buildInvitationEmail } from './build';
import { sendEmail } from './send';

/**
 * Looks the invitation up by token and emails whoever it is for. Returns
 * whether real delivery happened — `false` when the person has no address on
 * file, when email is not configured, or when the send failed. In every one
 * of those cases the link is still shown on the project page, so nothing is
 * lost, and this never throws.
 */
export async function sendInvitationEmail(
  token: string,
  link: string,
): Promise<{ emailed: boolean }> {
  const invitation = await getInvitationByToken(token);
  if (!invitation || !invitation.personEmail) return { emailed: false };

  const { subject, text, html } = buildInvitationEmail({
    personName: invitation.personName,
    orgName: invitation.orgName,
    roleTitle: invitation.roleTitle,
    projectBrief: invitation.projectBrief,
    message: invitation.message,
    link,
  });

  const { delivered } = await sendEmail({ to: invitation.personEmail, subject, text, html });
  return { emailed: delivered };
}
