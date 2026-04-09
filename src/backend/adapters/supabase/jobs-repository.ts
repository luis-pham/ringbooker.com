import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { JobStatus, JobType } from '@/src/backend/domain/types';
import type { JobsRepository } from '@/src/backend/ports/repositories';

type JobsRow = {
  id: string;
  shop_id: string | null;
  type: JobType;
  payload: Record<string, unknown>;
  status: string;
  run_at: string;
  attempts: number;
  max_attempts: number;
};

export class SupabaseJobsRepository implements JobsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async enqueue(params: {
    shopId: string;
    type: JobType;
    payload: Record<string, unknown>;
    runAt: Date;
    idempotencyKey: string;
  }): Promise<void> {
    const { error } = await this.supabase.from('jobs').upsert(
      {
        shop_id: params.shopId,
        type: params.type,
        payload: params.payload,
        status: 'queued',
        run_at: params.runAt.toISOString(),
        idempotency_key: params.idempotencyKey,
      },
      {
        onConflict: 'idempotency_key',
        ignoreDuplicates: true,
      },
    );

    if (error) {
      throw new Error(`jobs_enqueue_failed:${error.message}`);
    }
  }

  async leaseNext(params: {
    now: Date;
    leaseSeconds: number;
    workerId: string;
  }): Promise<{
    id: string;
    shopId: string;
    type: JobType;
    payload: Record<string, unknown>;
    attemptCount: number;
  } | null> {
    const { data: candidate, error: findError } = await this.supabase
      .from('jobs')
      .select('id, shop_id, type, payload, attempts, max_attempts, status, run_at')
      .eq('status', 'queued')
      .lte('run_at', params.now.toISOString())
      .order('run_at', { ascending: true })
      .limit(1)
      .maybeSingle<JobsRow>();

    if (findError) {
      throw new Error(`jobs_lease_query_failed:${findError.message}`);
    }

    if (!candidate || !candidate.shop_id) return null;

    const { data: updated, error: leaseError } = await this.supabase
      .from('jobs')
      .update({
        status: 'running',
        locked_at: params.now.toISOString(),
        lock_token: params.workerId,
        attempts: candidate.attempts + 1,
        updated_at: params.now.toISOString(),
      })
      .eq('id', candidate.id)
      .eq('status', 'queued')
      .select('id, shop_id, type, payload, attempts')
      .maybeSingle<{
        id: string;
        shop_id: string;
        type: JobType;
        payload: Record<string, unknown>;
        attempts: number;
      }>();

    if (leaseError) {
      throw new Error(`jobs_lease_update_failed:${leaseError.message}`);
    }

    if (!updated) return null;

    return {
      id: updated.id,
      shopId: updated.shop_id,
      type: updated.type,
      payload: updated.payload,
      attemptCount: updated.attempts,
    };
  }

  async complete(jobId: string): Promise<void> {
    const { error } = await this.supabase
      .from('jobs')
      .update({
        status: 'completed',
        lock_token: null,
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      throw new Error(`jobs_complete_failed:${error.message}`);
    }
  }

  async fail(jobId: string, params: { retryable: boolean; reason: string; nextRunAt?: Date }): Promise<void> {
    const { data: row, error: rowError } = await this.supabase
      .from('jobs')
      .select('attempts, max_attempts')
      .eq('id', jobId)
      .maybeSingle<{ attempts: number; max_attempts: number }>();

    if (rowError) {
      throw new Error(`jobs_fail_load_failed:${rowError.message}`);
    }

    if (!row) return;

    const reachedMaxAttempts = row.attempts >= row.max_attempts;
    const status = !params.retryable ? 'failed' : reachedMaxAttempts ? 'dead_letter' : 'queued';

    const { error } = await this.supabase
      .from('jobs')
      .update({
        status,
        last_error: params.reason,
        run_at: status === 'queued' ? (params.nextRunAt ?? new Date(Date.now() + 60_000)).toISOString() : undefined,
        lock_token: null,
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      throw new Error(`jobs_fail_update_failed:${error.message}`);
    }
  }

  async updateStatus(jobId: string, status: JobStatus): Promise<void> {
    const { error } = await this.supabase
      .from('jobs')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      throw new Error(`jobs_update_status_failed:${error.message}`);
    }
  }

  async getStatusCounts(): Promise<Partial<Record<JobStatus, number>>> {
    const statuses: JobStatus[] = ['queued', 'running', 'leased', 'completed', 'failed', 'dead_letter', 'cancelled'];
    const result: Partial<Record<JobStatus, number>> = {};

    await Promise.all(
      statuses.map(async (status) => {
        const { count, error } = await this.supabase
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .eq('status', status);
        if (error) {
          throw new Error(`jobs_status_count_failed:${status}:${error.message}`);
        }
        result[status] = count ?? 0;
      }),
    );

    return result;
  }

  static createWorkerId(prefix = 'jobs-worker'): string {
    return `${prefix}-${randomUUID().slice(0, 8)}`;
  }
}
