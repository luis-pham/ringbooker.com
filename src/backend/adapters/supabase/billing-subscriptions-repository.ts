import type { SupabaseClient } from '@supabase/supabase-js';

import type { BillingInterval, BillingSubscription, BillingSubscriptionStatus } from '@/src/backend/domain/types';
import type { BillingSubscriptionsRepository } from '@/src/backend/ports/repositories';

type BillingSubscriptionsRow = {
  id: string;
  shop_id: string;
  provider: BillingSubscription['provider'];
  provider_subscription_id: string;
  provider_customer_id: string | null;
  plan: BillingSubscription['plan'];
  status: BillingSubscriptionStatus;
  interval: BillingInterval;
  currency: string;
  amount: number;
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
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
    plan: row.plan,
    status: row.status,
    interval: row.interval,
    currency: row.currency,
    amount: row.amount,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    trialEndsAt: row.trial_ends_at,
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

  async upsert(params: {
    shopId: string;
    provider: BillingSubscription['provider'];
    providerSubscriptionId: string;
    providerCustomerId?: string | null;
    plan: BillingSubscription['plan'];
    status: BillingSubscription['status'];
    interval: BillingSubscription['interval'];
    currency: string;
    amount: number;
    cancelAtPeriodEnd?: boolean;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    trialEndsAt?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<BillingSubscription> {
    const { data, error } = await this.supabase
      .from('billing_subscriptions')
      .upsert(
        {
          shop_id: params.shopId,
          provider: params.provider,
          provider_subscription_id: params.providerSubscriptionId,
          provider_customer_id: params.providerCustomerId ?? null,
          plan: params.plan,
          status: params.status,
          interval: params.interval,
          currency: params.currency,
          amount: params.amount,
          cancel_at_period_end: params.cancelAtPeriodEnd ?? false,
          current_period_start: params.currentPeriodStart ?? null,
          current_period_end: params.currentPeriodEnd ?? null,
          trial_ends_at: params.trialEndsAt ?? null,
          metadata: params.metadata ?? null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'provider,provider_subscription_id',
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
