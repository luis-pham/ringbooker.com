import type { ProviderEventRecord, ProviderEventsRepository } from '@/src/backend/ports/repositories';

type StoredProviderEvent = ProviderEventRecord & {
  processingError?: string;
};

function getDedupeKey(provider: string, providerEventId: string): string {
  return `${provider}:${providerEventId}`;
}

export class InMemoryProviderEventsRepository implements ProviderEventsRepository {
  private readonly processed = new Map<string, StoredProviderEvent>();

  async hasProcessed(provider: string, providerEventId: string): Promise<boolean> {
    return this.processed.has(getDedupeKey(provider, providerEventId));
  }

  async markProcessed(event: ProviderEventRecord): Promise<void> {
    this.processed.set(getDedupeKey(event.provider, event.providerEventId), {
      ...event,
      processingError: undefined,
    });
  }

  async markProcessingError(provider: string, providerEventId: string, reason: string): Promise<void> {
    const dedupeKey = getDedupeKey(provider, providerEventId);
    const existing = this.processed.get(dedupeKey);
    if (!existing) return;
    existing.processingError = reason;
    this.processed.set(dedupeKey, existing);
  }

  async clearProcessingError(provider: string, providerEventId: string): Promise<void> {
    const dedupeKey = getDedupeKey(provider, providerEventId);
    const existing = this.processed.get(dedupeKey);
    if (!existing) return;
    existing.processingError = undefined;
    this.processed.set(dedupeKey, existing);
  }
}
