import { useSyncExternalStore } from 'react';

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

/** Bumped on every write so subscribers re-read. */
const listeners = new Set<() => void>();
let snapshot: User | null | undefined;

function emit() {
  snapshot = undefined;
  for (const l of listeners) l();
}

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
  emit();
  try {
    localStorage.setItem(KEY, JSON.stringify(u));
  } catch {
    /* keep the in-memory copy only */
  }
}

export function clearUser() {
  memory = null;
  emit();
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

/**
 * Read the session in a component.
 *
 * useSyncExternalStore rather than an effect that calls setState: the server
 * and the first client render both see null, so hydration matches, and React
 * swaps in the real value without a cascading render.
 */
export function useUser(): User | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      if (snapshot === undefined) snapshot = getUser();
      return snapshot;
    },
    () => null,
  );
}
