import type { Hono } from 'hono';

import { getEnv } from '@/src/backend/config/env';
import { formatPlanPrice, getPlanCatalogEntry, isSelfServeTrialPlan } from '@/src/backend/domain/plan-catalog';
import type { BillingSubscriptionStatus } from '@/src/backend/domain/types';
import { logger } from '@/src/backend/observability/logger';
import type {
  BillingCustomersRepository,
  BillingSubscriptionsRepository,
  CallLogsRepository,
  CommercialAccountsRepository,
  ShopAccessStatesRepository,
  ShopActiveCallSessionsRepository,
  ShopOverageChargesRepository,
  ShopsRepository,
  TestCallAttemptsRepository,
} from '@/src/backend/ports/repositories';
import { getShopBillingAccess } from '@/src/backend/services/billing/access';
import { createNoCardTrialForShop } from '@/src/backend/services/billing/no-card-trial';
import type { BillingProviderAdapter } from '@/src/backend/services/billing/types';
import { getShopUsageForPeriod } from '@/src/backend/services/usage/shop-usage';
import {
  enforceRateLimit,
  enforceSameOriginForCookieMutation,
  getAppBaseUrl,
  PADDLE_CHECKOUT_PENDING_WINDOW_MS,
  RATE_LIMIT_POLICIES,
  requireSession,
  userBillingCheckoutSchema,
  userBillingManageSchema,
  userBillingUpgradeSchema,
} from '../app-shared';

type UserBillingDeps = {
  shopsRepository?: ShopsRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  billingCustomersRepository?: BillingCustomersRepository;
  shopAccessStatesRepository?: ShopAccessStatesRepository;
  testCallAttemptsRepository?: TestCallAttemptsRepository;
  commercialAccountsRepository?: CommercialAccountsRepository;
  callLogsRepository?: CallLogsRepository;
  shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
  shopOverageChargesRepository?: ShopOverageChargesRepository;
  billingProvider?: BillingProviderAdapter;
};

