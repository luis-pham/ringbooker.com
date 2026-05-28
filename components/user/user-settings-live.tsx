'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { BottomSheet, useIsKnowledgeMobile } from '@/components/ui/BottomSheet';
import { UserLayout } from '@/components/user/user-layout';
import type { UserPortalNavKey } from '@/components/user/user-portal-nav';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import {
  USER_PORTAL_TOPBAR_ACTIONS_CLASS,
  UserPortalStandardTopActions,
} from '@/components/user/user-portal-standard-top-actions';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';
import { knowledgePortalTabPageClass, UserPortalPageContent } from '@/components/user/user-portal-page-content';
import { useUserPortalToast } from '@/components/user/user-portal-toast';
import { useUserWorkspace } from '@/components/user/user-workspace-context';
import {
  bookingLinkSaveSuccessMessage,
  formatSaveErrorMessage,
  settingsSaveSuccessMessage,
} from '@/lib/user-portal-save-messages';
import { IntegrationsRedesign } from '@/components/user/integrations-redesign';
import { OnboardingAddGroupSheet } from '@/components/user/onboarding-add-group-sheet';
import { userSettingsScripts, userSettingsStyles } from '@/components/user/user-settings';
import {
  USER_LANGUAGE_OPTIONS,
  getBilingualAnsweringPlanUx,
  getOwnerTransferPlanUx,
  getReturningCallerNotesPlanUx,
  languageDisplayName,
  normalizeUserLanguages,
} from '@/components/user/user-plan-ux-copy';

/** Which top-level portal this settings UI serves (separate sidebar destinations). */
export type UserSettingsPortal = 'ai-settings' | 'knowledge' | 'integrations';

export function userSettingsPortalNavKey(portal: UserSettingsPortal): UserPortalNavKey {
  if (portal === 'knowledge') return 'knowledge';
  if (portal === 'integrations') return 'integrations';
  return 'ai-settings';
}

type ShopPlan = 'starter' | 'professional' | 'enterprise';
type BusinessHoursEntry =
  | { closed: true }
  | {
      open: string;
      close: string;
    };
type ServiceItem = {
  name: string;
  duration_min: number;
  price: number;
};
type ServicePriceType = 'fixed' | 'from' | 'varies' | 'consultation';
type ServiceVariant = {
  id?: string;
  label: string;
  durationMinutes?: number | null;
  durationText?: string | null;
  priceAmount?: number | null;
  priceCurrency?: string;
  priceType?: ServicePriceType;
  sortOrder?: number;
  notes?: string | null;
};
type ServiceCategory = {
  id: string;
  shopId?: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  active: boolean;
};
type ShopService = {
  id: string;
  shopId?: string;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  durationText?: string | null;
  durationMinutes?: number | null;
  priceAmount?: number | null;
  priceCurrency: string;
  priceType: ServicePriceType;
  bookable: boolean;
  active: boolean;
  sortOrder: number;
  aliases: string[];
  bookingNotes?: string | null;
  variants?: ServiceVariant[];
};
type ShopServiceCatalog = {
  categories: ServiceCategory[];
  services: ShopService[];
};
type StaffMember = {
  name: string;
  role?: string | null;
  specialties?: string[];
  notes?: string | null;
  active?: boolean;
};
type BusinessFaqItem = {
  question: string;
  answer: string;
};
type BusinessKnowledgeSuggestionType = 'staff' | 'policy' | 'faq' | 'promotion' | 'booking_hint';
type BusinessKnowledgeSuggestion = {
  id: string;
  sourceUrl: string;
  suggestionType: BusinessKnowledgeSuggestionType;
  payload: Record<string, unknown>;
  confidence: number;
  source: string;
  evidenceSnippet?: string | null;
};
type BusinessKnowledgeSuggestionsResponse = {
  ok?: boolean;
  suggestions?: BusinessKnowledgeSuggestion[];
  counts?: Record<string, number>;
  error?: string;
};
type ShopSettings = {
  id: string;
  name: string;
  vertical?: string | null;
  vertical_detail?: string | null;
  phone_number: string;
  user_name?: string | null;
  user_phone: string;
  handoff_phone?: string | null;
  handoff_availability?: 'business_hours' | 'always' | 'custom' | null;
  handoff_custom_hours?: Record<string, BusinessHoursEntry> | null;
  address?: string | null;
  timezone: string;
  services: ServiceItem[];
  service_catalog?: ShopServiceCatalog | null;
  not_offered_services?: string[];
  staff?: StaffMember[];
  faqs?: BusinessFaqItem[];
  hours: Record<string, BusinessHoursEntry>;
  cancel_policy: string;
  promotions?: string | null;
  booking_url?: string | null;
  booking_method?: 'app' | 'direct' | 'later' | null;
  selected_integration?: string | null;
  website_url?: string | null;
  ai_voice?: string | null;
  ai_welcome_message?: string | null;
  ai_custom_instructions?: string | null;
  languages?: string[] | null;
  allow_transfers: boolean;
  call_recording_enabled?: boolean;
  allow_callbacks: boolean;
  send_reminder_sms: boolean;
  send_review_request_sms: boolean;
  send_missed_call_followup_sms: boolean;
  send_call_summary_sms?: boolean;
  owner_call_summary_sms_timing?: 'business_hours' | 'always' | null;
  send_callback_request_sms?: boolean;
  owner_callback_request_sms_timing?: 'business_hours' | 'always' | null;
  send_daily_digest_sms?: boolean;
  owner_daily_digest_time?: string | null;
  sms_quiet_hours_start?: string | null;
  sms_quiet_hours_end?: string | null;
  plan: ShopPlan;
  active: boolean;
};
type ShopCapabilities = Record<
  | 'edit_business_profile'
  | 'edit_booking_url'
  | 'edit_cancel_policy'
  | 'edit_promotions'
  | 'edit_services'
  | 'edit_staff'
  | 'edit_hours'
  | 'edit_transfer_settings'
  | 'edit_callback_settings'
  | 'edit_missed_call_followup_sms'
  | 'edit_ai_voice'
  | 'edit_ai_greeting'
  | 'edit_reminder_sms'
  | 'edit_review_request_sms'
  | 'edit_ai_custom_instructions'
  | 'provider_context'
  | 'third_party_integrations'
  | 'advanced_call_analytics'
  | 'call_recovery_insights'
  | 'configure_call_recording'
  | 'call_recording_playback',
  boolean
>;
type CapabilityMinPlans = Partial<Record<keyof ShopCapabilities, ShopPlan>>;

export type UserSettingsResponse = {
  ok: boolean;
  shop?: ShopSettings;
  capabilities?: ShopCapabilities;
  capabilityMinPlans?: CapabilityMinPlans;
  serviceCatalogEnabled?: boolean;
  /** When true, Settings shows a Go live tab first until live answering is enabled. */
  showGoLiveSettingsTab?: boolean;
  error?: string;
  fields?: string[];
  warnings?: string[];
};

type CatalogGroupSheetState =
  | null
  | { mode: 'add' }
  | { mode: 'rename'; categoryId: string; currentName: string };

type CalendarProviderSummary = {
  id: string;
  label: string;
  implemented: boolean;
  connected: boolean;
  configured: boolean;
  details: {
    bookingUrl?: string | null;
    merchantId?: string | null;
    locationId?: string | null;
    serviceVariationId?: string | null;
    teamMemberId?: string | null;
    region?: string | null;
    businessId?: string | null;
    capabilityNote?: string | null;
  } | null;
};

type CalendarProvidersResponse = {
  ok: boolean;
  providers?: CalendarProviderSummary[];
  error?: string;
};

type SquareOptionsResponse = {
  ok: boolean;
  options?: {
    locations: Array<{ id: string; name: string; status?: string }>;
    serviceVariations: Array<{ id: string; name: string; durationMin?: number; amount?: number; currency?: string }>;
  };
  error?: string;
};

type SettingsState = {
  name: string;
  vertical: string;
  vertical_detail: string;
  phone_number: string;
  user_name: string;
  user_phone: string;
  handoff_phone: string;
  handoff_availability: 'business_hours' | 'always' | 'custom';
  handoff_custom_hours: Record<string, BusinessHoursEntry>;
  address: string;
  timezone: string;
  booking_url: string;
  website_url: string;
  cancel_policy: string;
  promotions: string;
  services: ServiceItem[];
  service_catalog: ShopServiceCatalog;
  not_offered_services: string[];
  staff: StaffMember[];
  faqs: BusinessFaqItem[];
  hours: Record<string, BusinessHoursEntry>;
  ai_voice: string;
  ai_welcome_message: string;
  ai_custom_instructions: string;
  languages: string[];
  allow_transfers: boolean;
  call_recording_enabled: boolean;
  allow_callbacks: boolean;
  send_reminder_sms: boolean;
  send_review_request_sms: boolean;
  send_missed_call_followup_sms: boolean;
  send_call_summary_sms: boolean;
  owner_call_summary_sms_timing: 'business_hours' | 'always';
  send_callback_request_sms: boolean;
  owner_callback_request_sms_timing: 'business_hours' | 'always';
  send_daily_digest_sms: boolean;
  owner_daily_digest_time: string;
  sms_quiet_hours_start: string;
  sms_quiet_hours_end: string;
};

type SettingsTabId =
  | 'business'
  | 'hours'
  | 'services-hours'
  | 'staff'
  | 'faq'
  | 'ai-call-behavior'
  | 'messaging'
  | 'integrations';

/** Logos under /public/images — used in Calendar integrations cards. */
function textLogo(label: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80"><rect width="160" height="80" rx="18" fill="white"/><text x="80" y="44" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#111827">${label}</text></svg>`,
  )}`;
}

const CALENDAR_PROVIDER_LOGOS: Record<string, string> = {
  vagaro: '/images/vagaro.png',
  square_appointments: '/images/square.png',
  mindbody: '/images/mindbody.webp',
  booksy: '/images/booksy.png',
  glossgenius: textLogo('GlossGenius'),
  fresha: textLogo('Fresha'),
  custom: textLogo('Custom'),
};

type BookingLinkProviderId = 'glossgenius' | 'fresha' | 'custom' | 'booksy';

const BOOKING_LINK_PROVIDER_IDS = ['glossgenius', 'fresha', 'custom', 'booksy'] as const;
const BOOKING_LINK_PLACEHOLDERS: Record<BookingLinkProviderId, string> = {
  glossgenius: 'https://glossgenius.com/your-business or your custom domain',
  fresha: 'https://fresha.com/your-business-name',
  custom: 'https://yourbookingpage.com/your-business',
  booksy: 'https://booksy.com/en-us/your-profile',
};

const BUSINESS_TYPE_OPTIONS = [
  { value: 'nail_salon', label: 'Nail salon' },
  { value: 'hair_salon', label: 'Hair salon' },
  { value: 'day_spa', label: 'Day spa' },
  { value: 'med_spa', label: 'Med spa' },
  { value: 'beauty_clinic', label: 'Beauty clinic' },
] as const;

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<(typeof DAY_ORDER)[number], string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

const TIME_OPTIONS = Array.from({ length: 31 }, (_, index) => {
  const totalMinutes = (7 * 60) + index * 30;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
});

const SERVICE_CATALOG: Array<ServiceItem & { key: string; description: string }> = [
  { key: 'manicure', name: 'Manicure', duration_min: 30, price: 20, description: 'Fast polish refresh for repeat clients.' },
  { key: 'pedicure', name: 'Pedicure', duration_min: 45, price: 35, description: 'Classic spa pedicure for high-call demand.' },
  { key: 'gel-nails', name: 'Gel Nails', duration_min: 60, price: 45, description: 'Longer-service staple with clear timing.' },
  { key: 'blowout', name: 'Wash & Blowout', duration_min: 30, price: 35, description: 'Great for same-day availability questions.' },
  { key: 'haircut', name: 'Haircut', duration_min: 45, price: 45, description: 'Simple bookable service for voice callers.' },
  { key: 'color', name: 'Color Touch-up', duration_min: 90, price: 95, description: 'Longer slot with pricing clarity built in.' },
];

const PRICE_TYPE_OPTIONS: Array<{ value: ServicePriceType; label: string }> = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'from', label: 'Starts at' },
  { value: 'varies', label: 'Varies' },
  { value: 'consultation', label: 'Consultation' },
];

const SERVICE_GROUP_EXAMPLES: Record<string, string[]> = {
  nail_salon: ['Manicure', 'Pedicure', 'Acrylics / Extensions'],
  hair_salon: ['Haircuts', 'Color', 'Treatments'],
  day_spa: ['Facials', 'Massage', 'Waxing'],
  med_spa: ['Injectables', 'Laser', 'Facials'],
  beauty_clinic: ['Facials', 'Waxing', 'Lash / Brow'],
};

const CANCEL_POLICY_PRESETS = [
  'No cancellation fee. Please give us a quick heads-up if plans change.',
  'Appointments should be canceled at least 2 hours before the scheduled time.',
  'Appointments should be canceled at least 24 hours before the scheduled time.',
  'Same-day changes should be handled by phone with the salon team.',
];

const PROMOTION_PRESETS = [
  '',
  '10% off for first-time customers this week.',
  'Free consultation with any color booking this month.',
  '$10 off weekday appointments booked before 2 PM.',
];

const AI_GREETING_PRESETS = [
  'Thank you for calling {business}, how can I help you today?',
  'Welcome to {business}. I can help with bookings, pricing, and availability.',
  'Hi, this is the AI booking desk for {business}. What service would you like today?',
];

const AI_VOICE_OPTIONS = [
  { value: 'Aoede', label: 'Warm and polished' },
  { value: 'Puck', label: 'Fast and concise' },
  { value: 'Charon', label: 'Confident and premium' },
];

const HOURS_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  hours: Record<string, BusinessHoursEntry>;
}> = [
  {
    id: 'classic',
    label: 'Classic salon week',
    description: 'Mon-Sat 9:00 to 18:00, Sunday closed.',
    hours: {
      mon: { open: '09:00', close: '18:00' },
      tue: { open: '09:00', close: '18:00' },
      wed: { open: '09:00', close: '18:00' },
      thu: { open: '09:00', close: '18:00' },
      fri: { open: '09:00', close: '18:00' },
      sat: { open: '09:00', close: '18:00' },
      sun: { closed: true },
    },
  },
  {
    id: 'busy-friday',
    label: 'Late Friday',
    description: 'Adds extended hours on Friday for after-work bookings.',
    hours: {
      mon: { open: '09:00', close: '18:00' },
      tue: { open: '09:00', close: '18:00' },
      wed: { open: '09:00', close: '18:00' },
      thu: { open: '09:00', close: '18:00' },
      fri: { open: '09:00', close: '20:00' },
      sat: { open: '09:00', close: '18:00' },
      sun: { closed: true },
    },
  },
  {
    id: 'six-day',
    label: 'Six-day coverage',
    description: 'Open Sunday for shorter hours with strong callback coverage.',
    hours: {
      mon: { open: '09:00', close: '18:00' },
      tue: { open: '09:00', close: '18:00' },
      wed: { open: '09:00', close: '18:00' },
      thu: { open: '09:00', close: '18:00' },
      fri: { open: '09:00', close: '19:00' },
      sat: { open: '09:00', close: '18:00' },
      sun: { open: '10:00', close: '15:00' },
    },
  },
];

function SettingsTabIcon({ tabId }: { tabId: SettingsTabId }): ReactNode {
  const wrap = (children: ReactNode) => (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );

  switch (tabId) {
    case 'business':
      return wrap(
        <>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </>,
      );
    case 'hours':
      return wrap(
        <>
          <circle cx={12} cy={12} r={9} />
          <path d="M12 7v5l3 2" />
        </>,
      );
    case 'services-hours':
      return wrap(
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h10" />
        </>,
      );
    case 'staff':
      return wrap(
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx={9} cy={7} r={4} />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </>,
      );
    case 'faq':
      return wrap(
        <>
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
          <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4" />
          <path d="M12 17h.01" />
        </>,
      );
    case 'ai-call-behavior':
      return wrap(
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
      );
    case 'messaging':
      return wrap(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />);
    case 'integrations':
      return wrap(
        <>
          <circle cx={12} cy={12} r={3} />
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </>,
      );
    default:
      return null;
  }
}

const SETTINGS_TAB_META: Record<SettingsTabId, { label: string; description: string }> = {
  business: { label: 'Business profile', description: 'Name, type, website, phone, timezone, and address.' },
  hours: { label: 'Hours', description: 'Weekly schedule and closure notes.' },
  'services-hours': { label: 'Services', description: 'Service groups, prices, duration, and request rules.' },
  staff: { label: 'Staffs', description: 'Technicians, specialists, and provider preferences.' },
  faq: { label: 'Policies & FAQ', description: 'Policies, promotions, and approved answers.' },
  'ai-call-behavior': { label: 'AI behavior & Calling handling', description: 'Voice, call rules, and SMS notifications.' },
  messaging: { label: 'Messaging', description: 'Reminders, reviews, and follow-up SMS.' },
  integrations: { label: 'Integrations', description: 'Square, Vagaro, or booking page links.' },
};

const SETTINGS_PORTAL_TAB_ORDER: Record<UserSettingsPortal, SettingsTabId[]> = {
  'ai-settings': ['ai-call-behavior'],
  knowledge: ['business', 'hours', 'services-hours', 'staff', 'faq', 'ai-call-behavior'],
  integrations: ['integrations'],
};

function tabCopyForPortal(portal: UserSettingsPortal, id: SettingsTabId): { label: string; description: string } {
  if (portal === 'ai-settings' && id === 'ai-call-behavior') {
    return {
      label: 'AI behavior & Calling handling',
      description: 'Voice, call handling, and SMS notification rules.',
    };
  }
  return SETTINGS_TAB_META[id];
}

function visibleTabsForPortal(portal: UserSettingsPortal): Array<{ id: SettingsTabId; label: string; description: string }> {
  return SETTINGS_PORTAL_TAB_ORDER[portal].map((id) => ({ id, ...tabCopyForPortal(portal, id) }));
}

function cloneHours(hours: Record<string, BusinessHoursEntry>) {
  return JSON.parse(JSON.stringify(hours)) as Record<string, BusinessHoursEntry>;
}

function clientId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseDurationTextToMinutes(value?: string | null): number | null {
  const text = (value ?? '').trim().toLowerCase();
  if (!text) return null;
  const range = text.match(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m)?/);
  const match = range ?? text.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m)?\+?/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[3] || match[2] || '';
  return /h|hour|hr/.test(unit) ? Math.round(amount * 60) : Math.round(amount);
}

function serviceDurationText(service: Pick<ShopService, 'durationText' | 'durationMinutes'>): string {
  return service.durationText?.trim() || (service.durationMinutes ? `${service.durationMinutes} min` : '');
}

function catalogFromLegacyServices(services: ServiceItem[], shopId = ''): ShopServiceCatalog {
  const categoryId = clientId('service-category');
  return {
    categories: services.length
      ? [{ id: categoryId, shopId, name: 'General Services', description: null, sortOrder: 0, active: true }]
      : [],
    services: services
      .filter((service) => service.name.trim().length > 0)
      .map((service, index) => ({
        id: clientId('service'),
        shopId,
        categoryId,
        name: service.name.trim(),
        description: null,
        durationText: service.duration_min ? `${service.duration_min} min` : null,
        durationMinutes: service.duration_min || 60,
        priceAmount: Number.isFinite(service.price) ? service.price : 0,
        priceCurrency: 'USD',
        priceType: service.price > 0 ? 'fixed' : 'varies',
        bookable: true,
        active: true,
        sortOrder: index,
        aliases: [],
        bookingNotes: null,
        variants: [],
      })),
  };
}

function ensureEditableCatalog(catalog: ShopServiceCatalog, shopId = ''): ShopServiceCatalog {
  if (catalog.categories.length > 0) return catalog;
  return {
    categories: [{ id: clientId('service-category'), shopId, name: 'General Services', description: null, sortOrder: 0, active: true }],
    services: catalog.services,
  };
}

function legacyServicesFromCatalog(catalog: ShopServiceCatalog): ServiceItem[] {
  const categoryOrder = new Map(catalog.categories.map((category) => [category.id, category.sortOrder]));
  return catalog.services
    .filter((service) => service.active !== false && service.name.trim())
    .sort((a, b) => {
      const categoryDiff = (categoryOrder.get(a.categoryId ?? '') ?? 0) - (categoryOrder.get(b.categoryId ?? '') ?? 0);
      if (categoryDiff !== 0) return categoryDiff;
      return a.sortOrder - b.sortOrder;
    })
    .map((service) => ({
      name: service.name,
      duration_min: service.durationMinutes ?? 60,
      price: service.priceAmount ?? 0,
      // Legacy flat services cannot represent variants; the service catalog keeps them.
    }));
}

function normalizeGreeting(template: string, shopName: string) {
  return template.replaceAll('{business}', shopName || 'your salon').replaceAll('{shop}', shopName || 'your salon');
}

