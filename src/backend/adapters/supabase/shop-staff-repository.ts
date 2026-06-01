import type { SupabaseClient } from '@supabase/supabase-js';

import type { ShopStaff, ShopStaffExternalProvider, ShopStaffService } from '@/src/backend/domain/types';
import type {
  CreateShopStaff,
  ShopStaffRepository,
  ShopStaffServicesRepository,
  UpdateShopStaff,
  UpsertShopStaff,
} from '@/src/backend/ports/repositories';

type ShopStaffRow = {
  id: string;
  shop_id: string;
  name: string;
  role: string | null;
  specialties: string[] | null;
  notes: string | null;
  active: boolean;
  all_services?: boolean | null;
  external_provider: ShopStaffExternalProvider | null;
  external_staff_id: string | null;
  external_metadata: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

type ShopStaffServiceRow = {
  id: string;
  shop_id: string;
  staff_id: string;
  service_id: string;
  created_at?: string;
};

function toShopStaff(row: ShopStaffRow): ShopStaff {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    role: row.role,
    specialties: row.specialties ?? [],
    notes: row.notes,
    active: row.active,
    allServices: row.all_services ?? true,
    externalProvider: row.external_provider,
    externalStaffId: row.external_staff_id,
    externalMetadata: row.external_metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toShopStaffService(row: ShopStaffServiceRow): ShopStaffService {
  return {
    id: row.id,
    shopId: row.shop_id,
    staffId: row.staff_id,
    serviceId: row.service_id,
    createdAt: row.created_at,
  };
}

const SHOP_STAFF_SELECT =
  'id,shop_id,name,role,specialties,notes,active,all_services,external_provider,external_staff_id,external_metadata,created_at,updated_at';

function toUpsertRow(staff: UpsertShopStaff) {
  const row: Record<string, unknown> = {
    shop_id: staff.shopId,
    name: staff.name,
    role: staff.role ?? null,
    specialties: staff.specialties ?? [],
    notes: staff.notes ?? null,
    active: staff.active !== false,
    external_provider: staff.externalProvider,
    external_staff_id: staff.externalStaffId,
    external_metadata: staff.externalMetadata ?? {},
    updated_at: new Date().toISOString(),
  };
  if (staff.allServices !== undefined) row.all_services = staff.allServices;
  return row;
}

function toCreateRow(staff: CreateShopStaff) {
  return {
    shop_id: staff.shopId,
    name: staff.name,
    role: staff.role ?? null,
    specialties: staff.specialties ?? [],
    notes: staff.notes ?? null,
    active: staff.active !== false,
    all_services: staff.allServices ?? true,
    external_provider: null,
    external_staff_id: null,
    external_metadata: {},
    updated_at: new Date().toISOString(),
  };
}

function toUpdateRow(data: UpdateShopStaff) {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.name !== undefined) row.name = data.name;
  if (data.role !== undefined) row.role = data.role;
  if (data.specialties !== undefined) row.specialties = data.specialties;
  if (data.notes !== undefined) row.notes = data.notes;
  if (data.active !== undefined) row.active = data.active;
  if (data.allServices !== undefined) row.all_services = data.allServices;
  return row;
}

export class SupabaseShopStaffRepository implements ShopStaffRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByShopId(shopId: string): Promise<ShopStaff[]> {
    const { data, error } = await this.supabase
      .from('shop_staff')
      .select(SHOP_STAFF_SELECT)
      .eq('shop_id', shopId)
      .order('name', { ascending: true })
      .returns<ShopStaffRow[]>();
    if (error) throw new Error(`shop_staff_find_by_shop_failed:${error.message}`);
    return (data ?? []).map(toShopStaff);
  }

  async findById(id: string): Promise<ShopStaff | null> {
    const { data, error } = await this.supabase
      .from('shop_staff')
      .select(SHOP_STAFF_SELECT)
      .eq('id', id)
      .maybeSingle<ShopStaffRow>();
    if (error) throw new Error(`shop_staff_find_by_id_failed:${error.message}`);
    return data ? toShopStaff(data) : null;
  }

  async findByExternalId(
    shopId: string,
    provider: ShopStaffExternalProvider,
    externalStaffId: string,
  ): Promise<ShopStaff | null> {
    const { data, error } = await this.supabase
      .from('shop_staff')
      .select(SHOP_STAFF_SELECT)
      .eq('shop_id', shopId)
      .eq('external_provider', provider)
      .eq('external_staff_id', externalStaffId)
      .maybeSingle<ShopStaffRow>();
    if (error) throw new Error(`shop_staff_find_by_external_id_failed:${error.message}`);
    return data ? toShopStaff(data) : null;
  }

  async create(staff: CreateShopStaff): Promise<ShopStaff> {
    const { data, error } = await this.supabase
      .from('shop_staff')
      .insert(toCreateRow(staff))
      .select(SHOP_STAFF_SELECT)
      .single<ShopStaffRow>();
    if (error) throw new Error(`shop_staff_create_failed:${error.message}`);
    return toShopStaff(data);
  }

  async upsert(staff: UpsertShopStaff): Promise<ShopStaff> {
    const { data, error } = await this.supabase
      .from('shop_staff')
      .upsert(toUpsertRow(staff), {
        onConflict: 'shop_id,external_provider,external_staff_id',
        ignoreDuplicates: false,
      })
      .select(SHOP_STAFF_SELECT)
      .single<ShopStaffRow>();
    if (error) throw new Error(`shop_staff_upsert_failed:${error.message}`);
    return toShopStaff(data);
  }

  async update(id: string, data: UpdateShopStaff): Promise<ShopStaff> {
    const { data: row, error } = await this.supabase
      .from('shop_staff')
      .update(toUpdateRow(data))
      .eq('id', id)
      .select(SHOP_STAFF_SELECT)
      .maybeSingle<ShopStaffRow>();
    if (error) throw new Error(`shop_staff_update_failed:${error.message}`);
    if (!row) throw new Error('shop_staff_update_not_found');
    return toShopStaff(row);
  }

  async deleteById(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('shop_staff')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`shop_staff_delete_failed:${error.message}`);
  }

  async bulkUpsertFromSync(
    shopId: string,
    staff: UpsertShopStaff[],
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const records = staff.filter((item) => item.shopId === shopId);
    if (records.length === 0) return { created: 0, updated: 0, skipped: 0 };

    const provider = records[0]?.externalProvider;
    const externalIds = [...new Set(records.map((item) => item.externalStaffId).filter(Boolean))];
    const { data: existingRows, error: existingError } = await this.supabase
      .from('shop_staff')
      .select('external_staff_id')
      .eq('shop_id', shopId)
      .eq('external_provider', provider)
      .in('external_staff_id', externalIds)
      .returns<Array<{ external_staff_id: string | null }>>();
    if (existingError) throw new Error(`shop_staff_existing_lookup_failed:${existingError.message}`);

    const existingIds = new Set((existingRows ?? []).map((row) => row.external_staff_id).filter((id): id is string => Boolean(id)));
    const { error } = await this.supabase
      .from('shop_staff')
      .upsert(records.map(toUpsertRow), {
        onConflict: 'shop_id,external_provider,external_staff_id',
        ignoreDuplicates: false,
      });
    if (error) throw new Error(`shop_staff_bulk_upsert_failed:${error.message}`);

    const updated = records.filter((item) => existingIds.has(item.externalStaffId)).length;
    return {
      created: records.length - updated,
      updated,
      skipped: staff.length - records.length,
    };
  }

  async deactivateNotInList(
    shopId: string,
    provider: ShopStaffExternalProvider,
    activeExternalIds: string[],
  ): Promise<number> {
    const { data: currentRows, error: currentError } = await this.supabase
      .from('shop_staff')
      .select('id,external_staff_id')
      .eq('shop_id', shopId)
      .eq('external_provider', provider)
      .eq('active', true)
      .returns<Array<{ id: string; external_staff_id: string | null }>>();
    if (currentError) throw new Error(`shop_staff_deactivate_lookup_failed:${currentError.message}`);

    const keep = new Set(activeExternalIds);
    const idsToDeactivate = (currentRows ?? [])
      .filter((row) => !row.external_staff_id || !keep.has(row.external_staff_id))
      .map((row) => row.id);
    if (idsToDeactivate.length === 0) return 0;

    const { data, error } = await this.supabase
      .from('shop_staff')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('shop_id', shopId)
      .eq('external_provider', provider)
      .in('id', idsToDeactivate)
      .select('id')
      .returns<Array<{ id: string }>>();
    if (error) throw new Error(`shop_staff_deactivate_failed:${error.message}`);
    return data?.length ?? 0;
  }
}

