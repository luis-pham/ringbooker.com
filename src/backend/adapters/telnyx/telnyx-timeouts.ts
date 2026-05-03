import { getEnv } from '@/src/backend/config/env';

/**
 * Default timeouts (ms) for Telnyx REST. Override globally via env when set.
 * @see telnyx-http.ts
 */

const CALL_CONTROL_ACTION_DEFAULT_MS: Record<string, number> = {
  answer: 5000,
  reject: 5000,
  hangup: 5000,
  speak: 6000,
  dial: 8000,
  gather_using_speak: 8000,
  bridge: 8000,
};

/** Single env overrides per-action defaults for all Call Control actions (pilot simplicity). */
export function getCallControlActionTimeoutMs(action: string): number {
  const raw = process.env.TELNYX_CALL_CONTROL_TIMEOUT_MS?.trim();
  if (raw && Number.isFinite(Number(raw))) {
    const n = Number(raw);
    if (n > 0) return n;
  }
  return CALL_CONTROL_ACTION_DEFAULT_MS[action] ?? 8000;
}

export function getTelnyxSmsTimeoutMs(): number {
  const raw = process.env.TELNYX_SMS_TIMEOUT_MS?.trim();
  if (raw && Number.isFinite(Number(raw))) {
    const n = Number(raw);
    if (n > 0) return n;
  }
  return 10_000;
}

/** POST /v2/calls (Calls API — not Call Control actions). */
export function getTelnyxCallsCreateTimeoutMs(): number {
  const raw = process.env.TELNYX_OUTBOUND_CALL_TIMEOUT_MS?.trim();
  if (raw && Number.isFinite(Number(raw))) {
    const n = Number(raw);
    if (n > 0) return n;
  }
  return 10_000;
}

/** `timeout_secs` on Telnyx `POST /v2/calls` for OpenAI SIP outbound leg (not HTTP client timeout). */
export function getTelnyxOpenAiSipLegTimeoutSecs(): number {
  const v = getEnv().TELNYX_OPENAI_SIP_LEG_TIMEOUT_SECS;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const n = Math.floor(v);
    if (n >= 5 && n <= 120) return n;
  }
  return 15;
}

export function getTelnyxProvisioningSearchTimeoutMs(): number {
  const raw = process.env.TELNYX_PROVISIONING_TIMEOUT_MS?.trim();
  if (raw && Number.isFinite(Number(raw))) {
    const n = Number(raw);
    if (n > 0) return n;
  }
  return 15_000;
}

export function getTelnyxProvisioningOrderTimeoutMs(): number {
  const raw = process.env.TELNYX_PROVISIONING_TIMEOUT_MS?.trim();
  if (raw && Number.isFinite(Number(raw))) {
    const n = Number(raw);
    if (n > 0) return n;
  }
  return 20_000;
}
