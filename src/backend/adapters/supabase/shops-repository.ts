import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildGeneralServiceCatalog,
  GENERAL_SERVICE_CATEGORY_NAME,
  serviceCatalogToLegacyServices,
} from '@/src/backend/domain/service-catalog';
import type {
  BusinessFaqItem,
  BusinessHours,
  ServiceCategory,
  ServiceItem,
  Shop,
  ShopPlan,
  ShopService,
  ShopServiceCatalog,
  StaffMember,
} from '@/src/backend/domain/types';
import { logger } from '@/src/backend/observability/logger';
import type { ShopsRepository } from '@/src/backend/ports/repositories';

type ShopsRow = {
  id: string;
  name: string;
  vertical: Shop['vertical'] | null;
  vertical_detail: string | null;
  brand_slug: string | null;
  phone_number: string;
  user_phone: string;
  backup_phone: string | null;
  user_name: string | null;
  address: string | null;
  timezone: string;
  services: unknown;
  not_offered_services: string[] | null;
  staff: unknown;
  faqs: unknown;
  hours: unknown;
  cancel_policy: string | null;
  promotions: string | null;
  booking_url: string | null;
  booking_method: Shop['booking_method'] | null;
  selected_integration: string | null;
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
  sms_owner_opted_in: boolean | null;
  plan: string | null;
  active: boolean | null;
  google_cal_id: string | null;
  google_cal_credentials_encrypted: string | null;
  integration_credentials_encrypted: string | null;
};

const SHOP_SELECT_COLUMNS = [
  'id',
  'name',
  'vertical',
  'vertical_detail',
  'brand_slug',
  'phone_number',
  'user_phone',
  'backup_phone',
  'user_name',
  'address',
  'timezone',
  'services',
  'not_offered_services',
  'staff',
  'faqs',
  'hours',
  'cancel_policy',
  'promotions',
  'booking_url',
  'booking_method',
  'selected_integration',
  'sms_owner_opted_in',
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
  'integration_credentials_encrypted',
] as const;

const CORE_SHOP_SELECT_COLUMNS = [
  'id',
  'name',
  'vertical',
  'vertical_detail',
  'brand_slug',
  'phone_number',
  'user_phone',
  'backup_phone',
  'user_name',
  'address',
  'timezone',
  'services',
  'staff',
  'faqs',
  'hours',
  'cancel_policy',
  'promotions',
  'booking_url',
  'website_url',
  'languages',
  'current_onboarding_step',
  'plan',
  'active',
] as const;

function shopSelectColumns(options: { includeSmsOwnerOptIn?: boolean; coreOnly?: boolean } = {}): string {
  if (options.coreOnly) return CORE_SHOP_SELECT_COLUMNS.join(',');
  const includeSmsOwnerOptIn = options.includeSmsOwnerOptIn ?? true;
  return SHOP_SELECT_COLUMNS
    .filter((column) => includeSmsOwnerOptIn || column !== 'sms_owner_opted_in')
    .join(',');
}

function isMissingShopColumn(error: { message?: string } | null): boolean {
  const message = error?.message ?? '';
  return /schema cache|column .* does not exist|could not find .* column/i.test(message);
}

