import { REALTIME_TOOL_DEFINITIONS } from '@/src/agent/realtime/shared-tool-definitions';

/** Production SIP shop route: same subset as inbound voice booking (no transfer/callback here). */
export const SIP_SHOP_TOOL_NAMES = [
  'get_shop_info',
  'check_availability',
  'create_booking',
  'cancel_booking',
  'reschedule_booking',
  'send_booking_link',
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
