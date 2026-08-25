/**
 * Demo session. There is no auth server, so this records who the user says they
 * are and nothing else — enough to attribute chat messages and greet them.
 *
 * Every localStorage access is guarded: storage throws outright in sandboxed
 * and private-mode contexts, and an uncaught throw during render takes the whole
 * page down. The in-memory fallback keeps the session working for the tab.
 */
export interface User {
  name: string;
  email: string;
}

const KEY = 'pm_user';
let memory: User | null = null;

export function getUser(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as User;
  } catch {
    /* storage unavailable — fall through to memory */
  }
  return memory;
}

export function setUser(u: User) {
  memory = u;
  try {
    localStorage.setItem(KEY, JSON.stringify(u));
  } catch {
    /* keep the in-memory copy only */
  }
}

export function clearUser() {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
