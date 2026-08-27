/**
 * A fixed-window rate limiter, in memory.
 *
 * `/api/ai` calls a paid model on behalf of anyone who can reach the URL. It
 * has been open since the day it was written, which is fine while nobody
 * knows the address and indefensible the moment they do.
 *
 * Deliberately in-process rather than backed by Redis or Postgres. Be honest
 * about what that buys: on serverless each instance keeps its own counters,
 * so a determined attacker spread across warm instances gets a multiple of
 * the limit. What it does stop is the realistic case — one client in a loop,
 * a scraper, a stuck retry — at zero infrastructure and zero latency. A
 * shared store is the upgrade when there is a bill to protect; the seam here
 * is one function.
 *
 * Pure and synchronous, so it is testable without a server.
 */

export interface RateLimitResult {
  ok: boolean;
  /** Requests still allowed in this window. */
  remaining: number;
  /** Unix ms when the current window resets. */
  resetAt: number;
  /** Seconds to wait, for a Retry-After header. Only meaningful when !ok. */
  retryAfter: number;
}

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

/** Stop the map growing without bound on a long-lived instance. */
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, w] of buckets) if (w.resetAt <= now) buckets.delete(key);
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  sweep(now);

  const existing = buckets.get(key);
  const window: Window =
    existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + windowMs };

  window.count++;
  buckets.set(key, window);

  const ok = window.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - window.count),
    resetAt: window.resetAt,
    retryAfter: ok ? 0 : Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
  };
}

/** Test seam — resets all counters. Not used in application code. */
export function resetRateLimits() {
  buckets.clear();
}

/**
 * Who to count against. The first hop in `x-forwarded-for` is the client as
 * far as the platform is concerned; everything after it is proxy chain and
 * is trivially spoofable, so only the first entry is used.
 */
export function clientKey(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return headers.get('x-real-ip') ?? 'unknown';
}
