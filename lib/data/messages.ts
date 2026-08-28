import 'server-only';

import type { Person } from '../types';
import { createServerSupabase, getCurrentUser } from '../supabase/server';

/**
 * Project chat, persisted for real.
 *
 * This replaces the `BroadcastChannel` demo transport — a clever hack that
 * only ever synced two tabs on one machine. Messages are rows now, readable
 * by any org member (and any visitor to the demo org), writable only by a
 * member of the owning org.
 *
 * Realtime is not wired here yet: a send does a server round trip and the
 * page re-renders. The socket subscription — the one deliberate exception to
 * "no database in the browser" — is the next increment, not what makes the
 * chat real.
 */

export interface Message {
  id: number;
  authorName: string;
  authorId: string | null;
  body: string;
  at: string;
  /** True when this row was written by the person now viewing. */
  mine: boolean;
}

export async function listMessages(projectId: string): Promise<Message[]> {
  const supabase = await createServerSupabase();
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('messages')
    .select('id, author_id, author_name, body, at, people ( user_id )')
    .eq('project_id', projectId)
    .order('at', { ascending: true })
    .limit(200);

  if (error) throw new Error('Could not load the conversation: ' + error.message);

  const rows = (data ?? []) as unknown as {
    id: number;
    author_id: string | null;
    author_name: string;
    body: string;
    at: string;
    people: { user_id: string | null } | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    authorName: r.author_name,
    authorId: r.author_id,
    body: r.body,
    at: r.at,
    mine: Boolean(user && r.people?.user_id && r.people.user_id === user.id),
  }));
}

/** The display name to attribute a message to, from the signed-in identity. */
function displayName(user: { email?: string; user_metadata?: Record<string, unknown> }): string {
  const meta = user.user_metadata ?? {};
  const named = (meta.full_name ?? meta.name ?? meta.user_name) as string | undefined;
  return named?.trim() || user.email?.split('@')[0] || 'Someone';
}

export async function postMessage(projectId: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;
  if (trimmed.length > 4000) throw new Error('That message is too long.');

  const supabase = await createServerSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('You have to be signed in to post.');

  // Link the message to the caller's own person row when they have one —
  // otherwise author_id stays null and only the name carries.
  const { data: me } = await supabase
    .from('people')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const authorId = (me as { id: string } | null)?.id ?? null;

  const { error } = await supabase.from('messages').insert({
    project_id: projectId,
    author_id: authorId,
    author_name: displayName(user),
    body: trimmed,
  });

  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('row-level security')) {
      throw new Error('Only a member of this organisation can post here.');
    }
    throw new Error('Could not post your message: ' + error.message);
  }
}

/** The name assistant messages are written under. */
export const ASSISTANT = 'assistant';

/**
 * Posts a reply from the assistant.
 *
 * Written through the caller's own session, not the admin client: the
 * messages_insert policy only asks whether you are a member of the owning
 * org, which is exactly the right question. Somebody who could not post here
 * themselves should not be able to make the assistant post for them, and
 * routing this through a privileged client would have quietly broken that.
 *
 * author_id stays null — the assistant is not a person on the roster, and
 * pretending otherwise would put it in member counts and rankings.
 */
export async function postAssistantMessage(projectId: string, body: string): Promise<void> {
  const trimmed = body.trim().slice(0, 4000);
  if (!trimmed) return;

  const supabase = await createServerSupabase();
  const { error } = await supabase.from('messages').insert({
    project_id: projectId,
    author_id: null,
    author_name: ASSISTANT,
    body: trimmed,
  });

  // A failed reply must not fail the message that prompted it — the person's
  // own words are already in, and losing them to a bot error would be worse
  // than a silent assistant.
  if (error) console.error('assistant reply not posted: ' + error.message);
}

/**
 * Chat opens when every seat has been accepted — not at assembly, and not on
 * the first acceptance.
 *
 * The looser rule was worse than it looked. A channel that opens on one yes
 * is a channel three of the five people cannot read, so the first real
 * conversation about the project happens without them and has to be repeated
 * when they arrive. Waiting costs a few hours; not waiting costs the team its
 * first shared context.
 *
 * It also gives the invitation step a meaning it did not have: the room
 * appears when the team does.
 */
export function chatIsOpen(members: Person[], seats: number): boolean {
  return seats > 0 && members.length >= seats;
}
