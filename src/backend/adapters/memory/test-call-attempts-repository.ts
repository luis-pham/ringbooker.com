import { randomUUID } from 'node:crypto';

import type { TestCallAttempt } from '@/src/backend/domain/types';
import type { TestCallAttemptsRepository } from '@/src/backend/ports/repositories';

export class InMemoryTestCallAttemptsRepository implements TestCallAttemptsRepository {
  private readonly records = new Map<string, TestCallAttempt>();

  async create(params: Omit<TestCallAttempt, 'id' | 'createdAt'> & { createdAt?: string }): Promise<TestCallAttempt> {
    const now = new Date().toISOString();
    const record: TestCallAttempt = {
      id: `tca_${randomUUID()}`,
      createdAt: params.createdAt ?? now,
      ...params,
    };
    this.records.set(record.id, record);
    return record;
  }

  async countRecentByShopId(params: { shopId: string; since: Date; type?: TestCallAttempt['type'] }): Promise<number> {
    const sinceMs = params.since.getTime();
    return [...this.records.values()].filter((record) => {
      if (record.shopId !== params.shopId) return false;
      if (params.type && record.type !== params.type) return false;
      return new Date(record.createdAt ?? 0).getTime() >= sinceMs;
    }).length;
  }

  async countRecentByShopIds(params: {
    shopIds: string[];
    since: Date;
    type?: TestCallAttempt['type'];
  }): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const id of params.shopIds) counts.set(id, 0);
    const sinceMs = params.since.getTime();
    for (const record of this.records.values()) {
      if (!params.shopIds.includes(record.shopId)) continue;
      if (params.type && record.type !== params.type) continue;
      if (new Date(record.createdAt ?? 0).getTime() < sinceMs) continue;
      counts.set(record.shopId, (counts.get(record.shopId) ?? 0) + 1);
    }
    return counts;
  }

  async updateStatus(
    id: string,
    params: {
      status: TestCallAttempt['status'];
      errorReason?: string | null;
      completedAt?: string | null;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<TestCallAttempt | null> {
    const current = this.records.get(id);
    if (!current) return null;
    const next: TestCallAttempt = {
      ...current,
      status: params.status,
      errorReason: params.errorReason ?? current.errorReason ?? null,
      completedAt: params.completedAt ?? current.completedAt ?? null,
      metadata: params.metadata ?? current.metadata ?? null,
    };
    this.records.set(id, next);
    return next;
  }
}
