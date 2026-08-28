/**
 * Making a typed-in link safe to put in an href.
 *
 * People write "linkedin.com/in/me", not "https://linkedin.com/in/me", and a
 * bare hostname in an href is a *relative* path — the browser resolves it
 * against the current page, so a profile link quietly navigated to
 * /app/org/acme/people/linkedin.com/in/me and 404ed. Every one of the sixty
 * seeded profiles had this.
 *
 * The scheme check is also the safety check: javascript:, data: and vbscript:
 * URLs are refused rather than prefixed, so a link somebody pastes into their
 * own profile cannot become script that runs for a colleague viewing it.
 */
const SAFE = /^https?:\/\//i;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function externalUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;

  // Already absolute and safe.
  if (SAFE.test(value)) return value;

  // Some other scheme — mailto:, javascript:, data:. Not ours to render.
  if (SCHEME.test(value)) return null;

  // Protocol-relative, which is absolute in practice.
  if (value.startsWith('//')) return 'https:' + value;

  // A bare host or path. Anything without a dot before the first slash is not
  // a hostname, so it is not a link either.
  const host = value.split('/')[0] ?? '';
  if (!host.includes('.')) return null;

  return 'https://' + value;
}
