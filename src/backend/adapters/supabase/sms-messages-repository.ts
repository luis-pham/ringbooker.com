import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  SmsMessageListItem,
  SmsMessageRecord,
  SmsMessagesListFilters,
  SmsMessagesRepository,
} from '@/src/backend/ports/repositories';

type SmsMessageRow = {
  id: string;
  shop_id: string | null;
  location_id: string | null;
  telnyx_message_id: string | null;
  telnyx_event_id: string;
  direction: string;
  from_number: string;
  to_number: string;
  body: string | null;
  media_urls: unknown;
  provider: string;
  event_type: string;
  raw_payload?: unknown;
  received_at: string;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '23505' || /duplicate key|unique/i.test(error?.message ?? '');
}

function mediaUrlsFromRow(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toRecord(row: SmsMessageRow): SmsMessageRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    locationId: row.location_id,
    telnyxMessageId: row.telnyx_message_id,
    telnyxEventId: row.telnyx_event_id,
    direction: row.direction === 'outbound' ? 'outbound' : 'inbound',
    fromNumber: row.from_number,
    toNumber: row.to_number,
    body: row.body,
    mediaUrls: mediaUrlsFromRow(row.media_urls),
    provider: row.provider,
    eventType: row.event_type,
    rawPayload: row.raw_payload ?? null,
    receivedAt: row.received_at,
    readAt: row.read_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPreview(body: string | null | undefined): string | null {
  const text = body?.trim() ?? '';
  if (!text) return null;
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function toListItem(row: SmsMessageRow): SmsMessageListItem {
  const record = toRecord(row);
  const { body, rawPayload: _rawPayload, ...rest } = record;
  return {
    ...rest,
    bodyPreview: toPreview(body),
  };
}

function toIso(value: Date | string | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function escapeIlike(value: string): string {
  return value.replace(/[%_,]/g, ' ');
}

const LIST_COLUMNS =
  'id,shop_id,location_id,telnyx_message_id,telnyx_event_id,direction,from_number,to_number,body,media_urls,provider,event_type,received_at,read_at,created_at,updated_at';

const DETAIL_COLUMNS = `${LIST_COLUMNS},raw_payload`;

export class SupabaseSmsMessagesRepository implements SmsMessagesRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async saveInboundFromTelnyxEvent(params: {
    shopId?: string | null;
    locationId?: string | null;
    telnyxMessageId?: string | null;
    telnyxEventId: string;
    fromNumber: string;
    toNumber: string;
    body?: string | null;
    mediaUrls?: string[];
    eventType: string;
    rawPayload: unknown;
    receivedAt?: Date | string | null;
  }): Promise<{ record: SmsMessageRecord; created: boolean }> {
    const insertPayload = {
      shop_id: params.shopId ?? null,
      location_id: params.locationId ?? null,
      telnyx_message_id: params.telnyxMessageId ?? null,
      telnyx_event_id: params.telnyxEventId,
      direction: 'inbound',
      from_number: params.fromNumber,
      to_number: params.toNumber,
      body: params.body ?? null,
      media_urls: params.mediaUrls ?? [],
      provider: 'telnyx',
      event_type: params.eventType,
      raw_payload: params.rawPayload,
      received_at: toIso(params.receivedAt),
    };
    const { data, error } = await this.supabase
      .from('sms_messages')
      .insert(insertPayload)
      .select(DETAIL_COLUMNS)
      .single<SmsMessageRow>();

    if (!error && data) return { record: toRecord(data), created: true };
    if (!isUniqueViolation(error)) {
      throw new Error(`sms_messages_save_inbound_failed:${error?.message ?? 'unknown_error'}`);
    }

    const existing = await this.findDuplicate(params.telnyxEventId, params.telnyxMessageId ?? null);
    if (existing) return { record: existing, created: false };
    throw new Error('sms_messages_save_inbound_failed:duplicate_not_found');
  }

  async listAdminSmsMessages(filters: SmsMessagesListFilters): Promise<{ items: SmsMessageListItem[]; total: number }> {
    if (filters.allowedToNumbers.length === 0) return { items: [], total: 0 };
    let query = this.supabase
      .from('sms_messages')
      .select(LIST_COLUMNS, { count: 'exact' })
      .in('to_number', filters.allowedToNumbers);

    if (filters.toNumber) query = query.eq('to_number', filters.toNumber);
    if (filters.read === 'read') query = query.not('read_at', 'is', null);
    if (filters.read === 'unread') query = query.is('read_at', null);
    if (filters.dateFrom) query = query.gte('received_at', filters.dateFrom.toISOString());
    if (filters.dateTo) query = query.lte('received_at', filters.dateTo.toISOString());
    if (filters.q?.trim()) {
      const term = `%${escapeIlike(filters.q.trim())}%`;
      query = query.or(`from_number.ilike.${term},to_number.ilike.${term},body.ilike.${term}`);
    }

    const offset = (filters.page - 1) * filters.limit;
    const { data, error, count } = await query
      .order('received_at', { ascending: false })
      .range(offset, offset + filters.limit - 1)
      .returns<SmsMessageRow[]>();

    if (error) {
      throw new Error(`sms_messages_list_admin_failed:${error.message}`);
    }

    return {
      items: (data ?? []).map(toListItem),
      total: count ?? 0,
    };
  }

  async getAdminSmsMessageById(id: string, allowedToNumbers: string[]): Promise<SmsMessageRecord | null> {
    if (allowedToNumbers.length === 0) return null;
    const { data, error } = await this.supabase
      .from('sms_messages')
      .select(DETAIL_COLUMNS)
      .eq('id', id)
      .in('to_number', allowedToNumbers)
      .maybeSingle<SmsMessageRow>();

    if (error) {
      throw new Error(`sms_messages_get_admin_failed:${error.message}`);
    }
    return data ? toRecord(data) : null;
  }

  async markSmsMessageRead(id: string, allowedToNumbers: string[]): Promise<SmsMessageRecord | null> {
    if (allowedToNumbers.length === 0) return null;
    const { data, error } = await this.supabase
      .from('sms_messages')
      .update({
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .in('to_number', allowedToNumbers)
      .select(DETAIL_COLUMNS)
      .maybeSingle<SmsMessageRow>();

    if (error) {
      throw new Error(`sms_messages_mark_read_failed:${error.message}`);
    }
    return data ? toRecord(data) : null;
  }

  private async findDuplicate(telnyxEventId: string, telnyxMessageId: string | null): Promise<SmsMessageRecord | null> {
    const filters = [`telnyx_event_id.eq.${telnyxEventId.replace(/,/g, '')}`];
    if (telnyxMessageId) filters.push(`telnyx_message_id.eq.${telnyxMessageId.replace(/,/g, '')}`);
    const { data, error } = await this.supabase
      .from('sms_messages')
      .select(DETAIL_COLUMNS)
      .or(filters.join(','))
      .maybeSingle<SmsMessageRow>();

    if (error) {
      throw new Error(`sms_messages_find_duplicate_failed:${error.message}`);
    }
    return data ? toRecord(data) : null;
  }
}
