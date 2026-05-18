import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type DnsLookup = (hostname: string) => Promise<Array<{ address: string; family: number }> | { address: string; family: number }>;
export type SafeResolvedUrl = { url: URL; address: string; family: number };

const TRACKING_PARAMS = [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^mc_/i];
const EXPLICIT_SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const ALLOWED_SCHEMES = new Set(['http', 'https']);

function isPrivateIpv4(address: string): boolean {
  const [a, b, c, d] = address.split('.').map((part) => Number(part));
  if (![a, b, c, d].every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) return true;
  if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254)) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 224 || a >= 240) return true;
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;
  // Documentation / benchmark ranges are not public fetch targets for imports.
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  return false;
}

export function isPrivateOrLocalIp(address: string): boolean {
  const ipVersion = isIP(address);
  if (ipVersion === 4) return isPrivateIpv4(address);
  if (ipVersion === 6) {
    const normalized = address.toLowerCase();
    const mapped = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mapped) return isPrivateIpv4(mapped[1]);
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('ff') ||
      normalized.startsWith('2001:db8:')
    );
  }
  return false;
}

export function normalizeImportUrl(input: string): URL {
  const trimmed = input.trim();
  const scheme = trimmed.match(EXPLICIT_SCHEME)?.[1]?.toLowerCase();
  if (scheme && !ALLOWED_SCHEMES.has(scheme)) throw new Error('unsupported_url_scheme');
  const withProtocol = scheme ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('unsupported_url_scheme');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((pattern) => pattern.test(key))) url.searchParams.delete(key);
  }
  return url;
}

export async function resolveSafeUrl(input: string, opts: { lookup?: DnsLookup } = {}): Promise<SafeResolvedUrl> {
  const url = normalizeImportUrl(input);
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) throw new Error('blocked_localhost');
  const directIp = isIP(hostname);
  if (directIp && isPrivateOrLocalIp(hostname)) throw new Error('blocked_private_ip');
  const resolver = opts.lookup ?? ((host: string) => dnsLookup(host, { all: true }) as Promise<Array<{ address: string; family: number }>>);
  const records = directIp ? [{ address: hostname, family: directIp }] : await resolver(hostname);
  const list = Array.isArray(records) ? records : [records];
  if (list.length === 0) throw new Error('dns_lookup_failed');
  if (list.some((record) => isPrivateOrLocalIp(record.address))) throw new Error('blocked_private_ip');
  const first = list[0];
  if (!first) throw new Error('dns_lookup_failed');
  return { url, address: first.address, family: first.family };
}

export async function preflightUrl(input: string, opts: { lookup?: DnsLookup } = {}): Promise<URL> {
  return (await resolveSafeUrl(input, opts)).url;
}
