import { randomUUID } from 'node:crypto';

import type {
  SalesPreparedDemo,
  SalesPreparedDemosRepository,
  UpsertPreparedDemoParams,
} from '@/src/backend/ports/sales-prepared-demos';

export class InMemorySalesPreparedDemosRepository implements SalesPreparedDemosRepository {
  private readonly byId = new Map<string, SalesPreparedDemo>();

  async upsertByLead(params: UpsertPreparedDemoParams): Promise<SalesPreparedDemo> {
    const now = new Date().toISOString();
    const existing = [...this.byId.values()].find((d) => d.salesLeadId === params.salesLeadId);

    if (existing) {
      const updated: SalesPreparedDemo = {
        ...existing,
        vertical: params.vertical,
        businessName: params.businessName,
        address: params.address ?? null,
        city: params.city ?? null,
        state: params.state ?? null,
        websiteUrl: params.websiteUrl ?? null,
        instagramUrl: params.instagramUrl ?? null,
        logoUrl: params.logoUrl ?? null,
        demoConfig: params.demoConfig,
        systemPrompt: params.systemPrompt ?? null,
        expiresAt: params.expiresAt.toISOString(),
        updatedAt: now,
      };
      this.byId.set(existing.id, updated);
      return updated;
    }

    const record: SalesPreparedDemo = {
      id: randomUUID(),
      salesLeadId: params.salesLeadId,
      slug: params.slug,
      vertical: params.vertical,
      businessName: params.businessName,
      address: params.address ?? null,
      city: params.city ?? null,
      state: params.state ?? null,
      websiteUrl: params.websiteUrl ?? null,
      instagramUrl: params.instagramUrl ?? null,
      logoUrl: params.logoUrl ?? null,
      demoConfig: params.demoConfig,
      systemPrompt: params.systemPrompt ?? null,
      expiresAt: params.expiresAt.toISOString(),
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(record.id, record);
    return record;
  }

  async findBySlug(slug: string): Promise<SalesPreparedDemo | null> {
    return [...this.byId.values()].find((d) => d.slug === slug) ?? null;
  }

  async findByLead(salesLeadId: string): Promise<SalesPreparedDemo | null> {
    return [...this.byId.values()].find((d) => d.salesLeadId === salesLeadId) ?? null;
  }

  async slugExists(slug: string): Promise<boolean> {
    return [...this.byId.values()].some((d) => d.slug === slug);
  }
}
