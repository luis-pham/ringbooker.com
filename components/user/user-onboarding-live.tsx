'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { formatPhoneForDisplay, normalizePhoneForStorage } from '@/lib/phone-number';
import { isSignupSyntheticPlaceholderPhone } from '@/lib/shop-phone-placeholder';
import { UserLayout } from '@/components/user/user-layout';
import { OnboardingAddGroupSheet } from '@/components/user/onboarding-add-group-sheet';
import { userSettingsScripts, userSettingsStyles } from '@/components/user/user-settings';

type Vertical = 'nail_salon' | 'hair_salon' | 'day_spa' | 'med_spa' | 'beauty_clinic';
export type BeautySubtype =
  | 'beauty_clinic'
  | 'aesthetic_clinic'
  | 'wax_studio'
  | 'lash_studio'
  | 'brow_studio'
  | 'other_beauty';
type ShopPlan = 'starter' | 'professional' | 'enterprise';
type WizardStep = 1 | 2 | 3 | 4;
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
type ServiceItem = {
  name: string;
  duration_min?: number | null;
  duration_text?: string | null;
  price: number;
  group?: string;
  aliases?: string[];
  price_type?: ServicePriceType;
  bookable?: boolean;
  confidence?: number;
  needsReview?: boolean;
  source?: string | null;
  sourceHint?: string | null;
  evidenceSnippet?: string | null;
  variants?: ServiceVariant[];
};
type ServiceCatalogResponse = {
  categories: Array<{ id: string; name: string; sortOrder: number; active: boolean }>;
  services: Array<{
    id: string;
    categoryId?: string | null;
    name: string;
    durationText?: string | null;
    durationMinutes?: number | null;
    priceAmount?: number | null;
    priceType?: ServicePriceType;
    bookable?: boolean;
    aliases?: string[];
    sortOrder: number;
    active: boolean;
    variants?: ServiceVariant[];
  }>;
};
type ApiHours = Record<string, { closed: true } | { open: string; close: string }>;
type WizardHours = Record<string, { open: boolean; from: string; to: string }>;
type ImportSource = 'none' | 'website' | 'google_business' | 'manual';

type ImportedWebsiteSuggestions = {
  status: 'success' | 'partial' | 'failed';
  sourceUrl: string;
  businessProfile: {
    name?: { value: string | null; confidence: number; source?: string | null };
    primaryType?: { value: string | null; confidence: number; source?: string | null };
    phone?: { value: string | null; confidence: number; source?: string | null };
    website?: { value: string | null; confidence: number; source?: string | null };
    address?: { value: string | null; confidence: number; source?: string | null };
    timezone?: { value: string | null; confidence: number; source?: string | null };
  };
  hours?: { value: ApiHours | null; confidence: number; source?: string | null };
  serviceCatalog?: {
    confidence: number;
    categories: Array<{ name: string; confidence: number; source?: string }>;
    services: Array<{
      categoryName: string;
      name: string;
      durationText?: string | null;
      durationMinutes?: number | null;
      priceAmount?: number | null;
      priceType?: ServicePriceType;
      aliases?: string[];
      bookable?: boolean;
      confidence?: number;
      needsReview?: boolean;
      source?: string | null;
      sourceHint?: string | null;
      evidenceSnippet?: string | null;
      variants?: ServiceVariant[];
    }>;
  };
  alsoOffers?: Array<{ value: string | null; confidence: number; source?: string | null }>;
  bookingUrl?: { value: string | null; confidence: number; source?: string | null };
  staffSuggestions?: unknown[];
  policySuggestions?: unknown[];
  faqSuggestions?: unknown[];
  promotionSuggestions?: unknown[];
  bookingSetupSuggestions?: unknown[];
  warnings?: string[];
  completeness?: {
    recommendedNextAction?: string;
    overallConfidence?: number;
    missingFields?: string[];
    lowConfidenceFields?: string[];
  };
};

type ImportWebsiteResponse = {
  ok?: boolean;
  suggestions?: ImportedWebsiteSuggestions;
  diagnostics?: unknown;
  error?: string;
  message?: string;
};

export const IMPORT_PROGRESS_STEPS = [
  'Reading your website',
  'Finding your services page',
  'Extracting services and hours',
  'Building your profile',
] as const;

export function importProgressStepIndex(elapsedMs: number): number {
  if (elapsedMs >= 6500) return 3;
  if (elapsedMs >= 4000) return 2;
  if (elapsedMs >= 1800) return 1;
  return 0;
}

export function importProgressDelayMessage(elapsedMs: number): string | null {
  if (elapsedMs >= 120000) return 'This is taking longer than expected. You can continue manually and edit everything later.';
  if (elapsedMs >= 20000) return 'We’re still importing your website. Please wait a little longer.';
  if (elapsedMs >= 8500) return 'Still working... Some websites take longer to read.';
  return null;
}

export function importResultMessage(suggestions?: ImportedWebsiteSuggestions | null, failed = false): string {
  if (failed || suggestions?.status === 'failed') return 'We couldn’t import this automatically. You can still set this up manually.';
  if (suggestions?.status === 'partial' || suggestions?.warnings?.length) return 'Some details need review';
  return 'Ready to review';
}

export function secondaryImportSuggestionCount(suggestions?: ImportedWebsiteSuggestions | null): number {
  if (!suggestions) return 0;
  return [
    suggestions.staffSuggestions,
    suggestions.policySuggestions,
    suggestions.faqSuggestions,
    suggestions.promotionSuggestions,
    suggestions.bookingSetupSuggestions,
  ].reduce((total, items) => total + (Array.isArray(items) ? items.length : 0), 0);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return matches;
}

export type OnboardingStatusResponse = {
  ok: boolean;
  onboardingRequired?: boolean;
  onboardingCompleted?: boolean;
  liveCallsEnabled?: boolean;
  forwardingSetupVerified?: boolean;
  paymentMethodStatus?: 'none' | 'pending' | 'valid' | 'failed' | 'unknown';
  serviceCatalogEnabled?: boolean;
  shop?: {
    id: string;
    name: string;
    vertical?: Vertical | null;
    phone_number: string;
    user_name?: string;
    user_phone?: string;
    timezone: string;
    cancel_policy: string;
    services: ServiceItem[];
    service_catalog?: ServiceCatalogResponse | null;
    hours: ApiHours;
    languages?: string[];
    website_url?: string;
    booking_url?: string;
    address?: string | null;
    vertical_detail?: string | null;
    current_onboarding_step?: number | null;
    setup_method?: 'forward' | 'new_number' | null;
    forwarding_type?: string | null;
    forwarding_carrier?: string | null;
    forwarding_country?: string | null;
    telnyx_number?: string | null;
    plan?: ShopPlan;
  };
  error?: string;
};

const DAYS = [
  ['mon', 'Mon'],
  ['tue', 'Tue'],
  ['wed', 'Wed'],
  ['thu', 'Thu'],
  ['fri', 'Fri'],
  ['sat', 'Sat'],
  ['sun', 'Sun'],
] as const;

const TIME_OPTIONS = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
];

const STEP_LABELS = ['Find', 'Profile', 'Services', 'Test'] as const;

/** When true, onboarding helper copy assumes website extraction is live (set NEXT_PUBLIC_WEBSITE_IMPORT_ACTIVE=true). */
const WEBSITE_IMPORT_EXTRACTION_ACTIVE = process.env.NEXT_PUBLIC_WEBSITE_IMPORT_ACTIVE === 'true';

type Step1View = 'quick' | 'manual_vertical' | 'manual_beauty_subtype';
type ProfileEditField = 'name' | 'phone' | 'website' | 'type' | 'address' | 'hours' | 'timezone' | null;
type ProfileReviewRequiredField = Exclude<ProfileEditField, null>;
type Step2SheetKind = 'type' | 'timezone' | 'address' | 'hours';

const MIXED_SERVICE_GROUPS = [
  'Manicure',
  'Pedicure',
  'Acrylics / Extensions',
  'Haircuts',
  'Hair Color',
  'Waxing',
  'Massage',
  'Facials',
  'Brows & Lashes',
  'Makeup',
  'Injectables',
  'Laser',
  'Skin Treatments',
  'Consultations',
  'Other',
] as const;
type VerticalConfidence = 'high' | 'low' | 'none';

const MANUAL_PRIMARY_VERTICAL: Array<{ id: Vertical | 'beauty_umbrella'; emoji: string; label: string }> = [
  { id: 'nail_salon', emoji: '✦', label: 'Nail salon' },
  { id: 'hair_salon', emoji: '✂️', label: 'Hair salon' },
  { id: 'day_spa', emoji: '🫧', label: 'Day spa' },
  { id: 'med_spa', emoji: '💉', label: 'Med spa' },
  { id: 'beauty_clinic', emoji: '✨', label: 'Beauty clinic' },
  { id: 'beauty_umbrella', emoji: '⋯', label: 'Mixed / other' },
];

const BEAUTY_SUBTYPE_OPTIONS: Array<{ id: BeautySubtype; label: string }> = [
  { id: 'beauty_clinic', label: 'Beauty clinic' },
  { id: 'aesthetic_clinic', label: 'Aesthetic clinic' },
  { id: 'wax_studio', label: 'Wax studio' },
  { id: 'lash_studio', label: 'Lash studio' },
  { id: 'brow_studio', label: 'Brow studio' },
  { id: 'other_beauty', label: 'Other beauty service' },
];

const MIXED_SERVICE_GROUP_ICONS: Record<(typeof MIXED_SERVICE_GROUPS)[number], string> = {
  Manicure: '💅',
  Pedicure: '💅',
  'Acrylics / Extensions': '💅',
  Haircuts: '✂️',
  'Hair Color': '🎨',
  Waxing: '🔥',
  Massage: '💆',
  Facials: '💧',
  'Brows & Lashes': '👁',
  Makeup: '✦',
  Injectables: '💉',
  Laser: '⚡',
  'Skin Treatments': '🔬',
  Consultations: '💬',
  Other: '⋯',
};

type ChipSuggestionProfileKey = Vertical | 'lash_studio' | 'aesthetic_clinic' | 'wax_studio' | 'brow_studio';

/** Tier-1 suggested chips by business type; `mixed` / indeterminate → show all chips flat (no tier split, no auto pre-select). */
const CHIP_SUGGESTIONS: Record<ChipSuggestionProfileKey, readonly string[]> = {
  hair_salon: ['Haircuts', 'Hair Color', 'Waxing', 'Brows & Lashes'],
  nail_salon: ['Manicure', 'Pedicure', 'Acrylics / Extensions', 'Waxing'],
  day_spa: ['Massage', 'Facials', 'Waxing', 'Skin Treatments'],
  med_spa: ['Injectables', 'Laser', 'Facials', 'Skin Treatments'],
  beauty_clinic: ['Facials', 'Brows & Lashes', 'Makeup', 'Waxing'],
  lash_studio: ['Brows & Lashes', 'Waxing', 'Facials', 'Makeup'],
  // Botox / filler / laser resurfacing core; facials often bundled at aesthetic clinics.
  aesthetic_clinic: ['Injectables', 'Laser', 'Skin Treatments', 'Facials'],
  // Wax-first; brow shaping common; post-wax skin care; consult common at wax studios.
  wax_studio: ['Waxing', 'Brows & Lashes', 'Skin Treatments', 'Consultations'],
  // Brow-focused + wax/makeup; consult for shaping / tint plans.
  brow_studio: ['Brows & Lashes', 'Waxing', 'Makeup', 'Consultations'],
};

/** Maps Step 1 beauty specialty (under Mixed / beauty_clinic) to tier-1 chip profile. */
const BEAUTY_SUBTYPE_CHIP_KEY: Record<BeautySubtype, ChipSuggestionProfileKey | null> = {
  beauty_clinic: 'beauty_clinic',
  aesthetic_clinic: 'aesthetic_clinic',
  wax_studio: 'wax_studio',
  brow_studio: 'brow_studio',
  lash_studio: 'lash_studio',
  other_beauty: null,
};

/** Returns preset chip keys to select + merge, or `null` for flat-all mode (no auto pre-select). */
function resolveStep3PresetChipKeys(
  vertical: Vertical | '',
  step1Pick: Vertical | 'beauty_umbrella' | '',
  beautySubtype: BeautySubtype | '',
): string[] | null {
  if (step1Pick === 'beauty_umbrella') {
    if (!beautySubtype) return null;
    const tierKey = BEAUTY_SUBTYPE_CHIP_KEY[beautySubtype];
    if (tierKey === null) return null;
    return [...CHIP_SUGGESTIONS[tierKey]];
  }
  if (vertical === 'beauty_clinic' && beautySubtype) {
    const tierKey = BEAUTY_SUBTYPE_CHIP_KEY[beautySubtype];
    if (tierKey === null) return null;
    return [...CHIP_SUGGESTIONS[tierKey]];
  }
  if (step1Pick && step1Pick in CHIP_SUGGESTIONS) {
    return [...CHIP_SUGGESTIONS[step1Pick as keyof typeof CHIP_SUGGESTIONS]];
  }
  if (vertical && vertical in CHIP_SUGGESTIONS) return [...CHIP_SUGGESTIONS[vertical]];
  return null;
}

function step3ChipDisplayPlan(
  vertical: Vertical | '',
  step1Pick: Vertical | 'beauty_umbrella' | '',
  beautySubtype: BeautySubtype | '',
): { flatAll: boolean; tier1: string[]; tier2: string[] } {
  const presetKeys = resolveStep3PresetChipKeys(vertical, step1Pick, beautySubtype);
  if (presetKeys === null) {
    return { flatAll: true, tier1: [...MIXED_SERVICE_GROUPS], tier2: [] };
  }
  const tier1Ordered = presetKeys.filter((name) => MIXED_SERVICE_GROUPS.includes(name as (typeof MIXED_SERVICE_GROUPS)[number]));
  const tier1Set = new Set(tier1Ordered.map((s) => s.toLowerCase()));
  const tier2 = MIXED_SERVICE_GROUPS.filter((name) => !tier1Set.has(name.toLowerCase()));
  return { flatAll: false, tier1: tier1Ordered, tier2 };
}

function shouldShowServiceGroupCard(
  manualSetup: boolean,
  group: string,
  items: Array<{ service: ServiceItem; index: number }>,
  selectedServiceGroups: string[],
): boolean {
  const hasNamedService = items.some(({ service }) => service.name.trim().length > 0);
  if (hasNamedService) return true;
  if (selectedServiceGroups.includes(group)) return true;
  if (!manualSetup) {
    return items.some(({ service }) => Boolean(service.source || service.sourceHint));
  }
  return false;
}

const MANUAL_SERVICE_PRESETS: Record<string, ServiceItem[]> = {
  Haircuts: [
    { name: "Women's haircut", price: 55, duration_min: 45, duration_text: '45min', group: 'Haircuts' },
    { name: "Men's haircut", price: 35, duration_min: 30, duration_text: '30min', group: 'Haircuts' },
    { name: "Children's haircut", price: 25, duration_min: 20, duration_text: '20min', group: 'Haircuts' },
  ],
  'Hair Color': [
    { name: 'All over color', price: 120, duration_min: 90, duration_text: '90min', group: 'Hair Color' },
    { name: 'Highlights', price: 150, duration_min: 120, duration_text: '2hrs', group: 'Hair Color', price_type: 'from' },
    { name: 'Color touch-up', price: 95, duration_min: 60, duration_text: '60min', group: 'Hair Color' },
  ],
  Waxing: [
    { name: 'Eyebrow wax', price: 18, duration_min: 15, duration_text: '15min', group: 'Waxing' },
    { name: 'Lip wax', price: 12, duration_min: 10, duration_text: '10min', group: 'Waxing' },
    { name: 'Full leg wax', price: 65, duration_min: 45, duration_text: '45min', group: 'Waxing' },
  ],
  Massage: [
    { name: '60-min massage', price: 95, duration_min: 60, duration_text: '60min', group: 'Massage' },
    { name: '90-min massage', price: 130, duration_min: 90, duration_text: '90min', group: 'Massage' },
  ],
  Facials: [
    { name: 'Signature facial', price: 85, duration_min: 60, duration_text: '60min', group: 'Facials' },
    { name: 'Express facial', price: 55, duration_min: 30, duration_text: '30min', group: 'Facials' },
  ],
  Manicure: [
    { name: 'Classic manicure', price: 35, duration_min: 30, duration_text: '30min', group: 'Manicure' },
    { name: 'Gel manicure', price: 50, duration_min: 45, duration_text: '45min', group: 'Manicure' },
  ],
  Pedicure: [
    { name: 'Classic pedicure', price: 45, duration_min: 45, duration_text: '45min', group: 'Pedicure' },
    { name: 'Gel pedicure', price: 60, duration_min: 60, duration_text: '60min', group: 'Pedicure' },
  ],
  'Brows & Lashes': [
    { name: 'Classic lash set', price: 120, duration_min: 90, duration_text: '90min', group: 'Brows & Lashes' },
    { name: 'Lash fill', price: 65, duration_min: 60, duration_text: '60min', group: 'Brows & Lashes' },
  ],
};

function manualPresetServicesForGroupName(name: string): ServiceItem[] | undefined {
  const preset = MANUAL_SERVICE_PRESETS[name];
  if (preset) return preset;
  const lower = name.trim().toLowerCase();
  const key = Object.keys(MANUAL_SERVICE_PRESETS).find((k) => k.toLowerCase() === lower);
  return key ? MANUAL_SERVICE_PRESETS[key] : undefined;
}

const VERTICAL_LABELS: Record<Vertical, string> = {
  nail_salon: 'Nail Salon',
  hair_salon: 'Hair Salon',
  day_spa: 'Day Spa',
  med_spa: 'Med Spa',
  beauty_clinic: 'Beauty Clinic / Aesthetic / Wax / Lash',
};

const BEAUTY_SUBTYPE_LABELS: Record<BeautySubtype, string> = {
  beauty_clinic: 'Beauty clinic',
  aesthetic_clinic: 'Aesthetic clinic',
  wax_studio: 'Wax studio',
  lash_studio: 'Lash studio',
  brow_studio: 'Brow studio',
  other_beauty: 'Other beauty service',
};

const SERVICE_PRESETS: Record<Exclude<Vertical, 'beauty_clinic'>, string[]> = {
  nail_salon: ['Manicure', 'Pedicure', 'Gel polish', 'Acrylic full set', 'Dip powder', 'Nail art', 'Removal'],
  hair_salon: ['Haircut', 'Blowout', 'Color', 'Highlights', 'Balayage', 'Treatment'],
  day_spa: ['Facial', 'Massage', 'Waxing', 'Body treatment'],
  med_spa: [
    'Consultation',
    'Botox consultation',
    'Filler consultation',
    'Laser hair removal consultation',
    'Microneedling consultation',
    'Chemical peel consultation',
    'Treatment follow-up',
  ],
};

const BEAUTY_SERVICE_PRESETS: Record<BeautySubtype, string[]> = {
  beauty_clinic: [
    'Facial consultation',
    'Custom facial',
    'Acne treatment',
    'Chemical peel',
    'Microneedling',
    'Skin consultation',
    'LED light therapy',
    'Post-treatment follow-up',
  ],
  aesthetic_clinic: [
    'Aesthetic consultation',
    'Botox consultation',
    'Filler consultation',
    'Laser hair removal consultation',
    'Skin rejuvenation consultation',
    'Microneedling consultation',
    'Chemical peel consultation',
    'Treatment follow-up',
    'New patient inquiry',
  ],
  wax_studio: [
    'Eyebrow wax',
    'Lip wax',
    'Chin wax',
    'Underarm wax',
    'Arm wax',
    'Leg wax',
    'Bikini wax',
    'Brazilian wax',
    'Back wax',
    'Waxing consultation',
  ],
  lash_studio: [
    'Classic lash extensions',
    'Hybrid lash extensions',
    'Volume lash extensions',
    'Mega volume lashes',
    'Lash fill',
    'Lash removal',
    'Lash lift',
    'Lash tint',
    'Patch test request',
    'Aftercare question',
  ],
  brow_studio: [
    'Brow shaping',
    'Brow wax',
    'Brow tint',
    'Brow lamination',
    'Henna brows',
    'Brow consultation',
    'Lash and brow package',
    'Touch-up appointment',
  ],
  other_beauty: [
    'Consultation',
    'New appointment request',
    'Follow-up appointment',
    'Reschedule appointment',
    'Cancellation request',
    'Pricing question',
    'Service not listed',
  ],
};

const COUNTRY_TIMEZONES = [
  { country: 'United States', flag: '🇺🇸', timezones: [
    { label: 'Eastern Time', value: 'America/New_York', offset: 'UTC-5/4' },
    { label: 'Central Time', value: 'America/Chicago', offset: 'UTC-6/5' },
    { label: 'Mountain Time', value: 'America/Denver', offset: 'UTC-7/6' },
    { label: 'Pacific Time', value: 'America/Los_Angeles', offset: 'UTC-8/7' },
    { label: 'Alaska Time', value: 'America/Anchorage', offset: 'UTC-9/8' },
    { label: 'Hawaii Time', value: 'Pacific/Honolulu', offset: 'UTC-10' },
  ] },
  { country: 'Canada', flag: '🇨🇦', timezones: [
    { label: 'Eastern Time', value: 'America/Toronto', offset: 'UTC-5/4' },
    { label: 'Central Time', value: 'America/Winnipeg', offset: 'UTC-6/5' },
    { label: 'Mountain Time', value: 'America/Edmonton', offset: 'UTC-7/6' },
    { label: 'Pacific Time', value: 'America/Vancouver', offset: 'UTC-8/7' },
    { label: 'Atlantic Time', value: 'America/Halifax', offset: 'UTC-4/3' },
    { label: 'Newfoundland Time', value: 'America/St_Johns', offset: 'UTC-3:30' },
  ] },
  { country: 'United Kingdom', flag: '🇬🇧', timezones: [
    { label: 'GMT / BST', value: 'Europe/London', offset: 'UTC+0/1' },
  ] },
  { country: 'Ireland', flag: '🇮🇪', timezones: [
    { label: 'IST / GMT', value: 'Europe/Dublin', offset: 'UTC+0/1' },
  ] },
  { country: 'Australia', flag: '🇦🇺', timezones: [
    { label: 'Sydney / Melbourne (AEST)', value: 'Australia/Sydney', offset: 'UTC+10/11' },
    { label: 'Brisbane (AEST)', value: 'Australia/Brisbane', offset: 'UTC+10' },
    { label: 'Adelaide (ACST)', value: 'Australia/Adelaide', offset: 'UTC+9:30/10:30' },
    { label: 'Perth (AWST)', value: 'Australia/Perth', offset: 'UTC+8' },
    { label: 'Darwin (ACST)', value: 'Australia/Darwin', offset: 'UTC+9:30' },
  ] },
  { country: 'New Zealand', flag: '🇳🇿', timezones: [
    { label: 'NZST / NZDT', value: 'Pacific/Auckland', offset: 'UTC+12/13' },
  ] },
  { country: 'Singapore', flag: '🇸🇬', timezones: [
    { label: 'SGT', value: 'Asia/Singapore', offset: 'UTC+8' },
  ] },
  { country: 'Philippines', flag: '🇵🇭', timezones: [
    { label: 'PST', value: 'Asia/Manila', offset: 'UTC+8' },
  ] },
  { country: 'India', flag: '🇮🇳', timezones: [
    { label: 'IST', value: 'Asia/Kolkata', offset: 'UTC+5:30' },
  ] },
  { country: 'Hong Kong', flag: '🇭🇰', timezones: [
    { label: 'HKT', value: 'Asia/Hong_Kong', offset: 'UTC+8' },
  ] },
  { country: 'South Africa', flag: '🇿🇦', timezones: [
    { label: 'SAST', value: 'Africa/Johannesburg', offset: 'UTC+2' },
  ] },
  { country: 'Jamaica', flag: '🇯🇲', timezones: [
    { label: 'EST', value: 'America/Jamaica', offset: 'UTC-5' },
  ] },
  { country: 'Trinidad and Tobago', flag: '🇹🇹', timezones: [
    { label: 'AST', value: 'America/Port_of_Spain', offset: 'UTC-4' },
  ] },
  { country: 'Fiji', flag: '🇫🇯', timezones: [
    { label: 'FJT', value: 'Pacific/Fiji', offset: 'UTC+12' },
  ] },
] as const;

