# Making the workspace chat sync across devices

The chat in the team workspace already works. It runs in one of two modes and
picks automatically — the pill in the channel header tells you which:

| Pill | Mode | What syncs |
|---|---|---|
| amber `live · this device` | BroadcastChannel | across browser windows on one machine |
| green `live · N online` | Supabase Realtime | across devices, plus real presence dots |

No configuration is needed for the amber mode. Two browser windows side by side
already demo as live. Set up Supabase only if you want it to sync to a phone.

## Supabase setup (~15 minutes)

1. Create a free project at supabase.com. Copy the Project URL and the `anon`
   public key from Settings → API.

2. Run this in the SQL editor:

```sql
create table messages (
  id         bigint generated always as identity primary key,
  channel    text not null,
  author     text not null,
  role       text,
  body       text not null,
  at         bigint not null
);

alter table messages enable row level security;
create policy "demo read"  on messages for select using (true);
create policy "demo write" on messages for insert with check (true);

alter publication supabase_realtime add table messages;
```

3. Add to `.env.local` (and to Vercel → Settings → Environment Variables):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

4. Restart the dev server. The pill should turn green.

`lib/live.ts` loads the SDK from esm.sh so nothing has to be installed. For a
real deployment run `npm i @supabase/supabase-js` and replace the `cdn` dynamic
import with a normal package import.

## Security

Those RLS policies are wide open: anyone with the URL can read and write the
table. That is fine for a demo and nothing else.

- The `anon` key is designed to ship in client code — RLS is what protects the
  data. Never put the `service_role` key in the client.
- Do not store real personal data in this table.
- Delete the project or tighten the policies after the demo.
- `GEMINI_API_KEY` stays server-side in `/api/ai`. None of this moves it.
