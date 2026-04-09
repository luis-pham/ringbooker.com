import type { SupabaseClient } from '@supabase/supabase-js';

import type { BillingCustomer } from '@/src/backend/domain/types';
import type { BillingCustomersRepository } from '@/src/backend/ports/repositories';

type BillingCustomersRow = {
  id: string;
  shop_id: string;
  provider: BillingCustomer['provider'];
  provider_customer_id: string;
  email: string | null;
  created_at: string;
  updated_at: string;
};

function toBillingCustomer(row: BillingCustomersRow): BillingCustomer {
  return {
    id: row.id,
    shopId: row.shop_id,
    provider: row.provider,
    providerCustomerId: row.provider_customer_id,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseBillingCustomersRepository implements BillingCustomersRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByShopId(shopId: string, provider?: BillingCustomer['provider']): Promise<BillingCustomer | null> {
    let query = this.supabase.from('billing_customers').select('*').eq('shop_id', shopId).limit(1);
    if (provider) query = query.eq('provider', provider);
    const { data, error } = await query.maybeSingle<BillingCustomersRow>();
    if (error) {
      throw new Error(`billing_customers_find_by_shop_id_failed:${error.message}`);
    }
    return data ? toBillingCustomer(data) : null;
  }

  async findByProviderCustomerId(
    provider: BillingCustomer['provider'],
    providerCustomerId: string,
  ): Promise<BillingCustomer | null> {
    const { data, error } = await this.supabase
      .from('billing_customers')
      .select('*')
      .eq('provider', provider)
      .eq('provider_customer_id', providerCustomerId)
      .maybeSingle<BillingCustomersRow>();
    if (error) {
      throw new Error(`billing_customers_find_by_provider_customer_id_failed:${error.message}`);
    }
    return data ? toBillingCustomer(data) : null;
  }

  async upsert(params: {
    shopId: string;
    provider: BillingCustomer['provider'];
    providerCustomerId: string;
    email?: string | null;
  }): Promise<BillingCustomer> {
    const { data, error } = await this.supabase
      .from('billing_customers')
      .upsert(
        {
          shop_id: params.shopId,
          provider: params.provider,
          provider_customer_id: params.providerCustomerId,
          email: params.email ?? null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'provider,provider_customer_id',
        },
      )
      .select('*')
      .single<BillingCustomersRow>();
    if (error) {
      throw new Error(`billing_customers_upsert_failed:${error.message}`);
    }
    return toBillingCustomer(data);
  }
}
