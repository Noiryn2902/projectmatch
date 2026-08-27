# ProjectMatch — Improvement Plan

**Status:** working document. Written 27 Aug 2026, after being selected for the PromptWars top 20.
**Purpose:** the single place that records what we are building, why, in what order, and what we
decided *not* to do. If a future session needs context, start here rather than re-deriving it.

**Goal, stated by the owner:** make this a real product, not a competition entry. "Presenting the
best product" beats placing first. That is the tiebreaker for every call below.

---

## 0. How to read this

| Marker | Meaning |
|---|---|
| **Committed** | Decided. Build it. |
| **Proposed** | Recommended, not yet approved. |
| **Deferred** | Considered seriously, deliberately not now. Reason recorded. |
| **Declined** | Rejected on principle, not on time. Reason recorded. |

Nothing in here is a feature list for its own sake. Every item answers one of three questions:
does it make the product *real*, does it make the engine *smarter*, or does it make the decision
the product produces *defensible*.

---

## 1. The decision underneath everything

**Committed: ProjectMatch is internal organisational team formation. It is not an open marketplace.**

The product was two products in one coat — a company staffing project teams from its own people,
and a marketplace where strangers find each other. Feature requests kept splitting along that seam.

Internal org wins because:

- **Cold start is solved by one roster import**, not by luck. A marketplace with eight signed-up
  strangers is worthless; an org with one uploaded CSV has 500 people on day one.
- **The data can be true.** Hours, seniority, office and timezone are things an employer knows.
  A stranger's self-reported "20 hrs/week free" is fiction nobody will ever update.
- **Consent is tractable** inside an employment relationship. Scraping strangers is not.
- **The schema already committed to it.** `lib/types.ts` has `companyId`, `office`, `utcOffset`,
  `hoursPerWeek`. That is an internal staffing model, built before it was named.
- **It matches the problem statement** — team *formation*, not networking.

Individuals can still self-onboard, and an org that never imports a roster still works. But the
product is aimed at the organisation.

---

## 2. Where it stands today

### What is genuinely good

- **The engine.** 443 lines of pure TypeScript across `graph.ts` (63), `score.ts` (137),
  `assemble.ts` (187), `health.ts` (56). No React, no network, no IO. 51 assertions in
  `scripts/test-engine.ts`. This is the only part of the product nobody else has.
- **The core idea holds.** `marginalGain()` scores what a person adds to *the team being built*,
  not how good they look alone. With a frontend developer seated, a second frontend developer
  scores 0% while a junior designer scores 12%.
- **AI discipline.** Three actions on one route, Gemini constrained to the 82-skill vocabulary via
  `responseSchema`, a three-model cascade in `lib/ai/client.ts`, and a deterministic fallback for
  every call in `lib/ai/fallback.ts`. The app works with the network unplugged. **Gemini never
  picks the team** — results stay reproducible.
- **`npm run verify`** = typecheck + lint + 51 tests + build, all passing.
- **AI evaluation 95.92/100** — Code Quality 86, Security 98, Efficiency 100, Testing 98,
  Accessibility 96, Problem Statement Alignment 100.

### What is theatre

| Area | Reality today |
|---|---|
| Identity | `lib/session.ts` writes a name to `localStorage`. Nothing is verified. |
| People | 60 fictional people from `scripts/seed.mjs`. Nobody can ever be added. |
| Persistence | Nothing survives a refresh. Chat rides `BroadcastChannel`, one machine only. |
| Joining | No path in. You browse a fixed pool and you are not in it. |
| Invitations | Do not exist. Assemble a team and chat opens. Nobody was asked; nobody can decline. |
| Skill levels | 411 seeded records, all trusted equally. No provenance, no recency. |
| Team lifecycle | One shot. `health.ts` measures at assembly, then the story ends. |
| Org control | `ScopeFilter` filters by company/office, but no one *owns* an org and nothing imports. |
| Consent | `openToProjects` is a seeded boolean, not a person's choice. No edit, withdraw, or delete. |
| Learning | Nothing is recorded. Every ranking starts from zero history. |

### Architectural findings — the ones that block the roadmap

1. **There is no routing.** `app/` contains exactly one page. `app/page.tsx` renders
   `TeamBuilder.tsx`, and that one 662-line client component imports the landing sections, the
   directory, the builder and the 815-line `Workspace.tsx`. The entire application is a single
   route with conditional rendering.

   **This blocks Phase 2 outright.** An invitation email links to a URL. There are no URLs. Real
   routes are a prerequisite for invitations, shareable team proposals, and org pages — not polish.

   **Partially resolved (2026-08-27):** `/project/[id]` is real now — `lib/data/projects.ts` reads
   a persisted project (brief, roles, requirements, seats, filled members) and runs it through the
   unmodified engine, and the route renders it server-side. Verified against Postgres: real seeded
   names, a real 52% coverage number, and a genuinely honest gap (a filled seat whose occupant
   turned out not to actually have the required skill — the engine caught it, which is the whole
   point). Not yet done: the **write** path. Submitting a brief still only updates in-memory
   state — turning that into a real `create_project` call needs a real org to write into, which is
   Phase 1 (org membership), not built yet. `TeamBuilder.tsx`/`Workspace.tsx` also still exist
   unmodified — the split into route-based pages is still pending, tracked in §3.

