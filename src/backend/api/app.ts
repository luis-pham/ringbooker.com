import { Hono } from 'hono';

import type { RealtimeAgentRuntime } from '@/src/agent/realtime/types';
import type { BlogPostsRepository, BookingsRepository, BusinessKnowledgeSuggestionsRepository, BillingNotificationsRepository, BillingCustomersRepository, BillingSubscriptionsRepository, CommercialAccountsRepository, CommercialGoLiveApprovalEventsRepository, CallbacksRepository, CallLogsRepository, JobsRepository, MissedCallsRepository, OutboundMessagesRepository, ProviderEventsRepository, ShopStaffRepository, ShopStaffServicesRepository, ShopsRepository, AuthUsersRepository, ContactRequestsRepository, DemoSessionsRepository, HandoffSessionsRepository, ShopAccessStatesRepository, ShopLocationsRepository, ShopOverageChargesRepository, ShopUsageAlertsRepository, ShopRoutingRulesRepository, ShopActiveCallSessionsRepository, TestCallAttemptsRepository, ForwardingTestSessionsRepository, VoiceCallLegsRepository, CustomersRepository, VagaroWebhookEventsRepository } from '@/src/backend/ports/repositories';
import type { WebDemoSessionsRepository } from '@/src/backend/ports/web-demo-sessions';
import type { SalesPreparedDemosRepository } from '@/src/backend/ports/sales-prepared-demos';
import type { BillingProviderAdapter } from '@/src/backend/services/billing/types';
import type { TelephonyService } from '@/src/backend/services/telephony/types';
import type { PhoneProvisioningService } from '@/src/backend/services/phone-provisioning/types';
import type { CallRecordingStorage } from '@/src/backend/services/calls/call-recording-storage';
import type { EmailService } from '@/src/backend/services/email/types';
import { logger } from '@/src/backend/observability/logger';
import { trackApiStatusForAlerts } from '@/src/backend/observability/security-alerts';
import { incrementMetric, observeDurationMs } from '@/src/backend/observability/metrics';


import { enforceRequestBodySize, requireSession } from './app-shared';

// Re-export everything from app-shared for backward compatibility with test files
// and other modules that import from '@/src/backend/api/app'.
export * from './app-shared';

import { registerHealthRoutes } from './routes/health';
import { registerAgentJobsRoutes } from './routes/agent-jobs';
import { registerSystemRoutes } from './routes/system';
import { registerPublicRoutes } from './routes/public';
import { registerDemoRoutes } from './routes/demo';
import { registerAuthRoutes } from './routes/auth';
import { registerAdminRoutes } from './routes/admin';
import { registerWebhookRoutes } from './routes/webhooks';
import { registerUserStaffRoutes } from './routes/user-staff';
import { registerUserBillingRoutes } from './routes/user-billing';
import { registerUserSettingsRoutes } from './routes/user-settings';
import { registerUserMiscRoutes } from './routes/user-misc';
import { registerUserBookingsCallsRoutes } from './routes/user-bookings-calls';
import { registerUserCalendarRoutes } from './routes/user-calendar';
import { registerUserGoLiveRoutes } from './routes/user-go-live';

