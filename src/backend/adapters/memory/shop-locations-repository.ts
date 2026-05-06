
import { randomUUID } from 'node:crypto';

import type { ShopLocation } from '@/src/backend/domain/types';
import type { ShopLocationsRepository } from '@/src/backend/ports/repositories';

export class InMemoryShopLocationsRepository implements ShopLocationsRepository {
  private readonly records = new Map<string, ShopLocation>();

  async listByShopId(shopId: string): Promise<ShopLocation[]> {
    return [...this.records.values()].filter((r) => r.shopId === shopId).sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
  }

  async create(params: { shopId: string; name: string; address?: string | null; timezone: string; phoneNumber?: string | null; telnyxNumber?: string | null; businessHours?: Record<string, unknown>; active?: boolean; }): Promise<ShopLocation> {
    const now = new Date().toISOString();
    const record: ShopLocation = { id: randomUUID(), shopId: params.shopId, name: params.name, address: params.address ?? null, timezone: params.timezone, phoneNumber: params.phoneNumber ?? null, telnyxNumber: params.telnyxNumber ?? null, businessHours: (params.businessHours ?? {}) as ShopLocation['businessHours'], active: params.active ?? true, createdAt: now, updatedAt: now };
    this.records.set(record.id, record);
    return record;
  }

  async update(shopId: string, locationId: string, patch: Partial<Omit<ShopLocation, 'id' | 'shopId' | 'createdAt' | 'updatedAt'>>): Promise<ShopLocation | null> {
    const current = this.records.get(locationId);
    if (!current || current.shopId !== shopId) return null;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.records.set(locationId, next);
    return next;
  }
}
