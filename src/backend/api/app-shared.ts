import { Hono } from 'hono';
import type { Context } from 'hono';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

import type { RealtimeAgentRuntime } from '@/src/agent/realtime/types';
import { handleRealtimeDispatch, parseRealtimeDispatchInput } from '@/src/agent/realtime/dispatch-handler';
import { dispatchRealtimeSession } from '@/src/agent/realtime/dispatch-session';
import { createInboundAgentSession } from '@/src/agent/runtime/session';
import { openAiRealtimeVoiceForDemoVerticalSlug } from '@/src/agent/prompts';
import { buildPublicDemoScriptedWelcomeLine, buildPublicDemoSystemPrompt, getDemoVerticalShopContext } from '@/src/backend/demo/public-demo-system-prompt';
import {
  buildDirectWebDemoClientSecretAudioInput,
  buildOpenAiRealtimeInputTranscriptionFromEnv,
  type DirectWebDemoTurnDetectionProfile,
} from '@/src/backend/webhooks/openai-sip-accept-payload';
import {
  clearDirectDemoActiveSlot,
  consumePublicDemoRealtimeLimits,
  directDemoActiveTtlMs,
  enforcePublicDemoRealtimeOrigin,
  jsonPublicDemoRealtimeBlocked,
  runDirectDemoSerialized,
  tryOccupyDirectDemoActiveSlot,
  releaseDirectDemoActiveSlot,
  verifyDirectDemoActiveSlot,
} from '@/src/backend/demo/public-demo-realtime-guard';
import { shopLocalToUtcIso, isRequestedAppointmentInsideBusinessHours } from '@/src/agent/tools/types';
import { buildValidationMessageForAi } from '@/src/agent/tools/validate-appointment-time';
import { DateTime } from 'luxon';
import { effectiveDemoClientCountry, resolveDemoClientCountryForPersistence } from '@/src/backend/lib/demo-client-country';
import { parseDemoUserAgentHints } from '@/src/backend/lib/demo-user-agent-hints';
import {
  CAPABILITY_MIN_PLAN,
  CAPABILITY_LABELS,
  getShopPlanCapabilities,
  isCapabilityAllowed,
  type ShopSettingCapability,
} from '@/src/backend/domain/shop-plan-capabilities';
import { createShopWithPlaceholderPhoneRetry } from '@/src/backend/domain/signup-placeholder-phone';
import { normalizePhoneForStorage } from '@/lib/phone-number';
import { getCountryConfig } from '@/lib/countries/config';
import { isCommercialGoLiveApprovalRequired } from '@/src/backend/domain/commercial-approval';
import { canProceedToGoLive, evaluateKnowledgeGate } from '@/src/backend/domain/go-live-gate';
import { mergeImportedServicesIntoCatalog } from '@/src/backend/domain/service-catalog';
import { importWebsiteForOnboarding } from '@/src/backend/services/website-import/importer';
import { importWebsiteWithCache } from '@/src/backend/services/website-import/cache';
import { buildApplyPatchForSuggestions, pendingSuggestionsFromImport, secondarySummary, validateSuggestionPayload } from '@/src/backend/domain/business-knowledge-suggestions';
import { isShopSetupWizardComplete } from '@/src/backend/domain/shop-onboarding';
import { detectCarrierFromTelnyx } from '@/src/backend/services/go-live/detect-carrier';
import { startOrReuseForwardingTestSession } from '@/src/backend/services/go-live/start-forwarding-test-session';
import type {
  BillingProvider,
  BillingSubscription,
  BillingSubscriptionStatus,
  BlogPostStatus,
  ContactRequestStatus,
  JobType,
  Shop,
  ShopAccessState,
  ShopStaff,
  ShopStaffService,
  ShopServiceCatalog,
  VagaroSettings,
} from '@/src/backend/domain/types';
import type {
  BlogPostsRepository,
  BookingRecord,
  BookingsRepository,
  BusinessKnowledgeSuggestionsRepository,
  BillingNotificationsRepository,
  BillingCustomersRepository,
  BillingSubscriptionsRepository,
  CommercialAccountsRepository,
  CommercialGoLiveApprovalEventsRepository,
  CallbacksRepository,
  CallLogListItem,
  CallLogsRepository,
  DemoAdminCallListRow,
  DemoCallStatus,
  DemoSessionStatus,
  JobsRepository,
  MissedCallsRepository,
  OutboundMessageRecord,
  OutboundMessagesRepository,
  ProviderEventsRepository,
  ShopStaffRepository,
  ShopStaffServicesRepository,
  ShopsRepository,
  AuthUsersRepository,
  ContactRequestsRepository,
  DemoSessionsRepository,
  HandoffSessionsRepository,
  ShopAccessStatesRepository,
  ShopLocationsRepository,
  ShopOverageChargesRepository,
  ShopUsageAlertsRepository,
  ShopRoutingRulesRepository,
  ShopActiveCallSessionsRepository,
  TestCallAttemptsRepository,
  ForwardingTestSessionsRepository,
  VoiceCallLegsRepository,
  CustomersRepository,
  VagaroWebhookEventsRepository,
} from '@/src/backend/ports/repositories';
import type { WebDemoSessionAdminRecord, WebDemoSessionStatus, WebDemoSessionsRepository } from '@/src/backend/ports/web-demo-sessions';
import type { SalesPreparedDemoConfig, SalesPreparedDemosRepository } from '@/src/backend/ports/sales-prepared-demos';
import { notifySalesDemoEvent, notifySalesLifecycle } from '@/src/backend/services/sales-integration/sales-webhook';
import type { BillingProviderAdapter } from '@/src/backend/services/billing/types';
import { createNoCardTrialForShop } from '@/src/backend/services/billing/no-card-trial';
import {
  reminderSourceFromBooking,
  scheduleBookingFollowupJobs,
} from '@/src/backend/services/bookings/reminder-scheduling';
import { buildAdminShopStatus } from '@/src/backend/services/admin/admin-shop-status';
import { getShopBillingAccess, isBillingTrialStillValid, type BillingBlockReason, type ShopBillingAccess } from '@/src/backend/services/billing/access';
import { resolveGoLiveDashboardPrimaryCta } from '@/src/backend/services/billing/go-live-dashboard';
import { normalizeInboundE164 } from '@/src/backend/services/calls/shop-resolver';
import { formatPlanPrice, getPlanCatalogEntry, isSelfServeTrialPlan } from '@/src/backend/domain/plan-catalog';
import { getShopUsageForPeriod } from '@/src/backend/services/usage/shop-usage';
import { getBillingPeriodForShop } from '@/src/backend/services/usage/period';
import { normalizeShopTimezone } from '@/src/shared/timezone';
import {
  buildAdminTrialEndingSoonWatchlist,
  type AdminTrialEndingSoonItem,
} from '@/src/backend/services/admin/admin-dashboard-trial-watchlist';
import {
  buildDashboardOverviewRail,
  resolveCalendarBookingStatus,
  shopHasConfiguredBusinessHours,
  shopHasConfiguredServices,
} from '@/src/backend/services/user/dashboard-overview-rail';
import {
  buildUserPortalNotifications,
  type UserPortalNotificationsUsageInput,
} from '@/src/backend/services/user/user-portal-notifications';
import type { TelephonyService } from '@/src/backend/services/telephony/types';
import type { PhoneProvisioningService } from '@/src/backend/services/phone-provisioning/types';
import type { CallRecordingStorage } from '@/src/backend/services/calls/call-recording-storage';
import { provisionShopNumber } from '@/src/backend/services/phone-provisioning/provision-shop-number';
import type { EmailService } from '@/src/backend/services/email/types';
import {
  buildDemoRequestCustomerEmailPayload,
  buildPasswordResetEmailPayload,
} from '@/src/backend/services/email/base-email-builders';
import { renderBaseEmailHtml } from '@/src/backend/services/email/base-email-mjml';
import {
  contactSalesEmail,
  emailDefaultFrom,
  emailFounderFrom,
  emailReplyTo,
  emailSupportAddress,
} from '@/src/backend/services/email/config';
import { collectEmailLifecycleDiagnostics } from '@/src/backend/services/email/diagnostics';
import { emailRecipientDomain } from '@/src/backend/services/email/recipient-domain';
import { sendSignupWelcomeEmail } from '@/src/backend/services/email/signup-welcome';
import { sendVerifyEmail } from '@/src/backend/services/email/verify-email';
import { resolveEmailProviderMode } from '@/src/backend/services/email/startup';
import { getEnv } from '@/src/backend/config/env';
import { logger } from '@/src/backend/observability/logger';
import { buildDialCode, findCarrier, getForwardingCode, type ForwardingType } from '@/lib/call-forwarding/carrier-data';
import { trackApiStatusForAlerts } from '@/src/backend/observability/security-alerts';
import { getMetricsSnapshot, incrementMetric, observeDurationMs } from '@/src/backend/observability/metrics';
import {
  ADMIN_SESSION_COOKIE,
  USER_SESSION_COOKIE,
  signSessionToken,
  verifySessionToken,
} from '@/src/backend/security/session';
import { securityAudit } from '@/src/backend/security/audit-log';
import { signDemoPreviewToken, verifyDemoPreviewToken } from '@/src/backend/security/demo-preview';
import { AccessToken } from 'livekit-server-sdk';
import { toLiveKitBrowserWsUrl } from '@/src/backend/lib/livekit-browser-url';
import { generateVerificationToken, hashEmailVerificationToken } from '@/src/backend/security/email-verification';
import { hashPassword, verifyPassword } from '@/src/backend/security/password';
import {
  consumeRateLimit,
  getClientIp,
  rateLimitUserMessage,
  RATE_LIMIT_POLICIES,
} from '@/src/backend/security/rate-limit';
import { verifyTurnstileToken } from '@/src/backend/security/turnstile';
import { handlePaddleWebhook } from '@/src/backend/webhooks/paddle';
import { handleOpenAiRealtimeSipWebhook } from '@/src/backend/webhooks/openai-realtime-sip';
import { handleTelnyxWebhook } from '@/src/backend/webhooks/telnyx';
import { handleTelnyxCallControlWebhook } from '@/src/backend/webhooks/telnyx-call-control-webhook';
import { handleTelnyxTexmlOpenAiInbound } from '@/src/backend/webhooks/telnyx-texml-openai-inbound';
import { verifyVagaroWebhookHmac } from '@/src/backend/webhooks/vagaro';
import {
  acuityAuthorizeUrl,
  acuityExchangeAuthorizationCode,
  acuityFetchCurrentUser,
  acuityRevokeToken,
  encodeSquareConnectionCredentials,
  parseSquareConnectionCredentials,
  squareAuthorizeUrl,
  squareExchangeAuthorizationCode,
  squareFetchConnectionOptions,
  type SquareConnectionCredentials,
} from '@/src/backend/services/calendar/provider-connections';
import { runPlatformSync, triggerPlatformSync } from '@/src/backend/services/platform-sync';
import type { PlatformSyncDeps } from '@/src/backend/services/platform-sync';
import { resolveBookingProviderReadinessForId } from '@/src/backend/services/calendar/provider-readiness';
import {
  encodeVagaroCredentials,
  generateWebhookToken,
  generateVagaroAccessToken,
  parseVagaroCredentials,
  verifyVagaroCredentials,
  VagaroProvider,
  type VagaroCredentials,
} from '@/src/backend/services/calendar/vagaro';
import { decrypt, encrypt } from '@/src/backend/services/crypto/encrypt';
import {
  encodeMindbodyCredentials,
  parseMindbodyCredentials,
  MindbodyProvider,
  type MindbodyCredentials,
} from '@/src/backend/services/booking-providers/mindbody';
import {
  AcuityProvider,
  buildAcuityConnectionPayload,
  encodeAcuityCredentials,
  parseAcuityCredentials,
} from '@/src/backend/services/booking-providers/acuity';
import { CALENDAR_PROVIDER_CATALOG } from '@/src/backend/services/calendar/provider-catalog';
import {
  aggregateIntoBuckets,
  getChartRangeSpec,
  type DashboardChartPeriod,
} from '@/src/backend/services/admin-dashboard-chart-series';


// Auto-extracted from app.ts by scripts/split-app-ts.mjs
// All module-level schemas, helpers, constants, and types live here.
// Do not edit manually — re-run the script if app.ts module-level code changes.

export const jobTypeSchema = z.enum([
  'realtime_session_dispatch',
  'appointment_reminder_24h',
  'appointment_reminder_2h',
  'missed_call_followup_sms',
  'review_request_sms',
  'post_call_summary',
  'callback_request_owner_alert',
  'lifecycle_email',
  'trial_reminder_email',
  'trial_expiry_check',
]);

export const BODY_LIMITS = {
  defaultPublic: 256 * 1024,
  auth: 32 * 1024,
  contact: 64 * 1024,
  publicDemoRealtime: 96 * 1024,
  websiteImport: 8 * 1024,
  webhook: 1024 * 1024,
} as const;

export function bodyLimitForPath(pathname: string): number {
  if (pathname.includes('/webhooks/') || pathname.includes('/telnyx/texml/inbound')) return BODY_LIMITS.webhook;
  if (pathname.includes('/auth/')) return BODY_LIMITS.auth;
  if (pathname.includes('/public/contact/')) return BODY_LIMITS.contact;
  if (pathname.includes('/public/demo/realtime-session')) return BODY_LIMITS.publicDemoRealtime;
  if (pathname.includes('/import-website') || pathname.includes('/read-website')) return BODY_LIMITS.websiteImport;
  return BODY_LIMITS.defaultPublic;
}

export function enforceRequestBodySize(c: Context): Response | null {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method.toUpperCase())) return null;
  const raw = c.req.header('content-length')?.trim();
  if (!raw) return null;
  const bytes = Number(raw);
  const limit = bodyLimitForPath(c.req.path);
  if (Number.isFinite(bytes) && bytes > limit) {
    return c.json({ ok: false, error: 'payload_too_large' }, 413);
  }
  return null;
}