function buildInitialState(shop: ShopSettings): SettingsState {
  return {
    name: shop.name ?? '',
    vertical: shop.vertical ?? '',
    vertical_detail: shop.vertical_detail ?? '',
    phone_number: shop.phone_number ?? '',
    user_name: shop.user_name ?? '',
    user_phone: shop.user_phone,
    handoff_phone: shop.handoff_phone ?? '',
    handoff_availability: (shop.handoff_availability ?? 'business_hours') as 'business_hours' | 'always' | 'custom',
    handoff_custom_hours: cloneHours((shop.handoff_custom_hours as Record<string, BusinessHoursEntry> | null | undefined) ?? {}),
    address: shop.address ?? '',
    timezone: shop.timezone,
    booking_url: shop.booking_url ?? '',
    website_url: shop.website_url ?? '',
    cancel_policy: shop.cancel_policy,
    promotions: shop.promotions ?? '',
    services: shop.services,
    service_catalog: ensureEditableCatalog(shop.service_catalog ?? catalogFromLegacyServices(shop.services, shop.id), shop.id),
    not_offered_services: shop.not_offered_services ?? [],
    staff: shop.staff ?? [],
    faqs: shop.faqs ?? [],
    hours: cloneHours(shop.hours),
    ai_voice: shop.ai_voice ?? 'Aoede',
    ai_welcome_message: shop.ai_welcome_message ?? normalizeGreeting(AI_GREETING_PRESETS[0], shop.name),
    ai_custom_instructions: shop.ai_custom_instructions ?? '',
    languages: normalizeUserLanguages(shop.languages),
    allow_transfers: shop.allow_transfers,
    call_recording_enabled: shop.call_recording_enabled ?? false,
    allow_callbacks: shop.allow_callbacks,
    send_reminder_sms: shop.send_reminder_sms,
    send_review_request_sms: shop.send_review_request_sms,
    send_missed_call_followup_sms: shop.send_missed_call_followup_sms,
    send_call_summary_sms: shop.send_call_summary_sms ?? true,
    owner_call_summary_sms_timing: shop.owner_call_summary_sms_timing ?? 'business_hours',
    send_callback_request_sms: shop.send_callback_request_sms ?? true,
    owner_callback_request_sms_timing: shop.owner_callback_request_sms_timing ?? 'always',
    send_daily_digest_sms: shop.send_daily_digest_sms ?? false,
    owner_daily_digest_time: shop.owner_daily_digest_time ?? '18:00',
    sms_quiet_hours_start: shop.sms_quiet_hours_start ?? '08:00',
    sms_quiet_hours_end: shop.sms_quiet_hours_end ?? '21:00',
  };
}

const DEFAULT_SETTINGS_SHOP: ShopSettings = {
  id: 'loading',
  name: 'Your business',
  vertical: null,
  vertical_detail: null,
  phone_number: '',
  user_name: '',
  user_phone: '',
  handoff_phone: '',
  handoff_availability: 'business_hours',
  handoff_custom_hours: {},
  address: '',
  timezone: 'America/Los_Angeles',
  services: [],
  service_catalog: { categories: [], services: [] },
  not_offered_services: [],
  staff: [],
  faqs: [],
  hours: cloneHours(HOURS_PRESETS[0]?.hours ?? {}),
  cancel_policy: '',
  promotions: '',
  booking_url: '',
  website_url: '',
  ai_voice: 'Aoede',
  ai_welcome_message: normalizeGreeting(AI_GREETING_PRESETS[0], 'Your business'),
  ai_custom_instructions: '',
  languages: ['en'],
  allow_transfers: false,
  call_recording_enabled: false,
  allow_callbacks: true,
  send_reminder_sms: false,
  send_review_request_sms: false,
  send_missed_call_followup_sms: true,
  send_call_summary_sms: true,
  owner_call_summary_sms_timing: 'business_hours',
  send_callback_request_sms: true,
  owner_callback_request_sms_timing: 'always',
  send_daily_digest_sms: false,
  owner_daily_digest_time: '18:00',
  sms_quiet_hours_start: '08:00',
  sms_quiet_hours_end: '21:00',
  plan: 'starter',
  active: false,
};

const DEFAULT_SETTINGS_CAPABILITIES: ShopCapabilities = {
  edit_business_profile: true,
  edit_booking_url: true,
  edit_cancel_policy: true,
  edit_promotions: true,
  edit_services: true,
  edit_staff: false,
  edit_hours: true,
  edit_transfer_settings: false,
  edit_callback_settings: true,
  edit_missed_call_followup_sms: true,
  edit_ai_voice: false,
  edit_ai_greeting: false,
  edit_reminder_sms: false,
  edit_review_request_sms: false,
  edit_ai_custom_instructions: false,
  provider_context: false,
  third_party_integrations: false,
  advanced_call_analytics: false,
  call_recovery_insights: false,
  configure_call_recording: false,
  call_recording_playback: false,
};

const DEFAULT_SETTINGS_STATE = buildInitialState(DEFAULT_SETTINGS_SHOP);

function getPresetMatch(value: string, presets: string[]) {
  return presets.includes(value) ? value : 'custom';
}

function getHourPresetId(hours: Record<string, BusinessHoursEntry>) {
  const serialized = JSON.stringify(hours);
  const match = HOURS_PRESETS.find((preset) => JSON.stringify(preset.hours) === serialized);
  return match?.id ?? 'custom';
}

function emptyStaffMember(): StaffMember {
  return { name: '', role: '', specialties: [], notes: '', active: true };
}

function emptyFaqItem(): BusinessFaqItem {
  return { question: '', answer: '' };
}

