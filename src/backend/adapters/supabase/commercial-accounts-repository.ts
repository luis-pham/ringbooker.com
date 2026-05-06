
import type { SupabaseClient } from '@supabase/supabase-js';

import type { CommercialAccount } from '@/src/backend/domain/types';
import type { CommercialAccountsRepository } from '@/src/backend/ports/repositories';

type Row = {
  shop_id: string; contract_status: CommercialAccount['contractStatus']; monthly_minimum_cents: number | null;
  setup_fee_cents: number | null; included_locations: number | null; included_minutes: number | null;
  overage_rate_cents: number | null; billing_method: CommercialAccount['billingMethod']; contract_signed_at: string | null;
  approved_at: string | null; notes: string | null; created_at: string; updated_at: string;
};

function toAccount(row: Row): CommercialAccount {
  return {
    shopId: row.shop_id,
    contractStatus: row.contract_status,
    monthlyMinimumCents: row.monthly_minimum_cents,
    setupFeeCents: row.setup_fee_cents,
    includedLocations: row.included_locations,
    includedMinutes: row.included_minutes,
    overageRateCents: row.overage_rate_cents,
    billingMethod: row.billing_method,
    contractSignedAt: row.contract_signed_at,
    approvedAt: row.approved_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseCommercialAccountsRepository implements CommercialAccountsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByShopId(shopId: string): Promise<CommercialAccount | null> {
    const { data, error } = await this.supabase.from('commercial_accounts').select('*').eq('shop_id', shopId).maybeSingle<Row>();
    if (error) throw new Error(`commercial_accounts_find_by_shop_id_failed:${error.message}`);
    return data ? toAccount(data) : null;
  }

  async upsert(params: CommercialAccount): Promise<CommercialAccount> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('commercial_accounts')
      .upsert({
        shop_id: params.shopId,
        contract_status: params.contractStatus,
        monthly_minimum_cents: params.monthlyMinimumCents ?? null,
        setup_fee_cents: params.setupFeeCents ?? null,
        included_locations: params.includedLocations ?? null,
        included_minutes: params.includedMinutes ?? null,
        overage_rate_cents: params.overageRateCents ?? null,
        billing_method: params.billingMethod,
        contract_signed_at: params.contractSignedAt ?? null,
        approved_at: params.approvedAt ?? null,
        notes: params.notes ?? null,
        updated_at: now,
      }, { onConflict: 'shop_id' })
      .select('*')
      .single<Row>();
    if (error) throw new Error(`commercial_accounts_upsert_failed:${error.message}`);
    return toAccount(data);
  }
}
