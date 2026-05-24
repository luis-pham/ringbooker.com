import type { SupabaseClient } from '@supabase/supabase-js';

import type { ShopOverageCharge, ShopOverageChargeStatus } from '@/src/backend/domain/types';
import type { ShopOverageChargesRepository } from '@/src/backend/ports/repositories';

type ShopOverageChargeRow = {
  id: string;
  shop_id: string;
  billing_subscription_id: string | null;
  period_start: string;
  period_end: string;
  included_callers: number;
  captured_callers: number;
  overage_callers: number;
  rate_cents: number;
  amount_cents: number;
  paddle_subscription_id: string | null;
  paddle_transaction_id: string | null;
  status: ShopOverageChargeStatus;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
};

function toShopOverageCharge(row: ShopOverageChargeRow): ShopOverageCharge {
  return {
    id: row.id,
    shopId: row.shop_id,
    billingSubscriptionId: row.billing_subscription_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    includedCallers: row.included_callers,
    capturedCallers: row.captured_callers,
    overageCallers: row.overage_callers,
    rateCents: row.rate_cents,
    amountCents: row.amount_cents,
    paddleSubscriptionId: row.paddle_subscription_id,
    paddleTransactionId: row.paddle_transaction_id,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseShopOverageChargesRepository implements ShopOverageChargesRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByIdempotencyKey(idempotencyKey: string): Promise<ShopOverageCharge | null> {
    const { data, error } = await this.supabase
      .from('shop_overage_charges')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle<ShopOverageChargeRow>();
    if (error) throw new Error(`shop_overage_charges_find_by_idempotency_key_failed:${error.message}`);
    return data ? toShopOverageCharge(data) : null;
  }

  async create(params: {
    shopId: string;
    billingSubscriptionId?: string | null;
    periodStart: Date;
    periodEnd: Date;
    includedCallers: number;
    capturedCallers: number;
    overageCallers: number;
    rateCents: number;
    amountCents: number;
    paddleSubscriptionId?: string | null;
    paddleTransactionId?: string | null;
    status: ShopOverageChargeStatus;
    idempotencyKey: string;
  }): Promise<ShopOverageCharge> {
    const { data, error } = await this.supabase
      .from('shop_overage_charges')
      .insert({
        shop_id: params.shopId,
        billing_subscription_id: params.billingSubscriptionId ?? null,
        period_start: params.periodStart.toISOString(),
        period_end: params.periodEnd.toISOString(),
        included_callers: params.includedCallers,
        captured_callers: params.capturedCallers,
        overage_callers: params.overageCallers,
        rate_cents: params.rateCents,
        amount_cents: params.amountCents,
        paddle_subscription_id: params.paddleSubscriptionId ?? null,
        paddle_transaction_id: params.paddleTransactionId ?? null,
        status: params.status,
        idempotency_key: params.idempotencyKey,
      })
      .select('*')
      .single<ShopOverageChargeRow>();
    if (error) throw new Error(`shop_overage_charges_create_failed:${error.message}`);
    return toShopOverageCharge(data);
  }

  async updateStatus(
    idempotencyKey: string,
    status: ShopOverageChargeStatus,
    paddleTransactionId?: string | null,
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (paddleTransactionId !== undefined) patch.paddle_transaction_id = paddleTransactionId;
    const { error } = await this.supabase
      .from('shop_overage_charges')
      .update(patch)
      .eq('idempotency_key', idempotencyKey);
    if (error) throw new Error(`shop_overage_charges_update_status_failed:${error.message}`);
  }

  async listByShopId(shopId: string, params?: { limit?: number }): Promise<ShopOverageCharge[]> {
    const limit = params?.limit && params.limit > 0 ? params.limit : 50;
    const { data, error } = await this.supabase
      .from('shop_overage_charges')
      .select('*')
      .eq('shop_id', shopId)
      .order('period_start', { ascending: false })
      .limit(limit)
      .returns<ShopOverageChargeRow[]>();
    if (error) throw new Error(`shop_overage_charges_list_by_shop_id_failed:${error.message}`);
    return (data ?? []).map(toShopOverageCharge);
  }
}
