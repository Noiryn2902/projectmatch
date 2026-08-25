/**
 * Live chat transport.
 *
 * Two modes, chosen automatically:
 *   supabase — real multi-user across devices, plus presence. Needs
 *              NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 *   local    — BroadcastChannel. Syncs across windows on one machine only.
 *
 * The fallback is deliberate: a demo that silently dies because a key is
 * missing is worse than one that quietly downgrades and says so in the UI.
 */
export interface ChatMessage {
  id?: string | number;
  channel: string;
  author: string;
  role?: string | null;
  body: string;
  at: number;
}

type OnMessage = (m: ChatMessage, replay?: boolean) => void;
type OnPresence = (online: Set<string> | null, typing?: string) => void;

/** The slice of the Supabase realtime channel this file actually calls. */
interface RealtimeChannelLike {
  on: (...args: unknown[]) => RealtimeChannelLike;
  subscribe: (cb?: (status: string) => void) => RealtimeChannelLike;
  send: (payload: Record<string, unknown>) => Promise<unknown> | unknown;
  track: (payload: Record<string, unknown>) => Promise<unknown> | unknown;
  presenceState: () => Record<string, unknown>;
  unsubscribe: () => Promise<unknown> | unknown;
}

interface SupabaseLike {
  from: (t: string) => {
    select: (c: string) => {
      order: (c: string, o: { ascending: boolean }) => {
        limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null }>;
      };
    };
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
  channel: (n: string, o?: unknown) => RealtimeChannelLike;
}

export type LiveMode = 'supabase' | 'local';

class LiveChat {
  mode: LiveMode = 'local';
  private sb: SupabaseLike | null = null;
  private room: RealtimeChannelLike | null = null;
  private bc: BroadcastChannel | null = null;

  async init(onMessage: OnMessage, onPresence: OnPresence): Promise<LiveMode> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && key) {
      try {
        // Held in a variable so the bundler and the type checker both leave the
        // URL alone; swap this for a normal package import once the SDK is installed.
        const cdn = 'https://esm.sh/@supabase/supabase-js@2';
        const mod = (await import(/* webpackIgnore: true */ cdn)) as {
          createClient: (u: string, k: string) => SupabaseLike;
        };
        this.sb = mod.createClient(url, key);

        const { data } = await this.sb
          .from('messages')
          .select('*')
          .order('at', { ascending: true })
          .limit(200);
        (data ?? []).forEach((r) => onMessage(rowToMessage(r), true));

        // Held in a local as well as on the instance, so the callbacks below
        // close over a value TypeScript knows cannot be null.
        const room = this.sb
          .channel('workspace', { config: { presence: { key: crypto.randomUUID() } } })
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (p: { new: Record<string, unknown> }) => onMessage(rowToMessage(p.new)),
          )
          .on('presence', { event: 'sync' }, () => {
            const state = (room.presenceState() ?? {}) as Record<string, { name?: string }[]>;
            const names = new Set<string>();
            Object.values(state).forEach((entries) =>
              entries.forEach((e) => e.name && names.add(e.name)),
            );
            onPresence(names);
          });

        this.room = room;

        await new Promise<void>((resolve, reject) => {
          const bail = setTimeout(() => reject(new Error('timeout')), 6000);
          room.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              clearTimeout(bail);
              resolve();
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              clearTimeout(bail);
              reject(new Error(status));
            }
          });
        });

        this.mode = 'supabase';
        return this.mode;
      } catch (e) {
        console.warn('Supabase realtime unavailable, using local sync:', e);
      }
    }

    try {
      this.bc = new BroadcastChannel('pm_workspace');
      this.bc.onmessage = (e) => {
        if (e.data?.kind === 'msg') onMessage(e.data.msg as ChatMessage);
        if (e.data?.kind === 'typing') onPresence(null, e.data.who as string);
      };
    } catch {
      /* no BroadcastChannel: messages stay in this tab */
    }
    this.mode = 'local';
    return this.mode;
  }

  /** Returns true when the transport will echo the message back to the sender. */
  async send(m: ChatMessage): Promise<boolean> {
    if (this.mode === 'supabase' && this.sb) {
      const { error } = await this.sb.from('messages').insert({
        channel: m.channel,
        author: m.author,
        role: m.role ?? null,
        body: m.body,
        at: m.at,
      });
      if (error) throw new Error(error.message);
      return true;
    }
    this.bc?.postMessage({ kind: 'msg', msg: m });
    return false;
  }

  setName(name: string) {
    if (this.mode === 'supabase' && this.room) this.room.track({ name });
  }

  typing(who: string) {
    this.bc?.postMessage({ kind: 'typing', who });
  }

  dispose() {
    try {
      this.bc?.close();
      this.room?.unsubscribe();
    } catch {
      /* already gone */
    }
  }
}

function rowToMessage(r: Record<string, unknown>): ChatMessage {
  return {
    id: r.id as string | number,
    channel: String(r.channel),
    author: String(r.author),
    role: (r.role as string) ?? null,
    body: String(r.body),
    at: Number(r.at ?? Date.now()),
  };
}

export const live = new LiveChat();
