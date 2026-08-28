import { overlapWindow, asClock } from './meeting';
import type { Person, Role, TeamHealth } from './types';

/**
 * @assistant, answering out of the engine rather than out of a model.
 *
 * The original build had an assistant in chat that was a Gemini call wearing
 * a team member's name. It read well and it could say anything, which is the
 * problem: the one question people actually ask it — "what are we still
 * missing" — already has an exact answer sitting in TeamHealth, computed from
 * the same requirements the ranking uses. Sending that question to a language
 * model replaces a correct answer with a plausible one.
 *
 * So this is arithmetic and a lookup table of intents. It cannot hallucinate a
 * skill nobody needs, cannot invent a person, and says "I don't know" by
 * listing what it does know. That is a better demo than fluency, because
 * every number in the reply is one the interface is showing at the same time.
 */

export interface Context {
  health: TeamHealth;
  members: Person[];
  roles: Role[];
  /** Seats with nobody in them yet. */
  open: number;
}

/*
 * Intent matching is on stems rather than whole words. Requiring a closing
 * word boundary meant "who are we depending on" missed \bdepend\b and fell
 * through to the I-don't-know reply — the worst outcome available, since the
 * engine had an exact answer to that exact question.
 */

const list = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? '')
    : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];

/** What the team still lacks, in the engine's own words. */
function missing({ health, open }: Context): string {
  const pct = Math.round(health.coverage * 100);

  if (health.gaps.length === 0 && open === 0) {
    return `Nothing I can see. ${pct}% of the brief's requirements are covered, every seat is filled, and no requirement rests on one person.`;
  }

  const parts: string[] = [`Coverage is ${pct}%.`];

  if (open > 0) {
    parts.push(`${open} seat${open === 1 ? ' is' : 's are'} still open.`);
  }

  const skillGaps = health.gaps.filter((g) => g.severity === 'high');
  if (skillGaps.length > 0) {
    parts.push(`The gaps that matter most: ${list(skillGaps.map((g) => g.label))}.`);
  }

  const soft = health.gaps.filter((g) => g.severity !== 'high');
  if (soft.length > 0) {
    parts.push(`Also worth knowing: ${list(soft.map((g) => g.label))}.`);
  }

  return parts.join(' ');
}

/** Who the team cannot afford to lose. */
function risk({ health }: Context): string {
  const spof = health.gaps.filter((g) => g.label.startsWith('Only '));

  if (health.busFactor >= 2 && spof.length === 0) {
    return `Nothing rests on a single person — every requirement the team covers has at least ${health.busFactor} people behind it.`;
  }

  if (spof.length === 0) {
    return `Bus factor is ${health.busFactor}: one person leaving would uncover something, but no single requirement is named as theirs alone.`;
  }

  return `Bus factor is ${health.busFactor}. ${list(spof.map((g) => g.label))} — if that person goes, the team loses it outright.`;
}

/** When everybody is awake at once. */
function when({ members, health }: Context): string {
  const win = overlapWindow(members);
  if (!win) {
    return `There is no hour of the day everyone is awake for — this team spans too many timezones for a shared window, so any meeting is somebody's early morning. Kickoff has the detail.`;
  }
  return `${asClock(win.start)}–${asClock(win.end)} UTC works for everyone, which is ${health.overlapHours} hours a week of overlap. Kickoff will book it.`;
}

/** Where the project stands, in one line. */
function status({ health, members, roles, open }: Context): string {
  return `${members.length} of ${roles.length} seats accepted, ${Math.round(
    health.coverage * 100,
  )}% of the brief covered, ${health.overlapHours} hrs/wk of overlap${
    open > 0 ? `, ${open} still open` : ''
  }.`;
}

const INTENTS: { test: RegExp; answer: (c: Context) => string }[] = [
  { test: /\b(missing|miss|gap|lack|weak|uncover|short|need)/i, answer: missing },
  { test: /\b(risk|bus factor|only|depend|reli|single point|lose|losing|lost)/i, answer: risk },
  { test: /\b(when|time|meet|overlap|schedul|kickoff|call|availab)/i, answer: when },
  { test: /\b(status|how are we|where are we|summary|progress|going)/i, answer: status },
];

/**
 * The reply. Always a string: an unmatched question gets the status line and
 * a list of what can be asked, which is more useful than silence.
 */
export function assistantReply(question: string, ctx: Context): string {
  const q = question.replace(/@assistant/gi, ' ').trim();

  for (const intent of INTENTS) {
    if (intent.test.test(q)) return intent.answer(ctx);
  }

  // Not understood. Say what can be asked rather than guessing at the
  // question — a wrong guess here is a wrong fact in a team's chat log.
  return `${status(ctx)}\n\nI answer from the same numbers the tabs show, so I can only tell you a few things: what the team is still missing, what rests on one person, and when everyone is awake at once.`;
}
