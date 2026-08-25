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

export interface PersonSkill {
  skillId: SkillId;
  level: number;
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
