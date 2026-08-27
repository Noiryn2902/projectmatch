import 'server-only';

import { EMAIL_FROM, RESEND_API_KEY, hasEmail } from '../env';

/**
 * The one place an email leaves the building.
 *
 * It never throws. A send that fails must not take an invitation down with
 * it — the link is on the project page regardless — so the caller gets a
 * plain `delivered` boolean and the detail goes to the server log, the same
 * shape as the AI cascade's deterministic fallback.
 *
 * With no RESEND_API_KEY / EMAIL_FROM configured the message is logged
 * instead of sent, which is enough to develop and demo against.
 */
export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(msg: Email): Promise<{ delivered: boolean }> {
  if (!hasEmail) {
    console.info(
      `[email:fallback] not configured — would send to ${msg.to}\n` +
        `  subject: ${msg.subject}\n  ${msg.text.replace(/\n/g, '\n  ')}`,
    );
    return { delivered: false };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[email] Resend returned ${res.status}: ${body}`);
      return { delivered: false };
    }
    return { delivered: true };
  } catch (err) {
    console.error('[email] send failed:', err);
    return { delivered: false };
  }
}
