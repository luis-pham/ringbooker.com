/**
 * Prepared, shareable per-salon demos created by sales.ringbooker.com via the
 * internal demo-context API and served at /try/<slug>. One row per sales lead.
 */

export type SalesPreparedDemoService = {
  category: string;
  name: string;
  price?: number | null;
  duration?: string | null;
  variants?: Array<{
    label: string;
    price?: number | null;
    duration?: string | null;
    priceType?: 'fixed' | 'from' | 'varies' | 'consultation' | null;
    notes?: string | null;
  }>;
};

export type SalesPreparedDemoConfig = {
  services?: SalesPreparedDemoService[];
  primaryHours?: string | null;
  secondaryHours?: string | null;
  staffNames?: string[];
};

export type SalesPreparedDemo = {
  id: string;
  salesLeadId: string;
  slug: string;
  vertical: string;
  businessName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  logoUrl: string | null;
  demoConfig: SalesPreparedDemoConfig;
  systemPrompt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type UpsertPreparedDemoParams = {
  salesLeadId: string;
  /** Used only on first insert; an existing lead keeps its original slug so shared links stay valid. */
  slug: string;
  vertical: string;
  businessName: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  logoUrl?: string | null;
  demoConfig: SalesPreparedDemoConfig;
  systemPrompt?: string | null;
  expiresAt: Date;
};

export interface SalesPreparedDemosRepository {
  /** Idempotent per sales lead: updates the existing row (keeping its slug) or inserts a new one. */
  upsertByLead(params: UpsertPreparedDemoParams): Promise<SalesPreparedDemo>;
  findBySlug(slug: string): Promise<SalesPreparedDemo | null>;
  findByLead(salesLeadId: string): Promise<SalesPreparedDemo | null>;
  slugExists(slug: string): Promise<boolean>;
}