export const enqueueJobSchema = z.object({
  shopId: z.string().min(1),
  type: jobTypeSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
  runAtIso: z.string().datetime().optional(),
  idempotencyKey: z.string().min(1).optional(),
});

export const simulateInboundSchema = z.object({
  destinationPhone: z.string().min(1),
  callerPhone: z.string().min(1),
  tool: z.enum([
    'validate_appointment_time',
    'check_availability',
    'create_booking',
    'reschedule_booking',
    'get_shop_info',
    'transfer_to_user',
    'schedule_callback',
  ]),
  params: z.record(z.string(), z.unknown()).default({}),
  requestId: z.string().min(1).optional(),
  roomName: z.string().min(1).optional(),
});

export const startInboundSchema = z.object({
  destinationPhone: z.string().min(1),
  callerPhone: z.string().min(1),
  requestId: z.string().min(1).optional(),
  roomName: z.string().min(1).optional(),
});

// Structured service item for demo prompt building — server-side only
export const demoServiceItemSchema = z.object({
  category: z.string().max(60),
  name: z.string().max(100),
  price: z.number().min(0).max(100000).nullable().optional(),
  duration: z.string().max(60).nullable().optional(),
  enabled: z.boolean().optional(),
});

export const publicDemoRequestSchema = z.object({
  shopName: z.string().min(1).max(120),
  phoneNumber: z.string().min(7).max(32),
  businessType: z.string().min(1).max(80),
  demoVertical: z.enum(['nail-salon', 'hair-salon', 'day-spa', 'med-spa', 'beauty-clinic']).optional(),
  demoMode: z.enum(['quick', 'advanced', 'free-form']).optional(),
  demoSource: z.string().min(1).max(80).optional(),
  staffName: z.string().min(1).max(120).optional(),
  notes: z.string().max(500).optional(),
  // SECURITY: systemPrompt is intentionally removed from the public schema.
  // The system prompt is always built server-side from structured inputs to prevent
  // prompt injection. Any client-submitted raw prompt would bypass guardrails.
  demoConfig: z
    .object({
      address: z.string().max(500).optional(),
      city: z.string().max(120).optional(),
      primaryHours: z.string().max(200).optional(),
      secondaryHours: z.string().max(200).optional(),
      staffNames: z.array(z.string().max(80)).max(8).optional(),
      useDefaultFallbacks: z.boolean().optional(),
      services: z.array(demoServiceItemSchema).max(60).optional(),
    })
    .optional(),
  captchaToken: z.string().min(1),
  sessionId: z.string().min(8).max(120),
  website: z.string().max(120).optional(),
});

/** Same fields as `publicDemoRequestSchema` except visitor phone (web demo uses browser audio only). */
export const publicDemoWebSessionSchema = publicDemoRequestSchema.omit({ phoneNumber: true }).extend({
  importedSiteUrl: z.string().url().max(500).optional(),
  /** Set when the demo is opened from a sales prepared demo page (/try/<slug>). */
  preparedDemoSlug: z.string().max(120).optional(),
});

/** Payload from sales.ringbooker.com POST /api/backend/internal/sales/demo-context. */
export const salesDemoContextSchema = z.object({
  salesLeadId: z.string().uuid(),
  salonName: z.string().min(1).max(200),
  demoVertical: z.enum(['nail-salon', 'hair-salon', 'day-spa', 'med-spa', 'beauty-clinic']).default('hair-salon'),
  city: z.string().max(120).optional().default(''),
  state: z.string().max(120).optional().default(''),
  services: z.array(z.string().max(120)).max(60).optional().default([]),
  staffNames: z.array(z.string().max(120)).max(20).optional().default([]),
  primaryHours: z.string().max(400).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  websiteUrl: z.string().max(500).nullable().optional(),
  instagramUrl: z.string().max(500).nullable().optional(),
});

/** Verify the HMAC-signed rb_ref attribution cookie set by middleware ("<slug>.<sigB64url>")
 *  and return the trusted slug, or null if missing/forged. Same key as middleware. */
export function attributionSigningSecret(): string | null {
  const secret = process.env.APP_SIGNING_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return 'development-only-insecure-signing-secret-please-override';
  }
  return null;
}

export function verifyAttributionCookie(value: string | undefined | null): string | null {
  if (!value) return null;
  const secret = attributionSigningSecret();
  if (!secret) return null;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const slug = value.slice(0, dot);
  const providedB64 = value.slice(dot + 1);
  let provided: Buffer;
  try {
    provided = Buffer.from(providedB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  } catch {
    return null;
  }
  const expected = createHmac('sha256', secret).update(slug).digest();
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  return slug;
}

/** Readable, URL-safe slug from a salon name (+ city). */
export function slugifyDemo(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
}

/** E.164 placeholder stored on demo sessions for web-only demos — outbound dial to visitor is never performed. */
export const PUBLIC_DEMO_WEB_SESSION_CALLBACK_PHONE_E164 = '+15555550100';

export type OpenAiRealtimeClientSecretResponse = {
  value?: string;
  expires_at?: number;
  client_secret?: {
    value?: string;
    expires_at?: number;
  };
};

export function directOpenAiRealtimeModel() {
  return process.env.OPENAI_REALTIME_MODEL?.trim() || 'gpt-realtime';
}

export function directWebDemoTurnDetectionProfileForSource(demoSource: string): DirectWebDemoTurnDetectionProfile {
  return demoSource.includes('onboarding') || demoSource.includes('user') ? 'user_demo' : 'public_demo';
}

export async function createOpenAiRealtimeClientSecret(params: {
  model: string;
  voice: string;
  instructions: string;
  turnDetectionProfile: DirectWebDemoTurnDetectionProfile;
}): Promise<{
  value: string;
  expiresAt?: number;
  /** When set, browser demo sends `session.update` after the scripted welcome so mic turns create replies again. */
  turnDetectionAfterWelcome: Record<string, unknown> | null;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('openai_config_missing');
  }

  const { turnDetectionForSecret, turnDetectionAfterWelcome } = buildDirectWebDemoClientSecretAudioInput(
    params.turnDetectionProfile,
  );

  const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(process.env.OPENAI_ORGANIZATION ? { 'OpenAI-Organization': process.env.OPENAI_ORGANIZATION } : {}),
      ...(process.env.OPENAI_PROJECT ? { 'OpenAI-Project': process.env.OPENAI_PROJECT } : {}),
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model: params.model,
        instructions: params.instructions,
        audio: {
          input: {
            // GA Realtime schema: transcription lives under audio.input.transcription,
            // not the legacy top-level session.input_audio_transcription.
            transcription: buildOpenAiRealtimeInputTranscriptionFromEnv('en'),
            turn_detection: turnDetectionForSecret,
          },
          output: {
            voice: params.voice,
          },
        },
      },
    }),
  }).catch((err: unknown) => {
    logger.error(
      { err, model: params.model },
      'openai_realtime_client_secret_network_error',
    );
    return null;
  });

  if (!response) {
    throw new Error('realtime_session_failed');
  }
  if (!response.ok) {
    // Capture OpenAI's real rejection reason — without this the failure collapses to a
    // generic 502 and the actual cause (quota exhausted, rate limit, bad model) is lost.
    const detail = await response.text().catch(() => '');
    logger.error(
      { status: response.status, body: detail.slice(0, 600), model: params.model },
      'openai_realtime_client_secret_rejected',
    );
    throw new Error(response.status === 401 || response.status === 403 ? 'openai_config_missing' : 'realtime_session_failed');
  }

  const body = (await response.json().catch(() => null)) as OpenAiRealtimeClientSecretResponse | null;
  const value = body?.value ?? body?.client_secret?.value;
  if (!value) {
    logger.error({ model: params.model }, 'openai_realtime_client_secret_missing_value');
    throw new Error('realtime_session_failed');
  }
  return {
    value,
    expiresAt: body?.expires_at ?? body?.client_secret?.expires_at,
    turnDetectionAfterWelcome,
  };
}


/**
 * Shared website-import wall-clock budget for BOTH the public demo and onboarding.
 * They must use the identical budget — a shorter demo budget truncates the LLM /
 * Google Places enrichment on slower sites and yields partial/wrong hours & services,
 * so the demo import would diverge from onboarding for the same URL.
 */
export const WEBSITE_IMPORT_BUDGET_MS = 60_000;

export const WEBSITE_IMPORT_LLM_GLOBAL_IDENTITY = 'global:website_import_llm';
export const WEBSITE_IMPORT_LLM_CAP_ALERT_COOLDOWN_MS = 60 * 60_000;
export let lastWebsiteImportLlmCapAlertAt: number | undefined;

/**
 * Cross-instance daily budget gate for website-import LLM extraction. Consumed once per
 * import that would actually call the LLM (see importer `acquireLlmBudget`). Returns true
 * when a token is available; on exhaustion returns false so the import falls back to
 * static + Google Places extraction instead of burning OpenAI spend. Fails open on a
 * rate-limiter error so a Redis outage never blocks enrichment.
 */
export async function acquireWebsiteImportLlmBudget(): Promise<boolean> {
  const env = getEnv();
  try {
    const result = await consumeRateLimit(
      {
        name: 'website_import_llm_global',
        limit: env.WEBSITE_IMPORT_LLM_GLOBAL_DAILY_LIMIT,
        windowMs: env.WEBSITE_IMPORT_LLM_GLOBAL_WINDOW_SECONDS * 1000,
      },
      WEBSITE_IMPORT_LLM_GLOBAL_IDENTITY,
    );
    if (!result.ok) {
      const now = Date.now();
      if (!lastWebsiteImportLlmCapAlertAt || now - lastWebsiteImportLlmCapAlertAt >= WEBSITE_IMPORT_LLM_CAP_ALERT_COOLDOWN_MS) {
        lastWebsiteImportLlmCapAlertAt = now;
        logger.warn(
          { alert: true, key: 'website_import_llm_global_cap_reached', globalLimit: env.WEBSITE_IMPORT_LLM_GLOBAL_DAILY_LIMIT },
          'Website-import LLM daily cap reached — enrichment is falling back to static extraction',
        );
      }
    }
    return result.ok;
  } catch (err) {
    logger.warn({ err }, 'website_import_llm_budget_check_failed_open');
    return true;
  }
}

export const contactIntentValues = ['demo', 'enterprise', 'sales', 'support', 'general'] as const;
export const contactPlanInterestValues = ['starter', 'professional', 'enterprise', 'unknown'] as const;

export function normalizeEnumValue<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return allowed.includes(normalized) ? normalized : fallback;
}

export function nullableTrimmedString(max: number) {
  return z.preprocess((value) => {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
  }, z.string().max(max).nullable());
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '"') return '&quot;';
    return '&#39;';
  });
}

export const publicContactRequestSchema = z.object({
  fullName: z.string().min(1).max(120),
  businessName: z.string().min(1).max(120),
  email: z.string().email(),
  phoneNumber: z.string().min(7).max(32),
  businessType: z.string().min(1).max(80),
  currentSetup: z.string().min(1).max(120),
  helpNeed: z.string().min(1).max(1000),
  bestTime: z.string().min(1).max(140),
  intent: z.preprocess(
    (value) => normalizeEnumValue(value, contactIntentValues, 'general'),
    z.enum(contactIntentValues),
  ),
  source: z.preprocess((value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized.length > 0 ? normalized : undefined;
  }, z.string().max(120).optional()),
  planInterest: z.preprocess(
    (value) => normalizeEnumValue(value, contactPlanInterestValues, 'unknown'),
    z.enum(contactPlanInterestValues),
  ),
  locationCount: z.coerce.number().int().min(1).max(500).nullable().optional(),
  estimatedCallVolume: nullableTrimmedString(120).optional(),
  bookingSoftware: nullableTrimmedString(160).optional(),
  routingNeeds: nullableTrimmedString(3000).optional(),
  goLiveTimeline: nullableTrimmedString(300).optional(),
  numberOfLocations: z.coerce.number().int().min(1).max(500).nullable().optional(),
  locationsText: nullableTrimmedString(3000).optional(),
  mainContact: nullableTrimmedString(160).optional(),
  currentPhoneProvider: nullableTrimmedString(160).optional(),
  currentBookingSoftware: nullableTrimmedString(160).optional(),
  currentCrm: nullableTrimmedString(160).optional(),
  estimatedMonthlyCallVolume: nullableTrimmedString(120).optional(),
  languagesNeeded: nullableTrimmedString(500).optional(),
  routingRules: nullableTrimmedString(3000).optional(),
  escalationRules: nullableTrimmedString(3000).optional(),
  integrationRequirements: nullableTrimmedString(3000).optional(),
  preferredGoLiveTimeline: nullableTrimmedString(300).optional(),
  captchaToken: z.string().min(1),
  sessionId: z.string().min(8).max(120),
  website: z.string().max(120).optional(),
});

export const dispatchStatusSchema = z.object({
  requestId: z.string().min(1),
  roomName: z.string().min(1),
  sessionId: z.string().min(1),
  status: z.enum(['received', 'agent_joined', 'completed', 'failed']),
  error: z.string().optional(),
  occurredAt: z.string().datetime().optional(),
  shopId: z.string().optional(),
  isDemo: z.boolean().optional(),
  demoVertical: z.string().optional(),
  demoMode: z.string().optional(),
});

export const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional(),
});

export const signupPhoneSearchSchema = z.object({
  countryCode: z.string().min(2).max(2).default('US'),
  locality: z.string().min(1).max(80).optional(),
  administrativeArea: z.string().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
});

export const userSignupSchema = z.object({
  shopName: z.string().min(1).max(120).optional(),
  brandSlug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  userName: z.string().min(1).max(120).optional(),
  userPhone: z.string().min(6).max(32).optional(),
  timezone: z.string().min(1).max(80).default('America/Los_Angeles'),
  /** Shop's current business line (E.164). Never used for Telnyx purchase during signup. */
  phoneNumber: z.string().min(6).max(32).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  remember: z.boolean().optional(),
  plan: z.enum(['starter', 'professional']),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(8).max(128),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(64).max(128),
});

