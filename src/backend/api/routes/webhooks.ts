import type { Context, Hono } from 'hono';

import type {
  BillingSubscriptionsRepository,
  BookingsRepository,
  CallbacksRepository,
  CallLogsRepository,
  CommercialAccountsRepository,
  CustomersRepository,
  DemoSessionsRepository,
  ForwardingTestSessionsRepository,
  HandoffSessionsRepository,
  JobsRepository,
  MissedCallsRepository,
  ProviderEventsRepository,
  ShopAccessStatesRepository,
  ShopActiveCallSessionsRepository,
  ShopRoutingRulesRepository,
  ShopStaffRepository,
  ShopStaffServicesRepository,
  ShopsRepository,
  TestCallAttemptsRepository,
  VagaroWebhookEventsRepository,
  VoiceCallLegsRepository,
} from '@/src/backend/ports/repositories';
import type { BillingProviderAdapter } from '@/src/backend/services/billing/types';
import type { CallRecordingStorage } from '@/src/backend/services/calls/call-recording-storage';
import type { EmailService } from '@/src/backend/services/email/types';
import type { TelephonyService } from '@/src/backend/services/telephony/types';
import { logger } from '@/src/backend/observability/logger';
import { incrementMetric } from '@/src/backend/observability/metrics';
import { handleOpenAiRealtimeSipWebhook } from '@/src/backend/webhooks/openai-realtime-sip';
import { handlePaddleWebhook } from '@/src/backend/webhooks/paddle';
import { handleTelnyxWebhook } from '@/src/backend/webhooks/telnyx';
import { handleTelnyxCallControlWebhook } from '@/src/backend/webhooks/telnyx-call-control-webhook';
import { handleTelnyxTexmlOpenAiInbound } from '@/src/backend/webhooks/telnyx-texml-openai-inbound';
import { verifyVagaroWebhookHmac } from '@/src/backend/webhooks/vagaro';
import {
  enforceRateLimit,
  getClientIp,
  getWebhookStringField,
  RATE_LIMIT_POLICIES,
  safeWebhookHeaders,
  securityAudit,
} from '../app-shared';

type WebhookDeps = {
  providerEventsRepository: ProviderEventsRepository;
  vagaroWebhookEventsRepository?: VagaroWebhookEventsRepository;
  jobsRepository?: JobsRepository;
  callbacksRepository?: CallbacksRepository;
  shopsRepository?: ShopsRepository;
  callLogsRepository?: CallLogsRepository;
  missedCallsRepository?: MissedCallsRepository;
  demoSessionsRepository?: DemoSessionsRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  shopAccessStatesRepository?: ShopAccessStatesRepository;
  testCallAttemptsRepository?: TestCallAttemptsRepository;
  customersRepository?: CustomersRepository;
  forwardingTestSessionsRepository?: ForwardingTestSessionsRepository;
  recordingStorage?: CallRecordingStorage;
  commercialAccountsRepository?: CommercialAccountsRepository;
  shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
  handoffSessionsRepository?: HandoffSessionsRepository;
  voiceCallLegsRepository?: VoiceCallLegsRepository;
  testingTelnyxFetch?: typeof fetch;
  billingProvider?: BillingProviderAdapter;
  emailService?: EmailService;
  shopRoutingRulesRepository?: ShopRoutingRulesRepository;
  shopStaffRepository?: ShopStaffRepository;
  shopStaffServicesRepository?: ShopStaffServicesRepository;
  bookingsRepository?: BookingsRepository;
  telephonyService?: TelephonyService;
  testingOpenAiFetch?: typeof fetch;
};

