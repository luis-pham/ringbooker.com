import type { SupabaseClient } from '@supabase/supabase-js';

import type { CallbackRecord, CallbacksRepository } from '@/src/backend/ports/repositories';

type CallbackRow = {
  id: string;
  shop_id: string;
  customer_phone: string;
  customer_name: string | null;
  reason: string;
  status: string;
  attempt_count: number;
};

export class SupabaseCallbacksRepository implements CallbacksRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(params: {
    shopId: string;
    customerPhone: string;
    customerName?: string | null;
    reason: string;
    requestId?: string;
  }): Promise<CallbackRecord> {
    const { data, error } = await this.supabase
      .from('callbacks')
      .insert({
        shop_id: params.shopId,
        customer_phone: params.customerPhone,
        customer_name: params.customerName ?? null,
        reason: params.reason,
        status: 'queued',
        attempt_count: 0,
        request_id: params.requestId ?? null,
      })
      .select('id,shop_id,customer_phone,customer_name,reason,status,attempt_count')
      .single<CallbackRow>();

    if (error) {
      throw new Error(`callbacks_create_failed:${error.message}`);
    }

    return {
      id: data.id,
      shopId: data.shop_id,
      customerPhone: data.customer_phone,
      customerName: data.customer_name,
      reason: data.reason,
      status: data.status,
      attemptCount: data.attempt_count,
    };
  }

  async findById(callbackId: string): Promise<CallbackRecord | null> {
    const { data, error } = await this.supabase
      .from('callbacks')
      .select('id,shop_id,customer_phone,customer_name,reason,status,attempt_count')
      .eq('id', callbackId)
      .maybeSingle<CallbackRow>();

    if (error) {
      throw new Error(`callbacks_find_by_id_failed:${error.message}`);
    }
    if (!data) return null;

    return {
      id: data.id,
      shopId: data.shop_id,
      customerPhone: data.customer_phone,
      customerName: data.customer_name,
      reason: data.reason,
      status: data.status,
      attemptCount: data.attempt_count,
    };
  }

  async markAttempt(callbackId: string, params: { nextAttemptAt?: Date }): Promise<void> {
    const { data: current, error: currentError } = await this.supabase
      .from('callbacks')
      .select('attempt_count')
      .eq('id', callbackId)
      .maybeSingle<{ attempt_count: number }>();

    if (currentError) {
      throw new Error(`callbacks_load_attempt_count_failed:${currentError.message}`);
    }

    const { error } = await this.supabase
      .from('callbacks')
      .update({
        status: 'dialing',
        attempt_count: (current?.attempt_count ?? 0) + 1,
        last_attempt_at: new Date().toISOString(),
        next_attempt_at: params.nextAttemptAt?.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', callbackId);

    if (error) {
      throw new Error(`callbacks_mark_attempt_failed:${error.message}`);
    }
  }

  async markQueued(callbackId: string, params: { nextAttemptAt: Date }): Promise<void> {
    const { error } = await this.supabase
      .from('callbacks')
      .update({
        status: 'queued',
        next_attempt_at: params.nextAttemptAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', callbackId);

    if (error) {
      throw new Error(`callbacks_mark_queued_failed:${error.message}`);
    }
  }

  async markCompleted(callbackId: string): Promise<void> {
    const { error } = await this.supabase
      .from('callbacks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', callbackId);

    if (error) {
      throw new Error(`callbacks_mark_completed_failed:${error.message}`);
    }
  }

  async markFailed(callbackId: string): Promise<void> {
    const { error } = await this.supabase
      .from('callbacks')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', callbackId);

    if (error) {
      throw new Error(`callbacks_mark_failed_failed:${error.message}`);
    }
  }
}