2. **The interface has outgrown the engine, 8.6 to 1.** 3,802 lines of components against 443
   lines of engine. Two files carry most of it: `Workspace.tsx` (815) and `TeamBuilder.tsx` (662).
   This is the direct cause of Code Quality being the lowest score at 86, and every new flow makes
   it worse unless files are split as we go.

3. **The only data access pattern is client-side.** `lib/live.ts` reads
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the browser. That directly
   contradicts the decision to put the database behind a backend.

4. **The engine has no IO boundary.** It reads `Person[]` passed in from JSON imported at the
   page level. That is actually the right shape — it means swapping the source from seeded JSON
   to Postgres does not touch the engine at all. Preserve this property deliberately.

---

## 3. What to remove

Deletions matter as much as additions. Each of these either contradicts a decision above or will
actively fight the work.

### Delete

| Target | Why | When |
|---|---|---|
| `lib/session.ts` (87 lines) | Fake identity. Replaced wholesale by real auth. Every feature built on it inherits the lie. | Phase 0 |
| `BroadcastChannel` chat mode in `lib/live.ts` | A clever demo hack for syncing two windows on one machine. Once a backend exists it is a second code path to maintain that no real user will ever hit. Keep one transport. | Phase 0 |
| Browser-side **data access** via `NEXT_PUBLIC_SUPABASE_*` | All querying moves server-side. **Correction:** the vars themselves stay — the browser needs the URL and anon key to open a realtime socket, which is the one deliberate exception. They are not secrets and RLS assumes they are known. What goes is the browser *querying tables*. | Phase 0 |
| The `esm.sh` runtime import in `lib/live.ts` | The Supabase SDK is fetched from a CDN at runtime in the browser, via `await import('https://esm.sh/...')`. That is a supply-chain dependency on a third party at page load, invisible to the lockfile. Replaced by a real dependency. | Phase 0 |
| `LIVE_CHAT_SETUP.md` | Documents the two-mode chat story that Phase 0 removes. Becomes actively misleading. Fold anything still true into the main docs. | Phase 0 |
| `components/Proof.tsx` (93 lines) | Fabricated testimonial quotes attributed to fictional people. Fine while everything is openly fictional. **A credibility hazard the moment real users exist alongside them** — invented endorsements sitting next to a real org's data is the kind of thing that is hard to explain afterwards. | Before real data |
| `sameOffice` sort mode | A filter wearing a sort's clothes, in a product whose entire thesis is that filtering is the wrong frame. `types.ts:74`, `assemble.ts:88`, `TeamBuilder.tsx:29`. | Engine phase |

### Split, don't delete

| Target | Action |
|---|---|
| `TeamBuilder.tsx` (662) | Currently the app's de facto router. Decompose along the real routes introduced in Phase 0. |
| `Workspace.tsx` (815) | Split by concern: team panel, chat, health, invitations. No file over ~300 lines. |
| Landing sections (`Band`, `BigCta`, `Categories`, `HowItWorks`, `Stats` ≈ 570 lines) | Move to a marketing route that is not loaded by the product shell. A signed-in user should not be shipping the landing page's JavaScript. |

### Keep, explicitly

- `components/Difference.tsx` — this is the 0% / 12% proof. It is the crown jewel. Do not touch it
  except to strengthen it.
- The seeded 60 people — they become a clearly labelled demo organisation, never merged into real
  org results. **Demo data must be isolated at the query level, not by convention.**
- Every deterministic AI fallback.

---

## 4. Target architecture

### Layering rule

```
lib/engine/     pure. no IO, no React, no network, no imports from anything below.
     ↑
lib/data/       repositories. server-only. the sole place SQL lives.
     ↑
app/            route handlers, server components, server actions. transport + auth.
     ↑
components/     presentation. never imports lib/data directly.
```

The engine's purity is the most valuable structural property in the codebase. It is why the tests
are fast and honest, and it is why the database can be swapped in without touching the scoring.
**Guard it:** the engine keeps taking plain `Person[]` and returning plain results. Nothing async
ever enters it.

### Next.js 16 specifics — the standard recipes are stale

This project runs Next 16.3.2 / React 19.2.8. Verified against `node_modules/next/dist/docs/`:

- **`middleware.ts` is deprecated and renamed to `proxy.ts`.** Every Supabase SSR auth guide on
  the internet puts session refresh in middleware. That is wrong here. Codemod exists:
  `npx @next/codemod@canary middleware-to-proxy .`
- **Request APIs are async.** `cookies()` and `headers()` must be awaited — which is exactly where
  Supabase's cookie adapter plugs in.
- Caching APIs changed in 16 (`revalidateTag`, `updateTag`, `refresh`, `cacheLife`/`cacheTag`),
  and PPR is available. Read the docs before relying on any caching behaviour from memory.

### Transport choices

