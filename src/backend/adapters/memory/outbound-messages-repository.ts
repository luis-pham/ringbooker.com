import type { OutboundMessagesRepository } from '@/src/backend/ports/repositories';

export class InMemoryOutboundMessagesRepository implements OutboundMessagesRepository {
  private readonly idempotencyKeys = new Set<string>();

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
  }
}
