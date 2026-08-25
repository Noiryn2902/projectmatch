import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'data');
mkdirSync(OUT, { recursive: true });

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260825);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const pickN = (arr, n) => {
  const c = [...arr];
  const out = [];
  while (out.length < n && c.length) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]);
  return out;
};
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

const GROUPS = {
  frontend: { parent: 'engineering', skills: ['react', 'nextjs', 'vue', 'typescript', 'javascript', 'css', 'tailwind', 'accessibility'] },
  backend: { parent: 'engineering', skills: ['nodejs', 'python', 'go', 'java', 'postgres', 'mongodb', 'redis', 'api-design'] },
  devops: { parent: 'engineering', skills: ['docker', 'kubernetes', 'aws', 'gcp', 'ci-cd', 'terraform', 'monitoring'] },
  mobile: { parent: 'engineering', skills: ['react-native', 'swift', 'kotlin', 'flutter'] },
  ml: { parent: 'data', skills: ['pytorch', 'tensorflow', 'nlp', 'computer-vision', 'llm', 'mlops', 'statistics'] },
  'data-eng': { parent: 'data', skills: ['sql', 'etl', 'airflow', 'spark', 'dbt', 'data-modeling'] },
  analytics: { parent: 'data', skills: ['dashboards', 'ab-testing', 'bi-tools'] },
  design: { parent: null, skills: ['ui-design', 'ux-research', 'figma', 'prototyping', 'design-systems', 'brand', 'motion-design'] },
  product: { parent: null, skills: ['product-management', 'roadmapping', 'user-interviews', 'requirements'] },
  quality: { parent: null, skills: ['qa-testing', 'test-automation', 'security'] },
  comms: { parent: null, skills: ['technical-writing', 'project-management', 'growth-marketing'] },
  domain: { parent: null, skills: ['healthcare', 'fintech', 'education', 'ecommerce', 'logistics', 'customer-support', 'climate', 'legal'] },
};

const LABELS = {
  react: 'React', nextjs: 'Next.js', vue: 'Vue', typescript: 'TypeScript', javascript: 'JavaScript',
  css: 'CSS', tailwind: 'Tailwind', accessibility: 'Accessibility', nodejs: 'Node.js', python: 'Python',
  go: 'Go', java: 'Java', postgres: 'PostgreSQL', mongodb: 'MongoDB', redis: 'Redis', 'api-design': 'API design',
  docker: 'Docker', kubernetes: 'Kubernetes', aws: 'AWS', gcp: 'GCP', 'ci-cd': 'CI/CD', terraform: 'Terraform',
  monitoring: 'Monitoring', 'react-native': 'React Native', swift: 'Swift', kotlin: 'Kotlin', flutter: 'Flutter',
  pytorch: 'PyTorch', tensorflow: 'TensorFlow', nlp: 'NLP', 'computer-vision': 'Computer vision', llm: 'LLMs',
  mlops: 'MLOps', statistics: 'Statistics', sql: 'SQL', etl: 'ETL', airflow: 'Airflow', spark: 'Spark',
  dbt: 'dbt', 'data-modeling': 'Data modeling', dashboards: 'Dashboards', 'ab-testing': 'A/B testing',
  'bi-tools': 'BI tools', 'ui-design': 'UI design', 'ux-research': 'UX research', figma: 'Figma',
  prototyping: 'Prototyping', 'design-systems': 'Design systems', brand: 'Brand', 'motion-design': 'Motion design',
  'product-management': 'Product management', roadmapping: 'Roadmapping', 'user-interviews': 'User interviews',
  requirements: 'Requirements', 'qa-testing': 'QA testing', 'test-automation': 'Test automation',
  security: 'Security', 'technical-writing': 'Technical writing', 'project-management': 'Project management',
  'growth-marketing': 'Growth marketing', healthcare: 'Healthcare', fintech: 'Fintech', education: 'Education',
  ecommerce: 'E-commerce', logistics: 'Logistics', 'customer-support': 'Customer support', climate: 'Climate',
  legal: 'Legal', frontend: 'Frontend', backend: 'Backend', devops: 'DevOps', mobile: 'Mobile', ml: 'Machine learning',
  analytics: 'Analytics',
  'data-eng': 'Data engineering', design: 'Design', product: 'Product', quality: 'Quality', comms: 'Communication',
  domain: 'Domain', engineering: 'Engineering', data: 'Data',
};

