import { randomUUID } from 'node:crypto';

import type { BillingSubscription } from '@/src/backend/domain/types';
import type { BillingSubscriptionsRepository } from '@/src/backend/ports/repositories';

function sortByUpdatedAtDescending(input: BillingSubscription[]): BillingSubscription[] {
  return [...input].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

export class InMemoryBillingSubscriptionsRepository implements BillingSubscriptionsRepository {
  private readonly records = new Map<string, BillingSubscription>([
    [
      'bs_demo',
      {
        id: 'bs_demo',
        shopId: 'demo-shop',
        provider: 'paddle',
        providerSubscriptionId: 'sub_demo_paddle',
        providerCustomerId: 'ctm_demo_paddle',
        providerPriceId: process.env.PADDLE_PRICE_PROFESSIONAL ?? null,
        providerProductId: null,
        plan: 'professional',
        status: 'active',
        interval: 'month',
        currency: 'USD',
        amount: 149,
        amountCents: 14900,
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date('2026-04-01T00:00:00.000Z').toISOString(),
        currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z').toISOString(),
        trialStartedAt: null,
        trialEndsAt: null,
        trialExpiredAt: null,
        canceledAt: null,
        pausedAt: null,
        paymentMethodStatus: 'valid',
        paymentMethodAddedAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
        activatedAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
        metadata: { seeded: true },
        createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        updatedAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
      },
    ],
  ]);

  async findCurrentByShopId(shopId: string, provider?: BillingSubscription['provider']): Promise<BillingSubscription | null> {
    const matches = [...this.records.values()].filter((record) => {
      if (record.shopId !== shopId) return false;
      if (provider && record.provider !== provider) return false;
      return true;
    });
    return sortByUpdatedAtDescending(matches)[0] ?? null;
  }

  async findCurrentByShopIds(shopIds: string[]): Promise<Map<string, BillingSubscription | null>> {
    const result = new Map<string, BillingSubscription | null>();
    for (const id of shopIds) {
      result.set(id, null);
    }
    for (const id of shopIds) {
      const current = await this.findCurrentByShopId(id);
      result.set(id, current);
    }
    return result;
  }

  async findById(id: string): Promise<BillingSubscription | null> {
    return this.records.get(id) ?? null;
  }

  async findByProviderSubscriptionId(
    provider: BillingSubscription['provider'],
    providerSubscriptionId: string,
  ): Promise<BillingSubscription | null> {
    for (const record of this.records.values()) {
      if (record.provider === provider && record.providerSubscriptionId === providerSubscriptionId) {
        return record;
      }
    }
    return null;
  }

  async list(params?: { limit?: number; shopId?: string }): Promise<BillingSubscription[]> {
    const limit = params?.limit && params.limit > 0 ? params.limit : 100;
    const matches = [...this.records.values()].filter((record) => {
      if (params?.shopId && record.shopId !== params.shopId) return false;
      return true;
    });
    return sortByUpdatedAtDescending(matches).slice(0, limit);
  }

  async updateById(id: string, params: Partial<BillingSubscription>): Promise<BillingSubscription | null> {
    const existing = this.records.get(id);
    if (!existing) return null;
    const next: BillingSubscription = {
      ...existing,
      ...params,
      metadata: params.metadata ?? existing.metadata ?? null,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(id, next);
    return next;
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
    const existing = params.providerSubscriptionId
      ? await this.findByProviderSubscriptionId(params.provider, params.providerSubscriptionId)
      : await this.findCurrentByShopId(params.shopId, params.provider);
    const now = new Date().toISOString();
    const next: BillingSubscription = {
      id: existing?.id ?? `bs_${randomUUID()}`,
      shopId: params.shopId,
      provider: params.provider,
      providerSubscriptionId: params.providerSubscriptionId ?? existing?.providerSubscriptionId ?? null,
      providerCustomerId: params.providerCustomerId ?? existing?.providerCustomerId ?? null,
      providerPriceId: params.providerPriceId ?? existing?.providerPriceId ?? null,
      providerProductId: params.providerProductId ?? existing?.providerProductId ?? null,
      plan: params.plan,
      status: params.status,
      interval: params.interval,
      currency: params.currency,
      amount: params.amount,
      amountCents: params.amountCents ?? existing?.amountCents ?? Math.round(params.amount * 100),
      cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? existing?.cancelAtPeriodEnd ?? false,
      currentPeriodStart: params.currentPeriodStart ?? existing?.currentPeriodStart ?? null,
      currentPeriodEnd: params.currentPeriodEnd ?? existing?.currentPeriodEnd ?? null,
      trialStartedAt: params.trialStartedAt ?? existing?.trialStartedAt ?? null,
      trialEndsAt: params.trialEndsAt ?? existing?.trialEndsAt ?? null,
      trialExpiredAt: params.trialExpiredAt ?? existing?.trialExpiredAt ?? null,
      canceledAt: params.canceledAt ?? existing?.canceledAt ?? null,
      pausedAt: params.pausedAt ?? existing?.pausedAt ?? null,
      paymentMethodStatus: params.paymentMethodStatus ?? existing?.paymentMethodStatus ?? 'none',
      paymentMethodAddedAt: params.paymentMethodAddedAt ?? existing?.paymentMethodAddedAt ?? null,
      activatedAt: params.activatedAt ?? existing?.activatedAt ?? null,
      metadata: params.metadata ?? existing?.metadata ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.records.set(next.id, next);
    return next;
  }
}