type ShopServiceCategoryRow = {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  active: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ShopServiceRow = {
  id: string;
  shop_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  duration_text?: string | null;
  duration_minutes: number | null;
  price_amount: number | string | null;
  price_currency: string | null;
  price_type: string | null;
  bookable: boolean | null;
  active: boolean | null;
  sort_order: number | null;
  aliases: unknown;
  booking_notes: string | null;
  variants_json?: unknown;
  external_provider?: string | null;
  external_service_id?: string | null;
  external_location_id?: string | null;
  external_staff_required?: boolean | null;
  external_metadata?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
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

function normalizePriceType(value: string | null): ShopService['priceType'] {
  if (value === 'fixed' || value === 'from' || value === 'varies' || value === 'consultation') return value;
  return 'fixed';
}

function normalizeServiceVariants(value: unknown): ShopService['variants'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw, index) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      const item = raw as Record<string, unknown>;
      const label = typeof item.label === 'string' ? item.label.trim().slice(0, 80) : '';
      const durationMinutes = typeof item.durationMinutes === 'number' && Number.isFinite(item.durationMinutes) && item.durationMinutes > 0
        ? Math.round(item.durationMinutes)
        : null;
      const durationText = typeof item.durationText === 'string' && item.durationText.trim()
        ? item.durationText.trim().slice(0, 80)
        : durationMinutes ? `${durationMinutes} min` : null;
      const priceAmount = typeof item.priceAmount === 'number' && Number.isFinite(item.priceAmount) && item.priceAmount >= 0
        ? item.priceAmount
        : null;
      if (!label && !durationText && priceAmount === null) return null;
      return {
        id: typeof item.id === 'string' && item.id.trim() ? item.id : randomUUID(),
        label: label || durationText || (priceAmount !== null ? `$${priceAmount}` : `Option ${index + 1}`),
        durationMinutes,
        durationText,
        priceAmount,
        priceCurrency: typeof item.priceCurrency === 'string' && item.priceCurrency.trim().length === 3 ? item.priceCurrency.trim().toUpperCase() : 'USD',
        priceType: normalizePriceType(typeof item.priceType === 'string' ? item.priceType : null),
        sortOrder: typeof item.sortOrder === 'number' && Number.isFinite(item.sortOrder) ? Math.max(0, Math.round(item.sortOrder)) : index,
        notes: typeof item.notes === 'string' && item.notes.trim() ? item.notes.trim().slice(0, 240) : null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 20);
}

function toServiceCategory(row: ShopServiceCategoryRow): ServiceCategory {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order ?? 0,
    active: row.active ?? true,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function toShopService(row: ShopServiceRow): ShopService {
  const priceAmount =
    typeof row.price_amount === 'number'
      ? row.price_amount
      : typeof row.price_amount === 'string'
        ? Number(row.price_amount)
        : null;
  return {
    id: row.id,
    shopId: row.shop_id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    durationText: row.duration_text ?? null,
    durationMinutes: row.duration_minutes,
    priceAmount: Number.isFinite(priceAmount) ? priceAmount : null,
    priceCurrency: row.price_currency ?? 'USD',
    priceType: normalizePriceType(row.price_type),
    bookable: row.bookable ?? true,
    active: row.active ?? true,
    sortOrder: row.sort_order ?? 0,
    aliases: Array.isArray(row.aliases) ? row.aliases.filter((alias): alias is string => typeof alias === 'string') : [],
    bookingNotes: row.booking_notes,
    variants: normalizeServiceVariants(row.variants_json),
    externalProvider: row.external_provider ?? null,
    externalServiceId: row.external_service_id ?? null,
    externalLocationId: row.external_location_id ?? null,
    externalStaffRequired: row.external_staff_required ?? false,
    externalMetadata: (() => {
      if (!row.external_metadata || typeof row.external_metadata !== 'object' || Array.isArray(row.external_metadata)) return {};
      const { __aiKnowledgeStatus: _stripped, ...rest } = row.external_metadata as Record<string, unknown>;
      return rest;
    })(),
    aiKnowledgeStatus: (() => {
      if (!row.external_metadata || typeof row.external_metadata !== 'object' || Array.isArray(row.external_metadata)) return null;
      const v = (row.external_metadata as Record<string, unknown>).__aiKnowledgeStatus;
      return v === 'imported_unreviewed' || v === 'owner_reviewed' ? v : null;
    })(),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function isMissingServiceCatalogTableError(error: unknown): boolean {
  const record = error as { code?: string; message?: string } | null;
  return record?.code === '42P01' || /shop_service_(categories|services)/i.test(record?.message ?? '');
}

function normalizeStaff(value: unknown): StaffMember[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      if (typeof raw.name !== 'string' || !raw.name.trim()) return null;
      const specialties = Array.isArray(raw.specialties)
        ? raw.specialties.filter((specialty): specialty is string => typeof specialty === 'string' && specialty.trim().length > 0)
        : [];
      const normalized: StaffMember = {
        name: raw.name.trim(),
        role: typeof raw.role === 'string' && raw.role.trim() ? raw.role.trim() : null,
        specialties,
        notes: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim() : null,
        active: typeof raw.active === 'boolean' ? raw.active : true,
      };
      return normalized;
    })
    .filter((item): item is StaffMember => item !== null);
}

function normalizeFaqs(value: unknown): BusinessFaqItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      if (typeof raw.question !== 'string' || typeof raw.answer !== 'string') return null;
      const question = raw.question.trim();
      const answer = raw.answer.trim();
      if (!question || !answer) return null;
      return { question, answer };
    })
    .filter((item): item is BusinessFaqItem => item !== null);
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
    vertical_detail: row.vertical_detail,
    brand_slug: row.brand_slug,
    phone_number: row.phone_number,
    user_phone: row.user_phone,
    backup_phone: row.backup_phone,
    user_name: row.user_name,
    address: row.address,
    timezone: row.timezone,
    services: normalizeServices(row.services),
    not_offered_services: Array.isArray(row.not_offered_services)
      ? row.not_offered_services.filter((service): service is string => typeof service === 'string' && service.trim().length > 0)
      : [],
    staff: normalizeStaff(row.staff),
    faqs: normalizeFaqs(row.faqs),
    hours: normalizeHours(row.hours),
    cancel_policy: row.cancel_policy ?? '2-hour cancellation policy applies.',
    promotions: row.promotions,
    booking_url: row.booking_url,
    booking_method: row.booking_method ?? null,
    selected_integration: row.selected_integration ?? null,
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
    sms_owner_opted_in: row.sms_owner_opted_in ?? false,
    send_reminder_sms: row.send_reminder_sms ?? false,
    send_review_request_sms: row.send_review_request_sms ?? false,
    send_missed_call_followup_sms: row.send_missed_call_followup_sms ?? true,
    plan: normalizePlan(row.plan),
    active: row.active ?? false,
    google_cal_id: row.google_cal_id,
    google_cal_credentials_encrypted: row.google_cal_credentials_encrypted,
    integration_credentials_encrypted: row.integration_credentials_encrypted,
  };
}