export function UserSettingsLive({
  portal = 'ai-settings',
  initialData = null,
}: {
  portal?: UserSettingsPortal;
  initialData?: UserSettingsResponse | null;
}) {
  const { setWorkspace } = useUserWorkspace();
  const { showToast } = useUserPortalToast();
  const sidebarNav = userSettingsPortalNavKey(portal);
  const portalHead =
    portal === 'knowledge'
      ? {
          title: 'Business Knowledge',
          subtitle:
            'This is what RingBooker uses to answer every caller: profile, hours, services, staff, policies, FAQs, and call handling.',
        }
      : portal === 'integrations'
        ? {
            title: 'Integrations',
            subtitle: 'Connect Square, Vagaro, or your public booking link so the AI stays aligned with real availability.',
          }
        : {
            title: 'AI Settings',
            subtitle: 'Voice, tone, call handling, and SMS automations.',
          };

  const defaultTabForPortal = (): SettingsTabId =>
    portal === 'knowledge' ? 'business' : portal === 'integrations' ? 'integrations' : 'ai-call-behavior';

  const initialShop = initialData?.ok && initialData.shop ? initialData.shop : null;
  const initialState = initialShop ? buildInitialState(initialShop) : null;
  const [shop, setShop] = useState<ShopSettings | null>(initialShop);
  const [capabilities, setCapabilities] = useState<ShopCapabilities | null>(
    initialData?.ok ? initialData.capabilities ?? null : null,
  );
  const [capabilityMinPlans, setCapabilityMinPlans] = useState<CapabilityMinPlans>(
    initialData?.ok ? initialData.capabilityMinPlans ?? {} : {},
  );
  const [serviceCatalogEnabled, setServiceCatalogEnabled] = useState(initialData?.ok ? initialData.serviceCatalogEnabled === true : false);
  const [form, setForm] = useState<SettingsState | null>(initialState);
  const [status, setStatus] = useState<string | null>(initialData && !initialData.ok ? initialData.error ?? 'unable_to_load' : null);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [cancelPreset, setCancelPreset] = useState<string>(initialState ? getPresetMatch(initialState.cancel_policy, CANCEL_POLICY_PRESETS) : 'custom');
  const [promoPreset, setPromoPreset] = useState<string>(initialState ? getPresetMatch(initialState.promotions, PROMOTION_PRESETS) : 'custom');
  const [greetingPreset, setGreetingPreset] = useState<string>(
    initialState && initialShop ? getPresetMatch(initialState.ai_welcome_message, AI_GREETING_PRESETS.map((item) => normalizeGreeting(item, initialShop.name))) : 'custom',
  );
  const [hourPreset, setHourPreset] = useState<string>(initialState ? getHourPresetId(initialState.hours) : 'custom');
  const [activeTab, setActiveTab] = useState<SettingsTabId>(defaultTabForPortal);
  const [calendarProviders, setCalendarProviders] = useState<CalendarProviderSummary[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<string | null>(null);
  const [loadingCalendarProviders, setLoadingCalendarProviders] = useState(false);
  const [squareOptions, setSquareOptions] = useState<SquareOptionsResponse['options'] | null>(null);
  const [loadingSquareOptions, setLoadingSquareOptions] = useState(false);
  const [squareLocationId, setSquareLocationId] = useState('');
  const [squareServiceVariationId, setSquareServiceVariationId] = useState('');
  const [squareTeamMemberId, setSquareTeamMemberId] = useState('');
  const [savingSquareConfig, setSavingSquareConfig] = useState(false);
  const [vagaroClientId, setVagaroClientId] = useState('');
  const [vagaroClientSecretKey, setVagaroClientSecretKey] = useState('');
  const [vagaroRegion, setVagaroRegion] = useState('us');
  const [vagaroBusinessId, setVagaroBusinessId] = useState('');
  const [vagaroBookingUrl, setVagaroBookingUrl] = useState(initialShop?.booking_url ?? '');
  const [vagaroBookingUrlError, setVagaroBookingUrlError] = useState<string | null>(null);
  const [savingVagaroConfig, setSavingVagaroConfig] = useState(false);
  const [savingVagaroBookingUrl, setSavingVagaroBookingUrl] = useState(false);
  const [bookingLinkInputs, setBookingLinkInputs] = useState<Record<BookingLinkProviderId, string>>({
    glossgenius: '',
    fresha: '',
    custom: '',
    booksy: '',
  });
  const [bookingLinkErrors, setBookingLinkErrors] = useState<Partial<Record<BookingLinkProviderId, string>>>({});
  const [editingBookingLinkProvider, setEditingBookingLinkProvider] = useState<BookingLinkProviderId | null>(null);
  const [savingBookingLinkProvider, setSavingBookingLinkProvider] = useState<BookingLinkProviderId | null>(null);
  const [behaviorSubTab, setBehaviorSubTab] = useState<'call' | 'sms' | 'voice'>('voice');
  const [messagingSubTab, setMessagingSubTab] = useState<'automations' | 'notes'>('automations');
  const [editingLegacyServiceIndex, setEditingLegacyServiceIndex] = useState<number | null>(null);
  const [editingCatalogServiceId, setEditingCatalogServiceId] = useState<string | null>(null);
  const catalogServiceDialogRef = useRef<HTMLDialogElement>(null);
  const [catalogDialogServiceId, setCatalogDialogServiceId] = useState<string | null>(null);
  const [catalogDialogDraft, setCatalogDialogDraft] = useState<ShopService | null>(null);
  const [catalogDialogError, setCatalogDialogError] = useState<string | null>(null);
  const [catalogGroupSheet, setCatalogGroupSheet] = useState<CatalogGroupSheetState>(null);
  const knowledgeMobile = useIsKnowledgeMobile();
  const [knowledgeAddressSheetOpen, setKnowledgeAddressSheetOpen] = useState(false);
  const [knowledgeAddressDraft, setKnowledgeAddressDraft] = useState('');
  const [knowledgeCatalogMobileSheet, setKnowledgeCatalogMobileSheet] = useState<{ serviceId: string; draft: ShopService } | null>(null);
  const [knowledgeCatalogMobileError, setKnowledgeCatalogMobileError] = useState<string | null>(null);
  const [knowledgeLegacyMobileSheet, setKnowledgeLegacyMobileSheet] = useState<{ index: number; draft: ServiceItem } | null>(null);
  const [knowledgeLegacyMobileError, setKnowledgeLegacyMobileError] = useState<string | null>(null);
  const [knowledgeStaffAddSheetOpen, setKnowledgeStaffAddSheetOpen] = useState(false);
  const [knowledgeStaffAddDraft, setKnowledgeStaffAddDraft] = useState<StaffMember>(() => emptyStaffMember());
  const [knowledgeFaqCreateSheetOpen, setKnowledgeFaqCreateSheetOpen] = useState(false);
  const [knowledgeFaqCreateDraft, setKnowledgeFaqCreateDraft] = useState<BusinessFaqItem>(() => emptyFaqItem());
  const legacyServiceDialogRef = useRef<HTMLDialogElement>(null);
  const [legacyDialogIndex, setLegacyDialogIndex] = useState<number | null>(null);
  const [legacyDialogDraft, setLegacyDialogDraft] = useState<ServiceItem | null>(null);
  const [legacyFormError, setLegacyFormError] = useState<string | null>(null);
  const [expandedStaffIndex, setExpandedStaffIndex] = useState<number | null>(null);
  const [websiteSuggestions, setWebsiteSuggestions] = useState<BusinessKnowledgeSuggestion[]>([]);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
  const [suggestionEdits, setSuggestionEdits] = useState<Record<string, Record<string, unknown>>>({});
  const [suggestionStatus, setSuggestionStatus] = useState<string | null>(null);
  const [savingSuggestions, setSavingSuggestions] = useState(false);
  const [handoffPhoneDraft, setHandoffPhoneDraft] = useState<string>(initialShop?.handoff_phone ?? '');
  const [handoffAvailabilityDraft, setHandoffAvailabilityDraft] = useState<'business_hours' | 'always' | 'custom'>(
    (initialShop?.handoff_availability ?? 'business_hours') as 'business_hours' | 'always' | 'custom',
  );
  const [handoffCustomHoursDraft, setHandoffCustomHoursDraft] = useState<Record<string, BusinessHoursEntry>>(
    cloneHours((initialShop?.handoff_custom_hours as Record<string, BusinessHoursEntry> | null | undefined) ?? {}),
  );
  const [handoffPhoneStatus, setHandoffPhoneStatus] = useState<'idle' | 'saving' | 'saved' | string>('idle');
  const [handoffPhoneWarnings, setHandoffPhoneWarnings] = useState<string[]>([]);

  const activateSettingsTab = useCallback((tabId: SettingsTabId) => {
    setActiveTab(tabId);
    if (typeof window === 'undefined') return;
    const base = `${window.location.pathname}${window.location.search}`;
    if (tabId === 'integrations') {
      window.history.replaceState(null, '', `${base}#integrations`);
    } else if (window.location.hash) {
      window.history.replaceState(null, '', base);
    }
  }, []);

  const loadWebsiteSuggestions = useCallback(async () => {
    if (portal !== 'knowledge') return;
    try {
      const response = await fetch('/api/backend/user/business-knowledge/suggestions');
      const body = (await response.json()) as BusinessKnowledgeSuggestionsResponse;
      if (!response.ok || !body.ok) {
        setSuggestionStatus(body.error ?? 'suggestions_load_failed');
        return;
      }
      setWebsiteSuggestions(body.suggestions ?? []);
      setSelectedSuggestionIds([]);
      setSuggestionEdits({});
    } catch {
      setSuggestionStatus('suggestions_network_error');
    }
  }, [portal]);


  useEffect(() => {
    if (initialData) return;
    let active = true;
    void fetch('/api/backend/user/settings')
      .then(async (response) => (await response.json()) as UserSettingsResponse)
      .then((body) => {
        if (!active) return;
        if (!body.ok || !body.shop || !body.capabilities) {
          setStatus(body.error ?? 'unable_to_load');
          return;
        }
        const nextShop = body.shop;
        setShop(nextShop);
        setVagaroBookingUrl(nextShop.booking_url ?? '');
        setCapabilities(body.capabilities);
        setCapabilityMinPlans(body.capabilityMinPlans ?? {});
        setServiceCatalogEnabled(body.serviceCatalogEnabled === true);
        const nextState = buildInitialState(nextShop);
        setForm(nextState);
        setCancelPreset(getPresetMatch(nextState.cancel_policy, CANCEL_POLICY_PRESETS));
        setPromoPreset(getPresetMatch(nextState.promotions, PROMOTION_PRESETS));
        setGreetingPreset(getPresetMatch(nextState.ai_welcome_message, AI_GREETING_PRESETS.map((item) => normalizeGreeting(item, nextShop.name))));
        setHourPreset(getHourPresetId(nextState.hours));

        const allowedIds = new Set(SETTINGS_PORTAL_TAB_ORDER[portal]);
        const h = typeof window !== 'undefined' ? window.location.hash : '';
        let nextTab: SettingsTabId = defaultTabForPortal();
        const hashTab = h.startsWith('#') ? (h.slice(1) as SettingsTabId) : null;
        if (hashTab && allowedIds.has(hashTab)) {
          nextTab = hashTab;
        }
        setActiveTab(nextTab);
      })
      .catch(() => {
        if (active) setStatus('network_error');
      });
    return () => {
      active = false;
    };
  }, [initialData, portal]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const calendarConnect = query.get('calendar_connect');
    if (!calendarConnect) return;
    const provider = query.get('provider') ?? 'provider';
    const message = query.get('calendar_message');
    if (calendarConnect === 'success') {
      setCalendarStatus(`${provider} connected successfully.`);
    } else {
      setCalendarStatus(message ? `Connection failed: ${message}` : `Connection failed for ${provider}.`);
    }
  }, []);

  useEffect(() => {
    const allowedIds = new Set(SETTINGS_PORTAL_TAB_ORDER[portal]);
    const syncHash = () => {
      if (typeof window === 'undefined') return;
      const h = window.location.hash;
      const hashTab = h.startsWith('#') ? (h.slice(1) as SettingsTabId) : null;
      if (hashTab && allowedIds.has(hashTab)) {
        setActiveTab(hashTab);
        return;
      }
      if (hashTab && !allowedIds.has(hashTab)) {
        const base = `${window.location.pathname}${window.location.search}`;
        window.history.replaceState(null, '', base);
      }
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [portal]);

  async function loadCalendarProviders() {
    if (!(capabilities ?? DEFAULT_SETTINGS_CAPABILITIES).third_party_integrations) {
      setCalendarProviders([]);
      setCalendarStatus(null);
      setLoadingCalendarProviders(false);
      return;
    }
    setLoadingCalendarProviders(true);
    try {
      const response = await fetch('/api/backend/user/calendar/providers');
      const body = (await response.json()) as CalendarProvidersResponse;
      if (!response.ok || !body.ok || !body.providers) {
        if (body.error === 'plan_feature_locked') {
          setCalendarStatus(null);
          return;
        }
        setCalendarStatus(body.error ?? 'unable_to_load_calendar_providers');
        return;
      }
      const providers = body.providers;
      setCalendarProviders(providers);
      const square = providers.find((item) => item.id === 'square_appointments');
      if (square?.details?.locationId) setSquareLocationId(square.details.locationId);
      if (square?.details?.serviceVariationId) setSquareServiceVariationId(square.details.serviceVariationId);
      if (square?.details?.teamMemberId) setSquareTeamMemberId(square.details.teamMemberId);
      const vagaro = providers.find((item) => item.id === 'vagaro');
      if (vagaro?.details?.region) setVagaroRegion(vagaro.details.region);
      if (vagaro?.details?.businessId) setVagaroBusinessId(vagaro.details.businessId);
      if (vagaro?.details?.bookingUrl) setVagaroBookingUrl(vagaro.details.bookingUrl);
      setBookingLinkInputs((current) => {
        const next = { ...current };
        for (const providerId of BOOKING_LINK_PROVIDER_IDS) {
          const provider = providers.find((item) => item.id === providerId);
          if (provider?.details?.bookingUrl) next[providerId] = provider.details.bookingUrl;
        }
        return next;
      });
    } catch {
      setCalendarStatus('unable_to_load_calendar_providers');
    } finally {
      setLoadingCalendarProviders(false);
    }
  }

  useEffect(() => {
    if (!(capabilities ?? DEFAULT_SETTINGS_CAPABILITIES).third_party_integrations) {
      setCalendarProviders([]);
      setLoadingCalendarProviders(false);
      return;
    }
    void loadCalendarProviders();
  }, [capabilities]);

  async function loadSquareOptions() {
    setLoadingSquareOptions(true);
    try {
      const response = await fetch('/api/backend/user/calendar/providers/square_appointments/options');
      const body = (await response.json()) as SquareOptionsResponse;
      if (!response.ok || !body.ok || !body.options) {
        setCalendarStatus(body.error ?? 'unable_to_load_square_options');
        return;
      }
      setSquareOptions(body.options);
      if (!squareLocationId && body.options.locations.length > 0) {
        setSquareLocationId(body.options.locations[0].id);
      }
      if (!squareServiceVariationId && body.options.serviceVariations.length > 0) {
        setSquareServiceVariationId(body.options.serviceVariations[0].id);
      }
    } catch {
      setCalendarStatus('unable_to_load_square_options');
    } finally {
      setLoadingSquareOptions(false);
    }
  }

  const squareProvider = calendarProviders.find((item) => item.id === 'square_appointments') ?? null;
  const vagaroProvider = calendarProviders.find((item) => item.id === 'vagaro') ?? null;

  const hasAnyIntegrationSetup = useMemo(() => {
    const bookingLinked = BOOKING_LINK_PROVIDER_IDS.some((id) =>
      calendarProviders.some((p) => p.id === id && p.connected),
    );
    return Boolean(squareProvider?.connected || vagaroProvider?.connected || bookingLinked);
  }, [calendarProviders, squareProvider?.connected, vagaroProvider?.connected]);

  const [integrationsPath, setIntegrationsPath] = useState<
    'pick' | 'square' | 'booking_link' | 'vagaro' | 'all'
  >('pick');

  useEffect(() => {
    if (hasAnyIntegrationSetup) setIntegrationsPath('all');
  }, [hasAnyIntegrationSetup]);

  const connectedBookingLinkId = useMemo(() => {
    return BOOKING_LINK_PROVIDER_IDS.find((id) => calendarProviders.some((p) => p.id === id && p.connected)) ?? null;
  }, [calendarProviders]);

  const [bookingLinkPick, setBookingLinkPick] = useState<BookingLinkProviderId>('fresha');

  useEffect(() => {
    if (connectedBookingLinkId) setBookingLinkPick(connectedBookingLinkId);
  }, [connectedBookingLinkId]);

  const showSquareBlock =
    hasAnyIntegrationSetup || integrationsPath === 'all' || integrationsPath === 'square';
  const showBookingLinkBlock =
    hasAnyIntegrationSetup || integrationsPath === 'all' || integrationsPath === 'booking_link';
  const showVagaroBlock =
    hasAnyIntegrationSetup || integrationsPath === 'all' || integrationsPath === 'vagaro';
  const showIntegrationsPathPicker = !hasAnyIntegrationSetup && integrationsPath === 'pick';
  const showIntegrationsPathFooter =
    !hasAnyIntegrationSetup && integrationsPath !== 'pick' && integrationsPath !== 'all';
  const squareSectionHeadingFirst = showSquareBlock;
  const bookingSectionHeadingFirst = showBookingLinkBlock && !showSquareBlock;
  const vagaroSectionHeadingFirst = showVagaroBlock && !showSquareBlock && !showBookingLinkBlock;

  async function saveBookingLink(providerId: BookingLinkProviderId) {
    const bookingUrl = bookingLinkInputs[providerId].trim();
    setBookingLinkErrors((current) => ({ ...current, [providerId]: '' }));
    setSavingBookingLinkProvider(providerId);
    try {
      if (!(capabilities ?? DEFAULT_SETTINGS_CAPABILITIES).third_party_integrations) {
        const response = await fetch('/api/backend/user/settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ booking_method: 'app', booking_url: bookingUrl || null }),
        });
        const body = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !body.ok) {
          const message = body.error === 'plan_feature_locked' ? 'This feature requires Professional.' : body.error ?? 'booking_link_save_failed';
          setBookingLinkErrors((current) => ({ ...current, [providerId]: message }));
          showToast({
            type: 'error',
            message: formatSaveErrorMessage(message, bookingLinkSaveSuccessMessage(providerId)),
          });
          return;
        }
        showToast({ type: 'success', message: bookingLinkSaveSuccessMessage(providerId) });
        setEditingBookingLinkProvider(null);
        return;
      }
      const response = await fetch(`/api/backend/user/calendar/providers/${providerId}/connect`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookingUrl }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) {
        const message = body.error ?? 'booking_link_save_failed';
        setBookingLinkErrors((current) => ({ ...current, [providerId]: message }));
        showToast({
          type: 'error',
          message: formatSaveErrorMessage(message, bookingLinkSaveSuccessMessage(providerId)),
        });
        return;
      }
      showToast({ type: 'success', message: bookingLinkSaveSuccessMessage(providerId) });
      setEditingBookingLinkProvider(null);
      await loadCalendarProviders();
    } catch {
      setBookingLinkErrors((current) => ({ ...current, [providerId]: 'booking_link_save_failed' }));
      showToast({
        type: 'error',
        message: formatSaveErrorMessage('network_error', bookingLinkSaveSuccessMessage(providerId)),
      });
    } finally {
      setSavingBookingLinkProvider(null);
    }
  }

  async function saveVagaroBookingLink() {
    const bookingUrl = vagaroBookingUrl.trim();
    setVagaroBookingUrlError(null);
    setSavingVagaroBookingUrl(true);
    try {
      if (!(capabilities ?? DEFAULT_SETTINGS_CAPABILITIES).third_party_integrations) {
        const response = await fetch('/api/backend/user/settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ booking_method: 'app', booking_url: bookingUrl || null }),
        });
        const body = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !body.ok) {
          const message = body.error === 'plan_feature_locked' ? 'This feature requires Professional.' : body.error ?? 'vagaro_booking_link_save_failed';
          setVagaroBookingUrlError(message);
          showToast({
            type: 'error',
            message: formatSaveErrorMessage(message, bookingLinkSaveSuccessMessage('vagaro')),
          });
          return;
        }
        showToast({ type: 'success', message: bookingLinkSaveSuccessMessage('vagaro') });
        return;
      }
      const response = await fetch('/api/backend/user/calendar/providers/vagaro/booking-url', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookingUrl }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string; bookingUrl?: string };
      if (!response.ok || !body.ok) {
        const message = body.error ?? 'vagaro_booking_link_save_failed';
        setVagaroBookingUrlError(message);
        showToast({
          type: 'error',
          message: formatSaveErrorMessage(message, bookingLinkSaveSuccessMessage('vagaro')),
        });
        return;
      }
      if (body.bookingUrl) setVagaroBookingUrl(body.bookingUrl);
      showToast({ type: 'success', message: bookingLinkSaveSuccessMessage('vagaro') });
      await loadCalendarProviders();
    } catch {
      setVagaroBookingUrlError('vagaro_booking_link_save_failed');
      showToast({
        type: 'error',
        message: formatSaveErrorMessage('network_error', bookingLinkSaveSuccessMessage('vagaro')),
      });
    } finally {
      setSavingVagaroBookingUrl(false);
    }
  }

  useEffect(() => {
    if (squareProvider?.connected && !squareOptions) {
      void loadSquareOptions();
    }
  }, [squareProvider?.connected]);

  useEffect(() => {
    if (!shop) return;
    setWorkspace({
      shopName: shop.name,
      plan: shop.plan,
      active: shop.active,
    });
  }, [shop, setWorkspace]);

  const settingsReady = Boolean(shop && capabilities && form);
  const effectiveShop = shop ?? DEFAULT_SETTINGS_SHOP;
  const currentCapabilities = capabilities ?? DEFAULT_SETTINGS_CAPABILITIES;
  const currentForm = form ?? DEFAULT_SETTINGS_STATE;
  const ownerTransferUx = getOwnerTransferPlanUx(effectiveShop.plan, {
    edit_transfer_settings: currentCapabilities.edit_transfer_settings,
  });
  const callRecordingLocked = !currentCapabilities.configure_call_recording;
  const bilingualAnsweringUx = getBilingualAnsweringPlanUx(effectiveShop.plan);
  const returningCallerNotesUx = getReturningCallerNotesPlanUx(effectiveShop.plan);

  useEffect(() => {
    if (settingsReady && portal === 'knowledge') void loadWebsiteSuggestions();
  }, [settingsReady, portal, loadWebsiteSuggestions]);

  const websiteSuggestionCounts = useMemo(() => {
    return websiteSuggestions.reduce<Record<BusinessKnowledgeSuggestionType, number>>(
      (acc, item) => {
        acc[item.suggestionType] += 1;
        return acc;
      },
      { staff: 0, policy: 0, faq: 0, promotion: 0, booking_hint: 0 },
    );
  }, [websiteSuggestions]);

  const serviceChoices = useMemo(() => {
    const selected = new Map(currentForm.services.map((item) => [item.name, item]));
    return SERVICE_CATALOG.map((item) => ({
      ...item,
      selected: selected.has(item.name),
      current: selected.get(item.name) ?? item,
    })).concat(
      currentForm.services
        .filter((item) => !SERVICE_CATALOG.some((catalogItem) => catalogItem.name === item.name))
        .map((item) => ({
          key: item.name.toLowerCase().replace(/\s+/g, '-'),
          name: item.name,
          description: 'Imported from current business settings.',
          duration_min: item.duration_min,
          price: item.price,
          selected: true,
          current: item,
        })),
    );
  }, [currentForm.services]);

  const visibleTabs = useMemo(() => visibleTabsForPortal(portal), [portal]);

  useEffect(() => {
    const allowed = SETTINGS_PORTAL_TAB_ORDER[portal];
    if (!allowed.includes(activeTab)) {
      setActiveTab(allowed[0] ?? 'business');
    }
  }, [portal, activeTab]);

  useEffect(() => {
    if (!catalogDialogServiceId || !catalogDialogDraft) return;
    const el = catalogServiceDialogRef.current;
    if (el && !el.open) el.showModal();
  }, [catalogDialogServiceId, catalogDialogDraft]);

  useEffect(() => {
    if (legacyDialogIndex === null || !legacyDialogDraft) return;
    const el = legacyServiceDialogRef.current;
    if (el && !el.open) el.showModal();
  }, [legacyDialogIndex, legacyDialogDraft]);

  function patchState<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function applyHourPreset(presetId: string) {
    setHourPreset(presetId);
    if (presetId === 'custom') return;
    const preset = HOURS_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    patchState('hours', cloneHours(preset.hours));
  }

  function toggleService(template: ServiceItem) {
    patchState(
      'services',
      currentForm.services.some((item) => item.name === template.name)
        ? currentForm.services.filter((item) => item.name !== template.name)
        : [...currentForm.services, template],
    );
  }

  function updateService(name: string, patch: Partial<ServiceItem>) {
    patchState(
      'services',
      currentForm.services.map((item) => (item.name === name ? { ...item, ...patch } : item)),
    );
  }

  function addLegacyService() {
    const idx = currentForm.services.length;
    const draft: ServiceItem = { name: '', duration_min: 60, price: 0 };
    const next = [...currentForm.services, draft];
    patchState('services', next);
    if (portal === 'knowledge' && typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches) {
      setKnowledgeLegacyMobileError(null);
      setKnowledgeLegacyMobileSheet({ index: idx, draft });
      setEditingLegacyServiceIndex(null);
      return;
    }
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 861px)').matches) {
      setLegacyFormError(null);
      setLegacyDialogIndex(idx);
      setLegacyDialogDraft({ name: '', duration_min: 60, price: 0 });
    } else {
      setEditingLegacyServiceIndex(idx);
    }
  }

  function updateLegacyService(index: number, patch: Partial<ServiceItem>) {
    patchState(
      'services',
      currentForm.services.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function removeLegacyService(index: number) {
    if (editingLegacyServiceIndex === index) setEditingLegacyServiceIndex(null);
    if (knowledgeLegacyMobileSheet?.index === index) {
      setKnowledgeLegacyMobileSheet(null);
      setKnowledgeLegacyMobileError(null);
    }
    if (legacyDialogIndex === index) {
      setLegacyDialogIndex(null);
      setLegacyDialogDraft(null);
      setLegacyFormError(null);
      legacyServiceDialogRef.current?.close();
    }
    patchState('services', currentForm.services.filter((_, itemIndex) => itemIndex !== index));
  }

  function patchServiceCatalog(nextCatalog: ShopServiceCatalog) {
    patchState('service_catalog', nextCatalog);
    patchState('services', legacyServicesFromCatalog(nextCatalog));
  }

  function addServiceGroup(name = 'New service group') {
    const next = ensureEditableCatalog(currentForm.service_catalog, effectiveShop.id);
    patchServiceCatalog({
      ...next,
      categories: [
        ...next.categories,
        {
          id: clientId('service-category'),
          shopId: effectiveShop.id,
          name,
          description: null,
          sortOrder: next.categories.length,
          active: true,
        },
      ],
    });
  }

  function updateServiceGroup(categoryId: string, patch: Partial<ServiceCategory>) {
    patchServiceCatalog({
      ...currentForm.service_catalog,
      categories: currentForm.service_catalog.categories.map((category) =>
        category.id === categoryId ? { ...category, ...patch } : category,
      ),
    });
  }

  function addServiceToGroup(categoryId: string) {
    const groupCount = currentForm.service_catalog.services.filter((service) => service.categoryId === categoryId).length;
    const serviceId = clientId('service');
    const newService: ShopService = {
      id: serviceId,
      shopId: effectiveShop.id,
      categoryId,
      name: '',
      description: null,
      durationText: null,
      durationMinutes: null,
      priceAmount: 0,
      priceCurrency: 'USD',
      priceType: 'varies',
      bookable: true,
      active: true,
      sortOrder: groupCount,
      aliases: [],
      bookingNotes: null,
      variants: [],
    };
    patchServiceCatalog({
      ...currentForm.service_catalog,
      services: [...currentForm.service_catalog.services, newService],
    });
    if (isKnowledgeWideLayout()) {
      setEditingCatalogServiceId(null);
      setCatalogDialogError(null);
      setCatalogDialogDraft(JSON.parse(JSON.stringify(newService)) as ShopService);
      setCatalogDialogServiceId(serviceId);
    } else {
      if (portal === 'knowledge' && typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches) {
        setEditingCatalogServiceId(null);
        setKnowledgeCatalogMobileError(null);
        setKnowledgeCatalogMobileSheet({
          serviceId,
          draft: JSON.parse(JSON.stringify(newService)) as ShopService,
        });
      } else {
        setEditingCatalogServiceId(serviceId);
      }
    }
  }

  function updateCatalogService(serviceId: string, patch: Partial<ShopService>) {
    patchServiceCatalog({
      ...currentForm.service_catalog,
      services: currentForm.service_catalog.services.map((service) =>
        service.id === serviceId ? { ...service, ...patch } : service,
      ),
    });
  }

  function updateCatalogServiceVariant(serviceId: string, variantIndex: number, patch: Partial<ServiceVariant>) {
    const service = currentForm.service_catalog.services.find((item) => item.id === serviceId);
    if (!service) return;
    const variants = [...(service.variants ?? [])];
    variants[variantIndex] = { ...variants[variantIndex], ...patch } as ServiceVariant;
    updateCatalogService(serviceId, { variants });
  }

  function addCatalogServiceVariant(serviceId: string) {
    const service = currentForm.service_catalog.services.find((item) => item.id === serviceId);
    if (!service) return;
    updateCatalogService(serviceId, {
      variants: [
        ...(service.variants ?? []),
        { label: '', durationMinutes: null, durationText: '', priceAmount: null, priceCurrency: 'USD', priceType: 'from', sortOrder: service.variants?.length ?? 0, notes: null },
      ],
    });
  }

  function removeCatalogServiceVariant(serviceId: string, variantIndex: number) {
    const service = currentForm.service_catalog.services.find((item) => item.id === serviceId);
    if (!service) return;
    updateCatalogService(serviceId, { variants: (service.variants ?? []).filter((_, index) => index !== variantIndex) });
  }

  function removeCatalogService(serviceId: string) {
    if (editingCatalogServiceId === serviceId) setEditingCatalogServiceId(null);
    if (knowledgeCatalogMobileSheet?.serviceId === serviceId) {
      setKnowledgeCatalogMobileSheet(null);
      setKnowledgeCatalogMobileError(null);
    }
    if (catalogDialogServiceId === serviceId) {
      setCatalogDialogServiceId(null);
      setCatalogDialogDraft(null);
      setCatalogDialogError(null);
      catalogServiceDialogRef.current?.close();
    }
    patchServiceCatalog({
      ...currentForm.service_catalog,
      services: currentForm.service_catalog.services.filter((service) => service.id !== serviceId),
    });
  }

  function isKnowledgeWideLayout() {
    return typeof window !== 'undefined' && window.matchMedia('(min-width: 861px)').matches;
  }

  function closeCatalogServiceDialog() {
    catalogServiceDialogRef.current?.close();
  }

  function openCatalogServiceEditor(service: ShopService) {
    if (portal === 'knowledge' && !isKnowledgeWideLayout() && serviceCatalogEnabled) {
      setEditingCatalogServiceId(null);
      setKnowledgeCatalogMobileError(null);
      setKnowledgeCatalogMobileSheet({
        serviceId: service.id,
        draft: JSON.parse(JSON.stringify(service)) as ShopService,
      });
      return;
    }
    if (isKnowledgeWideLayout()) {
      setCatalogDialogError(null);
      setCatalogDialogDraft(JSON.parse(JSON.stringify(service)) as ShopService);
      setCatalogDialogServiceId(service.id);
    } else {
      setEditingCatalogServiceId((id) => (id === service.id ? null : service.id));
    }
  }

  function saveCatalogServiceDialog() {
    if (!catalogDialogServiceId || !catalogDialogDraft) return;
    if (!catalogDialogDraft.name.trim()) {
      setCatalogDialogError('Service name is required.');
      return;
    }
    setCatalogDialogError(null);
    const id = catalogDialogServiceId;
    const merged = { ...catalogDialogDraft, name: catalogDialogDraft.name.trim() } as ShopService;
    patchServiceCatalog({
      ...currentForm.service_catalog,
      services: currentForm.service_catalog.services.map((s) => (s.id === id ? merged : s)),
    });
    closeCatalogServiceDialog();
  }

  function patchKnowledgeCatalogMobileDraft(patch: Partial<ShopService>) {
    setKnowledgeCatalogMobileSheet((cur) => (cur ? { ...cur, draft: { ...cur.draft, ...patch } } : cur));
  }

  function patchKnowledgeMobileVariant(variantIndex: number, patch: Partial<ServiceVariant>) {
    setKnowledgeCatalogMobileSheet((cur) => {
      if (!cur) return cur;
      const variants = [...(cur.draft.variants ?? [])];
      variants[variantIndex] = { ...variants[variantIndex], ...patch } as ServiceVariant;
      return { ...cur, draft: { ...cur.draft, variants } };
    });
  }

  function addKnowledgeMobileVariantRow() {
    setKnowledgeCatalogMobileSheet((cur) => {
      if (!cur) return cur;
      const d = cur.draft;
      const next = [...(d.variants ?? [])];
      next.push({
        label: '',
        durationMinutes: null,
        durationText: '',
        priceAmount: null,
        priceCurrency: 'USD',
        priceType: 'from',
        sortOrder: next.length,
        notes: null,
      });
      return { ...cur, draft: { ...d, variants: next } };
    });
  }

  function removeKnowledgeMobileVariantRow(variantIndex: number) {
    setKnowledgeCatalogMobileSheet((cur) => {
      if (!cur) return cur;
      return {
        ...cur,
        draft: {
          ...cur.draft,
          variants: (cur.draft.variants ?? []).filter((_, i) => i !== variantIndex),
        },
      };
    });
  }

  function saveKnowledgeCatalogMobileSheet() {
    if (!knowledgeCatalogMobileSheet) return;
    const id = knowledgeCatalogMobileSheet.serviceId;
    const draft = knowledgeCatalogMobileSheet.draft;
    if (!draft.name.trim()) {
      setKnowledgeCatalogMobileError('Service name is required.');
      return;
    }
    setKnowledgeCatalogMobileError(null);
    const merged = { ...draft, name: draft.name.trim() } as ShopService;
    patchServiceCatalog({
      ...currentForm.service_catalog,
      services: currentForm.service_catalog.services.map((s) => (s.id === id ? merged : s)),
    });
    setKnowledgeCatalogMobileSheet(null);
  }

  function saveKnowledgeLegacyMobileSheet() {
    if (!knowledgeLegacyMobileSheet) return;
    const idx = knowledgeLegacyMobileSheet.index;
    const draft = knowledgeLegacyMobileSheet.draft;
    if (!draft.name.trim()) {
      setKnowledgeLegacyMobileError('Service name is required.');
      return;
    }
    setKnowledgeLegacyMobileError(null);
    patchState(
      'services',
      currentForm.services.map((s, i) => (i === idx ? { ...draft, name: draft.name.trim() } : s)),
    );
    setKnowledgeLegacyMobileSheet(null);
  }

  function confirmRemoveCatalogServiceFromDialog(serviceId: string, serviceLabel: string) {
    if (!window.confirm(`Remove ${serviceLabel}? This cannot be undone.`)) return;
    removeCatalogService(serviceId);
  }

  function archiveCatalogServiceFromDialog(serviceId: string) {
    updateCatalogService(serviceId, { active: false });
    closeCatalogServiceDialog();
  }

  function patchCatalogDialogDraft(patch: Partial<ShopService>) {
    setCatalogDialogDraft((d) => (d ? { ...d, ...patch } : d));
  }

  function patchCatalogDialogVariant(variantIndex: number, patch: Partial<ServiceVariant>) {
    setCatalogDialogDraft((d) => {
      if (!d) return d;
      const variants = [...(d.variants ?? [])];
      variants[variantIndex] = { ...variants[variantIndex], ...patch } as ServiceVariant;
      return { ...d, variants };
    });
  }

  function addCatalogDialogVariantRow() {
    setCatalogDialogDraft((d) => {
      if (!d) return d;
      const next = [...(d.variants ?? [])];
      next.push({
        label: '',
        durationMinutes: null,
        durationText: '',
        priceAmount: null,
        priceCurrency: 'USD',
        priceType: 'from',
        sortOrder: next.length,
        notes: null,
      });
      return { ...d, variants: next };
    });
  }

  function removeCatalogDialogVariantRow(variantIndex: number) {
    setCatalogDialogDraft((d) => {
      if (!d) return d;
      return { ...d, variants: (d.variants ?? []).filter((_, i) => i !== variantIndex) };
    });
  }

  function closeLegacyServiceDialog() {
    legacyServiceDialogRef.current?.close();
  }

  function openLegacyServiceEditor(index: number) {
    const service = currentForm.services[index];
    if (!service) return;
    if (portal === 'knowledge' && !isKnowledgeWideLayout()) {
      setEditingLegacyServiceIndex(null);
      setKnowledgeLegacyMobileError(null);
      setKnowledgeLegacyMobileSheet({ index, draft: { ...service } });
      return;
    }
    if (isKnowledgeWideLayout()) {
      setLegacyFormError(null);
      setLegacyDialogIndex(index);
      setLegacyDialogDraft({ ...service });
    } else {
      setEditingLegacyServiceIndex((i) => (i === index ? null : index));
    }
  }

  function saveLegacyServiceDialog() {
    if (legacyDialogIndex === null || !legacyDialogDraft) return;
    if (!legacyDialogDraft.name.trim()) {
      setLegacyFormError('Service name is required.');
      return;
    }
    setLegacyFormError(null);
    const idx = legacyDialogIndex;
    const next = { ...legacyDialogDraft, name: legacyDialogDraft.name.trim() };
    patchState(
      'services',
      currentForm.services.map((s, i) => (i === idx ? next : s)),
    );
    closeLegacyServiceDialog();
  }

  function formatServicePriceSummary(service: Pick<ShopService, 'priceType' | 'priceAmount'>) {
    if (service.priceType === 'consultation') return 'Consultation';
    if (service.priceType === 'varies') return 'Varies';
    const amount = Number(service.priceAmount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return service.priceType === 'from' ? 'Starts at' : 'Price TBD';
    const formatted = `$${Math.round(amount)}`;
    return service.priceType === 'from' ? `from ${formatted}` : formatted;
  }

  function formatVariantSummary(variant: ServiceVariant) {
    const duration = variant.durationText || (variant.durationMinutes ? `${variant.durationMinutes} min` : '');
    const price = variant.priceType === 'consultation'
      ? 'consultation'
      : variant.priceType === 'varies'
        ? 'varies'
        : variant.priceAmount !== null && variant.priceAmount !== undefined
          ? `${variant.priceType === 'from' ? 'starts at ' : ''}$${variant.priceAmount}`
          : '';
    return [duration || variant.label, price].filter(Boolean).join(' · ');
  }

  function renderCatalogServiceListMeta(service: ShopService): ReactNode {
    if (service.variants?.length) {
      return `${service.variants.length} options · ${service.variants.slice(0, 2).map(formatVariantSummary).join(' / ')}`;
    }
    const price = formatServicePriceSummary(service);
    const dur = serviceDurationText(service);
    return (
      <>
        {price}
        {dur ? (
          <> · {dur}</>
        ) : (
          <>
            {' '}
            <span className="service-duration-warn" role="img" aria-label="No duration set">
              ⚠
            </span>
          </>
        )}
      </>
    );
  }

  function renderServiceSummaryNameCell(name: string | null | undefined) {
    const trimmed = (name ?? '').trim();
    const untitled = trimmed.length === 0;
    const display = untitled ? 'Untitled service' : trimmed;
    return (
      <span className={`service-summary-name${untitled ? ' service-summary-name--untitled' : ''}`}>
        <span className="service-summary-name-inner">
          <span className="service-summary-name-text">{display}</span>
        </span>
      </span>
    );
  }

  function renderEditIcon() {
    return (
      <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    );
  }

  function updateStaff(index: number, patch: Partial<StaffMember>) {
    patchState(
      'staff',
      currentForm.staff.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function updateFaq(index: number, patch: Partial<BusinessFaqItem>) {
    patchState(
      'faqs',
      currentForm.faqs.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function toggleLanguage(language: string, checked: boolean) {
    const next = new Set(normalizeUserLanguages(currentForm.languages));
    if (checked) next.add(language);
    else if (language !== 'en') next.delete(language);
    patchState('languages', normalizeUserLanguages(Array.from(next)));
  }

  function updateHours(day: (typeof DAY_ORDER)[number], next: BusinessHoursEntry) {
    patchState('hours', { ...currentForm.hours, [day]: next });
    setHourPreset('custom');
  }

  async function commitSettingsPatch(sectionId: string, patch: Record<string, unknown>) {
    if (!settingsReady) {
      showToast({
        type: 'error',
        message: formatSaveErrorMessage('settings_still_loading', settingsSaveSuccessMessage(sectionId)),
      });
      return;
    }
    setSavingSection(sectionId);
    setStatus(null);
    try {
      const response = await fetch('/api/backend/user/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const body = (await response.json()) as UserSettingsResponse;
      if (!response.ok || !body.ok || !body.shop || !body.capabilities) {
        if (body.error === 'plan_feature_locked' && body.fields?.length) {
          const upgradeMsg = `Upgrade required for: ${body.fields.join(', ')}`;
          showToast({ type: 'error', message: upgradeMsg });
          return;
        }
        showToast({
          type: 'error',
          message: formatSaveErrorMessage(body.error ?? 'save_failed', settingsSaveSuccessMessage(sectionId)),
        });
        return;
      }
      const nextShop = body.shop;
      setShop(nextShop);
      setCapabilities(body.capabilities);
      setCapabilityMinPlans(body.capabilityMinPlans ?? {});
      setServiceCatalogEnabled(body.serviceCatalogEnabled === true);
      const nextState = buildInitialState(nextShop);
      setForm(nextState);
      setHandoffPhoneDraft(nextShop.handoff_phone ?? '');
      setHandoffAvailabilityDraft((nextShop.handoff_availability ?? 'business_hours') as 'business_hours' | 'always' | 'custom');
      setHandoffCustomHoursDraft(cloneHours((nextShop.handoff_custom_hours as Record<string, BusinessHoursEntry> | null | undefined) ?? {}));
      if (body.warnings?.length) setHandoffPhoneWarnings(body.warnings);
      setCancelPreset(getPresetMatch(nextState.cancel_policy, CANCEL_POLICY_PRESETS));
      setPromoPreset(getPresetMatch(nextState.promotions, PROMOTION_PRESETS));
      setGreetingPreset(
        getPresetMatch(
          nextState.ai_welcome_message,
          AI_GREETING_PRESETS.map((item) => normalizeGreeting(item, nextShop.name)),
        ),
      );
      setHourPreset(getHourPresetId(nextState.hours));
      showToast({ type: 'success', message: settingsSaveSuccessMessage(sectionId) });
    } catch {
      showToast({
        type: 'error',
        message: formatSaveErrorMessage('network_error', settingsSaveSuccessMessage(sectionId)),
      });
    } finally {
      setSavingSection(null);
    }
  }

  async function saveTransferSettings() {
    setHandoffPhoneStatus('saving');
    setHandoffPhoneWarnings([]);
    try {
      const payload: Record<string, unknown> = {
        handoff_phone: handoffPhoneDraft.trim() || null,
        handoff_availability: handoffAvailabilityDraft,
        handoff_custom_hours: handoffAvailabilityDraft === 'custom' ? handoffCustomHoursDraft : null,
      };
      const response = await fetch('/api/backend/user/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as UserSettingsResponse;
      if (!response.ok || !body.ok || !body.shop) {
        const err = body.error ?? 'save_failed';
        setHandoffPhoneStatus(err);
        showToast({
          type: 'error',
          message: formatSaveErrorMessage(err, 'Call transfer settings'),
        });
        return;
      }
      setShop(body.shop);
      setHandoffPhoneDraft(body.shop.handoff_phone ?? '');
      setHandoffAvailabilityDraft((body.shop.handoff_availability ?? 'business_hours') as 'business_hours' | 'always' | 'custom');
      setHandoffCustomHoursDraft(cloneHours((body.shop.handoff_custom_hours as Record<string, BusinessHoursEntry> | null | undefined) ?? {}));
      setHandoffPhoneWarnings(body.warnings ?? []);
      setHandoffPhoneStatus('idle');
      showToast({ type: 'success', message: settingsSaveSuccessMessage('call-transfer') });
    } catch {
      setHandoffPhoneStatus('network_error');
      showToast({
        type: 'error',
        message: formatSaveErrorMessage('network_error', 'Call transfer settings'),
      });
    }
  }

  function suggestionPayload(suggestion: BusinessKnowledgeSuggestion): Record<string, unknown> {
    return suggestionEdits[suggestion.id] ?? suggestion.payload;
  }

  function updateSuggestionPayload(id: string, patch: Record<string, unknown>) {
    setSuggestionEdits((current) => ({
      ...current,
      [id]: { ...(current[id] ?? websiteSuggestions.find((item) => item.id === id)?.payload ?? {}), ...patch },
    }));
  }

  function toggleSuggestionSelected(id: string, checked: boolean) {
    setSelectedSuggestionIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  }

  async function applySelectedSuggestions() {
    if (selectedSuggestionIds.length === 0) {
      setSuggestionStatus('Choose at least one suggestion to apply.');
      return;
    }
    setSavingSuggestions(true);
    setSuggestionStatus(null);
    try {
      const editedPayloads = Object.fromEntries(selectedSuggestionIds.map((id) => [id, suggestionEdits[id]]).filter(([, payload]) => payload));
      const response = await fetch('/api/backend/user/business-knowledge/suggestions/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ suggestionIds: selectedSuggestionIds, editedPayloads }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !body?.ok) {
        showToast({
          type: 'error',
          message: formatSaveErrorMessage(body?.error ?? 'suggestion_apply_failed', 'Website suggestions'),
        });
        return;
      }
      showToast({ type: 'success', message: 'Website suggestions applied' });
      await loadWebsiteSuggestions();
    } catch {
      showToast({
        type: 'error',
        message: formatSaveErrorMessage('suggestion_apply_network_error', 'Website suggestions'),
      });
    } finally {
      setSavingSuggestions(false);
    }
  }

  async function dismissSelectedSuggestions() {
    if (selectedSuggestionIds.length === 0) {
      setSuggestionStatus('Choose at least one suggestion to dismiss.');
      return;
    }
    setSavingSuggestions(true);
    setSuggestionStatus(null);
    try {
      const response = await fetch('/api/backend/user/business-knowledge/suggestions/dismiss', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ suggestionIds: selectedSuggestionIds }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !body?.ok) {
        showToast({
          type: 'error',
          message: formatSaveErrorMessage(body?.error ?? 'suggestion_dismiss_failed', 'Website suggestions'),
        });
        return;
      }
      showToast({ type: 'success', message: 'Suggestions dismissed' });
      await loadWebsiteSuggestions();
    } catch {
      showToast({
        type: 'error',
        message: formatSaveErrorMessage('suggestion_dismiss_network_error', 'Website suggestions'),
      });
    } finally {
      setSavingSuggestions(false);
    }
  }

  function renderSuggestionEditor(suggestion: BusinessKnowledgeSuggestion) {
    const payload = suggestionPayload(suggestion);
    const inputStyle = { marginTop: 8 } as const;
    if (suggestion.suggestionType === 'staff') {
      return (
        <div className="grid grid-2" style={{ marginTop: 10 }}>
          <label className="field-label">
            Name
            <input style={inputStyle} value={String(payload.name ?? '')} onChange={(event) => updateSuggestionPayload(suggestion.id, { name: event.target.value })} />
          </label>
          <label className="field-label">
            Role
            <input style={inputStyle} value={String(payload.role ?? '')} onChange={(event) => updateSuggestionPayload(suggestion.id, { role: event.target.value })} />
          </label>
          <label className="field-label grid-span-2">
            Notes
            <textarea style={inputStyle} rows={2} value={String(payload.notes ?? '')} onChange={(event) => updateSuggestionPayload(suggestion.id, { notes: event.target.value })} />
          </label>
        </div>
      );
    }
    if (suggestion.suggestionType === 'policy') {
      return (
        <div className="grid grid-2" style={{ marginTop: 10 }}>
          <label className="field-label">
            Title
            <input style={inputStyle} value={String(payload.title ?? '')} onChange={(event) => updateSuggestionPayload(suggestion.id, { title: event.target.value })} />
          </label>
          <label className="field-label">
            Type
            <select style={inputStyle} value={String(payload.type ?? 'other')} onChange={(event) => updateSuggestionPayload(suggestion.id, { type: event.target.value })}>
              <option value="cancellation">Cancellation</option>
              <option value="no_show">No-show</option>
              <option value="deposit">Deposit</option>
              <option value="late_arrival">Late arrival</option>
              <option value="walk_ins">Walk-ins</option>
              <option value="refund">Refund</option>
              <option value="appointment_prep">Appointment prep</option>
              <option value="consultation">Consultation</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="field-label grid-span-2">
            Content
            <textarea style={inputStyle} rows={3} value={String(payload.content ?? '')} onChange={(event) => updateSuggestionPayload(suggestion.id, { content: event.target.value })} />
          </label>
        </div>
      );
    }
    if (suggestion.suggestionType === 'faq') {
      return (
        <div className="grid grid-2" style={{ marginTop: 10 }}>
          <label className="field-label">
            Question
            <input style={inputStyle} value={String(payload.question ?? '')} onChange={(event) => updateSuggestionPayload(suggestion.id, { question: event.target.value })} />
          </label>
          <label className="field-label">
            Answer
            <textarea style={inputStyle} rows={2} value={String(payload.answer ?? '')} onChange={(event) => updateSuggestionPayload(suggestion.id, { answer: event.target.value })} />
          </label>
        </div>
      );
    }
    if (suggestion.suggestionType === 'promotion') {
      return (
        <div className="grid grid-2" style={{ marginTop: 10 }}>
          <label className="field-label">
            Title
            <input style={inputStyle} value={String(payload.title ?? '')} onChange={(event) => updateSuggestionPayload(suggestion.id, { title: event.target.value })} />
          </label>
          <label className="field-label">
            Description
            <textarea style={inputStyle} rows={2} value={String(payload.description ?? '')} onChange={(event) => updateSuggestionPayload(suggestion.id, { description: event.target.value })} />
          </label>
        </div>
      );
    }
    return (
      <div className="grid grid-2" style={{ marginTop: 10 }}>
        <label className="field-label">
          Label
          <input style={inputStyle} value={String(payload.label ?? '')} onChange={(event) => updateSuggestionPayload(suggestion.id, { label: event.target.value })} />
        </label>
        <label className="field-label">
          Value
          <input style={inputStyle} value={String(payload.value ?? '')} onChange={(event) => updateSuggestionPayload(suggestion.id, { value: event.target.value })} />
        </label>
      </div>
    );
  }

  function isLocked(capability: keyof ShopCapabilities) {
    return !currentCapabilities[capability];
  }

  function renderLockCopy(capability: keyof ShopCapabilities) {
    if (!isLocked(capability)) return null;
    const requiredPlan = capabilityMinPlans[capability];
    if (!requiredPlan) return null;
    const label =
      requiredPlan === 'enterprise'
        ? 'Available on Enterprise'
        : requiredPlan === 'professional'
          ? 'Available on Professional'
          : `Available on ${requiredPlan[0].toUpperCase()}${requiredPlan.slice(1)}`;
    return <span className="tag orange knowledge-plan-lock-badge">{label}</span>;
  }

  const pageContentClass = useMemo(() => {
    if (portal === 'integrations') return 'page-integrations';
    if (portal === 'ai-settings') return 'page-ai-behavior';
    if (portal === 'knowledge') return 'page-knowledge';
    return knowledgePortalTabPageClass(activeTab);
  }, [portal, activeTab]);

  return (
    <UserLayout styles={userSettingsStyles} scripts={userSettingsScripts} scriptPrefix="user-settings-live">
      <>
      <div className="app-shell user-app-shell">
        <UserPortalSidebar active={sidebarNav} />

        <main className={`main${portal === 'knowledge' ? ' knowledge-portal-main' : ''}${portal === 'integrations' ? ' integrations-portal-main' : ''}`}>
          <UserPortalTopbar
            title={portalHead.title}
            subtitle={portalHead.subtitle}
            actionsClassName={USER_PORTAL_TOPBAR_ACTIONS_CLASS}
            actions={<UserPortalStandardTopActions />}
          />

          <UserPortalPageContent pageClass={pageContentClass}>
          {!settingsReady && status ? (
            <div className="note" style={{ marginBottom: 18 }}>
              Unable to load settings: {status}
            </div>
          ) : null}

          {portal !== 'integrations' ? (
            portal === 'knowledge' ? (
              <div className="knowledge-portal-tab-bar">
                <div className="business-subtabs calls-filter-tabs" role="tablist" aria-label="Business Knowledge tabs">
                  {visibleTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      title={tab.description}
                      className={`business-subtab${activeTab === tab.id ? ' active' : ''}`}
                      onClick={() => activateSettingsTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="tab-strip" role="tablist" aria-label="AI Settings tabs">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    title={tab.description}
                    className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => activateSettingsTab(tab.id)}
                  >
                    <span className="tab-button-icon">
                      <SettingsTabIcon tabId={tab.id} />
                    </span>
                    <span className="tab-button-body">
                      <strong>{tab.label}</strong>
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : null}

          {portal === 'knowledge' && websiteSuggestions.length > 0 ? (
            <section className="card" style={{ marginBottom: 18 }}>
              <div className="panel-head">
                <div>
                  <h3>Website suggestions</h3>
                  <p className="sub">We found details from your website that can help RingBooker answer callers more accurately.</p>
                </div>
                <div className="actions-row">
                  <button type="button" className="btn" onClick={() => void dismissSelectedSuggestions()} disabled={savingSuggestions || selectedSuggestionIds.length === 0}>
                    Dismiss
                  </button>
                  <button type="button" className="btn user-save" onClick={() => void applySelectedSuggestions()} disabled={savingSuggestions || selectedSuggestionIds.length === 0}>
                    Apply selected
                  </button>
                </div>
              </div>
              <div className="grid grid-5" style={{ marginTop: 12 }}>
                {[
                  ['Staff found', websiteSuggestionCounts.staff],
                  ['Policies found', websiteSuggestionCounts.policy],
                  ['FAQs found', websiteSuggestionCounts.faq],
                  ['Promotions found', websiteSuggestionCounts.promotion],
                  ['Booking hints found', websiteSuggestionCounts.booking_hint],
                ].map(([label, count]) => (
                  <div className="metric-card" key={String(label)}>
                    <strong>{count}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              {suggestionStatus ? <p className="sub" style={{ marginTop: 12 }}>{suggestionStatus}</p> : null}
              <div className="section-stack" style={{ marginTop: 14 }}>
                {websiteSuggestions.map((suggestion) => (
                  <div className="option-card" key={suggestion.id}>
                    <div className="hint-row">
                      <label className="checkbox-line" style={{ margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={selectedSuggestionIds.includes(suggestion.id)}
                          onChange={(event) => toggleSuggestionSelected(suggestion.id, event.target.checked)}
                        />
                        <strong className="option-title">{suggestion.suggestionType.replace('_', ' ')}</strong>
                      </label>
                      <span className="pill">{suggestion.source}</span>
                      <span className="pill">{Math.round(suggestion.confidence * 100)}%</span>
                    </div>
                    {suggestion.evidenceSnippet ? <p className="sub" style={{ marginTop: 8 }}>{suggestion.evidenceSnippet}</p> : null}
                    {renderSuggestionEditor(suggestion)}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="section-stack">
            {activeTab === 'integrations' ? (
            <section className="card integrations-main-frame">
              <IntegrationsRedesign
                canUseThirdPartyIntegrations={currentCapabilities.third_party_integrations}
                initialBookingMethod={effectiveShop.booking_method ?? null}
                initialBookingUrl={effectiveShop.booking_url ?? null}
              />
            </section>
            ) : null}

            {activeTab === 'business' ? (
            <section className="card">
              {portal === 'knowledge' ? (
              <form
                className="card-section-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitSettingsPatch('business-knowledge-info', {
                    name: currentForm.name,
                    ...(currentForm.vertical ? { vertical: currentForm.vertical } : {}),
                    vertical_detail: currentForm.vertical_detail.trim() ? currentForm.vertical_detail.trim() : null,
                    phone_number: currentForm.phone_number,
                    user_name: currentForm.user_name,
                    ...(currentForm.user_phone.trim() ? { user_phone: currentForm.user_phone } : {}),
                    handoff_phone: currentForm.handoff_phone || null,
                    address: currentForm.address || null,
	                    timezone: currentForm.timezone,
	                    website_url: currentForm.website_url.trim() ? currentForm.website_url.trim() : '',
	                  });
	                }}
	              >
	                <div className="card-section settings-tab-content-frame">
	                  <div className="panel-head knowledge-tab-panel-head">
	                    <div>
	                      <h3>Business profile</h3>
	                      <p className="sub">Core details RingBooker can use when callers ask who you are, where you are, or how to reach the team.</p>
	                    </div>
	                  </div>
	                  <div className="form-grid settings-tab-content-frame" style={{ marginTop: 14 }}>
	                    <div className="field"><label>Business name</label><input value={currentForm.name} onChange={(event) => patchState('name', event.target.value)} /></div>
	                    <div className="field"><label>Primary contact name</label><input value={currentForm.user_name} onChange={(event) => patchState('user_name', event.target.value)} placeholder="Owner or manager name" /></div>
	                    <div className="field">
                      <label>Primary business type</label>
                      <select value={currentForm.vertical} onChange={(event) => patchState('vertical', event.target.value)}>
                        <option value="">Select business type</option>
                        {BUSINESS_TYPE_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Additional services</label>
                      <input value={currentForm.vertical_detail} onChange={(event) => patchState('vertical_detail', event.target.value)} placeholder="also offers spa services" />
                    </div>
	                    <div className="field"><label>Business Phone Number</label><input value={currentForm.phone_number} onChange={(event) => patchState('phone_number', event.target.value)} /></div>
	                    <div className="field"><label>Owner Phone (optional)</label><input value={currentForm.user_phone} onChange={(event) => patchState('user_phone', event.target.value)} placeholder="Owner or manager phone" /></div>
	                    <div className="field"><label>Handoff phone</label><input value={currentForm.handoff_phone} onChange={(event) => patchState('handoff_phone', event.target.value)} placeholder="Optional handoff line" /></div>
	                    <div className="field"><label>Timezone</label><select value={currentForm.timezone} onChange={(event) => patchState('timezone', event.target.value)}><option value="America/Los_Angeles">America/Los_Angeles</option><option value="America/New_York">America/New_York</option><option value="America/Chicago">America/Chicago</option><option value="America/Denver">America/Denver</option></select></div>
	                    <div className="field">
                      <label>Address</label>
                      {portal === 'knowledge' && knowledgeMobile ? (
                        <button
                          type="button"
                          className={`knowledge-address-sheet-trigger${!currentForm.address.trim() ? ' knowledge-address-sheet-trigger--placeholder' : ''}`}
                          onClick={() => {
                            setKnowledgeAddressDraft(currentForm.address);
                            setKnowledgeAddressSheetOpen(true);
                          }}
                        >
                          {currentForm.address.trim() || 'Tap to edit address'}
                        </button>
                      ) : (
                        <input value={currentForm.address} onChange={(event) => patchState('address', event.target.value)} />
                      )}
                    </div>
	                    <div className="field"><label>Website</label><input value={currentForm.website_url} onChange={(event) => patchState('website_url', event.target.value)} placeholder="https://..." /></div>
	                  </div>
	                </div>
                <div className="settings-save-footer settings-tab-content-frame">
                  <button type="submit" className="btn user-save" disabled={savingSection !== null}>
                    {savingSection === 'business-knowledge-info' ? 'Saving...' : 'Save business profile'}
                  </button>
                </div>
              </form>
              ) : (
              <form
                className="card-section-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitSettingsPatch('business-profile', {
                    name: currentForm.name,
                    ...(currentForm.vertical ? { vertical: currentForm.vertical } : {}),
                    vertical_detail: currentForm.vertical_detail.trim() ? currentForm.vertical_detail.trim() : null,
                    phone_number: currentForm.phone_number,
                    user_name: currentForm.user_name,
                    ...(currentForm.user_phone.trim() ? { user_phone: currentForm.user_phone } : {}),
                    handoff_phone: currentForm.handoff_phone || null,
                    address: currentForm.address || null,
                    timezone: currentForm.timezone,
                    booking_url: currentForm.booking_url.trim() ? currentForm.booking_url.trim() : null,
                  });
                }}
              >
                <div className="settings-business-profile-layout settings-tab-content-frame">
                  <div className="form-grid settings-business-profile-form">
                    <div className="field"><label>Business name</label><input value={currentForm.name} onChange={(event) => patchState('name', event.target.value)} /></div>
                    <div className="field"><label>Primary contact name</label><input value={currentForm.user_name} onChange={(event) => patchState('user_name', event.target.value)} placeholder="Owner or manager name" /></div>
                    <div className="field">
                      <label>Primary business type</label>
                      <select value={currentForm.vertical} onChange={(event) => patchState('vertical', event.target.value)}>
                        <option value="">Select business type</option>
                        {BUSINESS_TYPE_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Additional services</label>
                      <input value={currentForm.vertical_detail} onChange={(event) => patchState('vertical_detail', event.target.value)} placeholder="also offers spa services" />
                    </div>
                    <div className="field"><label>Business Phone Number</label><input value={currentForm.phone_number} onChange={(event) => patchState('phone_number', event.target.value)} /></div>
                    <div className="field"><label>Owner Phone (optional)</label><input value={currentForm.user_phone} onChange={(event) => patchState('user_phone', event.target.value)} placeholder="Owner or manager phone" /></div>
                    <div className="field"><label>Handoff phone</label><input value={currentForm.handoff_phone} onChange={(event) => patchState('handoff_phone', event.target.value)} placeholder="Optional handoff line" /></div>
                    <div className="field"><label>Timezone</label><select value={currentForm.timezone} onChange={(event) => patchState('timezone', event.target.value)}><option value="America/Los_Angeles">America/Los_Angeles</option><option value="America/New_York">America/New_York</option><option value="America/Chicago">America/Chicago</option><option value="America/Denver">America/Denver</option></select></div>
                    <div className="field" style={{ gridColumn: '1 / -1' }}><label>Address</label><input value={currentForm.address} onChange={(event) => patchState('address', event.target.value)} /></div>
                    <div className="field" style={{ gridColumn: '1 / -1' }}><label>Booking link</label><input value={currentForm.booking_url} onChange={(event) => patchState('booking_url', event.target.value)} placeholder="https://..." /></div>
                  </div>
                  <aside className="settings-business-profile-helper" aria-label="Business profile helper panels">
                    <section className="settings-helper-card">
                      <h4>AI uses this to answer</h4>
                      <ul className="settings-helper-list">
                        <li>What's your address?</li>
                        <li>What's your phone number?</li>
                        <li>What's your website?</li>
                        <li>Call greeting &amp; business identity</li>
                      </ul>
                    </section>
                    <section className="settings-helper-card">
                      <h4>Knowledge completeness</h4>
                      <p className="settings-helper-progress-label">Overall 60%</p>
                      <div className="settings-helper-progress-track" aria-hidden>
                        <span className="settings-helper-progress-fill" style={{ width: '60%' }} />
                      </div>
                      <div className="settings-helper-checklist">
                        <div className="done"><span>Business profile</span><span>Done</span></div>
                        <div className="done"><span>Hours</span><span>Done</span></div>
                        <div className="done"><span>Services</span><span>Done</span></div>
                        <div className="warn"><span>Staff</span><span>Add staff</span></div>
                        <div className="warn"><span>Policies &amp; FAQ</span><span>Add policies</span></div>
                        <div className="done"><span>AI behavior</span><span>Done</span></div>
                      </div>
                    </section>
                  </aside>
                </div>
                <div className="settings-save-footer settings-tab-content-frame">
                  <button type="submit" className="btn user-save" disabled={savingSection !== null}>
                    {savingSection === 'business-profile' ? 'Saving...' : 'Save business profile'}
                  </button>
                </div>
              </form>
              )}
            </section>
            ) : null}

            {activeTab === 'services-hours' ? (
            <section className="card">
              <form
                className="card-section-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitSettingsPatch(
                    'services',
                    serviceCatalogEnabled
                      ? {
                          service_catalog: currentForm.service_catalog,
                        }
                      : {
                          services: currentForm.services
                            .filter((service) => service.name.trim().length > 0)
                            .map((service) => ({
                              name: service.name.trim(),
                              duration_min: Number.isFinite(service.duration_min) && service.duration_min > 0 ? service.duration_min : 60,
                              price: Number.isFinite(service.price) && service.price > 0 ? service.price : 0,
                            })),
                        },
                  );
                }}
              >
                <div className="card-section settings-tab-content-frame">
                  {!serviceCatalogEnabled ? (
                    <>
	                      <div className="panel-head knowledge-tab-panel-head service-catalog-heading">
	                        <div>
	                          <h3>Services</h3>
	                          <p className="sub">
	                            Add the services callers ask about most. Grouped service editing will appear after service catalog migration is enabled.
	                          </p>
	                        </div>
                        <button type="button" className="btn" onClick={addLegacyService}>
                          Add service
                        </button>
                      </div>
                      {currentForm.services.length === 0 ? (
                        <div className="sh-empty service-catalog-empty">
                          Add the services customers usually ask about on the phone, like Gel Manicure, Deluxe Pedicure, Balayage, or Botox Consultation.
                        </div>
                      ) : null}
	                      <div className="service-group-list">
	                        {currentForm.services.map((service, index) => (
	                          <div key={`${service.name || 'service'}-${index}`} className="service-summary-item">
	                            <div
	                              className="service-summary-row service-summary-row--clickable"
	                              role="button"
	                              tabIndex={0}
	                              onKeyDown={(event) => {
	                                if (event.key === 'Enter' || event.key === ' ') {
	                                  event.preventDefault();
	                                  openLegacyServiceEditor(index);
	                                }
	                              }}
	                              onClick={() => openLegacyServiceEditor(index)}
	                            >
	                              {renderServiceSummaryNameCell(service.name)}
	                              <span className="service-summary-meta">${Math.round(Number(service.price) || 0)} · {service.duration_min || 60} min</span>
	                              <button
	                                type="button"
	                                className="service-edit-icon"
	                                aria-label={`Edit ${service.name || 'service'}`}
	                                onClick={(event) => {
	                                  event.stopPropagation();
	                                  openLegacyServiceEditor(index);
	                                }}
	                              >
	                                {renderEditIcon()}
	                              </button>
	                            </div>
	                            {editingLegacyServiceIndex === index && portal !== 'knowledge' ? (
	                              <div className="service-inline-editor service-inline-editor--legacy-mobile">
	                                <div className="service-item-head">
	                                  <div className="field">
	                                    <label>service name</label>
	                                    <input value={service.name} onChange={(event) => updateLegacyService(index, { name: event.target.value })} placeholder="Gel Manicure" />
	                                    <p className="service-name-edit-hint">Shorten so callers can understand</p>
	                                  </div>
	                                  <div className="field">
	                                    <label>duration</label>
	                                    <input
	                                      type="number"
	                                      min={1}
	                                      value={service.duration_min || ''}
	                                      onChange={(event) => updateLegacyService(index, { duration_min: event.target.value === '' ? 0 : Number(event.target.value) })}
	                                      placeholder="60"
	                                    />
	                                  </div>
	                                  <div className="field">
	                                    <label>price</label>
	                                    <input type="number" min={0} value={service.price} onChange={(event) => updateLegacyService(index, { price: Number(event.target.value) })} />
	                                  </div>
	                                </div>
	                                <div className="service-item-footer">
	                                  <button type="button" className="subtle-link" onClick={() => removeLegacyService(index)}>
	                                    Remove service
	                                  </button>
	                                  <button type="button" className="btn" onClick={() => setEditingLegacyServiceIndex(null)}>
	                                    Done
	                                  </button>
	                                </div>
	                              </div>
	                            ) : null}
	                          </div>
	                        ))}
	                      </div>
                      <dialog
                        ref={legacyServiceDialogRef}
                        className="catalog-service-dialog catalog-service-dialog--legacy"
                        onClose={() => {
                          setLegacyDialogIndex(null);
                          setLegacyDialogDraft(null);
                          setLegacyFormError(null);
                        }}
                      >
                        <div className="catalog-service-dialog-panel">
                          <header className="catalog-service-dialog-header">
                            <div className="catalog-service-dialog-header-main">
                              <span className="catalog-service-dialog-header-name">
                                {legacyDialogDraft?.name?.trim() ? legacyDialogDraft.name.trim() : 'Untitled service'}
                              </span>
                              {legacyDialogDraft ? (
                                <span className="catalog-service-dialog-header-meta">
                                  ${Math.round(Number(legacyDialogDraft.price) || 0)} · {legacyDialogDraft.duration_min || 60} min
                                </span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="catalog-service-dialog-close"
                              aria-label="Close"
                              onClick={() => legacyServiceDialogRef.current?.close()}
                            >
                              ✕
                            </button>
                          </header>
                          <div className="catalog-service-dialog-body">
                            {legacyDialogDraft ? (
                              <div className="catalog-service-dialog-grid">
                                <div className="catalog-service-dialog-row2">
                                  <div className="field">
                                    <label>service name</label>
                                    <input
                                      value={legacyDialogDraft.name}
                                      onChange={(event) => setLegacyDialogDraft({ ...legacyDialogDraft, name: event.target.value })}
                                      placeholder="Gel Manicure"
                                    />
                                    <p className="service-name-edit-hint">Shorten so callers can understand</p>
                                  </div>
                                </div>
                                <div className="catalog-service-dialog-row3">
                                  <div className="field">
                                    <label>duration</label>
                                    <input
                                      type="number"
                                      min={1}
                                      value={legacyDialogDraft.duration_min || ''}
                                      onChange={(event) =>
                                        setLegacyDialogDraft({
                                          ...legacyDialogDraft,
                                          duration_min: event.target.value === '' ? 0 : Number(event.target.value),
                                        })
                                      }
                                      placeholder="60"
                                    />
                                  </div>
                                  <div className="field">
                                    <label>price</label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={legacyDialogDraft.price}
                                      onChange={(event) => setLegacyDialogDraft({ ...legacyDialogDraft, price: Number(event.target.value) })}
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            {legacyFormError ? <p className="catalog-service-dialog-error">{legacyFormError}</p> : null}
                          </div>
                          <footer className="catalog-service-dialog-footer">
                            <div className="catalog-service-dialog-footer-spacer" />
                            <button
                              type="button"
                              className="subtle-link catalog-service-dialog-link-remove"
                              onClick={() => {
                                if (legacyDialogIndex === null || !legacyDialogDraft) return;
                                const label = legacyDialogDraft.name.trim() || 'this service';
                                if (!window.confirm(`Remove ${label}? This cannot be undone.`)) return;
                                removeLegacyService(legacyDialogIndex);
                              }}
                            >
                              Remove
                            </button>
                            <button type="button" className="btn catalog-service-dialog-btn-cancel" onClick={() => legacyServiceDialogRef.current?.close()}>
                              Cancel <span className="catalog-service-dialog-esc-hint">ESC</span>
                            </button>
                            <button type="button" className="btn user-save" onClick={() => void saveLegacyServiceDialog()}>
                              Save changes
                            </button>
                          </footer>
                        </div>
                      </dialog>
                    </>
                  ) : (
                    <>
                    {(() => {
                      const editableCatalog = ensureEditableCatalog(currentForm.service_catalog, effectiveShop.id);
                      const activeServiceCount = editableCatalog.services.filter((service) => service.active !== false && service.name.trim()).length;
                      return (
	                  <div className="panel-head knowledge-tab-panel-head service-catalog-heading">
	                    <div>
	                      <h3>Services</h3>
	                      <p className="sub">
	                        {editableCatalog.categories.length} groups · {activeServiceCount} services
	                      </p>
	                    </div>
                    <div className="service-catalog-actions">
                      <button type="button" className="btn" onClick={() => setCatalogGroupSheet({ mode: 'add' })}>
                        <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden>
                          <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2h7.5A2.5 2.5 0 0 1 21 8.5v1" />
                          <path d="M12 16h8" />
                          <path d="M16 12v8" />
                          <path d="M3 9h10" />
                          <path d="M3 9v8.5A2.5 2.5 0 0 0 5.5 20H12" />
                        </svg>
                        Add group
                      </button>
                    </div>
                  </div>
                      );
                    })()}

                  {currentForm.service_catalog.services.length === 0 ? (
                    <div className="sh-empty service-catalog-empty">
                      Add the services customers usually ask about on the phone, like Gel Manicure, Deluxe Pedicure, Balayage, or Botox Consultation.
                    </div>
                  ) : null}

                  <div className="service-group-list">
                    {ensureEditableCatalog(currentForm.service_catalog, effectiveShop.id).categories
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((category) => {
                        const groupServices = currentForm.service_catalog.services
                          .filter((service) => service.categoryId === category.id)
                          .sort((a, b) => a.sortOrder - b.sortOrder);
                        return (
	                          <details key={category.id} className="service-group-card service-group-card--compact">
	                            <summary>
	                              <div className="service-group-summary-inner">
	                                <span className="service-group-title-with-rename">
	                                  <strong>{category.name || 'Service group'}</strong>
	                                  <button
	                                    type="button"
	                                    className="service-group-rename-btn"
	                                    aria-label={`Rename group ${category.name || 'Service group'}`}
	                                    onClick={(event) => {
	                                      event.preventDefault();
	                                      event.stopPropagation();
	                                      setCatalogGroupSheet({
	                                        mode: 'rename',
	                                        categoryId: category.id,
	                                        currentName: category.name?.trim() || 'Service group',
	                                      });
	                                    }}
	                                  >
	                                    {renderEditIcon()}
	                                  </button>
	                                </span>
	                                <span className="service-group-count">
                                  {groupServices.length} services
                                  <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden>
                                    <path d="m6 9 6 6 6-6" />
                                  </svg>
                                </span>
                              </div>
	                            </summary>
	                            <div className="service-group-body">
	                              {groupServices.length === 0 ? (
	                                <div className="sh-empty">No services in this group yet.</div>
	                              ) : null}
	                              {groupServices.map((service) => (
	                                <div key={service.id} className={`service-summary-item ${service.active === false ? 'archived' : ''}`}>
	                                  <div
	                                    className="service-summary-row service-summary-row--clickable"
	                                    role="button"
	                                    tabIndex={0}
	                                    onKeyDown={(event) => {
	                                      if (event.key === 'Enter' || event.key === ' ') {
	                                        event.preventDefault();
	                                        openCatalogServiceEditor(service);
	                                      }
	                                    }}
	                                    onClick={() => openCatalogServiceEditor(service)}
	                                  >
	                                    {renderServiceSummaryNameCell(service.name)}
	                                    <span className="service-summary-meta">{renderCatalogServiceListMeta(service)}</span>
	                                    <button
	                                      type="button"
	                                      className="service-edit-icon"
	                                      aria-label={`Edit ${service.name || 'service'}`}
	                                      onClick={(event) => {
	                                        event.stopPropagation();
	                                        openCatalogServiceEditor(service);
	                                      }}
	                                    >
	                                      {renderEditIcon()}
	                                    </button>
	                                  </div>
	                                  {editingCatalogServiceId === service.id && portal !== 'knowledge' ? (
	                                    <div className="service-inline-editor service-inline-editor--catalog-mobile">
	                                      <div className="service-item-head service-item-head--catalog-pair">
	                                        <div className="field">
	                                          <label>service name</label>
	                                          <input value={service.name} onChange={(event) => updateCatalogService(service.id, { name: event.target.value })} placeholder="Gel Manicure" />
	                                          <p className="service-name-edit-hint">Shorten so callers can understand</p>
	                                        </div>
	                                        <div className="field">
	                                          <label>move to group</label>
	                                          <select value={service.categoryId ?? ''} onChange={(event) => updateCatalogService(service.id, { categoryId: event.target.value || null })}>
	                                            {currentForm.service_catalog.categories.map((item) => (
	                                              <option key={item.id} value={item.id}>{item.name}</option>
	                                            ))}
	                                          </select>
	                                        </div>
	                                      </div>
	                                      <div className="form-grid settings-tab-content-frame">
	                                        <div className="field">
	                                          <label>description</label>
	                                          <input value={service.description ?? ''} onChange={(event) => updateCatalogService(service.id, { description: event.target.value || null })} placeholder="Optional caller-facing details" />
	                                        </div>
	                                        <div className="field">
	                                          <label>duration</label>
	                                          <input
	                                            value={serviceDurationText(service)}
	                                            onChange={(event) => {
	                                              const durationText = event.target.value;
	                                              updateCatalogService(service.id, {
	                                                durationText: durationText.trim() ? durationText : null,
	                                                durationMinutes: parseDurationTextToMinutes(durationText),
	                                              });
	                                            }}
	                                            placeholder="60 min, 1 hour+, Varies"
	                                          />
	                                        </div>
	                                        <div className="field">
	                                          <label>price type</label>
	                                          <select value={service.priceType} onChange={(event) => updateCatalogService(service.id, { priceType: event.target.value as ServicePriceType })}>
	                                            {PRICE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
	                                          </select>
	                                        </div>
	                                        <div className="field">
	                                          <label>price</label>
	                                          <input type="number" min={0} value={service.priceAmount ?? 0} onChange={(event) => updateCatalogService(service.id, { priceAmount: Number(event.target.value) })} disabled={service.priceType === 'consultation' || service.priceType === 'varies'} />
	                                        </div>
	                                      </div>
	                                      <div className="field">
	                                        <label>aliases / other names customers use</label>
	                                        <input
	                                          value={service.aliases.join(', ')}
	                                          onChange={(event) => updateCatalogService(service.id, { aliases: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
	                                          placeholder="gel mani, shellac"
	                                        />
	                                      </div>
	                                      <div className="field">
	                                        <label>booking notes</label>
	                                        <textarea
	                                          value={service.bookingNotes ?? ''}
	                                          onChange={(event) => updateCatalogService(service.id, { bookingNotes: event.target.value || null })}
	                                          placeholder="Anything the AI should know before capturing this request."
	                                        />
	                                      </div>
                                        <div className="field">
                                          <label>options / variants</label>
                                          <p className="field-help">Use options when a service has different lengths or prices.</p>
                                          <div className="service-variants-editor">
                                            {(service.variants ?? []).map((variant, variantIndex) => (
                                              <div className="service-variant-row" key={`${service.id}-variant-${variantIndex}`}>
                                                <input value={variant.label} onChange={(event) => updateCatalogServiceVariant(service.id, variantIndex, { label: event.target.value })} placeholder="30 min" />
                                                <input value={variant.durationText ?? ''} onChange={(event) => {
                                                  const durationText = event.target.value;
                                                  updateCatalogServiceVariant(service.id, variantIndex, { durationText: durationText || null, durationMinutes: parseDurationTextToMinutes(durationText) });
                                                }} placeholder="Duration" />
                                                <input type="number" min={0} value={variant.priceAmount ?? ''} onChange={(event) => updateCatalogServiceVariant(service.id, variantIndex, { priceAmount: event.target.value === '' ? null : Number(event.target.value) })} placeholder="Price" />
                                                <select value={variant.priceType ?? 'from'} onChange={(event) => updateCatalogServiceVariant(service.id, variantIndex, { priceType: event.target.value as ServicePriceType })}>
                                                  {PRICE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                </select>
                                                <button type="button" className="subtle-link" onClick={() => removeCatalogServiceVariant(service.id, variantIndex)}>Remove</button>
                                              </div>
                                            ))}
                                            <button type="button" className="btn ghost" onClick={() => addCatalogServiceVariant(service.id)}>+ Add option</button>
                                          </div>
                                        </div>
	                                      <div className="service-item-footer service-item-footer--catalog-inline">
	                                        <label className="inline-check">
	                                          <input type="checkbox" checked={service.bookable} onChange={(event) => updateCatalogService(service.id, { bookable: event.target.checked })} />
	                                          Bookable by request
	                                        </label>
	                                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3 mt-1">
	                                          <button type="button" className="subtle-link catalog-service-dialog-link-remove" onClick={() => removeCatalogService(service.id)}>
	                                            Remove
	                                          </button>
	                                          <button type="button" className="btn" onClick={() => setEditingCatalogServiceId(null)}>
	                                            Done
	                                          </button>
	                                        </div>
	                                      </div>
	                                    </div>
	                                  ) : null}
	                                </div>
	                              ))}
                              <button type="button" className="btn service-group-add-service" onClick={() => addServiceToGroup(category.id)}>
                                + Add service
                              </button>
                            </div>
                          </details>
                        );
                      })}
                  </div>
                  <dialog
                    ref={catalogServiceDialogRef}
                    className="catalog-service-dialog"
                    onClose={() => {
                      setCatalogDialogServiceId(null);
                      setCatalogDialogDraft(null);
                      setCatalogDialogError(null);
                    }}
                  >
                    {catalogDialogDraft && catalogDialogServiceId ? (
                      <div className="catalog-service-dialog-panel">
                        <header className="catalog-service-dialog-header">
                          <div className="catalog-service-dialog-header-main">
                            <span
                              className={`catalog-service-dialog-header-name${
                                !catalogDialogDraft.name.trim() ? ' catalog-service-dialog-header-name--untitled' : ''
                              }`}
                            >
                              {catalogDialogDraft.name.trim() || 'Untitled service'}
                            </span>
                            <span className="catalog-service-dialog-header-meta">
                              {catalogDialogDraft.variants?.length ? (
                                <>
                                  {catalogDialogDraft.variants.length} options ·{' '}
                                  {catalogDialogDraft.variants
                                    .slice(0, 2)
                                    .map(formatVariantSummary)
                                    .join(' / ')}
                                </>
                              ) : (
                                <>
                                  {formatServicePriceSummary(catalogDialogDraft)}
                                  {serviceDurationText(catalogDialogDraft) ? (
                                    <> · {serviceDurationText(catalogDialogDraft)}</>
                                  ) : (
                                    <>
                                      {' '}
                                      <span className="service-duration-warn service-duration-warn--header" role="img" aria-label="No duration set">
                                        ⚠
                                      </span>
                                    </>
                                  )}
                                </>
                              )}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="catalog-service-dialog-close"
                            aria-label="Close"
                            onClick={() => catalogServiceDialogRef.current?.close()}
                          >
                            ✕
                          </button>
                        </header>
                        <div className="catalog-service-dialog-body max-h-[calc(100dvh-160px)] min-h-0 flex-1 overflow-y-auto">
                          <div className="catalog-service-dialog-grid catalog-service-dialog-grid--desktop">
                            <div className="catalog-service-dialog-desktop-row1">
                              <div className="field">
                                <label>service name</label>
                                <input
                                  value={catalogDialogDraft.name}
                                  onChange={(event) => patchCatalogDialogDraft({ name: event.target.value })}
                                  placeholder="Gel Manicure"
                                />
                                <p className="service-name-edit-hint">Shorten so callers can understand</p>
                              </div>
                              <div className="field">
                                <label>move to group</label>
                                <select
                                  value={catalogDialogDraft.categoryId ?? ''}
                                  onChange={(event) => patchCatalogDialogDraft({ categoryId: event.target.value || null })}
                                >
                                  {currentForm.service_catalog.categories.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="field catalog-service-dialog-desc-field">
                              <label>description</label>
                              <textarea
                                rows={2}
                                className="w-full resize-y"
                                value={catalogDialogDraft.description ?? ''}
                                onChange={(event) => patchCatalogDialogDraft({ description: event.target.value || null })}
                                placeholder="Optional caller-facing details"
                              />
                            </div>
                            <div className="catalog-service-dialog-desktop-row3">
                              <div className="field">
                                <label>price type</label>
                                <select
                                  className="w-full"
                                  value={catalogDialogDraft.priceType}
                                  onChange={(event) =>
                                    patchCatalogDialogDraft({ priceType: event.target.value as ServicePriceType })
                                  }
                                >
                                  {PRICE_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="field">
                                <label>price</label>
                                <input
                                  className="w-full"
                                  type="number"
                                  min={0}
                                  value={catalogDialogDraft.priceAmount ?? 0}
                                  onChange={(event) =>
                                    patchCatalogDialogDraft({ priceAmount: Number(event.target.value) })
                                  }
                                  disabled={
                                    catalogDialogDraft.priceType === 'consultation' ||
                                    catalogDialogDraft.priceType === 'varies'
                                  }
                                />
                              </div>
                              <div className="field">
                                <label>duration</label>
                                <input
                                  className="w-full"
                                  value={serviceDurationText(catalogDialogDraft)}
                                  onChange={(event) => {
                                    const durationText = event.target.value;
                                    patchCatalogDialogDraft({
                                      durationText: durationText.trim() ? durationText : null,
                                      durationMinutes: parseDurationTextToMinutes(durationText),
                                    });
                                  }}
                                  placeholder="e.g. 45min, 1 hour, Varies"
                                />
                              </div>
                            </div>
                            <div className="catalog-service-dialog-desktop-row4">
                              <div className="field">
                                <label>aliases</label>
                                <input
                                  className="w-full"
                                  value={catalogDialogDraft.aliases.join(', ')}
                                  onChange={(event) =>
                                    patchCatalogDialogDraft({
                                      aliases: event.target.value
                                        .split(',')
                                        .map((item) => item.trim())
                                        .filter(Boolean),
                                    })
                                  }
                                  placeholder="other names callers use"
                                />
                              </div>
                              <div className="field">
                                <label>booking notes</label>
                                <textarea
                                  className="w-full resize-y"
                                  rows={2}
                                  value={catalogDialogDraft.bookingNotes ?? ''}
                                  onChange={(event) =>
                                    patchCatalogDialogDraft({ bookingNotes: event.target.value || null })
                                  }
                                  placeholder="Anything the AI should know before capturing this request."
                                />
                              </div>
                            </div>
                            <div className="catalog-service-dialog-variants-box">
                              <p className="catalog-service-dialog-variants-title">Options / variants</p>
                              <p className="catalog-service-dialog-variants-sub">
                                Add options when a service has different lengths or prices.
                              </p>
                              <div className="service-variants-editor">
                                {(catalogDialogDraft.variants ?? []).map((variant, variantIndex) => (
                                  <div className="service-variant-row" key={`dialog-${catalogDialogServiceId}-v-${variantIndex}`}>
                                    <input
                                      value={variant.label}
                                      onChange={(event) =>
                                        patchCatalogDialogVariant(variantIndex, { label: event.target.value })
                                      }
                                      placeholder="30 min"
                                    />
                                    <input
                                      value={variant.durationText ?? ''}
                                      onChange={(event) => {
                                        const durationText = event.target.value;
                                        patchCatalogDialogVariant(variantIndex, {
                                          durationText: durationText || null,
                                          durationMinutes: parseDurationTextToMinutes(durationText),
                                        });
                                      }}
                                      placeholder="Duration"
                                    />
                                    <input
                                      type="number"
                                      min={0}
                                      value={variant.priceAmount ?? ''}
                                      onChange={(event) =>
                                        patchCatalogDialogVariant(variantIndex, {
                                          priceAmount: event.target.value === '' ? null : Number(event.target.value),
                                        })
                                      }
                                      placeholder="Price"
                                    />
                                    <select
                                      value={variant.priceType ?? 'from'}
                                      onChange={(event) =>
                                        patchCatalogDialogVariant(variantIndex, {
                                          priceType: event.target.value as ServicePriceType,
                                        })
                                      }
                                    >
                                      {PRICE_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      className="subtle-link"
                                      onClick={() => removeCatalogDialogVariantRow(variantIndex)}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                                <button type="button" className="catalog-service-dialog-add-option" onClick={addCatalogDialogVariantRow}>
                                  + Add option
                                </button>
                              </div>
                            </div>
                            <label className="inline-check catalog-service-dialog-bookable catalog-service-dialog-bookable--body">
                              <input
                                type="checkbox"
                                checked={catalogDialogDraft.bookable}
                                onChange={(event) => patchCatalogDialogDraft({ bookable: event.target.checked })}
                              />
                              Bookable by request
                            </label>
                          </div>
                          {catalogDialogError ? <p className="catalog-service-dialog-error">{catalogDialogError}</p> : null}
                        </div>
                        <footer className="catalog-service-dialog-footer">
                          <button
                            type="button"
                            className="subtle-link catalog-service-dialog-link-remove"
                            onClick={() => {
                              if (!catalogDialogServiceId || !catalogDialogDraft) return;
                              const label = catalogDialogDraft.name.trim() || 'this service';
                              confirmRemoveCatalogServiceFromDialog(catalogDialogServiceId, label);
                            }}
                          >
                            Remove
                          </button>
                          <div className="catalog-service-dialog-footer-actions">
                            <button
                              type="button"
                              className="btn catalog-service-dialog-btn-cancel"
                              onClick={() => catalogServiceDialogRef.current?.close()}
                            >
                              Cancel <span className="catalog-service-dialog-esc-hint">ESC</span>
                            </button>
                            <button type="button" className="btn user-save" onClick={() => void saveCatalogServiceDialog()}>
                              Save changes
                            </button>
                          </div>
                        </footer>
                      </div>
                    ) : null}
                  </dialog>
                  <OnboardingAddGroupSheet
                    isOpen={catalogGroupSheet !== null}
                    onClose={() => setCatalogGroupSheet(null)}
                    onConfirm={(name) => {
                      const trimmed = name.trim();
                      if (!trimmed || !catalogGroupSheet) return;
                      if (catalogGroupSheet.mode === 'add') {
                        addServiceGroup(trimmed);
                      } else {
                        updateServiceGroup(catalogGroupSheet.categoryId, { name: trimmed });
                      }
                      setCatalogGroupSheet(null);
                    }}
                    title={
                      catalogGroupSheet?.mode === 'rename' ? 'Rename service group' : catalogGroupSheet?.mode === 'add' ? 'New service group' : ''
                    }
                    placeholder="e.g. Waxing, Facials, Extensions..."
                    initialName={catalogGroupSheet?.mode === 'rename' ? catalogGroupSheet.currentName : undefined}
                    confirmLabel={catalogGroupSheet?.mode === 'rename' ? 'Save' : 'Add group'}
                    titleId="knowledge-catalog-group-sheet-title"
                  />
                  <div className="service-catalog-note">
                    These services help RingBooker answer caller questions and capture booking requests. They do not turn on direct booking integrations by themselves.
                  </div>
                    </>
                  )}
                </div>
                <div className="settings-save-footer settings-tab-content-frame">
                  <button type="submit" className="btn user-save" disabled={savingSection !== null}>
                    {savingSection === 'services' ? 'Saving...' : 'Save services'}
                  </button>
                </div>
	              </form>
            </section>
            ) : null}

            {activeTab === 'hours' ? (
            <section className="card">
              <form
                className="card-section-form sh-business-hours-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitSettingsPatch('hours', { hours: currentForm.hours });
                }}
              >
                <div className="card-section settings-tab-content-frame">
                  <div className="panel-head knowledge-tab-panel-head">
                    <div>
                      <h3>Hours</h3>
                      <p className="sub">Set your weekly schedule. Use a preset for a quick start, then fine-tune individual days.</p>
                    </div>
                  </div>
                  <div className="sh-hours-presets">
                    <p className="sh-hours-presets-label">Quick apply</p>
                    <div className="preset-pills">
                      {HOURS_PRESETS.map((preset) => (
                        <button key={preset.id} type="button" className={`preset-pill ${hourPreset === preset.id ? 'active' : ''}`} onClick={() => applyHourPreset(preset.id)}>
                          {preset.label}
                        </button>
                      ))}
                      <button type="button" className={`preset-pill ${hourPreset === 'custom' ? 'active' : ''}`} onClick={() => setHourPreset('custom')}>Custom</button>
                    </div>
                  </div>
                  <div className="sh-hours-wrap">
                    <div className="sh-hours-thead" aria-hidden="true">
                      <span>Day</span>
                      <span>Opens</span>
                      <span>Closes</span>
                      <span>Status</span>
                    </div>
                    <div className="hours-grid">
                      {DAY_ORDER.map((day) => {
                        const entry = currentForm.hours[day] ?? { closed: true };
                        const isClosed = 'closed' in entry;
                        const openId = `hours-open-${day}`;
                        const closeId = `hours-close-${day}`;
                        const closedLabelId = `hours-closed-label-${day}`;
                        return (
                          <div key={day} className={`hours-row ${isClosed ? 'closed' : ''}`}>
                            <div className="hours-day">{DAY_LABELS[day]}</div>
                            <div className="small-field hours-field-open">
                              <label htmlFor={openId}>Open</label>
                              <select id={openId} value={isClosed ? '09:00' : entry.open} disabled={isClosed} onChange={(event) => updateHours(day, { open: event.target.value, close: isClosed ? '18:00' : entry.close })}>
                                {TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
                              </select>
                            </div>
                            <div className="small-field hours-field-close">
                              <label htmlFor={closeId}>Close</label>
                              <select id={closeId} value={isClosed ? '18:00' : entry.close} disabled={isClosed} onChange={(event) => updateHours(day, { open: isClosed ? '09:00' : entry.open, close: event.target.value })}>
                                {TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
                              </select>
                            </div>
                            <div className="hours-closed-cell">
                              <span className="hours-closed-label" id={closedLabelId}>
                                Closed
                              </span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={isClosed}
                                aria-labelledby={closedLabelId}
                                className="hours-closed-toggle"
                                onClick={() => updateHours(day, isClosed ? { open: '09:00', close: '18:00' } : { closed: true })}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="settings-save-footer settings-tab-content-frame">
                  <button type="submit" className="btn user-save" disabled={savingSection !== null}>
                    {savingSection === 'hours' ? 'Saving...' : 'Save hours'}
                  </button>
                </div>
	              </form>
            </section>
            ) : null}

            {activeTab === 'staff' ? (
            <section className="card">
              <form
                className="card-section-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitSettingsPatch('staff', {
                    staff: currentForm.staff
                      .map((item) => ({
                        ...item,
                        name: item.name.trim(),
                        role: item.role?.trim() || null,
                        specialties: (item.specialties ?? []).map((value) => value.trim()).filter(Boolean),
                        notes: item.notes?.trim() || null,
                        active: item.active !== false,
                      }))
                      .filter((item) => item.name),
                  });
                }}
              >
                <div className="panel-head knowledge-tab-panel-head">
                  <div>
                    <h3>Staff / Technicians</h3>
                    <p className="sub">Add staff names and specialties so RingBooker answers accurately. Preferred-provider memory requires Professional.</p>
                  </div>
                </div>
                <div className="card-section settings-tab-content-frame">
                  {currentForm.staff.length > 0 ? (
                    <div className="staff-section-toolbar">
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          if (portal === 'knowledge' && knowledgeMobile) {
                            setKnowledgeStaffAddDraft(emptyStaffMember());
                            setKnowledgeStaffAddSheetOpen(true);
                            return;
                          }
                          patchState('staff', [...currentForm.staff, emptyStaffMember()]);
                          setExpandedStaffIndex(currentForm.staff.length);
                        }}
                      >
                        Add staff
                      </button>
                    </div>
                  ) : null}
                  {currentForm.staff.length === 0 ? (
                    <div className="sh-empty empty staff-empty">
                      <div className="staff-empty-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                          <circle cx="9.5" cy="7" r="4" />
                          <path d="M19 8v6" />
                          <path d="M22 11h-6" />
                        </svg>
                      </div>
                      <strong>No staff added yet.</strong>
                      <p>Add providers so callers can request them by name.</p>
                      <button
                        type="button"
                        className="btn staff-empty-add"
                        onClick={() => {
                          if (portal === 'knowledge' && knowledgeMobile) {
                            setKnowledgeStaffAddDraft(emptyStaffMember());
                            setKnowledgeStaffAddSheetOpen(true);
                            return;
                          }
                          patchState('staff', [...currentForm.staff, emptyStaffMember()]);
                          setExpandedStaffIndex(0);
                        }}
                      >
                        + Add staff member
                      </button>
                    </div>
                  ) : null}
                  {currentForm.staff.map((member, index) => (
                    <div className={`staff-card ${member.active === false ? 'inactive' : ''}`} key={`staff-${index}`}>
                      <div className="staff-card-main" role="button" tabIndex={0} onClick={() => setExpandedStaffIndex(expandedStaffIndex === index ? null : index)} onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setExpandedStaffIndex(expandedStaffIndex === index ? null : index);
                        }
                      }}>
                        <div className="staff-avatar">
                          {(member.name.trim() || 'S').slice(0, 1).toUpperCase()}
                        </div>
                        <div className="staff-info">
                          <div className="staff-name">
                            {member.name.trim() || 'New staff member'}
                            {member.active === false ? <span> · inactive</span> : null}
                          </div>
                          <div className="staff-role">{member.role?.trim() || 'Provider'}</div>
                          {(member.specialties ?? []).length > 0 ? (
                            <div className="staff-spec-tags">
                              {(member.specialties ?? []).slice(0, 4).map((specialty, specialtyIndex) => (
                                <span className="staff-spec" key={`${specialty}-${specialtyIndex}`}>{specialty}</span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="staff-card-actions">
                          <button
                            type="button"
                            className={`staff-toggle ${member.active === false ? 'off' : 'on'}`}
                            aria-label={member.active === false ? 'Mark staff active' : 'Mark staff inactive'}
                            onClick={(event) => {
                              event.stopPropagation();
                              updateStaff(index, { active: member.active === false });
                            }}
                          />
                          <span className="staff-chevron" aria-hidden="true">{expandedStaffIndex === index ? '⌃' : '⌄'}</span>
                        </div>
                      </div>
                      {expandedStaffIndex === index ? (
                        <div className="staff-card-detail">
                          <div className="form-grid">
                            <div className="field"><label>Name</label><input value={member.name} onChange={(event) => updateStaff(index, { name: event.target.value })} placeholder="Sarah" /></div>
                            <div className="field"><label>Role / title</label><input value={member.role ?? ''} onChange={(event) => updateStaff(index, { role: event.target.value })} placeholder="Nail technician" /></div>
                            <div className="field" style={{ gridColumn: '1 / -1' }}><label>Specialties</label><input value={(member.specialties ?? []).join(', ')} onChange={(event) => updateStaff(index, { specialties: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} placeholder="Gel nails, nail art, pedicure" /></div>
                            <div className="field" style={{ gridColumn: '1 / -1' }}><label>Notes for AI</label><textarea value={member.notes ?? ''} onChange={(event) => updateStaff(index, { notes: event.target.value })} placeholder="Optional. Example: Available Tuesday-Friday. Best for detailed nail art." /></div>
                          </div>
                          <div className="staff-detail-actions">
                            <button type="button" className="subtle-link" onClick={() => {
                              patchState('staff', currentForm.staff.filter((_, itemIndex) => itemIndex !== index));
                              setExpandedStaffIndex(null);
                            }}>
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="settings-save-footer settings-tab-content-frame">
                  <button type="submit" className="btn user-save" disabled={savingSection !== null}>
                    {savingSection === 'staff' ? 'Saving...' : 'Save staff'}
                  </button>
                </div>
              </form>
            </section>
            ) : null}

            {activeTab === 'faq' ? (
            <section className="card">
              <form
                className="card-section-form"
	                onSubmit={(event) => {
	                  event.preventDefault();
	                  void commitSettingsPatch('faqs', {
	                    cancel_policy: currentForm.cancel_policy,
	                    promotions: currentForm.promotions || null,
	                    faqs: currentForm.faqs
	                      .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }))
	                      .filter((item) => item.question && item.answer),
                  });
                }}
              >
	                <div className="panel-head knowledge-tab-panel-head">
	                  <div>
	                    <h3>Policies & FAQ</h3>
	                    <p className="sub">Approved policies and answers for common caller questions: deposits, cancellations, parking, walk-ins, payment methods, gift cards, or group bookings.</p>
	                  </div>
		                  {currentForm.faqs.length > 0 ? (
		                    <button type="button" className="btn" onClick={() => {
                          if (portal === 'knowledge' && knowledgeMobile) {
                            setKnowledgeFaqCreateDraft(emptyFaqItem());
                            setKnowledgeFaqCreateSheetOpen(true);
                            return;
                          }
                          patchState('faqs', [...currentForm.faqs, emptyFaqItem()]);
                        }}>
		                      Add FAQ
		                    </button>
		                  ) : null}
	                </div>
	                <div className="card-section settings-tab-content-frame">
	                  <div className="option-card option-card--bare">
	                    <div className="hint-row"><strong className="option-title">Cancellation policy</strong><span className="hint-copy">Choose a preset, then edit if your business needs a special case.</span></div>
	                    <div className="preset-pills" style={{ marginTop: 12 }}>
	                      {CANCEL_POLICY_PRESETS.map((item) => (
	                        <button key={item} type="button" className={`preset-pill ${cancelPreset === item ? 'active' : ''}`} onClick={() => {
	                          setCancelPreset(item);
	                          patchState('cancel_policy', item);
	                        }}>
	                          {item.includes('2 hours') ? '2-hour notice' : item.includes('24 hours') ? '24-hour notice' : item.includes('No cancellation') ? 'No fee' : 'Phone-only changes'}
	                        </button>
	                      ))}
	                      <button type="button" className={`preset-pill ${cancelPreset === 'custom' ? 'active' : ''}`} onClick={() => setCancelPreset('custom')}>Custom</button>
	                    </div>
	                    <div className="field" style={{ marginTop: 14 }}>
	                      <label>Policy text</label>
	                      <textarea value={currentForm.cancel_policy} onChange={(event) => {
	                        setCancelPreset('custom');
	                        patchState('cancel_policy', event.target.value);
	                      }} placeholder="e.g. 24-hour notice required. Late cancellations may be charged a fee." />
	                    </div>
	                  </div>
	                  <div className="option-card option-card--bare">
	                    <div className="hint-row"><strong className="option-title">Promotion</strong><span className="hint-copy">Optional. Add one active offer so the AI never invents a discount.</span></div>
	                    <div className="preset-pills" style={{ marginTop: 12 }}>
	                      {PROMOTION_PRESETS.map((item, index) => (
	                        <button key={`${item}-${index}`} type="button" className={`preset-pill ${promoPreset === item ? 'active' : ''}`} onClick={() => {
	                          setPromoPreset(item);
	                          patchState('promotions', item);
	                        }}>
	                          {index === 0 ? 'No promotion' : index === 1 ? '10% first visit' : index === 2 ? 'Free consult' : 'Weekday offer'}
	                        </button>
	                      ))}
	                      <button type="button" className={`preset-pill ${promoPreset === 'custom' ? 'active' : ''}`} onClick={() => setPromoPreset('custom')}>Custom</button>
	                    </div>
	                    <div className="field" style={{ marginTop: 14 }}>
	                      <label>Promotion text</label>
	                      <textarea value={currentForm.promotions} onChange={(event) => {
	                        setPromoPreset('custom');
	                        patchState('promotions', event.target.value);
	                      }} placeholder="Optional. Leave blank if you are not running a promotion." />
	                    </div>
	                  </div>
		                  {currentForm.faqs.length === 0 ? (
		                    <div className="sh-empty faq-empty-state">
		                      <p>No FAQs added yet. Add common answers so RingBooker can respond consistently.</p>
		                      <button type="button" className="btn faq-empty-cta" onClick={() => {
                            if (portal === 'knowledge' && knowledgeMobile) {
                              setKnowledgeFaqCreateDraft(emptyFaqItem());
                              setKnowledgeFaqCreateSheetOpen(true);
                              return;
                            }
                            patchState('faqs', [...currentForm.faqs, emptyFaqItem()]);
                          }}>
		                        Add FAQ
		                      </button>
		                    </div>
		                  ) : null}
	                  {currentForm.faqs.map((item, index) => (
	                    <div className="option-card option-card--bare" key={`faq-${index}`}>
                      <div className="field"><label>Question</label><input value={item.question} onChange={(event) => updateFaq(index, { question: event.target.value })} placeholder="Do you accept walk-ins?" /></div>
                      <div className="field"><label>Approved answer</label><textarea value={item.answer} onChange={(event) => updateFaq(index, { answer: event.target.value })} placeholder="Walk-ins are welcome when staff are available, but appointments are recommended." /></div>
                      <div className="settings-save-footer settings-tab-content-frame" style={{ marginTop: 10 }}>
                        <button type="button" className="subtle-link" onClick={() => patchState('faqs', currentForm.faqs.filter((_, itemIndex) => itemIndex !== index))}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
	                <div className="settings-save-footer settings-tab-content-frame">
	                  <button type="submit" className="btn user-save" disabled={savingSection !== null}>
	                    {savingSection === 'faqs' ? 'Saving...' : 'Save policies & FAQ'}
	                  </button>
                </div>
              </form>
            </section>
            ) : null}

            {activeTab === 'ai-call-behavior' ? (
            <section className="card">
              <div className="panel-head knowledge-tab-panel-head" style={{ marginBottom: 12 }}>
                <div>
                  <h3>AI behavior & Calling handling</h3>
                  <p className="sub">Control how your AI receptionist speaks, handles calls, and sends SMS notifications.</p>
                </div>
              </div>
              <div className="business-subtabs" role="tablist" aria-label="AI call behavior sections">
                <button type="button" role="tab" aria-selected={behaviorSubTab === 'voice'} className={`business-subtab ${behaviorSubTab === 'voice' ? 'active' : ''}`} onClick={() => setBehaviorSubTab('voice')}>
                  Voice
                </button>
                <button type="button" role="tab" aria-selected={behaviorSubTab === 'call'} className={`business-subtab ${behaviorSubTab === 'call' ? 'active' : ''}`} onClick={() => setBehaviorSubTab('call')}>
                  Call
                </button>
                <button type="button" role="tab" aria-selected={behaviorSubTab === 'sms'} className={`business-subtab ${behaviorSubTab === 'sms' ? 'active' : ''}`} onClick={() => setBehaviorSubTab('sms')}>
                  SMS
                </button>
              </div>
              {behaviorSubTab === 'call' ? (
              <form
                className="card-section-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const patch: Record<string, unknown> = {};
                  if (!ownerTransferUx.locked) patch.allow_transfers = currentForm.allow_transfers;
                  if (!callRecordingLocked) patch.call_recording_enabled = currentForm.call_recording_enabled;
                  void commitSettingsPatch('call-handling', patch);
                }}
              >
                <div className="card-section settings-tab-content-frame">
                  <div className="switch-list">
                    <div className={`switch-row ${ownerTransferUx.locked ? 'locked' : ''}`}>
                      <div className="switch-copy">
                        <div className="switch-title-row">
                          <h4>{ownerTransferUx.title}</h4>
                          {ownerTransferUx.locked ? (
                            <span className="tag orange knowledge-plan-lock-badge">{ownerTransferUx.badge}</span>
                          ) : null}
                        </div>
                        <p>{ownerTransferUx.description}</p>
                      </div>
                      <div className="switch-stack">
                        <button
                          type="button"
                          className={`switch ${currentForm.allow_transfers && !ownerTransferUx.locked ? 'on' : ''} ${ownerTransferUx.locked ? 'locked' : ''}`}
                          disabled={ownerTransferUx.locked}
                          aria-disabled={ownerTransferUx.locked}
                          onClick={() => {
                            if (ownerTransferUx.locked) return;
                            patchState('allow_transfers', !currentForm.allow_transfers);
                          }}
                        >
                          <span className="sr-only">{ownerTransferUx.locked ? 'Owner transfer is locked' : 'Toggle transfers'}</span>
                        </button>
                      </div>
                    </div>
                    {!ownerTransferUx.locked && currentForm.allow_transfers ? (
                      <div className="handoff-phone-section">
                        <div className="field handoff-transfer-phone">
                          <label className="handoff-section-label">Transfer calls to</label>
                          {!effectiveShop.handoff_phone ? (
                            <p style={{ color: '#b45309', fontSize: 12, marginBottom: 6 }}>&#9888; Add a direct mobile so RingBooker knows where to transfer calls. Without it, callers who ask for you will receive a message instead.</p>
                          ) : handoffPhoneWarnings.includes('matches_business_line') ? (
                            <p style={{ color: '#b45309', fontSize: 12, marginBottom: 6 }}>&#9888; This looks like your business line. If it forwards to RingBooker, transfers may not work. Use a direct mobile instead.</p>
                          ) : (
                            <p style={{ color: '#16a34a', fontSize: 12, marginBottom: 6 }}>&#10003; Transfers will go to {effectiveShop.handoff_phone}</p>
                          )}
                          <input
                            value={handoffPhoneDraft}
                            onChange={(e) => { setHandoffPhoneDraft(e.target.value); setHandoffPhoneStatus('idle'); }}
                            placeholder="+1 (555) 000-0000"
                            aria-label="Handoff phone number"
                          />
                        </div>
                        <div className={`field handoff-availability${handoffAvailabilityDraft === 'custom' ? ' handoff-availability--custom' : ''}`}>
                          <label className="handoff-section-label">Transfer availability</label>
                          <div className="handoff-radio-group">
                            {(['business_hours', 'always', 'custom'] as const).map((option) => (
                              <label key={option} className="handoff-radio-option">
                                <input
                                  type="radio"
                                  name="handoff_availability"
                                  value={option}
                                  checked={handoffAvailabilityDraft === option}
                                  onChange={() => setHandoffAvailabilityDraft(option)}
                                />
                                {option === 'business_hours' ? 'During business hours only' : option === 'always' ? 'Always available' : 'Custom hours'}
                              </label>
                            ))}
                          </div>
                        </div>
                        {handoffAvailabilityDraft === 'custom' ? (
                          <div className="field handoff-custom-hours">
                            <label className="handoff-section-label">Custom transfer hours</label>
                            <div className="sh-hours-wrap" style={{ marginTop: 8 }}>
                              <div className="sh-hours-thead" aria-hidden="true">
                                <span>Day</span>
                                <span>Opens</span>
                                <span>Closes</span>
                                <span>Status</span>
                              </div>
                              <div className="hours-grid">
                                {DAY_ORDER.map((day) => {
                                  const entry = handoffCustomHoursDraft[day] ?? { closed: true };
                                  const isClosed = 'closed' in entry;
                                  const openId = `handoff-hours-open-${day}`;
                                  const closeId = `handoff-hours-close-${day}`;
                                  const closedLabelId = `handoff-hours-closed-label-${day}`;
                                  return (
                                    <div key={day} className={`hours-row ${isClosed ? 'closed' : ''}`}>
                                      <div className="hours-day">{DAY_LABELS[day]}</div>
                                      <div className="small-field hours-field-open">
                                        <label htmlFor={openId}>Open</label>
                                        <select id={openId} value={isClosed ? '09:00' : entry.open} disabled={isClosed} onChange={(e) => setHandoffCustomHoursDraft({ ...handoffCustomHoursDraft, [day]: { open: e.target.value, close: isClosed ? '18:00' : entry.close } })}>
                                          {TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
                                        </select>
                                      </div>
                                      <div className="small-field hours-field-close">
                                        <label htmlFor={closeId}>Close</label>
                                        <select id={closeId} value={isClosed ? '18:00' : entry.close} disabled={isClosed} onChange={(e) => setHandoffCustomHoursDraft({ ...handoffCustomHoursDraft, [day]: { open: isClosed ? '09:00' : entry.open, close: e.target.value } })}>
                                          {TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
                                        </select>
                                      </div>
                                      <div className="hours-closed-cell">
                                        <span className="hours-closed-label" id={closedLabelId}>Closed</span>
                                        <button
                                          type="button"
                                          role="switch"
                                          aria-checked={isClosed}
                                          aria-labelledby={closedLabelId}
                                          className="hours-closed-toggle"
                                          onClick={() => setHandoffCustomHoursDraft({ ...handoffCustomHoursDraft, [day]: isClosed ? { open: '09:00', close: '18:00' } : { closed: true } })}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : null}
                        <div className="handoff-actions">
                          <button
                            type="button"
                            className="btn user-save"
                            disabled={handoffPhoneStatus === 'saving'}
                            onClick={() => { void saveTransferSettings(); }}
                          >
                            {handoffPhoneStatus === 'saving' ? 'Saving...' : 'Save transfer settings'}
                          </button>
                          {handoffPhoneStatus !== 'idle' && handoffPhoneStatus !== 'saving' && handoffPhoneStatus !== 'saved' ? (
                            <span style={{ color: '#dc2626', fontSize: 12 }}>{handoffPhoneStatus}</span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <div className={`switch-row ${callRecordingLocked ? 'locked' : ''}`}>
                      <div className="switch-copy">
                        <div className="switch-title-row">
                          <h4>Call recording</h4>
                          {callRecordingLocked ? (
                            <span className="tag orange knowledge-plan-lock-badge">Available on Professional</span>
                          ) : null}
                        </div>
                        <p>
                          {callRecordingLocked
                            ? 'Record and replay calls from your call log on Professional.'
                            : 'Record calls for quality review and replay them from your call log. Make sure your recording notice meets local requirements.'}
                        </p>
                      </div>
                      <div className="switch-stack">
                        <button
                          type="button"
                          className={`switch ${currentForm.call_recording_enabled && !callRecordingLocked ? 'on' : ''} ${callRecordingLocked ? 'locked' : ''}`}
                          disabled={callRecordingLocked}
                          aria-disabled={callRecordingLocked}
                          aria-pressed={currentForm.call_recording_enabled && !callRecordingLocked}
                          onClick={() => {
                            if (callRecordingLocked) return;
                            patchState('call_recording_enabled', !currentForm.call_recording_enabled);
                          }}
                        >
                          <span className="sr-only">{callRecordingLocked ? 'Call recording is locked' : 'Toggle call recording'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className={`option-card ${returningCallerNotesUx.locked ? 'locked' : ''}`}>
                    <div className="hint-row">
                      <strong className="option-title">{returningCallerNotesUx.title}</strong>
                      <span className={`tag knowledge-plan-lock-badge ${returningCallerNotesUx.locked ? 'orange' : 'green'}`}>{returningCallerNotesUx.badge}</span>
                    </div>
                    <p className="sub" style={{ marginTop: 8 }}>{returningCallerNotesUx.description}</p>
                  </div>
                </div>
                <div className="settings-save-footer settings-tab-content-frame">
                  <button type="submit" className="btn user-save" disabled={savingSection !== null}>
                    {savingSection === 'call-handling' ? 'Saving...' : 'Save call handling'}
                  </button>
                </div>
              </form>
              ) : null}

              {behaviorSubTab === 'voice' ? (
              <form
                className="card-section-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const patch: Record<string, unknown> = {
                    ai_voice: currentForm.ai_voice || null,
                    ai_welcome_message: currentForm.ai_welcome_message.trim() ? currentForm.ai_welcome_message : null,
                    ai_custom_instructions: currentForm.ai_custom_instructions.trim() ? currentForm.ai_custom_instructions : null,
                  };
                  if (effectiveShop.plan === 'professional') {
                    patch.languages = normalizeUserLanguages(currentForm.languages);
                  }
                  void commitSettingsPatch('ai-voice', patch);
                }}
              >
                <div className="card-section settings-tab-content-frame">
                  <div className="field">
                    <div className="field-plan-lock-head">
                      <label>Voice style</label>
                      {renderLockCopy('edit_ai_voice')}
                    </div>
                    <select value={currentForm.ai_voice} disabled={isLocked('edit_ai_voice')} onChange={(event) => patchState('ai_voice', event.target.value)}>
                      {AI_VOICE_OPTIONS.map((voice) => <option key={voice.value} value={voice.value}>{voice.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <div className="hint-row">
                      <strong className="option-title">Greeting preset</strong>
                      {renderLockCopy('edit_ai_greeting')}
                    </div>
                    <div className="preset-pills" style={{ marginTop: 12 }}>
                      {AI_GREETING_PRESETS.map((preset, index) => {
                        const resolved = normalizeGreeting(preset, effectiveShop.name);
                        return (
                          <button
                            key={preset}
                            type="button"
                            disabled={isLocked('edit_ai_greeting')}
                            className={`preset-pill ${greetingPreset === resolved ? 'active' : ''} ${isLocked('edit_ai_greeting') ? 'locked' : ''}`}
                            onClick={() => {
                              setGreetingPreset(resolved);
                              patchState('ai_welcome_message', resolved);
                            }}
                          >
                            {index === 0 ? 'Friendly' : index === 1 ? 'Professional' : 'Booking-first'}
                          </button>
                        );
                      })}
                      <button type="button" disabled={isLocked('edit_ai_greeting')} className={`preset-pill ${greetingPreset === 'custom' ? 'active' : ''} ${isLocked('edit_ai_greeting') ? 'locked' : ''}`} onClick={() => setGreetingPreset('custom')}>Custom</button>
                    </div>
                    <div className="field" style={{ marginTop: 14 }}>
                      <label>Greeting text</label>
                      <textarea value={currentForm.ai_welcome_message} disabled={isLocked('edit_ai_greeting')} onChange={(event) => {
                        setGreetingPreset('custom');
                        patchState('ai_welcome_message', event.target.value);
                      }} />
                    </div>
                  </div>

                  <div className={`option-card ${bilingualAnsweringUx.locked ? 'locked' : ''}`}>
                    <div className="hint-row">
                      <strong className="option-title">{bilingualAnsweringUx.title}</strong>
                      <span
                        className={`tag knowledge-plan-lock-badge ${bilingualAnsweringUx.locked ? 'orange' : effectiveShop.plan === 'enterprise' ? 'purple' : 'green'}`}
                      >
                        {bilingualAnsweringUx.badge}
                      </span>
                    </div>
                    <p className="sub" style={{ marginTop: 8 }}>{bilingualAnsweringUx.description}</p>
                    {effectiveShop.plan === 'professional' ? (
                      <div className="preset-pills" style={{ marginTop: 12 }}>
                        {USER_LANGUAGE_OPTIONS.map((language) => (
                          <label key={language.code} className={`preset-pill ${currentForm.languages.includes(language.code) ? 'active' : ''}`}>
                            <input
                              type="checkbox"
                              checked={currentForm.languages.includes(language.code)}
                              disabled={language.code === 'en'}
                              onChange={(event) => toggleLanguage(language.code, event.target.checked)}
                              style={{ marginRight: 8 }}
                            />
                            {language.label}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="sub" style={{ marginTop: 8 }}>
                        Current setup language: {normalizeUserLanguages(currentForm.languages).map(languageDisplayName).join(', ')}
                      </p>
                    )}
                    {effectiveShop.plan === 'enterprise' ? (
                      <a className="btn" href="/contact?topic=implementation" style={{ marginTop: 12 }}>
                        Contact implementation support
                      </a>
                    ) : null}
                  </div>

                  <div className="field">
                    <div className="field-plan-lock-head">
                      <label>Advanced AI instructions</label>
                      {renderLockCopy('edit_ai_custom_instructions')}
                    </div>
                    <textarea value={currentForm.ai_custom_instructions} disabled={isLocked('edit_ai_custom_instructions')} onChange={(event) => patchState('ai_custom_instructions', event.target.value)} placeholder="Only show for Enterprise businesses." />
                  </div>
                </div>
                <div className="settings-save-footer settings-tab-content-frame">
                  <button type="submit" className="btn user-save" disabled={savingSection !== null}>
                    {savingSection === 'ai-voice' ? 'Saving...' : effectiveShop.plan === 'professional' ? 'Save AI voice & language' : 'Save AI voice & greeting'}
                  </button>
                </div>
              </form>
              ) : null}

              {behaviorSubTab === 'sms' ? (
              <form
                className="card-section-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitSettingsPatch('sms-notifications', {
                    send_reminder_sms: currentForm.send_reminder_sms,
                    send_review_request_sms: currentForm.send_review_request_sms,
                    send_missed_call_followup_sms: currentForm.send_missed_call_followup_sms,
                    send_call_summary_sms: currentForm.send_call_summary_sms,
                    owner_call_summary_sms_timing: currentForm.owner_call_summary_sms_timing,
                    send_callback_request_sms: currentForm.send_callback_request_sms,
                    owner_callback_request_sms_timing: currentForm.owner_callback_request_sms_timing,
                    send_daily_digest_sms: currentForm.send_daily_digest_sms,
                    owner_daily_digest_time: currentForm.owner_daily_digest_time,
                    sms_quiet_hours_start: currentForm.sms_quiet_hours_start,
                    sms_quiet_hours_end: currentForm.sms_quiet_hours_end,
                  });
                }}
              >
                <div className="card-section settings-tab-content-frame">
                  <div className="settings-sms-grid">
                    <section className="settings-sms-panel">
                      <h4>CUSTOMER NOTIFICATIONS</h4>
                      <div className="switch-list">
                        <div className="switch-row">
                          <div className="switch-copy"><h4>Booking confirmations</h4><p>Sent immediately when AI books an appointment.</p></div>
                          <div className="switch-stack"><button type="button" className="switch on locked" disabled><span className="sr-only">Booking confirmations are always on</span></button></div>
                        </div>
                        <div className={`switch-row ${isLocked('edit_reminder_sms') ? 'locked' : ''}`}>
                          <div className="switch-copy">
                            <div className="switch-title-row"><h4>Appointment reminders</h4>{renderLockCopy('edit_reminder_sms')}</div>
                            <p>24 hours before and 2 hours before, based on confirmed appointment time.</p>
                            <p>Respects quiet hours; blocked reminders are sent next morning.</p>
                          </div>
                          <div className="switch-stack"><button type="button" className={`switch ${currentForm.send_reminder_sms ? 'on' : ''}`} disabled={isLocked('edit_reminder_sms')} onClick={() => patchState('send_reminder_sms', !currentForm.send_reminder_sms)}><span className="sr-only">Toggle appointment reminders</span></button></div>
                        </div>
                        <div className="switch-row">
                          <div className="switch-copy"><h4>Missed call follow-up</h4><p>Sent when caller hangs up without reaching anyone.</p></div>
                          <div className="switch-stack"><button type="button" className={`switch ${currentForm.send_missed_call_followup_sms ? 'on' : ''}`} onClick={() => patchState('send_missed_call_followup_sms', !currentForm.send_missed_call_followup_sms)}><span className="sr-only">Toggle missed call follow-up</span></button></div>
                        </div>
                        <div className={`switch-row ${isLocked('edit_review_request_sms') ? 'locked' : ''}`}>
                          <div className="switch-copy">
                            <div className="switch-title-row"><h4>Review requests</h4>{renderLockCopy('edit_review_request_sms')}</div>
                            <p>Sent 4 hours after appointment. Only sends when business website is set.</p>
                          </div>
                          <div className="switch-stack"><button type="button" className={`switch ${currentForm.send_review_request_sms ? 'on' : ''}`} disabled={isLocked('edit_review_request_sms')} onClick={() => patchState('send_review_request_sms', !currentForm.send_review_request_sms)}><span className="sr-only">Toggle review requests</span></button></div>
                        </div>
                        <div className="switch-row locked">
                          <div className="switch-copy"><h4>Booking link</h4><p>Sent by AI during a call when caller needs a link. AI-initiated and cannot be disabled.</p></div>
                          <div className="switch-stack"><button type="button" className="switch locked" disabled><span className="sr-only">Booking link SMS is AI initiated</span></button></div>
                        </div>
                      </div>
                    </section>

                    <section className="settings-sms-panel">
                      <h4>OWNER NOTIFICATIONS</h4>
                      <div className="switch-list">
                        <div className="switch-row">
                          <div className="switch-copy"><h4>Call summaries</h4><p>After each AI-handled call.</p></div>
                          <div className="switch-stack"><button type="button" className={`switch ${currentForm.send_call_summary_sms ? 'on' : ''}`} onClick={() => patchState('send_call_summary_sms', !currentForm.send_call_summary_sms)}><span className="sr-only">Toggle call summaries</span></button></div>
                        </div>
                        <div className="field">
                          <label>Send during</label>
                          <select value={currentForm.owner_call_summary_sms_timing} onChange={(event) => patchState('owner_call_summary_sms_timing', event.target.value as 'business_hours' | 'always')}>
                            <option value="business_hours">Business hours only</option>
                            <option value="always">Always</option>
                          </select>
                        </div>
                        <div className="switch-row">
                          <div className="switch-copy"><h4>Follow-up request alerts</h4><p>Text the owner when a caller asks the team to follow up.</p></div>
                          <div className="switch-stack"><button type="button" className={`switch ${currentForm.send_callback_request_sms ? 'on' : ''}`} onClick={() => patchState('send_callback_request_sms', !currentForm.send_callback_request_sms)}><span className="sr-only">Toggle follow-up request alerts</span></button></div>
                        </div>
                        <div className="field">
                          <label>Send</label>
                          <select value={currentForm.owner_callback_request_sms_timing} onChange={(event) => patchState('owner_callback_request_sms_timing', event.target.value as 'business_hours' | 'always')}>
                            <option value="always">Always</option>
                            <option value="business_hours">Business hours only</option>
                          </select>
                        </div>
                        <div className="switch-row">
                          <div className="switch-copy"><h4>End of day digest</h4><p>Summary of all calls and bookings.</p></div>
                          <div className="switch-stack"><button type="button" className={`switch ${currentForm.send_daily_digest_sms ? 'on' : ''}`} onClick={() => patchState('send_daily_digest_sms', !currentForm.send_daily_digest_sms)}><span className="sr-only">Toggle end of day digest</span></button></div>
                        </div>
                        <div className="field">
                          <label>Send at</label>
                          <input type="time" value={currentForm.owner_daily_digest_time} onChange={(event) => patchState('owner_daily_digest_time', event.target.value)} />
                        </div>
                        <div className="note">Handoff alerts are always on and cannot be disabled.</div>
                      </div>
                    </section>

                    <section className="settings-sms-panel">
                      <h4>QUIET HOURS</h4>
                      <p className="sub">No SMS sent outside this window in shop local time.</p>
                      <div className="form-grid">
                        <div className="field">
                          <label>Start</label>
                          <input type="time" value={currentForm.sms_quiet_hours_start} onChange={(event) => patchState('sms_quiet_hours_start', event.target.value)} />
                        </div>
                        <div className="field">
                          <label>End</label>
                          <input type="time" value={currentForm.sms_quiet_hours_end} onChange={(event) => patchState('sms_quiet_hours_end', event.target.value)} />
                        </div>
                      </div>
                      <p className="sub">Applies to customer and owner notifications above.</p>
                    </section>
                  </div>
                </div>
                <div className="settings-save-footer settings-tab-content-frame">
                  <button type="submit" className="btn user-save" disabled={savingSection !== null}>
                    {savingSection === 'sms-notifications' ? 'Saving...' : 'Save SMS settings'}
                  </button>
                </div>
              </form>
              ) : null}
            </section>
            ) : null}

            {activeTab === 'messaging' ? (
            <section className="card">
              <div className="business-subtabs" role="tablist" aria-label="Messaging sections">
                <button type="button" role="tab" aria-selected={messagingSubTab === 'automations'} className={`business-subtab ${messagingSubTab === 'automations' ? 'active' : ''}`} onClick={() => setMessagingSubTab('automations')}>
                  SMS automations
                </button>
                <button type="button" role="tab" aria-selected={messagingSubTab === 'notes'} className={`business-subtab ${messagingSubTab === 'notes' ? 'active' : ''}`} onClick={() => setMessagingSubTab('notes')}>
                  Messaging notes
                </button>
              </div>
              {messagingSubTab === 'automations' ? (
              <form
                className="card-section-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitSettingsPatch('messaging', {
                    send_reminder_sms: currentForm.send_reminder_sms,
                    send_review_request_sms: currentForm.send_review_request_sms,
                    send_missed_call_followup_sms: currentForm.send_missed_call_followup_sms,
                  });
                }}
              >
                <div className="switch-list">
                  <div className="switch-row">
                    <div className="switch-copy"><h4>Missed-call follow-up SMS</h4><p>Send a quick text when a caller hangs up before the salon team can connect.</p></div>
                    <div className="switch-stack">
                      <button type="button" className={`switch ${currentForm.send_missed_call_followup_sms ? 'on' : ''}`} onClick={() => patchState('send_missed_call_followup_sms', !currentForm.send_missed_call_followup_sms)} />
                    </div>
                  </div>
                  <div className="switch-row">
                    <div className="switch-copy">
                      <div className="switch-title-row">
                        <h4>Reminder SMS</h4>
                        {renderLockCopy('edit_reminder_sms')}
                      </div>
                      <p>Automatic appointment reminders that reduce no-shows.</p>
                    </div>
                    <div className="switch-stack">
                      <button type="button" className={`switch ${currentForm.send_reminder_sms ? 'on' : ''}`} disabled={isLocked('edit_reminder_sms')} onClick={() => patchState('send_reminder_sms', !currentForm.send_reminder_sms)} />
                    </div>
                  </div>
                  <div className="switch-row">
                    <div className="switch-copy">
                      <div className="switch-title-row">
                        <h4>Review request SMS</h4>
                        {renderLockCopy('edit_review_request_sms')}
                      </div>
                      <p>Follow up completed appointments with a review request.</p>
                    </div>
                    <div className="switch-stack">
                      <button type="button" className={`switch ${currentForm.send_review_request_sms ? 'on' : ''}`} disabled={isLocked('edit_review_request_sms')} onClick={() => patchState('send_review_request_sms', !currentForm.send_review_request_sms)} />
                    </div>
                  </div>
                </div>
                <div className="settings-save-footer settings-tab-content-frame">
                  <button type="submit" className="btn user-save" disabled={savingSection !== null}>
                    {savingSection === 'messaging' ? 'Saving...' : 'Save messaging'}
                  </button>
                </div>
              </form>
              ) : null}

              {messagingSubTab === 'notes' ? (
              <div className="card-section-form">
                <div className="card-section settings-tab-content-frame">
                  <div className="note">Reminder and review request controls unlock by plan. Missed-call follow-up stays available because it directly protects lost revenue from unanswered calls.</div>
                </div>
              </div>
              ) : null}
            </section>
            ) : null}

          </div>

          {portal === 'knowledge' ? (
            <>
              <BottomSheet
                isOpen={knowledgeAddressSheetOpen}
                onClose={() => setKnowledgeAddressSheetOpen(false)}
                title="Edit Address"
              >
                <div className="onb-sheet-field">
                  <div className="onb-sheet-label">Address</div>
                  <textarea
                    className="onb-sheet-input"
                    rows={4}
                    value={knowledgeAddressDraft}
                    onChange={(event) => setKnowledgeAddressDraft(event.target.value)}
                    style={{ minHeight: 100, resize: 'vertical' }}
                  />
                </div>
                <div className="onb-sheet-actions">
                  <button type="button" className="onb-sheet-cancel" onClick={() => setKnowledgeAddressSheetOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="onb-sheet-save"
                    onClick={() => {
                      patchState('address', knowledgeAddressDraft);
                      setKnowledgeAddressSheetOpen(false);
                    }}
                  >
                    Save
                  </button>
                </div>
              </BottomSheet>

              <BottomSheet
                isOpen={knowledgeLegacyMobileSheet !== null}
                onClose={() => {
                  setKnowledgeLegacyMobileSheet(null);
                  setKnowledgeLegacyMobileError(null);
                }}
                title="Edit Service"
              >
                {knowledgeLegacyMobileSheet ? (
                  <>
                    <div className="field">
                      <label>service name</label>
                      <input
                        value={knowledgeLegacyMobileSheet.draft.name}
                        onChange={(event) =>
                          setKnowledgeLegacyMobileSheet({
                            ...knowledgeLegacyMobileSheet,
                            draft: { ...knowledgeLegacyMobileSheet.draft, name: event.target.value },
                          })
                        }
                        placeholder="Gel Manicure"
                      />
                      <p className="service-name-edit-hint">Shorten so callers can understand</p>
                    </div>
                    <div className="service-item-head" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="field">
                        <label>duration</label>
                        <input
                          type="number"
                          min={1}
                          value={knowledgeLegacyMobileSheet.draft.duration_min || ''}
                          onChange={(event) =>
                            setKnowledgeLegacyMobileSheet({
                              ...knowledgeLegacyMobileSheet,
                              draft: {
                                ...knowledgeLegacyMobileSheet.draft,
                                duration_min: event.target.value === '' ? 0 : Number(event.target.value),
                              },
                            })
                          }
                          placeholder="60"
                        />
                      </div>
                      <div className="field">
                        <label>price</label>
                        <input
                          type="number"
                          min={0}
                          value={knowledgeLegacyMobileSheet.draft.price}
                          onChange={(event) =>
                            setKnowledgeLegacyMobileSheet({
                              ...knowledgeLegacyMobileSheet,
                              draft: { ...knowledgeLegacyMobileSheet.draft, price: Number(event.target.value) },
                            })
                          }
                        />
                      </div>
                    </div>
                    {knowledgeLegacyMobileError ? (
                      <p className="catalog-service-dialog-error" style={{ marginTop: 8 }}>
                        {knowledgeLegacyMobileError}
                      </p>
                    ) : null}
                    <div className="onb-sheet-actions">
                      <button type="button" className="onb-sheet-cancel" onClick={() => setKnowledgeLegacyMobileSheet(null)}>
                        Cancel
                      </button>
                      <button type="button" className="onb-sheet-save" onClick={() => saveKnowledgeLegacyMobileSheet()}>
                        Save
                      </button>
                    </div>
                  </>
                ) : null}
              </BottomSheet>

              <BottomSheet
                isOpen={knowledgeStaffAddSheetOpen}
                onClose={() => setKnowledgeStaffAddSheetOpen(false)}
                title="Add Staff"
              >
                <div className="form-grid" style={{ gap: 12 }}>
                  <div className="field">
                    <label>Name</label>
                    <input
                      value={knowledgeStaffAddDraft.name}
                      onChange={(event) => setKnowledgeStaffAddDraft({ ...knowledgeStaffAddDraft, name: event.target.value })}
                      placeholder="Sarah"
                    />
                  </div>
                  <div className="field">
                    <label>Role / title</label>
                    <input
                      value={knowledgeStaffAddDraft.role ?? ''}
                      onChange={(event) => setKnowledgeStaffAddDraft({ ...knowledgeStaffAddDraft, role: event.target.value })}
                      placeholder="Nail technician"
                    />
                  </div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>Specialties</label>
                    <input
                      value={(knowledgeStaffAddDraft.specialties ?? []).join(', ')}
                      onChange={(event) =>
                        setKnowledgeStaffAddDraft({
                          ...knowledgeStaffAddDraft,
                          specialties: event.target.value
                            .split(',')
                            .map((value) => value.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Gel nails, nail art, pedicure"
                    />
                  </div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>Notes for AI</label>
                    <textarea
                      value={knowledgeStaffAddDraft.notes ?? ''}
                      onChange={(event) => setKnowledgeStaffAddDraft({ ...knowledgeStaffAddDraft, notes: event.target.value })}
                      placeholder="Optional. Example: Available Tuesday-Friday."
                    />
                  </div>
                </div>
                <div className="onb-sheet-actions">
                  <button type="button" className="onb-sheet-cancel" onClick={() => setKnowledgeStaffAddSheetOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="onb-sheet-save"
                    disabled={!knowledgeStaffAddDraft.name.trim()}
                    onClick={() => {
                      const name = knowledgeStaffAddDraft.name.trim();
                      if (!name) return;
                      patchState('staff', [
                        ...currentForm.staff,
                        {
                          ...knowledgeStaffAddDraft,
                          name,
                          role: knowledgeStaffAddDraft.role?.trim() || null,
                          specialties: (knowledgeStaffAddDraft.specialties ?? []).map((value) => value.trim()).filter(Boolean),
                          notes: knowledgeStaffAddDraft.notes?.trim() || null,
                          active: knowledgeStaffAddDraft.active !== false,
                        },
                      ]);
                      setExpandedStaffIndex(currentForm.staff.length);
                      setKnowledgeStaffAddSheetOpen(false);
                    }}
                  >
                    Save
                  </button>
                </div>
              </BottomSheet>

              <BottomSheet
                isOpen={knowledgeFaqCreateSheetOpen}
                onClose={() => setKnowledgeFaqCreateSheetOpen(false)}
                title="Create FAQ"
              >
                <div className="field">
                  <label>Question</label>
                  <input
                    value={knowledgeFaqCreateDraft.question}
                    onChange={(event) => setKnowledgeFaqCreateDraft({ ...knowledgeFaqCreateDraft, question: event.target.value })}
                    placeholder="e.g. Do you take walk-ins?"
                  />
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <label>Answer</label>
                  <textarea
                    value={knowledgeFaqCreateDraft.answer}
                    onChange={(event) => setKnowledgeFaqCreateDraft({ ...knowledgeFaqCreateDraft, answer: event.target.value })}
                    placeholder="Approved answer callers should hear."
                    rows={4}
                  />
                </div>
                <div className="onb-sheet-actions">
                  <button type="button" className="onb-sheet-cancel" onClick={() => setKnowledgeFaqCreateSheetOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="onb-sheet-save"
                    disabled={!knowledgeFaqCreateDraft.question.trim() || !knowledgeFaqCreateDraft.answer.trim()}
                    onClick={() => {
                      const q = knowledgeFaqCreateDraft.question.trim();
                      const a = knowledgeFaqCreateDraft.answer.trim();
                      if (!q || !a) return;
                      patchState('faqs', [...currentForm.faqs, { question: q, answer: a }]);
                      setKnowledgeFaqCreateSheetOpen(false);
                    }}
                  >
                    Save
                  </button>
                </div>
              </BottomSheet>

              <BottomSheet
                isOpen={knowledgeCatalogMobileSheet !== null}
                onClose={() => {
                  setKnowledgeCatalogMobileSheet(null);
                  setKnowledgeCatalogMobileError(null);
                }}
                title="Edit Service"
              >
                {knowledgeCatalogMobileSheet ? (() => {
                  const draft = knowledgeCatalogMobileSheet.draft;
                  const showPrice = draft.priceType !== 'consultation' && draft.priceType !== 'varies';
                  return (
                    <>
                      <div className="flex flex-col gap-3">
                        <div className="service-item-head service-item-head--catalog-pair">
                          <div className="field">
                            <label>service name</label>
                            <input
                              value={draft.name}
                              onChange={(event) => patchKnowledgeCatalogMobileDraft({ name: event.target.value })}
                              placeholder="Gel Manicure"
                              className="w-full"
                            />
                            <p className="service-name-edit-hint">Shorten so callers can understand</p>
                          </div>
                          <div className="field">
                            <label>move to group</label>
                            <select
                              className="w-full"
                              value={draft.categoryId ?? ''}
                              onChange={(event) => patchKnowledgeCatalogMobileDraft({ categoryId: event.target.value || null })}
                            >
                              {currentForm.service_catalog.categories.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="field">
                          <label>description</label>
                          <input
                            className="w-full"
                            value={draft.description ?? ''}
                            onChange={(event) => patchKnowledgeCatalogMobileDraft({ description: event.target.value || null })}
                            placeholder="Optional caller-facing details"
                          />
                        </div>
                        <div className={showPrice ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-2 gap-3'}>
                          <div className="field min-w-0">
                            <label className="text-xs text-[var(--text-gray)]">duration</label>
                            <input
                              className="w-full"
                              value={serviceDurationText(draft)}
                              onChange={(event) => {
                                const durationText = event.target.value;
                                patchKnowledgeCatalogMobileDraft({
                                  durationText: durationText.trim() ? durationText : null,
                                  durationMinutes: parseDurationTextToMinutes(durationText),
                                });
                              }}
                              placeholder="60 min, 1 hour+, Varies"
                            />
                          </div>
                          <div className="field min-w-0">
                            <label className="text-xs text-[var(--text-gray)]">price type</label>
                            <select
                              className="w-full"
                              value={draft.priceType}
                              onChange={(event) =>
                                patchKnowledgeCatalogMobileDraft({ priceType: event.target.value as ServicePriceType })
                              }
                            >
                              {PRICE_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          {showPrice ? (
                            <div className="field min-w-0">
                              <label className="text-xs text-[var(--text-gray)]">price</label>
                              <input
                                className="w-full"
                                type="number"
                                min={0}
                                value={draft.priceAmount ?? 0}
                                onChange={(event) => patchKnowledgeCatalogMobileDraft({ priceAmount: Number(event.target.value) })}
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="field">
                          <label>aliases / other names customers use</label>
                          <input
                            className="w-full"
                            value={draft.aliases.join(', ')}
                            onChange={(event) =>
                              patchKnowledgeCatalogMobileDraft({
                                aliases: event.target.value
                                  .split(',')
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="gel mani, shellac"
                          />
                        </div>
                        <div className="field">
                          <label>booking notes</label>
                          <textarea
                            className="w-full min-h-[64px] resize-y"
                            rows={2}
                            value={draft.bookingNotes ?? ''}
                            onChange={(event) => patchKnowledgeCatalogMobileDraft({ bookingNotes: event.target.value || null })}
                            placeholder="Anything the AI should know before capturing this request."
                          />
                        </div>
                        <div className="field mt-1">
                          <label>options / variants</label>
                          <p className="field-help mt-0 mb-2">Use options when a service has different lengths or prices.</p>
                          <div className="service-variants-editor">
                            {(draft.variants ?? []).map((variant, variantIndex) => (
                              <div className="service-variant-row" key={`${knowledgeCatalogMobileSheet.serviceId}-variant-${variantIndex}`}>
                                <input
                                  value={variant.label}
                                  onChange={(event) => patchKnowledgeMobileVariant(variantIndex, { label: event.target.value })}
                                  placeholder="30 min"
                                />
                                <input
                                  value={variant.durationText ?? ''}
                                  onChange={(event) => {
                                    const durationText = event.target.value;
                                    patchKnowledgeMobileVariant(variantIndex, {
                                      durationText: durationText || null,
                                      durationMinutes: parseDurationTextToMinutes(durationText),
                                    });
                                  }}
                                  placeholder="Duration"
                                />
                                <input
                                  type="number"
                                  min={0}
                                  value={variant.priceAmount ?? ''}
                                  onChange={(event) =>
                                    patchKnowledgeMobileVariant(variantIndex, {
                                      priceAmount: event.target.value === '' ? null : Number(event.target.value),
                                    })
                                  }
                                  placeholder="Price"
                                />
                                <select
                                  value={variant.priceType ?? 'from'}
                                  onChange={(event) =>
                                    patchKnowledgeMobileVariant(variantIndex, {
                                      priceType: event.target.value as ServicePriceType,
                                    })
                                  }
                                >
                                  {PRICE_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <button type="button" className="subtle-link" onClick={() => removeKnowledgeMobileVariantRow(variantIndex)}>
                                  Remove
                                </button>
                              </div>
                            ))}
                            <button type="button" className="btn ghost" onClick={() => addKnowledgeMobileVariantRow()}>
                              + Add option
                            </button>
                          </div>
                        </div>
                      </div>
                      <label className="inline-check mt-2 block">
                        <input
                          type="checkbox"
                          checked={draft.bookable}
                          onChange={(event) => patchKnowledgeCatalogMobileDraft({ bookable: event.target.checked })}
                        />
                        Bookable by request
                      </label>
                      <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                        <button
                          type="button"
                          className="subtle-link catalog-service-dialog-link-remove"
                          onClick={() => {
                            const sid = knowledgeCatalogMobileSheet.serviceId;
                            const label = draft.name.trim() || 'this service';
                            if (!window.confirm(`Remove ${label}? This cannot be undone.`)) return;
                            removeCatalogService(sid);
                          }}
                        >
                          Remove
                        </button>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="onb-sheet-cancel"
                            onClick={() => {
                              setKnowledgeCatalogMobileSheet(null);
                              setKnowledgeCatalogMobileError(null);
                            }}
                          >
                            Cancel
                          </button>
                          <button type="button" className="onb-sheet-save" onClick={() => saveKnowledgeCatalogMobileSheet()}>
                            Save
                          </button>
                        </div>
                      </div>
                      {knowledgeCatalogMobileError ? (
                        <p className="catalog-service-dialog-error mt-2">{knowledgeCatalogMobileError}</p>
                      ) : null}
                    </>
                  );
                })() : null}
              </BottomSheet>
            </>
          ) : null}

          </UserPortalPageContent>
        </main>
      </div>
      <UserPortalMobileTabbar active={sidebarNav} />
      </>
    </UserLayout>
  );
}
