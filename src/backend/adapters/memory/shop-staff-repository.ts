import { randomUUID } from 'node:crypto';

import type { ShopStaff, ShopStaffExternalProvider, ShopStaffService } from '@/src/backend/domain/types';
import type { ShopStaffRepository, ShopStaffServicesRepository, UpsertShopStaff } from '@/src/backend/ports/repositories';

export class InMemoryShopStaffRepository implements ShopStaffRepository {
  private readonly staff = new Map<string, ShopStaff>();

  async findByShopId(shopId: string): Promise<ShopStaff[]> {
    return [...this.staff.values()].filter((staff) => staff.shopId === shopId);
  }

  async findByExternalId(
    shopId: string,
    provider: ShopStaffExternalProvider,
    externalStaffId: string,
  ): Promise<ShopStaff | null> {
    return (
      [...this.staff.values()].find(
        (staff) =>
          staff.shopId === shopId &&
          staff.externalProvider === provider &&
          staff.externalStaffId === externalStaffId,
      ) ?? null
    );
  }

  async upsert(input: UpsertShopStaff): Promise<ShopStaff> {
    const existing = await this.findByExternalId(input.shopId, input.externalProvider, input.externalStaffId);
    const now = new Date().toISOString();
    const record: ShopStaff = {
      id: existing?.id ?? `shop-staff-${randomUUID()}`,
      shopId: input.shopId,
      name: input.name,
      role: input.role ?? null,
      specialties: input.specialties ?? [],
      notes: input.notes ?? null,
      active: input.active !== false,
      externalProvider: input.externalProvider,
      externalStaffId: input.externalStaffId,
      externalMetadata: input.externalMetadata ?? {},
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.staff.set(record.id, record);
    return record;
  }

  async bulkUpsertFromSync(
    shopId: string,
    staff: UpsertShopStaff[],
  ): Promise<{ created: number; updated: number; skipped: number }> {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const item of staff) {
      if (item.shopId !== shopId) {
        skipped += 1;
        continue;
      }
      const existing = await this.findByExternalId(item.shopId, item.externalProvider, item.externalStaffId);
      await this.upsert(item);
      if (existing) updated += 1;
      else created += 1;
    }
    return { created, updated, skipped };
  }

  async deactivateNotInList(
    shopId: string,
    provider: ShopStaffExternalProvider,
    activeExternalIds: string[],
  ): Promise<number> {
    const keep = new Set(activeExternalIds);
    let count = 0;
    for (const [id, staff] of this.staff.entries()) {
      if (staff.shopId !== shopId || staff.externalProvider !== provider) continue;
      if (staff.externalStaffId && keep.has(staff.externalStaffId)) continue;
      this.staff.set(id, {
        ...staff,
        active: false,
        updatedAt: new Date().toISOString(),
      });
      count += 1;
    }
    return count;
  }
}

export class InMemoryShopStaffServicesRepository implements ShopStaffServicesRepository {
  private readonly mappings = new Map<string, ShopStaffService>();

  async setMappingsForStaff(
    shopId: string,
    staffId: string,
    serviceIds: string[],
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    for (const serviceId of [...new Set(serviceIds.filter(Boolean))]) {
      const existing = [...this.mappings.values()].find(
        (mapping) => mapping.shopId === shopId && mapping.staffId === staffId && mapping.serviceId === serviceId,
      );
      if (existing) {
        skipped += 1;
        continue;
      }
      const record: ShopStaffService = {
        id: `shop-staff-service-${randomUUID()}`,
        shopId,
        staffId,
        serviceId,
        createdAt: new Date().toISOString(),
      };
      this.mappings.set(record.id, record);
      created += 1;
    }
    return { created, skipped };
  }

  async getServiceIdsByStaffId(shopId: string, staffId: string): Promise<string[]> {
    return [...this.mappings.values()]
      .filter((mapping) => mapping.shopId === shopId && mapping.staffId === staffId)
      .map((mapping) => mapping.serviceId);
  }

  async getStaffIdsByServiceId(shopId: string, serviceId: string): Promise<string[]> {
    return [...this.mappings.values()]
      .filter((mapping) => mapping.shopId === shopId && mapping.serviceId === serviceId)
      .map((mapping) => mapping.staffId);
  }

  async listByShopId(shopId: string): Promise<ShopStaffService[]> {
    return [...this.mappings.values()].filter((mapping) => mapping.shopId === shopId);
  }
}
