import { randomUUID } from 'node:crypto';

import type { ShopOverageCharge, ShopOverageChargeStatus } from '@/src/backend/domain/types';
import type { ShopOverageChargesRepository } from '@/src/backend/ports/repositories';

function sortByPeriodStartDescending(input: ShopOverageCharge[]): ShopOverageCharge[] {
  return [...input].sort((a, b) => b.periodStart.localeCompare(a.periodStart));
}

export class InMemoryShopOverageChargesRepository implements ShopOverageChargesRepository {
  private readonly records = new Map<string, ShopOverageCharge>();

  async findByIdempotencyKey(idempotencyKey: string): Promise<ShopOverageCharge | null> {
    return this.records.get(idempotencyKey) ?? null;
  }

  async create(params: {
    shopId: string;
    billingSubscriptionId?: string | null;
    periodStart: Date;
    periodEnd: Date;
    includedCallers: number;
    capturedCallers: number;
    overageCallers: number;
    rateCents: number;
    amountCents: number;
    paddleSubscriptionId?: string | null;
    paddleTransactionId?: string | null;
    status: ShopOverageChargeStatus;
    idempotencyKey: string;
  }): Promise<ShopOverageCharge> {
    const now = new Date().toISOString();
    const record: ShopOverageCharge = {
      id: `soc_${randomUUID()}`,
      shopId: params.shopId,
      billingSubscriptionId: params.billingSubscriptionId ?? null,
      periodStart: params.periodStart.toISOString(),
      periodEnd: params.periodEnd.toISOString(),
      includedCallers: params.includedCallers,
      capturedCallers: params.capturedCallers,
      overageCallers: params.overageCallers,
      rateCents: params.rateCents,
      amountCents: params.amountCents,
      paddleSubscriptionId: params.paddleSubscriptionId ?? null,
      paddleTransactionId: params.paddleTransactionId ?? null,
      status: params.status,
      idempotencyKey: params.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(record.idempotencyKey, record);
    return record;
  }

  async updateStatus(
    idempotencyKey: string,
    status: ShopOverageChargeStatus,
    paddleTransactionId?: string | null,
  ): Promise<void> {
    const existing = this.records.get(idempotencyKey);
    if (!existing) return;
    this.records.set(idempotencyKey, {
      ...existing,
      status,
      paddleTransactionId: paddleTransactionId !== undefined ? paddleTransactionId : existing.paddleTransactionId,
      updatedAt: new Date().toISOString(),
    });
  }

  async listByShopId(shopId: string, params?: { limit?: number }): Promise<ShopOverageCharge[]> {
    const limit = params?.limit && params.limit > 0 ? params.limit : 50;
    return sortByPeriodStartDescending([...this.records.values()].filter((record) => record.shopId === shopId)).slice(0, limit);
  }

  async listCharged(params?: { limit?: number }): Promise<ShopOverageCharge[]> {
    const limit = params?.limit && params.limit > 0 ? params.limit : 1000;
    return sortByPeriodStartDescending([...this.records.values()].filter((record) => record.status === 'charged')).slice(0, limit);
  }
}