export const testCallForwardingSchema = z.object({});

export const userSettingsBaseSchema = z.object({
  name: z.string().min(1).optional(),
  phone_number: z.string().min(1).optional(),
  vertical: z.enum(['nail_salon', 'hair_salon', 'day_spa', 'med_spa', 'beauty_clinic']).optional(),
  vertical_detail: z.string().min(1).max(120).nullable().optional(),
  user_name: z.string().min(1).optional(),
  user_phone: z.string().min(1).optional(),
  handoff_phone: z.string().min(1).nullable().optional(),
  address: z.string().min(1).nullable().optional(),
  email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
  timezone: z.string().min(1).optional(),
  cancel_policy: z.string().min(1).optional(),
  promotions: z.string().min(1).nullable().optional(),
  booking_url: z.string().min(1).nullable().optional(),
  booking_method: z.enum(['app', 'direct', 'later']).nullable().optional(),
  website_url: z.string().url().optional().or(z.literal('')),
  languages: z.array(z.string()).optional(),
  not_offered_services: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
  current_onboarding_step: z.coerce.number().int().min(1).max(4).optional(),
  setup_method: z.enum(['forward', 'new_number']).optional(),
  forwarding_type: z.enum(['no_answer', 'all', 'busy', 'unreachable']).optional(),
  forwarding_carrier: z.string().optional(),
  forwarding_country: z.string().optional(),
});

export const serviceItemSchema = z.object({
  name: z.string().min(1).max(120),
  duration_min: z.coerce.number().int().min(1).max(600),
  price: z.coerce.number().min(0).max(10000),
});

export const serviceCategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  active: z.boolean().optional(),
});

export const serviceVariantSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().max(80).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(600).nullable().optional(),
  durationText: z.string().trim().max(80).nullable().optional(),
  priceAmount: z.coerce.number().min(0).max(100000).nullable().optional(),
  priceCurrency: z.string().trim().min(3).max(3).optional(),
  priceType: z.enum(['fixed', 'from', 'varies', 'consultation']).optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  notes: z.string().trim().max(240).nullable().optional(),
}).strict();

export const shopServiceSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  durationText: z.string().trim().max(80).nullable().optional(),
  durationMinutes: z.coerce.number().int().min(1).max(600).nullable().optional(),
  priceAmount: z.coerce.number().min(0).max(100000).nullable().optional(),
  priceCurrency: z.string().trim().min(3).max(3).optional(),
  priceType: z.enum(['fixed', 'from', 'varies', 'consultation']).optional(),
  bookable: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  aliases: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  bookingNotes: z.string().trim().max(1000).nullable().optional(),
  variants: z.array(serviceVariantSchema).max(20).optional(),
  aiKnowledgeStatus: z.enum(['imported_unreviewed', 'owner_reviewed']).nullable().optional(),
});

export const serviceCatalogSchema = z.object({
  categories: z.array(serviceCategorySchema).max(100),
  services: z.array(shopServiceSchema).max(500),
});

export const staffMemberSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120).nullable().optional(),
  specialties: z.array(z.string().trim().min(1).max(80)).max(12).optional().default([]),
  notes: z.string().trim().max(500).nullable().optional(),
  active: z.boolean().optional().default(true),
});

export const normalizedStaffCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  role: z.string().trim().max(100).nullable().optional(),
  specialties: z.array(z.string().trim().min(1).max(50)).max(10).optional().default([]),
  notes: z.string().trim().max(500).nullable().optional(),
  active: z.boolean().optional().default(true),
  allServices: z.boolean().optional().default(true),
  serviceIds: z.array(z.string().uuid()).max(100).optional().default([]),
}).strict();

export const normalizedStaffUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  role: z.string().trim().max(100).nullable().optional(),
  specialties: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  active: z.boolean().optional(),
}).strict();

export const staffServiceAssignmentSchema = z.object({
  allServices: z.boolean(),
  serviceIds: z.array(z.string().uuid()).max(100).optional().default([]),
}).strict();

export const businessFaqItemSchema = z.object({
  question: z.string().trim().min(1).max(200),
  answer: z.string().trim().min(1).max(1000),
});

export const businessHoursEntrySchema = z.union([
  z.object({
    closed: z.literal(true),
  }),
  z.object({
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
  }),
]);

export const userSettingsUpdateSchema = userSettingsBaseSchema.extend({
  services: z.array(serviceItemSchema).optional(),
  service_catalog: serviceCatalogSchema.optional(),
  staff: z.array(staffMemberSchema).max(50).optional(),
  faqs: z.array(businessFaqItemSchema).max(100).optional(),
  hours: z.record(z.string(), businessHoursEntrySchema).optional(),
  handoff_availability: z.enum(['business_hours', 'always', 'custom']).optional(),
  handoff_custom_hours: z.record(z.string(), businessHoursEntrySchema).nullable().optional(),
  ai_voice: z.string().min(1).max(80).nullable().optional(),
  ai_welcome_message: z.string().min(1).max(240).nullable().optional(),
  ai_custom_instructions: z.string().min(1).max(2000).nullable().optional(),
  allow_transfers: z.boolean().optional(),
  call_recording_enabled: z.boolean().optional(),
  allow_callbacks: z.boolean().optional(),
  send_reminder_sms: z.boolean().optional(),
  send_review_request_sms: z.boolean().optional(),
  send_missed_call_followup_sms: z.boolean().optional(),
  send_call_summary_sms: z.boolean().optional(),
  owner_call_summary_sms_timing: z.enum(['business_hours', 'always']).optional(),
  send_callback_request_sms: z.boolean().optional(),
  owner_callback_request_sms_timing: z.enum(['business_hours', 'always']).optional(),
  send_daily_digest_sms: z.boolean().optional(),
  owner_daily_digest_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sms_quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sms_quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const suggestionIdListSchema = z.object({
  suggestionIds: z.array(z.string().uuid()).min(1).max(100),
}).strict();

export const applyBusinessKnowledgeSuggestionsSchema = z.object({
  suggestionIds: z.array(z.string().uuid()).min(1).max(100),
  editedPayloads: z.record(z.string().uuid(), z.unknown()).optional(),
}).strict();

export const userPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export const adminShopSettingsUpdateSchema = userSettingsBaseSchema.extend({
  services: z.array(serviceItemSchema).optional(),
  staff: z.array(staffMemberSchema).max(50).optional(),
  faqs: z.array(businessFaqItemSchema).max(100).optional(),
  hours: z.record(z.string(), businessHoursEntrySchema).optional(),
});

export const adminShopDynamicConfigSchema = z.object({
  ai_voice: z.string().min(1).max(80).nullable().optional(),
  ai_welcome_message: z.string().min(1).max(240).nullable().optional(),
  ai_custom_instructions: z.string().min(1).max(2000).nullable().optional(),
  allow_transfers: z.boolean().optional(),
  allow_callbacks: z.boolean().optional(),
  send_reminder_sms: z.boolean().optional(),
  send_review_request_sms: z.boolean().optional(),
  send_missed_call_followup_sms: z.boolean().optional(),
  send_call_summary_sms: z.boolean().optional(),
  owner_call_summary_sms_timing: z.enum(['business_hours', 'always']).optional(),
  send_callback_request_sms: z.boolean().optional(),
  owner_callback_request_sms_timing: z.enum(['business_hours', 'always']).optional(),
  send_daily_digest_sms: z.boolean().optional(),
  owner_daily_digest_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sms_quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sms_quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const adminCreateShopSchema = z.object({
  name: z.string().min(1),
  brand_slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/).optional(),
  phone_number: z.string().min(6),
  user_phone: z.string().min(6),
  user_name: z.string().min(1).nullable().optional(),
  timezone: z.string().min(1),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  active: z.boolean().optional(),
});

export const adminUpdatePlanSchema = z.object({
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  active: z.boolean().optional(),
});

export const adminCommercialGoLiveApprovalSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const adminVerifyForwardingSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export const jsonRecordSchema = z.record(z.string(), z.unknown());

export const adminShopLocationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().max(500).nullable().optional(),
  timezone: z.string().trim().min(1).max(80).default('America/Los_Angeles'),
  phoneNumber: z.string().trim().max(32).nullable().optional(),
  telnyxNumber: z.string().trim().max(32).nullable().optional(),
  businessHours: jsonRecordSchema.optional().default({}),
  active: z.boolean().optional().default(true),
});

export const adminShopRoutingRuleSchema = z.object({
  locationId: z.string().uuid().nullable().optional(),
  ruleType: z.string().trim().min(1).max(80),
  conditionJson: jsonRecordSchema.optional().default({}),
  actionJson: jsonRecordSchema.optional().default({}),
  priority: z.coerce.number().int().min(0).max(10000).optional().default(100),
  active: z.boolean().optional().default(true),
});

export const adminCommercialAccountSchema = z.object({
  contractStatus: z.enum(['draft', 'sent', 'signed', 'active', 'paused', 'terminated']).default('draft'),
  monthlyMinimumCents: z.coerce.number().int().min(0).nullable().optional(),
  setupFeeCents: z.coerce.number().int().min(0).nullable().optional(),
  includedLocations: z.coerce.number().int().min(0).nullable().optional(),
  includedMinutes: z.coerce.number().int().min(0).nullable().optional(),
  includedCapturedCallers: z.coerce.number().int().min(0).nullable().optional(),
  maxConcurrentLiveCalls: z.coerce.number().int().min(0).nullable().optional(),
  maxCallDurationSeconds: z.coerce.number().int().min(0).nullable().optional(),
  overageRateCents: z.coerce.number().int().min(0).nullable().optional(),
  billingMethod: z.enum(['manual_invoice', 'paddle_custom', 'wire', 'ach', 'other']).default('manual_invoice'),
  contractSignedAt: z.string().datetime().nullable().optional(),
  approvedAt: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const adminInviteSchema = z.object({
  email: z.string().email(),
  shopId: z.string().uuid().optional(),
});

export const adminUserPatchSchema = z
  .object({
    role: z.enum(['user', 'admin']).optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => data.role !== undefined || data.active !== undefined, {
    message: 'empty_patch',
  });

export const adminUserSetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(128),
});

export const userBillingCheckoutSchema = z.object({
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  billing_interval: z.enum(['monthly', 'annual']).optional(),
}).strict();

export const userBillingManageSchema = z.object({}).strict();

export const userBillingUpgradeSchema = z.object({
  target_plan: z.enum(['starter', 'professional']),
  billing_interval: z.enum(['monthly', 'annual']).optional(),
}).strict();

export const importWebsiteSchema = z.object({
  url: z.string().trim().min(1).max(2048),
}).strict();

export const readWebsiteSchema = z.object({
  url: z.string().url(),
  services: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        category: z.string().trim().max(120).nullable().optional(),
        description: z.string().trim().max(1000).nullable().optional(),
        durationText: z.string().trim().max(80).nullable().optional(),
        durationMinutes: z.coerce.number().int().min(1).max(600).nullable().optional(),
        priceAmount: z.coerce.number().min(0).max(100000).nullable().optional(),
        priceType: z.enum(['fixed', 'from', 'varies', 'consultation']).optional(),
        aliases: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
        bookingNotes: z.string().trim().max(1000).nullable().optional(),
      }),
    )
    .max(100)
    .optional(),
});

/** Post-payment RingBooker forwarding number provisioning (see docs/onboarding_go_live_sprint.md). */
export const provisionForwardingNumberSchema = z.object({
  confirmGoLiveIntent: z.literal(true),
});

export const confirmForwardingSetupSchema = z.object({
  confirmForwardingReady: z.literal(true),
});

export const markForwardingConfiguredSchema = z.object({
  carrier: z.string().trim().min(1).max(80),
  country: z.string().trim().min(2).max(8).optional(),
  forwardingType: z.enum(['no_answer', 'all', 'busy', 'unreachable']).default('no_answer'),
});

export const forwardingCodeQuerySchema = z.object({
  carrier: z.string().trim().min(1).max(80),
  country: z.string().trim().min(2).max(8).optional(),
  forwardingType: z.enum(['no_answer', 'all', 'busy', 'unreachable']).optional(),
});

export function telnyxCountryCodeFromForwardingCountry(value: string | null | undefined): string {
  const v = (value ?? '').trim().toUpperCase();
  const config = getCountryConfig(v || null);
  return config.telnyx.countryIso;
}

export function normalizeForwardingNumberForCode(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/[\s().-]/g, '');
}

/**
 * Best-effort parse of a free-form US address string into city, state abbreviation, and zip.
 * Handles common formats: "123 Main St, Los Angeles, CA 90001" or "Austin, TX 78701".
 * Returns empty strings when a component cannot be determined.
 */
export function parseShopAddressComponents(address: string): { city: string; state: string; zip: string } {
  const empty = { city: '', state: '', zip: '' };
  if (!address.trim()) return empty;

  // Extract 5-digit zip (optionally followed by -4 extension)
  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = zipMatch?.[1] ?? '';

  // Extract two-letter US state abbreviation preceded by comma or space
  const stateMatch = address.match(/[,\s]+([A-Z]{2})[\s,]*(?:\d{5})?/i);
  const state = stateMatch?.[1]?.toUpperCase() ?? '';

  // City: last comma-separated segment before the state+zip portion
  const parts = address.split(',').map((p) => p.trim());
  let city = '';
  if (parts.length >= 2) {
    // The city is typically the second-to-last or last segment before state+zip
    // e.g. ["123 Main St", "Los Angeles", "CA 90001"]
    const candidatePart = parts[parts.length - 2] ?? parts[parts.length - 1] ?? '';
    // Strip any trailing state/zip from the candidate
    city = candidatePart.replace(/\s+[A-Z]{2}\s*\d{5}.*$/i, '').replace(/\d{5}.*$/, '').trim();
  }

  return { city, state, zip };
}

