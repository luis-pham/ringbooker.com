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
import { isShopOnboardingComplete } from '@/src/backend/domain/shop-onboarding';
import type {
  BillingProvider,
  BillingSubscription,
  BillingSubscriptionStatus,
  BlogPostStatus,
  ContactRequestStatus,
  JobType,
  Shop,
  ShopAccessState,
} from '@/src/backend/domain/types';
import type {
  BlogPostsRepository,
  BookingsRepository,
  BillingNotificationsRepository,
  BillingCustomersRepository,
  BillingSubscriptionsRepository,
  CallbacksRepository,
  CallLogsRepository,
  DemoAdminCallListRow,
  DemoCallStatus,
  DemoSessionStatus,
  JobsRepository,
  MissedCallsRepository,
  ProviderEventsRepository,
  ShopsRepository,
  AuthUsersRepository,
  ContactRequestsRepository,
  DemoSessionsRepository,
  HandoffSessionsRepository,
  ShopAccessStatesRepository,
  TestCallAttemptsRepository,
  VoiceCallLegsRepository,
} from '@/src/backend/ports/repositories';
import type { WebDemoSessionStatus, WebDemoSessionsRepository } from '@/src/backend/ports/web-demo-sessions';
import type { BillingProviderAdapter } from '@/src/backend/services/billing/types';
import { createNoCardTrialForShop } from '@/src/backend/services/billing/no-card-trial';
import { buildAdminShopStatus } from '@/src/backend/services/admin/admin-shop-status';
import { getShopBillingAccess } from '@/src/backend/services/billing/access';
import { formatPlanPrice, getPlanCatalogEntry, isSelfServeTrialPlan } from '@/src/backend/domain/plan-catalog';
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
            turn_detection: turnDetectionForSecret,
          },
          output: {
            voice: params.voice,
          },
        },
      },
    }),
  }).catch(() => null);

  if (!response) {
    throw new Error('realtime_session_failed');
  }
  if (!response.ok) {
    throw new Error(response.status === 401 || response.status === 403 ? 'openai_config_missing' : 'realtime_session_failed');
  }

  const body = (await response.json().catch(() => null)) as OpenAiRealtimeClientSecretResponse | null;
  const value = body?.value ?? body?.client_secret?.value;
  if (!value) {
    throw new Error('realtime_session_failed');
  }
  return {
    value,
    expiresAt: body?.expires_at ?? body?.client_secret?.expires_at,
    turnDetectionAfterWelcome,
  };
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
  current_onboarding_step: z.coerce.number().int().min(1).max(4).optional(),
  setup_method: z.enum(['forward', 'new_number']).optional(),
  forwarding_type: z.enum(['no_answer', 'all', 'busy', 'unreachable']).optional(),
  forwarding_carrier: z.string().optional(),
  forwarding_country: z.string().optional(),
});

