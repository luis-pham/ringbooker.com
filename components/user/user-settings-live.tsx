'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import type { UserPortalNavKey } from '@/components/user/user-portal-nav';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import {
  USER_PORTAL_TOPBAR_ACTIONS_CLASS,
  UserPortalStandardTopActions,
} from '@/components/user/user-portal-standard-top-actions';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';
import { useUserWorkspace } from '@/components/user/user-workspace-context';
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
  durationMinutes?: number | null;
  priceAmount?: number | null;
  priceCurrency: string;
  priceType: ServicePriceType;
  bookable: boolean;
  active: boolean;
  sortOrder: number;
  aliases: string[];
  bookingNotes?: string | null;
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
type ShopSettings = {
  id: string;
  name: string;
  vertical?: string | null;
  phone_number: string;
  user_name?: string | null;
  user_phone: string;
  backup_phone?: string | null;
  address?: string | null;
  timezone: string;
  services: ServiceItem[];
  service_catalog?: ShopServiceCatalog | null;
  staff?: StaffMember[];
  faqs?: BusinessFaqItem[];
  hours: Record<string, BusinessHoursEntry>;
  cancel_policy: string;
  promotions?: string | null;
  booking_url?: string | null;
  website_url?: string | null;
  ai_voice?: string | null;
  ai_welcome_message?: string | null;
  ai_custom_instructions?: string | null;
  languages?: string[] | null;
  allow_transfers: boolean;
  allow_callbacks: boolean;
  send_reminder_sms: boolean;
  send_review_request_sms: boolean;
  send_missed_call_followup_sms: boolean;
  plan: ShopPlan;
  active: boolean;
};
type ShopCapabilities = Record<
  | 'edit_business_profile'
  | 'edit_booking_url'
  | 'edit_cancel_policy'
  | 'edit_promotions'
  | 'edit_services'
  | 'edit_hours'
  | 'edit_transfer_settings'
  | 'edit_callback_settings'
  | 'edit_missed_call_followup_sms'
  | 'edit_ai_voice'
  | 'edit_ai_greeting'
  | 'edit_reminder_sms'
  | 'edit_review_request_sms'
  | 'edit_ai_custom_instructions',
  boolean
>;

type UserSettingsResponse = {
  ok: boolean;
  shop?: ShopSettings;
  capabilities?: ShopCapabilities;
  serviceCatalogEnabled?: boolean;
  /** When true, Settings shows a Go live tab first until live answering is enabled. */
  showGoLiveSettingsTab?: boolean;
  error?: string;
  fields?: string[];
};

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
  user_name: string;
  user_phone: string;
  backup_phone: string;
  address: string;
  timezone: string;
  booking_url: string;
  website_url: string;
  cancel_policy: string;
  promotions: string;
  services: ServiceItem[];
  service_catalog: ShopServiceCatalog;
  staff: StaffMember[];
  faqs: BusinessFaqItem[];
  hours: Record<string, BusinessHoursEntry>;
  ai_voice: string;
  ai_welcome_message: string;
  ai_custom_instructions: string;
  languages: string[];
  allow_transfers: boolean;
  allow_callbacks: boolean;
  send_reminder_sms: boolean;
  send_review_request_sms: boolean;
  send_missed_call_followup_sms: boolean;
};

type SettingsTabId =
  | 'business'
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
  'Thanks for calling {business}. How can I help you today?',
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
    case 'services-hours':
      return wrap(
        <>
          <rect x={3} y={4} width={18} height={18} rx={2} />
          <path d="M16 2v4M8 2v4M3 10h18" />
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
  business: { label: 'Business', description: 'Profile, policy, and promo details.' },
  'services-hours': { label: 'Services & Hours', description: 'What you offer and when you are open.' },
  staff: { label: 'Staff', description: 'Technicians, specialists, and provider preferences.' },
  faq: { label: 'FAQ', description: 'Common caller questions and approved answers.' },
  'ai-call-behavior': { label: 'AI Call Behavior', description: 'Voice, greeting, and call handling.' },
  messaging: { label: 'Messaging', description: 'Reminders, reviews, and follow-up SMS.' },
  integrations: { label: 'Integrations', description: 'Square, Vagaro, or booking page links.' },
};

const SETTINGS_PORTAL_TAB_ORDER: Record<UserSettingsPortal, SettingsTabId[]> = {
  'ai-settings': ['ai-call-behavior', 'messaging'],
  knowledge: ['business', 'services-hours', 'staff', 'faq'],
  integrations: ['integrations'],
};

function tabCopyForPortal(portal: UserSettingsPortal, id: SettingsTabId): { label: string; description: string } {
  if (portal === 'knowledge' && id === 'business') {
    return {
      label: 'Business info',
      description: 'Name, address, contact lines, policies, and promos.',
    };
  }
  if (portal === 'ai-settings' && id === 'ai-call-behavior') {
    return {
      label: 'AI voice & tone',
      description: 'Greeting, voice, handling rules, and extra instructions for callers.',
    };
  }
  return SETTINGS_TAB_META[id];
}

function visibleTabsForPortal(portal: UserSettingsPortal): Array<{ id: SettingsTabId; label: string; description: string }> {
  return SETTINGS_PORTAL_TAB_ORDER[portal].map((id) => ({ id, ...tabCopyForPortal(portal, id) }));
}

const REQUIRED_PLAN_BY_CAPABILITY: Partial<Record<keyof ShopCapabilities, ShopPlan>> = {
  edit_transfer_settings: 'professional',
  edit_ai_voice: 'professional',
  edit_ai_greeting: 'professional',
  edit_reminder_sms: 'professional',
  edit_review_request_sms: 'professional',
  edit_ai_custom_instructions: 'enterprise',
};

function cloneHours(hours: Record<string, BusinessHoursEntry>) {
  return JSON.parse(JSON.stringify(hours)) as Record<string, BusinessHoursEntry>;
}

function clientId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
        durationMinutes: service.duration_min || 60,
        priceAmount: Number.isFinite(service.price) ? service.price : 0,
        priceCurrency: 'USD',
        priceType: service.price > 0 ? 'fixed' : 'varies',
        bookable: true,
        active: true,
        sortOrder: index,
        aliases: [],
        bookingNotes: null,
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
    }));
}

function normalizeGreeting(template: string, shopName: string) {
  return template.replaceAll('{business}', shopName || 'your salon').replaceAll('{shop}', shopName || 'your salon');
}

function buildInitialState(shop: ShopSettings): SettingsState {
  return {
    name: shop.name ?? '',
    user_name: shop.user_name ?? '',
    user_phone: shop.user_phone,
    backup_phone: shop.backup_phone ?? '',
    address: shop.address ?? '',
    timezone: shop.timezone,
    booking_url: shop.booking_url ?? '',
    website_url: shop.website_url ?? '',
    cancel_policy: shop.cancel_policy,
    promotions: shop.promotions ?? '',
    services: shop.services,
    service_catalog: ensureEditableCatalog(shop.service_catalog ?? catalogFromLegacyServices(shop.services, shop.id), shop.id),
    staff: shop.staff ?? [],
    faqs: shop.faqs ?? [],
    hours: cloneHours(shop.hours),
    ai_voice: shop.ai_voice ?? 'Aoede',
    ai_welcome_message: shop.ai_welcome_message ?? normalizeGreeting(AI_GREETING_PRESETS[0], shop.name),
    ai_custom_instructions: shop.ai_custom_instructions ?? '',
    languages: normalizeUserLanguages(shop.languages),
    allow_transfers: shop.allow_transfers,
    allow_callbacks: shop.allow_callbacks,
    send_reminder_sms: shop.send_reminder_sms,
    send_review_request_sms: shop.send_review_request_sms,
    send_missed_call_followup_sms: shop.send_missed_call_followup_sms,
  };
}

