import type { SupabaseClient } from '@supabase/supabase-js';

import { HANDOFF_TERMINAL_STATUSES, type HandoffSessionRecord, type HandoffSessionStatus } from '@/src/backend/domain/handoff';
import type { HandoffSessionsRepository } from '@/src/backend/ports/repositories';

type HandoffRow = {
  id: string;
  shop_id: string;
  rb_call_id: string;
  idempotency_key: string;
  parent_call_control_id: string;
  parent_call_session_id: string | null;
  owner_call_control_id: string | null;
  openai_call_id: string | null;
  owner_phone: string;
  caller_phone: string | null;
  caller_name: string | null;
  reason: string;
  urgency: string;
  summary: string;
  service_requested: string | null;
  preferred_time: string | null;
  status: string;
  failed_reason: string | null;
  error_message: string | null;
  dtmf_retry_count: number;
  fallback_sms_sent: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

function toRecord(row: HandoffRow): HandoffSessionRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    rbCallId: row.rb_call_id,
    idempotencyKey: row.idempotency_key,
    parentCallControlId: row.parent_call_control_id,
    parentCallSessionId: row.parent_call_session_id,
    ownerCallControlId: row.owner_call_control_id,
    openaiCallId: row.openai_call_id,
    ownerPhone: row.owner_phone,
    callerPhone: row.caller_phone,
    callerName: row.caller_name,
    reason: row.reason,
    urgency: row.urgency,
    summary: row.summary,
    serviceRequested: row.service_requested,
    preferredTime: row.preferred_time,
    status: row.status as HandoffSessionStatus,
    failedReason: row.failed_reason,
    errorMessage: row.error_message,
    dtmfRetryCount: row.dtmf_retry_count,
    fallbackSmsSent: row.fallback_sms_sent,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  };
}

export class SupabaseHandoffSessionsRepository implements HandoffSessionsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(params: {
    shopId: string;
    rbCallId: string;
    idempotencyKey: string;
    parentCallControlId: string;
    parentCallSessionId?: string | null;
    ownerPhone: string;
    callerPhone?: string | null;
    callerName?: string | null;
    reason: string;
    urgency: string;
    summary: string;
    serviceRequested?: string | null;
    preferredTime?: string | null;
    status: HandoffSessionStatus;
  }): Promise<HandoffSessionRecord> {
    const { data, error } = await this.supabase
      .from('handoff_sessions')
      .insert({
        shop_id: params.shopId,
        rb_call_id: params.rbCallId,
        idempotency_key: params.idempotencyKey,
        parent_call_control_id: params.parentCallControlId,
        parent_call_session_id: params.parentCallSessionId ?? null,
        owner_phone: params.ownerPhone,
        caller_phone: params.callerPhone ?? null,
        caller_name: params.callerName ?? null,
        reason: params.reason,
        urgency: params.urgency,
        summary: params.summary,
        service_requested: params.serviceRequested ?? null,
        preferred_time: params.preferredTime ?? null,
        status: params.status,
      })
      .select()
      .single<HandoffRow>();

    if (!error && data) {
      return toRecord(data);
    }

    const { data: existing, error: fetchError } = await this.supabase
      .from('handoff_sessions')
      .select()
      .eq('shop_id', params.shopId)
      .eq('idempotency_key', params.idempotencyKey)
      .maybeSingle<HandoffRow>();

    if (fetchError) {
      throw new Error(`handoff_sessions_create_failed:${error?.message ?? fetchError.message}`);
    }
    if (existing) {
      return toRecord(existing);
    }

    throw new Error(`handoff_sessions_create_failed:${error?.message ?? 'unknown'}`);
  }

  async findById(id: string): Promise<HandoffSessionRecord | null> {
    const { data, error } = await this.supabase.from('handoff_sessions').select().eq('id', id).maybeSingle<HandoffRow>();
    if (error) {
      throw new Error(`handoff_sessions_find_failed:${error.message}`);
    }
    return data ? toRecord(data) : null;
  }

  async findActiveByRbCallId(shopId: string, rbCallId: string): Promise<HandoffSessionRecord | null> {
    const { data, error } = await this.supabase
      .from('handoff_sessions')
      .select()
      .eq('shop_id', shopId)
      .eq('rb_call_id', rbCallId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`handoff_sessions_find_active_rb_failed:${error.message}`);
    }
    const rows = (data ?? []) as HandoffRow[];
    for (const row of rows) {
      if (!HANDOFF_TERMINAL_STATUSES.has(row.status as HandoffSessionStatus)) {
        return toRecord(row);
      }
    }
    return null;
  }

  async findByOwnerCallControlId(callControlId: string): Promise<HandoffSessionRecord | null> {
    const { data, error } = await this.supabase
      .from('handoff_sessions')
      .select()
      .eq('owner_call_control_id', callControlId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<HandoffRow>();
    if (error) {
      throw new Error(`handoff_sessions_find_owner_cc_failed:${error.message}`);
    }
    return data ? toRecord(data) : null;
  }

  async findByParentCallControlId(parentCallControlId: string): Promise<HandoffSessionRecord | null> {
    const { data, error } = await this.supabase
      .from('handoff_sessions')
      .select()
      .eq('parent_call_control_id', parentCallControlId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<HandoffRow>();
    if (error) {
      throw new Error(`handoff_sessions_find_parent_cc_failed:${error.message}`);
    }
    return data ? toRecord(data) : null;
  }

  async findActiveByParentCallControlId(parentCallControlId: string): Promise<HandoffSessionRecord | null> {
    const { data, error } = await this.supabase
      .from('handoff_sessions')
      .select()
      .eq('parent_call_control_id', parentCallControlId)
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(`handoff_sessions_find_active_parent_failed:${error.message}`);
    }
    const rows = (data ?? []) as HandoffRow[];
    for (const row of rows) {
      if (!HANDOFF_TERMINAL_STATUSES.has(row.status as HandoffSessionStatus)) {
        return toRecord(row);
      }
    }
    return null;
  }

  async update(
    id: string,
    patch: Partial<{
      status: HandoffSessionStatus;
      ownerCallControlId: string | null;
      openaiCallId: string | null;
      parentCallSessionId: string | null;
      failedReason: string | null;
      errorMessage: string | null;
      dtmfRetryCount: number;
      fallbackSmsSent: boolean;
      completedAt: Date | null;
    }>,
  ): Promise<void> {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.ownerCallControlId !== undefined) row.owner_call_control_id = patch.ownerCallControlId;
    if (patch.openaiCallId !== undefined) row.openai_call_id = patch.openaiCallId;
    if (patch.parentCallSessionId !== undefined) row.parent_call_session_id = patch.parentCallSessionId;
    if (patch.failedReason !== undefined) row.failed_reason = patch.failedReason;
    if (patch.errorMessage !== undefined) row.error_message = patch.errorMessage;
    if (patch.dtmfRetryCount !== undefined) row.dtmf_retry_count = patch.dtmfRetryCount;
    if (patch.fallbackSmsSent !== undefined) row.fallback_sms_sent = patch.fallbackSmsSent;
    if (patch.completedAt !== undefined) {
      row.completed_at = patch.completedAt ? patch.completedAt.toISOString() : null;
    }

    const { error } = await this.supabase.from('handoff_sessions').update(row).eq('id', id);
    if (error) {
      throw new Error(`handoff_sessions_update_failed:${error.message}`);
    }
  }
}