const serviceItemSchema = z.object({
  name: z.string().min(1).max(120),
  duration_min: z.coerce.number().int().min(1).max(600),
  price: z.coerce.number().min(0).max(10000),
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

const userPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

const adminShopSettingsUpdateSchema = userSettingsBaseSchema.extend({
  services: z.array(serviceItemSchema).optional(),
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
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const readWebsiteSchema = z.object({
  url: z.string().url(),
});

const calendarProviderParamSchema = z.object({
  provider: z.enum(['square_appointments', 'google_calendar', 'vagaro', 'glossgenius', 'fresha', 'mindbody', 'booksy']),
});
type CalendarProviderParam = z.infer<typeof calendarProviderParamSchema>['provider'];
type BookingLinkProviderId = 'glossgenius' | 'fresha' | 'booksy';

const BOOKING_LINK_PROVIDER_IDS = ['glossgenius', 'fresha', 'booksy'] as const satisfies readonly BookingLinkProviderId[];

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

const blogPostStatusSchema = z.enum(['draft', 'published', 'archived']);

const blogPostListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  query: z.string().max(120).optional(),
  status: z.union([blogPostStatusSchema, z.literal('all')]).optional(),
});

const contactRequestStatusSchema = z.enum(['new', 'contacted', 'qualified', 'closed', 'spam']);

const adminLeadsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  status: z.union([contactRequestStatusSchema, z.literal('all')]).optional(),
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

const USER_CALLS_PAGE_SIZE = 20;
const userCallsFilterSchema = z.enum(['all', 'follow_up_needed', 'high_urgency', 'bookings', 'missed']);
const userCallsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  filter: userCallsFilterSchema.optional().default('all'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
  const startedAfter = parsed.from ? new Date(`${parsed.from}T00:00:00.000Z`) : undefined;
  const startedBefore = parsed.to ? new Date(`${parsed.to}T23:59:59.999Z`) : undefined;
  const base = { startedAfter, startedBefore };
  switch (parsed.filter) {
    case 'follow_up_needed':
      return { ...base, summaryFollowUpRequired: true };
    case 'high_urgency':
      return { ...base, summaryUrgency: 'high' as const };
    case 'bookings':
      return { ...base, summaryNextActions: ['booking_created' as const, 'booking_link_sent' as const] };
    case 'missed':
      return { ...base, outcome: 'missed' };
    default:
      return base;
  }
}

type SessionRole = 'user' | 'admin';

const USER_SETTING_FIELD_CAPABILITIES: Record<string, ShopSettingCapability> = {
  name: 'edit_business_profile',
  phone_number: 'edit_business_profile',
  vertical: 'edit_business_profile',
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
  cancel_policy: 'edit_cancel_policy',
  promotions: 'edit_promotions',
  services: 'edit_services',
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
        | 'user_name'
      | 'user_phone'
      | 'backup_phone'
      | 'address'
      | 'timezone'
      | 'services'
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

function createTemporaryPhoneNumber(): string {
  const digits = randomUUID().replace(/[^0-9]/g, '').padEnd(10, '0').slice(0, 10);
  return `+1${digits}`;
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
  appBaseUrl: string;
  idempotencyKey: string;
}): Promise<void> {
  if (!params.emailService) return;
  try {
    const { input, text } = buildWelcomeSignupEmailPayload({
      email: params.email,
      shopName: params.shopName,
      trialEndsAt: params.trialEndsAt,
      appBaseUrl: params.appBaseUrl,
      paddleTrialConfigVerified: process.env.PADDLE_TRIAL_CONFIG_VERIFIED === 'true',
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
    ? "Add a payment method to go live. You won't be charged until your trial ends."
    : 'Add a payment method to go live. A payment method is required before RingBooker answers real callers on your business number.';
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
  if (!isShopOnboardingComplete(params.shop)) {
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
  const url = new URL('/user/settings', params.appBaseUrl);
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
): Promise<{ ok: false; status: number; error: string } | { ok: true; json: Record<string, unknown> }> {
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
const adminDashboardChartMetricSchema = z.enum(['demo-calls', 'leads', 'shops', 'calls']);

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

export function createBackendApp(deps: {
  providerEventsRepository: ProviderEventsRepository;
  jobsRepository?: JobsRepository;
  bookingsRepository?: BookingsRepository;
  billingCustomersRepository?: BillingCustomersRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  billingNotificationsRepository?: BillingNotificationsRepository;
  shopAccessStatesRepository?: ShopAccessStatesRepository;
  testCallAttemptsRepository?: TestCallAttemptsRepository;
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
  missedCallsRepository?: MissedCallsRepository;
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
        "script-src 'self' 'unsafe-inline'",
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
        ].join(' '),
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
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
        callLogsRepository: deps.callLogsRepository,
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
    }),
  );
  app.get(path('/telnyx/texml/inbound'), (c) =>
    handleTelnyxTexmlOpenAiInbound(c, {
      shopsRepository: deps.shopsRepository,
      billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
      shopAccessStatesRepository: deps.shopAccessStatesRepository,
    }),
  );

  app.post(path('/webhooks/paddle'), (c) =>
    (async () => {
      const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.webhook_paddle, 'webhook_paddle');
      if (limited) return limited;
      return handlePaddleWebhook(c, {
      providerEventsRepository: deps.providerEventsRepository,
      billingProvider: deps.billingProvider,
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
        jobsRepository: deps.jobsRepository,
        bookingsRepository: deps.bookingsRepository,
        callbacksRepository: deps.callbacksRepository,
        telephonyService: deps.telephonyService,
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
      const subject = `New Contact Request — ${parsed.data.businessName}`;
      const lines = [
        `Request ID: ${requestId}`,
        `Received At: ${receivedAt}`,
        `Name: ${parsed.data.fullName}`,
        `Business: ${parsed.data.businessName}`,
        `Email: ${normalizedEmail}`,
        `Phone: ${normalizedPhone}`,
        `Business Type: ${parsed.data.businessType}`,
        `Current Setup: ${parsed.data.currentSetup}`,
        `Best Time: ${parsed.data.bestTime}`,
        '',
        'Help Request:',
        parsed.data.helpNeed,
      ];
      try {
        await deps.emailService.sendEmail({
          to: salesTo,
          subject,
          text: lines.join('\n'),
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
              <h2 style="margin:0 0 12px">New Contact Request</h2>
              <p style="margin:0 0 8px"><strong>Request ID:</strong> ${requestId}</p>
              <p style="margin:0 0 8px"><strong>Received At:</strong> ${receivedAt}</p>
              <p style="margin:0 0 8px"><strong>Name:</strong> ${parsed.data.fullName}</p>
              <p style="margin:0 0 8px"><strong>Business:</strong> ${parsed.data.businessName}</p>
              <p style="margin:0 0 8px"><strong>Email:</strong> ${normalizedEmail}</p>
              <p style="margin:0 0 8px"><strong>Phone:</strong> ${normalizedPhone}</p>
              <p style="margin:0 0 8px"><strong>Business Type:</strong> ${parsed.data.businessType}</p>
              <p style="margin:0 0 8px"><strong>Current Setup:</strong> ${parsed.data.currentSetup}</p>
              <p style="margin:0 0 8px"><strong>Best Time:</strong> ${parsed.data.bestTime}</p>
              <p style="margin:12px 0 4px"><strong>Help Request:</strong></p>
              <p style="margin:0;white-space:pre-wrap">${parsed.data.helpNeed}</p>
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

    if (deps.emailService) {
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

      try {
        await deps.emailService.sendEmail({
          from: emailDefaultFrom(),
          to: salesTo,
          subject: `New demo request: ${parsed.data.businessName || parsed.data.fullName}`,
          text: `New demo request received:

Name: ${parsed.data.fullName}
Business: ${parsed.data.businessName || 'Not provided'}
Email: ${normalizedEmail}
Phone: ${normalizedPhone || 'Not provided'}
Business type: ${parsed.data.businessType || 'Not provided'}
Main need: ${parsed.data.helpNeed || 'Not provided'}

Submitted at: ${new Date().toISOString()}`,
          category: 'demo_request_internal',
          idempotencyKey: `public_contact_internal:${requestId}`,
          replyTo: normalizedEmail,
        });
      } catch (error) {
        logger.error(
          {
            err: error,
            requestId,
          },
          'public_contact_internal_notification_failed',
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
      if (!tryOccupyDirectDemoActiveSlot(ip, requestId, ttlMs)) {
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
    const released = releaseDirectDemoActiveSlot(ip, releaseParsed.data.requestId);
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

  app.post(path('/auth/user/signup/phone-search'), async (c) => {
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

    const requestId = randomUUID();
    const shopName = parsed.data.shopName?.trim() || buildDefaultShopNameFromEmail(normalizedEmail);
    let assignedPhoneNumber = createTemporaryPhoneNumber();

    if (parsed.data.phoneNumber && deps.phoneProvisioningService) {
      const provisioned = await deps.phoneProvisioningService.provisionNumber({
        phoneNumber: parsed.data.phoneNumber,
        requestId,
      });
      assignedPhoneNumber = provisioned.phoneNumber;
    } else if (deps.phoneProvisioningService) {
      try {
        const suggested = await deps.phoneProvisioningService.searchAvailableNumbers({
          countryCode: 'US',
          limit: 1,
        });
        const candidate = suggested[0]?.phoneNumber;
        if (candidate) {
          const provisioned = await deps.phoneProvisioningService.provisionNumber({
            phoneNumber: candidate,
            requestId,
          });
          assignedPhoneNumber = provisioned.phoneNumber;
        }
      } catch (error) {
        logger.warn({ err: error, requestId }, 'signup_phone_auto_provision_fallback_to_temporary');
      }
    }

    const createdShop = await deps.shopsRepository.create({
      name: shopName,
      brand_slug: parsed.data.brandSlug ?? toBrandSlug(shopName),
      phone_number: assignedPhoneNumber,
      user_phone: parsed.data.userPhone ?? assignedPhoneNumber,
      user_name: parsed.data.userName ?? null,
      timezone: parsed.data.timezone,
      plan: parsed.data.plan,
      active: true,
    });

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
        phoneNumber: assignedPhoneNumber,
      },
    });

    await sendSignupWelcomeEmail({
      emailService: deps.emailService,
      email: authUser.email,
      shopName: createdShop.name,
      shopId: createdShop.id,
      trialEndsAt: trial.subscription.trialEndsAt ?? undefined,
      appBaseUrl: getAppBaseUrl(c.req),
      idempotencyKey: `signup-welcome:${authUser.id}`,
    });

    const postAuthRedirect = computeUserPostAuthRedirectPath({ shop: createdShop, shopId: createdShop.id });

    return c.json(
      {
        ok: true,
        role: 'user',
        shopId: createdShop.id,
        onboardingRequired: !isShopOnboardingComplete(createdShop),
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
      const requestId = randomUUID();
      const shopName = buildDefaultShopNameFromEmail(googleProfile.email);
      let assignedPhoneNumber = createTemporaryPhoneNumber();
      if (deps.phoneProvisioningService) {
        try {
          const suggested = await deps.phoneProvisioningService.searchAvailableNumbers({
            countryCode: 'US',
            limit: 1,
          });
          const candidate = suggested[0]?.phoneNumber;
          if (candidate) {
            const provisioned = await deps.phoneProvisioningService.provisionNumber({
              phoneNumber: candidate,
              requestId,
            });
            assignedPhoneNumber = provisioned.phoneNumber;
          }
        } catch (error) {
          logger.warn({ err: error, requestId }, 'google_signup_phone_auto_provision_fallback_to_temporary');
        }
      }
      shop = await deps.shopsRepository.create({
        name: shopName,
        brand_slug: toBrandSlug(shopName),
        phone_number: assignedPhoneNumber,
        user_phone: assignedPhoneNumber,
        user_name: googleProfile.name?.trim() || null,
        timezone: process.env.DEFAULT_SHOP_TIMEZONE ?? 'America/Los_Angeles',
        plan: selectedPlan,
        active: true,
      });
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
      onboardingRequired: shop ? !isShopOnboardingComplete(shop) : false,
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
    const [bookingCount, callCount, missedCalls] = await Promise.all([
      deps.bookingsRepository.countByShop(shop.id),
      deps.callLogsRepository.countByShop(shop.id, {}),
      deps.callLogsRepository.countByShop(shop.id, { outcome: 'missed' }),
    ]);

    return c.json({
      ok: true,
      shop: {
        id: shop.id,
        name: shop.name,
        phone_number: shop.phone_number,
        timezone: shop.timezone,
        plan: shop.plan,
        active: shop.active,
      },
      onboardingRequired: !isShopOnboardingComplete(shop),
      metrics: {
        bookingCount,
        callCount,
        missedCalls,
      },
    });
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
    return c.json({
      ok: true,
      onboardingRequired: !isShopOnboardingComplete(shop),
      shop: {
        id: shop.id,
        name: shop.name,
        vertical: shop.vertical ?? null,
        phone_number: shop.phone_number,
        user_name: shop.user_name ?? '',
        user_phone: shop.user_phone ?? '',
        timezone: shop.timezone,
        cancel_policy: shop.cancel_policy,
        services: shop.services,
        hours: shop.hours,
        languages: shop.languages ?? ['en'],
        website_url: shop.website_url ?? '',
        booking_url: shop.booking_url ?? '',
        current_onboarding_step: shop.current_onboarding_step ?? 1,
        setup_method: shop.setup_method ?? null,
        forwarding_type: shop.forwarding_type ?? 'no_answer',
        forwarding_carrier: shop.forwarding_carrier ?? null,
        forwarding_country: shop.forwarding_country ?? 'us',
        telnyx_number: shop.telnyx_number ?? '',
      },
    });
  });

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

    const updated = await deps.shopsRepository.updateUserSettings(sessionResult.shopId ?? '', {
      website_url: parsed.data.url,
    });
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    return c.json({
      ok: true,
      success: true,
      servicesFound: 0,
      todo: 'website_scraping_not_implemented',
    });
  });

  app.post(path('/user/test-call-forwarding'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_test_call_forwarding');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;

    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = testCallForwardingSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    // TODO: implement real Telnyx outbound forwarding verification call.
    // Stub behavior: app/dashboard-based carriers fail; dial-code carriers pass.
    await new Promise((resolve) => setTimeout(resolve, 3000));
    // Always use the authenticated user's shop. Never trust a shop id from the request body.
    const shopId = sessionResult.shopId ?? '';
    const shop = await deps.shopsRepository.findById(shopId);
    const appBasedCarriers = ['googlevoice', 'ringcentral', 'openphone', 'other'];
    const success = Boolean(shop?.forwarding_carrier && !appBasedCarriers.includes(shop.forwarding_carrier));
    return c.json({
      ok: true,
      success,
    });
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
        { shopId: shop.id, onboardingComplete: isShopOnboardingComplete(shop) },
      );
      trialDaysRemaining = access.trialDaysRemaining;
      paymentMethodStatus = access.paymentMethodStatus ?? 'none';
      liveCallsEnabled = access.liveCallsEnabled;
      canGoLive = access.canGoLive;
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
      onboardingRequired: !isShopOnboardingComplete(shop),
      subscriptionStatus,
      billingStatus: subscriptionStatus,
      trialEndsAt,
      trialDaysRemaining,
      paymentMethodStatus,
      liveCallsEnabled,
      canGoLive,
      billingBannerVariant,
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

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const bookings = await deps.bookingsRepository.listByShop(shop.id, { limit: 100 });
    return c.json({ ok: true, bookings });
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
    const [totalLast7Days, bookingsCount, followUpCount, missedCount] = await Promise.all([
      repo.countByShop(shop.id, { startedAfter: last7Days }),
      repo.countByShop(shop.id, { summaryNextActions: ['booking_created', 'booking_link_sent'] }),
      repo.countByShop(shop.id, { summaryFollowUpRequired: true }),
      repo.countByShop(shop.id, { startedAfter: last7Days, outcome: 'missed' }),
    ]);

    return c.json({
      ok: true,
      totalLast7Days,
      bookingsCount,
      followUpCount,
      missedCount,
    });
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
      filter: c.req.query('filter'),
      from: c.req.query('from'),
      to: c.req.query('to'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query', details: parsed.error.flatten() }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const page = parsed.data.page ?? 1;
    const offset = (page - 1) * USER_CALLS_PAGE_SIZE;
    const repo = deps.callLogsRepository;
    const filters = buildUserCallFilters(parsed.data);

    const [calls, total, booked, missed, transcriptsReady] = await Promise.all([
      repo.listByShop(shop.id, { ...filters, limit: USER_CALLS_PAGE_SIZE, offset }),
      repo.countByShop(shop.id, filters),
      repo.countByShop(shop.id, { ...filters, summaryNextActions: ['booking_created', 'booking_link_sent'] }),
      repo.countByShop(shop.id, { ...filters, outcome: 'missed' }),
      repo.countByShop(shop.id, { ...filters, transcriptStatus: 'completed' }),
    ]);

    return c.json({
      ok: true,
      calls,
      pagination: { page, pageSize: USER_CALLS_PAGE_SIZE, total },
      summary: { total, booked, missed, transcriptsReady },
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
    return c.json({
      ok: true,
      shop,
      capabilities: getShopPlanCapabilities(shop.plan),
      capabilityLabels: CAPABILITY_LABELS,
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
                }
              : null,
          };
        }
        if (id === 'vagaro') {
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
    });
    if (!settingsUpdated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    return c.json({
      ok: true,
      provider: 'vagaro',
      bookingUrl,
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
    if (isBookingLinkProviderId(provider)) {
      return c.json({
        ok: true,
        provider,
        type: 'booking_link',
        capabilities: { hasBookingLink: true },
        note: 'When clients call to book, they will receive your booking link via SMS.',
      });
    }
    if (provider !== 'square_appointments' && provider !== 'vagaro') {
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
        logger.error({ err: error, provider }, 'calendar_provider_options_failed');
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
      { shopId: shop.id, onboardingComplete: isShopOnboardingComplete(shop) },
    );
    const catalog = getPlanCatalogEntry(subscription?.plan ?? shop.plan);
    const amountCents = access.amountCents ?? catalog.amountCents ?? 0;

    return c.json({
      ok: true,
      shop: {
        id: shop.id,
        name: shop.name,
        plan: shop.plan,
        active: shop.active,
      },
      billing: {
        provider: subscription?.provider ?? customer?.provider ?? deps.billingProvider?.provider ?? 'manual',
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
        currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
        paymentMethodStatus: access.paymentMethodStatus,
        hasPaymentMethod: access.paymentMethodStatus === 'valid',
        liveCallsEnabled: access.liveCallsEnabled,
        canOnboard: true,
        canTestCall: access.canTestCall,
        canGoLive: access.canGoLive,
        canReceiveLiveCalls: access.canReceiveLiveCalls,
        blockReason: access.blockReason,
        requiresPaymentMethodBeforeGoLive: access.paymentMethodStatus !== 'valid',
        trialNoChargeUntilEndVerified: process.env.PADDLE_TRIAL_CONFIG_VERIFIED === 'true',
        checkoutAvailable: Boolean(deps.billingProvider && isSelfServeTrialPlan(shop.plan)),
        manageBillingAvailable: false,
      },
    });
  });

  app.post(path('/user/billing/checkout'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_billing_checkout');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.billingProvider || !deps.billingSubscriptionsRepository) {
      return c.json({ ok: false, error: 'billing_provider_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = userBillingCheckoutSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
    if (!subscription || !['trialing', 'trial_expired', 'paused', 'canceled', 'active'].includes(subscription.status)) {
      return c.json({ ok: false, error: 'subscription_not_ready_for_checkout' }, 409);
    }
    const checkoutPlan = subscription.plan;
    if (!isSelfServeTrialPlan(checkoutPlan)) {
      return c.json({ ok: false, error: 'plan_not_self_serve', message: 'Please contact sales for custom plans.' }, 400);
    }

    const appBaseUrl = getAppBaseUrl(c.req);
    const session = await deps.billingProvider.createCheckoutSession({
      shop,
      plan: checkoutPlan,
      email: sessionResult.email,
      internalSubscriptionId: subscription.id,
      trialEndsAt: subscription.trialEndsAt ?? null,
      source: 'add_payment_method_before_go_live',
      successUrl: parsed.data.successUrl ?? `${appBaseUrl}/user/billing?checkout=success`,
      cancelUrl: parsed.data.cancelUrl ?? `${appBaseUrl}/user/billing?checkout=cancelled`,
    });

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
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_billing_reactivate');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.billingProvider || !deps.billingSubscriptionsRepository) {
      return c.json({ ok: false, error: 'billing_provider_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
    if (!subscription || !['trial_expired', 'paused', 'canceled', 'past_due', 'unpaid'].includes(subscription.status)) {
      return c.json({ ok: false, error: 'subscription_not_reactivatable' }, 409);
    }
    if (!isSelfServeTrialPlan(subscription.plan)) {
      return c.json({ ok: false, error: 'plan_not_self_serve', message: 'Please contact sales for custom plans.' }, 400);
    }
    const appBaseUrl = getAppBaseUrl(c.req);
    const session = await deps.billingProvider.createCheckoutSession({
      shop,
      plan: subscription.plan,
      email: sessionResult.email,
      internalSubscriptionId: subscription.id,
      source: 'reactivate_subscription',
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

  app.post(path('/user/go-live/enable'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_go_live_enable');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.billingSubscriptionsRepository || !deps.shopAccessStatesRepository) {
      return c.json({ ok: false, error: 'billing_dependencies_unavailable' }, 500);
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
      { shopId: shop.id, onboardingComplete: isShopOnboardingComplete(shop) },
    );
    if (!access.canGoLive) {
      const status = access.blockReason === 'payment_method_required' ? 402 : 409;
      return c.json(
        {
          ok: false,
          error: access.blockReason === 'payment_method_required' ? 'payment_method_required' : access.blockReason,
          message:
            access.blockReason === 'payment_method_required'
              ? buildGoLivePaymentRequiredMessage()
              : 'RingBooker cannot go live until your account is ready.',
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
    return c.json({ ok: true, liveCallsEnabled: next.liveCallsEnabled, goLiveAt: next.goLiveAt });
  });

  app.post(path('/user/test-calls/call-me'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_test_calls_call_me');
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
    const parsed = z.object({ phoneNumber: z.string().min(6).max(32).optional() }).safeParse(body);
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
      { shopId: shop.id, onboardingComplete: isShopOnboardingComplete(shop) },
    );
    if (!access.canTestCall) {
      return c.json({ ok: false, error: access.blockReason, message: 'Test calls are not available for this account state.' }, 409);
    }
    const destination = parsed.data.phoneNumber ?? shop.user_phone;
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
        from: shop.phone_number,
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
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

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

    const hasBasicPatch = Object.keys(basicPatch).length > 0;
    const hasDynamicPatch = Object.keys(dynamicPatch).length > 0;
    if (!hasBasicPatch && !hasDynamicPatch) {
      return c.json({ ok: false, error: 'no_changes' }, 400);
    }

    let updated = shop;
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

    return c.json({
      ok: true,
      shop: updated,
      capabilities: getShopPlanCapabilities(updated.plan),
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
      deps.shopsRepository.list({ limit: 200 }),
      deps.callLogsRepository.listRecent({ limit: 200 }),
    ]);
    return c.json({
      ok: true,
      metrics: {
        shopCount: shops.length,
        activeShops: shops.filter((shop) => shop.active).length,
        callCount: calls.length,
        missedCalls: calls.filter((item) => item.outcome === 'missed').length,
      },
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
    const [subscription, accessState, testCallsUsed] = await Promise.all([
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
    ]);

    return c.json({
      ok: true,
      shop,
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
      query: c.req.query('query'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query' }, 400);
    }

    const leads = await deps.contactRequestsRepository.listForAdmin({
      limit: parsed.data.limit,
      status: parsed.data.status,
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
    const activeAdmins = users.filter((u) => u.role === 'admin' && u.active);
    const mfaEnabled = users.filter((u) => u.mfaEnabled).length;
    const stats = {
      total: users.length,
      adminTotal: users.filter((u) => u.role === 'admin').length,
      activeAdminCount: activeAdmins.length,
      mfaEnabledCount: mfaEnabled,
      mfaPercent: users.length ? Math.round((mfaEnabled / users.length) * 100) : 0,
    };
    return c.json({ ok: true, users, stats });
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