- **Server Actions** for mutations driven by the app's own forms (create project, invite, accept,
  edit profile).
- **Route Handlers** for anything reached from outside: the invitation accept link, future webhooks,
  and the existing `/api/ai`.
- **Realtime chat** is the one deliberate exception to "no database in the browser" — realtime
  needs a socket. It subscribes with RLS behind it; writes still go through the backend.

### Routes to introduce (Phase 0)

```
/                        marketing (not loaded by the product shell)
/app                     signed-in home
/app/org/[orgId]         roster, import, admin
/app/project/[id]        the brief, the team, health, chat
/invite/[token]          accept or decline — must work before the recipient has an account
/auth/*                  sign-in, callback, sign-out
```

### Security posture

- All authorisation server-side. RLS on every table as defence in depth, never as the only gate.
- Service-role key server-only. Never `NEXT_PUBLIC_`.
- Rate limiting on `/api/ai` — currently absent and currently free to abuse.
- An audit trail for staffing decisions (see §6.8).

---

## 5. Data model sketch

```
orgs                id, name, created_by
memberships         org_id, user_id, role (owner | admin | member)
people              id, org_id, user_id?, name, title, office, utc_offset,
                    years_exp, seniority, hours_per_week, visibility, open_to_projects
skills              id, label, parent, related[]          (the 82-skill vocabulary)
person_skills       person_id, skill_id, level,
                    provenance (self | extracted | endorsed | verified),
                    source, last_used_at, confidence
endorsements        person_skill_id, endorsed_by, note, created_at
projects            id, org_id, brief_text, duration_weeks, domain[], status
roles               project_id, title, hours_needed
requirements        role_id, skill_id, min_level, weight
seats               project_id, role_id, person_id?, state (open | invited | filled)
allocations         person_id, project_id, hours_per_week, starts_at, ends_at
invitations         id, seat_id, person_id, token, status (pending | accepted | declined |
                    expired | revoked), sent_at, responded_at
messages            project_id, author_id, body, at
outcomes            project_id, person_id, accepted, completed, would_work_again
audit_log           actor_id, action, subject, payload, at
```

Two fields carry more weight than they look:

- **`person_skills.provenance`** — who says this level is true. See §6.5.
- **`allocations`** — the difference between "has 20 hours a week" and "has 20 hours a week that
  are not already spent". See §6.1.

---

## 6. The engine phase — what actually makes it best

**This is the most important section in the document.**

Phases 0–4 below make ProjectMatch *real*. Not one of them makes it *smarter*. At the end of the
plumbing the engine knows exactly what it knows today. Since the engine is the only differentiator,
the items here are what raise the ceiling.

### 6.1 Capacity is fiction — model allocation **[Proposed, highest value]**

`hoursPerWeek` floats free of reality. A person can be seated on unlimited teams simultaneously and
the engine never notices. Real staffing is allocation: capacity minus existing commitments.

Modelling it unlocks **conflict detection** — *"this team is only possible if you take Priya off
Atlas."* That is not a feature, that is the job the tool exists to do. Nothing else on this list
changes the product's usefulness as much.

### 6.2 `coverage()` is blind to key-person risk **[Proposed, cheapest win]**

`score.ts:22` takes the **max** satisfaction across members. One person covering Kubernetes and
three people covering it produce an identical number — so a team with a single point of failure
currently scores as perfectly healthy.

Counting how many members clear each requirement is a few lines and yields **bus factor**, which
real organisations genuinely fear and no competitor will show.

### 6.3 One answer, where real decisions need options **[Proposed]**

Today: here is your team. Better: two or three *distinct* teams with named tradeoffs — "fastest,
but payments rests on one person" versus "two weeks slower, no key-person risk". Pure engine work.

It changes the product's posture from oracle to advisor, which is both more honest and more useful.

### 6.4 Infeasibility diagnosis **[Proposed]**

When a brief cannot be staffed, the product simply fails. A real optimiser says *why*, and what is
cheapest to change: *"not staffable this quarter — hire one senior backend, or extend three weeks,
or drop the ML requirement."* Runs on coverage math that already exists. The smartest-looking
feature in the product for the least new machinery.

### 6.5 Skill trust: provenance **and** recency **[Committed — Phase 3]**

The engine is only ever as good as `PersonSkill.level`. Seeded, those are perfect. Filled in by
real humans, everyone is a five and the scoring quietly becomes noise. This is the weakest link in
the entire model and nobody has pointed at it yet.

Two fields fix it:

- **Provenance** — self-declared / extracted from a resume / endorsed by a colleague / verified by
  the org. The engine **discounts what it cannot verify**, and the interface says so.
- **Recency** (`last_used_at`) — a skill last used four years ago is not current. Provenance
  answers *who says so*; recency answers *how stale*. Together they make levels honest over time.

### 6.6 Cost **[Proposed]**

Every real allocation problem is budgeted. `seniority × hours` gives cost almost free, and then the
engine answers the question managers actually ask: *"Team B costs 1.4× for six points of coverage —
worth it?"* Without cost this is a recommender. With cost it is an optimiser.

