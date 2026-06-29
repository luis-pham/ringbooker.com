import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  SalesPreparedDemo,
  SalesPreparedDemoConfig,
  SalesPreparedDemosRepository,
  UpsertPreparedDemoParams,
} from '@/src/backend/ports/sales-prepared-demos';

type SalesPreparedDemoRow = {
  id: string;
  sales_lead_id: string;
  slug: string;
  vertical: string;
  business_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  website_url: string | null;
  instagram_url: string | null;
  logo_url: string | null;
  demo_config: SalesPreparedDemoConfig | null;
  system_prompt: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

function toDomain(row: SalesPreparedDemoRow): SalesPreparedDemo {
  return {
    id: row.id,
    salesLeadId: row.sales_lead_id,
    slug: row.slug,
    vertical: row.vertical,
    businessName: row.business_name,
    address: row.address ?? null,
    city: row.city,
    state: row.state,
    websiteUrl: row.website_url,
    instagramUrl: row.instagram_url,
    logoUrl: row.logo_url ?? null,
    demoConfig: row.demo_config ?? {},
    systemPrompt: row.system_prompt,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseSalesPreparedDemosRepository implements SalesPreparedDemosRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async upsertByLead(params: UpsertPreparedDemoParams): Promise<SalesPreparedDemo> {
    const existing = await this.findByLead(params.salesLeadId);

    if (existing) {
      // Keep the original slug so previously-shared links keep working.
      const { data, error } = await this.supabase
        .from('sales_prepared_demos')
        .update({
          vertical: params.vertical,
          business_name: params.businessName,
          address: params.address ?? null,
          city: params.city ?? null,
          state: params.state ?? null,
          website_url: params.websiteUrl ?? null,
          instagram_url: params.instagramUrl ?? null,
          logo_url: params.logoUrl ?? null,
          demo_config: params.demoConfig,
          system_prompt: params.systemPrompt ?? null,
          expires_at: params.expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single<SalesPreparedDemoRow>();
      if (error || !data) throw new Error(`sales_prepared_demos update failed: ${error?.message ?? 'unknown'}`);
      return toDomain(data);
    }

    const { data, error } = await this.supabase
      .from('sales_prepared_demos')
      .insert({
        sales_lead_id: params.salesLeadId,
        slug: params.slug,
        vertical: params.vertical,
        business_name: params.businessName,
        address: params.address ?? null,
        city: params.city ?? null,
        state: params.state ?? null,
        website_url: params.websiteUrl ?? null,
        instagram_url: params.instagramUrl ?? null,
        logo_url: params.logoUrl ?? null,
        demo_config: params.demoConfig,
        system_prompt: params.systemPrompt ?? null,
        expires_at: params.expiresAt.toISOString(),
      })
      .select('*')
      .single<SalesPreparedDemoRow>();
    if (error || !data) throw new Error(`sales_prepared_demos insert failed: ${error?.message ?? 'unknown'}`);
    return toDomain(data);
  }

  async findBySlug(slug: string): Promise<SalesPreparedDemo | null> {
    const { data } = await this.supabase
      .from('sales_prepared_demos')
      .select('*')
      .eq('slug', slug)
      .maybeSingle<SalesPreparedDemoRow>();
    return data ? toDomain(data) : null;
  }

  async findByLead(salesLeadId: string): Promise<SalesPreparedDemo | null> {
    const { data } = await this.supabase
      .from('sales_prepared_demos')
      .select('*')
      .eq('sales_lead_id', salesLeadId)
      .maybeSingle<SalesPreparedDemoRow>();
    return data ? toDomain(data) : null;
  }

  async slugExists(slug: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('sales_prepared_demos')
      .select('id')
      .eq('slug', slug)
      .maybeSingle<{ id: string }>();
    return Boolean(data);
  }
}
