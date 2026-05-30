import { randomUUID } from 'node:crypto';

import type { VagaroWebhookEvent } from '@/src/backend/domain/types';
import type { VagaroWebhookEventsRepository } from '@/src/backend/ports/repositories';

export class InMemoryVagaroWebhookEventsRepository implements VagaroWebhookEventsRepository {
  private readonly events: VagaroWebhookEvent[] = [];

  async save(event: Omit<VagaroWebhookEvent, 'id'>): Promise<void> {
    this.events.push({
      id: randomUUID(),
      ...event,
    });
  }

  list(): VagaroWebhookEvent[] {
    return [...this.events];
  }
}
