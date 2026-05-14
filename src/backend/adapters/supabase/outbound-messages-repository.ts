import type { SupabaseClient } from '@supabase/supabase-js';

import type { OutboundMessageRecord, OutboundMessagesRepository } from '@/src/backend/ports/repositories';

type OutboundMessageRow = {
  id: string;
  shop_id: string;
  booking_id: string | null;
  customer_phone: string;
  category: string;
  body: string | null;
  status: string;
  provider_message_id: string | null;
  created_at?: string;
  updated_at?: string;
};

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

  async listMissedCallSmsSentPhones(shopId: string, phones: string[]): Promise<Set<string>> {
    if (phones.length === 0) return new Set();
    const { data } = await this.supabase
      .from('outbound_messages')
      .select('customer_phone')
      .eq('shop_id', shopId)
      .eq('category', 'missed_call')
      .in('customer_phone', phones)
      .returns<{ customer_phone: string }[]>();
    return new Set((data ?? []).map((row) => row.customer_phone));
  }

  async countRecentByPhone(params: { shopId: string; customerPhone: string; since: Date }): Promise<number> {
    const { count, error } = await this.supabase
      .from('outbound_messages')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', params.shopId)
      .eq('customer_phone', params.customerPhone)
      .gte('created_at', params.since.toISOString());
    if (error) return 0;
    return count ?? 0;
  }

  async listByBookingId(bookingId: string): Promise<OutboundMessageRecord[]> {
    const { data, error } = await this.supabase
      .from('outbound_messages')
      .select('id,shop_id,booking_id,customer_phone,category,body,status,provider_message_id,created_at,updated_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })
      .returns<OutboundMessageRow[]>();

    if (error) {
      throw new Error(`outbound_messages_list_by_booking_failed:${error.message}`);
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      shopId: row.shop_id,
      bookingId: row.booking_id,
      customerPhone: row.customer_phone,
      category: row.category,
      body: row.body,
      status: row.status,
      providerMessageId: row.provider_message_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}
