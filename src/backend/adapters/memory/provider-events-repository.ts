import type {
  ProviderEventProcessingState,
  ProviderEventRecord,
  ProviderEventsRepository,
} from '@/src/backend/ports/repositories';

type StoredProviderEvent = ProviderEventRecord & {
  processingError?: string;
  state: ProviderEventProcessingState;
};

function getDedupeKey(provider: string, providerEventId: string): string {
  return `${provider}:${providerEventId}`;
}

export class InMemoryProviderEventsRepository implements ProviderEventsRepository {
  private readonly processed = new Map<string, StoredProviderEvent>();

  async hasProcessed(provider: string, providerEventId: string): Promise<boolean> {
    return this.processed.has(getDedupeKey(provider, providerEventId));
  }

  async tryMarkProcessing(
    event: ProviderEventRecord,
    options?: { reacquireFailed?: boolean },
  ): Promise<{
    acquired: boolean;
    state?: ProviderEventProcessingState;
  }> {
    const dedupeKey = getDedupeKey(event.provider, event.providerEventId);
    const existing = this.processed.get(dedupeKey);
    if (existing) {
      if (options?.reacquireFailed && existing.state === 'failed') {
        this.processed.set(dedupeKey, { ...event, state: 'processing' });
        return { acquired: true, state: 'processing' };
      }
      return { acquired: false, state: existing.state };
    }
    this.processed.set(dedupeKey, { ...event, state: 'processing' });
    return { acquired: true, state: 'processing' };
  }

  async markProcessed(event: ProviderEventRecord): Promise<void> {
    this.processed.set(getDedupeKey(event.provider, event.providerEventId), {
      ...event,
      state: 'processed',
      processingError: undefined,
    });
  }

  async markProcessingError(provider: string, providerEventId: string, reason: string): Promise<void> {
    const dedupeKey = getDedupeKey(provider, providerEventId);
    const existing = this.processed.get(dedupeKey);
    if (!existing) return;
    existing.processingError = reason;
    existing.state = 'failed';
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
