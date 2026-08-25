# ProjectMatch

**Describe your project in two lines, get a full team back — not a search results page.**

Built for PromptWars. Problem statement: *ProjectMatch — Team Formation Platform*.

## The idea

People build teams from whoever they already know, so a developer who needs a designer never finds one. ProjectMatch is an opt-in directory of people with their skills, experience, availability and contact details. You write a short brief, AI works out which roles the project needs, and the platform assembles a team — then tells you honestly what that team is still missing.

## The approach

**Team formation is a set problem, not a search problem.**

Every other tool scores each candidate on their own, so a search for "React" returns four React developers and you end up with no designer. We score what a person *adds* to the team you already have.

Verified in `scripts/test-engine.ts` against the seeded directory:

```
seat 1 taken by: Diego Larsen (Senior frontend engineer)
  next best same-skill  Jae Diallo       Principal frontend engineer   adds 0%
  best designer         Diego Lundqvist  Junior product designer       adds 12%
```

A more senior developer with the same skills adds nothing. A junior designer, who would rank far lower in any list view, is the correct pick. That difference is the whole product.

### What the scoring weighs

| Component | Weight |
|---|---|
| Gap fill — share of what's missing this person closes | 34% |
| Seat fit — can they actually do this role | 26% |
| Availability — free hours and overlapping working windows | 16% |
| Experience — seniority balance against the role | 12% |
| Interest — domain the person actually cares about | 12% |
| Redundancy penalty | up to −20% |

### Skills match through a graph, not keywords

`React ~ Next.js = 0.7`, `React ~ Vue = 0.45`, `React ~ PostgreSQL = 0.2`, `React ~ UI design = 0`.

Someone who wrote "Next.js" still counts when the brief asks for "React". A keyword filter misses them entirely.

### Availability is a real input, not a checkbox

Each person carries working hours and a timezone. The engine intersects the whole team's working windows, so it can tell you *"these 4 share only 3 hrs a week"* — the kind of warning that quietly kills projects and that no directory surfaces.

### Assembly

1. Rule out anyone who genuinely can't join
2. Fill each seat with whoever adds the most, recalculating after every pick
3. Run a swap pass, keeping any exchange that raises the team's score

Greedy alone reaches 82% coverage on the sample brief. The swap pass takes it to 91%.

## Where AI sits, deliberately

Gemini does two jobs: turning a plain-English brief into a structured requirement list, and writing the human explanation behind each recommendation. **It never chooses.** The choosing is deterministic code, so the same brief always produces the same team — ask "why her and not him?" twice and you get the same answer twice.

Every AI call has a deterministic fallback (`lib/ai/fallback.ts`). Pull the network cable and the app still works, it just gets a templated sentence instead of a written one.

## Running it

```bash
npm install
npm run seed
npm run dev
```

Set `GEMINI_API_KEY` in `.env.local` (see `.env.example`). Without it the app still runs on the deterministic fallback.

Verify the engine on its own, no UI required:

```bash
npx tsx scripts/test-engine.ts
```

## Layout

```
lib/engine/    pure TypeScript, no React and no network
  graph.ts     skill similarity
  score.ts     coverage, marginal gain, candidate scoring
  assemble.ts  ranking, auto-fill, swap pass
  health.ts    coverage, gaps, overlap hours
lib/data/      seeded directory: 60 people, 6 companies, 82 skills
lib/ai/        Gemini wrapper and deterministic fallbacks
app/api/ai/    the single API route
```

All matching runs in the browser on plain arithmetic. No database, no login, no waiting.

## Data

Everyone in `lib/data/people.json` is generated and fictional. No real people, nothing scraped. Regenerate deterministically with `npm run seed`.
