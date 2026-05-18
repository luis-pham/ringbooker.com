import { normalizePhoneForStorage } from '@/lib/phone-number';
import { telnyxHttpJson } from '@/src/backend/adapters/telnyx/telnyx-http';
import { getTelnyxProvisioningSearchTimeoutMs } from '@/src/backend/adapters/telnyx/telnyx-timeouts';
import { logger } from '@/src/backend/observability/logger';

export type DetectedCarrier = {
  detected: boolean;
  carrier: string | null;
  line_type: string | null;
  raw_carrier_name: string | null;
};

type TelnyxNumberLookupResponse = {
  data?: {
    carrier?: {
      name?: string | null;
    } | null;
    portability?: {
      spid_carrier_name?: string | null;
      line_type?: string | null;
      ported_status?: string | null;
    } | null;
  } | null;
};

function mapCarrierNameToRingBookerCarrier(value: string | null | undefined): string {
  const name = value?.toLowerCase() ?? '';
  if (name.includes('verizon')) return 'verizon';
  if (name.includes('at&t') || name.includes('att') || name.includes('at and t')) return 'att';
  if (name.includes('t-mobile') || name.includes('tmobile')) return 'tmobile';
  if (name.includes('nextiva')) return 'nextiva';
  if (name.includes('ringcentral')) return 'ringcentral';
  if (name.includes('google voice')) return 'google_voice';
  if (name.includes('comcast')) return 'comcast';
  if (name.includes('ooma')) return 'ooma';
  if (name.includes('openphone') || name.includes('open phone')) return 'openphone';
  if (name.includes('twilio')) return 'twilio';
  return 'other';
}

export async function detectCarrierFromTelnyx(params: {
  apiKey: string;
  phoneNumber: string | null | undefined;
  shopId?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<DetectedCarrier> {
  const e164 = normalizePhoneForStorage(params.phoneNumber);
  if (!e164) {
    return { detected: false, carrier: null, line_type: null, raw_carrier_name: null };
  }

  try {
    const result = await telnyxHttpJson({
      method: 'GET',
      path: `number_lookup/${encodeURIComponent(e164)}?carrier`,
      timeoutMs: getTelnyxProvisioningSearchTimeoutMs(),
      operation: 'number_lookup.carrier',
      apiKey: params.apiKey,
      fetchImpl: params.fetchImpl,
      correlation: { shopId: params.shopId ?? undefined, purpose: 'go_live_carrier_detection' },
    });
    const parsed = result.parsedJson as TelnyxNumberLookupResponse | null;
    const portability = parsed?.data?.portability ?? null;
    const rawCarrierName =
      portability?.spid_carrier_name?.trim() || parsed?.data?.carrier?.name?.trim() || null;
    if (!rawCarrierName && !portability?.line_type) {
      return { detected: false, carrier: null, line_type: null, raw_carrier_name: null };
    }

    return {
      detected: true,
      carrier: mapCarrierNameToRingBookerCarrier(rawCarrierName),
      line_type: portability?.line_type?.trim() || null,
      raw_carrier_name: rawCarrierName,
    };
  } catch (error) {
    logger.warn(
      {
        err: error,
        shopId: params.shopId ?? null,
        phoneLast4: e164.slice(-4),
      },
      'go_live_carrier_detection_failed',
    );
    return { detected: false, carrier: null, line_type: null, raw_carrier_name: null };
  }
}
