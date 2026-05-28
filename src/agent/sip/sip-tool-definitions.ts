import { REALTIME_TOOL_DEFINITIONS } from '@/src/agent/realtime/shared-tool-definitions';

import { getResolvedVoiceTransport } from '@/src/backend/config/voice-transport';
import type { Shop } from '@/src/backend/domain/types';
import { getShopCalendarProviderMetadata } from '@/src/backend/services/calendar/types';

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
  'validate_appointment_time',
  'get_shop_info',
  'check_availability',
  'create_booking',
  'cancel_booking',
  'reschedule_booking',
  'send_booking_link',
  'schedule_callback',
] as const;

export type OpenAiSipFunctionTool = {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export const END_CALL_TOOL: OpenAiSipFunctionTool = {
  type: 'function',
  name: 'end_call',
  description:
    'End the phone call after the caller\'s request is fully complete. Call this after: booking confirmed, booking link sent and acknowledged, question fully answered, callback scheduled, or handoff initiated. Always say a warm goodbye BEFORE calling this tool. Do NOT call end_call if a human handoff is actively connecting — the owner will close the call.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      reason: {
        type: 'string',
        enum: ['booking_completed', 'link_sent', 'question_answered', 'callback_scheduled', 'handoff_initiated', 'other'],
        description: 'Why the call is ending.',
      },
    },
    required: ['reason'],
  },
};

/** Owner handoff for OpenAI SIP direct — Telnyx Call Control only (see `request-human-handoff.ts`). */
export const REQUEST_HUMAN_HANDOFF_TOOL: OpenAiSipFunctionTool = {
  type: 'function',
  name: 'request_human_handoff',
  description:
    'Start a live handoff attempt to the team (not a guaranteed bridge). Use only if they ask for a person, sound upset, need complex/urgent help, or you are unsure—not for simple hours, services, prices, policies, location, or rules already in runtime. After the call returns, follow message_for_ai exactly; never claim they are transferred or connected unless the product confirms a completed bridge. Do not use transfer_to_user.',
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
 *
 * When `shop` is provided and its calendar provider is `manual` (no calendar integration),
 * `check_availability` is excluded from the list. This avoids a redundant ~7s OpenAI round-trip:
 * ManualCalendarProvider always returns `{available: true}` instantly, but the tool call itself
 * costs a full model inference round-trip through OpenAI Realtime, causing ~14s of silence
 * when paired with the mandatory `validate_appointment_time` call.
 */
export function getSipShopToolsForOpenAiAccept(shop?: Shop | null): OpenAiSipFunctionTool[] {
  // Determine which tools to suppress for this shop
  const isManualProvider = shop
    ? getShopCalendarProviderMetadata(shop).id === 'manual'
    : false;

  const core: OpenAiSipFunctionTool[] = [];
  for (const n of SIP_CORE_TOOL_NAMES) {
    // Skip check_availability for manual shops — saves one full OpenAI round-trip (~7s)
    if (n === 'check_availability' && isManualProvider) continue;
    const t = toolFromShared(n);
    if (t) core.push(t);
  }

  const vt = getResolvedVoiceTransport();
  if (vt === 'openai_sip_direct') {
    return [...core, REQUEST_HUMAN_HANDOFF_TOOL, END_CALL_TOOL];
  }

  const transfer = toolFromShared('transfer_to_user');
  return transfer ? [...core, transfer, END_CALL_TOOL] : [...core, END_CALL_TOOL];
}

export function getSipShopToolNameSet(shop?: Shop | null): Set<string> {
  return new Set(getSipShopToolsForOpenAiAccept(shop).map((t) => t.name));
}

/** @deprecated Use getSipShopToolsForOpenAiAccept() so voice transport is respected. */
export const SIP_SHOP_TOOLS: OpenAiSipFunctionTool[] = getSipShopToolsForOpenAiAccept();

/** @deprecated Use getSipShopToolNameSet() */
export const SIP_SHOP_TOOL_NAME_SET: Set<string> = new Set(SIP_SHOP_TOOLS.map((t) => t.name));