### 6.7 Growth-aware staffing **[Proposed — the signature move]**

Staffing is also how people develop, and nobody models it. A junior seated beside a senior in the
same skill is a stretch assignment. `health.ts` already flags "no senior presence" — the inverse is
an opportunity signal.

Optimising for team output **plus individual development** rather than output alone is humane, is a
genuine priority for the people who would buy this, and is almost certainly unique in this field.
This is the one people remember afterwards.

### 6.8 Fairness: opportunity concentration **[Proposed]**

A deterministic engine over a fixed pool concentrates opportunity — the top ten people get every
project and everyone else becomes invisible. That is a real harm in an internal staffing tool, it
is measurable per person over time, and surfacing it both fixes the harm and pre-empts the sharpest
criticism anyone could make of this product.

### 6.9 "Why wasn't I picked?" **[Proposed]**

Deterministic scoring means this can be answered exactly. In internal staffing it is a conversation
that actually happens, and an auditable, non-discriminatory answer is a requirement, not a nicety.
Pairs with the audit log.

### 6.10 Locked seats and re-optimisation **[Proposed]**

Managers always have a "I want X on this" constraint. Pin a person, re-optimise around them. This
is table stakes for real use and the assembly pass largely supports it already.

### 6.11 Explain the *swap*, not just the person **[Proposed]**

"Swapping A for B costs three points of coverage and gains six hours of overlap." The delta is what
a decision-maker needs; the absolute score is not.

### 6.12 Prior collaboration **[Proposed, depends on §Phase 4]**

People who have worked together ramp faster. Once outcomes are recorded, prior collaboration
becomes a real, earned signal rather than a guess.

### 6.13 Declarative constraints on the brief **[Proposed]**

Budget, deadline, must-include, must-exclude, required timezone band are currently UI-level filters.
Making them first-class fields on `Brief` is cleaner architecturally and is what makes the optimiser
story true rather than rhetorical.

### 6.14 Brief coaching **[Proposed, small]**

Garbage in, garbage out. *"Your brief does not say how long or how many hours a week — the team it
produces will be wrong."* Cheap, and it improves every downstream result.

### 6.15 Scale benchmark **[Proposed, one hour]**

60 people is nothing. Benchmark the engine at 10,000 and put the number on screen. An hour of work,
and it makes Efficiency 100 mean something concrete.

---

## 7. Roadmap

Phases are a dependency chain. Each depends on the one above.

### Phase 0 — Real login, real database, real routes

The unglamorous one, and the one everything else stands on.

- Supabase Auth: email magic link + GitHub OAuth. Cookie sessions, server-verified.
- Session refresh in **`proxy.ts`**, not `middleware.ts` (see §4).
- Postgres schema and migrations, RLS written on day one rather than retrofitted.
- **Real routes** (see §4) — without them Phase 2 cannot exist.
- All data access moves server-side. `lib/data/` repositories become the only place SQL lives.
- The seeded 60 migrate in as an isolated demo org, still labelled fictional.
- Delete `lib/session.ts`, the `BroadcastChannel` path, and `LIVE_CHAT_SETUP.md`.
- A **guest route into the demo org**: sign-in is required to *act*, never to *look*.

### Phase 1 — Organisations and the people in them

The supply side, and the answer to cold start.

- Org entity with an owner; admin view of the roster.
- CSV / JSON import with a preview and a column-mapping step before anything is written.
- Claim-your-profile for imported people; self-onboard for everyone else.
- Edit, visibility, withdraw, delete — the profile belongs to the person.
- Orgs that never import anything still work.

**Done (2026-08-27) — org creation and a minimal roster.** `/app` is the signed-in home: no
session redirects to sign-in, no org shows a one-field "create your organisation" form, an
existing org redirects to its roster. `/app/org/[slug]` lists the roster and can add one person
at a time through an ordinary form — no privileged path, it relies on the same `people_insert` RLS
policy a malicious client would also be subject to.

**A real bug caught before it shipped:** `memberships_write`'s policy required the caller to
already be an org admin, which meant nobody could ever become the *first* member of an org they
just created — there is no admin yet to grant that membership. Fixed with `create_org()` in
`supabase/migrations/0002_create_org.sql`, a `SECURITY DEFINER` function (same pattern as
`is_org_member()`) that inserts the org and its founding `owner` membership atomically, bypassing
RLS for exactly that one bootstrapping moment. Everything after — a second member, an edit — goes
through ordinary RLS-checked writes.

**Verified against the real database, both directions:** signed in as the real GitHub account,
created `Test Co`, confirmed the `owner` membership row exists with the correct `user_id`; added
Priya Nair to the roster and confirmed the row. Then, as a signed-out anonymous client: 0 rows
readable from `Test Co`'s roster, and a direct insert attempt against it was blocked — the row
count after the attempt was unchanged. RLS holds in both directions, not just the happy path.

**Not done yet, on purpose — narrowly scoped to prove the pipe works end to end:**
- ~~CSV/JSON bulk import (still one person at a time)~~ **done, see below**
- Claim-your-profile / self-onboarding (needs an invitation or a matching mechanism — Phase 2
  territory, or a follow-up slice)
