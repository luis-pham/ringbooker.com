import type { SupabaseClient } from '@supabase/supabase-js';

import type { VagaroWebhookEvent } from '@/src/backend/domain/types';
import type { VagaroWebhookEventsRepository } from '@/src/backend/ports/repositories';

export class SupabaseVagaroWebhookEventsRepository implements VagaroWebhookEventsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async save(event: Omit<VagaroWebhookEvent, 'id'>): Promise<void> {
    const { error } = await this.supabase.from('vagaro_webhook_events').insert({
      shop_id: event.shop_id,
      event_type: event.event_type,
      action: event.action ?? null,
      payload: event.payload,
      raw_headers: event.raw_headers ?? null,
      received_at: event.received_at,
      processed_at: event.processed_at ?? null,
      processing_error: event.processing_error ?? null,
    });

    if (error) {
      throw new Error(`vagaro_webhook_events_save_failed:${error.message}`);
    }
  }
}
