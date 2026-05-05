import type { SupabaseClient } from '@supabase/supabase-js';

import type { BusinessHours, ServiceItem, Shop, ShopPlan } from '@/src/backend/domain/types';
import type { ShopsRepository } from '@/src/backend/ports/repositories';

type ShopsRow = {
  id: string;
  name: string;
  vertical: Shop['vertical'] | null;
  brand_slug: string | null;
  phone_number: string;
  user_phone: string;
  backup_phone: string | null;
  user_name: string | null;
  address: string | null;
  timezone: string;
  services: unknown;
  hours: unknown;
  cancel_policy: string | null;
  promotions: string | null;
  booking_url: string | null;
  website_url: string | null;
  languages: string[] | null;
  current_onboarding_step: number | null;
  setup_method: Shop['setup_method'] | null;
  forwarding_type: Shop['forwarding_type'] | null;
  forwarding_carrier: string | null;
  forwarding_country: string | null;
  telnyx_number: string | null;
  forwarding_number_status: Shop['forwarding_number_status'] | null;
  forwarding_number_provisioning_started_at: string | null;
  forwarding_number_provider_order_id: string | null;
  forwarding_number_last_error: string | null;
  ai_voice: string | null;
  ai_welcome_message: string | null;
  ai_custom_instructions: string | null;
  allow_transfers: boolean | null;
  allow_callbacks: boolean | null;
  send_reminder_sms: boolean | null;
  send_review_request_sms: boolean | null;
  send_missed_call_followup_sms: boolean | null;
  plan: string | null;
  active: boolean | null;
  google_cal_id: string | null;
  google_cal_credentials_encrypted: string | null;
};

function normalizePlan(value: string | null): ShopPlan {
  if (value === 'starter' || value === 'professional' || value === 'enterprise') {
    return value;
  }
  return 'professional';
}

function normalizeServices(value: unknown): ServiceItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      if (typeof raw.name !== 'string') return null;
      return {
        name: raw.name,
        duration_min: typeof raw.duration_min === 'number' ? raw.duration_min : 60,
        price: typeof raw.price === 'number' ? raw.price : 0,
      };
    })
    .filter((item): item is ServiceItem => item !== null);
}

function normalizeHours(value: unknown): BusinessHours {
  if (!value || typeof value !== 'object') return {};
  return value as BusinessHours;
}

function toShop(row: ShopsRow): Shop {
  return {
    id: row.id,
    name: row.name,
    vertical: row.vertical,
    brand_slug: row.brand_slug,
    phone_number: row.phone_number,
    user_phone: row.user_phone,
    backup_phone: row.backup_phone,
    user_name: row.user_name,
    address: row.address,
    timezone: row.timezone,
    services: normalizeServices(row.services),
    hours: normalizeHours(row.hours),
    cancel_policy: row.cancel_policy ?? '2-hour cancellation policy applies.',
    promotions: row.promotions,
    booking_url: row.booking_url,
    website_url: row.website_url,
    languages: Array.isArray(row.languages) && row.languages.length > 0 ? row.languages : ['en'],
    current_onboarding_step: row.current_onboarding_step ?? 1,
    setup_method: row.setup_method,
    forwarding_type: row.forwarding_type ?? 'no_answer',
    forwarding_carrier: row.forwarding_carrier,
    forwarding_country: row.forwarding_country ?? 'us',
    telnyx_number: row.telnyx_number,
    forwarding_number_status: row.forwarding_number_status ?? 'none',
    forwarding_number_provisioning_started_at: row.forwarding_number_provisioning_started_at,
    forwarding_number_provider_order_id: row.forwarding_number_provider_order_id,
    forwarding_number_last_error: row.forwarding_number_last_error,
    ai_voice: row.ai_voice ?? 'Aoede',
    ai_welcome_message: row.ai_welcome_message,
    ai_custom_instructions: row.ai_custom_instructions,
    allow_transfers: row.allow_transfers ?? false,
    allow_callbacks: row.allow_callbacks ?? true,
    send_reminder_sms: row.send_reminder_sms ?? false,
    send_review_request_sms: row.send_review_request_sms ?? false,
    send_missed_call_followup_sms: row.send_missed_call_followup_sms ?? true,
    plan: normalizePlan(row.plan),
    active: row.active ?? false,
    google_cal_id: row.google_cal_id,
    google_cal_credentials_encrypted: row.google_cal_credentials_encrypted,
  };
}

