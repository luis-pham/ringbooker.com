import { Hono } from 'hono';
import type { Context } from 'hono';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

import type { RealtimeAgentRuntime } from '@/src/agent/realtime/types';
import { handleRealtimeDispatch, parseRealtimeDispatchInput } from '@/src/agent/realtime/dispatch-handler';
import { dispatchRealtimeSession } from '@/src/agent/realtime/dispatch-session';
import { createInboundAgentSession } from '@/src/agent/runtime/session';
import { openAiRealtimeVoiceForDemoVerticalSlug } from '@/src/agent/prompts';
import { buildPublicDemoScriptedWelcomeLine, buildPublicDemoSystemPrompt } from '@/src/backend/demo/public-demo-system-prompt';
import { buildDirectWebDemoClientSecretAudioInput } from '@/src/backend/webhooks/openai-sip-accept-payload';
import {
  clearDirectDemoActiveSlot,
  consumePublicDemoRealtimeLimits,
  directDemoActiveTtlMs,
  enforcePublicDemoRealtimeOrigin,
  jsonPublicDemoRealtimeBlocked,
  runDirectDemoSerialized,
  tryOccupyDirectDemoActiveSlot,
  releaseDirectDemoActiveSlot,
} from '@/src/backend/demo/public-demo-realtime-guard';
import { effectiveDemoClientCountry, resolveDemoClientCountryForPersistence } from '@/src/backend/lib/demo-client-country';
import { parseDemoUserAgentHints } from '@/src/backend/lib/demo-user-agent-hints';
import {
  CAPABILITY_MIN_PLAN,
  CAPABILITY_LABELS,
  getShopPlanCapabilities,
  type ShopSettingCapability,
} from '@/src/backend/domain/shop-plan-capabilities';
import { createShopWithPlaceholderPhoneRetry } from '@/src/backend/domain/signup-placeholder-phone';
import { normalizePhoneForStorage } from '@/lib/phone-number';
import { isCommercialGoLiveApprovalRequired } from '@/src/backend/domain/commercial-approval';
import { canProceedToGoLive, evaluateKnowledgeGate } from '@/src/backend/domain/go-live-gate';
import { mergeImportedServicesIntoCatalog } from '@/src/backend/domain/service-catalog';
import { importWebsiteForOnboarding } from '@/src/backend/services/website-import/importer';
import { importWebsiteWithCache } from '@/src/backend/services/website-import/cache';
import { buildApplyPatchForSuggestions, pendingSuggestionsFromImport, secondarySummary, validateSuggestionPayload } from '@/src/backend/domain/business-knowledge-suggestions';
import { isShopSetupWizardComplete } from '@/src/backend/domain/shop-onboarding';
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
  ShopServiceCatalog,
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
  ShopsRepository,
  AuthUsersRepository,
  ContactRequestsRepository,
  DemoSessionsRepository,
  HandoffSessionsRepository,
  ShopAccessStatesRepository,
  ShopLocationsRepository,
  ShopRoutingRulesRepository,
  ShopActiveCallSessionsRepository,
  TestCallAttemptsRepository,
  ForwardingTestSessionsRepository,
  VoiceCallLegsRepository,
  CustomersRepository,
} from '@/src/backend/ports/repositories';
import type { WebDemoSessionAdminRecord, WebDemoSessionStatus, WebDemoSessionsRepository } from '@/src/backend/ports/web-demo-sessions';
import type { BillingProviderAdapter } from '@/src/backend/services/billing/types';
import { createNoCardTrialForShop } from '@/src/backend/services/billing/no-card-trial';
import { buildAdminShopStatus } from '@/src/backend/services/admin/admin-shop-status';
import { getShopBillingAccess, isBillingTrialStillValid, type BillingBlockReason, type ShopBillingAccess } from '@/src/backend/services/billing/access';
import { resolveGoLiveDashboardPrimaryCta } from '@/src/backend/services/billing/go-live-dashboard';
import { normalizeInboundE164 } from '@/src/backend/services/calls/shop-resolver';
import { formatPlanPrice, getPlanCatalogEntry, isSelfServeTrialPlan } from '@/src/backend/domain/plan-catalog';
import { getShopUsageForPeriod } from '@/src/backend/services/usage/shop-usage';
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
import type { EmailService } from '@/src/backend/services/email/types';
import {
  buildDemoRequestCustomerEmailPayload,
  buildPasswordResetEmailPayload,
  buildWelcomeSignupEmailPayload,
} from '@/src/backend/services/email/base-email-builders';
import { renderBaseEmailHtml } from '@/src/backend/services/email/base-email-mjml';
import {
  contactSalesEmail,
  emailDefaultFrom,
  emailFounderFrom,
  emailReplyTo,
  emailSupportAddress,
} from '@/src/backend/services/email/config';
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
import { handleVagaroWebhook } from '@/src/backend/webhooks/vagaro';
import {
  encodeSquareConnectionCredentials,
  parseSquareConnectionCredentials,
  squareAuthorizeUrl,
  squareExchangeAuthorizationCode,
  squareFetchConnectionOptions,
  type SquareConnectionCredentials,
} from '@/src/backend/services/calendar/provider-connections';
import {
  encodeVagaroCredentials,
  generateVagaroAccessToken,
  parseVagaroCredentials,
  VagaroProvider,
  type VagaroCredentials,
} from '@/src/backend/services/calendar/vagaro';
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

const jobTypeSchema = z.enum([
  'realtime_session_dispatch',
  'appointment_reminder_24h',
  'appointment_reminder_2h',
  'missed_call_followup_sms',
  'callback_outbound_call',
  'review_request_sms',
  'post_call_summary',
  'lifecycle_email',
  'trial_reminder_email',
  'trial_expiry_check',
]);

const enqueueJobSchema = z.object({
  shopId: z.string().min(1),
  type: jobTypeSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
  runAtIso: z.string().datetime().optional(),
  idempotencyKey: z.string().min(1).optional(),
});

const simulateInboundSchema = z.object({
  destinationPhone: z.string().min(1),
  callerPhone: z.string().min(1),
  tool: z.enum([
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

const startInboundSchema = z.object({
  destinationPhone: z.string().min(1),
  callerPhone: z.string().min(1),
  requestId: z.string().min(1).optional(),
  roomName: z.string().min(1).optional(),
});

// Structured service item for demo prompt building — server-side only
const demoServiceItemSchema = z.object({
  category: z.string().max(60),
  name: z.string().max(100),
  price: z.number().min(0).max(100000).nullable().optional(),
  duration: z.string().max(60).nullable().optional(),
  enabled: z.boolean().optional(),
});

const publicDemoRequestSchema = z.object({
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
      city: z.string().max(120).optional(),
      primaryHours: z.string().max(200).optional(),
      secondaryHours: z.string().max(200).optional(),
      staffNames: z.array(z.string().max(80)).max(8).optional(),
      services: z.array(demoServiceItemSchema).max(60).optional(),
    })
    .optional(),
  captchaToken: z.string().min(1),
  sessionId: z.string().min(8).max(120),
  website: z.string().max(120).optional(),
});

/** Same fields as `publicDemoRequestSchema` except visitor phone (web demo uses browser audio only). */
const publicDemoWebSessionSchema = publicDemoRequestSchema.omit({ phoneNumber: true });

/** E.164 placeholder stored on demo sessions for web-only demos — outbound dial to visitor is never performed. */
const PUBLIC_DEMO_WEB_SESSION_CALLBACK_PHONE_E164 = '+15555550100';

type OpenAiRealtimeClientSecretResponse = {
  value?: string;
  expires_at?: number;
  client_secret?: {
    value?: string;
    expires_at?: number;
  };
};

function directOpenAiRealtimeModel() {
  return process.env.OPENAI_REALTIME_MODEL?.trim() || 'gpt-realtime';
}

async function createOpenAiRealtimeClientSecret(params: {
  model: string;
  voice: string;
  instructions: string;
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

  const { turnDetectionForSecret, turnDetectionAfterWelcome } = buildDirectWebDemoClientSecretAudioInput();

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
            transcription: { model: 'gpt-4o-mini-transcribe' },
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


const contactIntentValues = ['demo', 'enterprise', 'sales', 'support', 'general'] as const;
const contactPlanInterestValues = ['starter', 'professional', 'enterprise', 'unknown'] as const;

function normalizeEnumValue<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return allowed.includes(normalized) ? normalized : fallback;
}

function nullableTrimmedString(max: number) {
  return z.preprocess((value) => {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
  }, z.string().max(max).nullable());
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '"') return '&quot;';
    return '&#39;';
  });
}

const publicContactRequestSchema = z.object({
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

const dispatchStatusSchema = z.object({
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

const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional(),
});

const signupPhoneSearchSchema = z.object({
  countryCode: z.string().min(2).max(2).default('US'),
  locality: z.string().min(1).max(80).optional(),
  administrativeArea: z.string().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
});

const userSignupSchema = z.object({
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

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(8).max(128),
});

const testCallForwardingSchema = z.object({});

const userSettingsBaseSchema = z.object({
  name: z.string().min(1).optional(),
  phone_number: z.string().min(1).optional(),
  vertical: z.enum(['nail_salon', 'hair_salon', 'day_spa', 'med_spa', 'beauty_clinic']).optional(),
  vertical_detail: z.string().min(1).max(120).nullable().optional(),
  user_name: z.string().min(1).optional(),
  user_phone: z.string().min(1).optional(),
  backup_phone: z.string().min(1).nullable().optional(),
  address: z.string().min(1).nullable().optional(),
  timezone: z.string().min(1).optional(),
  cancel_policy: z.string().min(1).optional(),
  promotions: z.string().min(1).nullable().optional(),
  booking_url: z.string().url().nullable().optional(),
  website_url: z.string().url().optional().or(z.literal('')),
  languages: z.array(z.string()).optional(),
  not_offered_services: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
  current_onboarding_step: z.coerce.number().int().min(1).max(4).optional(),
  setup_method: z.enum(['forward', 'new_number']).optional(),
  forwarding_type: z.enum(['no_answer', 'all', 'busy', 'unreachable']).optional(),
  forwarding_carrier: z.string().optional(),
  forwarding_country: z.string().optional(),
  sms_owner_opted_in: z.boolean().optional(),
});

const serviceItemSchema = z.object({
  name: z.string().min(1).max(120),
  duration_min: z.coerce.number().int().min(1).max(600),
  price: z.coerce.number().min(0).max(10000),
});

const serviceCategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  active: z.boolean().optional(),
});

const serviceVariantSchema = z.object({
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

const shopServiceSchema = z.object({
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

const serviceCatalogSchema = z.object({
  categories: z.array(serviceCategorySchema).max(100),
  services: z.array(shopServiceSchema).max(500),
});

const staffMemberSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120).nullable().optional(),
  specialties: z.array(z.string().trim().min(1).max(80)).max(12).optional().default([]),
  notes: z.string().trim().max(500).nullable().optional(),
  active: z.boolean().optional().default(true),
});

const businessFaqItemSchema = z.object({
  question: z.string().trim().min(1).max(200),
  answer: z.string().trim().min(1).max(1000),
});

const businessHoursEntrySchema = z.union([
  z.object({
    closed: z.literal(true),
  }),
  z.object({
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
  }),
]);

const userSettingsUpdateSchema = userSettingsBaseSchema.extend({
  services: z.array(serviceItemSchema).optional(),
  service_catalog: serviceCatalogSchema.optional(),
  staff: z.array(staffMemberSchema).max(50).optional(),
  faqs: z.array(businessFaqItemSchema).max(100).optional(),
  hours: z.record(z.string(), businessHoursEntrySchema).optional(),
  ai_voice: z.string().min(1).max(80).nullable().optional(),
  ai_welcome_message: z.string().min(1).max(240).nullable().optional(),
  ai_custom_instructions: z.string().min(1).max(2000).nullable().optional(),
  allow_transfers: z.boolean().optional(),
  allow_callbacks: z.boolean().optional(),
  send_reminder_sms: z.boolean().optional(),
  send_review_request_sms: z.boolean().optional(),
  send_missed_call_followup_sms: z.boolean().optional(),
});

const suggestionIdListSchema = z.object({
  suggestionIds: z.array(z.string().uuid()).min(1).max(100),
}).strict();

const applyBusinessKnowledgeSuggestionsSchema = z.object({
  suggestionIds: z.array(z.string().uuid()).min(1).max(100),
  editedPayloads: z.record(z.string().uuid(), z.unknown()).optional(),
}).strict();

const userPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

const adminShopSettingsUpdateSchema = userSettingsBaseSchema.extend({
  services: z.array(serviceItemSchema).optional(),
  staff: z.array(staffMemberSchema).max(50).optional(),
  faqs: z.array(businessFaqItemSchema).max(100).optional(),
  hours: z.record(z.string(), businessHoursEntrySchema).optional(),
});

const adminShopDynamicConfigSchema = z.object({
  ai_voice: z.string().min(1).max(80).nullable().optional(),
  ai_welcome_message: z.string().min(1).max(240).nullable().optional(),
  ai_custom_instructions: z.string().min(1).max(2000).nullable().optional(),
  allow_transfers: z.boolean().optional(),
  allow_callbacks: z.boolean().optional(),
  send_reminder_sms: z.boolean().optional(),
  send_review_request_sms: z.boolean().optional(),
  send_missed_call_followup_sms: z.boolean().optional(),
});

const adminCreateShopSchema = z.object({
  name: z.string().min(1),
  brand_slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/).optional(),
  phone_number: z.string().min(6),
  user_phone: z.string().min(6),
  user_name: z.string().min(1).nullable().optional(),
  timezone: z.string().min(1),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  active: z.boolean().optional(),
});

const adminUpdatePlanSchema = z.object({
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  active: z.boolean().optional(),
});

const adminCommercialGoLiveApprovalSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

const jsonRecordSchema = z.record(z.string(), z.unknown());

const adminShopLocationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().max(500).nullable().optional(),
  timezone: z.string().trim().min(1).max(80).default('America/Los_Angeles'),
  phoneNumber: z.string().trim().max(32).nullable().optional(),
  telnyxNumber: z.string().trim().max(32).nullable().optional(),
  businessHours: jsonRecordSchema.optional().default({}),
  active: z.boolean().optional().default(true),
});

const adminShopRoutingRuleSchema = z.object({
  locationId: z.string().uuid().nullable().optional(),
  ruleType: z.string().trim().min(1).max(80),
  conditionJson: jsonRecordSchema.optional().default({}),
  actionJson: jsonRecordSchema.optional().default({}),
  priority: z.coerce.number().int().min(0).max(10000).optional().default(100),
  active: z.boolean().optional().default(true),
});

const adminCommercialAccountSchema = z.object({
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

const adminInviteSchema = z.object({
  email: z.string().email(),
  shopId: z.string().uuid().optional(),
});

const adminUserPatchSchema = z
  .object({
    role: z.enum(['user', 'admin']).optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => data.role !== undefined || data.active !== undefined, {
    message: 'empty_patch',
  });

const adminUserSetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(128),
});

const userBillingCheckoutSchema = z.object({
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  billing_interval: z.enum(['monthly', 'annual']).optional(),
}).strict();

const userBillingManageSchema = z.object({}).strict();

const userBillingUpgradeSchema = z.object({
  target_plan: z.literal('professional'),
  billing_interval: z.enum(['monthly', 'annual']).optional(),
}).strict();

const importWebsiteSchema = z.object({
  url: z.string().trim().min(1).max(2048),
}).strict();

const readWebsiteSchema = z.object({
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
const provisionForwardingNumberSchema = z.object({
  confirmGoLiveIntent: z.literal(true),
});

const confirmForwardingSetupSchema = z.object({
  confirmForwardingReady: z.literal(true),
});

const markForwardingConfiguredSchema = z.object({
  carrier: z.string().trim().min(1).max(80),
  country: z.string().trim().min(2).max(8).optional(),
  forwardingType: z.enum(['no_answer', 'all', 'busy', 'unreachable']).default('no_answer'),
});

const forwardingCodeQuerySchema = z.object({
  carrier: z.string().trim().min(1).max(80),
  country: z.string().trim().min(2).max(8).optional(),
  forwardingType: z.enum(['no_answer', 'all', 'busy', 'unreachable']).optional(),
});

function telnyxCountryCodeFromForwardingCountry(value: string | null | undefined): string {
  const v = (value ?? 'us').trim().toLowerCase();
  if (v === 'ca' || v === 'can') return 'CA';
  return 'US';
}

function normalizeForwardingNumberForCode(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/[\s().-]/g, '');
}

function billingStatusForGoLive(subscription: BillingSubscription | null): 'none' | 'trial' | 'active' | 'cancelled' | 'past_due' {
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

function provisionStatusForGoLive(shop: Shop): 'none' | 'provisioning' | 'ready' | 'failed' {
  if (shop.telnyx_number?.trim()) return 'ready';
  if (shop.forwarding_number_status === 'provisioning') return 'provisioning';
  if (shop.forwarding_number_status === 'failed') return 'failed';
  return 'none';
}

function forwardingStatusForGoLive(params: {
  shop: Shop;
  forwardingSetupVerified: boolean;
}): 'none' | 'configured' | 'verified' {
  if (params.forwardingSetupVerified) return 'verified';
  if (params.shop.forwarding_carrier?.trim()) return 'configured';
  return 'none';
}

const calendarProviderParamSchema = z.object({
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
type CalendarProviderParam = z.infer<typeof calendarProviderParamSchema>['provider'];
type BookingLinkProviderId =
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

const BOOKING_LINK_PROVIDER_IDS = [
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

const integrationsPreferencesSchema = z.object({
  bookingMethod: z.enum(['app', 'direct', 'later']).nullable().optional(),
  selectedIntegration: calendarProviderParamSchema.shape.provider.nullable().optional(),
});

const squareConfigureSchema = z.object({
  locationId: z.string().min(1),
  serviceVariationId: z.string().min(1),
  teamMemberId: z.string().min(1).optional(),
});

const vagaroConnectSchema = z.object({
  clientId: z.string().min(1),
  clientSecretKey: z.string().min(1),
  region: z.string().min(1).default('us'),
  businessId: z.string().min(1, 'Business ID is required for Vagaro integration'),
  scope: z.string().min(1).optional(),
  bookingUrl: z.string().optional(),
});

const vagaroConfigureSchema = z.object({
  clientId: z.string().min(1).optional(),
  clientSecretKey: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  businessId: z.string().min(1, 'Business ID is required for Vagaro integration').optional(),
  scope: z.string().min(1).optional(),
});

const bookingLinkConnectSchema = z.object({
  bookingUrl: z.string().min(1),
});

const vagaroBookingUrlSchema = z.object({
  bookingUrl: z.string().min(1),
});

const mindbodyConnectSchema = z.object({
  siteId: z.string().min(1, 'Mindbody Site ID is required'),
  apiKey: z.string().min(1, 'Mindbody API key is required'),
  sourceName: z.string().min(1).optional(),
  staffToken: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
  sessionTypeId: z.string().min(1).optional(),
  staffId: z.string().min(1).optional(),
  bookingUrl: z.string().optional(),
});

const acuityConnectSchema = z.object({
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

const blogPostStatusSchema = z.enum(['draft', 'published', 'archived']);

const blogPostListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  query: z.string().max(120).optional(),
  status: z.union([blogPostStatusSchema, z.literal('all')]).optional(),
});

const contactRequestStatusSchema = z.enum(['new', 'contacted', 'qualified', 'closed', 'spam']);
const contactRequestIntentSchema = z.enum(contactIntentValues);

const adminLeadsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  status: z.union([contactRequestStatusSchema, z.literal('all')]).optional(),
  intent: z.union([contactRequestIntentSchema, z.literal('all')]).optional(),
  query: z.string().max(120).optional(),
});

const adminDemoCallsListQuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
});

const webDemoAdminStatusSchema = z.enum(['started', 'connected', 'completed', 'failed', 'timed_out', 'rate_limited']);

const adminWebDemosListQuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  vertical: z.preprocess((v) => (v === '' || v == null ? undefined : String(v)), z.string().max(120).optional()),
  status: webDemoAdminStatusSchema.optional(),
  country: z.preprocess((v) => (v === '' || v == null ? undefined : String(v)), z.string().max(8).optional()),
  search: z.preprocess((v) => (v === '' || v == null ? undefined : String(v)), z.string().max(200).optional()),
});

