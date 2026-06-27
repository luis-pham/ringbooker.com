import { randomUUID } from 'node:crypto';

import type { Context, Hono } from 'hono';
import { z } from 'zod';

import { buildDialCode, findCarrier, getForwardingCode, type ForwardingType } from '@/lib/call-forwarding/carrier-data';
import { getEnv } from '@/src/backend/config/env';
import { isCommercialGoLiveApprovalRequired } from '@/src/backend/domain/commercial-approval';
import { canProceedToGoLive, evaluateKnowledgeGate } from '@/src/backend/domain/go-live-gate';
import { isShopSetupWizardComplete } from '@/src/backend/domain/shop-onboarding';
import type { Shop } from '@/src/backend/domain/types';
import { logger } from '@/src/backend/observability/logger';
import type {
  AuthUsersRepository,
  BillingSubscriptionsRepository,
  ForwardingTestSessionsRepository,
  JobsRepository,
  ShopAccessStatesRepository,
  ShopsRepository,
  TestCallAttemptsRepository,
} from '@/src/backend/ports/repositories';
import { securityAudit } from '@/src/backend/security/audit-log';
import { getShopBillingAccess, type BillingBlockReason } from '@/src/backend/services/billing/access';
import { resolveGoLiveDashboardPrimaryCta } from '@/src/backend/services/billing/go-live-dashboard';
import { normalizeInboundE164 } from '@/src/backend/services/calls/shop-resolver';
import { detectCarrierFromTelnyx } from '@/src/backend/services/go-live/detect-carrier';
import { startOrReuseForwardingTestSession } from '@/src/backend/services/go-live/start-forwarding-test-session';
import type { PhoneProvisioningService } from '@/src/backend/services/phone-provisioning/types';
import { provisionShopNumber } from '@/src/backend/services/phone-provisioning/provision-shop-number';
import type { TelephonyService } from '@/src/backend/services/telephony/types';
import {
  billingStatusForGoLive,
  buildGoLivePaymentRequiredMessage,
  confirmForwardingSetupSchema,
  enforceRateLimit,
  enforceRateLimitWithIdentity,
  enforceSameOriginForCookieMutation,
  forwardingCodeQuerySchema,
  forwardingStatusForGoLive,
  getClientIp,
  markForwardingConfiguredSchema,
  normalizeForwardingNumberForCode,
  parseShopAddressComponents,
  provisionForwardingNumberSchema,
  provisionStatusForGoLive,
  RATE_LIMIT_POLICIES,
  requireSession,
  testCallForwardingSchema,
} from '../app-shared';

type UserGoLiveDeps = {
  shopsRepository?: ShopsRepository;
  authUsersRepository?: AuthUsersRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  shopAccessStatesRepository?: ShopAccessStatesRepository;
  testCallAttemptsRepository?: TestCallAttemptsRepository;
  forwardingTestSessionsRepository?: ForwardingTestSessionsRepository;
  jobsRepository?: JobsRepository;
  phoneProvisioningService?: PhoneProvisioningService;
  telephonyService?: TelephonyService;
};

