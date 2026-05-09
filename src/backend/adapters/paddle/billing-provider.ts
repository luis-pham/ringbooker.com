import { getEnv } from '@/src/backend/config/env';
import { resolvePaddlePriceIdFromCatalog } from '@/src/backend/domain/plan-catalog';
import { logger } from '@/src/backend/observability/logger';
import type {
  BillingInterval,
  BillingCustomer,
  BillingSubscription,
  BillingSubscriptionStatus,
  Shop,
  ShopPlan,
} from '@/src/backend/domain/types';
import type {
  BillingCustomersRepository,
  BillingSubscriptionsRepository,
  ShopAccessStatesRepository,
  ShopsRepository,
} from '@/src/backend/ports/repositories';
import type { BillingProviderAdapter, BillingWebhookSyncResult } from '@/src/backend/services/billing/types';

function getPaddleApiBaseUrl() {
  const env = getEnv();
  return (env.PADDLE_ENV ?? env.PADDLE_ENVIRONMENT) === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
}

function resolvePaddlePriceId(plan: ShopPlan, interval: BillingInterval): string {
  getEnv();
  return resolvePaddlePriceIdFromCatalog(plan, interval);
}

function configuredPaddlePriceIds(env = getEnv()): Array<{ priceId: string; plan: ShopPlan; interval: BillingInterval }> {
  const entries: Array<{ priceId: string | undefined; plan: ShopPlan; interval: BillingInterval }> = [
    { priceId: env.PADDLE_PRICE_STARTER_MONTHLY, plan: 'starter', interval: 'month' },
    { priceId: env.PADDLE_PRICE_STARTER_ANNUAL, plan: 'starter', interval: 'year' },
    { priceId: env.PADDLE_PRICE_PROFESSIONAL_MONTHLY, plan: 'professional', interval: 'month' },
    { priceId: env.PADDLE_PRICE_PROFESSIONAL_ANNUAL, plan: 'professional', interval: 'year' },
    { priceId: env.PADDLE_PRICE_STARTER, plan: 'starter', interval: 'month' },
    { priceId: env.PADDLE_PRICE_PROFESSIONAL, plan: 'professional', interval: 'month' },
    { priceId: env.PADDLE_PRICE_ENTERPRISE, plan: 'enterprise', interval: 'month' },
  ];
  return entries.flatMap((entry) => {
    const priceId = entry.priceId?.trim();
    return priceId ? [{ ...entry, priceId }] : [];
  });
}

function mapPaddlePriceToPlan(data: Record<string, unknown> | undefined): ShopPlan | null {
  if (!data || typeof data !== 'object') return null;
  const env = getEnv();
  const candidates: string[] = [];

  const addCandidate = (value: unknown) => {
    if (typeof value === 'string' && value.trim().length > 0) candidates.push(value.trim());
  };

  addCandidate((data as { price_id?: unknown }).price_id);

  const items = Array.isArray(data.items) ? data.items : [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    addCandidate((item as { price_id?: unknown }).price_id);
    const nestedPrice = (item as { price?: { id?: unknown } }).price?.id;
    addCandidate(nestedPrice);
  }

  const configured = configuredPaddlePriceIds(env);
  for (const candidate of candidates) {
    const match = configured.find((entry) => candidate === entry.priceId);
    if (match) return match.plan;
  }

  return null;
}

function mapPaddlePriceToInterval(data: Record<string, unknown> | undefined): BillingInterval | null {
  if (!data || typeof data !== 'object') return null;
  const candidates: string[] = [];
  const addCandidate = (value: unknown) => {
    if (typeof value === 'string' && value.trim().length > 0) candidates.push(value.trim());
  };
  addCandidate((data as { price_id?: unknown }).price_id);
  const items = Array.isArray(data.items) ? data.items : [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    addCandidate((item as { price_id?: unknown }).price_id);
    addCandidate((item as { price?: { id?: unknown } }).price?.id);
  }
  const configured = configuredPaddlePriceIds();
  for (const candidate of candidates) {
    const match = configured.find((entry) => candidate === entry.priceId);
    if (match) return match.interval;
  }
  return null;
}

