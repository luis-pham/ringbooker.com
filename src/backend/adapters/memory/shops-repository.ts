import { randomUUID } from 'node:crypto';

import type { Shop } from '@/src/backend/domain/types';
import type { ShopsRepository } from '@/src/backend/ports/repositories';

const defaultShop: Shop = {
  id: 'demo-shop',
  name: 'RingBooker Demo Salon',
  vertical: 'nail_salon',
  brand_slug: 'ringbooker-demo-salon',
  phone_number: '+17145550123',
  user_phone: '+17145550199',
  user_name: 'Demo User',
  address: '123 Main St, Garden Grove, CA',
  timezone: 'America/Los_Angeles',
  services: [
    { name: 'Manicure', duration_min: 30, price: 20 },
    { name: 'Pedicure', duration_min: 45, price: 35 },
    { name: 'Gel Nails', duration_min: 60, price: 45 },
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
  forwarding_number_provider_order_id: null,
  forwarding_number_last_error: null,
  ai_voice: 'Aoede',
  ai_welcome_message: 'Thanks for calling RingBooker Demo Salon. How can I help you today?',
  ai_custom_instructions: 'Prioritize manicure and pedicure bookings and keep answers concise.',
  allow_transfers: true,
  allow_callbacks: true,
  send_reminder_sms: true,
  send_review_request_sms: true,
  send_missed_call_followup_sms: true,
  plan: 'professional',
  active: true,
};

export class InMemoryShopsRepository implements ShopsRepository {
  private readonly shops = new Map<string, Shop>([[defaultShop.id, defaultShop]]);
  private readonly shopCreatedAt = new Map<string, string>([[defaultShop.id, new Date().toISOString()]]);

  async findByDestinationPhone(destinationPhone: string): Promise<Shop | null> {
    for (const shop of this.shops.values()) {
      if (shop.active && shop.phone_number === destinationPhone) {
        return shop;
      }
    }
    return null;
  }

  async findByTelnyxNumber(e164: string): Promise<Shop | null> {
    for (const shop of this.shops.values()) {
      if (shop.active && shop.telnyx_number && shop.telnyx_number === e164) {
        return shop;
      }
    }
    return null;
  }

  async findById(shopId: string): Promise<Shop | null> {
    return this.shops.get(shopId) ?? null;
  }

  async list(params?: { limit?: number }): Promise<Shop[]> {
    const limit = params?.limit && params.limit > 0 ? params.limit : 50;
    return [...this.shops.values()].slice(0, limit);
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
      brand_slug: params.brand_slug ?? null,
      phone_number: params.phone_number,
      user_phone: params.user_phone,
      user_name: params.user_name ?? null,
      timezone: params.timezone,
      services: [],
      hours: {},
      cancel_policy: '2-hour cancellation policy applies.',
      ai_voice: 'Aoede',
      ai_welcome_message: null,
      ai_custom_instructions: null,
      languages: ['en'],
      website_url: null,
      current_onboarding_step: 1,
      setup_method: null,
      forwarding_type: 'no_answer',
      forwarding_carrier: null,
      forwarding_country: 'us',
      telnyx_number: null,
      forwarding_number_status: 'none',
      forwarding_number_provisioning_started_at: null,
      forwarding_number_provider_order_id: null,
      forwarding_number_last_error: null,
      allow_transfers: enableProfessionalDefaults,
      allow_callbacks: true,
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
        | 'user_name'
        | 'user_phone'
        | 'backup_phone'
        | 'address'
        | 'timezone'
        | 'services'
        | 'hours'
        | 'cancel_policy'
        | 'promotions'
        | 'booking_url'
        | 'website_url'
        | 'languages'
        | 'current_onboarding_step'
        | 'setup_method'
        | 'forwarding_type'
        | 'forwarding_carrier'
        | 'forwarding_country'
        | 'telnyx_number'
        | 'forwarding_number_status'
        | 'forwarding_number_provisioning_started_at'
        | 'forwarding_number_provider_order_id'
        | 'forwarding_number_last_error'
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
}