export function createBackendApp(deps: {
  providerEventsRepository: ProviderEventsRepository;
  vagaroWebhookEventsRepository?: VagaroWebhookEventsRepository;
  jobsRepository?: JobsRepository;
  bookingsRepository?: BookingsRepository;
  billingCustomersRepository?: BillingCustomersRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  shopOverageChargesRepository?: ShopOverageChargesRepository;
  shopUsageAlertsRepository?: ShopUsageAlertsRepository;
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
  salesPreparedDemosRepository?: SalesPreparedDemosRepository;
  shopsRepository?: ShopsRepository;
  telephonyService?: TelephonyService;
  phoneProvisioningService?: PhoneProvisioningService;
  emailService?: EmailService;
  callLogsRepository?: CallLogsRepository;
  recordingStorage?: CallRecordingStorage;
  customersRepository?: CustomersRepository;
	  missedCallsRepository?: MissedCallsRepository;
	  outboundMessagesRepository?: OutboundMessagesRepository;
	  handoffSessionsRepository?: HandoffSessionsRepository;
  voiceCallLegsRepository?: VoiceCallLegsRepository;
  shopStaffRepository?: ShopStaffRepository;
  shopStaffServicesRepository?: ShopStaffServicesRepository;
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
    const bodySizeBlocked = enforceRequestBodySize(c);
    if (bodySizeBlocked) return bodySizeBlocked;

    c.header('X-Frame-Options', 'DENY');
    c.header('X-Content-Type-Options', 'nosniff');
    if (process.env.NODE_ENV === 'production') {
      c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
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
        "media-src 'self' https://*.r2.cloudflarestorage.com",
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

  app.use(path('/admin/*'), async (c, next) => {
    const sessionResult = await requireSession(c, 'admin', {
      authUsersRepository: deps.authUsersRepository,
    });
    if (sessionResult instanceof Response) return sessionResult;
    await next();
  });

  registerHealthRoutes(app, path, { runtimeInfo: deps.runtimeInfo });

  registerWebhookRoutes(app, path, {
    providerEventsRepository: deps.providerEventsRepository,
    vagaroWebhookEventsRepository: deps.vagaroWebhookEventsRepository,
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
    forwardingTestSessionsRepository: deps.forwardingTestSessionsRepository,
    recordingStorage: deps.recordingStorage,
    commercialAccountsRepository: deps.commercialAccountsRepository,
    shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
    handoffSessionsRepository: deps.handoffSessionsRepository,
    voiceCallLegsRepository: deps.voiceCallLegsRepository,
    testingTelnyxFetch: deps.testingTelnyxFetch,
    billingProvider: deps.billingProvider,
    emailService: deps.emailService,
    shopRoutingRulesRepository: deps.shopRoutingRulesRepository,
    shopStaffRepository: deps.shopStaffRepository,
    shopStaffServicesRepository: deps.shopStaffServicesRepository,
    bookingsRepository: deps.bookingsRepository,
    telephonyService: deps.telephonyService,
    testingOpenAiFetch: deps.testingOpenAiFetch,
  });

  registerSystemRoutes(app, path, { runtimeInfo: deps.runtimeInfo });

  registerPublicRoutes(app, path, {
    blogPostsRepository: deps.blogPostsRepository,
    contactRequestsRepository: deps.contactRequestsRepository,
    emailService: deps.emailService,
  });

  registerDemoRoutes(app, path, {
    demoSessionsRepository: deps.demoSessionsRepository,
    webDemoSessionsRepository: deps.webDemoSessionsRepository,
    salesPreparedDemosRepository: deps.salesPreparedDemosRepository,
    shopsRepository: deps.shopsRepository,
    realtimeAgentRuntime: deps.realtimeAgentRuntime,
    runtimeInfo: deps.runtimeInfo,
  });

  registerAuthRoutes(app, path, {
    phoneProvisioningService: deps.phoneProvisioningService,
    authUsersRepository: deps.authUsersRepository,
    shopsRepository: deps.shopsRepository,
    billingCustomersRepository: deps.billingCustomersRepository,
    billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
    shopAccessStatesRepository: deps.shopAccessStatesRepository,
    salesPreparedDemosRepository: deps.salesPreparedDemosRepository,
    emailService: deps.emailService,
  });

  registerUserMiscRoutes(app, path, {
    shopsRepository: deps.shopsRepository,
    bookingsRepository: deps.bookingsRepository,
    callLogsRepository: deps.callLogsRepository,
    authUsersRepository: deps.authUsersRepository,
    commercialAccountsRepository: deps.commercialAccountsRepository,
    shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
    billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
    shopAccessStatesRepository: deps.shopAccessStatesRepository,
    testCallAttemptsRepository: deps.testCallAttemptsRepository,
    businessKnowledgeSuggestionsRepository: deps.businessKnowledgeSuggestionsRepository,
  });

  registerUserGoLiveRoutes(app, path, {
    shopsRepository: deps.shopsRepository,
    authUsersRepository: deps.authUsersRepository,
    billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
    shopAccessStatesRepository: deps.shopAccessStatesRepository,
    testCallAttemptsRepository: deps.testCallAttemptsRepository,
    forwardingTestSessionsRepository: deps.forwardingTestSessionsRepository,
    jobsRepository: deps.jobsRepository,
    phoneProvisioningService: deps.phoneProvisioningService,
    telephonyService: deps.telephonyService,
  });


  registerUserBookingsCallsRoutes(app, path, {
    shopsRepository: deps.shopsRepository,
    bookingsRepository: deps.bookingsRepository,
    callLogsRepository: deps.callLogsRepository,
    shopAccessStatesRepository: deps.shopAccessStatesRepository,
    outboundMessagesRepository: deps.outboundMessagesRepository,
    jobsRepository: deps.jobsRepository,
    commercialAccountsRepository: deps.commercialAccountsRepository,
    shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
    billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
    recordingStorage: deps.recordingStorage,
  });

  registerUserSettingsRoutes(app, path, {
    shopsRepository: deps.shopsRepository,
    shopAccessStatesRepository: deps.shopAccessStatesRepository,
    billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
    testCallAttemptsRepository: deps.testCallAttemptsRepository,
    authUsersRepository: deps.authUsersRepository,
  });

  registerUserStaffRoutes(app, path, {
    shopsRepository: deps.shopsRepository,
    shopStaffRepository: deps.shopStaffRepository,
    shopStaffServicesRepository: deps.shopStaffServicesRepository,
  });

  registerUserCalendarRoutes(app, path, {
    shopsRepository: deps.shopsRepository,
    billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
    shopStaffRepository: deps.shopStaffRepository,
    shopStaffServicesRepository: deps.shopStaffServicesRepository,
  });

  registerUserBillingRoutes(app, path, {
    shopsRepository: deps.shopsRepository,
    billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
    billingCustomersRepository: deps.billingCustomersRepository,
    shopAccessStatesRepository: deps.shopAccessStatesRepository,
    testCallAttemptsRepository: deps.testCallAttemptsRepository,
    commercialAccountsRepository: deps.commercialAccountsRepository,
    callLogsRepository: deps.callLogsRepository,
    shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
    shopOverageChargesRepository: deps.shopOverageChargesRepository,
    billingProvider: deps.billingProvider,
  });

  /**
   * Provisions a Telnyx DID into `shops.telnyx_number` after explicit go-live intent.
   * Does not modify `shop.phone_number` (business line). Idempotent when `telnyx_number` already set.
   */


  registerAdminRoutes(app, path, {
    jobsRepository: deps.jobsRepository,
    shopsRepository: deps.shopsRepository,
    callLogsRepository: deps.callLogsRepository,
    bookingsRepository: deps.bookingsRepository,
    blogPostsRepository: deps.blogPostsRepository,
    contactRequestsRepository: deps.contactRequestsRepository,
    demoSessionsRepository: deps.demoSessionsRepository,
    webDemoSessionsRepository: deps.webDemoSessionsRepository,
    salesPreparedDemosRepository: deps.salesPreparedDemosRepository,
    authUsersRepository: deps.authUsersRepository,
    billingCustomersRepository: deps.billingCustomersRepository,
    billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
    shopOverageChargesRepository: deps.shopOverageChargesRepository,
    shopUsageAlertsRepository: deps.shopUsageAlertsRepository,
    billingNotificationsRepository: deps.billingNotificationsRepository,
    shopAccessStatesRepository: deps.shopAccessStatesRepository,
    commercialGoLiveApprovalEventsRepository: deps.commercialGoLiveApprovalEventsRepository,
    shopLocationsRepository: deps.shopLocationsRepository,
    shopRoutingRulesRepository: deps.shopRoutingRulesRepository,
    commercialAccountsRepository: deps.commercialAccountsRepository,
    shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
    testCallAttemptsRepository: deps.testCallAttemptsRepository,
    forwardingTestSessionsRepository: deps.forwardingTestSessionsRepository,
    callbacksRepository: deps.callbacksRepository,
    customersRepository: deps.customersRepository,
    outboundMessagesRepository: deps.outboundMessagesRepository,
    handoffSessionsRepository: deps.handoffSessionsRepository,
    voiceCallLegsRepository: deps.voiceCallLegsRepository,
    missedCallsRepository: deps.missedCallsRepository,
    shopStaffRepository: deps.shopStaffRepository,
    shopStaffServicesRepository: deps.shopStaffServicesRepository,
    emailService: deps.emailService,
    billingProvider: deps.billingProvider,
  });

  registerAgentJobsRoutes(app, path, {
    jobsRepository: deps.jobsRepository,
    bookingsRepository: deps.bookingsRepository,
    callbacksRepository: deps.callbacksRepository,
    shopsRepository: deps.shopsRepository,
    telephonyService: deps.telephonyService,
    shopRoutingRulesRepository: deps.shopRoutingRulesRepository,
    realtimeAgentRuntime: deps.realtimeAgentRuntime,
    callLogsRepository: deps.callLogsRepository,
    demoSessionsRepository: deps.demoSessionsRepository,
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