const ALIASES = {
  react: ['reactjs', 'react.js'], nextjs: ['next', 'next.js'], typescript: ['ts'], javascript: ['js', 'es6'],
  postgres: ['postgresql', 'psql'], nodejs: ['node', 'node.js'], 'react-native': ['rn'],
  llm: ['genai', 'generative ai'], nlp: ['natural language processing'],
  'ci-cd': ['continuous integration', 'continuous delivery'], 'ui-design': ['visual design'],
  'ux-research': ['user research'], 'qa-testing': ['qa', 'testing'], 'ab-testing': ['experimentation'],
  kubernetes: ['k8s'], 'customer-support': ['support', 'helpdesk'],
};

const RELATED = [
  ['react', 'nextjs'], ['typescript', 'javascript'], ['python', 'pytorch'], ['sql', 'postgres'],
  ['docker', 'kubernetes'], ['figma', 'ui-design'], ['ux-research', 'user-interviews'], ['llm', 'nlp'],
  ['mlops', 'ci-cd'], ['data-modeling', 'postgres'], ['tailwind', 'css'], ['aws', 'terraform'],
  ['dashboards', 'sql'], ['prototyping', 'figma'], ['design-systems', 'accessibility'],
  ['product-management', 'roadmapping'], ['spark', 'etl'], ['dbt', 'sql'], ['pytorch', 'tensorflow'],
  ['security', 'monitoring'], ['test-automation', 'qa-testing'], ['nextjs', 'typescript'],
];

const skills = [];
for (const [gid, g] of Object.entries(GROUPS)) {
  skills.push({ id: gid, label: LABELS[gid] || gid, aliases: [], parent: g.parent || undefined, related: [] });
  for (const s of g.skills) {
    skills.push({ id: s, label: LABELS[s] || s, aliases: ALIASES[s] || [], parent: gid, related: [] });
  }
}
skills.push({ id: 'engineering', label: 'Engineering', aliases: [], related: [] });
skills.push({ id: 'data', label: 'Data', aliases: [], related: [] });

const byId = Object.fromEntries(skills.map((s) => [s.id, s]));
for (const [a, b] of RELATED) {
  byId[a].related.push(b);
  byId[b].related.push(a);
}

const COMPANIES = [
  { id: 'northwind', name: 'Northwind Labs', offices: ['Bengaluru', 'London', 'Austin'] },
  { id: 'kestrel', name: 'Kestrel Health', offices: ['Berlin', 'Bengaluru'] },
  { id: 'orbit', name: 'Orbit Financial', offices: ['Singapore', 'London'] },
  { id: 'lumen', name: 'Lumen Education', offices: ['Toronto', 'Lagos'] },
  { id: 'atlas', name: 'Atlas Logistics', offices: ['Rotterdam', 'Mumbai'] },
  { id: 'verdant', name: 'Verdant Climate', offices: ['Nairobi', 'Copenhagen'] },
];

const TZ = {
  Bengaluru: 5.5, Mumbai: 5.5, London: 0, Austin: -6, Berlin: 1, Singapore: 8,
  Toronto: -5, Lagos: 1, Rotterdam: 1, Nairobi: 3, Copenhagen: 1,
};

const ARCH = {
  frontend: { title: 'frontend engineer', core: 'frontend', near: ['design', 'quality'] },
  backend: { title: 'backend engineer', core: 'backend', near: ['devops', 'data-eng'] },
  devops: { title: 'platform engineer', core: 'devops', near: ['backend', 'quality'] },
  mobile: { title: 'mobile engineer', core: 'mobile', near: ['frontend', 'design'] },
  ml: { title: 'ML engineer', core: 'ml', near: ['data-eng', 'backend'] },
  'data-eng': { title: 'data engineer', core: 'data-eng', near: ['analytics', 'backend'] },
  analytics: { title: 'data analyst', core: 'analytics', near: ['data-eng', 'product'] },
  design: { title: 'product designer', core: 'design', near: ['frontend', 'product'] },
  product: { title: 'product manager', core: 'product', near: ['analytics', 'design'] },
  quality: { title: 'QA engineer', core: 'quality', near: ['devops', 'backend'] },
  comms: { title: 'technical writer', core: 'comms', near: ['product', 'design'] },
};
const ARCH_KEYS = Object.keys(ARCH);
const LEVEL_PREFIX = ['Junior ', '', 'Senior ', 'Staff ', 'Principal '];

