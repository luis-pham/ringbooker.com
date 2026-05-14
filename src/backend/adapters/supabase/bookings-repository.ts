import type { SupabaseClient } from '@supabase/supabase-js';

import type { BookingRecord, BookingsRepository } from '@/src/backend/ports/repositories';

type BookingRow = {
  id: string;
  shop_id: string;
  customer_phone: string;
  customer_name: string | null;
  service: string;
  tech_name?: string | null;
  matched_service_id?: string | null;
  matched_service_confidence?: number | string | null;
  datetime_utc: string;
  timezone: string;
  duration_min?: number | null;
  status: string;
  confirmed?: boolean;
  reminder_24h_sent: boolean;
  reminder_2h_sent: boolean;
  review_request_sent: boolean;
  calendar_event_id?: string | null;
  provider?: string | null;
  provider_status?: string | null;
  provider_error_reason?: string | null;
  call_log_id?: string | null;
  call_transcript?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

const BOOKING_SELECT =
  'id,shop_id,customer_phone,customer_name,service,tech_name,matched_service_id,matched_service_confidence,datetime_utc,timezone,duration_min,status,confirmed,reminder_24h_sent,reminder_2h_sent,review_request_sent,calendar_event_id,provider,provider_status,provider_error_reason,call_log_id,call_transcript,notes,created_at,updated_at';

function normalizeBookingStatus(status: string): string {
  if (status === 'pending') return 'captured';
  if (status === 'no_show') return 'cancelled';
  return status;
}

function toBookingRecord(row: BookingRow): BookingRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    customerPhone: row.customer_phone,
    customerName: row.customer_name,
    service: row.service,
    techName: row.tech_name ?? null,
    matchedServiceId: row.matched_service_id ?? null,
    matchedServiceConfidence:
      typeof row.matched_service_confidence === 'number'
        ? row.matched_service_confidence
        : typeof row.matched_service_confidence === 'string'
          ? Number(row.matched_service_confidence)
          : null,
    datetimeUtc: row.datetime_utc,
    timezone: row.timezone,
    durationMinutes: row.duration_min ?? null,
    status: row.status,
    confirmed: Boolean(row.confirmed),
    reminder24hSent: row.reminder_24h_sent,
    reminder2hSent: row.reminder_2h_sent,
    reviewRequestSent: row.review_request_sent,
    calendarEventId: row.calendar_event_id ?? null,
    provider: row.provider ?? null,
    providerStatus: row.provider_status ?? null,
    providerErrorReason: row.provider_error_reason ?? null,
    callLogId: row.call_log_id ?? null,
    callTranscript: row.call_transcript ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseBookingsRepository implements BookingsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(bookingId: string): Promise<BookingRecord | null> {
    const { data, error } = await this.supabase
      .from('bookings')
      .select(BOOKING_SELECT)
      .eq('id', bookingId)
      .maybeSingle<BookingRow>();

    if (error) {
      throw new Error(`bookings_find_by_id_failed:${error.message}`);
    }
    if (!data) return null;

    return toBookingRecord(data);
  }

  async countByShop(
    shopId: string,
    params?: { createdAfter?: Date; createdBefore?: Date; statuses?: string[]; callLogId?: string },
  ): Promise<number> {
    let q = this.supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId);
    if (params?.createdAfter) q = q.gte('created_at', params.createdAfter.toISOString());
    if (params?.createdBefore) q = q.lte('created_at', params.createdBefore.toISOString());
    if (params?.statuses?.length) q = q.in('status', params.statuses.flatMap(statusesForStorage));
    if (params?.callLogId) q = q.eq('call_log_id', params.callLogId);
    const { count, error } = await q;
    if (error) {
      throw new Error(`bookings_count_by_shop_failed:${error.message}`);
    }
    return count ?? 0;
  }

  async listByShop(
    shopId: string,
    params?: { limit?: number; offset?: number; createdAfter?: Date; createdBefore?: Date; statuses?: string[]; callLogId?: string },
  ): Promise<BookingRecord[]> {
    const limit = params?.limit && params.limit > 0 ? params.limit : 20;
    const offset = params?.offset && params.offset > 0 ? params.offset : 0;
    let q = this.supabase
      .from('bookings')
      .select(BOOKING_SELECT)
      .eq('shop_id', shopId);
    if (params?.createdAfter) q = q.gte('created_at', params.createdAfter.toISOString());
    if (params?.createdBefore) q = q.lte('created_at', params.createdBefore.toISOString());
    if (params?.statuses?.length) q = q.in('status', params.statuses.flatMap(statusesForStorage));
    if (params?.callLogId) q = q.eq('call_log_id', params.callLogId);
    const { data, error } = await q.order('created_at', { ascending: false }).range(offset, offset + limit - 1).returns<BookingRow[]>();

    if (error) {
      throw new Error(`bookings_list_by_shop_failed:${error.message}`);
    }

    return (data ?? []).map(toBookingRecord);
  }

  async create(params: {
    id?: string;
    shopId: string;
    customerPhone: string;
    customerName?: string | null;
    service: string;
    matchedServiceId?: string | null;
    matchedServiceConfidence?: number | null;
    datetimeUtc: string;
    timezone: string;
    status: string;
    calendarEventId?: string;
    provider?: string | null;
    providerStatus?: string | null;
    providerErrorReason?: string | null;
    callLogId?: string | null;
    techName?: string | null;
    durationMinutes?: number | null;
  }): Promise<BookingRecord> {
    const now = new Date().toISOString();
    const payload = {
      ...(params.id ? { id: params.id } : {}),
      shop_id: params.shopId,
      customer_phone: params.customerPhone,
      customer_name: params.customerName ?? null,
      service: params.service,
      tech_name: params.techName ?? null,
      matched_service_id: params.matchedServiceId ?? null,
      matched_service_confidence: params.matchedServiceConfidence ?? null,
      datetime_utc: params.datetimeUtc,
      timezone: params.timezone,
      duration_min: params.durationMinutes ?? 60,
      status: params.status,
      confirmed: normalizeBookingStatus(params.status) === 'confirmed',
      calendar_event_id: params.calendarEventId ?? null,
      provider: params.provider ?? null,
      provider_status: params.providerStatus ?? null,
      provider_error_reason: params.providerErrorReason ?? null,
      call_log_id: params.callLogId ?? null,
      reminder_24h_sent: false,
      reminder_2h_sent: false,
      review_request_sent: false,
      updated_at: now,
    };

    const { data, error } = await this.supabase
      .from('bookings')
      .insert(payload)
      .select(BOOKING_SELECT)
      .single<BookingRow>();

    if (error) {
      throw new Error(`bookings_create_failed:${error.message}`);
    }

    return toBookingRecord(data);
  }

  async updateStatusByShop(shopId: string, bookingId: string, status: string): Promise<BookingRecord | null> {
    const { data, error } = await this.supabase
      .from('bookings')
      .update({
        status,
        confirmed: normalizeBookingStatus(status) === 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('shop_id', shopId)
      .eq('id', bookingId)
      .select(BOOKING_SELECT)
      .maybeSingle<BookingRow>();

    if (error) {
      throw new Error(`bookings_update_status_failed:${error.message}`);
    }
    return data ? toBookingRecord(data) : null;
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

function statusesForStorage(status: string): string[] {
  if (status === 'captured') return ['captured', 'pending'];
  if (status === 'cancelled') return ['cancelled', 'no_show'];
  return [status];
}