export function registerWebhookRoutes(app: Hono, path: (route: string) => string, deps: WebhookDeps): void {
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
        recordingStorage: deps.recordingStorage,
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

  app.post(path('/telnyx/texml/inbound'), (c) =>
    handleTelnyxTexmlOpenAiInbound(c, {
      shopsRepository: deps.shopsRepository,
      billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
      shopAccessStatesRepository: deps.shopAccessStatesRepository,
      forwardingTestSessionsRepository: deps.forwardingTestSessionsRepository,
      callLogsRepository: deps.callLogsRepository,
      commercialAccountsRepository: deps.commercialAccountsRepository,
      shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
      demoSessionsRepository: deps.demoSessionsRepository,
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
        shopsRepository: deps.shopsRepository,
      });
    })(),
  );

  const handleShopVagaroWebhook = async (
    c: Context,
    params: { token: string | null; deprecatedPathToken: boolean },
  ) => {
    if (!deps.shopsRepository || !deps.vagaroWebhookEventsRepository) {
      return c.json({ ok: false, error: 'vagaro_webhook_dependencies_unavailable' }, 500);
    }
    const token = params.token?.trim() ?? '';
    if (!token) return c.json({ ok: false }, 401);

    const shop = await deps.shopsRepository.getShopByWebhookToken(token);
    if (!shop) return c.json({ ok: false }, 404);

    const rawBody = await c.req.text().catch(() => '');
    const signature = c.req.header('x-vagaro-signature') ?? c.req.header('X-Vagaro-Signature') ?? null;
    if (signature && !verifyVagaroWebhookHmac({ rawBody, secret: token, signature })) {
      incrementMetric('webhook_requests_total', {
        provider: 'vagaro',
        outcome: 'invalid_signature',
      });
      securityAudit({
        action: 'webhook_signature_invalid',
        actorType: 'provider',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
        provider: 'vagaro',
        details: {
          shopId: shop.id,
          reason: 'hmac_mismatch',
        },
      });
      return c.json({ ok: false }, 401);
    }
    if (!signature) {
      // TODO: make X-Vagaro-Signature mandatory when Vagaro supports signed webhook payloads.
      logger.warn({ shopId: shop.id }, 'vagaro_webhook_signature_missing_header_token_auth_used');
    }
    if (params.deprecatedPathToken) {
      logger.warn({ shopId: shop.id }, 'vagaro_webhook_path_token_deprecated');
    }

    let body: unknown = null;
    try {
      body = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      return c.json({ ok: false }, 400);
    }
    const eventType = getWebhookStringField(body, 'type') ?? 'unknown';
    const action = getWebhookStringField(body, 'action');
    const payload =
      body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'payload')
        ? (body as Record<string, unknown>).payload
        : body;

    await deps.vagaroWebhookEventsRepository.save({
      shop_id: shop.id,
      event_type: eventType,
      action,
      payload: payload ?? {},
      raw_headers: safeWebhookHeaders(c.req.raw.headers),
      received_at: new Date().toISOString(),
      processed_at: null,
      processing_error: null,
    });

    logger.info({ shopId: shop.id, eventType, action }, 'vagaro_webhook_received');
    return c.json({ ok: true }, 200);
  };

  app.post(path('/webhooks/vagaro'), (c) =>
    (async () => {
      const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.webhook_paddle, 'webhook_vagaro');
      if (limited) return limited;
      return handleShopVagaroWebhook(c, {
        token: c.req.header('x-ringbooker-shop-token') ?? c.req.header('X-RingBooker-Shop-Token') ?? null,
        deprecatedPathToken: false,
      });
    })(),
  );

  app.post(path('/webhooks/vagaro/:token'), (c) =>
    (async () => {
      const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.webhook_paddle, 'webhook_vagaro_token');
      if (limited) return limited;
      return handleShopVagaroWebhook(c, {
        token: c.req.param('token') ?? null,
        deprecatedPathToken: true,
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
        shopStaffRepository: deps.shopStaffRepository,
        shopStaffServicesRepository: deps.shopStaffServicesRepository,
        jobsRepository: deps.jobsRepository,
        bookingsRepository: deps.bookingsRepository,
        callbacksRepository: deps.callbacksRepository,
        telephonyService: deps.telephonyService,
        callLogsRepository: deps.callLogsRepository,
        voiceCallLegsRepository: deps.voiceCallLegsRepository,
        commercialAccountsRepository: deps.commercialAccountsRepository,
        shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
        fetchImpl: deps.testingOpenAiFetch,
      });
    })(),
  );
}
