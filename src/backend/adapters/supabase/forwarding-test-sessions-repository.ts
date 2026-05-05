import type { SupabaseClient } from '@supabase/supabase-js';

import type { ForwardingTestSession, ForwardingTestSessionStatus } from '@/src/backend/domain/types';
import type { ForwardingTestSessionsRepository } from '@/src/backend/ports/repositories';
import { normalizeInboundE164 } from '@/src/backend/services/calls/shop-resolver';

type Row = {
  id: string;
  shop_id: string;
  status: ForwardingTestSessionStatus;
  forwarding_number: string;
  expected_business_phone: string | null;
  started_at: string;
  expires_at: string;
  passed_at: string | null;
  inbound_call_session_id: string | null;
  inbound_call_control_id: string | null;
  caller_phone: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function toDomain(row: Row): ForwardingTestSession {
  return {
    id: row.id,
    shopId: row.shop_id,
    status: row.status,
    forwardingNumber: row.forwarding_number,
    expectedBusinessPhone: row.expected_business_phone,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    passedAt: row.passed_at,
    inboundCallSessionId: row.inbound_call_session_id,
    inboundCallControlId: row.inbound_call_control_id,
    callerPhone: row.caller_phone,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseForwardingTestSessionsRepository implements ForwardingTestSessionsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findPendingUnexpiredByShopId(params: { shopId: string; now: Date }): Promise<ForwardingTestSession | null> {
    const nowIso = params.now.toISOString();
    const { data, error } = await this.supabase
      .from('forwarding_test_sessions')
      .select('*')
      .eq('shop_id', params.shopId)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<Row>();
    if (error) throw new Error(`forwarding_test_sessions_find_pending_failed:${error.message}`);
    return data ? toDomain(data) : null;
  }

  async createSession(params: {
    shopId: string;
    forwardingNumber: string;
    expectedBusinessPhone?: string | null;
    startedAt: Date;
    expiresAt: Date;
    metadata?: Record<string, unknown>;
  }): Promise<ForwardingTestSession> {
    const { data, error } = await this.supabase
      .from('forwarding_test_sessions')
      .insert({
        shop_id: params.shopId,
        status: 'pending',
        forwarding_number: params.forwardingNumber,
        expected_business_phone: params.expectedBusinessPhone ?? null,
        started_at: params.startedAt.toISOString(),
        expires_at: params.expiresAt.toISOString(),
        metadata: params.metadata ?? {},
      })
      .select('*')
      .single<Row>();
    if (error) throw new Error(`forwarding_test_sessions_create_failed:${error.message}`);
    return toDomain(data);
  }

  async markPassedIfEligible(params: {
    shopId: string;
    forwardingNumberE164: string;
    inboundCallSessionId: string | null;
    inboundCallControlId: string | null;
    callerPhone: string | null;
    now: Date;
  }): Promise<boolean> {
    const normalized = normalizeInboundE164(params.forwardingNumberE164);
    if (!normalized) return false;
    const nowIso = params.now.toISOString();
    const { data, error } = await this.supabase
      .from('forwarding_test_sessions')
      .update({
        status: 'passed',
        passed_at: nowIso,
        inbound_call_session_id: params.inboundCallSessionId,
        inbound_call_control_id: params.inboundCallControlId,
        caller_phone: params.callerPhone,
        updated_at: nowIso,
      })
      .eq('shop_id', params.shopId)
      .eq('forwarding_number', normalized)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .select('id')
      .maybeSingle<{ id: string }>();
    if (error) throw new Error(`forwarding_test_sessions_mark_passed_failed:${error.message}`);
    return Boolean(data?.id);
  }

  async findLatestByShopId(shopId: string): Promise<ForwardingTestSession | null> {
    const { data, error } = await this.supabase
      .from('forwarding_test_sessions')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<Row>();
    if (error) throw new Error(`forwarding_test_sessions_find_latest_failed:${error.message}`);
    return data ? toDomain(data) : null;
  }
}
