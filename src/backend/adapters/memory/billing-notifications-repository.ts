import { randomUUID } from 'node:crypto';

import type { BillingNotification } from '@/src/backend/domain/types';
import type { BillingNotificationsRepository } from '@/src/backend/ports/repositories';

function keyFor(params: {
  shopId: string;
  subscriptionId?: string | null;
  type: BillingNotification['type'];
  channel: BillingNotification['channel'];
}) {
  return `${params.shopId}:${params.subscriptionId ?? 'none'}:${params.type}:${params.channel}`;
}

export class InMemoryBillingNotificationsRepository implements BillingNotificationsRepository {
  private readonly records = new Map<string, BillingNotification>();

  async hasSent(params: {
    shopId: string;
    subscriptionId?: string | null;
    type: BillingNotification['type'];
    channel: BillingNotification['channel'];
  }): Promise<boolean> {
    return this.records.has(keyFor(params));
  }

  async markSent(params: {
    shopId: string;
    subscriptionId?: string | null;
    type: BillingNotification['type'];
    channel: BillingNotification['channel'];
    metadata?: Record<string, unknown> | null;
  }): Promise<BillingNotification> {
    const key = keyFor(params);
    const existing = this.records.get(key);
    if (existing) return existing;
    const record: BillingNotification = {
      id: `bn_${randomUUID()}`,
      shopId: params.shopId,
      subscriptionId: params.subscriptionId ?? null,
      type: params.type,
      channel: params.channel,
      sentAt: new Date().toISOString(),
      metadata: params.metadata ?? null,
    };
    this.records.set(key, record);
    return record;
  }
}
