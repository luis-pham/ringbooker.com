import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AdminOutboundMessagesFilters,
  AdminOutboundMessagesListResult,
  OutboundDeliveryStatusUpdateInput,
  OutboundDeliveryStatusUpdateResult,
  OutboundMessageCreateQueuedInput,
  OutboundMessageRecord,
  OutboundMessagesRepository,
} from '@/src/backend/ports/repositories';
import { buildOutboundDeliveryStatusMutation } from '@/src/backend/services/sms/outbound-delivery-status';

const OUTBOUND_MESSAGE_SELECT = [
  'id',
  'shop_id',
  'location_id',
  'customer_id',
  'booking_id',
  'call_id',
  'job_id',
  'customer_phone',
  'category',
  'message_type',
  'from_number',
  'to_number',
  'media_urls',
  'body',
  'status',
  'provider',
  'provider_message_id',
  'telnyx_message_id',
  'telnyx_event_id',
  'provider_request',
  'provider_response',
  'provider_status_payload',
  'error_code',
  'error_message',
  'attempts',
  'last_attempt_at',
  'submitted_at',
  'delivered_at',
  'failed_at',
  'idempotency_key',
  'created_at',
  'updated_at',
].join(',');

type OutboundMessageRow = {
  id: string;
  shop_id: string;
  location_id: string | null;
  customer_id: string | null;
  booking_id: string | null;
  call_id: string | null;
  job_id: string | null;
  customer_phone: string;
  category: string;
  message_type: string | null;
  from_number: string | null;
  to_number: string | null;
  media_urls: unknown;
  body: string | null;
  status: string;
  provider: string | null;
  provider_message_id: string | null;
  telnyx_message_id: string | null;
  telnyx_event_id: string | null;
  provider_request: unknown | null;
  provider_response: unknown | null;
  provider_status_payload: unknown | null;
  error_code: string | null;
  error_message: string | null;
  attempts: number | null;
  last_attempt_at: string | null;
  submitted_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  idempotency_key: string | null;
  created_at?: string;
  updated_at?: string;
};

function mediaUrlsFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function mapOutboundMessage(row: OutboundMessageRow): OutboundMessageRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    locationId: row.location_id,
    customerId: row.customer_id,
    bookingId: row.booking_id,
    callId: row.call_id,
    jobId: row.job_id,
    customerPhone: row.customer_phone,
    category: row.category,
    messageType: row.message_type,
    fromNumber: row.from_number,
    toNumber: row.to_number,
    mediaUrls: mediaUrlsFromJson(row.media_urls),
    body: row.body,
    status: row.status,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    telnyxMessageId: row.telnyx_message_id,
    telnyxEventId: row.telnyx_event_id,
    providerRequest: row.provider_request,
    providerResponse: row.provider_response,
    providerStatusPayload: row.provider_status_payload,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    attempts: row.attempts ?? 0,
    lastAttemptAt: row.last_attempt_at,
    submittedAt: row.submitted_at,
    deliveredAt: row.delivered_at,
    failedAt: row.failed_at,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function cleanSearchTerm(q: string | null | undefined): string | null {
  const value = q?.trim().replace(/[(),]/g, ' ');
  if (!value) return null;
  return value.slice(0, 200);
}

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
        message_type: params.category,
        to_number: params.customerPhone,
        body: params.body,
        status: params.status,
        provider_message_id: params.providerMessageId ?? null,
        telnyx_message_id: params.providerMessageId ?? null,
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

  async createQueued(input: OutboundMessageCreateQueuedInput): Promise<OutboundMessageRecord> {
    const idempotencyKey = input.idempotencyKey?.trim() || null;
    if (idempotencyKey) {
      const existing = await this.findByIdempotencyKey(idempotencyKey);
      if (existing) return existing;
    }

    const payload = {
      shop_id: input.shopId,
      location_id: input.locationId ?? null,
      customer_id: input.customerId ?? null,
      booking_id: input.bookingId ?? null,
      call_id: input.callId ?? null,
      job_id: input.jobId ?? null,
      customer_phone: input.customerPhone ?? input.toNumber,
      category: input.messageType,
      message_type: input.messageType,
      from_number: input.fromNumber ?? null,
      to_number: input.toNumber,
      media_urls: input.mediaUrls ?? [],
      body: input.body,
      status: 'queued',
      provider: input.provider ?? 'telnyx',
      provider_request: input.providerRequest ?? null,
      attempts: 0,
      idempotency_key: idempotencyKey,
    };

    const { data, error } = await this.supabase
      .from('outbound_messages')
      .insert(payload)
      .select(OUTBOUND_MESSAGE_SELECT)
      .single<OutboundMessageRow>();

    if (error) {
      if (idempotencyKey) {
        const existing = await this.findByIdempotencyKey(idempotencyKey);
        if (existing) return existing;
      }
      throw new Error(`outbound_messages_create_queued_failed:${error.message}`);
    }

    return mapOutboundMessage(data);
  }

  async markSending(id: string): Promise<OutboundMessageRecord | null> {
    const current = await this.getAdminOutboundMessageById(id);
    if (!current) return null;
    const attempts = (current.attempts ?? 0) + 1;
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('outbound_messages')
      .update({
        status: 'sending',
        attempts,
        last_attempt_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .select(OUTBOUND_MESSAGE_SELECT)
      .maybeSingle<OutboundMessageRow>();

    if (error) throw new Error(`outbound_messages_mark_sending_failed:${error.message}`);
    return data ? mapOutboundMessage(data) : null;
  }

  async markSubmitted(
    id: string,
    input: {
      telnyxMessageId?: string | null;
      providerResponse?: unknown | null;
      submittedAt?: Date;
    },
  ): Promise<OutboundMessageRecord | null> {
    const submittedAt = input.submittedAt ?? new Date();
    const { data, error } = await this.supabase
      .from('outbound_messages')
      .update({
        status: 'submitted',
        provider_message_id: input.telnyxMessageId ?? null,
        telnyx_message_id: input.telnyxMessageId ?? null,
        provider_response: input.providerResponse ?? null,
        submitted_at: submittedAt.toISOString(),
        error_code: null,
        error_message: null,
        failed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(OUTBOUND_MESSAGE_SELECT)
      .maybeSingle<OutboundMessageRow>();

    if (error) throw new Error(`outbound_messages_mark_submitted_failed:${error.message}`);
    return data ? mapOutboundMessage(data) : null;
  }

  async markSendFailed(
    id: string,
    input: {
      errorCode: string;
      errorMessage?: string | null;
      providerResponse?: unknown | null;
      failedAt?: Date;
    },
  ): Promise<OutboundMessageRecord | null> {
    const failedAt = input.failedAt ?? new Date();
    const { data, error } = await this.supabase
      .from('outbound_messages')
      .update({
        status: 'send_failed',
        error_code: input.errorCode,
        error_message: input.errorMessage ?? null,
        provider_response: input.providerResponse ?? null,
        failed_at: failedAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(OUTBOUND_MESSAGE_SELECT)
      .maybeSingle<OutboundMessageRow>();

    if (error) throw new Error(`outbound_messages_mark_send_failed_failed:${error.message}`);
    return data ? mapOutboundMessage(data) : null;
  }

  async markDeliveryStatus(input: OutboundDeliveryStatusUpdateInput): Promise<OutboundDeliveryStatusUpdateResult> {
    const { data: current, error: findError } = await this.supabase
      .from('outbound_messages')
      .select(OUTBOUND_MESSAGE_SELECT)
      .eq('telnyx_message_id', input.telnyxMessageId)
      .maybeSingle<OutboundMessageRow>();

    if (findError) throw new Error(`outbound_messages_find_delivery_status_failed:${findError.message}`);
    if (!current) return { result: 'not_found' };

    const currentMessage = mapOutboundMessage(current);
    const mutation = buildOutboundDeliveryStatusMutation({
      currentStatus: currentMessage.status,
      eventType: input.eventType,
      telnyxStatus: input.telnyxStatus,
      occurredAt: input.occurredAt,
      completedAt: input.completedAt,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
    });
    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      telnyx_event_id: input.telnyxEventId,
      provider_status_payload: input.providerStatusPayload ?? null,
      updated_at: now,
    };

    if (mutation.kind === 'status') {
      updatePayload.status = mutation.status;
      if (mutation.submittedAt && !current.submitted_at) updatePayload.submitted_at = mutation.submittedAt.toISOString();
      if (mutation.deliveredAt !== undefined) updatePayload.delivered_at = mutation.deliveredAt ? mutation.deliveredAt.toISOString() : null;
      if (mutation.failedAt !== undefined) updatePayload.failed_at = mutation.failedAt ? mutation.failedAt.toISOString() : null;
      if (mutation.errorCode !== undefined) updatePayload.error_code = mutation.errorCode;
      if (mutation.errorMessage !== undefined) updatePayload.error_message = mutation.errorMessage;
    }

    const { data, error } = await this.supabase
      .from('outbound_messages')
      .update(updatePayload)
      .eq('id', current.id)
      .select(OUTBOUND_MESSAGE_SELECT)
      .maybeSingle<OutboundMessageRow>();

    if (error) throw new Error(`outbound_messages_mark_delivery_status_failed:${error.message}`);
    const message = data ? mapOutboundMessage(data) : currentMessage;
    return {
      result: mutation.kind === 'ignored_downgrade' ? 'ignored_downgrade' : 'updated',
      message,
    };
  }

  async listAdminOutboundMessages(filters: AdminOutboundMessagesFilters): Promise<AdminOutboundMessagesListResult> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.supabase
      .from('outbound_messages')
      .select(OUTBOUND_MESSAGE_SELECT, { count: 'exact' });

    if (filters.shopId) query = query.eq('shop_id', filters.shopId);
    if (filters.fromNumber) query = query.eq('from_number', filters.fromNumber);
    if (filters.toNumber) query = query.eq('to_number', filters.toNumber);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.messageType) query = query.eq('message_type', filters.messageType);
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom.toISOString());
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo.toISOString());

    const q = cleanSearchTerm(filters.q);
    if (q) {
      const like = `%${q}%`;
      query = query.or(
        [
          `from_number.ilike.${like}`,
          `to_number.ilike.${like}`,
          `customer_phone.ilike.${like}`,
          `body.ilike.${like}`,
          `provider_message_id.ilike.${like}`,
          `telnyx_message_id.ilike.${like}`,
        ].join(','),
      );
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)
      .returns<OutboundMessageRow[]>();

    if (error) throw new Error(`outbound_messages_admin_list_failed:${error.message}`);
    return {
      items: (data ?? []).map(mapOutboundMessage),
      total: count ?? 0,
    };
  }

  async getAdminOutboundMessageById(id: string): Promise<OutboundMessageRecord | null> {
    const { data, error } = await this.supabase
      .from('outbound_messages')
      .select(OUTBOUND_MESSAGE_SELECT)
      .eq('id', id)
      .maybeSingle<OutboundMessageRow>();

    if (error) throw new Error(`outbound_messages_admin_detail_failed:${error.message}`);
    return data ? mapOutboundMessage(data) : null;
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
      .select(OUTBOUND_MESSAGE_SELECT)
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })
      .returns<OutboundMessageRow[]>();

    if (error) {
      throw new Error(`outbound_messages_list_by_booking_failed:${error.message}`);
    }

    return (data ?? []).map(mapOutboundMessage);
  }

  private async findByIdempotencyKey(idempotencyKey: string): Promise<OutboundMessageRecord | null> {
    const { data, error } = await this.supabase
      .from('outbound_messages')
      .select(OUTBOUND_MESSAGE_SELECT)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle<OutboundMessageRow>();

    if (error) throw new Error(`outbound_messages_find_idempotency_failed:${error.message}`);
    return data ? mapOutboundMessage(data) : null;
  }
}
