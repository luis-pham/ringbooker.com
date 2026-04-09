import { getEnv } from '@/src/backend/config/env';
import type {
  BillingCustomer,
  BillingSubscription,
  BillingSubscriptionStatus,
  Shop,
  ShopPlan,
} from '@/src/backend/domain/types';
import type {
  BillingCustomersRepository,
  BillingSubscriptionsRepository,
  ShopsRepository,
} from '@/src/backend/ports/repositories';
import type { BillingProviderAdapter, BillingWebhookSyncResult } from '@/src/backend/services/billing/types';

function getPaddleApiBaseUrl() {
  return getEnv().PADDLE_ENVIRONMENT === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
}

function resolvePaddlePriceId(plan: ShopPlan): string {
  const env = getEnv();
  switch (plan) {
    case 'starter':
      return env.PADDLE_PRICE_STARTER;
    case 'professional':
      return env.PADDLE_PRICE_PROFESSIONAL;
    case 'enterprise':
      return env.PADDLE_PRICE_ENTERPRISE;
  }
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

  for (const candidate of candidates) {
    if (candidate === env.PADDLE_PRICE_STARTER) return 'starter';
    if (candidate === env.PADDLE_PRICE_PROFESSIONAL) return 'professional';
    if (candidate === env.PADDLE_PRICE_ENTERPRISE) return 'enterprise';
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

function extractProviderCustomerId(data: Record<string, unknown> | undefined): string | null {
  if (!data || typeof data !== 'object') return null;
  const candidates = [
    (data.customer as Record<string, unknown> | undefined)?.id,
    (data.customer_id as string | undefined),
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

function extractProviderSubscriptionId(data: Record<string, unknown> | undefined): string | null {
  if (!data || typeof data !== 'object') return null;
  const candidates = [(data.id as string | undefined), (data.subscription_id as string | undefined)];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate.trim();
  }
  return null;
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

  if (normalized.includes('subscription.canceled') || normalized.includes('subscription_cancelled')) return 'canceled';
  if (normalized.includes('subscription.created') || normalized.includes('subscription.updated')) return 'active';
  if (normalized.includes('transaction.paid') || normalized.includes('payment.succeeded')) return 'active';

  return 'unknown';
}

export class PaddleBillingProvider implements BillingProviderAdapter {
  readonly provider = 'paddle' as const;

  constructor(
    private readonly deps: {
      billingCustomersRepository: BillingCustomersRepository;
      billingSubscriptionsRepository: BillingSubscriptionsRepository;
      shopsRepository: ShopsRepository;
    },
  ) {}

  async createCheckoutSession(params: {
    shop: Shop;
    plan: Shop['plan'];
    email?: string | null;
    successUrl: string;
    cancelUrl: string;
  }) {
    const priceId = resolvePaddlePriceId(params.plan);
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
          requested_plan: params.plan,
        },
        checkout: {
          url: params.successUrl,
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

    const providerCustomerId = extractProviderCustomerId(params.payload);
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

    const providerSubscriptionId = extractProviderSubscriptionId(params.payload);
    let subscription: BillingSubscription | null = null;
    if (providerSubscriptionId) {
      const mappedPlan = mapPaddlePriceToPlan(params.payload) ?? shop.plan;
      const mappedStatus = mapPaddleStatus(params.eventType, params.payload);
      const amount = extractMoneyAmount(params.payload);
      const period = extractPeriod(params.payload);

      subscription = await this.deps.billingSubscriptionsRepository.upsert({
        shopId,
        provider: 'paddle',
        providerSubscriptionId,
        providerCustomerId,
        plan: mappedPlan,
        status: mappedStatus,
        interval: period.interval,
        currency: amount.currency,
        amount: amount.amount,
        cancelAtPeriodEnd: period.cancelAtPeriodEnd,
        currentPeriodStart: period.currentPeriodStart ?? null,
        currentPeriodEnd: period.currentPeriodEnd ?? null,
        trialEndsAt: period.trialEndsAt ?? null,
        metadata: params.payload,
      });

      const shouldBeActive = subscription.status === 'active' || subscription.status === 'trialing';
      const existingPlan = shop.plan;
      const existingActive = shop.active;
      await this.deps.shopsRepository.updatePlanAndActivation(shopId, {
        plan: subscription.plan,
        active: shouldBeActive,
      });

      return {
        provider: 'paddle',
        shopId,
        customer,
        subscription,
        shopPlanChanged: existingPlan !== subscription.plan || existingActive !== shouldBeActive,
      };
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
