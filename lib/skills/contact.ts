/**
 * Pulling the obvious personal details out of résumé text.
 *
 * Pure, deterministic, and deliberately timid. Everything here is either
 * unambiguous in the text (an email address, a phone number) or a stated
 * convention that résumés almost always follow (the name is the first line).
 * When a guess would be a guess, this returns nothing and lets the person
 * type it — a wrong name silently filled into a form is worse than an empty
 * field, because nobody proofreads a box that already looks answered.
 *
 * Two things it will never do:
 *
 *   - Infer gender. It is not in the text, it is not derivable from a name,
 *     and a product has no business deciding it on someone's behalf.
 *   - Invent a postal address. A city on a résumé is a city, not an address.
 *
 * Whatever comes back is a suggestion shown in an editable field, never a
 * value written straight to the database.
 */

export interface ExtractedContact {
  name?: string;
  /** The line under the name — "Senior Backend Engineer" and the like. */
  title?: string;
  email?: string;
  phone?: string;
  /** A city, or "City, Country" — whatever sat on the contact line. */
  location?: string;
  /** The first line under an EDUCATION heading, verbatim. */
  qualification?: string;
  /** The largest plausible "N years" the document claims. */
  yearsExp?: number;
  /** 1–5, from the years claimed and the seniority word in the title. */
  seniority?: number;
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

/**
 * Deliberately narrow: an optional +country, then 7-14 digits with spaces,
 * dashes, dots or brackets between them. Loose enough for international
 * formats, tight enough not to match a date range or a postcode.
 */
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d(?:[\d\s.-]{5,16})\d/;

/** Words that mean a line is a heading, not a name. */
const HEADINGS =
  /^(resume|curriculum vitae|cv|summary|profile|objective|experience|education|skills|contact|about)\b/i;

const CITIES_HINT =
  /\b(remote|bengaluru|bangalore|mumbai|delhi|pune|hyderabad|chennai|kolkata|london|berlin|paris|madrid|lisbon|dublin|amsterdam|new york|san francisco|seattle|austin|toronto|vancouver|sydney|melbourne|singapore|tokyo|seoul|dubai|nairobi|lagos|cairo|são paulo|sao paulo|mexico city)\b/i;

/** Digits only, for judging whether a candidate phone is plausible. */
const digits = (s: string) => s.replace(/\D/g, '');

/**
 * A name, if the first few lines contain something that looks like one.
 *
 * Résumés open with the person's name on its own line, usually in caps. This
 * checks the first six non-empty lines and accepts the first that is short,
 * mostly letters, two to four words, and not a section heading. Anything
 * else and it gives up rather than guessing.
 */
function findName(lines: string[]): { name: string; at: number } | undefined {
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i]!.trim();
    if (line.length < 3 || line.length > 60) continue;
    if (HEADINGS.test(line)) continue;
    if (EMAIL.test(line)) continue;
    if (/\d/.test(line)) continue;
    // A pipe or bullet means it is a contact line, not a name.
    if (/[|•·@/]/.test(line)) continue;

    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 4) continue;
    if (!/^[A-Za-z][A-Za-z'.\- ]*$/.test(line)) continue;

    // ALL CAPS is the common résumé style; title-case it so it does not land
    // in the field shouting.
    if (line === line.toUpperCase()) {
      return {
        name: words.map((w) => w[0] + w.slice(1).toLowerCase()).join(' '),
        at: i,
      };
    }
    return { name: line, at: i };
  }
  return undefined;
}

/**
 * The job title, which on a résumé is the line directly under the name.
 *
 * That convention is strong enough to rely on and weak enough to check: the
 * line has to be short, free of contact punctuation, and not a section
 * heading. "Senior Backend & Data Engineer" passes; an address line, an email
 * line, or a straight drop into EXPERIENCE does not.
 */
function findTitle(lines: string[], nameAt: number): string | undefined {
  const line = lines[nameAt + 1]?.trim();
  if (!line) return undefined;
  if (line.length < 3 || line.length > 70) return undefined;
  if (HEADINGS.test(line)) return undefined;
  if (EMAIL.test(line)) return undefined;
  // Pipes and bullets mean the contact line; a digit means a date or a phone.
  if (/[|•·@]/.test(line)) return undefined;
  if (/\d/.test(line)) return undefined;
  return line;
}

/**
 * Whatever sits under the EDUCATION heading, taken verbatim and not parsed.
 *
 * `qualification` is one free-text line by design — the engine never reads it
 * — so splitting a degree into institution, field and year would be work in
 * service of nothing. The first substantive line under the heading is what a
 * person would have typed into the box themselves.
 */
