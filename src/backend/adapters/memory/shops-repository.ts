import { randomUUID } from 'node:crypto';

import {
  buildGeneralServiceCatalog,
  GENERAL_SERVICE_CATEGORY_NAME,
  serviceCatalogToLegacyServices,
} from '@/src/backend/domain/service-catalog';
import type { Shop } from '@/src/backend/domain/types';
import type { ShopsRepository } from '@/src/backend/ports/repositories';

const defaultShop: Shop = {
  id: 'demo-shop',
  name: 'RingBooker Demo Salon',
  vertical: 'nail_salon',
  brand_slug: 'ringbooker-demo-salon',
  phone_number: '+17145550123',
  user_phone: '+17145550199',
  handoff_availability: 'business_hours' as const,
  handoff_custom_hours: null,
  user_name: 'Demo User',
  address: '123 Main St, Garden Grove, CA',
  timezone: 'America/Los_Angeles',
  services: [
    { name: 'Manicure', duration_min: 30, price: 20 },
    { name: 'Pedicure', duration_min: 45, price: 35 },
    { name: 'Gel Nails', duration_min: 60, price: 45 },
  ],
  not_offered_services: [],
  staff: [
    { name: 'Jenny', role: 'Nail technician', specialties: ['Gel nails', 'Pedicure'], active: true },
    { name: 'Sarah', role: 'Nail artist', specialties: ['Nail art', 'Acrylic'], active: true },
  ],
  faqs: [
    { question: 'Do you accept walk-ins?', answer: 'Walk-ins are welcome when technicians are available, but appointments are recommended.' },
    { question: 'Where should clients park?', answer: 'Clients can use the front parking lot or nearby street parking.' },
  ],
  hours: {
    mon: { open: '09:00', close: '18:00' },
    tue: { open: '09:00', close: '18:00' },
    wed: { open: '09:00', close: '18:00' },
    thu: { open: '09:00', close: '18:00' },
    fri: { open: '09:00', close: '20:00' },
    sat: { open: '09:00', close: '18:00' },
    sun: { closed: true },
  },
  cancel_policy: '2-hour cancellation policy applies.',
  promotions: '10% off for first-time customers this week.',
  booking_url: 'https://ringbooker.com/demo',
  booking_method: null,
  selected_integration: null,
  website_url: 'https://ringbooker.com/demo',
  languages: ['en', 'vi'],
  current_onboarding_step: 4,
  setup_method: null,
  forwarding_type: 'no_answer',
  forwarding_carrier: null,
  forwarding_country: 'us',
  telnyx_number: null,
  forwarding_number_status: 'none',
  forwarding_number_provisioning_started_at: null,
  forwarding_number_provisioned_at: null,
  forwarding_number_released_at: null,
  forwarding_number_release_reason: null,
  forwarding_number_provider_order_id: null,
  forwarding_number_last_error: null,
  detected_carrier: null,
  detected_line_type: null,
  carrier_detected_at: null,
  test_call_count: 0,
  test_call_limit: 3,
  ai_voice: 'Aoede',
  ai_welcome_message: 'Thanks for calling RingBooker Demo Salon. How can I help you today?',
  ai_custom_instructions: 'Prioritize manicure and pedicure bookings and keep answers concise.',
  allow_transfers: true,
  allow_callbacks: true,
  sms_owner_opted_in: false,
  send_reminder_sms: true,
  send_review_request_sms: true,
  send_missed_call_followup_sms: true,
  plan: 'professional',
  active: true,
};

export class InMemoryShopsRepository implements ShopsRepository {
  private readonly shops = new Map<string, Shop>([[defaultShop.id, defaultShop]]);
  private readonly serviceCatalogs = new Map<string, NonNullable<Shop['service_catalog']>>();
  private readonly shopCreatedAt = new Map<string, string>([[defaultShop.id, new Date().toISOString()]]);

