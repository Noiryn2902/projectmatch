'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { inviteToSeat } from '@/lib/data/invitations';
import { sendInvitationEmail } from '@/lib/email/invitation';

/**
 * Sends the asks.
 *
 * One button for the whole team and one per card, sharing a single action.
 * The per-card button submits the same form, so it names the one pair it
 * means with `only` and everything else is ignored — otherwise "ask just
 * Priya" would quietly ask all six.
 *
 * Each seat is independent: one failure — a seat already invited, a person
 * removed from the roster — does not cost you the others. The count that
 * comes back is what actually went out.
 */
export async function sendInvitesAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  if (!projectId) return;

  const split = (s: string): [string, string] | null => {
    const [roleId, personId] = s.split(':');
    return roleId && personId ? [roleId, personId] : null;
  };

  const only = String(formData.get('only') ?? '');
  const pairs = (
    only
      ? [split(only)]
      : formData.getAll('pair').map(String).map(split)
  ).filter((p): p is [string, string] => p !== null);

  // The picks carried from step three, so a partial send comes back to the
  // same page still showing the people you chose for the seats you skipped.
  const picks = String(formData.get('picks') ?? '');
  const back = `/project/${projectId}/invite${picks ? `?picks=${encodeURIComponent(picks)}&` : '?'}`;

  if (pairs.length === 0) redirect(back.slice(0, -1));

  const shared = String(formData.get('message') ?? '').trim();

  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');

  let sent = 0;
  for (const [roleId, personId] of pairs) {
    // A note written for this person beats the shared one; falling back to
    // the shared text means "send all" still carries context.
    const personal = String(formData.get(`note:${personId}`) ?? '').trim();
    const message = (personal || shared).slice(0, 500);

    try {
      const token = await inviteToSeat(roleId, personId, message || undefined);
      await sendInvitationEmail(token, `${proto}://${host}/invite/${token}`);
      sent++;
    } catch {
      // Already invited, or the seat moved on. Keep going: the rest of the
      // team should not fail because one seat did.
    }
  }

  revalidatePath(`/project/${projectId}/invite`);
  redirect(`${back}sent=${sent}`);
}