export class SupabaseShopsRepository implements ShopsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByDestinationPhone(destinationPhone: string): Promise<Shop | null> {
    const { data, error } = await this.supabase
      .from('shops')
      .select(
        [
          'id',
          'name',
          'vertical',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'website_url',
          'languages',
          'current_onboarding_step',
          'setup_method',
          'forwarding_type',
          'forwarding_carrier',
          'forwarding_country',
          'telnyx_number',
          'forwarding_number_status',
          'forwarding_number_provisioning_started_at',
          'forwarding_number_provider_order_id',
          'forwarding_number_last_error',
          'ai_voice',
          'ai_welcome_message',
          'ai_custom_instructions',
          'allow_transfers',
          'allow_callbacks',
          'send_reminder_sms',
          'send_review_request_sms',
          'send_missed_call_followup_sms',
          'plan',
          'active',
          'google_cal_id',
          'google_cal_credentials_encrypted',
        ].join(','),
      )
      .eq('phone_number', destinationPhone)
      .eq('active', true)
      .maybeSingle<ShopsRow>();

    if (error) {
      throw new Error(`shops_find_by_destination_phone_failed:${error.message}`);
    }

    return data ? toShop(data) : null;
  }

  async findByTelnyxNumber(e164: string): Promise<Shop | null> {
    const { data, error } = await this.supabase
      .from('shops')
      .select(
        [
          'id',
          'name',
          'vertical',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'website_url',
          'languages',
          'current_onboarding_step',
          'setup_method',
          'forwarding_type',
          'forwarding_carrier',
          'forwarding_country',
          'telnyx_number',
          'forwarding_number_status',
          'forwarding_number_provisioning_started_at',
          'forwarding_number_provider_order_id',
          'forwarding_number_last_error',
          'ai_voice',
          'ai_welcome_message',
          'ai_custom_instructions',
          'allow_transfers',
          'allow_callbacks',
          'send_reminder_sms',
          'send_review_request_sms',
          'send_missed_call_followup_sms',
          'plan',
          'active',
          'google_cal_id',
          'google_cal_credentials_encrypted',
        ].join(','),
      )
      .eq('telnyx_number', e164)
      .eq('active', true)
      .maybeSingle<ShopsRow>();

    if (error) {
      throw new Error(`shops_find_by_telnyx_number_failed:${error.message}`);
    }

    return data ? toShop(data) : null;
  }

  async findById(shopId: string): Promise<Shop | null> {
    const { data, error } = await this.supabase
      .from('shops')
      .select(
        [
          'id',
          'name',
          'vertical',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'website_url',
          'languages',
          'current_onboarding_step',
          'setup_method',
          'forwarding_type',
          'forwarding_carrier',
          'forwarding_country',
          'telnyx_number',
          'forwarding_number_status',
          'forwarding_number_provisioning_started_at',
          'forwarding_number_provider_order_id',
          'forwarding_number_last_error',
          'ai_voice',
          'ai_welcome_message',
          'ai_custom_instructions',
          'allow_transfers',
          'allow_callbacks',
          'send_reminder_sms',
          'send_review_request_sms',
          'send_missed_call_followup_sms',
          'plan',
          'active',
          'google_cal_id',
          'google_cal_credentials_encrypted',
        ].join(','),
      )
      .eq('id', shopId)
      .maybeSingle<ShopsRow>();

    if (error) {
      throw new Error(`shops_find_by_id_failed:${error.message}`);
    }

    return data ? toShop(data) : null;
  }

  async list(params?: { limit?: number }): Promise<Shop[]> {
    const limit = params?.limit && params.limit > 0 ? params.limit : 50;
    const { data, error } = await this.supabase
      .from('shops')
      .select(
        [
          'id',
          'name',
          'vertical',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'website_url',
          'languages',
          'current_onboarding_step',
          'plan',
          'active',
          'google_cal_id',
          'google_cal_credentials_encrypted',
        ].join(','),
      )
      .order('created_at', { ascending: false })
      .limit(limit)
      .returns<ShopsRow[]>();

    if (error) {
      throw new Error(`shops_list_failed:${error.message}`);
    }
    return (data ?? []).map(toShop);
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
    const plan = params.plan ?? 'starter';
    const enableProfessionalDefaults = plan === 'professional' || plan === 'enterprise';
    const { data, error } = await this.supabase
      .from('shops')
      .insert({
        name: params.name,
        brand_slug: params.brand_slug ?? null,
        phone_number: params.phone_number,
        user_phone: params.user_phone,
        user_name: params.user_name ?? null,
        timezone: params.timezone,
        plan,
        active: params.active ?? true,
        ai_voice: 'Aoede',
        allow_transfers: enableProfessionalDefaults,
        allow_callbacks: true,
        send_reminder_sms: enableProfessionalDefaults,
        send_review_request_sms: enableProfessionalDefaults,
        send_missed_call_followup_sms: true,
        services: [],
        hours: {},
      })
      .select(
        [
          'id',
          'name',
          'vertical',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'website_url',
          'languages',
          'current_onboarding_step',
          'setup_method',
          'forwarding_type',
          'forwarding_carrier',
          'forwarding_country',
          'telnyx_number',
          'forwarding_number_status',
          'forwarding_number_provisioning_started_at',
          'forwarding_number_provider_order_id',
          'forwarding_number_last_error',
          'ai_voice',
          'ai_welcome_message',
          'ai_custom_instructions',
          'allow_transfers',
          'allow_callbacks',
          'send_reminder_sms',
          'send_review_request_sms',
          'send_missed_call_followup_sms',
          'plan',
          'active',
          'google_cal_id',
          'google_cal_credentials_encrypted',
        ].join(','),
      )
      .single<ShopsRow>();

    if (error) {
      throw new Error(`shops_create_failed:${error.message}`);
    }
    return toShop(data);
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
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.phone_number !== undefined) payload.phone_number = patch.phone_number;
    if (patch.vertical !== undefined) payload.vertical = patch.vertical;
    if (patch.user_name !== undefined) payload.user_name = patch.user_name;
    if (patch.user_phone !== undefined) payload.user_phone = patch.user_phone;
    if (patch.backup_phone !== undefined) payload.backup_phone = patch.backup_phone;
    if (patch.address !== undefined) payload.address = patch.address;
    if (patch.timezone !== undefined) payload.timezone = patch.timezone;
    if (patch.services !== undefined) payload.services = patch.services;
    if (patch.hours !== undefined) payload.hours = patch.hours;
    if (patch.cancel_policy !== undefined) payload.cancel_policy = patch.cancel_policy;
    if (patch.promotions !== undefined) payload.promotions = patch.promotions;
    if (patch.booking_url !== undefined) payload.booking_url = patch.booking_url;
    if (patch.website_url !== undefined) payload.website_url = patch.website_url;
    if (patch.languages !== undefined) payload.languages = patch.languages;
    if (patch.current_onboarding_step !== undefined) payload.current_onboarding_step = patch.current_onboarding_step;
    if (patch.setup_method !== undefined) payload.setup_method = patch.setup_method;
    if (patch.forwarding_type !== undefined) payload.forwarding_type = patch.forwarding_type;
    if (patch.forwarding_carrier !== undefined) payload.forwarding_carrier = patch.forwarding_carrier;
    if (patch.forwarding_country !== undefined) payload.forwarding_country = patch.forwarding_country;
    if (patch.telnyx_number !== undefined) payload.telnyx_number = patch.telnyx_number;
    if (patch.forwarding_number_status !== undefined) payload.forwarding_number_status = patch.forwarding_number_status;
    if (patch.forwarding_number_provisioning_started_at !== undefined) {
      payload.forwarding_number_provisioning_started_at = patch.forwarding_number_provisioning_started_at;
    }
    if (patch.forwarding_number_provider_order_id !== undefined) {
      payload.forwarding_number_provider_order_id = patch.forwarding_number_provider_order_id;
    }
    if (patch.forwarding_number_last_error !== undefined) {
      payload.forwarding_number_last_error = patch.forwarding_number_last_error;
    }

    const { data, error } = await this.supabase
      .from('shops')
      .update(payload)
      .eq('id', shopId)
      .select(
        [
          'id',
          'name',
          'vertical',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'website_url',
          'languages',
          'current_onboarding_step',
          'setup_method',
          'forwarding_type',
          'forwarding_carrier',
          'forwarding_country',
          'telnyx_number',
          'forwarding_number_status',
          'forwarding_number_provisioning_started_at',
          'forwarding_number_provider_order_id',
          'forwarding_number_last_error',
          'ai_voice',
          'ai_welcome_message',
          'ai_custom_instructions',
          'allow_transfers',
          'allow_callbacks',
          'send_reminder_sms',
          'send_review_request_sms',
          'send_missed_call_followup_sms',
          'plan',
          'active',
          'google_cal_id',
          'google_cal_credentials_encrypted',
        ].join(','),
      )
      .maybeSingle<ShopsRow>();

    if (error) {
      throw new Error(`shops_update_user_settings_failed:${error.message}`);
    }

    return data ? toShop(data) : null;
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
    const existing = await this.findById(params.shopId);
    if (!existing) return { acquired: false, shop: null, reason: 'shop_not_found' };
    if (existing.telnyx_number?.trim()) {
      return { acquired: false, shop: existing, reason: 'already_provisioned' };
    }

    const startedIso = params.startedAt.toISOString();
    const staleIso = params.staleBefore.toISOString();
    const { data, error } = await this.supabase
      .from('shops')
      .update({
        forwarding_number_status: 'provisioning',
        forwarding_number_provisioning_started_at: startedIso,
        forwarding_number_provider_order_id: null,
        forwarding_number_last_error: null,
        updated_at: startedIso,
      })
      .eq('id', params.shopId)
      .is('telnyx_number', null)
      .or(
        [
          'forwarding_number_status.is.null',
          'forwarding_number_status.eq.none',
          'forwarding_number_status.eq.failed',
          `forwarding_number_provisioning_started_at.lt.${staleIso}`,
        ].join(','),
      )
      .select(
        [
          'id',
          'name',
          'vertical',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'website_url',
          'languages',
          'current_onboarding_step',
          'setup_method',
          'forwarding_type',
          'forwarding_carrier',
          'forwarding_country',
          'telnyx_number',
          'forwarding_number_status',
          'forwarding_number_provisioning_started_at',
          'forwarding_number_provider_order_id',
          'forwarding_number_last_error',
          'ai_voice',
          'ai_welcome_message',
          'ai_custom_instructions',
          'allow_transfers',
          'allow_callbacks',
          'send_reminder_sms',
          'send_review_request_sms',
          'send_missed_call_followup_sms',
          'plan',
          'active',
          'google_cal_id',
          'google_cal_credentials_encrypted',
        ].join(','),
      )
      .maybeSingle<ShopsRow>();

    if (error) throw new Error(`shops_begin_forwarding_number_provisioning_failed:${error.message}`);
    if (data) return { acquired: true, shop: toShop(data) };

    const latest = await this.findById(params.shopId);
    if (!latest) return { acquired: false, shop: null, reason: 'shop_not_found' };
    if (latest.telnyx_number?.trim()) return { acquired: false, shop: latest, reason: 'already_provisioned' };
    return { acquired: false, shop: latest, reason: 'already_provisioning' };
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
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.ai_voice !== undefined) payload.ai_voice = patch.ai_voice;
    if (patch.ai_welcome_message !== undefined) payload.ai_welcome_message = patch.ai_welcome_message;
    if (patch.ai_custom_instructions !== undefined) payload.ai_custom_instructions = patch.ai_custom_instructions;
    if (patch.allow_transfers !== undefined) payload.allow_transfers = patch.allow_transfers;
    if (patch.allow_callbacks !== undefined) payload.allow_callbacks = patch.allow_callbacks;
    if (patch.send_reminder_sms !== undefined) payload.send_reminder_sms = patch.send_reminder_sms;
    if (patch.send_review_request_sms !== undefined) payload.send_review_request_sms = patch.send_review_request_sms;
    if (patch.send_missed_call_followup_sms !== undefined) {
      payload.send_missed_call_followup_sms = patch.send_missed_call_followup_sms;
    }

    const { data, error } = await this.supabase
      .from('shops')
      .update(payload)
      .eq('id', shopId)
      .select(
        [
          'id',
          'name',
          'vertical',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'website_url',
          'languages',
          'current_onboarding_step',
          'setup_method',
          'forwarding_type',
          'forwarding_carrier',
          'forwarding_country',
          'telnyx_number',
          'forwarding_number_status',
          'forwarding_number_provisioning_started_at',
          'forwarding_number_provider_order_id',
          'forwarding_number_last_error',
          'ai_voice',
          'ai_welcome_message',
          'ai_custom_instructions',
          'allow_transfers',
          'allow_callbacks',
          'send_reminder_sms',
          'send_review_request_sms',
          'send_missed_call_followup_sms',
          'plan',
          'active',
          'google_cal_id',
          'google_cal_credentials_encrypted',
        ].join(','),
      )
      .maybeSingle<ShopsRow>();

    if (error) {
      throw new Error(`shops_update_dynamic_config_failed:${error.message}`);
    }
    return data ? toShop(data) : null;
  }

  async updatePlanAndActivation(
    shopId: string,
    patch: {
      plan?: Shop['plan'];
      active?: boolean;
    },
  ): Promise<Shop | null> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.plan) payload.plan = patch.plan;
    if (typeof patch.active === 'boolean') payload.active = patch.active;

    const { data, error } = await this.supabase
      .from('shops')
      .update(payload)
      .eq('id', shopId)
      .select(
        [
          'id',
          'name',
          'vertical',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'website_url',
          'languages',
          'current_onboarding_step',
          'setup_method',
          'forwarding_type',
          'forwarding_carrier',
          'forwarding_country',
          'telnyx_number',
          'forwarding_number_status',
          'forwarding_number_provisioning_started_at',
          'forwarding_number_provider_order_id',
          'forwarding_number_last_error',
          'ai_voice',
          'ai_welcome_message',
          'ai_custom_instructions',
          'allow_transfers',
          'allow_callbacks',
          'send_reminder_sms',
          'send_review_request_sms',
          'send_missed_call_followup_sms',
          'plan',
          'active',
          'google_cal_id',
          'google_cal_credentials_encrypted',
        ].join(','),
      )
      .maybeSingle<ShopsRow>();

    if (error) {
      throw new Error(`shops_update_plan_activation_failed:${error.message}`);
    }
    return data ? toShop(data) : null;
  }

  async updateCalendarConnection(
    shopId: string,
    patch: Pick<Shop, 'google_cal_id' | 'google_cal_credentials_encrypted'>,
  ): Promise<Shop | null> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      google_cal_id: patch.google_cal_id ?? null,
      google_cal_credentials_encrypted: patch.google_cal_credentials_encrypted ?? null,
    };

    const { data, error } = await this.supabase
      .from('shops')
      .update(payload)
      .eq('id', shopId)
      .select(
        [
          'id',
          'name',
          'vertical',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'website_url',
          'languages',
          'current_onboarding_step',
          'setup_method',
          'forwarding_type',
          'forwarding_carrier',
          'forwarding_country',
          'telnyx_number',
          'forwarding_number_status',
          'forwarding_number_provisioning_started_at',
          'forwarding_number_provider_order_id',
          'forwarding_number_last_error',
          'ai_voice',
          'ai_welcome_message',
          'ai_custom_instructions',
          'allow_transfers',
          'allow_callbacks',
          'send_reminder_sms',
          'send_review_request_sms',
          'send_missed_call_followup_sms',
          'plan',
          'active',
          'google_cal_id',
          'google_cal_credentials_encrypted',
        ].join(','),
      )
      .maybeSingle<ShopsRow>();

    if (error) {
      throw new Error(`shops_update_calendar_connection_failed:${error.message}`);
    }
    return data ? toShop(data) : null;
  }

  async listCreatedAtInRange(params: { createdAfter: Date; createdBefore: Date }): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('shops')
      .select('created_at')
      .gte('created_at', params.createdAfter.toISOString())
      .lte('created_at', params.createdBefore.toISOString())
      .limit(50_000);
    if (error) {
      throw new Error(`shops_list_created_at_range_failed:${error.message}`);
    }
    return (data ?? []).map((row) => (row as { created_at: string }).created_at);
  }
}
