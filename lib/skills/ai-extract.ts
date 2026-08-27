import 'server-only';

import { generateJson } from '../ai/client';
import { SKILLS, resolveSkill } from '../engine/graph';
import { extractSkills, type ExtractedSkill } from './extract';

/**
 * Reading skills out of a résumé, with Gemini doing the reading.
 *
 * The deterministic matcher in ./extract.ts only finds a skill when its
 * label or an alias appears literally. Real writing does not oblige: "I
 * build REST APIs" never says *API design*, "shipped to containers" never
 * says *Docker*, and "design reviews" says *design* while meaning nothing of
 * the sort. A model reads the sentence instead of the substring.
 *
 * Three constraints keep this honest, and they are the same three the rest
 * of the AI in this product works under:
 *
 *   1. The model may only answer with skills from the 82-skill vocabulary,
 *      given to it in the prompt and enforced again on the way back through
 *      `resolveSkill` — anything it invents is dropped, not stored.
 *   2. Structured output via responseSchema, so there is nothing to parse
 *      out of prose.
 *   3. Every failure — no key, all three models busy, a timeout, a garbage
 *      body — falls through to the deterministic matcher. The feature works
 *      with the network unplugged; it is just less perceptive.
 *
 * Levels are the model's read of evidence in the text, clamped to 1..5. They
 * still land as `extracted` provenance, which the engine discounts to 0.75 —
 * an inference about a claim is not a verified fact, and the scoring says so.
 */

const VOCAB = SKILLS.filter((s) => !['engineering', 'data'].includes(s.id))
  .map((s) => s.label)
  .join(', ');

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    skills: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          skill: { type: 'STRING' },
          level: { type: 'INTEGER' },
        },
        required: ['skill', 'level'],
      },
    },
  },
  required: ['skills'],
};

function prompt(text: string): string {
  return [
    'You are reading a résumé or professional bio and listing the skills it evidences.',
    '',
    'Text:',
    text.slice(0, 6000),
    '',
    'Rules:',
    '- Every "skill" value MUST be copied exactly from this list, and nothing else:',
    VOCAB,
    '- Only include a skill the text gives real evidence for. Do not pad the list.',
    '- Infer the obvious: "built REST APIs" is API design, "runs in containers" is Docker,',
    '  "deployment pipelines" is CI/CD, "large language models" is LLMs.',
    '- Do NOT be fooled by incidental words. "design reviews" is not UI design;',
    '  "managed a data centre migration" is not Data modeling.',
    '- level is 1 to 5 for how strong the evidence is: 1 a passing mention,',
    '  3 clear working use, 5 years of depth or explicit seniority in it.',
    '- Return at most 25 skills, strongest evidence first.',
  ].join('\n');
}

export interface ExtractionResult {
  skills: ExtractedSkill[];
  /** Which path produced these — shown to the person so the claim is not overstated. */
  source: 'ai' | 'fallback';
}

const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n) || 3));

/**
 * Best available reading of the text. Never throws and never returns
 * nothing where the deterministic matcher would have found something.
 */
export async function extractSkillsSmart(text: string): Promise<ExtractionResult> {
  const deterministic = extractSkills(text);
  if (!text.trim()) return { skills: deterministic, source: 'fallback' };

  const result = await generateJson<{ skills: { skill: string; level: number }[] }>(
    prompt(text),
    SCHEMA,
  );

  if (!result?.data?.skills?.length) {
    return { skills: deterministic, source: 'fallback' };
  }

  // Re-resolve every answer against the vocabulary. The prompt asks for exact
  // labels; this is what makes it true rather than hoped for.
  const seen = new Set<string>();
  const skills: ExtractedSkill[] = [];
  for (const raw of result.data.skills) {
    const id = resolveSkill(String(raw.skill ?? ''));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    skills.push({ skillId: id, level: clamp(Number(raw.level)) });
    if (skills.length >= 25) break;
  }

  // A model that came back with nothing usable is a failed call, not an
  // answer of "this person has no skills".
  if (skills.length === 0) return { skills: deterministic, source: 'fallback' };

  return { skills, source: 'ai' };
}
