import type { SupabaseClient } from '@supabase/supabase-js';

import type { CommercialGoLiveApprovalEvent } from '@/src/backend/domain/types';
import type { CommercialGoLiveApprovalEventsRepository } from '@/src/backend/ports/repositories';

type CommercialGoLiveApprovalEventRow = {
  id: string;
  shop_id: string;
  event_type: CommercialGoLiveApprovalEvent['eventType'];
  actor_email: string;
  note: string | null;
  created_at: string;
};

function toEvent(row: CommercialGoLiveApprovalEventRow): CommercialGoLiveApprovalEvent {
  return {
    id: row.id,
    shopId: row.shop_id,
    eventType: row.event_type,
    actorEmail: row.actor_email,
    note: row.note,
    createdAt: row.created_at,
  };
}

export class SupabaseCommercialGoLiveApprovalEventsRepository implements CommercialGoLiveApprovalEventsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(params: {
    shopId: string;
    eventType: CommercialGoLiveApprovalEvent['eventType'];
    actorEmail: string;
    note?: string | null;
    createdAt?: string;
  }): Promise<CommercialGoLiveApprovalEvent> {
    const { data, error } = await this.supabase
      .from('commercial_go_live_approval_events')
      .insert({
        shop_id: params.shopId,
        event_type: params.eventType,
        actor_email: params.actorEmail,
        note: params.note ?? null,
        ...(params.createdAt ? { created_at: params.createdAt } : {}),
      })
      .select('*')
      .single<CommercialGoLiveApprovalEventRow>();
    if (error) throw new Error(`commercial_go_live_approval_events_create_failed:${error.message}`);
    return toEvent(data);
  }

  async listByShopId(shopId: string, limit = 20): Promise<CommercialGoLiveApprovalEvent[]> {
    const { data, error } = await this.supabase
      .from('commercial_go_live_approval_events')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(limit, 100)))
      .returns<CommercialGoLiveApprovalEventRow[]>();
    if (error) throw new Error(`commercial_go_live_approval_events_list_by_shop_id_failed:${error.message}`);
    return (data ?? []).map(toEvent);
  }
}
