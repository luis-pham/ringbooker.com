import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

function createValidatedEnv() {
  return createEnv({
    server: {
      APP_BASE_URL: z.string().url(),
      PORT: z.coerce.number().default(3000),
      NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
      LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
      BACKEND_REPOSITORY_MODE: z.enum(['memory', 'supabase']).default('memory'),
      BACKEND_COMM_PROVIDER: z.enum(['noop', 'telnyx']).default('noop'),
      BILLING_PROVIDER: z.enum(['paddle', 'manual']).default('paddle'),
      AGENT_RUNTIME_MODE: z.enum(['mock', 'livekit_gemini', 'livekit_native_gemini', 'livekit_openai', 'livekit_native_openai']).default('mock'),
      AGENT_TRANSPORT: z.enum(['mock', 'livekit']).default('mock'),
      AGENT_VOICE_PROVIDER: z.enum(['none', 'gemini_live', 'openai_realtime']).default('none'),
      AGENT_VOICE_MODEL: z.string().min(1).default('gemini-3.1-flash-live-preview'),
      AGENT_GEMINI_MODEL: z.string().min(1).default('gemini-3.1-flash-live-preview'),
      AGENT_GEMINI_LATENCY_PRESET: z.enum(['balanced', 'ultra_low_latency']).default('balanced'),
      AGENT_GEMINI_THINKING_LEVEL: z.enum(['minimal', 'low', 'medium', 'high']).default('minimal'),
      AGENT_GEMINI_VAD_START_SENSITIVITY: z.enum(['low', 'high']).default('low'),
      AGENT_GEMINI_VAD_END_SENSITIVITY: z.enum(['low', 'high']).default('low'),
      AGENT_GEMINI_VAD_PREFIX_MS: z.coerce.number().int().min(0).default(20),
      AGENT_GEMINI_VAD_SILENCE_MS: z.coerce.number().int().min(1).default(100),
      AGENT_GEMINI_CONTEXT_COMPRESSION_ENABLED: z.coerce.boolean().default(true),
      AGENT_GEMINI_SYSTEM_PROMPT_MAX_CHARS: z.coerce.number().int().min(1000).default(7000),
      AGENT_GEMINI_TOOL_OUTPUT_MAX_CHARS: z.coerce.number().int().min(500).default(3000),
      AGENT_REALTIME_LOW_LATENCY_PREFERRED: z.coerce.boolean().default(true),
      AGENT_REALTIME_UPLINK_CHUNK_MS: z.coerce.number().int().min(10).max(120).default(20),
      AGENT_GEMINI_UPLINK_CHUNK_MS: z.coerce.number().int().min(10).max(120).default(20),
      AGENT_OPENAI_UPLINK_CHUNK_MS: z.coerce.number().int().min(10).max(120).default(20),
      AGENT_OPENAI_INPUT_TRANSCRIPTION_ENABLED: z.coerce.boolean().default(true),
      AGENT_DISPATCH_WEBHOOK_URL: z.string().url().optional(),
      AGENT_DISPATCH_AUTH_TOKEN: z.string().min(1).optional(),
      AGENT_LIVEKIT_AGENT_COMMAND: z.string().min(1).optional(),
      AGENT_LIVEKIT_NATIVE_OPENAI_AGENT_NAME: z.string().min(1).optional(),
      AGENT_WORKER_MAX_SESSION_MS: z.coerce.number().int().positive().default(30 * 60 * 1000),
      BACKEND_INTERNAL_API_KEY: z.string().min(16).optional(),

      LIVEKIT_URL: z.string().url(),
      LIVEKIT_API_KEY: z.string().min(1),
      LIVEKIT_API_SECRET: z.string().min(1),
      LIVEKIT_SIP_OUTBOUND_TRUNK_ID: z.string().min(1).optional(),

      TELNYX_API_KEY: z.string().min(1),
      TELNYX_APP_ID: z.string().min(1),
      TELNYX_MESSAGING_PROFILE: z.string().min(1),
      TELNYX_SMS_SENDER_NUMBER: z.string().optional(),
      TELNYX_WEBHOOK_PUBLIC_KEY: z.string().min(1),
      TELNYX_WEBHOOK_MAX_SKEW_SECONDS: z.coerce.number().int().positive().default(300),

      GOOGLE_AI_API_KEY: z.string().min(1),
      GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),

      SQUARE_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
      SQUARE_API_VERSION: z.string().min(1).default('2026-01-22'),
      SQUARE_APPLICATION_ID: z.string().min(1).optional(),
      SQUARE_APPLICATION_SECRET: z.string().min(1).optional(),
      VAGARO_REGION: z.string().min(1).default('us'),
      VAGARO_WEBHOOK_VERIFICATION_TOKEN: z.string().min(1).optional(),

      OPENAI_API_KEY: z.string().min(1).optional(),
      OPENAI_REALTIME_URL: z.string().url().optional(),
      OPENAI_ORGANIZATION: z.string().min(1).optional(),
      OPENAI_PROJECT: z.string().min(1).optional(),

      /** Realtime SIP pilot: POST /webhooks/openai when true; false returns 404. */
      OPENAI_SIP_WEBHOOK_ENABLED: z
        .string()
        .optional()
        .transform((s) => s?.trim().toLowerCase() === 'true' || s === '1'),
      /** Standard Webhooks signing secret (`whsec_…`). Required when SIP webhook is enabled. */
      OPENAI_WEBHOOK_SECRET: z.string().min(1).optional(),
      OPENAI_WEBHOOK_MAX_SKEW_SECONDS: z.coerce.number().int().positive().default(300),
      /** When true, answer inbound SIP with `accept` (requires OPENAI_API_KEY). */
      OPENAI_SIP_ACCEPT_ENABLED: z
        .string()
        .optional()
        .transform((s) => s?.trim().toLowerCase() === 'true' || s === '1'),
      OPENAI_SIP_SIDEBAND_ENABLED: z
        .string()
        .optional()
        .transform((s) => {
          if (s === undefined || s === null || String(s).trim() === '') return true;
          const t = String(s).trim().toLowerCase();
          return !(t === 'false' || t === '0' || t === 'no');
        }),
      /** JSON array: `[{ "did": "+1…", "vertical": "nail-salon", "defaultShopName": "…" }]` */
      OPENAI_SIP_DEMO_DID_MAP_JSON: z.string().optional(),
      OPENAI_REALTIME_PROJECT_ID: z.string().min(1).optional(),
      /** Telnyx TeXML: full OpenAI SIP URI for Dial/Sip (see /telnyx/texml/inbound). */
      OPENAI_SIP_URI: z.string().min(1).optional(),
      /** Optional: force one Realtime voice for all SIP calls. If unset, voice follows marketing vertical. */
      OPENAI_REALTIME_SIP_VOICE: z.string().min(1).optional(),

      SUPABASE_URL: z.string().url(),
      SUPABASE_SERVICE_KEY: z.string().min(1),

      PADDLE_API_KEY: z.string().min(1),
      PADDLE_WEBHOOK_SECRET: z.string().min(1),
      PADDLE_WEBHOOK_MAX_SKEW_SECONDS: z.coerce.number().int().positive().default(300),
      PADDLE_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
      PADDLE_PRICE_STARTER: z.string().min(1),
      PADDLE_PRICE_PROFESSIONAL: z.string().min(1),
      PADDLE_PRICE_ENTERPRISE: z.string().min(1),

      EMAIL_PROVIDER: z.enum(['noop', 'resend']).default('noop'),
      EMAIL_FROM_ADDRESS: z.string().min(1).default('RingBooker Notifications <notifications@send.ringbooker.com>'),
      EMAIL_FOUNDER_FROM: z.string().min(1).default('Luis Pham from RingBooker <luis@send.ringbooker.com>'),
      EMAIL_REPLY_TO: z.string().email().default('hello@ringbooker.com'),
      CONTACT_SALES_EMAIL: z.string().email().default('hello@ringbooker.com'),
      EMAIL_SUPPORT_ADDRESS: z.string().email().default('support@ringbooker.com'),
      RESEND_API_KEY: z.string().min(1).optional(),

      APP_ENCRYPTION_KEY: z.string().min(32),
      APP_SIGNING_SECRET: z.string().min(32),

      DEFAULT_SHOP_TIMEZONE: z.string().default('America/Los_Angeles'),
      CALENDAR_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
      BOOKING_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
      SMS_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
      TRANSFER_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
      REDIS_URL: z.string().url().optional(),
      TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
      PUBLIC_DEMO_SHOP_ID: z.string().min(1).default('demo-shop'),
      CALENDAR_TOKEN_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3300),
      CALENDAR_FREEBUSY_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(45),
      CALENDAR_SINGLEFLIGHT_LOCK_MS: z.coerce.number().int().positive().default(2500),

      JOB_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
      JOB_LEASE_SECONDS: z.coerce.number().int().positive().default(60),
    },
    runtimeEnv: process.env,
  });
}

let cachedEnv: ReturnType<typeof createValidatedEnv> | null = null;
let warnedMissingVagaroWebhookToken = false;

export function getEnv() {
  if (!cachedEnv) {
    cachedEnv = createValidatedEnv();
  }
  const vagaroLooksEnabled =
    process.env.CALENDAR_PROVIDER_DEFAULT === 'vagaro' ||
    Boolean(process.env.VAGARO_CLIENT_ID) ||
    Boolean(process.env.VAGARO_CLIENT_SECRET_KEY);
  if (vagaroLooksEnabled && !cachedEnv.VAGARO_WEBHOOK_VERIFICATION_TOKEN && !warnedMissingVagaroWebhookToken) {
    warnedMissingVagaroWebhookToken = true;
    console.warn('VAGARO_WEBHOOK_VERIFICATION_TOKEN is not configured; Vagaro webhooks will be rejected.');
  }
  return cachedEnv;
}

/** Clears parsed env cache after `process.env` mutations (used in tests). */
export function resetEnvCacheForTests() {
  cachedEnv = null;
}