export function registerUserGoLiveRoutes(
  app: Hono,
  path: (route: string) => string,
  deps: UserGoLiveDeps,
) {
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
  const provisionForwardingNumberHandler = async (c: Context) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
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

    const existingForwarding = shop.telnyx_number?.trim();
    if (existingForwarding) {
      return c.json({
        ok: true,
        forwardingNumber: existingForwarding,
        status: 'existing',
        nextStep: 'show_forwarding_instructions',
      });
    }

    const provisionLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.user_provision_forwarding_number,
      `shop:${shop.id}`,
    );
    if (provisionLimited) return provisionLimited;

    const subscription = deps.billingSubscriptionsRepository
      ? await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id)
      : null;
    const subscriptionId = subscription?.id ?? null;

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

    // Extract address components for US area-code selection.
    // shop.address is a free-form string; we parse it best-effort.
    const { city: shopCity, state: shopState, zip: shopZip } = parseShopAddressComponents(shop.address ?? '');

    const flowRequestId = randomUUID();
    const provisionResult = await provisionShopNumber({
      shopId: shop.id,
      city: shopCity,
      state: shopState,
      zip: shopZip,
      country: (shop.forwarding_country ?? 'us').toUpperCase(),
      requestIdPrefix: flowRequestId,
      service: deps.phoneProvisioningService,
    }).catch((err: unknown) => ({
      ok: false as const,
      code: 'all_candidates_failed' as const,
      message: err instanceof Error ? err.message : 'unknown',
    }));

    if (!provisionResult.ok) {
      const isNoNumbers = provisionResult.code === 'no_candidates';
      await deps.shopsRepository.updateUserSettings(shop.id, {
        forwarding_number_status: 'failed',
        forwarding_number_provisioning_started_at: null,
        forwarding_number_provisioned_at: null,
        forwarding_number_last_error: provisionResult.message.slice(0, 500),
      });
      securityAudit({
        action: 'forwarding_number_failed',
        actorType: 'user',
        actorId: sessionResult.email,
        ip,
        path: c.req.path,
        details: { shopId: shop.id, phase: isNoNumbers ? 'search' : 'provision', message: provisionResult.message },
      });
      await enqueueLifecycleEmail({
        shopId: shop.id,
        kind: 'forwarding_number_failed_user',
        subscriptionId,
        idempotencySuffix: `forwarding_number_failed_user:${provisionResult.code}`,
      });
      await enqueueLifecycleEmail({
        shopId: shop.id,
        kind: 'forwarding_number_failed_internal',
        subscriptionId,
        title: isNoNumbers ? 'No Telnyx forwarding numbers available' : 'Telnyx forwarding number provisioning failed',
        summary: provisionResult.message,
        fields: { shop_id: shop.id, code: provisionResult.code },
        idempotencySuffix: `forwarding_number_failed_internal:${provisionResult.code}:${Date.now()}`,
      });
      return c.json({ ok: false, error: `forwarding_number_${provisionResult.code}` }, isNoNumbers ? 503 : 502);
    }

    const order = provisionResult;
    let saved: Shop | null = null;
    try {
      saved = await deps.shopsRepository.updateUserSettings(shop.id, {
        telnyx_number: order.phoneNumber,
        forwarding_number_status: 'provisioned',
        forwarding_number_provisioning_started_at: null,
        forwarding_number_provisioned_at: new Date().toISOString(),
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
        forwarding_number_provisioned_at: null,
        forwarding_number_provider_order_id: order.orderId ?? order.providerNumberId ?? null,
        forwarding_number_last_error: persistError instanceof Error ? persistError.message.slice(0, 500) : 'shop_persist_failed',
      }).catch(() => undefined);
      await enqueueLifecycleEmail({
        shopId: shop.id,
        kind: 'forwarding_number_failed_user',
        subscriptionId,
        idempotencySuffix: 'forwarding_number_failed_user:persist',
      });
      await enqueueLifecycleEmail({
        shopId: shop.id,
        kind: 'forwarding_number_failed_internal',
        subscriptionId,
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
        areaCode: order.areaCode ?? null,
        strategy: order.strategy,
      },
    });
    await deps.shopAccessStatesRepository.upsert({
      shopId: shop.id,
      forwardingClaimedAt: null,
      forwardingVerifiedAt: null,
      forwardingVerifiedSource: null,
    });
    await enqueueLifecycleEmail({
      shopId: shop.id,
      kind: 'forwarding_number_ready',
      subscriptionId,
      forwardingNumber: order.phoneNumber,
    });
    return c.json({
      ok: true,
      forwardingNumber: order.phoneNumber,
      status: 'provisioned',
      nextStep: 'show_forwarding_instructions',
    });
  };
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
      if (result.testCallsRemaining !== undefined) body.test_calls_remaining = result.testCallsRemaining;
      if (result.error === 'payment_method_required') {
        body.message = buildGoLivePaymentRequiredMessage();
      }
      return c.json(body, result.httpStatus as 400);
    }

    securityAudit({
      action: 'forwarding_inbound_test_started',
      actorType: 'user',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: { shopId: shop.id, sessionId: result.sessionId },
    });

    return c.json({
      ok: true,
      mode: 'inbound_required',
      status: result.status,
      expiresAt: result.expiresAt,
      instruction: result.instruction,
      sessionId: result.sessionId,
      test_calls_remaining: result.testCallsRemaining,
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
    const sessionAuthUser = deps.authUsersRepository
      ? await deps.authUsersRepository.findByEmail(sessionResult.email).catch(() => null)
      : null;
    const sessionEmailVerified = Boolean(sessionAuthUser?.emailVerifiedAt ?? sessionResult.emailVerified);

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
    const forwardingClaimedAt = accessState?.forwardingClaimedAt ?? null;
    const forwardingVerifiedAt = accessState?.forwardingVerifiedAt ?? accessState?.forwardingSetupVerifiedAt ?? null;
    const forwardingVerifiedSource = accessState?.forwardingVerifiedSource ?? null;
    const forwardingClaimed = Boolean(forwardingClaimedAt);
    const forwardingVerified = Boolean(forwardingVerifiedAt);

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

    const emailVerified = sessionEmailVerified;
    const blockReason = !knowledgeGatePassed && access.canGoLive
      ? 'knowledge_incomplete'
      : !emailVerified && access.canGoLive
        ? 'email_not_verified'
        : access.blockReason;
    const canGoLive = access.canGoLive && knowledgeGatePassed && emailVerified;

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
      forwardingSetupVerified: forwardingVerified,
      forwardingSetupVerifiedAt: forwardingVerifiedAt,
      forwardingSetupVerifiedVia: forwardingVerifiedSource,
      forwarding: {
        configured: forwardingClaimed,
        verified: forwardingVerified,
        verified_at: forwardingVerifiedAt,
        verified_source: forwardingVerifiedSource,
      },
      forwardingTestStatus,
      forwardingTestExpiresAt,
      liveCallsEnabled: access.liveCallsEnabled,
      canGoLive,
      emailVerified,
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
        emailVerification: {
          verified: emailVerified,
        },
        provision: {
          status: provisionStatusForGoLive(shop),
          ringbookerNumber: shop.telnyx_number?.trim() || null,
          telnyx_number_id: shop.forwarding_number_provider_order_id ?? null,
        },
        forwarding: {
          status: forwardingStatusForGoLive({ shop, forwardingClaimed, forwardingVerified }),
          country: shop.forwarding_country ?? 'us',
          carrier: shop.forwarding_carrier?.trim() || null,
          forwardingType: shop.forwarding_type ?? 'no_answer',
          dialCode: null,
          verifiedAt: forwardingVerifiedAt,
          configured: forwardingClaimed,
          verified: forwardingVerified,
          verifiedSource: forwardingVerifiedSource,
        },
        liveAnswering: {
          enabled: access.liveCallsEnabled,
          enabledAt: accessState?.goLiveAt ?? null,
        },
      },
    });
  });

  app.get(path('/user/go-live/detected-carrier'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_go_live_detected_carrier');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopAccessStatesRepository) return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);

    let shop;
    try {
      shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    } catch (error) {
      logger.warn(
        { err: error, shopId: sessionResult.shopId ?? null },
        'go_live_detected_carrier_shop_lookup_failed',
      );
      return c.json({ ok: true, detected: false, carrier: null, line_type: null, raw_carrier_name: null });
    }
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const cachedCarrier = shop.detected_carrier?.trim() || null;
    if (cachedCarrier) {
      return c.json({
        ok: true,
        detected: true,
        carrier: cachedCarrier,
        line_type: shop.detected_line_type?.trim() || null,
        raw_carrier_name: null,
      });
    }

    const detected = await detectCarrierFromTelnyx({
      apiKey: getEnv().TELNYX_API_KEY,
      phoneNumber: shop.phone_number,
      shopId: shop.id,
    });

    if (detected.detected && detected.carrier) {
      try {
        await deps.shopsRepository.updateUserSettings(shop.id, {
          detected_carrier: detected.carrier,
          detected_line_type: detected.line_type,
          carrier_detected_at: new Date().toISOString(),
        });
      } catch (error) {
        logger.warn(
          { err: error, shopId: shop.id },
          'go_live_detected_carrier_cache_write_failed',
        );
      }
    }

    return c.json({ ok: true, ...detected });
  });

  app.get(path('/user/go-live/forwarding-code'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_go_live_forwarding_code');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopAccessStatesRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

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
    if (!deps.shopsRepository || !deps.shopAccessStatesRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

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
    await deps.shopAccessStatesRepository.upsert({
      shopId: shop.id,
      forwardingClaimedAt: new Date().toISOString(),
    });

    return c.json({
      ok: true,
      forwardingStatus: 'configured',
      status: 'claimed',
      message: 'Call your business number to complete verification',
    });
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
      if (result.testCallsRemaining !== undefined) resBody.test_calls_remaining = result.testCallsRemaining;
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
      test_calls_remaining: result.testCallsRemaining,
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
      forwardingClaimedAt: new Date().toISOString(),
    });
    securityAudit({
      action: 'forwarding_setup_claimed',
      actorType: 'user',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: { shopId: shop.id },
    });

    return c.json({
      ok: true,
      status: 'claimed',
      forwardingSetupVerified: false,
      message: 'Call your business number to complete verification',
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
  app.post(path('/user/go-live/provision-number'), provisionForwardingNumberHandler);
  app.post(path('/user/phone-numbers/provision-forwarding-number'), provisionForwardingNumberHandler);

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
    const sessionAuthUser = deps.authUsersRepository
      ? await deps.authUsersRepository.findByEmail(sessionResult.email).catch(() => null)
      : null;
    const sessionEmailVerified = Boolean(sessionAuthUser?.emailVerifiedAt ?? sessionResult.emailVerified);
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
    const accessState = await deps.shopAccessStatesRepository.findByShopId(shop.id);
    if (!(accessState?.forwardingVerifiedAt ?? accessState?.forwardingSetupVerifiedAt)?.trim()) {
      return c.json(
        {
          ok: false,
          error: 'forwarding_not_verified',
          message:
            'Call forwarding must be verified before going live. Call your business number from another phone to verify.',
        },
        403,
      );
    }
    if (!sessionEmailVerified) {
      return c.json(
        {
          ok: false,
          error: 'email_not_verified',
          message: 'Confirm your email address before enabling live answering.',
        },
        403,
      );
    }
    if (!access.canGoLive) {
      const status = access.blockReason === 'payment_method_required' ? 402 : access.blockReason === 'commercial_approval_required' ? 403 : 409;
      const messageByReason: Partial<Record<BillingBlockReason, string>> = {
        payment_method_required: buildGoLivePaymentRequiredMessage(),
        commercial_approval_required:
          'Your Custom setup must be approved by the RingBooker team before live answering can be enabled.',
        forwarding_number_required:
          'Provision your RingBooker forwarding number before enabling live answering.',
        forwarding_verification_required:
          'Call your business number from another phone to verify forwarding before enabling live answering.',
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
}
