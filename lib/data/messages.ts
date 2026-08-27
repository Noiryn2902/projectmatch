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

/** Chat opens once at least one person has accepted a seat, not at assembly. */
export function chatIsOpen(members: Person[]): boolean {
  return members.length > 0;
}