  private hydrateShop(shop: Shop): Shop {
    const catalog = this.serviceCatalogs.get(shop.id);
    if (!catalog) return shop;
    return {
      ...shop,
      service_catalog: catalog,
      services: serviceCatalogToLegacyServices(catalog),
    };
  }

  async findByDestinationPhone(destinationPhone: string): Promise<Shop | null> {
    for (const shop of this.shops.values()) {
      if (shop.active && shop.phone_number === destinationPhone) {
        return this.hydrateShop(shop);
      }
    }
    return null;
  }

  async findByTelnyxNumber(e164: string): Promise<Shop | null> {
    for (const shop of this.shops.values()) {
      if (shop.active && shop.telnyx_number && shop.telnyx_number === e164) {
        return this.hydrateShop(shop);
      }
    }
    return null;
  }

  async findById(shopId: string): Promise<Shop | null> {
    const shop = this.shops.get(shopId);
    return shop ? this.hydrateShop(shop) : null;
  }

  async list(params?: { limit?: number }): Promise<Shop[]> {
    const limit = params?.limit && params.limit > 0 ? params.limit : 50;
    return [...this.shops.values()].slice(0, limit).map((shop) => this.hydrateShop(shop));
  }

  async listCreatedAtInRange(params: { createdAfter: Date; createdBefore: Date }): Promise<string[]> {
    const fromMs = params.createdAfter.getTime();
    const toMs = params.createdBefore.getTime();
    const out: string[] = [];
    for (const id of this.shops.keys()) {
      const iso = this.shopCreatedAt.get(id);
      if (!iso) continue;
      const t = new Date(iso).getTime();
      if (t >= fromMs && t <= toMs) out.push(iso);
    }
    return out;
  }

  async create(params: {
    name: string;
    brand_slug?: string | null;
    phone_number: string;
    user_phone: string;
    user_name?: string | null;
    timezone: string;
    plan?: Shop['plan'];
    active?: boolean;
  }): Promise<Shop> {
    const id = `shop-${randomUUID()}`;
    const plan = params.plan ?? 'starter';
    const enableProfessionalDefaults = plan === 'professional' || plan === 'enterprise';
    const created: Shop = {
      id,
      name: params.name,
      vertical: null,
      vertical_detail: null,
      brand_slug: params.brand_slug ?? null,
      phone_number: params.phone_number,
      user_phone: params.user_phone,
      handoff_availability: 'business_hours',
      handoff_custom_hours: null,
      user_name: params.user_name ?? null,
      timezone: params.timezone,
      services: [],
      not_offered_services: [],
      staff: [],
      faqs: [],
      hours: {},
      cancel_policy: '2-hour cancellation policy applies.',
      ai_voice: 'Aoede',
      ai_welcome_message: null,
      ai_custom_instructions: null,
      languages: ['en'],
      website_url: null,
      current_onboarding_step: 1,
      booking_method: null,
      selected_integration: null,
      setup_method: null,
      forwarding_type: 'no_answer',
      forwarding_carrier: null,
      forwarding_country: 'us',
      telnyx_number: null,
      forwarding_number_status: 'none',
      forwarding_number_provisioning_started_at: null,
      forwarding_number_provisioned_at: null,
      forwarding_number_released_at: null,
      forwarding_number_release_reason: null,
      forwarding_number_provider_order_id: null,
      forwarding_number_last_error: null,
      detected_carrier: null,
      detected_line_type: null,
      carrier_detected_at: null,
      test_call_count: 0,
      test_call_limit: 3,
      allow_transfers: enableProfessionalDefaults,
      allow_callbacks: true,
      sms_owner_opted_in: false,
      send_reminder_sms: enableProfessionalDefaults,
      send_review_request_sms: enableProfessionalDefaults,
      send_missed_call_followup_sms: true,
      plan,
      active: params.active ?? true,
    };
    this.shops.set(id, created);
    this.shopCreatedAt.set(id, new Date().toISOString());
    return created;
  }

