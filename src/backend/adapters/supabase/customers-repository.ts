import type { SupabaseClient } from '@supabase/supabase-js';

import type { Customer } from '@/src/backend/domain/types';
import type { CustomersRepository } from '@/src/backend/ports/repositories';

export class SupabaseCustomersRepository implements CustomersRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async isSmsOptedOut(shopId: string, phone: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('customers')
      .select('sms_opt_out')
      .eq('shop_id', shopId)
      .eq('phone', phone)
      .maybeSingle();
    return data?.sms_opt_out === true;
  }

  async setSmsOptOut(shopId: string, phone: string, optOut: boolean): Promise<void> {
    await this.supabase
      .from('customers')
      .upsert(
        { shop_id: shopId, phone, sms_opt_out: optOut, updated_at: new Date().toISOString() },
        { onConflict: 'phone,shop_id' },
      );
  }

  async upsert(customer: Omit<Customer, 'sms_opt_out'>): Promise<Customer> {
    const { data, error } = await this.supabase
      .from('customers')
      .upsert(
        {
          phone: customer.phone,
          shop_id: customer.shop_id,
          full_name: customer.full_name ?? null,
          last_service: customer.last_service ?? null,
          preferred_tech: customer.preferred_tech ?? null,
          visit_count: customer.visit_count,
          notes: customer.notes ?? null,
          last_visit_at: customer.last_visit_at ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'phone,shop_id', ignoreDuplicates: false },
      )
      .select('phone,shop_id,full_name,last_service,preferred_tech,visit_count,notes,sms_opt_out,last_visit_at')
      .single();
    if (error) throw error;
    return {
      phone: data.phone,
      shop_id: data.shop_id,
      full_name: data.full_name,
      last_service: data.last_service,
      preferred_tech: data.preferred_tech,
      visit_count: data.visit_count,
      notes: data.notes,
      sms_opt_out: data.sms_opt_out,
      last_visit_at: data.last_visit_at,
    };
  }
}
