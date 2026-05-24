import { randomUUID } from 'node:crypto';

import type { ShopUsageAlert, ShopUsageAlertType } from '@/src/backend/domain/types';
import type { ShopUsageAlertsRepository } from '@/src/backend/ports/repositories';

export class InMemoryShopUsageAlertsRepository implements ShopUsageAlertsRepository {
  private readonly records = new Map<string, ShopUsageAlert>();

  async findByIdempotencyKey(idempotencyKey: string): Promise<ShopUsageAlert | null> {
    return this.records.get(idempotencyKey) ?? null;
  }

  async create(params: {
    shopId: string;
    alertType: ShopUsageAlertType;
    periodStart: Date;
    idempotencyKey: string;
  }): Promise<ShopUsageAlert> {
    const record: ShopUsageAlert = {
      id: `sua_${randomUUID()}`,
      shopId: params.shopId,
      alertType: params.alertType,
      periodStart: params.periodStart.toISOString(),
      sentAt: new Date().toISOString(),
      idempotencyKey: params.idempotencyKey,
    };
    this.records.set(record.idempotencyKey, record);
    return record;
  }
}
