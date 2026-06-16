import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ProviderEventProcessingState,
  ProviderEventRecord,
  ProviderEventsRepository,
} from '@/src/backend/ports/repositories';

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '23505' || /duplicate key|unique/i.test(error?.message ?? '');
}

export class SupabaseProviderEventsRepository implements ProviderEventsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async hasProcessed(provider: string, providerEventId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('provider_events')
      .select('id')
      .eq('provider', provider)
      .eq('provider_event_id', providerEventId)
      .maybeSingle();

    if (error) {
      throw new Error(`provider_events_has_processed_failed:${error.message}`);
    }

    return Boolean(data);
  }

  async tryMarkProcessing(
    event: ProviderEventRecord,
    options?: { reacquireFailed?: boolean },
  ): Promise<{
    acquired: boolean;
    state?: ProviderEventProcessingState;
  }> {
    const { error } = await this.supabase.from('provider_events').insert({
      provider: event.provider,
      provider_event_id: event.providerEventId,
      event_type: event.eventType,
      payload_raw: event.payload,
      processed_at: null,
      processing_error: null,
    });

    if (isUniqueViolation(error)) {
      if (options?.reacquireFailed) {
        // Conditional UPDATE keeps this race-safe: concurrent retries serialize on the row
        // lock and only the first one still sees `processing_error` set.
        const { data: reacquired, error: reacquireError } = await this.supabase
          .from('provider_events')
          .update({
            payload_raw: event.payload,
            processed_at: null,
            processing_error: null,
          })
          .eq('provider', event.provider)
          .eq('provider_event_id', event.providerEventId)
          .not('processing_error', 'is', null)
          .select('id');
        if (reacquireError) {
          throw new Error(`provider_events_try_mark_processing_failed:${reacquireError.message}`);
        }
        if ((reacquired ?? []).length > 0) {
          return { acquired: true, state: 'processing' };
        }
      }
      return { acquired: false, state: 'processing' };
    }
    if (error) {
      throw new Error(`provider_events_try_mark_processing_failed:${error.message}`);
    }
    return { acquired: true, state: 'processing' };
  }

  async markProcessed(event: ProviderEventRecord): Promise<void> {
    const { error } = await this.supabase.from('provider_events').upsert(
      {
        provider: event.provider,
        provider_event_id: event.providerEventId,
        event_type: event.eventType,
        payload_raw: event.payload,
        processed_at: new Date().toISOString(),
      },
      {
        onConflict: 'provider,provider_event_id',
        ignoreDuplicates: false,
      },
    );

    if (error) {
      throw new Error(`provider_events_mark_processed_failed:${error.message}`);
    }
  }

  async markProcessingError(provider: string, providerEventId: string, reason: string): Promise<void> {
    const { error } = await this.supabase
      .from('provider_events')
      .update({
        processing_error: reason,
        processed_at: new Date().toISOString(),
      })
      .eq('provider', provider)
      .eq('provider_event_id', providerEventId);
    if (error) {
      throw new Error(`provider_events_mark_processing_error_failed:${error.message}`);
    }
  }

  async clearProcessingError(provider: string, providerEventId: string): Promise<void> {
    const { error } = await this.supabase
      .from('provider_events')
      .update({
        processing_error: null,
        processed_at: new Date().toISOString(),
      })
      .eq('provider', provider)
      .eq('provider_event_id', providerEventId);
    if (error) {
      throw new Error(`provider_events_clear_processing_error_failed:${error.message}`);
    }
  }
}