function findQualification(lines: string[]): string | undefined {
  const at = lines.findIndex((l) => /^(education|qualifications?|academics?)\b/i.test(l.trim()));
  if (at === -1) return undefined;

  for (const raw of lines.slice(at + 1, at + 4)) {
    const line = raw.trim().replace(/^[-•·*]\s*/, '');
    if (line.length < 4 || line.length > 200) continue;
    if (HEADINGS.test(line)) break;
    return line;
  }
  return undefined;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20,
};

/**
 * The largest "N years" the document claims about itself.
 *
 * Largest, not first, because a résumé opens with the total and then talks
 * about three years of this and two of that; the total is the one that
 * describes the person. Written-out numbers count — "Nine years building" is
 * how the opening line of a résumé actually reads.
 *
 * Anything over forty is a company's age or a typo, not a career.
 */
function findYears(text: string): number | undefined {
  const words = Object.keys(NUMBER_WORDS).join('|');
  const re = new RegExp('\\b(\\d{1,2}|' + words + ')\\s*\\+?\\s*(?:years?|yrs?)\\b', 'gi');

  let best = 0;
  for (const m of text.matchAll(re)) {
    const raw = m[1]!.toLowerCase();
    const n = NUMBER_WORDS[raw] ?? Number(raw);
    if (Number.isFinite(n) && n > best && n <= 40) best = n;
  }
  return best > 0 ? best : undefined;
}

/** Years of work, on the schema's 1–5 scale. */
function seniorityFromYears(years: number): number {
  if (years <= 1) return 1;
  if (years <= 3) return 2;
  if (years <= 6) return 3;
  if (years <= 10) return 4;
  return 5;
}

/**
 * A floor set by the title, because the two disagree often enough to matter.
 *
 * Nine years and "Principal Engineer" is a 5, not the 4 the years alone give;
 * eight years and "Junior developer" is somebody returning to the field or
 * changing track, and the title is the honest read. Neither overrides the
 * other blindly — the years set the base and the word can only raise it,
 * except for the explicitly junior words, which cap it.
 */
function seniorityFromTitle(title: string): { floor?: number; ceiling?: number } {
  const t = title.toLowerCase();
  if (/\b(intern|trainee|graduate|apprentice)\b/.test(t)) return { ceiling: 1 };
  if (/\b(junior|jr\.?|entry[- ]level)\b/.test(t)) return { ceiling: 2 };
  if (/\b(principal|distinguished|head of|director|vp|chief|cto)\b/.test(t)) return { floor: 5 };
  if (/\b(staff|lead|architect)\b/.test(t)) return { floor: 4 };
  // "Manager" names a role as often as a rank — a Product Manager is not
  // senior to a Product Designer by virtue of the word.
  if (/\b(senior|sr\.?|manager)\b/.test(t)) return { floor: 3 };
  return {};
}

/** A city, if one of the known ones is on a contact line near the top. */
function findLocation(lines: string[]): string | undefined {
  for (const raw of lines.slice(0, 8)) {
    const match = CITIES_HINT.exec(raw);
    if (!match) continue;
    const city = match[0];
    return city[0].toUpperCase() + city.slice(1);
  }
  return undefined;
}

export function extractContact(text: string): ExtractedContact {
  if (!text.trim()) return {};

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const found: ExtractedContact = {};

  const named = findName(lines);
  if (named) {
    found.name = named.name;
    const title = findTitle(lines, named.at);
    if (title) found.title = title;
  }

  const qualification = findQualification(lines);
  if (qualification) found.qualification = qualification;

  const years = findYears(text);
  if (years !== undefined) {
    found.yearsExp = years;
    let seniority = seniorityFromYears(years);
    if (found.title) {
      const { floor, ceiling } = seniorityFromTitle(found.title);
      if (floor !== undefined) seniority = Math.max(seniority, floor);
      if (ceiling !== undefined) seniority = Math.min(seniority, ceiling);
    }
    found.seniority = seniority;
  } else if (found.title) {
    // No years stated, but a title that says something. Better than the
    // schema's default of 1 for everyone.
    const { floor, ceiling } = seniorityFromTitle(found.title);
    if (floor !== undefined) found.seniority = floor;
    else if (ceiling !== undefined) found.seniority = ceiling;
  }

  const email = EMAIL.exec(text)?.[0];
  if (email) found.email = email.toLowerCase();

  // Search the top of the document only. A phone number is on the contact
  // line; a run of digits further down is a date, a metric, or a version.
  const head = lines.slice(0, 8).join('\n');
  const phone = PHONE.exec(head)?.[0]?.trim();
  if (phone) {
    const n = digits(phone).length;
    if (n >= 8 && n <= 15) found.phone = phone;
  }

  const location = findLocation(lines);
  if (location) found.location = location;

  return found;
}