- Edit / withdraw / delete on a person's own profile
- Multiple orgs per user (an owner can currently only ever have the one `/app` redirects to)
- No nav link anywhere points at `/app` yet — reachable only by URL, same as `/project/[id]`

**Done (2026-08-27) — roster import, the answer to cold start.** `/app/org/[slug]/import` takes a
paste from Excel / Sheets / a CSV export and turns it into roster rows. `lib/import/roster.ts` is
pure and client-safe: an RFC4180-ish `parseDelimited()` (quoted commas, `""` escapes, quoted
newlines, comma-vs-tab sniffing) and `normaliseRoster()`, which maps header aliases to canonical
fields (`name` required; title, email, department, office, hours, seniority recognised; anything
else listed as ignored), clamps hours to 0–40 and seniority to 1–5, and marks every row
`ok | dup-roster | dup-file | invalid`. The same pure function draws the live preview in the
browser as you paste and runs again server-side at commit — the client's parsed rows are never
trusted, only the raw text crosses back.

`importPeople()` in `lib/data/people.ts` is one batched insert under the ordinary `people_insert`
RLS policy — an org admin can, a plain member cannot, and a non-admin gets a clean "only an
organisation admin can import a roster" rather than a partial write. No migration, no
`SECURITY DEFINER`: same reasoning as `create_project()`, there is no bootstrapping deadlock here.
The page itself is admin-gated (`getMyRole()`, new in `lib/data/orgs.ts`) and redirects a
non-admin back to the roster rather than showing a form the database would reject.

**Tests:** `scripts/test-import.ts` — 22 assertions over the parser (delimiter sniffing, quoting,
the three duplicate kinds, clamping, unknown columns, empty input). Wired into `npm run verify` as
`test:import`, kept separate from the 51 engine checks so "engine invariants hold" stays a
distinct claim. `npm run verify` green: typecheck + lint + 51 engine + 22 import + build.

**Not verified against live data yet** — needs a signed-in admin session to paste and commit
through the UI. **Still open:** claim-your-profile, and skills/timezone/availability on imported
people (import only sets name, title, email, department, office, hours, seniority — imported people
have no skills, so they will not rank until Phase 3).

**Done (2026-08-27) — the write path on projects.** `/app/org/[slug]/new` submits a brief through
the same deterministic `fallbackBrief()` parser the live builder falls back to, and
`create_project()` (`supabase/migrations/0003_create_project.sql`) turns it into a real project —
the row, every role, every requirement, and an open seat per role — in one atomic transaction. The
org roster page now lists real projects with a link into each, closing the loop this phase set out
to close: `/project/[id]`, built two slices ago against seeded data only, renders a project created
live through the form exactly the same way, because it never knew the difference.

Deliberately **not** a `SECURITY DEFINER` function like `create_org()` — there is no bootstrapping
deadlock here, the caller is already a member by the time they reach this page, so it runs as
`SECURITY INVOKER` and ordinary RLS is the real gate on every insert inside it, same as a raw
insert from that user would face.

Verified against the live database: created a project through the actual UI as the real GitHub
account, confirmed all 4 roles, every requirement, and 4 open seats landed correctly in Postgres in
one call; separately probed the function with a nonexistent org id and got a real foreign-key
violation rather than a silent no-op, confirming the function's logic genuinely runs rather than
just existing.

Still open: no name field on project creation (`name` is always empty — the page uses the brief
text as the title), and profile claiming / CSV import are unchanged from before this slice.

**Done (2026-08-27) — staffing a seat, and a real bug found by testing it.**
`/project/[id]/staff/[roleId]` ranks the org's roster against one open seat, calling the engine
directly on live data for the first time. `setSeatPerson()` fills or empties a seat through
ordinary RLS.

**The bug, worth recording because it was a design error rather than a typo.** The page first
displayed `breakdown.gapFill` as the single "contribution" number and sorted on it. But `gapFill`
is computed across *every requirement in the brief*, not the seat being filled — so a product
designer who fully covers the design role scores identically to a frontend engineer when you are
looking at the frontend seat. All three test candidates showed exactly 33% on every seat. Sorting
on it put a product designer at the top of the **backend** seat, and following the ranking produced
a team with a designer as backend engineer and a frontend engineer as product designer.

`rankCandidates` already guards this with `SEAT_FLOOR` — but only applies it when at least three
candidates clear the bar, falling back to the whole pool on a small roster, which is exactly the
case that was being tested. The engine was right; the page was asking it the wrong question.

Fixed by showing **both** numbers — `roleMatch` as "fit" (can they hold this seat) and `gapFill` as
"adds" (what they close for the whole team) — partitioning on the now-exported `SEAT_FLOOR`, and
never letting someone below the floor outrank someone above it. People below the bar still appear,
in a visually separate dashed group with an explanation, because on a small roster showing nothing
is worse. Verified after the fix: the backend seat lists only backend/ML/data/platform people, all
fit ≥ 45%, and an already-seated person correctly shows 0% adds.

