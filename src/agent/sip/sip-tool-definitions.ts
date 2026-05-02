import { REALTIME_TOOL_DEFINITIONS } from '@/src/agent/realtime/shared-tool-definitions';

import { getResolvedVoiceTransport } from '@/src/backend/config/voice-transport';

/**
 * Production SIP shop route — tools exposed on OpenAI SIP `accept` + sideband.
 *
 * - **OpenAI SIP direct** (`VOICE_TRANSPORT=openai_sip_direct`): use `request_human_handoff` → Telnyx Call Control
 *   when parent `call_control_id` is present (Call Control ingress). No LiveKit room transfer.
 * - **Legacy / LiveKit media**: `transfer_to_user` remains available when voice transport is not OpenAI SIP direct.
 *
 * TeXML-only ingress (no Call Control) does not carry `telnyxCallControlId` → handoff tool returns a controlled failure.
 */
export const SIP_CORE_TOOL_NAMES = [
  'get_shop_info',
  'check_availability',
  'create_booking',
  'cancel_booking',
  'reschedule_booking',
  'send_booking_link',
] as const;

export type OpenAiSipFunctionTool = {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

/** Owner handoff for OpenAI SIP direct — Telnyx Call Control only (see `request-human-handoff.ts`). */
export const REQUEST_HUMAN_HANDOFF_TOOL: OpenAiSipFunctionTool = {
  type: 'function',
  name: 'request_human_handoff',
  description:
    'Request a human handoff for the current caller. Use only when the caller explicitly asks for a human, is upset, has a complex request, or business rules require escalation.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      reason: {
        type: 'string',
        enum: [
          'caller_requested_human',
          'angry_or_complaint',
          'complex_booking',
          'same_day_urgent_change',
          'pricing_or_policy_uncertain',
          'vip_or_high_value',
          'ai_uncertain',
          'other',
        ],
        description: 'Why the caller needs a person.',
      },
      urgency: {
        type: 'string',
        enum: ['low', 'normal', 'high'],
        description: 'How time-sensitive the handoff is.',
      },
      summary: {
        type: 'string',
        description: 'Short summary for the owner before accepting the call.',
      },
      caller_name: { type: 'string', description: "Caller's name if known." },
      service_requested: { type: 'string', description: 'Service or intent if known.' },
      preferred_time: { type: 'string', description: 'Preferred appointment time if relevant.' },
    },
    required: ['reason', 'urgency', 'summary'],
  },
};

const sipCoreNameSet = new Set<string>(SIP_CORE_TOOL_NAMES);

function toolFromShared(name: string): OpenAiSipFunctionTool | null {
  const d = REALTIME_TOOL_DEFINITIONS.find((x) => x.name === name);
  if (!d) return null;
  return {
    type: 'function' as const,
    name: d.name,
    description: d.description,
    parameters: d.parameters,
  };
}

/**
 * Tools array for `POST .../realtime/calls/{id}/accept` when shop sideband is enabled.
 * Resolves at call time so tests can override `process.env.VOICE_TRANSPORT`.
 */
export function getSipShopToolsForOpenAiAccept(): OpenAiSipFunctionTool[] {
  const core: OpenAiSipFunctionTool[] = [];
  for (const n of SIP_CORE_TOOL_NAMES) {
    const t = toolFromShared(n);
    if (t) core.push(t);
  }

  const vt = getResolvedVoiceTransport();
  if (vt === 'openai_sip_direct') {
    return [...core, REQUEST_HUMAN_HANDOFF_TOOL];
  }

  const transfer = toolFromShared('transfer_to_user');
  return transfer ? [...core, transfer] : core;
}

export function getSipShopToolNameSet(): Set<string> {
  return new Set(getSipShopToolsForOpenAiAccept().map((t) => t.name));
}

/** @deprecated Use getSipShopToolsForOpenAiAccept() so voice transport is respected. */
export const SIP_SHOP_TOOLS: OpenAiSipFunctionTool[] = getSipShopToolsForOpenAiAccept();

/** @deprecated Use getSipShopToolNameSet() */
export const SIP_SHOP_TOOL_NAME_SET: Set<string> = new Set(SIP_SHOP_TOOLS.map((t) => t.name));
