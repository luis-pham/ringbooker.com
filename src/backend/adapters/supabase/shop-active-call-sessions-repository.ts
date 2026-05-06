import type { SupabaseClient } from '@supabase/supabase-js';

import type { ShopActiveCallSessionsRepository } from '@/src/backend/ports/repositories';

export class SupabaseShopActiveCallSessionsRepository implements ShopActiveCallSessionsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async acquireSlot(params: {
    shopId: string;
    callSessionId: string;
    provider: string;
    limit: number;
    startedAt: Date;
    expiresAt: Date;
  }): Promise<{ acquired: boolean; activeCount: number; reason?: 'limit_reached' | 'duplicate_active' }> {
    const { data, error } = await this.supabase.rpc('acquire_shop_active_call_slot', {
      p_shop_id: params.shopId,
      p_call_session_id: params.callSessionId,
      p_provider: params.provider,
      p_limit: params.limit,
      p_started_at: params.startedAt.toISOString(),
      p_expires_at: params.expiresAt.toISOString(),
    });
    if (error) throw new Error(`active_call_slot_acquire_failed:${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      acquired: Boolean(row?.acquired),
      activeCount: Number(row?.active_count ?? 0),
      reason: (row?.reason as 'limit_reached' | 'duplicate_active' | null) ?? undefined,
    };
  }

  async releaseByCallSession(params: { provider: string; callSessionId: string; releasedAt?: Date }): Promise<void> {
    const releasedAt = (params.releasedAt ?? new Date()).toISOString();
    const { error } = await this.supabase
      .from('shop_active_call_sessions')
      .update({ status: 'released', released_at: releasedAt, updated_at: releasedAt })
      .eq('provider', params.provider)
      .eq('call_session_id', params.callSessionId)
      .eq('status', 'active')
      .is('released_at', null);
    if (error) throw new Error(`active_call_slot_release_failed:${error.message}`);
  }

  async countActiveByShop(params: { shopId: string; now: Date }): Promise<number> {
    const { count, error } = await this.supabase
      .from('shop_active_call_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', params.shopId)
      .eq('status', 'active')
      .is('released_at', null)
      .gt('expires_at', params.now.toISOString());
    if (error) throw new Error(`active_call_slot_count_failed:${error.message}`);
    return count ?? 0;
  }
}