  async updateUserSettings(
    shopId: string,
    patch: Partial<
      Pick<
        Shop,
        | 'name'
        | 'phone_number'
        | 'vertical'
        | 'vertical_detail'
        | 'user_name'
        | 'user_phone'
        | 'handoff_phone'
        | 'handoff_availability'
        | 'handoff_custom_hours'
        | 'address'
        | 'timezone'
        | 'services'
        | 'not_offered_services'
        | 'staff'
        | 'faqs'
        | 'hours'
        | 'cancel_policy'
        | 'promotions'
        | 'booking_url'
        | 'booking_method'
        | 'selected_integration'
        | 'website_url'
        | 'languages'
        | 'current_onboarding_step'
        | 'setup_method'
        | 'forwarding_type'
        | 'forwarding_carrier'
        | 'forwarding_country'
        | 'sms_owner_opted_in'
        | 'telnyx_number'
        | 'forwarding_number_status'
        | 'forwarding_number_provisioning_started_at'
        | 'forwarding_number_provisioned_at'
        | 'forwarding_number_released_at'
        | 'forwarding_number_release_reason'
        | 'forwarding_number_provider_order_id'
        | 'forwarding_number_last_error'
        | 'detected_carrier'
        | 'detected_line_type'
        | 'carrier_detected_at'
        | 'test_call_count'
        | 'test_call_limit'
      >
    >,
  ): Promise<Shop | null> {
    const current = this.shops.get(shopId);
    if (!current) return null;
    const updated: Shop = {
      ...current,
      ...patch,
    };
    this.shops.set(shopId, updated);
    if (patch.services !== undefined) {
      this.serviceCatalogs.set(
        shopId,
        buildGeneralServiceCatalog({
          shopId,
          services: patch.services,
          categoryId: `service-category-${randomUUID()}`,
          serviceIdForIndex: () => `service-${randomUUID()}`,
        }),
      );
    }
    return this.hydrateShop(updated);
  }

  async findServiceCatalogByShopId(shopId: string): Promise<Shop['service_catalog'] | null> {
    const catalog = this.serviceCatalogs.get(shopId);
    if (catalog) return catalog;
    const shop = this.shops.get(shopId);
    if (!shop) return null;
    if (!shop.services.length) return { categories: [], services: [] };
    return buildGeneralServiceCatalog({
      shopId,
      services: shop.services,
      categoryId: `service-category-${randomUUID()}`,
      serviceIdForIndex: () => `service-${randomUUID()}`,
    });
  }

  async saveServiceCatalog(shopId: string, catalog: NonNullable<Shop['service_catalog']>): Promise<Shop['service_catalog'] | null> {
    const shop = this.shops.get(shopId);
    if (!shop) return null;
    const sanitized = {
      categories: catalog.categories.map((category, index) => ({
        ...category,
        shopId,
        sortOrder: Number.isFinite(category.sortOrder) ? category.sortOrder : index,
      })),
      services: catalog.services.map((service, index) => ({
        ...service,
        shopId,
        sortOrder: Number.isFinite(service.sortOrder) ? service.sortOrder : index,
      })),
    };
    this.serviceCatalogs.set(shopId, sanitized);
    this.shops.set(shopId, { ...shop, services: serviceCatalogToLegacyServices(sanitized) });
    return sanitized;
  }