export function billingStatusForGoLive(subscription: BillingSubscription | null): 'none' | 'trial' | 'active' | 'cancelled' | 'past_due' {
  if (!subscription) return 'none';
  if (subscription.status === 'trialing') return 'trial';
  if (subscription.status === 'active') return 'active';
  if (
    subscription.status === 'canceled' ||
    subscription.status === 'paused' ||
    subscription.status === 'trial_expired' ||
    (subscription.status === 'unknown' &&
      subscription.provider === 'paddle' &&
      Boolean(subscription.providerCustomerId?.trim() || subscription.providerSubscriptionId?.trim()))
  ) {
    return 'cancelled';
  }
  if (subscription.status === 'past_due' || subscription.status === 'unpaid' || subscription.status === 'incomplete') {
    return 'past_due';
  }
  return 'none';
}

export function provisionStatusForGoLive(shop: Shop): 'none' | 'provisioning' | 'ready' | 'failed' {
  if (shop.telnyx_number?.trim()) return 'ready';
  if (shop.forwarding_number_status === 'provisioning') return 'provisioning';
  if (shop.forwarding_number_status === 'failed') return 'failed';
  return 'none';
}

export function forwardingStatusForGoLive(params: {
  shop: Shop;
  forwardingClaimed: boolean;
  forwardingVerified: boolean;
}): 'none' | 'configured' | 'verified' {
  if (params.forwardingVerified) return 'verified';
  if (params.forwardingClaimed || params.shop.forwarding_carrier?.trim()) return 'configured';
  return 'none';
}

export const calendarProviderParamSchema = z.object({
  provider: z.enum([
    'square_appointments',
    'google_calendar',
    'vagaro',
    'glossgenius',
    'fresha',
    'custom',
    'mindbody',
    'booksy',
    'boulevard',
    'calendly',
    'styleseat',
    'mangomint',
    'schedulicity',
    'zenoti',
    'phorest',
    'timely',
    'acuity',
  ]),
});
export type CalendarProviderParam = z.infer<typeof calendarProviderParamSchema>['provider'];
export type BookingLinkProviderId =
  | 'vagaro'
  | 'glossgenius'
  | 'fresha'
  | 'custom'
  | 'booksy'
  | 'boulevard'
  | 'calendly'
  | 'styleseat'
  | 'mangomint'
  | 'schedulicity'
  | 'zenoti'
  | 'phorest'
  | 'timely';

export const BOOKING_LINK_PROVIDER_IDS = [
  'vagaro',
  'glossgenius',
  'fresha',
  'custom',
  'booksy',
  'boulevard',
  'calendly',
  'styleseat',
  'mangomint',
  'schedulicity',
  'zenoti',
  'phorest',
  'timely',
] as const satisfies readonly BookingLinkProviderId[];

export const integrationsPreferencesSchema = z.object({
  bookingMethod: z.enum(['app', 'direct', 'later']).nullable().optional(),
  selectedIntegration: calendarProviderParamSchema.shape.provider.nullable().optional(),
});

export const squareConfigureSchema = z.object({
  locationId: z.string().min(1),
  serviceVariationId: z.string().min(1).optional(),
  teamMemberId: z.string().min(1).optional(),
});

export const vagaroConnectSchema = z.object({
  clientId: z.string().min(1),
  clientSecretKey: z.string().min(1),
  region: z.string().min(1).default('us'),
  businessId: z.string().min(1, 'Business ID is required for Vagaro integration'),
  scope: z.string().min(1).optional(),
  bookingUrl: z.string().optional(),
});

export const vagaroVerifySchema = z.object({
  clientId: z.string().min(1),
  clientSecretKey: z.string().min(1),
  region: z.string().min(1),
});

export const vagaroSettingsSchema = z.object({
  mode: z.enum(['link_only', 'live_sync']).optional(),
  booking_url: z.string().nullable().optional(),
  fallback_url: z.string().nullable().optional(),
});

export const vagaroConfigureSchema = z.object({
  clientId: z.string().min(1).optional(),
  clientSecretKey: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  businessId: z.string().min(1, 'Business ID is required for Vagaro integration').optional(),
  scope: z.string().min(1).optional(),
});

export const bookingLinkConnectSchema = z.object({
  bookingUrl: z.string().min(1),
});

export const vagaroBookingUrlSchema = z.object({
  bookingUrl: z.string().min(1),
});

export const mindbodyConnectSchema = z.object({
  siteId: z.string().min(1, 'Mindbody Site ID is required'),
  apiKey: z.string().min(1, 'Mindbody API key is required'),
  sourceName: z.string().min(1).optional(),
  staffToken: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
  sessionTypeId: z.string().min(1).optional(),
  staffId: z.string().min(1).optional(),
  bookingUrl: z.string().optional(),
});

export const acuityConnectSchema = z.object({
  userId: z.string().min(1, 'Acuity User ID is required').optional(),
  apiKey: z.string().min(1, 'Acuity API key is required').optional(),
  accessToken: z.string().min(1).optional(),
  appointmentTypeId: z.string().min(1).optional(),
  calendarId: z.string().min(1).optional(),
  defaultCalendarId: z.string().min(1).optional(),
  serviceMappings: z.record(z.string(), z.string()).optional(),
  staffMappings: z.record(z.string(), z.string()).optional(),
  requiresCallerEmail: z.boolean().optional(),
  timezone: z.string().min(1).optional(),
  bookingUrl: z.string().optional(),
}).refine((value) => Boolean(value.accessToken || (value.userId && value.apiKey)), {
  message: 'Acuity User ID and API key, or OAuth access token, are required',
});

export const acuitySettingsSchema = z.object({
  appointmentTypeId: z.string().min(1).optional(),
  calendarId: z.string().min(1).optional(),
  defaultCalendarId: z.string().min(1).optional(),
  serviceMappings: z.record(z.string(), z.string()).optional(),
  staffMappings: z.record(z.string(), z.string()).optional(),
  requiresCallerEmail: z.boolean().optional(),
  timezone: z.string().min(1).optional(),
  bookingUrl: z.string().optional(),
});

export const blogPostStatusSchema = z.enum(['draft', 'published', 'archived']);

export const blogPostListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  query: z.string().max(120).optional(),
  status: z.union([blogPostStatusSchema, z.literal('all')]).optional(),
});

export const contactRequestStatusSchema = z.enum(['new', 'contacted', 'qualified', 'closed', 'spam']);
export const contactRequestIntentSchema = z.enum(contactIntentValues);

export const adminLeadsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  status: z.union([contactRequestStatusSchema, z.literal('all')]).optional(),
  intent: z.union([contactRequestIntentSchema, z.literal('all')]).optional(),
  query: z.string().max(120).optional(),
});

export const adminDemoCallsListQuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
});

export const webDemoAdminStatusSchema = z.enum(['started', 'connected', 'completed', 'failed', 'timed_out', 'rate_limited']);

export const adminWebDemosListQuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  vertical: z.preprocess((v) => (v === '' || v == null ? undefined : String(v)), z.string().max(120).optional()),
  status: webDemoAdminStatusSchema.optional(),
  country: z.preprocess((v) => (v === '' || v == null ? undefined : String(v)), z.string().max(8).optional()),
  search: z.preprocess((v) => (v === '' || v == null ? undefined : String(v)), z.string().max(200).optional()),
});

export const adminCallsListQuerySchema = z.object({
  shopId: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : String(val).trim()),
    z
      .string()
      .optional()
      .refine((v) => v === undefined || parseAdminShopIdParam(v) !== null, { message: 'invalid_shop_id' }),
  ),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
});

export const adminShopCallsQuerySchema = z.object({
  callsPage: z.coerce.number().int().min(1).max(10_000).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** How long after a checkout session is created we treat its webhooks as still in flight
 *  and block a duplicate checkout. Past this window the previous attempt is considered
 *  abandoned and the user may start payment setup again. */
export const PADDLE_CHECKOUT_PENDING_WINDOW_MS = 5 * 60 * 1000;

export const USER_CALLS_PAGE_SIZE = 25;
export const userCallsTabSchema = z.enum(['all', 'follow_up', 'follow_up_needed', 'high_urgency', 'missed']);
export const userCallsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  tab: userCallsTabSchema.optional(),
  filter: userCallsTabSchema.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const USER_BOOKINGS_PAGE_SIZE = 25;
export const userBookingsTabSchema = z.enum(['all', 'awaiting_action', 'contacted', 'confirmed', 'declined', 'rescheduled', 'cancellation_pending', 'cancelled', 'completed']);
export const userBookingsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  tab: userBookingsTabSchema.optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  callId: z.preprocess((v) => (v === '' || v == null ? undefined : String(v)), z.string().max(160).optional()),
});
export const userBookingStatusPatchSchema = z.object({
  status: z.enum(['captured', 'link_sent', 'contacted', 'confirmed', 'reminder_sent', 'cancel_link_sent', 'declined', 'cancelled', 'rescheduled', 'completed']),
});

export const adminShopAnalyticsQuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const adminLeadStatusUpdateSchema = z.object({
  status: contactRequestStatusSchema,
  notes: z.string().max(2000).nullable().optional(),
});


export function buildUserCallFilters(parsed: z.infer<typeof userCallsListQuerySchema>) {
  const dateFrom = parsed.dateFrom ?? parsed.from;
  const dateTo = parsed.dateTo ?? parsed.to;
  const tab = parsed.tab ?? parsed.filter ?? 'all';
  const startedAfter = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : undefined;
  const startedBefore = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : undefined;
  const base = { startedAfter, startedBefore };
  switch (tab) {
    case 'follow_up':
    case 'follow_up_needed':
      return { ...base, summaryFollowUpRequired: true };
    case 'high_urgency':
      return { ...base, summaryUrgency: 'high' as const };
    case 'missed':
      return { ...base, outcome: 'missed' };
    default:
      return base;
  }
}

export function buildUserBookingFilters(parsed: z.infer<typeof userBookingsListQuerySchema>) {
  const createdAfter = parsed.dateFrom ? new Date(`${parsed.dateFrom}T00:00:00.000Z`) : undefined;
  const createdBefore = parsed.dateTo ? new Date(`${parsed.dateTo}T23:59:59.999Z`) : undefined;
  const base = { createdAfter, createdBefore, callLogId: parsed.callId };
  switch (parsed.tab ?? 'all') {
    case 'awaiting_action':
      return { ...base, statuses: ['captured', 'link_sent'] };
    case 'contacted':
      return { ...base, statuses: ['contacted'] };
    case 'confirmed':
      return { ...base, statuses: ['confirmed', 'reminder_sent'] };
    case 'declined':
      return { ...base, statuses: ['declined'] };
    case 'rescheduled':
      return { ...base, statuses: ['rescheduled'] };
    case 'cancellation_pending':
      return { ...base, statuses: ['cancel_link_sent'] };
    case 'cancelled':
      return { ...base, statuses: ['cancelled'] };
    case 'completed':
      return { ...base, statuses: ['completed'] };
    default:
      return base;
  }
}

export function normalizeUserBookingStatus(status: string, reminder24hSent?: boolean, reminder2hSent?: boolean): string {
  if (status === 'pending') return 'captured';
  if (status === 'no_show') return 'cancelled';
  if (status === 'confirmed' && (reminder24hSent || reminder2hSent)) return 'reminder_sent';
  return status;
}

export function appointmentDateParts(datetimeUtc?: string | null, timezone = 'UTC'): { appointmentDate?: string; appointmentTime?: string } {
  if (!datetimeUtc) return {};
  const date = new Date(datetimeUtc);
  if (!Number.isFinite(date.getTime())) return {};
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const appointmentDate = `${get('year')}-${get('month')}-${get('day')}`;
  const appointmentTime = `${get('hour')}:${get('minute')} ${get('dayPeriod')}`.trim();
  return { appointmentDate, appointmentTime };
}

export function smsTypeFromCategory(category: string):
  | 'booking_link'
  | 'confirmation'
  | 'reminder'
  | 'cancel_link'
  | 'reschedule_link'
  | 'owner_summary' {
  const c = category.toLowerCase();
  if (c.includes('booking_link')) return 'booking_link';
  if (c.includes('confirmation')) return 'confirmation';
  if (c.includes('reminder')) return 'reminder';
  if (c.includes('cancel')) return 'cancel_link';
  if (c.includes('reschedule')) return 'reschedule_link';
  return 'owner_summary';
}

