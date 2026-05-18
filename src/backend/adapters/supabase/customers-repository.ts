import type { SupabaseClient } from '@supabase/supabase-js';

import type { Customer } from '@/src/backend/domain/types';
import type { CustomersRepository } from '@/src/backend/ports/repositories';

export class SupabaseCustomersRepository implements CustomersRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async isSmsOptedOut(shopId: string, phone: string): Promise<boolean> {
    const [shopLevel, platformLevel] = await Promise.all([
      this.supabase
        .from('customers')
        .select('sms_opt_out')
        .eq('shop_id', shopId)
        .eq('phone', phone)
        .maybeSingle(),
      this.supabase
        .from('sms_opt_outs')
        .select('phone')
        .eq('phone', phone)
        .maybeSingle(),
    ]);
    return shopLevel.data?.sms_opt_out === true || platformLevel.data !== null;
  }

  async setSmsOptOut(shopId: string, phone: string, optOut: boolean): Promise<void> {
    await this.supabase
      .from('customers')
      .upsert(
        { shop_id: shopId, phone, sms_opt_out: optOut, updated_at: new Date().toISOString() },
        { onConflict: 'phone,shop_id' },
      );
  }

  async setPlatformSmsOptOut(phone: string): Promise<void> {
    await this.supabase
      .from('sms_opt_outs')
      .upsert({ phone, opted_out_at: new Date().toISOString() }, { onConflict: 'phone' });
  }

  async isSmsConsented(shopId: string, phone: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('customers')
      .select('sms_consent')
      .eq('shop_id', shopId)
      .eq('phone', phone)
      .maybeSingle();
    return data?.sms_consent === true;
  }

  async setSmsConsent(shopId: string, phone: string): Promise<void> {
    await this.supabase
      .from('customers')
      .upsert(
        { shop_id: shopId, phone, sms_consent: true, sms_consent_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: 'phone,shop_id' },
      );
  }

  async upsert(customer: Omit<Customer, 'sms_opt_out' | 'sms_consent' | 'sms_consent_at'>): Promise<Customer> {
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
      .select('phone,shop_id,full_name,last_service,preferred_tech,visit_count,notes,sms_opt_out,sms_consent,sms_consent_at,last_visit_at')
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
      sms_consent: data.sms_consent ?? false,
      sms_consent_at: data.sms_consent_at ?? null,
      last_visit_at: data.last_visit_at,
    };
  }
}