export class SupabaseShopStaffServicesRepository implements ShopStaffServicesRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async setMappingsForStaff(
    shopId: string,
    staffId: string,
    serviceIds: string[],
  ): Promise<{ created: number; skipped: number }> {
    const uniqueServiceIds = [...new Set(serviceIds.filter(Boolean))];
    if (uniqueServiceIds.length === 0) return { created: 0, skipped: 0 };

    const { data: existingRows, error: existingError } = await this.supabase
      .from('shop_staff_services')
      .select('service_id')
      .eq('shop_id', shopId)
      .eq('staff_id', staffId)
      .in('service_id', uniqueServiceIds)
      .returns<Array<{ service_id: string }>>();
    if (existingError) throw new Error(`shop_staff_services_existing_lookup_failed:${existingError.message}`);

    const existingIds = new Set((existingRows ?? []).map((row) => row.service_id));
    const rows = uniqueServiceIds.map((serviceId) => ({
      shop_id: shopId,
      staff_id: staffId,
      service_id: serviceId,
    }));
    const { error } = await this.supabase.from('shop_staff_services').upsert(rows, {
      onConflict: 'staff_id,service_id',
      ignoreDuplicates: true,
    });
    if (error) throw new Error(`shop_staff_services_set_mappings_failed:${error.message}`);

    return {
      created: uniqueServiceIds.filter((serviceId) => !existingIds.has(serviceId)).length,
      skipped: uniqueServiceIds.filter((serviceId) => existingIds.has(serviceId)).length,
    };
  }

  async replaceMappingsForStaff(
    shopId: string,
    staffId: string,
    serviceIds: string[],
  ): Promise<{ created: number; skipped: number }> {
    const uniqueServiceIds = [...new Set(serviceIds.filter(Boolean))];

    const { data: existingRows, error: existingError } = await this.supabase
      .from('shop_staff_services')
      .select('service_id')
      .eq('shop_id', shopId)
      .eq('staff_id', staffId)
      .returns<Array<{ service_id: string }>>();
    if (existingError) throw new Error(`shop_staff_services_replace_lookup_failed:${existingError.message}`);

    const desiredIds = new Set(uniqueServiceIds);
    const existingIds = new Set((existingRows ?? []).map((row) => row.service_id));
    const idsToDelete = [...existingIds].filter((serviceId) => !desiredIds.has(serviceId));
    const idsToInsert = uniqueServiceIds.filter((serviceId) => !existingIds.has(serviceId));

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await this.supabase
        .from('shop_staff_services')
        .delete()
        .eq('shop_id', shopId)
        .eq('staff_id', staffId)
        .in('service_id', idsToDelete);
      if (deleteError) throw new Error(`shop_staff_services_replace_delete_failed:${deleteError.message}`);
    }

    if (idsToInsert.length === 0) {
      return {
        created: 0,
        skipped: uniqueServiceIds.filter((serviceId) => existingIds.has(serviceId)).length,
      };
    }

    const rows = idsToInsert.map((serviceId) => ({
      shop_id: shopId,
      staff_id: staffId,
      service_id: serviceId,
    }));
    const { error } = await this.supabase.from('shop_staff_services').insert(rows);
    if (error) throw new Error(`shop_staff_services_replace_insert_failed:${error.message}`);
    return {
      created: idsToInsert.length,
      skipped: uniqueServiceIds.filter((serviceId) => existingIds.has(serviceId)).length,
    };
  }

  async clearMappingsForStaff(
    shopId: string,
    staffId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('shop_staff_services')
      .delete()
      .eq('shop_id', shopId)
      .eq('staff_id', staffId);
    if (error) throw new Error(`shop_staff_services_clear_failed:${error.message}`);
  }

  async getServiceIdsByStaffId(shopId: string, staffId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('shop_staff_services')
      .select('service_id')
      .eq('shop_id', shopId)
      .eq('staff_id', staffId)
      .returns<Array<{ service_id: string }>>();
    if (error) throw new Error(`shop_staff_services_get_service_ids_failed:${error.message}`);
    return (data ?? []).map((row) => row.service_id);
  }

  async getStaffIdsByServiceId(shopId: string, serviceId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('shop_staff_services')
      .select('staff_id')
      .eq('shop_id', shopId)
      .eq('service_id', serviceId)
      .returns<Array<{ staff_id: string }>>();
    if (error) throw new Error(`shop_staff_services_get_staff_ids_failed:${error.message}`);
    return (data ?? []).map((row) => row.staff_id);
  }

  async listByShopId(shopId: string): Promise<ShopStaffService[]> {
    const { data, error } = await this.supabase
      .from('shop_staff_services')
      .select('id,shop_id,staff_id,service_id,created_at')
      .eq('shop_id', shopId)
      .returns<ShopStaffServiceRow[]>();
    if (error) throw new Error(`shop_staff_services_list_failed:${error.message}`);
    return (data ?? []).map(toShopStaffService);
  }
}
