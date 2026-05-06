import { randomUUID } from 'node:crypto';

import type { CommercialGoLiveApprovalEvent } from '@/src/backend/domain/types';
import type { CommercialGoLiveApprovalEventsRepository } from '@/src/backend/ports/repositories';

export class InMemoryCommercialGoLiveApprovalEventsRepository implements CommercialGoLiveApprovalEventsRepository {
  private readonly events: CommercialGoLiveApprovalEvent[] = [];

  async create(params: {
    shopId: string;
    eventType: CommercialGoLiveApprovalEvent['eventType'];
    actorEmail: string;
    note?: string | null;
    createdAt?: string;
  }): Promise<CommercialGoLiveApprovalEvent> {
    const event: CommercialGoLiveApprovalEvent = {
      id: `cgl_${randomUUID()}`,
      shopId: params.shopId,
      eventType: params.eventType,
      actorEmail: params.actorEmail,
      note: params.note ?? null,
      createdAt: params.createdAt ?? new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }

  async listByShopId(shopId: string, limit = 20): Promise<CommercialGoLiveApprovalEvent[]> {
    return this.events
      .filter((event) => event.shopId === shopId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, Math.max(1, Math.min(limit, 100)));
  }
}