export class SupabaseShopsRepository implements ShopsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  private async hydrateServiceCatalog(shop: Shop): Promise<Shop> {
    let catalog: ShopServiceCatalog | null = null;
    try {
      catalog = await this.findServiceCatalogByShopId(shop.id);
    } catch (error) {
      logger.warn({ err: error, shopId: shop.id }, 'shop_service_catalog_hydration_failed');
      return shop;
    }
    if (!catalog || (catalog.services.length === 0 && catalog.categories.length === 0)) return shop;
    return {
      ...shop,
      service_catalog: catalog,
      services: serviceCatalogToLegacyServices(catalog),
    };
  }

  async findByDestinationPhone(destinationPhone: string): Promise<Shop | null> {
    const { data, error } = await this.supabase
      .from('shops')
      .select(
        [
          'id',
          'name',
          'vertical',
          'vertical_detail',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'not_offered_services',
          'staff',
          'faqs',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'booking_method',
          'selected_integration',
          'sms_owner_opted_in',
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
          'integration_credentials_encrypted',
        ].join(','),
      )
      .eq('phone_number', destinationPhone)
      .eq('active', true)
      .maybeSingle<ShopsRow>();

    if (error) {
      throw new Error(`shops_find_by_destination_phone_failed:${error.message}`);
    }

    return data ? this.hydrateServiceCatalog(toShop(data)) : null;
  }

  async findByTelnyxNumber(e164: string): Promise<Shop | null> {
    const { data, error } = await this.supabase
      .from('shops')
      .select(
        [
          'id',
          'name',
          'vertical',
          'vertical_detail',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'not_offered_services',
          'staff',
          'faqs',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'booking_method',
          'selected_integration',
          'sms_owner_opted_in',
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
          'integration_credentials_encrypted',
        ].join(','),
      )
      .eq('telnyx_number', e164)
      .eq('active', true)
      .maybeSingle<ShopsRow>();

    if (error) {
      throw new Error(`shops_find_by_telnyx_number_failed:${error.message}`);
    }

    return data ? this.hydrateServiceCatalog(toShop(data)) : null;
  }

  async findById(shopId: string): Promise<Shop | null> {
    let result = await this.supabase
      .from('shops')
      .select(shopSelectColumns())
      .eq('id', shopId)
      .maybeSingle<ShopsRow>();

    if (result.error && isMissingShopColumn(result.error)) {
      result = await this.supabase
        .from('shops')
        .select(shopSelectColumns({ coreOnly: true }))
        .eq('id', shopId)
        .maybeSingle<ShopsRow>();
    }

    if (result.error) {
      throw new Error(`shops_find_by_id_failed:${result.error.message}`);
    }

    return result.data ? this.hydrateServiceCatalog(toShop(result.data)) : null;
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
          'vertical_detail',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'not_offered_services',
          'staff',
          'faqs',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'booking_method',
          'selected_integration',
          'sms_owner_opted_in',
          'website_url',
          'languages',
          'current_onboarding_step',
          'plan',
          'active',
          'google_cal_id',
          'google_cal_credentials_encrypted',
          'integration_credentials_encrypted',
        ].join(','),
      )
      .order('created_at', { ascending: false })
      .limit(limit)
      .returns<ShopsRow[]>();

    if (error) {
      throw new Error(`shops_list_failed:${error.message}`);
    }
    return Promise.all((data ?? []).map((row) => this.hydrateServiceCatalog(toShop(row))));
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
        staff: [],
        faqs: [],
        hours: {},
      })
      .select(
        [
          'id',
          'name',
          'vertical',
          'vertical_detail',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'not_offered_services',
          'staff',
          'faqs',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'booking_method',
          'selected_integration',
          'sms_owner_opted_in',
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
          'integration_credentials_encrypted',
        ].join(','),
      )
      .single<ShopsRow>();

    if (error) {
      throw new Error(`shops_create_failed:${error.message}`);
    }
    return this.hydrateServiceCatalog(toShop(data));
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
        | 'backup_phone'
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
    if (patch.vertical_detail !== undefined) payload.vertical_detail = patch.vertical_detail;
    if (patch.user_name !== undefined) payload.user_name = patch.user_name;
    if (patch.user_phone !== undefined) payload.user_phone = patch.user_phone;
    if (patch.backup_phone !== undefined) payload.backup_phone = patch.backup_phone;
    if (patch.address !== undefined) payload.address = patch.address;
    if (patch.timezone !== undefined) payload.timezone = patch.timezone;
    if (patch.services !== undefined) payload.services = patch.services;
    if (patch.not_offered_services !== undefined) payload.not_offered_services = patch.not_offered_services;
    if (patch.staff !== undefined) payload.staff = patch.staff;
    if (patch.faqs !== undefined) payload.faqs = patch.faqs;
    if (patch.hours !== undefined) payload.hours = patch.hours;
    if (patch.cancel_policy !== undefined) payload.cancel_policy = patch.cancel_policy;
    if (patch.promotions !== undefined) payload.promotions = patch.promotions;
    if (patch.booking_url !== undefined) payload.booking_url = patch.booking_url;
    if (patch.booking_method !== undefined) payload.booking_method = patch.booking_method;
    if (patch.selected_integration !== undefined) payload.selected_integration = patch.selected_integration;
    if (patch.website_url !== undefined) payload.website_url = patch.website_url;
    if (patch.languages !== undefined) payload.languages = patch.languages;
    if (patch.current_onboarding_step !== undefined) payload.current_onboarding_step = patch.current_onboarding_step;
    if (patch.setup_method !== undefined) payload.setup_method = patch.setup_method;
    if (patch.forwarding_type !== undefined) payload.forwarding_type = patch.forwarding_type;
    if (patch.forwarding_carrier !== undefined) payload.forwarding_carrier = patch.forwarding_carrier;
    if (patch.forwarding_country !== undefined) payload.forwarding_country = patch.forwarding_country;
    if (patch.sms_owner_opted_in !== undefined) payload.sms_owner_opted_in = patch.sms_owner_opted_in;
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

    let result = await this.supabase
      .from('shops')
      .update(payload)
      .eq('id', shopId)
      .select(shopSelectColumns({ includeSmsOwnerOptIn: patch.sms_owner_opted_in !== undefined }))
      .maybeSingle<ShopsRow>();

    if (result.error && isMissingShopColumn(result.error) && patch.sms_owner_opted_in === undefined) {
      result = await this.supabase
        .from('shops')
        .update(payload)
        .eq('id', shopId)
        .select(shopSelectColumns({ coreOnly: true }))
        .maybeSingle<ShopsRow>();
    }

    if (result.error) {
      throw new Error(`shops_update_user_settings_failed:${result.error.message}`);
    }

    if (!result.data) return null;
    if (patch.services !== undefined) {
      await this.saveServiceCatalog(
        result.data.id,
        buildGeneralServiceCatalog({
          shopId: result.data.id,
          services: patch.services,
          categoryId: randomUUID(),
          serviceIdForIndex: () => randomUUID(),
        }),
      );
      return this.findById(result.data.id);
    }
    return this.hydrateServiceCatalog(toShop(result.data));
  }

  async findServiceCatalogByShopId(shopId: string): Promise<ShopServiceCatalog | null> {
    const [{ data: categories, error: categoriesError }, { data: services, error: servicesError }] = await Promise.all([
      this.supabase
        .from('shop_service_categories')
        .select('id,shop_id,name,description,sort_order,active,created_at,updated_at')
        .eq('shop_id', shopId)
        .order('sort_order', { ascending: true })
        .returns<ShopServiceCategoryRow[]>(),
      this.supabase
        .from('shop_services')
        .select(
          'id,shop_id,category_id,name,description,duration_text,duration_minutes,price_amount,price_currency,price_type,bookable,active,sort_order,aliases,booking_notes,variants_json,external_provider,external_service_id,external_location_id,external_staff_required,external_metadata,created_at,updated_at',
        )
        .eq('shop_id', shopId)
        .order('sort_order', { ascending: true })
        .returns<ShopServiceRow[]>(),
    ]);

    if (categoriesError || servicesError) {
      if (isMissingServiceCatalogTableError(categoriesError) || isMissingServiceCatalogTableError(servicesError)) {
        const legacy = await this.findLegacyServicesByShopId(shopId);
        if (!legacy) return null;
        return buildGeneralServiceCatalog({
          shopId,
          services: legacy,
          categoryId: randomUUID(),
          serviceIdForIndex: () => randomUUID(),
        });
      }
      throw new Error(`shop_service_catalog_find_failed:${categoriesError?.message ?? servicesError?.message}`);
    }

    if ((categories ?? []).length === 0 && (services ?? []).length === 0) {
      const legacy = await this.findLegacyServicesByShopId(shopId);
      if (!legacy) return null;
      return legacy.length
        ? buildGeneralServiceCatalog({
            shopId,
            services: legacy,
            categoryId: randomUUID(),
            serviceIdForIndex: () => randomUUID(),
          })
        : { categories: [], services: [] };
    }

    return {
      categories: (categories ?? []).map(toServiceCategory),
      services: (services ?? []).map(toShopService),
    };
  }

  private async findLegacyServicesByShopId(shopId: string): Promise<ServiceItem[] | null> {
    const { data, error } = await this.supabase.from('shops').select('services').eq('id', shopId).maybeSingle<{ services: unknown }>();
    if (error) throw new Error(`shop_legacy_services_find_failed:${error.message}`);
    if (!data) return null;
    return normalizeServices(data.services);
  }

  async saveServiceCatalog(shopId: string, catalog: ShopServiceCatalog): Promise<ShopServiceCatalog | null> {
    const { data: shopRow, error: shopError } = await this.supabase.from('shops').select('id').eq('id', shopId).maybeSingle<{ id: string }>();
    if (shopError) throw new Error(`shop_service_catalog_shop_find_failed:${shopError.message}`);
    if (!shopRow) return null;

    const now = new Date().toISOString();
    const categoryIds = new Set(catalog.categories.map((category) => category.id));
    const categoryRows = catalog.categories.map((category, index) => ({
      id: category.id || randomUUID(),
      shop_id: shopId,
      name: category.name.trim(),
      description: category.description ?? null,
      sort_order: Number.isFinite(category.sortOrder) ? category.sortOrder : index,
      active: category.active !== false,
      updated_at: now,
    }));
    const normalizedCategoryIds = new Set(categoryRows.map((category) => category.id));
    const serviceRows = catalog.services
      .filter((service) => service.name.trim().length > 0)
      .map((service, index) => ({
        id: service.id || randomUUID(),
        shop_id: shopId,
        category_id: service.categoryId && (categoryIds.has(service.categoryId) || normalizedCategoryIds.has(service.categoryId)) ? service.categoryId : null,
        name: service.name.trim(),
        description: service.description ?? null,
        duration_text: service.durationText ?? null,
        duration_minutes: service.durationMinutes ?? null,
        price_amount: service.priceAmount ?? null,
        price_currency: service.priceCurrency || 'USD',
        price_type: service.priceType,
        bookable: service.bookable !== false,
        active: service.active !== false,
        sort_order: Number.isFinite(service.sortOrder) ? service.sortOrder : index,
        aliases: service.aliases ?? [],
        booking_notes: service.bookingNotes ?? null,
        variants_json: service.variants?.length ? service.variants : null,
        external_provider: service.externalProvider ?? null,
        external_service_id: service.externalServiceId ?? null,
        external_location_id: service.externalLocationId ?? null,
        external_staff_required: service.externalStaffRequired ?? false,
        external_metadata: {
          ...(service.externalMetadata ?? {}),
          ...(service.aiKnowledgeStatus != null ? { __aiKnowledgeStatus: service.aiKnowledgeStatus } : {}),
        },
        updated_at: now,
      }));

    const saved: ShopServiceCatalog = {
      categories: categoryRows.map((row) =>
        toServiceCategory({
          id: row.id,
          shop_id: row.shop_id,
          name: row.name,
          description: row.description,
          sort_order: row.sort_order,
          active: row.active,
          updated_at: row.updated_at,
        }),
      ),
      services: serviceRows.map((row) =>
        toShopService({
          id: row.id,
          shop_id: row.shop_id,
          category_id: row.category_id,
          name: row.name,
          description: row.description,
          duration_text: row.duration_text,
          duration_minutes: row.duration_minutes,
          price_amount: row.price_amount,
          price_currency: row.price_currency,
          price_type: row.price_type,
          bookable: row.bookable,
          active: row.active,
          sort_order: row.sort_order,
          aliases: row.aliases,
          booking_notes: row.booking_notes,
          variants_json: row.variants_json,
          external_provider: row.external_provider,
          external_service_id: row.external_service_id,
          external_location_id: row.external_location_id,
          external_staff_required: row.external_staff_required,
          external_metadata: row.external_metadata,
          updated_at: row.updated_at,
        }),
      ),
    };
    const legacyServices = serviceCatalogToLegacyServices(saved);
    const { error: replaceError } = await this.supabase.rpc('replace_shop_service_catalog', {
      p_shop_id: shopId,
      p_categories: categoryRows,
      p_services: serviceRows,
      p_legacy_services: legacyServices,
    });
    if (replaceError) throw new Error(`shop_service_catalog_replace_failed:${replaceError.message}`);
    return this.findServiceCatalogByShopId(shopId);
  }

  async deleteServiceCategory(params: { shopId: string; categoryId: string }): Promise<ShopServiceCatalog | null> {
    const catalog = await this.findServiceCatalogByShopId(params.shopId);
    if (!catalog) return null;
    if (!catalog.categories.some((category) => category.id === params.categoryId)) return catalog;

    let general = catalog.categories.find((category) => category.name === GENERAL_SERVICE_CATEGORY_NAME && category.id !== params.categoryId);
    const categories = catalog.categories.filter((category) => category.id !== params.categoryId);
    if (!general) {
      general = {
        id: randomUUID(),
        shopId: params.shopId,
        name: GENERAL_SERVICE_CATEGORY_NAME,
        description: null,
        sortOrder: 0,
        active: true,
      };
      categories.unshift(general);
    }
    const updated: ShopServiceCatalog = {
      categories,
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
          'vertical_detail',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'not_offered_services',
          'staff',
          'faqs',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'booking_method',
          'selected_integration',
          'sms_owner_opted_in',
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
          'integration_credentials_encrypted',
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
          'vertical_detail',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'not_offered_services',
          'staff',
          'faqs',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'booking_method',
          'selected_integration',
          'sms_owner_opted_in',
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
          'integration_credentials_encrypted',
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
          'vertical_detail',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'not_offered_services',
          'staff',
          'faqs',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'booking_method',
          'selected_integration',
          'sms_owner_opted_in',
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
          'integration_credentials_encrypted',
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
          'vertical_detail',
          'brand_slug',
          'phone_number',
          'user_phone',
          'backup_phone',
          'user_name',
          'address',
          'timezone',
          'services',
          'not_offered_services',
          'staff',
          'faqs',
          'hours',
          'cancel_policy',
          'promotions',
          'booking_url',
          'booking_method',
          'selected_integration',
          'sms_owner_opted_in',
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
          'integration_credentials_encrypted',
        ].join(','),
      )
      .maybeSingle<ShopsRow>();

    if (error) {
      throw new Error(`shops_update_calendar_connection_failed:${error.message}`);
    }
    return data ? toShop(data) : null;
  }

  async updateIntegrationConnection(
    shopId: string,
    patch: Pick<Shop, 'integration_credentials_encrypted'>,
  ): Promise<Shop | null> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      integration_credentials_encrypted: patch.integration_credentials_encrypted ?? null,
    };

    const { data, error } = await this.supabase
      .from('shops')
      .update(payload)
      .eq('id', shopId)
      .select(shopSelectColumns())
      .maybeSingle<ShopsRow>();

    if (error) {
      throw new Error(`shops_update_integration_connection_failed:${error.message}`);
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
