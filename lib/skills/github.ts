import 'server-only';

import { resolveSkill } from '../engine/graph';
import type { ExtractedSkill } from './extract';

/**
 * Reading skills off a public GitHub profile.
 *
 * This is the one third-party import the plan sanctions, and the reason is
 * worth keeping in view: it uses GitHub's *public* API, on a username the
 * person typed in themselves, reading data they published deliberately.
 * No scraping, no extra OAuth scope, nothing behind a login. Scraping
 * LinkedIn was declined for the opposite reasons and that decision stands.
 *
 * The signal is language bytes per repository, which is a better measure
 * than a résumé sentence: it is what someone has actually written, weighted
 * by how much of it. Topics come along too, since a repo tagged `kubernetes`
 * is evidence even when the language is YAML.
 */

const API = 'https://api.github.com';
const TIMEOUT_MS = 8000;
/** Enough to characterise someone; more is rate limit for no extra signal. */
const REPOS = 60;

export class GitHubError extends Error {}

interface Repo {
  name: string;
  fork: boolean;
  archived: boolean;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
}

/** Bare username, from a handle, a profile URL, or an @-prefixed mention. */
export function parseHandle(input: string): string | null {
  const trimmed = input.trim().replace(/^@/, '');
  const fromUrl = trimmed.match(/github\.com\/([A-Za-z0-9-]+)/i);
  const handle = fromUrl ? fromUrl[1] : trimmed;
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(handle) ? handle : null;
}

async function get<T>(path: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API + path, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ProjectMatch',
        // Lifts the anonymous rate limit from 60/hr to 5000/hr when a token
        // happens to be configured. Entirely optional.
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
    });
    if (res.status === 404) throw new GitHubError('No GitHub user by that name.');
    if (res.status === 403) throw new GitHubError('GitHub is rate limiting us — try again shortly.');
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof GitHubError) throw err;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface GitHubResult {
  handle: string;
  repos: number;
  skills: ExtractedSkill[];
  /** Language and topic words that matched nothing in the vocabulary. */
  unrecognised: string[];
}

/**
 * Weight to a 1..5 level. Someone's dominant language should read as strong
 * without a single toy repository implying expertise, so this is share of
 * their public work rather than a raw count.
 */
function levelFor(share: number, repos: number): number {
  if (repos >= 3 && share >= 0.35) return 5;
  if (share >= 0.2) return 4;
  if (share >= 0.08) return 3;
  return 2;
}

export async function skillsFromGitHub(input: string): Promise<GitHubResult> {
  const handle = parseHandle(input);
  if (!handle) throw new GitHubError('That does not look like a GitHub username.');

  const repos = await get<Repo[]>(
    `/users/${handle}/repos?per_page=${REPOS}&sort=pushed&type=owner`,
  );
  if (repos === null) throw new GitHubError('Could not reach GitHub just now.');

  // Forks and archives are not evidence of what someone can do.
  const own = repos.filter((r) => !r.fork && !r.archived);
  if (own.length === 0) {
    return { handle, repos: 0, skills: [], unrecognised: [] };
  }

  const weight = new Map<string, number>();
  const unrecognised = new Set<string>();

  const bump = (word: string, by: number) => {
    const id = resolveSkill(word);
    if (id) weight.set(id, (weight.get(id) ?? 0) + by);
    else if (word.length > 1) unrecognised.add(word);
  };

  for (const r of own) {
    // A starred repository is stronger evidence than an untouched one, but
    // only mildly — popularity is not proficiency.
    const w = 1 + Math.min(1, r.stargazers_count / 50);
    if (r.language) bump(r.language, w);
    for (const t of r.topics ?? []) bump(t, w * 0.6);
  }

  const total = [...weight.values()].reduce((a, b) => a + b, 0) || 1;
  const skills: ExtractedSkill[] = [...weight.entries()]
    .map(([skillId, w]) => ({ skillId, level: levelFor(w / total, own.length) }))
    .sort((a, b) => b.level - a.level)
    .slice(0, 25);

  return { handle, repos: own.length, skills, unrecognised: [...unrecognised].slice(0, 8) };
}
