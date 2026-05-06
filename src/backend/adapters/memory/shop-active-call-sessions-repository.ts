import type { ShopActiveCallSessionsRepository } from '@/src/backend/ports/repositories';

type ActiveSlot = {
  shopId: string;
  callSessionId: string;
  provider: string;
  startedAt: Date;
  expiresAt: Date;
  releasedAt?: Date | null;
  status: 'active' | 'released' | 'expired';
};

export class InMemoryShopActiveCallSessionsRepository implements ShopActiveCallSessionsRepository {
  private readonly slots: ActiveSlot[] = [];

  private expire(now: Date) {
    for (const slot of this.slots) {
      if (slot.status === 'active' && !slot.releasedAt && slot.expiresAt <= now) {
        slot.status = 'expired';
        slot.releasedAt = now;
      }
    }
  }

  async acquireSlot(params: {
    shopId: string;
    callSessionId: string;
    provider: string;
    limit: number;
    startedAt: Date;
    expiresAt: Date;
  }): Promise<{ acquired: boolean; activeCount: number; reason?: 'limit_reached' | 'duplicate_active' }> {
    this.expire(params.startedAt);
    const duplicate = this.slots.find(
      (s) => s.provider === params.provider && s.callSessionId === params.callSessionId && s.status === 'active' && !s.releasedAt,
    );
    const activeCount = await this.countActiveByShop({ shopId: params.shopId, now: params.startedAt });
    if (duplicate) return { acquired: true, activeCount, reason: 'duplicate_active' };
    if (activeCount >= params.limit) return { acquired: false, activeCount, reason: 'limit_reached' };
    this.slots.push({ ...params, status: 'active', releasedAt: null });
    return { acquired: true, activeCount: activeCount + 1 };
  }

  async releaseByCallSession(params: { provider: string; callSessionId: string; releasedAt?: Date }): Promise<void> {
    const releasedAt = params.releasedAt ?? new Date();
    for (const slot of this.slots) {
      if (slot.provider === params.provider && slot.callSessionId === params.callSessionId && slot.status === 'active' && !slot.releasedAt) {
        slot.status = 'released';
        slot.releasedAt = releasedAt;
      }
    }
  }

  async countActiveByShop(params: { shopId: string; now: Date }): Promise<number> {
    this.expire(params.now);
    return this.slots.filter(
      (s) => s.shopId === params.shopId && s.status === 'active' && !s.releasedAt && s.expiresAt > params.now,
    ).length;
  }
}