const FIRST = ['Priya', 'Daniel', 'Mei', 'Tomas', 'Aisha', 'Rohan', 'Elena', 'Kofi', 'Sanne', 'Yuki', 'Lucas', 'Nadia', 'Omar', 'Grace', 'Ivan', 'Leila', 'Marcus', 'Ana', 'Ravi', 'Sofia', 'Tunde', 'Hannah', 'Jae', 'Farah', 'Diego', 'Nina', 'Arjun', 'Clara', 'Samuel', 'Mira', 'Noah', 'Zara', 'Felix', 'Ingrid', 'Hassan', 'Bea', 'Theo', 'Anika', 'Paulo', 'Wei', 'Esther', 'Karim', 'Lena', 'Sunil', 'Maya', 'Jonas', 'Amara', 'Victor', 'Rania', 'Oscar', 'Divya', 'Milan', 'Nour', 'Kenji', 'Iris', 'Bruno', 'Tara', 'Emeka', 'Sara', 'Levi'];
const LAST = ['Raman', 'Okafor', 'Lin', 'Novak', 'Bello', 'Mehta', 'Costa', 'Mensah', 'Visser', 'Tanaka', 'Almeida', 'Haddad', 'Farouk', 'Adeyemi', 'Petrov', 'Barakat', 'Webb', 'Duarte', 'Krishnan', 'Moretti', 'Balogun', 'Weiss', 'Park', 'Nasser', 'Ortega', 'Volkov', 'Nair', 'Lindqvist', 'Owusu', 'Sen', 'Bergman', 'Khalil', 'Brandt', 'Solberg', 'Rahman', 'Fontaine', 'Marek', 'Iyer', 'Ribeiro', 'Zhang', 'Mwangi', 'Aziz', 'Hoffmann', 'Pillai', 'Devi', 'Larsen', 'Diallo', 'Silva', 'Kassab', 'Lundqvist'];

const usedNames = new Set();
const people = [];

for (let i = 0; i < 60; i++) {
  const archKey = ARCH_KEYS[i % ARCH_KEYS.length];
  const arch = ARCH[archKey];

  let name;
  do {
    name = pick(FIRST) + ' ' + pick(LAST);
  } while (usedNames.has(name));
  usedNames.add(name);

  const seniority = between(1, 5);
  const company = pick(COMPANIES);
  const office = pick(company.offices);

  const coreSkills = pickN(GROUPS[arch.core].skills, between(3, 5));
  const nearGroup = pick(arch.near);
  const nearSkills = pickN(GROUPS[nearGroup].skills, between(1, 2));
  const domains = pickN(GROUPS.domain.skills, between(1, 2));

  const skillList = [
    ...coreSkills.map((s) => ({ skillId: s, level: Math.max(2, Math.min(5, seniority + between(0, 1))) })),
    ...nearSkills.map((s) => ({ skillId: s, level: Math.max(1, Math.min(4, seniority - between(0, 2))) })),
    ...domains.map((s) => ({ skillId: s, level: between(2, 5) })),
  ];

  const parts = name.toLowerCase().split(' ');
  const title = LEVEL_PREFIX[seniority - 1] + arch.title;

  people.push({
    id: 'p' + String(i + 1).padStart(2, '0'),
    name,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    companyId: company.id,
    office,
    utcOffset: TZ[office],
    yearsExp: Math.max(1, seniority * 2 + between(-1, 3)),
    seniority,
    skills: skillList,
    interests: domains,
    hoursPerWeek: pick([2, 3, 4, 5, 6, 8, 8, 10, 10, 12, 12, 15, 16, 20]),
    contact: {
      email: parts[0] + '.' + parts[1] + '@' + company.id + '.com',
      slack: '@' + parts[0] + parts[1][0],
      linkedin: 'linkedin.com/in/' + parts[0] + '-' + parts[1],
      github: rnd() > 0.45 ? 'github.com/' + parts[0] + parts[1][0] : undefined,
    },
    openToProjects: rnd() > 0.12,
    hue: Math.floor(rnd() * 360),
  });
}

writeFileSync(join(OUT, 'skills.json'), JSON.stringify(skills));
writeFileSync(join(OUT, 'companies.json'), JSON.stringify(COMPANIES, null, 2));
writeFileSync(join(OUT, 'people.json'), JSON.stringify(people));

console.log('skills: ' + skills.length + '  companies: ' + COMPANIES.length + '  people: ' + people.length);
console.log('open to projects: ' + people.filter((p) => p.openToProjects).length);
