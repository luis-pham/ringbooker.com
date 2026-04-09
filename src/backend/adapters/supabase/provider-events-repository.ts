import type { SupabaseClient } from '@supabase/supabase-js';

import type { ProviderEventRecord, ProviderEventsRepository } from '@/src/backend/ports/repositories';

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
        ignoreDuplicates: true,
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
