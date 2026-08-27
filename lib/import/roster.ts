/**
 * Reading a roster out of whatever a spreadsheet exported.
 *
 * Pure: no IO, no server-only import, no network. It runs unchanged in the
 * browser to draw an instant preview as someone pastes, and again on the
 * server at commit time — because the parsed rows a client sends back are not
 * to be trusted, only the raw text is. Everything here is a plain function
 * over strings, which is also what makes it testable without a database.
 */

export type RowStatus = 'ok' | 'dup-file' | 'dup-roster' | 'invalid';

export interface ParsedPerson {
  name: string;
  title: string;
  email: string;
  department: string;
  office: string;
  hoursPerWeek: number;
  seniority: number;
  status: RowStatus;
  /** Why a row is not `ok`, or a soft warning on one that still is. */
  note: string;
}

export interface ParsedRoster {
  /** Canonical fields the header row was understood to provide. */
  recognised: string[];
  /** Header columns that were present but map to nothing we store. */
  ignored: string[];
  rows: ParsedPerson[];
  counts: { ok: number; dupFile: number; dupRoster: number; invalid: number };
}

/** Canonical field -> the header spellings that mean it, all lowercased. */
const HEADER_ALIASES: Record<keyof PersonFields, string[]> = {
  name: ['name', 'full name', 'fullname', 'person', 'employee'],
  title: ['title', 'role', 'job title', 'jobtitle', 'position'],
  email: ['email', 'e-mail', 'mail', 'email address'],
  department: ['department', 'dept', 'team', 'group', 'division'],
  office: ['office', 'location', 'site', 'city'],
  hoursPerWeek: ['hours', 'hrs', 'hours per week', 'hours/week', 'hoursperweek', 'capacity'],
  seniority: ['seniority', 'level', 'grade'],
};

interface PersonFields {
  name: string;
  title: string;
  email: string;
  department: string;
  office: string;
  hoursPerWeek: string;
  seniority: string;
}

/**
 * Splits delimited text into rows of fields, honouring quoted values that may
 * themselves contain the delimiter, a newline, or an escaped `""` quote.
 * Delimiter is sniffed from the first line: a tab if there are more tabs than
 * commas on it, otherwise a comma.
 */
export function parseDelimited(text: string): string[][] {
  const firstLine = text.slice(0, text.search(/\r?\n/) === -1 ? text.length : text.search(/\r?\n/));
  const delimiter = (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
    ? '\t'
    : ',';

  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function canonicalFor(header: string): keyof PersonFields | null {
  const h = header.trim().toLowerCase();
  for (const key of Object.keys(HEADER_ALIASES) as (keyof PersonFields)[]) {
    if (HEADER_ALIASES[key].includes(h)) return key;
  }
  return null;
}

function toInt(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isFinite(n) ? Math.round(n) : null;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Turns pasted text into a previewable, de-duplicated roster. Nothing is
 * written here — the caller decides what to do with rows marked `ok`.
 *
 * @param existingNames names already on the roster, lower-cased, for the
 *   dup-roster check. Pass an empty set when that does not matter yet.
 */
export function normaliseRoster(text: string, existingNames: Set<string> = new Set()): ParsedRoster {
  const table = parseDelimited(text);
  if (table.length < 2) {
    return {
      recognised: [],
      ignored: [],
      rows: [],
      counts: { ok: 0, dupFile: 0, dupRoster: 0, invalid: 0 },
    };
  }

  const headerRow = table[0];
  const mapping = headerRow.map(canonicalFor);
  const recognised = [...new Set(mapping.filter((m): m is keyof PersonFields => m !== null))];
  const ignored = headerRow.filter((_, i) => mapping[i] === null && headerRow[i].trim() !== '');

  const seenInFile = new Set<string>();
  const rows: ParsedPerson[] = [];
  const counts = { ok: 0, dupFile: 0, dupRoster: 0, invalid: 0 };

  for (const raw of table.slice(1)) {
    const f: PersonFields = {
      name: '',
      title: '',
      email: '',
      department: '',
      office: '',
      hoursPerWeek: '',
      seniority: '',
    };
    mapping.forEach((key, i) => {
      if (key) f[key] = (raw[i] ?? '').trim();
    });

    const name = f.name;
    const hoursInt = f.hoursPerWeek ? toInt(f.hoursPerWeek) : null;
    const seniorityInt = f.seniority ? toInt(f.seniority) : null;

    let status: RowStatus = 'ok';
    let note = '';

    if (!name) {
      status = 'invalid';
      note = 'no name in this row';
    } else if (existingNames.has(name.toLowerCase())) {
      status = 'dup-roster';
      note = 'already on the roster';
    } else if (seenInFile.has(name.toLowerCase())) {
      status = 'dup-file';
      note = 'appears more than once here';
    } else if (f.email && !f.email.includes('@')) {
      note = 'email looks off — will still import';
    }

    if (name) seenInFile.add(name.toLowerCase());

    if (status === 'ok') counts.ok++;
    else if (status === 'dup-file') counts.dupFile++;
    else if (status === 'dup-roster') counts.dupRoster++;
    else counts.invalid++;

    rows.push({
      name,
      title: f.title,
      email: f.email,
      department: f.department,
      office: f.office,
      hoursPerWeek: hoursInt === null ? 0 : clamp(hoursInt, 0, 40),
      seniority: seniorityInt === null ? 1 : clamp(seniorityInt, 1, 5),
      status,
      note,
    });
  }

  return { recognised, ignored, rows, counts };
}