function extractShopId(data: Record<string, unknown> | undefined): string | null {
  if (!data || typeof data !== 'object') return null;
  const candidates = [
    (data.custom_data as Record<string, unknown> | undefined)?.shop_id,
    (data.customData as Record<string, unknown> | undefined)?.shop_id,
    (data.metadata as Record<string, unknown> | undefined)?.shop_id,
    (data.business as Record<string, unknown> | undefined)?.external_id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate.trim();
  }
  return null;
}

function extractProviderCustomerId(eventType: string, data: Record<string, unknown> | undefined): string | null {
  if (!data || typeof data !== 'object') return null;
  const candidates = [
    (data.customer as Record<string, unknown> | undefined)?.id,
    (data.customer_id as string | undefined),
    eventType.toLowerCase().startsWith('customer.') ? (data.id as string | undefined) : undefined,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate.trim();
  }
  return null;
}

function extractCustomerEmail(data: Record<string, unknown> | undefined): string | null {
  if (!data || typeof data !== 'object') return null;
  const candidates = [
    (data.customer as Record<string, unknown> | undefined)?.email,
    (data.email as string | undefined),
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate.trim().toLowerCase();
  }
  return null;
}

function extractProviderSubscriptionId(eventType: string, data: Record<string, unknown> | undefined): string | null {
  if (!data || typeof data !== 'object') return null;
  const normalized = eventType.toLowerCase();
  const candidates = [
    (data.subscription_id as string | undefined),
    normalized.startsWith('subscription.') ? (data.id as string | undefined) : undefined,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate.trim();
  }
  return null;
}

function extractInternalSubscriptionId(data: Record<string, unknown> | undefined): string | null {
  if (!data || typeof data !== 'object') return null;
  const candidates = [
    (data.custom_data as Record<string, unknown> | undefined)?.internal_subscription_id,
    (data.customData as Record<string, unknown> | undefined)?.internal_subscription_id,
    (data.metadata as Record<string, unknown> | undefined)?.internal_subscription_id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate.trim();
  }
  return null;
}

function extractProviderPriceId(data: Record<string, unknown> | undefined): string | null {
  if (!data || typeof data !== 'object') return null;
  const direct = (data as { price_id?: unknown }).price_id;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const item = Array.isArray(data.items) ? data.items[0] : null;
  if (item && typeof item === 'object') {
    const price = (item as { price?: { id?: unknown }; price_id?: unknown }).price;
    const candidate = typeof (item as { price_id?: unknown }).price_id === 'string'
      ? (item as { price_id: string }).price_id
      : typeof price?.id === 'string'
        ? price.id
        : null;
    if (candidate?.trim()) return candidate.trim();
  }
  return null;
}

function hasPaymentMethodEvidence(eventType: string, data: Record<string, unknown> | undefined): boolean {
  if (!data || typeof data !== 'object') return false;
  const normalized = eventType.toLowerCase();
  const candidates = [
    (data as { payment_method_id?: unknown }).payment_method_id,
    (data as { payment_method?: Record<string, unknown> }).payment_method?.id,
    (data as { paymentMethod?: Record<string, unknown> }).paymentMethod?.id,
    (data as { payment_method?: Record<string, unknown> }).payment_method?.type,
  ];
  if (candidates.some((value) => typeof value === 'string' && value.trim().length > 0)) return true;
  const payments = Array.isArray((data as { payments?: unknown }).payments) ? ((data as { payments: unknown[] }).payments) : [];
  if (
    payments.some((payment) => {
      if (!payment || typeof payment !== 'object') return false;
      const status = String((payment as Record<string, unknown>).status ?? '').toLowerCase();
      const method = (payment as Record<string, unknown>).payment_method_id ?? (payment as Record<string, unknown>).payment_method;
      return ['authorized', 'captured', 'paid', 'succeeded', 'completed'].includes(status) || Boolean(method);
    })
  ) {
    return true;
  }
  return normalized.includes('payment_method') && !normalized.includes('deleted') && !normalized.includes('failed');
}

function extractMoneyAmount(data: Record<string, unknown> | undefined): { amount: number; currency: string } {
  if (!data || typeof data !== 'object') return { amount: 0, currency: 'USD' };
  const totals = data as {
    currency_code?: unknown;
    unit_totals?: { total?: unknown };
    totals?: { total?: unknown };
  };
  const rawAmount =
    typeof totals.unit_totals?.total === 'string'
      ? Number(totals.unit_totals.total)
      : typeof totals.totals?.total === 'string'
        ? Number(totals.totals.total)
        : 0;
  return {
    amount: Number.isFinite(rawAmount) ? rawAmount / 100 : 0,
    currency: typeof totals.currency_code === 'string' ? totals.currency_code : 'USD',
  };
}

