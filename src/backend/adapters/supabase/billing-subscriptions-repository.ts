import type { SupabaseClient } from '@supabase/supabase-js';

import type { BillingInterval, BillingSubscription, BillingSubscriptionStatus } from '@/src/backend/domain/types';
import type { BillingSubscriptionsRepository } from '@/src/backend/ports/repositories';

type BillingSubscriptionsRow = {
  id: string;
  shop_id: string;
  provider: BillingSubscription['provider'];
  provider_subscription_id: string | null;
  provider_customer_id: string | null;
  provider_price_id: string | null;
  provider_product_id: string | null;
  plan: BillingSubscription['plan'];
  status: BillingSubscriptionStatus;
  interval: BillingInterval;
  currency: string;
  amount: number;
  amount_cents: number | null;
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_expired_at: string | null;
  canceled_at: string | null;
  paused_at: string | null;
  payment_method_status: BillingSubscription['paymentMethodStatus'];
  payment_method_added_at: string | null;
  activated_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function toBillingSubscription(row: BillingSubscriptionsRow): BillingSubscription {
  return {
    id: row.id,
    shopId: row.shop_id,
    provider: row.provider,
    providerSubscriptionId: row.provider_subscription_id,
    providerCustomerId: row.provider_customer_id,
    providerPriceId: row.provider_price_id,
    providerProductId: row.provider_product_id,
    plan: row.plan,
    status: row.status,
    interval: row.interval,
    currency: row.currency,
    amount: row.amount,
    amountCents: row.amount_cents,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    trialExpiredAt: row.trial_expired_at,
    canceledAt: row.canceled_at,
    pausedAt: row.paused_at,
    paymentMethodStatus: row.payment_method_status,
    paymentMethodAddedAt: row.payment_method_added_at,
    activatedAt: row.activated_at,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseBillingSubscriptionsRepository implements BillingSubscriptionsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findCurrentByShopId(
    shopId: string,
    provider?: BillingSubscription['provider'],
  ): Promise<BillingSubscription | null> {
    let query = this.supabase
      .from('billing_subscriptions')
      .select('*')
      .eq('shop_id', shopId)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (provider) query = query.eq('provider', provider);
    const { data, error } = await query.maybeSingle<BillingSubscriptionsRow>();
    if (error) {
      throw new Error(`billing_subscriptions_find_current_by_shop_id_failed:${error.message}`);
    }
    return data ? toBillingSubscription(data) : null;
  }

  async findCurrentByShopIds(shopIds: string[]): Promise<Map<string, BillingSubscription | null>> {
    const result = new Map<string, BillingSubscription | null>();
    for (const id of shopIds) result.set(id, null);
    if (shopIds.length === 0) return result;

    const { data, error } = await this.supabase
      .from('billing_subscriptions')
      .select('*')
      .in('shop_id', shopIds)
      .order('updated_at', { ascending: false })
      .returns<BillingSubscriptionsRow[]>();
    if (error) {
      throw new Error(`billing_subscriptions_find_current_by_shop_ids_failed:${error.message}`);
    }
    const rows = data ?? [];
    const rowsSorted = [...rows].sort((a, b) =>
      String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')),
    );
    for (const row of rowsSorted) {
      const sub = toBillingSubscription(row);
      if (result.get(sub.shopId) !== null) continue;
      result.set(sub.shopId, sub);
    }
    return result;
  }

  async findById(id: string): Promise<BillingSubscription | null> {
    const { data, error } = await this.supabase
      .from('billing_subscriptions')
      .select('*')
      .eq('id', id)
      .maybeSingle<BillingSubscriptionsRow>();
    if (error) {
      throw new Error(`billing_subscriptions_find_by_id_failed:${error.message}`);
    }
    return data ? toBillingSubscription(data) : null;
  }

  async findByProviderSubscriptionId(
    provider: BillingSubscription['provider'],
    providerSubscriptionId: string,
  ): Promise<BillingSubscription | null> {
    const { data, error } = await this.supabase
      .from('billing_subscriptions')
      .select('*')
      .eq('provider', provider)
      .eq('provider_subscription_id', providerSubscriptionId)
      .maybeSingle<BillingSubscriptionsRow>();
    if (error) {
      throw new Error(`billing_subscriptions_find_by_provider_subscription_id_failed:${error.message}`);
    }
    return data ? toBillingSubscription(data) : null;
  }

  async list(params?: { limit?: number; shopId?: string }): Promise<BillingSubscription[]> {
    const limit = params?.limit && params.limit > 0 ? params.limit : 100;
    let query = this.supabase
      .from('billing_subscriptions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (params?.shopId) query = query.eq('shop_id', params.shopId);
    const { data, error } = await query.returns<BillingSubscriptionsRow[]>();
    if (error) {
      throw new Error(`billing_subscriptions_list_failed:${error.message}`);
    }
    return (data ?? []).map(toBillingSubscription);
  }

  async updateById(id: string, params: Partial<BillingSubscription>): Promise<BillingSubscription | null> {
    const patch: Partial<BillingSubscriptionsRow> & Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (params.provider !== undefined) patch.provider = params.provider;
    if (params.providerSubscriptionId !== undefined) patch.provider_subscription_id = params.providerSubscriptionId;
    if (params.providerCustomerId !== undefined) patch.provider_customer_id = params.providerCustomerId;
    if (params.providerPriceId !== undefined) patch.provider_price_id = params.providerPriceId;
    if (params.providerProductId !== undefined) patch.provider_product_id = params.providerProductId;
    if (params.plan !== undefined) patch.plan = params.plan;
    if (params.status !== undefined) patch.status = params.status;
    if (params.interval !== undefined) patch.interval = params.interval;
    if (params.currency !== undefined) patch.currency = params.currency;
    if (params.amount !== undefined) patch.amount = params.amount;
    if (params.amountCents !== undefined) patch.amount_cents = params.amountCents;
    if (params.cancelAtPeriodEnd !== undefined) patch.cancel_at_period_end = params.cancelAtPeriodEnd;
    if (params.currentPeriodStart !== undefined) patch.current_period_start = params.currentPeriodStart;
    if (params.currentPeriodEnd !== undefined) patch.current_period_end = params.currentPeriodEnd;
    if (params.trialStartedAt !== undefined) patch.trial_started_at = params.trialStartedAt;
    if (params.trialEndsAt !== undefined) patch.trial_ends_at = params.trialEndsAt;
    if (params.trialExpiredAt !== undefined) patch.trial_expired_at = params.trialExpiredAt;
    if (params.canceledAt !== undefined) patch.canceled_at = params.canceledAt;
    if (params.pausedAt !== undefined) patch.paused_at = params.pausedAt;
    if (params.paymentMethodStatus !== undefined) patch.payment_method_status = params.paymentMethodStatus;
    if (params.paymentMethodAddedAt !== undefined) patch.payment_method_added_at = params.paymentMethodAddedAt;
    if (params.activatedAt !== undefined) patch.activated_at = params.activatedAt;
    if (params.metadata !== undefined) patch.metadata = params.metadata;
    const { data, error } = await this.supabase
      .from('billing_subscriptions')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle<BillingSubscriptionsRow>();
    if (error) throw new Error(`billing_subscriptions_update_by_id_failed:${error.message}`);
    return data ? toBillingSubscription(data) : null;
  }

  async upsert(params: {
    shopId: string;
    provider: BillingSubscription['provider'];
    providerSubscriptionId?: string | null;
    providerCustomerId?: string | null;
    providerPriceId?: string | null;
    providerProductId?: string | null;
    plan: BillingSubscription['plan'];
    status: BillingSubscription['status'];
    interval: BillingSubscription['interval'];
    currency: string;
    amount: number;
    amountCents?: number | null;
    cancelAtPeriodEnd?: boolean;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    trialStartedAt?: string | null;
    trialEndsAt?: string | null;
    trialExpiredAt?: string | null;
    canceledAt?: string | null;
    pausedAt?: string | null;
    paymentMethodStatus?: BillingSubscription['paymentMethodStatus'];
    paymentMethodAddedAt?: string | null;
    activatedAt?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<BillingSubscription> {
    if (!params.providerSubscriptionId) {
      const existing = await this.findCurrentByShopId(params.shopId, params.provider);
      if (existing) {
        const { data, error } = await this.supabase
          .from('billing_subscriptions')
          .update({
            provider_customer_id: params.providerCustomerId ?? existing.providerCustomerId ?? null,
            provider_price_id: params.providerPriceId ?? existing.providerPriceId ?? null,
            provider_product_id: params.providerProductId ?? existing.providerProductId ?? null,
            plan: params.plan,
            status: params.status,
            interval: params.interval,
            currency: params.currency,
            amount: params.amount,
            amount_cents: params.amountCents ?? existing.amountCents ?? Math.round(params.amount * 100),
            cancel_at_period_end: params.cancelAtPeriodEnd ?? existing.cancelAtPeriodEnd ?? false,
            current_period_start: params.currentPeriodStart ?? existing.currentPeriodStart ?? null,
            current_period_end: params.currentPeriodEnd ?? existing.currentPeriodEnd ?? null,
            trial_started_at: params.trialStartedAt ?? existing.trialStartedAt ?? null,
            trial_ends_at: params.trialEndsAt ?? existing.trialEndsAt ?? null,
            trial_expired_at: params.trialExpiredAt ?? existing.trialExpiredAt ?? null,
            canceled_at: params.canceledAt ?? existing.canceledAt ?? null,
            paused_at: params.pausedAt ?? existing.pausedAt ?? null,
            payment_method_status: params.paymentMethodStatus ?? existing.paymentMethodStatus ?? 'none',
            payment_method_added_at: params.paymentMethodAddedAt ?? existing.paymentMethodAddedAt ?? null,
            activated_at: params.activatedAt ?? existing.activatedAt ?? null,
            metadata: params.metadata ?? existing.metadata ?? {},
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('*')
          .single<BillingSubscriptionsRow>();
        if (error) throw new Error(`billing_subscriptions_upsert_failed:${error.message}`);
        return toBillingSubscription(data);
      }
      const { data, error } = await this.supabase
        .from('billing_subscriptions')
        .insert({
          shop_id: params.shopId,
          provider: params.provider,
          provider_subscription_id: null,
          provider_customer_id: params.providerCustomerId ?? null,
          provider_price_id: params.providerPriceId ?? null,
          provider_product_id: params.providerProductId ?? null,
          plan: params.plan,
          status: params.status,
          interval: params.interval,
          currency: params.currency,
          amount: params.amount,
          amount_cents: params.amountCents ?? Math.round(params.amount * 100),
          cancel_at_period_end: params.cancelAtPeriodEnd ?? false,
          current_period_start: params.currentPeriodStart ?? null,
          current_period_end: params.currentPeriodEnd ?? null,
          trial_started_at: params.trialStartedAt ?? null,
          trial_ends_at: params.trialEndsAt ?? null,
          trial_expired_at: params.trialExpiredAt ?? null,
          canceled_at: params.canceledAt ?? null,
          paused_at: params.pausedAt ?? null,
          payment_method_status: params.paymentMethodStatus ?? 'none',
          payment_method_added_at: params.paymentMethodAddedAt ?? null,
          activated_at: params.activatedAt ?? null,
          metadata: params.metadata ?? {},
        })
        .select('*')
        .single<BillingSubscriptionsRow>();
      if (error) throw new Error(`billing_subscriptions_upsert_failed:${error.message}`);
      return toBillingSubscription(data);
    }

    const { data, error } = await this.supabase
      .from('billing_subscriptions')
      .upsert(
        {
          shop_id: params.shopId,
          provider: params.provider,
          provider_subscription_id: params.providerSubscriptionId,
          provider_customer_id: params.providerCustomerId ?? null,
          provider_price_id: params.providerPriceId ?? null,
          provider_product_id: params.providerProductId ?? null,
          plan: params.plan,
          status: params.status,
          interval: params.interval,
          currency: params.currency,
          amount: params.amount,
          amount_cents: params.amountCents ?? Math.round(params.amount * 100),
          cancel_at_period_end: params.cancelAtPeriodEnd ?? false,
          current_period_start: params.currentPeriodStart ?? null,
          current_period_end: params.currentPeriodEnd ?? null,
          trial_started_at: params.trialStartedAt ?? null,
          trial_ends_at: params.trialEndsAt ?? null,
          trial_expired_at: params.trialExpiredAt ?? null,
          canceled_at: params.canceledAt ?? null,
          paused_at: params.pausedAt ?? null,
          payment_method_status: params.paymentMethodStatus ?? 'none',
          payment_method_added_at: params.paymentMethodAddedAt ?? null,
          activated_at: params.activatedAt ?? null,
          metadata: params.metadata ?? null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: params.providerSubscriptionId ? 'provider,provider_subscription_id' : 'shop_id,provider',
        },
      )
      .select('*')
      .single<BillingSubscriptionsRow>();
    if (error) {
      throw new Error(`billing_subscriptions_upsert_failed:${error.message}`);
    }
    return toBillingSubscription(data);
  }
}
