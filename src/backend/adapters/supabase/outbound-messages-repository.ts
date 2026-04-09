import type { SupabaseClient } from '@supabase/supabase-js';

import type { OutboundMessagesRepository } from '@/src/backend/ports/repositories';

export class SupabaseOutboundMessagesRepository implements OutboundMessagesRepository {
  constructor(private readonly supabase: SupabaseClient) {}

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
    const { error } = await this.supabase.from('outbound_messages').upsert(
      {
        shop_id: params.shopId,
        booking_id: params.bookingId ?? null,
        customer_phone: params.customerPhone,
        category: params.category,
        body: params.body,
        status: params.status,
        provider_message_id: params.providerMessageId ?? null,
        idempotency_key: params.idempotencyKey,
      },
      {
        onConflict: 'idempotency_key',
        ignoreDuplicates: true,
      },
    );

    if (error) {
      throw new Error(`outbound_messages_create_failed:${error.message}`);
    }
  }
}