function extractPeriod(data: Record<string, unknown> | undefined): {
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  interval: 'month' | 'year';
  cancelAtPeriodEnd: boolean;
} {
  if (!data || typeof data !== 'object') {
    return { interval: 'month', cancelAtPeriodEnd: false };
  }
  const schedule = (data.scheduled_change as Record<string, unknown> | undefined)?.action;
  const recurring = data.recurring_transaction_details as Record<string, unknown> | undefined;
  const frequency = recurring?.interval as string | undefined;
  const interval = frequency === 'year' ? 'year' : 'month';
  return {
    currentPeriodStart: typeof (data.current_billing_period as Record<string, unknown> | undefined)?.starts_at === 'string'
      ? ((data.current_billing_period as Record<string, unknown>).starts_at as string)
      : null,
    currentPeriodEnd: typeof (data.current_billing_period as Record<string, unknown> | undefined)?.ends_at === 'string'
      ? ((data.current_billing_period as Record<string, unknown>).ends_at as string)
      : null,
    trialEndsAt: typeof (data.trial_dates as Record<string, unknown> | undefined)?.ends_at === 'string'
      ? ((data.trial_dates as Record<string, unknown>).ends_at as string)
      : null,
    interval,
    cancelAtPeriodEnd: schedule === 'cancel',
  };
}

function mapPaddleStatus(eventType: string, data: Record<string, unknown> | undefined): BillingSubscriptionStatus {
  const normalized = eventType.toLowerCase();
  const statusCandidate = typeof (data as { status?: unknown } | undefined)?.status === 'string'
    ? (((data as { status?: string }).status) ?? '').toLowerCase()
    : '';

  if (statusCandidate === 'trialing') return 'trialing';
  if (statusCandidate === 'active') return 'active';
  if (statusCandidate === 'past_due') return 'past_due';
  if (statusCandidate === 'paused') return 'paused';
  if (statusCandidate === 'canceled' || statusCandidate === 'cancelled') return 'canceled';
  if (statusCandidate === 'incomplete') return 'incomplete';
  if (statusCandidate === 'unpaid') return 'unpaid';

  if (normalized.includes('subscription.canceled') || normalized.includes('subscription_cancelled')) return 'canceled';
  if (normalized.includes('subscription.paused')) return 'paused';
  if (normalized.includes('subscription.resumed')) return 'active';
  if (normalized.includes('subscription.past_due')) return 'past_due';
  if (normalized.includes('subscription.trialing')) return 'trialing';
  if (normalized.includes('subscription.activated')) return 'active';
  if (normalized.includes('subscription.created') || normalized.includes('subscription.updated')) return 'active';
  if (normalized.includes('transaction.completed') || normalized.includes('transaction.paid') || normalized.includes('payment.succeeded')) return 'active';
  if (normalized.includes('transaction.payment_failed') || normalized.includes('payment_failed')) return 'past_due';

  return 'unknown';
}

function shouldMutateSubscriptionFromPaddleEvent(params: {
  eventType: string;
  providerSubscriptionId: string | null;
  mappedStatus: BillingSubscriptionStatus;
}): boolean {
  if (params.providerSubscriptionId) return true;
  const normalized = params.eventType.toLowerCase();
  if (normalized.includes('subscription.')) return true;
  if (params.mappedStatus === 'unknown') return false;
  return normalized.includes('payment_method.') || normalized.includes('transaction.payment_failed');
}

export class PaddleBillingProvider implements BillingProviderAdapter {
  readonly provider = 'paddle' as const;

  constructor(
    private readonly deps: {
      billingCustomersRepository: BillingCustomersRepository;
      billingSubscriptionsRepository: BillingSubscriptionsRepository;
      shopAccessStatesRepository?: ShopAccessStatesRepository;
      shopsRepository: ShopsRepository;
    },
  ) {}