export function registerUserBillingRoutes(
  app: Hono,
  path: (route: string) => string,
  deps: UserBillingDeps,
) {
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
          {
            callLogsRepository: deps.callLogsRepository,
            shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
            billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
          },
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
              (upgradeMetadata as Record<string, unknown>).targetPlan === 'professional' ||
              (upgradeMetadata as Record<string, unknown>).targetPlan === 'starter'
                ? ((upgradeMetadata as Record<string, unknown>).targetPlan as 'starter' | 'professional')
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
            isSelfServeTrialPlan(shop.plan) &&
            subscription?.plan === shop.plan &&
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
            : !isSelfServeTrialPlan(shop.plan) || subscription?.plan !== shop.plan
            ? 'current_plan_not_self_serve'
            : subscription?.provider !== 'paddle'
              ? 'provider_not_supported'
              : !['active', 'trialing'].includes(subscription?.status ?? '')
                ? 'subscription_not_changeable'
                : !subscription?.providerCustomerId?.trim()
                  ? 'missing_provider_customer_id'
                  : !subscription?.providerSubscriptionId?.trim()
                    ? 'missing_provider_subscription_id'
                    : deps.billingProvider?.provider !== 'paddle' || typeof deps.billingProvider.upgradeSubscriptionPlan !== 'function'
                      ? 'billing_plan_change_unavailable'
                      : null,
        pendingPlanUpgrade: pendingPlanUpgrade?.targetPlan ? pendingPlanUpgrade : null,
        billingHistoryLabel: 'Account billing activity',
        forwardingNumber: shop.telnyx_number?.trim() ? shop.telnyx_number.trim() : null,
        usage,
      },
    });
  });

  app.get(path('/user/billing/overage-charges'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_billing_overage_charges');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopOverageChargesRepository) {
      return c.json({ ok: true, charges: [] });
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const charges = await deps.shopOverageChargesRepository.listByShopId(shop.id, { limit: 50 });

    return c.json({
      ok: true,
      charges: charges.map((charge) => ({
        id: charge.id,
        periodStart: charge.periodStart,
        periodEnd: charge.periodEnd,
        includedCallers: charge.includedCallers,
        capturedCallers: charge.capturedCallers,
        overageCallers: charge.overageCallers,
        rateCents: charge.rateCents,
        amountCents: charge.amountCents,
        status: charge.status,
        paddleTransactionId: charge.paddleTransactionId ?? null,
        createdAt: charge.createdAt,
      })),
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
          message: 'Plan changes are not enabled for this environment yet.',
        },
        503,
      );
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isSelfServeTrialPlan(shop.plan)) {
      return c.json({ ok: false, error: 'current_plan_not_self_serve', message: 'This plan cannot be changed in-app.' }, 409);
    }
    if (parsed.data.target_plan === shop.plan) {
      return c.json({ ok: false, error: 'target_plan_is_current_plan', message: 'This is already your current plan.' }, 409);
    }
    if (deps.billingProvider.provider !== 'paddle' || typeof deps.billingProvider.upgradeSubscriptionPlan !== 'function') {
      return c.json({ ok: false, error: 'billing_upgrade_unavailable', message: 'Plan change is not available right now. Please contact support.' }, 503);
    }

    const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
    if (!subscription || subscription.provider !== 'paddle') {
      return c.json({ ok: false, error: 'provider_not_supported', message: 'This subscription cannot be changed in-app yet.' }, 409);
    }
    if (subscription.plan !== shop.plan) {
      return c.json({ ok: false, error: 'current_plan_mismatch', message: 'Billing is still synchronizing your current plan. Please try again shortly.' }, 409);
    }
    if (!['active', 'trialing'].includes(subscription.status)) {
      return c.json({ ok: false, error: 'subscription_not_upgradeable', message: 'Resolve billing before changing your plan.' }, 409);
    }

    const providerCustomerId = subscription.providerCustomerId?.trim();
    const providerSubscriptionId = subscription.providerSubscriptionId?.trim();
    if (!providerCustomerId) return c.json({ ok: false, error: 'missing_provider_customer_id', message: 'Billing is not ready for a plan change yet.' }, 409);
    if (!providerSubscriptionId) return c.json({ ok: false, error: 'missing_provider_subscription_id', message: 'Billing is not ready for a plan change yet.' }, 409);

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
        targetPlan: parsed.data.target_plan,
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
      const isDowngrade = upgrade.targetPlan === 'starter';
      return c.json({
        ok: true,
        status: 'pending',
        message: isDowngrade
          ? 'Your change to Starter is being processed. Your plan will update after billing is confirmed.'
          : 'Your upgrade is being processed. Professional features will unlock after billing is confirmed.',
      });
    } catch (err) {
      logger.error(
        {
          err,
          shopId: shop.id,
          providerSubscriptionId,
          targetPlan: parsed.data.target_plan,
          billingInterval,
        },
        'user_billing_upgrade_failed',
      );
      return c.json(
        {
          ok: false,
          error: 'billing_upgrade_failed',
          message: 'Plan change could not start. Please try again or contact support.',
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
      // Block only while a completed checkout's webhooks may still be in flight (Paddle
      // delivers within seconds). An older customer record means the previous checkout
      // was abandoned — without this window check the user would be locked out of
      // payment setup for the whole trial.
      const customerTouchedAtMs = Date.parse(existingPaddleCustomer.updatedAt ?? existingPaddleCustomer.createdAt ?? '');
      const withinPendingWindow =
        Number.isFinite(customerTouchedAtMs) && Date.now() - customerTouchedAtMs < PADDLE_CHECKOUT_PENDING_WINDOW_MS;
      if (withinPendingWindow) {
        return c.json(
          {
            ok: false,
            error: 'payment_setup_pending',
            message: 'Payment setup is already pending. Refresh Billing in a minute; if it does not update, contact support.',
          },
          409,
        );
      }
      logger.info(
        {
          shopId: shop.id,
          providerCustomerId: existingPaddleCustomer.providerCustomerId,
          customerTouchedAt: existingPaddleCustomer.updatedAt ?? existingPaddleCustomer.createdAt ?? null,
        },
        'user_billing_checkout_retry_after_stale_pending',
      );
    }
    const checkoutPlan = subscription.plan;
    const billingInterval = parsed.data.billing_interval === 'annual' ? 'year' : 'month';
    if (!isSelfServeTrialPlan(checkoutPlan)) {
      return c.json({ ok: false, error: 'plan_not_self_serve', message: 'Please contact sales for custom plans.' }, 400);
    }
    if (process.env.NODE_ENV === 'production' && !getEnv().PADDLE_TRIAL_CONFIG_VERIFIED && subscription.status === 'trialing') {
      // Without verified trial config on the Paddle price, this checkout would charge the
      // card immediately instead of at trial end. Fail closed in production.
      logger.error(
        { shopId: shop.id, plan: checkoutPlan, trialEndsAt: subscription.trialEndsAt ?? null },
        'user_billing_checkout_blocked_trial_config_unverified',
      );
      return c.json(
        {
          ok: false,
          error: 'billing_trial_config_unverified',
          message: 'Payment setup is temporarily unavailable. Please try again later or contact support.',
        },
        503,
      );
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
}
