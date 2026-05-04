import type { SupabaseClient } from '@supabase/supabase-js';

import type { ShopAccessState } from '@/src/backend/domain/types';
import type { ShopAccessStatesRepository } from '@/src/backend/ports/repositories';

type ShopAccessStateRow = {
  id: string;
  shop_id: string;
  live_calls_enabled: boolean;
  go_live_at: string | null;
  live_calls_paused_reason: string | null;
  live_calls_paused_at: string | null;
  last_access_check_at: string | null;
  created_at: string;
  updated_at: string;
};

function toShopAccessState(row: ShopAccessStateRow): ShopAccessState {
  return {
    id: row.id,
    shopId: row.shop_id,
    liveCallsEnabled: row.live_calls_enabled,
    goLiveAt: row.go_live_at,
    liveCallsPausedReason: row.live_calls_paused_reason,
    liveCallsPausedAt: row.live_calls_paused_at,
    lastAccessCheckAt: row.last_access_check_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseShopAccessStatesRepository implements ShopAccessStatesRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByShopId(shopId: string): Promise<ShopAccessState | null> {
    const { data, error } = await this.supabase
      .from('shop_access_states')
      .select('*')
      .eq('shop_id', shopId)
      .maybeSingle<ShopAccessStateRow>();
    if (error) throw new Error(`shop_access_states_find_by_shop_id_failed:${error.message}`);
    return data ? toShopAccessState(data) : null;
  }

  async upsert(params: {
    shopId: string;
    liveCallsEnabled?: boolean;
    goLiveAt?: string | null;
    liveCallsPausedReason?: string | null;
    liveCallsPausedAt?: string | null;
    lastAccessCheckAt?: string | null;
  }): Promise<ShopAccessState> {
    const existing = await this.findByShopId(params.shopId);
    const { data, error } = await this.supabase
      .from('shop_access_states')
      .upsert(
        {
          shop_id: params.shopId,
          live_calls_enabled: params.liveCallsEnabled ?? existing?.liveCallsEnabled ?? false,
          go_live_at: params.goLiveAt ?? existing?.goLiveAt ?? null,
          live_calls_paused_reason: params.liveCallsPausedReason ?? existing?.liveCallsPausedReason ?? null,
          live_calls_paused_at: params.liveCallsPausedAt ?? existing?.liveCallsPausedAt ?? null,
          last_access_check_at: params.lastAccessCheckAt ?? existing?.lastAccessCheckAt ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'shop_id' },
      )
      .select('*')
      .single<ShopAccessStateRow>();
    if (error) throw new Error(`shop_access_states_upsert_failed:${error.message}`);
    return toShopAccessState(data);
  }
}
