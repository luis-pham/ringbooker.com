import type { Shop } from '@/src/backend/domain/types';
import type { ShopsRepository } from '@/src/backend/ports/repositories';

/**
 * Normalize inbound PSTN / SIP-derived numbers to E.164 for DB lookups.
 * Mirrors defensive parsing used in Telnyx/OpenAI SIP handlers without importing webhook modules.
 */
export function normalizeInboundE164(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const v = raw.trim();
  const sipUserMatch = v.match(/sip:([^@;>\s]+)/i);
  const focus = sipUserMatch?.[1]?.replace(/^["']|["']$/g, '') ?? v;
  const stripped = focus.replace(/[^\d+]/g, '');
  if (!stripped.length) return null;
  if (stripped.startsWith('+')) {
    return stripped.length >= 8 && stripped.length <= 16 ? stripped : null;
  }
  const digitsOnly = stripped.replace(/\D/g, '');
  if (digitsOnly.length === 10) return `+1${digitsOnly}`;
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) return `+${digitsOnly}`;
  if (digitsOnly.length >= 8 && digitsOnly.length <= 15) return `+${digitsOnly}`;
  return null;
}

export type InboundDidShopMatch = 'telnyx_number' | 'phone_number' | 'none';

export type ResolveShopByInboundDidResult = {
  shop: Shop | null;
  matchedBy: InboundDidShopMatch;
  /** Normalized E.164 from `to` when parsable. */
  inboundDid: string | null;
};

/**
 * Production inbound routing: Telnyx DID on `telnyx_number` wins over published `phone_number`.
 * Both queries enforce active shops via repository implementations.
 */
export async function resolveShopByInboundDidWithMeta(
  deps: { shopsRepository: ShopsRepository },
  toRaw: string,
): Promise<ResolveShopByInboundDidResult> {
  const inboundDid = normalizeInboundE164(toRaw);
  if (!inboundDid) {
    return { shop: null, matchedBy: 'none', inboundDid: null };
  }

  const byTelnyx = await deps.shopsRepository.findByTelnyxNumber(inboundDid);
  if (byTelnyx) {
    return { shop: byTelnyx, matchedBy: 'telnyx_number', inboundDid };
  }

  const byPhone = await deps.shopsRepository.findByDestinationPhone(inboundDid);
  if (byPhone) {
    return { shop: byPhone, matchedBy: 'phone_number', inboundDid };
  }

  return { shop: null, matchedBy: 'none', inboundDid };
}

export async function resolveShopByInboundDid(
  deps: { shopsRepository: ShopsRepository },
  toRaw: string,
): Promise<Shop | null> {
  const { shop } = await resolveShopByInboundDidWithMeta(deps, toRaw);
  return shop;
}