/** @deprecated Legacy helper — profile step validates business name; step 1 quick path only requires phone. */
export function validateOnboardingStep1(input: { businessName: string; vertical: string; businessPhone: string }): string[] {
  const errors: string[] = [];
  if (!input.businessName.trim()) errors.push('Business name is required.');
  if (!input.businessPhone.trim()) errors.push('Business phone number is required.');
  return errors;
}

/** Step 1 quick path (website/GBP optional): business phone is reviewed later with imported profile details. */
export function validateOnboardingStep1Quick(input: { businessPhone: string }): string[] {
  void input;
  return [];
}

export function validateOnboardingProfileReview(input: { businessName: string }): string[] {
  const errors: string[] = [];
  if (!input.businessName.trim()) errors.push('Business name is required.');
  return errors;
}

function friendlySaveError(error?: string | null): string {
  if (error === 'invalid_payload') return 'Some details need a quick check before saving.';
  return error || 'Unable to save. Please check your details and try again.';
}

export function applyVerticalLanguageSelection(vertical: string, languages: string[]): string[] {
  const next = new Set(['en', ...languages]);
  if (vertical === 'nail_salon') next.add('vi');
  return [...next];
}

function trackOnboarding(event: string, payload?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const extended = window as Window & { ringbookerTrack?: (e: string, p?: Record<string, unknown>) => void };
  extended.ringbookerTrack?.(event, payload);
  window.dispatchEvent(new CustomEvent('ringbooker:onboarding', { detail: { event, ...payload } }));
}

function normalizeWebsiteUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function isProbablyGoogleBusinessUrl(raw: string): boolean {
  const u = raw.trim().toLowerCase();
  return (
    u.includes('google.com/maps') ||
    u.includes('g.page') ||
    u.includes('maps.app.goo.gl') ||
    u.includes('business.google') ||
    u.includes('google.com/local/')
  );
}

export function isHttpWebsiteUrl(raw: string): boolean {
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw.trim()) && !/^https?:\/\//i.test(raw.trim())) return false;
    const url = new URL(normalizeWebsiteUrl(raw));
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function confidenceLabel(confidence?: number): 'AI verified' | 'Needs review' | 'Missing' | 'Review' {
  if (!confidence) return 'Missing';
  if (confidence > 0.9) return 'AI verified';
  if (confidence < 0.7) return 'Needs review';
  return 'Review';
}

export function importSourceLabel(source?: string | null): string {
  if (!source) return 'Missing';
  if (/google/i.test(source)) return 'Google';
  if (/json-ld|website/i.test(source)) return 'Website';
  if (/ai/i.test(source)) return 'Website analysis';
  if (/user/i.test(source)) return 'User';
  return source;
}

export function importRecommendedActionMessage(action?: string | null): string {
  if (action === 'ready_for_review') return 'We found enough details to get started. Please review before saving.';
  if (action === 'needs_manual_review') return 'Some details need your review before saving.';
  if (action === 'partial_import') return 'We found some details, but you may need to add missing information manually.';
  if (action === 'manual_setup_recommended') return 'We couldn’t find enough details. You can set this up manually.';
  if (action === 'service_details_incomplete') return 'We found your business details, but services may need review.';
  if (action === 'retry_with_google_maps_link') return 'A Google Maps link may help RingBooker find more accurate business details.';
  return 'Review and edit these details before saving.';
}

export function importReviewBadgeState(field?: { value?: unknown; confidence?: number; source?: string | null } | null): { label: 'AI verified' | 'Needs review' | 'Missing' | 'Review'; source: string } {
  const missing = !field || field.value === null || field.value === undefined || field.value === '';
  return {
    label: missing ? 'Missing' : confidenceLabel(field.confidence),
    source: missing ? '' : importSourceLabel(field.source),
  };
}

export function serviceSourceLabel(source?: string | null, sourceHint?: string | null): 'Website' | 'Website analysis' | 'Imported' {
  const combined = `${source ?? ''} ${sourceHint ?? ''}`.trim();
  if (!combined) return 'Imported';
  if (/llm|ai|analysis|normalizer/i.test(combined)) return 'Website analysis';
  if (/website|json-?ld|repeated_card|block_detector|semantic|heading_sibling/i.test(combined)) return 'Website';
  return 'Imported';
}

export function serviceReviewBadgeState(service?: Pick<ServiceItem, 'confidence' | 'needsReview' | 'source' | 'sourceHint'> | null): { label: 'AI verified' | 'Needs review' | 'Review'; source: 'Website' | 'Website analysis' | 'Imported' } | null {
  const hasMetadata = Boolean(service && (service.needsReview !== undefined || service.confidence !== undefined || service.source || service.sourceHint));
  if (!service || !hasMetadata) return null;
  const confidence = typeof service.confidence === 'number' ? service.confidence : undefined;
  const label = service.needsReview || (confidence !== undefined && confidence < 0.7)
    ? 'Needs review'
    : confidence !== undefined && confidence > 0.9
      ? 'AI verified'
      : 'Review';
  return {
    label,
    source: serviceSourceLabel(service.source, service.sourceHint),
  };
}

function isImportedFromGoogleSource(source?: string | null): boolean {
  if (!source || typeof source !== 'string') return false;
  return /google/i.test(source);
}

/** Step 2 profile cards: only Google gets a small gray footnote (no AI verified / Review badges). */
function profileImportGoogleFootnote(field?: { source?: string | null } | null): ReactNode {
  if (!field || !isImportedFromGoogleSource(field.source)) return null;
  return <p className="onb-profile-source-footnote">Google</p>;
}

function importedVerticalToApp(value?: string | null): Vertical | '' {
  if (value === 'nail_salon' || value === 'hair_salon' || value === 'day_spa' || value === 'med_spa' || value === 'beauty_clinic') return value;
  if (value === 'spa') return 'day_spa';
  return '';
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

function serviceDurationText(service: Pick<ServiceItem, 'duration_text' | 'duration_min'>): string {
  return service.duration_text?.trim() || (service.duration_min ? `${service.duration_min} min` : '');
}

function titleCaseServiceLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b([a-z])/g, (char) => char.toUpperCase())
    .replace(/\bAnd\b/g, 'and')
    .replace(/\bOr\b/g, 'or')
    .replace(/\bOf\b/g, 'of')
    .replace(/\bWith\b/g, 'with');
}

function serviceGroupIcon(group: string): { icon: string; bg: string } {
  const value = group.toLowerCase();
  if (/color|highlight|balayage/.test(value)) return { icon: '🎨', bg: '#fef3c7' };
  if (/haircut|cut|trim/.test(value)) return { icon: '✂️', bg: '#f0fdf4' };
  if (/style|blowout/.test(value)) return { icon: '💨', bg: '#eff6ff' };
  if (/extension|keratin/.test(value)) return { icon: '✨', bg: '#f5f3ff' };
  if (/wax/.test(value)) return { icon: '🔥', bg: '#fff7ed' };
  if (/massage|body/.test(value)) return { icon: '💆', bg: '#f0fdfa' };
  if (/facial|skin/.test(value)) return { icon: '💧', bg: '#eff6ff' };
  if (/nail|mani|pedi/.test(value)) return { icon: '💅', bg: '#fdf2f8' };
  if (/lash|brow/.test(value)) return { icon: '👁', bg: '#faf5ff' };
  if (/makeup/.test(value)) return { icon: '💄', bg: '#fff1f2' };
  if (/injectable|botox|filler/.test(value)) return { icon: '💉', bg: '#f0fdf4' };
  if (/laser/.test(value)) return { icon: '⚡', bg: '#fffbeb' };
  if (/consultation/.test(value)) return { icon: '💬', bg: '#f8fafc' };
  return { icon: '📋', bg: '#f9fafb' };
}

function formatServicePrice(service: ServiceItem): string {
  if (service.variants?.length) return `${service.variants.length} option${service.variants.length === 1 ? '' : 's'}`;
  if (service.price_type === 'consultation') return 'Consultation';
  if (service.price_type === 'varies' && service.price <= 0) return 'Varies';
  if (!Number.isFinite(service.price) || service.price <= 0) return '$0';
  const amount = `$${service.price}`;
  return service.price_type === 'from' ? `from ${amount}` : amount;
}

function formatServiceVariant(variant: ServiceVariant): string {
  const duration = variant.durationText || (variant.durationMinutes ? `${variant.durationMinutes} min` : '');
  const price = variant.priceType === 'consultation'
    ? 'consultation'
    : variant.priceType === 'varies'
      ? 'varies'
      : variant.priceAmount !== null && variant.priceAmount !== undefined
        ? `${variant.priceType === 'from' ? 'starts at ' : ''}$${variant.priceAmount}`
        : '';
  return [duration || variant.label, price, variant.notes].filter(Boolean).join(' · ');
}

function serviceNeedsAttention(service: ServiceItem): boolean {
  if (service.variants?.length) return service.needsReview === true || service.variants.some((variant) => variant.priceAmount === null || variant.priceAmount === undefined || !((variant.durationText ?? '').trim() || variant.durationMinutes));
  return service.price === 0 || !serviceDurationText(service).trim() || service.needsReview === true;
}

function servicesFromImport(suggestions?: ImportedWebsiteSuggestions): ServiceItem[] {
  const imported = suggestions?.serviceCatalog?.services ?? [];
  return imported
    .filter((service) => service.name.trim().length > 0)
    .map((service) => ({
      name: service.name.trim(),
      duration_min: service.durationMinutes ?? null,
      duration_text: service.durationText ?? (service.durationMinutes ? `${service.durationMinutes} min` : null),
      price: service.priceAmount ?? 0,
      group: service.categoryName?.trim() || 'General Services',
      aliases: service.aliases ?? [],
      price_type: service.priceType ?? ((service.priceAmount ?? 0) > 0 ? 'fixed' : 'varies'),
      bookable: service.bookable ?? true,
      confidence: service.confidence,
      needsReview: service.needsReview,
      source: service.source ?? null,
      sourceHint: service.sourceHint ?? null,
      evidenceSnippet: service.evidenceSnippet?.trim() || null,
      variants: service.variants ?? [],
    }));
}

/** Lightweight URL heuristic until automated extraction ships; user confirms or picks on Profile. */
function inferBusinessFromUrl(raw: string): {
  vertical: Vertical | '';
  beautySubtype: BeautySubtype | '';
  confidence: VerticalConfidence;
} {
  const empty = { vertical: '' as const, beautySubtype: '' as const, confidence: 'none' as const };
  const t = raw.trim();
  if (!t) return empty;
  let combined = '';
  try {
    const u = new URL(normalizeWebsiteUrl(t));
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    combined = `${host} ${u.pathname} ${u.search}`.toLowerCase();
  } catch {
    return empty;
  }

  const has = (...patterns: RegExp[]) => patterns.some((p) => p.test(combined));

  if (
    has(/\bmed(ical)?[\s_-]?spa\b/, /\bmedspa\b/) ||
    (has(/\bbotox\b/, /\bfiller\b/, /\binjectables?\b/) &&
      has(/\bdr[\._]?\b/, /\bmd\b/, /\bphysician\b/, /\bmedical\b/, /\bdoctor\b/))
  ) {
    return { vertical: 'med_spa', beautySubtype: '', confidence: 'high' };
  }

  if (
    has(/\bnailsalon\b/, /\bnail-bar\b/, /\bnailbar\b/, /\bnail[\s-]?spa\b/) ||
    ((has(/\bmani\b/, /\bpedi\b/, /\bnails\b/) || (has(/\bnail\b/) && has(/\bsalon\b/, /\bspa\b/))) && !has(/\bhair\b/, /\bbarber\b/))
  ) {
    const strong = has(/\bnailsalon\b/, /\bnailbar\b/, /\bnail-bar\b/);
    return { vertical: 'nail_salon', beautySubtype: '', confidence: strong ? 'high' : 'low' };
  }

  if (
    has(/\bbarber\b/, /\bhairsalon\b/, /\bhair[\s-]?salon\b/, /\bstylist\b/, /\bbalayage\b/, /\bhighlights\b/) &&
    !has(/\bnail\b/, /\bmed(ical)?[\s_-]?spa\b/, /\bmedspa\b/)
  ) {
    return { vertical: 'hair_salon', beautySubtype: '', confidence: has(/\bhairsalon\b/, /\bhair[\s-]?salon\b/) ? 'high' : 'low' };
  }

  if (
    (has(/\bday[\s_-]?spa\b/) || (has(/\bspa\b/, /\bmassage\b/) && !has(/\bnail\b/, /\bhair[\s-]?salon\b/, /\bbarber\b/))) &&
    !has(/\bmed(ical)?[\s_-]?spa\b/, /\bmedspa\b/)
  ) {
    return { vertical: 'day_spa', beautySubtype: '', confidence: 'low' };
  }

  if (has(/\blash\b/, /\beyelash\b/, /\bextensions\b/) && has(/\blash\b/, /\besthetic\b/, /\bbeauty\b/, /\bstudio\b/) && !has(/\bbrow\b/, /\bwax\b/)) {
    return { vertical: 'beauty_clinic', beautySubtype: 'lash_studio', confidence: 'low' };
  }
  if (has(/\blash\b/, /\beyelash\b/) && !has(/\bbrow\b/, /\bwax\b/)) {
    return { vertical: 'beauty_clinic', beautySubtype: 'lash_studio', confidence: 'low' };
  }
  if ((has(/\bbrow\b/) || has(/\bmicroblading\b/)) && !has(/\bwax\b/, /\blash\b/, /\beyelash\b/)) {
    return { vertical: 'beauty_clinic', beautySubtype: 'brow_studio', confidence: 'low' };
  }
  if (has(/\bwax\b/, /\bwaxing\b/, /\bbrazilian\b/, /\bbikini\b/) && has(/\bstudio\b/, /\bwax\b/, /\bsalon\b/)) {
    return { vertical: 'beauty_clinic', beautySubtype: 'wax_studio', confidence: 'low' };
  }
  if (has(/\baesthetic\b/, /\bjuvederm\b/) && !has(/\bmed(ical)?[\s_-]?spa\b/, /\bmedspa\b/)) {
    return { vertical: 'beauty_clinic', beautySubtype: 'aesthetic_clinic', confidence: 'low' };
  }
  if ((has(/\bskin\b/, /\bfacial\b/, /\bacne\b/) && has(/\bclinic\b/)) || has(/\bdermatology\b/)) {
    return { vertical: 'beauty_clinic', beautySubtype: 'beauty_clinic', confidence: 'low' };
  }

  if (has(/\bbeauty\b/, /\besthetic\b/, /\blash\b/, /\bwax\b/, /\bbrow\b/)) {
    return { vertical: 'beauty_clinic', beautySubtype: 'other_beauty', confidence: 'low' };
  }

  return empty;
}

function getPresetServiceNames(vertical: Vertical | '', beautySubtype: BeautySubtype | ''): string[] {
  if (!vertical) return [];
  if (vertical === 'beauty_clinic') {
    if (beautySubtype && BEAUTY_SERVICE_PRESETS[beautySubtype]) return BEAUTY_SERVICE_PRESETS[beautySubtype];
    return BEAUTY_SERVICE_PRESETS.other_beauty;
  }
  return SERVICE_PRESETS[vertical];
}

function parseBeautySubtype(raw: string | null | undefined): BeautySubtype | '' {
  const v = (raw ?? '').trim();
  const allowed: BeautySubtype[] = ['beauty_clinic', 'aesthetic_clinic', 'wax_studio', 'lash_studio', 'brow_studio', 'other_beauty'];
  return allowed.includes(v as BeautySubtype) ? (v as BeautySubtype) : '';
}

function verticalToWebDemoPath(v: Vertical | ''): string {
  switch (v) {
    case 'nail_salon':
      return '/industries/nail-salon';
    case 'hair_salon':
      return '/industries/hair-salon';
    case 'day_spa':
      return '/industries/spa';
    case 'med_spa':
      return '/industries/med-spa';
    case 'beauty_clinic':
      return '/industries/beauty-clinic';
    default:
      return '/demo';
  }
}

function defaultHours(): WizardHours {
  return {
    mon: { open: true, from: '09:00', to: '19:00' },
    tue: { open: true, from: '09:00', to: '19:00' },
    wed: { open: true, from: '09:00', to: '19:00' },
    thu: { open: true, from: '09:00', to: '19:00' },
    fri: { open: true, from: '09:00', to: '19:00' },
    sat: { open: true, from: '09:00', to: '18:00' },
    sun: { open: false, from: '09:00', to: '18:00' },
  };
}

function emptyHours(): WizardHours {
  return Object.fromEntries(
    DAYS.map(([day]) => [day, { open: false, from: '09:00', to: '18:00' }]),
  ) as WizardHours;
}

function presetWeekendClosed(h: WizardHours): WizardHours {
  return {
    ...h,
    sat: { ...h.sat, open: false },
    sun: { ...h.sun, open: false },
  };
}

function presetOpen7Days(h: WizardHours): WizardHours {
  const next = { ...h };
  for (const [day] of DAYS) {
    next[day] = { ...next[day], open: true };
  }
  return next;
}

function apiHoursToWizard(hours: ApiHours): WizardHours {
  const next = defaultHours();
  for (const [day] of DAYS) {
    const item = hours[day];
    if (!item) continue;
    if ('closed' in item) next[day] = { ...next[day], open: false };
    else next[day] = { open: true, from: item.open, to: item.close };
  }
  return next;
}

function wizardHoursToApi(hours: WizardHours): ApiHours {
  return Object.fromEntries(
    Object.entries(hours).map(([day, item]) => [
      day,
      item.open ? { open: item.from, close: item.to } : { closed: true },
    ]),
  ) as ApiHours;
}

function normalizeStep(value?: number | null): WizardStep {
  return value === 2 || value === 3 || value === 4 ? value : 1;
}

function cleanServices(rows: ServiceItem[]): ServiceItem[] {
  return rows
    .filter((item) => item.name.trim().length > 0)
    .map((item) => ({
      name: item.name.trim(),
      duration_min: item.duration_min && item.duration_min > 0 ? item.duration_min : parseDurationTextToMinutes(item.duration_text),
      duration_text: item.duration_text?.trim() || (item.duration_min ? `${item.duration_min} min` : null),
      price: Number.isFinite(item.price) ? item.price : 0,
      group: item.group?.trim() || 'General Services',
      aliases: item.aliases ?? [],
      price_type: item.price_type ?? (item.price > 0 ? 'fixed' : 'varies'),
      bookable: item.bookable ?? true,
      variants: (item.variants ?? []).slice(0, 20).map((variant, index) => ({
        ...variant,
        label: variant.label?.trim() || variant.durationText?.trim() || (variant.priceAmount !== null && variant.priceAmount !== undefined ? `$${variant.priceAmount}` : `Option ${index + 1}`),
        durationText: variant.durationText?.trim() || (variant.durationMinutes ? `${variant.durationMinutes} min` : null),
        durationMinutes: variant.durationMinutes ?? null,
        priceAmount: variant.priceAmount ?? null,
        priceCurrency: variant.priceCurrency ?? 'USD',
        priceType: variant.priceType ?? 'fixed',
        sortOrder: variant.sortOrder ?? index,
        notes: variant.notes ?? null,
      })),
    }));
}

function onboardingClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `service-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function suggestedGroupsForVertical(vertical: Vertical | '', subtype: BeautySubtype | '') {
  if (vertical === 'nail_salon') return ['Manicure', 'Pedicure', 'Acrylics / Extensions'];
  if (vertical === 'hair_salon') return ['Haircuts', 'Hair Color', 'Treatments'];
  if (vertical === 'day_spa') return ['Facials', 'Massage', 'Waxing'];
  if (vertical === 'med_spa') return ['Injectables', 'Laser', 'Facials'];
  if (vertical === 'beauty_clinic' && subtype === 'wax_studio') return ['Waxing', 'Brows', 'Packages'];
  if (vertical === 'beauty_clinic' && subtype === 'lash_studio') return ['Lash Sets', 'Lash Fills', 'Brows'];
  if (vertical === 'beauty_clinic') return ['Facials', 'Waxing', 'Lash / Brow'];
  return ['General Services'];
}

function servicesFromCatalog(catalog?: ServiceCatalogResponse | null): ServiceItem[] {
  if (!catalog?.services.length) return [];
  return catalog.services
    .filter((service) => service.active !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((service) => {
      const category = catalog.categories.find((item) => item.id === service.categoryId);
      return {
        name: service.name,
        duration_min: service.durationMinutes ?? null,
        duration_text: service.durationText ?? (service.durationMinutes ? `${service.durationMinutes} min` : null),
        price: service.priceAmount ?? 0,
        group: category?.name ?? 'General Services',
        aliases: service.aliases ?? [],
        price_type: service.priceType ?? 'fixed',
        bookable: service.bookable ?? true,
        variants: service.variants ?? [],
      };
    });
}

function serviceCatalogFromRows(rows: ServiceItem[], extraGroups: string[] = []) {
  const cleaned = cleanServices(rows);
  const groupNames = [
    ...new Set([
      ...extraGroups.map((group) => group.trim()).filter(Boolean),
      ...cleaned.map((service) => service.group?.trim() || 'General Services'),
    ]),
  ];
  const categories = groupNames.map((name, index) => ({
    id: onboardingClientId(),
    name,
    sortOrder: index,
    active: true,
  }));
  return {
    categories,
    services: cleaned.map((service, index) => {
      const category = categories.find((item) => item.name === (service.group?.trim() || 'General Services')) ?? categories[0];
      return {
        id: onboardingClientId(),
        categoryId: category?.id ?? null,
        name: service.name,
        durationMinutes: service.duration_min,
        durationText: service.duration_text ?? (service.duration_min ? `${service.duration_min} min` : null),
        priceAmount: service.price,
        priceCurrency: 'USD',
        priceType: service.price_type ?? (service.price > 0 ? 'fixed' : 'varies'),
        bookable: service.bookable ?? true,
        active: true,
        sortOrder: index,
        aliases: service.aliases ?? [],
        variants: service.variants ?? [],
      };
    }),
  };
}

function findCountryForTimezone(timezone: string) {
  return COUNTRY_TIMEZONES.find((item) => item.timezones.some((zone) => zone.value === timezone));
}

function formatTimeLabel(value: string): string {
  const [hourRaw, minute = '00'] = value.split(':');
  const hour = Number(hourRaw);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function summarizeHours(hours: WizardHours): string {
  if (DAYS.every(([day]) => !hours[day].open)) return 'Not set';
  const parts = DAYS.map(([day, label]) => {
    const row = hours[day];
    if (!row.open) return `${label}: Closed`;
    return `${label}: ${formatTimeLabel(row.from)}–${formatTimeLabel(row.to)}`;
  });
  return parts.join(' · ');
}

/** Step 2 read-only hours: two columns Mon–Thu | Fri–Sun */
function ProfileHoursPreviewGrid({ hours: h }: { hours: WizardHours }) {
  if (DAYS.every(([day]) => !h[day].open)) {
    return <div className="profile-review-value">Not set</div>;
  }
  const row = (dayKey: (typeof DAYS)[number][0], label: string) => {
    const day = h[dayKey];
    const closed = !day.open;
    return (
      <div className="hours-row" key={dayKey}>
        <span className="hours-day">{label}</span>
        {closed ? (
          <span className="hours-closed">Closed</span>
        ) : (
          <span className="hours-time">
            {formatTimeLabel(day.from)}–{formatTimeLabel(day.to)}
          </span>
        )}
      </div>
    );
  };
  return (
    <div className="onb-step2-hours-preview">
      <div className="hours-grid">
        <div className="hours-grid-col">{DAYS.slice(0, 4).map(([d, l]) => row(d, l))}</div>
        <div className="hours-grid-col">{DAYS.slice(4).map(([d, l]) => row(d, l))}</div>
      </div>
    </div>
  );
}

const STEP2_LANGUAGE_CHIPS: Array<{ code: string; label: string; required?: boolean }> = [
  { code: 'en', label: 'English', required: true },
  { code: 'es', label: 'Spanish' },
  { code: 'zh', label: 'Mandarin' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'other', label: 'Other' },
];

function toggleStep2Language(current: string[], code: string, selected: boolean): string[] {
  if (code === 'en') return current;
  const withoutOther = current.filter((c) => c !== 'other');
  const next = new Set(withoutOther);
  if (code === 'other') {
    if (selected) next.add('other');
    else next.delete('other');
  } else if (selected) next.add(code);
  else next.delete(code);
  next.add('en');
  const out = [...next];
  return out.includes('other') ? [...out.filter((c) => c !== 'other'), 'other'] : out;
}

function toggleLanguage(current: string[], language: string, checked: boolean): string[] {
  const next = new Set(['en', ...current]);
  if (checked) next.add(language);
  else next.delete(language);
  return [...next];
}

export function UserOnboardingLive({ initialData = null }: { initialData?: OnboardingStatusResponse | null }) {
  const router = useRouter();
  const initialShop = initialData?.ok ? initialData.shop : null;
  const initialRawPhone = (initialShop?.phone_number ?? initialShop?.user_phone ?? '').trim();
  const initialSyntheticPhone = isSignupSyntheticPlaceholderPhone(initialRawPhone);
  const initialVertical = initialShop?.vertical ?? '';
  const initialBeautySubtype = initialShop?.vertical === 'beauty_clinic' ? parseBeautySubtype(initialShop.vertical_detail) : '';
  const initialServices = initialShop
    ? (() => {
        const catalogServices = servicesFromCatalog(initialShop.service_catalog);
        return catalogServices.length > 0
          ? catalogServices
          : initialShop.services.length > 0
            ? initialShop.services
            : [];
      })()
    : [];

  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(initialData && !initialData.ok ? initialData.error ?? 'Unable to load onboarding.' : null);
  const [profileReviewMessage, setProfileReviewMessage] = useState<string | null>(null);
  const [profileReviewInvalidFields, setProfileReviewInvalidFields] = useState<ProfileReviewRequiredField[]>([]);
  const [shopId, setShopId] = useState(initialShop?.id ?? '');
  const [currentStep, setCurrentStep] = useState<WizardStep>(normalizeStep(initialShop?.current_onboarding_step));
  const [businessName, setBusinessName] = useState(initialShop?.name ?? '');
  const [address, setAddress] = useState(typeof initialShop?.address === 'string' ? initialShop.address : '');
  const [vertical, setVertical] = useState<Vertical | ''>(initialVertical);
  const [businessPhone, setBusinessPhone] = useState(initialSyntheticPhone ? '' : formatPhoneForDisplay(initialRawPhone));
  const [businessPhoneNeedsRealEntry, setBusinessPhoneNeedsRealEntry] = useState(initialSyntheticPhone);
  const [hours, setHours] = useState<WizardHours>(() => initialShop ? apiHoursToWizard(initialShop.hours ?? {}) : defaultHours());
  const [selectedCountry, setSelectedCountry] = useState(initialShop ? findCountryForTimezone(initialShop.timezone || 'America/Los_Angeles')?.country ?? 'United States' : '');
  const [timezone, setTimezone] = useState(initialShop?.timezone || 'America/Los_Angeles');
  const [languages, setLanguages] = useState<string[]>(applyVerticalLanguageSelection(initialVertical, initialShop?.languages ?? ['en']));
  const [shopPlan, setShopPlan] = useState<ShopPlan>(initialShop?.plan ?? 'starter');
  const [websiteUrl, setWebsiteUrl] = useState(initialShop?.website_url ?? '');
  const [websiteLoading, setWebsiteLoading] = useState(false);
  const [websiteImportAttempted, setWebsiteImportAttempted] = useState(Boolean(initialShop?.website_url?.trim()));
  const [servicesFound, setServicesFound] = useState(0);
  const [importSuggestions, setImportSuggestions] = useState<ImportedWebsiteSuggestions | null>(null);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [importProgressStep, setImportProgressStep] = useState(0);
  const [importDelayMessage, setImportDelayMessage] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceItem[]>(initialServices);
  const [selectedServiceGroups, setSelectedServiceGroups] = useState<string[]>(
    [...new Set(initialServices.map((service) => service.group?.trim()).filter((group): group is string => Boolean(group)))],
  );
  const [collapsedServiceGroups, setCollapsedServiceGroups] = useState<string[]>([]);
  const [pendingScrollServiceGroup, setPendingScrollServiceGroup] = useState<string | null>(null);
  const [serviceEditor, setServiceEditor] = useState<{
    index: number | null;
    group: string;
    draft: ServiceItem;
    mode: 'inline' | 'sheet';
  } | null>(null);
  const [groupRenameDesktop, setGroupRenameDesktop] = useState<string | null>(null);
  const [groupRenameDraft, setGroupRenameDraft] = useState('');
  const groupRenameInputRef = useRef<HTMLInputElement | null>(null);
  const [groupRenameMobile, setGroupRenameMobile] = useState<string | null>(null);
  const [groupRenameMobileDraft, setGroupRenameMobileDraft] = useState('');
  const [serviceCatalogEnabled, setServiceCatalogEnabled] = useState(initialData?.ok ? initialData.serviceCatalogEnabled === true : false);
  const [importSource, setImportSource] = useState<ImportSource>(
    initialShop?.website_url?.trim()
      ? isProbablyGoogleBusinessUrl(initialShop.website_url)
        ? 'google_business'
        : 'website'
      : 'none',
  );
  const [step1View, setStep1View] = useState<Step1View>('quick');
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [profileEditField, setProfileEditField] = useState<ProfileEditField>(null);
  const [userEditedProfileFields, setUserEditedProfileFields] = useState<Array<Exclude<ProfileEditField, null>>>([]);
  const isStep2Mobile = useMatchMedia('(max-width: 768px)');
  const [step2Sheet, setStep2Sheet] = useState<Step2SheetKind | null>(null);
  const [mobileInlineEdit, setMobileInlineEdit] = useState<'name' | 'phone' | 'website' | null>(null);
  const [mobileInlineDraft, setMobileInlineDraft] = useState('');
  const [tzSheetCountry, setTzSheetCountry] = useState('');
  const [tzSheetTimezone, setTzSheetTimezone] = useState('');
  const [tzSheetSearch, setTzSheetSearch] = useState('');
  const [addressSheetDraft, setAddressSheetDraft] = useState('');
  const [hoursSheetDraft, setHoursSheetDraft] = useState<WizardHours>(() => defaultHours());
  const mobileInlineCardRef = useRef<HTMLDivElement | null>(null);
  const typeSheetSnapshotRef = useRef<{
    vertical: Vertical | '';
    beautySubtype: BeautySubtype | '';
    profilePickPrimary: Vertical | 'beauty_umbrella' | '';
    profilePickSubtype: BeautySubtype | '';
  } | null>(null);

  const allTimezoneOptions = useMemo(
    () =>
      COUNTRY_TIMEZONES.flatMap((item) =>
        item.timezones.map((zone) => ({
          value: zone.value,
          label: `${zone.label} (${zone.offset})`,
          country: item.country,
          flag: item.flag,
        })),
      ),
    [],
  );
  const [manualPrimaryPick, setManualPrimaryPick] = useState<Vertical | 'beauty_umbrella' | ''>('');
  const [beautySubtype, setBeautySubtype] = useState<BeautySubtype | ''>(initialBeautySubtype);
  const [verticalConfidence, setVerticalConfidence] = useState<VerticalConfidence>(initialVertical ? 'high' : 'none');
  const [profileTypeEditOpen, setProfileTypeEditOpen] = useState(false);
  const [profilePickPrimary, setProfilePickPrimary] = useState<Vertical | 'beauty_umbrella' | ''>('');
  const [profilePickSubtype, setProfilePickSubtype] = useState<BeautySubtype | ''>('');
  const [testCallStatus, setTestCallStatus] = useState<string | null>(null);
  const importTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const importRequestRef = useRef(0);
  const serviceNameInputRef = useRef<HTMLInputElement | null>(null);
  const [step4Phase, setStep4Phase] = useState<'try' | 'done'>('try');
  const prevStepRef = useRef<WizardStep>(1);
  /** Captures Step 1 manual primary vertical before finalize clears `manualPrimaryPick` (needed for Step 3 chip pre-select; `beauty_umbrella` = mixed). */
  const step1ManualPrimaryRef = useRef<Vertical | 'beauty_umbrella' | ''>('');
  const step3ChipPresetsAppliedRef = useRef(false);
  const [addGroupSheetConfig, setAddGroupSheetConfig] = useState<{ title: string; placeholder: string } | null>(null);
  const [step3ShowMoreChips, setStep3ShowMoreChips] = useState(false);

  useEffect(() => {
    const enteredProfile = currentStep === 2 && prevStepRef.current !== 2;
    if (enteredProfile) {
      if (vertical === 'beauty_clinic' && beautySubtype) {
        setProfilePickPrimary('beauty_umbrella');
        setProfilePickSubtype(beautySubtype);
      } else if (vertical) {
        setProfilePickPrimary(vertical);
        setProfilePickSubtype('');
      } else {
        setProfilePickPrimary('');
        setProfilePickSubtype('');
      }
      setProfileTypeEditOpen(verticalConfidence !== 'high');
    }
    prevStepRef.current = currentStep;
  }, [currentStep, vertical, beautySubtype, verticalConfidence]);

  useEffect(() => {
    if (isStep2Mobile) {
      setProfileEditField(null);
    } else {
      setStep2Sheet(null);
      setMobileInlineEdit(null);
    }
  }, [isStep2Mobile]);

  useEffect(() => {
    if (!mobileInlineEdit) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = mobileInlineCardRef.current;
      if (root && !root.contains(e.target as Node)) {
        setMobileInlineEdit(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [mobileInlineEdit]);

  useEffect(() => {
    if (initialShop) return;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const match = findCountryForTimezone(detected);
    if (match) {
      setSelectedCountry(match.country);
      setTimezone(detected);
    }
  }, [initialShop]);

  useEffect(() => {
    if (initialData) return;
    void loadOnboarding();
  }, [initialData]);

  useEffect(() => {
    trackOnboarding('onboarding_start');
  }, []);

  useEffect(() => {
    return () => {
      importTimersRef.current.forEach((timer) => clearTimeout(timer));
      importTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (vertical === 'nail_salon') {
      setLanguages((current) => applyVerticalLanguageSelection(vertical, current));
    }
  }, [vertical]);

  useEffect(() => {
    serviceNameInputRef.current?.focus();
  }, [serviceEditor?.index, serviceEditor?.mode]);

  useEffect(() => {
    const groups = [...new Set(services.map((service) => service.group?.trim() || 'General Services'))];
    const totalServices = services.filter((service) => service.name.trim().length > 0).length;
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
    if (totalServices <= 8) {
      setCollapsedServiceGroups([]);
    } else if (totalServices <= 20) {
      setCollapsedServiceGroups(isMobile ? groups : []);
    } else {
      setCollapsedServiceGroups(isMobile ? groups : groups.slice(1));
    }
  }, [services]);

  useEffect(() => {
    if (!pendingScrollServiceGroup || typeof document === 'undefined') return;
    const name = pendingScrollServiceGroup;
    setPendingScrollServiceGroup(null);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        document.querySelector(`[data-service-group="${escaped}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [pendingScrollServiceGroup]);

  useEffect(() => {
    if (currentStep !== 3) {
      step3ChipPresetsAppliedRef.current = false;
      setStep3ShowMoreChips(false);
      return;
    }
    if (step3ChipPresetsAppliedRef.current) return;
    const hasContext = Boolean(vertical || step1ManualPrimaryRef.current);
    if (!hasContext) return;
    step3ChipPresetsAppliedRef.current = true;
    const chipKeys = resolveStep3PresetChipKeys(vertical, step1ManualPrimaryRef.current, beautySubtype);
    setSelectedServiceGroups((prev) => {
      let next = prev.filter((g) => g !== 'Other');
      if (chipKeys === null) return next;
      const setLower = new Set(next.map((g) => g.toLowerCase()));
      for (const c of chipKeys) {
        if (!setLower.has(c.toLowerCase())) {
          next = [...next, c];
          setLower.add(c.toLowerCase());
        }
      }
      return next;
    });
    if (chipKeys === null || chipKeys.length === 0) return;
    setServices((current) => {
      let next = current.filter((service) => service.name.trim().length > 0);
      const existing = new Set(next.map((service) => `${service.group || 'General Services'}:${service.name}`.toLowerCase()));
      for (const group of chipKeys) {
        const preset = MANUAL_SERVICE_PRESETS[group];
        if (!preset) continue;
        for (const service of preset) {
          const key = `${service.group || 'General Services'}:${service.name}`.toLowerCase();
          if (!existing.has(key)) {
            next = [...next, service];
            existing.add(key);
          }
        }
      }
      return next;
    });
  }, [currentStep, vertical, beautySubtype]);

  useEffect(() => {
    if (groupRenameDesktop) {
      groupRenameInputRef.current?.focus();
      groupRenameInputRef.current?.select();
    }
  }, [groupRenameDesktop]);

  function clearImportProgressTimers() {
    importTimersRef.current.forEach((timer) => clearTimeout(timer));
    importTimersRef.current = [];
  }

  function startImportProgressTimers() {
    clearImportProgressTimers();
    setImportProgress('Preparing your review');
    setImportProgressStep(0);
    setImportDelayMessage(null);
    const checkpoints = [1800, 4000, 6500, 8500, 20000, 120000];
    importTimersRef.current = checkpoints.map((delay) =>
      setTimeout(() => {
        setImportProgressStep(importProgressStepIndex(delay));
        setImportProgress('Preparing your review');
        setImportDelayMessage(importProgressDelayMessage(delay));
      }, delay),
    );
  }

  function stopImportProgressTimers() {
    clearImportProgressTimers();
    setImportProgressStep(0);
    setImportProgress(null);
    setImportDelayMessage(null);
  }

  async function completeImportProgress(requestId: number, startedAt: number, resultText: string) {
    const elapsed = Date.now() - startedAt;
    if (elapsed < 900) await wait(900 - elapsed);
    if (importRequestRef.current !== requestId) return false;
    clearImportProgressTimers();
    setImportProgressStep(4);
    setImportProgress(resultText);
    setImportDelayMessage(null);
    await wait(650);
    return importRequestRef.current === requestId;
  }

  function renderImportProgressCard() {
    return (
      <div className="onb-import-progress" role="status" aria-live="polite">
        <div>
          <p className="onb-import-progress-title">{importProgress ?? IMPORT_PROGRESS_STEPS[importProgressStep]}</p>
          <p className="onb-import-progress-sub">
            We&apos;re reading your website and filling in your profile. You’ll review and edit everything before saving.
          </p>
        </div>
        <div className="onb-import-steps">
          {IMPORT_PROGRESS_STEPS.map((step, index) => (
            <div key={step} className={`onb-import-step ${index < importProgressStep ? 'done' : ''} ${index === importProgressStep ? 'active' : ''}`}>
              <span className="onb-import-step-mark">
                {index < importProgressStep ? '✓' : index === importProgressStep ? <span className="onb-spinner" /> : index + 1}
              </span>
              <span>{step}</span>
            </div>
          ))}
        </div>
        {importDelayMessage ? <div className="onb-import-delay">{importDelayMessage}</div> : null}
        <div className="onb-import-progress-actions onb-import-manual-desktop-row">
          <button type="button" className="onb-help-link" onClick={() => enterManualSetup()}>
            Set up manually instead
          </button>
        </div>
      </div>
    );
  }

  async function loadOnboarding(options?: { silent?: boolean }) {
    const silent = options?.silent === true;
    if (!silent) setLoading(true);
    const response = await fetch('/api/backend/user/onboarding-status');
    const body = (await response.json().catch(() => null)) as OnboardingStatusResponse | null;
    if (!body?.ok || !body.shop) {
      setStatus(body?.error ?? 'Unable to load onboarding.');
      if (!silent) setLoading(false);
      return;
    }
    setShopId(body.shop.id);
    setBusinessName(body.shop.name ?? '');
    setAddress(typeof body.shop.address === 'string' ? body.shop.address : '');
    setVertical(body.shop.vertical ?? '');
    const subtype = parseBeautySubtype(body.shop.vertical_detail);
    setBeautySubtype(body.shop.vertical === 'beauty_clinic' ? subtype : '');
    setVerticalConfidence(body.shop.vertical ? 'high' : 'none');
    const rawPhone = (body.shop.phone_number ?? body.shop.user_phone ?? '').trim();
    const syntheticSignupPhone = isSignupSyntheticPlaceholderPhone(rawPhone);
    setBusinessPhone(syntheticSignupPhone ? '' : rawPhone);
    setBusinessPhoneNeedsRealEntry(syntheticSignupPhone);
    const savedTimezone = body.shop.timezone || 'America/Los_Angeles';
    setTimezone(savedTimezone);
    setSelectedCountry(findCountryForTimezone(savedTimezone)?.country ?? 'United States');
    setHours(apiHoursToWizard(body.shop.hours ?? {}));
    setLanguages(applyVerticalLanguageSelection(body.shop.vertical ?? '', body.shop.languages ?? ['en']));
    const savedSite = body.shop.website_url ?? '';
    setWebsiteUrl(savedSite);
    setWebsiteImportAttempted(Boolean(savedSite.trim()));
    if (savedSite.trim() && isProbablyGoogleBusinessUrl(savedSite)) setImportSource('google_business');
    else if (savedSite.trim()) setImportSource('website');
    else setImportSource('none');
    const catalogServices = servicesFromCatalog(body.shop.service_catalog);
    setServiceCatalogEnabled(body.serviceCatalogEnabled === true);
    const nextServices = catalogServices.length > 0 ? catalogServices : body.shop.services.length > 0 ? body.shop.services : [];
    setServices(nextServices);
    setSelectedServiceGroups([...new Set(nextServices.map((service) => service.group?.trim()).filter((group): group is string => Boolean(group)))]);
    setCurrentStep(normalizeStep(body.shop.current_onboarding_step));
    setShopPlan(body.shop.plan ?? 'starter');
    if (normalizeStep(body.shop.current_onboarding_step) === 1) {
      setStep1View('quick');
      setManualEntryOpen(false);
      setManualPrimaryPick('');
    }
    if (!silent) setLoading(false);
  }

  async function saveSettings(patch: Record<string, unknown>) {
    setSaving(true);
    setStatus(null);
    const response = await fetch('/api/backend/user/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setSaving(false);
    if (!response.ok || !body?.ok) {
      const message = friendlySaveError(body?.error);
      if (currentStep === 2) {
        setProfileReviewMessage(message);
        setStatus(null);
      } else {
        setStatus(message);
      }
      return false;
    }
    return true;
  }

  async function saveQuickContinue() {
    const errors = validateOnboardingStep1Quick({ businessPhone });
    if (errors.length > 0) {
      setStatus(errors.join(' '));
      return;
    }

    const trimmed = websiteUrl.trim();
    if (manualEntryOpen) {
      await continueManualVerticalSelection();
      return;
    }

    trackOnboarding('business_import_started', { mode: 'quick' });
    setStatus(null);

    let nextVertical: Vertical | '' = '';
    let nextSubtype: BeautySubtype | '' = '';
    let nextConfidence: VerticalConfidence = 'none';

    if (trimmed) {
      if (!isHttpWebsiteUrl(trimmed)) {
        setStatus('Enter a valid website URL or Google Maps link, leave blank, or use manual setup.');
        return;
      }
      const canonicalUrl = normalizeWebsiteUrl(trimmed);
      if (!WEBSITE_IMPORT_EXTRACTION_ACTIVE) {
        setWebsiteImportAttempted(false);
        setWebsiteUrl(canonicalUrl);
        setImportSource('manual');
      } else {
        const importRequestId = importRequestRef.current + 1;
        importRequestRef.current = importRequestId;
        const importStartedAt = Date.now();
        setWebsiteLoading(true);
        startImportProgressTimers();
        let importFailed = false;
        let importResultText = '';
        try {
          const response = await fetch('/api/backend/user/onboarding/import-website', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: canonicalUrl }),
          });
          const body = (await response.json().catch(() => null)) as ImportWebsiteResponse | null;
          if (importRequestRef.current !== importRequestId) return;
          setWebsiteImportAttempted(true);
          if (response.ok && body?.suggestions) {
            const suggestions = body.suggestions;
            importResultText = importResultMessage(suggestions);
            setImportSuggestions(suggestions);
            setStatus(importResultText);
            const importedServices = servicesFromImport(suggestions);
            setServicesFound(importedServices.length);
            if (!userEditedProfileFields.includes('name')) setBusinessName(suggestions.businessProfile.name?.value ?? '');
            if (!userEditedProfileFields.includes('phone')) {
              setBusinessPhone(suggestions.businessProfile.phone?.value ? formatPhoneForDisplay(suggestions.businessProfile.phone.value) : '');
              setBusinessPhoneNeedsRealEntry(false);
            }
            if (!userEditedProfileFields.includes('address')) setAddress(suggestions.businessProfile.address?.value ?? '');
            if (!userEditedProfileFields.includes('timezone')) {
              const importedTimezone = suggestions.businessProfile.timezone?.value?.trim() ?? '';
              if (importedTimezone) {
                setTimezone(importedTimezone);
                setSelectedCountry(findCountryForTimezone(importedTimezone)?.country ?? '');
              }
            }
            if (!userEditedProfileFields.includes('hours')) setHours(suggestions.hours?.value ? apiHoursToWizard(suggestions.hours.value) : emptyHours());
            const importedVertical = importedVerticalToApp(suggestions.businessProfile.primaryType?.value);
            if (importedVertical && !userEditedProfileFields.includes('type')) {
              nextVertical = importedVertical;
              nextSubtype = '';
              nextConfidence = (suggestions.businessProfile.primaryType?.confidence ?? 0) >= 0.7 ? 'high' : 'low';
            }
            if (importedServices.length > 0) {
              setServices(importedServices);
              setSelectedServiceGroups([...new Set(importedServices.map((service) => service.group || 'General Services'))]);
            } else if (suggestions.alsoOffers?.length) {
              setSelectedServiceGroups([...new Set(suggestions.alsoOffers.map((item) => item.value).filter((value): value is string => Boolean(value)))]);
            }
            trackOnboarding('business_import_success', { servicesFound: importedServices.length });
          } else {
            setImportSuggestions(null);
            importFailed = true;
            importResultText = importResultMessage(null, true);
            setStatus(importResultText);
            trackOnboarding('business_import_failed', { reason: body?.error ?? 'import_website' });
          }
        } catch {
          if (importRequestRef.current !== importRequestId) return;
          trackOnboarding('business_import_failed', { reason: 'network' });
          setWebsiteImportAttempted(true);
          setImportSuggestions(null);
          importFailed = true;
          importResultText = importResultMessage(null, true);
          setStatus(importResultText);
        }
        if (importRequestRef.current !== importRequestId) return;
        const progressCompleted = await completeImportProgress(importRequestId, importStartedAt, importResultText || importResultMessage(null, importFailed));
        if (!progressCompleted) return;
        setWebsiteLoading(false);
        stopImportProgressTimers();
        setWebsiteUrl(canonicalUrl);
        setImportSource(isProbablyGoogleBusinessUrl(trimmed) ? 'google_business' : 'website');
        if (importFailed) return;
      }
    } else {
      setStatus('Paste your website or Google Maps link, or choose “No website? Fill in manually.”');
      return;
    }

    setVertical(nextVertical);
    setBeautySubtype(nextVertical === 'beauty_clinic' ? nextSubtype : '');
    setVerticalConfidence(nextConfidence);

    const patch: Record<string, unknown> = {
      current_onboarding_step: 2,
    };
    if (businessPhone.trim()) {
      const normalizedPhone = normalizePhoneForStorage(businessPhone, address || undefined) ?? businessPhone;
      patch.phone_number = normalizedPhone;
      patch.user_phone = normalizedPhone;
    }
    const ok = await saveSettings(patch);
    if (ok) {
      setCurrentStep(2);
      setStep1View('quick');
      setProfileTypeEditOpen(nextConfidence !== 'high');
      setProfilePickPrimary('');
      setProfilePickSubtype('');
    }
  }

  function enterManualSetup() {
    importRequestRef.current += 1;
    setWebsiteLoading(false);
    stopImportProgressTimers();
    trackOnboarding('business_import_started', { mode: 'manual_wizard' });
    setImportSource('manual');
    setWebsiteImportAttempted(false);
    setImportSuggestions(null);
    setVerticalConfidence('none');
    if (vertical === 'beauty_clinic' && beautySubtype) {
      setManualPrimaryPick('beauty_umbrella');
    } else if (vertical) {
      setManualPrimaryPick(vertical);
    }
    setManualEntryOpen(true);
    setStep1View('quick');
    setStatus(null);
  }

  async function finalizeManualStep1AndGoProfile(v: Vertical, subtype: BeautySubtype | '') {
    const patch: Record<string, unknown> = {
      vertical: v,
      vertical_detail: v === 'beauty_clinic' && subtype ? subtype : null,
      current_onboarding_step: 2,
    };
    if (businessName.trim()) {
      patch.name = businessName.trim();
      patch.user_name = businessName.trim();
    }
    if (businessPhone.trim()) {
      const normalizedPhone = normalizePhoneForStorage(businessPhone, address || undefined) ?? businessPhone.trim();
      patch.phone_number = normalizedPhone;
      patch.user_phone = normalizedPhone;
    }

    const trimmed = websiteUrl.trim();
    if (trimmed && isHttpWebsiteUrl(trimmed)) {
      const canonicalUrl = normalizeWebsiteUrl(trimmed);
      setWebsiteUrl(canonicalUrl);
      setWebsiteImportAttempted(false);
      setImportSource('manual');
    }

    setVertical(v);
    setBeautySubtype(v === 'beauty_clinic' ? subtype : '');
    setVerticalConfidence('high');

    const ok = await saveSettings(patch);
    if (ok) {
      setCurrentStep(2);
      setStep1View('quick');
      setManualEntryOpen(false);
      setManualPrimaryPick('');
      setProfileTypeEditOpen(false);
      setProfilePickPrimary('');
      setProfilePickSubtype('');
    }
  }

  async function continueManualVerticalSelection() {
    if (!manualPrimaryPick) {
      setStatus('Choose a business type.');
      return;
    }
    if (manualPrimaryPick === 'beauty_umbrella') {
      if (!beautySubtype) {
        setStatus('Choose the option that best describes your business.');
        return;
      }
      step1ManualPrimaryRef.current = 'beauty_umbrella';
      await finalizeManualStep1AndGoProfile('beauty_clinic', beautySubtype);
      setStatus(null);
      return;
    }
    step1ManualPrimaryRef.current = manualPrimaryPick;
    await finalizeManualStep1AndGoProfile(manualPrimaryPick, '');
  }

  async function continueManualBeautySubtypeSelection() {
    if (!beautySubtype) {
      setStatus('Choose the option that best describes your business.');
      return;
    }
    step1ManualPrimaryRef.current = 'beauty_umbrella';
    await finalizeManualStep1AndGoProfile('beauty_clinic', beautySubtype);
  }

  async function continueProfileReview() {
    const invalidFields: ProfileReviewRequiredField[] = [];
    if (!businessName.trim()) invalidFields.push('name');
    if (!vertical || verticalConfidence !== 'high') invalidFields.push('type');
    if (vertical === 'beauty_clinic' && !beautySubtype) invalidFields.push('type');
    if (!timezone.trim()) invalidFields.push('timezone');
    if (websiteUrl.trim() && !isHttpWebsiteUrl(websiteUrl)) invalidFields.push('website');

    if (invalidFields.length > 0) {
      setProfileReviewInvalidFields([...new Set(invalidFields)]);
      setProfileReviewMessage(
        invalidFields.includes('name')
          ? 'Please add your business name before continuing.'
          : invalidFields.includes('type')
            ? 'Please choose the business type before continuing.'
            : invalidFields.includes('timezone')
              ? 'Please choose your timezone before continuing.'
              : 'Please enter a valid website link before continuing.',
      );
      setStatus(null);
      return;
    }
    setProfileReviewInvalidFields([]);
    setProfileReviewMessage(null);
    trackOnboarding('onboarding_profile_reviewed');
    const addr = address.trim();
    const profilePatch: Record<string, unknown> = {
      name: businessName,
      user_name: businessName,
      vertical,
      vertical_detail: vertical === 'beauty_clinic' && beautySubtype ? beautySubtype : null,
      hours: wizardHoursToApi(hours),
      timezone,
      languages:
        shopPlan === 'starter'
          ? ['en']
          : applyVerticalLanguageSelection(vertical, languages.filter((code) => code !== 'other')),
      ...(addr ? { address: addr } : { address: null }),
      ...(websiteUrl.trim() ? { website_url: normalizeWebsiteUrl(websiteUrl) } : { website_url: '' }),
      current_onboarding_step: 3,
    };
    if (businessPhone.trim()) {
      const normalizedPhone = normalizePhoneForStorage(businessPhone, addr || undefined) ?? businessPhone;
      profilePatch.phone_number = normalizedPhone;
      profilePatch.user_phone = normalizedPhone;
    }
    const ok = await saveSettings(profilePatch);
    if (ok) setCurrentStep(3);
  }

  async function continueServices() {
    const nextServices = cleanServices(services);
    trackOnboarding('onboarding_services_reviewed');
    const patch: Record<string, unknown> = { current_onboarding_step: 4 };
    if (serviceCatalogEnabled) {
      patch.service_catalog = serviceCatalogFromRows(nextServices, selectedServiceGroups);
    } else {
      patch.services = nextServices.map((service) => ({
        ...service,
        duration_min: service.duration_min ?? 60,
      }));
    }
    if (websiteUrl.trim()) patch.website_url = normalizeWebsiteUrl(websiteUrl);
    const ok = await saveSettings(patch);
    if (ok) {
      setStep4Phase('try');
      setCurrentStep(4);
    }
  }

  async function requestTestCall() {
    setTestCallStatus('Requesting test call...');
    trackOnboarding('test_call_initiated');
    try {
      const response = await fetch('/api/backend/user/test-calls/call-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
      setTestCallStatus(
        response.ok && body?.ok ? 'Test call started. Please answer your phone.' : body?.message ?? body?.error ?? 'test_call_failed',
      );
      if (response.ok && body?.ok) setStep4Phase('done');
    } catch {
      setTestCallStatus('Network error. Please try again.');
    }
  }

  function completeSetup() {
    trackOnboarding('dashboard_opened_after_onboarding');
    try {
      localStorage.setItem(`ringbooker_welcome_started_${shopId}`, String(Date.now()));
    } catch {
      // ignore
    }
    router.replace('/user');
    router.refresh();
  }

  function markOnboardingWrapped() {
    trackOnboarding('onboarding_complete');
    setStep4Phase('done');
  }

  function handleAddGroup(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSelectedServiceGroups((prev) => {
      if (prev.some((g) => g.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [...prev, trimmed];
    });
    setCollapsedServiceGroups((prev) => prev.filter((g) => g !== trimmed));
    setPendingScrollServiceGroup(trimmed);
    setAddGroupSheetConfig(null);
    const preset = manualPresetServicesForGroupName(trimmed);
    if (!preset) return;
    setServices((current) => {
      const existing = new Set(current.map((service) => `${service.group || 'General Services'}:${service.name}`.toLowerCase()));
      const additions = preset.filter((service) => !existing.has(`${service.group || 'General Services'}:${service.name}`.toLowerCase()));
      if (additions.length === 0) return current;
      return [...current.filter((service) => service.name.trim().length > 0), ...additions];
    });
  }

  function toggleServiceGroup(group: string) {
    const manualPath = importSource === 'manual' || !websiteUrl.trim();
    const preset = MANUAL_SERVICE_PRESETS[group];
    setSelectedServiceGroups((current) => {
      const wasOn = current.includes(group);
      const next = wasOn ? current.filter((item) => item !== group) : [...current, group];
      if (!wasOn && !preset) {
        queueMicrotask(() => {
          if (group === 'Other' && !manualPath) {
            const names = [
              ...new Set(
                [
                  ...next,
                  ...services.map((service) => service.group || 'General Services'),
                  services.length === 0 ? 'General Services' : '',
                ].filter(Boolean),
              ),
            ];
            setCollapsedServiceGroups(names.filter((g) => g !== 'Other'));
          }
          setPendingScrollServiceGroup(group);
        });
      }
      return next;
    });
    if (!preset) return;
    setServices((current) => {
      const existing = new Set(current.map((service) => `${service.group || 'General Services'}:${service.name}`.toLowerCase()));
      const additions = preset.filter((service) => !existing.has(`${service.group || 'General Services'}:${service.name}`.toLowerCase()));
      if (additions.length === 0) return current;
      return [...current.filter((service) => service.name.trim().length > 0), ...additions];
    });
  }

  function toggleServiceGroupCollapsed(group: string) {
    setCollapsedServiceGroups((current) =>
      current.includes(group) ? current.filter((item) => item !== group) : [...current, group],
    );
  }

  function renameServiceGroup(from: string, to: string) {
    const next = to.trim();
    if (!next || next === from) return;
    setServices((prev) => prev.map((s) => (s.group === from ? { ...s, group: next } : s)));
    setSelectedServiceGroups((prev) => prev.map((g) => (g === from ? next : g)));
    setCollapsedServiceGroups((prev) => prev.map((g) => (g === from ? next : g)));
    setServiceEditor((se) =>
      se && se.group === from ? { ...se, group: next, draft: { ...se.draft, group: next } } : se,
    );
  }

  function commitGroupRenameDesktop() {
    if (!groupRenameDesktop) return;
    renameServiceGroup(groupRenameDesktop, groupRenameDraft);
    setGroupRenameDesktop(null);
    setGroupRenameDraft('');
  }

  function cancelGroupRenameDesktop() {
    setGroupRenameDesktop(null);
    setGroupRenameDraft('');
  }

  function commitGroupRenameMobile() {
    if (!groupRenameMobile) return;
    renameServiceGroup(groupRenameMobile, groupRenameMobileDraft);
    setGroupRenameMobile(null);
    setGroupRenameMobileDraft('');
  }

  function cancelGroupRenameMobile() {
    setGroupRenameMobile(null);
    setGroupRenameMobileDraft('');
  }

  function setServiceRow(index: number, value: ServiceItem) {
    setServices(services.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function removeServiceRow(index: number) {
    setServices((current) => current.filter((_, itemIndex) => itemIndex !== index));
    if (serviceEditor?.index === index) setServiceEditor(null);
  }

  function openServiceEditor(index: number | null, group: string, mode: 'inline' | 'sheet') {
    setGroupRenameDesktop(null);
    setGroupRenameMobile(null);
    const service = index === null ? { name: '', duration_min: null, duration_text: '', price: 0, group } : services[index];
    setServiceEditor({
      index,
      group,
      mode,
      draft: {
        ...service,
        group: service.group || group || 'General Services',
        duration_text: serviceDurationText(service),
      },
    });
    setCollapsedServiceGroups((current) => current.filter((item) => item !== group));
  }

  function addBlankService(group: string, mode: 'inline' | 'sheet') {
    setGroupRenameDesktop(null);
    setGroupRenameDraft('');
    setGroupRenameMobile(null);
    setGroupRenameMobileDraft('');
    const next: ServiceItem = { name: '', duration_min: null, duration_text: '', price: 0, group };
    const cleaned = services.filter((service) => service.name.trim().length > 0);
    setServices([...cleaned, next]);
    setServiceEditor({ index: cleaned.length, group, mode, draft: next });
    setSelectedServiceGroups((current) => current.includes(group) ? current : [...current, group]);
    setCollapsedServiceGroups((current) => current.filter((item) => item !== group));
  }

  function updateServiceDraft(patch: Partial<ServiceItem>) {
    setServiceEditor((current) => (current ? { ...current, draft: { ...current.draft, ...patch } } : current));
  }

  function updateServiceDraftVariant(index: number, patch: Partial<ServiceVariant>) {
    setServiceEditor((current) => {
      if (!current) return current;
      const variants = [...(current.draft.variants ?? [])];
      variants[index] = { ...variants[index], ...patch } as ServiceVariant;
      return { ...current, draft: { ...current.draft, variants } };
    });
  }

  function removeServiceDraftVariant(index: number) {
    setServiceEditor((current) => current ? { ...current, draft: { ...current.draft, variants: (current.draft.variants ?? []).filter((_, itemIndex) => itemIndex !== index) } } : current);
  }

  function addServiceDraftVariant() {
    setServiceEditor((current) => current ? {
      ...current,
      draft: {
        ...current.draft,
        variants: [
          ...(current.draft.variants ?? []),
          { label: '', durationMinutes: null, durationText: '', priceAmount: null, priceCurrency: 'USD', priceType: 'from', sortOrder: current.draft.variants?.length ?? 0, notes: null },
        ],
      },
    } : current);
  }

  function saveServiceEditor() {
    if (!serviceEditor) return;
    const draft: ServiceItem = {
      ...serviceEditor.draft,
      name: serviceEditor.draft.name.trim(),
      group: serviceEditor.draft.group?.trim() || serviceEditor.group || 'General Services',
      price: Number.isFinite(Number(serviceEditor.draft.price)) ? Number(serviceEditor.draft.price) : 0,
      duration_min: parseDurationTextToMinutes(serviceEditor.draft.duration_text) ?? serviceEditor.draft.duration_min ?? null,
      duration_text: serviceEditor.draft.duration_text?.trim() || null,
      needsReview: false,
    };
    if (!draft.name) return;
    if (serviceEditor.index === null) {
      setServices((current) => [...current.filter((service) => service.name.trim().length > 0), draft]);
      setSelectedServiceGroups((current) => current.includes(draft.group || 'General Services') ? current : [...current, draft.group || 'General Services']);
    } else {
      setServiceRow(serviceEditor.index, draft);
    }
    setServiceEditor(null);
  }

  function handleServiceEditorKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveServiceEditor();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setServiceEditor(null);
    }
  }

  async function handleBack() {
    if (currentStep === 1) {
      if (manualEntryOpen) {
        setManualEntryOpen(false);
        setStatus(null);
        return;
      }
      if (step1View === 'manual_beauty_subtype') {
        setStep1View('manual_vertical');
        setBeautySubtype('');
        setStatus(null);
        return;
      }
      if (step1View === 'manual_vertical') {
        setStep1View('quick');
        setManualPrimaryPick('');
        setStatus(null);
        return;
      }
      return;
    }
    const next = (currentStep - 1) as WizardStep;
    setCurrentStep(next);
    void saveSettings({ current_onboarding_step: next });
  }

  const mergedStyles = useMemo(
    () => [
      ...userSettingsStyles,
      String.raw`
.onb-shell{
  max-width:1120px;margin:0 auto;padding:0;padding-bottom:110px;
  box-sizing:border-box;width:100%;min-width:0;
}
/* Prevent horizontal scroll on narrow viewports (wide grids, sticky CTA, etc.) */
.main.onboarding-main{min-width:0;overflow-x:hidden}
.onboarding-flow input,.onboarding-flow select,.onboarding-flow textarea{font-size:16px!important;-webkit-text-size-adjust:100%}
.onboarding-flow input:focus,.onboarding-flow select:focus,.onboarding-flow textarea:focus{transform:none!important}
.onb-card{background:transparent;border:none;box-shadow:none;border-radius:0;padding:32px 0;max-width:816px;margin:0 auto;width:100%}
.onb-card.wide{max-width:864px}
.onb-progress{display:flex;align-items:center;gap:14px;margin-bottom:32px;min-width:0;width:100%}
.onb-back-inline{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:999px;background:#000;color:#fff;padding:8px 16px;font-size:14px;font-weight:500;cursor:pointer;white-space:nowrap;flex-shrink:0}.onb-back-inline:hover{background:#1a1a1a}.onb-back-inline.hidden{visibility:hidden}
.onb-progress-divider{display:none}
.onb-progress-main{display:flex;justify-content:center;flex:1;min-width:0}
.onb-progress-track{display:grid;grid-template-columns:44px minmax(48px,1fr) 44px minmax(48px,1fr) 44px minmax(48px,1fr) 44px;align-items:center;gap:10px;width:100%;max-width:760px;min-width:0}
.onb-progress-node{width:34px;height:34px;border-radius:999px;border:2px solid #d9deea;background:#fff;color:#475569;display:inline-flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;box-shadow:none}
.onb-progress-node.done{border-color:#3f7d2f;background:#eef7e8;color:#235f1f}
.onb-progress-node.current{border-color:#7c3aed;background:#faf5ff;color:#5b21b6}
.onb-progress-line{height:2px;background:#d9deea;border-radius:999px}.onb-progress-line.done{background:#3f7d2f}.onb-progress-line.current{background:#7c3aed}
.onb-title{margin:0;color:#020617;font-size:1.5rem;line-height:1.3;letter-spacing:-.02em;font-weight:500}
.onb-subtitle{margin:8px 0 10px;color:var(--text-gray);font-size:14px;line-height:1.6;max-width:760px;font-weight:400}
.onb-section-title{display:block;margin:0 0 8px;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.onb-source-badge{display:inline-flex;align-items:center;border-radius:999px;background:#eef2ff;color:#4338ca;padding:3px 10px;font-size:11px;font-weight:500;margin-left:8px}
.onb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.onb-stack{display:grid;gap:18px}
.choice-card{min-height:100px;border:1.5px solid #e2e8f0;border-radius:12px;padding:20px;background:#fff;text-align:left;cursor:pointer;transition:.18s ease;box-shadow:none}
.choice-card:hover{background:#faf5ff;border-color:#e2e8f0;box-shadow:none}
.choice-card.active{background:#faf5ff;border-color:#7c3aed;border-width:1.5px;box-shadow:none}
.choice-card .emoji{font-size:2rem;line-height:1}.choice-card h4{margin:12px 0 0;font-size:15px;font-weight:500;color:#111827}
.onb-field{display:grid;gap:6px;margin-bottom:20px}.onb-field label{font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}
.onb-field input,.onb-field select,.onb-field textarea,.hours-row select{min-height:40px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:16px;line-height:1.5;background:#fff;color:#111827;width:100%;font-family:inherit;box-sizing:border-box}.onb-field textarea{min-height:72px;resize:vertical}
.onb-field input:focus,.onb-field select:focus,.onb-field textarea:focus,.hours-row select:focus{border-color:#7c3aed;outline:none;box-shadow:0 0 0 2px rgba(124,58,237,.15)}
.onb-help{font-size:13px;color:#64748b;margin:0}.onb-help-link{border:0;background:transparent;padding:8px 0;cursor:pointer;text-decoration:none;font-family:inherit;font-weight:400;line-height:1.5;text-align:inherit;transition:color .15s ease}.onb-help-link:hover{color:#334155;text-decoration:underline;text-underline-offset:2px}
.onb-import-panel{background-color:#7c3aed!important;border:1px solid rgba(255,255,255,.22);border-radius:14px;padding:16px}
.onb-import-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:end}
.onb-import-panel .onb-field{margin-bottom:0}.onb-import-panel .onb-help{margin-top:8px;color:rgba(255,255,255,.9)}.onb-import-panel .onb-field label{color:rgba(255,255,255,.88)}
.onb-import-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;border:1px solid #000;border-radius:8px;background:#000;color:#fff;padding:8px 18px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;box-shadow:0 8px 18px rgba(0,0,0,.18)}
.onb-import-button:hover:not(:disabled){border-color:#1f1f1f;color:#fff;background:#1f1f1f;box-shadow:0 12px 24px rgba(0,0,0,.24)}.onb-import-button:disabled{opacity:.6;cursor:not-allowed}
.onb-import-progress{border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:16px;display:grid;gap:12px}
.onb-import-progress-title{margin:0;color:#111827;font-size:15px;font-weight:500}.onb-import-progress-sub{margin:0;color:#64748b;font-size:13px;line-height:1.5}
.onb-import-steps{display:grid;gap:8px;margin:2px 0}.onb-import-step{display:flex;align-items:center;gap:10px;color:#64748b;font-size:13px;font-weight:500}.onb-import-step.done{color:#166534}.onb-import-step.active{color:#111827}
.onb-import-step-mark{width:22px;height:22px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;color:#64748b}.onb-import-step.done .onb-import-step-mark{border-color:#86efac;background:#ecfdf5;color:#166534}.onb-import-step.active .onb-import-step-mark{border-color:#111827;color:#111827}
.onb-spinner{width:12px;height:12px;border:2px solid #d1d5db;border-top-color:#111827;border-radius:999px;animation:onbSpin .8s linear infinite}
.onb-import-delay{border-radius:10px;background:#fff7ed;color:#9a3412;padding:10px 12px;font-size:13px;line-height:1.45}.onb-import-progress-actions{display:flex;justify-content:flex-start}.onb-import-progress-actions .onb-help-link{color:#111827;text-decoration:underline;text-underline-offset:3px}
@keyframes onbSpin{to{transform:rotate(360deg)}}
.onb-import-manual-link-desktop{display:none;margin-top:14px;text-align:center;border:0;background:transparent;color:#111827;font-size:14px;font-weight:500;cursor:pointer;text-decoration:underline;text-underline-offset:3px;font:inherit;padding:0;width:100%;box-sizing:border-box}
.onb-import-manual-link-desktop:hover{color:#5b21b6}
@media(min-width:641px){.onb-import-manual-link-desktop{display:block}}
.onb-manual-panel{border-top:0;padding-top:0}
.onb-step1-manual{max-width:none;margin:0;width:100%;padding:0;box-sizing:border-box;display:flex;flex-direction:column;gap:20px}
.onb-step1-manual .onb-step1-section{display:flex;flex-direction:column;gap:0}
.onb-step1-manual .onb-section-label{font-size:12px;font-weight:600;color:#111;margin:0 0 8px;text-transform:none;letter-spacing:0}
.onb-step1-optional-badge{font-size:11px;font-weight:400;color:#9ca3af;margin-left:4px}
.onb-step1-input{width:100%;padding:13px 14px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;font-size:16px;line-height:1.4;color:#111827;font-family:inherit;box-sizing:border-box}
.onb-step1-input:focus{outline:none;border-color:#7c3aed;box-shadow:none}
@media(min-width:641px){.onb-step1-manual .onb-step1-input{font-size:14px}}
.onb-step1-field-hint{font-size:12px;color:#9ca3af;margin:5px 0 0;line-height:1.45}
.type-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
@media(min-width:641px){.type-grid-desktop{grid-template-columns:repeat(3,1fr);gap:10px}}
.type-opt{display:flex;align-items:center;gap:8px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer;background:#fff;transition:border-color .15s,background .15s;text-align:left;font:inherit;margin:0;min-height:48px;box-sizing:border-box}
.type-opt:hover{border-color:#d1d5db}
.type-opt.selected{border-color:#7c3aed;background:#f5f3ff}
.type-icon{font-size:18px;width:22px;text-align:center;flex-shrink:0;line-height:1}
.type-name{font-size:13px;font-weight:500;color:#111}
.type-opt.selected .type-name{color:#7c3aed}
.onb-step1-also-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:2px}
.onb-step1-also-chips .preset-chip.mixed-chip{display:inline-flex;align-items:center;gap:7px;padding:8px 13px;border-radius:20px;font-size:13px;font-weight:500;border:1px solid #e5e7eb;background:#fff;color:#374151;box-shadow:none}
.onb-step1-also-chips .preset-chip.mixed-chip.active{border-color:#7c3aed;background:#f5f3ff;color:#7c3aed}
.onb-step1-also-chips .preset-chip.mixed-chip .chip-icon{font-size:14px;line-height:1}
.onb-step1-also-chips .preset-chip:not(.mixed-chip){display:inline-flex;align-items:center;padding:8px 13px;border-radius:20px;font-size:13px;font-weight:500;border:1px solid #e5e7eb;background:#fff;color:#374151}
.onb-step1-also-chips .preset-chip:not(.mixed-chip).active{border-color:#7c3aed;background:#f5f3ff;color:#7c3aed}
.onb-step1-manual-actions{justify-content:space-between;align-items:center;max-width:none;margin-left:0;margin-right:0;margin-top:28px;gap:16px;width:100%}
.onb-step1-hide-link{border:0;background:transparent;padding:8px 0;color:#9ca3af;cursor:pointer;font:inherit;font-size:15px;text-decoration:none}
.onb-step1-hide-link:hover{text-decoration:underline;text-underline-offset:3px}
@media(max-width:640px){.onb-sticky-cta .onb-sticky-quiet{border:0!important;background:transparent!important;color:#9ca3af!important;box-shadow:none!important;min-height:auto!important;padding:10px 0!important;font-weight:400!important}}
.onb-compact-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.onb-step2-type-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.choice-card.compact{min-height:78px;padding:12px;text-align:center;display:grid;align-content:center;justify-items:center}
.choice-card.compact .emoji{font-size:1.1rem;color:#475569}.choice-card.compact h4{margin:7px 0 0;font-size:14px;font-weight:500;color:#374151}
.choice-card.compact.active .emoji,.choice-card.compact.active h4{color:#6d28d9}
.preset-chip.active{border-color:#7c3aed;background:#faf5ff;color:#5b21b6}
.mixed-chip{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;font-size:13px;font-weight:500}
.mixed-chip .chip-icon{font-size:12px;line-height:1;color:#64748b}.mixed-chip.active .chip-icon{color:#5b21b6}
.onb-import-badge{display:inline-flex;align-items:center;gap:7px;border-radius:999px;background:#ecfdf5;color:#166534;padding:5px 12px;font-size:13px;font-weight:500;margin:18px 0 16px}
.onb-service-import-badge{display:inline-flex;align-items:center;gap:7px;border-radius:999px;background:#ecfdf5;color:#15803d;padding:7px 13px;font-size:14px;font-weight:500;margin:18px 0 16px}
.profile-review-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.profile-review-card{border:1px solid #d9deea;border-radius:12px;background:#fff;padding:14px 16px;min-height:78px}
.profile-review-card.invalid{border-color:#f97316;box-shadow:0 0 0 1px rgba(249,115,22,.18)}
.profile-review-card.wide{grid-column:1 / -1}
.profile-review-alert{margin:8px 0 12px;color:#c2410c;font-size:14px;font-weight:500;line-height:1.45}
.profile-review-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:4px}.profile-review-label{color:#64748b;font-size:14px;font-weight:600}.profile-review-edit{border:0;background:transparent;color:#475569;padding:0;width:40px;height:40px;margin:-6px -6px -6px 0;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;box-sizing:border-box}.profile-review-edit:hover{background:#f1f5f9;color:#111827}.profile-review-edit:focus-visible{outline:2px solid #2563eb;outline-offset:2px}.profile-review-edit svg{display:block;flex-shrink:0}.profile-review-edit.profile-review-edit--text{width:auto;height:auto;min-height:44px;padding:8px 4px;margin:-6px -4px -6px 0;color:#2563eb;font:inherit;font-size:14px;font-weight:600}.profile-review-edit.profile-review-edit--text:hover{background:transparent;text-decoration:underline;text-underline-offset:2px;color:#1d4ed8}
.profile-review-value{color:#111827;font-size:16px;font-weight:500;line-height:1.35;overflow-wrap:anywhere}.profile-review-editor{margin-top:10px}
.onb-profile-source-footnote{font-size:11px;color:#9ca3af;margin:6px 0 0;line-height:1.35}
.onb-step2-hours-preview{margin-top:2px}
.onb-step2-hours-preview .hours-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:13px;border:0}
.onb-step2-hours-preview .hours-grid-col{display:flex;flex-direction:column;gap:4px}
.onb-step2-hours-preview .hours-row{display:flex;gap:8px;align-items:center}
.onb-step2-hours-preview .hours-day{font-size:12px;color:#9ca3af;width:28px;flex-shrink:0;font-weight:400}
.onb-step2-hours-preview .hours-time{font-size:13px;color:#111}
.onb-step2-hours-preview .hours-closed{font-size:13px;color:#9ca3af}
.onb-step2-languages-card{margin-top:0}
.onb-step2-lang-chips.preset-row{margin-bottom:0}
.onb-step2-field-card-editing{border-color:#7c3aed!important}
.onb-step2-inline-input{width:100%;font-size:16px!important;padding:8px 12px;border:1.5px solid #7c3aed;border-radius:8px;color:#111;background:#fff;outline:none;margin-top:4px;font-family:inherit;box-sizing:border-box}
.onb-step2-inline-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
.onb-step2-inline-cancel{padding:6px 14px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;color:#6b7280;background:#fff;cursor:pointer;font-family:inherit}
.onb-step2-inline-save{padding:6px 16px;border:none;border-radius:8px;font-size:13px;font-weight:500;color:#fff;background:#111;cursor:pointer;font-family:inherit}
.onb-step2-value-click{cursor:pointer}
.onb-step2-sheet-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:200;display:flex;align-items:flex-end;justify-content:center}
.onb-step2-sheet{background:#fff;border-radius:20px 20px 0 0;padding:20px 20px calc(40px + env(safe-area-inset-bottom));width:100%;max-width:100%;max-height:80vh;overflow-y:auto;box-sizing:border-box}
.onb-step2-sheet-handle{width:36px;height:4px;background:#e5e7eb;border-radius:2px;margin:0 auto 20px}
.onb-step2-sheet-title{font-size:15px;font-weight:600;color:#111;margin-bottom:16px}
.onb-step2-sheet input,.onb-step2-sheet select,.onb-step2-sheet textarea{font-size:16px!important;width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:10px;font-family:inherit;color:#111;box-sizing:border-box;background:#fff;-webkit-text-size-adjust:100%}
.onb-step2-sheet input:focus,.onb-step2-sheet select:focus,.onb-step2-sheet textarea:focus{outline:none;border-color:#7c3aed}
.onb-step2-sheet-actions{display:flex;gap:10px;margin-top:20px}
.onb-step2-sheet-cancel{flex:1;padding:13px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;color:#6b7280;background:#fff;cursor:pointer;font-family:inherit}
.onb-step2-sheet-save{flex:2;padding:13px;border:none;border-radius:10px;font-size:14px;font-weight:500;color:#fff;background:#111;cursor:pointer;font-family:inherit}
.onb-step2-tz-list{max-height:240px;overflow-y:auto;margin-top:8px;border:1px solid #e5e7eb;border-radius:10px}
.onb-step2-tz-item{padding:12px 14px;font-size:14px;color:#111;border-bottom:1px solid #f9fafb;cursor:pointer}
.onb-step2-tz-item:last-child{border-bottom:none}
.onb-step2-tz-item.selected{color:#7c3aed;background:#f5f3ff}
.onb-step2-hours-editor{display:flex;flex-direction:column;gap:10px}
.onb-step2-hours-editor-row{display:grid;grid-template-columns:40px minmax(0,auto) minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:center}
.onb-step2-hours-day{font-size:13px;font-weight:500;color:#6b7280}
.onb-step2-hours-time{font-size:16px!important;padding:8px 6px;border:1px solid #e5e7eb;border-radius:8px;text-align:center;width:100%;box-sizing:border-box;font-family:inherit;background:#fff}
.onb-step2-hours-time:disabled{background:#f9fafb;color:#d1d5db}
.onb-step2-hours-toggle{width:36px;height:20px;border-radius:999px;border:1px solid #cbd5e1;background:#e5e7eb;cursor:pointer;position:relative;flex-shrink:0;padding:0}
.onb-step2-hours-toggle.on{background:#7c3aed;border-color:#7c3aed}
.onb-step2-hours-toggle::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .15s ease}
.onb-step2-hours-toggle.on::after{transform:translateX(16px)}
@media(min-width:769px){.onb-step2-mobile-only{display:none!important}}
@media(max-width:768px){.onb-step2-desktop-inline{display:none!important}}
.preset-chip.mixed-chip.locked{opacity:.55;cursor:not-allowed}
.onb-note{display:flex;gap:8px;align-items:flex-start;border-radius:12px;background:#fff7ed;color:#9a3412;padding:12px 14px;font-size:13px;line-height:1.5}
.onb-services-review-shell,.onb-service-mode-b,.onb-service-groups{max-width:780px;margin-left:auto;margin-right:auto}
.onb-desktop-copy{display:inline}.onb-mobile-copy{display:none}
.service-group-card{border:1px solid #e5e7eb;border-radius:12px;background:#fff;margin-top:14px;overflow:hidden;max-width:780px;margin-left:auto;margin-right:auto}
.service-group-head{width:100%;min-height:56px;display:flex;align-items:center;gap:10px;padding:12px 16px;background:#f9fafb;border:0;border-bottom:1px solid #f3f4f6;text-align:left;font:inherit;color:#111827;box-sizing:border-box}
.service-group-title-row{display:flex;align-items:center;gap:4px;min-width:0;flex-wrap:wrap}
.service-group-title--btn{border:0;background:transparent;padding:0;margin:0;font:inherit;font-size:15px;font-weight:500;color:#111827;cursor:pointer;text-align:left}
.service-group-title--btn:hover{color:#5b21b6}
.onb-group-title-input{font-size:14px;font-weight:500;border:1.5px solid #7c3aed;border-radius:6px;padding:4px 8px;min-width:120px;max-width:240px;width:auto;box-sizing:border-box;font-family:inherit;color:#111827}
.onb-group-title-actions{display:inline-flex;align-items:center;gap:6px;margin-left:6px}
.onb-group-title-save,.onb-group-title-cancel{border:0;background:#f3f4f6;cursor:pointer;font-size:14px;width:28px;height:28px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;line-height:1}
.onb-group-title-save{background:#111;color:#fff}
.onb-group-title-desktop{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
.onb-group-title-mobile{display:none;align-items:center;gap:4px;min-width:0;flex-wrap:wrap}
@media(max-width:640px){.onb-group-title-desktop{display:none!important}.onb-group-title-mobile{display:flex!important}.service-group-main .service-group-meta{grid-column:1/-1}}
@media(min-width:641px){.onb-group-title-mobile{display:none!important}}
.onb-group-rename-pencil{border:0;background:transparent;padding:0 2px;margin-left:5px;color:#9ca3af;cursor:pointer;line-height:1;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle}
.onb-group-rename-pencil svg{display:block;flex-shrink:0}
.onb-group-add-header-desktop{margin-left:auto;display:none;align-items:center;justify-content:center;padding:6px 12px;font-size:14px;font-weight:500;color:#7c3aed;background:transparent;border:1px dashed #e5e7eb;border-radius:8px;cursor:pointer;font-family:inherit;white-space:nowrap}
@media(min-width:641px){.onb-group-add-header-desktop{display:inline-flex}}
.service-group-collapse-btn{border:0;background:transparent;padding:4px 6px;cursor:pointer;color:#6b7280;display:inline-flex;align-items:center;flex-shrink:0;margin-left:4px}
.onb-step3-section-label{display:block;margin:16px 0 6px;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.onb-step3-section-hint{margin:0 0 14px;color:#64748b;font-size:13px;line-height:1.55}
.onb-step3-thin-warn{margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#fffbeb;color:#9a3412;font-size:13px;line-height:1.45;border:1px solid #fed7aa}
.onb-step3-import-divider{display:flex;align-items:center;justify-content:center;margin:22px 0 18px;color:#9ca3af;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;gap:14px}
.onb-step3-import-divider::before,.onb-step3-import-divider::after{content:"";flex:1;height:1px;background:#e5e7eb}
.onb-step3-optional-pill{font-weight:500;color:#64748b;font-size:1rem}
.onb-group-rename-sheet-input{width:100%;font-size:16px!important;padding:12px 14px;border:1px solid #e5e7eb;border-radius:10px;box-sizing:border-box;font-family:inherit;margin-top:10px}
.onb-group-rename-sheet-input:focus{outline:none;border-color:#7c3aed}
.onb-group-rename-sheet-actions{display:flex;gap:10px;margin-top:20px}
.onb-group-rename-sheet-actions button{flex:1;height:48px;border-radius:10px;font-size:14px;font-weight:500;font-family:inherit;cursor:pointer;box-sizing:border-box}
.onb-group-rename-sheet-cancel{border:1px solid #e5e7eb;background:#fff;color:#6b7280}
.onb-group-rename-sheet-save{border:none;background:#111;color:#fff;flex:2}
.service-group-icon{width:32px;height:32px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.service-group-main{display:grid;gap:2px;min-width:0;flex:1}.service-group-title{margin:0;color:#111827;font-size:15px;font-weight:500;line-height:1.25}.service-group-meta{color:#9ca3af;font-size:12px;font-weight:400;line-height:1.25}
.service-group-warning{border-radius:999px;background:#fffbeb;color:#f59e0b;padding:3px 8px;font-size:11px;font-weight:500;white-space:nowrap}.service-group-chevron{color:#6b7280;font-size:18px;line-height:1;transition:transform .18s ease}.service-group-chevron.open{transform:rotate(180deg)}
.service-group-body{display:grid;gap:0;padding:12px 16px 16px}
.onb-service-row-wrap{position:relative;border-bottom:1px solid #f3f4f6}.onb-service-row-wrap:last-of-type{border-bottom:0}
.onb-service-row{width:100%;border:0;background:transparent;padding:11px 0;display:flex;align-items:center;gap:14px;text-align:left;font:inherit;cursor:pointer;color:#111}
.onb-service-name{flex:1;color:#111;font-size:13px;font-weight:400;line-height:1.35;text-transform:capitalize;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.onb-service-variants-preview{display:block;margin-top:3px;color:#6b7280;font-size:12px;text-transform:none;white-space:normal}.svc-variants{margin:0 0 3px;color:#9ca3af;font-size:12px;line-height:1.35}.onb-service-price{color:#374151;font-size:13px;font-weight:500;white-space:nowrap}.onb-service-price.warn{color:#dc2626}.onb-service-duration{color:#9ca3af;font-size:12px;font-weight:400;white-space:nowrap}.onb-service-duration.warn{color:#f59e0b}.onb-service-edit-link{color:#9ca3af;font-size:12px;font-weight:500;opacity:0;transition:opacity .15s ease}.onb-service-row-wrap:hover .onb-service-edit-link{opacity:1}
.onb-service-row-mobile{display:none}.onb-service-mobile-meta{color:#6b7280;font-size:12px;text-align:right;white-space:nowrap}.onb-service-mobile-arrow{color:#9ca3af;font-size:22px;line-height:1}
.svc-row{display:none}.svc-body{flex:1;min-width:0}.svc-name{font-size:13px;font-weight:400;color:#111;text-transform:capitalize;line-height:1.35;margin-bottom:3px;overflow-wrap:anywhere}.svc-meta{display:flex;align-items:center;gap:6px;font-size:12px;color:#9ca3af;flex-wrap:nowrap;min-width:0}.svc-price{color:#374151;font-weight:500;white-space:nowrap}.svc-price.zero{color:#dc2626}.svc-duration{white-space:nowrap}.svc-duration.missing{color:#f59e0b}.svc-remove{margin-left:auto;font-size:12px;color:#9ca3af;background:none;border:none;padding:0;cursor:pointer;flex-shrink:0}.svc-remove:active{color:#dc2626}.svc-arrow{color:#d1d5db;font-size:16px;flex-shrink:0;align-self:flex-start;margin-top:1px}
.onb-service-edit-row{display:grid;grid-template-columns:minmax(0,1fr) 90px 90px 28px 28px;gap:8px;align-items:center;padding:8px 0}.onb-service-edit-row input,.onb-service-sheet-fields input{min-height:34px;border:1px solid #7c3aed;border-radius:8px;padding:6px 10px;font-size:16px;font-family:inherit;color:#111827;box-sizing:border-box;background:#fff;width:100%}.onb-service-price-input{position:relative}.onb-service-price-input span{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#6b7280;font-size:12px}.onb-service-price-input input{padding-left:24px!important}.onb-service-variants-editor{grid-column:1 / -1;display:grid;gap:8px;border:1px solid #ede9fe;border-radius:10px;background:#faf5ff;padding:10px}.onb-service-variants-label{font-size:12px;font-weight:700;color:#6d28d9}.onb-service-variant-edit{display:grid;grid-template-columns:minmax(0,1fr) 100px 90px 28px;gap:8px}.onb-service-variant-edit button{border:0;border-radius:999px;background:#f3f4f6;color:#6b7280;cursor:pointer}.onb-service-add-option{grid-column:1 / -1;border:1px dashed #ddd6fe;border-radius:8px;background:#fff;color:#7c3aed;padding:8px 10px;font-size:13px;font-weight:600;cursor:pointer}
.onb-service-save-dot,.onb-service-cancel-dot{width:28px;height:28px;border-radius:999px;border:0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;font-weight:600}.onb-service-save-dot{background:#111;color:#fff}.onb-service-cancel-dot{background:#f3f4f6;color:#6b7280}
.onb-group-add-service{margin-top:12px;width:100%;min-height:40px;border:1px dashed #e5e7eb;border-radius:8px;background:transparent;color:#7c3aed;font-size:14px;font-weight:500;cursor:pointer;text-align:center}.onb-group-add-service:hover{border-color:#c4b5fd;background:#faf5ff}.onb-group-add-service-mobile{display:none}
.service-remove-btn{min-height:32px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#64748b;padding:6px 10px;font-size:12px;font-weight:500;cursor:pointer}.service-remove-btn:hover{border-color:#fecaca;background:#fff1f2;color:#be123c}.onb-service-remove-compact{position:absolute;right:0;bottom:4px;opacity:0;pointer-events:none}.onb-service-row-wrap:hover .onb-service-remove-compact{opacity:1;pointer-events:auto}
.service-group-select-label{display:inline-flex;align-items:center;gap:8px;color:#64748b;font-size:12px;font-weight:500}.service-group-select-label select{width:auto;min-width:150px;min-height:34px;padding:6px 10px;font-size:16px}
.service-empty{font-size:13px;color:#9ca3af;padding:14px 16px;margin-bottom:10px;border:none;background:transparent}
.onb-sheet-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:200;display:flex;align-items:flex-end;font-family:inherit}
.onb-sheet{background:#fff;border-radius:20px 20px 0 0;padding:20px 20px 40px;width:100%;box-sizing:border-box;font-family:'Inter',sans-serif}
.onb-sheet-handle{width:36px;height:4px;background:#e5e7eb;border-radius:2px;margin:0 auto 20px}
.onb-sheet-title{font-size:15px;font-weight:600;color:#111;margin-bottom:16px;font-family:'Inter',sans-serif}
.onb-sheet-field{margin-bottom:0}
.onb-sheet-label{font-size:11px;font-weight:500;color:#6b7280;margin-bottom:5px;font-family:'Inter',sans-serif}
.onb-sheet-input{width:100%;font-size:16px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:10px;font-family:'Inter',sans-serif;color:#111;outline:none;box-sizing:border-box}
.onb-sheet-input:focus{border-color:#7c3aed}
.onb-sheet-actions{display:flex;gap:10px;margin-top:16px}
.onb-sheet-cancel{flex:1;padding:13px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;color:#6b7280;background:#fff;cursor:pointer;font-family:'Inter',sans-serif}
.onb-sheet-save{flex:2;padding:13px;border:none;border-radius:10px;font-size:14px;font-weight:500;color:#fff;background:#111;cursor:pointer;font-family:'Inter',sans-serif}
.onb-sheet-save:disabled{background:#d1d5db;cursor:not-allowed}
@media(min-width:768px){.onb-sheet-overlay{align-items:center;justify-content:center}.onb-sheet{border-radius:14px;max-width:420px;padding:24px}.onb-sheet-handle{display:none}}
.onb-add-service-group-btn{width:100%;padding:14px;margin-top:8px;border:1.5px dashed #e5e7eb;border-radius:12px;background:transparent;font-size:14px;font-weight:500;color:#7c3aed;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:'Inter',sans-serif;box-sizing:border-box}
.onb-add-service-group-btn:active{background:#f5f3ff;border-color:#7c3aed}
@media(min-width:768px){.onb-add-service-group-btn{padding:10px;margin-top:8px;border-radius:10px;font-size:13px;transition:all .15s}.onb-add-service-group-btn:hover{background:#f5f3ff;border-color:#7c3aed}}
.onb-actions{display:flex;justify-content:space-between;gap:12px;margin-top:24px;align-items:center}
.onb-btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;border:0;border-radius:8px;background:#000;color:#fff;padding:10px 18px;font-size:15px;font-weight:600;box-shadow:0 8px 18px rgba(0,0,0,.18);cursor:pointer;text-decoration:none;transition:background .15s ease,transform .15s ease,box-shadow .15s ease}.onb-btn-primary:hover:not(:disabled){background:#1f1f1f;transform:translateY(-1px);box-shadow:0 12px 24px rgba(0,0,0,.24)}
.onb-btn-primary:disabled{opacity:.6;cursor:not-allowed}.onb-btn-secondary{display:inline-flex;align-items:center;justify-content:center;min-height:44px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;padding:10px 18px;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none}
.hours-list{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff}.hours-row{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff;border-bottom:1px solid #f1f5f9}.hours-row:last-child{border-bottom:0}.hours-row.closed select{opacity:.4;background:#f8fafc!important}
.hours-day{font-weight:500;color:#111827;min-width:40px}.toggle-pill{position:relative;display:inline-flex;align-items:center;gap:8px;border:1px solid #dbe2ee;border-radius:999px;padding:8px 12px;background:#fff;font-weight:500;color:#64748b;cursor:pointer;box-shadow:none}.toggle-pill input{position:absolute;opacity:0;pointer-events:none}.toggle-dot{width:28px;height:16px;border-radius:999px;background:#cbd5e1;position:relative;transition:.18s ease;box-shadow:none}.toggle-dot:after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:none;transition:.18s ease}.toggle-pill.active{border-color:#8b5cf6;color:#5b21b6;background:transparent}.toggle-pill.active .toggle-dot{background:#7c3aed}.toggle-pill.active .toggle-dot:after{transform:translateX(12px)}
.lang-list{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}.lang-option{display:grid;gap:6px;justify-items:center;align-content:start}.lang-pill{min-width:72px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid #e2e8f0;border-radius:999px;padding:9px 14px;background:#fff;color:#374151;font-size:16px;font-weight:500;cursor:pointer;box-shadow:none}.lang-pill input{position:absolute;opacity:0;pointer-events:none}.lang-pill.selected{background:#faf5ff;border-color:#7c3aed;color:#111827;box-shadow:none}.lang-pill.required{background:#faf5ff;border-color:#7c3aed;color:#5b21b6;cursor:not-allowed}.lang-pill.locked{background:#f1f5f9!important;color:#64748b;cursor:not-allowed}.required-badge{display:block;color:#16a34a;background:transparent;padding:0;font-size:12px;font-weight:500;line-height:1.2}.plan-badge{display:block;color:#64748b;background:transparent!important;padding:0;font-size:12px;font-weight:500;line-height:1.2}.lang-badge-spacer{display:block;height:14px}.mini-badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;background:#dcfce7;color:#16a34a;padding:2px 8px;font-size:11px;font-weight:600}
.preset-row{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 14px}.onb-chips-tier2{margin-bottom:14px}.onb-chips-show-more-btn{font-size:12px;color:#7c3aed;background:none;border:none;cursor:pointer;padding:4px 0;font-family:'Inter',sans-serif;margin-top:4px;text-align:left}.preset-chip{border:1px solid #e2e8f0;border-radius:999px;background:#fff;padding:8px 14px;font-size:13px;font-weight:500;cursor:pointer;box-shadow:none;transition:border-color .15s ease,background .15s ease}.preset-chip:hover{border-color:#c4b5fd;background:#faf5ff}.preset-chip:focus-visible{outline:2px solid #7c3aed;outline-offset:2px}
.hours-summary{font-size:14px;color:#334155;line-height:1.5;margin:0 0 12px}
.acc{border:1px solid #e2e8f0;border-radius:12px;background:#fff;margin-bottom:10px;overflow:hidden}.acc-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border:0;background:#fff;font:inherit;font-weight:500;text-align:left;cursor:pointer}.acc-body{padding:0 16px 16px;border-top:1px solid #f1f5f9}
.test-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:20px}.test-card{border:1px solid #e2e8f0;border-radius:16px;padding:20px;background:#fff;display:flex;flex-direction:column;gap:10px;min-height:160px;box-shadow:none}.test-card h3{margin:0;font-size:17px}.test-card p{margin:0;font-size:14px;color:#64748b;line-height:1.55}
.manual-header{display:grid;grid-template-columns:minmax(120px,1fr) minmax(0,1.6fr) 72px 72px;gap:10px;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.service-row{display:grid;grid-template-columns:minmax(120px,1fr) minmax(0,1.6fr) 72px 72px;gap:10px;align-items:center;margin-bottom:10px}
.price-wrap,.duration-wrap{position:relative}.price-wrap span,.duration-wrap span{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#64748b;font-size:13px;font-weight:500;pointer-events:none}.price-wrap input{padding-left:28px!important}.duration-wrap input{padding-left:46px!important}
.onb-service-sheet-overlay{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.4);display:flex;align-items:flex-end;justify-content:center}.onb-service-sheet{width:100%;max-width:520px;background:#fff;border-radius:20px 20px 0 0;padding:14px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -18px 40px rgba(15,23,42,.18)}.onb-service-sheet-handle{width:36px;height:4px;border-radius:999px;background:#e5e7eb;margin:0 auto 16px}.onb-service-sheet h3{margin:0 0 14px;color:#111827;font-size:15px;font-weight:600;line-height:1.35}.onb-service-sheet-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.onb-service-sheet-fields>input:first-child{grid-column:1 / -1;min-height:46px;font-size:16px;padding:12px 14px}.onb-service-sheet-fields .onb-service-price-input input,.onb-service-sheet-fields>input:not(:first-child){min-height:46px;font-size:16px;padding:12px 14px}.onb-service-sheet-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.onb-service-sheet-actions .onb-btn-primary,.onb-service-sheet-actions .onb-btn-secondary{width:100%;height:48px;border-radius:10px}
.onb-status{margin-top:14px;padding:12px 14px;border-radius:16px;background:linear-gradient(180deg,#fbfaff 0%,#f7f4ff 52%,#f4f1ff 100%)!important;color:#475569;font-size:14px}
.read-success{color:#047857;font-weight:600}
.onb-sticky-cta{position:fixed;left:0;right:0;bottom:0;z-index:50;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);border-top:1px solid #e2e8f0;backdrop-filter:blur(10px);display:flex;flex-direction:column;gap:10px;align-items:stretch}
.onb-sticky-cta .onb-btn-primary,.onb-sticky-cta .onb-btn-secondary{width:100%;justify-content:center}
@media(min-width:641px){.onb-sticky-cta{display:none}}
@media(max-width:640px){.onb-shell{padding-bottom:120px;padding-left:max(16px, env(safe-area-inset-left));padding-right:max(16px, env(safe-area-inset-right));overflow-x:hidden}.onb-card{padding:16px 0;max-width:none}.onb-progress{gap:10px}.onb-progress-track{grid-template-columns:30px minmax(20px,1fr) 30px minmax(20px,1fr) 30px minmax(20px,1fr) 30px;gap:6px}.onb-progress-node{width:28px;height:28px;font-size:13px}.onb-grid,.onb-compact-grid,.profile-review-grid{grid-template-columns:1fr}.onb-import-row{grid-template-columns:1fr}.onb-import-button{width:100%}.test-grid{grid-template-columns:1fr}.manual-header{display:none}.service-row{grid-template-columns:1fr}.service-row select{grid-column:1 / -1}.onb-actions-desktop{display:none!important}.onb-import-manual-desktop-row{display:none!important}.onb-desktop-copy{display:none}.onb-mobile-copy{display:inline}.onb-services-review-shell,.onb-service-mode-b,.onb-service-groups,.service-group-card{max-width:none}.service-group-card{border-radius:12px}.service-group-head{height:56px;padding:0 14px}.service-group-title{font-size:14px}.service-group-warning{font-size:11px;padding:2px 7px}.service-group-body{padding:0}.onb-service-row-wrap{border-bottom:0}.onb-service-row-desktop,.onb-service-row-mobile{display:none}.svc-row{display:flex;align-items:center;padding:12px 16px;border-top:1px solid #f9fafb;cursor:pointer;gap:8px}.svc-row:active{background:#fafafa}.onb-service-name{font-size:13px}.onb-service-remove-compact{display:none}.onb-group-add-service-desktop{display:none}.onb-group-add-service-mobile{display:block;width:auto;border:0;border-radius:0;text-align:left;padding:12px 16px;margin:0;color:#7c3aed;background:transparent}.onb-service-edit-row{grid-template-columns:minmax(0,1fr)!important;gap:10px}.onb-service-variant-edit{grid-template-columns:minmax(0,1fr)!important;gap:8px}.onb-step2-hours-editor-row{grid-template-columns:minmax(0,1fr);gap:8px}.onb-also-offers-row .preset-chip{padding:7px 14px;font-size:13px;font-weight:400;color:#6b7280}.onb-also-offers-row .preset-chip.active{border-color:#7c3aed;background:#f5f3ff;color:#7c3aed}}
@media(max-width:640px){.hours-row{display:grid;grid-template-columns:1fr 1fr}}
`,
    ],
    [],
  );

  if (loading) {
    return (
      <UserLayout styles={mergedStyles} scripts={userSettingsScripts} scriptPrefix="user-onboarding-live">
      <main className="main onboarding-main">
        <section className="onb-shell onboarding-flow">
          <div className="onb-card">
            <p>Loading onboarding...</p>
            </div>
          </section>
        </main>
      </UserLayout>
    );
  }

  const webDemoHref = verticalToWebDemoPath(vertical);

  function renderStep1() {
    if (step1View === 'manual_vertical') {
      return (
        <div>
          <h1 className="onb-title">What type of business are you?</h1>
          <p className="onb-subtitle">This helps RingBooker suggest the right services and tone.</p>
          <div className="onb-step1-manual" style={{ marginTop: 24 }}>
            <div className="type-grid type-grid-desktop">
              {MANUAL_PRIMARY_VERTICAL.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`type-opt ${manualPrimaryPick === item.id ? 'selected' : ''}`}
                  onClick={() => setManualPrimaryPick(item.id)}
                >
                  <span className="type-icon" aria-hidden>{item.emoji}</span>
                  <span className="type-name">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
          {websiteLoading && importProgress ? <p className="onb-help">{importProgress}</p> : null}
        <div className="onb-actions onb-actions-desktop">
            <span />
            <button className="onb-btn-primary" type="button" onClick={() => void continueManualVerticalSelection()} disabled={saving || websiteLoading}>
              Continue to Profile
            </button>
          </div>
          <div className="onb-sticky-cta">
            <button className="onb-btn-primary" type="button" onClick={() => void continueManualVerticalSelection()} disabled={saving || websiteLoading}>
              Continue to Profile
            </button>
          </div>
        </div>
      );
    }

    if (step1View === 'manual_beauty_subtype') {
      return (
        <div>
          <h1 className="onb-title">What best describes your business?</h1>
          <p className="onb-subtitle">Pick the closest match — you can refine services in the next step.</p>
          <div className="onb-stack" style={{ marginTop: 24 }}>
            {BEAUTY_SUBTYPE_OPTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`choice-card ${beautySubtype === item.id ? 'active' : ''}`}
                style={{ minHeight: 72 }}
                onClick={() => setBeautySubtype(item.id)}
              >
                <h4 style={{ margin: 0 }}>{item.label}</h4>
              </button>
            ))}
          </div>
          {websiteLoading && importProgress ? <p className="onb-help">{importProgress}</p> : null}
        <div className="onb-actions onb-actions-desktop">
            <span />
            <button className="onb-btn-primary" type="button" onClick={() => void continueManualBeautySubtypeSelection()} disabled={saving || websiteLoading}>
              Continue to Profile
            </button>
          </div>
          <div className="onb-sticky-cta">
            <button className="onb-btn-primary" type="button" onClick={() => void continueManualBeautySubtypeSelection()} disabled={saving || websiteLoading}>
              Continue to Profile
            </button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <h1 className="onb-title">Let's set up your business profile</h1>
        <p className="onb-subtitle">
          {manualEntryOpen
            ? 'Fill in your business basics — takes about a minute.'
            : "Paste your website or Google Maps link — we'll fill in the details."}
        </p>
        <div className="onb-stack" style={{ marginTop: 24 }}>
          {!manualEntryOpen ? (
            <>
              <div className="onb-import-panel">
                <div className="onb-import-row">
                  <div className="onb-field">
                    <input
                      value={websiteUrl}
                      onChange={(event) => setWebsiteUrl(event.target.value)}
                      placeholder="e.g. glowspa.com or maps.google.com/..."
                      inputMode="url"
                    />
                  </div>
                  <button
                    className="onb-import-button onb-actions-desktop"
                    type="button"
                    onClick={() => void saveQuickContinue()}
                    disabled={saving || websiteLoading}
                  >
                    ✧ {websiteLoading ? 'Importing…' : 'Import'}
                  </button>
                </div>
              </div>
              {!websiteLoading ? (
                <button type="button" className="onb-import-manual-link-desktop" onClick={() => enterManualSetup()} disabled={saving}>
                  No website? Fill in manually
                </button>
              ) : null}
            </>
          ) : null}
          {websiteLoading ? renderImportProgressCard() : null}
          {manualEntryOpen ? (
            <div className="onb-manual-panel">
              <div className="onb-step1-manual">
                <div className="onb-step1-section">
                  <label className="onb-section-label" htmlFor="onb-step1-business-name">
                    Business name
                  </label>
                  <input
                    id="onb-step1-business-name"
                    className="onb-step1-input"
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    placeholder="e.g. Glamour Hair Studio"
                    autoComplete="organization"
                  />
                </div>
                <div className="onb-step1-section">
                  <span className="onb-section-label">What best describes your business?</span>
                  <div className="type-grid type-grid-desktop">
                    {MANUAL_PRIMARY_VERTICAL.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`type-opt ${manualPrimaryPick === item.id ? 'selected' : ''}`}
                        onClick={() => {
                          setManualPrimaryPick(item.id);
                          if (item.id !== 'beauty_umbrella') setBeautySubtype('');
                        }}
                      >
                        <span className="type-icon" aria-hidden>{item.emoji}</span>
                        <span className="type-name">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {manualPrimaryPick === 'beauty_umbrella' ? (
                  <div className="onb-step1-section">
                    <span className="onb-section-label">Beauty specialty</span>
                    <div className="onb-step1-also-chips">
                      {BEAUTY_SUBTYPE_OPTIONS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`preset-chip mixed-chip ${beautySubtype === item.id ? 'active' : ''}`}
                          onClick={() => setBeautySubtype(item.id)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="onb-step1-section">
                  <label className="onb-section-label" htmlFor="onb-step1-phone">
                    Phone number<span className="onb-step1-optional-badge">optional</span>
                  </label>
                  <input
                    id="onb-step1-phone"
                    className="onb-step1-input"
                    type="tel"
                    value={businessPhone}
                    onChange={(event) => {
                      setBusinessPhone(event.target.value);
                      setBusinessPhoneNeedsRealEntry(false);
                    }}
                    placeholder="(555) 123-4567"
                    autoComplete="tel"
                  />
                  <p className="onb-step1-field-hint">
                    {businessPhoneNeedsRealEntry
                      ? 'You can add the main business line now or review it later in Profile.'
                      : "The number clients call today — you're not changing it."}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        {manualEntryOpen ? (
          <div className="onb-actions onb-actions-desktop onb-step1-manual-actions">
            <button
              type="button"
              className="onb-step1-hide-link"
              onClick={() => setManualEntryOpen(false)}
              disabled={saving || websiteLoading}
            >
              Hide manual form
            </button>
            <button className="onb-btn-primary" type="button" onClick={() => void saveQuickContinue()} disabled={saving || websiteLoading}>
              Next →
            </button>
          </div>
        ) : null}
        <div className="onb-sticky-cta">
          <button className="onb-btn-primary" type="button" onClick={() => void saveQuickContinue()} disabled={saving || websiteLoading}>
            {websiteLoading ? 'Importing…' : manualEntryOpen ? 'Next →' : WEBSITE_IMPORT_EXTRACTION_ACTIVE ? 'Import' : 'Next →'}
          </button>
          <button
            className="onb-btn-secondary onb-sticky-quiet"
            type="button"
            onClick={() => {
              if (manualEntryOpen) setManualEntryOpen(false);
              else enterManualSetup();
            }}
            disabled={saving || websiteLoading}
          >
            {manualEntryOpen ? 'Hide manual form' : 'No website? Fill in manually'}
          </button>
        </div>
      </div>
    );
  }

  function renderStep2() {
    const countryTimezones = COUNTRY_TIMEZONES.find((item) => item.country === selectedCountry);
    const selectedTimezoneMeta = countryTimezones?.timezones.find((zone) => zone.value === timezone);

    const resolvedVerticalLabel =
      vertical === 'beauty_clinic' && beautySubtype
        ? BEAUTY_SUBTYPE_LABELS[beautySubtype]
        : vertical
          ? VERTICAL_LABELS[vertical]
          : '';

    const importedHost = (() => {
      try {
        return websiteUrl ? new URL(normalizeWebsiteUrl(websiteUrl)).hostname.replace(/^www\./, '') : 'website';
      } catch {
        return 'website';
      }
    })();

    const markProfileFieldEdited = (field: Exclude<ProfileEditField, null>) => {
      setUserEditedProfileFields((fields) => (fields.includes(field) ? fields : [...fields, field]));
      setProfileReviewInvalidFields((fields) => fields.filter((item) => item !== field));
      setProfileReviewMessage(null);
    };

    const applyMobileInline = (field: 'name' | 'phone' | 'website') => {
      if (field === 'name') {
        setBusinessName(mobileInlineDraft);
        markProfileFieldEdited('name');
      } else if (field === 'phone') {
        setBusinessPhone(mobileInlineDraft);
        setBusinessPhoneNeedsRealEntry(false);
        markProfileFieldEdited('phone');
      } else {
        setWebsiteUrl(mobileInlineDraft);
        markProfileFieldEdited('website');
      }
      setMobileInlineEdit(null);
    };

    const openMobileInline = (field: 'name' | 'phone' | 'website') => {
      setStep2Sheet(null);
      setMobileInlineDraft(field === 'name' ? businessName : field === 'phone' ? businessPhone : websiteUrl);
      setMobileInlineEdit(field);
    };

    const openMobileSheet = (kind: Step2SheetKind) => {
      setMobileInlineEdit(null);
      if (kind === 'type') {
        typeSheetSnapshotRef.current = {
          vertical,
          beautySubtype,
          profilePickPrimary,
          profilePickSubtype,
        };
        setStep2Sheet('type');
      } else if (kind === 'timezone') {
        setTzSheetCountry(selectedCountry);
        setTzSheetTimezone(timezone);
        setTzSheetSearch('');
        setStep2Sheet('timezone');
      } else if (kind === 'address') {
        setAddressSheetDraft(address);
        setStep2Sheet('address');
      } else {
        setHoursSheetDraft(JSON.parse(JSON.stringify(hours)) as WizardHours);
        setStep2Sheet('hours');
      }
    };

    const cancelTypeSheet = () => {
      const snap = typeSheetSnapshotRef.current;
      if (snap) {
        setVertical(snap.vertical);
        setBeautySubtype(snap.beautySubtype);
        setProfilePickPrimary(snap.profilePickPrimary);
        setProfilePickSubtype(snap.profilePickSubtype);
      }
      typeSheetSnapshotRef.current = null;
      setStep2Sheet(null);
    };

    const saveTypeSheet = () => {
      markProfileFieldEdited('type');
      typeSheetSnapshotRef.current = null;
      setStep2Sheet(null);
    };

    const cancelTimezoneSheet = () => setStep2Sheet(null);

    const saveTimezoneSheet = () => {
      setSelectedCountry(tzSheetCountry);
      setTimezone(tzSheetTimezone);
      markProfileFieldEdited('timezone');
      setStep2Sheet(null);
    };

    const cancelAddressSheet = () => setStep2Sheet(null);

    const saveAddressSheet = () => {
      setAddress(addressSheetDraft);
      markProfileFieldEdited('address');
      setStep2Sheet(null);
    };

    const cancelHoursSheet = () => setStep2Sheet(null);

    const saveHoursSheet = () => {
      setHours(hoursSheetDraft);
      markProfileFieldEdited('hours');
      setStep2Sheet(null);
    };

    const tzSearchLower = tzSheetSearch.trim().toLowerCase();
    const filteredTzOptions = allTimezoneOptions.filter(
      (z) =>
        !tzSearchLower ||
        z.label.toLowerCase().includes(tzSearchLower) ||
        z.value.toLowerCase().includes(tzSearchLower) ||
        z.country.toLowerCase().includes(tzSearchLower),
    );

    const pencilIcon = (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    );

    const profileCard = (
      field: Exclude<ProfileEditField, null>,
      label: string,
      value: string,
      editor: ReactNode,
      options: { wide?: boolean; imported?: { value?: unknown; confidence?: number; source?: string | null } | null } = {},
    ) => {
      const hasUserValue = value.trim().length > 0;
      const showImportState = websiteImportAttempted && options.imported && (!userEditedProfileFields.includes(field) || !hasUserValue);
      const isInvalid = profileReviewInvalidFields.includes(field);
      const cardClassName = `profile-review-card ${options.wide ? 'wide' : ''}${isInvalid ? ' invalid' : ''}`;

      if (isStep2Mobile && (field === 'name' || field === 'phone' || field === 'website')) {
        const editing = mobileInlineEdit === field;
        return (
          <div
            ref={editing ? mobileInlineCardRef : undefined}
            className={`${cardClassName}${editing ? ' onb-step2-field-card-editing' : ''}`}
          >
            <div className="profile-review-top">
              <span className="profile-review-label">{label}</span>
              <button
                type="button"
                className="profile-review-edit"
                aria-label={editing ? `Cancel editing ${label}` : `Edit ${label}`}
                onClick={() => (editing ? setMobileInlineEdit(null) : openMobileInline(field))}
              >
                {pencilIcon}
              </button>
            </div>
            {editing ? (
              <>
                <input
                  className="onb-step2-inline-input"
                  value={mobileInlineDraft}
                  onChange={(event) => setMobileInlineDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      applyMobileInline(field);
                    }
                    if (event.key === 'Escape') setMobileInlineEdit(null);
                  }}
                  autoFocus
                  type={field === 'phone' ? 'tel' : 'text'}
                  placeholder={
                    field === 'name'
                      ? 'Happy Nails & Spa'
                      : field === 'website'
                        ? 'yourbusiness.com or http://yourbusiness.com'
                        : undefined
                  }
                />
                <div className="onb-step2-inline-actions">
                  <button type="button" className="onb-step2-inline-cancel" onClick={() => setMobileInlineEdit(null)} aria-label="Cancel">
                    ✕
                  </button>
                  <button type="button" className="onb-step2-inline-save" onClick={() => applyMobileInline(field)}>
                    ✓ Save
                  </button>
                </div>
              </>
            ) : (
              <div
                className="profile-review-value onb-step2-value-click"
                onClick={() => openMobileInline(field)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') openMobileInline(field);
                }}
              >
                {value || 'Missing'}
              </div>
            )}
            {showImportState ? profileImportGoogleFootnote(options.imported ?? undefined) : null}
          </div>
        );
      }

      if (isStep2Mobile && (field === 'type' || field === 'timezone' || field === 'address' || field === 'hours')) {
        const sk = field as Step2SheetKind;
        return (
          <div className={cardClassName}>
            <div className="profile-review-top">
              <span className="profile-review-label">{label}</span>
              <button type="button" className="profile-review-edit" aria-label={`Edit ${label}`} onClick={() => openMobileSheet(sk)}>
                {pencilIcon}
              </button>
            </div>
            {field === 'hours' ? (
              <div className="onb-step2-value-click" onClick={() => openMobileSheet('hours')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openMobileSheet('hours'); }}>
                <ProfileHoursPreviewGrid hours={hours} />
              </div>
            ) : (
              <div
                className="profile-review-value onb-step2-value-click"
                onClick={() => openMobileSheet(sk)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') openMobileSheet(sk);
                }}
              >
                {value || 'Missing'}
              </div>
            )}
            {showImportState ? profileImportGoogleFootnote(options.imported ?? undefined) : null}
          </div>
        );
      }

      const editing = profileEditField === field;
      return (
        <div className={cardClassName}>
          <div className="profile-review-top">
            <span className="profile-review-label">{label}</span>
            <button
              type="button"
              className={editing ? 'profile-review-edit profile-review-edit--text' : 'profile-review-edit'}
              aria-label={editing ? `Done editing ${label}` : `Edit ${label}`}
              onClick={() => setProfileEditField(editing ? null : field)}
            >
              {editing ? (
                'done'
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              )}
            </button>
          </div>
          {editing ? (
            <div className="profile-review-editor onb-step2-desktop-inline">{editor}</div>
          ) : field === 'hours' ? (
            <ProfileHoursPreviewGrid hours={hours} />
          ) : (
            <div className="profile-review-value">{value || 'Missing'}</div>
          )}
          {showImportState ? profileImportGoogleFootnote(options.imported ?? undefined) : null}
        </div>
      );
    };

    return (
      <>
      <div className="onb-step-confirm">
        <h1 className="onb-title">Confirm your details</h1>
        <p className="onb-subtitle">AI filled these from your website. Edit anything that&apos;s wrong.</p>

        {websiteImportAttempted && (importSource === 'website' || importSource === 'google_business') ? (
          <div>
            <span className="onb-import-badge">✓ Imported from {importSource === 'google_business' ? 'Google' : importedHost}</span>
            {importSuggestions?.warnings?.length ? (
              <div className="onb-warning" style={{ borderRadius: 12, border: '1px solid #fed7aa', background: '#fff7ed', color: '#9a3412', padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>
                {importSuggestions.warnings.slice(0, 3).map((warning) => (
                  <p key={warning} style={{ margin: 0 }}>{warning}</p>
                ))}
              </div>
            ) : null}
            {secondaryImportSuggestionCount(importSuggestions) > 0 ? (
              <p className="onb-help" style={{ margin: '10px 0 14px' }}>
                Staff, policies, and FAQs are ready to review in Business Knowledge.
              </p>
            ) : null}
          </div>
        ) : null}
        {importSource === 'manual' ? (
          <p className="onb-help" style={{ margin: '14px 0' }}>
            No website link saved — you can add one later from the dashboard.
          </p>
        ) : null}

        {profileReviewMessage ? (
          <p className="profile-review-alert" role="alert">
            {profileReviewMessage}
          </p>
        ) : null}

        <div className="profile-review-grid">
          {profileCard(
            'name',
            'Business name',
            businessName,
            <input
              value={businessName}
              onChange={(event) => {
                setBusinessName(event.target.value);
                markProfileFieldEdited('name');
              }}
              placeholder="Happy Nails & Spa"
            />,
            { imported: importSuggestions?.businessProfile.name ?? null },
          )}
          {profileCard(
            'type',
            'Type',
            resolvedVerticalLabel || 'Not set',
            <div>
              <div className="onb-grid onb-compact-grid">
                {MANUAL_PRIMARY_VERTICAL.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`choice-card compact ${profilePickPrimary === item.id ? 'active' : ''}`}
                    onClick={() => {
                      setProfilePickPrimary(item.id);
                      if (item.id === 'beauty_umbrella') {
                        setVertical('beauty_clinic');
                        setBeautySubtype(profilePickSubtype || 'other_beauty');
                      } else {
                        setProfilePickSubtype('');
                        setVertical(item.id);
                        setBeautySubtype('');
                      }
                      setVerticalConfidence('high');
                      markProfileFieldEdited('type');
                      setStatus(null);
                    }}
                  >
                    <span className="emoji">{item.emoji}</span>
                    <h4>{item.label}</h4>
                  </button>
                ))}
              </div>
              {profilePickPrimary === 'beauty_umbrella' ? (
                <div className="preset-row">
                  {BEAUTY_SUBTYPE_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`preset-chip ${profilePickSubtype === item.id ? 'active' : ''}`}
                      onClick={() => {
                        setProfilePickSubtype(item.id);
                        setVertical('beauty_clinic');
                        setBeautySubtype(item.id);
                        setVerticalConfidence('high');
                        markProfileFieldEdited('type');
                        setStatus(null);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>,
            { imported: importSuggestions?.businessProfile.primaryType ?? null },
          )}
          {profileCard(
            'phone',
            'Phone',
            formatPhoneForDisplay(businessPhone),
            <input
              type="tel"
              value={businessPhone}
              onChange={(event) => {
                setBusinessPhone(event.target.value);
                setBusinessPhoneNeedsRealEntry(false);
                markProfileFieldEdited('phone');
              }}
            />,
            { imported: importSuggestions?.businessProfile.phone ?? null },
          )}
          {profileCard(
            'timezone',
            'Timezone',
            selectedTimezoneMeta ? `${selectedTimezoneMeta.label} (${selectedTimezoneMeta.offset})` : timezone,
            <div>
              <div className="onb-field" style={{ marginBottom: 10 }}>
                <label>Country</label>
                <select
                  value={selectedCountry}
                  onChange={(event) => {
                    const nextCountry = event.target.value;
                    const nextCountryMeta = COUNTRY_TIMEZONES.find((item) => item.country === nextCountry);
                    setSelectedCountry(nextCountry);
                    if (nextCountryMeta && !nextCountryMeta.timezones.some((zone) => zone.value === timezone)) {
                      setTimezone(nextCountryMeta.timezones[0].value);
                    }
                    markProfileFieldEdited('timezone');
                  }}
                >
                  <option value="">Select your country...</option>
                  {COUNTRY_TIMEZONES.map((item) => (
                    <option key={item.country} value={item.country}>{item.flag} {item.country}</option>
                  ))}
                </select>
              </div>
              {countryTimezones ? (
                <select
                  value={timezone}
                  onChange={(event) => {
                    setTimezone(event.target.value);
                    markProfileFieldEdited('timezone');
                  }}
                >
                  {countryTimezones.timezones.map((zone) => (
                    <option key={zone.value} value={zone.value}>{zone.label} ({zone.offset})</option>
                  ))}
                </select>
              ) : null}
            </div>,
            { imported: importSuggestions?.businessProfile.timezone ?? null },
          )}
          {profileCard(
            'website',
            'Website',
            websiteUrl,
            <input
              value={websiteUrl}
              onChange={(event) => {
                setWebsiteUrl(event.target.value);
                markProfileFieldEdited('website');
              }}
              placeholder="yourbusiness.com or http://yourbusiness.com"
            />,
            { imported: importSuggestions?.businessProfile.website ?? { value: websiteUrl || null, confidence: websiteUrl ? 0.95 : 0, source: websiteUrl ? 'User' : null } },
          )}
          {profileCard(
            'address',
            'Address',
            address,
            <textarea
              value={address}
              onChange={(event) => {
                setAddress(event.target.value);
                markProfileFieldEdited('address');
              }}
              placeholder="Street, city, region"
            />,
            { imported: importSuggestions?.businessProfile.address ?? null },
          )}
          {profileCard(
            'hours',
            'Hours',
            summarizeHours(hours),
            <div>
              <div className="preset-row">
                <button type="button" className="preset-chip" onClick={() => { setHours(defaultHours()); markProfileFieldEdited('hours'); }}>Standard salon hours</button>
                <button type="button" className="preset-chip" onClick={() => { setHours((h) => presetWeekendClosed({ ...h })); markProfileFieldEdited('hours'); }}>Weekend closed</button>
                <button type="button" className="preset-chip" onClick={() => { setHours(presetOpen7Days(defaultHours())); markProfileFieldEdited('hours'); }}>Open 7 days</button>
              </div>
              <div className="hours-list">
                {DAYS.map(([day, label]) => (
                  <div className={`hours-row ${hours[day].open ? '' : 'closed'}`} key={day}>
                    <strong className="hours-day">{label}</strong>
                    <label className={`toggle-pill ${hours[day].open ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={hours[day].open}
                        onChange={(event) => {
                          setHours({ ...hours, [day]: { ...hours[day], open: event.target.checked } });
                          markProfileFieldEdited('hours');
                        }}
                      />
                      <span className="toggle-dot" />
                      {hours[day].open ? 'Open' : 'Closed'}
                    </label>
                    <select
                      disabled={!hours[day].open}
                      value={hours[day].from}
                      onChange={(event) => {
                        setHours({ ...hours, [day]: { ...hours[day], from: event.target.value } });
                        markProfileFieldEdited('hours');
                      }}
                    >
                      {TIME_OPTIONS.map((time) => <option key={time} value={time}>{formatTimeLabel(time)}</option>)}
                    </select>
                    <select
                      disabled={!hours[day].open}
                      value={hours[day].to}
                      onChange={(event) => {
                        setHours({ ...hours, [day]: { ...hours[day], to: event.target.value } });
                        markProfileFieldEdited('hours');
                      }}
                    >
                      {TIME_OPTIONS.map((time) => <option key={time} value={time}>{formatTimeLabel(time)}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>,
            { wide: true, imported: importSuggestions?.hours ?? null },
          )}
        </div>

        <div className="onb-note" style={{ marginTop: 18, marginBottom: 24 }}>
          <span>ⓘ</span>
          <span>Check your hours and phone — these are what callers ask most.</span>
        </div>

        <div className="profile-review-card wide onb-step2-languages-card">
          <div className="profile-review-top">
            <span className="profile-review-label">{shopPlan === 'starter' ? 'Languages noted for setup' : 'Languages'}</span>
          </div>
          <p className="onb-subtitle" style={{ marginTop: 0, marginBottom: 12 }}>
            {shopPlan === 'starter'
              ? 'Stored for your team and onboarding notes. Starter keeps live dialogue in English unless your plan enables bilingual workflows.'
              : 'Beyond English, RingBooker can respond in the languages you enable here during live calls.'}
          </p>
          <div className="preset-row onb-step2-lang-chips" style={{ marginTop: 0 }}>
            {STEP2_LANGUAGE_CHIPS.map(({ code, label, required }) => {
              const selected = languages.includes(code);
              if (shopPlan === 'starter' && !required) {
                return (
                  <button key={code} type="button" className="preset-chip mixed-chip locked" disabled>
                    {label}
                  </button>
                );
              }
              if (required) {
                return (
                  <button key={code} type="button" className="preset-chip mixed-chip active" disabled>
                    {label} ✓
                  </button>
                );
              }
              return (
                <button
                  key={code}
                  type="button"
                  className={`preset-chip mixed-chip ${selected ? 'active' : ''}`}
                  onClick={() => setLanguages(toggleStep2Language(languages, code, !selected))}
                >
                  {label}
                  {selected ? ' ✓' : ''}
                </button>
              );
            })}
          </div>
          {vertical === 'nail_salon' && shopPlan !== 'starter' && languages.includes('vi') ? (
            <p className="onb-help" style={{ marginTop: 10, marginBottom: 0 }}>
              Vietnamese is included for nail salons — turn off if you don&apos;t need it.
            </p>
          ) : null}
        </div>

        {websiteLoading && importProgress ? <p className="onb-help">{importProgress}</p> : null}
        <div className="onb-actions onb-actions-desktop">
          <span />
          <button className="onb-btn-primary" type="button" onClick={() => void continueProfileReview()} disabled={saving}>
            {saving ? 'Saving…' : 'Continue →'}
          </button>
        </div>
        <div className="onb-sticky-cta">
          <button className="onb-btn-primary" type="button" onClick={() => void continueProfileReview()} disabled={saving}>
            {saving ? 'Saving…' : 'Continue →'}
          </button>
        </div>
      </div>

      {isStep2Mobile && step2Sheet === 'type' ? (
        <div className="onb-step2-sheet-overlay" role="presentation" onClick={cancelTypeSheet}>
          <div
            className="onb-step2-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onb-step2-type-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="onb-step2-sheet-handle" />
            <div className="onb-step2-sheet-title" id="onb-step2-type-title">
              Type
            </div>
            <div>
              <div className="onb-step2-type-grid">
                {MANUAL_PRIMARY_VERTICAL.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`choice-card compact ${profilePickPrimary === item.id ? 'active' : ''}`}
                    onClick={() => {
                      setProfilePickPrimary(item.id);
                      if (item.id === 'beauty_umbrella') {
                        setVertical('beauty_clinic');
                        setBeautySubtype(profilePickSubtype || 'other_beauty');
                      } else {
                        setProfilePickSubtype('');
                        setVertical(item.id);
                        setBeautySubtype('');
                      }
                      setVerticalConfidence('high');
                      markProfileFieldEdited('type');
                      setStatus(null);
                    }}
                  >
                    <span className="emoji">{item.emoji}</span>
                    <h4>{item.label}</h4>
                  </button>
                ))}
              </div>
              {profilePickPrimary === 'beauty_umbrella' ? (
                <div className="preset-row">
                  {BEAUTY_SUBTYPE_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`preset-chip ${profilePickSubtype === item.id ? 'active' : ''}`}
                      onClick={() => {
                        setProfilePickSubtype(item.id);
                        setVertical('beauty_clinic');
                        setBeautySubtype(item.id);
                        setVerticalConfidence('high');
                        markProfileFieldEdited('type');
                        setStatus(null);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="onb-step2-sheet-actions">
              <button type="button" className="onb-step2-sheet-cancel" onClick={cancelTypeSheet}>
                Cancel
              </button>
              <button type="button" className="onb-step2-sheet-save" onClick={saveTypeSheet}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isStep2Mobile && step2Sheet === 'timezone' ? (
        <div className="onb-step2-sheet-overlay" role="presentation" onClick={cancelTimezoneSheet}>
          <div
            className="onb-step2-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onb-step2-tz-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="onb-step2-sheet-handle" />
            <div className="onb-step2-sheet-title" id="onb-step2-tz-title">
              Timezone
            </div>
            <div className="onb-field" style={{ marginBottom: 10 }}>
              <label>Country</label>
              <select
                value={tzSheetCountry}
                onChange={(event) => {
                  const nextCountry = event.target.value;
                  const nextCountryMeta = COUNTRY_TIMEZONES.find((item) => item.country === nextCountry);
                  setTzSheetCountry(nextCountry);
                  if (nextCountryMeta && !nextCountryMeta.timezones.some((zone) => zone.value === tzSheetTimezone)) {
                    setTzSheetTimezone(nextCountryMeta.timezones[0].value);
                  }
                }}
              >
                <option value="">Select your country...</option>
                {COUNTRY_TIMEZONES.map((item) => (
                  <option key={item.country} value={item.country}>
                    {item.flag} {item.country}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="search"
              placeholder="Search timezone..."
              value={tzSheetSearch}
              onChange={(event) => setTzSheetSearch(event.target.value)}
              autoComplete="off"
              enterKeyHint="search"
            />
            <div className="onb-step2-tz-list" role="listbox">
              {filteredTzOptions.map((z) => (
                <div
                  key={z.value}
                  role="option"
                  aria-selected={tzSheetTimezone === z.value}
                  className={`onb-step2-tz-item${tzSheetTimezone === z.value ? ' selected' : ''}`}
                  onClick={() => setTzSheetTimezone(z.value)}
                >
                  {z.flag} {z.label}
                </div>
              ))}
            </div>
            <div className="onb-step2-sheet-actions">
              <button type="button" className="onb-step2-sheet-cancel" onClick={cancelTimezoneSheet}>
                Cancel
              </button>
              <button type="button" className="onb-step2-sheet-save" onClick={saveTimezoneSheet}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isStep2Mobile && step2Sheet === 'address' ? (
        <div className="onb-step2-sheet-overlay" role="presentation" onClick={cancelAddressSheet}>
          <div
            className="onb-step2-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onb-step2-address-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="onb-step2-sheet-handle" />
            <div className="onb-step2-sheet-title" id="onb-step2-address-title">
              Address
            </div>
            <textarea
              rows={3}
              value={addressSheetDraft}
              onChange={(event) => setAddressSheetDraft(event.target.value)}
              placeholder="Street, City, State ZIP"
            />
            <div className="onb-step2-sheet-actions">
              <button type="button" className="onb-step2-sheet-cancel" onClick={cancelAddressSheet}>
                Cancel
              </button>
              <button type="button" className="onb-step2-sheet-save" onClick={saveAddressSheet}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isStep2Mobile && step2Sheet === 'hours' ? (
        <div className="onb-step2-sheet-overlay" role="presentation" onClick={cancelHoursSheet}>
          <div
            className="onb-step2-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onb-step2-hours-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="onb-step2-sheet-handle" />
            <div className="onb-step2-sheet-title" id="onb-step2-hours-title">
              Hours
            </div>
            <div className="preset-row">
              <button type="button" className="preset-chip" onClick={() => setHoursSheetDraft(defaultHours())}>
                Standard salon hours
              </button>
              <button type="button" className="preset-chip" onClick={() => setHoursSheetDraft((h) => presetWeekendClosed({ ...h }))}>
                Weekend closed
              </button>
              <button type="button" className="preset-chip" onClick={() => setHoursSheetDraft(presetOpen7Days(defaultHours()))}>
                Open 7 days
              </button>
            </div>
            <div className="hours-list" style={{ marginTop: 12 }}>
              {DAYS.map(([day, label]) => (
                <div className={`hours-row ${hoursSheetDraft[day].open ? '' : 'closed'}`} key={day}>
                  <strong className="hours-day">{label}</strong>
                  <label className={`toggle-pill ${hoursSheetDraft[day].open ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={hoursSheetDraft[day].open}
                      onChange={(event) => {
                        setHoursSheetDraft({
                          ...hoursSheetDraft,
                          [day]: { ...hoursSheetDraft[day], open: event.target.checked },
                        });
                      }}
                    />
                    <span className="toggle-dot" />
                    {hoursSheetDraft[day].open ? 'Open' : 'Closed'}
                  </label>
                  <select
                    disabled={!hoursSheetDraft[day].open}
                    value={hoursSheetDraft[day].from}
                    onChange={(event) => {
                      setHoursSheetDraft({
                        ...hoursSheetDraft,
                        [day]: { ...hoursSheetDraft[day], from: event.target.value },
                      });
                    }}
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>
                        {formatTimeLabel(time)}
                      </option>
                    ))}
                  </select>
                  <select
                    disabled={!hoursSheetDraft[day].open}
                    value={hoursSheetDraft[day].to}
                    onChange={(event) => {
                      setHoursSheetDraft({
                        ...hoursSheetDraft,
                        [day]: { ...hoursSheetDraft[day], to: event.target.value },
                      });
                    }}
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>
                        {formatTimeLabel(time)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="onb-step2-sheet-actions">
              <button type="button" className="onb-step2-sheet-cancel" onClick={cancelHoursSheet}>
                Cancel
              </button>
              <button type="button" className="onb-step2-sheet-save" onClick={saveHoursSheet}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </>
    );
  }

  function renderStep3() {
    const importedServiceCount = servicesFound;
    const manualSetup = importSource === 'manual' || !websiteUrl.trim();
    const hasNamedGroups = services.some((service) => {
      const group = (service.group || '').trim().toLowerCase();
      return Boolean(group) && group !== 'general services';
    });
    const thinImport = !manualSetup && (importedServiceCount < 5 || !hasNamedGroups);
    const fullImport = !manualSetup && importedServiceCount >= 5 && hasNamedGroups;
    const showChipSection = !fullImport;
    const groupNames = [
      ...new Set([...selectedServiceGroups, ...services.map((service) => service.group || 'General Services')].filter(Boolean)),
    ];
    const groupedServices = groupNames.map((group) => ({
      group,
      items: services.map((service, index) => ({ service, index })).filter(({ service }) => (service.group || 'General Services') === group),
    }));
    const visibleGroupedServices = groupedServices.filter(({ group, items }) =>
      shouldShowServiceGroupCard(manualSetup, group, items, selectedServiceGroups),
    );
    const chipSideGroups = thinImport
      ? visibleGroupedServices.filter(
          ({ items }) => !items.some(({ service }) => Boolean(service.source || service.sourceHint)),
        )
      : [];
    const importedSideGroups = thinImport
      ? visibleGroupedServices.filter(({ items }) => items.some(({ service }) => Boolean(service.source || service.sourceHint)))
      : [];
    const chipDisplayPlan = step3ChipDisplayPlan(vertical, step1ManualPrimaryRef.current, beautySubtype);
    const totalServices = services.filter((service) => service.name.trim().length > 0).length;
    const importNote = totalServices === 1 ? '✓ 1 service imported' : `✓ ${totalServices} services imported`;
    const chipTierMargin = thinImport ? 0 : 10;
    const renderCategoryChips = (chips: readonly string[]) =>
      chips.map((chipGroup) => {
        const isManualOther = manualSetup && chipGroup === 'Other';
        const isActive = !isManualOther && selectedServiceGroups.includes(chipGroup);
        return (
          <button
            key={chipGroup}
            type="button"
            className={`preset-chip mixed-chip ${isActive ? 'active' : ''}`}
            onClick={() =>
              isManualOther
                ? setAddGroupSheetConfig({
                    title: 'Name your category',
                    placeholder: 'e.g. Waxing, Lashes, Threading...',
                  })
                : toggleServiceGroup(chipGroup)
            }
          >
            <span className="chip-icon">{MIXED_SERVICE_GROUP_ICONS[chipGroup as keyof typeof MIXED_SERVICE_GROUP_ICONS]}</span>
            {chipGroup}
          </button>
        );
      });

    const renderServiceEditor = (group: string, index: number | null, mode: 'inline' | 'sheet') => {
      const draft = serviceEditor?.draft;
      if (!draft || serviceEditor.mode !== mode || serviceEditor.group !== group || serviceEditor.index !== index) return null;
      return (
        <div className={mode === 'inline' ? 'onb-service-edit-row' : 'onb-service-sheet-fields'} onKeyDown={handleServiceEditorKeyDown}>
          <input
            ref={serviceNameInputRef}
            value={draft.name}
            onChange={(event) => updateServiceDraft({ name: event.target.value })}
            placeholder="Service name"
            aria-label="Service name"
          />
          <div className="onb-service-price-input">
            <span>$</span>
            <input
              type="number"
              value={draft.price}
              onChange={(event) => updateServiceDraft({ price: Number(event.target.value) })}
              placeholder="Price"
              aria-label="Price"
            />
          </div>
          <input
            value={serviceDurationText(draft)}
            onChange={(event) => updateServiceDraft({ duration_text: event.target.value, duration_min: parseDurationTextToMinutes(event.target.value) })}
            placeholder="Duration"
            aria-label="Duration"
          />
          {draft.variants?.length ? (
            <div className="onb-service-variants-editor">
              <span className="onb-service-variants-label">Options</span>
              {draft.variants.map((variant, variantIndex) => (
                <div className="onb-service-variant-edit" key={`${variant.label}-${variantIndex}`}>
                  <input
                    value={variant.label}
                    onChange={(event) => updateServiceDraftVariant(variantIndex, { label: event.target.value })}
                    placeholder="Option"
                    aria-label="Option label"
                  />
                  <input
                    value={variant.durationText ?? ''}
                    onChange={(event) => updateServiceDraftVariant(variantIndex, { durationText: event.target.value, durationMinutes: parseDurationTextToMinutes(event.target.value) })}
                    placeholder="30 min"
                    aria-label="Option duration"
                  />
                  <input
                    type="number"
                    value={variant.priceAmount ?? ''}
                    onChange={(event) => updateServiceDraftVariant(variantIndex, { priceAmount: event.target.value === '' ? null : Number(event.target.value) })}
                    placeholder="Price"
                    aria-label="Option price"
                  />
                  <button type="button" onClick={() => removeServiceDraftVariant(variantIndex)} aria-label="Remove option">×</button>
                </div>
              ))}
            </div>
          ) : null}
          <button type="button" className="onb-service-add-option" onClick={addServiceDraftVariant}>+ Add option</button>
          {mode === 'inline' ? (
            <>
              <button type="button" className="onb-service-save-dot" onClick={saveServiceEditor} aria-label="Save service">✓</button>
              <button type="button" className="onb-service-cancel-dot" onClick={() => setServiceEditor(null)} aria-label="Cancel editing">×</button>
            </>
          ) : null}
        </div>
      );
    };

    const renderGroupCard = (group: string, items: Array<{ service: ServiceItem; index: number }>) => {
      const collapsed = collapsedServiceGroups.includes(group);
      const groupVisual = serviceGroupIcon(group);
      const groupNeedsReview = items.some(({ service }) => serviceNeedsAttention(service));
      const editingDesktopName = groupRenameDesktop === group;

      const openDesktopGroupRename = () => {
        setGroupRenameMobile(null);
        setGroupRenameMobileDraft('');
        setGroupRenameDesktop(group);
        setGroupRenameDraft(titleCaseServiceLabel(group));
      };

      return (
        <div className="service-group-card" key={group} data-service-group={group}>
          <div className="service-group-head">
            <span className="service-group-icon" style={{ background: groupVisual.bg }} aria-hidden>{groupVisual.icon}</span>
            <span className="service-group-main">
              <span className="onb-group-title-desktop service-group-title-row">
                {editingDesktopName ? (
                  <>
                    <input
                      ref={groupRenameInputRef}
                      className="onb-group-title-input"
                      value={groupRenameDraft}
                      onChange={(event) => setGroupRenameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitGroupRenameDesktop();
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          cancelGroupRenameDesktop();
                        }
                      }}
                      aria-label="Group name"
                    />
                    <span className="onb-group-title-actions">
                      <button type="button" className="onb-group-title-save" onClick={commitGroupRenameDesktop} aria-label="Save group name">✓</button>
                      <button type="button" className="onb-group-title-cancel" onClick={cancelGroupRenameDesktop} aria-label="Cancel renaming group">✕</button>
                    </span>
                  </>
                ) : (
                  <>
                    <button type="button" className="service-group-title--btn" onClick={openDesktopGroupRename}>
                      {titleCaseServiceLabel(group)}
                    </button>
                    <button type="button" className="onb-group-rename-pencil onb-group-rename-pencil--desktop" aria-label="Rename group" onClick={openDesktopGroupRename}>
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                  </>
                )}
              </span>
              <span className="onb-group-title-mobile service-group-title-row">
                <span className="service-group-title">{titleCaseServiceLabel(group)}</span>
                <button
                  type="button"
                  className="onb-group-rename-pencil"
                  aria-label="Rename group"
                  onClick={() => {
                    setGroupRenameDesktop(null);
                    setGroupRenameDraft('');
                    setGroupRenameMobile(group);
                    setGroupRenameMobileDraft(titleCaseServiceLabel(group));
                  }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
              </span>
              <span className="service-group-meta">{items.length} {items.length === 1 ? 'service' : 'services'}</span>
            </span>
            {groupNeedsReview ? <span className="service-group-warning">needs review</span> : null}
            <button type="button" className="onb-group-add-header-desktop" onClick={() => addBlankService(group, 'inline')}>
              + Add service
            </button>
            <button
              type="button"
              className="service-group-collapse-btn"
              onClick={() => toggleServiceGroupCollapsed(group)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand group' : 'Collapse group'}
            >
              <span className={`service-group-chevron ${collapsed ? '' : 'open'}`} aria-hidden>⌄</span>
            </button>
          </div>
          {!collapsed ? (
            <div className="service-group-body">
              {items.length === 0 ? (
                <div className="service-empty">No services yet.</div>
              ) : null}
              {items.map(({ service, index }) => {
                const editingInline = serviceEditor?.mode === 'inline' && serviceEditor.index === index;
                const duration = serviceDurationText(service);
                return (
                  <div className="onb-service-row-wrap" key={`${group}-${index}`}>
                    {editingInline ? (
                      renderServiceEditor(group, index, 'inline')
                    ) : (
                      <>
                        <button type="button" className="onb-service-row onb-service-row-desktop" onClick={() => openServiceEditor(index, group, 'inline')}>
                          <span className="onb-service-name">
                            {service.name || 'Untitled service'}
                            {service.variants?.length ? (
                              <span className="onb-service-variants-preview">
                                {service.variants.slice(0, 4).map(formatServiceVariant).join(' · ')}
                              </span>
                            ) : null}
                          </span>
                          <span className={`onb-service-price ${service.price === 0 ? 'warn' : ''}`} title={service.price === 0 ? "This service has no price. AI will say 'price on consultation'." : undefined}>
                            {service.price === 0 ? '⚠ ' : ''}
                            {formatServicePrice(service)}
                          </span>
                          <span className={`onb-service-duration ${duration ? '' : 'warn'}`} title={!duration ? "No duration set. AI won't estimate appointment length." : undefined}>
                            {duration || 'Add time ⚠'}
                          </span>
                          <span className="onb-service-edit-link">Edit</span>
                        </button>
                        <div
                          className="svc-row"
                          role="button"
                          tabIndex={0}
                          onClick={() => openServiceEditor(index, group, 'sheet')}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openServiceEditor(index, group, 'sheet');
                            }
                          }}
                        >
                          <div className="svc-body">
                            <div className="svc-name">{service.name || 'Untitled service'}</div>
                            {service.variants?.length ? (
                              <div className="svc-variants">{service.variants.slice(0, 3).map(formatServiceVariant).join(' · ')}</div>
                            ) : null}
                            <div className="svc-meta">
                              <span className={`svc-price ${service.price === 0 ? 'zero' : ''}`}>{service.price === 0 ? '$0 ⚠' : formatServicePrice(service)}</span>
                              <span>·</span>
                              <span className={`svc-duration ${duration ? '' : 'missing'}`}>{duration || 'Add time ⚠'}</span>
                              <span>·</span>
                              <button
                                type="button"
                                className="svc-remove"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeServiceRow(index);
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          <div className="svc-arrow" aria-hidden>›</div>
                        </div>
                      </>
                    )}
                    {!editingInline ? (
                      <button type="button" className="service-remove-btn onb-service-remove-compact" onClick={() => removeServiceRow(index)} aria-label={`Remove ${service.name || 'service'}`}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                );
              })}
              <button className="onb-group-add-service onb-group-add-service-mobile" type="button" onClick={() => addBlankService(group, 'sheet')}>
                + Add service
              </button>
            </div>
          ) : null}
        </div>
      );
    };

    return (
      <div>
        <div className="onb-services-review-shell">
          <h1 className="onb-title">
            {fullImport ? 'Review your services' : 'Add your services'}{' '}
            <span className="onb-step3-optional-pill">optional</span>
          </h1>
          <p className="onb-subtitle">
            {fullImport
              ? 'Fix anything that looks wrong. Edit prices and add missing ones.'
              : thinImport
                ? 'So AI can answer pricing questions. Skip and finish later.'
                : "Select what you offer — we'll add example services. Edit prices to match yours."}
          </p>
          {fullImport && totalServices > 0 ? (
            <p className="onb-service-import-badge">
              <span className="onb-desktop-copy">{importNote} — click any row to edit</span>
              <span className="onb-mobile-copy">{importNote} — tap any to edit</span>
            </p>
          ) : null}
        </div>
        {thinImport ? (
          <p className="onb-step3-thin-warn">
            We found a few services but couldn&apos;t read prices. Pick your categories below — we&apos;ll add examples to edit.
          </p>
        ) : null}
        {showChipSection ? (
          <div className="onb-service-mode-b">
            <span className="onb-step3-section-label">What do you offer?</span>
            {thinImport ? (
              <p className="onb-step3-section-hint">Tap to add — we&apos;ll create example services with prices to fill in.</p>
            ) : null}
            {chipDisplayPlan.flatAll ? (
              <div className="preset-row onb-chips-tier1" style={{ marginTop: chipTierMargin }}>
                {renderCategoryChips(chipDisplayPlan.tier1)}
              </div>
            ) : (
              <>
                <div className="preset-row onb-chips-tier1" style={{ marginTop: chipTierMargin }}>
                  {renderCategoryChips(chipDisplayPlan.tier1)}
                </div>
                {!step3ShowMoreChips && chipDisplayPlan.tier2.length > 0 ? (
                  <button type="button" className="onb-chips-show-more-btn" onClick={() => setStep3ShowMoreChips(true)}>
                    + Show more categories
                  </button>
                ) : null}
                {step3ShowMoreChips ? (
                  <div className="preset-row onb-chips-tier2" style={{ marginTop: 8 }}>
                    {renderCategoryChips(chipDisplayPlan.tier2)}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
        {thinImport ? (
          <>
            <div className="onb-service-groups" aria-label="Service groups">
              {chipSideGroups.map(({ group, items }) => renderGroupCard(group, items))}
            </div>
            {importedSideGroups.length > 0 ? (
              <>
                <div className="onb-step3-import-divider">
                  <span>Imported</span>
                </div>
                <div className="onb-service-groups" aria-label="Imported service groups">
                  {importedSideGroups.map(({ group, items }) => renderGroupCard(group, items))}
                </div>
              </>
            ) : null}
          </>
        ) : (
          <div className="onb-service-groups" aria-label="Service groups">
            {visibleGroupedServices.map(({ group, items }) => renderGroupCard(group, items))}
          </div>
        )}
        {thinImport || fullImport ? (
          <button
            type="button"
            className="onb-add-service-group-btn"
            onClick={() =>
              setAddGroupSheetConfig({
                title: 'New service group',
                placeholder: 'e.g. Waxing, Facials, Extensions...',
              })
            }
          >
            + Add service group
          </button>
        ) : null}
        <OnboardingAddGroupSheet
          isOpen={addGroupSheetConfig !== null}
          onClose={() => setAddGroupSheetConfig(null)}
          onConfirm={handleAddGroup}
          title={addGroupSheetConfig?.title ?? ''}
          placeholder={addGroupSheetConfig?.placeholder ?? ''}
        />
        {serviceEditor?.mode === 'sheet' ? (
          <div className="onb-service-sheet-overlay" role="presentation" onClick={() => setServiceEditor(null)}>
            <div className="onb-service-sheet" role="dialog" aria-modal="true" aria-label="Edit service" onClick={(event) => event.stopPropagation()}>
              <div className="onb-service-sheet-handle" />
              <h3>{serviceEditor.draft.name || 'New service'}</h3>
              {renderServiceEditor(serviceEditor.group, serviceEditor.index, 'sheet')}
              <div className="onb-service-sheet-actions">
                <button type="button" className="onb-btn-secondary" onClick={() => setServiceEditor(null)}>Cancel</button>
                <button type="button" className="onb-btn-primary" onClick={saveServiceEditor}>Save</button>
              </div>
            </div>
          </div>
        ) : null}
        {groupRenameMobile ? (
          <div className="onb-step2-sheet-overlay" role="presentation" onClick={cancelGroupRenameMobile}>
            <div className="onb-step2-sheet" role="dialog" aria-modal="true" aria-labelledby="onb-group-rename-title" onClick={(event) => event.stopPropagation()}>
              <div className="onb-step2-sheet-handle" />
              <div className="onb-step2-sheet-title" id="onb-group-rename-title">Rename group</div>
              <input
                className="onb-group-rename-sheet-input"
                value={groupRenameMobileDraft}
                onChange={(event) => setGroupRenameMobileDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitGroupRenameMobile();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelGroupRenameMobile();
                  }
                }}
                aria-label="Group name"
                autoFocus
              />
              <div className="onb-group-rename-sheet-actions">
                <button type="button" className="onb-group-rename-sheet-cancel" onClick={cancelGroupRenameMobile}>
                  Cancel
                </button>
                <button type="button" className="onb-group-rename-sheet-save" onClick={commitGroupRenameMobile}>
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <div className="onb-actions onb-actions-desktop" style={{ marginTop: 28 }}>
          <button className="onb-btn-secondary" type="button" onClick={() => void continueServices()} disabled={saving}>
            Skip services for now
          </button>
          <button className="onb-btn-primary" type="button" onClick={() => void continueServices()} disabled={saving}>
            {saving ? 'Saving…' : 'Save services'}
          </button>
        </div>
        <div className="onb-sticky-cta">
          <button className="onb-btn-primary" type="button" onClick={() => void continueServices()} disabled={saving}>
            {saving ? 'Saving…' : 'Save services'}
          </button>
          <button className="onb-btn-secondary onb-sticky-quiet" type="button" onClick={() => void continueServices()} disabled={saving}>
            Skip services for now
          </button>
        </div>
      </div>
    );
  }

  function renderStep4() {
    return (
      <div>
        <h1 className="onb-title">Meet your AI receptionist</h1>
        <p className="onb-subtitle">Try RingBooker before it answers real callers. No card is needed for setup and test calls.</p>

        {step4Phase === 'try' ? (
          <>
            <div className="test-grid">
              <div className="test-card">
                <h3>Web voice test</h3>
                <p>Talk to RingBooker in your browser using your business setup.</p>
                <a
                  className="onb-btn-primary onb-actions-desktop"
                  href={webDemoHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginTop: 'auto', alignSelf: 'flex-start' }}
                  onClick={() => {
                    trackOnboarding('web_voice_test_started', { href: webDemoHref });
                  }}
                >
                  Start web voice test
                </a>
              </div>
              <div className="test-card">
                <h3>Call me for a test</h3>
                <p>RingBooker will call your saved phone number so you can hear how it sounds on a real call.</p>
                <button
                  className="onb-btn-primary onb-actions-desktop"
                  style={{ marginTop: 'auto', alignSelf: 'flex-start' }}
                  type="button"
                  onClick={() => void requestTestCall()}
                >
                  Call me now
                </button>
                {testCallStatus ? <p className="onb-help">{testCallStatus}</p> : null}
              </div>
            </div>
            <div className="onb-actions-desktop" style={{ marginTop: 20 }}>
              <button type="button" className="onb-btn-secondary" style={{ marginRight: 12 }} onClick={markOnboardingWrapped}>
                I tried the web demo — continue
              </button>
              <button type="button" className="onb-help-link" onClick={markOnboardingWrapped}>
                Skip tests, I&apos;m ready to finish →
              </button>
            </div>
          </>
        ) : null}

        {step4Phase === 'done' ? (
          <div className="onb-status" style={{ marginTop: 16, border: '1px solid #c7d2fe', background: '#eef2ff' }}>
            <h3 className="onb-title" style={{ fontSize: '1.15rem' }}>
              Setup complete
            </h3>
            <p className="onb-subtitle" style={{ marginTop: 8 }}>
              Open your dashboard to finish going live when you&apos;re ready. Start your 14-day trial from Billing — live answering stays off until billing and phone forwarding are complete.
            </p>
            <div className="onb-actions-desktop" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              <button className="onb-btn-primary" type="button" onClick={completeSetup}>
                Open dashboard
              </button>
              <a className="onb-btn-secondary" href="/user/billing">
                Start 14-day trial
              </a>
            </div>
          </div>
        ) : null}

        <div className="onb-sticky-cta">
          {step4Phase === 'try' ? (
            <>
              <a
                className="onb-btn-primary"
                href={webDemoHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackOnboarding('web_voice_test_started', { href: webDemoHref });
                }}
              >
                Start web voice test
              </a>
              <button className="onb-btn-secondary" type="button" onClick={() => void requestTestCall()}>
                Call me now
              </button>
              <button type="button" className="onb-btn-secondary" onClick={markOnboardingWrapped}>
                Continue after web demo
              </button>
            </>
          ) : (
            <>
              <button className="onb-btn-primary" type="button" onClick={completeSetup}>
                Open dashboard
              </button>
              <a className="onb-btn-secondary" href="/user/billing">
                Start 14-day trial
              </a>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <UserLayout styles={mergedStyles} scripts={userSettingsScripts} scriptPrefix="user-onboarding-live">
      <main className="main onboarding-main">
        <section className="onb-shell onboarding-flow">
          <div className={`onb-card ${currentStep === 4 ? 'wide' : ''}`}>
            <Progress currentStep={currentStep} step1View={step1View} onBack={() => void handleBack()} />
            {currentStep === 1 ? renderStep1() : null}
            {currentStep === 2 ? renderStep2() : null}
            {currentStep === 3 ? renderStep3() : null}
            {currentStep === 4 ? renderStep4() : null}
            {status && currentStep !== 2 ? <div className="onb-status">{status}</div> : null}
          </div>
        </section>
      </main>
    </UserLayout>
  );
}

function Progress({
  currentStep,
  step1View,
  onBack,
}: {
  currentStep: WizardStep;
  step1View: Step1View;
  onBack: () => void;
}) {
  const hideBack = currentStep === 1 && step1View === 'quick';
  return (
    <div className="onb-progress">
      <button
        className={`onb-back-inline ${hideBack ? 'hidden' : ''}`}
        type="button"
        onClick={onBack}
        aria-hidden={hideBack}
        tabIndex={hideBack ? -1 : 0}
      >
        ← <span className="onb-back-text">Back</span>
      </button>
      <div className="onb-progress-main">
        <div className="onb-progress-track" aria-label={`Step ${currentStep} of 4`}>
          {[1, 2, 3, 4].map((step) => (
            <Fragment key={step}>
              <span
                className={`onb-progress-node ${step < currentStep ? 'done' : ''} ${step === currentStep ? 'current' : ''}`}
                aria-current={step === currentStep ? 'step' : undefined}
                title={STEP_LABELS[step - 1]}
              >
                {step}
              </span>
              {step < 4 ? (
                <span className={`onb-progress-line ${step < currentStep ? 'done' : ''} ${step === currentStep ? 'current' : ''}`} />
              ) : null}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
