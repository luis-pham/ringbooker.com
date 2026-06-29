const REQUIRED_TEST_ENV: Record<string, string> = {
  APP_BASE_URL: 'http://localhost:3000',
  PORT: '3000',
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  BACKEND_REPOSITORY_MODE: 'memory',
  BACKEND_COMM_PROVIDER: 'noop',
  BILLING_CHECKOUT_ENABLED: 'true',
  BILLING_MANAGE_ENABLED: 'true',
  SERVICE_CATALOG_ENABLED: 'true',
  WEBSITE_IMPORT_ENABLED: 'true',
  WEBSITE_IMPORT_LLM_ENABLED: 'false',
  WEBSITE_IMPORT_LLM_MODEL: 'gpt-4.1-mini',
  WEBSITE_IMPORT_LLM_MAX_TOKENS: '1800',
  WEBSITE_IMPORT_SERVICE_RETRY_ENABLED: 'false',
  WEBSITE_IMPORT_SERVICE_RETRY_MODEL: 'gpt-4.1-mini',
  WEBSITE_IMPORT_DIFFICULT_FALLBACK_MODEL: 'gpt-5.4-mini',
  WEBSITE_IMPORT_SERVICE_RETRY_MAX_PAGES: '12',
  WEBSITE_IMPORT_SERVICE_RETRY_TIMEOUT_MS: '20000',
  WEBSITE_IMPORT_SERVICE_RETRY_MIN_SERVICE_COUNT: '15',
  WEBSITE_IMPORT_POLICY_RETRY_ENABLED: 'false',
  WEBSITE_IMPORT_POLICY_RETRY_MODEL: '',
  WEBSITE_IMPORT_POLICY_RETRY_FALLBACK_MODEL: 'gpt-5.4-mini',
  WEBSITE_IMPORT_POLICY_RETRY_MAX_PAGES: '8',
  WEBSITE_IMPORT_POLICY_RETRY_TIMEOUT_MS: '20000',
  WEBSITE_IMPORT_POLICY_RETRY_MIN_POLICY_COUNT: '3',
  WEBSITE_IMPORT_DEBUG_LOG: 'false',
  WEBSITE_IMPORT_DEBUG_SAVE_TEXT: 'false',
  WEBSITE_IMPORT_MAX_BYTES: '1500000',
  AGENT_RUNTIME_MODE: 'mock',
  AGENT_GEMINI_MODEL: 'gemini-2.5-flash-preview-native-audio-dialog',
  AGENT_LIVEKIT_AGENT_COMMAND: 'true',
  AGENT_WORKER_MAX_SESSION_MS: '10000',
  LIVEKIT_URL: 'wss://example.livekit.cloud',
  LIVEKIT_API_KEY: 'lk_test_key',
  LIVEKIT_API_SECRET: 'lk_test_secret',
  TELNYX_API_KEY: 'telnyx_test_key',
  TELNYX_APP_ID: 'telnyx_test_app',
  TELNYX_MESSAGING_PROFILE: 'telnyx_test_profile',
  TELNYX_WEBHOOK_PUBLIC_KEY: 'test-public-key',
  GOOGLE_AI_API_KEY: 'google_ai_test',
  GOOGLE_PLACES_API_KEY: 'google_places_test',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_KEY: 'supabase_service_test',
  PADDLE_API_KEY: 'paddle_test_key',
  PADDLE_CLIENT_TOKEN: 'paddle_client_test_token',
  PADDLE_WEBHOOK_SECRET: 'paddle_test_secret',
  PADDLE_ENV: 'sandbox',
  PADDLE_ENVIRONMENT: 'sandbox',
  PADDLE_PRICE_STARTER_MONTHLY: 'pri_test_starter_monthly',
  PADDLE_PRICE_STARTER_ANNUAL: 'pri_test_starter_annual',
  PADDLE_PRICE_PROFESSIONAL_MONTHLY: 'pri_test_professional_monthly',
  PADDLE_PRICE_PROFESSIONAL_ANNUAL: 'pri_test_professional_annual',
  PADDLE_PRICE_STARTER: 'pri_test_starter_monthly',
  PADDLE_PRICE_PROFESSIONAL: 'pri_test_professional_monthly',
  PADDLE_PRICE_ENTERPRISE: 'pri_test_enterprise',
  PADDLE_TRIAL_CONFIG_VERIFIED: 'true',
  APP_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
  APP_SIGNING_SECRET: 'abcdef0123456789abcdef0123456789',
  DEFAULT_SHOP_TIMEZONE: 'America/Los_Angeles',
  CALENDAR_TIMEOUT_MS: '2000',
  BOOKING_TIMEOUT_MS: '3000',
  SMS_TIMEOUT_MS: '3000',
  TRANSFER_TIMEOUT_MS: '3000',
  JOB_POLL_INTERVAL_MS: '500',
  JOB_LEASE_SECONDS: '30',
  /** Required for POST /user/test-calls/call-me in integration tests (shared outbound CID). */
  RINGBOOKER_OUTBOUND_CALLER_ID: '+15555550199',
};

export function applyRequiredTestEnv(overrides?: Record<string, string>) {
  for (const [key, value] of Object.entries(REQUIRED_TEST_ENV)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      process.env[key] = value;
    }
  }
}
