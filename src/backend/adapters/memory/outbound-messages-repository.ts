import { randomUUID } from 'node:crypto';

import type { OutboundMessageRecord, OutboundMessagesRepository } from '@/src/backend/ports/repositories';

export class InMemoryOutboundMessagesRepository implements OutboundMessagesRepository {
  private readonly idempotencyKeys = new Set<string>();
  private readonly messages: OutboundMessageRecord[] = [];

  async create(params: {
    shopId: string;
    bookingId?: string;
    customerPhone: string;
    category: string;
    body: string;
    idempotencyKey: string;
    status: 'queued' | 'sent' | 'failed';
    providerMessageId?: string;
  }): Promise<void> {
    if (this.idempotencyKeys.has(params.idempotencyKey)) return;
    this.idempotencyKeys.add(params.idempotencyKey);
    const now = new Date().toISOString();
    this.messages.push({
      id: randomUUID(),
      shopId: params.shopId,
      bookingId: params.bookingId ?? null,
      customerPhone: params.customerPhone,
      category: params.category,
      body: params.body,
      status: params.status,
      providerMessageId: params.providerMessageId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  async listMissedCallSmsSentPhones(shopId: string, phones: string[]): Promise<Set<string>> {
    const phoneSet = new Set(phones);
    const sent = this.messages
      .filter((m) => m.shopId === shopId && m.category === 'missed_call' && phoneSet.has(m.customerPhone))
      .map((m) => m.customerPhone);
    return new Set(sent);
  }

  async listByBookingId(bookingId: string): Promise<OutboundMessageRecord[]> {
    return this.messages
      .filter((message) => message.bookingId === bookingId)
      .sort((a, b) => ((a.createdAt ?? '') > (b.createdAt ?? '') ? 1 : -1));
  }
}
