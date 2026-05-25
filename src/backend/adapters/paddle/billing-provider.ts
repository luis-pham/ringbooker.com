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
  CallLogsRepository,
  AuthUsersRepository,
  ShopAccessStatesRepository,
  ShopOverageChargesRepository,
  ShopUsageAlertsRepository,
  ShopsRepository,
} from '@/src/backend/ports/repositories';
import { processOverageForPeriod } from '@/src/backend/services/billing/process-overage';
import type { EmailService } from '@/src/backend/services/email/types';
import type { BillingProviderAdapter, BillingTransactionRecord, BillingWebhookSyncResult } from '@/src/backend/services/billing/types';

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

function extractPaddleEventTimestamp(data: Record<string, unknown> | undefined): string | null {
  if (!data || typeof data !== 'object') return null;
  const candidates = [
    data.__paddle_event_occurred_at,
    data.occurred_at,
    data.updated_at,
    data.created_at,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    const timestamp = Date.parse(candidate);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }
  return null;
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestPaddleEventTimestamp(subscription: BillingSubscription | null | undefined): string | null {
  const value = subscription?.metadata?.latest_paddle_event_at;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isStalePaddleEvent(subscription: BillingSubscription | null | undefined, eventTimestamp: string | null): boolean {
  if (!subscription || !eventTimestamp) return false;
  const latestTimestamp = latestPaddleEventTimestamp(subscription);
  if (!latestTimestamp) return false;
  const eventMs = Date.parse(eventTimestamp);
  const latestMs = Date.parse(latestTimestamp);
  return Number.isFinite(eventMs) && Number.isFinite(latestMs) && eventMs < latestMs;
}

function logPaddleOwnershipConflict(params: {
  reason: string;
  payloadShopId: string | null;
  resolvedShopId: string | null;
  providerCustomerId: string | null;
  existingCustomerShopId?: string | null;
  providerSubscriptionId: string | null;
  existingSubscriptionShopId?: string | null;
  internalSubscriptionId?: string | null;
  internalSubscriptionShopId?: string | null;
  eventType: string;
}) {
  logger.error(
    {
      event: 'paddle_webhook_ownership_conflict',
      reason: params.reason,
      payload_shop_id: params.payloadShopId,
      resolved_shop_id: params.resolvedShopId,
      provider_customer_id: params.providerCustomerId,
      existing_customer_shop_id: params.existingCustomerShopId ?? null,
      provider_subscription_id: params.providerSubscriptionId,
      existing_subscription_shop_id: params.existingSubscriptionShopId ?? null,
      internal_subscription_id: params.internalSubscriptionId ?? null,
      internal_subscription_shop_id: params.internalSubscriptionShopId ?? null,
      event_type: params.eventType,
    },
    'paddle_webhook_ownership_conflict',
  );
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

function extractInternalTrialEndsAt(data: Record<string, unknown> | undefined): string | null {
  if (!data || typeof data !== 'object') return null;
  const candidates = [
    (data.custom_data as Record<string, unknown> | undefined)?.internal_trial_ends_at,
    (data.customData as Record<string, unknown> | undefined)?.internal_trial_ends_at,
    (data.metadata as Record<string, unknown> | undefined)?.internal_trial_ends_at,
    data.internal_trial_ends_at,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    const timestamp = Date.parse(candidate);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }
  return null;
}

function isPaddleSubscriptionPaymentMethodChange(eventType: string, data: Record<string, unknown> | undefined): boolean {
  if (!data || typeof data !== 'object') return false;
  const normalized = eventType.toLowerCase();
  return normalized.startsWith('transaction.') && data.origin === 'subscription_payment_method_change';
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
  // Paddle subscription events (subscription.created, subscription.activated) use
  // payment_method_details instead of payment_method_id
  const pmDetails = (data as { payment_method_details?: unknown }).payment_method_details;
  if (pmDetails && typeof pmDetails === 'object') {
    const pmType = (pmDetails as { type?: unknown }).type;
    if (typeof pmType === 'string' && pmType.trim()) return true;
    if ((pmDetails as { card?: unknown }).card || (pmDetails as { paypal?: unknown }).paypal) return true;
  }
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
  if (
    isPaddleSubscriptionPaymentMethodChange(eventType, data) &&
    Boolean(extractProviderCustomerId(eventType, data)) &&
    Boolean(extractProviderSubscriptionId(eventType, data))
  ) {
    return true;
  }
  return normalized.includes('payment_method') && !normalized.includes('deleted') && !normalized.includes('failed');
}

function pickPaddlePortalUrl(data: Record<string, unknown> | undefined, providerSubscriptionId: string): string | null {
  const urls = data?.urls;
  if (!urls || typeof urls !== 'object') return null;
  const urlRecord = urls as Record<string, unknown>;

  const general = urlRecord.general;
  const generalOverview = general && typeof general === 'object'
    ? (general as Record<string, unknown>).overview
    : null;

  const subscriptions = Array.isArray(urlRecord.subscriptions) ? urlRecord.subscriptions : [];
  for (const subscription of subscriptions) {
    if (!subscription || typeof subscription !== 'object') continue;
    const sub = subscription as Record<string, unknown>;
    const subscriptionId = typeof sub.subscription_id === 'string'
      ? sub.subscription_id
      : typeof sub.id === 'string'
        ? sub.id
        : null;
    if (subscriptionId && subscriptionId !== providerSubscriptionId) continue;
    for (const key of ['overview', 'update_payment_method', 'payment_method', 'cancel_subscription', 'subscription']) {
      const value = sub[key];
      if (typeof value === 'string' && value.startsWith('https://')) return value;
      if (value && typeof value === 'object') {
        const nestedUrl = (value as Record<string, unknown>).url ?? (value as Record<string, unknown>).href;
        if (typeof nestedUrl === 'string' && nestedUrl.startsWith('https://')) return nestedUrl;
      }
    }
  }

  return typeof generalOverview === 'string' && generalOverview.startsWith('https://') ? generalOverview : null;
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
  if (isPaddleSubscriptionPaymentMethodChange(eventType, data)) {
    const internalTrialEndsAt = extractInternalTrialEndsAt(data);
    if (internalTrialEndsAt) return Date.parse(internalTrialEndsAt) > Date.now() ? 'trialing' : 'trial_expired';
  }

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
  // payment_method.saved must update paymentMethodStatus even when mappedStatus is 'unknown'
  // (payment_method events carry no subscription status in their payload)
  if (normalized.includes('payment_method.') || normalized.includes('transaction.payment_failed')) return true;
  if (params.mappedStatus === 'unknown') return false;
  return false;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function nestedRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function nestedArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function centsToAmount(value: unknown): number {
  const raw = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 0;
  return Number.isFinite(raw) ? raw / 100 : 0;
}

function extractTransactionAmount(data: Record<string, unknown>): number {
  const details = nestedRecord(data.details);
  const totals = nestedRecord(data.totals);
  const detailsTotals = nestedRecord(details?.totals);
  const adjustedTotals = nestedRecord(details?.adjusted_totals);
  const payments = nestedArray(data.payments).map(nestedRecord).filter(Boolean) as Array<Record<string, unknown>>;
  const firstPayment = payments[0];
  return centsToAmount(
    firstString(
      adjustedTotals?.grand_total,
      adjustedTotals?.total,
      detailsTotals?.grand_total,
      detailsTotals?.total,
      totals?.grand_total,
      totals?.total,
      firstPayment?.amount,
    ),
  );
}

function extractTransactionCurrency(data: Record<string, unknown>): string {
  const details = nestedRecord(data.details);
  const totals = nestedRecord(data.totals);
  const payments = nestedArray(data.payments).map(nestedRecord).filter(Boolean) as Array<Record<string, unknown>>;
  return firstString(data.currency_code, totals?.currency_code, details?.currency_code, payments[0]?.currency_code) ?? 'USD';
}

function extractTransactionDescription(data: Record<string, unknown>): string {
  const invoiceNumber = firstString(data.invoice_number, nestedRecord(data.invoice)?.number);
  if (invoiceNumber) return `Invoice ${invoiceNumber}`;
  const items = nestedArray(data.items).map(nestedRecord).filter(Boolean) as Array<Record<string, unknown>>;
  const price = nestedRecord(items[0]?.price);
  const product = nestedRecord(price?.product);
  const name = firstString(product?.name, price?.name, items[0]?.description);
  return name ?? 'Paddle transaction';
}

function extractBillingPeriod(data: Record<string, unknown>): { start?: string; end?: string } {
  const period = nestedRecord(data.billing_period) ?? nestedRecord(data.current_billing_period);
  return {
    start: firstString(period?.starts_at, period?.start_at),
    end: firstString(period?.ends_at, period?.end_at),
  };
}

function extractTransactionLinks(data: Record<string, unknown>): { invoiceUrl?: string; receiptUrl?: string } {
  const invoice = nestedRecord(data.invoice);
  const checkout = nestedRecord(data.checkout);
  const payments = nestedArray(data.payments).map(nestedRecord).filter(Boolean) as Array<Record<string, unknown>>;
  return {
    invoiceUrl: firstString(data.invoice_url, data.invoice_pdf, invoice?.url, invoice?.pdf_url),
    receiptUrl: firstString(data.receipt_url, data.receipt_pdf, payments[0]?.receipt_url, payments[0]?.receipt_pdf, checkout?.url),
  };
}

function mapTransactionType(data: Record<string, unknown>): BillingTransactionRecord['type'] {
  const status = firstString(data.status)?.toLowerCase() ?? '';
  const origin = firstString(data.origin)?.toLowerCase() ?? '';
  const amount = extractTransactionAmount(data);
  if (status.includes('refunded') || origin.includes('refund')) return 'refund';
  if (amount < 0) return 'credit';
  if (firstString(data.invoice_number, nestedRecord(data.invoice)?.number)) return 'invoice';
  if (status.includes('paid') || status.includes('completed')) return 'payment';
  return 'unknown';
}

function sanitizePaddleTransaction(data: Record<string, unknown>): BillingTransactionRecord | null {
  const id = firstString(data.id);
  const date = firstString(data.billed_at, data.created_at, data.updated_at);
  if (!id || !date) return null;
  const period = extractBillingPeriod(data);
  const links = extractTransactionLinks(data);
  return {
    id,
    date,
    description: extractTransactionDescription(data),
    amount: extractTransactionAmount(data),
    currency: extractTransactionCurrency(data),
    status: firstString(data.status) ?? 'unknown',
    type: mapTransactionType(data),
    billingPeriodStart: period.start,
    billingPeriodEnd: period.end,
    invoiceNumber: firstString(data.invoice_number, nestedRecord(data.invoice)?.number),
    invoiceUrl: links.invoiceUrl,
    receiptUrl: links.receiptUrl,
  };
}

export class PaddleBillingProvider implements BillingProviderAdapter {
  readonly provider = 'paddle' as const;

  constructor(
    private readonly deps: {
      billingCustomersRepository: BillingCustomersRepository;
      billingSubscriptionsRepository: BillingSubscriptionsRepository;
      callLogsRepository?: CallLogsRepository;
      shopAccessStatesRepository?: ShopAccessStatesRepository;
      shopOverageChargesRepository?: ShopOverageChargesRepository;
      shopUsageAlertsRepository?: ShopUsageAlertsRepository;
      authUsersRepository?: AuthUsersRepository;
      emailService?: EmailService;
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

  async chargeOverage(params: {
    providerSubscriptionId: string;
    amountCents: number;
    description: string;
  }): Promise<{ providerTransactionId: string }> {
    const response = await fetch(`${getPaddleApiBaseUrl()}/subscriptions/${encodeURIComponent(params.providerSubscriptionId)}/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getEnv().PADDLE_API_KEY}`,
      },
      body: JSON.stringify({
        effective_from: 'immediately',
        items: [
          {
            price: {
              description: params.description,
              unit_price: {
                amount: String(params.amountCents),
                currency_code: 'USD',
              },
            },
            quantity: 1,
          },
        ],
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(`paddle_charge_overage_failed:${response.status}:${bodyText}`);
    }

    const json = (await response.json()) as { data?: { id?: string; transaction_id?: string; transaction?: { id?: string } } };
    const providerTransactionId = json.data?.id ?? json.data?.transaction_id ?? json.data?.transaction?.id;
    if (!providerTransactionId) throw new Error('paddle_charge_overage_missing_transaction_id');
    return { providerTransactionId };
  }

  async createManageBillingSession(params: {
    shop: Shop;
    providerCustomerId: string;
    providerSubscriptionId: string;
  }) {
    const response = await fetch(
      `${getPaddleApiBaseUrl()}/customers/${encodeURIComponent(params.providerCustomerId)}/portal-sessions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getEnv().PADDLE_API_KEY}`,
        },
        body: JSON.stringify({
          subscription_ids: [params.providerSubscriptionId],
        }),
      },
    );

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(`paddle_create_portal_session_failed:${response.status}:${bodyText}`);
    }

    const json = (await response.json()) as {
      data?: {
        id?: string;
        customer_id?: string;
        urls?: Record<string, unknown>;
      };
    };
    if (json.data?.customer_id && json.data.customer_id !== params.providerCustomerId) {
      throw new Error('paddle_create_portal_session_customer_mismatch');
    }
    const manageUrl = pickPaddlePortalUrl(json.data as Record<string, unknown> | undefined, params.providerSubscriptionId);
    if (!manageUrl) {
      throw new Error('paddle_create_portal_session_missing_url');
    }

    return {
      provider: 'paddle' as const,
      manageUrl,
      providerPortalSessionId: json.data?.id ?? null,
      canViewInvoicesViaPortal: true,
      canUpdatePaymentMethodViaPortal: true,
      canCancelViaPortal: true,
    };
  }

  async upgradeSubscriptionPlan(params: {
    shop: Shop;
    providerCustomerId: string;
    providerSubscriptionId: string;
    targetPlan: Extract<ShopPlan, 'starter' | 'professional'>;
    billingInterval: BillingInterval;
    prorationBillingMode: 'prorated_next_billing_period';
  }) {
    const targetPriceId = resolvePaddlePriceId(params.targetPlan, params.billingInterval);
    const response = await fetch(
      `${getPaddleApiBaseUrl()}/subscriptions/${encodeURIComponent(params.providerSubscriptionId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getEnv().PADDLE_API_KEY}`,
        },
        body: JSON.stringify({
          items: [{ price_id: targetPriceId, quantity: 1 }],
          proration_billing_mode: params.prorationBillingMode,
          on_payment_failure: 'prevent_change',
        }),
      },
    );

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(`paddle_plan_change_failed:${response.status}:${bodyText}`);
    }

    const json = (await response.json()) as {
      data?: {
        id?: string;
        customer_id?: string;
      };
    };
    if (json.data?.id && json.data.id !== params.providerSubscriptionId) {
      throw new Error('paddle_plan_change_subscription_id_mismatch');
    }
    if (json.data?.customer_id && json.data.customer_id !== params.providerCustomerId) {
      throw new Error('paddle_plan_change_customer_id_mismatch');
    }

    return {
      provider: 'paddle' as const,
      providerSubscriptionId: json.data?.id ?? params.providerSubscriptionId,
      targetPlan: params.targetPlan,
      billingInterval: params.billingInterval,
      prorationBillingMode: params.prorationBillingMode,
    };
  }

  async listBillingTransactions(params: {
    providerCustomerId: string;
    providerSubscriptionId?: string | null;
    limit?: number;
    after?: string | null;
    before?: string | null;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
    const url = new URL(`${getPaddleApiBaseUrl()}/transactions`);
    url.searchParams.set('customer_id', params.providerCustomerId);
    if (params.providerSubscriptionId?.trim()) {
      url.searchParams.set('subscription_id', params.providerSubscriptionId.trim());
    }
    url.searchParams.set('per_page', String(limit));
    if (params.after?.trim()) url.searchParams.set('after', params.after.trim());
    if (params.before?.trim()) url.searchParams.set('before', params.before.trim());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${getEnv().PADDLE_API_KEY}`,
      },
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(`paddle_list_transactions_failed:${response.status}:${bodyText}`);
    }

    const json = (await response.json()) as {
      data?: unknown[];
      meta?: {
        has_more?: boolean;
        pagination?: {
          has_more?: boolean;
          next?: string | null;
        };
      };
    };
    const transactions = (Array.isArray(json.data) ? json.data : [])
      .map(nestedRecord)
      .filter(Boolean)
      .map((entry) => sanitizePaddleTransaction(entry as Record<string, unknown>))
      .filter((entry): entry is BillingTransactionRecord => entry != null);

    return {
      provider: 'paddle' as const,
      transactions,
      hasMore: json.meta?.pagination?.has_more ?? json.meta?.has_more ?? false,
      nextCursor: json.meta?.pagination?.next ?? null,
    };
  }

  private async processRenewalOverage(shop: Shop, oldPeriodStart: Date, oldPeriodEnd: Date): Promise<void> {
    if (!this.deps.shopOverageChargesRepository || !this.deps.callLogsRepository) return;
    try {
      await processOverageForPeriod(shop, oldPeriodStart, oldPeriodEnd, {
        overageRepository: this.deps.shopOverageChargesRepository,
        billingSubscriptionsRepository: this.deps.billingSubscriptionsRepository,
        callLogsRepository: this.deps.callLogsRepository,
        billingProvider: this,
        usageAlertsRepository: this.deps.shopUsageAlertsRepository,
        authUsersRepository: this.deps.authUsersRepository,
        emailService: this.deps.emailService,
      });
    } catch (err) {
      logger.error({ err, shopId: shop.id, oldPeriodStart, oldPeriodEnd }, 'captured_caller_overage_renewal_processing_failed');
    }
  }

  async syncWebhookEvent(params: {
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<BillingWebhookSyncResult | null> {
    const payloadShopId = extractShopId(params.payload);
    const providerCustomerId = extractProviderCustomerId(params.eventType, params.payload);
    const providerSubscriptionId = extractProviderSubscriptionId(params.eventType, params.payload);
    const existingCustomer = providerCustomerId
      ? await this.deps.billingCustomersRepository.findByProviderCustomerId('paddle', providerCustomerId)
      : null;
    const existingProviderSubscription = providerSubscriptionId
      ? await this.deps.billingSubscriptionsRepository.findByProviderSubscriptionId('paddle', providerSubscriptionId)
      : null;

    let shopId = payloadShopId ?? existingProviderSubscription?.shopId ?? existingCustomer?.shopId ?? null;
    if (payloadShopId && existingCustomer && existingCustomer.shopId !== payloadShopId) {
      logPaddleOwnershipConflict({
        reason: 'customer_shop_mismatch',
        payloadShopId,
        resolvedShopId: shopId,
        providerCustomerId,
        existingCustomerShopId: existingCustomer.shopId,
        providerSubscriptionId,
        existingSubscriptionShopId: existingProviderSubscription?.shopId,
        eventType: params.eventType,
      });
      return null;
    }
    if (payloadShopId && existingProviderSubscription && existingProviderSubscription.shopId !== payloadShopId) {
      logPaddleOwnershipConflict({
        reason: 'subscription_shop_mismatch',
        payloadShopId,
        resolvedShopId: shopId,
        providerCustomerId,
        existingCustomerShopId: existingCustomer?.shopId,
        providerSubscriptionId,
        existingSubscriptionShopId: existingProviderSubscription.shopId,
        eventType: params.eventType,
      });
      return null;
    }
    if (existingCustomer && existingProviderSubscription && existingCustomer.shopId !== existingProviderSubscription.shopId) {
      logPaddleOwnershipConflict({
        reason: 'customer_subscription_shop_mismatch',
        payloadShopId,
        resolvedShopId: shopId,
        providerCustomerId,
        existingCustomerShopId: existingCustomer.shopId,
        providerSubscriptionId,
        existingSubscriptionShopId: existingProviderSubscription.shopId,
        eventType: params.eventType,
      });
      return null;
    }
    shopId = shopId?.trim() || null;
    if (!shopId) return null;

    const shop = await this.deps.shopsRepository.findById(shopId);
    if (!shop) return null;

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
    const explicitInternalSubscription = internalSubscriptionId
      ? await this.deps.billingSubscriptionsRepository.findById(internalSubscriptionId)
      : null;
    if (explicitInternalSubscription && explicitInternalSubscription.shopId !== shopId) {
      logPaddleOwnershipConflict({
        reason: 'internal_subscription_shop_mismatch',
        payloadShopId,
        resolvedShopId: shopId,
        providerCustomerId,
        existingCustomerShopId: existingCustomer?.shopId,
        providerSubscriptionId,
        existingSubscriptionShopId: existingProviderSubscription?.shopId,
        internalSubscriptionId,
        internalSubscriptionShopId: explicitInternalSubscription.shopId,
        eventType: params.eventType,
      });
      return null;
    }
    const currentInternalSubscription = !explicitInternalSubscription && !existingProviderSubscription
      ? await this.deps.billingSubscriptionsRepository.findCurrentByShopId(shopId, 'internal')
      : null;
    const internalSubscription =
      explicitInternalSubscription ?? (currentInternalSubscription?.status === 'trialing' ? currentInternalSubscription : null);
    let subscription: BillingSubscription | null = null;
    const eventTimestamp = extractPaddleEventTimestamp(params.payload);
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
      const staleTarget = existingProviderSubscription ?? internalSubscription ?? null;
      if (isStalePaddleEvent(staleTarget, eventTimestamp)) {
        logger.warn(
          {
            event: 'paddle_webhook_stale_event_ignored',
            event_type: params.eventType,
            shop_id: shopId,
            provider_customer_id: providerCustomerId,
            provider_subscription_id: providerSubscriptionId,
            event_at: eventTimestamp,
            latest_event_at: latestPaddleEventTimestamp(staleTarget),
          },
          'paddle_webhook_stale_event_ignored',
        );
        return {
          provider: 'paddle',
          shopId,
          customer,
          subscription: staleTarget,
          shopPlanChanged: false,
        };
      }
      const amount = extractMoneyAmount(params.payload);
      const period = extractPeriod(params.payload);
      const mappedInterval = mapPaddlePriceToInterval(params.payload);
      const providerPriceId = extractProviderPriceId(params.payload);
      const oldPeriodStart = parseOptionalDate(staleTarget?.currentPeriodStart);
      const oldPeriodEnd = parseOptionalDate(staleTarget?.currentPeriodEnd);
      const paymentMethodStatus: BillingSubscription['paymentMethodStatus'] = hasPaymentMethodEvidence(params.eventType, params.payload)
        ? 'valid'
        : mappedStatus === 'past_due' || mappedStatus === 'unpaid'
          ? 'failed'
          : staleTarget?.paymentMethodStatus === 'valid'
            ? 'valid'
            : 'unknown';
      const now = new Date().toISOString();

      const subscriptionPatch = {
        provider: 'paddle' as const,
        providerSubscriptionId: providerSubscriptionId ?? internalSubscription?.providerSubscriptionId ?? null,
        providerCustomerId: providerCustomerId ?? existingProviderSubscription?.providerCustomerId ?? internalSubscription?.providerCustomerId ?? null,
        providerPriceId,
        providerProductId: null,
        plan: mappedPlan,
        // Preserve existing status when the event carries no meaningful status (e.g. payment_method.saved)
        status: mappedStatus === 'unknown' ? (staleTarget?.status ?? 'unknown') : mappedStatus,
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
          latest_paddle_event_at: eventTimestamp ?? existingProviderSubscription?.metadata?.latest_paddle_event_at ?? internalSubscription?.metadata?.latest_paddle_event_at,
          latest_paddle_event_type: params.eventType,
        },
      };
      subscription = internalSubscription
        ? await this.deps.billingSubscriptionsRepository.updateById(internalSubscription.id, subscriptionPatch)
        : await this.deps.billingSubscriptionsRepository.upsert({
        shopId,
        ...subscriptionPatch,
      });
      if (!subscription) return null;

      const newPeriodStart = parseOptionalDate(subscription.currentPeriodStart);
      if (
        params.eventType.toLowerCase().includes('subscription.updated') &&
        oldPeriodStart &&
        oldPeriodEnd &&
        newPeriodStart &&
        newPeriodStart > oldPeriodStart
      ) {
        await this.processRenewalOverage(shop, oldPeriodStart, oldPeriodEnd);
      }

      // Only 'canceled' fully deactivates the account; 'past_due'/'paused' keeps
      // the dashboard accessible but suspends live calls until billing recovers.
      const shouldBeActive = subscription.status !== 'canceled';
      const shouldDisableLiveCalls = !['active', 'trialing'].includes(subscription.status);
      const existingPlan = shop.plan;
      const existingActive = shop.active;
      await this.deps.shopsRepository.updatePlanAndActivation(shopId, {
        plan: subscription.plan,
        active: shouldBeActive,
      });
      if (shouldDisableLiveCalls) {
        await this.deps.shopAccessStatesRepository?.upsert({
          shopId,
          liveCallsEnabled: false,
          liveCallsPausedReason: subscription.status,
          liveCallsPausedAt: new Date().toISOString(),
        });
      } else {
        await this.deps.shopAccessStatesRepository?.upsert({
          shopId,
          liveCallsEnabled: true,
          liveCallsPausedReason: null,
          liveCallsPausedAt: null,
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
        if (isStalePaddleEvent(current, eventTimestamp)) {
          logger.warn(
            {
              event: 'paddle_webhook_stale_event_ignored',
              event_type: params.eventType,
              shop_id: shopId,
              provider_customer_id: providerCustomerId,
              provider_subscription_id: current.providerSubscriptionId,
              event_at: eventTimestamp,
              latest_event_at: latestPaddleEventTimestamp(current),
            },
            'paddle_webhook_stale_event_ignored',
          );
          return {
            provider: 'paddle',
            shopId,
            customer,
            subscription: current,
            shopPlanChanged: false,
          };
        }
        const paymentMethodStatus: BillingSubscription['paymentMethodStatus'] =
          eventType.includes('payment_method.saved')
            ? 'valid'
            : eventType.includes('payment_method.deleted') || eventType.includes('transaction.payment_failed')
              ? 'failed'
              : current.paymentMethodStatus;
        const subscription = await this.deps.billingSubscriptionsRepository.updateById(current.id, {
          provider: 'paddle',
          providerCustomerId: providerCustomerId ?? current.providerCustomerId ?? null,
          paymentMethodStatus,
          paymentMethodAddedAt: paymentMethodStatus === 'valid' ? new Date().toISOString() : current.paymentMethodAddedAt ?? null,
          metadata: {
            ...(current.metadata ?? {}),
            last_paddle_event_type: params.eventType,
            last_paddle_event_payload: params.payload,
            latest_paddle_event_at: eventTimestamp ?? current.metadata?.latest_paddle_event_at,
            latest_paddle_event_type: params.eventType,
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
