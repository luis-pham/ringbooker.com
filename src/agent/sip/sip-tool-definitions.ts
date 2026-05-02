import { REALTIME_TOOL_DEFINITIONS } from '@/src/agent/realtime/shared-tool-definitions';

/**
 * Production SIP shop route — tools exposed on OpenAI SIP `accept` + sideband.
 * `transfer_to_user` uses `TelephonyService.transferLiveCallToUser` (LiveKit SIP participant into `roomName`).
 * Pure OpenAI SIP calls use synthetic `roomName` (no LiveKit room): Telnyx transfer may fall back until a
 * Call-Control–based transfer is implemented for that path.
 */
export const SIP_SHOP_TOOL_NAMES = [
  'get_shop_info',
  'check_availability',
  'create_booking',
  'cancel_booking',
  'reschedule_booking',
  'send_booking_link',
  'transfer_to_user',
] as const;

export type SipShopToolName = (typeof SIP_SHOP_TOOL_NAMES)[number];

export const SIP_SHOP_TOOL_NAME_SET = new Set<string>(SIP_SHOP_TOOL_NAMES);

export type OpenAiSipFunctionTool = {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

/** OpenAI Realtime `accept` tools array — derived from shared LiveKit schemas (no duplication). */
export const SIP_SHOP_TOOLS: OpenAiSipFunctionTool[] = REALTIME_TOOL_DEFINITIONS.filter((d) =>
  SIP_SHOP_TOOL_NAME_SET.has(d.name),
).map((d) => ({
  type: 'function' as const,
  name: d.name,
  description: d.description,
  parameters: d.parameters,
}));
