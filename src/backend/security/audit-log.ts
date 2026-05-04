import { logger } from '@/src/backend/observability/logger';
import { trackSecurityAuditForAlerts } from '@/src/backend/observability/security-alerts';
import { incrementMetric } from '@/src/backend/observability/metrics';
import { sanitizeForLog } from '@/src/backend/security/pii';

export type SecurityAuditEvent = {
  action:
    | 'auth_signup_success'
    | 'auth_google_signup_success'
    | 'auth_google_success'
    | 'auth_login_success'
    | 'auth_login_failed'
    | 'auth_logout'
    | 'auth_password_reset_requested'
    | 'auth_password_reset_completed'
    | 'user_password_changed'
    | 'user_password_change_denied'
    | 'admin_shop_created'
    | 'admin_shop_plan_updated'
    | 'admin_user_invited'
    | 'admin_user_updated'
    | 'admin_user_password_set'
    | 'admin_demo_transcript_viewed'
    | 'admin_contact_request_status_updated'
    | 'admin_shop_settings_updated'
    | 'admin_shop_dynamic_config_updated'
    | 'authz_denied'
    | 'rate_limit_blocked'
    | 'webhook_signature_invalid'
    | 'public_demo_honeypot_triggered'
    | 'public_demo_captcha_failed'
    | 'public_demo_requested'
    | 'public_demo_outbound_disabled'
    | 'public_demo_web_session_requested'
    | 'public_demo_realtime_session_requested'
    | 'public_demo_realtime_token_created'
    | 'public_demo_realtime_limit_blocked'
    | 'public_demo_sip_prep_saved'
    | 'public_contact_honeypot_triggered'
    | 'public_contact_captcha_failed'
    | 'public_contact_requested'
    | 'csrf_blocked';
  actorType: 'user' | 'admin' | 'public' | 'provider' | 'internal';
  actorId?: string;
  ip?: string;
  path?: string;
  provider?: string;
  details?: Record<string, unknown>;
};

export function securityAudit(event: SecurityAuditEvent): void {
  const sanitized = sanitizeForLog(event) as SecurityAuditEvent;
  trackSecurityAuditForAlerts(sanitized.action, sanitized.path);
  incrementMetric('security_audit_events_total', {
    action: sanitized.action,
    actorType: sanitized.actorType,
  });
  if (sanitized.action === 'webhook_signature_invalid') {
    incrementMetric('webhook_signature_invalid_total', {
      provider: sanitized.provider ?? 'unknown',
    });
  }
  logger.warn(
    {
      security: true,
      ...sanitized,
    },
    'security_audit',
  );
}
