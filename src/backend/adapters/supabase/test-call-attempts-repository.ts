import type { SupabaseClient } from '@supabase/supabase-js';

import type { TestCallAttempt } from '@/src/backend/domain/types';
import type { TestCallAttemptsRepository } from '@/src/backend/ports/repositories';

type TestCallAttemptRow = {
  id: string;
  shop_id: string;
  user_id: string | null;
  type: TestCallAttempt['type'];
  status: TestCallAttempt['status'];
  destination_phone: string | null;
  source_number: string | null;
  test_number_id: string | null;
  transcript_id: string | null;
  call_summary_id: string | null;
  duration_seconds: number | null;
  error_reason: string | null;
  created_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
};

function toTestCallAttempt(row: TestCallAttemptRow): TestCallAttempt {
  return {
    id: row.id,
    shopId: row.shop_id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    destinationPhone: row.destination_phone,
    sourceNumber: row.source_number,
    testNumberId: row.test_number_id,
    transcriptId: row.transcript_id,
    callSummaryId: row.call_summary_id,
    durationSeconds: row.duration_seconds,
    errorReason: row.error_reason,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    metadata: row.metadata,
  };
}

export class SupabaseTestCallAttemptsRepository implements TestCallAttemptsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(params: {
    shopId: string;
    userId?: string | null;
    type: TestCallAttempt['type'];
    status: TestCallAttempt['status'];
    destinationPhone?: string | null;
    sourceNumber?: string | null;
    testNumberId?: string | null;
    transcriptId?: string | null;
    callSummaryId?: string | null;
    durationSeconds?: number | null;
    errorReason?: string | null;
    completedAt?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<TestCallAttempt> {
    const { data, error } = await this.supabase
      .from('test_call_attempts')
      .insert({
        shop_id: params.shopId,
        user_id: params.userId ?? null,
        type: params.type,
        status: params.status,
        destination_phone: params.destinationPhone ?? null,
        source_number: params.sourceNumber ?? null,
        test_number_id: params.testNumberId ?? null,
        transcript_id: params.transcriptId ?? null,
        call_summary_id: params.callSummaryId ?? null,
        duration_seconds: params.durationSeconds ?? null,
        error_reason: params.errorReason ?? null,
        completed_at: params.completedAt ?? null,
        metadata: params.metadata ?? {},
      })
      .select('*')
      .single<TestCallAttemptRow>();
    if (error) throw new Error(`test_call_attempts_create_failed:${error.message}`);
    return toTestCallAttempt(data);
  }

  async countRecentByShopId(params: { shopId: string; since: Date; type?: TestCallAttempt['type'] }): Promise<number> {
    let query = this.supabase
      .from('test_call_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', params.shopId)
      .gte('created_at', params.since.toISOString());
    if (params.type) query = query.eq('type', params.type);
    const { count, error } = await query;
    if (error) throw new Error(`test_call_attempts_count_failed:${error.message}`);
    return count ?? 0;
  }

  async updateStatus(
    id: string,
    params: {
      status: TestCallAttempt['status'];
      errorReason?: string | null;
      completedAt?: string | null;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<TestCallAttempt | null> {
    const { data, error } = await this.supabase
      .from('test_call_attempts')
      .update({
        status: params.status,
        error_reason: params.errorReason ?? null,
        completed_at: params.completedAt ?? null,
        metadata: params.metadata ?? {},
      })
      .eq('id', id)
      .select('*')
      .maybeSingle<TestCallAttemptRow>();
    if (error) throw new Error(`test_call_attempts_update_status_failed:${error.message}`);
    return data ? toTestCallAttempt(data) : null;
  }
}
