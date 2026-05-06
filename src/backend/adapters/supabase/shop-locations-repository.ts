
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ShopLocation } from '@/src/backend/domain/types';
import type { ShopLocationsRepository } from '@/src/backend/ports/repositories';

type Row = {
  id: string; shop_id: string; name: string; address: string | null; timezone: string;
  phone_number: string | null; telnyx_number: string | null; business_hours: Record<string, unknown> | null;
  active: boolean; created_at: string; updated_at: string;
};

function toLocation(row: Row): ShopLocation {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    address: row.address,
    timezone: row.timezone,
    phoneNumber: row.phone_number,
    telnyxNumber: row.telnyx_number,
    businessHours: (row.business_hours ?? {}) as ShopLocation['businessHours'],
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseShopLocationsRepository implements ShopLocationsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listByShopId(shopId: string): Promise<ShopLocation[]> {
    const { data, error } = await this.supabase
      .from('shop_locations')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: true })
      .returns<Row[]>();
    if (error) throw new Error(`shop_locations_list_by_shop_id_failed:${error.message}`);
    return (data ?? []).map(toLocation);
  }

  async create(params: {
    shopId: string; name: string; address?: string | null; timezone: string; phoneNumber?: string | null;
    telnyxNumber?: string | null; businessHours?: Record<string, unknown>; active?: boolean;
  }): Promise<ShopLocation> {
    const { data, error } = await this.supabase
      .from('shop_locations')
      .insert({
        shop_id: params.shopId,
        name: params.name,
        address: params.address ?? null,
        timezone: params.timezone,
        phone_number: params.phoneNumber ?? null,
        telnyx_number: params.telnyxNumber ?? null,
        business_hours: params.businessHours ?? {},
        active: params.active ?? true,
      })
      .select('*')
      .single<Row>();
    if (error) throw new Error(`shop_locations_create_failed:${error.message}`);
    return toLocation(data);
  }

  async update(shopId: string, locationId: string, patch: Partial<Omit<ShopLocation, 'id' | 'shopId' | 'createdAt' | 'updatedAt'>>): Promise<ShopLocation | null> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.address !== undefined) payload.address = patch.address;
    if (patch.timezone !== undefined) payload.timezone = patch.timezone;
    if (patch.phoneNumber !== undefined) payload.phone_number = patch.phoneNumber;
    if (patch.telnyxNumber !== undefined) payload.telnyx_number = patch.telnyxNumber;
    if (patch.businessHours !== undefined) payload.business_hours = patch.businessHours;
    if (patch.active !== undefined) payload.active = patch.active;
    const { data, error } = await this.supabase
      .from('shop_locations')
      .update(payload)
      .eq('shop_id', shopId)
      .eq('id', locationId)
      .select('*')
      .maybeSingle<Row>();
    if (error) throw new Error(`shop_locations_update_failed:${error.message}`);
    return data ? toLocation(data) : null;
  }
}