export function toUserBookingResponse(booking: BookingRecord, smsLog: OutboundMessageRecord[] = []) {
  const status = normalizeUserBookingStatus(booking.status, booking.reminder24hSent, booking.reminder2hSent);
  const dateParts = appointmentDateParts(booking.datetimeUtc, booking.timezone);
  return {
    id: booking.id,
    shopId: booking.shopId,
    callerPhone: booking.customerPhone,
    callerName: booking.customerName ?? undefined,
    serviceRequested: booking.service || undefined,
    providerRequested: booking.techName ?? undefined,
    durationMinutes: booking.durationMinutes ?? undefined,
    appointmentDate: dateParts.appointmentDate,
    appointmentTime: dateParts.appointmentTime,
    datetimeUtc: booking.datetimeUtc,
    timezone: booking.timezone,
    status,
    callId: booking.callLogId ?? undefined,
    integrationId: booking.calendarEventId ?? undefined,
    providerStatus: booking.providerStatus ?? null,
    providerError: booking.providerErrorReason ?? null,
    integrationName: booking.provider ?? null,
    calendarEventId: booking.calendarEventId ?? null,
    smsLog: smsLog.map((message) => ({
      id: message.id,
      bookingRequestId: booking.id,
      type: smsTypeFromCategory(message.category),
      sentAt: message.createdAt,
      deliveredAt: message.status === 'sent' ? message.updatedAt ?? message.createdAt : undefined,
      failedAt: message.status === 'failed' ? message.updatedAt ?? message.createdAt : undefined,
      phoneNumber: message.customerPhone,
    })),
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

export function userBookingStatsStatuses(kind: 'awaitingAction' | 'contacted' | 'confirmed' | 'declined' | 'rescheduled' | 'cancellationPending' | 'cancelled' | 'completed'): string[] {
  if (kind === 'awaitingAction') return ['captured', 'link_sent'];
  if (kind === 'contacted') return ['contacted'];
  if (kind === 'confirmed') return ['confirmed', 'reminder_sent'];
  if (kind === 'declined') return ['declined'];
  if (kind === 'rescheduled') return ['rescheduled'];
  if (kind === 'cancellationPending') return ['cancel_link_sent'];
  if (kind === 'cancelled') return ['cancelled'];
  return ['completed'];
}

export type UserCallStatus = 'in_progress' | 'completed' | 'missed' | 'voicemail';
export type UserCallOutcome =
  | 'booking_request'
  | 'booking_contacted'
  | 'booking_confirmed'
  | 'booking_cancel_pending'
  | 'booking_declined'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'booking_completed'
  | 'captured_call'
  | 'pricing_inquiry'
  | 'hours_inquiry'
  | 'general_inquiry'
  | 'follow_up_needed'
  | 'cancelled_request'
  | 'reschedule_request'
  | 'complaint'
  | 'no_response'
  | 'no_outcome';

export function deriveUserCallStatus(call: CallLogListItem, now = new Date()): UserCallStatus {
  if (call.outcome === 'missed') return 'missed';
  if (call.outcome === 'voicemail') return 'voicemail';
  if (!call.endedAt) {
    const startedAt = call.startedAt ? new Date(call.startedAt) : null;
    if (startedAt && Number.isFinite(startedAt.getTime()) && now.getTime() - startedAt.getTime() <= 30 * 60 * 1000) {
      return 'in_progress';
    }
    return call.transcriptText?.trim() || call.transcriptStatus === 'completed' ? 'completed' : 'missed';
  }
  return 'completed';
}

export function hasCallerUtterance(call: Pick<CallLogListItem, 'transcriptText'>): boolean {
  return (call.transcriptText ?? '')
    .split('\n')
    .some((line) => /\bCALLER:\s*\S/i.test(line));
}

export function needsUserFollowUp(call: Pick<CallLogListItem, 'summaryFollowUpRequired' | 'summaryNextAction' | 'outcome'>): boolean {
  return Boolean(call.summaryFollowUpRequired);
}

export function deriveUserCallOutcome(call: CallLogListItem, linkedBooking?: BookingRecord | null): UserCallOutcome {
  const question = `${call.summaryCallerQuestion ?? ''} ${call.summaryServiceRequest ?? ''} ${call.transcriptText ?? ''}`.toLowerCase();
  if (call.transcriptText?.trim() && !hasCallerUtterance(call)) return 'no_response';
  if (call.summaryNextAction === 'cancellation_requested') return 'cancelled_request';
  if (call.summaryNextAction === 'reschedule_requested') return 'reschedule_request';
  if (call.summaryNextAction === 'escalated') return 'complaint';
  if (linkedBooking) {
    const status = normalizeUserBookingStatus(linkedBooking.status, linkedBooking.reminder24hSent, linkedBooking.reminder2hSent);
    if (status === 'contacted') return 'booking_contacted';
    if (status === 'confirmed' || status === 'reminder_sent') return 'booking_confirmed';
    if (status === 'cancel_link_sent') return 'booking_cancel_pending';
    if (status === 'declined') return 'booking_declined';
    if (status === 'cancelled') return 'booking_cancelled';
    if (status === 'rescheduled') return 'booking_rescheduled';
    if (status === 'completed') return 'booking_completed';
    return 'booking_request';
  }
  if (needsUserFollowUp(call)) return 'follow_up_needed';
  if (question.includes('price') || question.includes('pricing') || question.includes('cost') || question.includes('how much')) return 'pricing_inquiry';
  if (question.includes('hour') || question.includes('open') || question.includes('close')) return 'hours_inquiry';
  if (call.isCapturedCaller) return 'captured_call';
  if (call.transcriptText?.trim() || call.summaryCallerQuestion || call.summaryServiceRequest) return 'general_inquiry';
  return 'no_outcome';
}

export function buildUserCallSummary(call: CallLogListItem): string | undefined {
  const parts = [
    call.summaryServiceRequest ? `Service: ${call.summaryServiceRequest}` : null,
    call.summaryCallerQuestion ? `Question: ${call.summaryCallerQuestion}` : null,
    call.summaryPreferredDatetime ? `Preferred time: ${call.summaryPreferredDatetime}` : null,
    call.summaryPreferredTech ? `Provider: ${call.summaryPreferredTech}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join('\n') : undefined;
}

export function hasViewableTranscript(call: { transcriptText?: string | null }): boolean {
  return Boolean(call.transcriptText?.trim());
}

export function toUserCallResponse(
  call: CallLogListItem,
  extras: { missedFollowupSmsSent?: boolean } = {},
  linkedBooking?: BookingRecord | null,
) {
  const status = deriveUserCallStatus(call);
  const outcome = deriveUserCallOutcome(call, linkedBooking);
  return {
    id: call.requestId ?? call.providerCallId,
    shopId: call.shopId,
    callerPhone: call.callerPhone ?? '',
    callerName: call.summaryCallerName ?? undefined,
    isRepeatCaller: false,
    forwardedTo: call.destinationPhone ?? undefined,
    startedAt: call.startedAt,
    endedAt: call.endedAt,
    durationSeconds: call.durationSecs ?? undefined,
    status,
    outcome,
    bookingCaptured: Boolean(linkedBooking),
    bookingRequestId: linkedBooking?.id,
    transcriptAvailable: hasViewableTranscript(call),
    transcriptUrl: undefined,
    recordingUrl: undefined,
    recordingAvailable: call.recordingStatus === 'available' && Boolean(call.recordingStorageKey),
    recordingStatus: call.recordingStatus,
    summary: buildUserCallSummary(call),
    transcriptText: call.transcriptText,
    followUpNeeded: needsUserFollowUp(call),
    highUrgency: call.summaryUrgency === 'high',
    urgencyReason: call.summaryUrgency === 'high' ? call.summaryCallerQuestion ?? call.summaryServiceRequest ?? 'Marked high urgency' : undefined,
    provider: call.provider,
    providerCallId: call.providerCallId,
    requestId: call.requestId,
    transcriptStatus: call.transcriptStatus,
    createdAt: call.startedAt,
    updatedAt: call.endedAt ?? call.startedAt,
    missedFollowupSmsSent: extras.missedFollowupSmsSent ?? false,
  };
}

export function toBasicUserCallResponse(
  call: CallLogListItem,
  extras: { missedFollowupSmsSent?: boolean } = {},
  options: { includeTranscriptText?: boolean } = {},
) {
  const status = deriveUserCallStatus(call);
  return {
    id: call.requestId ?? call.providerCallId,
    shopId: call.shopId,
    callerPhone: call.callerPhone ?? '',
    startedAt: call.startedAt,
    endedAt: call.endedAt,
    durationSeconds: call.durationSecs ?? undefined,
    status,
    transcriptAvailable: hasViewableTranscript(call),
    transcriptStatus: call.transcriptStatus,
    ...(options.includeTranscriptText ? { transcriptText: call.transcriptText } : {}),
    providerCallId: call.providerCallId,
    requestId: call.requestId,
    createdAt: call.startedAt,
    updatedAt: call.endedAt ?? call.startedAt,
    missedFollowupSmsSent: extras.missedFollowupSmsSent ?? false,
  };
}

export function shopLocalDateKey(value: Date | string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function shopLocalHour(value: Date | string, timezone: string): number | null {
  const rendered = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(new Date(value));
  const hour = Number(rendered);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

export type SessionRole = 'user' | 'admin';

export const USER_SETTING_FIELD_CAPABILITIES: Record<string, ShopSettingCapability> = {
  name: 'edit_business_profile',
  phone_number: 'edit_business_profile',
  vertical: 'edit_business_profile',
  vertical_detail: 'edit_business_profile',
  user_name: 'edit_business_profile',
  user_phone: 'edit_business_profile',
  handoff_phone: 'edit_business_profile',
  handoff_availability: 'edit_transfer_settings',
  handoff_custom_hours: 'edit_transfer_settings',
  address: 'edit_business_profile',
  email: 'edit_business_profile',
  timezone: 'edit_business_profile',
  booking_url: 'edit_booking_url',
  booking_method: 'edit_booking_url',
  website_url: 'edit_business_profile',
  languages: 'edit_business_profile',
  cancel_policy: 'edit_cancel_policy',
  promotions: 'edit_promotions',
  services: 'edit_services',
  not_offered_services: 'edit_services',
  service_catalog: 'edit_services',
  staff: 'edit_staff',
  faqs: 'edit_business_profile',
  hours: 'edit_hours',
  allow_transfers: 'edit_transfer_settings',
  call_recording_enabled: 'configure_call_recording',
  allow_callbacks: 'edit_callback_settings',
  send_missed_call_followup_sms: 'edit_missed_call_followup_sms',
  send_call_summary_sms: 'edit_callback_settings',
  owner_call_summary_sms_timing: 'edit_callback_settings',
  send_callback_request_sms: 'edit_callback_settings',
  owner_callback_request_sms_timing: 'edit_callback_settings',
  send_daily_digest_sms: 'edit_callback_settings',
  owner_daily_digest_time: 'edit_callback_settings',
  sms_quiet_hours_start: 'edit_callback_settings',
  sms_quiet_hours_end: 'edit_callback_settings',
  ai_voice: 'edit_ai_voice',
  ai_welcome_message: 'edit_ai_greeting',
  send_reminder_sms: 'edit_reminder_sms',
  send_review_request_sms: 'edit_review_request_sms',
  ai_custom_instructions: 'edit_ai_custom_instructions',
  // Onboarding wizard + call-forwarding setup persist these via PUT /user/settings.
  // (sms_owner_opted_in is intentionally NOT here — owner SMS consent is guarded separately.)
  current_onboarding_step: 'edit_business_profile',
  setup_method: 'edit_business_profile',
  forwarding_type: 'edit_business_profile',
  forwarding_carrier: 'edit_business_profile',
  forwarding_country: 'edit_business_profile',
};

export function planFeatureLockedJson(c: Context, capability: ShopSettingCapability) {
  return c.json(
    {
      ok: false,
      error: 'plan_feature_locked',
      requirements: {
        capability,
        label: CAPABILITY_LABELS[capability],
        minPlan: CAPABILITY_MIN_PLAN[capability],
      },
    },
    403,
  );
}

export function splitUserSettingsPatchByPlan(
  shop: Shop,
  patch: Record<string, unknown>,
): {
  basicPatch: Partial<
      Pick<
        Shop,
        | 'name'
        | 'phone_number'
        | 'vertical'
        | 'vertical_detail'
        | 'user_name'
      | 'user_phone'
      | 'handoff_phone'
      | 'handoff_availability'
      | 'handoff_custom_hours'
      | 'address'
      | 'email'
      | 'timezone'
      | 'services'
      | 'not_offered_services'
      | 'staff'
      | 'faqs'
      | 'hours'
      | 'cancel_policy'
        | 'promotions'
        | 'booking_url'
        | 'booking_method'
        | 'website_url'
        | 'languages'
        | 'current_onboarding_step'
        | 'setup_method'
        | 'forwarding_type'
        | 'forwarding_carrier'
        | 'forwarding_country'
        | 'sms_owner_opted_in'
    >
  >;
  dynamicPatch: Partial<
    Pick<
      Shop,
      | 'ai_voice'
      | 'ai_welcome_message'
      | 'ai_custom_instructions'
      | 'allow_transfers'
      | 'call_recording_enabled'
      | 'allow_callbacks'
      | 'send_reminder_sms'
      | 'send_review_request_sms'
      | 'send_missed_call_followup_sms'
      | 'send_call_summary_sms'
      | 'owner_call_summary_sms_timing'
      | 'send_callback_request_sms'
      | 'owner_callback_request_sms_timing'
      | 'send_daily_digest_sms'
      | 'owner_daily_digest_time'
      | 'sms_quiet_hours_start'
      | 'sms_quiet_hours_end'
    >
  >;
  disallowedFields: string[];
} {
  const capabilities = getShopPlanCapabilities(shop.plan);
  const basicPatch: Record<string, unknown> = {};
  const dynamicPatch: Record<string, unknown> = {};
  const disallowedFields: string[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const capability = USER_SETTING_FIELD_CAPABILITIES[key];
    if (!capability) continue;
    if (!capabilities[capability]) {
      if (JSON.stringify(shop[key as keyof Shop] ?? null) === JSON.stringify(value ?? null)) {
        continue;
      }
      disallowedFields.push(key);
      continue;
    }

    if (
      key === 'ai_voice' ||
      key === 'ai_welcome_message' ||
      key === 'ai_custom_instructions' ||
      key === 'allow_transfers' ||
      key === 'call_recording_enabled' ||
      key === 'allow_callbacks' ||
      key === 'send_reminder_sms' ||
      key === 'send_review_request_sms' ||
      key === 'send_missed_call_followup_sms' ||
      key === 'send_call_summary_sms' ||
      key === 'owner_call_summary_sms_timing' ||
      key === 'send_callback_request_sms' ||
      key === 'owner_callback_request_sms_timing' ||
      key === 'send_daily_digest_sms' ||
      key === 'owner_daily_digest_time' ||
      key === 'sms_quiet_hours_start' ||
      key === 'sms_quiet_hours_end'
    ) {
      dynamicPatch[key] = value;
      continue;
    }

    if ((key === 'phone_number' || key === 'user_phone' || key === 'handoff_phone') && typeof value === 'string') {
      basicPatch[key] = normalizePhoneForStorage(value, shop.country_code ?? 'US') ?? value;
      continue;
    }

    basicPatch[key] = value;
  }

  return {
    basicPatch: basicPatch as {
      [K in keyof Pick<
        Shop,
        | 'user_name'
        | 'user_phone'
        | 'handoff_phone'
        | 'handoff_availability'
        | 'handoff_custom_hours'
        | 'address'
        | 'email'
        | 'timezone'
        | 'services'
      | 'not_offered_services'
        | 'staff'
        | 'faqs'
        | 'hours'
        | 'cancel_policy'
        | 'promotions'
        | 'booking_url'
        | 'booking_method'
        | 'website_url'
        | 'languages'
        | 'current_onboarding_step'
        | 'setup_method'
        | 'forwarding_type'
        | 'forwarding_carrier'
        | 'forwarding_country'
        | 'sms_owner_opted_in'
      >]?: Shop[K];
    },
    dynamicPatch: dynamicPatch as {
      [K in keyof Pick<
        Shop,
        | 'ai_voice'
        | 'ai_welcome_message'
        | 'ai_custom_instructions'
        | 'allow_transfers'
        | 'call_recording_enabled'
        | 'allow_callbacks'
        | 'send_reminder_sms'
        | 'send_review_request_sms'
        | 'send_missed_call_followup_sms'
        | 'send_call_summary_sms'
        | 'owner_call_summary_sms_timing'
        | 'send_callback_request_sms'
        | 'owner_callback_request_sms_timing'
        | 'send_daily_digest_sms'
        | 'owner_daily_digest_time'
        | 'sms_quiet_hours_start'
        | 'sms_quiet_hours_end'
      >]?: Shop[K];
    },
    disallowedFields,
  };
}

export function normalizeServiceCatalogForShop(
  shopId: string,
  input: z.infer<typeof serviceCatalogSchema>,
): ShopServiceCatalog {
  const now = new Date().toISOString();
  const categories = input.categories.map((category, index) => ({
    id: category.id ?? randomUUID(),
    shopId,
    name: category.name,
    description: category.description ?? null,
    sortOrder: category.sortOrder ?? index,
    active: category.active ?? true,
    createdAt: now,
    updatedAt: now,
  }));
  const categoryIds = new Set(categories.map((category) => category.id));
  return {
    categories,
    services: input.services.map((service, index) => ({
      id: service.id ?? randomUUID(),
      shopId,
      categoryId: service.categoryId && categoryIds.has(service.categoryId) ? service.categoryId : null,
      name: service.name,
      description: service.description ?? null,
      durationText: service.durationText ?? null,
      durationMinutes: service.durationMinutes ?? null,
      priceAmount: service.priceAmount ?? null,
      priceCurrency: service.priceCurrency ?? 'USD',
      priceType: service.priceType ?? 'fixed',
      bookable: service.bookable ?? true,
      active: service.active ?? true,
      sortOrder: service.sortOrder ?? index,
      aliases: service.aliases ?? [],
      bookingNotes: service.bookingNotes ?? null,
      aiKnowledgeStatus: service.aiKnowledgeStatus ?? null,
      variants: (service.variants ?? []).slice(0, 20).map((variant, variantIndex) => ({
        id: variant.id ?? randomUUID(),
        label: variant.label?.trim() || variant.durationText?.trim() || (variant.priceAmount !== null && variant.priceAmount !== undefined ? `$${variant.priceAmount}` : `Option ${variantIndex + 1}`),
        durationMinutes: variant.durationMinutes ?? null,
        durationText: variant.durationText?.trim() || (variant.durationMinutes ? `${variant.durationMinutes} min` : null),
        priceAmount: variant.priceAmount ?? null,
        priceCurrency: (variant.priceCurrency ?? 'USD').toUpperCase(),
        priceType: variant.priceType ?? 'fixed',
        sortOrder: variant.sortOrder ?? variantIndex,
        notes: variant.notes ?? null,
      })).filter((variant) => variant.label || variant.durationText || variant.priceAmount !== null),
      externalMetadata: {},
      createdAt: now,
      updatedAt: now,
    })),
  };
}

export function userSettingsDuplicateConflict(message: string): { error: string; fields: string[] } | null {
  if (/shops_phone_number_key|duplicate key value.*phone_number/i.test(message)) {
    return { error: 'phone_number_already_exists', fields: ['phone_number'] };
  }
  if (/idx_shops_telnyx_number_unique|shops_telnyx_number_key|duplicate key value.*telnyx_number/i.test(message)) {
    return { error: 'forwarding_number_already_exists', fields: ['telnyx_number'] };
  }
  if (/shops_brand_slug_key|duplicate key value.*brand_slug/i.test(message)) {
    return { error: 'brand_slug_already_exists', fields: ['brand_slug'] };
  }
  if (/duplicate key value violates unique constraint/i.test(message)) {
    return { error: 'duplicate_record', fields: [] };
  }
  return null;
}

export function toUserFacingServiceCatalog(catalog?: ShopServiceCatalog | null): ShopServiceCatalog | null {
  if (!catalog) return null;
  return {
    categories: catalog.categories.map((category) => ({ ...category })),
    services: catalog.services.map((service) => {
      const {
        externalProvider: _externalProvider,
        externalServiceId: _externalServiceId,
        externalLocationId: _externalLocationId,
        externalStaffRequired: _externalStaffRequired,
        externalMetadata: _externalMetadata,
        ...userFacingService
      } = service;
      return userFacingService;
    }),
  };
}

export function toUserFacingStaff(member: ShopStaff, mappings: ShopStaffService[] = []) {
  const allServices = member.allServices !== false;
  return {
    id: member.id,
    name: member.name,
    role: member.role ?? null,
    specialties: member.specialties ?? [],
    notes: member.notes ?? null,
    active: member.active,
    allServices,
    serviceIds: allServices
      ? []
      : mappings.filter((mapping) => mapping.staffId === member.id).map((mapping) => mapping.serviceId),
    syncedFromPlatform: Boolean(member.externalProvider),
    externalProvider: member.externalProvider ?? null,
  };
}

export function stripSensitiveShopFields(shop: Shop): Shop {
  const sanitized = Object.fromEntries(
    Object.entries(shop).filter(([key]) => !key.endsWith('_encrypted') && !key.endsWith('_secret')),
  ) as Shop;
  return sanitized;
}

export function toUserFacingShop(shop: Shop): Shop {
  const sanitized = stripSensitiveShopFields(shop);
  return {
    ...sanitized,
    vagaro_webhook_token: sanitized.vagaro_webhook_token ? 'whk_••••••••••••' : null,
    service_catalog: toUserFacingServiceCatalog(sanitized.service_catalog) ?? undefined,
  };
}

export function toAdminFacingShop(shop: Shop): Shop {
  const sanitized = stripSensitiveShopFields(shop);
  return {
    ...sanitized,
    vagaro_webhook_token: sanitized.vagaro_webhook_token ? 'whk_••••••••••••' : null,
  };
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

export function ensureInternalAccess(headerValue: string | null): boolean {
  const internalKey = process.env.BACKEND_INTERNAL_API_KEY;
  if (!internalKey) return process.env.NODE_ENV !== 'production';
  return headerValue != null && timingSafeStringEqual(headerValue, internalKey);
}

export function ensureRealtimeDispatchAccess(authHeader: string | null, internalHeader: string | null): boolean {
  const dispatchToken = process.env.AGENT_DISPATCH_AUTH_TOKEN;
  if (dispatchToken) {
    return authHeader != null && timingSafeStringEqual(authHeader, `Bearer ${dispatchToken}`);
  }
  return ensureInternalAccess(internalHeader);
}

export function requireLivekitRealtimeInProduction(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_PROD_RUNTIME !== 'true';
}

export type MetricsSnapshot = ReturnType<typeof getMetricsSnapshot>;
export type SnapshotMetric = MetricsSnapshot['metrics'][number];

export function metricLabelsMatch(metric: SnapshotMetric, labels?: Record<string, string>): boolean {
  if (!labels) return true;
  return Object.entries(labels).every(([key, value]) => metric.labels[key] === value);
}

export function counterMetricTotal(snapshot: MetricsSnapshot, name: string, labels?: Record<string, string>): number {
  return snapshot.metrics.reduce((sum, metric) => {
    if (metric.type !== 'counter') return sum;
    if (metric.name !== name) return sum;
    if (!metricLabelsMatch(metric, labels)) return sum;
    return sum + metric.value;
  }, 0);
}

export function durationMetricAggregate(
  snapshot: MetricsSnapshot,
  name: string,
  labels?: Record<string, string>,
): { count: number; avg: number; min: number; max: number } {
  let count = 0;
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const metric of snapshot.metrics) {
    if (metric.type !== 'duration') continue;
    if (metric.name !== name) continue;
    if (!metricLabelsMatch(metric, labels)) continue;
    count += metric.count;
    sum += metric.sum;
    min = Math.min(min, metric.min);
    max = Math.max(max, metric.max);
  }
  return {
    count,
    avg: count > 0 ? Number((sum / count).toFixed(2)) : 0,
    min: Number.isFinite(min) ? Number(min.toFixed(2)) : 0,
    max: Number(max.toFixed(2)),
  };
}

export async function readSession(c: Context): Promise<{ role: SessionRole; email: string; shopId?: string; emailVerified?: boolean } | null> {
  const userToken = getCookie(c, USER_SESSION_COOKIE);
  if (userToken) {
    const verified = await verifySessionToken(userToken);
    if (verified?.role === 'user') {
      return {
        role: 'user',
        email: verified.email,
        shopId: verified.shopId,
        emailVerified: verified.emailVerified === true,
      };
    }
  }

  const adminToken = getCookie(c, ADMIN_SESSION_COOKIE);
  if (adminToken) {
    const verified = await verifySessionToken(adminToken);
    if (verified?.role === 'admin') {
      return { role: 'admin', email: verified.email };
    }
  }

  return null;
}

export async function requireSession(
  c: Context,
  role: SessionRole,
  options?: { authUsersRepository?: AuthUsersRepository },
): Promise<{ role: SessionRole; email: string; shopId?: string; emailVerified?: boolean } | Response> {
  const session = await readSession(c);
  if (!session || session.role !== role) {
    securityAudit({
      action: 'authz_denied',
      actorType: session?.role ?? 'public',
      actorId: session?.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        requiredRole: role,
        foundRole: session?.role ?? null,
      },
    });
    return c.json({ ok: false, error: 'unauthorized' }, 401);
  }
  if (role === 'admin' && options?.authUsersRepository) {
    const dbUser = await options.authUsersRepository.findByEmail(session.email).catch((err) => {
      logger.warn({ err, adminEmail: session.email }, 'admin_session_revalidation_failed');
      return null;
    });
    if (!dbUser || dbUser.role !== 'admin' || !dbUser.active) {
      securityAudit({
        action: 'authz_denied',
        actorType: 'admin',
        actorId: session.email,
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
        details: {
          reason: 'admin_session_revalidation_failed',
        },
      });
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }
  }
  return session;
}

/** Returns a canonical UUID string or null if the path/query segment is not a valid UUID */
export function parseAdminResourceUuid(raw: string | undefined): string | null {
  const trimmed = raw?.trim() ?? '';
  const parsed = z.string().uuid().safeParse(trimmed);
  return parsed.success ? parsed.data : null;
}

/**
 * Shop id in Postgres is a UUID; in-memory tests use `shop-<uuid>`; fixtures may use short slugs (e.g. demo-shop).
 */
export function parseAdminShopIdParam(raw: string | undefined): string | null {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed || trimmed.length > 80) return null;
  if (z.string().uuid().safeParse(trimmed).success) return trimmed;
  if (trimmed.startsWith('shop-')) {
    const suffix = trimmed.slice(5);
    if (z.string().uuid().safeParse(suffix).success) return trimmed;
    return null;
  }
  if (/^[a-z0-9][a-z0-9-]{0,62}$/i.test(trimmed)) return trimmed;
  return null;
}

export async function enforceRateLimit(
  c: Context,
  policy: (typeof RATE_LIMIT_POLICIES)[keyof typeof RATE_LIMIT_POLICIES],
  identitySuffix: string,
): Promise<Response | null> {
  const ip = getClientIp({
    get: (name: string) => c.req.header(name) ?? null,
  });
  const identity = `${ip}:${identitySuffix}`;
  const result = await consumeRateLimit(policy, identity);
  c.header('X-RateLimit-Limit', String(result.limit));
  c.header('X-RateLimit-Remaining', String(result.remaining));
  c.header('Retry-After', String(result.retryAfterSec));
  if (!result.ok) {
    securityAudit({
      action: 'rate_limit_blocked',
      actorType: 'public',
      ip,
      path: c.req.path,
      details: {
        policy: policy.name,
        retryAfterSec: result.retryAfterSec,
      },
    });
    return c.json(
      {
        ok: false,
        error: 'rate_limited',
        message: rateLimitUserMessage(result.retryAfterSec),
        retryAfterSec: result.retryAfterSec,
      },
      429,
    );
  }
  return null;
}

export async function enforceRateLimitWithIdentity(
  c: Context,
  policy: (typeof RATE_LIMIT_POLICIES)[keyof typeof RATE_LIMIT_POLICIES],
  identity: string,
): Promise<Response | null> {
  const result = await consumeRateLimit(policy, identity);
  c.header('X-RateLimit-Limit', String(result.limit));
  c.header('X-RateLimit-Remaining', String(result.remaining));
  c.header('Retry-After', String(result.retryAfterSec));
  if (!result.ok) {
    securityAudit({
      action: 'rate_limit_blocked',
      actorType: 'public',
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        policy: policy.name,
        identity,
        retryAfterSec: result.retryAfterSec,
      },
    });
    return c.json(
      {
        ok: false,
        error: 'rate_limited',
        message: rateLimitUserMessage(result.retryAfterSec),
        retryAfterSec: result.retryAfterSec,
      },
      429,
    );
  }
  return null;
}

export function enforceSameOriginForCookieMutation(c: Context): Response | null {
  const method = c.req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return null;
  const origin = c.req.header('origin') ?? null;
  const referer = c.req.header('referer') ?? null;
  if (!origin && !referer) {
    securityAudit({
      action: 'csrf_blocked',
      actorType: 'public',
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: { reason: 'missing_origin_or_referer' },
    });
    return c.json({ ok: false, error: 'forbidden' }, 403);
  }
  let requestHost: string;
  try {
    requestHost = new URL(origin || referer || '').host;
  } catch {
    return c.json({ ok: false, error: 'forbidden' }, 403);
  }
  const host = c.req.header('host') ?? requestHost;
  if (requestHost !== host) {
    securityAudit({
      action: 'csrf_blocked',
      actorType: 'public',
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: { origin, referer, host },
    });
    return c.json({ ok: false, error: 'forbidden' }, 403);
  }
  return null;
}

export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function toBrandSlug(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 120);
  return slug || `shop-${randomUUID().slice(0, 8)}`;
}

export function buildDefaultShopNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'new-shop';
  const cleaned = local
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  if (!cleaned) return 'New RingBooker Shop';
  return `${cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase())} Shop`;
}

export function createOAuthFallbackPasswordHash(): string {
  return hashPassword(`${randomUUID()}${randomBytes(24).toString('hex')}`);
}

export function buildGoLivePaymentRequiredMessage(params?: { paddleTrialConfigVerified?: boolean }): string {
  const verified = params?.paddleTrialConfigVerified ?? process.env.PADDLE_TRIAL_CONFIG_VERIFIED === 'true';
  return verified
    ? "Start your 14-day trial. Due today: $0. You won't be charged until your 14-day trial ends. Final total may include applicable taxes based on your location."
    : 'Start your 14-day trial. Due today: $0. Final total may include applicable taxes based on your location. RingBooker will not answer real calls on your business number until billing is confirmed.';
}

export async function sendPasswordResetEmail(params: {
  emailService?: EmailService;
  email: string;
  resetToken: string;
  role: 'user' | 'admin';
  appBaseUrl: string;
}): Promise<void> {
  if (!params.emailService) return;
  const base = params.appBaseUrl.replace(/\/+$/, '');
  const path = params.role === 'admin' ? '/admin/reset-password' : '/user/reset-password';
  const resetUrl = `${base}${path}?token=${encodeURIComponent(params.resetToken)}`;
  try {
    const { input, text } = buildPasswordResetEmailPayload({
      email: params.email,
      resetUrl,
      role: params.role,
    });
    const html = await renderBaseEmailHtml(input);
    await params.emailService.sendEmail({
      to: params.email,
      subject: input.title,
      text,
      html,
      category: 'password_reset',
      idempotencyKey: `password_reset_email:${hashPasswordResetToken(params.resetToken)}`,
      from: emailDefaultFrom(),
      replyTo: emailSupportAddress(),
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        email: params.email,
        role: params.role,
      },
      'password_reset_email_failed',
    );
  }
}

export async function createAndSendEmailVerification(params: {
  authUsersRepository: AuthUsersRepository;
  emailService?: EmailService;
  authUserId: string;
  email: string;
  shopId: string;
  shopName: string;
  appBaseUrl: string;
  idempotencyPrefix: string;
}): Promise<{ rawToken: string }> {
  const token = generateVerificationToken();
  await params.authUsersRepository.createEmailVerificationToken({
    authUserId: params.authUserId,
    tokenHash: token.hashed,
    expiresAt: token.expiresAt,
  });
  await sendVerifyEmail({
    emailService: params.emailService,
    email: params.email,
    shopName: params.shopName,
    shopId: params.shopId,
    authUserId: params.authUserId,
    rawToken: token.raw,
    appBaseUrl: params.appBaseUrl,
    idempotencyKey: `${params.idempotencyPrefix}:${params.authUserId}:${token.hashed}`,
  });
  return { rawToken: token.raw };
}

/**
 * Canonical public origin for redirects and OAuth `redirect_uri`.
 * Prefer validated `APP_BASE_URL`; otherwise derive from `x-forwarded-*` / `host` so HTTPS
 * behind a reverse proxy is not downgraded to `http://` (Square redirect URI must match the dashboard).
 */
export function getAppBaseUrl(_req: { header(name: string): string | undefined }): string {
  const fromEnv = process.env.APP_BASE_URL?.trim() ?? '';
  if (fromEnv) {
    const parsed = new URL(fromEnv);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('APP_BASE_URL must be http or https');
    }
    return fromEnv.replace(/\/+$/, '');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_BASE_URL must be set in production');
  }
  return 'http://localhost:3000';
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/[^\d+]/g, '');
  if (!normalized) return null;
  if (normalized.startsWith('+')) {
    return normalized.length >= 8 && normalized.length <= 16 ? normalized : null;
  }
  if (normalized.length === 10) {
    return `+1${normalized}`;
  }
  if (normalized.length === 11 && normalized.startsWith('1')) {
    return `+${normalized}`;
  }
  return normalized.length >= 8 && normalized.length <= 15 ? `+${normalized}` : null;
}

export function deriveDemoCallStage(call: {
  startedAt?: string;
  endedAt?: string;
  agentJoined: boolean;
  transcriptStatus?: string;
  transcriptText?: string;
}) {
  if (call.transcriptStatus === 'failed') return 'failed';
  if (call.endedAt || call.transcriptStatus === 'completed') return 'completed';
  if (call.agentJoined || (call.transcriptText && call.transcriptText.trim().length > 0)) return 'live';
  if (call.startedAt) return 'dialing';
  return 'queued';
}

export function deriveDemoLiveSignal(call: {
  demoLiveState?: string;
  endedAt?: string;
  transcriptStatus?: string;
  transcriptText?: string;
}) {
  if (call.demoLiveState) return call.demoLiveState;
  if (call.transcriptStatus === 'failed') return 'failed';
  if (call.endedAt || call.transcriptStatus === 'completed') return 'completed';
  if (call.transcriptText && call.transcriptText.trim().length > 0) return 'ai_agent_speaking';
  return 'preparing';
}

export function mapDemoCallRunStatusToStage(status: string): 'queued' | 'dialing' | 'live' | 'completed' | 'failed' {
  if (status === 'completed') return 'completed';
  if (status === 'failed' || status === 'missed') return 'failed';
  if (status === 'live') return 'live';
  if (status === 'dialing') return 'dialing';
  return 'queued';
}

export function mapDispatchStatusToDemoCallStatus(status: 'received' | 'agent_joined' | 'completed' | 'failed') {
  if (status === 'agent_joined') return 'live' as const;
  if (status === 'completed') return 'completed' as const;
  if (status === 'failed') return 'failed' as const;
  return 'queued' as const;
}

export async function verifyGoogleIdToken(idToken: string): Promise<{
  email: string;
  emailVerified: boolean;
  name?: string;
  aud: string;
}> {
  const tokenInfoUrl = new URL('https://oauth2.googleapis.com/tokeninfo');
  tokenInfoUrl.searchParams.set('id_token', idToken);
  const response = await fetch(tokenInfoUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`google_tokeninfo_failed:${response.status}`);
  }
  const body = (await response.json()) as {
    email?: string;
    email_verified?: string;
    name?: string;
    aud?: string;
    exp?: string;
  };
  if (!body.email || !body.aud || !body.exp) {
    throw new Error('google_tokeninfo_invalid_payload');
  }
  const expMillis = Number.parseInt(body.exp, 10) * 1000;
  if (!Number.isFinite(expMillis) || expMillis <= Date.now()) {
    throw new Error('google_tokeninfo_expired');
  }
  return {
    email: body.email.trim().toLowerCase(),
    emailVerified: body.email_verified === 'true',
    name: body.name,
    aud: body.aud,
  };
}

