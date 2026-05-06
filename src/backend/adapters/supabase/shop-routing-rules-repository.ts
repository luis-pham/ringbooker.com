
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ShopRoutingRule } from '@/src/backend/domain/types';
import type { ShopRoutingRulesRepository } from '@/src/backend/ports/repositories';

type Row = {
  id: string; shop_id: string; location_id: string | null; rule_type: string;
  condition_json: Record<string, unknown> | null; action_json: Record<string, unknown> | null;
  priority: number; active: boolean; created_at: string; updated_at: string;
};

function toRule(row: Row): ShopRoutingRule {
  return {
    id: row.id,
    shopId: row.shop_id,
    locationId: row.location_id,
    ruleType: row.rule_type,
    conditionJson: row.condition_json ?? {},
    actionJson: row.action_json ?? {},
    priority: row.priority,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseShopRoutingRulesRepository implements ShopRoutingRulesRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listByShopId(shopId: string, params?: { activeOnly?: boolean }): Promise<ShopRoutingRule[]> {
    let query = this.supabase.from('shop_routing_rules').select('*').eq('shop_id', shopId).order('priority', { ascending: true });
    if (params?.activeOnly) query = query.eq('active', true);
    const { data, error } = await query.returns<Row[]>();
    if (error) throw new Error(`shop_routing_rules_list_by_shop_id_failed:${error.message}`);
    return (data ?? []).map(toRule);
  }

  async create(params: {
    shopId: string; locationId?: string | null; ruleType: string; conditionJson: Record<string, unknown>;
    actionJson: Record<string, unknown>; priority?: number; active?: boolean;
  }): Promise<ShopRoutingRule> {
    const { data, error } = await this.supabase
      .from('shop_routing_rules')
      .insert({
        shop_id: params.shopId,
        location_id: params.locationId ?? null,
        rule_type: params.ruleType,
        condition_json: params.conditionJson,
        action_json: params.actionJson,
        priority: params.priority ?? 100,
        active: params.active ?? true,
      })
      .select('*')
      .single<Row>();
    if (error) throw new Error(`shop_routing_rules_create_failed:${error.message}`);
    return toRule(data);
  }

  async update(shopId: string, ruleId: string, patch: Partial<Omit<ShopRoutingRule, 'id' | 'shopId' | 'createdAt' | 'updatedAt'>>): Promise<ShopRoutingRule | null> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.locationId !== undefined) payload.location_id = patch.locationId;
    if (patch.ruleType !== undefined) payload.rule_type = patch.ruleType;
    if (patch.conditionJson !== undefined) payload.condition_json = patch.conditionJson;
    if (patch.actionJson !== undefined) payload.action_json = patch.actionJson;
    if (patch.priority !== undefined) payload.priority = patch.priority;
    if (patch.active !== undefined) payload.active = patch.active;
    const { data, error } = await this.supabase
      .from('shop_routing_rules')
      .update(payload)
      .eq('shop_id', shopId)
      .eq('id', ruleId)
      .select('*')
      .maybeSingle<Row>();
    if (error) throw new Error(`shop_routing_rules_update_failed:${error.message}`);
    return data ? toRule(data) : null;
  }
}
