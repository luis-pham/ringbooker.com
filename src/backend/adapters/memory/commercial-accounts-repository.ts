
import type { CommercialAccount } from '@/src/backend/domain/types';
import type { CommercialAccountsRepository } from '@/src/backend/ports/repositories';

export class InMemoryCommercialAccountsRepository implements CommercialAccountsRepository {
  private readonly records = new Map<string, CommercialAccount>();

  async findByShopId(shopId: string): Promise<CommercialAccount | null> {
    return this.records.get(shopId) ?? null;
  }

  async upsert(params: CommercialAccount): Promise<CommercialAccount> {
    const now = new Date().toISOString();
    const current = this.records.get(params.shopId);
    const next: CommercialAccount = { ...current, ...params, createdAt: current?.createdAt ?? now, updatedAt: now };
    this.records.set(params.shopId, next);
    return next;
  }
}