const DEFAULT_SETTINGS_SHOP: ShopSettings = {
  id: 'loading',
  name: 'Your business',
  vertical: null,
  phone_number: '',
  user_name: '',
  user_phone: '',
  backup_phone: '',
  address: '',
  timezone: 'America/Los_Angeles',
  services: [],
  service_catalog: { categories: [], services: [] },
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
  allow_callbacks: true,
  send_reminder_sms: false,
  send_review_request_sms: false,
  send_missed_call_followup_sms: true,
  plan: 'starter',
  active: false,
};

const DEFAULT_SETTINGS_CAPABILITIES: ShopCapabilities = {
  edit_business_profile: true,
  edit_booking_url: true,
  edit_cancel_policy: true,
  edit_promotions: true,
  edit_services: true,
  edit_hours: true,
  edit_transfer_settings: false,
  edit_callback_settings: true,
  edit_missed_call_followup_sms: true,
  edit_ai_voice: false,
  edit_ai_greeting: false,
  edit_reminder_sms: false,
  edit_review_request_sms: false,
  edit_ai_custom_instructions: false,
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

export function UserSettingsLive({ portal = 'ai-settings' }: { portal?: UserSettingsPortal }) {
  const { setWorkspace } = useUserWorkspace();
  const sidebarNav = userSettingsPortalNavKey(portal);
  const portalHead =
    portal === 'knowledge'
      ? {
          title: 'Business Knowledge',
          subtitle:
            'Teach RingBooker what to say on calls: business info, services, hours, staff, FAQs, and policies.',
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

  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [capabilities, setCapabilities] = useState<ShopCapabilities | null>(null);
  const [serviceCatalogEnabled, setServiceCatalogEnabled] = useState(false);
  const [form, setForm] = useState<SettingsState | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [cancelPreset, setCancelPreset] = useState<string>('custom');
  const [promoPreset, setPromoPreset] = useState<string>('custom');
  const [greetingPreset, setGreetingPreset] = useState<string>('custom');
  const [hourPreset, setHourPreset] = useState<string>('custom');
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
  const [vagaroBookingUrl, setVagaroBookingUrl] = useState('');
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
  const [servicesHoursSubTab, setServicesHoursSubTab] = useState<'services' | 'hours'>('services');
  const [behaviorSubTab, setBehaviorSubTab] = useState<'handling' | 'voice'>('voice');
  const [messagingSubTab, setMessagingSubTab] = useState<'automations' | 'notes'>('automations');
  const [businessKnowledgeSubTab, setBusinessKnowledgeSubTab] = useState<'info' | 'cancellation' | 'promotion'>('info');

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

  useEffect(() => {
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
        if (h === '#integrations' && allowedIds.has('integrations')) {
          nextTab = 'integrations';
        }
        setActiveTab(nextTab);
      })
      .catch(() => {
        if (active) setStatus('network_error');
      });
    return () => {
      active = false;
    };
  }, [portal]);

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
      if (h === '#integrations' && allowedIds.has('integrations')) {
        setActiveTab('integrations');
        return;
      }
      if (h === '#integrations' && !allowedIds.has('integrations')) {
        const base = `${window.location.pathname}${window.location.search}`;
        window.history.replaceState(null, '', base);
      }
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [portal]);

  async function loadCalendarProviders() {
    setLoadingCalendarProviders(true);
    try {
      const response = await fetch('/api/backend/user/calendar/providers');
      const body = (await response.json()) as CalendarProvidersResponse;
      if (!response.ok || !body.ok || !body.providers) {
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
    void loadCalendarProviders();
  }, []);

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
      const response = await fetch(`/api/backend/user/calendar/providers/${providerId}/connect`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookingUrl }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) {
        const message = body.error ?? 'booking_link_save_failed';
        setBookingLinkErrors((current) => ({ ...current, [providerId]: message }));
        setCalendarStatus(message);
        return;
      }
      setCalendarStatus('Booking link saved.');
      setEditingBookingLinkProvider(null);
      await loadCalendarProviders();
    } catch {
      setBookingLinkErrors((current) => ({ ...current, [providerId]: 'booking_link_save_failed' }));
      setCalendarStatus('booking_link_save_failed');
    } finally {
      setSavingBookingLinkProvider(null);
    }
  }

  async function saveVagaroBookingLink() {
    const bookingUrl = vagaroBookingUrl.trim();
    setVagaroBookingUrlError(null);
    setSavingVagaroBookingUrl(true);
    try {
      const response = await fetch('/api/backend/user/calendar/providers/vagaro/booking-url', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookingUrl }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string; bookingUrl?: string };
      if (!response.ok || !body.ok) {
        const message = body.error ?? 'vagaro_booking_link_save_failed';
        setVagaroBookingUrlError(message);
        setCalendarStatus(message);
        return;
      }
      if (body.bookingUrl) setVagaroBookingUrl(body.bookingUrl);
      setCalendarStatus('Vagaro booking link saved.');
      await loadCalendarProviders();
    } catch {
      setVagaroBookingUrlError('vagaro_booking_link_save_failed');
      setCalendarStatus('vagaro_booking_link_save_failed');
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
  const bilingualAnsweringUx = getBilingualAnsweringPlanUx(effectiveShop.plan);
  const returningCallerNotesUx = getReturningCallerNotesPlanUx(effectiveShop.plan);

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
    patchState('services', [...currentForm.services, { name: '', duration_min: 60, price: 0 }]);
  }

  function updateLegacyService(index: number, patch: Partial<ServiceItem>) {
    patchState(
      'services',
      currentForm.services.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function removeLegacyService(index: number) {
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
    patchServiceCatalog({
      ...currentForm.service_catalog,
      services: [
        ...currentForm.service_catalog.services,
        {
          id: clientId('service'),
          shopId: effectiveShop.id,
          categoryId,
          name: '',
          description: null,
          durationMinutes: 60,
          priceAmount: 0,
          priceCurrency: 'USD',
          priceType: 'varies',
          bookable: true,
          active: true,
          sortOrder: groupCount,
          aliases: [],
          bookingNotes: null,
        },
      ],
    });
  }

  function updateCatalogService(serviceId: string, patch: Partial<ShopService>) {
    patchServiceCatalog({
      ...currentForm.service_catalog,
      services: currentForm.service_catalog.services.map((service) =>
        service.id === serviceId ? { ...service, ...patch } : service,
      ),
    });
  }

  function applySuggestedGroups() {
    const examples = SERVICE_GROUP_EXAMPLES[effectiveShop.vertical ?? ''] ?? [];
    const existing = new Set(currentForm.service_catalog.categories.map((category) => category.name.trim().toLowerCase()));
    const toAdd = examples.filter((name) => !existing.has(name.toLowerCase()));
    if (toAdd.length === 0) {
      setStatus('Suggested groups are already added.');
      return;
    }
    const next = ensureEditableCatalog(currentForm.service_catalog, effectiveShop.id);
    patchServiceCatalog({
      ...next,
      categories: [
        ...next.categories,
        ...toAdd.map((name, index) => ({
          id: clientId('service-category'),
          shopId: effectiveShop.id,
          name,
          description: null,
          sortOrder: next.categories.length + index,
          active: true,
        })),
      ],
    });
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
      setStatus('settings_still_loading');
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
          setStatus(`Upgrade required for: ${body.fields.join(', ')}`);
          return;
        }
        setStatus(body.error ?? 'save_failed');
        return;
      }
      const nextShop = body.shop;
      setShop(nextShop);
      setCapabilities(body.capabilities);
      setServiceCatalogEnabled(body.serviceCatalogEnabled === true);
      const nextState = buildInitialState(nextShop);
      setForm(nextState);
      setCancelPreset(getPresetMatch(nextState.cancel_policy, CANCEL_POLICY_PRESETS));
      setPromoPreset(getPresetMatch(nextState.promotions, PROMOTION_PRESETS));
      setGreetingPreset(
        getPresetMatch(
          nextState.ai_welcome_message,
          AI_GREETING_PRESETS.map((item) => normalizeGreeting(item, nextShop.name)),
        ),
      );
      setHourPreset(getHourPresetId(nextState.hours));
      setStatus('saved');
    } catch {
      setStatus('network_error');
    } finally {
      setSavingSection(null);
    }
  }

  function isLocked(capability: keyof ShopCapabilities) {
    return !currentCapabilities[capability];
  }

  function renderLockCopy(capability: keyof ShopCapabilities) {
    const requiredPlan = REQUIRED_PLAN_BY_CAPABILITY[capability];
    if (!requiredPlan) return null;
    return (
      <span className="lock-copy">
        Unlock with {requiredPlan[0].toUpperCase()}
        {requiredPlan.slice(1)}
      </span>
    );
  }

  return (
    <UserLayout styles={userSettingsStyles} scripts={userSettingsScripts} scriptPrefix="user-settings-live">
      <>
      <div className="app-shell user-app-shell">
        <UserPortalSidebar active={sidebarNav} />

        <main className="main">
          <UserPortalTopbar
            title={portalHead.title}
            subtitle={portalHead.subtitle}
            actionsClassName={USER_PORTAL_TOPBAR_ACTIONS_CLASS}
            actions={<UserPortalStandardTopActions />}
          />

          {!settingsReady && status ? (
            <div className="note" style={{ marginBottom: 18 }}>
              Unable to load settings: {status}
            </div>
          ) : null}

          {portal !== 'integrations' ? (
          <div className="tab-strip" role="tablist" aria-label={portal === 'knowledge' ? 'Business Knowledge tabs' : 'AI Settings tabs'}>
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
          ) : null}

          <div className="section-stack">
            {activeTab === 'integrations' ? (
            <section className="card">
              <div className="panel-head">
                <div>
                  <h3>Integrations</h3>
                  <p className="sub">
                    Connect where your live appointments are stored. Most businesses only need one option below.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void loadCalendarProviders()}
                  disabled={loadingCalendarProviders}
                >
                  {loadingCalendarProviders ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {showIntegrationsPathPicker ? (
                <>
                  <p className="sub" style={{ marginBottom: 12 }}>
                    Choose how clients book with you. You can switch or add another system anytime.
                  </p>
                  <div className="integrations-path-picker" role="group" aria-label="Booking system">
                    <button type="button" className="btn user-save integrations-primary-button" onClick={() => setIntegrationsPath('square')}>
                      Square Appointments
                    </button>
                    <button type="button" className="btn user-save integrations-primary-button" onClick={() => setIntegrationsPath('booking_link')}>
                      Booking page link
                    </button>
                    <button type="button" className="btn user-save integrations-primary-button" onClick={() => setIntegrationsPath('vagaro')}>
                      Vagaro
                    </button>
                  </div>
                  <div className="integrations-path-actions">
                    <button type="button" className="subtle-link" onClick={() => setIntegrationsPath('all')}>
                      Show all options at once
                    </button>
                  </div>
                </>
              ) : null}

              {!showIntegrationsPathPicker ? (
                <div className="note integrations-intro-note">
                  Square or Vagaro: live availability and booking in that system. Fresha, Booksy, or GlossGenius: paste a public
                  booking URL (SMS link for callers; no calendar sync).
                </div>
              ) : null}

              {showIntegrationsPathFooter ? (
                <div className="integrations-path-actions">
                  <button type="button" className="subtle-link" onClick={() => setIntegrationsPath('pick')}>
                    Choose a different system
                  </button>
                  <span className="hint-copy" aria-hidden="true">
                    ·
                  </span>
                  <button type="button" className="subtle-link" onClick={() => setIntegrationsPath('all')}>
                    Show all options
                  </button>
                </div>
              ) : null}

              {showSquareBlock ? (
                <>
                  {squareProvider ? (
                  <>
                  <div
                    className={[
                      'integrations-square-section',
                      squareSectionHeadingFirst ? 'integrations-square-section--first' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="integrations-square-section-head">
                      <div className="calendar-int-logo-wrap integrations-square-section-logo">
                        <img
                          src={CALENDAR_PROVIDER_LOGOS.square_appointments}
                          alt=""
                          width={44}
                          height={44}
                          loading="lazy"
                        />
                      </div>
                      <h4 className="integrations-square-section-title">Square Appointments</h4>
                    </div>
                    <p className="sub integrations-section-lead">
                      {squareProvider.connected
                        ? squareProvider.configured
                          ? 'Square is connected and configured. Live availability and booking use your Square calendar.'
                          : 'Square is connected. Choose location and default service below, then save.'
                        : 'Sign in with Square (OAuth), then pick the location and service RingBooker should use for availability and booking.'}
                    </p>
                  </div>
                  <div
                  className={[
                    'calendar-int-card',
                    'calendar-int-card--solo',
                    'calendar-int-card--plain',
                    'integrations-square-connect-card',
                    squareProvider.connected ? 'connected-active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="integrations-square-connect-row">
                    <button
                      type="button"
                      className="btn user-save integrations-primary-button"
                      onClick={() => {
                        window.location.href = '/api/backend/user/calendar/providers/square_appointments/connect/start';
                      }}
                    >
                      {squareProvider.connected ? 'Reconnect Square' : 'Connect Square'}
                    </button>
                    {squareProvider.connected ? (
                      <div className="integrations-inline-actions">
                        <button
                          type="button"
                          className="btn"
                          onClick={async () => {
                            try {
                              const response = await fetch(
                                '/api/backend/user/calendar/providers/square_appointments/disconnect',
                                { method: 'POST' },
                              );
                              const body = (await response.json()) as { ok: boolean; error?: string };
                              if (!response.ok || !body.ok) {
                                setCalendarStatus(body.error ?? 'disconnect_failed');
                                return;
                              }
                              setCalendarStatus('Square disconnected.');
                              setSquareOptions(null);
                              await loadCalendarProviders();
                            } catch {
                              setCalendarStatus('disconnect_failed');
                            }
                          }}
                        >
                          Disconnect
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => void loadSquareOptions()}
                          disabled={loadingSquareOptions}
                        >
                          {loadingSquareOptions ? 'Loading...' : 'Reload options'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                  </>
              ) : (
                  <h4
                    className={`integrations-section-heading ${squareSectionHeadingFirst ? 'integrations-section-heading--first' : ''}`}
                  >
                    Square Appointments
                  </h4>
              )}

                  {squareProvider?.connected ? (
                    <div className="card-section integrations-square-config">
                      <div className="hint-row">
                        <strong className="option-title">Square booking targets</strong>
                        <span className="hint-copy">Choose the location and service the AI should use.</span>
                      </div>
                      <div className="form-grid">
                        <div className="field">
                          <label>Square location</label>
                          <select value={squareLocationId} onChange={(event) => setSquareLocationId(event.target.value)}>
                            <option value="">Select location</option>
                            {(squareOptions?.locations ?? []).map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label>Default service variation</label>
                          <select
                            value={squareServiceVariationId}
                            onChange={(event) => setSquareServiceVariationId(event.target.value)}
                          >
                            <option value="">Select service</option>
                            {(squareOptions?.serviceVariations ?? []).map((service) => (
                              <option key={service.id} value={service.id}>
                                {service.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label>Team member (optional)</label>
                          <input
                            value={squareTeamMemberId}
                            onChange={(event) => setSquareTeamMemberId(event.target.value)}
                            placeholder="Optional Square team_member_id"
                          />
                        </div>
                        <div className="field">
                          <label>Connection status</label>
                          <div className="note">
                            {squareProvider.configured
                              ? 'Ready: live availability + booking can use Square now.'
                              : 'Connected but incomplete. Please choose location and service, then save.'}
                          </div>
                        </div>
                        <div className="field" style={{ gridColumn: '1 / -1' }}>
                          <button
                            type="button"
                            className="btn user-save"
                            disabled={savingSquareConfig || !squareLocationId || !squareServiceVariationId}
                            onClick={async () => {
                              setSavingSquareConfig(true);
                              try {
                                const response = await fetch(
                                  '/api/backend/user/calendar/providers/square_appointments/configure',
                                  {
                                    method: 'POST',
                                    headers: { 'content-type': 'application/json' },
                                    body: JSON.stringify({
                                      locationId: squareLocationId,
                                      serviceVariationId: squareServiceVariationId,
                                      teamMemberId: squareTeamMemberId || undefined,
                                    }),
                                  },
                                );
                                const body = (await response.json()) as { ok: boolean; error?: string };
                                if (!response.ok || !body.ok) {
                                  setCalendarStatus(body.error ?? 'square_config_save_failed');
                                  return;
                                }
                                setCalendarStatus('Square configuration saved.');
                                await loadCalendarProviders();
                              } catch {
                                setCalendarStatus('square_config_save_failed');
                              } finally {
                                setSavingSquareConfig(false);
                              }
                            }}
                          >
                            {savingSquareConfig ? 'Saving...' : 'Save Square booking target'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {showBookingLinkBlock ? (
                <>
              <h4
                className={`integrations-section-heading ${bookingSectionHeadingFirst ? 'integrations-section-heading--first' : ''}`}
              >
                Booking page link
              </h4>
              <p className="sub integrations-section-lead">
                Pick your app or choose custom, then paste your public booking URL once. RingBooker texts it to callers when
                needed — one link per account.
              </p>
              {(() => {
                const blMeta = calendarProviders.find((p) => p.id === bookingLinkPick);
                const bookingLinkUrl = blMeta?.details?.bookingUrl ?? '';
                const isEditingBookingLink = editingBookingLinkProvider === bookingLinkPick;
                return (
                  <div
                    className={[
                      'calendar-int-card',
                      'calendar-int-card--solo',
                      'calendar-int-card--plain',
                      'integrations-booking-link-card',
                      blMeta?.connected ? 'connected-active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="field integrations-booking-link-field">
                      <select
                        id="booking-link-brand-select"
                        aria-label="Booking app"
                        value={bookingLinkPick}
                        onChange={(event) => {
                          const next = event.target.value as BookingLinkProviderId;
                          setBookingLinkPick(next);
                          setEditingBookingLinkProvider(null);
                        }}
                      >
                        {BOOKING_LINK_PROVIDER_IDS.map((id) => (
                          <option key={id} value={id}>
                            {calendarProviders.find((p) => p.id === id)?.label ?? id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="calendar-int-desc">
                      {blMeta?.connected
                        ? 'Connected — callers can receive this booking link by SMS.'
                        : 'Add your booking link so callers can receive it by SMS.'}
                    </p>
                    <div className="calendar-int-actions integrations-booking-link-actions">
                      <div className="integrations-booking-link-stack">
                        {blMeta?.connected && !isEditingBookingLink ? (
                          <>
                            <span
                              className="calendar-int-badge"
                              aria-label="Connected"
                              style={{
                                background: '#ecfdf5',
                                borderColor: '#bbf7d0',
                                color: '#047857',
                                width: 'fit-content',
                              }}
                            >
                              Connected
                            </span>
                            <div className="note" style={{ wordBreak: 'break-word' }}>
                              {bookingLinkUrl}
                            </div>
                            <button
                              type="button"
                              className="btn user-save"
                              onClick={() => {
                                setEditingBookingLinkProvider(bookingLinkPick);
                                setBookingLinkInputs((current) => ({
                                  ...current,
                                  [bookingLinkPick]: bookingLinkUrl,
                                }));
                              }}
                            >
                              Edit
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="field integrations-booking-link-field">
                              <label>Booking link URL</label>
                              <input
                                value={bookingLinkInputs[bookingLinkPick]}
                                onChange={(event) => {
                                  setBookingLinkInputs((current) => ({
                                    ...current,
                                    [bookingLinkPick]: event.target.value,
                                  }));
                                  setBookingLinkErrors((current) => ({ ...current, [bookingLinkPick]: '' }));
                                }}
                                placeholder={BOOKING_LINK_PLACEHOLDERS[bookingLinkPick]}
                              />
                            </div>
                            {bookingLinkErrors[bookingLinkPick] ? (
                              <div className="note" style={{ color: '#b91c1c' }}>
                                {bookingLinkErrors[bookingLinkPick]}
                              </div>
                            ) : null}
                            <div className="integrations-inline-actions">
                              {blMeta?.connected ? (
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={() => {
                                    setEditingBookingLinkProvider(null);
                                    setBookingLinkErrors((current) => ({ ...current, [bookingLinkPick]: '' }));
                                  }}
                                >
                                  Cancel
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="btn user-save integrations-primary-button"
                                disabled={
                                  savingBookingLinkProvider === bookingLinkPick ||
                                  !bookingLinkInputs[bookingLinkPick].trim()
                                }
                                onClick={() => void saveBookingLink(bookingLinkPick)}
                              >
                                {savingBookingLinkProvider === bookingLinkPick ? 'Saving...' : 'Save booking link'}
                              </button>
                            </div>
                          </>
                        )}
                        <div className="note">
                          When clients call to book, they will receive your booking link via SMS automatically.
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
                </>
              ) : null}

              {showVagaroBlock ? (
                <>
                  <h4
                    className={`integrations-section-heading ${vagaroSectionHeadingFirst ? 'integrations-section-heading--first' : ''}`}
                  >
                    Vagaro
                  </h4>
                  <p className="sub integrations-section-lead">
                    RingBooker uses your Vagaro API for availability checks and webhook sync. Booking and checkout stay in
                    Vagaro — add your credentials below.
                  </p>

                  {vagaroProvider ? (
              <div className="card-section integrations-vagaro-block">
                <div className="form-grid integrations-vagaro-form">
                  <div className="field">
                    <label>Client ID</label>
                    <input
                      value={vagaroClientId}
                      onChange={(event) => setVagaroClientId(event.target.value)}
                      placeholder={vagaroProvider.connected ? 'Leave blank to keep current client ID' : 'Vagaro clientId'}
                    />
                  </div>
                  <div className="field">
                    <label>Client secret key</label>
                    <input
                      type="password"
                      value={vagaroClientSecretKey}
                      onChange={(event) => setVagaroClientSecretKey(event.target.value)}
                      placeholder={vagaroProvider.connected ? 'Leave blank to keep current secret' : 'Vagaro clientSecretKey'}
                    />
                  </div>
                  <div className="field">
                    <label>Region</label>
                    <input
                      value={vagaroRegion}
                      onChange={(event) => setVagaroRegion(event.target.value)}
                      placeholder="us"
                    />
                  </div>
                  <div className="field">
                    <label>Business ID</label>
                    <input
                      value={vagaroBusinessId}
                      onChange={(event) => setVagaroBusinessId(event.target.value)}
                      placeholder="Vagaro Business ID (required)"
                    />
                  </div>
                  <div className="field integrations-vagaro-booking-field">
                    <label>Vagaro Booking Link</label>
                    <span className="hint-copy">Optional — for SMS booking links</span>
                    <input
                      type="text"
                      value={vagaroBookingUrl}
                      onChange={(event) => {
                        setVagaroBookingUrl(event.target.value);
                        setVagaroBookingUrlError(null);
                      }}
                      placeholder="https://vagaro.com/your-business"
                    />
                    <div className="note">
                      When callers want to book, we'll send this link via SMS. Works alongside availability checking.
                    </div>
                    {vagaroBookingUrlError ? (
                      <div className="note" style={{ color: '#b91c1c' }}>
                        {vagaroBookingUrlError}
                      </div>
                    ) : null}
                    <div className="integrations-vagaro-booking-actions">
                      <button
                        type="button"
                        className="btn user-save integrations-primary-button"
                        disabled={savingVagaroBookingUrl || !vagaroBookingUrl.trim()}
                        onClick={() => void saveVagaroBookingLink()}
                      >
                        {savingVagaroBookingUrl ? 'Saving...' : 'Save booking link'}
                      </button>
                    </div>
                  </div>
                  <div className="field integrations-vagaro-status-field">
                    <label>Connection status</label>
                    <div className="note">
                      {vagaroProvider.connected
                        ? vagaroProvider.configured
                          ? 'Connected: availability checking can use Vagaro now.'
                          : 'Connected but incomplete. Add business ID to load Vagaro services and staff.'
                        : 'Not connected. Enter API credentials to connect Vagaro.'}
                    </div>
                  </div>
                  <div className="field integrations-vagaro-primary-actions">
                    <button
                      type="button"
                      className="btn user-save"
                      disabled={
                        savingVagaroConfig ||
                        !vagaroRegion ||
                        !vagaroBusinessId ||
                        (!vagaroProvider.connected && (!vagaroClientId || !vagaroClientSecretKey))
                      }
                      onClick={async () => {
                        if (!vagaroBusinessId) {
                          setCalendarStatus('Business ID is required for Vagaro integration');
                          return;
                        }
                        setSavingVagaroConfig(true);
                        try {
                          const response = await fetch(
                            vagaroProvider.connected
                              ? '/api/backend/user/calendar/providers/vagaro/configure'
                              : '/api/backend/user/calendar/providers/vagaro/connect',
                            {
                              method: 'POST',
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({
                                clientId: vagaroClientId || undefined,
                                clientSecretKey: vagaroClientSecretKey || undefined,
                                region: vagaroRegion,
                                businessId: vagaroBusinessId || undefined,
                                bookingUrl: vagaroBookingUrl.trim() || undefined,
                              }),
                            },
                          );
                          const body = (await response.json()) as { ok: boolean; error?: string };
                          if (!response.ok || !body.ok) {
                            setCalendarStatus(body.error ?? 'vagaro_config_save_failed');
                            return;
                          }
                          setCalendarStatus(vagaroProvider.connected ? 'Vagaro configuration saved.' : 'Vagaro connected.');
                          setVagaroClientSecretKey('');
                          await loadCalendarProviders();
                        } catch {
                          setCalendarStatus('vagaro_config_save_failed');
                        } finally {
                          setSavingVagaroConfig(false);
                        }
                      }}
                    >
                      {savingVagaroConfig ? 'Saving...' : vagaroProvider.connected ? 'Save Vagaro settings' : 'Connect Vagaro'}
                    </button>
                  </div>
                </div>
              </div>
              ) : null}
                </>
              ) : null}

              {calendarStatus ? (
                <div className="note" style={{ marginTop: 14 }}>{calendarStatus}</div>
              ) : null}
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
                    user_name: currentForm.user_name,
                    user_phone: currentForm.user_phone,
                    backup_phone: currentForm.backup_phone || null,
                    address: currentForm.address || null,
                    timezone: currentForm.timezone,
                    website_url: currentForm.website_url.trim() ? currentForm.website_url.trim() : '',
                    cancel_policy: currentForm.cancel_policy,
                    promotions: currentForm.promotions || null,
                  });
                }}
              >
                <div className="business-subtabs" role="tablist" aria-label="Business knowledge sections">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={businessKnowledgeSubTab === 'info'}
                    className={`business-subtab ${businessKnowledgeSubTab === 'info' ? 'active' : ''}`}
                    onClick={() => setBusinessKnowledgeSubTab('info')}
                  >
                    Business info
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={businessKnowledgeSubTab === 'cancellation'}
                    className={`business-subtab ${businessKnowledgeSubTab === 'cancellation' ? 'active' : ''}`}
                    onClick={() => setBusinessKnowledgeSubTab('cancellation')}
                  >
                    Cancellation policy
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={businessKnowledgeSubTab === 'promotion'}
                    className={`business-subtab ${businessKnowledgeSubTab === 'promotion' ? 'active' : ''}`}
                    onClick={() => setBusinessKnowledgeSubTab('promotion')}
                  >
                    Promotion
                  </button>
                </div>

                <div className="card-section">
                  {businessKnowledgeSubTab === 'info' ? (
                    <div>
                      <div className="hint-row">
                        <strong className="option-title">Business info</strong>
                        <span className="hint-copy">Core details RingBooker can use when callers ask who you are, where you are, or how to reach the team.</span>
                      </div>
                      <div className="form-grid" style={{ marginTop: 14 }}>
                        <div className="field"><label>Business name</label><input value={currentForm.name} onChange={(event) => patchState('name', event.target.value)} /></div>
                        <div className="field"><label>Primary contact name</label><input value={currentForm.user_name} onChange={(event) => patchState('user_name', event.target.value)} placeholder="Owner or manager name" /></div>
                        <div className="field"><label>Main user phone</label><input value={currentForm.user_phone} onChange={(event) => patchState('user_phone', event.target.value)} /></div>
                        <div className="field"><label>Backup phone</label><input value={currentForm.backup_phone} onChange={(event) => patchState('backup_phone', event.target.value)} placeholder="Optional handoff line" /></div>
                        <div className="field"><label>Timezone</label><select value={currentForm.timezone} onChange={(event) => patchState('timezone', event.target.value)}><option value="America/Los_Angeles">America/Los_Angeles</option><option value="America/New_York">America/New_York</option><option value="America/Chicago">America/Chicago</option><option value="America/Denver">America/Denver</option></select></div>
                        <div className="field"><label>Address</label><input value={currentForm.address} onChange={(event) => patchState('address', event.target.value)} /></div>
                        <div className="field"><label>Website</label><input value={currentForm.website_url} onChange={(event) => patchState('website_url', event.target.value)} placeholder="https://..." /></div>
                      </div>
                    </div>
                  ) : null}

                  {businessKnowledgeSubTab === 'cancellation' ? (
                    <div>
                      <div className="hint-row"><strong className="option-title">Cancellation policy</strong><span className="hint-copy">Choose a preset, then edit only if your business needs a special case.</span></div>
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
                      <div className="field" style={{ marginTop: 14, width: '60%', maxWidth: '100%' }}>
                        <label>Policy text</label>
                        <textarea value={currentForm.cancel_policy} onChange={(event) => {
                          setCancelPreset('custom');
                          patchState('cancel_policy', event.target.value);
                        }} />
                      </div>
                    </div>
                  ) : null}

                  {businessKnowledgeSubTab === 'promotion' ? (
                    <div>
                      <div className="hint-row"><strong className="option-title">Promotion</strong><span className="hint-copy">Pick one active offer so the AI never invents a discount.</span></div>
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
                      <div className="field" style={{ marginTop: 14, width: '60%', maxWidth: '100%' }}>
                        <label>Promotion text</label>
                        <textarea value={currentForm.promotions} onChange={(event) => {
                          setPromoPreset('custom');
                          patchState('promotions', event.target.value);
                        }} placeholder="Optional. Leave blank if you are not running a promotion." />
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="settings-save-footer">
                  <button type="submit" className="btn user-save" disabled={savingSection !== null}>
                    {savingSection === 'business-knowledge-info' ? 'Saving...' : 'Save business knowledge'}
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
                    user_name: currentForm.user_name,
                    user_phone: currentForm.user_phone,
                    backup_phone: currentForm.backup_phone || null,
                    address: currentForm.address || null,
                    timezone: currentForm.timezone,
                    booking_url: currentForm.booking_url.trim() ? currentForm.booking_url.trim() : null,
                  });
                }}
              >
                <div className="form-grid">
                  <div className="field"><label>Business name</label><input value={currentForm.name} onChange={(event) => patchState('name', event.target.value)} /></div>
                  <div className="field"><label>Primary contact name</label><input value={currentForm.user_name} onChange={(event) => patchState('user_name', event.target.value)} placeholder="Owner or manager name" /></div>
                  <div className="field"><label>Main user phone</label><input value={currentForm.user_phone} onChange={(event) => patchState('user_phone', event.target.value)} /></div>
                  <div className="field"><label>Backup phone</label><input value={currentForm.backup_phone} onChange={(event) => patchState('backup_phone', event.target.value)} placeholder="Optional handoff line" /></div>
                  <div className="field"><label>Timezone</label><select value={currentForm.timezone} onChange={(event) => patchState('timezone', event.target.value)}><option value="America/Los_Angeles">America/Los_Angeles</option><option value="America/New_York">America/New_York</option><option value="America/Chicago">America/Chicago</option><option value="America/Denver">America/Denver</option></select></div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}><label>Address</label><input value={currentForm.address} onChange={(event) => patchState('address', event.target.value)} /></div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}><label>Booking link</label><input value={currentForm.booking_url} onChange={(event) => patchState('booking_url', event.target.value)} placeholder="https://..." /></div>
                </div>
                <div className="settings-save-footer">
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
              <div className="business-subtabs" role="tablist" aria-label="Services and hours sections">
                <button type="button" role="tab" aria-selected={servicesHoursSubTab === 'services'} className={`business-subtab ${servicesHoursSubTab === 'services' ? 'active' : ''}`} onClick={() => setServicesHoursSubTab('services')}>
                  Services
                </button>
                <button type="button" role="tab" aria-selected={servicesHoursSubTab === 'hours'} className={`business-subtab ${servicesHoursSubTab === 'hours' ? 'active' : ''}`} onClick={() => setServicesHoursSubTab('hours')}>
                  Business hours
                </button>
              </div>
              {servicesHoursSubTab === 'services' ? (
              <form
                className="card-section-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitSettingsPatch(
                    'services',
                    serviceCatalogEnabled
                      ? { service_catalog: currentForm.service_catalog }
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
                <div className="card-section">
                  {!serviceCatalogEnabled ? (
                    <>
                      <div className="service-catalog-heading">
                        <div>
                          <h3>Services customers ask about</h3>
                          <p className="sh-catalog-intro">
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
                          <div key={`${service.name || 'service'}-${index}`} className="service-item-card">
                            <div className="service-item-head">
                              <div className="field">
                                <label>Service name</label>
                                <input value={service.name} onChange={(event) => updateLegacyService(index, { name: event.target.value })} placeholder="Gel Manicure" />
                              </div>
                              <div className="field">
                                <label>Duration</label>
                                <input
                                  type="number"
                                  min={1}
                                  value={service.duration_min || ''}
                                  onChange={(event) => updateLegacyService(index, { duration_min: event.target.value === '' ? 0 : Number(event.target.value) })}
                                  placeholder="60"
                                />
                              </div>
                              <div className="field">
                                <label>Price</label>
                                <input type="number" min={0} value={service.price} onChange={(event) => updateLegacyService(index, { price: Number(event.target.value) })} />
                              </div>
                            </div>
                            <button type="button" className="subtle-link" onClick={() => removeLegacyService(index)}>
                              Remove service
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                  <div className="service-catalog-heading">
                    <div>
                      <h3>Services customers ask about</h3>
                      <p className="sh-catalog-intro">
                        Group your services so the AI can answer questions naturally and ask the right follow-up questions.
                      </p>
                    </div>
                    <div className="service-catalog-actions">
                      <button type="button" className="btn" onClick={() => applySuggestedGroups()}>
                        Add suggested groups
                      </button>
                      <button type="button" className="btn" onClick={() => addServiceGroup()}>
                        Add service group
                      </button>
                    </div>
                  </div>

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
                          <details key={category.id} className="service-group-card" open>
                            <summary>
                              <div>
                                <strong>{category.name || 'Service group'}</strong>
                                <span>{groupServices.length} services</span>
                              </div>
                            </summary>
                            <div className="service-group-body">
                              <div className="form-grid">
                                <div className="field">
                                  <label>Service group</label>
                                  <input value={category.name} onChange={(event) => updateServiceGroup(category.id, { name: event.target.value })} />
                                </div>
                                <div className="field">
                                  <label>Group description</label>
                                  <input
                                    value={category.description ?? ''}
                                    onChange={(event) => updateServiceGroup(category.id, { description: event.target.value || null })}
                                    placeholder="Optional context for callers"
                                  />
                                </div>
                              </div>

                              {groupServices.length === 0 ? (
                                <div className="sh-empty">No services in this group yet.</div>
                              ) : null}
                              {groupServices.map((service) => (
                                <div key={service.id} className={`service-item-card ${service.active === false ? 'archived' : ''}`}>
                                  <div className="service-item-head">
                                    <div className="field">
                                      <label>Service name</label>
                                      <input value={service.name} onChange={(event) => updateCatalogService(service.id, { name: event.target.value })} placeholder="Gel Manicure" />
                                    </div>
                                    <div className="field">
                                      <label>Move to group</label>
                                      <select value={service.categoryId ?? ''} onChange={(event) => updateCatalogService(service.id, { categoryId: event.target.value || null })}>
                                        {currentForm.service_catalog.categories.map((item) => (
                                          <option key={item.id} value={item.id}>{item.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                  <div className="form-grid">
                                    <div className="field">
                                      <label>Description</label>
                                      <input value={service.description ?? ''} onChange={(event) => updateCatalogService(service.id, { description: event.target.value || null })} placeholder="Optional caller-facing details" />
                                    </div>
                                    <div className="field">
                                      <label>Duration</label>
                                      <select value={String(service.durationMinutes ?? 60)} onChange={(event) => updateCatalogService(service.id, { durationMinutes: Number(event.target.value) })}>
                                        {[15, 30, 45, 60, 75, 90, 120, 150, 180].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
                                      </select>
                                    </div>
                                    <div className="field">
                                      <label>Price type</label>
                                      <select value={service.priceType} onChange={(event) => updateCatalogService(service.id, { priceType: event.target.value as ServicePriceType })}>
                                        {PRICE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                      </select>
                                    </div>
                                    <div className="field">
                                      <label>Price</label>
                                      <input type="number" min={0} value={service.priceAmount ?? 0} onChange={(event) => updateCatalogService(service.id, { priceAmount: Number(event.target.value) })} disabled={service.priceType === 'consultation' || service.priceType === 'varies'} />
                                    </div>
                                  </div>
                                  <div className="field">
                                    <label>Aliases / other names customers use</label>
                                    <input
                                      value={service.aliases.join(', ')}
                                      onChange={(event) => updateCatalogService(service.id, { aliases: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
                                      placeholder="gel mani, shellac"
                                    />
                                  </div>
                                  <div className="field">
                                    <label>Booking notes</label>
                                    <textarea
                                      value={service.bookingNotes ?? ''}
                                      onChange={(event) => updateCatalogService(service.id, { bookingNotes: event.target.value || null })}
                                      placeholder="Anything the AI should know before capturing this request."
                                    />
                                  </div>
                                  <div className="service-item-footer">
                                    <label className="inline-check">
                                      <input type="checkbox" checked={service.bookable} onChange={(event) => updateCatalogService(service.id, { bookable: event.target.checked })} />
                                      Bookable by request
                                    </label>
                                    <button type="button" className="subtle-link" onClick={() => updateCatalogService(service.id, { active: service.active === false })}>
                                      {service.active === false ? 'Restore service' : 'Archive service'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <button type="button" className="add-service-btn" onClick={() => addServiceToGroup(category.id)}>
                                + Add service in {category.name || 'this group'}
                              </button>
                            </div>
                          </details>
                        );
                      })}
                  </div>
                  <div className="service-catalog-note">
                    These services help RingBooker answer caller questions and capture booking requests. They do not turn on direct booking integrations by themselves.
                  </div>
                    </>
                  )}
                </div>
                <div className="settings-save-footer">
                  <button type="submit" className="btn user-save" disabled={savingSection !== null}>
                    {savingSection === 'services' ? 'Saving...' : 'Save services'}
                  </button>
                </div>
              </form>
              ) : null}

              {servicesHoursSubTab === 'hours' ? (
              <form
                className="card-section-form sh-business-hours-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitSettingsPatch('hours', { hours: currentForm.hours });
                }}
              >
                <div className="card-section">
                  <p className="sh-catalog-intro sh-hours-intro">Set your weekly schedule. Use a preset for a quick start, then fine-tune individual days.</p>
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
                        return (
                          <div key={day} className={`hours-row ${isClosed ? 'closed' : ''}`}>
                            <div className="hours-day">{DAY_LABELS[day]}</div>
                            <div className="small-field">
                              <label htmlFor={openId}>Open</label>
                              <select id={openId} value={isClosed ? '09:00' : entry.open} disabled={isClosed} onChange={(event) => updateHours(day, { open: event.target.value, close: isClosed ? '18:00' : entry.close })}>
                                {TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
                              </select>
                            </div>
                            <div className="small-field">
                              <label htmlFor={closeId}>Close</label>
                              <select id={closeId} value={isClosed ? '18:00' : entry.close} disabled={isClosed} onChange={(event) => updateHours(day, { open: isClosed ? '09:00' : entry.open, close: event.target.value })}>
                                {TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
                              </select>
                            </div>
                            <label className="inline-check">
                              <input type="checkbox" checked={isClosed} onChange={(event) => updateHours(day, event.target.checked ? { closed: true } : { open: '09:00', close: '18:00' })} />
                              Closed
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="settings-save-footer">
                  <button type="submit" className="btn user-save" disabled={savingSection !== null}>
                    {savingSection === 'hours' ? 'Saving...' : 'Save hours'}
                  </button>
                </div>
              </form>
              ) : null}
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
                <div className="panel-head">
                  <div>
                    <h3>Staff / Technicians</h3>
                    <p className="sub">Add approved staff names, specialties, and notes so RingBooker does not invent technician details.</p>
                    <p className="sub" style={{ marginTop: 6 }}>
                      {effectiveShop.plan === 'starter'
                        ? 'Staff details stay editable on Starter. Returning caller preferred-provider memory is available on Professional.'
                        : effectiveShop.plan === 'enterprise'
                          ? 'Custom accounts can use staff knowledge with managed routing and provider rules.'
                          : 'Professional can use returning caller notes to remember preferred providers when caller history is available.'}
                    </p>
                  </div>
                  <button type="button" className="btn" onClick={() => patchState('staff', [...currentForm.staff, emptyStaffMember()])}>
                    Add staff
                  </button>
                </div>
                <div className="card-section">
                  {currentForm.staff.length === 0 ? (
                    <div className="sh-empty">No staff added yet. Add names callers may request, like Sarah for nail art or Jenny for pedicures.</div>
                  ) : null}
                  {currentForm.staff.map((member, index) => (
                    <div className="option-card" key={`${member.name}-${index}`}>
                      <div className="form-grid">
                        <div className="field"><label>Name</label><input value={member.name} onChange={(event) => updateStaff(index, { name: event.target.value })} placeholder="Sarah" /></div>
                        <div className="field"><label>Role</label><input value={member.role ?? ''} onChange={(event) => updateStaff(index, { role: event.target.value })} placeholder="Nail technician" /></div>
                        <div className="field" style={{ gridColumn: '1 / -1' }}><label>Specialties</label><input value={(member.specialties ?? []).join(', ')} onChange={(event) => updateStaff(index, { specialties: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} placeholder="Gel nails, nail art, pedicure" /></div>
                        <div className="field" style={{ gridColumn: '1 / -1' }}><label>Notes</label><textarea value={member.notes ?? ''} onChange={(event) => updateStaff(index, { notes: event.target.value })} placeholder="Optional. Example: Available Tuesday-Friday. Best for detailed nail art." /></div>
                      </div>
                      <div className="settings-save-footer" style={{ marginTop: 10 }}>
                        <button type="button" className="subtle-link" onClick={() => patchState('staff', currentForm.staff.filter((_, itemIndex) => itemIndex !== index))}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="settings-save-footer">
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
                    faqs: currentForm.faqs
                      .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }))
                      .filter((item) => item.question && item.answer),
                  });
                }}
              >
                <div className="panel-head">
                  <div>
                    <h3>FAQ</h3>
                    <p className="sub">Approved answers for common caller questions: parking, walk-ins, deposits, payment methods, gift cards, or group bookings.</p>
                  </div>
                  <button type="button" className="btn" onClick={() => patchState('faqs', [...currentForm.faqs, emptyFaqItem()])}>
                    Add FAQ
                  </button>
                </div>
                <div className="card-section">
                  {currentForm.faqs.length === 0 ? (
                    <div className="sh-empty">No FAQs added yet. Add common answers so RingBooker can respond consistently.</div>
                  ) : null}
                  {currentForm.faqs.map((item, index) => (
                    <div className="option-card option-card--bare" key={`${item.question}-${index}`}>
                      <div className="field"><label>Question</label><input value={item.question} onChange={(event) => updateFaq(index, { question: event.target.value })} placeholder="Do you accept walk-ins?" /></div>
                      <div className="field"><label>Approved answer</label><textarea value={item.answer} onChange={(event) => updateFaq(index, { answer: event.target.value })} placeholder="Walk-ins are welcome when staff are available, but appointments are recommended." /></div>
                      <div className="settings-save-footer" style={{ marginTop: 10 }}>
                        <button type="button" className="subtle-link" onClick={() => patchState('faqs', currentForm.faqs.filter((_, itemIndex) => itemIndex !== index))}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="settings-save-footer">
                  <button type="submit" className="btn user-save" disabled={savingSection !== null}>
                    {savingSection === 'faqs' ? 'Saving...' : 'Save FAQ'}
                  </button>
                </div>
              </form>
            </section>
            ) : null}

            {activeTab === 'ai-call-behavior' ? (
            <section className="card">
              <div className="business-subtabs" role="tablist" aria-label="AI call behavior sections">
                <button type="button" role="tab" aria-selected={behaviorSubTab === 'voice'} className={`business-subtab ${behaviorSubTab === 'voice' ? 'active' : ''}`} onClick={() => setBehaviorSubTab('voice')}>
                  AI tone and voice
                </button>
                <button type="button" role="tab" aria-selected={behaviorSubTab === 'handling'} className={`business-subtab ${behaviorSubTab === 'handling' ? 'active' : ''}`} onClick={() => setBehaviorSubTab('handling')}>
                  Call handling
                </button>
              </div>
              {behaviorSubTab === 'handling' ? (
              <form
                className="card-section-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const patch: Record<string, unknown> = {
                    allow_callbacks: currentForm.allow_callbacks,
                  };
                  if (!ownerTransferUx.locked) patch.allow_transfers = currentForm.allow_transfers;
                  void commitSettingsPatch('call-handling', patch);
                }}
              >
                <div className="switch-list">
                  <div className={`switch-row ${ownerTransferUx.locked ? 'locked' : ''}`}>
                    <div className="switch-copy">
                      <h4>{ownerTransferUx.title}</h4>
                      <p>{ownerTransferUx.description}</p>
                      {ownerTransferUx.locked ? <span className="lock-copy">{ownerTransferUx.badge}</span> : null}
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
                  <div className="switch-row">
                    <div className="switch-copy"><h4>Offer callbacks</h4><p>When the team is busy, the AI can queue a callback instead of losing the lead.</p></div>
                    <div className="switch-stack"><button type="button" className={`switch ${currentForm.allow_callbacks ? 'on' : ''}`} onClick={() => patchState('allow_callbacks', !currentForm.allow_callbacks)}><span className="sr-only">Toggle callbacks</span></button></div>
                  </div>
                </div>
                <div className={`option-card ${returningCallerNotesUx.locked ? 'locked' : ''}`} style={{ marginTop: 16 }}>
                  <div className="hint-row">
                    <strong className="option-title">{returningCallerNotesUx.title}</strong>
                    <span className={`tag ${returningCallerNotesUx.locked ? 'orange' : 'green'}`}>{returningCallerNotesUx.badge}</span>
                  </div>
                  <p className="sub" style={{ marginTop: 8 }}>{returningCallerNotesUx.description}</p>
                </div>
                <div className="settings-save-footer">
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
                <div className="card-section">
                  <div className="field">
                    <label>Voice style</label>
                    <select value={currentForm.ai_voice} disabled={isLocked('edit_ai_voice')} onChange={(event) => patchState('ai_voice', event.target.value)}>
                      {AI_VOICE_OPTIONS.map((voice) => <option key={voice.value} value={voice.value}>{voice.label}</option>)}
                    </select>
                    {renderLockCopy('edit_ai_voice')}
                  </div>

                  <div>
                    <div className="hint-row"><strong className="option-title">Greeting preset</strong>{renderLockCopy('edit_ai_greeting')}</div>
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
                      <span className={`tag ${bilingualAnsweringUx.locked ? 'orange' : effectiveShop.plan === 'enterprise' ? 'purple' : 'green'}`}>
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
                    <label>Advanced AI instructions</label>
                    <textarea value={currentForm.ai_custom_instructions} disabled={isLocked('edit_ai_custom_instructions')} onChange={(event) => patchState('ai_custom_instructions', event.target.value)} placeholder="Only show for Enterprise businesses." />
                    {renderLockCopy('edit_ai_custom_instructions')}
                  </div>
                </div>
                <div className="settings-save-footer">
                  <button type="submit" className="btn user-save" disabled={savingSection !== null}>
                    {savingSection === 'ai-voice' ? 'Saving...' : effectiveShop.plan === 'professional' ? 'Save AI voice & language' : 'Save AI voice & greeting'}
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
                    <div className="switch-copy"><h4>Reminder SMS</h4><p>Automatic appointment reminders that reduce no-shows.</p></div>
                    <div className="switch-stack">
                      <button type="button" className={`switch ${currentForm.send_reminder_sms ? 'on' : ''}`} disabled={isLocked('edit_reminder_sms')} onClick={() => patchState('send_reminder_sms', !currentForm.send_reminder_sms)} />
                      {renderLockCopy('edit_reminder_sms')}
                    </div>
                  </div>
                  <div className="switch-row">
                    <div className="switch-copy"><h4>Review request SMS</h4><p>Follow up completed appointments with a review request.</p></div>
                    <div className="switch-stack">
                      <button type="button" className={`switch ${currentForm.send_review_request_sms ? 'on' : ''}`} disabled={isLocked('edit_review_request_sms')} onClick={() => patchState('send_review_request_sms', !currentForm.send_review_request_sms)} />
                      {renderLockCopy('edit_review_request_sms')}
                    </div>
                  </div>
                </div>
                <div className="settings-save-footer">
                  <button type="submit" className="btn user-save" disabled={savingSection !== null}>
                    {savingSection === 'messaging' ? 'Saving...' : 'Save messaging'}
                  </button>
                </div>
              </form>
              ) : null}

              {messagingSubTab === 'notes' ? (
              <div className="card-section-form">
                <div className="card-section">
                  <div className="note">Reminder and review request controls unlock by plan. Missed-call follow-up stays available because it directly protects lost revenue from unanswered calls.</div>
                </div>
              </div>
              ) : null}
            </section>
            ) : null}

          </div>

        </main>
      </div>
      <UserPortalMobileTabbar active={sidebarNav} />
      </>
    </UserLayout>
  );
}
