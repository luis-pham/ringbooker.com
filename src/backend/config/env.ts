import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

import { validateVoiceArchitectureAtStartup } from '@/src/backend/config/voice-transport';

/** Empty/unset → undefined; positive integer ms when set (Telnyx REST timeout overrides). */
const optionalPositiveIntEnv = z.preprocess(
  (val) => (val === '' || val === undefined || val === null ? undefined : val),
  z.coerce.number().int().positive().optional(),
);
const optionalNonEmptyStringEnv = z.preprocess(
  (val) => (val === '' || val === undefined || val === null ? undefined : val),
  z.string().min(1).optional(),
);

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
      BILLING_CHECKOUT_ENABLED: z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
      BILLING_MANAGE_ENABLED: z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
      SERVICE_CATALOG_ENABLED: z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
      WEBSITE_IMPORT_ENABLED: z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
      GOOGLE_PLACES_API_KEY: optionalNonEmptyStringEnv,
      WEBSITE_IMPORT_LLM_ENABLED: z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
      WEBSITE_IMPORT_LLM_MODEL: optionalNonEmptyStringEnv,
      WEBSITE_IMPORT_LLM_MAX_TOKENS: optionalPositiveIntEnv,
      // Cross-IP daily cap on website-import LLM extraction calls (cost guardrail).
      // A service-only retry may consume one additional LLM call when explicitly enabled.
      // When the cap is hit, imports still succeed using static + Google Places extraction.
      WEBSITE_IMPORT_LLM_GLOBAL_DAILY_LIMIT: z.coerce.number().int().positive().default(500),
      WEBSITE_IMPORT_LLM_GLOBAL_WINDOW_SECONDS: z.coerce.number().int().positive().default(86_400),
      WEBSITE_IMPORT_SERVICE_RETRY_ENABLED: z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
      WEBSITE_IMPORT_SERVICE_RETRY_MODEL: optionalNonEmptyStringEnv,
      WEBSITE_IMPORT_DIFFICULT_FALLBACK_MODEL: z.string().min(1).default('gpt-5.4-mini'),
      WEBSITE_IMPORT_SERVICE_RETRY_MAX_PAGES: z.coerce.number().int().min(1).max(24).default(12),
      WEBSITE_IMPORT_SERVICE_RETRY_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(20_000),
      WEBSITE_IMPORT_SERVICE_RETRY_MIN_SERVICE_COUNT: z.coerce.number().int().min(1).max(80).default(15),
      WEBSITE_IMPORT_POLICY_RETRY_ENABLED: z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
      WEBSITE_IMPORT_POLICY_RETRY_MODEL: optionalNonEmptyStringEnv,
      WEBSITE_IMPORT_POLICY_RETRY_FALLBACK_MODEL: z.string().min(1).default('gpt-5.4-mini'),
      WEBSITE_IMPORT_POLICY_RETRY_MAX_PAGES: z.coerce.number().int().min(1).max(16).default(8),
      WEBSITE_IMPORT_POLICY_RETRY_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(20_000),
      WEBSITE_IMPORT_POLICY_RETRY_MIN_POLICY_COUNT: z.coerce.number().int().min(1).max(25).default(3),
      WEBSITE_IMPORT_DEBUG_LOG: z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
      WEBSITE_IMPORT_DEBUG_SAVE_TEXT: z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
      WEBSITE_IMPORT_MAX_BYTES: z.coerce.number().int().min(100_000).max(5_000_000).default(1_500_000),
      WEBSITE_IMPORT_RENDER_URL: optionalNonEmptyStringEnv,
      WEBSITE_IMPORT_RENDER_API_KEY: optionalNonEmptyStringEnv,
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
      TELNYX_SMS_INBOX_ALLOWED_NUMBERS: optionalNonEmptyStringEnv,
      TELNYX_WEBHOOK_PUBLIC_KEY: z.string().min(1),
      TELNYX_WEBHOOK_MAX_SKEW_SECONDS: z.coerce.number().int().positive().default(300),
      /** When true, POST /webhooks/telnyx/call-control accepts Telnyx Call Control Application events (Phase 2+). */
      TELNYX_CALL_CONTROL_WEBHOOK_ENABLED: z
        .string()
        .optional()
        .transform((s) => s?.trim().toLowerCase() === 'true' || s === '1'),
      /** On `call.answered`, send Call Control `dial` to `OPENAI_SIP_URI` with bridge (production pilot). */
      TELNYX_CALL_CONTROL_BRIDGE_OPENAI_SIP: z
        .string()
        .optional()
        .transform((s) => s?.trim().toLowerCase() === 'true' || s === '1'),
      /** Connection / Call Control Application ID for outbound `POST /v2/calls` (required in production when create_and_bridge + bridge OpenAI SIP). */
      TELNYX_CALL_CONTROL_CONNECTION_ID: z.string().min(1).optional(),
      /** Audio URL played on caller leg while waiting for OpenAI SIP leg to bridge. Omit to disable ringback. */
      TELNYX_RINGBACK_AUDIO_URL: z.string().url().optional(),
      /** Outbound OpenAI SIP leg ring/answer timeout for `POST /v2/calls` (`timeout_secs`). Default 15 in code when unset. */
      TELNYX_OPENAI_SIP_LEG_TIMEOUT_SECS: z.coerce.number().int().min(5).max(120).optional(),
      // Demo-only duration cap. Shop calls set max_duration_secs from billing plan at line 588 of
      // telnyx-call-control-webhook.ts before this condition is evaluated — production calls are unaffected.
      TELNYX_ANSWER_MAX_DURATION_ENABLED: z
        .string()
        .optional()
        .default('true')
        .transform((s) => s?.trim().toLowerCase() === 'true' || s === '1'),
      /** Cap for inbound parent call duration when answer max-duration is enabled. Default 300 = 5-min demo cap. */
      TELNYX_INBOUND_MAX_DURATION_SECS: z.coerce.number().int().min(60).max(28_800).default(300),
      /**
       * Verify the Ed25519 signature on TeXML Voice URL POSTs (`/telnyx/texml/inbound`).
       * Default true. Set false only if your Telnyx TeXML application is not configured to sign webhooks.
       */
      TELNYX_TEXML_VERIFY_SIGNATURE: z
        .string()
        .optional()
        .default('true')
        .transform((s) => s?.trim().toLowerCase() === 'true' || s === '1'),
      /** Hard duration cap (seconds) applied to demo TeXML `<Dial timeLimit>` — provider-side, survives restarts. */
      TELNYX_TEXML_DEMO_MAX_DURATION_SECS: z.coerce.number().int().min(60).max(3600).default(300),
      /** transfer | create_and_bridge | texml_fallback | disabled */
      TELNYX_OPENAI_CONNECT_MODE: z.string().optional(),
      /** Override default per-action timeouts for all Call Control POST actions (ms). */
      TELNYX_CALL_CONTROL_TIMEOUT_MS: optionalPositiveIntEnv,
      TELNYX_SMS_TIMEOUT_MS: optionalPositiveIntEnv,
      TELNYX_PROVISIONING_TIMEOUT_MS: optionalPositiveIntEnv,
      /** POST /v2/calls (outbound Calls API), not Call Control actions. */
      TELNYX_OUTBOUND_CALL_TIMEOUT_MS: optionalPositiveIntEnv,

      /** Private Cloudflare R2 bucket used for durable Telnyx call recording playback. */
      R2_CALL_RECORDINGS_ACCOUNT_ID: optionalNonEmptyStringEnv,
      R2_CALL_RECORDINGS_ACCESS_KEY_ID: optionalNonEmptyStringEnv,
      R2_CALL_RECORDINGS_SECRET_ACCESS_KEY: optionalNonEmptyStringEnv,
      R2_CALL_RECORDINGS_BUCKET: optionalNonEmptyStringEnv,
      /**
       * Optional ISO-8601 instant for emergency grandfather only (prefer SQL backfill:
       * scripts/backfill-forwarding-verification-legacy-live.sql).
       * Shops with live_calls_enabled, null forwarding_setup_verified_at, non-empty telnyx_number,
       * and go_live_at strictly before this instant are treated as forwarding-verified for live-call gates.
       */
      RB_FORWARDING_VERIFICATION_GRANDFATHER_GO_LIVE_BEFORE: z.preprocess(
        (v) => (v === undefined || v === null || String(v).trim() === '' ? undefined : String(v).trim()),
        z.string().min(4).optional(),
      ),

      /**
       * E.164 caller ID for outbound **test** calls (`POST /user/test-calls/call-me`).
       * Prefer this over TELNYX_OUTBOUND_CALLER_ID when both are set.
       */
      RINGBOOKER_OUTBOUND_CALLER_ID: z.preprocess(
        (v) => (v === undefined || v === null || String(v).trim() === '' ? undefined : String(v).trim()),
        z.string().min(4).optional(),
      ),
      /** Alias for RINGBOOKER_OUTBOUND_CALLER_ID (call-me trial outbound `from`). */
      TELNYX_OUTBOUND_CALLER_ID: z.preprocess(
        (v) => (v === undefined || v === null || String(v).trim() === '' ? undefined : String(v).trim()),
        z.string().min(4).optional(),
      ),

      GOOGLE_AI_API_KEY: z.string().min(1),
      GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),

      SQUARE_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
      SQUARE_API_VERSION: z.string().min(1).default('2026-01-22'),
      SQUARE_APPLICATION_ID: z.string().min(1).optional(),
      SQUARE_APPLICATION_SECRET: z.string().min(1).optional(),
      ACUITY_CLIENT_ID: z.string().min(1).optional(),
      ACUITY_CLIENT_SECRET: z.string().min(1).optional(),
      ACUITY_REDIRECT_URI: z.string().url().optional(),
      VAGARO_REGION: z.string().min(1).default('us'),

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
          if (s === undefined || s === null || String(s).trim() === '') return false;
          const t = String(s).trim().toLowerCase();
          return t === 'true' || t === '1' || t === 'yes' || t === 'on';
        }),
      /**
       * After sideband WebSocket connects, wait this many ms before sending the first `response.create`.
       * Lower = faster first greeting; 0 is allowed. Telnyx→OpenAI bridge latency dominates perceived pickup time.
       */
      OPENAI_SIP_SIDEBAND_GREETING_DELAY_MS: z.coerce.number().int().min(0).max(5000).optional(),
      /** JSON array: `[{ "did": "+1…", "vertical": "nail-salon", "defaultShopName": "…" }]` */
      OPENAI_SIP_DEMO_DID_MAP_JSON: z.string().optional(),
      /** Inbound E.164 for vertical-specific SIP demo (merged into demo DID map; JSON overrides on duplicate DID). */
      DEMO_PHONE_NAIL_SALON: z.preprocess(
        (v) => (v === undefined || v === null || String(v).trim() === '' ? undefined : String(v).trim()),
        z.string().min(1).optional(),
      ),
      DEMO_PHONE_HAIR_SALON: z.preprocess(
        (v) => (v === undefined || v === null || String(v).trim() === '' ? undefined : String(v).trim()),
        z.string().min(1).optional(),
      ),
      DEMO_PHONE_DAY_SPA: z.preprocess(
        (v) => (v === undefined || v === null || String(v).trim() === '' ? undefined : String(v).trim()),
        z.string().min(1).optional(),
      ),
      DEMO_PHONE_MED_SPA: z.preprocess(
        (v) => (v === undefined || v === null || String(v).trim() === '' ? undefined : String(v).trim()),
        z.string().min(1).optional(),
      ),
      DEMO_PHONE_BEAUTY_CLINIC: z.preprocess(
        (v) => (v === undefined || v === null || String(v).trim() === '' ? undefined : String(v).trim()),
        z.string().min(1).optional(),
      ),
      /** When a tool maps an unknown called number to a vertical (default nail-salon). */
      DEMO_PHONE_FALLBACK_VERTICAL: z.enum(['nail-salon', 'hair-salon', 'day-spa', 'med-spa', 'beauty-clinic']).optional(),
      OPENAI_REALTIME_PROJECT_ID: z.string().min(1).optional(),
      /** Telnyx TeXML: full OpenAI SIP URI for Dial/Sip (see /telnyx/texml/inbound). */
      OPENAI_SIP_URI: z.string().min(1).optional(),
      /** Optional: force one Realtime voice for all SIP calls. If unset, voice follows marketing vertical. */
      OPENAI_REALTIME_SIP_VOICE: z.string().min(1).optional(),
      /** Preferred alias for OpenAI Realtime model on SIP accept; falls back to AGENT_VOICE_MODEL. */
      OPENAI_REALTIME_MODEL: z.string().min(1).optional(),
      /** openai_sip_direct | livekit_media — drives SIP tool surface (see voice-transport.ts). */
      VOICE_TRANSPORT: z.string().optional(),
      /** telnyx_call_control | livekit_sip | none */
      HANDOFF_TRANSPORT: z.string().optional(),
      /** texml_to_openai_sip | call_control_to_openai_sip */
      TELNYX_INBOUND_ROUTING_MODE: z.string().optional(),
      /** Optional route-specific override for real shop numbers. */
      TELNYX_SHOP_INBOUND_ROUTING_MODE: z.string().optional(),
      /** Optional route-specific override for configured demo vertical numbers. */
      TELNYX_DEMO_INBOUND_ROUTING_MODE: z.string().optional(),

      SUPABASE_URL: z.string().url(),
      SUPABASE_SERVICE_KEY: z.string().min(1),

      PADDLE_API_KEY: z.string().min(1),
      PADDLE_CLIENT_TOKEN: optionalNonEmptyStringEnv,
      PADDLE_WEBHOOK_SECRET: z.string().min(1),
      PADDLE_WEBHOOK_MAX_SKEW_SECONDS: z.coerce.number().int().positive().default(300),
      PADDLE_ENV: z.enum(['sandbox', 'production']).optional(),
      PADDLE_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
      PADDLE_PRICE_STARTER_MONTHLY: z.string().min(1),
      PADDLE_PRICE_STARTER_ANNUAL: z.string().min(1),
      PADDLE_PRICE_PROFESSIONAL_MONTHLY: z.string().min(1),
      PADDLE_PRICE_PROFESSIONAL_ANNUAL: z.string().min(1),
      PADDLE_PRICE_STARTER: optionalNonEmptyStringEnv,
      PADDLE_PRICE_PROFESSIONAL: optionalNonEmptyStringEnv,
      PADDLE_PRICE_ENTERPRISE: optionalNonEmptyStringEnv,
      /**
       * Must be true only after Paddle dashboard prices are verified to collect
       * payment method now and not charge until the configured 14-day trial ends.
       */
      PADDLE_TRIAL_CONFIG_VERIFIED: z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),

      EMAIL_PROVIDER: z.enum(['noop', 'resend']).default('noop'),
      EMAIL_FROM_ADDRESS: z.string().min(1).default('RingBooker <notifications@send.ringbooker.com>'),
      EMAIL_FOUNDER_FROM: z.string().min(1).default('Luis Pham from RingBooker <luis@send.ringbooker.com>'),
      EMAIL_REPLY_TO: z.string().email().default('hello@ringbooker.com'),
      CONTACT_SALES_EMAIL: z.string().email().default('hello@ringbooker.com'),
      EMAIL_SUPPORT_ADDRESS: z.string().email().default('support@ringbooker.com'),
      RESEND_API_KEY: z.string().min(1).optional(),

      APP_ENCRYPTION_KEY: z.string().min(32),
      APP_SIGNING_SECRET: z.string().min(32),

      // Outbound integration with sales.ringbooker.com (demo tracking + lifecycle).
      // Base, e.g. https://sales.ringbooker.com; secret == sales RINGBOOKER_WEBHOOK_SECRET.
      SALES_WEBHOOK_BASE_URL: z.string().url().optional(),
      SALES_WEBHOOK_SECRET: z.string().min(1).optional(),

      DEFAULT_SHOP_TIMEZONE: z.string().default('America/Los_Angeles'),
      CALENDAR_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
      BOOKING_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
      SMS_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
      TRANSFER_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
      REDIS_URL: z.string().url().optional(),
      TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
      PUBLIC_DEMO_SHOP_ID: z.string().min(1).default('demo-shop'),
      /** Direct OpenAI browser demo (`POST /public/demo/realtime-session`) — abuse / cost caps. */
      PUBLIC_DEMO_REALTIME_BURST_LIMIT: z.coerce.number().int().positive().default(2),
      PUBLIC_DEMO_REALTIME_BURST_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
      PUBLIC_DEMO_REALTIME_IP_LIMIT: z.coerce.number().int().positive().default(5),
      PUBLIC_DEMO_REALTIME_IP_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
      PUBLIC_DEMO_REALTIME_SESSION_LIMIT: z.coerce.number().int().positive().default(3),
      PUBLIC_DEMO_REALTIME_SESSION_WINDOW_SECONDS: z.coerce.number().int().positive().default(1800),
      PUBLIC_DEMO_REALTIME_GLOBAL_LIMIT: z.coerce.number().int().positive().default(100),
      PUBLIC_DEMO_REALTIME_GLOBAL_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
      PUBLIC_DEMO_REALTIME_MAX_DURATION_SECONDS: z.coerce.number().int().positive().default(300),
      PUBLIC_DEMO_REALTIME_CONCURRENT_PER_IP: z.coerce.number().int().positive().default(1),
      DEMO_WEB_CALL_MODE: z.enum(['direct_openai', 'livekit']).default('livekit'),
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
export function getEnv() {
  if (!cachedEnv) {
    cachedEnv = createValidatedEnv();
    validateVoiceArchitectureAtStartup();
  }
  return cachedEnv;
}

/** Clears parsed env cache after `process.env` mutations (used in tests). */
export function resetEnvCacheForTests() {
  cachedEnv = null;
}
