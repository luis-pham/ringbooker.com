import type { SupabaseClient } from '@supabase/supabase-js';

import type { BookingRecord, BookingsRepository } from '@/src/backend/ports/repositories';

type BookingRow = {
  id: string;
  shop_id: string;
  customer_phone: string;
  customer_name: string | null;
  service: string;
  datetime_utc: string;
  timezone: string;
  status: string;
  reminder_24h_sent: boolean;
  reminder_2h_sent: boolean;
  review_request_sent: boolean;
  created_at?: string;
  updated_at?: string;
};

export class SupabaseBookingsRepository implements BookingsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(bookingId: string): Promise<BookingRecord | null> {
    const { data, error } = await this.supabase
      .from('bookings')
      .select(
        'id,shop_id,customer_phone,customer_name,service,datetime_utc,timezone,status,reminder_24h_sent,reminder_2h_sent,review_request_sent,created_at,updated_at',
      )
      .eq('id', bookingId)
      .maybeSingle<BookingRow>();

    if (error) {
      throw new Error(`bookings_find_by_id_failed:${error.message}`);
    }
    if (!data) return null;

    return {
      id: data.id,
      shopId: data.shop_id,
      customerPhone: data.customer_phone,
      customerName: data.customer_name,
      service: data.service,
      datetimeUtc: data.datetime_utc,
      timezone: data.timezone,
      status: data.status,
      reminder24hSent: data.reminder_24h_sent,
      reminder2hSent: data.reminder_2h_sent,
      reviewRequestSent: data.review_request_sent,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async countByShop(shopId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId);
    if (error) {
      throw new Error(`bookings_count_by_shop_failed:${error.message}`);
    }
    return count ?? 0;
  }

  async listByShop(
    shopId: string,
    params?: { limit?: number; createdAfter?: Date; createdBefore?: Date },
  ): Promise<BookingRecord[]> {
    const limit = params?.limit && params.limit > 0 ? params.limit : 20;
    let q = this.supabase
      .from('bookings')
      .select(
        'id,shop_id,customer_phone,customer_name,service,datetime_utc,timezone,status,reminder_24h_sent,reminder_2h_sent,review_request_sent,created_at,updated_at',
      )
      .eq('shop_id', shopId);
    if (params?.createdAfter) q = q.gte('created_at', params.createdAfter.toISOString());
    if (params?.createdBefore) q = q.lte('created_at', params.createdBefore.toISOString());
    const { data, error } = await q.order('datetime_utc', { ascending: false }).limit(limit).returns<BookingRow[]>();

    if (error) {
      throw new Error(`bookings_list_by_shop_failed:${error.message}`);
    }

    return (data ?? []).map((item) => ({
      id: item.id,
      shopId: item.shop_id,
      customerPhone: item.customer_phone,
      customerName: item.customer_name,
      service: item.service,
      datetimeUtc: item.datetime_utc,
      timezone: item.timezone,
      status: item.status,
      reminder24hSent: item.reminder_24h_sent,
      reminder2hSent: item.reminder_2h_sent,
      reviewRequestSent: item.review_request_sent,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
  }

  async create(params: {
    id?: string;
    shopId: string;
    customerPhone: string;
    customerName?: string | null;
    service: string;
    datetimeUtc: string;
    timezone: string;
    status: string;
    calendarEventId?: string;
  }): Promise<BookingRecord> {
    const now = new Date().toISOString();
    const payload = {
      ...(params.id ? { id: params.id } : {}),
      shop_id: params.shopId,
      customer_phone: params.customerPhone,
      customer_name: params.customerName ?? null,
      service: params.service,
      datetime_utc: params.datetimeUtc,
      timezone: params.timezone,
      status: params.status,
      confirmed: params.status === 'confirmed',
      calendar_event_id: params.calendarEventId ?? null,
      reminder_24h_sent: false,
      reminder_2h_sent: false,
      review_request_sent: false,
      updated_at: now,
    };

    const { data, error } = await this.supabase
      .from('bookings')
      .insert(payload)
      .select(
        'id,shop_id,customer_phone,customer_name,service,datetime_utc,timezone,status,reminder_24h_sent,reminder_2h_sent,review_request_sent,created_at,updated_at',
      )
      .single<BookingRow>();

    if (error) {
      throw new Error(`bookings_create_failed:${error.message}`);
    }

    return {
      id: data.id,
      shopId: data.shop_id,
      customerPhone: data.customer_phone,
      customerName: data.customer_name,
      service: data.service,
      datetimeUtc: data.datetime_utc,
      timezone: data.timezone,
      status: data.status,
      reminder24hSent: data.reminder_24h_sent,
      reminder2hSent: data.reminder_2h_sent,
      reviewRequestSent: data.review_request_sent,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateDatetime(bookingId: string, newDatetimeUtc: Date): Promise<void> {
    const { error } = await this.supabase
      .from('bookings')
      .update({
        datetime_utc: newDatetimeUtc.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (error) {
      throw new Error(`bookings_update_datetime_failed:${error.message}`);
    }
  }

  async markReminderSent(bookingId: string, kind: '24h' | '2h'): Promise<void> {
    const update =
      kind === '24h'
        ? { reminder_24h_sent: true, updated_at: new Date().toISOString() }
        : { reminder_2h_sent: true, updated_at: new Date().toISOString() };

    const { error } = await this.supabase.from('bookings').update(update).eq('id', bookingId);
    if (error) {
      throw new Error(`bookings_mark_reminder_sent_failed:${error.message}`);
    }
  }

  async markReviewRequestSent(bookingId: string): Promise<void> {
    const { error } = await this.supabase
      .from('bookings')
      .update({
        review_request_sent: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (error) {
      throw new Error(`bookings_mark_review_request_sent_failed:${error.message}`);
    }
  }
}
