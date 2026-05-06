
import { randomUUID } from 'node:crypto';

import type { ShopRoutingRule } from '@/src/backend/domain/types';
import type { ShopRoutingRulesRepository } from '@/src/backend/ports/repositories';

export class InMemoryShopRoutingRulesRepository implements ShopRoutingRulesRepository {
  private readonly records = new Map<string, ShopRoutingRule>();

  async listByShopId(shopId: string, params?: { activeOnly?: boolean }): Promise<ShopRoutingRule[]> {
    return [...this.records.values()]
      .filter((r) => r.shopId === shopId && (!params?.activeOnly || r.active))
      .sort((a, b) => a.priority - b.priority || (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
  }

  async create(params: { shopId: string; locationId?: string | null; ruleType: string; conditionJson: Record<string, unknown>; actionJson: Record<string, unknown>; priority?: number; active?: boolean; }): Promise<ShopRoutingRule> {
    const now = new Date().toISOString();
    const record: ShopRoutingRule = { id: randomUUID(), shopId: params.shopId, locationId: params.locationId ?? null, ruleType: params.ruleType, conditionJson: params.conditionJson, actionJson: params.actionJson, priority: params.priority ?? 100, active: params.active ?? true, createdAt: now, updatedAt: now };
    this.records.set(record.id, record);
    return record;
  }

  async update(shopId: string, ruleId: string, patch: Partial<Omit<ShopRoutingRule, 'id' | 'shopId' | 'createdAt' | 'updatedAt'>>): Promise<ShopRoutingRule | null> {
    const current = this.records.get(ruleId);
    if (!current || current.shopId !== shopId) return null;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.records.set(ruleId, next);
    return next;
  }
}
