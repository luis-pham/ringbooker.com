/**
 * Single source of truth for "is this a Google Maps / Business Profile URL", shared by the
 * backend import classifier (source-routing.ts) and the onboarding frontend's instant-feedback
 * badge. Keeping this in one module (rather than two independent guesses) is what stops the
 * frontend badge and backend `sourceType` from drifting apart.
 */

const GOOGLE_MAPS_EXACT_HOSTNAMES = new Set(['g.co', 'g.page', 'business.google.com']);

/**
 * Opaque short-link hosts: the hostname alone can't be classified because the real destination
 * (place, business profile, or something unrelated) only appears after following the redirect.
 * `g.page` is both a short-link host (e.g. `g.page/r/xxxx`) and, if resolution ever fails, still
 * safe to classify directly as `google_maps` via GOOGLE_MAPS_EXACT_HOSTNAMES above.
 */
const GOOGLE_MAPS_SHORT_LINK_HOSTNAMES = new Set(['maps.app.goo.gl', 'goo.gl', 'g.page']);

const MAPS_GOOGLE_TLD_RE = /^maps\.google\.[a-z]{2,3}(?:\.[a-z]{2})?$/i;

function stripWww(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, '');
}

/** True when `hostname` is an opaque short link that must be redirect-resolved before classification. */
export function isGoogleMapsShortLinkHostname(hostname: string): boolean {
  return GOOGLE_MAPS_SHORT_LINK_HOSTNAMES.has(stripWww(hostname));
}

/**
 * True when `url` is a resolvable Google Maps / Business Profile URL. Deliberately an allowlist
 * rather than a `hostname.includes('google.')` substring match, so an unrelated *.google.com
 * page (mail, accounts, drive, plain search) is never misclassified as a Maps import source.
 */
export function isGoogleMapsUrl(url: URL): boolean {
  const host = stripWww(url.hostname);
  if (GOOGLE_MAPS_EXACT_HOSTNAMES.has(host)) return true;
  if (MAPS_GOOGLE_TLD_RE.test(host)) return true;
  if (host === 'google.com' && url.pathname.startsWith('/maps')) return true;
  return false;
}

/**
 * Best-effort check against a raw pasted string (may be missing a scheme) for instant UI
 * feedback, before any server round-trip. Also matches short-link hosts (maps.app.goo.gl,
 * goo.gl, g.page) — resolving those to confirm they're really Maps only happens server-side,
 * but the badge should still show "looks like Google" immediately for a pasted share link.
 */
export function isProbablyGoogleMapsUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    return isGoogleMapsUrl(parsed) || isGoogleMapsShortLinkHostname(parsed.hostname);
  } catch {
    return false;
  }
}
