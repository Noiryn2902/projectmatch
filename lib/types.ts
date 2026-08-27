export type SkillId = string;

export interface Skill {
  id: SkillId;
  label: string;
  aliases: string[];
  parent?: SkillId;
  related: SkillId[];
}

export interface Company {
  id: string;
  name: string;
  offices: string[];
}

/**
 * An organisation is the security boundary: a roster, the projects staffed
 * from it, and the people who administer both. `Company` is the seeded
 * equivalent, and the seeded set becomes one org with isDemo set.
 */
export interface Org {
  id: string;
  name: string;
  slug: string;
  offices: string[];
  isDemo: boolean;
}

/**
 * Who asserted a skill level. The engine trusts these unequally on purpose —
 * a level nobody has corroborated is a claim, not a measurement.
 */
export type SkillProvenance = 'self' | 'extracted' | 'endorsed' | 'verified';

export interface PersonSkill {
  skillId: SkillId;
  level: number;
  /**
   * Who asserted the level. Absent in seeded data, which predates the field —
   * the engine leaves an absent value at full trust and only discounts an
   * explicit one, so the demo pool is unaffected. See `skillTrust` in
   * lib/engine/score.ts.
   */
  provenance?: SkillProvenance;
  /** ISO date. A skill last used four years ago is not a current skill. */
  lastUsedAt?: string;
}

export interface Contact {
  email: string;
  slack: string;
  linkedin: string;
  github?: string;
}

export interface Person {
  id: string;
  name: string;
  title: string;
  companyId: string;
  office: string;
  utcOffset: number;
  yearsExp: number;
  seniority: number;
  skills: PersonSkill[];
  interests: string[];
  hoursPerWeek: number;
  contact: Contact;
  openToProjects: boolean;
  photo?: string;
  hue: number;
}

export interface Requirement {
  skillId: SkillId;
  minLevel: number;
  weight: number;
}

export interface Role {
  id: string;
  title: string;
  requirements: Requirement[];
  hoursNeeded: number;
}

export interface Brief {
  text: string;
  roles: Role[];
  durationWeeks: number;
  domain: string[];
}

export type TeamState = Record<string, string | null>;

export type SortMode =
  | 'bestFit'
  | 'experience'
  | 'availability'
  | 'skillMatch'
  | 'sameOffice';

export interface ScoreBreakdown {
  gapFill: number;
  availability: number;
  experience: number;
  interest: number;
  redundancy: number;
  total: number;
}

export interface Gap {
  label: string;
  severity: 'high' | 'medium';
}

export interface TeamHealth {
  coverage: number;
  filled: number;
  seats: number;
  overlapHours: number;
  gaps: Gap[];
}

export interface ScopeFilter {
  companyId: string | null;
  office: string | null;
}
