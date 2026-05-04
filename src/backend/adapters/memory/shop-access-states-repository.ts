import { randomUUID } from 'node:crypto';

import type { ShopAccessState } from '@/src/backend/domain/types';
import type { ShopAccessStatesRepository } from '@/src/backend/ports/repositories';

export class InMemoryShopAccessStatesRepository implements ShopAccessStatesRepository {
  private readonly records = new Map<string, ShopAccessState>();

  async findByShopId(shopId: string): Promise<ShopAccessState | null> {
    return [...this.records.values()].find((record) => record.shopId === shopId) ?? null;
  }

  async upsert(params: {
    shopId: string;
    liveCallsEnabled?: boolean;
    goLiveAt?: string | null;
    liveCallsPausedReason?: string | null;
    liveCallsPausedAt?: string | null;
    lastAccessCheckAt?: string | null;
  }): Promise<ShopAccessState> {
    const existing = await this.findByShopId(params.shopId);
    const now = new Date().toISOString();
    const next: ShopAccessState = {
      id: existing?.id ?? `sas_${randomUUID()}`,
      shopId: params.shopId,
      liveCallsEnabled: params.liveCallsEnabled ?? existing?.liveCallsEnabled ?? false,
      goLiveAt: params.goLiveAt ?? existing?.goLiveAt ?? null,
      liveCallsPausedReason: params.liveCallsPausedReason ?? existing?.liveCallsPausedReason ?? null,
      liveCallsPausedAt: params.liveCallsPausedAt ?? existing?.liveCallsPausedAt ?? null,
      lastAccessCheckAt: params.lastAccessCheckAt ?? existing?.lastAccessCheckAt ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.records.set(next.id, next);
    return next;
  }
}