Also fixed while here: seating in the demo org threw a raw 500 (RLS correctly refusing the write,
surfaced terribly). Both the staffing page and the project page now detect the demo org and show
the ranking read-only with an explanation instead of offering buttons the database will reject.

Still open: `autoFill` (staff every seat at once) is not wired to this page, and seating is still
an assertion rather than an invitation — which is Phase 2 below.

### Phase 2 — Invitations that leave the building

- Invitation records with real email delivery, and a link that works before the recipient has an
  account.
- Accept / decline / expire, with the seat reopening correctly in every case.
- Chat unlocks on acceptance, not on assembly.
- **On decline the engine re-ranks against the team as it now stands** and proposes the swap, with
  what the team lost stated plainly.
- Second-inviter, already-invited, already-accepted and revoked states all handled. This is where a
  real product either holds or falls apart.

**Done (2026-08-27) — the invitation state machine, and a link that answers itself.**
`supabase/migrations/0004_invitations.sql` adds two functions and they differ in a way worth
noting: `invite_to_seat()` is plain `SECURITY INVOKER` (the caller is already a member acting on
their own project — ordinary RLS is the right check), while `respond_to_invitation()` is
`SECURITY DEFINER`, because the recipient may have **no account at all**, and therefore no
permission to read the invitation, the seat, or their own person row. The token is the
authorisation — the same trust model as any invitation email.

`/invite/[token]` — the one route that has to work for a stranger — reads through the admin client
with only the token as input, and never asks for a sign-in. `/project/[id]/staff/[roleId]`'s
primary action is now **Invite**, not **Seat**: it holds the chair without filling it.

**A real design decision, not just plumbing:** an invited-but-unanswered seat does not count toward
`teamHealth()` coverage. `ProjectDetail.team` — what the engine sees — only ever contains *filled*
seats; a new `seats` map carries the fuller `open / invited / filled` picture for the interface.
Counting an unconfirmed invitation as coverage would be exactly the kind of overclaiming this
product exists to refuse.

**Verified against the live database, the whole state machine, not just the happy path:** invite
Arjun to a seat (held, not filled) → a second invite to the *same* seat refused by the partial
unique index from Phase 0, not by application logic → Arjun declines (seat reopens) → replaying the
same link says "already declined" rather than reprocessing → Sara is invited and accepts (seat
filled, by her) → a bogus token returns a clean "not found" → an invitation with a past
`expires_at` reopens the seat rather than holding it forever. Then, separately, through the actual
UI in a browser with **no session at all**: the invite page rendered the real name, org, brief, and
message; clicking Accept filled the seat; the database confirmed `filled` with the right person id
and the invitation row showed `accepted` with a real timestamp.

**Not done, stated rather than left implicit:** ~~no email delivery~~ (done, see two slices below).
No revoke button. No UI listing pending invitations. Chat still does not exist to unlock.

