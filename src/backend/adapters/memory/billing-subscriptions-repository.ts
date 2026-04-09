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
        plan: 'professional',
        status: 'active',
        interval: 'month',
        currency: 'USD',
        amount: 149,
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date('2026-04-01T00:00:00.000Z').toISOString(),
        currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z').toISOString(),
        trialEndsAt: null,
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
    const existing = await this.findByProviderSubscriptionId(params.provider, params.providerSubscriptionId);
    const now = new Date().toISOString();
    const next: BillingSubscription = {
      id: existing?.id ?? `bs_${randomUUID()}`,
      shopId: params.shopId,
      provider: params.provider,
      providerSubscriptionId: params.providerSubscriptionId,
      providerCustomerId: params.providerCustomerId ?? existing?.providerCustomerId ?? null,
      plan: params.plan,
      status: params.status,
      interval: params.interval,
      currency: params.currency,
      amount: params.amount,
      cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? existing?.cancelAtPeriodEnd ?? false,
      currentPeriodStart: params.currentPeriodStart ?? existing?.currentPeriodStart ?? null,
      currentPeriodEnd: params.currentPeriodEnd ?? existing?.currentPeriodEnd ?? null,
      trialEndsAt: params.trialEndsAt ?? existing?.trialEndsAt ?? null,
      metadata: params.metadata ?? existing?.metadata ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.records.set(next.id, next);
    return next;
  }
}
