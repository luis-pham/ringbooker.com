import { logger } from '@/src/backend/observability/logger';

type AlertCounter = {
  count: number;
  resetAt: number;
  lastAlertAt?: number;
};

type AlertRule = {
  threshold: number;
  windowMs: number;
  cooldownMs: number;
  severity: 'warning' | 'critical';
};

const counters = new Map<string, AlertCounter>();

const STATUS_ALERT_RULES: Record<string, AlertRule> = {
  api_spike_401: { threshold: 40, windowMs: 60_000, cooldownMs: 5 * 60_000, severity: 'warning' },
  api_spike_403: { threshold: 25, windowMs: 60_000, cooldownMs: 5 * 60_000, severity: 'warning' },
  api_spike_429: { threshold: 30, windowMs: 60_000, cooldownMs: 5 * 60_000, severity: 'warning' },
  api_spike_5xx: { threshold: 12, windowMs: 60_000, cooldownMs: 2 * 60_000, severity: 'critical' },
};

const AUDIT_ALERT_RULES: Record<string, AlertRule> = {
  security_webhook_signature_invalid: {
    threshold: 5,
    windowMs: 60_000,
    cooldownMs: 5 * 60_000,
    severity: 'critical',
  },
  // Single honeypot trigger is immediately suspicious — alert on first occurrence.
  public_demo_honeypot_triggered: {
    threshold: 1,
    windowMs: 15 * 60_000,
    cooldownMs: 15 * 60_000,
    severity: 'warning',
  },
  // Captcha failures in burst indicate bot activity.
  public_demo_captcha_failed: {
    threshold: 5,
    windowMs: 10 * 60_000,
    cooldownMs: 15 * 60_000,
    severity: 'warning',
  },
  // High rate-limit hit rate signals abuse or misconfigured client.
  public_demo_rate_limited: {
    threshold: 20,
    windowMs: 10 * 60_000,
    cooldownMs: 15 * 60_000,
    severity: 'warning',
  },
};

function bumpAndMaybeAlert(
  key: string,
  rule: AlertRule,
  context: Record<string, unknown>,
): void {
  const now = Date.now();
  const existing = counters.get(key);
  const state =
    !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + rule.windowMs, lastAlertAt: existing?.lastAlertAt }
      : existing;

  state.count += 1;
  counters.set(key, state);

  const canAlert = !state.lastAlertAt || now - state.lastAlertAt >= rule.cooldownMs;
  if (state.count < rule.threshold || !canAlert) return;

  state.lastAlertAt = now;
  counters.set(key, state);
  logger.error(
    {
      alert: true,
      key,
      severity: rule.severity,
      windowMs: rule.windowMs,
      threshold: rule.threshold,
      observed: state.count,
      ...context,
    },
    'security_alert_triggered',
  );
}

export function trackApiStatusForAlerts(status: number, path: string): void {
  if (status === 401) {
    bumpAndMaybeAlert('api_spike_401', STATUS_ALERT_RULES.api_spike_401, { status, path });
    return;
  }
  if (status === 403) {
    bumpAndMaybeAlert('api_spike_403', STATUS_ALERT_RULES.api_spike_403, { status, path });
    return;
  }
  if (status === 429) {
    bumpAndMaybeAlert('api_spike_429', STATUS_ALERT_RULES.api_spike_429, { status, path });
    return;
  }
  if (status >= 500) {
    bumpAndMaybeAlert('api_spike_5xx', STATUS_ALERT_RULES.api_spike_5xx, { status, path });
  }
}

export function trackSecurityAuditForAlerts(action: string, path?: string): void {
  if (action === 'webhook_signature_invalid') {
    bumpAndMaybeAlert('security_webhook_signature_invalid', AUDIT_ALERT_RULES.security_webhook_signature_invalid, {
      action,
      path,
    });
    return;
  }
  if (action === 'public_demo_honeypot_triggered') {
    bumpAndMaybeAlert('public_demo_honeypot_triggered', AUDIT_ALERT_RULES.public_demo_honeypot_triggered, {
      action,
      path,
    });
    return;
  }
  if (action === 'public_demo_captcha_failed') {
    bumpAndMaybeAlert('public_demo_captcha_failed', AUDIT_ALERT_RULES.public_demo_captcha_failed, {
      action,
      path,
    });
    return;
  }
  if (action === 'public_demo_realtime_limit_blocked') {
    bumpAndMaybeAlert('public_demo_rate_limited', AUDIT_ALERT_RULES.public_demo_rate_limited, {
      action,
      path,
    });
  }
}
