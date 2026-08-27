/**
 * Rate limiter — a fixed window, so its behaviour is arithmetic and testable
 * without a server or a clock we do not control (`now` is a parameter).
 *
 *   npx tsx scripts/test-ratelimit.ts
 */
import { clientKey, rateLimit, resetRateLimits } from '../lib/rate-limit';

let passed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log('  pass  ' + name);
  } else {
    failures.push(name);
    console.log('  FAIL  ' + name);
  }
}

console.log('\nRate limiter');

resetRateLimits();
const T = 1_000_000;

check('the first request is allowed', rateLimit('a', 3, 1000, T).ok);
check('so is the second', rateLimit('a', 3, 1000, T).ok);
check('and the last one inside the limit', rateLimit('a', 3, 1000, T).ok);
check('one past the limit is refused', !rateLimit('a', 3, 1000, T).ok);
check('a refusal says how long to wait', rateLimit('a', 3, 1000, T).retryAfter >= 1);

resetRateLimits();
rateLimit('b', 2, 1000, T);
rateLimit('b', 2, 1000, T);
check('a different key has its own budget', rateLimit('c', 2, 1000, T).ok);
check('the exhausted key is still refused', !rateLimit('b', 2, 1000, T).ok);
check('the window reopens once it has passed', rateLimit('b', 2, 1000, T + 1001).ok);

resetRateLimits();
check('remaining counts down', rateLimit('d', 3, 1000, T).remaining === 2);
check('remaining floors at zero', (() => {
  rateLimit('d', 3, 1000, T);
  rateLimit('d', 3, 1000, T);
  return rateLimit('d', 3, 1000, T).remaining === 0;
})());
check('an allowed request has no retry-after', rateLimit('e', 5, 1000, T).retryAfter === 0);

// --------------------------------------------------------------- client key

check(
  'the first forwarded hop is the client',
  clientKey(new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1, 10.0.0.2' })) === '203.0.113.9',
);
check(
  'x-real-ip is the fallback',
  clientKey(new Headers({ 'x-real-ip': '198.51.100.4' })) === '198.51.100.4',
);
check('no headers at all still yields a key', clientKey(new Headers()) === 'unknown');

console.log('\n' + '='.repeat(52));
if (failures.length === 0) {
  console.log(`${passed}/${passed} checks passed`);
  console.log('Rate limiting holds.');
} else {
  console.log(`${passed} passed, ${failures.length} FAILED`);
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