**Done (2026-08-27) — the decline proposes the next move.** A decline used to be a silent database
update: `respond_to_invitation()` reopened the seat, and the owner had to notice it was open again
and work out why. Now `getProject()` carries a `declines` map — for every seat that is *currently
open* and whose most recent invitation was declined, the name of who declined, when, and every id
that has declined it. Built from one extra query against `invitations` (RLS already lets an org
member read their project's invitations), gated on `state = 'open'` so a re-invited or otherwise
filled seat drops the cue.

The interface acts on it in three places: the project page shows a banner (`N seats were declined
and are open again`) and turns each declined seat's row amber with an **Ask someone else** action
instead of the plain *Find someone*; the staffing page opens with a banner naming who declined and
stating the ranking below is computed against the team as it now stands; and in that ranking the
people who declined this seat are kept visible — a small roster can't hide anyone — but sorted to
the bottom of their group and shown a muted **Declined** pill in place of the Invite button. No
engine change, no migration: the ranking already re-runs live on every page load against
`project.team`, and the seat was never *filled*, so there is no coverage number that moved and none
is invented. All 51 engine tests still pass; `npm run verify` green.

Verified: `npm run verify` (typecheck + lint + 51 tests + build) passes, and a read-only probe
against the live database confirmed the new embedded PostgREST query (`invitations` →
`people ( name )`, filtered on `status = 'declined'`, ordered by `responded_at`) parses and runs.
A full click-through of decline → re-rank against live data with a real session is still to be
done through the UI.

**Done (2026-08-27) — invitations that leave the building.** Inviting someone now emails them the
`/invite/[token]` link when there is an address on file and email is configured. The design follows
the AI cascade's rule exactly: `lib/email/send.ts` never throws and returns a plain `delivered`
boolean, and with no `RESEND_API_KEY` / `EMAIL_FROM` set it logs the message to the server console
instead — the link is on the project page regardless, so a bounce or a missing key never strands an
invitation. `lib/email/build.ts` is the pure body builder (subject + text + HTML), split out from
the IO so its escaping can be tested: the brief and the personal note are user-controlled and must
not inject markup. `inviteAction` derives the absolute URL from request headers, sends, and passes
`emailed=1` back so the project-page banner reads "Invitation emailed" rather than "ready to send".

**Tests:** `scripts/test-email.ts` — 9 assertions, mostly that `<script>` in a brief and
`<img onerror>` in a note come out escaped. Wired into `verify` as `test:email`. Full run green:
typecheck + lint + 51 engine + 22 import + 9 email + build.

**Not verified live** — needs `RESEND_API_KEY` + a Resend-verified `EMAIL_FROM`, and a real invitee
address, to confirm an actual email arrives. The keyless fallback path (console log + link on page)
is what runs until then.

**Still deferred:** a revoke button, a pending-invitations list, and chat unlocking on acceptance.

### Phase 3 — Skills you can trust

- Resume paste and GitHub import as a fourth action on the AI route — constrained to the 82-skill
  vocabulary, structured output, deterministic fallback, exactly like the three before it.
- Provenance and recency on every skill (§6.5). Endorsements.
- The scoring engine discounts unverified levels, and the interface says so.
- **No scraping.** GitHub's public API and a person's own export only.

**Done (2026-08-27) — the engine discounts what it cannot verify, and imported people carry
skills.** Two halves that prove each other.

*Engine.* `satisfaction()` in `lib/engine/score.ts` — the one function where a stated level becomes
coverage — now multiplies the level by `skillTrust(ps)` before measuring it against the bar.
`verified` → 1.0, `endorsed` → 0.9, `extracted` → 0.75, `self` → 0.6. A level with **no**
provenance is left at 1.0 on purpose: the seeded pool predates the field, and reading "unknown" as
"unverified" would move every number in the live demo and the 0% / 12% proof. Recency
(`last_used_at`) is deliberately *not* in yet — it needs a clock, and `Date.now()` inside a
function the tests assert is deterministic is the wrong trade for one slice; it comes when the
`now` param can be threaded through properly. 6 new assertions; the suite is 57/57 and every
pre-existing invariant still holds unchanged, which is the point.

*Import.* The roster paste takes a `skills` column now — one quoted cell like
`"react:4, postgres:3, nodejs"`. `parseSkillCell()` (pure, in `lib/import/roster.ts`) splits on
`, ; |`, reads a trailing 1–5 as the level (default 3), resolves each name against the 82-skill
vocabulary via `resolveSkill`, and hands back anything it does not recognise rather than guessing.
`importPeople()` writes them with `provenance = 'self'`, `source = 'roster import'` in a second
batch insert under the `person_skills_write` RLS policy — so an imported person is immediately
rankable, at the discounted trust the engine applies to a self-reported level. The import page and
preview say so in as many words. 12 new parser assertions (`test:import` now 34).

`npm run verify` green: typecheck + lint + 57 engine + 34 import + 9 email + build. No migration —
`person_skills` already had `provenance` and `source`.

**Not verified live** — needs an admin to paste a roster with skills and confirm the `person_skills`
rows land and the people then appear in a ranking (discounted).

**Done (2026-08-27) — the ranking says which trust it is looking at.** `coveringProvenance(person,
reqs)` in `lib/engine/score.ts` reduces the provenances of the skills a person actually brings to a
set of requirements down to their *weakest link* — `'unknown'` when the covering skills carry no
provenance (the seeded pool), `'none'` when nothing contributes. The staffing page
(`/project/[id]/staff/[roleId]`) tags each candidate with it: `verified` / `endorsed` in colour,
`self-reported` / `from résumé` muted, nothing at all for the seeded pool. A line under the ranking
explains that a `self-reported` tag means the score has already been discounted. 4 engine
assertions (suite now 61). Pure, UI-only, no migration. This is the "and the interface says so"
half of the trust work — it makes slice 11's discount, otherwise invisible, legible on the page
where the pitch lives.

**Still open in Phase 3:** resume / GitHub import as an AI action, recency, endorsements
(`endorsements` table + RLS already exist in `0001`, but the engine reads `person_skills.provenance`
not the endorsement rows, and the org owner has no `people` row to endorse *from* yet — that ties
into claim-your-profile), and a per-*skill* breakdown rather than the single weakest-link tag.

### Phase 3.5 — The engine phase

§6 items. Recommended core: **6.1 capacity conflicts, 6.2 bus factor, 6.3 options with tradeoffs,
6.4 infeasibility diagnosis**, plus **6.15 the benchmark** because it costs an hour. Then **6.7
growth-aware staffing** as the signature move if there is room.

### Phase 4 — Teams that stay alive

- Projects persist, with membership and hours that change over time.
- Health recomputes on every change; drift alerts — *"coverage fell to 71% because someone dropped
  to five hours a week, here is the repair."*
- Mid-project re-optimisation, not just initial assembly.
- Acceptance history and outcomes feed future ranking. Arithmetic on real events, not a model —
  results stay reproducible.

### Phase 5 — Proof, finish, and the deck

- The counterfactual panel: what a keyword filter picks versus what the engine picks, same brief,
  side by side. Highest persuasion-per-hour artifact available.
- Empty, loading, error and permission states on every flow.
- Rate limiting on `/api/ai`; mobile passes on new screens.
- The presentation, assembled from the phases rather than written the night before.

---

## 8. Deferred and declined

| Item | Verdict | Reason |
|---|---|---|
| LinkedIn scraping / ingestion | **Declined** | Breaks LinkedIn's terms, legally exposed, and forfeits the one claim about this data nobody can attack: that it was never scraped. A person's own export, GitHub's public API, and HR-system connectors do the same job honestly. |
| Open marketplace direction | **Declined** | See §1. Cold start, unverifiable data, no buyer. |
| ML-based ranking | **Declined** | "The engine decides, the AI explains" is the strongest answer available under questioning. Reproducibility is worth more than a model here. |
| Time-phased requirements (design needed up front, ops needed at the end) | **Deferred** | Genuinely better modelling and would produce smaller teams, but it is a large change to `Brief` and `coverage()`. Revisit after §6.1. |
| Slack / calendar integrations | **Deferred** | Real signal of deployability, but integration work is a poor trade against engine work right now. Say "connector-ready", build later. |
| Multi-org / federated pools | **Deferred** | Interesting once single-org works. Not before. |

---

## 9. Risks

1. **A login wall in front of a first-time visitor.** Real auth and unattended evaluation pull
   against each other. Mitigated by the guest route in Phase 0: sign-in to act, never to look.
2. **Twelve half-features instead of four finished ones.** This is how "make it real" usually
   fails. A product feels real because its flows are *complete* — the second person to invite the
   same candidate, the expired link, the empty roster, the deleted profile. Four flows nobody can
   break beat nine that fall over on the second click.
3. **The interface outgrowing the engine further.** Already 8.6:1. Every phase should add more to
   what the engine can *reason about* than to what the screen displays.
4. **Demo data leaking into real results.** Isolate at the query level, not by convention.
5. **Live-demo fragility.** The deterministic path stays the default; the database is additive.
   Nothing that renders should require a round trip.

---

## 10. The quality bar

Current: **95.92/100**.

| Dimension | Now | What has to be true after |
|---|---|---|
| Code Quality | 86 | The weakest, and most at risk. `Workspace.tsx` 815, `TeamBuilder.tsx` 662. Target: data layer separated from interface, nothing over ~300 lines. |
| Security | 98 | Currently cheap — no accounts, no data, no writes. Real auth and a real database make this genuinely hard: RLS, server-side authorisation on every read, no privileged key near the client, rate limits. Holding 98 *after* Phase 0 is worth far more than 98 today. |
| Testing | 98 | 51 engine tests. The invitation state machine, provenance discounting, and import parsing are all pure logic and all testable. |
| Accessibility | 96 | Hold. Auth, import, invitations and profile editing are all forms — exactly where accessibility is usually lost. |
| Efficiency | 100 | Hold. Engine stays pure and synchronous; database work stays on the server. |
| Problem alignment | 100 | Committing to internal team formation strengthens this. The marketplace direction was the one that risked drifting. |

---

## 11. Open questions

- Supabase project needs to be created by the owner (account signup). URL + keys needed before
  Phase 0 can be wired, though schema and repositories can be written without them.
- **What happens to the seeded six companies?** The seed has 60 people spread across 6 companies,
  and `ScopeFilter` filters by `companyId`. Under the internal-org decision, one org is one
  company — so importing the seed as *one* demo org collapses that filter, and importing it as
  *six* orgs breaks cross-org team building, since people are only visible inside their own org.
  Most likely answer: one demo org, and the six become departments or offices. Needs deciding
  before the seed migration is written. `lib/data/people.ts` carries a comment pointing here.
  **Resolved (2026-08-27):** one demo org, six departments — see §7 Phase 0.
- ~~GitHub OAuth from day one, or magic link only first?~~ **Resolved (2026-08-27):** email,
  Google, and GitHub are all live, tested against the real providers. **Before the demo**: the
  Google OAuth app is still in Testing mode (Google Cloud Console → Audience) — only accounts
  added as test users can sign in until it's published, or judges hit a wall. LinkedIn OAuth is
  deferred (needs a LinkedIn Company Page + a logo upload, not code work). Phone/SMS OTP is
  declined outright — Supabase needs a paid SMS provider, and Indian numbers additionally require
  DLT registration with TRAI before an OTP SMS can be sent at all; email magic link already covers
  the same need for free.
- Does the presentation want a live demo against real data, or the deterministic demo org? Affects
  how much Phase 4 polish matters.
- Is there an appetite for §6.7 growth-aware staffing? It is the most distinctive item here and
  also the least conventional.

---

## Reference

- Live: https://projectmatch-noiryn.vercel.app
- Repo: https://github.com/Noiryn2902/projectmatch
- Roadmap artifact: https://claude.ai/code/artifact/4dddf163-788e-47b4-b420-a521547cf4f9
- Build journey: `docs/ProjectMatch-Journey.docx`
- Next.js docs for this exact version: `node_modules/next/dist/docs/` — **read these, not memory.**
