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
  forwarding_claimed_at: string | null;
  forwarding_verified_at: string | null;
  forwarding_verified_source: string | null;
  commercial_go_live_approved_at: string | null;
  commercial_go_live_approved_by: string | null;
  commercial_go_live_approval_note: string | null;
  created_at: string;
  updated_at: string;
};

function forwardingViaFromRow(via: string | null): ShopAccessState['forwardingSetupVerifiedVia'] {
  if (
    via === 'forwarding_test' ||
    via === 'user_confirmed' ||
    via === 'inbound_test_call' ||
    via === 'manual_confirmation' ||
    via === 'legacy_live'
  ) {
    return via;
  }
  return null;
}

function toShopAccessState(row: ShopAccessStateRow): ShopAccessState {
  const verifiedSource =
    row.forwarding_verified_source === 'inbound_test' || row.forwarding_verified_source === 'admin_override'
      ? row.forwarding_verified_source
      : null;
  const via = verifiedSource === 'inbound_test' ? 'inbound_test_call' : verifiedSource === 'admin_override' ? 'manual_confirmation' : null;
  return {
    id: row.id,
    shopId: row.shop_id,
    liveCallsEnabled: row.live_calls_enabled,
    goLiveAt: row.go_live_at,
    liveCallsPausedReason: row.live_calls_paused_reason,
    liveCallsPausedAt: row.live_calls_paused_at,
    lastAccessCheckAt: row.last_access_check_at,
    forwardingClaimedAt: row.forwarding_claimed_at,
    forwardingVerifiedAt: row.forwarding_verified_at,
    forwardingVerifiedSource: verifiedSource,
    forwardingSetupVerifiedAt: row.forwarding_verified_at,
    forwardingSetupVerifiedVia: forwardingViaFromRow(via),
    commercialGoLiveApprovedAt: row.commercial_go_live_approved_at,
    commercialGoLiveApprovedBy: row.commercial_go_live_approved_by,
    commercialGoLiveApprovalNote: row.commercial_go_live_approval_note,
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

  async findByShopIds(shopIds: string[]): Promise<Map<string, ShopAccessState | null>> {
    const result = new Map<string, ShopAccessState | null>();
    for (const id of shopIds) result.set(id, null);
    if (shopIds.length === 0) return result;
    const { data, error } = await this.supabase
      .from('shop_access_states')
      .select('*')
      .in('shop_id', shopIds)
      .returns<ShopAccessStateRow[]>();
    if (error) throw new Error(`shop_access_states_find_by_shop_ids_failed:${error.message}`);
    for (const row of data ?? []) {
      const state = toShopAccessState(row);
      result.set(state.shopId, state);
    }
    return result;
  }

  async upsert(params: {
    shopId: string;
    liveCallsEnabled?: boolean;
    goLiveAt?: string | null;
    liveCallsPausedReason?: string | null;
    liveCallsPausedAt?: string | null;
    lastAccessCheckAt?: string | null;
    forwardingClaimedAt?: string | null;
    forwardingVerifiedAt?: string | null;
    forwardingVerifiedSource?: ShopAccessState['forwardingVerifiedSource'];
    forwardingSetupVerifiedAt?: string | null;
    forwardingSetupVerifiedVia?: ShopAccessState['forwardingSetupVerifiedVia'];
    commercialGoLiveApprovedAt?: string | null;
    commercialGoLiveApprovedBy?: string | null;
    commercialGoLiveApprovalNote?: string | null;
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
          forwarding_claimed_at:
            params.forwardingClaimedAt !== undefined
              ? params.forwardingClaimedAt
              : (existing?.forwardingClaimedAt ?? null),
          forwarding_verified_at:
            params.forwardingVerifiedAt !== undefined
              ? params.forwardingVerifiedAt
              : (params.forwardingSetupVerifiedAt !== undefined
                ? params.forwardingSetupVerifiedAt
                : (existing?.forwardingVerifiedAt ?? existing?.forwardingSetupVerifiedAt ?? null)),
          forwarding_verified_source:
            params.forwardingVerifiedSource !== undefined
              ? params.forwardingVerifiedSource
              : (params.forwardingSetupVerifiedVia === 'inbound_test_call' || params.forwardingSetupVerifiedVia === 'forwarding_test'
                ? 'inbound_test'
                : (existing?.forwardingVerifiedSource ?? null)),
          commercial_go_live_approved_at:
            params.commercialGoLiveApprovedAt !== undefined
              ? params.commercialGoLiveApprovedAt
              : (existing?.commercialGoLiveApprovedAt ?? null),
          commercial_go_live_approved_by:
            params.commercialGoLiveApprovedBy !== undefined
              ? params.commercialGoLiveApprovedBy
              : (existing?.commercialGoLiveApprovedBy ?? null),
          commercial_go_live_approval_note:
            params.commercialGoLiveApprovalNote !== undefined
              ? params.commercialGoLiveApprovalNote
              : (existing?.commercialGoLiveApprovalNote ?? null),
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
