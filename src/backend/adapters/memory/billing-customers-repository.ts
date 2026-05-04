import { randomUUID } from 'node:crypto';

import type { BillingCustomer } from '@/src/backend/domain/types';
import type { BillingCustomersRepository } from '@/src/backend/ports/repositories';

export class InMemoryBillingCustomersRepository implements BillingCustomersRepository {
  private readonly records = new Map<string, BillingCustomer>([
    [
      'bc_demo',
      {
        id: 'bc_demo',
        shopId: 'demo-shop',
        provider: 'paddle',
        providerCustomerId: 'ctm_demo_paddle',
        email: 'user@ringbooker.local',
        name: 'RingBooker Demo Salon',
        metadata: { seeded: true },
        createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      },
    ],
  ]);

  async findByShopId(shopId: string, provider?: BillingCustomer['provider']): Promise<BillingCustomer | null> {
    for (const record of this.records.values()) {
      if (record.shopId !== shopId) continue;
      if (provider && record.provider !== provider) continue;
      return record;
    }
    return null;
  }

  async findByProviderCustomerId(
    provider: BillingCustomer['provider'],
    providerCustomerId: string,
  ): Promise<BillingCustomer | null> {
    for (const record of this.records.values()) {
      if (record.provider === provider && record.providerCustomerId === providerCustomerId) {
        return record;
      }
    }
    return null;
  }

  async upsert(params: {
    shopId: string;
    provider: BillingCustomer['provider'];
    providerCustomerId?: string | null;
    email?: string | null;
    name?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<BillingCustomer> {
    const existing = params.providerCustomerId
      ? await this.findByProviderCustomerId(params.provider, params.providerCustomerId)
      : await this.findByShopId(params.shopId, params.provider);
    const now = new Date().toISOString();
    const next: BillingCustomer = {
      id: existing?.id ?? `bc_${randomUUID()}`,
      shopId: params.shopId,
      provider: params.provider,
      providerCustomerId: params.providerCustomerId ?? existing?.providerCustomerId ?? null,
      email: params.email ?? existing?.email ?? null,
      name: params.name ?? existing?.name ?? null,
      metadata: params.metadata ?? existing?.metadata ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.records.set(next.id, next);
    return next;
  }
}
