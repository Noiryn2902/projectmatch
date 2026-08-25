import { NextResponse } from 'next/server';
import type { Requirement, Role } from '@/lib/types';
import { SKILLS, resolveSkill } from '@/lib/engine/graph';
import { fallbackBrief, fallbackReason } from '@/lib/ai/fallback';
import { generateJson } from '@/lib/ai/client';

export const runtime = 'nodejs';

const VOCAB = SKILLS.filter((s) => !['engineering', 'data'].includes(s.id))
  .map((s) => s.label)
  .join(', ');

const WEIGHT: Record<string, number> = { must: 3, important: 2, nice: 1 };

const BRIEF_SCHEMA = {
  type: 'OBJECT',
  properties: {
    roles: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          hoursNeeded: { type: 'INTEGER' },
          requirements: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                skill: { type: 'STRING' },
                minLevel: { type: 'INTEGER' },
                importance: { type: 'STRING', enum: ['must', 'important', 'nice'] },
              },
              required: ['skill', 'minLevel', 'importance'],
            },
          },
        },
        required: ['title', 'hoursNeeded', 'requirements'],
      },
    },
    durationWeeks: { type: 'INTEGER' },
    domains: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['roles', 'durationWeeks', 'domains'],
};

const REASON_SCHEMA = {
  type: 'OBJECT',
  properties: { reason: { type: 'STRING' } },
  required: ['reason'],
};

interface AiRole {
  title: string;
  hoursNeeded: number;
  requirements: { skill: string; minLevel: number; importance: string }[];
}

function briefPrompt(text: string): string {
  return [
    'You are reading a short project brief and working out which roles the team needs.',
    '',
    'Brief:',
    text,
    '',
    'Rules:',
    '- Return 3 to 5 roles. Each role is one seat filled by one person.',
    '- Give each role 3 to 5 requirements.',
    '- Every "skill" value MUST be copied exactly from this list, nothing else:',
    VOCAB,
    '- minLevel is 1 to 5, where 3 means solidly competent and 5 means expert.',
    '- importance is "must", "important", or "nice". Give each role at least one "must".',
    '- hoursNeeded is realistic hours per week for that seat, usually 4 to 15.',
    '- domains: any domain skills from the list above that the project sits in, or an empty array.',
    '- If the brief mentions deployment, shipping, or production, include a platform or infrastructure role.',
  ].join('\n');
}

function toRoles(aiRoles: AiRole[]): Role[] {
  const roles: Role[] = [];

  for (const r of aiRoles) {
    const seen = new Set<string>();
    const requirements: Requirement[] = [];

    for (const req of r.requirements ?? []) {
      const id = resolveSkill(req.skill);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      requirements.push({
        skillId: id,
        minLevel: Math.min(5, Math.max(1, Math.round(req.minLevel) || 3)),
        weight: WEIGHT[req.importance] ?? 2,
      });
    }

    if (requirements.length === 0) continue;

    roles.push({
      id: r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `role-${roles.length}`,
      title: r.title,
      requirements,
      hoursNeeded: Math.min(30, Math.max(2, Math.round(r.hoursNeeded) || 8)),
    });
  }

  // Ids must be unique, otherwise two seats share one slot in the team map.
  const used = new Set<string>();
  for (const r of roles) {
    let id = r.id;
    let n = 2;
    while (used.has(id)) id = `${r.id}-${n++}`;
    used.add(id);
    r.id = id;
  }

  return roles;
}

export async function POST(request: Request) {
  let body: { action?: string; payload?: Record<string, unknown> };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Malformed request body.' }, { status: 400 });
  }

  const { action, payload } = body;

  if (action === 'brief') {
    const text = String(payload?.text ?? '').slice(0, 2000);
    if (text.trim().length < 8) {
      return NextResponse.json(
        { ok: false, error: 'Please add a little more detail about the project.' },
        { status: 400 },
      );
    }

    const result = await generateJson<{
      roles: AiRole[];
      durationWeeks: number;
      domains: string[];
    }>(briefPrompt(text), BRIEF_SCHEMA);

    if (result) {
      const roles = toRoles(result.data.roles ?? []);
      if (roles.length >= 2) {
        const domain = (result.data.domains ?? [])
          .map((d) => resolveSkill(d))
          .filter((d): d is string => Boolean(d));

        return NextResponse.json({
          ok: true,
          data: {
            roles,
            durationWeeks: Math.min(52, Math.max(1, result.data.durationWeeks || 6)),
            domain,
          },
          source: result.model,
        });
      }
    }

    return NextResponse.json({ ok: true, data: fallbackBrief(text), source: 'fallback' });
  }

  if (action === 'explain') {
    const name = String(payload?.name ?? 'This person');
    const title = String(payload?.title ?? '');
    const gapPct = Number(payload?.gapPct ?? 0);
    const hours = Number(payload?.hours ?? 0);
    const office = String(payload?.office ?? '');
    const covers = String(payload?.covers ?? '');
    const roleTitle = String(payload?.role ?? 'this seat');
    const missing = String(payload?.missing ?? '');

    const prompt = [
      'Write one sentence justifying a candidate selection, for a professional staffing tool.',
      '',
      `Candidate: ${name}, ${title}, based in ${office}.`,
      `Role: ${roleTitle}.`,
      `Relevant skills: ${covers || 'the core requirements'}.`,
      `Availability: ${hours} hours per week.`,
      `Closes ${gapPct}% of the team's remaining skill gap.`,
      missing ? `Gap remaining after selection: ${missing}.` : '',
      '',
      'Requirements:',
      '- One sentence, 30 words maximum, third person, starting with the candidate name.',
      '- Write all figures as numerals.',
      '- Name the specific skills directly. Never write that someone "provides" or "offers" a skill.',
      '- Plain professional register. No praise adjectives, no marketing language, no em dashes.',
      '- Never use: leverage, robust, seamless, passionate, exceptional, invaluable, perfect, ideal.',
      '- If a remaining gap is given, close the sentence by naming it.',
    ]
      .filter(Boolean)
      .join('\n');

    const result = await generateJson<{ reason: string }>(prompt, REASON_SCHEMA);

    if (result?.data?.reason) {
      return NextResponse.json({
        ok: true,
        data: { reason: result.data.reason.trim() },
        source: result.model,
      });
    }

    return NextResponse.json({
      ok: true,
      data: { reason: fallbackReason(name, gapPct, hours, office) },
      source: 'fallback',
    });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
}