  async createCheckoutSession(params: {
    shop: Shop;
    plan: Shop['plan'];
    email?: string | null;
    internalSubscriptionId?: string | null;
    trialEndsAt?: string | null;
    billingInterval?: BillingInterval;
    source?: string;
    checkoutUrl: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    const billingInterval = params.billingInterval ?? 'month';
    const priceId = resolvePaddlePriceId(params.plan, billingInterval);
    const trialConfigVerified = getEnv().PADDLE_TRIAL_CONFIG_VERIFIED;
    if (!trialConfigVerified) {
      logger.warn(
        {
          plan: params.plan,
          shopId: params.shop.id,
          trialEndsAt: params.trialEndsAt ?? null,
        },
        'paddle_trial_config_not_verified_checkout_may_charge_immediately',
      );
    }
    const response = await fetch(`${getPaddleApiBaseUrl()}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getEnv().PADDLE_API_KEY}`,
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        customer_email: params.email ?? undefined,
        custom_data: {
          shop_id: params.shop.id,
          internal_subscription_id: params.internalSubscriptionId ?? undefined,
          requested_plan: params.plan,
          requested_billing_interval: billingInterval,
          plan: params.plan,
          source: params.source ?? 'add_payment_method_before_go_live',
          internal_trial_ends_at: params.trialEndsAt ?? undefined,
          no_charge_until_trial_end_verified: trialConfigVerified,
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
        },
        checkout: {
          url: params.checkoutUrl,
        },
        collection_mode: 'automatic',
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(`paddle_create_checkout_failed:${response.status}:${bodyText}`);
    }

    const json = (await response.json()) as {
      data?: {
        id?: string;
        checkout?: {
          url?: string;
        };
        customer_id?: string;
      };
    };
    const checkoutUrl = json.data?.checkout?.url;
    if (!checkoutUrl) {
      throw new Error('paddle_create_checkout_missing_url');
    }

    if (json.data?.customer_id) {
      await this.deps.billingCustomersRepository.upsert({
        shopId: params.shop.id,
        provider: 'paddle',
        providerCustomerId: json.data.customer_id,
        email: params.email ?? null,
      });
    }

    return {
      provider: 'paddle' as const,
      checkoutUrl,
      providerTransactionId: json.data?.id ?? null,
      providerCustomerId: json.data?.customer_id ?? null,
      trialConfigVerified,
    };
  }

  async syncWebhookEvent(params: {
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<BillingWebhookSyncResult | null> {
    const shopId = extractShopId(params.payload);
    if (!shopId) return null;

    const shop = await this.deps.shopsRepository.findById(shopId);
    if (!shop) return null;

    const providerCustomerId = extractProviderCustomerId(params.eventType, params.payload);
    const customerEmail = extractCustomerEmail(params.payload);
    let customer: BillingCustomer | null = null;
    if (providerCustomerId) {
      customer = await this.deps.billingCustomersRepository.upsert({
        shopId,
        provider: 'paddle',
        providerCustomerId,
        email: customerEmail,
      });
    }

    const internalSubscriptionId = extractInternalSubscriptionId(params.payload);
    const providerSubscriptionId = extractProviderSubscriptionId(params.eventType, params.payload);
    const existingProviderSubscription = providerSubscriptionId
      ? await this.deps.billingSubscriptionsRepository.findByProviderSubscriptionId('paddle', providerSubscriptionId)
      : null;
    const explicitInternalSubscription = internalSubscriptionId
      ? await this.deps.billingSubscriptionsRepository.findById(internalSubscriptionId)
      : null;
    const currentInternalSubscription = !explicitInternalSubscription && !existingProviderSubscription
      ? await this.deps.billingSubscriptionsRepository.findCurrentByShopId(shopId, 'internal')
      : null;
    const internalSubscription =
      explicitInternalSubscription ?? (currentInternalSubscription?.status === 'trialing' ? currentInternalSubscription : null);
    let subscription: BillingSubscription | null = null;
    if (providerSubscriptionId || internalSubscription) {
      const mappedPlan = mapPaddlePriceToPlan(params.payload) ?? shop.plan;
      const mappedStatus = mapPaddleStatus(params.eventType, params.payload);
      if (!shouldMutateSubscriptionFromPaddleEvent({ eventType: params.eventType, providerSubscriptionId, mappedStatus })) {
        return {
          provider: 'paddle',
          shopId,
          customer,
          subscription: internalSubscription ?? existingProviderSubscription ?? null,
          shopPlanChanged: false,
        };
      }
      const amount = extractMoneyAmount(params.payload);
      const period = extractPeriod(params.payload);
      const mappedInterval = mapPaddlePriceToInterval(params.payload);
      const providerPriceId = extractProviderPriceId(params.payload);
      const paymentMethodStatus: BillingSubscription['paymentMethodStatus'] = hasPaymentMethodEvidence(params.eventType, params.payload)
        ? 'valid'
        : mappedStatus === 'past_due' || mappedStatus === 'unpaid'
          ? 'failed'
          : internalSubscription?.paymentMethodStatus === 'valid'
            ? 'valid'
            : 'unknown';
      const now = new Date().toISOString();

      const subscriptionPatch = {
        provider: 'paddle' as const,
        providerSubscriptionId: providerSubscriptionId ?? internalSubscription?.providerSubscriptionId ?? null,
        providerCustomerId,
        providerPriceId,
        providerProductId: null,
        plan: mappedPlan,
        status: mappedStatus,
        interval: mappedInterval ?? period.interval,
        currency: amount.currency,
        amount: amount.amount,
        amountCents: Math.round(amount.amount * 100),
        cancelAtPeriodEnd: period.cancelAtPeriodEnd,
        currentPeriodStart: period.currentPeriodStart ?? internalSubscription?.currentPeriodStart ?? null,
        currentPeriodEnd: period.currentPeriodEnd ?? internalSubscription?.currentPeriodEnd ?? null,
        trialStartedAt: internalSubscription?.trialStartedAt ?? null,
        trialEndsAt: period.trialEndsAt ?? internalSubscription?.trialEndsAt ?? null,
        paymentMethodStatus,
        paymentMethodAddedAt: paymentMethodStatus === 'valid' ? now : null,
        activatedAt: mappedStatus === 'active' || mappedStatus === 'trialing' ? now : null,
        pausedAt: mappedStatus === 'paused' ? now : null,
        canceledAt: mappedStatus === 'canceled' ? now : null,
        metadata: {
          ...params.payload,
          internal_subscription_id: internalSubscriptionId,
        },
      };
      subscription = internalSubscription
        ? await this.deps.billingSubscriptionsRepository.updateById(internalSubscription.id, subscriptionPatch)
        : await this.deps.billingSubscriptionsRepository.upsert({
        shopId,
        ...subscriptionPatch,
      });
      if (!subscription) return null;

      const shouldBeActive = subscription.status === 'active' || subscription.status === 'trialing';
      const existingPlan = shop.plan;
      const existingActive = shop.active;
      await this.deps.shopsRepository.updatePlanAndActivation(shopId, {
        plan: subscription.plan,
        active: shouldBeActive,
      });
      if (!shouldBeActive) {
        await this.deps.shopAccessStatesRepository?.upsert({
          shopId,
          liveCallsEnabled: false,
          liveCallsPausedReason: subscription.status,
          liveCallsPausedAt: new Date().toISOString(),
        });
      }

      return {
        provider: 'paddle',
        shopId,
        customer,
        subscription,
        shopPlanChanged: existingPlan !== subscription.plan || existingActive !== shouldBeActive,
      };
    }

    const eventType = params.eventType.toLowerCase();
    if (eventType.includes('payment_method.saved') || eventType.includes('payment_method.deleted') || eventType.includes('transaction.payment_failed')) {
      const current = await this.deps.billingSubscriptionsRepository.findCurrentByShopId(shopId);
      if (current) {
        const paymentMethodStatus: BillingSubscription['paymentMethodStatus'] =
          eventType.includes('payment_method.saved')
            ? 'valid'
            : eventType.includes('payment_method.deleted') || eventType.includes('transaction.payment_failed')
              ? 'failed'
              : current.paymentMethodStatus;
        const subscription = await this.deps.billingSubscriptionsRepository.updateById(current.id, {
          paymentMethodStatus,
          paymentMethodAddedAt: paymentMethodStatus === 'valid' ? new Date().toISOString() : current.paymentMethodAddedAt ?? null,
          metadata: {
            ...(current.metadata ?? {}),
            last_paddle_event_type: params.eventType,
            last_paddle_event_payload: params.payload,
          },
        });
        return {
          provider: 'paddle',
          shopId,
          customer,
          subscription,
          shopPlanChanged: false,
        };
      }
    }

    return {
      provider: 'paddle',
      shopId,
      customer,
      subscription,
      shopPlanChanged: false,
    };
  }
}
