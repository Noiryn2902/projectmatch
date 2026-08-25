import type { Brief, Requirement, Role } from '../types';

type Tmpl = { id: string; title: string; hoursNeeded: number; reqs: [string, number, number][] };

const TEMPLATES: Record<string, Tmpl> = {
  frontend: {
    id: 'frontend',
    title: 'Frontend engineer',
    hoursNeeded: 10,
    reqs: [['react', 3, 3], ['typescript', 3, 2], ['css', 3, 2], ['accessibility', 2, 1]],
  },
  backend: {
    id: 'backend',
    title: 'Backend engineer',
    hoursNeeded: 10,
    reqs: [['api-design', 3, 3], ['nodejs', 3, 2], ['postgres', 3, 2], ['redis', 2, 1]],
  },
  ml: {
    id: 'ml',
    title: 'ML engineer',
    hoursNeeded: 10,
    reqs: [['llm', 3, 3], ['nlp', 3, 3], ['python', 3, 2], ['mlops', 2, 1]],
  },
  data: {
    id: 'data',
    title: 'Data engineer',
    hoursNeeded: 8,
    reqs: [['sql', 3, 3], ['etl', 3, 2], ['data-modeling', 3, 2], ['airflow', 2, 1]],
  },
  design: {
    id: 'design',
    title: 'Product designer',
    hoursNeeded: 8,
    reqs: [['ui-design', 3, 3], ['ux-research', 3, 2], ['figma', 3, 2], ['design-systems', 2, 1]],
  },
  platform: {
    id: 'platform',
    title: 'Platform engineer',
    hoursNeeded: 6,
    reqs: [['docker', 3, 3], ['ci-cd', 3, 3], ['aws', 3, 2], ['monitoring', 2, 1]],
  },
  product: {
    id: 'product',
    title: 'Product manager',
    hoursNeeded: 6,
    reqs: [['product-management', 3, 3], ['user-interviews', 3, 2], ['requirements', 3, 2]],
  },
  mobile: {
    id: 'mobile',
    title: 'Mobile engineer',
    hoursNeeded: 10,
    reqs: [['react-native', 3, 3], ['swift', 3, 2], ['kotlin', 3, 2]],
  },
};

const TRIGGERS: [string, RegExp][] = [
  ['ml', /\b(ai|ml|machine learning|llm|gpt|model|summari[sz]|classif|nlp|embedding|chatbot)\b/i],
  ['data', /\b(data|pipeline|etl|warehouse|analytics|report|dashboard|ingest)\b/i],
  ['design', /\b(design|ux|ui|interface|usable|figma|brand|look)\b/i],
  ['platform', /\b(deploy|ship|production|infra|scale|uptime|devops|cloud|host)\b/i],
  ['mobile', /\b(mobile|ios|android|app store|phone app)\b/i],
  ['backend', /\b(api|backend|server|database|auth|integration|webhook)\b/i],
  ['frontend', /\b(web|frontend|dashboard|portal|page|site|ui)\b/i],
  ['product', /\b(users|customers|research|requirements|roadmap|stakeholder)\b/i],
];

const DOMAINS: [string, RegExp][] = [
  ['healthcare', /\b(health|medical|patient|clinic|doctor|hospital)\b/i],
  ['fintech', /\b(payment|bank|finance|invoice|ledger|trading|fintech)\b/i],
  ['education', /\b(student|course|learn|teach|school|education)\b/i],
  ['ecommerce', /\b(shop|store|cart|checkout|product catalog|ecommerce|retail)\b/i],
  ['logistics', /\b(shipping|delivery|fleet|warehouse|supply|logistics|route)\b/i],
  ['customer-support', /\b(support|ticket|helpdesk|complaint|customer service)\b/i],
  ['climate', /\b(climate|carbon|emission|energy|sustainab)\b/i],
  ['legal', /\b(legal|contract|compliance|policy|regulat)\b/i],
];

function toRole(t: Tmpl): Role {
  const requirements: Requirement[] = t.reqs.map(([skillId, minLevel, weight]) => ({
    skillId,
    minLevel,
    weight,
  }));
  return { id: t.id, title: t.title, requirements, hoursNeeded: t.hoursNeeded };
}

/**
 * Deterministic brief reader. Used when Gemini is slow, erroring, or absent,
 * so the product never dies on a network hiccup.
 */
export function fallbackBrief(text: string): Omit<Brief, 'text'> {
  const hits: string[] = [];
  for (const [key, re] of TRIGGERS) {
    if (re.test(text) && !hits.includes(key)) hits.push(key);
  }

  const domain = DOMAINS.filter(([, re]) => re.test(text)).map(([d]) => d);

  if (hits.length === 0) hits.push('frontend', 'backend', 'design', 'product');
  if (hits.length < 3) {
    for (const extra of ['frontend', 'backend', 'design']) {
      if (hits.length >= 3) break;
      if (!hits.includes(extra)) hits.push(extra);
    }
  }

  const picked = hits.slice(0, 4);
  if (domain.length > 0 && picked.length < 5) {
    const d = domain[0];
    picked.push('domain:' + d);
  }

  const roles: Role[] = picked.map((key) => {
    if (key.startsWith('domain:')) {
      const d = key.slice(7);
      return {
        id: 'domain',
        title: 'Domain expert',
        hoursNeeded: 4,
        requirements: [{ skillId: d, minLevel: 4, weight: 3 }],
      };
    }
    return toRole(TEMPLATES[key]);
  });

  const weeks = text.match(/(\d+)\s*(week|wk)/i);
  const months = text.match(/(\d+)\s*month/i);
  const durationWeeks = weeks
    ? parseInt(weeks[1], 10)
    : months
      ? parseInt(months[1], 10) * 4
      : 6;

  return { roles, durationWeeks, domain };
}

export function fallbackReason(name: string, gapPct: number, hours: number, office: string): string {
  return (
    name.split(' ')[0] +
    ' closes ' +
    gapPct +
    '% of what this team is still missing, has ' +
    hours +
    ' hrs a week free, and works out of ' +
    office +
    '.'
  );
}
