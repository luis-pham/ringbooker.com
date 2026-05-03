/**
 * Voice / Telnyx routing configuration for OpenAI SIP direct vs LiveKit media.
 * See `.env.example` for VOICE_TRANSPORT, HANDOFF_TRANSPORT, TELNYX_INBOUND_ROUTING_MODE.
 */

export type VoiceTransport = 'openai_sip_direct' | 'livekit_media' | 'unspecified';

export type HandoffTransport = 'telnyx_call_control' | 'livekit_sip' | 'none';

export type TelnyxInboundRoutingMode = 'texml_to_openai_sip' | 'call_control_to_openai_sip';

let warnedArchitectureOnce = false;

function normalizeEnv(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v && v.length > 0 ? v : undefined;
}

/** Default: OpenAI SIP direct (no LiveKit room required for media). */
export function getResolvedVoiceTransport(): VoiceTransport {
  const raw = normalizeEnv('VOICE_TRANSPORT')?.toLowerCase();
  if (!raw || raw === 'openai_sip_direct') return 'openai_sip_direct';
  if (raw === 'livekit' || raw === 'livekit_media') return 'livekit_media';
  return 'unspecified';
}

/** Default: Telnyx Call Control for owner handoff on SIP direct path. */
export function getResolvedHandoffTransport(): HandoffTransport {
  const raw = normalizeEnv('HANDOFF_TRANSPORT')?.toLowerCase();
  if (!raw || raw === 'telnyx_call_control') return 'telnyx_call_control';
  if (raw === 'livekit_sip' || raw === 'livekit') return 'livekit_sip';
  if (raw === 'none' || raw === 'off') return 'none';
  return 'telnyx_call_control';
}

export function getTelnyxInboundRoutingMode(): TelnyxInboundRoutingMode | 'unspecified' {
  const raw = normalizeEnv('TELNYX_INBOUND_ROUTING_MODE')?.toLowerCase();
  if (raw === 'call_control_to_openai_sip') return 'call_control_to_openai_sip';
  if (raw === 'texml_to_openai_sip') return 'texml_to_openai_sip';
  return 'unspecified';
}

/**
 * Warn once on suspicious combinations (does not throw — keeps deploys safe).
 */
export function validateVoiceArchitectureAtStartup(): void {
  if (warnedArchitectureOnce) return;
  warnedArchitectureOnce = true;

  const vt = getResolvedVoiceTransport();
  const ht = getResolvedHandoffTransport();
  const rm = getTelnyxInboundRoutingMode();

  if (vt === 'livekit_media' && ht === 'telnyx_call_control') {
    console.warn(
      '[voice] VOICE_TRANSPORT suggests LiveKit media while HANDOFF_TRANSPORT=telnyx_call_control. ' +
        'Confirm owner handoff targets the intended media path.',
    );
  }
  if (vt === 'openai_sip_direct' && ht === 'livekit_sip') {
    console.warn(
      '[voice] VOICE_TRANSPORT=openai_sip_direct but HANDOFF_TRANSPORT=livekit_sip — owner handoff may require a LiveKit room.',
    );
  }
  if (rm === 'unspecified') {
    console.warn(
      '[voice] TELNYX_INBOUND_ROUTING_MODE is unset. Use texml_to_openai_sip or call_control_to_openai_sip explicitly in production.',
    );
  }
  if (vt === 'openai_sip_direct' && ht === 'telnyx_call_control' && rm === 'texml_to_openai_sip') {
    console.warn(
      '[voice] TeXML ingress does not provide parent Telnyx call_control_id. Live handoff may not be available; ' +
        'request_human_handoff will fall back to summary unless call_control_id exists (e.g. from SIP headers).',
    );
  }
  if (rm === 'call_control_to_openai_sip') {
    const cc = process.env.TELNYX_CALL_CONTROL_WEBHOOK_ENABLED?.trim().toLowerCase();
    const bridge = process.env.TELNYX_CALL_CONTROL_BRIDGE_OPENAI_SIP?.trim().toLowerCase();
    if (cc !== 'true' && cc !== '1') {
      console.warn(
        '[voice] TELNYX_INBOUND_ROUTING_MODE=call_control_to_openai_sip but TELNYX_CALL_CONTROL_WEBHOOK_ENABLED is not true; inbound Call Control events will not reach the app.',
      );
    }
    if (bridge !== 'true' && bridge !== '1') {
      console.warn(
        '[voice] TELNYX_INBOUND_ROUTING_MODE=call_control_to_openai_sip but TELNYX_CALL_CONTROL_BRIDGE_OPENAI_SIP is not true; OpenAI SIP may not be dialed on answer.',
      );
    }
  }

  const bridgeOpenAi = process.env.TELNYX_CALL_CONTROL_BRIDGE_OPENAI_SIP?.trim().toLowerCase();
  const connectMode = (process.env.TELNYX_OPENAI_CONNECT_MODE ?? 'create_and_bridge').trim().toLowerCase();
  const createAndBridge = connectMode === 'create_and_bridge' || connectMode === '';
  const needsExplicitConnectionId =
    (bridgeOpenAi === 'true' || bridgeOpenAi === '1') && createAndBridge;
  const hasConnectionId = Boolean(process.env.TELNYX_CALL_CONTROL_CONNECTION_ID?.trim());
  const hasAppId = Boolean(process.env.TELNYX_APP_ID?.trim());
  let usingConnectionIdSource: 'telnyx_call_control_connection_id' | 'telnyx_app_id_fallback_test_only' | 'missing';
  if (hasConnectionId) usingConnectionIdSource = 'telnyx_call_control_connection_id';
  else if (needsExplicitConnectionId && process.env.NODE_ENV === 'production') usingConnectionIdSource = 'missing';
  else usingConnectionIdSource = 'telnyx_app_id_fallback_test_only';

  console.info(
    '[voice] telnyx_outbound_calls_connection_id_config',
    JSON.stringify({
      connectionIdConfigured: hasConnectionId,
      appIdConfigured: hasAppId,
      usingConnectionIdSource,
    }),
  );

  if (needsExplicitConnectionId && !hasConnectionId && process.env.NODE_ENV === 'production') {
    console.error(
      '[voice] TELNYX_CALL_CONTROL_CONNECTION_ID is required in production when TELNYX_CALL_CONTROL_BRIDGE_OPENAI_SIP is enabled and TELNYX_OPENAI_CONNECT_MODE=create_and_bridge. POST /v2/calls will not fall back to TELNYX_APP_ID.',
    );
  } else if (needsExplicitConnectionId && !hasConnectionId && process.env.NODE_ENV !== 'test') {
    console.warn(
      '[voice] TELNYX_CALL_CONTROL_CONNECTION_ID is unset; non-production may fall back to TELNYX_APP_ID for POST /v2/calls (test-only style; set explicit connection id for production).',
    );
  }
}
