/**
 * Loads the deterministic seed into Postgres.
 *
 * Run once after applying supabase/migrations/0001_init.sql:
 *
 *   node scripts/migrate-seed.mjs
 *
 * It is safe to run repeatedly. The two seeded orgs are dropped and rebuilt
 * each time, and because everything below them cascades, that is enough to
 * make this idempotent without tracking what changed.
 *
 * Two orgs are created, and the split is deliberate:
 *
 *   demo         all sixty people, with the seed's six companies becoming
 *                departments. Marked is_demo, so it is readable by anyone
 *                including signed-out visitors and writable by nobody. This
 *                is what a first-time visitor explores.
 *
 *   atlas-freight  four people, an ordinary org. Its entire job is to prove
 *                the walls are real: a member of this org cannot see the
 *                sixty, and nobody outside it can see these four.
 */

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

// --- environment -----------------------------------------------------------
// Next loads .env.local automatically; a plain node script does not, and a
// dependency for four lines of parsing is not worth it.

function loadEnvLocal() {
  try {
    const text = readFileSync(join(root, '.env.local'), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      // .trim() is load-bearing on Windows: CRLF leaves a \r on the value,
      // which travels into the apikey header, gets rejected, and the request
      // silently downgrades to the anonymous role. PostgREST then reports the
      // table as missing from the schema cache rather than as forbidden, which
      // sends you looking for a schema problem that does not exist.
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '').trim();
      }
    }
  } catch {
    /* no .env.local — fall back to whatever is already in the environment */
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Missing credentials.\n\n' +
      'This script writes past row level security, so it needs the service role key:\n' +
      '  NEXT_PUBLIC_SUPABASE_URL     (Supabase dashboard -> Settings -> API)\n' +
      '  SUPABASE_SERVICE_ROLE_KEY    (same page, the secret one)\n\n' +
      'Put both in .env.local. See .env.example.',
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const die = (label, error) => {
  if (!error) return;
  console.error('\n' + label + ' failed: ' + error.message);
  process.exit(1);
};

// --- provenance ------------------------------------------------------------
/**
 * Seeded skill levels have to claim a source like any other, and marking all
 * of them verified would misrepresent invented data. So the demo carries a
 * deliberate spread instead — which also means the discounting the engine
 * applies to unverified levels is visible in the demo rather than theoretical.
 *
 * Deterministic: the same person and skill always land on the same value.
 */
function provenanceFor(personIndex, skillIndex, level) {
  const h = (personIndex * 31 + skillIndex * 17) % 100;
  if (level >= 4) return h < 55 ? 'verified' : h < 85 ? 'endorsed' : 'self';
  if (level === 3) return h < 25 ? 'verified' : h < 60 ? 'endorsed' : h < 85 ? 'extracted' : 'self';
  return h < 20 ? 'endorsed' : h < 55 ? 'extracted' : 'self';
}

/** Recent for most, stale for a deliberate few, so recency has something to say. */
function lastUsedFor(personIndex, skillIndex, level) {
  const h = (personIndex * 13 + skillIndex * 7) % 100;
  const monthsAgo = level >= 4 ? h % 6 : h < 70 ? h % 14 : 24 + (h % 30);
  const d = new Date(Date.UTC(2026, 7, 1));
  d.setUTCMonth(d.getUTCMonth() - monthsAgo);
  return d.toISOString().slice(0, 10);
}

// --- the second org --------------------------------------------------------

const ATLAS_PEOPLE = [
  {
    name: 'Ivo Berger', title: 'Operations lead', office: 'Rotterdam', utcOffset: 1,
    yearsExp: 11, seniority: 4, hoursPerWeek: 8, hue: 210,
    skills: [['product-management', 4], ['analytics', 3], ['sql', 2]],
  },
  {
    name: 'Wren Adeyemi', title: 'Backend engineer', office: 'Rotterdam', utcOffset: 1,
    yearsExp: 5, seniority: 3, hoursPerWeek: 12, hue: 140,
    skills: [['backend', 3], ['python', 4], ['postgres', 3]],
  },
  {
    name: 'Sasha Lindqvist', title: 'Data analyst', office: 'Malmo', utcOffset: 1,
    yearsExp: 3, seniority: 2, hoursPerWeek: 15, hue: 45,
    skills: [['analytics', 3], ['sql', 3], ['python', 2]],
  },
  {
    name: 'Tomas Ruiz', title: 'Junior frontend engineer', office: 'Malmo', utcOffset: 1,
    yearsExp: 1, seniority: 1, hoursPerWeek: 20, hue: 300,
    skills: [['frontend', 2], ['javascript', 2], ['react', 1]],
  },
];

// --- run -------------------------------------------------------------------

async function main() {
  const skills = read('lib/seed/skills.json');
  const companies = read('lib/seed/companies.json');
  const people = read('lib/seed/people.json');

  console.log('Seeding ' + people.length + ' people, ' + skills.length + ' skills.\n');

  // Skills. Inserted parent-blind first because skills.parent is a self
  // reference and the vocabulary is not ordered by depth.
  const flat = skills.map((s) => ({
    id: s.id,
    label: s.label,
    parent: null,
    aliases: s.aliases ?? [],
    related: s.related ?? [],
  }));
  die('skills insert', (await db.from('skills').upsert(flat, { onConflict: 'id' })).error);

  for (const s of skills.filter((s) => s.parent)) {
    die('skill parent', (await db.from('skills').update({ parent: s.parent }).eq('id', s.id)).error);
  }
  console.log('  skills        ' + skills.length);

  // Rebuild both seeded orgs from scratch. Everything below cascades.
  die('org cleanup', (await db.from('orgs').delete().in('slug', ['demo', 'atlas-freight'])).error);

  const offices = [...new Set(companies.flatMap((c) => c.offices))];
  const { data: demo, error: demoErr } = await db
    .from('orgs')
    .insert({ name: 'Demo organisation', slug: 'demo', offices, is_demo: true })
    .select('id')
    .single();
  die('demo org', demoErr);

  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  // Ids are generated here rather than read back from the insert. Postgres
  // usually returns rows in the order they were sent, but "usually" is not a
  // guarantee to hang every skill record on.
  const personIds = people.map(() => randomUUID());

  const personRows = people.map((p, i) => ({
    id: personIds[i],
    org_id: demo.id,
    name: p.name,
    title: p.title,
    office: p.office,
    // The six seeded companies become departments of the one demo org.
    department: companyName.get(p.companyId) ?? '',
    utc_offset: p.utcOffset,
    years_exp: p.yearsExp,
    seniority: p.seniority,
    hours_per_week: p.hoursPerWeek,
    interests: p.interests ?? [],
    email: p.contact?.email ?? null,
    slack: p.contact?.slack ?? null,
    linkedin: p.contact?.linkedin ?? null,
    github: p.contact?.github ?? null,
    photo: p.photo ?? null,
    hue: p.hue,
    open_to_projects: p.openToProjects,
  }));

  die('people insert', (await db.from('people').insert(personRows)).error);
  console.log(
    '  demo org      ' + personRows.length + ' people across ' + companies.length + ' departments',
  );

  const skillRows = [];
  people.forEach((p, pi) => {
    p.skills.forEach((s, si) => {
      skillRows.push({
        person_id: personIds[pi],
        skill_id: s.skillId,
        level: s.level,
        provenance: provenanceFor(pi, si, s.level),
        source: 'seed',
        last_used_at: lastUsedFor(pi, si, s.level),
      });
    });
  });
  die('person_skills', (await db.from('person_skills').insert(skillRows)).error);

  const spread = skillRows.reduce((acc, r) => {
    acc[r.provenance] = (acc[r.provenance] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    '  skill records ' + skillRows.length + '  (' +
      Object.entries(spread).map(([k, v]) => k + ' ' + v).join(', ') + ')',
  );

  // One example project, seeded directly like the people above rather than
  // created through the app — Phase 1 (org membership) does not exist yet, so
  // there is no real path to write a project into an org. This gives
  // /project/[id] something genuine to be tested against in the meantime, and
  // gives everyone else a linkable example to look at. One seat is left open
  // on purpose: a perfectly staffed demo team proves nothing about the health
  // computation that an honest gap does not.
  const EXAMPLE_ROLES = [
    {
      title: 'Data engineer',
      hoursNeeded: 8,
      requirements: [
        ['sql', 3, 3],
        ['etl', 3, 2],
        ['data-modeling', 3, 2],
      ],
      fillTitle: /data (engineer|analyst)/i,
    },
    {
      title: 'Backend engineer',
      hoursNeeded: 10,
      requirements: [
        ['api-design', 3, 3],
        ['nodejs', 3, 2],
        ['postgres', 3, 2],
      ],
      fillTitle: /backend engineer/i,
    },
    {
      title: 'Product designer',
      hoursNeeded: 8,
      requirements: [
        ['ui-design', 3, 3],
        ['ux-research', 3, 2],
        ['figma', 3, 2],
      ],
      fillTitle: null, // left open deliberately
    },
  ];

  const { data: exampleProject, error: exampleProjectErr } = await db
    .from('projects')
    .insert({
      org_id: demo.id,
      name: 'Support ticket theme reports',
      brief_text:
        'Internal tool that turns customer support tickets into weekly theme reports. ' +
        'Roughly 6 weeks. It needs to actually ship, not stay a prototype.',
      duration_weeks: 6,
      domain: ['data'],
      status: 'staffing',
    })
    .select('id')
    .single();
  die('example project', exampleProjectErr);

  let filledSeats = 0;
  for (const [i, role] of EXAMPLE_ROLES.entries()) {
    const { data: roleRow, error: roleErr } = await db
      .from('project_roles')
      .insert({
        project_id: exampleProject.id,
        title: role.title,
        hours_needed: role.hoursNeeded,
        position: i,
      })
      .select('id')
      .single();
    die('example project role', roleErr);

    die(
      'example project requirements',
      (
        await db.from('requirements').insert(
          role.requirements.map(([skillId, minLevel, weight]) => ({
            role_id: roleRow.id,
            skill_id: skillId,
            min_level: minLevel,
            weight,
          })),
        )
      ).error,
    );

    const candidateIdx = role.fillTitle ? people.findIndex((p) => role.fillTitle.test(p.title)) : -1;
    const personId = candidateIdx >= 0 ? personIds[candidateIdx] : null;
    if (personId) filledSeats += 1;

    die(
      'example project seat',
      (
        await db.from('seats').insert({
          project_id: exampleProject.id,
          role_id: roleRow.id,
          person_id: personId,
          state: personId ? 'filled' : 'open',
        })
      ).error,
    );
  }
  console.log(
    '  example project ' + filledSeats + '/' + EXAMPLE_ROLES.length + ' seats filled — id ' +
      exampleProject.id,
  );

  // The second org. Ordinary, not demo — invisible to everyone who is not a
  // member, which is the entire point of it existing.
  const { data: atlas, error: atlasErr } = await db
    .from('orgs')
    .insert({
      name: 'Atlas Freight',
      slug: 'atlas-freight',
      offices: ['Rotterdam', 'Malmo'],
      is_demo: false,
    })
    .select('id')
    .single();
  die('atlas org', atlasErr);

  const atlasIds = ATLAS_PEOPLE.map(() => randomUUID());

  const atlasPeopleErr = (
    await db.from('people').insert(
      ATLAS_PEOPLE.map((p, i) => ({
        id: atlasIds[i],
        org_id: atlas.id,
        name: p.name,
        title: p.title,
        office: p.office,
        department: 'Operations',
        utc_offset: p.utcOffset,
        years_exp: p.yearsExp,
        seniority: p.seniority,
        hours_per_week: p.hoursPerWeek,
        interests: [],
        hue: p.hue,
        open_to_projects: true,
      })),
    )
  ).error;
  die('atlas people', atlasPeopleErr);

  const atlasSkills = [];
  ATLAS_PEOPLE.forEach((p, pi) => {
    p.skills.forEach(([skillId, level], si) => {
      atlasSkills.push({
        person_id: atlasIds[pi],
        skill_id: skillId,
        level,
        provenance: provenanceFor(pi + 90, si, level),
        source: 'seed',
        last_used_at: lastUsedFor(pi + 90, si, level),
      });
    });
  });
  die('atlas person_skills', (await db.from('person_skills').insert(atlasSkills)).error);
  console.log('  atlas freight ' + atlasIds.length + ' people, isolated from the demo org');

  console.log('\nDone.');
}

main().catch((e) => {
  console.error('\nUnexpected failure: ' + (e?.message ?? e));
  process.exit(1);
});