/** Where to send the user after a successful user login or signup (email or Google). */
export function computeUserPostAuthRedirectPath(params: { shop: Shop | null; shopId: string | null | undefined }): string {
  if (!params.shopId || !params.shop) {
    return '/pricing?reason=plan_required';
  }
  if (!isShopSetupWizardComplete(params.shop)) {
    return '/user/onboarding';
  }
  return '/user';
}

export function clearUserGoogleOAuthCookies(c: Context) {
  deleteCookie(c, 'rb_google_oauth_state', { path: '/' });
  deleteCookie(c, 'rb_google_oauth_intent', { path: '/' });
  deleteCookie(c, 'rb_google_oauth_selected_plan', { path: '/' });
}

export function parseCalendarProviderParam(value: string): CalendarProviderParam | null {
  const parsed = calendarProviderParamSchema.safeParse({ provider: value });
  return parsed.success ? parsed.data.provider : null;
}

export function isBookingLinkProviderId(provider: CalendarProviderParam | null): provider is BookingLinkProviderId {
  return Boolean(provider && (BOOKING_LINK_PROVIDER_IDS as readonly string[]).includes(provider));
}

export function normalizeHttpsBookingUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function safeWebhookHeaders(headers: Headers): Record<string, string> {
  const safe: Record<string, string> = {};
  const exact = new Set(['content-type', 'user-agent', 'x-request-id']);
  for (const [rawName, value] of headers.entries()) {
    const name = rawName.toLowerCase();
    if (exact.has(name) || (name.startsWith('x-vagaro-') && !name.includes('signature'))) {
      safe[name] = value;
    }
  }
  return safe;
}