  async deleteServiceCategory(params: { shopId: string; categoryId: string }): Promise<Shop['service_catalog'] | null> {
    const catalog = await this.findServiceCatalogByShopId(params.shopId);
    if (!catalog) return null;
    const category = catalog.categories.find((item) => item.id === params.categoryId);
    if (!category) return catalog;
    const remainingCategories = catalog.categories.filter((item) => item.id !== params.categoryId);
    let general = remainingCategories.find((item) => item.name === GENERAL_SERVICE_CATEGORY_NAME);
    if (!general) {
      general = {
        id: `service-category-${randomUUID()}`,
        shopId: params.shopId,
        name: GENERAL_SERVICE_CATEGORY_NAME,
        description: null,
        sortOrder: 0,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      remainingCategories.unshift(general);
    }
    const updated = {
      categories: remainingCategories,
      services: catalog.services.map((service) =>
        service.categoryId === params.categoryId ? { ...service, categoryId: general.id } : service,
      ),
    };
    return this.saveServiceCatalog(params.shopId, updated);
  }

  async tryBeginForwardingNumberProvisioning(params: {
    shopId: string;
    startedAt: Date;
    staleBefore: Date;
  }): Promise<{
    acquired: boolean;
    shop: Shop | null;
    reason?: 'already_provisioned' | 'already_provisioning' | 'shop_not_found';
  }> {
    const current = this.shops.get(params.shopId);
    if (!current) return { acquired: false, shop: null, reason: 'shop_not_found' };
    if (current.telnyx_number?.trim()) {
      return { acquired: false, shop: current, reason: 'already_provisioned' };
    }

    const status = current.forwarding_number_status ?? 'none';
    const startedAt = current.forwarding_number_provisioning_started_at
      ? new Date(current.forwarding_number_provisioning_started_at)
      : null;
    const stale = startedAt ? startedAt.getTime() < params.staleBefore.getTime() : false;
    const canAcquire = status === 'none' || status === 'failed' || stale;
    if (!canAcquire) {
      return { acquired: false, shop: current, reason: 'already_provisioning' };
    }

    const updated: Shop = {
      ...current,
      forwarding_number_status: 'provisioning',
      forwarding_number_provisioning_started_at: params.startedAt.toISOString(),
      forwarding_number_provisioned_at: null,
      forwarding_number_released_at: null,
      forwarding_number_release_reason: null,
      forwarding_number_provider_order_id: null,
      forwarding_number_last_error: null,
    };
    this.shops.set(params.shopId, updated);
    return { acquired: true, shop: updated };
  }

  async updateDynamicConfig(
    shopId: string,
    patch: Partial<
      Pick<
        Shop,
        | 'ai_voice'
        | 'ai_welcome_message'
        | 'ai_custom_instructions'
        | 'allow_transfers'
        | 'allow_callbacks'
        | 'send_reminder_sms'
        | 'send_review_request_sms'
        | 'send_missed_call_followup_sms'
      >
    >,
  ): Promise<Shop | null> {
    const current = this.shops.get(shopId);
    if (!current) return null;
    const updated: Shop = {
      ...current,
      ...patch,
    };
    this.shops.set(shopId, updated);
    return updated;
  }

  async updatePlanAndActivation(
    shopId: string,
    patch: {
      plan?: Shop['plan'];
      active?: boolean;
    },
  ): Promise<Shop | null> {
    const current = this.shops.get(shopId);
    if (!current) return null;
    const updated: Shop = {
      ...current,
      ...(patch.plan ? { plan: patch.plan } : {}),
      ...(typeof patch.active === 'boolean' ? { active: patch.active } : {}),
    };
    this.shops.set(shopId, updated);
    return updated;
  }

  async updateCalendarConnection(
    shopId: string,
    patch: Pick<Shop, 'google_cal_id' | 'google_cal_credentials_encrypted'>,
  ): Promise<Shop | null> {
    const current = this.shops.get(shopId);
    if (!current) return null;
    const updated: Shop = {
      ...current,
      google_cal_id: patch.google_cal_id ?? null,
      google_cal_credentials_encrypted: patch.google_cal_credentials_encrypted ?? null,
    };
    this.shops.set(shopId, updated);
    return updated;
  }

  async updateIntegrationConnection(
    shopId: string,
    patch: Pick<Shop, 'integration_credentials_encrypted'>,
  ): Promise<Shop | null> {
    const current = this.shops.get(shopId);
    if (!current) return null;
    const updated: Shop = {
      ...current,
      integration_credentials_encrypted: patch.integration_credentials_encrypted ?? null,
    };
    this.shops.set(shopId, updated);
    return updated;
  }
}
