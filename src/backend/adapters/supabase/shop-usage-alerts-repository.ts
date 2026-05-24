import type { SupabaseClient } from '@supabase/supabase-js';

import type { ShopUsageAlert, ShopUsageAlertType } from '@/src/backend/domain/types';
import type { ShopUsageAlertsRepository } from '@/src/backend/ports/repositories';

type ShopUsageAlertRow = {
  id: string;
  shop_id: string;
  alert_type: ShopUsageAlertType;
  period_start: string;
  sent_at: string;
  idempotency_key: string;
};

function toShopUsageAlert(row: ShopUsageAlertRow): ShopUsageAlert {
  return {
    id: row.id,
    shopId: row.shop_id,
    alertType: row.alert_type,
    periodStart: row.period_start,
    sentAt: row.sent_at,
    idempotencyKey: row.idempotency_key,
  };
}

export class SupabaseShopUsageAlertsRepository implements ShopUsageAlertsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByIdempotencyKey(idempotencyKey: string): Promise<ShopUsageAlert | null> {
    const { data, error } = await this.supabase
      .from('shop_usage_alerts')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle<ShopUsageAlertRow>();
    if (error) throw new Error(`shop_usage_alerts_find_by_idempotency_key_failed:${error.message}`);
    return data ? toShopUsageAlert(data) : null;
  }

  async create(params: {
    shopId: string;
    alertType: ShopUsageAlertType;
    periodStart: Date;
    idempotencyKey: string;
  }): Promise<ShopUsageAlert> {
    const { data, error } = await this.supabase
      .from('shop_usage_alerts')
      .insert({
        shop_id: params.shopId,
        alert_type: params.alertType,
        period_start: params.periodStart.toISOString(),
        idempotency_key: params.idempotencyKey,
      })
      .select('*')
      .single<ShopUsageAlertRow>();
    if (error) throw new Error(`shop_usage_alerts_create_failed:${error.message}`);
    return toShopUsageAlert(data);
  }
}