export function getWebhookStringField(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function buildCalendarSettingsRedirect(params: { appBaseUrl: string; result: 'success' | 'error'; provider: string; message?: string }) {
  const url = new URL('/user/integrations', params.appBaseUrl);
  url.searchParams.set('calendar_connect', params.result);
  url.searchParams.set('provider', params.provider);
  if (params.message) url.searchParams.set('calendar_message', params.message);
  return url.toString();
}

export function buildSquareCallbackUrl(appBaseUrl: string): string {
  return `${appBaseUrl.replace(/\/+$/, '')}/api/backend/user/calendar/providers/square_appointments/connect/callback`;
}

export function buildAcuityCallbackUrl(appBaseUrl: string): string {
  return process.env.ACUITY_REDIRECT_URI?.trim() || `${appBaseUrl.replace(/\/+$/, '')}/api/backend/user/calendar/providers/acuity/connect/callback`;
}

export function getAcuityOAuthConfig() {
  const clientId = process.env.ACUITY_CLIENT_ID?.trim();
  const clientSecret = process.env.ACUITY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error('acuity_oauth_not_configured');
  return { clientId, clientSecret };
}

export function extractAcuityUserId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const candidates = [
    record.id,
    record.userID,
    record.userId,
    record.email,
    [record.firstName, record.lastName].filter((value): value is string => typeof value === 'string' && value.trim().length > 0).join(' '),
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);
  }
  return null;
}

export function buildSquareConnectionPayload(current: SquareConnectionCredentials | null, patch: Partial<SquareConnectionCredentials>) {
  return {
    provider: 'square_appointments' as const,
    access_token: patch.access_token ?? current?.access_token,
    refresh_token: patch.refresh_token ?? current?.refresh_token,
    expires_at: patch.expires_at ?? current?.expires_at,
    merchant_id: patch.merchant_id ?? current?.merchant_id,
    location_id: patch.location_id ?? current?.location_id,
    service_variation_id: patch.service_variation_id ?? current?.service_variation_id,
    service_variation_version: patch.service_variation_version ?? current?.service_variation_version,
    team_member_id: patch.team_member_id ?? current?.team_member_id,
  };
}

export function selectSquareLocationId(locations: Array<{ id: string; status?: string }>): string | undefined {
  return locations.find((location) => location.status === 'ACTIVE')?.id ?? locations[0]?.id;
}

export function buildVagaroConnectionPayload(current: Partial<VagaroCredentials> | null, patch: Partial<VagaroCredentials>): VagaroCredentials {
  const region = patch.region ?? current?.region ?? process.env.VAGARO_REGION ?? 'us';
  const businessId = patch.businessId ?? current?.businessId ?? process.env.VAGARO_BUSINESS_ID ?? '';
  return {
    provider: 'vagaro',
    region,
    businessId,
    clientId: patch.clientId ?? current?.clientId,
    clientSecretKey: patch.clientSecretKey ?? current?.clientSecretKey,
    scope: patch.scope ?? current?.scope ?? 'read access',
    accessToken: patch.accessToken ?? current?.accessToken,
    expiresAt: patch.expiresAt ?? current?.expiresAt,
  };
}

export function buildMindbodyConnectionPayload(current: Partial<MindbodyCredentials> | null, patch: Partial<MindbodyCredentials>): MindbodyCredentials {
  const siteId = patch.siteId ?? current?.siteId ?? process.env.MINDBODY_SITE_ID ?? '';
  const apiKey = patch.apiKey ?? current?.apiKey ?? process.env.MINDBODY_API_KEY ?? '';
  return {
    provider: 'mindbody',
    siteId,
    apiKey,
    sourceName: patch.sourceName ?? current?.sourceName ?? process.env.MINDBODY_SOURCE_NAME,
    staffToken: patch.staffToken ?? current?.staffToken ?? process.env.MINDBODY_STAFF_TOKEN,
    locationId: patch.locationId ?? current?.locationId ?? process.env.MINDBODY_LOCATION_ID,
    sessionTypeId: patch.sessionTypeId ?? current?.sessionTypeId ?? process.env.MINDBODY_SESSION_TYPE_ID,
    staffId: patch.staffId ?? current?.staffId ?? process.env.MINDBODY_STAFF_ID,
    bookingUrl: patch.bookingUrl ?? current?.bookingUrl ?? process.env.MINDBODY_BOOKING_URL,
  };
}

export function buildBookingLinkConnectionPayload(provider: BookingLinkProviderId, bookingUrl: string) {
  return JSON.stringify({
    provider,
    type: 'booking_link',
    booking_url: bookingUrl,
  });
}

export function parseBookingLinkConnectionProvider(raw: string | null | undefined): BookingLinkProviderId | null {
  if (!raw) return null;
  const candidates = [raw];
  try {
    candidates.push(Buffer.from(raw, 'base64').toString('utf-8'));
  } catch {
    // ignore invalid base64
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const provider = typeof parsed.provider === 'string' ? parseCalendarProviderParam(parsed.provider) : null;
      return isBookingLinkProviderId(provider) ? provider : null;
    } catch {
      continue;
    }
  }
  return null;
}

/** Cloudflare `CF-IPCountry` or compatible two-letter country code. */
export function normalizeCfIpCountry(header: string | undefined): string | null {
  const raw = header?.trim().toUpperCase();
  if (!raw || raw.length !== 2 || !/^[A-Z]{2}$/.test(raw)) return null;
  if (raw === 'XX' || raw === 'T1') return null;
  return raw;
}

