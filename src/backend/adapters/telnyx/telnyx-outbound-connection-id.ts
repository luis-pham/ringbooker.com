import { getEnv } from '@/src/backend/config/env';
import { withLogContext } from '@/src/backend/observability/logger';

export type TelnyxOutboundCallsConnectionIdSource =
  | 'telnyx_call_control_connection_id'
  | 'telnyx_app_id_fallback_test_only'
  | 'missing';

/** True when POST /v2/calls must use an explicit Call Control Application connection id (no silent prod fallback). */
export function telnyxOutboundCreateCallRequiresExplicitConnectionId(): boolean {
  const env = getEnv();
  const bridge = Boolean(env.TELNYX_CALL_CONTROL_BRIDGE_OPENAI_SIP);
  const mode = (process.env.TELNYX_OPENAI_CONNECT_MODE ?? 'create_and_bridge').trim().toLowerCase();
  const createAndBridge = mode === 'create_and_bridge' || mode === '';
  return bridge && createAndBridge;
}

/**
 * Resolves `connection_id` for Telnyx `POST /v2/calls` (OpenAI SIP leg, owner leg).
 * Production: no fallback to `TELNYX_APP_ID` when explicit connection id is required.
 */
export function resolveTelnyxOutboundCallsConnectionId(
  log: ReturnType<typeof withLogContext>,
): { connectionId: string; usingConnectionIdSource: TelnyxOutboundCallsConnectionIdSource } | null {
  const env = getEnv();
  const explicit = env.TELNYX_CALL_CONTROL_CONNECTION_ID?.trim();
  const requiresExplicit = telnyxOutboundCreateCallRequiresExplicitConnectionId();
  const isProd = env.NODE_ENV === 'production';

  if (explicit) {
    return { connectionId: explicit, usingConnectionIdSource: 'telnyx_call_control_connection_id' };
  }

  if (requiresExplicit && isProd) {
    log.error(
      {
        connectionIdConfigured: false,
        appIdConfigured: Boolean(env.TELNYX_APP_ID?.trim()),
        usingConnectionIdSource: 'missing' satisfies TelnyxOutboundCallsConnectionIdSource,
      },
      'telnyx_call_control_connection_id_required',
    );
    return null;
  }

  if (requiresExplicit) {
    log.warn(
      {
        connectionIdConfigured: false,
        appIdConfigured: Boolean(env.TELNYX_APP_ID?.trim()),
        usingConnectionIdSource: 'telnyx_app_id_fallback_test_only',
      },
      'telnyx_call_control_connection_id_missing_using_app_id_fallback_test_only',
    );
  }

  const appId = env.TELNYX_APP_ID?.trim();
  if (!appId) {
    log.error({ connectionIdConfigured: false, appIdConfigured: false }, 'telnyx_call_control_connection_id_required');
    return null;
  }

  return { connectionId: appId, usingConnectionIdSource: 'telnyx_app_id_fallback_test_only' };
}
