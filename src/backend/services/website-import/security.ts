import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type DnsLookup = (hostname: string) => Promise<Array<{ address: string; family: number }> | { address: string; family: number }>;

const TRACKING_PARAMS = [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^mc_/i];
const EXPLICIT_SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const ALLOWED_SCHEMES = new Set(['http', 'https']);

function isPrivateIpv4(address: string): boolean {
  const [a, b] = address.split('.').map((part) => Number(part));
  if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254)) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function isPrivateOrLocalIp(address: string): boolean {
  const ipVersion = isIP(address);
  if (ipVersion === 4) return isPrivateIpv4(address);
  if (ipVersion === 6) {
    const normalized = address.toLowerCase();
    const mapped = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mapped) return isPrivateIpv4(mapped[1]);
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:') || normalized === '::';
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
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url;
}

export async function preflightUrl(input: string, opts: { lookup?: DnsLookup } = {}): Promise<URL> {
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
  return url;
}