export function demoCallDurationSeconds(row: Pick<DemoAdminCallListRow, 'connectedAt' | 'endedAt' | 'startedAt'>): number | null {
  if (row.connectedAt && row.endedAt) {
    const ms = new Date(row.endedAt).getTime() - new Date(row.connectedAt).getTime();
    if (!Number.isFinite(ms) || ms < 0) return null;
    return Math.round(ms / 1000);
  }
  if (row.startedAt && row.endedAt) {
    const ms = new Date(row.endedAt).getTime() - new Date(row.startedAt).getTime();
    if (!Number.isFinite(ms) || ms < 0) return null;
    return Math.round(ms / 1000);
  }
  return null;
}

export const ADMIN_CALL_LIST_PAGE_SIZE = 20;
export const ADMIN_CALL_CHART_SAMPLE = 8000;
export const ADMIN_DEMO_LIST_PAGE_SIZE = 20;
export const ADMIN_DEMO_CHART_SAMPLE = 8000;
export const ADMIN_WEB_DEMO_MERGE_CAP = 2500;

export async function buildAdminDemoCallsListResult(
  deps: {
    demoSessionsRepository: DemoSessionsRepository;
    callLogsRepository: CallLogsRepository;
  },
  parsed: z.infer<typeof adminDemoCallsListQuerySchema>,
  providerFilter?: { providerEquals?: string; providerNotEquals?: string },
): Promise<{ ok: false; status: 400; error: string } | { ok: true; json: Record<string, unknown> }> {
  const env = getEnv();
  const now = new Date();
  const endDay = parsed.dateTo ?? now.toISOString().slice(0, 10);
  let startDay = parsed.dateFrom ?? null;
  if (!startDay) {
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 30);
    startDay = from.toISOString().slice(0, 10);
  }
  const createdAfter = new Date(`${startDay}T00:00:00.000Z`);
  const createdBefore = new Date(`${endDay}T23:59:59.999Z`);
  if (createdAfter.getTime() > createdBefore.getTime()) {
    return { ok: false, status: 400, error: 'invalid_date_range' };
  }

  const page = parsed.page ?? 1;
  const pageSize = ADMIN_DEMO_LIST_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const rangeArgs = { createdAfter, createdBefore };
  const filterArgs = providerFilter ?? {};
  const [total, pageRows, chartRows] = await Promise.all([
    deps.demoSessionsRepository.countAdminDemoCallRuns({ ...rangeArgs, ...filterArgs }),
    deps.demoSessionsRepository.listAdminDemoCallRuns({
      ...rangeArgs,
      ...filterArgs,
      limit: pageSize,
      offset,
    }),
    deps.demoSessionsRepository.listAdminDemoCallRuns({
      ...rangeArgs,
      ...filterArgs,
      limit: ADMIN_DEMO_CHART_SAMPLE,
      offset: 0,
    }),
  ]);

  const requestIdsPage = pageRows.map((r) => r.requestId);
  const requestIdsChart = chartRows.map((r) => r.requestId);
  const transcriptMeta = await deps.callLogsRepository.listTranscriptMetaByShopAndRequestIds({
    shopId: env.PUBLIC_DEMO_SHOP_ID,
    requestIds: [...new Set([...requestIdsPage, ...requestIdsChart])],
  });

  const enrich = (row: (typeof pageRows)[0]) => {
    const meta = transcriptMeta.get(row.requestId);
    return {
      ...row,
      clientCountry: effectiveDemoClientCountry(row.clientCountry, row.callbackPhone),
      demoDurationSeconds: demoCallDurationSeconds(row),
      transcriptStatus: meta?.transcriptStatus,
      hasTranscriptText: meta?.hasTranscriptText ?? false,
    };
  };

  const calls = pageRows.map(enrich);

  const chartEnriched = chartRows.map(enrich);
  const chartDailyMap = new Map<string, { count: number; demoSeconds: number }>();
  for (const row of chartEnriched) {
    const day = row.runCreatedAt.slice(0, 10);
    const sec = row.demoDurationSeconds ?? 0;
    const prev = chartDailyMap.get(day) ?? { count: 0, demoSeconds: 0 };
    prev.count += 1;
    prev.demoSeconds += sec;
    chartDailyMap.set(day, prev);
  }
  const chartDaily = [...chartDailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, count: v.count, demoSeconds: v.demoSeconds }));

  const summary = {
    total,
    completed: chartEnriched.filter((r) => r.runStatus === 'completed').length,
    missed: chartEnriched.filter((r) => r.runStatus === 'missed' || r.outcome === 'missed').length,
    withTranscript: chartEnriched.filter((r) => r.hasTranscriptText).length,
    summarySampleSize: chartEnriched.length,
    summaryTruncated: total > ADMIN_DEMO_CHART_SAMPLE,
  };

  return {
    ok: true,
    json: {
      ok: true,
      calls,
      chartDaily,
      summary,
      pagination: { page, pageSize, total },
      filter: {
        dateFrom: startDay,
        dateTo: endDay,
      },
    },
  };
}

export function liveKitDemoRunToWebAdminStatus(
  runStatus: DemoCallStatus,
  sessionStatus: DemoSessionStatus,
): WebDemoSessionStatus {
  if (runStatus === 'live' || sessionStatus === 'live') return 'connected';
  if (runStatus === 'completed') return 'completed';
  if (runStatus === 'failed' || runStatus === 'missed') return 'failed';
  return 'started';
}

export function parseAdminUuidParam(raw: string | undefined): string | null {
  const t = raw?.trim() ?? '';
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)
  ) {
    return null;
  }
  return t.toLowerCase();
}

export function formatWebDemoTranscriptForAdmin(transcript: unknown): string | null {
  if (transcript == null) return null;
  if (typeof transcript === 'string') {
    const s = transcript.trim();
    return s.length ? s : null;
  }
  if (!Array.isArray(transcript)) {
    try {
      return JSON.stringify(transcript, null, 2);
    } catch {
      return null;
    }
  }
  const lines: string[] = [];
  for (const item of transcript) {
    if (!item || typeof item !== 'object') continue;
    const role = typeof (item as { role?: unknown }).role === 'string' ? (item as { role: string }).role : 'unknown';
    const content =
      typeof (item as { content?: unknown }).content === 'string'
        ? (item as { content: string }).content
        : typeof (item as { text?: unknown }).text === 'string'
          ? (item as { text: string }).text
          : null;
    if (content?.trim()) lines.push(`${role}: ${content.trim()}`);
  }
  return lines.length ? lines.join('\n\n') : null;
}

export function unifiedWebDemoRowMatchesFilters(
  row: {
    verticalSlug: string;
    adminStatus: WebDemoSessionStatus;
    country: string | null;
    businessName: string | null;
    publicSessionId: string;
    livekitRequestId: string | null;
  },
  filters: {
    vertical?: string;
    status?: WebDemoSessionStatus;
    country?: string;
    search?: string;
  },
): boolean {
  if (filters.vertical && row.verticalSlug !== filters.vertical) return false;
  if (filters.status && row.adminStatus !== filters.status) return false;
  if (filters.country && (row.country ?? '').toUpperCase() !== filters.country.trim().toUpperCase()) return false;
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    const hay = [row.businessName, row.publicSessionId, row.livekitRequestId].filter(Boolean).join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export const adminDashboardChartPeriodSchema = z.enum(['today', 'week', 'month', 'year']);
export const adminDashboardChartMetricSchema = z.enum(['demo-calls', 'leads', 'shops', 'calls', 'web-demos']);

export function buildAdminCallChartDaily(calls: Array<{ startedAt?: string }>): Array<{ day: string; count: number }> {
  const map = new Map<string, number>();
  for (const call of calls) {
    const day = call.startedAt?.slice(0, 10);
    if (!day) continue;
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));
}

/** Settings UI: show dedicated Go Live tab only after wizard completion and before live answering is enabled. */
export async function computeShowGoLiveSettingsTab(params: {
  shop: Shop;
  shopsRepository: ShopsRepository;
  shopAccessStatesRepository?: ShopAccessStatesRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  testCallAttemptsRepository?: TestCallAttemptsRepository;
}): Promise<boolean> {
  if (!isShopSetupWizardComplete(params.shop)) return false;
  if (
    !params.shopAccessStatesRepository ||
    !params.billingSubscriptionsRepository ||
    !params.testCallAttemptsRepository
  ) {
    return false;
  }
  const access = await getShopBillingAccess(
    {
      shopsRepository: params.shopsRepository,
      billingSubscriptionsRepository: params.billingSubscriptionsRepository,
      shopAccessStatesRepository: params.shopAccessStatesRepository,
      testCallAttemptsRepository: params.testCallAttemptsRepository,
    },
    { shopId: params.shop.id },
  );
  return !access.liveCallsEnabled;
}

// ---------------------------------------------------------------------------
// Admin billing — Paddle gross collected revenue cache
// ---------------------------------------------------------------------------

/** Simple in-process cache so we don't hammer the Paddle API on every admin page load. */
export let _paddleGrossCache: { value: number; fetchedAt: number } | null = null;
export const PADDLE_GROSS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches ALL completed Paddle transactions (paginated) and sums their
 * grand_total (in USD).  Results are cached in-process for 5 minutes.
 * Returns null when Paddle is not configured or the fetch fails.
 */
export async function fetchPaddleGrossCollected(): Promise<{ value: number; cachedAt: string } | null> {
  if (_paddleGrossCache && Date.now() - _paddleGrossCache.fetchedAt < PADDLE_GROSS_CACHE_TTL_MS) {
    return { value: _paddleGrossCache.value, cachedAt: new Date(_paddleGrossCache.fetchedAt).toISOString() };
  }
  const env = getEnv();
  const apiKey = env.PADDLE_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (env.PADDLE_ENV ?? env.PADDLE_ENVIRONMENT) === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';

  let totalCents = 0;
  let after: string | null = null;
  let pages = 0;
  const MAX_PAGES = 40; // cap at 2 000 transactions (40 × 50)

  try {
    do {
      const url = new URL(`${baseUrl}/transactions`);
      url.searchParams.set('status', 'completed');
      url.searchParams.set('per_page', '50');
      if (after) url.searchParams.set('after', after);

      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) break;

      const json = (await response.json()) as {
        data?: unknown[];
        meta?: { pagination?: { has_more?: boolean; next?: string | null }; has_more?: boolean };
      };

      for (const tx of Array.isArray(json.data) ? json.data : []) {
        if (!tx || typeof tx !== 'object') continue;
        const t = tx as Record<string, unknown>;
        // Paddle stores amounts as cent-string in details.adjusted_totals or details.totals
        const details = (t.details && typeof t.details === 'object') ? t.details as Record<string, unknown> : {};
        const adj = (details.adjusted_totals && typeof details.adjusted_totals === 'object')
          ? details.adjusted_totals as Record<string, unknown> : {};
        const tot = (details.totals && typeof details.totals === 'object')
          ? details.totals as Record<string, unknown> : {};
        const outerTot = (t.totals && typeof t.totals === 'object') ? t.totals as Record<string, unknown> : {};
        const raw = adj.grand_total ?? adj.total ?? tot.grand_total ?? tot.total ?? outerTot.grand_total ?? outerTot.total ?? 0;
        const cents = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : 0;
        if (Number.isFinite(cents) && cents > 0) totalCents += cents;
      }

      const pagination = json.meta?.pagination;
      const hasMore = pagination?.has_more ?? json.meta?.has_more ?? false;
      after = hasMore ? (pagination?.next ?? null) : null;
      pages++;
    } while (after && pages < MAX_PAGES);
  } catch {
    // Network/timeout — return cached value if available, otherwise null
    if (_paddleGrossCache) {
      return { value: _paddleGrossCache.value, cachedAt: new Date(_paddleGrossCache.fetchedAt).toISOString() };
    }
    return null;
  }

  const value = Number((totalCents / 100).toFixed(2));
  _paddleGrossCache = { value, fetchedAt: Date.now() };
  return { value, cachedAt: new Date(_paddleGrossCache.fetchedAt).toISOString() };
}

// Re-export imported names for route modules
export { consumeRateLimit, getClientIp, rateLimitUserMessage, RATE_LIMIT_POLICIES } from '@/src/backend/security/rate-limit';
export { securityAudit } from '@/src/backend/security/audit-log';
export { handleRealtimeDispatch, parseRealtimeDispatchInput } from '@/src/agent/realtime/dispatch-handler';
export { createInboundAgentSession } from '@/src/agent/runtime/session';
export type { JobType } from '@/src/backend/domain/types';
export { renderBaseEmailHtml } from '@/src/backend/services/email/base-email-mjml';
export { resolveEmailProviderMode } from '@/src/backend/services/email/startup';
export { verifyTurnstileToken } from '@/src/backend/security/turnstile';
export { contactSalesEmail, emailDefaultFrom, emailFounderFrom, emailReplyTo, emailSupportAddress } from '@/src/backend/services/email/config';
export { buildDemoRequestCustomerEmailPayload } from '@/src/backend/services/email/base-email-builders';
export type { EmailService } from '@/src/backend/services/email/types';
export type { BlogPostsRepository, ContactRequestsRepository } from '@/src/backend/ports/repositories';
export { getMetricsSnapshot } from '@/src/backend/observability/metrics';
export { collectEmailLifecycleDiagnostics } from '@/src/backend/services/email/diagnostics';
export { buildAdminShopStatus } from '@/src/backend/services/admin/admin-shop-status';
export { buildAdminTrialEndingSoonWatchlist } from '@/src/backend/services/admin/admin-dashboard-trial-watchlist';
export { getShopUsageForPeriod } from '@/src/backend/services/usage/shop-usage';
export { getBillingPeriodForShop } from '@/src/backend/services/usage/period';
export { getEnv } from '@/src/backend/config/env';
export { effectiveDemoClientCountry } from '@/src/backend/lib/demo-client-country';
export { hashPassword } from '@/src/backend/security/password';