const adminCallsListQuerySchema = z.object({
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

const adminShopCallsQuerySchema = z.object({
  callsPage: z.coerce.number().int().min(1).max(10_000).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const USER_CALLS_PAGE_SIZE = 25;
const userCallsTabSchema = z.enum(['all', 'follow_up', 'follow_up_needed', 'high_urgency', 'missed']);
const userCallsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  tab: userCallsTabSchema.optional(),
  filter: userCallsTabSchema.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const USER_BOOKINGS_PAGE_SIZE = 25;
const userBookingsTabSchema = z.enum(['all', 'awaiting_action', 'contacted', 'confirmed', 'declined', 'rescheduled', 'cancelled', 'completed']);
const userBookingsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  tab: userBookingsTabSchema.optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  callId: z.preprocess((v) => (v === '' || v == null ? undefined : String(v)), z.string().max(160).optional()),
});
const userBookingStatusPatchSchema = z.object({
  status: z.enum(['captured', 'link_sent', 'contacted', 'confirmed', 'reminder_sent', 'cancel_link_sent', 'declined', 'cancelled', 'rescheduled', 'completed']),
});

const adminShopAnalyticsQuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const adminLeadStatusUpdateSchema = z.object({
  status: contactRequestStatusSchema,
  notes: z.string().max(2000).nullable().optional(),
});


function buildUserCallFilters(parsed: z.infer<typeof userCallsListQuerySchema>) {
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

function buildUserBookingFilters(parsed: z.infer<typeof userBookingsListQuerySchema>) {
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
    case 'cancelled':
      return { ...base, statuses: ['cancelled', 'cancel_link_sent'] };
    case 'completed':
      return { ...base, statuses: ['completed'] };
    default:
      return base;
  }
}

function normalizeUserBookingStatus(status: string, reminder24hSent?: boolean, reminder2hSent?: boolean): string {
  if (status === 'pending') return 'captured';
  if (status === 'no_show') return 'cancelled';
  if (status === 'confirmed' && (reminder24hSent || reminder2hSent)) return 'reminder_sent';
  return status;
}

function appointmentDateParts(datetimeUtc?: string | null, timezone = 'UTC'): { appointmentDate?: string; appointmentTime?: string } {
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

function smsTypeFromCategory(category: string):
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

function toUserBookingResponse(booking: BookingRecord, smsLog: OutboundMessageRecord[] = []) {
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

function userBookingStatsStatuses(kind: 'awaitingAction' | 'contacted' | 'confirmed' | 'declined' | 'cancelled' | 'completed'): string[] {
  if (kind === 'awaitingAction') return ['captured', 'link_sent'];
  if (kind === 'contacted') return ['contacted'];
  if (kind === 'confirmed') return ['confirmed', 'reminder_sent'];
  if (kind === 'declined') return ['declined'];
  if (kind === 'cancelled') return ['cancelled', 'cancel_link_sent'];
  return ['completed'];
}

type UserCallStatus = 'in_progress' | 'completed' | 'missed' | 'voicemail';
type UserCallOutcome =
  | 'booking_captured'
  | 'pricing_inquiry'
  | 'hours_inquiry'
  | 'general_inquiry'
  | 'follow_up_needed'
  | 'cancelled_request'
  | 'reschedule_request'
  | 'complaint'
  | 'wrong_number'
  | 'no_outcome';

function deriveUserCallStatus(call: CallLogListItem, now = new Date()): UserCallStatus {
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

function deriveUserCallOutcome(call: CallLogListItem): UserCallOutcome {
  const question = `${call.summaryCallerQuestion ?? ''} ${call.summaryServiceRequest ?? ''} ${call.transcriptText ?? ''}`.toLowerCase();
  if (call.isCapturedCaller || call.summaryNextAction === 'booking_created' || call.summaryNextAction === 'booking_link_sent' || call.outcome === 'booked') {
    return 'booking_captured';
  }
  if (call.summaryFollowUpRequired || call.summaryNextAction === 'callback_scheduled' || call.outcome === 'error') return 'follow_up_needed';
  if (call.summaryNextAction === 'cancellation_requested') return 'cancelled_request';
  if (call.summaryNextAction === 'reschedule_requested') return 'reschedule_request';
  if (call.summaryNextAction === 'escalated') return 'complaint';
  if (question.includes('price') || question.includes('pricing') || question.includes('cost') || question.includes('how much')) return 'pricing_inquiry';
  if (question.includes('hour') || question.includes('open') || question.includes('close')) return 'hours_inquiry';
  if (call.transcriptText?.trim() || call.summaryCallerQuestion || call.summaryServiceRequest) return 'general_inquiry';
  return 'no_outcome';
}

function buildUserCallSummary(call: CallLogListItem): string | undefined {
  const parts = [
    call.summaryServiceRequest ? `Service: ${call.summaryServiceRequest}` : null,
    call.summaryCallerQuestion ? `Question: ${call.summaryCallerQuestion}` : null,
    call.summaryPreferredDatetime ? `Preferred time: ${call.summaryPreferredDatetime}` : null,
    call.summaryPreferredTech ? `Provider: ${call.summaryPreferredTech}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join('\n') : undefined;
}

function toUserCallResponse(call: CallLogListItem, extras: { missedFollowupSmsSent?: boolean } = {}) {
  const status = deriveUserCallStatus(call);
  const outcome = deriveUserCallOutcome(call);
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
    bookingCaptured: outcome === 'booking_captured',
    bookingRequestId: undefined,
    transcriptAvailable: call.transcriptStatus === 'completed' && Boolean(call.transcriptText?.trim()),
    transcriptUrl: undefined,
    recordingUrl: undefined,
    summary: buildUserCallSummary(call),
    transcriptText: call.transcriptText,
    followUpNeeded: Boolean(call.summaryFollowUpRequired) || outcome === 'follow_up_needed',
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

type SessionRole = 'user' | 'admin';

const USER_SETTING_FIELD_CAPABILITIES: Record<string, ShopSettingCapability> = {
  name: 'edit_business_profile',
  phone_number: 'edit_business_profile',
  vertical: 'edit_business_profile',
  vertical_detail: 'edit_business_profile',
  user_name: 'edit_business_profile',
  user_phone: 'edit_business_profile',
  backup_phone: 'edit_business_profile',
  address: 'edit_business_profile',
  timezone: 'edit_business_profile',
  booking_url: 'edit_booking_url',
  website_url: 'edit_business_profile',
  languages: 'edit_business_profile',
  current_onboarding_step: 'edit_business_profile',
  setup_method: 'edit_business_profile',
  forwarding_type: 'edit_business_profile',
  forwarding_carrier: 'edit_business_profile',
  forwarding_country: 'edit_business_profile',
  sms_owner_opted_in: 'edit_business_profile',
  cancel_policy: 'edit_cancel_policy',
  promotions: 'edit_promotions',
  services: 'edit_services',
  not_offered_services: 'edit_services',
  service_catalog: 'edit_services',
  staff: 'edit_services',
  faqs: 'edit_business_profile',
  hours: 'edit_hours',
  allow_transfers: 'edit_transfer_settings',
  allow_callbacks: 'edit_callback_settings',
  send_missed_call_followup_sms: 'edit_missed_call_followup_sms',
  ai_voice: 'edit_ai_voice',
  ai_welcome_message: 'edit_ai_greeting',
  send_reminder_sms: 'edit_reminder_sms',
  send_review_request_sms: 'edit_review_request_sms',
  ai_custom_instructions: 'edit_ai_custom_instructions',
};

function splitUserSettingsPatchByPlan(
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
      | 'backup_phone'
      | 'address'
      | 'timezone'
      | 'services'
      | 'not_offered_services'
      | 'staff'
      | 'faqs'
      | 'hours'
      | 'cancel_policy'
        | 'promotions'
        | 'booking_url'
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
      | 'allow_callbacks'
      | 'send_reminder_sms'
      | 'send_review_request_sms'
      | 'send_missed_call_followup_sms'
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
      key === 'allow_callbacks' ||
      key === 'send_reminder_sms' ||
      key === 'send_review_request_sms' ||
      key === 'send_missed_call_followup_sms'
    ) {
      dynamicPatch[key] = value;
      continue;
    }

    if ((key === 'phone_number' || key === 'user_phone' || key === 'backup_phone') && typeof value === 'string') {
      basicPatch[key] = normalizePhoneForStorage(value, typeof patch.address === 'string' ? patch.address : typeof shop.address === 'string' ? shop.address : undefined) ?? value;
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
        | 'backup_phone'
        | 'address'
        | 'timezone'
        | 'services'
      | 'not_offered_services'
        | 'staff'
        | 'faqs'
        | 'hours'
        | 'cancel_policy'
        | 'promotions'
        | 'booking_url'
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
        | 'allow_callbacks'
        | 'send_reminder_sms'
        | 'send_review_request_sms'
        | 'send_missed_call_followup_sms'
      >]?: Shop[K];
    },
    disallowedFields,
  };
}

function normalizeServiceCatalogForShop(
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

function userSettingsDuplicateConflict(message: string): { error: string; fields: string[] } | null {
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

function toUserFacingServiceCatalog(catalog?: ShopServiceCatalog | null): ShopServiceCatalog | null {
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

function toUserFacingShop(shop: Shop): Shop {
  return {
    ...shop,
    service_catalog: toUserFacingServiceCatalog(shop.service_catalog) ?? undefined,
  };
}

function ensureInternalAccess(headerValue: string | null): boolean {
  const internalKey = process.env.BACKEND_INTERNAL_API_KEY;
  if (!internalKey) return process.env.NODE_ENV !== 'production';
  return headerValue === internalKey;
}

function ensureRealtimeDispatchAccess(authHeader: string | null, internalHeader: string | null): boolean {
  const dispatchToken = process.env.AGENT_DISPATCH_AUTH_TOKEN;
  if (dispatchToken) {
    return authHeader === `Bearer ${dispatchToken}`;
  }
  return ensureInternalAccess(internalHeader);
}

function requireLivekitRealtimeInProduction(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_PROD_RUNTIME !== 'true';
}

type MetricsSnapshot = ReturnType<typeof getMetricsSnapshot>;
type SnapshotMetric = MetricsSnapshot['metrics'][number];

function metricLabelsMatch(metric: SnapshotMetric, labels?: Record<string, string>): boolean {
  if (!labels) return true;
  return Object.entries(labels).every(([key, value]) => metric.labels[key] === value);
}

function counterMetricTotal(snapshot: MetricsSnapshot, name: string, labels?: Record<string, string>): number {
  return snapshot.metrics.reduce((sum, metric) => {
    if (metric.type !== 'counter') return sum;
    if (metric.name !== name) return sum;
    if (!metricLabelsMatch(metric, labels)) return sum;
    return sum + metric.value;
  }, 0);
}

function durationMetricAggregate(
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

async function readSession(c: Context): Promise<{ role: SessionRole; email: string; shopId?: string } | null> {
  const userToken = getCookie(c, USER_SESSION_COOKIE);
  if (userToken) {
    const verified = await verifySessionToken(userToken);
    if (verified?.role === 'user') {
      return { role: 'user', email: verified.email, shopId: verified.shopId };
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

async function requireSession(
  c: Context,
  role: SessionRole,
): Promise<{ role: SessionRole; email: string; shopId?: string } | Response> {
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
  return session;
}

/** Returns a canonical UUID string or null if the path/query segment is not a valid UUID */
function parseAdminResourceUuid(raw: string | undefined): string | null {
  const trimmed = raw?.trim() ?? '';
  const parsed = z.string().uuid().safeParse(trimmed);
  return parsed.success ? parsed.data : null;
}

/**
 * Shop id in Postgres is a UUID; in-memory tests use `shop-<uuid>`; fixtures may use short slugs (e.g. demo-shop).
 */
function parseAdminShopIdParam(raw: string | undefined): string | null {
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

async function enforceRateLimit(
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

async function enforceRateLimitWithIdentity(
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

function enforceSameOriginForCookieMutation(c: Context): Response | null {
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

function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toBrandSlug(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 120);
  return slug || `shop-${randomUUID().slice(0, 8)}`;
}

function buildDefaultShopNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'new-shop';
  const cleaned = local
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  if (!cleaned) return 'New RingBooker Shop';
  return `${cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase())} Shop`;
}

function createOAuthFallbackPasswordHash(): string {
  return hashPassword(`${randomUUID()}${randomBytes(24).toString('hex')}`);
}

async function sendSignupWelcomeEmail(params: {
  emailService?: EmailService;
  email: string;
  shopName: string;
  shopId: string;
  trialEndsAt?: string;
  shopTimezone?: string | null;
  appBaseUrl: string;
  idempotencyKey: string;
}): Promise<void> {
  if (!params.emailService) return;
  try {
    const { input, text } = buildWelcomeSignupEmailPayload({
      email: params.email,
      shopName: params.shopName,
      trialEndsAt: params.trialEndsAt,
      shopTimezone: params.shopTimezone,
      appBaseUrl: params.appBaseUrl,
    });
    const html = await renderBaseEmailHtml(input);
    await params.emailService.sendEmail({
      to: params.email,
      subject: input.title,
      text,
      html,
      category: 'welcome_signup',
      idempotencyKey: params.idempotencyKey,
      shopId: params.shopId,
      from: emailFounderFrom(),
      replyTo: emailReplyTo(),
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        shopId: params.shopId,
        email: params.email,
      },
      'signup_welcome_email_failed',
    );
  }
}

export function buildGoLivePaymentRequiredMessage(params?: { paddleTrialConfigVerified?: boolean }): string {
  const verified = params?.paddleTrialConfigVerified ?? process.env.PADDLE_TRIAL_CONFIG_VERIFIED === 'true';
  return verified
    ? "Start your 14-day trial. Due today: $0. You won't be charged until your 14-day trial ends. Final total may include applicable taxes based on your location."
    : 'Start your 14-day trial. Due today: $0. Final total may include applicable taxes based on your location. RingBooker will not answer real calls on your business number until billing and phone forwarding are set up.';
}

async function sendPasswordResetEmail(params: {
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

/**
 * Canonical public origin for redirects and OAuth `redirect_uri`.
 * Prefer validated `APP_BASE_URL`; otherwise derive from `x-forwarded-*` / `host` so HTTPS
 * behind a reverse proxy is not downgraded to `http://` (Square redirect URI must match the dashboard).
 */
function getAppBaseUrl(req: { header(name: string): string | undefined }): string {
  try {
    const fromEnv = getEnv().APP_BASE_URL?.trim();
    if (fromEnv) return fromEnv.replace(/\/+$/, '');
  } catch {
    /* env may be unavailable in some import/build paths */
  }
  const xfHost = req.header('x-forwarded-host')?.trim();
  const host = (xfHost && xfHost.length > 0 ? xfHost : req.header('host')?.trim()) ?? '';
  if (host.length > 0) {
    const xfProto = req.header('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
    const isLocal =
      host.startsWith('localhost:') || host === 'localhost' || host.startsWith('127.0.0.1');
    const scheme = xfProto === 'http' || xfProto === 'https' ? xfProto : isLocal ? 'http' : 'https';
    return `${scheme}://${host}`.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

function normalizePhone(phone: string | null | undefined): string | null {
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

function deriveDemoCallStage(call: {
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

function deriveDemoLiveSignal(call: {
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

function mapDemoCallRunStatusToStage(status: string): 'queued' | 'dialing' | 'live' | 'completed' | 'failed' {
  if (status === 'completed') return 'completed';
  if (status === 'failed' || status === 'missed') return 'failed';
  if (status === 'live') return 'live';
  if (status === 'dialing') return 'dialing';
  return 'queued';
}

function mapDispatchStatusToDemoCallStatus(status: 'received' | 'agent_joined' | 'completed' | 'failed') {
  if (status === 'agent_joined') return 'live' as const;
  if (status === 'completed') return 'completed' as const;
  if (status === 'failed') return 'failed' as const;
  return 'queued' as const;
}

async function verifyGoogleIdToken(idToken: string): Promise<{
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
function computeUserPostAuthRedirectPath(params: { shop: Shop | null; shopId: string | null | undefined }): string {
  if (!params.shopId || !params.shop) {
    return '/pricing?reason=plan_required';
  }
  if (!isShopSetupWizardComplete(params.shop)) {
    return '/user/onboarding';
  }
  return '/user';
}

function clearUserGoogleOAuthCookies(c: Context) {
  deleteCookie(c, 'rb_google_oauth_state', { path: '/' });
  deleteCookie(c, 'rb_google_oauth_intent', { path: '/' });
  deleteCookie(c, 'rb_google_oauth_selected_plan', { path: '/' });
}

function parseCalendarProviderParam(value: string): CalendarProviderParam | null {
  const parsed = calendarProviderParamSchema.safeParse({ provider: value });
  return parsed.success ? parsed.data.provider : null;
}

function isBookingLinkProviderId(provider: CalendarProviderParam | null): provider is BookingLinkProviderId {
  return Boolean(provider && (BOOKING_LINK_PROVIDER_IDS as readonly string[]).includes(provider));
}

function normalizeHttpsBookingUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function buildCalendarSettingsRedirect(params: { appBaseUrl: string; result: 'success' | 'error'; provider: string; message?: string }) {
  const url = new URL('/user/integrations', params.appBaseUrl);
  url.searchParams.set('calendar_connect', params.result);
  url.searchParams.set('provider', params.provider);
  if (params.message) url.searchParams.set('calendar_message', params.message);
  return url.toString();
}

function buildSquareCallbackUrl(appBaseUrl: string): string {
  return `${appBaseUrl.replace(/\/+$/, '')}/api/backend/user/calendar/providers/square_appointments/connect/callback`;
}

function buildSquareConnectionPayload(current: SquareConnectionCredentials | null, patch: Partial<SquareConnectionCredentials>) {
  return {
    provider: 'square_appointments' as const,
    access_token: patch.access_token ?? current?.access_token,
    refresh_token: patch.refresh_token ?? current?.refresh_token,
    expires_at: patch.expires_at ?? current?.expires_at,
    merchant_id: patch.merchant_id ?? current?.merchant_id,
    location_id: patch.location_id ?? current?.location_id,
    service_variation_id: patch.service_variation_id ?? current?.service_variation_id,
    team_member_id: patch.team_member_id ?? current?.team_member_id,
  };
}

function buildVagaroConnectionPayload(current: Partial<VagaroCredentials> | null, patch: Partial<VagaroCredentials>): VagaroCredentials {
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

function buildMindbodyConnectionPayload(current: Partial<MindbodyCredentials> | null, patch: Partial<MindbodyCredentials>): MindbodyCredentials {
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

function buildBookingLinkConnectionPayload(provider: BookingLinkProviderId, bookingUrl: string) {
  return JSON.stringify({
    provider,
    type: 'booking_link',
    booking_url: bookingUrl,
  });
}

function parseBookingLinkConnectionProvider(raw: string | null | undefined): BookingLinkProviderId | null {
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
function normalizeCfIpCountry(header: string | undefined): string | null {
  const raw = header?.trim().toUpperCase();
  if (!raw || raw.length !== 2 || !/^[A-Z]{2}$/.test(raw)) return null;
  if (raw === 'XX' || raw === 'T1') return null;
  return raw;
}

function demoCallDurationSeconds(row: Pick<DemoAdminCallListRow, 'connectedAt' | 'endedAt' | 'startedAt'>): number | null {
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

const ADMIN_CALL_LIST_PAGE_SIZE = 20;
const ADMIN_CALL_CHART_SAMPLE = 8000;
const ADMIN_DEMO_LIST_PAGE_SIZE = 20;
const ADMIN_DEMO_CHART_SAMPLE = 8000;
const ADMIN_WEB_DEMO_MERGE_CAP = 2500;

async function buildAdminDemoCallsListResult(
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

function liveKitDemoRunToWebAdminStatus(
  runStatus: DemoCallStatus,
  sessionStatus: DemoSessionStatus,
): WebDemoSessionStatus {
  if (runStatus === 'live' || sessionStatus === 'live') return 'connected';
  if (runStatus === 'completed') return 'completed';
  if (runStatus === 'failed' || runStatus === 'missed') return 'failed';
  return 'started';
}

function parseAdminUuidParam(raw: string | undefined): string | null {
  const t = raw?.trim() ?? '';
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)
  ) {
    return null;
  }
  return t.toLowerCase();
}

function formatWebDemoTranscriptForAdmin(transcript: unknown): string | null {
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

function unifiedWebDemoRowMatchesFilters(
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

const adminDashboardChartPeriodSchema = z.enum(['today', 'week', 'month', 'year']);
const adminDashboardChartMetricSchema = z.enum(['demo-calls', 'leads', 'shops', 'calls', 'web-demos']);

function buildAdminCallChartDaily(calls: Array<{ startedAt?: string }>): Array<{ day: string; count: number }> {
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
async function computeShowGoLiveSettingsTab(params: {
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

export function createBackendApp(deps: {
  providerEventsRepository: ProviderEventsRepository;
  jobsRepository?: JobsRepository;
  bookingsRepository?: BookingsRepository;
  billingCustomersRepository?: BillingCustomersRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  billingNotificationsRepository?: BillingNotificationsRepository;
  businessKnowledgeSuggestionsRepository?: BusinessKnowledgeSuggestionsRepository;
  shopAccessStatesRepository?: ShopAccessStatesRepository;
  commercialGoLiveApprovalEventsRepository?: CommercialGoLiveApprovalEventsRepository;
  shopLocationsRepository?: ShopLocationsRepository;
  shopRoutingRulesRepository?: ShopRoutingRulesRepository;
  commercialAccountsRepository?: CommercialAccountsRepository;
  shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
  testCallAttemptsRepository?: TestCallAttemptsRepository;
  forwardingTestSessionsRepository?: ForwardingTestSessionsRepository;
  callbacksRepository?: CallbacksRepository;
  blogPostsRepository?: BlogPostsRepository;
  contactRequestsRepository?: ContactRequestsRepository;
  demoSessionsRepository?: DemoSessionsRepository;
  webDemoSessionsRepository?: WebDemoSessionsRepository;
  shopsRepository?: ShopsRepository;
  telephonyService?: TelephonyService;
  phoneProvisioningService?: PhoneProvisioningService;
  emailService?: EmailService;
  callLogsRepository?: CallLogsRepository;
  customersRepository?: CustomersRepository;
	  missedCallsRepository?: MissedCallsRepository;
	  outboundMessagesRepository?: OutboundMessagesRepository;
	  handoffSessionsRepository?: HandoffSessionsRepository;
  voiceCallLegsRepository?: VoiceCallLegsRepository;
  authUsersRepository?: AuthUsersRepository;
  billingProvider?: BillingProviderAdapter;
  basePath?: string;
  runtimeInfo?: {
    mode: 'memory' | 'supabase';
    commProvider: 'noop' | 'telnyx';
    agentRuntimeMode?: 'mock' | 'livekit_realtime';
    agentTransportMode?: 'mock' | 'livekit';
    agentVoiceProviderMode?: 'none' | 'gemini_live' | 'openai_realtime';
  };
  realtimeAgentRuntime?: RealtimeAgentRuntime;
  /** Test-only: mock OpenAI HTTP for SIP accept/reject. */
  testingOpenAiFetch?: typeof fetch;
  /** Test-only: mock Telnyx Call Control REST (answer/reject/dial). */
  testingTelnyxFetch?: typeof fetch;
}) {
  const app = new Hono();
  const path = (route: string) => `${deps.basePath ?? ''}${route}`;
  const enqueueLifecycleEmail = async (params: {
    shopId: string;
    kind: string;
    subscriptionId?: string | null;
    forwardingNumber?: string | null;
    status?: string | null;
    title?: string | null;
    summary?: string | null;
    fields?: Record<string, string | number | boolean | null>;
    idempotencySuffix?: string;
  }) => {
    if (!deps.jobsRepository) return;
    const suffix = params.idempotencySuffix ?? params.kind;
    await deps.jobsRepository.enqueue({
      shopId: params.shopId,
      type: 'lifecycle_email',
      payload: {
        kind: params.kind,
        subscriptionId: params.subscriptionId ?? null,
        forwardingNumber: params.forwardingNumber ?? null,
        status: params.status ?? null,
        title: params.title ?? null,
        summary: params.summary ?? null,
        fields: params.fields ?? {},
      },
      runAt: new Date(),
      idempotencyKey: `lifecycle_email:${params.shopId}:${params.subscriptionId ?? 'none'}:${suffix}`,
    }).catch((error) => logger.warn({ err: error, shopId: params.shopId, kind: params.kind }, 'lifecycle_email_enqueue_failed'));
  };

  app.use('*', async (c, next) => {
    c.header('X-Frame-Options', 'DENY');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    c.header('Cross-Origin-Opener-Policy', 'same-origin');
    c.header('Cross-Origin-Resource-Policy', 'same-site');
    c.header(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.paddle.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        [
          "connect-src 'self'",
          'https://*.supabase.co',
          'https://api.telnyx.com',
          'https://api.openai.com',
          'wss://*.telnyx.com',
          'wss://*.openai.com',
          'https://api.resend.com',
          'https://api.paddle.com',
          'https://sandbox-api.paddle.com',
          'https://*.paddle.com',
        ].join(' '),
        "frame-src 'self' https://*.paddle.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self' https://*.paddle.com",
      ].join('; '),
    );

    const start = Date.now();
    await next();
    const durationMs = Date.now() - start;
    logger.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs,
      },
      'api_request',
    );
    trackApiStatusForAlerts(c.res.status, c.req.path);
    observeDurationMs('api_request_duration_ms', durationMs, {
      method: c.req.method,
      status: c.res.status,
    });
    incrementMetric('api_requests_total', {
      method: c.req.method,
      status: c.res.status,
    });
  });

  app.get(path('/health'), (c) => c.json({ ok: true }));
  app.get(path('/readiness'), (c) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const mode = deps.runtimeInfo?.mode ?? 'memory';
    const commProvider = deps.runtimeInfo?.commProvider ?? 'noop';
    const agentRuntimeMode = deps.runtimeInfo?.agentRuntimeMode ?? 'mock';
    const agentTransportMode = deps.runtimeInfo?.agentTransportMode ?? (agentRuntimeMode === 'livekit_realtime' ? 'livekit' : 'mock');
    const agentVoiceProviderMode =
      deps.runtimeInfo?.agentVoiceProviderMode ?? (agentRuntimeMode === 'livekit_realtime' ? 'gemini_live' : 'none');
    const checks = [
      {
        key: 'app_signing_secret',
        ok: typeof process.env.APP_SIGNING_SECRET === 'string' && process.env.APP_SIGNING_SECRET.length >= 32,
      },
      {
        key: 'app_encryption_key',
        ok: typeof process.env.APP_ENCRYPTION_KEY === 'string' && process.env.APP_ENCRYPTION_KEY.length >= 32,
      },
      ...(isProduction
        ? [
            {
              key: 'turnstile_secret_key',
              ok: typeof process.env.TURNSTILE_SECRET_KEY === 'string' && process.env.TURNSTILE_SECRET_KEY.length > 0,
            },
            {
              key: 'backend_internal_api_key',
              ok: typeof process.env.BACKEND_INTERNAL_API_KEY === 'string' && process.env.BACKEND_INTERNAL_API_KEY.length >= 16,
            },
            {
              key: 'production_repository_mode_supabase',
              ok: mode === 'supabase',
            },
            {
              key: 'production_comm_provider_telnyx',
              ok: commProvider === 'telnyx',
            },
            {
              key: 'production_agent_runtime_livekit_realtime',
              ok: agentRuntimeMode === 'livekit_realtime',
            },
          ]
        : []),
      ...(mode === 'supabase'
        ? [
            {
              key: 'supabase_url',
              ok: typeof process.env.SUPABASE_URL === 'string' && process.env.SUPABASE_URL.length > 0,
            },
            {
              key: 'supabase_service_key',
              ok: typeof process.env.SUPABASE_SERVICE_KEY === 'string' && process.env.SUPABASE_SERVICE_KEY.length > 0,
            },
          ]
        : []),
      ...(commProvider === 'telnyx'
        ? [
            {
              key: 'telnyx_api_key',
              ok: typeof process.env.TELNYX_API_KEY === 'string' && process.env.TELNYX_API_KEY.length > 0,
            },
            {
              key: 'telnyx_app_id',
              ok: typeof process.env.TELNYX_APP_ID === 'string' && process.env.TELNYX_APP_ID.length > 0,
            },
            {
              key: 'telnyx_messaging_profile',
              ok: typeof process.env.TELNYX_MESSAGING_PROFILE === 'string' && process.env.TELNYX_MESSAGING_PROFILE.length > 0,
            },
            {
              key: 'telnyx_webhook_public_key',
              ok:
                typeof process.env.TELNYX_WEBHOOK_PUBLIC_KEY === 'string' &&
                process.env.TELNYX_WEBHOOK_PUBLIC_KEY.length > 0,
            },
          ]
        : []),
      ...(agentTransportMode === 'livekit'
        ? [
            {
              key: 'livekit_url',
              ok: typeof process.env.LIVEKIT_URL === 'string' && process.env.LIVEKIT_URL.length > 0,
            },
            {
              key: 'livekit_api_key',
              ok: typeof process.env.LIVEKIT_API_KEY === 'string' && process.env.LIVEKIT_API_KEY.length > 0,
            },
            {
              key: 'livekit_api_secret',
              ok: typeof process.env.LIVEKIT_API_SECRET === 'string' && process.env.LIVEKIT_API_SECRET.length > 0,
            },
          ]
        : []),
      ...(agentVoiceProviderMode === 'gemini_live'
        ? [
            {
              key: 'google_ai_api_key',
              ok: typeof process.env.GOOGLE_AI_API_KEY === 'string' && process.env.GOOGLE_AI_API_KEY.length > 0,
            },
          ]
        : []),
      ...(agentVoiceProviderMode === 'openai_realtime'
        ? [
            {
              key: 'openai_api_key',
              ok: typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0,
            },
          ]
        : []),
      ...(process.env.EMAIL_PROVIDER === 'resend'
        ? [
            {
              key: 'email_from_address',
              ok: typeof process.env.EMAIL_FROM_ADDRESS === 'string' && process.env.EMAIL_FROM_ADDRESS.length > 0,
            },
            {
              key: 'resend_api_key',
              ok: typeof process.env.RESEND_API_KEY === 'string' && process.env.RESEND_API_KEY.length > 0,
            },
          ]
        : []),
    ];
    const ok = checks.every((check) => check.ok);
    return c.json(
      {
        ok,
        mode,
        commProvider,
        agentRuntimeMode,
        checks,
      },
      ok ? 200 : 503,
    );
  });

  app.post(path('/webhooks/telnyx'), (c) =>
    (async () => {
      const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.webhook_telnyx, 'webhook_telnyx');
      if (limited) return limited;
      return handleTelnyxWebhook(c, {
      providerEventsRepository: deps.providerEventsRepository,
      jobsRepository: deps.jobsRepository,
      callbacksRepository: deps.callbacksRepository,
      shopsRepository: deps.shopsRepository,
      callLogsRepository: deps.callLogsRepository,
      missedCallsRepository: deps.missedCallsRepository,
      demoSessionsRepository: deps.demoSessionsRepository,
      billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
      shopAccessStatesRepository: deps.shopAccessStatesRepository,
      testCallAttemptsRepository: deps.testCallAttemptsRepository,
      customersRepository: deps.customersRepository,
      });
    })(),
  );

  app.post(path('/webhooks/telnyx/call-control'), (c) =>
    (async () => {
      const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.webhook_telnyx, 'webhook_telnyx_cc');
      if (limited) return limited;
      return handleTelnyxCallControlWebhook(c, {
        providerEventsRepository: deps.providerEventsRepository,
        shopsRepository: deps.shopsRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopAccessStatesRepository: deps.shopAccessStatesRepository,
        forwardingTestSessionsRepository: deps.forwardingTestSessionsRepository,
        callLogsRepository: deps.callLogsRepository,
        commercialAccountsRepository: deps.commercialAccountsRepository,
        shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
        jobsRepository: deps.jobsRepository,
        missedCallsRepository: deps.missedCallsRepository,
        handoffSessionsRepository: deps.handoffSessionsRepository,
        voiceCallLegsRepository: deps.voiceCallLegsRepository,
        testingTelnyxFetch: deps.testingTelnyxFetch,
      });
    })(),
  );

  // TeXML OpenAI SIP ingress adapter — Voice URL when TELNYX_INBOUND_ROUTING_MODE=texml_to_openai_sip (see telnyx-texml-openai-inbound.ts).
  app.post(path('/telnyx/texml/inbound'), (c) =>
    handleTelnyxTexmlOpenAiInbound(c, {
      shopsRepository: deps.shopsRepository,
      billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
      shopAccessStatesRepository: deps.shopAccessStatesRepository,
      forwardingTestSessionsRepository: deps.forwardingTestSessionsRepository,
      callLogsRepository: deps.callLogsRepository,
      commercialAccountsRepository: deps.commercialAccountsRepository,
      shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
    }),
  );
  app.get(path('/telnyx/texml/inbound'), (c) =>
    c.text('', 405, {
      Allow: 'POST',
      'Cache-Control': 'no-store',
    }),
  );

  app.post(path('/webhooks/paddle'), (c) =>
    (async () => {
      const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.webhook_paddle, 'webhook_paddle');
      if (limited) return limited;
      return handlePaddleWebhook(c, {
      providerEventsRepository: deps.providerEventsRepository,
      billingProvider: deps.billingProvider,
      jobsRepository: deps.jobsRepository,
      emailService: deps.emailService,
      });
    })(),
  );

  app.post(path('/webhooks/vagaro'), (c) =>
    (async () => {
      const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.webhook_paddle, 'webhook_vagaro');
      if (limited) return limited;
      return handleVagaroWebhook(c, {
        providerEventsRepository: deps.providerEventsRepository,
      });
    })(),
  );

  app.post(path('/webhooks/openai'), (c) =>
    (async () => {
      const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.webhook_openai, 'webhook_openai');
      if (limited) return limited;
      return handleOpenAiRealtimeSipWebhook(c, {
        providerEventsRepository: deps.providerEventsRepository,
        demoSessionsRepository: deps.demoSessionsRepository,
        shopsRepository: deps.shopsRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopAccessStatesRepository: deps.shopAccessStatesRepository,
        shopRoutingRulesRepository: deps.shopRoutingRulesRepository,
        jobsRepository: deps.jobsRepository,
        bookingsRepository: deps.bookingsRepository,
        callbacksRepository: deps.callbacksRepository,
        telephonyService: deps.telephonyService,
        callLogsRepository: deps.callLogsRepository,
        commercialAccountsRepository: deps.commercialAccountsRepository,
        shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
        fetchImpl: deps.testingOpenAiFetch,
      });
    })(),
  );

  app.get(path('/runtime'), (c) => {
    if (!ensureInternalAccess(c.req.header('x-backend-key') ?? null)) {
      securityAudit({
        action: 'authz_denied',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
        details: { reason: 'internal_key_required' },
      });
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }
    return c.json({
      ok: true,
      mode: deps.runtimeInfo?.mode ?? 'memory',
      commProvider: deps.runtimeInfo?.commProvider ?? 'noop',
      agentRuntimeMode: deps.runtimeInfo?.agentRuntimeMode ?? 'mock',
      agentTransportMode: deps.runtimeInfo?.agentTransportMode ?? 'mock',
      agentVoiceProviderMode: deps.runtimeInfo?.agentVoiceProviderMode ?? 'none',
      agentVoiceModel: process.env.AGENT_VOICE_MODEL ?? process.env.AGENT_GEMINI_MODEL ?? null,
    });
  });

  app.get(path('/metrics'), (c) => {
    if (!ensureInternalAccess(c.req.header('x-backend-key') ?? null)) {
      securityAudit({
        action: 'authz_denied',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
        details: { reason: 'internal_key_required' },
      });
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }
    return c.json({
      ok: true,
      ...getMetricsSnapshot(),
    });
  });

  app.get(path('/public/blog/posts'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_status, 'public_blog_posts');
    if (limited) return limited;
    if (!deps.blogPostsRepository) return c.json({ ok: false, error: 'blog_repository_unavailable' }, 500);
    const parsed = blogPostListQuerySchema.safeParse({
      limit: c.req.query('limit'),
      query: c.req.query('query'),
    });
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_query' }, 400);
    const posts = await deps.blogPostsRepository.listPublished({
      limit: parsed.data.limit,
      query: parsed.data.query,
    });
    return c.json({ ok: true, posts });
  });

  app.get(path('/public/blog/posts/:slug'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_status, 'public_blog_post_detail');
    if (limited) return limited;
    if (!deps.blogPostsRepository) return c.json({ ok: false, error: 'blog_repository_unavailable' }, 500);
    const slug = c.req.param('slug');
    if (!slug) return c.json({ ok: false, error: 'invalid_slug' }, 400);
    const post = await deps.blogPostsRepository.findBySlug(slug);
    if (!post) return c.json({ ok: false, error: 'not_found' }, 404);
    return c.json({ ok: true, post });
  });

  app.post(path('/public/contact/request'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_contact_request, 'public_contact_request');
    if (limited) return limited;

    const body = await c.req.json().catch(() => null);
    const parsed = publicContactRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }

    if (parsed.data.website && parsed.data.website.trim().length > 0) {
      securityAudit({
        action: 'public_contact_honeypot_triggered',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
      });
      return c.json({ ok: false, error: 'invalid_request' }, 400);
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const sessionLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.public_contact_request_session,
      `public_contact_request_session:${parsed.data.sessionId}`,
    );
    if (sessionLimited) return sessionLimited;

    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    const emailDailyLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.public_contact_request_email_daily,
      `public_contact_request_email_daily:${normalizedEmail}`,
    );
    if (emailDailyLimited) return emailDailyLimited;

    const ipEmailLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.public_contact_request_ip_email,
      `public_contact_request_ip_email:${ip}:${normalizedEmail}`,
    );
    if (ipEmailLimited) return ipEmailLimited;

    const captcha = await verifyTurnstileToken({
      token: parsed.data.captchaToken,
      ip,
    });
    if (!captcha.ok) {
      securityAudit({
        action: 'public_contact_captcha_failed',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: { reason: captcha.reason },
      });
      return c.json({ ok: false, error: 'captcha_failed' }, 403);
    }

    const normalizedPhone = normalizePhone(parsed.data.phoneNumber);
    if (!normalizedPhone) {
      return c.json({ ok: false, error: 'invalid_phone' }, 400);
    }

    const requestId = `contact-${randomUUID()}`;
    const receivedAt = new Date().toISOString();
    const locationCount = parsed.data.locationCount ?? parsed.data.numberOfLocations ?? null;
    const estimatedCallVolume = parsed.data.estimatedCallVolume ?? parsed.data.estimatedMonthlyCallVolume ?? null;
    const bookingSoftware = parsed.data.bookingSoftware ?? parsed.data.currentBookingSoftware ?? null;
    const routingNeeds = parsed.data.routingNeeds ?? parsed.data.routingRules ?? null;
    const goLiveTimeline = parsed.data.goLiveTimeline ?? parsed.data.preferredGoLiveTimeline ?? null;
    const sourceDetail = parsed.data.source ?? null;

    if (deps.contactRequestsRepository) {
      try {
        await deps.contactRequestsRepository.create({
          requestId,
          fullName: parsed.data.fullName,
          businessName: parsed.data.businessName,
          email: normalizedEmail,
          phoneNumber: normalizedPhone,
          businessType: parsed.data.businessType,
          currentSetup: parsed.data.currentSetup,
          helpNeed: parsed.data.helpNeed,
          bestTime: parsed.data.bestTime,
          intent: parsed.data.intent,
          sourceDetail,
          planInterest: parsed.data.planInterest,
          locationCount,
          estimatedCallVolume,
          bookingSoftware,
          routingNeeds,
          goLiveTimeline,
          numberOfLocations: parsed.data.numberOfLocations ?? null,
          locationsText: parsed.data.locationsText ?? null,
          mainContact: parsed.data.mainContact ?? null,
          currentPhoneProvider: parsed.data.currentPhoneProvider ?? null,
          currentBookingSoftware: parsed.data.currentBookingSoftware ?? null,
          currentCrm: parsed.data.currentCrm ?? null,
          estimatedMonthlyCallVolume: parsed.data.estimatedMonthlyCallVolume ?? null,
          languagesNeeded: parsed.data.languagesNeeded ?? null,
          routingRules: parsed.data.routingRules ?? null,
          escalationRules: parsed.data.escalationRules ?? null,
          integrationRequirements: parsed.data.integrationRequirements ?? null,
          preferredGoLiveTimeline: parsed.data.preferredGoLiveTimeline ?? null,
          source: 'marketing_contact_form',
          ip,
        });
      } catch (error) {
        logger.error(
          {
            err: error,
            requestId,
          },
          'public_contact_persist_failed',
        );
      }
    }

    const salesTo = contactSalesEmail();
    if (getEnv().EMAIL_PROVIDER === 'noop') {
      logger.warn(
        { requestId },
        'public_contact_email_skipped_set_EMAIL_PROVIDER_resend_and_RESEND_API_KEY',
      );
    }
    if (deps.emailService && salesTo) {
      const leadName = parsed.data.businessName || normalizedEmail;
      const subject =
        parsed.data.intent === 'enterprise'
          ? `[Enterprise inquiry] Custom setup request from ${leadName}`
          : parsed.data.intent === 'demo'
            ? `[Demo request] ${leadName}`
            : `[Contact] ${leadName}`;
      const lines = [
        `Request ID: ${requestId}`,
        `Received At: ${receivedAt}`,
        `Intent: ${parsed.data.intent}`,
        sourceDetail ? `Source: ${sourceDetail}` : 'Source: —',
        `Plan Interest: ${parsed.data.planInterest}`,
        `Name: ${parsed.data.fullName}`,
        `Business: ${parsed.data.businessName}`,
        `Email: ${normalizedEmail}`,
        `Phone: ${normalizedPhone}`,
        `Business Type: ${parsed.data.businessType}`,
        `Current Setup: ${parsed.data.currentSetup}`,
        `Best Time: ${parsed.data.bestTime}`,
        locationCount ? `Number of locations: ${locationCount}` : null,
        estimatedCallVolume ? `Estimated Monthly Call Volume: ${estimatedCallVolume}` : null,
        bookingSoftware ? `Booking Software: ${bookingSoftware}` : null,
        routingNeeds ? `Routing Needs: ${routingNeeds}` : null,
        goLiveTimeline ? `Preferred Go-live Timeline: ${goLiveTimeline}` : null,
        parsed.data.locationsText ? `Locations: ${parsed.data.locationsText}` : null,
        parsed.data.currentPhoneProvider ? `Phone Provider: ${parsed.data.currentPhoneProvider}` : null,
        parsed.data.currentCrm ? `CRM: ${parsed.data.currentCrm}` : null,
        parsed.data.languagesNeeded ? `Languages Needed: ${parsed.data.languagesNeeded}` : null,
        parsed.data.escalationRules ? `Escalation Rules: ${parsed.data.escalationRules}` : null,
        parsed.data.integrationRequirements ? `Integration Requirements: ${parsed.data.integrationRequirements}` : null,
        '',
        'Help Request:',
        parsed.data.helpNeed,
      ].filter((line): line is string => typeof line === 'string');
      try {
        await deps.emailService.sendEmail({
          to: salesTo,
          subject,
          text: lines.join('\n'),
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
              <h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2>
              <pre style="white-space:pre-wrap;font-family:Arial,sans-serif;margin:0">${escapeHtml(lines.join('\n'))}</pre>
            </div>
          `,
          category: 'contact_request',
          idempotencyKey: `public_contact:${requestId}`,
          from: emailDefaultFrom(),
          replyTo: normalizedEmail,
        });
      } catch (error) {
        logger.error(
          {
            err: error,
            requestId,
            salesTo,
          },
          'public_contact_email_send_failed',
        );
      }
    }

    if (deps.emailService && parsed.data.intent === 'demo') {
      const firstName = parsed.data.fullName.trim().split(/\s+/).filter(Boolean)[0] ?? '';
      try {
        const { input, text } = buildDemoRequestCustomerEmailPayload({
          firstName,
          businessName: parsed.data.businessName,
          businessType: parsed.data.businessType,
          demoCtaUrl: 'https://ringbooker.com/demo',
        });
        const html = await renderBaseEmailHtml(input);
        await deps.emailService.sendEmail({
          from: emailFounderFrom(),
          to: normalizedEmail,
          subject: input.title,
          text,
          html,
          category: 'demo_request_confirmation',
          idempotencyKey: `public_contact_customer:${requestId}`,
          replyTo: emailReplyTo(),
        });
      } catch (error) {
        logger.error(
          {
            err: error,
            requestId,
            to: normalizedEmail,
          },
          'public_contact_confirmation_email_failed',
        );
      }
    }

    securityAudit({
      action: 'public_contact_requested',
      actorType: 'public',
      ip,
      path: c.req.path,
      details: {
        requestId,
        businessType: parsed.data.businessType,
        currentSetup: parsed.data.currentSetup,
        intent: parsed.data.intent,
        source: sourceDetail,
        planInterest: parsed.data.planInterest,
      },
    });

    return c.json({
      ok: true,
      requestId,
      message: 'request_received',
    });
  });

  /**
   * Legacy public outbound visitor demo — permanently disabled.
   * Browser voice demos use `POST /public/demo/web-session` instead (no visitor phone dial).
   */
  app.post(path('/public/demo/request'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_request, 'public_demo_outbound_disabled');
    if (limited) return limited;

    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    securityAudit({
      action: 'public_demo_outbound_disabled',
      actorType: 'public',
      ip,
      path: c.req.path,
      details: { reason: 'outbound_visitor_demo_removed' },
    });

    return c.json(
      {
        ok: false,
        error: 'outbound_demo_disabled',
        message: 'Outbound demo calls are no longer supported. Please use the browser web demo.',
      },
      410,
    );
  });

  app.post(path('/public/demo/realtime-session'), async (c) => {
    const body = await c.req.json().catch(() => null);
    const normalizedBody =
      body && typeof body === 'object' && !Array.isArray(body)
        ? {
            ...body,
            shopName:
              typeof (body as { shopName?: unknown }).shopName === 'string'
                ? (body as { shopName: string }).shopName
                : (body as { businessName?: unknown }).businessName,
          }
        : body;
    const parsed = publicDemoWebSessionSchema.safeParse(normalizedBody);
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          code: 'invalid_demo_payload',
          message: 'Please check your demo details and try again.',
          retryAfterSeconds: 0,
        },
        400,
      );
    }

    if (parsed.data.website && parsed.data.website.trim().length > 0) {
      securityAudit({
        action: 'public_demo_honeypot_triggered',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
      });
      return c.json(
        {
          ok: false,
          code: 'invalid_demo_payload',
          message: 'Please check your demo details and try again.',
          retryAfterSeconds: 0,
        },
        400,
      );
    }

    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    const originDenied = enforcePublicDemoRealtimeOrigin(c);
    if (originDenied) return originDenied;

    const captcha = await verifyTurnstileToken({
      token: parsed.data.captchaToken,
      ip,
    });
    if (!captcha.ok) {
      securityAudit({
        action: 'public_demo_captcha_failed',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: { reason: captcha.reason },
      });
      return c.json(
        {
          ok: false,
          code: 'captcha_failed',
          error: 'captcha_failed',
          message: 'Captcha verification failed. Please try again.',
          retryAfterSeconds: 0,
        },
        403,
      );
    }

    const demoVertical = parsed.data.demoVertical ?? parsed.data.businessType.toLowerCase().replace(/\s+/g, '-');

    return runDirectDemoSerialized(ip, async () => {
      const persistCountry = resolveDemoClientCountryForPersistence(
        normalizeCfIpCountry(c.req.header('CF-IPCountry')),
        PUBLIC_DEMO_WEB_SESSION_CALLBACK_PHONE_E164,
      );
      const uaHints = parseDemoUserAgentHints(c.req.header('user-agent'));

      const limits = await consumePublicDemoRealtimeLimits(ip, parsed.data.sessionId);
      if (!limits.ok) {
        if (deps.webDemoSessionsRepository) {
          try {
            await deps.webDemoSessionsRepository.insertRateLimited({
              publicSessionId: parsed.data.sessionId,
              verticalSlug: demoVertical,
              businessName: parsed.data.shopName,
              ipAddress: ip,
              country: persistCountry,
              userAgent: c.req.header('user-agent') ?? null,
              browser: uaHints.browser,
              deviceType: uaHints.deviceType,
              errorCode: limits.code,
            });
          } catch (error) {
            logger.warn({ err: error }, 'web_demo_session_rate_limit_persist_failed');
          }
        }
        return jsonPublicDemoRealtimeBlocked(c, limits.code, { vertical: demoVertical });
      }

      const requestId = `demo-direct-${randomUUID()}`;
      const ttlMs = directDemoActiveTtlMs();
      if (!await tryOccupyDirectDemoActiveSlot(ip, requestId, ttlMs)) {
        if (deps.webDemoSessionsRepository) {
          try {
            await deps.webDemoSessionsRepository.insertRateLimited({
              publicSessionId: parsed.data.sessionId,
              verticalSlug: demoVertical,
              businessName: parsed.data.shopName,
              ipAddress: ip,
              country: persistCountry,
              userAgent: c.req.header('user-agent') ?? null,
              browser: uaHints.browser,
              deviceType: uaHints.deviceType,
              errorCode: 'demo_concurrent_session_limit',
            });
          } catch (error) {
            logger.warn({ err: error }, 'web_demo_session_concurrent_limit_persist_failed');
          }
        }
        return jsonPublicDemoRealtimeBlocked(c, 'demo_concurrent_session_limit', {
          requestId,
          vertical: demoVertical,
        });
      }

      if (deps.webDemoSessionsRepository) {
        try {
          await deps.webDemoSessionsRepository.insertStarted({
            publicSessionId: parsed.data.sessionId,
            requestId,
            verticalSlug: demoVertical,
            businessName: parsed.data.shopName,
            ipAddress: ip,
            country: persistCountry,
            userAgent: c.req.header('user-agent') ?? null,
            browser: uaHints.browser,
            deviceType: uaHints.deviceType,
          });
        } catch (error) {
          logger.warn({ err: error, requestId }, 'web_demo_session_started_persist_failed');
        }
      }

      const demoMode = parsed.data.demoMode ?? 'quick';
      const demoSource = parsed.data.demoSource ?? 'vertical_demo_direct_openai';
      const model = directOpenAiRealtimeModel();
      const voice = openAiRealtimeVoiceForDemoVerticalSlug(parsed.data.demoVertical ?? demoVertical);
      const systemPrompt = buildPublicDemoSystemPrompt({
        shopName: parsed.data.shopName,
        businessType: parsed.data.businessType,
        demoVertical: parsed.data.demoVertical,
        staffName: parsed.data.staffName,
        notes: parsed.data.notes,
        demoConfig: parsed.data.demoConfig,
      });
      const scriptedWelcomeLine = buildPublicDemoScriptedWelcomeLine({
        shopName: parsed.data.shopName,
        businessType: parsed.data.businessType,
        demoVertical: parsed.data.demoVertical,
      });

      const services =
        parsed.data.demoConfig?.services?.map((s) => ({
          category: s.category,
          name: s.name,
          price: s.price ?? null,
          duration: s.duration ?? null,
          enabled: s.enabled ?? true,
        })) ?? [];
      const staff =
        parsed.data.demoConfig?.staffNames?.length
          ? parsed.data.demoConfig.staffNames
          : parsed.data.staffName
            ? [parsed.data.staffName]
            : [];

      if (deps.demoSessionsRepository) {
        try {
          const demoSession = await deps.demoSessionsRepository.createSession({
            publicSessionId: parsed.data.sessionId,
            verticalSlug: demoVertical,
            mode: demoMode,
            source: demoSource,
            callbackPhone: PUBLIC_DEMO_WEB_SESSION_CALLBACK_PHONE_E164,
            businessName: parsed.data.shopName,
            city: parsed.data.demoConfig?.city ?? null,
            businessHours: {
              primaryHours: parsed.data.demoConfig?.primaryHours,
              secondaryHours: parsed.data.demoConfig?.secondaryHours,
            },
            staff,
            notes: parsed.data.notes ?? null,
            systemPrompt,
            services,
            clientIp: ip,
            clientCountry: resolveDemoClientCountryForPersistence(
              normalizeCfIpCountry(c.req.header('CF-IPCountry')),
              PUBLIC_DEMO_WEB_SESSION_CALLBACK_PHONE_E164,
            ),
          });
          await deps.demoSessionsRepository.addStatusEvent({
            demoSessionId: demoSession.id,
            requestId,
            eventType: 'demo_realtime_session_requested',
            payload: {
              demoVertical,
              demoMode,
              demoSource,
              model,
              voice,
            },
          });
        } catch (error) {
          logger.warn({ err: error, requestId }, 'public_demo_realtime_session_persist_failed');
        }
      }

      securityAudit({
        action: 'public_demo_realtime_session_requested',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: {
          requestId,
          businessType: parsed.data.businessType,
          demoVertical,
          demoMode,
          demoSource,
          model,
          voice,
        },
      });

      try {
        const clientSecret = await createOpenAiRealtimeClientSecret({
          model,
          voice,
          instructions: systemPrompt,
        });

        securityAudit({
          action: 'public_demo_realtime_token_created',
          actorType: 'public',
          ip,
          path: c.req.path,
          details: {
            requestId,
            demoVertical,
            model,
            voice,
            expiresAt: clientSecret.expiresAt ?? null,
          },
        });

        if (deps.webDemoSessionsRepository) {
          try {
            await deps.webDemoSessionsRepository.markConnectedByRequestId(requestId);
          } catch (error) {
            logger.warn({ err: error, requestId }, 'web_demo_session_mark_connected_failed');
          }
        }

        return c.json({
          ok: true,
          requestId,
          clientSecret: clientSecret.value,
          expiresAt: clientSecret.expiresAt,
          model,
          voice,
          scriptedWelcomeLine,
          ...(clientSecret.turnDetectionAfterWelcome
            ? { turnDetectionAfterWelcome: clientSecret.turnDetectionAfterWelcome }
            : {}),
        });
      } catch (error) {
        clearDirectDemoActiveSlot(ip, requestId);
        const code = error instanceof Error && error.message === 'openai_config_missing' ? 'openai_config_missing' : 'realtime_session_failed';
        if (deps.webDemoSessionsRepository) {
          try {
            await deps.webDemoSessionsRepository.markFailedByRequestId(requestId, {
              errorCode: code,
              errorMessage: error instanceof Error ? error.message : String(error),
            });
          } catch (persistErr) {
            logger.warn({ err: persistErr, requestId }, 'web_demo_session_mark_failed_persist_failed');
          }
        }
        logger.error(
          {
            err: error,
            requestId,
            demoVertical,
            model,
            voice,
          },
          'public_demo_realtime_session_failed',
        );
        const status = code === 'openai_config_missing' ? 503 : 502;
        const message =
          code === 'openai_config_missing'
            ? 'The voice demo is temporarily unavailable. Please try again later.'
            : "We couldn't connect to the voice demo. Please try again in a moment.";
        return c.json(
          {
            ok: false,
            code,
            message,
            retryAfterSeconds: 60,
          },
          status,
        );
      }
    });
  });

  app.post(path('/public/demo/realtime-session/release'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_realtime_release, 'demo_realtime_release');
    if (limited) return limited;

    const originDenied = enforcePublicDemoRealtimeOrigin(c);
    if (originDenied) return originDenied;

    const body = await c.req.json().catch(() => null);
    const releaseParsed = z
      .object({
        requestId: z.string().min(1).max(200),
        endReason: z.enum(['completed', 'timeout']).optional(),
      })
      .safeParse(body);
    if (!releaseParsed.success) {
      return c.json(
        {
          ok: false,
          code: 'invalid_demo_payload',
          message: 'Please check your demo details and try again.',
          retryAfterSeconds: 0,
        },
        400,
      );
    }

    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    const released = await releaseDirectDemoActiveSlot(ip, releaseParsed.data.requestId);
    if (!released) {
      return c.json(
        {
          ok: false,
          code: 'demo_session_expired',
          message:
            'This demo session has ended. You can start a new demo when you are ready.',
          retryAfterSeconds: 60,
        },
        404,
      );
    }

    const rid = releaseParsed.data.requestId;
    if (deps.webDemoSessionsRepository && rid.startsWith('demo-direct-')) {
      try {
        await deps.webDemoSessionsRepository.finalizeByRequestId(rid, {
          endReason: releaseParsed.data.endReason === 'timeout' ? 'timeout' : 'completed',
        });
      } catch (error) {
        logger.warn({ err: error, requestId: rid }, 'web_demo_session_finalize_failed');
      }
    }

    return c.json({ ok: true });
  });

  app.post(path('/public/demo/web-session'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_web_session, 'public_demo_web_session');
    if (limited) return limited;

    const body = await c.req.json().catch(() => null);
    const parsed = publicDemoWebSessionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }

    if (parsed.data.website && parsed.data.website.trim().length > 0) {
      securityAudit({
        action: 'public_demo_honeypot_triggered',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
      });
      return c.json({ ok: false, error: 'invalid_request' }, 400);
    }

    const sessionIp = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    const sessionLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.public_demo_request_session,
      `public_demo_web_session:${sessionIp}:${parsed.data.sessionId}`,
    );
    if (sessionLimited) return sessionLimited;

    const normalizedPhone = PUBLIC_DEMO_WEB_SESSION_CALLBACK_PHONE_E164;
    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });

    const captcha = await verifyTurnstileToken({
      token: parsed.data.captchaToken,
      ip,
    });
    if (!captcha.ok) {
      securityAudit({
        action: 'public_demo_captcha_failed',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: { reason: captcha.reason },
      });
      return c.json({ ok: false, error: 'captcha_failed' }, 403);
    }

    if (!deps.shopsRepository || !deps.realtimeAgentRuntime || !deps.demoSessionsRepository) {
      return c.json({ ok: false, error: 'demo_dependencies_unavailable' }, 503);
    }

    const env = getEnv();
    const demoShop = await deps.shopsRepository.findById(env.PUBLIC_DEMO_SHOP_ID);
    if (!demoShop || !demoShop.active) {
      return c.json({ ok: false, error: 'demo_shop_unavailable' }, 503);
    }

    const liveDemoConfigured =
      deps.runtimeInfo?.commProvider === 'telnyx' &&
      deps.runtimeInfo?.agentTransportMode === 'livekit' &&
      (deps.runtimeInfo?.agentVoiceProviderMode === 'gemini_live' ||
        deps.runtimeInfo?.agentVoiceProviderMode === 'openai_realtime');
    if (!liveDemoConfigured && process.env.NODE_ENV === 'production') {
      return c.json({ ok: false, error: 'demo_runtime_not_configured' }, 503);
    }

    const requestId = `demo-${randomUUID()}`;
    const roomName = `rb-demo-${requestId.slice(-12)}`;
    const demoVertical = parsed.data.demoVertical ?? parsed.data.businessType.toLowerCase().replace(/\s+/g, '-');
    const demoMode = parsed.data.demoMode ?? 'free-form';
    const demoSource = parsed.data.demoSource ?? 'vertical_demo_web';
    const systemPrompt = buildPublicDemoSystemPrompt({
      shopName: parsed.data.shopName,
      businessType: parsed.data.businessType,
      demoVertical: parsed.data.demoVertical,
      staffName: parsed.data.staffName,
      notes: parsed.data.notes,
      demoConfig: parsed.data.demoConfig,
    });

    const services =
      parsed.data.demoConfig?.services?.map((s) => ({
        category: s.category,
        name: s.name,
        price: s.price ?? null,
        duration: s.duration ?? null,
        enabled: s.enabled ?? true,
      })) ?? [];

    const staff =
      parsed.data.demoConfig?.staffNames?.length
        ? parsed.data.demoConfig.staffNames
        : parsed.data.staffName
          ? [parsed.data.staffName]
          : [];

    try {
      const demoSession = await deps.demoSessionsRepository.createSession({
        publicSessionId: parsed.data.sessionId,
        verticalSlug: demoVertical,
        mode: demoMode,
        source: demoSource,
        callbackPhone: normalizedPhone,
        businessName: parsed.data.shopName,
        city: parsed.data.demoConfig?.city ?? null,
        businessHours: {
          primaryHours: parsed.data.demoConfig?.primaryHours,
          secondaryHours: parsed.data.demoConfig?.secondaryHours,
        },
        staff,
        notes: parsed.data.notes ?? null,
        systemPrompt,
        services,
        clientIp: ip,
        clientCountry: resolveDemoClientCountryForPersistence(normalizeCfIpCountry(c.req.header('CF-IPCountry')), normalizedPhone),
      });
      await deps.demoSessionsRepository.createCallRun({
        demoSessionId: demoSession.id,
        requestId,
        provider: 'marketing_demo_web',
        roomName,
        status: 'dialing',
        startedAt: new Date(),
      });
      await deps.demoSessionsRepository.addStatusEvent({
        demoSessionId: demoSession.id,
        requestId,
        eventType: 'demo_web_session_requested',
        payload: {
          demoVertical,
          demoMode,
          demoSource,
        },
      });

      const realtime = await deps.realtimeAgentRuntime.startInboundSession({
        requestId,
        roomName,
        shopId: demoShop.id,
        destinationPhone: demoShop.phone_number,
        callerPhone: normalizedPhone,
        systemPrompt,
        shopPlan: demoShop.plan,
      });

      if (requireLivekitRealtimeInProduction() && realtime.mode !== 'livekit_realtime') {
        logger.error(
          {
            requestId,
            mode: realtime.mode,
          },
          'public_demo_web_session_realtime_mode_not_allowed_in_production',
        );
        return c.json({ ok: false, error: 'demo_runtime_not_configured' }, 503);
      }

      if (realtime.metadata?.dispatchPayload) {
        realtime.metadata.dispatchPayload.toolPolicy = {
          allowedTools: [],
          blockMessage: 'This live demo explains the flow but does not perform real booking actions.',
        };
        realtime.metadata.dispatchPayload.demo = {
          isolated: true,
          source: demoSource,
          vertical: demoVertical,
          mode: demoMode,
        };
      }

      await dispatchRealtimeSession({
        requestId,
        roomName,
        destinationPhone: demoShop.phone_number,
        callerPhone: normalizedPhone,
        systemPrompt,
        realtime,
      });

      await deps.demoSessionsRepository.addStatusEvent({
        demoSessionId: demoSession.id,
        requestId,
        eventType: 'demo_web_realtime_dispatched',
        payload: {
          demoVertical,
          mode: realtime.mode,
        },
      });

      const previewToken = await signDemoPreviewToken({
        requestId,
        shopId: demoShop.id,
        callerPhone: normalizedPhone,
      });

      const liveKitBrowserUrl = toLiveKitBrowserWsUrl(env.LIVEKIT_URL);
      const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
        identity: `web-demo-${requestId.slice(-18)}`,
        name: 'Web demo',
        ttl: '45m',
      });
      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
      });
      const liveKitToken = await at.toJwt();

      securityAudit({
        action: 'public_demo_web_session_requested',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: {
          requestId,
          shopId: demoShop.id,
          businessType: parsed.data.businessType,
          demoVertical,
          demoMode,
          demoSource,
        },
      });

      return c.json({
        ok: true,
        requestId,
        previewToken,
        roomName,
        liveKitUrl: liveKitBrowserUrl,
        liveKitToken,
        mode: realtime.mode,
      });
    } catch (error) {
      await deps.demoSessionsRepository.markCallRunStatusByRequestId({
        requestId,
        status: 'failed',
        endedAt: new Date(),
        outcome: 'error',
      });
      await deps.demoSessionsRepository.addStatusEvent({
        requestId,
        eventType: 'demo_web_session_failed',
        payload: { error: error instanceof Error ? error.message : 'unknown_error' },
      });
      logger.error(
        {
          err: error,
          requestId,
        },
        'public_demo_web_session_failed',
      );
      return c.json({ ok: false, error: 'demo_web_session_failed' }, 502);
    }
  });

  /**
   * Persist marketing demo form context for OpenAI SIP inbound pilot (no outbound call).
   * Pair with `OPENAI_SIP_*` + Telnyx → OpenAI SIP; caller phone should match `callbackPhone`.
   */
  app.post(path('/public/demo/sip-prep'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_sip_prep, 'public_demo_sip_prep');
    if (limited) return limited;

    const body = await c.req.json().catch(() => null);
    const parsed = publicDemoRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }

    if (parsed.data.website && parsed.data.website.trim().length > 0) {
      securityAudit({
        action: 'public_demo_honeypot_triggered',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
      });
      return c.json({ ok: false, error: 'invalid_request' }, 400);
    }

    const sessionIp = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    const sessionLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.public_demo_request_session,
      `public_demo_sip_prep_session:${sessionIp}:${parsed.data.sessionId}`,
    );
    if (sessionLimited) return sessionLimited;

    const normalizedPhone = normalizePhone(parsed.data.phoneNumber);
    if (!normalizedPhone) {
      return c.json({ ok: false, error: 'invalid_phone' }, 400);
    }

    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    const phoneShortLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.public_demo_request_phone_short,
      `public_demo_sip_prep_phone_short:${normalizedPhone}`,
    );
    if (phoneShortLimited) return phoneShortLimited;

    const captcha = await verifyTurnstileToken({
      token: parsed.data.captchaToken,
      ip,
    });
    if (!captcha.ok) {
      securityAudit({
        action: 'public_demo_captcha_failed',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: { reason: captcha.reason },
      });
      return c.json({ ok: false, error: 'captcha_failed' }, 403);
    }

    if (!deps.demoSessionsRepository) {
      return c.json({ ok: false, error: 'demo_dependencies_unavailable' }, 503);
    }

    const demoVertical = parsed.data.demoVertical ?? parsed.data.businessType.toLowerCase().replace(/\s+/g, '-');
    const demoMode = parsed.data.demoMode ?? 'free-form';
    const demoSource = `${parsed.data.demoSource ?? 'public_demo'}:sip_prep`;

    const systemPrompt = buildPublicDemoSystemPrompt({
      shopName: parsed.data.shopName,
      businessType: parsed.data.businessType,
      demoVertical: parsed.data.demoVertical,
      staffName: parsed.data.staffName,
      notes: parsed.data.notes,
      demoConfig: parsed.data.demoConfig,
    });

    const services =
      parsed.data.demoConfig?.services?.map((s) => ({
        category: s.category,
        name: s.name,
        price: s.price ?? null,
        duration: s.duration ?? null,
        enabled: s.enabled ?? true,
      })) ?? [];

    try {
      const demoSession = await deps.demoSessionsRepository.createSession({
        publicSessionId: parsed.data.sessionId,
        verticalSlug: demoVertical,
        mode: demoMode,
        source: demoSource,
        callbackPhone: normalizedPhone,
        businessName: parsed.data.shopName,
        city: parsed.data.demoConfig?.city ?? null,
        businessHours: {
          primaryHours: parsed.data.demoConfig?.primaryHours,
          secondaryHours: parsed.data.demoConfig?.secondaryHours,
        },
        staff: parsed.data.demoConfig?.staffNames?.length
          ? parsed.data.demoConfig.staffNames
          : parsed.data.staffName
            ? [parsed.data.staffName]
            : [],
        notes: parsed.data.notes ?? null,
        systemPrompt,
        services,
        clientIp: ip,
        clientCountry: resolveDemoClientCountryForPersistence(normalizeCfIpCountry(c.req.header('CF-IPCountry')), normalizedPhone),
      });
      await deps.demoSessionsRepository.addStatusEvent({
        demoSessionId: demoSession.id,
        eventType: 'sip_demo_context_saved',
        payload: { demoVertical, demoMode },
      });
      securityAudit({
        action: 'public_demo_sip_prep_saved',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: { demoVertical },
      });
      return c.json({ ok: true, publicSessionId: parsed.data.sessionId });
    } catch (error) {
      logger.error({ err: error }, 'public_demo_sip_prep_failed');
      return c.json({ ok: false, error: 'sip_prep_failed' }, 502);
    }
  });

  app.get(path('/public/demo/status/:requestId'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_status, 'public_demo_status');
    if (limited) return limited;

    const requestId = c.req.param('requestId');
    const token = c.req.query('token') ?? '';
    if (!requestId || !token) {
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }

    const verified = await verifyDemoPreviewToken(token);
    if (!verified || verified.requestId !== requestId) {
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }
    if (!deps.demoSessionsRepository) {
      return c.json({ ok: false, error: 'demo_dependencies_unavailable' }, 503);
    }

    const call = await deps.demoSessionsRepository.findCallRunByRequestId(requestId);
    const stage = call ? mapDemoCallRunStatusToStage(call.status) : 'queued';

    return c.json({
      ok: true,
      stage,
      call: call
        ? {
            callerPhone: call.callbackPhone ?? null,
            startedAt: call.startedAt ?? null,
            endedAt: call.endedAt ?? null,
            outcome: call.outcome ?? null,
            transcriptStatus: call.status === 'completed' ? 'completed' : call.status === 'failed' ? 'failed' : 'pending',
            transcriptText: null,
            demoLiveState: call.status === 'live' ? 'ai_agent_speaking' : call.status,
            roomName: call.roomName ?? null,
            requestId: call.requestId ?? null,
            agentJoined: call.status === 'live' || call.status === 'completed',
            humanAnswered: call.status === 'live' || call.status === 'completed',
          }
        : null,
    });
  });

  app.post(path('/public/demo/import-website'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_import_website, 'public_demo_import_website');
    if (limited) return limited;

    if (!getEnv().WEBSITE_IMPORT_ENABLED) {
      return c.json({ ok: false, error: 'website_import_disabled' }, 503);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = importWebsiteSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    try {
      const env = getEnv();
      // Demo budget must leave room for the LLM extractor (needs >=4s after the crawl);
      // 15s was too short — the LLM was skipped, so the demo returned far fewer services,
      // a partial address and no hours. 25s matches the LLM-capable onboarding crawl.
      const demoImportBudgetMs = 25_000;
      const result = await importWebsiteWithCache({ url: parsed.data.url, qualityBudgetMs: demoImportBudgetMs }, () =>
        importWebsiteForOnboarding({ url: parsed.data.url }, {
          googlePlacesApiKey: env.GOOGLE_PLACES_API_KEY,
          llmEnabled: env.WEBSITE_IMPORT_LLM_ENABLED,
          openAiApiKey: env.OPENAI_API_KEY,
          llmModel: env.WEBSITE_IMPORT_LLM_MODEL,
          llmMaxTokens: env.WEBSITE_IMPORT_LLM_MAX_TOKENS,
          maxBytes: env.WEBSITE_IMPORT_MAX_BYTES,
          renderEndpoint: env.WEBSITE_IMPORT_RENDER_URL,
          renderApiKey: env.WEBSITE_IMPORT_RENDER_API_KEY,
          deadlineMs: demoImportBudgetMs,
        }),
      );
      return c.json({ ok: result.ok, suggestions: result.suggestions });
    } catch (err) {
      logger.warn({ err }, 'public_demo_import_website_failed');
      return c.json({ ok: false, error: 'import_failed', message: 'Could not read that website. You can fill in the details manually.' }, 200);
    }
  });

  // Cost estimate: ~$0.001 per call (gpt-4o-mini, ~150 output tokens)
  // At 1,000 demo sessions/month = ~$1/month; at 10,000 = ~$10/month
  app.post(path('/public/demo/suggested-questions'), async (c) => {
    const ip = getClientIp({ get: (n: string) => c.req.header(n) ?? null });
    const ipLimited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_suggested_questions_ip, ip);
    if (ipLimited) {
      return c.json({ ok: true, questions: null, source: 'default' });
    }

    const body = await c.req.json().catch(() => null);
    const parsed = z.object({
      businessName: z.string().max(120),
      vertical: z.string().max(60),
      services: z.array(z.string().max(80)).max(40),
      hours: z.string().max(200).optional(),
      city: z.string().max(100).optional(),
      sessionId: z.string().max(80).optional(),
    }).safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    if (parsed.data.sessionId) {
      const sessLimited = await enforceRateLimit(
        c,
        RATE_LIMIT_POLICIES.public_demo_suggested_questions_session,
        `sugq:${parsed.data.sessionId}`,
      );
      if (sessLimited) return c.json({ ok: true, questions: null, source: 'default' });
    }

    if (!parsed.data.services.length) {
      return c.json({ ok: true, questions: null, source: 'default' });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      logger.warn('demo_suggested_questions_no_openai_key');
      return c.json({ ok: true, questions: null, source: 'default' });
    }

    const t0 = Date.now();
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 200,
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are generating realistic sample caller questions for a voice AI demo for a beauty salon. ' +
                'Generate exactly 4 questions a real caller might ask this specific salon over the phone. ' +
                'Rules: use the actual service names provided — do not invent services; ' +
                'questions must be natural spoken language, not formal; ' +
                'mix question types: pricing, availability, booking, info; ' +
                'keep each question under 12 words; ' +
                'do not repeat the same question type twice. ' +
                'Return JSON only: { "questions": ["q1", "q2", "q3", "q4"] }',
            },
            {
              role: 'user',
              content: [
                `Salon: ${parsed.data.businessName}`,
                parsed.data.city ? `Location: ${parsed.data.city}` : '',
                `Vertical: ${parsed.data.vertical}`,
                `Services offered: ${parsed.data.services.slice(0, 20).join(', ')}`,
                parsed.data.hours ? `Hours: ${parsed.data.hours}` : '',
                '',
                'Generate 4 realistic caller questions for this salon.',
              ].filter(Boolean).join('\n'),
            },
          ],
        }),
      });

      const elapsed = Date.now() - t0;
      const data = res.ok ? ((await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null) : null;
      const content = data?.choices?.[0]?.message?.content?.trim() ?? '';
      let questions: string[] | null = null;
      try {
        const parsed2 = JSON.parse(content) as { questions?: unknown };
        if (Array.isArray(parsed2.questions) && parsed2.questions.length > 0) {
          questions = (parsed2.questions as unknown[])
            .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
            .slice(0, 5);
        }
      } catch { /* fall through to default */ }

      logger.info({
        vertical: parsed.data.vertical,
        servicesCount: parsed.data.services.length,
        elapsedMs: elapsed,
        fallback: questions === null,
      }, 'demo_suggested_questions_generated');

      if (!questions?.length) return c.json({ ok: true, questions: null, source: 'default' });
      return c.json({ ok: true, questions: questions.map((text, i) => ({ id: `q${i}`, text })), source: 'ai' });
    } catch (err) {
      logger.warn({ err, elapsedMs: Date.now() - t0 }, 'demo_suggested_questions_failed');
      return c.json({ ok: true, questions: null, source: 'default' });
    }
  });

  // Cost estimate: ~$0.001 per call (gpt-4o-mini, ~100 output tokens)
  // At 1,000 demo sessions/month = ~$1/month; at 10,000 = ~$10/month
  app.post(path('/public/demo/extract-call-summary'), async (c) => {
    const ip = getClientIp({ get: (n: string) => c.req.header(n) ?? null });
    const ipLimited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_extract_call_ip, ip);
    if (ipLimited) return c.json({ ok: true, hasRealData: false });

    const body = await c.req.json().catch(() => null);
    const parsed = z.object({
      transcript: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(1000) })).max(80),
      vertical: z.string().max(60),
      businessName: z.string().max(120),
      sessionId: z.string().max(80).optional(),
    }).safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    if (parsed.data.sessionId) {
      const sessLimited = await enforceRateLimit(
        c,
        RATE_LIMIT_POLICIES.public_demo_extract_call_session,
        `extract:${parsed.data.sessionId}`,
      );
      if (sessLimited) return c.json({ ok: true, hasRealData: false });
    }

    const turns = parsed.data.transcript;
    if (turns.length < 2) return c.json({ ok: true, hasRealData: false });

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return c.json({ ok: true, hasRealData: false });

    const transcriptText = turns
      .map((t) => `${t.role === 'user' ? 'Caller' : 'AI'}: ${t.text}`)
      .join('\n')
      .slice(0, 3000);

    const t0 = Date.now();
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 200,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are extracting structured data from a demo call transcript for a beauty salon AI receptionist. ' +
                'Extract only information explicitly mentioned by the caller. ' +
                'Do not infer or assume — if not mentioned, return null. ' +
                'Return JSON only: { "callerIntent": "booking|pricing|info|reschedule|null", ' +
                '"serviceRequested": "exact service name or null", ' +
                '"requestedTime": "time mentioned or null", ' +
                '"callerName": "name if mentioned or null", ' +
                '"additionalNotes": "any other booking detail or null" }',
            },
            {
              role: 'user',
              content: `Vertical: ${parsed.data.vertical}\nBusiness: ${parsed.data.businessName}\n\nTranscript:\n${transcriptText}`,
            },
          ],
        }),
      });

      const elapsed = Date.now() - t0;
      const data = res.ok ? ((await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null) : null;
      const content = data?.choices?.[0]?.message?.content?.trim() ?? '';

      let extracted: { callerIntent: string | null; serviceRequested: string | null; requestedTime: string | null; callerName: string | null; additionalNotes: string | null } | null = null;
      try {
        const p = JSON.parse(content) as Record<string, unknown>;
        extracted = {
          callerIntent: typeof p.callerIntent === 'string' ? p.callerIntent : null,
          serviceRequested: typeof p.serviceRequested === 'string' ? p.serviceRequested : null,
          requestedTime: typeof p.requestedTime === 'string' ? p.requestedTime : null,
          callerName: typeof p.callerName === 'string' ? p.callerName : null,
          additionalNotes: typeof p.additionalNotes === 'string' ? p.additionalNotes : null,
        };
      } catch { /* fall through */ }

      const hasRealData = extracted !== null &&
        (extracted.serviceRequested !== null || extracted.requestedTime !== null || extracted.callerName !== null);

      logger.info({
        vertical: parsed.data.vertical,
        turnCount: turns.length,
        elapsedMs: elapsed,
        hasRealData,
      }, 'demo_extract_call_summary_done');

      return c.json({ ok: true, extracted: extracted ?? null, confidence: hasRealData ? 'high' : 'low', hasRealData });
    } catch (err) {
      logger.warn({ err, elapsedMs: Date.now() - t0 }, 'demo_extract_call_summary_failed');
      return c.json({ ok: true, hasRealData: false });
    }
  });

  app.post(path('/auth/user/signup/phone-search'), async (c) => {
    /**
     * Reserved for future **post-payment** RingBooker forwarding number selection / admin tooling.
     * Not used by self-serve signup (`UserSignupForm` does not call this).
     * P1: tie to POST /user/phone-numbers/provision-forwarding-number only after payment + intent.
     */
    const body = await c.req.json().catch(() => null);
    const parsed = signupPhoneSearchSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }
    const limited = await enforceRateLimit(
      c,
      RATE_LIMIT_POLICIES.auth_signup_phone_search,
      `signup_phone_search:${parsed.data.countryCode}:${parsed.data.locality ?? 'all'}`,
    );
    if (limited) return limited;
    if (!deps.phoneProvisioningService) {
      return c.json({ ok: false, error: 'phone_provisioning_unavailable' }, 503);
    }

    const numbers = await deps.phoneProvisioningService.searchAvailableNumbers({
      countryCode: parsed.data.countryCode,
      locality: parsed.data.locality,
      administrativeArea: parsed.data.administrativeArea,
      limit: parsed.data.limit ?? 12,
    });
    return c.json({
      ok: true,
      numbers,
    });
  });

  app.post(path('/auth/user/signup'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const body = await c.req.json().catch(() => null);
    const rawPlan =
      body && typeof body === 'object' && 'plan' in body ? (body as { plan?: unknown }).plan : undefined;
    const hasValidTrialPlan = rawPlan === 'starter' || rawPlan === 'professional';
    const parsed = userSignupSchema.safeParse(body);
    if (!parsed.success) {
      if (!hasValidTrialPlan) {
        return c.json(
          {
            ok: false,
            error: 'plan_required',
            message: 'Please choose a trial plan first.',
          },
          400,
        );
      }
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }
    const normalizedEmail = parsed.data.email.toLowerCase();
    const limited = await enforceRateLimit(
      c,
      RATE_LIMIT_POLICIES.auth_signup_user,
      `user_signup:${normalizedEmail}`,
    );
    if (limited) return limited;
    if (!deps.authUsersRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'signup_dependencies_unavailable' }, 500);
    }
    if (!deps.billingCustomersRepository || !deps.billingSubscriptionsRepository || !deps.shopAccessStatesRepository) {
      return c.json({ ok: false, error: 'billing_dependencies_unavailable' }, 500);
    }

    const existing = await deps.authUsersRepository.findByEmail(normalizedEmail);
    if (existing) {
      return c.json(
        {
          ok: false,
          error: 'email_already_exists',
          message: 'Account already exists. Please log in to continue.',
        },
        409,
      );
    }

    const shopName = parsed.data.shopName?.trim() || buildDefaultShopNameFromEmail(normalizedEmail);
    /* Business main line when provided — never Telnyx-provisioned during signup (P0 onboarding sprint). */
    const businessLineRaw =
      (parsed.data.phoneNumber?.trim() || '') || (parsed.data.userPhone?.trim() || '');
    const userProvidedPhone = businessLineRaw.length >= 6 ? businessLineRaw : null;
    const ownerPhoneFromForm =
      parsed.data.userPhone?.trim().length && parsed.data.userPhone.trim().length >= 6
        ? parsed.data.userPhone.trim()
        : null;

    // When user provides a real phone, create directly. Otherwise retry up to 5x on placeholder collision.
    const createdShop = userProvidedPhone
      ? await deps.shopsRepository.create({
          name: shopName,
          brand_slug: parsed.data.brandSlug ?? toBrandSlug(shopName),
          phone_number: userProvidedPhone,
          user_phone: ownerPhoneFromForm ?? userProvidedPhone,
          user_name: parsed.data.userName ?? null,
          timezone: parsed.data.timezone,
          plan: parsed.data.plan,
          active: true,
        })
      : await createShopWithPlaceholderPhoneRetry((placeholder) =>
          deps.shopsRepository!.create({
            name: shopName,
            brand_slug: parsed.data.brandSlug ?? toBrandSlug(shopName),
            phone_number: placeholder,
            user_phone: placeholder,
            user_name: parsed.data.userName ?? null,
            timezone: parsed.data.timezone,
            plan: parsed.data.plan,
            active: true,
          }),
        );

    const authUser = await deps.authUsersRepository.create({
      email: normalizedEmail,
      role: 'user',
      shopId: createdShop.id,
      passwordHash: hashPassword(parsed.data.password),
      active: true,
      mfaEnabled: false,
    });

    const trial = await createNoCardTrialForShop(
      {
        billingCustomersRepository: deps.billingCustomersRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopAccessStatesRepository: deps.shopAccessStatesRepository,
      },
      {
        shopId: createdShop.id,
        email: authUser.email,
        plan: parsed.data.plan,
      },
    );

    const token = await signSessionToken({
      role: 'user',
      email: authUser.email,
      shopId: authUser.shopId ?? undefined,
      ttlHours: parsed.data.remember ? 24 * 14 : 24,
    });
    setCookie(c, USER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: (parsed.data.remember ? 24 * 14 : 24) * 3600,
    });
    deleteCookie(c, ADMIN_SESSION_COOKIE, { path: '/' });

    securityAudit({
      action: 'auth_signup_success',
      actorType: 'user',
      actorId: authUser.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId: createdShop.id,
        phoneNumber: createdShop.phone_number,
      },
    });

    await sendSignupWelcomeEmail({
      emailService: deps.emailService,
      email: authUser.email,
      shopName: createdShop.name,
      shopId: createdShop.id,
      trialEndsAt: trial.subscription.trialEndsAt ?? undefined,
      shopTimezone: createdShop.timezone,
      appBaseUrl: getAppBaseUrl(c.req),
      idempotencyKey: `signup-welcome:${authUser.id}`,
    });

    const postAuthRedirect = computeUserPostAuthRedirectPath({ shop: createdShop, shopId: createdShop.id });

    return c.json(
      {
        ok: true,
        role: 'user',
        shopId: createdShop.id,
        onboardingRequired: !isShopSetupWizardComplete(createdShop),
        postAuthRedirect,
        billing: {
          subscriptionStatus: trial.subscription.status,
          trialEndsAt: trial.subscription.trialEndsAt ?? null,
          paymentMethodStatus: trial.subscription.paymentMethodStatus ?? 'none',
          liveCallsEnabled: trial.accessState.liveCallsEnabled,
        },
        shop: {
          id: createdShop.id,
          name: createdShop.name,
          phone_number: createdShop.phone_number,
        },
      },
      201,
    );
  });

  app.get(path('/auth/user/google/start'), async (c) => {
    const appBaseUrl = getAppBaseUrl(c.req);
    const intentRaw = c.req.query('intent');
    const planRaw = c.req.query('plan');
    const intent: 'login' | 'signup' = intentRaw === 'signup' ? 'signup' : 'login';
    if (intent === 'signup') {
      if (planRaw !== 'starter' && planRaw !== 'professional') {
        return c.redirect(`${appBaseUrl}/pricing?reason=plan_required`, 302);
      }
    }
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.auth_google_user, `auth_google_start:${intent}`);
    if (limited) return limited;
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    if (!clientId) {
      return c.json({ ok: false, error: 'google_oauth_not_configured' }, 503);
    }

    const oauthState = randomUUID();
    setCookie(c, 'rb_google_oauth_state', oauthState, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: 600,
    });
    setCookie(c, 'rb_google_oauth_intent', intent, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: 600,
    });
    if (intent === 'signup' && (planRaw === 'starter' || planRaw === 'professional')) {
      setCookie(c, 'rb_google_oauth_selected_plan', planRaw, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'Lax',
        path: '/',
        maxAge: 600,
      });
    } else {
      deleteCookie(c, 'rb_google_oauth_selected_plan', { path: '/' });
    }
    const redirectUri = `${appBaseUrl}/api/backend/auth/user/google/callback`;
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'select_account');
    googleAuthUrl.searchParams.set('state', oauthState);

    return c.redirect(googleAuthUrl.toString(), 302);
  });

  app.get(path('/auth/user/google/callback'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.auth_google_user, 'auth_google_callback');
    if (limited) {
      clearUserGoogleOAuthCookies(c);
      return limited;
    }
    if (!deps.authUsersRepository || !deps.shopsRepository) {
      clearUserGoogleOAuthCookies(c);
      return c.json({ ok: false, error: 'signup_dependencies_unavailable' }, 500);
    }
    if (!deps.billingCustomersRepository || !deps.billingSubscriptionsRepository || !deps.shopAccessStatesRepository) {
      clearUserGoogleOAuthCookies(c);
      return c.json({ ok: false, error: 'billing_dependencies_unavailable' }, 500);
    }
    const state = c.req.query('state');
    const code = c.req.query('code');
    const oauthError = c.req.query('error');
    const oauthStateCookie = getCookie(c, 'rb_google_oauth_state');
    const oauthIntent = getCookie(c, 'rb_google_oauth_intent') ?? 'login';
    const oauthSelectedPlanRaw = getCookie(c, 'rb_google_oauth_selected_plan');
    clearUserGoogleOAuthCookies(c);

    const appBaseUrl = getAppBaseUrl(c.req);
    if (oauthError || !code || !state || !oauthStateCookie || state !== oauthStateCookie) {
      return c.redirect(`${appBaseUrl}/user/login?error=google_oauth_denied`, 302);
    }

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      return c.redirect(`${appBaseUrl}/user/login?error=google_oauth_not_configured`, 302);
    }
    const redirectUri = `${appBaseUrl}/api/backend/auth/user/google/callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!tokenResponse.ok) {
      return c.redirect(`${appBaseUrl}/user/login?error=google_exchange_failed`, 302);
    }
    const tokenBody = (await tokenResponse.json()) as { id_token?: string };
    const idToken = tokenBody.id_token;
    if (!idToken) {
      return c.redirect(`${appBaseUrl}/user/login?error=google_missing_id_token`, 302);
    }

    let googleProfile: Awaited<ReturnType<typeof verifyGoogleIdToken>>;
    try {
      googleProfile = await verifyGoogleIdToken(idToken);
    } catch {
      return c.redirect(`${appBaseUrl}/user/login?error=google_verify_failed`, 302);
    }
    if (!googleProfile.emailVerified) {
      return c.redirect(`${appBaseUrl}/user/login?error=google_email_not_verified`, 302);
    }
    if (googleProfile.aud !== clientId) {
      return c.redirect(`${appBaseUrl}/user/login?error=google_invalid_audience`, 302);
    }

    let authUser = await deps.authUsersRepository.findByEmail(googleProfile.email);
    if (authUser && authUser.role !== 'user') {
      return c.redirect(`${appBaseUrl}/user/login?error=google_role_conflict`, 302);
    }
    if (authUser && !authUser.active) {
      return c.redirect(`${appBaseUrl}/user/login?error=account_inactive`, 302);
    }
    if (authUser && oauthIntent === 'signup') {
      return c.redirect(`${appBaseUrl}/user/login?error=account_exists`, 302);
    }

    let createdViaGoogleSignup = false;
    let shop: Shop | null = null;
    if (!authUser) {
      if (oauthIntent === 'login') {
        return c.redirect(`${appBaseUrl}/user/login?error=no_ringbooker_account`, 302);
      }
      const selectedPlan =
        oauthSelectedPlanRaw === 'starter' || oauthSelectedPlanRaw === 'professional' ? oauthSelectedPlanRaw : null;
      if (!selectedPlan) {
        return c.redirect(`${appBaseUrl}/pricing?reason=plan_required`, 302);
      }
      const shopName = buildDefaultShopNameFromEmail(googleProfile.email);
      shop = await createShopWithPlaceholderPhoneRetry((placeholder) =>
        deps.shopsRepository!.create({
          name: shopName,
          brand_slug: toBrandSlug(shopName),
          phone_number: placeholder,
          user_phone: placeholder,
          user_name: googleProfile.name?.trim() || null,
          timezone: process.env.DEFAULT_SHOP_TIMEZONE ?? 'America/Los_Angeles',
          plan: selectedPlan!,
          active: true,
        }),
      );
      authUser = await deps.authUsersRepository.create({
        email: googleProfile.email,
        role: 'user',
        shopId: shop.id,
        passwordHash: createOAuthFallbackPasswordHash(),
        active: true,
        mfaEnabled: false,
      });
      await createNoCardTrialForShop(
        {
          billingCustomersRepository: deps.billingCustomersRepository,
          billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
          shopAccessStatesRepository: deps.shopAccessStatesRepository,
        },
        {
          shopId: shop.id,
          email: authUser.email,
          plan: selectedPlan,
        },
      );
      createdViaGoogleSignup = true;
    } else if (authUser.shopId) {
      shop = await deps.shopsRepository.findById(authUser.shopId);
    }

    const token = await signSessionToken({
      role: 'user',
      email: authUser.email,
      shopId: authUser.shopId ?? undefined,
      ttlHours: 24 * 14,
    });
    setCookie(c, USER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: 24 * 14 * 3600,
    });
    deleteCookie(c, ADMIN_SESSION_COOKIE, { path: '/' });

    securityAudit({
      action: createdViaGoogleSignup ? 'auth_google_signup_success' : 'auth_google_success',
      actorType: 'user',
      actorId: googleProfile.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        intent: oauthIntent,
        shopId: authUser.shopId ?? shop?.id ?? null,
      },
    });

    if (createdViaGoogleSignup && shop) {
      const trial = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
      await sendSignupWelcomeEmail({
        emailService: deps.emailService,
        email: authUser.email,
        shopName: shop.name,
        shopId: shop.id,
        trialEndsAt: trial?.trialEndsAt ?? undefined,
        shopTimezone: shop.timezone,
        appBaseUrl,
        idempotencyKey: `google-signup-welcome:${authUser.id}`,
      });
    }

    const postAuthRedirect = computeUserPostAuthRedirectPath({ shop, shopId: authUser.shopId });
    return c.redirect(`${appBaseUrl}${postAuthRedirect}`, 302);
  });

  app.post(path('/auth/user/login'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const body = await c.req.json().catch(() => null);
    const parsed = authLoginSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }
    const limited = await enforceRateLimit(
      c,
      RATE_LIMIT_POLICIES.auth_login_user,
      `user_login:${parsed.data.email.toLowerCase()}`,
    );
    if (limited) return limited;

    if (!deps.authUsersRepository) {
      return c.json({ ok: false, error: 'auth_repository_unavailable' }, 500);
    }
    const authUser = await deps.authUsersRepository.findByEmail(parsed.data.email.toLowerCase());
    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    if (!authUser || authUser.role !== 'user' || !authUser.active || !verifyPassword(parsed.data.password, authUser.passwordHash)) {
      securityAudit({
        action: 'auth_login_failed',
        actorType: 'user',
        actorId: parsed.data.email.toLowerCase(),
        ip,
        path: c.req.path,
      });
      return c.json({ ok: false, error: 'invalid_credentials' }, 401);
    }

    const token = await signSessionToken({
      role: 'user',
      email: authUser.email,
      shopId: authUser.shopId ?? undefined,
      ttlHours: parsed.data.remember ? 24 * 14 : 24,
    });

    setCookie(c, USER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: (parsed.data.remember ? 24 * 14 : 24) * 3600,
    });
    deleteCookie(c, ADMIN_SESSION_COOKIE, { path: '/' });
    securityAudit({
      action: 'auth_login_success',
      actorType: 'user',
      actorId: authUser.email,
      ip,
      path: c.req.path,
    });

    const shop =
      authUser.shopId && deps.shopsRepository ? await deps.shopsRepository.findById(authUser.shopId) : null;

    const postAuthRedirect = computeUserPostAuthRedirectPath({ shop, shopId: authUser.shopId });

    return c.json({
      ok: true,
      role: 'user',
      shopId: authUser.shopId ?? undefined,
      onboardingRequired: shop ? !isShopSetupWizardComplete(shop) : false,
      postAuthRedirect,
    });
  });

  app.post(path('/auth/admin/login'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const body = await c.req.json().catch(() => null);
    const parsed = authLoginSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }
    const limited = await enforceRateLimit(
      c,
      RATE_LIMIT_POLICIES.auth_login_admin,
      `admin_login:${parsed.data.email.toLowerCase()}`,
    );
    if (limited) return limited;

    if (!deps.authUsersRepository) {
      return c.json({ ok: false, error: 'auth_repository_unavailable' }, 500);
    }
    const authUser = await deps.authUsersRepository.findByEmail(parsed.data.email.toLowerCase());
    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    if (!authUser || authUser.role !== 'admin' || !authUser.active || !verifyPassword(parsed.data.password, authUser.passwordHash)) {
      securityAudit({
        action: 'auth_login_failed',
        actorType: 'admin',
        actorId: parsed.data.email.toLowerCase(),
        ip,
        path: c.req.path,
      });
      return c.json({ ok: false, error: 'invalid_credentials' }, 401);
    }

    const token = await signSessionToken({
      role: 'admin',
      email: authUser.email,
      ttlHours: parsed.data.remember ? 24 * 14 : 24,
    });

    setCookie(c, ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: (parsed.data.remember ? 24 * 14 : 24) * 3600,
    });
    deleteCookie(c, USER_SESSION_COOKIE, { path: '/' });
    securityAudit({
      action: 'auth_login_success',
      actorType: 'admin',
      actorId: authUser.email,
      ip,
      path: c.req.path,
    });

    return c.json({
      ok: true,
      role: 'admin',
    });
  });

  app.post(path('/auth/user/forgot-password'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.auth_forgot_user, 'auth_forgot_user');
    if (limited) return limited;
    const body = await c.req.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    if (!deps.authUsersRepository) return c.json({ ok: false, error: 'auth_repository_unavailable' }, 500);

    const email = parsed.data.email.toLowerCase();
    const authUser = await deps.authUsersRepository.findByEmail(email);
    let resetToken: string | undefined;
    let outcome: 'reset_email_sent' | 'account_not_found' = 'account_not_found';
    if (authUser && authUser.role === 'user' && authUser.active) {
      outcome = 'reset_email_sent';
      resetToken = `${randomUUID()}${randomBytes(12).toString('hex')}`;
      await deps.authUsersRepository.createPasswordResetToken({
        userId: authUser.id,
        tokenHash: hashPasswordResetToken(resetToken),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      });
      securityAudit({
        action: 'auth_password_reset_requested',
        actorType: 'user',
        actorId: authUser.email,
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
      });
      await sendPasswordResetEmail({
        emailService: deps.emailService,
        email,
        resetToken,
        role: 'user',
        appBaseUrl: getAppBaseUrl(c.req),
      });
    }

    return c.json({
      ok: true,
      outcome,
      accepted: outcome === 'reset_email_sent',
      ...(process.env.NODE_ENV !== 'production' && resetToken ? { resetToken } : {}),
    });
  });

  app.post(path('/auth/admin/forgot-password'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.auth_forgot_admin, 'auth_forgot_admin');
    if (limited) return limited;
    const body = await c.req.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    if (!deps.authUsersRepository) return c.json({ ok: false, error: 'auth_repository_unavailable' }, 500);

    const email = parsed.data.email.toLowerCase();
    const authUser = await deps.authUsersRepository.findByEmail(email);
    let resetToken: string | undefined;
    let outcome: 'reset_email_sent' | 'account_not_found' = 'account_not_found';
    if (authUser && authUser.role === 'admin' && authUser.active) {
      outcome = 'reset_email_sent';
      resetToken = `${randomUUID()}${randomBytes(12).toString('hex')}`;
      await deps.authUsersRepository.createPasswordResetToken({
        userId: authUser.id,
        tokenHash: hashPasswordResetToken(resetToken),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      });
      securityAudit({
        action: 'auth_password_reset_requested',
        actorType: 'admin',
        actorId: authUser.email,
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
      });
      await sendPasswordResetEmail({
        emailService: deps.emailService,
        email,
        resetToken,
        role: 'admin',
        appBaseUrl: getAppBaseUrl(c.req),
      });
    }

    return c.json({
      ok: true,
      outcome,
      accepted: outcome === 'reset_email_sent',
      ...(process.env.NODE_ENV !== 'production' && resetToken ? { resetToken } : {}),
    });
  });

  app.post(path('/auth/reset-password'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.auth_reset_password, 'auth_reset_password');
    if (limited) return limited;
    const body = await c.req.json().catch(() => null);
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    if (!deps.authUsersRepository) return c.json({ ok: false, error: 'auth_repository_unavailable' }, 500);

    const consumed = await deps.authUsersRepository.consumePasswordResetToken(hashPasswordResetToken(parsed.data.token));
    if (!consumed) return c.json({ ok: false, error: 'invalid_or_expired_token' }, 400);

    await deps.authUsersRepository.updatePasswordHash(consumed.userId, hashPassword(parsed.data.newPassword));
    securityAudit({
      action: 'auth_password_reset_completed',
      actorType: 'public',
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: { userId: consumed.userId },
    });

    return c.json({ ok: true, updated: true });
  });

  app.post(path('/auth/logout'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    deleteCookie(c, USER_SESSION_COOKIE, { path: '/' });
    deleteCookie(c, ADMIN_SESSION_COOKIE, { path: '/' });
    securityAudit({
      action: 'auth_logout',
      actorType: 'public',
      ip,
      path: c.req.path,
    });
    return c.json({ ok: true });
  });

  app.get(path('/auth/me'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.auth_session_read, 'auth_me');
    if (limited) return limited;
    const session = await readSession(c);
    if (!session) return c.json({ ok: false, error: 'unauthorized' }, 401);
    return c.json({
      ok: true,
      session,
    });
  });

  app.get(path('/user/dashboard'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_dashboard');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.bookingsRepository || !deps.callLogsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const [bookingCount, callCount, missedCalls, commercialAccount, recentCallRows] = await Promise.all([
      deps.bookingsRepository.countByShop(shop.id),
      deps.callLogsRepository.countByShop(shop.id, {}),
      deps.callLogsRepository.countByShop(shop.id, { outcome: 'missed' }),
      deps.commercialAccountsRepository ? deps.commercialAccountsRepository.findByShopId(shop.id).catch(() => null) : Promise.resolve(null),
      deps.callLogsRepository.listByShop(shop.id, { limit: 3 }),
    ]);
    let usage: Awaited<ReturnType<typeof getShopUsageForPeriod>> | null = null;
    let usageTimedOut = false;
    let usageTimeout: ReturnType<typeof setTimeout> | null = null;
    const usageTimeoutPromise = new Promise<null>((resolve) => {
      usageTimeout = setTimeout(() => {
        usageTimedOut = true;
        logger.warn({ shopId: shop.id }, 'user_dashboard_usage_timeout');
        resolve(null);
      }, 2500);
    });
    usage = await Promise.race([
      getShopUsageForPeriod(
        {
          callLogsRepository: deps.callLogsRepository,
          shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
        },
        { shop, commercialAccount },
      ).catch((err) => {
        logger.warn({ err, shopId: shop.id }, 'user_dashboard_usage_unavailable');
        return null;
      }),
      usageTimeoutPromise,
    ]);
    if (!usageTimedOut && usageTimeout) clearTimeout(usageTimeout);

    let goLive: {
      liveCallsEnabled: boolean;
      primaryCta: ReturnType<typeof resolveGoLiveDashboardPrimaryCta>;
      forwardingSetupVerified: boolean;
      hasForwardingNumber: boolean;
      paymentMethodValid: boolean;
      subscriptionActiveLike: boolean;
      billingTrialing: boolean;
      blockReason: BillingBlockReason;
      commercialGoLiveApproved: boolean;
      commercialApprovalRequired: boolean;
    } | null = null;

    if (deps.billingSubscriptionsRepository && deps.shopAccessStatesRepository) {
      const access = await getShopBillingAccess(
        {
          shopsRepository: deps.shopsRepository,
          billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
          shopAccessStatesRepository: deps.shopAccessStatesRepository,
          testCallAttemptsRepository: deps.testCallAttemptsRepository,
        },
        { shopId: shop.id },
      );
      const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
      const now = new Date();
      const commercialApprovalRequired = access.blockReason === 'commercial_approval_required';
      goLive = {
        liveCallsEnabled: access.liveCallsEnabled,
        primaryCta: commercialApprovalRequired ? null : resolveGoLiveDashboardPrimaryCta({
          liveCallsEnabled: access.liveCallsEnabled,
          subscription,
          paymentMethodStatus: access.paymentMethodStatus,
          hasForwardingNumber: access.hasForwardingNumber,
          forwardingSetupVerified: access.forwardingSetupVerified,
          now,
        }),
        forwardingSetupVerified: access.forwardingSetupVerified,
        hasForwardingNumber: access.hasForwardingNumber,
        paymentMethodValid: access.paymentMethodStatus === 'valid',
        subscriptionActiveLike:
          subscription?.status === 'active' || (subscription ? isBillingTrialStillValid(subscription, now) : false),
        billingTrialing: Boolean(
          subscription?.status === 'trialing' && subscription && isBillingTrialStillValid(subscription, now),
        ),
        blockReason: access.blockReason,
        commercialGoLiveApproved: access.commercialGoLiveApproved,
        commercialApprovalRequired,
      };
    }

    const onboardingRequired = !isShopSetupWizardComplete(shop);
    const recentCalls = recentCallRows.map((row) => ({
      requestId: row.requestId,
      startedAt: row.startedAt,
      callerPhone: row.callerPhone,
      outcome: row.outcome,
      subtitle: row.summaryServiceRequest ?? null,
    }));

    const overviewRail = buildDashboardOverviewRail({
      shop,
      onboardingRequired,
      goLive,
      usage: usage
        ? {
            nearCapturedCallerLimit: usage.nearCapturedCallerLimit,
            overCapturedCallerLimit: usage.overCapturedCallerLimit,
          }
        : null,
      recentCalls,
      totalCallCount: callCount,
    });

    const calendarBooking = resolveCalendarBookingStatus(shop);
    const overviewSnapshot = {
      hasServices: shopHasConfiguredServices(shop),
      hasHours: shopHasConfiguredBusinessHours(shop),
      integrationConnected: calendarBooking.ready,
      integrationLabel: calendarBooking.detail,
    };

    return c.json({
      ok: true,
      shop: {
        id: shop.id,
        name: shop.name,
        phone_number: shop.phone_number,
        address: shop.address ?? null,
        timezone: shop.timezone,
        plan: shop.plan,
        active: shop.active,
      },
      onboardingRequired,
      onboardingCompleted: isShopSetupWizardComplete(shop),
      metrics: {
        bookingCount,
        callCount,
        missedCalls,
      },
      usage,
      goLive,
      overviewRail,
      overviewSnapshot,
    });
  });

  app.get(path('/user/notifications'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_notifications');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    if (
      !deps.billingSubscriptionsRepository ||
      !deps.shopAccessStatesRepository ||
      !deps.testCallAttemptsRepository
    ) {
      return c.json({ ok: true, notifications: [] });
    }

    const now = new Date();
    const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
    const access = await getShopBillingAccess(
      {
        shopsRepository: deps.shopsRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopAccessStatesRepository: deps.shopAccessStatesRepository,
        testCallAttemptsRepository: deps.testCallAttemptsRepository,
      },
      { shopId: shop.id },
    );

    let usage: UserPortalNotificationsUsageInput = null;
    if (deps.callLogsRepository) {
      const commercialAccount = deps.commercialAccountsRepository
        ? await deps.commercialAccountsRepository.findByShopId(shop.id).catch(() => null)
        : null;
      const usageRow = await getShopUsageForPeriod(
        {
          callLogsRepository: deps.callLogsRepository,
          shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
        },
        { shop, commercialAccount },
      ).catch(() => null);
      if (usageRow) {
        usage = {
          nearCapturedCallerLimit: usageRow.nearCapturedCallerLimit,
          overCapturedCallerLimit: usageRow.overCapturedCallerLimit,
          capturedCallersUsed: usageRow.capturedCallersUsed,
          capturedCallersLimit: usageRow.capturedCallersLimit,
        };
      }
    }

    const notifications = buildUserPortalNotifications({
      access,
      subscription,
      usage,
      now,
      shopTimezone: shop.timezone,
    });

    return c.json({ ok: true, notifications });
  });

  app.get(path('/user/onboarding-status'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_onboarding_status');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    let paymentMethodStatus: ShopBillingAccess['paymentMethodStatus'] = 'none';
    let liveCallsEnabled = false;
    let forwardingSetupVerified = false;
    if (deps.billingSubscriptionsRepository && deps.shopAccessStatesRepository) {
      const access = await getShopBillingAccess(
        {
          shopsRepository: deps.shopsRepository,
          billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
          shopAccessStatesRepository: deps.shopAccessStatesRepository,
          testCallAttemptsRepository: deps.testCallAttemptsRepository,
        },
        { shopId: shop.id },
      );
      paymentMethodStatus = access.paymentMethodStatus;
      liveCallsEnabled = access.liveCallsEnabled;
      forwardingSetupVerified = access.forwardingSetupVerified;
    }

    const onboardingCompleted = isShopSetupWizardComplete(shop);
    const serviceCatalogEnabled = getEnv().SERVICE_CATALOG_ENABLED;

    return c.json({
      ok: true,
      onboardingRequired: !onboardingCompleted,
      onboardingCompleted,
      liveCallsEnabled,
      forwardingSetupVerified,
      paymentMethodStatus,
      serviceCatalogEnabled,
      shop: {
        id: shop.id,
        name: shop.name,
        vertical: shop.vertical ?? null,
        vertical_detail: shop.vertical_detail ?? null,
        phone_number: shop.phone_number,
        user_name: shop.user_name ?? '',
        user_phone: shop.user_phone ?? '',
        timezone: shop.timezone,
        cancel_policy: shop.cancel_policy,
        services: shop.services,
        service_catalog: serviceCatalogEnabled ? toUserFacingServiceCatalog(shop.service_catalog) : null,
        hours: shop.hours,
        languages: shop.languages ?? ['en'],
        website_url: shop.website_url ?? '',
        address: shop.address ?? null,
        booking_url: shop.booking_url ?? '',
        booking_method: shop.booking_method ?? null,
        selected_integration: shop.selected_integration ?? null,
        current_onboarding_step: shop.current_onboarding_step ?? 1,
        setup_method: shop.setup_method ?? null,
        forwarding_type: shop.forwarding_type ?? 'no_answer',
        forwarding_carrier: shop.forwarding_carrier ?? null,
        forwarding_country: shop.forwarding_country ?? 'us',
        telnyx_number: shop.telnyx_number ?? '',
        plan: shop.plan,
      },
    });
  });

  app.post(path('/user/onboarding/import-website'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_website_import, 'user_onboarding_import_website');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = importWebsiteSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!getEnv().WEBSITE_IMPORT_ENABLED) {
      return c.json({ ok: false, error: 'website_import_disabled' }, 503);
    }

    try {
      const env = getEnv();
      // Onboarding can afford a longer crawl for a more complete import.
      const onboardingImportBudgetMs = 28_000;
      const result = await importWebsiteWithCache({ url: parsed.data.url, qualityBudgetMs: onboardingImportBudgetMs }, () =>
        importWebsiteForOnboarding({ url: parsed.data.url }, {
          googlePlacesApiKey: env.GOOGLE_PLACES_API_KEY,
          llmEnabled: env.WEBSITE_IMPORT_LLM_ENABLED,
          openAiApiKey: env.OPENAI_API_KEY,
          llmModel: env.WEBSITE_IMPORT_LLM_MODEL,
          llmMaxTokens: env.WEBSITE_IMPORT_LLM_MAX_TOKENS,
          maxBytes: env.WEBSITE_IMPORT_MAX_BYTES,
          renderEndpoint: env.WEBSITE_IMPORT_RENDER_URL,
          renderApiKey: env.WEBSITE_IMPORT_RENDER_API_KEY,
          deadlineMs: onboardingImportBudgetMs,
        }),
      );
      if (result.diagnostics.warnings.length > 0) {
        logger.info({ shopId: shop.id, warnings: [...new Set([...result.diagnostics.warnings, ...result.suggestions.warnings])], selectedPageCount: result.diagnostics.selectedPages.length }, 'website_import_completed_with_warnings');
      }
      const secondaryCreates = pendingSuggestionsFromImport(result.suggestions);
      if (secondaryCreates.length > 0 && deps.businessKnowledgeSuggestionsRepository) {
        try {
          await deps.businessKnowledgeSuggestionsRepository.createPendingSuggestions(shop.id, result.suggestions.sourceUrl, secondaryCreates);
        } catch (err) {
          logger.warn({ err, shopId: shop.id, suggestionCount: secondaryCreates.length }, 'business_knowledge_suggestions_persist_failed');
        }
      }
      return c.json({
        ok: result.ok,
        suggestions: result.suggestions,
        secondarySuggestionsSummary: secondarySummary(result.suggestions),
        warnings: [...new Set([...result.diagnostics.warnings, ...result.suggestions.warnings])],
      });
    } catch (err) {
      logger.warn({ err, shopId: shop.id }, 'website_import_failed');
      return c.json({
        ok: false,
        error: 'website_import_failed',
        message: 'We could not read that website right now. You can continue manually.',
      }, 200);
    }
  });

  app.get(path('/user/business-knowledge/suggestions'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_business_knowledge_suggestions_get');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.businessKnowledgeSuggestionsRepository) return c.json({ ok: false, error: 'suggestions_repository_unavailable' }, 500);
    const suggestions = await deps.businessKnowledgeSuggestionsRepository.listPendingSuggestions(sessionResult.shopId ?? '');
    const counts = suggestions.reduce<Record<string, number>>((acc, item) => {
      acc[item.suggestionType] = (acc[item.suggestionType] ?? 0) + 1;
      return acc;
    }, {});
    return c.json({
      ok: true,
      suggestions: suggestions.map((item) => ({
        id: item.id,
        sourceUrl: item.sourceUrl,
        suggestionType: item.suggestionType,
        payload: item.payload,
        confidence: item.confidence,
        source: item.source,
        evidenceSnippet: item.evidenceSnippet,
        createdAt: item.createdAt,
      })),
      counts,
    });
  });

  app.post(path('/user/business-knowledge/suggestions/apply'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_business_knowledge_suggestions_apply');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.businessKnowledgeSuggestionsRepository || !deps.shopsRepository) return c.json({ ok: false, error: 'suggestions_dependencies_unavailable' }, 500);
    const body = await c.req.json().catch(() => null);
    const parsed = applyBusinessKnowledgeSuggestionsSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const ids = [...new Set(parsed.data.suggestionIds)];
    const suggestions = await deps.businessKnowledgeSuggestionsRepository.findByIds(shop.id, ids);
    if (suggestions.length !== ids.length) return c.json({ ok: false, error: 'suggestion_not_found' }, 404);
    if (suggestions.some((item) => item.status !== 'pending')) return c.json({ ok: false, error: 'suggestion_not_pending' }, 400);
    for (const [id, payload] of Object.entries(parsed.data.editedPayloads ?? {})) {
      const suggestion = suggestions.find((item) => item.id === id);
      if (!suggestion) return c.json({ ok: false, error: 'invalid_edited_payload' }, 400);
      if (!validateSuggestionPayload(suggestion.suggestionType, payload)) return c.json({ ok: false, error: 'invalid_edited_payload' }, 400);
    }
    const patch = buildApplyPatchForSuggestions(shop, suggestions, parsed.data.editedPayloads);
    if (patch) {
      const updated = await deps.shopsRepository.updateUserSettings(shop.id, patch);
      if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    }
    const applied = await deps.businessKnowledgeSuggestionsRepository.markApplied(shop.id, ids);
    return c.json({ ok: true, appliedCount: applied.length });
  });

  app.post(path('/user/business-knowledge/suggestions/dismiss'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_business_knowledge_suggestions_dismiss');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.businessKnowledgeSuggestionsRepository) return c.json({ ok: false, error: 'suggestions_repository_unavailable' }, 500);
    const body = await c.req.json().catch(() => null);
    const parsed = suggestionIdListSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const ids = [...new Set(parsed.data.suggestionIds)];
    const suggestions = await deps.businessKnowledgeSuggestionsRepository.findByIds(sessionResult.shopId ?? '', ids);
    if (suggestions.length !== ids.length) return c.json({ ok: false, error: 'suggestion_not_found' }, 404);
    if (suggestions.some((item) => item.status !== 'pending')) return c.json({ ok: false, error: 'suggestion_not_pending' }, 400);
    const dismissed = await deps.businessKnowledgeSuggestionsRepository.markDismissed(sessionResult.shopId ?? '', ids);
    return c.json({ ok: true, dismissedCount: dismissed.length });
  });

  // Legacy mutating website import endpoint. Do not use this for onboarding review:
  // `/user/onboarding/import-website` is the suggestions-only flow that waits for user confirmation.
  app.post(path('/user/read-website'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_read_website');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = readWebsiteSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const serviceCatalogEnabled = getEnv().SERVICE_CATALOG_ENABLED;

    const updated = await deps.shopsRepository.updateUserSettings(sessionResult.shopId ?? '', {
      website_url: parsed.data.url,
    });
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    let servicesFound = 0;
    if (serviceCatalogEnabled && parsed.data.services?.length) {
      const currentCatalog = await deps.shopsRepository.findServiceCatalogByShopId(shop.id);
      const merged = mergeImportedServicesIntoCatalog({
        shopId: shop.id,
        currentCatalog,
        importedServices: parsed.data.services,
        vertical: shop.vertical,
        idForCategory: () => randomUUID(),
        idForService: () => randomUUID(),
      });
      servicesFound = merged.addedCount;
      if (servicesFound > 0) {
        await deps.shopsRepository.saveServiceCatalog(shop.id, merged.catalog);
      }
    }

    return c.json({
      ok: true,
      success: true,
      servicesFound,
      imported: servicesFound > 0,
      todo: !serviceCatalogEnabled && parsed.data.services?.length ? 'service_catalog_disabled' : parsed.data.services?.length ? undefined : 'website_scraping_not_implemented',
    });
  });

  app.post(path('/user/go-live/start-forwarding-test'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_start_forwarding_test, 'user_start_forwarding_test');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;

    if (
      !deps.shopsRepository ||
      !deps.billingSubscriptionsRepository ||
      !deps.shopAccessStatesRepository ||
      !deps.forwardingTestSessionsRepository
    ) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const result = await startOrReuseForwardingTestSession({
      deps: {
        shopsRepository: deps.shopsRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopAccessStatesRepository: deps.shopAccessStatesRepository,
        forwardingTestSessionsRepository: deps.forwardingTestSessionsRepository,
        testCallAttemptsRepository: deps.testCallAttemptsRepository,
      },
      shop,
    });

    if (!result.ok) {
      const body: Record<string, unknown> = {
        ok: false,
        error: result.error,
        message: result.message,
      };
      if (result.billingUrl) body.billingUrl = result.billingUrl;
      if (result.error === 'payment_method_required') {
        body.message = buildGoLivePaymentRequiredMessage();
      }
      return c.json(body, result.httpStatus as 400);
    }

    return c.json({
      ok: true,
      status: result.status,
      expiresAt: result.expiresAt,
      instruction: result.instruction,
      sessionId: result.sessionId,
    });
  });

  app.get(path('/user/go-live/status'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_go_live_status');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;

    if (!deps.shopsRepository || !deps.billingSubscriptionsRepository || !deps.shopAccessStatesRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const access = await getShopBillingAccess(
      {
        shopsRepository: deps.shopsRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopAccessStatesRepository: deps.shopAccessStatesRepository,
        testCallAttemptsRepository: deps.testCallAttemptsRepository,
      },
      { shopId: shop.id },
    );

    const accessState = await deps.shopAccessStatesRepository.findByShopId(shop.id);
    const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
    const now = new Date();
    const gate = evaluateKnowledgeGate(shop);
    const knowledgeGatePassed = canProceedToGoLive(gate);

    let forwardingTestStatus: 'none' | 'pending' | 'passed' | 'expired' | 'failed' = 'none';
    let forwardingTestExpiresAt: string | null = null;
    if (deps.forwardingTestSessionsRepository) {
      const latest = await deps.forwardingTestSessionsRepository.findLatestByShopId(shop.id);
      if (latest) {
        if (latest.status === 'pending') {
          if (new Date(latest.expiresAt).getTime() > now.getTime()) {
            forwardingTestStatus = 'pending';
            forwardingTestExpiresAt = latest.expiresAt;
          } else {
            forwardingTestStatus = 'expired';
            forwardingTestExpiresAt = latest.expiresAt;
          }
        } else {
          forwardingTestStatus = latest.status;
        }
      }
    }

    const primaryCta = resolveGoLiveDashboardPrimaryCta({
      liveCallsEnabled: access.liveCallsEnabled,
      subscription,
      paymentMethodStatus: access.paymentMethodStatus,
      hasForwardingNumber: access.hasForwardingNumber,
      forwardingSetupVerified: access.forwardingSetupVerified,
      now,
    });

    const blockReason = !knowledgeGatePassed && access.canGoLive ? 'knowledge_incomplete' : access.blockReason;
    const canGoLive = access.canGoLive && knowledgeGatePassed;

    return c.json({
      ok: true,
      businessPhone: shop.phone_number?.trim() || null,
      businessAddress: shop.address?.trim() || null,
      paymentMethodStatus: access.paymentMethodStatus,
      subscriptionStatus: access.subscriptionStatus,
      providerCustomerId: access.providerCustomerId,
      providerSubscriptionId: access.providerSubscriptionId,
      hasPaymentMethod: access.paymentMethodStatus === 'valid',
      forwardingNumber: shop.telnyx_number?.trim() || null,
      hasForwardingNumber: access.hasForwardingNumber,
      forwardingSetupVerified: access.forwardingSetupVerified,
      forwardingSetupVerifiedAt: accessState?.forwardingSetupVerifiedAt ?? null,
      forwardingSetupVerifiedVia: accessState?.forwardingSetupVerifiedVia ?? null,
      forwardingTestStatus,
      forwardingTestExpiresAt,
      liveCallsEnabled: access.liveCallsEnabled,
      canGoLive,
      primaryCta: access.blockReason === 'commercial_approval_required' ? null : primaryCta,
      blockReason,
      commercialGoLiveApproved: access.commercialGoLiveApproved,
      commercialApprovalRequired: access.blockReason === 'commercial_approval_required',
      gate,
      status: {
        knowledgeGate: {
          businessName: gate.find((item) => item.key === 'businessName')?.passed ?? false,
          timezone: gate.find((item) => item.key === 'timezone')?.passed ?? false,
          hours: gate.find((item) => item.key === 'hours')?.passed ?? false,
          hasServices: gate.find((item) => item.key === 'services')?.passed ?? false,
          passed: knowledgeGatePassed,
        },
        billing: {
          status: billingStatusForGoLive(subscription),
          trialEndsAt: subscription?.trialEndsAt ?? null,
          paymentMethodAdded: access.paymentMethodStatus === 'valid',
        },
        provision: {
          status: provisionStatusForGoLive(shop),
          ringbookerNumber: shop.telnyx_number?.trim() || null,
          telnyx_number_id: shop.forwarding_number_provider_order_id ?? null,
        },
        forwarding: {
          status: forwardingStatusForGoLive({ shop, forwardingSetupVerified: access.forwardingSetupVerified }),
          country: shop.forwarding_country ?? 'us',
          carrier: shop.forwarding_carrier?.trim() || null,
          forwardingType: shop.forwarding_type ?? 'no_answer',
          dialCode: null,
          verifiedAt: accessState?.forwardingSetupVerifiedAt ?? null,
        },
        liveAnswering: {
          enabled: access.liveCallsEnabled,
          enabledAt: accessState?.goLiveAt ?? null,
        },
      },
    });
  });

  app.get(path('/user/go-live/forwarding-code'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_go_live_forwarding_code');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!shop.telnyx_number?.trim()) return c.json({ ok: false, error: 'forwarding_number_required' }, 409);

    const parsed = forwardingCodeQuerySchema.safeParse({
      carrier: c.req.query('carrier'),
      country: c.req.query('country') ?? shop.forwarding_country ?? 'us',
      forwardingType: c.req.query('forwardingType') ?? shop.forwarding_type ?? 'no_answer',
    });
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const carrier = findCarrier(parsed.data.country ?? 'us', parsed.data.carrier);
    if (!carrier) return c.json({ ok: false, error: 'carrier_not_found' }, 404);
    const type = (parsed.data.forwardingType ?? carrier.defaultType) as ForwardingType;
    const code = getForwardingCode(carrier, type);
    const number = normalizeForwardingNumberForCode(shop.telnyx_number);
    const dialCode = code ? buildDialCode(code, number) : null;
    const instructions = carrier.appSteps?.length
      ? carrier.appSteps
      : [
          "Open your phone's dialer app",
          'Paste or type the code above, then press call',
          "You'll hear a tone - then come back and tap Done below",
        ];
    return c.json({
      ok: true,
      dialCode,
      turnOffCode: code?.cancelCode ?? null,
      instructions,
      carrier: carrier.id,
      forwardingType: type,
    });
  });

  app.post(path('/user/go-live/mark-forwarding-configured'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_confirm_forwarding_setup, 'user_go_live_mark_forwarding_configured');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);

    const body = await c.req.json().catch(() => null);
    const parsed = markForwardingConfiguredSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload', message: 'Choose a carrier before continuing.' }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!shop.telnyx_number?.trim()) return c.json({ ok: false, error: 'forwarding_number_required' }, 409);

    await deps.shopsRepository.updateUserSettings(shop.id, {
      forwarding_carrier: parsed.data.carrier,
      forwarding_country: parsed.data.country ?? shop.forwarding_country ?? 'us',
      forwarding_type: parsed.data.forwardingType,
    });

    return c.json({ ok: true, forwardingStatus: 'configured' });
  });

  app.post(path('/user/test-call-forwarding'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_start_forwarding_test, 'user_test_call_forwarding');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;

    if (
      !deps.shopsRepository ||
      !deps.billingSubscriptionsRepository ||
      !deps.shopAccessStatesRepository ||
      !deps.forwardingTestSessionsRepository
    ) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = testCallForwardingSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const shopId = sessionResult.shopId ?? '';
    const shop = await deps.shopsRepository.findById(shopId);
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const result = await startOrReuseForwardingTestSession({
      deps: {
        shopsRepository: deps.shopsRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopAccessStatesRepository: deps.shopAccessStatesRepository,
        forwardingTestSessionsRepository: deps.forwardingTestSessionsRepository,
        testCallAttemptsRepository: deps.testCallAttemptsRepository,
      },
      shop,
    });

    if (!result.ok) {
      const resBody: Record<string, unknown> = {
        ok: false,
        error: result.error,
        message: result.message,
      };
      if (result.billingUrl) resBody.billingUrl = result.billingUrl;
      if (result.error === 'payment_method_required') {
        resBody.message = buildGoLivePaymentRequiredMessage();
      }
      return c.json(resBody, result.httpStatus as 400);
    }

    return c.json({
      ok: true,
      success: false,
      status: result.status,
      expiresAt: result.expiresAt,
      instruction: result.instruction,
      sessionId: result.sessionId,
      message:
        'Forwarding is not verified until RingBooker receives your forwarded call. Call your current business number from another phone.',
    });
  });

  app.post(path('/user/go-live/confirm-forwarding-setup'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_confirm_forwarding_setup, 'user_confirm_forwarding_setup');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopAccessStatesRepository || !deps.billingSubscriptionsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = confirmForwardingSetupSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload', message: 'confirmForwardingReady: true is required.' }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const access = await getShopBillingAccess(
      {
        shopsRepository: deps.shopsRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopAccessStatesRepository: deps.shopAccessStatesRepository,
        testCallAttemptsRepository: deps.testCallAttemptsRepository,
      },
      { shopId: shop.id },
    );
    if (access.blockReason === 'commercial_approval_required') {
      return c.json(
        {
          ok: false,
          error: 'commercial_approval_required',
          message: 'Your Custom setup must be approved by the RingBooker team before live answering can be enabled.',
        },
        403,
      );
    }
    if (access.liveCallsEnabled) {
      return c.json({ ok: true, forwardingSetupVerified: access.forwardingSetupVerified, liveCallsEnabled: true });
    }
    if (!access.setupWizardComplete) {
      return c.json({ ok: false, error: 'onboarding_incomplete', message: 'Finish setup wizard first.' }, 409);
    }
    if (access.subscriptionStatus !== 'active' && access.subscriptionStatus !== 'trialing') {
      return c.json({ ok: false, error: access.blockReason || 'subscription_inactive' }, 409);
    }
    if (access.blockReason === 'trial_expired' || access.subscriptionStatus === 'trialing' && access.trialDaysRemaining === 0) {
      return c.json({ ok: false, error: 'trial_expired' }, 409);
    }
    if (access.paymentMethodStatus !== 'valid') {
      return c.json(
        {
          ok: false,
          error: 'payment_method_required',
          message: buildGoLivePaymentRequiredMessage(),
          billingUrl: '/user/billing',
        },
        402,
      );
    }
    if (!shop.telnyx_number?.trim()) {
      return c.json(
        {
          ok: false,
          error: 'forwarding_number_required',
          message: 'Provision your RingBooker forwarding number first.',
        },
        409,
      );
    }

    await deps.shopAccessStatesRepository.upsert({
      shopId: shop.id,
      forwardingSetupVerifiedAt: new Date().toISOString(),
      forwardingSetupVerifiedVia: 'manual_confirmation',
    });
    const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
    await enqueueLifecycleEmail({
      shopId: shop.id,
      kind: 'forwarding_verified',
      subscriptionId: subscription?.id ?? null,
    });
    securityAudit({
      action: 'forwarding_setup_manual_confirmed',
      actorType: 'user',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: { shopId: shop.id },
    });

    return c.json({ ok: true, forwardingSetupVerified: true });
  });

  // ── Nav state: minimal authenticated data for the marketing nav ──────────────
  app.get(path('/user/nav-state'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_nav_state');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    let subscriptionStatus: string | null = null;
    let trialEndsAt: string | null = null;
    let trialDaysRemaining: number | null = null;
    let paymentMethodStatus = 'none';
    let liveCallsEnabled = false;
    let canGoLive = false;
    let forwardingSetupVerified = false;
    let commercialGoLiveApproved = false;
    let commercialApprovalRequired = false;
    let billingBannerVariant = 'payment_required_go_live';
    if (deps.billingSubscriptionsRepository) {
      const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
      subscriptionStatus = subscription?.status ?? null;
      trialEndsAt = subscription?.trialEndsAt ?? null;
    }
    if (deps.billingSubscriptionsRepository && deps.shopAccessStatesRepository) {
      const access = await getShopBillingAccess(
        {
          shopsRepository: deps.shopsRepository,
          billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
          shopAccessStatesRepository: deps.shopAccessStatesRepository,
          testCallAttemptsRepository: deps.testCallAttemptsRepository,
        },
        { shopId: shop.id },
      );
      trialDaysRemaining = access.trialDaysRemaining;
      paymentMethodStatus = access.paymentMethodStatus ?? 'none';
      liveCallsEnabled = access.liveCallsEnabled;
      canGoLive = access.canGoLive;
      forwardingSetupVerified = access.forwardingSetupVerified;
      commercialGoLiveApproved = access.commercialGoLiveApproved;
      commercialApprovalRequired = access.blockReason === 'commercial_approval_required';
      billingBannerVariant =
        subscriptionStatus === 'active'
          ? 'active'
          : subscriptionStatus === 'trial_expired'
            ? 'trial_expired'
            : subscriptionStatus === 'trialing' && paymentMethodStatus === 'valid'
              ? 'trialing_setup'
              : subscriptionStatus === 'trialing' && (trialDaysRemaining ?? 99) <= 3
                ? 'trial_ending'
                : subscriptionStatus === 'past_due'
                  ? 'past_due'
                  : 'payment_required_go_live';
    }

    return c.json({
      ok: true,
      email: sessionResult.email,
      shopName: shop.name,
      userName: shop.user_name ?? '',
      plan: shop.plan,
      onboardingRequired: !isShopSetupWizardComplete(shop),
      subscriptionStatus,
      billingStatus: subscriptionStatus,
      trialEndsAt,
      trialDaysRemaining,
      paymentMethodStatus,
      liveCallsEnabled,
      canGoLive,
      billingBannerVariant,
      hasForwardingNumber: Boolean(shop.telnyx_number?.trim()),
      forwardingSetupVerified,
      commercialGoLiveApproved,
      commercialApprovalRequired,
    });
  });


  app.patch(path('/user/calls/:requestId/follow-up-done'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calls_follow_up_done');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.callLogsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const requestId = c.req.param('requestId');
    if (!requestId) return c.json({ ok: false, error: 'missing_request_id' }, 400);
    const call = await deps.callLogsRepository.findTranscriptByShopAndRequestId({ shopId: shop.id, requestId });
    if (!call) return c.json({ ok: false, error: 'call_not_found' }, 404);

    await deps.callLogsRepository.updateStructuredSummary(shop.id, requestId, {
      summaryFollowUpRequired: false,
    });

    return c.json({ ok: true });
  });

  app.get(path('/user/bookings'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_bookings');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.bookingsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const parsed = userBookingsListQuerySchema.safeParse({
      page: c.req.query('page'),
      limit: c.req.query('limit'),
      tab: c.req.query('tab'),
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
      callId: c.req.query('callId'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query', details: parsed.error.flatten() }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const page = parsed.data.page ?? 1;
    const limit = parsed.data.limit ?? USER_BOOKINGS_PAGE_SIZE;
    const offset = (page - 1) * limit;
    const filters = buildUserBookingFilters(parsed.data);
    const repo = deps.bookingsRepository;
    const [bookings, total, totalAll, awaitingAction, contacted, confirmed, declined, cancelled, completed] = await Promise.all([
      repo.listByShop(shop.id, { ...filters, limit, offset }),
      repo.countByShop(shop.id, filters),
      repo.countByShop(shop.id),
      repo.countByShop(shop.id, { statuses: userBookingStatsStatuses('awaitingAction') }),
      repo.countByShop(shop.id, { statuses: userBookingStatsStatuses('contacted') }),
      repo.countByShop(shop.id, { statuses: userBookingStatsStatuses('confirmed') }),
      repo.countByShop(shop.id, { statuses: userBookingStatsStatuses('declined') }),
      repo.countByShop(shop.id, { statuses: userBookingStatsStatuses('cancelled') }),
      repo.countByShop(shop.id, { statuses: userBookingStatsStatuses('completed') }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return c.json({
      ok: true,
      bookings: bookings.map((booking) => toUserBookingResponse(booking)),
      shop: { timezone: shop.timezone },
      total,
      stats: {
        total: totalAll,
        awaitingAction,
        contacted,
        confirmed,
        declined,
        cancelled,
        completed,
      },
      pagination: { page, limit, total, totalPages },
    });
  });

  app.get(path('/user/bookings/:id'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_bookings_detail');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.bookingsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const id = c.req.param('id') ?? '';
    const booking = await deps.bookingsRepository.findById(id);
    if (!booking || booking.shopId !== shop.id) return c.json({ ok: false, error: 'booking_not_found' }, 404);

    const smsLog = deps.outboundMessagesRepository?.listByBookingId
      ? await deps.outboundMessagesRepository.listByBookingId(booking.id).catch(() => [])
      : [];
    let parentCall: Record<string, unknown> | null = null;
    if (booking.callLogId && deps.callLogsRepository) {
      const call = await deps.callLogsRepository.findTranscriptByShopAndRequestId({ shopId: shop.id, requestId: booking.callLogId }).catch(() => null);
      if (call) {
        parentCall = {
          id: booking.callLogId,
          callerPhone: booking.customerPhone,
          startedAt: call.startedAt,
          durationSeconds:
            call.startedAt && call.endedAt
              ? Math.max(0, Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000))
              : undefined,
          transcriptAvailable: call.transcriptStatus === 'completed' && Boolean(call.transcriptText?.trim()),
        };
      }
    }
    return c.json({ ok: true, booking: { ...toUserBookingResponse(booking, smsLog), parentCall } });
  });

  app.patch(path('/user/bookings/:id'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_bookings_update');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.bookingsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const parsed = userBookingStatusPatchSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload', details: parsed.error.flatten() }, 400);

    const id = c.req.param('id') ?? '';
    const booking = await deps.bookingsRepository.findById(id);
    if (!booking || booking.shopId !== shop.id) return c.json({ ok: false, error: 'booking_not_found' }, 404);

    const current = normalizeUserBookingStatus(booking.status, booking.reminder24hSent, booking.reminder2hSent);
    const next = parsed.data.status;
    const allowed =
      ((current === 'captured' || current === 'link_sent') && (next === 'contacted' || next === 'cancelled')) ||
      (current === 'contacted' && (next === 'confirmed' || next === 'declined' || next === 'cancelled')) ||
      ((current === 'confirmed' || current === 'reminder_sent') && (next === 'completed' || next === 'cancelled')) ||
      (current === 'rescheduled' && next === 'confirmed');
    if (!allowed) return c.json({ ok: false, error: 'invalid_status_transition' }, 400);

    const updated = await deps.bookingsRepository.updateStatusByShop(shop.id, id, next);
    if (!updated) return c.json({ ok: false, error: 'booking_not_found' }, 404);
    return c.json({ ok: true, booking: toUserBookingResponse(updated) });
  });


  app.get(path('/user/calls/summary'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calls_summary');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.callLogsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const repo = deps.callLogsRepository;
    const commercialAccount = deps.commercialAccountsRepository ? await deps.commercialAccountsRepository.findByShopId(shop.id).catch(() => null) : null;
    const [totalLast7Days, bookingsCount, followUpCount, missedCount, usage] = await Promise.all([
      repo.countByShop(shop.id, { startedAfter: last7Days }),
      repo.countByShop(shop.id, { summaryNextActions: ['booking_created', 'booking_link_sent'] }),
      repo.countByShop(shop.id, { summaryFollowUpRequired: true }),
      repo.countByShop(shop.id, { startedAfter: last7Days, outcome: 'missed' }),
      getShopUsageForPeriod({ callLogsRepository: repo, shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository }, { shop, commercialAccount }),
    ]);
    return c.json({
      ok: true,
      totalLast7Days,
      bookingsCount,
      followUpCount,
      missedCount,
      usage,
    });
  });

  app.get(path('/user/calls/:id'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calls_detail');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.callLogsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    await deps.callLogsRepository.resolveStaleInProgressByShop(shop.id, new Date(Date.now() - 30 * 60 * 1000)).catch(() => 0);
    const id = c.req.param('id');
    const recent = await deps.callLogsRepository.listByShop(shop.id, { limit: 500 });
    const call = recent.find((item) => item.requestId === id || item.providerCallId === id);
    if (!call) return c.json({ ok: false, error: 'call_not_found' }, 404);
    return c.json({ ok: true, call: toUserCallResponse(call), shop: { timezone: shop.timezone } });
  });

  app.get(path('/user/calls'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calls');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.callLogsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const parsed = userCallsListQuerySchema.safeParse({
      page: c.req.query('page'),
      limit: c.req.query('limit'),
      tab: c.req.query('tab'),
      filter: c.req.query('filter'),
      from: c.req.query('from'),
      to: c.req.query('to'),
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query', details: parsed.error.flatten() }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const repo = deps.callLogsRepository;
    await repo.resolveStaleInProgressByShop(shop.id, new Date(Date.now() - 30 * 60 * 1000)).catch(() => 0);

    const page = parsed.data.page ?? 1;
    const limit = parsed.data.limit ?? USER_CALLS_PAGE_SIZE;
    const offset = (page - 1) * limit;
    const filters = buildUserCallFilters(parsed.data);
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [calls, total, last7DaysCount, bookings, followUp, missed, highUrgency, transcriptsReady] = await Promise.all([
      repo.listByShop(shop.id, { ...filters, limit, offset }),
      repo.countByShop(shop.id, filters),
      repo.countByShop(shop.id, { startedAfter: last7Days }),
      repo.countByShop(shop.id, { summaryNextActions: ['booking_created', 'booking_link_sent'] }),
      repo.countByShop(shop.id, { summaryFollowUpRequired: true }),
      repo.countByShop(shop.id, { outcome: 'missed' }),
      repo.countByShop(shop.id, { summaryUrgency: 'high' }),
      repo.countByShop(shop.id, { ...filters, transcriptStatus: 'completed' }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const missedPhones = calls
      .filter((c) => c.outcome === 'missed' && c.callerPhone)
      .map((c) => c.callerPhone as string);
    const missedSmsSentPhones = missedPhones.length > 0 && deps.outboundMessagesRepository?.listMissedCallSmsSentPhones
      ? await deps.outboundMessagesRepository.listMissedCallSmsSentPhones(shop.id, missedPhones)
      : new Set<string>();

    return c.json({
      ok: true,
      calls: calls.map((call) => toUserCallResponse(call, { missedFollowupSmsSent: missedSmsSentPhones.has(call.callerPhone ?? '') })),
      shop: { timezone: shop.timezone },
      total,
      stats: { last7Days: last7DaysCount, bookings, followUp, missed, highUrgency },
      pagination: { page, limit, pageSize: limit, total, totalPages },
      summary: { total, booked: bookings, missed, transcriptsReady },
    });
  });

  app.get(path('/user/settings'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_settings_get');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const serviceCatalogEnabled = getEnv().SERVICE_CATALOG_ENABLED;
    const showGoLiveSettingsTab = await computeShowGoLiveSettingsTab({
      shop,
      shopsRepository: deps.shopsRepository,
      shopAccessStatesRepository: deps.shopAccessStatesRepository,
      billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
      testCallAttemptsRepository: deps.testCallAttemptsRepository,
    });
    return c.json({
      ok: true,
      shop: serviceCatalogEnabled ? toUserFacingShop(shop) : { ...toUserFacingShop(shop), service_catalog: null },
      capabilities: getShopPlanCapabilities(shop.plan),
      capabilityLabels: CAPABILITY_LABELS,
      showGoLiveSettingsTab,
      serviceCatalogEnabled,
    });
  });

  app.get(path('/user/integrations/preferences'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_integrations_preferences_get');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    return c.json({
      ok: true,
      bookingMethod: shop.booking_method ?? null,
      selectedIntegration: shop.selected_integration ?? null,
    });
  });

  app.patch(path('/user/integrations/preferences'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_integrations_preferences_patch');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = integrationsPreferencesSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const updated = await deps.shopsRepository.updateUserSettings(sessionResult.shopId ?? '', {
      ...(parsed.data.bookingMethod !== undefined ? { booking_method: parsed.data.bookingMethod } : {}),
      ...(parsed.data.selectedIntegration !== undefined ? { selected_integration: parsed.data.selectedIntegration } : {}),
    });
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    return c.json({
      ok: true,
      bookingMethod: updated.booking_method ?? null,
      selectedIntegration: updated.selected_integration ?? null,
    });
  });

  app.get(path('/user/calendar/providers'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_providers_get');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const squareCredentials = parseSquareConnectionCredentials(shop.google_cal_credentials_encrypted);
    const vagaroCredentials = parseVagaroCredentials(shop.google_cal_credentials_encrypted);
    const mindbodyCredentials =
      parseMindbodyCredentials(shop.integration_credentials_encrypted) ??
      parseMindbodyCredentials(shop.google_cal_credentials_encrypted);
    const acuityCredentials =
      parseAcuityCredentials(shop.integration_credentials_encrypted) ??
      parseAcuityCredentials(shop.google_cal_credentials_encrypted);
    const bookingLinkProvider = parseBookingLinkConnectionProvider(shop.google_cal_credentials_encrypted);
    const providers = (Object.keys(CALENDAR_PROVIDER_CATALOG) as Array<keyof typeof CALENDAR_PROVIDER_CATALOG>)
      .filter((id) => id !== 'manual' && id !== 'google_calendar')
      .map((id) => {
        const meta = CALENDAR_PROVIDER_CATALOG[id];
        if (id === 'square_appointments') {
          const connected = Boolean(squareCredentials?.access_token && squareCredentials?.refresh_token);
          const configured = Boolean(squareCredentials?.location_id && squareCredentials?.service_variation_id);
          return {
            id,
            label: meta.label,
            implemented: meta.implemented,
            connected,
            configured,
            details: connected
              ? {
                  merchantId: squareCredentials?.merchant_id ?? null,
                  locationId: squareCredentials?.location_id ?? null,
                  serviceVariationId: squareCredentials?.service_variation_id ?? null,
                  teamMemberId: squareCredentials?.team_member_id ?? null,
                  servicesCatalogSync: 'available',
                  staffSync: 'available',
                  availabilityCheck: configured ? 'available' : 'needs_mapping',
                  directAppointmentCreation: configured ? 'enabled' : 'not_enabled',
                  bookingMode: configured ? 'direct_booking_with_fallback' : 'capture_request_only',
                  capabilityNote:
                    'Square Appointments is a booking provider. RingBooker can check availability and create appointments directly after location and service mapping are configured.',
                }
              : null,
          };
        }
        if (id === 'vagaro') {
          if ((bookingLinkProvider === 'vagaro' || shop.selected_integration === 'vagaro') && shop.booking_url) {
            return {
              id,
              label: meta.label,
              implemented: true,
              connected: true,
              configured: true,
              details: {
                bookingUrl: shop.booking_url,
                type: 'booking_link',
                capabilityNote: 'Vagaro booking link saved. Full API sync requires Vagaro API approval.',
              },
            };
          }
          const connected = Boolean(vagaroCredentials?.accessToken || vagaroCredentials?.clientId);
          const configured = Boolean(vagaroCredentials?.region && vagaroCredentials?.businessId);
          return {
            id,
            label: meta.label,
            implemented: meta.implemented,
            connected,
            configured,
            details: connected
              ? {
                  region: vagaroCredentials?.region ?? null,
                  businessId: vagaroCredentials?.businessId ?? null,
                  bookingUrl: shop.booking_url ?? null,
                  capabilityNote: 'Availability checking supported. Booking creation requires Vagaro app.',
                }
              : null,
          };
        }
        if (id === 'mindbody') {
          const connected = Boolean(mindbodyCredentials?.siteId && mindbodyCredentials?.apiKey);
          const configured = connected;
          return {
            id,
            label: meta.label,
            implemented: meta.implemented,
            connected,
            configured,
            details: connected
              ? {
                  siteId: mindbodyCredentials?.siteId ?? null,
                  sourceName: mindbodyCredentials?.sourceName ?? null,
                  locationId: mindbodyCredentials?.locationId ?? null,
                  sessionTypeId: mindbodyCredentials?.sessionTypeId ?? null,
                  staffId: mindbodyCredentials?.staffId ?? null,
                  bookingUrl: mindbodyCredentials?.bookingUrl ?? shop.booking_url ?? null,
                  servicesStaffSync: 'available',
                  availabilityCheck: 'best_effort',
                  directAppointmentCreation: 'not_enabled',
                  bookingMode: 'capture_request_only',
                  capabilityNote:
                    'Mindbody API connected for services/staff sync and best-effort availability. Direct appointment creation is not enabled; RingBooker captures booking requests for owner confirmation.',
                }
              : null,
          };
        }
        if (id === 'acuity') {
          const connected = Boolean(acuityCredentials?.accessToken || (acuityCredentials?.userId && acuityCredentials?.apiKey));
          const serviceMappingCount = Object.keys(acuityCredentials?.serviceMappings ?? {}).length;
          const staffMappingCount = Object.keys(acuityCredentials?.staffMappings ?? {}).length;
          const defaultCalendarId = acuityCredentials?.defaultCalendarId ?? acuityCredentials?.calendarId ?? null;
          const directFlagEnabled = process.env.ACUITY_DIRECT_BOOKING_ENABLED === 'true';
          const hasRequiredMappings = serviceMappingCount > 0 && Boolean(defaultCalendarId);
          const directEnabled = directFlagEnabled && hasRequiredMappings;
          const missingMappings = [
            serviceMappingCount > 0 ? null : 'Add at least one RingBooker service to Acuity appointment type mapping.',
            defaultCalendarId ? null : 'Set a default Acuity calendar or staff calendar mapping.',
          ].filter(Boolean);
          return {
            id,
            label: meta.label,
            implemented: meta.implemented,
            connected,
            configured: connected,
            details: connected
              ? {
                  userId: acuityCredentials?.userId ?? null,
                  appointmentTypeId: acuityCredentials?.appointmentTypeId ?? null,
                  calendarId: acuityCredentials?.calendarId ?? null,
                  defaultCalendarId,
                  serviceMappings: acuityCredentials?.serviceMappings ?? {},
                  staffMappings: acuityCredentials?.staffMappings ?? {},
                  serviceMappingCount,
                  staffMappingCount,
                  requiresCallerEmail: acuityCredentials?.requiresCallerEmail ?? false,
                  missingMappings,
                  timezone: acuityCredentials?.timezone ?? shop.timezone ?? null,
                  bookingUrl: acuityCredentials?.bookingUrl ?? shop.booking_url ?? null,
                  appointmentTypesSync: 'available',
                  calendarsSync: 'available',
                  availabilityCheck: serviceMappingCount > 0 ? 'available' : 'needs_mapping',
                  directAppointmentCreation: directEnabled ? 'enabled' : 'not_enabled',
                  bookingMode: directEnabled ? 'direct_booking_with_fallback' : 'capture_request_only',
                  capabilityNote: directEnabled
                    ? 'Acuity direct appointment creation is enabled. Failed API bookings still fall back to captured booking requests.'
                    : 'Acuity is connected for appointment types, calendars, and availability. Direct appointment creation requires service mapping, default calendar mapping, and ACUITY_DIRECT_BOOKING_ENABLED=true.',
                }
              : null,
          };
        }
        if (isBookingLinkProviderId(id)) {
          const connected = bookingLinkProvider === id && Boolean(shop.booking_url);
          return {
            id,
            label: meta.label,
            implemented: meta.implemented,
            connected,
            configured: connected,
            details: connected
              ? {
                  bookingUrl: shop.booking_url,
                  type: 'booking_link',
                  capabilityNote: 'When clients call to book, they will receive your booking link via SMS.',
                }
              : null,
          };
        }
        return {
          id,
          label: meta.label,
          implemented: meta.implemented,
          connected: false,
          configured: false,
          details: null,
        };
      });

    return c.json({
      ok: true,
      providers,
    });
  });

  app.post(path('/user/calendar/providers/vagaro/connect'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_vagaro_connect');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = vagaroConnectSchema.safeParse(body);
    if (!parsed.success) {
      const businessIdIssue = parsed.error.issues.find((issue) => issue.path.join('.') === 'businessId');
      return c.json(
        {
          ok: false,
          error: businessIdIssue ? 'Business ID is required for Vagaro integration' : 'invalid_payload',
        },
        400,
      );
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const bookingUrl = parsed.data.bookingUrl ? normalizeHttpsBookingUrl(parsed.data.bookingUrl) : null;
    if (parsed.data.bookingUrl && !bookingUrl) {
      return c.json({ ok: false, error: 'bookingUrl must start with https://' }, 400);
    }

    try {
      const token = await generateVagaroAccessToken({
        region: parsed.data.region,
        clientId: parsed.data.clientId,
        clientSecretKey: parsed.data.clientSecretKey,
        scope: parsed.data.scope,
      });
      const current = parseVagaroCredentials(shop.google_cal_credentials_encrypted);
      const payload = buildVagaroConnectionPayload(current, {
        region: parsed.data.region,
        businessId: parsed.data.businessId,
        clientId: parsed.data.clientId,
        clientSecretKey: parsed.data.clientSecretKey,
        scope: parsed.data.scope,
        accessToken: token.accessToken,
        expiresAt: token.expiresAt,
      });
      const updated = await deps.shopsRepository.updateCalendarConnection(shop.id, {
        google_cal_id: shop.google_cal_id ?? null,
        google_cal_credentials_encrypted: encodeVagaroCredentials(payload),
      });
      if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
      if (bookingUrl) {
        const settingsUpdated = await deps.shopsRepository.updateUserSettings(shop.id, {
          booking_url: bookingUrl,
          booking_method: 'app',
          selected_integration: 'vagaro',
        });
        if (!settingsUpdated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
      }

      return c.json({
        ok: true,
        provider: 'vagaro',
        connected: true,
        configured: Boolean(payload.businessId),
      });
    } catch (error) {
      logger.error({ err: error, provider: 'vagaro' }, 'calendar_provider_vagaro_connect_failed');
      return c.json({ ok: false, error: 'vagaro_connect_failed' }, 502);
    }
  });

  app.patch(path('/user/calendar/providers/vagaro/booking-url'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_vagaro_booking_url');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = vagaroBookingUrlSchema.safeParse(body);
    const bookingUrl = parsed.success ? normalizeHttpsBookingUrl(parsed.data.bookingUrl) : null;
    if (!bookingUrl) {
      return c.json({ ok: false, error: 'bookingUrl must start with https://' }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const settingsUpdated = await deps.shopsRepository.updateUserSettings(shop.id, {
      booking_url: bookingUrl,
      booking_method: 'app',
      selected_integration: 'vagaro',
    });
    if (!settingsUpdated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    return c.json({
      ok: true,
      provider: 'vagaro',
      bookingUrl,
    });
  });

  app.post(path('/user/calendar/providers/mindbody/connect'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_mindbody_connect');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = mindbodyConnectSchema.safeParse(body);
    if (!parsed.success) {
      const siteIdIssue = parsed.error.issues.find((issue) => issue.path.join('.') === 'siteId');
      const apiKeyIssue = parsed.error.issues.find((issue) => issue.path.join('.') === 'apiKey');
      return c.json(
        {
          ok: false,
          error: siteIdIssue ? 'Mindbody Site ID is required' : apiKeyIssue ? 'Mindbody API key is required' : 'invalid_payload',
        },
        400,
      );
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const bookingUrl = parsed.data.bookingUrl ? normalizeHttpsBookingUrl(parsed.data.bookingUrl) : null;
    if (parsed.data.bookingUrl && !bookingUrl) {
      return c.json({ ok: false, error: 'bookingUrl must start with https://' }, 400);
    }

    const current =
      parseMindbodyCredentials(shop.integration_credentials_encrypted) ??
      parseMindbodyCredentials(shop.google_cal_credentials_encrypted);
    const payload = buildMindbodyConnectionPayload(current, {
      siteId: parsed.data.siteId,
      apiKey: parsed.data.apiKey,
      sourceName: parsed.data.sourceName,
      staffToken: parsed.data.staffToken,
      locationId: parsed.data.locationId,
      sessionTypeId: parsed.data.sessionTypeId,
      staffId: parsed.data.staffId,
      bookingUrl: bookingUrl ?? undefined,
    });

    const updated = await deps.shopsRepository.updateIntegrationConnection(shop.id, {
      integration_credentials_encrypted: encodeMindbodyCredentials(payload),
    });
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    await deps.shopsRepository.updateUserSettings(shop.id, {
      ...(bookingUrl ? { booking_url: bookingUrl } : {}),
      booking_method: 'app',
      selected_integration: 'mindbody',
    });

    logger.info(
      {
        provider: 'mindbody',
        shop_id: shop.id,
        user_id: null, user_email: sessionResult.email,
        status: 'success',
        has_booking_url: Boolean(bookingUrl),
      },
      'integration_mindbody_connect',
    );
    return c.json({
      ok: true,
      provider: 'mindbody',
      connected: true,
      configured: true,
    });
  });

  app.post(path('/user/calendar/providers/acuity/connect'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_acuity_connect');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = acuityConnectSchema.safeParse(body);
    if (!parsed.success) {
      logger.warn(
        { provider: 'acuity', shop_id: sessionResult.shopId ?? null, user_email: sessionResult.email, status: 'failed', error_kind: 'invalid_payload' },
        'integration_acuity_connect',
      );
      return c.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_payload' }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const bookingUrl = parsed.data.bookingUrl ? normalizeHttpsBookingUrl(parsed.data.bookingUrl) : null;
    if (parsed.data.bookingUrl && !bookingUrl) {
      return c.json({ ok: false, error: 'bookingUrl must start with https://' }, 400);
    }

    const current =
      parseAcuityCredentials(shop.integration_credentials_encrypted) ??
      parseAcuityCredentials(shop.google_cal_credentials_encrypted);
    const payload = buildAcuityConnectionPayload(current, {
      provider: 'acuity',
      userId: parsed.data.userId,
      apiKey: parsed.data.apiKey,
      accessToken: parsed.data.accessToken,
      appointmentTypeId: parsed.data.appointmentTypeId,
      calendarId: parsed.data.calendarId,
      defaultCalendarId: parsed.data.defaultCalendarId ?? parsed.data.calendarId,
      serviceMappings: parsed.data.serviceMappings,
      staffMappings: parsed.data.staffMappings,
      requiresCallerEmail: parsed.data.requiresCallerEmail,
      timezone: parsed.data.timezone,
      bookingUrl: bookingUrl ?? undefined,
    });

    const updated = await deps.shopsRepository.updateIntegrationConnection(shop.id, {
      integration_credentials_encrypted: encodeAcuityCredentials(payload),
    });
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    await deps.shopsRepository.updateUserSettings(shop.id, {
      ...(bookingUrl ? { booking_url: bookingUrl } : {}),
      booking_method: 'app',
      selected_integration: 'acuity',
    });

    logger.info(
      {
        provider: 'acuity',
        shop_id: shop.id,
        user_id: null,
        user_email: sessionResult.email,
        status: 'success',
        has_booking_url: Boolean(bookingUrl),
        has_appointment_type_id: Boolean(payload.appointmentTypeId),
        has_calendar_id: Boolean(payload.calendarId ?? payload.defaultCalendarId),
        service_mapping_count: Object.keys(payload.serviceMappings ?? {}).length,
        staff_mapping_count: Object.keys(payload.staffMappings ?? {}).length,
      },
      'integration_acuity_connect',
    );
    return c.json({
      ok: true,
      provider: 'acuity',
      connected: true,
      configured: true,
    });
  });

  app.post(path('/user/calendar/providers/:provider/connect'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_booking_link_connect');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const provider = parseCalendarProviderParam(c.req.param('provider') ?? '');
    if (!isBookingLinkProviderId(provider)) {
      return c.json({ ok: false, error: 'provider_not_supported' }, 400);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = bookingLinkConnectSchema.safeParse(body);
    const bookingUrl = parsed.success ? normalizeHttpsBookingUrl(parsed.data.bookingUrl) : null;
    if (!bookingUrl) {
      return c.json({ ok: false, error: 'bookingUrl must be a valid https URL' }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const settingsUpdated = await deps.shopsRepository.updateUserSettings(shop.id, {
      booking_url: bookingUrl,
      booking_method: 'app',
      selected_integration: provider,
    });
    if (!settingsUpdated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const connectionUpdated = await deps.shopsRepository.updateCalendarConnection(shop.id, {
      google_cal_id: shop.google_cal_id ?? null,
      google_cal_credentials_encrypted: buildBookingLinkConnectionPayload(provider, bookingUrl),
    });
    if (!connectionUpdated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    return c.json({
      ok: true,
      connected: true,
      provider,
    });
  });

  app.get(path('/user/calendar/providers/:provider/connect/start'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_connect_start');
    if (limited) return limited;
    const appBaseUrl = getAppBaseUrl(c.req);
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) {
      logger.warn({ path: c.req.path }, 'square_oauth_start_unauthenticated');
      return c.redirect(`${appBaseUrl}/user/login?error=calendar_connect_login_required`, 302);
    }
    const provider = parseCalendarProviderParam(c.req.param('provider') ?? '');
    if (!provider) return c.json({ ok: false, error: 'provider_not_supported' }, 400);

    if (provider !== 'square_appointments') {
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider,
          message: 'provider_not_implemented_yet',
        }),
      );
    }

    const state = randomUUID();
    setCookie(c, 'rb_calendar_provider_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: 600,
    });
    setCookie(c, 'rb_calendar_provider_name', provider, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: 600,
    });
    setCookie(c, 'rb_calendar_provider_shop', sessionResult.shopId ?? '', {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: 600,
    });

    try {
      const redirectUri = buildSquareCallbackUrl(appBaseUrl);
      const authorizeUrl = squareAuthorizeUrl({
        state,
        redirectUri,
      });
      let authorizeHost = '';
      try {
        authorizeHost = new URL(authorizeUrl).host;
      } catch {
        /* ignore malformed URL (should not happen) */
      }
      logger.info(
        {
          event: 'square_oauth_start',
          authorize_host: authorizeHost,
          redirect_uri_suffix: '/api/backend/user/calendar/providers/square_appointments/connect/callback',
          state_len: state.length,
        },
        'square_oauth_authorize_redirect',
      );
      return c.redirect(authorizeUrl);
    } catch (error) {
      logger.error({ err: error }, 'square_oauth_start_failed');
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider,
          message: 'square_oauth_not_configured',
        }),
      );
    }
  });

  app.get(path('/user/calendar/providers/:provider/connect/callback'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_connect_callback');
    if (limited) return limited;
    const appBaseUrl = getAppBaseUrl(c.req);
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) {
      logger.warn({ path: c.req.path }, 'square_oauth_callback_unauthenticated');
      return c.redirect(`${appBaseUrl}/user/login?error=calendar_oauth_login_required`, 302);
    }
    if (!deps.shopsRepository) {
      logger.error({ path: c.req.path }, 'square_oauth_callback_shops_repository_unavailable');
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider: 'square_appointments',
          message: 'user_dependencies_unavailable',
        }),
      );
    }

    const provider = parseCalendarProviderParam(c.req.param('provider') ?? '');
    const state = c.req.query('state') ?? '';
    const code = c.req.query('code') ?? '';
    const oauthError = c.req.query('error') ?? '';
    const cookieState = getCookie(c, 'rb_calendar_provider_state') ?? '';
    const cookieProvider = getCookie(c, 'rb_calendar_provider_name') ?? '';
    const cookieShopId = getCookie(c, 'rb_calendar_provider_shop') ?? '';

    logger.info(
      {
        event: 'square_oauth_callback',
        provider: provider || undefined,
        oauth_error: oauthError || undefined,
        has_code: Boolean(code),
        has_state: Boolean(state),
        has_state_cookie: Boolean(cookieState),
      },
      'square_oauth_callback_received',
    );

    deleteCookie(c, 'rb_calendar_provider_state', { path: '/' });
    deleteCookie(c, 'rb_calendar_provider_name', { path: '/' });
    deleteCookie(c, 'rb_calendar_provider_shop', { path: '/' });

    if (!provider || provider !== cookieProvider || cookieShopId !== (sessionResult.shopId ?? '')) {
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider: provider ?? 'unknown',
          message: 'invalid_oauth_context',
        }),
      );
    }

    if (oauthError) {
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider,
          message: oauthError,
        }),
      );
    }

    if (!state || !cookieState || state !== cookieState || !code) {
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider,
          message: 'invalid_oauth_state',
        }),
      );
    }

    if (provider !== 'square_appointments') {
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider,
          message: 'provider_not_implemented_yet',
        }),
      );
    }

    try {
      const exchanged = await squareExchangeAuthorizationCode({
        code,
        redirectUri: buildSquareCallbackUrl(appBaseUrl),
      });
      const existingShop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
      if (!existingShop) {
        return c.redirect(
          buildCalendarSettingsRedirect({
            appBaseUrl,
            result: 'error',
            provider,
            message: 'shop_not_found',
          }),
        );
      }
      const current = parseSquareConnectionCredentials(existingShop.google_cal_credentials_encrypted);
      const payload = buildSquareConnectionPayload(current, exchanged);

      const updated = await deps.shopsRepository.updateCalendarConnection(existingShop.id, {
        google_cal_id: existingShop.google_cal_id ?? null,
        google_cal_credentials_encrypted: encodeSquareConnectionCredentials(payload),
      });
      if (!updated) {
        return c.redirect(
          buildCalendarSettingsRedirect({
            appBaseUrl,
            result: 'error',
            provider,
            message: 'shop_not_found',
          }),
        );
      }
      await deps.shopsRepository.updateUserSettings(existingShop.id, {
        booking_method: 'app',
        selected_integration: 'square_appointments',
      });
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'success',
          provider,
        }),
      );
    } catch (error) {
      logger.error({ err: error, provider }, 'calendar_provider_oauth_callback_failed');
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider,
          message: 'oauth_exchange_failed',
        }),
      );
    }
  });

  app.get(path('/user/calendar/providers/:provider/options'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_options');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const provider = parseCalendarProviderParam(c.req.param('provider') ?? '');
    if (provider !== 'vagaro' && isBookingLinkProviderId(provider)) {
      return c.json({
        ok: true,
        provider,
        type: 'booking_link',
        capabilities: { hasBookingLink: true },
        note: 'When clients call to book, they will receive your booking link via SMS.',
      });
    }
    if (provider !== 'square_appointments' && provider !== 'vagaro' && provider !== 'mindbody' && provider !== 'acuity') {
      return c.json({ ok: false, error: 'provider_not_supported' }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    if (provider === 'vagaro') {
      const credentials = parseVagaroCredentials(shop.google_cal_credentials_encrypted);
      if (!credentials?.accessToken && !credentials?.clientId) {
        return c.json({ ok: false, error: 'provider_not_connected' }, 400);
      }
      if (!credentials.businessId) {
        return c.json({ ok: false, error: 'Business ID is required for Vagaro integration' }, 400);
      }

      try {
        const options = await new VagaroProvider(shop, {
          persistCredentials: async (encodedCredentials) => {
            await deps.shopsRepository?.updateCalendarConnection(shop.id, {
              google_cal_id: shop.google_cal_id ?? null,
              google_cal_credentials_encrypted: encodedCredentials,
            });
          },
        }).getConnectionOptions();
        return c.json({
          ok: true,
          provider,
          options,
          configured: true,
        });
      } catch (error) {
        logger.error({ err: error, provider, shop_id: shop.id, user_id: null, user_email: sessionResult.email, status: 'failed', error_kind: 'options_fetch_failed' }, 'integration_mindbody_sync_attempt');
        return c.json({ ok: false, error: 'provider_options_failed' }, 502);
      }
    }

    if (provider === 'mindbody') {
      const credentials =
        parseMindbodyCredentials(shop.integration_credentials_encrypted) ??
        parseMindbodyCredentials(shop.google_cal_credentials_encrypted);
      if (!credentials?.siteId || !credentials?.apiKey) {
        return c.json({ ok: false, error: 'provider_not_connected' }, 400);
      }

      try {
        const options = await new MindbodyProvider(shop).getConnectionOptions();
        logger.info(
          {
            provider,
            shop_id: shop.id,
            user_id: null,
            user_email: sessionResult.email,
            status: 'success',
            services_count: options.services.length,
            staff_count: options.staff.length,
          },
          'integration_mindbody_sync_attempt',
        );
        return c.json({
          ok: true,
          provider,
          options,
          configured: true,
        });
      } catch (error) {
        logger.error({ err: error, provider }, 'calendar_provider_options_failed');
        return c.json({ ok: false, error: 'provider_options_failed' }, 502);
      }
    }

    if (provider === 'acuity') {
      const credentials =
        parseAcuityCredentials(shop.integration_credentials_encrypted) ??
        parseAcuityCredentials(shop.google_cal_credentials_encrypted);
      if (!credentials?.accessToken && (!credentials?.userId || !credentials?.apiKey)) {
        return c.json({ ok: false, error: 'provider_not_connected' }, 400);
      }

      try {
        const options = await new AcuityProvider(shop).getConnectionOptions();
        logger.info(
          {
            provider,
            shop_id: shop.id,
            user_id: null,
            user_email: sessionResult.email,
            status: 'success',
            appointment_types_count: options.appointmentTypes.length,
            calendars_count: options.calendars.length,
          },
          'integration_acuity_sync_attempt',
        );
        return c.json({
          ok: true,
          provider,
          options,
          configured: true,
        });
      } catch (error) {
        logger.error(
          { err: error, provider, shop_id: shop.id, user_id: null, user_email: sessionResult.email, status: 'failed', error_kind: 'options_fetch_failed' },
          'integration_acuity_sync_attempt',
        );
        return c.json({ ok: false, error: 'provider_options_failed' }, 502);
      }
    }

    const credentials = parseSquareConnectionCredentials(shop.google_cal_credentials_encrypted);
    if (!credentials?.access_token || !credentials.refresh_token) {
      return c.json({ ok: false, error: 'provider_not_connected' }, 400);
    }

    try {
      const result = await squareFetchConnectionOptions(credentials);
      if (
        result.credentials.access_token !== credentials.access_token ||
        result.credentials.refresh_token !== credentials.refresh_token ||
        result.credentials.expires_at !== credentials.expires_at
      ) {
        const nextPayload = buildSquareConnectionPayload(credentials, result.credentials);
        await deps.shopsRepository.updateCalendarConnection(shop.id, {
          google_cal_id: shop.google_cal_id ?? null,
          google_cal_credentials_encrypted: encodeSquareConnectionCredentials(nextPayload),
        });
      }
      return c.json({
        ok: true,
        provider,
        options: result.options,
      });
    } catch (error) {
      logger.error({ err: error, provider }, 'calendar_provider_options_failed');
      return c.json({ ok: false, error: 'provider_options_failed' }, 502);
    }
  });

  app.post(path('/user/calendar/providers/:provider/configure'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_configure');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const provider = parseCalendarProviderParam(c.req.param('provider') ?? '');
    if (provider !== 'square_appointments' && provider !== 'vagaro') {
      return c.json({ ok: false, error: 'provider_not_supported' }, 400);
    }

    const body = await c.req.json().catch(() => null);
    if (provider === 'vagaro') {
      const parsed = vagaroConfigureSchema.safeParse(body);
      if (!parsed.success) {
        const businessIdIssue = parsed.error.issues.find((issue) => issue.path.join('.') === 'businessId');
        return c.json(
          {
            ok: false,
            error: businessIdIssue ? 'Business ID is required for Vagaro integration' : 'invalid_payload',
          },
          400,
        );
      }

      const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
      if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

      const current = parseVagaroCredentials(shop.google_cal_credentials_encrypted);
      if (!current?.accessToken && !current?.clientId) {
        return c.json({ ok: false, error: 'provider_not_connected' }, 400);
      }

      let tokenPatch: Partial<VagaroCredentials> = {};
      const nextClientId = parsed.data.clientId ?? current.clientId;
      const nextClientSecretKey = parsed.data.clientSecretKey ?? current.clientSecretKey;
      const nextRegion = parsed.data.region ?? current.region ?? 'us';
      if (nextClientId && nextClientSecretKey && (parsed.data.clientId || parsed.data.clientSecretKey || parsed.data.region || !current.accessToken)) {
        const token = await generateVagaroAccessToken({
          region: nextRegion,
          clientId: nextClientId,
          clientSecretKey: nextClientSecretKey,
          scope: parsed.data.scope ?? current.scope,
        });
        tokenPatch = {
          accessToken: token.accessToken,
          expiresAt: token.expiresAt,
        };
      }

      const payload = buildVagaroConnectionPayload(current, {
        ...parsed.data,
        ...tokenPatch,
      });
      const updated = await deps.shopsRepository.updateCalendarConnection(shop.id, {
        google_cal_id: shop.google_cal_id ?? null,
        google_cal_credentials_encrypted: encodeVagaroCredentials(payload),
      });
      if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

      return c.json({
        ok: true,
        provider,
        configured: Boolean(payload.businessId),
      });
    }

    const parsed = squareConfigureSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const credentials = parseSquareConnectionCredentials(shop.google_cal_credentials_encrypted);
    if (!credentials?.access_token || !credentials.refresh_token) {
      return c.json({ ok: false, error: 'provider_not_connected' }, 400);
    }

    const payload = buildSquareConnectionPayload(credentials, {
      location_id: parsed.data.locationId,
      service_variation_id: parsed.data.serviceVariationId,
      team_member_id: parsed.data.teamMemberId,
    });

    const updated = await deps.shopsRepository.updateCalendarConnection(shop.id, {
      google_cal_id: shop.google_cal_id ?? null,
      google_cal_credentials_encrypted: encodeSquareConnectionCredentials(payload),
    });
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    return c.json({
      ok: true,
      provider,
      configured: true,
    });
  });

  app.post(path('/user/calendar/providers/:provider/disconnect'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_disconnect');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const provider = parseCalendarProviderParam(c.req.param('provider') ?? '');
    if (!provider) return c.json({ ok: false, error: 'provider_not_supported' }, 400);

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const parsed = parseSquareConnectionCredentials(shop.google_cal_credentials_encrypted);
    if (provider === 'square_appointments' && parsed?.provider === 'square_appointments') {
      const updated = await deps.shopsRepository.updateCalendarConnection(shop.id, {
        google_cal_id: shop.google_cal_id ?? null,
        google_cal_credentials_encrypted: null,
      });
      if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
      return c.json({ ok: true, disconnected: true, provider });
    }

    const mindbody =
      parseMindbodyCredentials(shop.integration_credentials_encrypted) ??
      parseMindbodyCredentials(shop.google_cal_credentials_encrypted);
    if (provider === 'mindbody' && mindbody?.provider === 'mindbody') {
      const updated = await deps.shopsRepository.updateIntegrationConnection(shop.id, {
        integration_credentials_encrypted: null,
      });
      if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
      if (parseMindbodyCredentials(shop.google_cal_credentials_encrypted)?.provider === 'mindbody') {
        await deps.shopsRepository.updateCalendarConnection(shop.id, {
          google_cal_id: shop.google_cal_id ?? null,
          google_cal_credentials_encrypted: null,
        });
      }
      await deps.shopsRepository.updateUserSettings(shop.id, {
        selected_integration: null,
      });
      logger.info({ provider: 'mindbody', shop_id: shop.id, user_id: null, user_email: sessionResult.email, status: 'success' }, 'integration_mindbody_disconnect');
      return c.json({ ok: true, disconnected: true, provider });
    }

    const acuity =
      parseAcuityCredentials(shop.integration_credentials_encrypted) ??
      parseAcuityCredentials(shop.google_cal_credentials_encrypted);
    if (provider === 'acuity' && acuity?.provider === 'acuity') {
      const updated = await deps.shopsRepository.updateIntegrationConnection(shop.id, {
        integration_credentials_encrypted: null,
      });
      if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
      if (parseAcuityCredentials(shop.google_cal_credentials_encrypted)?.provider === 'acuity') {
        await deps.shopsRepository.updateCalendarConnection(shop.id, {
          google_cal_id: shop.google_cal_id ?? null,
          google_cal_credentials_encrypted: null,
        });
      }
      await deps.shopsRepository.updateUserSettings(shop.id, {
        selected_integration: null,
      });
      logger.info({ provider: 'acuity', shop_id: shop.id, user_id: null, user_email: sessionResult.email, status: 'success' }, 'integration_acuity_disconnect');
      return c.json({ ok: true, disconnected: true, provider });
    }

    return c.json({ ok: true, disconnected: false, provider });
  });

  app.get(path('/user/billing'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_billing_get');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.billingSubscriptionsRepository || !deps.billingCustomersRepository || !deps.shopAccessStatesRepository) {
      return c.json({ ok: false, error: 'billing_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const [customer, subscription] = await Promise.all([
      deps.billingCustomersRepository.findByShopId(shop.id),
      deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id),
    ]);
    const access = await getShopBillingAccess(
      {
        shopsRepository: deps.shopsRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopAccessStatesRepository: deps.shopAccessStatesRepository,
        testCallAttemptsRepository: deps.testCallAttemptsRepository,
      },
      { shopId: shop.id },
    );
    const catalog = getPlanCatalogEntry(subscription?.plan ?? shop.plan);
    const amountCents = access.amountCents ?? catalog.amountCents ?? 0;
    const commercialAccount = deps.commercialAccountsRepository ? await deps.commercialAccountsRepository.findByShopId(shop.id).catch(() => null) : null;
    let usage = null;
    if (deps.callLogsRepository) {
      let usageTimedOut = false;
      let usageTimeout: ReturnType<typeof setTimeout> | null = null;
      const usageTimeoutPromise = new Promise<null>((resolve) => {
        usageTimeout = setTimeout(() => {
          usageTimedOut = true;
          logger.warn({ shopId: shop.id }, 'user_billing_usage_timeout');
          resolve(null);
        }, 2500);
      });
      usage = await Promise.race([
        getShopUsageForPeriod(
          { callLogsRepository: deps.callLogsRepository, shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository },
          { shop, commercialAccount },
        ).catch((err) => {
          logger.warn({ err, shopId: shop.id }, 'user_billing_usage_unavailable');
          return null;
        }),
        usageTimeoutPromise,
      ]);
      if (!usageTimedOut && usageTimeout) clearTimeout(usageTimeout);
    }
    const env = getEnv();
    const selfServePlan = isSelfServeTrialPlan(shop.plan);
    const subscriptionProvider = subscription?.provider ?? customer?.provider ?? deps.billingProvider?.provider ?? 'manual';
    const upgradeMetadata = subscription?.metadata?.pending_plan_upgrade;
    const pendingPlanUpgrade =
      upgradeMetadata && typeof upgradeMetadata === 'object'
        ? {
            targetPlan:
              (upgradeMetadata as Record<string, unknown>).targetPlan === 'professional'
                ? 'professional'
                : null,
            billingInterval:
              (upgradeMetadata as Record<string, unknown>).billingInterval === 'year'
                ? 'annual'
                : (upgradeMetadata as Record<string, unknown>).billingInterval === 'month'
                  ? 'monthly'
                  : null,
            requestedAt:
              typeof (upgradeMetadata as Record<string, unknown>).requestedAt === 'string'
                ? ((upgradeMetadata as Record<string, unknown>).requestedAt as string)
                : null,
          }
        : null;
    const manageBillingAvailable = Boolean(
      env.BILLING_MANAGE_ENABLED &&
        selfServePlan &&
        deps.billingProvider?.provider === 'paddle' &&
        typeof deps.billingProvider.createManageBillingSession === 'function' &&
        subscription?.provider === 'paddle' &&
        ['active', 'trialing', 'past_due', 'paused'].includes(subscription.status) &&
        subscription.providerCustomerId?.trim() &&
        subscription.providerSubscriptionId?.trim(),
    );
    const checkoutAvailable = Boolean(
      env.BILLING_CHECKOUT_ENABLED &&
        deps.billingProvider &&
        env.PADDLE_CLIENT_TOKEN &&
        selfServePlan,
    );
    const availableBillingIntervals = [
      env.PADDLE_PRICE_STARTER_MONTHLY && env.PADDLE_PRICE_PROFESSIONAL_MONTHLY ? 'monthly' : null,
      env.PADDLE_PRICE_STARTER_ANNUAL && env.PADDLE_PRICE_PROFESSIONAL_ANNUAL ? 'annual' : null,
    ].filter((value): value is 'monthly' | 'annual' => value !== null);

    return c.json({
      ok: true,
      shop: {
        id: shop.id,
        name: shop.name,
        plan: shop.plan,
        active: shop.active,
        timezone: shop.timezone,
      },
      billing: {
        provider: subscriptionProvider,
        customer,
        subscription,
        plan: subscription?.plan ?? shop.plan,
        planLabel: catalog.label,
        status: subscription?.status ?? 'incomplete',
        amountCents,
        formattedPrice: amountCents > 0 ? formatPlanPrice({ ...catalog, amountCents }) : 'Custom',
        currency: subscription?.currency ?? catalog.currency,
        interval: subscription?.interval ?? catalog.interval,
        trialStartedAt: subscription?.trialStartedAt ?? null,
        trialEndsAt: subscription?.trialEndsAt ?? null,
        trialDaysRemaining: access.trialDaysRemaining,
        currentPeriodStart: subscription?.currentPeriodStart ?? null,
        currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
        createdAt: subscription?.createdAt ?? null,
        paymentMethodStatus: access.paymentMethodStatus,
        hasPaymentMethod: access.paymentMethodStatus === 'valid',
        liveCallsEnabled: access.liveCallsEnabled,
        canOnboard: true,
        canTestCall: access.canTestCall,
        canGoLive: access.canGoLive,
        canReceiveLiveCalls: access.canReceiveLiveCalls,
        blockReason: access.blockReason,
        commercialGoLiveApproved: access.commercialGoLiveApproved,
        commercialApprovalRequired: access.blockReason === 'commercial_approval_required',
        requiresPaymentMethodBeforeGoLive: access.paymentMethodStatus !== 'valid',
        trialNoChargeUntilEndVerified: env.PADDLE_TRIAL_CONFIG_VERIFIED === true,
        checkoutAvailable,
        checkoutDisabledReason: checkoutAvailable
          ? null
          : env.BILLING_CHECKOUT_ENABLED
            ? 'billing_provider_unavailable'
            : 'billing_checkout_disabled',
        availableBillingIntervals,
        manageBillingAvailable,
        manageBillingDisabledReason: manageBillingAvailable
          ? null
          : !env.BILLING_MANAGE_ENABLED
            ? 'billing_manage_disabled'
            : !selfServePlan
              ? 'plan_not_self_serve'
              : deps.billingProvider?.provider !== 'paddle' || typeof deps.billingProvider?.createManageBillingSession !== 'function'
                ? 'billing_management_unavailable'
                : subscription?.provider !== 'paddle'
                  ? 'provider_not_supported'
                  : !subscription?.providerCustomerId?.trim()
                    ? 'missing_provider_customer_id'
                    : !subscription?.providerSubscriptionId?.trim()
                      ? 'missing_provider_subscription_id'
                      : ['canceled', 'trial_expired', 'unpaid', 'incomplete', 'unknown'].includes(subscription.status)
                        ? 'subscription_not_manageable'
                        : 'billing_management_unavailable',
        canViewInvoicesViaPortal: manageBillingAvailable,
        canUpdatePaymentMethodViaPortal: manageBillingAvailable,
        canCancelViaPortal: manageBillingAvailable,
        selfServeUpgradeAvailable: Boolean(
          env.BILLING_CHECKOUT_ENABLED &&
            shop.plan === 'starter' &&
            subscription?.plan === 'starter' &&
            subscription.provider === 'paddle' &&
            ['active', 'trialing'].includes(subscription.status) &&
            subscription.providerCustomerId?.trim() &&
            subscription.providerSubscriptionId?.trim() &&
            deps.billingProvider?.provider === 'paddle' &&
            typeof deps.billingProvider.upgradeSubscriptionPlan === 'function',
        ),
        upgradeDisabledReason:
          !env.BILLING_CHECKOUT_ENABLED
            ? 'billing_checkout_disabled'
            : shop.plan !== 'starter' || subscription?.plan !== 'starter'
            ? 'current_plan_not_starter'
            : subscription?.provider !== 'paddle'
              ? 'provider_not_supported'
              : !['active', 'trialing'].includes(subscription?.status ?? '')
                ? 'subscription_not_upgradeable'
                : !subscription?.providerCustomerId?.trim()
                  ? 'missing_provider_customer_id'
                  : !subscription?.providerSubscriptionId?.trim()
                    ? 'missing_provider_subscription_id'
                    : deps.billingProvider?.provider !== 'paddle' || typeof deps.billingProvider.upgradeSubscriptionPlan !== 'function'
                      ? 'billing_upgrade_unavailable'
                      : null,
        pendingPlanUpgrade: pendingPlanUpgrade?.targetPlan ? pendingPlanUpgrade : null,
        billingHistoryLabel: 'Account billing activity',
        forwardingNumber: shop.telnyx_number?.trim() ? shop.telnyx_number.trim() : null,
        usage,
      },
    });
  });

  app.get(path('/user/billing/transactions'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_billing_transactions');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.billingProvider || !deps.billingSubscriptionsRepository || !deps.billingCustomersRepository) {
      return c.json({
        ok: true,
        available: false,
        reason: 'billing_transactions_unavailable',
        transactions: [],
        message: 'Official invoices and receipts are available in Manage billing.',
      });
    }
    if (deps.billingProvider.provider !== 'paddle' || typeof deps.billingProvider.listBillingTransactions !== 'function') {
      return c.json({
        ok: true,
        available: false,
        reason: 'provider_not_supported',
        transactions: [],
        message: 'Official invoices and receipts are available in Manage billing.',
      });
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
    if (!subscription || subscription.provider !== 'paddle') {
      return c.json({
        ok: true,
        available: false,
        reason: 'provider_not_supported',
        transactions: [],
        message: 'Payments and invoices will appear after your first billing event.',
      });
    }

    const providerCustomerId = subscription.providerCustomerId?.trim();
    const providerSubscriptionId = subscription.providerSubscriptionId?.trim() ?? null;
    if (!providerCustomerId) {
      return c.json({
        ok: true,
        available: false,
        reason: 'missing_provider_customer_id',
        transactions: [],
        message: 'Payments and invoices will appear after your first billing event.',
      });
    }

    const [customerByProvider, subscriptionByProvider] = await Promise.all([
      deps.billingCustomersRepository.findByProviderCustomerId('paddle', providerCustomerId),
      providerSubscriptionId
        ? deps.billingSubscriptionsRepository.findByProviderSubscriptionId('paddle', providerSubscriptionId)
        : Promise.resolve(null),
    ]);
    if (customerByProvider && customerByProvider.shopId !== shop.id) {
      logger.error(
        {
          event: 'user_billing_transactions_ownership_conflict',
          reason: 'customer_shop_mismatch',
          shop_id: shop.id,
          provider_customer_id: providerCustomerId,
          existing_customer_shop_id: customerByProvider.shopId,
        },
        'user_billing_transactions_ownership_conflict',
      );
      return c.json({ ok: false, error: 'billing_ownership_conflict' }, 409);
    }
    if (subscriptionByProvider && subscriptionByProvider.shopId !== shop.id) {
      logger.error(
        {
          event: 'user_billing_transactions_ownership_conflict',
          reason: 'subscription_shop_mismatch',
          shop_id: shop.id,
          provider_subscription_id: providerSubscriptionId,
          existing_subscription_shop_id: subscriptionByProvider.shopId,
        },
        'user_billing_transactions_ownership_conflict',
      );
      return c.json({ ok: false, error: 'billing_ownership_conflict' }, 409);
    }

    try {
      const result = await deps.billingProvider.listBillingTransactions({
        providerCustomerId,
        providerSubscriptionId,
        limit: 20,
      });
      return c.json({
        ok: true,
        available: true,
        provider: result.provider,
        transactions: result.transactions,
        hasMore: result.hasMore === true,
        nextCursor: result.nextCursor ?? null,
        message: null,
      });
    } catch (err) {
      logger.warn(
        {
          err,
          shopId: shop.id,
          providerCustomerId,
          providerSubscriptionId,
        },
        'user_billing_transactions_fetch_failed',
      );
      return c.json({
        ok: true,
        available: false,
        reason: 'paddle_transactions_unavailable',
        transactions: [],
        message: 'We could not load Paddle payment history right now. You can still view official invoices and receipts in Manage billing.',
      });
    }
  });

  app.post(path('/user/billing/manage'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_billing_manage, 'user_billing_manage');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.billingProvider || !deps.billingSubscriptionsRepository || !deps.billingCustomersRepository) {
      return c.json({ ok: false, error: 'billing_management_unavailable' }, 500);
    }
    if (!getEnv().BILLING_MANAGE_ENABLED) {
      logger.warn(
        { event: 'user_billing_manage_disabled', shop_id: sessionResult.shopId ?? null },
        'user_billing_manage_disabled',
      );
      return c.json(
        {
          ok: false,
          error: 'billing_manage_disabled',
          message: 'Billing management is temporarily unavailable. Contact support if you need help updating payment details or managing your subscription.',
        },
        503,
      );
    }

    const rawBody = await c.req.json().catch(() => ({}));
    const parsed = userBillingManageSchema.safeParse(rawBody ?? {});
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isSelfServeTrialPlan(shop.plan)) {
      return c.json({ ok: false, error: 'plan_not_self_serve', message: 'Please contact support to manage billing for this account.' }, 400);
    }
    if (deps.billingProvider.provider !== 'paddle' || typeof deps.billingProvider.createManageBillingSession !== 'function') {
      return c.json({ ok: false, error: 'billing_management_unavailable', message: 'Billing management is not available right now. Please contact support or try again later.' }, 503);
    }

    const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
    if (!subscription || subscription.provider !== 'paddle') {
      return c.json({ ok: false, error: 'provider_not_supported', message: 'Billing management is not available for this account.' }, 409);
    }
    if (!['active', 'trialing', 'past_due', 'paused'].includes(subscription.status)) {
      return c.json({ ok: false, error: 'subscription_not_manageable', message: 'This subscription cannot be managed through self-service billing right now.' }, 409);
    }

    const providerCustomerId = subscription.providerCustomerId?.trim();
    const providerSubscriptionId = subscription.providerSubscriptionId?.trim();
    if (!providerCustomerId) return c.json({ ok: false, error: 'missing_provider_customer_id', message: 'Billing management is not ready for this account yet.' }, 409);
    if (!providerSubscriptionId) return c.json({ ok: false, error: 'missing_provider_subscription_id', message: 'Billing management is not ready for this account yet.' }, 409);

    const [customerByProvider, subscriptionByProvider] = await Promise.all([
      deps.billingCustomersRepository.findByProviderCustomerId('paddle', providerCustomerId),
      deps.billingSubscriptionsRepository.findByProviderSubscriptionId('paddle', providerSubscriptionId),
    ]);
    if (customerByProvider && customerByProvider.shopId !== shop.id) {
      logger.error(
        {
          event: 'user_billing_manage_ownership_conflict',
          reason: 'customer_shop_mismatch',
          shop_id: shop.id,
          provider_customer_id: providerCustomerId,
          existing_customer_shop_id: customerByProvider.shopId,
        },
        'user_billing_manage_ownership_conflict',
      );
      return c.json({ ok: false, error: 'billing_ownership_conflict' }, 409);
    }
    if (subscriptionByProvider && subscriptionByProvider.shopId !== shop.id) {
      logger.error(
        {
          event: 'user_billing_manage_ownership_conflict',
          reason: 'subscription_shop_mismatch',
          shop_id: shop.id,
          provider_subscription_id: providerSubscriptionId,
          existing_subscription_shop_id: subscriptionByProvider.shopId,
        },
        'user_billing_manage_ownership_conflict',
      );
      return c.json({ ok: false, error: 'billing_ownership_conflict' }, 409);
    }

    try {
      const session = await deps.billingProvider.createManageBillingSession({
        shop,
        providerCustomerId,
        providerSubscriptionId,
      });
      return c.json({
        ok: true,
        provider: session.provider,
        manageUrl: session.manageUrl,
        canViewInvoicesViaPortal: session.canViewInvoicesViaPortal === true,
        canUpdatePaymentMethodViaPortal: session.canUpdatePaymentMethodViaPortal === true,
        canCancelViaPortal: session.canCancelViaPortal === true,
      });
    } catch (err) {
      logger.error(
        {
          err,
          shopId: shop.id,
          providerCustomerId,
          providerSubscriptionId,
        },
        'user_billing_manage_create_failed',
      );
      return c.json(
        {
          ok: false,
          error: 'billing_management_failed',
          message: 'Billing management is not available right now. Please contact support or try again later.',
        },
        502,
      );
    }
  });

  app.post(path('/user/billing/upgrade'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_billing_upgrade, 'user_billing_upgrade');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.billingProvider || !deps.billingSubscriptionsRepository || !deps.billingCustomersRepository) {
      return c.json({ ok: false, error: 'billing_upgrade_unavailable' }, 500);
    }

    const rawBody = await c.req.json().catch(() => null);
    const parsed = userBillingUpgradeSchema.safeParse(rawBody);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    if (!getEnv().BILLING_CHECKOUT_ENABLED) {
      return c.json(
        {
          ok: false,
          error: 'billing_checkout_disabled',
          message: 'Plan upgrades are not enabled for this environment yet.',
        },
        503,
      );
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (shop.plan !== 'starter') {
      return c.json({ ok: false, error: 'current_plan_not_starter', message: 'Only Starter accounts can upgrade to Professional in-app right now.' }, 409);
    }
    if (parsed.data.target_plan !== 'professional') {
      return c.json({ ok: false, error: 'invalid_target_plan' }, 400);
    }
    if (deps.billingProvider.provider !== 'paddle' || typeof deps.billingProvider.upgradeSubscriptionPlan !== 'function') {
      return c.json({ ok: false, error: 'billing_upgrade_unavailable', message: 'Plan upgrade is not available right now. Please contact support.' }, 503);
    }

    const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
    if (!subscription || subscription.provider !== 'paddle') {
      return c.json({ ok: false, error: 'provider_not_supported', message: 'This subscription cannot be upgraded in-app yet.' }, 409);
    }
    if (subscription.plan !== 'starter') {
      return c.json({ ok: false, error: 'current_plan_not_starter', message: 'This account is not on Starter.' }, 409);
    }
    if (!['active', 'trialing'].includes(subscription.status)) {
      return c.json({ ok: false, error: 'subscription_not_upgradeable', message: 'Resolve billing before upgrading your plan.' }, 409);
    }

    const providerCustomerId = subscription.providerCustomerId?.trim();
    const providerSubscriptionId = subscription.providerSubscriptionId?.trim();
    if (!providerCustomerId) return c.json({ ok: false, error: 'missing_provider_customer_id', message: 'Billing is not ready for plan upgrade yet.' }, 409);
    if (!providerSubscriptionId) return c.json({ ok: false, error: 'missing_provider_subscription_id', message: 'Billing is not ready for plan upgrade yet.' }, 409);

    const [customerByProvider, subscriptionByProvider] = await Promise.all([
      deps.billingCustomersRepository.findByProviderCustomerId('paddle', providerCustomerId),
      deps.billingSubscriptionsRepository.findByProviderSubscriptionId('paddle', providerSubscriptionId),
    ]);
    if (customerByProvider && customerByProvider.shopId !== shop.id) {
      logger.error(
        {
          event: 'user_billing_upgrade_ownership_conflict',
          reason: 'customer_shop_mismatch',
          shop_id: shop.id,
          provider_customer_id: providerCustomerId,
          existing_customer_shop_id: customerByProvider.shopId,
        },
        'user_billing_upgrade_ownership_conflict',
      );
      return c.json({ ok: false, error: 'billing_ownership_conflict' }, 409);
    }
    if (subscriptionByProvider && subscriptionByProvider.shopId !== shop.id) {
      logger.error(
        {
          event: 'user_billing_upgrade_ownership_conflict',
          reason: 'subscription_shop_mismatch',
          shop_id: shop.id,
          provider_subscription_id: providerSubscriptionId,
          existing_subscription_shop_id: subscriptionByProvider.shopId,
        },
        'user_billing_upgrade_ownership_conflict',
      );
      return c.json({ ok: false, error: 'billing_ownership_conflict' }, 409);
    }

    const billingInterval = parsed.data.billing_interval === 'annual' ? 'year' : 'month';
    const prorationBillingMode = 'prorated_next_billing_period' as const;
    try {
      const upgrade = await deps.billingProvider.upgradeSubscriptionPlan({
        shop,
        providerCustomerId,
        providerSubscriptionId,
        targetPlan: 'professional',
        billingInterval,
        prorationBillingMode,
      });
      await deps.billingSubscriptionsRepository.updateById(subscription.id, {
        metadata: {
          ...(subscription.metadata ?? {}),
          pending_plan_upgrade: {
            targetPlan: upgrade.targetPlan,
            billingInterval: upgrade.billingInterval,
            prorationBillingMode: upgrade.prorationBillingMode,
            requestedAt: new Date().toISOString(),
            requestedBy: sessionResult.email,
          },
        },
      }).catch((err) => {
        logger.warn({ err, shopId: shop.id, providerSubscriptionId }, 'user_billing_upgrade_pending_metadata_failed');
      });
      return c.json({
        ok: true,
        status: 'pending',
        message: 'Your upgrade is being processed. Professional features will unlock after billing is confirmed.',
      });
    } catch (err) {
      logger.error(
        {
          err,
          shopId: shop.id,
          providerSubscriptionId,
          targetPlan: 'professional',
          billingInterval,
        },
        'user_billing_upgrade_failed',
      );
      return c.json(
        {
          ok: false,
          error: 'billing_upgrade_failed',
          message: 'Plan upgrade could not start. Please try again or contact support.',
        },
        502,
      );
    }
  });

  app.post(path('/user/billing/checkout'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_billing_checkout, 'user_billing_checkout');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (
      !deps.shopsRepository ||
      !deps.billingProvider ||
      !deps.billingSubscriptionsRepository ||
      !deps.billingCustomersRepository ||
      !deps.shopAccessStatesRepository
    ) {
      return c.json({ ok: false, error: 'billing_provider_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = userBillingCheckoutSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    if (!getEnv().BILLING_CHECKOUT_ENABLED) {
      return c.json(
        {
          ok: false,
          error: 'billing_checkout_disabled',
          message: 'Billing checkout is not enabled for this environment yet.',
        },
        503,
      );
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    let subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
    const existingPaddleCustomer = await deps.billingCustomersRepository.findByShopId(shop.id, 'paddle');
    if (!subscription && isSelfServeTrialPlan(shop.plan)) {
      const trial = await createNoCardTrialForShop(
        {
          billingCustomersRepository: deps.billingCustomersRepository,
          billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
          shopAccessStatesRepository: deps.shopAccessStatesRepository,
        },
        {
          shopId: shop.id,
          email: sessionResult.email,
          plan: shop.plan,
        },
      );
      subscription = trial.subscription;
    }
    if (
      subscription?.status === 'unknown' &&
      isSelfServeTrialPlan(subscription.plan) &&
      !subscription.providerSubscriptionId?.trim() &&
      !subscription.providerCustomerId?.trim() &&
      subscription.trialEndsAt
    ) {
      const trialEndsAtMs = new Date(subscription.trialEndsAt).getTime();
      const normalizedStatus: BillingSubscriptionStatus = Number.isFinite(trialEndsAtMs) && trialEndsAtMs > Date.now() ? 'trialing' : 'trial_expired';
      subscription =
        (await deps.billingSubscriptionsRepository.updateById(subscription.id, {
          provider: 'internal',
          status: normalizedStatus,
          paymentMethodStatus: 'none',
          metadata: {
            ...(subscription.metadata ?? {}),
            normalized_from_unknown_for_checkout: true,
            normalized_at: new Date().toISOString(),
          },
        })) ?? subscription;
    }
    if (!subscription || !['trialing', 'trial_expired', 'paused', 'canceled', 'active', 'incomplete', 'past_due', 'unpaid'].includes(subscription.status)) {
      logger.warn(
        {
          shopId: shop.id,
          plan: shop.plan,
          subscriptionId: subscription?.id ?? null,
          subscriptionStatus: subscription?.status ?? null,
          subscriptionProvider: subscription?.provider ?? null,
          providerCustomerId: subscription?.providerCustomerId ?? existingPaddleCustomer?.providerCustomerId ?? null,
          providerSubscriptionId: subscription?.providerSubscriptionId ?? null,
          hasExistingPaddleCustomer: Boolean(existingPaddleCustomer?.providerCustomerId?.trim()),
        },
        'user_billing_checkout_subscription_not_ready',
      );
      return c.json(
        {
          ok: false,
          error: 'subscription_not_ready_for_payment_setup',
          message: 'Payment setup is not ready for this account yet. Please contact support if you are ready to go live.',
        },
        409,
      );
    }
    if (
      subscription.paymentMethodStatus === 'valid' ||
      (subscription.provider === 'paddle' && Boolean(subscription.providerSubscriptionId?.trim()))
    ) {
      return c.json(
        {
          ok: false,
          error: 'billing_already_started',
          message: 'Billing is already started for this account. Refresh Billing or use Manage billing.',
        },
        409,
      );
    }
    if (
      existingPaddleCustomer?.providerCustomerId?.trim() &&
      !['trial_expired', 'paused', 'canceled', 'past_due', 'unpaid', 'incomplete'].includes(subscription.status)
    ) {
      return c.json(
        {
          ok: false,
          error: 'payment_setup_pending',
          message: 'Payment setup is already pending. Refresh Billing in a minute; if it does not update, contact support.',
        },
        409,
      );
    }
    const checkoutPlan = subscription.plan;
    const billingInterval = parsed.data.billing_interval === 'annual' ? 'year' : 'month';
    if (!isSelfServeTrialPlan(checkoutPlan)) {
      return c.json({ ok: false, error: 'plan_not_self_serve', message: 'Please contact sales for custom plans.' }, 400);
    }

    const appBaseUrl = getAppBaseUrl(c.req);
    const checkoutUrl = `${appBaseUrl}/checkout/paddle`;
    let session: Awaited<ReturnType<typeof deps.billingProvider.createCheckoutSession>>;
    try {
      session = await deps.billingProvider.createCheckoutSession({
        shop,
        plan: checkoutPlan,
        email: sessionResult.email,
        internalSubscriptionId: subscription.id,
        trialEndsAt: subscription.trialEndsAt ?? null,
        billingInterval,
        source: 'add_payment_method_before_go_live',
        checkoutUrl,
        successUrl: `${appBaseUrl}/user/billing?checkout=success`,
        cancelUrl: `${appBaseUrl}/user/billing?checkout=cancelled`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(
        {
          err,
          shopId: shop.id,
          plan: checkoutPlan,
          billingInterval,
        },
        'user_billing_checkout_create_failed',
      );
      if (errorMessage.startsWith('missing_paddle_price_id:')) {
        return c.json(
          {
            ok: false,
            error: 'billing_price_not_configured',
            message: 'Payment setup is not configured for this plan yet. Please contact support.',
          },
          503,
        );
      }
      return c.json(
        {
          ok: false,
          error: 'billing_checkout_failed',
          message: 'Payment setup could not start. Please open Billing or contact support.',
        },
        502,
      );
    }

    return c.json({
      ok: true,
      provider: session.provider,
      checkoutUrl: session.checkoutUrl,
      providerTransactionId: session.providerTransactionId ?? null,
      providerCustomerId: session.providerCustomerId ?? null,
      trialConfigVerified: session.trialConfigVerified ?? false,
    });
  });

  app.post(path('/user/billing/reactivate'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_billing_reactivate, 'user_billing_reactivate');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.billingProvider || !deps.billingSubscriptionsRepository) {
      return c.json({ ok: false, error: 'billing_provider_unavailable' }, 500);
    }
    if (!getEnv().BILLING_CHECKOUT_ENABLED) {
      return c.json(
        {
          ok: false,
          error: 'billing_checkout_disabled',
          message: 'Billing checkout is not enabled for this environment yet.',
        },
        503,
      );
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
    const unknownPaddleSubscriptionCanReactivate =
      subscription?.status === 'unknown' &&
      subscription.provider === 'paddle' &&
      Boolean(subscription.providerCustomerId?.trim() || subscription.providerSubscriptionId?.trim());
    if (!subscription || (!['trial_expired', 'paused', 'canceled', 'past_due', 'unpaid'].includes(subscription.status) && !unknownPaddleSubscriptionCanReactivate)) {
      return c.json({ ok: false, error: 'subscription_not_reactivatable' }, 409);
    }
    if (!isSelfServeTrialPlan(subscription.plan)) {
      return c.json({ ok: false, error: 'plan_not_self_serve', message: 'Please contact sales for custom plans.' }, 400);
    }
    const appBaseUrl = getAppBaseUrl(c.req);
    const checkoutUrl = `${appBaseUrl}/checkout/paddle`;
    const session = await deps.billingProvider.createCheckoutSession({
      shop,
      plan: subscription.plan,
      email: sessionResult.email,
      internalSubscriptionId: subscription.id,
      billingInterval: subscription.interval ?? 'month',
      source: 'reactivate_subscription',
      checkoutUrl,
      successUrl: `${appBaseUrl}/user/billing?checkout=success`,
      cancelUrl: `${appBaseUrl}/user/billing?checkout=cancelled`,
    });
    return c.json({
      ok: true,
      provider: session.provider,
      checkoutUrl: session.checkoutUrl,
      trialConfigVerified: session.trialConfigVerified ?? false,
    });
  });

  /**
   * P1.1 — Provision Telnyx DID into `shops.telnyx_number` only after valid payment + explicit go-live intent.
   * Does not modify `shop.phone_number` (business line). Idempotent when `telnyx_number` already set.
   */
  app.post(path('/user/phone-numbers/provision-forwarding-number'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_provision_forwarding_number, 'user_provision_forwarding_number');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;

    const body = await c.req.json().catch(() => null);
    const parsedBody = provisionForwardingNumberSchema.safeParse(body);
    if (!parsedBody.success) {
      return c.json(
        {
          ok: false,
          error: 'confirmation_required',
          message: 'You must confirm go-live intent (confirmGoLiveIntent: true).',
        },
        400,
      );
    }

    if (
      !deps.shopsRepository ||
      !deps.billingSubscriptionsRepository ||
      !deps.shopAccessStatesRepository ||
      !deps.phoneProvisioningService
    ) {
      return c.json({ ok: false, error: 'forwarding_provision_dependencies_unavailable' }, 503);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });

    if (!isShopSetupWizardComplete(shop)) {
      return c.json({ ok: false, error: 'onboarding_incomplete', message: 'Finish setup wizard before provisioning a forwarding number.' }, 409);
    }

    const accessState = await deps.shopAccessStatesRepository.findByShopId(shop.id);
    if (isCommercialGoLiveApprovalRequired({ plan: shop.plan, accessState })) {
      return c.json(
        {
          ok: false,
          error: 'commercial_approval_required',
          message: 'Your Custom setup must be approved by the RingBooker team before live answering can be enabled.',
        },
        403,
      );
    }
    if (accessState?.liveCallsEnabled) {
      return c.json({ ok: false, error: 'live_already_enabled' }, 409);
    }

    const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
    if (!subscription) {
      return c.json({ ok: false, error: 'no_subscription' }, 409);
    }

    const now = new Date();
    const subscriptionActive =
      subscription.status === 'active' || isBillingTrialStillValid(subscription, now);
    if (!subscriptionActive) {
      const expired =
        subscription.status === 'trial_expired' ||
        (subscription.status === 'trialing' && !isBillingTrialStillValid(subscription, now));
      return c.json(
        {
          ok: false,
          error: expired ? 'trial_expired' : 'subscription_inactive',
        },
        409,
      );
    }

    if (subscription.paymentMethodStatus !== 'valid') {
      return c.json(
        {
          ok: false,
          error: 'payment_method_required',
          message: 'Add a valid payment method before provisioning a forwarding number.',
          billingUrl: '/user/billing',
        },
        402,
      );
    }

    const existingForwarding = shop.telnyx_number?.trim();
    if (existingForwarding) {
      return c.json({
        ok: true,
        forwardingNumber: existingForwarding,
        status: 'existing',
        nextStep: 'show_forwarding_instructions',
      });
    }

    const lockStartedAt = new Date();
    const lock = await deps.shopsRepository.tryBeginForwardingNumberProvisioning({
      shopId: shop.id,
      startedAt: lockStartedAt,
      staleBefore: new Date(lockStartedAt.getTime() - 10 * 60 * 1000),
    });
    if (!lock.acquired) {
      if (lock.reason === 'already_provisioned' && lock.shop?.telnyx_number?.trim()) {
        return c.json({
          ok: true,
          forwardingNumber: lock.shop.telnyx_number.trim(),
          status: 'existing',
          nextStep: 'show_forwarding_instructions',
        });
      }
      if (lock.reason === 'already_provisioning') {
        return c.json(
          {
            ok: false,
            error: 'forwarding_number_provisioning_in_progress',
            message: 'A forwarding number is already being provisioned. Please wait a moment and refresh.',
          },
          409,
        );
      }
      return c.json({ ok: false, error: 'shop_not_found' }, 404);
    }

    const lockedShop = await deps.shopsRepository.findById(shop.id);
    const forwardingAfterLock = lockedShop?.telnyx_number?.trim();
    if (forwardingAfterLock) {
      return c.json({
        ok: true,
        forwardingNumber: forwardingAfterLock,
        status: 'existing',
        nextStep: 'show_forwarding_instructions',
      });
    }

    securityAudit({
      action: 'forwarding_number_requested',
      actorType: 'user',
      actorId: sessionResult.email,
      ip,
      path: c.req.path,
      details: { shopId: shop.id },
    });

    const countryCode = telnyxCountryCodeFromForwardingCountry(shop.forwarding_country);
    let candidates;
    try {
      candidates = await deps.phoneProvisioningService.searchAvailableNumbers({
        countryCode,
        limit: 12,
      });
    } catch (error) {
      await deps.shopsRepository.updateUserSettings(shop.id, {
        forwarding_number_status: 'failed',
        forwarding_number_provisioning_started_at: null,
        forwarding_number_last_error: error instanceof Error ? error.message.slice(0, 500) : 'forwarding_number_search_failed',
      });
      securityAudit({
        action: 'forwarding_number_failed',
        actorType: 'user',
        actorId: sessionResult.email,
        ip,
        path: c.req.path,
        details: {
          shopId: shop.id,
          phase: 'search',
          message: error instanceof Error ? error.message : 'unknown',
        },
      });
      await enqueueLifecycleEmail({
        shopId: shop.id,
        kind: 'forwarding_number_failed_user',
        subscriptionId: subscription.id,
        idempotencySuffix: 'forwarding_number_failed_user:search',
      });
      await enqueueLifecycleEmail({
        shopId: shop.id,
        kind: 'forwarding_number_failed_internal',
        subscriptionId: subscription.id,
        title: 'Telnyx forwarding number search failed',
        summary: 'Forwarding number search failed during user go-live setup.',
        fields: { shop_id: shop.id, phase: 'search' },
        idempotencySuffix: `forwarding_number_failed_internal:search:${Date.now()}`,
      });
      return c.json({ ok: false, error: 'forwarding_number_search_failed' }, 502);
    }

    if (!candidates.length) {
      await deps.shopsRepository.updateUserSettings(shop.id, {
        forwarding_number_status: 'failed',
        forwarding_number_provisioning_started_at: null,
        forwarding_number_last_error: 'no_numbers_available',
      });
      securityAudit({
        action: 'forwarding_number_failed',
        actorType: 'user',
        actorId: sessionResult.email,
        ip,
        path: c.req.path,
        details: { shopId: shop.id, phase: 'search', message: 'no_numbers_available' },
      });
      await enqueueLifecycleEmail({
        shopId: shop.id,
        kind: 'forwarding_number_failed_user',
        subscriptionId: subscription.id,
        idempotencySuffix: 'forwarding_number_failed_user:no_numbers_available',
      });
      await enqueueLifecycleEmail({
        shopId: shop.id,
        kind: 'forwarding_number_failed_internal',
        subscriptionId: subscription.id,
        title: 'No Telnyx forwarding numbers available',
        summary: 'No forwarding number candidates were available for a shop.',
        fields: { shop_id: shop.id, country_code: countryCode },
        idempotencySuffix: `forwarding_number_failed_internal:no_numbers_available:${Date.now()}`,
      });
      return c.json({ ok: false, error: 'forwarding_number_search_empty' }, 503);
    }

    const flowRequestId = randomUUID();
    let lastErrorMessage = 'unknown';
    for (const candidate of candidates.slice(0, 8)) {
      try {
        const order = await deps.phoneProvisioningService.provisionNumber({
          phoneNumber: candidate.phoneNumber,
          requestId: `${flowRequestId}:${candidate.phoneNumber}`,
        });
        let saved: Shop | null = null;
        try {
          saved = await deps.shopsRepository.updateUserSettings(shop.id, {
            telnyx_number: order.phoneNumber,
            forwarding_number_status: 'provisioned',
            forwarding_number_provisioning_started_at: null,
            forwarding_number_provider_order_id: order.orderId ?? order.providerNumberId ?? null,
            forwarding_number_last_error: null,
          });
        } catch (persistError) {
          if (deps.phoneProvisioningService.releaseNumber) {
            await deps.phoneProvisioningService
              .releaseNumber({
                phoneNumber: order.phoneNumber,
                providerNumberId: order.providerNumberId,
                orderId: order.orderId,
                reason: 'shop_persist_failed',
              })
              .catch((releaseError) => {
                logger.warn(
                  {
                    shopId: shop.id,
                    providerNumberId: order.providerNumberId ?? null,
                    orderId: order.orderId ?? null,
                    err: releaseError,
                  },
                  'forwarding_number_compensation_release_failed',
                );
              });
          }
          securityAudit({
            action: 'forwarding_number_failed',
            actorType: 'user',
            actorId: sessionResult.email,
            ip,
            path: c.req.path,
            details: {
              shopId: shop.id,
              phase: 'persist',
              providerNumberId: order.providerNumberId ?? null,
              providerOrderId: order.orderId ?? null,
              message: persistError instanceof Error ? persistError.message : 'unknown',
            },
          });
          await deps.shopsRepository.updateUserSettings(shop.id, {
            forwarding_number_status: 'failed',
            forwarding_number_provisioning_started_at: null,
            forwarding_number_provider_order_id: order.orderId ?? order.providerNumberId ?? null,
            forwarding_number_last_error: persistError instanceof Error ? persistError.message.slice(0, 500) : 'shop_persist_failed',
          }).catch(() => undefined);
          await enqueueLifecycleEmail({
            shopId: shop.id,
            kind: 'forwarding_number_failed_user',
            subscriptionId: subscription.id,
            idempotencySuffix: 'forwarding_number_failed_user:persist',
          });
          await enqueueLifecycleEmail({
            shopId: shop.id,
            kind: 'forwarding_number_failed_internal',
            subscriptionId: subscription.id,
            title: 'Telnyx forwarding number persist failed',
            summary: 'A forwarding number was provisioned but could not be persisted to the shop record.',
            fields: {
              shop_id: shop.id,
              phase: 'persist',
              provider_number_id: order.providerNumberId ?? null,
              provider_order_id: order.orderId ?? null,
            },
            idempotencySuffix: `forwarding_number_failed_internal:persist:${order.orderId ?? order.providerNumberId ?? flowRequestId}`,
          });
          return c.json({ ok: false, error: 'forwarding_number_persist_failed' }, 502);
        }
        if (!saved) {
          if (deps.phoneProvisioningService.releaseNumber) {
            await deps.phoneProvisioningService
              .releaseNumber({
                phoneNumber: order.phoneNumber,
                providerNumberId: order.providerNumberId,
                orderId: order.orderId,
                reason: 'shop_persist_failed',
              })
              .catch((releaseError) => {
                logger.warn(
                  {
                    shopId: shop.id,
                    providerNumberId: order.providerNumberId ?? null,
                    orderId: order.orderId ?? null,
                    err: releaseError,
                  },
                  'forwarding_number_compensation_release_failed',
                );
              });
          }
          securityAudit({
            action: 'forwarding_number_failed',
            actorType: 'user',
            actorId: sessionResult.email,
            ip,
            path: c.req.path,
            details: { shopId: shop.id, phase: 'persist', message: 'shop_not_found' },
          });
          return c.json({ ok: false, error: 'shop_not_found' }, 404);
        }
        securityAudit({
          action: 'forwarding_number_provisioned',
          actorType: 'user',
          actorId: sessionResult.email,
          ip,
          path: c.req.path,
          details: {
            shopId: shop.id,
            forwardingNumberLast4: order.phoneNumber.slice(-4),
            providerNumberId: order.providerNumberId ?? null,
          },
        });
        await deps.shopAccessStatesRepository.upsert({
          shopId: shop.id,
          forwardingSetupVerifiedAt: null,
          forwardingSetupVerifiedVia: null,
        });
        await enqueueLifecycleEmail({
          shopId: shop.id,
          kind: 'forwarding_number_ready',
          subscriptionId: subscription.id,
          forwardingNumber: order.phoneNumber,
        });
        return c.json({
          ok: true,
          forwardingNumber: order.phoneNumber,
          status: 'provisioned',
          nextStep: 'show_forwarding_instructions',
        });
      } catch (error) {
        lastErrorMessage = error instanceof Error ? error.message : 'unknown';
      }
    }

    await deps.shopsRepository.updateUserSettings(shop.id, {
      forwarding_number_status: 'failed',
      forwarding_number_provisioning_started_at: null,
      forwarding_number_last_error: lastErrorMessage.slice(0, 500),
    });

    securityAudit({
      action: 'forwarding_number_failed',
      actorType: 'user',
      actorId: sessionResult.email,
      ip,
      path: c.req.path,
      details: { shopId: shop.id, phase: 'provision', message: lastErrorMessage },
    });
    await enqueueLifecycleEmail({
      shopId: shop.id,
      kind: 'forwarding_number_failed_user',
      subscriptionId: subscription.id,
      idempotencySuffix: 'forwarding_number_failed_user:provision',
    });
    await enqueueLifecycleEmail({
      shopId: shop.id,
      kind: 'forwarding_number_failed_internal',
      subscriptionId: subscription.id,
      title: 'Telnyx forwarding number provisioning failed',
      summary: 'All forwarding number provisioning candidates failed.',
      fields: { shop_id: shop.id, phase: 'provision' },
      idempotencySuffix: `forwarding_number_failed_internal:provision:${Date.now()}`,
    });
    return c.json({ ok: false, error: 'forwarding_number_provision_failed' }, 502);
  });

  /*
   * P1 (onboarding/go-live sprint): require forwarding number provisioned + forwarding test passed
   * (or explicit confirmation) before allowing live_calls_enabled. See docs/onboarding_go_live_sprint.md.
   */
  app.post(path('/user/go-live/enable'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_go_live_enable, 'user_go_live_enable');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.billingSubscriptionsRepository || !deps.shopAccessStatesRepository) {
      return c.json({ ok: false, error: 'billing_dependencies_unavailable' }, 500);
    }
    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const gate = evaluateKnowledgeGate(shop);
    if (!canProceedToGoLive(gate)) {
      return c.json(
        {
          ok: false,
          error: 'knowledge_incomplete',
          message: 'Finish business name, timezone, hours, and at least one service before enabling live answering.',
          gate,
        },
        409,
      );
    }
    const access = await getShopBillingAccess(
      {
        shopsRepository: deps.shopsRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopAccessStatesRepository: deps.shopAccessStatesRepository,
        testCallAttemptsRepository: deps.testCallAttemptsRepository,
      },
      { shopId: shop.id },
    );
    if (!access.canGoLive) {
      const status = access.blockReason === 'payment_method_required' ? 402 : access.blockReason === 'commercial_approval_required' ? 403 : 409;
      const messageByReason: Partial<Record<BillingBlockReason, string>> = {
        payment_method_required: buildGoLivePaymentRequiredMessage(),
        commercial_approval_required:
          'Your Custom setup must be approved by the RingBooker team before live answering can be enabled.',
        forwarding_number_required:
          'Provision your RingBooker forwarding number before enabling live answering.',
        forwarding_verification_required:
          'Run a forwarding connectivity check or confirm setup before enabling live answering.',
        onboarding_incomplete: 'Finish the setup wizard before enabling live answering.',
      };
      const message =
        messageByReason[access.blockReason] ?? 'RingBooker cannot go live until your account is ready.';
      return c.json(
        {
          ok: false,
          error: access.blockReason === 'payment_method_required' ? 'payment_method_required' : access.blockReason,
          message,
          billingUrl: '/user/billing',
        },
        status,
      );
    }
    const next = await deps.shopAccessStatesRepository.upsert({
      shopId: shop.id,
      liveCallsEnabled: true,
      goLiveAt: new Date().toISOString(),
      liveCallsPausedReason: null,
      liveCallsPausedAt: null,
    });
    const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
    await enqueueLifecycleEmail({
      shopId: shop.id,
      kind: 'live_answering_enabled',
      subscriptionId: subscription?.id ?? null,
    });
    return c.json({ ok: true, liveCallsEnabled: next.liveCallsEnabled, goLiveAt: next.goLiveAt });
  });

  app.post(path('/user/go-live/disable'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_go_live_enable, 'user_go_live_disable');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopAccessStatesRepository) {
      return c.json({ ok: false, error: 'billing_dependencies_unavailable' }, 500);
    }
    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const next = await deps.shopAccessStatesRepository.upsert({
      shopId: shop.id,
      liveCallsEnabled: false,
      liveCallsPausedReason: 'user_disabled',
      liveCallsPausedAt: new Date().toISOString(),
    });
    securityAudit({
      action: 'live_answering_disabled',
      actorType: 'user',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: { shopId: shop.id },
    });
    return c.json({ ok: true, liveCallsEnabled: next.liveCallsEnabled });
  });

  app.post(path('/user/test-calls/call-me'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_test_calls_call_me, 'user_test_calls_call_me');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (
      !deps.shopsRepository ||
      !deps.billingSubscriptionsRepository ||
      !deps.shopAccessStatesRepository ||
      !deps.testCallAttemptsRepository ||
      !deps.telephonyService
    ) {
      return c.json({ ok: false, error: 'test_call_dependencies_unavailable' }, 500);
    }
    const body = await c.req.json().catch(() => ({}));
    const parsed = z.object({}).strict().safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const access = await getShopBillingAccess(
      {
        shopsRepository: deps.shopsRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopAccessStatesRepository: deps.shopAccessStatesRepository,
        testCallAttemptsRepository: deps.testCallAttemptsRepository,
      },
      { shopId: shop.id },
    );
    if (!access.canTestCall) {
      return c.json({ ok: false, error: access.blockReason, message: 'Test calls are not available for this account state.' }, 409);
    }
    const outboundCallerId =
      getEnv().RINGBOOKER_OUTBOUND_CALLER_ID?.trim() || getEnv().TELNYX_OUTBOUND_CALLER_ID?.trim();
    if (!outboundCallerId) {
      return c.json(
        {
          ok: false,
          error: 'outbound_caller_id_not_configured',
          message: 'RingBooker outbound caller ID is not configured.',
        },
        503,
      );
    }
    const destination = normalizeInboundE164(shop.user_phone);
    if (!destination) {
      return c.json(
        {
          ok: false,
          error: 'phone_number_required',
          message: 'A valid owner phone number is required before starting a call-me test.',
        },
        422,
      );
    }
    const attempt = await deps.testCallAttemptsRepository.create({
      shopId: shop.id,
      userId: null,
      type: 'outbound_call_me',
      status: 'requested',
      destinationPhone: destination,
      metadata: { source: 'call_me_test', no_card_required: true },
    });
    const requestId = `test-call-${attempt.id}`;
    try {
      const result = await deps.telephonyService.createOutboundCall({
        shopId: shop.id,
        to: destination,
        from: outboundCallerId,
        purpose: 'callback',
        requestId,
        idempotencyKey: `test_call:${attempt.id}`,
      });
      await deps.testCallAttemptsRepository.updateStatus(attempt.id, {
        status: 'started',
        metadata: { providerCallId: result.providerCallId ?? null, requestId },
      });
      return c.json({ ok: true, attemptId: attempt.id, status: 'started', providerCallId: result.providerCallId ?? null });
    } catch (error) {
      await deps.testCallAttemptsRepository.updateStatus(attempt.id, {
        status: 'failed',
        errorReason: error instanceof Error ? error.message : 'test_call_failed',
        completedAt: new Date().toISOString(),
      });
      return c.json({ ok: false, error: 'test_call_failed', attemptId: attempt.id }, 502);
    }
  });

  app.put(path('/user/settings'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_settings_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = userSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: 'invalid_payload',
          fields: Object.keys(parsed.error.flatten().fieldErrors),
        },
        400,
      );
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const serviceCatalogPatch = parsed.data.service_catalog;
    const serviceCatalogEnabled = getEnv().SERVICE_CATALOG_ENABLED;
    if (serviceCatalogPatch && !serviceCatalogEnabled) {
      return c.json({ ok: false, error: 'service_catalog_disabled' }, 503);
    }
    const { basicPatch, dynamicPatch, disallowedFields } = splitUserSettingsPatchByPlan(shop, parsed.data);
    if (disallowedFields.length > 0) {
      return c.json(
        {
          ok: false,
          error: 'plan_feature_locked',
          fields: disallowedFields,
          requirements: Object.fromEntries(
            disallowedFields.map((field) => [
              field,
              {
                capability: USER_SETTING_FIELD_CAPABILITIES[field],
                label: CAPABILITY_LABELS[USER_SETTING_FIELD_CAPABILITIES[field]],
                minPlan: CAPABILITY_MIN_PLAN[USER_SETTING_FIELD_CAPABILITIES[field]],
              },
            ]),
          ),
        },
        403,
      );
    }

    const hasBasicPatch = Object.keys(basicPatch).some((key) => key !== 'service_catalog');
    const hasDynamicPatch = Object.keys(dynamicPatch).length > 0;
    if (!hasBasicPatch && !hasDynamicPatch && !serviceCatalogPatch) {
      return c.json({ ok: false, error: 'no_changes' }, 400);
    }

    let updated = shop;
    try {
      if (hasBasicPatch) {
        const basicUpdated = await deps.shopsRepository.updateUserSettings(sessionResult.shopId ?? '', basicPatch);
        if (!basicUpdated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
        updated = basicUpdated;
      }
      if (hasDynamicPatch) {
        const dynamicUpdated = await deps.shopsRepository.updateDynamicConfig(sessionResult.shopId ?? '', dynamicPatch);
        if (!dynamicUpdated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
        updated = dynamicUpdated;
      }
      if (serviceCatalogPatch) {
        const savedCatalog = await deps.shopsRepository.saveServiceCatalog(
          shop.id,
          normalizeServiceCatalogForShop(shop.id, serviceCatalogPatch),
        );
        if (!savedCatalog) return c.json({ ok: false, error: 'shop_not_found' }, 404);
        const reloaded = await deps.shopsRepository.findById(shop.id);
        if (!reloaded) return c.json({ ok: false, error: 'shop_not_found' }, 404);
        updated = reloaded;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const duplicateConflict = userSettingsDuplicateConflict(message);
      if (duplicateConflict) {
        return c.json(
          {
            ok: false,
            error: duplicateConflict.error,
            fields: duplicateConflict.fields,
          },
          409,
        );
      }
      logger.error({ err: error, shopId: sessionResult.shopId ?? null }, 'user_settings_update_failed');
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const showGoLiveSettingsTab = await computeShowGoLiveSettingsTab({
      shop: updated,
      shopsRepository: deps.shopsRepository,
      shopAccessStatesRepository: deps.shopAccessStatesRepository,
      billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
      testCallAttemptsRepository: deps.testCallAttemptsRepository,
    });

    return c.json({
      ok: true,
      shop: serviceCatalogEnabled ? toUserFacingShop(updated) : { ...toUserFacingShop(updated), service_catalog: null },
      capabilities: getShopPlanCapabilities(updated.plan),
      showGoLiveSettingsTab,
      serviceCatalogEnabled,
    });
  });

  app.put(path('/user/password'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_password_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.authUsersRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = userPasswordChangeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }

    if (parsed.data.newPassword === parsed.data.currentPassword) {
      return c.json({ ok: false, error: 'password_unchanged' }, 400);
    }

    const email = sessionResult.email.toLowerCase();
    const authUser = await deps.authUsersRepository.findByEmail(email);
    if (!authUser || authUser.role !== 'user' || !authUser.active) {
      return c.json({ ok: false, error: 'user_not_found' }, 404);
    }

    if (!verifyPassword(parsed.data.currentPassword, authUser.passwordHash)) {
      securityAudit({
        action: 'user_password_change_denied',
        actorType: 'user',
        actorId: email,
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
        details: { reason: 'invalid_current_password' },
      });
      return c.json({ ok: false, error: 'invalid_current_password' }, 400);
    }

    await deps.authUsersRepository.updatePasswordHash(authUser.id, hashPassword(parsed.data.newPassword));

    securityAudit({
      action: 'user_password_changed',
      actorType: 'user',
      actorId: email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
    });

    return c.json({ ok: true });
  });

  app.get(path('/admin/system-health/metrics'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_system_health_metrics');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.jobsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }

    const snapshot = getMetricsSnapshot();
    const jobStatus = await deps.jobsRepository.getStatusCounts();
    const responseLatency = durationMetricAggregate(snapshot, 'realtime_response_latency_ms');
    const queueLatency = durationMetricAggregate(snapshot, 'realtime_audio_queue_latency_ms');
    const jitter = durationMetricAggregate(snapshot, 'realtime_audio_jitter_ms');
    const toolcallDuration = durationMetricAggregate(snapshot, 'toolcall_duration_ms');

    return c.json({
      ok: true,
      generatedAt: snapshot.generatedAt,
      realtime: {
        responseLatencyMs: responseLatency,
        queueLatencyMs: queueLatency,
        jitterMs: jitter,
      },
      toolcalls: {
        total: counterMetricTotal(snapshot, 'toolcall_total'),
        queueFailed: counterMetricTotal(snapshot, 'toolcall_queue_failed_total'),
        durationMs: toolcallDuration,
      },
      webhooks: {
        total: counterMetricTotal(snapshot, 'webhook_requests_total'),
        processed: counterMetricTotal(snapshot, 'webhook_requests_total', { outcome: 'processed' }),
        duplicate: counterMetricTotal(snapshot, 'webhook_requests_total', { outcome: 'duplicate' }),
        invalidSignature: counterMetricTotal(snapshot, 'webhook_signature_invalid_total'),
        failed: counterMetricTotal(snapshot, 'webhook_requests_total', { outcome: 'failed' }),
      },
      jobs: {
        queued: jobStatus.queued ?? 0,
        running: jobStatus.running ?? 0,
        leased: jobStatus.leased ?? 0,
        completed: counterMetricTotal(snapshot, 'jobs_completed_total'),
        failed: counterMetricTotal(snapshot, 'jobs_failed_total'),
        deadLetter: counterMetricTotal(snapshot, 'jobs_dead_letter_total'),
      },
      apiStatus: {
        status401: counterMetricTotal(snapshot, 'api_requests_total', { status: '401' }),
        status403: counterMetricTotal(snapshot, 'api_requests_total', { status: '403' }),
        status429: counterMetricTotal(snapshot, 'api_requests_total', { status: '429' }),
        status5xx:
          counterMetricTotal(snapshot, 'api_requests_total', { status: '500' }) +
          counterMetricTotal(snapshot, 'api_requests_total', { status: '502' }) +
          counterMetricTotal(snapshot, 'api_requests_total', { status: '503' }) +
          counterMetricTotal(snapshot, 'api_requests_total', { status: '504' }),
      },
    });
  });

  app.get(path('/admin/dashboard'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_dashboard');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.callLogsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }

    const [shops, calls] = await Promise.all([
      deps.shopsRepository.list({ limit: 300 }),
      deps.callLogsRepository.listRecent({ limit: 200 }),
    ]);

    let trialEndingSoon: AdminTrialEndingSoonItem[] = [];
    if (deps.billingSubscriptionsRepository) {
      const shopIds = shops.map((shop) => shop.id);
      const subsByShop = await deps.billingSubscriptionsRepository.findCurrentByShopIds(shopIds);
      trialEndingSoon = buildAdminTrialEndingSoonWatchlist(shops, subsByShop, new Date());
    }

    return c.json({
      ok: true,
      metrics: {
        shopCount: shops.length,
        activeShops: shops.filter((shop) => shop.active).length,
        callCount: calls.length,
        missedCalls: calls.filter((item) => item.outcome === 'missed').length,
      },
      trialEndingSoon,
    });
  });

  app.get(path('/admin/dashboard/charts/:metric'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_chart_query, 'admin_dashboard_chart_metric');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;

    const metricParsed = adminDashboardChartMetricSchema.safeParse(c.req.param('metric'));
    if (!metricParsed.success) {
      return c.json({ ok: false, error: 'invalid_metric' }, 400);
    }
    const metric = metricParsed.data;

    const periodParsed = adminDashboardChartPeriodSchema.safeParse(c.req.query('period') ?? 'week');
    const period: DashboardChartPeriod = periodParsed.success ? periodParsed.data : 'week';
    const now = new Date();
    const spec = getChartRangeSpec(period, now);
    const pageSize = 2500;

    let timestamps: string[] = [];
    let repositoryAvailable = true;

    if (metric === 'calls') {
      if (!deps.callLogsRepository) {
        return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
      }
      let offset = 0;
      for (;;) {
        const batch = await deps.callLogsRepository.listRecent({
          startedAfter: spec.from,
          startedBefore: spec.to,
          limit: pageSize,
          offset,
        });
        for (const row of batch) {
          if (row.startedAt) timestamps.push(row.startedAt);
        }
        if (batch.length < pageSize) break;
        offset += pageSize;
        if (offset > 250_000) break;
      }
    } else if (metric === 'demo-calls') {
      if (!deps.demoSessionsRepository) {
        repositoryAvailable = false;
      } else {
        let offset = 0;
        for (;;) {
          const batch = await deps.demoSessionsRepository.listAdminDemoCallRuns({
            createdAfter: spec.from,
            createdBefore: spec.to,
            limit: pageSize,
            offset,
          });
          for (const row of batch) {
            timestamps.push(row.runCreatedAt);
          }
          if (batch.length < pageSize) break;
          offset += pageSize;
        }
      }
    } else if (metric === 'leads') {
      if (!deps.contactRequestsRepository) {
        repositoryAvailable = false;
      } else {
        const rows = await deps.contactRequestsRepository.listForAdmin({
          createdAfter: spec.from,
          createdBefore: spec.to,
          status: 'all',
          limit: 10_000,
        });
        timestamps = rows.map((r) => r.createdAt).filter((x): x is string => Boolean(x));
      }
    } else if (metric === 'shops') {
      if (!deps.shopsRepository) {
        return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
      }
      timestamps = await deps.shopsRepository.listCreatedAtInRange({
        createdAfter: spec.from,
        createdBefore: spec.to,
      });
    } else if (metric === 'web-demos') {
      if (!deps.webDemoSessionsRepository) {
        repositoryAvailable = false;
      } else {
        let offset = 0;
        for (;;) {
          const batch = await deps.webDemoSessionsRepository.listForAdmin({
            startedAfter: spec.from,
            startedBefore: spec.to,
            limit: pageSize,
            offset,
          });
          for (const row of batch) {
            if (row.status !== 'rate_limited') timestamps.push(row.startedAt);
          }
          if (batch.length < pageSize) break;
          offset += pageSize;
          if (offset > 250_000) break;
        }
      }
    }

    const values = aggregateIntoBuckets(spec.labels, timestamps, spec.bucketOf);

    return c.json({
      ok: true,
      metric,
      period,
      from: spec.from.toISOString(),
      to: spec.to.toISOString(),
      labels: spec.labels,
      labelTitles: spec.labelTitles,
      values,
      repositoryAvailable,
    });
  });

  app.get(path('/admin/dashboard/demo-health'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_demo_health');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;

    if (!deps.webDemoSessionsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }

    const now = new Date();
    const todayFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const weekFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [todayRows, weekRows] = await Promise.all([
      deps.webDemoSessionsRepository.listForAdmin({ startedAfter: todayFrom, startedBefore: now, limit: 5000, offset: 0 }),
      deps.webDemoSessionsRepository.listForAdmin({ startedAfter: weekFrom, startedBefore: now, limit: 10000, offset: 0 }),
    ]);

    function countByStatus(rows: WebDemoSessionAdminRecord[]) {
      const counts = { started: 0, connected: 0, completed: 0, failed: 0, timed_out: 0, rate_limited: 0 };
      for (const row of rows) {
        const key = row.status as keyof typeof counts;
        if (key in counts) counts[key]++;
      }
      return counts;
    }

    const todayCounts = countByStatus(todayRows);
    const weekCounts = countByStatus(weekRows);

    const weekNonRateLimited = weekCounts.started + weekCounts.connected + weekCounts.completed + weekCounts.failed + weekCounts.timed_out;
    const weekCompletionRatePct = weekNonRateLimited > 0
      ? Math.round((weekCounts.completed / weekNonRateLimited) * 100)
      : null;

    const durationsWeek = weekRows.filter((r) => r.durationSeconds !== null).map((r) => r.durationSeconds as number);
    const weekAvgDurationSecs = durationsWeek.length > 0
      ? Math.round(durationsWeek.reduce((a, b) => a + b, 0) / durationsWeek.length)
      : null;

    const verticalCounts = new Map<string, number>();
    for (const row of weekRows) {
      if (row.status === 'rate_limited') continue;
      const slug = row.verticalSlug ?? 'unknown';
      verticalCounts.set(slug, (verticalCounts.get(slug) ?? 0) + 1);
    }
    const byVertical = [...verticalCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([slug, count]) => ({ slug, count }));

    return c.json({
      ok: true,
      today: {
        started: todayCounts.started + todayCounts.connected,
        completed: todayCounts.completed,
        failed: todayCounts.failed,
        timedOut: todayCounts.timed_out,
        rateLimited: todayCounts.rate_limited,
      },
      week: {
        total: weekNonRateLimited,
        completed: weekCounts.completed,
        failed: weekCounts.failed,
        timedOut: weekCounts.timed_out,
        rateLimited: weekCounts.rate_limited,
        completionRatePct: weekCompletionRatePct,
        avgDurationSecs: weekAvgDurationSecs,
        byVertical,
      },
    });
  });

  app.get(path('/admin/shops'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_shops');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shops = await deps.shopsRepository.list({ limit: 300 });
    const shopIds = shops.map((shop) => shop.id);
    const sinceTestCalls = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [subsByShop, accessByShop, testCountsByShop] = await Promise.all([
      deps.billingSubscriptionsRepository
        ? deps.billingSubscriptionsRepository.findCurrentByShopIds(shopIds)
        : Promise.resolve(new Map<string, BillingSubscription | null>()),
      deps.shopAccessStatesRepository
        ? deps.shopAccessStatesRepository.findByShopIds(shopIds)
        : Promise.resolve(new Map<string, ShopAccessState | null>()),
      deps.testCallAttemptsRepository
        ? deps.testCallAttemptsRepository.countRecentByShopIds({
            shopIds,
            since: sinceTestCalls,
            type: 'outbound_call_me',
          })
        : Promise.resolve(new Map<string, number>()),
    ]);

    const calls = deps.callLogsRepository ? await deps.callLogsRepository.listRecent({ limit: 500 }) : [];
    const callsByShop = new Map<
      string,
      {
        totalCalls: number;
        latestCallAt?: string;
        latestOutcome?: string;
      }
    >();
    for (const call of calls) {
      const current = callsByShop.get(call.shopId) ?? { totalCalls: 0 };
      current.totalCalls += 1;
      if (!current.latestCallAt || (call.startedAt && call.startedAt > current.latestCallAt)) {
        current.latestCallAt = call.startedAt;
        current.latestOutcome = call.outcome;
      }
      callsByShop.set(call.shopId, current);
    }
    return c.json({
      ok: true,
      shops: shops.map((shop) => ({
        ...shop,
        totalCalls: callsByShop.get(shop.id)?.totalCalls ?? 0,
        latestCallAt: callsByShop.get(shop.id)?.latestCallAt,
        latestCallOutcome: callsByShop.get(shop.id)?.latestOutcome,
        adminStatus: buildAdminShopStatus({
          shop,
          subscription: subsByShop.get(shop.id) ?? null,
          accessState: accessByShop.get(shop.id) ?? null,
          testCallsUsed: testCountsByShop.get(shop.id) ?? 0,
        }),
      })),
    });
  });

  app.get(path('/admin/billing'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_billing_get');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.billingSubscriptionsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'billing_dependencies_unavailable' }, 500);
    }

    const [subscriptions, shops] = await Promise.all([
      deps.billingSubscriptionsRepository.list({ limit: 500 }),
      deps.shopsRepository.list({ limit: 500 }),
    ]);
    const shopNameById = new Map(shops.map((shop) => [shop.id, shop.name]));
    const activeStatuses = new Set<BillingSubscriptionStatus>(['active', 'trialing']);
    const monthlyRecurringRevenue = subscriptions
      .filter((subscription) => activeStatuses.has(subscription.status))
      .reduce((sum, subscription) => {
        const normalized = subscription.interval === 'year' ? subscription.amount / 12 : subscription.amount;
        return sum + normalized;
      }, 0);

    return c.json({
      ok: true,
      metrics: {
        subscriptionCount: subscriptions.length,
        activeSubscriptions: subscriptions.filter((subscription) => activeStatuses.has(subscription.status)).length,
        pastDueSubscriptions: subscriptions.filter((subscription) => subscription.status === 'past_due').length,
        mrr: Number(monthlyRecurringRevenue.toFixed(2)),
      },
      subscriptions: subscriptions.map((subscription) => ({
        ...subscription,
        shopName: shopNameById.get(subscription.shopId) ?? 'Unknown shop',
      })),
    });
  });

  app.post(path('/admin/shops'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_create_shop');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = adminCreateShopSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const created = await deps.shopsRepository.create(parsed.data);
    securityAudit({
      action: 'admin_shop_created',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId: created.id,
      },
    });
    return c.json({ ok: true, shop: created }, 201);
  });

  app.get(path('/admin/shops/:id/calls'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_shop_calls');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.callLogsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const shop = await deps.shopsRepository.findById(shopId);
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const qParsed = adminShopCallsQuerySchema.safeParse({
      callsPage: c.req.query('callsPage'),
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
    });
    if (!qParsed.success) return c.json({ ok: false, error: 'invalid_query' }, 400);

    const callsPage = qParsed.data.callsPage ?? 1;
    const callsPageSize = 20;
    const callsOffset = (callsPage - 1) * callsPageSize;

    let range: { startedAfter?: Date; startedBefore?: Date } = {};
    const df = qParsed.data.dateFrom;
    const dt = qParsed.data.dateTo;
    if (df && dt) {
      const startedAfter = new Date(`${df}T00:00:00.000Z`);
      const startedBefore = new Date(`${dt}T23:59:59.999Z`);
      if (startedAfter.getTime() > startedBefore.getTime()) {
        return c.json({ ok: false, error: 'invalid_date_range' }, 400);
      }
      range = { startedAfter, startedBefore };
    } else if (df || dt) {
      return c.json({ ok: false, error: 'invalid_query' }, 400);
    }

    const [recentCalls, callsTotal] = await Promise.all([
      deps.callLogsRepository.listByShop(shopId, {
        limit: callsPageSize,
        offset: callsOffset,
        ...range,
      }),
      deps.callLogsRepository.countByShop(shopId, range),
    ]);

    return c.json({
      ok: true,
      recentCalls,
      callsPagination: { page: callsPage, pageSize: callsPageSize, total: callsTotal },
      filter: { dateFrom: df ?? null, dateTo: dt ?? null },
    });
  });

  app.get(path('/admin/shops/:id/analytics'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_shop_analytics');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const shop = await deps.shopsRepository.findById(shopId);
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const qParsed = adminShopAnalyticsQuerySchema.safeParse({
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
    });
    if (!qParsed.success) return c.json({ ok: false, error: 'invalid_query' }, 400);

    const now = new Date();
    let endDay = qParsed.data.dateTo ?? now.toISOString().slice(0, 10);
    let startDay = qParsed.data.dateFrom ?? null;
    if (!startDay) {
      const from = new Date(now);
      from.setUTCDate(from.getUTCDate() - 30);
      startDay = from.toISOString().slice(0, 10);
    }
    const createdAfter = new Date(`${startDay}T00:00:00.000Z`);
    const createdBefore = new Date(`${endDay}T23:59:59.999Z`);
    if (createdAfter.getTime() > createdBefore.getTime()) {
      return c.json({ ok: false, error: 'invalid_date_range' }, 400);
    }

    const bookings = deps.bookingsRepository
      ? await deps.bookingsRepository.listByShop(shopId, {
          limit: 5000,
          createdAfter,
          createdBefore,
        })
      : [];

    const byStatus: Record<string, number> = {};
    for (const b of bookings) {
      const s = b.status || 'unknown';
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }

    let modifiedCount = 0;
    for (const b of bookings) {
      if (b.updatedAt && b.createdAt && b.updatedAt !== b.createdAt) modifiedCount += 1;
    }

    return c.json({
      ok: true,
      shopId: shop.id,
      shopName: shop.name,
      period: { dateFrom: startDay, dateTo: endDay },
      bookingsInPeriod: bookings.length,
      byStatus,
      bookingsUpdatedAfterCreate: modifiedCount,
      recentBookings: bookings.slice(0, 40),
    });
  });

  app.get(path('/admin/shops/:id'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_shop_detail');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);

    const shop = await deps.shopsRepository.findById(shopId);
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const sinceTestCalls = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const commercialGoLiveApprovalEventsPromise = deps.commercialGoLiveApprovalEventsRepository
      ? deps.commercialGoLiveApprovalEventsRepository.listByShopId(shop.id, 20).catch((error) => {
          console.warn('[admin_shop_detail] commercial approval history unavailable:', error);
          return [];
        })
      : Promise.resolve([]);
    const [subscription, accessState, testCallsUsed, commercialGoLiveApprovalEvents, shopLocations, shopRoutingRules, commercialAccount] = await Promise.all([
      deps.billingSubscriptionsRepository
        ? deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id)
        : Promise.resolve(null),
      deps.shopAccessStatesRepository ? deps.shopAccessStatesRepository.findByShopId(shop.id) : Promise.resolve(null),
      deps.testCallAttemptsRepository
        ? deps.testCallAttemptsRepository.countRecentByShopId({
            shopId: shop.id,
            type: 'outbound_call_me',
            since: sinceTestCalls,
          })
        : Promise.resolve(0),
      commercialGoLiveApprovalEventsPromise,
      deps.shopLocationsRepository ? deps.shopLocationsRepository.listByShopId(shop.id).catch(() => []) : Promise.resolve([]),
      deps.shopRoutingRulesRepository ? deps.shopRoutingRulesRepository.listByShopId(shop.id).catch(() => []) : Promise.resolve([]),
      deps.commercialAccountsRepository ? deps.commercialAccountsRepository.findByShopId(shop.id).catch(() => null) : Promise.resolve(null),
    ]);
    const usage = deps.callLogsRepository
      ? await getShopUsageForPeriod(
          { callLogsRepository: deps.callLogsRepository, shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository },
          { shop, commercialAccount },
        )
      : null;

    return c.json({
      ok: true,
      shop,
      commercialGoLiveApprovalEvents,
      shopLocations,
      shopRoutingRules,
      commercialAccount,
      usage,
      adminStatus: buildAdminShopStatus({
        shop,
        subscription,
        accessState,
        testCallsUsed,
      }),
    });
  });

  app.put(path('/admin/shops/:id/plan'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_plan_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const body = await c.req.json().catch(() => null);
    const parsed = adminUpdatePlanSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    if (parsed.data.plan === undefined && parsed.data.active === undefined) {
      return c.json({ ok: false, error: 'empty_patch' }, 400);
    }

    const updated = await deps.shopsRepository.updatePlanAndActivation(shopId, parsed.data);
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    securityAudit({
      action: 'admin_shop_plan_updated',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId,
        plan: parsed.data.plan ?? null,
        active: parsed.data.active ?? null,
      },
    });
    return c.json({ ok: true, shop: updated });
  });

  app.post(path('/admin/shops/:id/approve-commercial-go-live'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_approve_commercial_go_live');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopAccessStatesRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const body = await c.req.json().catch(() => ({}));
    const parsed = adminCommercialGoLiveApprovalSchema.safeParse(body ?? {});
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const shop = await deps.shopsRepository.findById(shopId);
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const existing = await deps.shopAccessStatesRepository.findByShopId(shop.id);
    if (existing?.commercialGoLiveApprovedAt) {
      return c.json({ ok: true, alreadyApproved: true, accessState: existing });
    }

    const approvedAt = new Date().toISOString();
    const next = await deps.shopAccessStatesRepository.upsert({
      shopId: shop.id,
      commercialGoLiveApprovedAt: approvedAt,
      commercialGoLiveApprovedBy: sessionResult.email,
      commercialGoLiveApprovalNote: parsed.data.note?.trim() || null,
    });
    const approvalEvent = deps.commercialGoLiveApprovalEventsRepository
      ? await deps.commercialGoLiveApprovalEventsRepository
          .create({
            shopId: shop.id,
            eventType: 'approved',
            actorEmail: sessionResult.email,
            note: parsed.data.note?.trim() || null,
            createdAt: approvedAt,
          })
          .catch((error) => {
            console.warn('[admin_shop_approve_commercial_go_live] approval history unavailable:', error);
            return null;
          })
      : null;
    securityAudit({
      action: 'commercial_go_live_approved',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId: shop.id,
      },
    });
    return c.json({ ok: true, alreadyApproved: false, accessState: next, approvalEvent: approvalEvent ?? null });
  });


  app.post(path('/admin/shops/:id/locations'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_location_post');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopLocationsRepository) return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const shop = await deps.shopsRepository.findById(shopId);
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const parsed = adminShopLocationSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const location = await deps.shopLocationsRepository.create({ shopId: shop.id, ...parsed.data });
    return c.json({ ok: true, location });
  });

  app.put(path('/admin/shops/:id/locations/:locationId'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_location_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopLocationsRepository) return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    const locationId = parseAdminResourceUuid(c.req.param('locationId'));
    if (!shopId || !locationId) return c.json({ ok: false, error: 'invalid_id' }, 400);
    const parsed = adminShopLocationSchema.partial().safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const location = await deps.shopLocationsRepository.update(shopId, locationId, parsed.data as Parameters<NonNullable<typeof deps.shopLocationsRepository>['update']>[2]);
    if (!location) return c.json({ ok: false, error: 'location_not_found' }, 404);
    return c.json({ ok: true, location });
  });

  app.post(path('/admin/shops/:id/routing-rules'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_routing_rule_post');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopRoutingRulesRepository) return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const shop = await deps.shopsRepository.findById(shopId);
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const parsed = adminShopRoutingRuleSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const rule = await deps.shopRoutingRulesRepository.create({ shopId: shop.id, ...parsed.data });
    return c.json({ ok: true, rule });
  });

  app.put(path('/admin/shops/:id/routing-rules/:ruleId'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_routing_rule_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopRoutingRulesRepository) return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    const ruleId = parseAdminResourceUuid(c.req.param('ruleId'));
    if (!shopId || !ruleId) return c.json({ ok: false, error: 'invalid_id' }, 400);
    const parsed = adminShopRoutingRuleSchema.partial().safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const rule = await deps.shopRoutingRulesRepository.update(shopId, ruleId, parsed.data);
    if (!rule) return c.json({ ok: false, error: 'routing_rule_not_found' }, 404);
    return c.json({ ok: true, rule });
  });

  app.put(path('/admin/shops/:id/commercial-account'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_commercial_account_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.commercialAccountsRepository) return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const shop = await deps.shopsRepository.findById(shopId);
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const parsed = adminCommercialAccountSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const account = await deps.commercialAccountsRepository.upsert({ shopId: shop.id, ...parsed.data });
    return c.json({ ok: true, commercialAccount: account });
  });

  app.put(path('/admin/shops/:id/settings'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_settings_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const body = await c.req.json().catch(() => null);
    const parsed = adminShopSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const updated = await deps.shopsRepository.updateUserSettings(shopId, parsed.data);
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    securityAudit({
      action: 'admin_shop_settings_updated',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId,
      },
    });
    return c.json({ ok: true, shop: updated });
  });

  app.put(path('/admin/shops/:id/config'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_config_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const body = await c.req.json().catch(() => null);
    const parsed = adminShopDynamicConfigSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const updated = await deps.shopsRepository.updateDynamicConfig(shopId, parsed.data);
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    securityAudit({
      action: 'admin_shop_dynamic_config_updated',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId,
        keys: Object.keys(parsed.data),
      },
    });
    return c.json({ ok: true, shop: updated });
  });

  app.get(path('/admin/calls'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_calls');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    const callLogsRepository = deps.callLogsRepository;
    if (!callLogsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const parsed = adminCallsListQuerySchema.safeParse({
      shopId: c.req.query('shopId'),
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
      page: c.req.query('page'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query' }, 400);
    }
    const shopId = parsed.data.shopId;
    const dateFrom = parsed.data.dateFrom;
    const dateTo = parsed.data.dateTo;
    const page = parsed.data.page ?? 1;
    const pageSize = ADMIN_CALL_LIST_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    let rangeParams: { startedAfter?: Date; startedBefore?: Date } = {};
    if (dateFrom && dateTo) {
      const startedAfter = new Date(`${dateFrom}T00:00:00.000Z`);
      const startedBefore = new Date(`${dateTo}T23:59:59.999Z`);
      if (startedAfter.getTime() > startedBefore.getTime()) {
        return c.json({ ok: false, error: 'invalid_date_range' }, 400);
      }
      rangeParams = { startedAfter, startedBefore };
    } else if (dateFrom || dateTo) {
      return c.json({ ok: false, error: 'invalid_query' }, 400);
    }

    const countArgs = rangeParams;
    const listPageArgs = { limit: pageSize, offset, ...rangeParams };
    const chartSampleArgs = { limit: ADMIN_CALL_CHART_SAMPLE, offset: 0, ...rangeParams };

    const countFn = (extra?: { outcome?: string; transcriptStatus?: string }) =>
      shopId
        ? callLogsRepository.countByShop(shopId, { ...countArgs, ...extra })
        : callLogsRepository.countRecent({ ...countArgs, ...extra });

    const [
      total,
      booked,
      missed,
      readyTranscript,
      calls,
      chartSource,
      shops,
    ] = await Promise.all([
      countFn(),
      countFn({ outcome: 'booked' }),
      countFn({ outcome: 'missed' }),
      countFn({ transcriptStatus: 'completed' }),
      shopId ? callLogsRepository.listByShop(shopId, listPageArgs) : callLogsRepository.listRecent(listPageArgs),
      shopId ? callLogsRepository.listByShop(shopId, chartSampleArgs) : callLogsRepository.listRecent(chartSampleArgs),
      deps.shopsRepository ? deps.shopsRepository.list({ limit: 500 }) : Promise.resolve([]),
    ]);

    const shopNameById = new Map(shops.map((s) => [s.id, s.name]));
    const chartDaily = buildAdminCallChartDaily(chartSource);
    const chartTruncated = total > ADMIN_CALL_CHART_SAMPLE;

    return c.json({
      ok: true,
      calls: calls.map((call) => ({
        ...call,
        shopName: shopNameById.get(call.shopId) ?? call.shopId,
      })),
      summary: {
        total,
        booked,
        missed,
        readyTranscript,
        chartSampleSize: chartSource.length,
        chartTruncated,
      },
      chartDaily,
      pagination: { page, pageSize, total },
      filter: {
        shopId: shopId || null,
        shopName: shopId ? (shopNameById.get(shopId) ?? null) : null,
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
      },
    });
  });

  app.get(path('/admin/demo-calls'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_demo_calls');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.demoSessionsRepository || !deps.callLogsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const parsed = adminDemoCallsListQuerySchema.safeParse({
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
      page: c.req.query('page'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query' }, 400);
    }
    const result = await buildAdminDemoCallsListResult(
      { demoSessionsRepository: deps.demoSessionsRepository, callLogsRepository: deps.callLogsRepository },
      parsed.data,
    );
    if (!result.ok) return c.json({ ok: false, error: result.error }, result.status);
    return c.json(result.json);
  });

  app.get(path('/admin/demos/phone'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_demos_phone');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.demoSessionsRepository || !deps.callLogsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const parsed = adminDemoCallsListQuerySchema.safeParse({
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
      page: c.req.query('page'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query' }, 400);
    }
    const result = await buildAdminDemoCallsListResult(
      { demoSessionsRepository: deps.demoSessionsRepository, callLogsRepository: deps.callLogsRepository },
      parsed.data,
      { providerNotEquals: 'marketing_demo_web' },
    );
    if (!result.ok) return c.json({ ok: false, error: result.error }, result.status);
    return c.json(result.json);
  });

  app.get(path('/admin/demos/web'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_demos_web');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.demoSessionsRepository || !deps.webDemoSessionsRepository || !deps.callLogsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const parsed = adminWebDemosListQuerySchema.safeParse({
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
      page: c.req.query('page'),
      vertical: c.req.query('vertical'),
      status: c.req.query('status'),
      country: c.req.query('country'),
      search: c.req.query('search'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query' }, 400);
    }

    const env = getEnv();
    const now = new Date();
    const endDay = parsed.data.dateTo ?? now.toISOString().slice(0, 10);
    let startDay = parsed.data.dateFrom ?? null;
    if (!startDay) {
      const from = new Date(now);
      from.setUTCDate(from.getUTCDate() - 30);
      startDay = from.toISOString().slice(0, 10);
    }
    const createdAfter = new Date(`${startDay}T00:00:00.000Z`);
    const createdBefore = new Date(`${endDay}T23:59:59.999Z`);
    if (createdAfter.getTime() > createdBefore.getTime()) {
      return c.json({ ok: false, error: 'invalid_date_range' }, 400);
    }

    const page = parsed.data.page ?? 1;
    const pageSize = ADMIN_DEMO_LIST_PAGE_SIZE;

    const verticalFilter = parsed.data.vertical?.trim() || undefined;
    const statusFilter = parsed.data.status;
    const countryFilter = parsed.data.country?.trim() || undefined;
    const searchFilter = parsed.data.search?.trim() || undefined;

    const [livekitRows, directRows] = await Promise.all([
      deps.demoSessionsRepository.listAdminDemoCallRuns({
        createdAfter,
        createdBefore,
        providerEquals: 'marketing_demo_web',
        limit: ADMIN_WEB_DEMO_MERGE_CAP,
        offset: 0,
      }),
      deps.webDemoSessionsRepository.listForAdmin({
        startedAfter: createdAfter,
        startedBefore: createdBefore,
        verticalSlug: verticalFilter,
        status: statusFilter,
        country: countryFilter,
        search: searchFilter,
        limit: ADMIN_WEB_DEMO_MERGE_CAP,
        offset: 0,
      }),
    ]);

    const truncatedMerge =
      livekitRows.length >= ADMIN_WEB_DEMO_MERGE_CAP || directRows.length >= ADMIN_WEB_DEMO_MERGE_CAP;

    const transcriptMeta = await deps.callLogsRepository.listTranscriptMetaByShopAndRequestIds({
      shopId: env.PUBLIC_DEMO_SHOP_ID,
      requestIds: livekitRows.map((r) => r.requestId),
    });

    type UnifiedWebDemoRow = {
      sortAt: string;
      kind: 'livekit_web' | 'direct_realtime';
      livekitRequestId: string | null;
      webDemoRowId: string | null;
      publicSessionId: string;
      ip: string | null;
      country: string | null;
      durationSeconds: number | null;
      businessName: string | null;
      verticalSlug: string;
      adminStatus: WebDemoSessionStatus;
      browser: string | null;
      deviceType: string | null;
      userAgent: string | null;
      transcriptAvailable: boolean;
    };

    const unified: UnifiedWebDemoRow[] = [];

    for (const row of livekitRows) {
      const adminStatus = liveKitDemoRunToWebAdminStatus(row.runStatus, row.sessionStatus);
      const enriched = {
        verticalSlug: row.verticalSlug,
        adminStatus,
        country: effectiveDemoClientCountry(row.clientCountry, row.callbackPhone),
        businessName: row.businessName,
        publicSessionId: row.publicSessionId,
        livekitRequestId: row.requestId,
      };
      if (
        !unifiedWebDemoRowMatchesFilters(enriched, {
          vertical: verticalFilter,
          status: statusFilter,
          country: countryFilter,
          search: searchFilter,
        })
      ) {
        continue;
      }
      const meta = transcriptMeta.get(row.requestId);
      unified.push({
        sortAt: row.runCreatedAt,
        kind: 'livekit_web',
        livekitRequestId: row.requestId,
        webDemoRowId: null,
        publicSessionId: row.publicSessionId,
        ip: row.clientIp,
        country: enriched.country,
        durationSeconds: demoCallDurationSeconds(row),
        businessName: row.businessName,
        verticalSlug: row.verticalSlug,
        adminStatus,
        browser: null,
        deviceType: null,
        userAgent: null,
        transcriptAvailable: meta?.hasTranscriptText ?? false,
      });
    }

    for (const row of directRows) {
      const transcriptAvailable = row.transcript != null && formatWebDemoTranscriptForAdmin(row.transcript) != null;
      unified.push({
        sortAt: row.startedAt,
        kind: 'direct_realtime',
        livekitRequestId: row.requestId,
        webDemoRowId: row.id,
        publicSessionId: row.publicSessionId,
        ip: row.ipAddress,
        country: row.country,
        durationSeconds: row.durationSeconds,
        businessName: row.businessName,
        verticalSlug: row.verticalSlug ?? '—',
        adminStatus: row.status,
        browser: row.browser,
        deviceType: row.deviceType,
        userAgent: row.userAgent,
        transcriptAvailable,
      });
    }

    unified.sort((a, b) => b.sortAt.localeCompare(a.sortAt));
    const total = unified.length;
    const offset = (page - 1) * pageSize;
    const pageRows = unified.slice(offset, offset + pageSize);

    return c.json({
      ok: true,
      sessions: pageRows.map((r) => ({
        kind: r.kind,
        startedAt: r.sortAt,
        sessionId: r.publicSessionId,
        requestId: r.livekitRequestId,
        webDemoRowId: r.webDemoRowId,
        ip: r.ip,
        country: r.country,
        durationSeconds: r.durationSeconds,
        businessName: r.businessName,
        verticalSlug: r.verticalSlug,
        status: r.adminStatus,
        browser: r.browser,
        deviceType: r.deviceType,
        userAgent: r.userAgent,
        transcriptAvailable: r.transcriptAvailable,
      })),
      pagination: { page, pageSize, total },
      filter: {
        dateFrom: startDay,
        dateTo: endDay,
        vertical: verticalFilter ?? null,
        status: statusFilter ?? null,
        country: countryFilter ?? null,
        search: searchFilter ?? null,
      },
      truncatedMerge,
    });
  });

  app.get(path('/admin/demos/web/:id'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_demos_web_detail');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.webDemoSessionsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const id = parseAdminUuidParam(c.req.param('id'));
    if (!id) return c.json({ ok: false, error: 'invalid_id' }, 400);
    const row = await deps.webDemoSessionsRepository.findById(id);
    if (!row) return c.json({ ok: false, error: 'not_found' }, 404);
    return c.json({
      ok: true,
      session: {
        id: row.id,
        sessionId: row.publicSessionId,
        requestId: row.requestId,
        verticalSlug: row.verticalSlug,
        businessName: row.businessName,
        demoSource: row.demoSource,
        status: row.status,
        ip: row.ipAddress,
        country: row.country,
        browser: row.browser,
        deviceType: row.deviceType,
        userAgent: row.userAgent,
        startedAt: row.startedAt,
        connectedAt: row.connectedAt,
        endedAt: row.endedAt,
        durationSeconds: row.durationSeconds,
        summary: row.summary,
        errorCode: row.errorCode,
        errorMessage: row.errorMessage,
        hasTranscript: row.transcript != null && formatWebDemoTranscriptForAdmin(row.transcript) != null,
      },
    });
  });

  app.get(path('/admin/demos/web/:id/transcript'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_demo_transcript_read, 'admin_demos_web_transcript');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.webDemoSessionsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const id = parseAdminUuidParam(c.req.param('id'));
    if (!id) return c.json({ ok: false, error: 'invalid_id' }, 400);
    const row = await deps.webDemoSessionsRepository.findById(id);
    if (!row) return c.json({ ok: false, error: 'not_found' }, 404);
    securityAudit({
      action: 'admin_web_demo_transcript_viewed',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: { webDemoSessionId: id },
    });
    const transcriptText = formatWebDemoTranscriptForAdmin(row.transcript);
    return c.json({
      ok: true,
      sessionId: row.publicSessionId,
      requestId: row.requestId,
      status: row.status,
      transcriptText,
    });
  });

  app.get(path('/admin/demo-calls/:requestId/transcript'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_demo_transcript_read, 'admin_demo_calls_transcript');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.callLogsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const requestId = c.req.param('requestId')?.trim() ?? '';
    if (!requestId.startsWith('demo-') || requestId.length > 120) {
      return c.json({ ok: false, error: 'invalid_request_id' }, 400);
    }
    const env = getEnv();
    const row = await deps.callLogsRepository.findTranscriptByShopAndRequestId({
      shopId: env.PUBLIC_DEMO_SHOP_ID,
      requestId,
    });
    if (!row) {
      return c.json({ ok: false, error: 'transcript_not_found' }, 404);
    }
    securityAudit({
      action: 'admin_demo_transcript_viewed',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: { requestId },
    });
    return c.json({
      ok: true,
      requestId,
      transcriptStatus: row.transcriptStatus ?? null,
      transcriptText: row.transcriptText ?? null,
      startedAt: row.startedAt ?? null,
      endedAt: row.endedAt ?? null,
    });
  });

  app.get(path('/admin/leads'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_leads');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.contactRequestsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const parsed = adminLeadsListQuerySchema.safeParse({
      limit: c.req.query('limit'),
      status: c.req.query('status'),
      intent: c.req.query('intent'),
      query: c.req.query('query'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query' }, 400);
    }

    const leads = await deps.contactRequestsRepository.listForAdmin({
      limit: parsed.data.limit,
      status: parsed.data.status,
      intent: parsed.data.intent,
      query: parsed.data.query,
    });

    const byStatus = new Map<ContactRequestStatus, number>();
    for (const lead of leads) {
      byStatus.set(lead.status, (byStatus.get(lead.status) ?? 0) + 1);
    }

    return c.json({
      ok: true,
      leads,
      filters: {
        status: parsed.data.status ?? 'all',
        intent: parsed.data.intent ?? 'all',
        query: parsed.data.query ?? '',
      },
      metrics: {
        total: leads.length,
        new: byStatus.get('new') ?? 0,
        contacted: byStatus.get('contacted') ?? 0,
        qualified: byStatus.get('qualified') ?? 0,
        closed: byStatus.get('closed') ?? 0,
        spam: byStatus.get('spam') ?? 0,
      },
    });
  });

  app.put(path('/admin/leads/:id/status'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_lead_status_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.contactRequestsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const leadId = parseAdminResourceUuid(c.req.param('id'));
    if (!leadId) return c.json({ ok: false, error: 'invalid_lead_id' }, 400);

    const body = await c.req.json().catch(() => null);
    const parsed = adminLeadStatusUpdateSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const updated = await deps.contactRequestsRepository.updateStatus(leadId, {
      status: parsed.data.status,
      notes: parsed.data.notes,
      handledBy: sessionResult.email,
    });
    if (!updated) return c.json({ ok: false, error: 'lead_not_found' }, 404);

    securityAudit({
      action: 'admin_contact_request_status_updated',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        leadId,
        status: parsed.data.status,
      },
    });

    return c.json({ ok: true, lead: updated });
  });

  app.get(path('/admin/users'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_users_list');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.authUsersRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const users = await deps.authUsersRepository.listForAdmin({ limit: 500 });
    const shops = deps.shopsRepository ? await deps.shopsRepository.list({ limit: 1000 }).catch(() => []) : [];
    const shopsById = new Map(shops.map((shop) => [shop.id, shop]));
    const usersWithShop = users.map((user) => {
      const shop = user.shopId ? shopsById.get(user.shopId) : null;
      return {
        ...user,
        shopName: shop?.name ?? null,
        shopBrandSlug: shop?.brand_slug ?? null,
      };
    });
    const activeAdmins = usersWithShop.filter((u) => u.role === 'admin' && u.active);
    const mfaEnabled = usersWithShop.filter((u) => u.mfaEnabled).length;
    const stats = {
      total: usersWithShop.length,
      adminTotal: usersWithShop.filter((u) => u.role === 'admin').length,
      activeAdminCount: activeAdmins.length,
      mfaEnabledCount: mfaEnabled,
      mfaPercent: usersWithShop.length ? Math.round((mfaEnabled / usersWithShop.length) * 100) : 0,
    };
    return c.json({ ok: true, users: usersWithShop, stats });
  });

  app.patch(path('/admin/users/:id'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_user_patch');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.authUsersRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const userId = parseAdminResourceUuid(c.req.param('id'));
    if (!userId) return c.json({ ok: false, error: 'invalid_user_id' }, 400);
    const body = await c.req.json().catch(() => null);
    const parsed = adminUserPatchSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const existing = await deps.authUsersRepository.findById(userId);
    if (!existing) return c.json({ ok: false, error: 'user_not_found' }, 404);

    const isAdminSeat = existing.role === 'admin' && existing.active;
    const willLoseAdminSeat =
      (parsed.data.role === 'user' && existing.role === 'admin') ||
      (parsed.data.active === false && existing.role === 'admin');

    if (isAdminSeat && willLoseAdminSeat) {
      const directory = await deps.authUsersRepository.listForAdmin({ limit: 500 });
      const otherActiveAdmins = directory.filter(
        (u) => u.id !== userId && u.role === 'admin' && u.active,
      );
      if (otherActiveAdmins.length === 0) {
        return c.json({ ok: false, error: 'last_active_admin' }, 400);
      }
    }

    const updated = await deps.authUsersRepository.updateUserAdmin(userId, {
      role: parsed.data.role,
      active: parsed.data.active,
    });
    if (!updated) return c.json({ ok: false, error: 'user_not_found' }, 404);

    securityAudit({
      action: 'admin_user_updated',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        targetUserId: userId,
        patch: parsed.data,
      },
    });

    return c.json({ ok: true, user: updated });
  });

  app.post(path('/admin/users/:id/password'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_user_password');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    const actorLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.admin_user_password_set_by_actor,
      `pw:${sessionResult.email.toLowerCase()}`,
    );
    if (actorLimited) return actorLimited;
    if (!deps.authUsersRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const userId = parseAdminResourceUuid(c.req.param('id'));
    if (!userId) return c.json({ ok: false, error: 'invalid_user_id' }, 400);
    const body = await c.req.json().catch(() => null);
    const parsed = adminUserSetPasswordSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const existing = await deps.authUsersRepository.findById(userId);
    if (!existing) return c.json({ ok: false, error: 'user_not_found' }, 404);

    await deps.authUsersRepository.updatePasswordHash(userId, hashPassword(parsed.data.newPassword));

    securityAudit({
      action: 'admin_user_password_set',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        targetUserId: userId,
        targetEmail: existing.email,
      },
    });

    return c.json({ ok: true });
  });

  app.post(path('/admin/users/invite'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_invite');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    const actorLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.admin_user_invite_by_actor,
      `invite:${sessionResult.email.toLowerCase()}`,
    );
    if (actorLimited) return actorLimited;
    if (!deps.authUsersRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const body = await c.req.json().catch(() => null);
    const parsed = adminInviteSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const email = parsed.data.email.toLowerCase();
    const existing = await deps.authUsersRepository.findByEmail(email);
    if (existing) {
      return c.json({ ok: false, error: 'email_already_exists' }, 409);
    }

    const bootstrapPassword = randomBytes(24).toString('hex');
    const created = await deps.authUsersRepository.create({
      email,
      role: 'admin',
      shopId: parsed.data.shopId ?? null,
      passwordHash: hashPassword(bootstrapPassword),
      active: true,
      mfaEnabled: false,
    });

    const resetToken = `${randomUUID()}${randomBytes(12).toString('hex')}`;
    await deps.authUsersRepository.createPasswordResetToken({
      userId: created.id,
      tokenHash: hashPasswordResetToken(resetToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
    });
    securityAudit({
      action: 'admin_user_invited',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        invitedEmail: email,
        invitedUserId: created.id,
      },
    });

    return c.json({
      ok: true,
      invited: true,
      email,
      role: created.role,
      ...(process.env.NODE_ENV !== 'production' ? { resetToken } : {}),
    });
  });

  app.post(path('/jobs/enqueue'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.jobs_enqueue, 'jobs_enqueue');
    if (limited) return limited;
    if (!ensureInternalAccess(c.req.header('x-backend-key') ?? null)) {
      securityAudit({
        action: 'authz_denied',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
        details: { reason: 'internal_key_required' },
      });
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }
    if (!deps.jobsRepository) {
      return c.json({ ok: false, error: 'jobs_repository_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = enqueueJobSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }

    const job = parsed.data;
    const runAt = job.runAtIso ? new Date(job.runAtIso) : new Date();
    const idempotencyKey = job.idempotencyKey ?? `manual:${job.type}:${job.shopId}:${randomUUID()}`;

    await deps.jobsRepository.enqueue({
      shopId: job.shopId,
      type: job.type as JobType,
      payload: job.payload,
      runAt,
      idempotencyKey,
    });

    return c.json({
      ok: true,
      queued: true,
      idempotencyKey,
      runAtIso: runAt.toISOString(),
    });
  });

  app.post(path('/agent/simulate-inbound'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.agent_simulate_inbound, 'agent_simulate_inbound');
    if (limited) return limited;
    if (!ensureInternalAccess(c.req.header('x-backend-key') ?? null)) {
      securityAudit({
        action: 'authz_denied',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
        details: { reason: 'internal_key_required' },
      });
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }
    if (
      !deps.jobsRepository ||
      !deps.bookingsRepository ||
      !deps.callbacksRepository ||
      !deps.shopsRepository ||
      !deps.telephonyService
    ) {
      return c.json({ ok: false, error: 'agent_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = simulateInboundSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }
    const phoneScopedLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.agent_simulate_inbound_phone,
      `agent_simulate_inbound:${parsed.data.destinationPhone}:${parsed.data.callerPhone}`,
    );
    if (phoneScopedLimited) return phoneScopedLimited;

    const session = await createInboundAgentSession(
      {
        shopsRepository: deps.shopsRepository,
        jobsRepository: deps.jobsRepository,
        bookingsRepository: deps.bookingsRepository,
        callbacksRepository: deps.callbacksRepository,
        telephonyService: deps.telephonyService,
        shopRoutingRulesRepository: deps.shopRoutingRulesRepository,
        realtimeAgentRuntime: deps.realtimeAgentRuntime ?? {
          startInboundSession: async (params) => ({
            mode: 'mock',
            sessionId: params.requestId,
            roomName: params.roomName,
            status: 'simulated',
          }),
        },
      },
      {
        destinationPhone: parsed.data.destinationPhone,
        callerPhone: parsed.data.callerPhone,
        requestId: parsed.data.requestId,
        roomName: parsed.data.roomName,
      },
    );

    if (!session) {
      return c.json({ ok: false, error: 'shop_not_found' }, 404);
    }

    const result = await session.runTool(parsed.data.tool, parsed.data.params);
    return c.json({
      ok: true,
      requestId: session.requestId,
      roomName: session.roomName,
      shopId: session.shop.id,
      prompt: session.systemPrompt,
      tool: parsed.data.tool,
      result,
    });
  });

  app.post(path('/agent/start-inbound'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.agent_start_inbound, 'agent_start_inbound');
    if (limited) return limited;
    if (!ensureInternalAccess(c.req.header('x-backend-key') ?? null)) {
      securityAudit({
        action: 'authz_denied',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
        details: { reason: 'internal_key_required' },
      });
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }
    if (
      !deps.jobsRepository ||
      !deps.bookingsRepository ||
      !deps.callbacksRepository ||
      !deps.shopsRepository ||
      !deps.telephonyService ||
      !deps.realtimeAgentRuntime
    ) {
      return c.json({ ok: false, error: 'agent_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = startInboundSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }
    const phoneScopedLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.agent_start_inbound_phone,
      `agent_start_inbound:${parsed.data.destinationPhone}:${parsed.data.callerPhone}`,
    );
    if (phoneScopedLimited) return phoneScopedLimited;

    const session = await createInboundAgentSession(
      {
        shopsRepository: deps.shopsRepository,
        jobsRepository: deps.jobsRepository,
        bookingsRepository: deps.bookingsRepository,
        callbacksRepository: deps.callbacksRepository,
        telephonyService: deps.telephonyService,
        shopRoutingRulesRepository: deps.shopRoutingRulesRepository,
        realtimeAgentRuntime: deps.realtimeAgentRuntime,
      },
      {
        destinationPhone: parsed.data.destinationPhone,
        callerPhone: parsed.data.callerPhone,
        requestId: parsed.data.requestId,
        roomName: parsed.data.roomName,
      },
    );

    if (!session) {
      return c.json({ ok: false, error: 'shop_not_found' }, 404);
    }

    const realtime = await session.startRealtimeSession();
    if (requireLivekitRealtimeInProduction() && realtime.mode !== 'livekit_realtime') {
      logger.error(
        {
          requestId: session.requestId,
          roomName: session.roomName,
          mode: realtime.mode,
        },
        'agent_start_inbound_realtime_mode_not_allowed_in_production',
      );
      return c.json({ ok: false, error: 'agent_runtime_not_configured' }, 503);
    }

    await deps.jobsRepository.enqueue({
      shopId: session.shop.id,
      type: 'realtime_session_dispatch',
      payload: {
        requestId: session.requestId,
        roomName: session.roomName,
        destinationPhone: session.shop.phone_number,
        callerPhone: session.callerPhone,
        systemPrompt: session.systemPrompt,
        realtime,
      },
      runAt: new Date(),
      idempotencyKey: `realtime_dispatch:${session.requestId}`,
    });

    return c.json({
      ok: true,
      requestId: session.requestId,
      roomName: session.roomName,
      shopId: session.shop.id,
      prompt: session.systemPrompt,
      realtime,
    });
  });

  app.post(path('/agent/dispatch'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.agent_dispatch, 'agent_dispatch');
    if (limited) return limited;
    if (!ensureRealtimeDispatchAccess(c.req.header('authorization') ?? null, c.req.header('x-backend-key') ?? null)) {
      securityAudit({
        action: 'authz_denied',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
        details: { reason: 'dispatch_auth_required' },
      });
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = parseRealtimeDispatchInput(body);
    if (!parsed) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }
    if (requireLivekitRealtimeInProduction() && parsed.realtime.mode !== 'livekit_realtime') {
      return c.json({ ok: false, error: 'realtime_mode_not_allowed' }, 422);
    }

    const dispatchPayload = (parsed.realtime.metadata as { dispatchPayload?: { demo?: { isolated?: boolean } } } | undefined)
      ?.dispatchPayload;
    const isDemoDispatch = dispatchPayload?.demo?.isolated === true || parsed.requestId.startsWith('demo-');
    await handleRealtimeDispatch(parsed, { callLogsRepository: isDemoDispatch ? undefined : deps.callLogsRepository });
    return c.json({
      ok: true,
      accepted: true,
      requestId: parsed.requestId,
      roomName: parsed.roomName,
      mode: parsed.realtime.mode,
    });
  });

  app.post(path('/agent/dispatch/status'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.agent_dispatch, 'agent_dispatch_status');
    if (limited) return limited;
    if (!ensureRealtimeDispatchAccess(c.req.header('authorization') ?? null, c.req.header('x-backend-key') ?? null)) {
      securityAudit({
        action: 'authz_denied',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
        details: { reason: 'dispatch_auth_required' },
      });
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = dispatchStatusSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }

    if (parsed.data.isDemo && deps.demoSessionsRepository) {
      await deps.demoSessionsRepository.markCallRunStatusByRequestId({
        requestId: parsed.data.requestId,
        status: mapDispatchStatusToDemoCallStatus(parsed.data.status),
        connectedAt: parsed.data.status === 'agent_joined' ? new Date(parsed.data.occurredAt ?? Date.now()) : undefined,
        endedAt:
          parsed.data.status === 'completed' || parsed.data.status === 'failed'
            ? new Date(parsed.data.occurredAt ?? Date.now())
            : undefined,
        outcome: parsed.data.status === 'failed' ? 'error' : parsed.data.status === 'completed' ? 'completed' : undefined,
      });
      await deps.demoSessionsRepository.addStatusEvent({
        requestId: parsed.data.requestId,
        eventType: `agent_dispatch_${parsed.data.status}`,
        payload: {
          roomName: parsed.data.roomName,
          sessionId: parsed.data.sessionId,
          error: parsed.data.error ?? null,
          demoVertical: parsed.data.demoVertical ?? null,
          demoMode: parsed.data.demoMode ?? null,
        },
        occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
      });
      return c.json({
        ok: true,
        accepted: true,
        requestId: parsed.data.requestId,
        status: parsed.data.status,
      });
    }

    if (deps.callLogsRepository && parsed.data.shopId && parsed.data.status === 'agent_joined') {
      await deps.callLogsRepository.markAgentJoined({
        shopId: parsed.data.shopId,
        requestId: parsed.data.requestId,
        roomName: parsed.data.roomName,
      });
    }

    if (
      deps.callLogsRepository &&
      parsed.data.shopId &&
      (parsed.data.status === 'completed' || parsed.data.status === 'failed')
    ) {
      await deps.callLogsRepository.updateTranscriptStatusByRequestId({
        shopId: parsed.data.shopId,
        requestId: parsed.data.requestId,
        status: parsed.data.status === 'completed' ? 'completed' : 'failed',
      });

      if (deps.jobsRepository) {
        await deps.jobsRepository.enqueue({
          shopId: parsed.data.shopId,
          type: 'post_call_summary',
          payload: {
            requestId: parsed.data.requestId,
            status: parsed.data.status,
            error: parsed.data.error ?? null,
            occurredAt: parsed.data.occurredAt ?? null,
          },
          runAt: new Date(),
          idempotencyKey: `post_call_summary:${parsed.data.requestId}:${parsed.data.status}`,
        });
      }
    }

    return c.json({
      ok: true,
      accepted: true,
      requestId: parsed.data.requestId,
      status: parsed.data.status,
    });
  });

  app.notFound((c) =>
    c.json(
      {
        ok: false,
        error: 'route_not_found',
        path: c.req.path,
      },
      404,
    ),
  );

  return app;
}
