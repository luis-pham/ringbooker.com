import { createHash, timingSafeEqual } from 'node:crypto';

import type { Context } from 'hono';

import { getEnv } from '@/src/backend/config/env';
import { logger } from '@/src/backend/observability/logger';

/** Browser header UpMySalon (and other allowlisted partners) must send on demo API calls. */
export const DEMO_PARTNER_KEY_HEADER = 'X-Demo-Partner-Key';

const PARTNER_CORS_ALLOW_HEADERS = ['Content-Type', DEMO_PARTNER_KEY_HEADER].join(', ');
const PARTNER_CORS_ALLOW_METHODS = 'POST, OPTIONS';

/**
 * Paths under `/public/demo/*` that partner UIs call cross-origin for the browser mic demo.
 * Keep this list tight — only cost-bearing / session-adjacent endpoints.
 */
export const PUBLIC_DEMO_PARTNER_CORS_PATH_SUFFIXES = [
  '/public/demo/realtime-session',
  '/public/demo/realtime-session/release',
  '/public/demo/realtime-session/transcript',
  '/public/demo/realtime-session/validate-appointment-time',
  '/public/demo/import-website',
  '/public/demo/suggested-questions',
  '/public/demo/extract-call-summary',
] as const;

/** Suggested `demoSource` value for UpMySalon analytics separation. */
export const UPMYSALON_PARTNER_DEMO_SOURCE = 'upmysalon_partner';

function normalizeOriginCandidate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '*') return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  // Bare origins only (scheme + host [+ port]). `https://host` normalizes pathname to `/`.
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== '/' && url.pathname !== '') return null;
  return url.origin;
}

/** Parse `DEMO_PARTNER_ORIGINS` (comma-separated). Never treats `*` as allow-all. */
export function parseDemoPartnerOrigins(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    if (part.trim() === '*') {
      logger.warn({ surface: 'public_demo_partner' }, 'demo_partner_origins_wildcard_ignored');
      continue;
    }
    const origin = normalizeOriginCandidate(part);
    if (!origin) {
      if (part.trim()) {
        logger.warn(
          { surface: 'public_demo_partner', entry: part.trim().slice(0, 80) },
          'demo_partner_origins_invalid_entry_ignored',
        );
      }
      continue;
    }
    if (seen.has(origin)) continue;
    seen.add(origin);
    out.push(origin);
  }
  return out;
}

export function getDemoPartnerOrigins(): string[] {
  return parseDemoPartnerOrigins(getEnv().DEMO_PARTNER_ORIGINS);
}

export function isDemoPartnerOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  let normalized: string;
  try {
    normalized = new URL(origin).origin;
  } catch {
    return false;
  }
  return getDemoPartnerOrigins().includes(normalized);
}

export function getDemoPartnerKey(): string | undefined {
  const key = getEnv().DEMO_PARTNER_KEY?.trim();
  return key || undefined;
}

/** Constant-time partner key check (hashes first so length mismatch cannot short-circuit). */
export function verifyDemoPartnerKey(provided: string | null | undefined): boolean {
  const expected = getDemoPartnerKey();
  if (!expected || !provided) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function isPublicDemoPartnerCorsPath(requestPath: string): boolean {
  return PUBLIC_DEMO_PARTNER_CORS_PATH_SUFFIXES.some(
    (suffix) => requestPath === suffix || requestPath.endsWith(suffix),
  );
}

/** Reflect allowlisted Origin + override CORP so browsers can read the response cross-origin. */
export function applyPublicDemoPartnerCorsHeaders(c: Context, origin: string): void {
  c.header('Access-Control-Allow-Origin', origin);
  c.header('Access-Control-Allow-Methods', PARTNER_CORS_ALLOW_METHODS);
  c.header('Access-Control-Allow-Headers', PARTNER_CORS_ALLOW_HEADERS);
  c.header('Access-Control-Max-Age', '86400');
  c.header('Vary', 'Origin');
  // Global API middleware sets CORP same-site; partners need cross-origin reads.
  c.header('Cross-Origin-Resource-Policy', 'cross-origin');
  // Demo partner flow uses header + body tokens, not cookies — omit Allow-Credentials.
}

export function partnerCorsPreflightResponse(c: Context, origin: string): Response {
  applyPublicDemoPartnerCorsHeaders(c, origin);
  return c.body(null, 204);
}
