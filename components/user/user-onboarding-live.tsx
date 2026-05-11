'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { formatPhoneForDisplay, normalizePhoneForStorage } from '@/lib/phone-number';
import { isSignupSyntheticPlaceholderPhone } from '@/lib/shop-phone-placeholder';
import { UserLayout } from '@/components/user/user-layout';
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
type ServiceItem = { name: string; duration_min: number; price: number; group?: string; aliases?: string[]; price_type?: ServicePriceType; bookable?: boolean };
type ServiceCatalogResponse = {
  categories: Array<{ id: string; name: string; sortOrder: number; active: boolean }>;
  services: Array<{
    id: string;
    categoryId?: string | null;
    name: string;
    durationMinutes?: number | null;
    priceAmount?: number | null;
    priceType?: ServicePriceType;
    bookable?: boolean;
    aliases?: string[];
    sortOrder: number;
    active: boolean;
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
      durationMinutes?: number | null;
      priceAmount?: number | null;
      priceType?: ServicePriceType;
      aliases?: string[];
      bookable?: boolean;
      confidence?: number;
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
  'Checking your link',
  'Finding useful pages',
  'Reading services and hours',
  'Comparing business details',
  'Preparing your review',
] as const;

export function importProgressStepIndex(elapsedMs: number): number {
  if (elapsedMs >= 6500) return 4;
  if (elapsedMs >= 4800) return 3;
  if (elapsedMs >= 3000) return 2;
  if (elapsedMs >= 1200) return 1;
  return 0;
}

export function importProgressDelayMessage(elapsedMs: number): string | null {
  if (elapsedMs >= 20000) return 'This is taking longer than expected. You can continue manually and edit everything later.';
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
  { id: 'hair_salon', emoji: '✂', label: 'Hair salon' },
  { id: 'day_spa', emoji: '♡', label: 'Day spa' },
  { id: 'med_spa', emoji: '✽', label: 'Med spa' },
  { id: 'beauty_umbrella', emoji: '…', label: 'Mixed / other' },
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
  Manicure: '✦',
  Pedicure: '✦',
  'Acrylics / Extensions': '✦',
  Haircuts: '✂',
  'Hair Color': '✂',
  Waxing: '♨',
  Massage: '⌁',
  Facials: '♡',
  'Brows & Lashes': '◉',
  Makeup: '✧',
  Injectables: '✽',
  Laser: '⌁',
  'Skin Treatments': '♢',
  Consultations: '□',
  Other: '…',
};

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

function isHttpsWebsiteUrl(raw: string): boolean {
  try {
    const url = new URL(normalizeWebsiteUrl(raw));
    return url.protocol === 'https:';
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

function importFieldState(field?: { value?: unknown; confidence?: number; source?: string | null } | null): ReactNode {
  const { label, source } = importReviewBadgeState(field);
  const verified = label === 'AI verified';
  const missing = label === 'Missing';
  const needsReview = label === 'Needs review';
  return (
    <p className="onb-help" style={{ marginTop: 6 }}>
      <span
        className="onb-source-badge"
        style={{
          background: verified ? '#ecfdf5' : needsReview ? '#fff7ed' : missing ? '#ffedd5' : '#eef2ff',
          color: verified ? '#047857' : needsReview ? '#c2410c' : missing ? '#c2410c' : '#3730a3',
        }}
      >
        {label}
      </span>{' '}
      {source ? <span className="onb-source-badge">Source: {source}</span> : null}
    </p>
  );
}

function importedVerticalToApp(value?: string | null): Vertical | '' {
  if (value === 'nail_salon' || value === 'hair_salon' || value === 'day_spa' || value === 'med_spa' || value === 'beauty_clinic') return value;
  if (value === 'spa') return 'day_spa';
  return '';
}

function servicesFromImport(suggestions?: ImportedWebsiteSuggestions): ServiceItem[] {
  const imported = suggestions?.serviceCatalog?.services ?? [];
  return imported
    .filter((service) => service.name.trim().length > 0)
    .map((service) => ({
      name: service.name.trim(),
      duration_min: service.durationMinutes ?? 60,
      price: service.priceAmount ?? 0,
      group: service.categoryName?.trim() || 'General Services',
      aliases: service.aliases ?? [],
      price_type: service.priceType ?? ((service.priceAmount ?? 0) > 0 ? 'fixed' : 'varies'),
      bookable: service.bookable ?? true,
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
      duration_min: item.duration_min && item.duration_min > 0 ? item.duration_min : 60,
      price: Number.isFinite(item.price) ? item.price : 0,
      group: item.group?.trim() || 'General Services',
      aliases: item.aliases ?? [],
      price_type: item.price_type ?? (item.price > 0 ? 'fixed' : 'varies'),
      bookable: item.bookable ?? true,
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
        duration_min: service.durationMinutes ?? 60,
        price: service.priceAmount ?? 0,
        group: category?.name ?? 'General Services',
        aliases: service.aliases ?? [],
        price_type: service.priceType ?? 'fixed',
        bookable: service.bookable ?? true,
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
        priceAmount: service.price,
        priceCurrency: 'USD',
        priceType: service.price_type ?? (service.price > 0 ? 'fixed' : 'varies'),
        bookable: service.bookable ?? true,
        active: true,
        sortOrder: index,
        aliases: service.aliases ?? [],
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
  const parts = DAYS.map(([day, label]) => {
    const row = hours[day];
    if (!row.open) return `${label}: Closed`;
    return `${label}: ${formatTimeLabel(row.from)}–${formatTimeLabel(row.to)}`;
  });
  return parts.join(' · ');
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
            : [{ name: '', duration_min: 60, price: 0, group: 'General Services' }];
      })()
    : [{ name: '', duration_min: 60, price: 0 }];

  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(initialData && !initialData.ok ? initialData.error ?? 'Unable to load onboarding.' : null);
  const [shopId, setShopId] = useState(initialShop?.id ?? '');
  const [currentStep, setCurrentStep] = useState<WizardStep>(normalizeStep(initialShop?.current_onboarding_step));
  const [businessName, setBusinessName] = useState(initialShop?.name ?? '');
  const [address, setAddress] = useState(typeof initialShop?.address === 'string' ? initialShop.address : '');
  const [vertical, setVertical] = useState<Vertical | ''>(initialVertical);
  const [businessPhone, setBusinessPhone] = useState(initialSyntheticPhone ? '' : formatPhoneForDisplay(initialRawPhone));
  const [businessPhoneNeedsRealEntry, setBusinessPhoneNeedsRealEntry] = useState(initialSyntheticPhone);
  const [hours, setHours] = useState<WizardHours>(() => initialShop ? apiHoursToWizard(initialShop.hours ?? {}) : defaultHours());
  const [hoursExpanded, setHoursExpanded] = useState(false);
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
  const [manualPrimaryPick, setManualPrimaryPick] = useState<Vertical | 'beauty_umbrella' | ''>('');
  const [beautySubtype, setBeautySubtype] = useState<BeautySubtype | ''>(initialBeautySubtype);
  const [verticalConfidence, setVerticalConfidence] = useState<VerticalConfidence>(initialVertical ? 'high' : 'none');
  const [profileTypeEditOpen, setProfileTypeEditOpen] = useState(false);
  const [profilePickPrimary, setProfilePickPrimary] = useState<Vertical | 'beauty_umbrella' | ''>('');
  const [profilePickSubtype, setProfilePickSubtype] = useState<BeautySubtype | ''>('');
  const [accordionOpen, setAccordionOpen] = useState<Record<string, boolean>>({
    profile: true,
    hours: false,
    languages: false,
  });
  const [testCallStatus, setTestCallStatus] = useState<string | null>(null);
  const importTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const importRequestRef = useRef(0);
  const [step4Phase, setStep4Phase] = useState<'try' | 'done'>('try');
  const prevStepRef = useRef<WizardStep>(1);

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

  function clearImportProgressTimers() {
    importTimersRef.current.forEach((timer) => clearTimeout(timer));
    importTimersRef.current = [];
  }

  function startImportProgressTimers() {
    clearImportProgressTimers();
    setImportProgress('Checking your link');
    setImportProgressStep(0);
    setImportDelayMessage(null);
    const checkpoints = [1200, 3000, 4800, 6500, 8500, 20000];
    importTimersRef.current = checkpoints.map((delay) =>
      setTimeout(() => {
        setImportProgressStep(importProgressStepIndex(delay));
        setImportProgress(IMPORT_PROGRESS_STEPS[importProgressStepIndex(delay)]);
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
            RingBooker will try to suggest details from your website. You’ll review and edit everything before saving.
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
        <div className="onb-import-progress-actions">
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
    const nextServices = catalogServices.length > 0 ? catalogServices : body.shop.services.length > 0 ? body.shop.services : [{ name: '', duration_min: 60, price: 0, group: 'General Services' }];
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
      setStatus(body?.error ?? 'Unable to save.');
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
      if (!isHttpsWebsiteUrl(trimmed)) {
        setStatus('Enter a valid https:// website URL or Google Maps link, leave blank, or use manual setup.');
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
            if (suggestions.businessProfile.name?.value && !businessName.trim()) setBusinessName(suggestions.businessProfile.name.value);
            if (suggestions.businessProfile.phone?.value && !businessPhone.trim()) setBusinessPhone(formatPhoneForDisplay(suggestions.businessProfile.phone.value));
            if (suggestions.businessProfile.address?.value && !address.trim()) setAddress(suggestions.businessProfile.address.value);
            if (suggestions.businessProfile.timezone?.value) setTimezone(suggestions.businessProfile.timezone.value);
            if (suggestions.hours?.value) setHours(apiHoursToWizard(suggestions.hours.value));
            const importedVertical = importedVerticalToApp(suggestions.businessProfile.primaryType?.value);
            if (importedVertical) {
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
    if (trimmed && isHttpsWebsiteUrl(trimmed)) {
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
      await finalizeManualStep1AndGoProfile('beauty_clinic', beautySubtype);
      setStatus(null);
      return;
    }
    await finalizeManualStep1AndGoProfile(manualPrimaryPick, '');
  }

  async function continueManualBeautySubtypeSelection() {
    if (!beautySubtype) {
      setStatus('Choose the option that best describes your business.');
      return;
    }
    await finalizeManualStep1AndGoProfile('beauty_clinic', beautySubtype);
  }

  async function continueProfileReview() {
    const errors = validateOnboardingProfileReview({ businessName });
    if (errors.length > 0) {
      setStatus(errors.join(' '));
      return;
    }
    if (!vertical || verticalConfidence !== 'high') {
      setStatus('Choose your business type so RingBooker can suggest the right services.');
      return;
    }
    if (vertical === 'beauty_clinic' && !beautySubtype) {
      setStatus('Choose your beauty specialty so we can tailor service suggestions.');
      return;
    }
    trackOnboarding('onboarding_profile_reviewed');
    const addr = address.trim();
    const profilePatch: Record<string, unknown> = {
      name: businessName,
      user_name: businessName,
      vertical,
      vertical_detail: vertical === 'beauty_clinic' && beautySubtype ? beautySubtype : null,
      hours: wizardHoursToApi(hours),
      timezone,
      languages: shopPlan === 'starter' ? ['en'] : applyVerticalLanguageSelection(vertical, languages),
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
    const patch: Record<string, unknown> = { current_onboarding_step: 4, services: nextServices };
    if (serviceCatalogEnabled) patch.service_catalog = serviceCatalogFromRows(nextServices, selectedServiceGroups);
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

  function applyPresetServices() {
    if (!vertical) return;
    const preset = getPresetServiceNames(vertical, beautySubtype);
    const existing = new Set(services.map((s) => s.name.trim().toLowerCase()).filter(Boolean));
    const toAdd = preset
      .filter((name) => !existing.has(name.toLowerCase()))
      .map((name) => ({ name, duration_min: 60, price: 0, group: suggestedGroupsForVertical(vertical, beautySubtype)[0] ?? 'General Services' }));
    if (toAdd.length === 0) {
      setStatus('Those preset services are already on your list.');
      return;
    }
    setServices([...services.filter((s) => s.name.trim().length > 0), ...toAdd]);
    setStatus(null);
  }

  function applySuggestedServiceGroups() {
    const groups = suggestedGroupsForVertical(vertical, beautySubtype);
    setSelectedServiceGroups((current) => [...new Set([...current, ...groups])]);
    setServices((current) => {
      const filled = current.filter((item) => item.name.trim().length > 0);
      if (filled.length === 0) return [{ name: '', duration_min: 60, price: 0, group: groups[0] ?? 'General Services' }];
      return filled.map((item, index) => ({ ...item, group: item.group || groups[index % groups.length] || 'General Services' }));
    });
    setStatus('Suggested service groups added. You can refine this later in Business Knowledge.');
  }

  function toggleServiceGroup(group: string) {
    setSelectedServiceGroups((current) =>
      current.includes(group) ? current.filter((item) => item !== group) : [...current, group],
    );
  }

  function toggleServiceGroupCollapsed(group: string) {
    setCollapsedServiceGroups((current) =>
      current.includes(group) ? current.filter((item) => item !== group) : [...current, group],
    );
  }

  function setServiceRow(index: number, value: ServiceItem) {
    setServices(services.map((item, itemIndex) => (itemIndex === index ? value : item)));
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
.onb-shell{max-width:1120px;margin:0 auto;padding:0;padding-bottom:110px;box-sizing:border-box}
.onb-card{background:transparent;border:none;box-shadow:none;border-radius:0;padding:32px 0;max-width:816px;margin:0 auto;width:100%}
.onb-card.wide{max-width:864px}
.onb-progress{display:flex;align-items:center;gap:14px;margin-bottom:32px}
.onb-back-inline{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:999px;background:#000;color:#fff;padding:8px 16px;font-size:14px;font-weight:500;cursor:pointer;white-space:nowrap;flex-shrink:0}.onb-back-inline:hover{background:#1a1a1a}.onb-back-inline.hidden{visibility:hidden}
.onb-progress-divider{display:none}
.onb-progress-main{display:flex;justify-content:center;flex:1;min-width:0}
.onb-progress-track{display:grid;grid-template-columns:44px minmax(48px,1fr) 44px minmax(48px,1fr) 44px minmax(48px,1fr) 44px;align-items:center;gap:10px;width:100%;max-width:760px}
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
.onb-field input,.onb-field select,.onb-field textarea,.hours-row select{min-height:40px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;line-height:1.5;background:#fff;color:#111827;width:100%;font-family:inherit;box-sizing:border-box}.onb-field textarea{min-height:72px;resize:vertical}
.onb-field input:focus,.onb-field select:focus,.onb-field textarea:focus,.hours-row select:focus{border-color:#7c3aed;outline:none;box-shadow:0 0 0 2px rgba(124,58,237,.15)}
.onb-help{font-size:13px;color:#64748b;margin:0}.onb-help-link{border:0;background:transparent;padding:8px 0;cursor:pointer;text-decoration:none;font-family:inherit;font-weight:400;line-height:1.5;text-align:inherit;transition:color .15s ease}.onb-help-link:hover{color:#334155;text-decoration:underline;text-underline-offset:2px}
.onb-import-panel{background:linear-gradient(180deg,#fbfaff 0%,#f7f4ff 52%,#f4f1ff 100%)!important;border:1px solid #e2e8f0;border-radius:14px;padding:16px}
.onb-import-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:end}
.onb-import-panel .onb-field{margin-bottom:0}.onb-import-panel .onb-help{margin-top:8px}
.onb-import-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;border:1px solid #000;border-radius:8px;background:#000;color:#fff;padding:8px 18px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;box-shadow:0 8px 18px rgba(0,0,0,.18)}
.onb-import-button:hover:not(:disabled){border-color:#1f1f1f;color:#fff;background:#1f1f1f;box-shadow:0 12px 24px rgba(0,0,0,.24)}.onb-import-button:disabled{opacity:.6;cursor:not-allowed}
.onb-import-progress{border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:16px;display:grid;gap:12px}
.onb-import-progress-title{margin:0;color:#111827;font-size:15px;font-weight:500}.onb-import-progress-sub{margin:0;color:#64748b;font-size:13px;line-height:1.5}
.onb-import-steps{display:grid;gap:8px;margin:2px 0}.onb-import-step{display:flex;align-items:center;gap:10px;color:#64748b;font-size:13px;font-weight:500}.onb-import-step.done{color:#166534}.onb-import-step.active{color:#111827}
.onb-import-step-mark{width:22px;height:22px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;color:#64748b}.onb-import-step.done .onb-import-step-mark{border-color:#86efac;background:#ecfdf5;color:#166534}.onb-import-step.active .onb-import-step-mark{border-color:#111827;color:#111827}
.onb-spinner{width:12px;height:12px;border:2px solid #d1d5db;border-top-color:#111827;border-radius:999px;animation:onbSpin .8s linear infinite}
.onb-import-delay{border-radius:10px;background:#fff7ed;color:#9a3412;padding:10px 12px;font-size:13px;line-height:1.45}.onb-import-progress-actions{display:flex;justify-content:flex-start}.onb-import-progress-actions .onb-help-link{color:#111827;text-decoration:underline;text-underline-offset:3px}
@keyframes onbSpin{to{transform:rotate(360deg)}}
.onb-manual-toggle-row{text-align:center;margin:-4px 0 2px}.onb-manual-toggle-row .onb-help-link{padding:0;color:#111827;text-decoration:underline;text-underline-offset:3px}
.onb-manual-panel{border-top:1px solid #e2e8f0;padding-top:18px}
.onb-compact-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
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
.profile-review-card.wide{grid-column:1 / -1}
.profile-review-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:4px}.profile-review-label{color:#64748b;font-size:14px;font-weight:600}.profile-review-edit{border:0;background:transparent;color:#2563eb;padding:0;font:inherit;font-size:14px;font-weight:600;cursor:pointer}.profile-review-edit:hover{text-decoration:underline;text-underline-offset:2px}
.profile-review-value{color:#111827;font-size:16px;font-weight:500;line-height:1.35;overflow-wrap:anywhere}.profile-review-editor{margin-top:10px}
.onb-note{display:flex;gap:8px;align-items:flex-start;border-radius:12px;background:#fff7ed;color:#9a3412;padding:12px 14px;font-size:13px;line-height:1.5}
.service-group-card{border:1px solid #e2e8f0;border-radius:14px;background:#fff;margin-top:14px;overflow:hidden}
.service-group-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:linear-gradient(180deg,#fbfaff 0%,#f7f4ff 52%,#f4f1ff 100%)!important;border-bottom:1px solid #e2e8f0}
.service-group-kicker{display:block;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}.service-group-title{margin:2px 0 0;color:#111827;font-size:15px;font-weight:500}
.service-group-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end}.service-collapse-btn{width:30px;height:30px;border-radius:999px;border:1px solid #d9deea;background:#fff;color:#5b21b6;font-size:18px;font-weight:600;line-height:1;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:none}.service-collapse-btn:hover{background:#faf5ff;border-color:#7c3aed}
.service-group-body{display:grid;gap:10px;padding:14px}
.service-item-row{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(100px,.65fr) minmax(100px,.65fr);gap:10px;align-items:center}
.service-item-row input{min-height:40px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;font-family:inherit;color:#111827;box-sizing:border-box;width:100%}
.service-empty{border:1px dashed #cbd5e1;border-radius:10px;padding:12px;color:#64748b;font-size:13px}
.onb-actions{display:flex;justify-content:space-between;gap:12px;margin-top:24px;align-items:center}
.onb-btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;border:0;border-radius:8px;background:#000;color:#fff;padding:10px 18px;font-size:15px;font-weight:600;box-shadow:0 8px 18px rgba(0,0,0,.18);cursor:pointer;text-decoration:none;transition:background .15s ease,transform .15s ease,box-shadow .15s ease}.onb-btn-primary:hover:not(:disabled){background:#1f1f1f;transform:translateY(-1px);box-shadow:0 12px 24px rgba(0,0,0,.24)}
.onb-btn-primary:disabled{opacity:.6;cursor:not-allowed}.onb-btn-secondary{display:inline-flex;align-items:center;justify-content:center;min-height:44px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;padding:10px 18px;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none}
.hours-list{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff}.hours-row{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff;border-bottom:1px solid #f1f5f9}.hours-row:last-child{border-bottom:0}.hours-row.closed{background:linear-gradient(180deg,#fbfaff 0%,#f7f4ff 52%,#f4f1ff 100%)!important}.hours-row.closed select{opacity:.4;background:#f8fafc!important}
.hours-day{font-weight:500;color:#111827;min-width:40px}.toggle-pill{position:relative;display:inline-flex;align-items:center;gap:8px;border:1px solid #dbe2ee;border-radius:999px;padding:8px 12px;background:#fff;font-weight:500;color:#64748b;cursor:pointer;box-shadow:none}.toggle-pill input{position:absolute;opacity:0;pointer-events:none}.toggle-dot{width:28px;height:16px;border-radius:999px;background:#cbd5e1;position:relative;transition:.18s ease;box-shadow:none}.toggle-dot:after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:none;transition:.18s ease}.toggle-pill.active{border-color:#8b5cf6;color:#5b21b6;background:transparent}.toggle-pill.active .toggle-dot{background:#7c3aed}.toggle-pill.active .toggle-dot:after{transform:translateX(12px)}
.lang-list{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}.lang-option{display:grid;gap:6px;justify-items:center;align-content:start}.lang-pill{min-width:72px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid #e2e8f0;border-radius:999px;padding:9px 14px;background:#fff;color:#374151;font-size:16px;font-weight:500;cursor:pointer;box-shadow:none}.lang-pill input{position:absolute;opacity:0;pointer-events:none}.lang-pill.selected{background:#faf5ff;border-color:#7c3aed;color:#111827;box-shadow:none}.lang-pill.required{background:#faf5ff;border-color:#7c3aed;color:#5b21b6;cursor:not-allowed}.lang-pill.locked{background:#f1f5f9!important;color:#64748b;cursor:not-allowed}.required-badge{display:block;color:#16a34a;background:transparent;padding:0;font-size:12px;font-weight:500;line-height:1.2}.plan-badge{display:block;color:#64748b;background:transparent!important;padding:0;font-size:12px;font-weight:500;line-height:1.2}.lang-badge-spacer{display:block;height:14px}.mini-badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;background:#dcfce7;color:#16a34a;padding:2px 8px;font-size:11px;font-weight:600}
.preset-row{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 14px}.preset-chip{border:1px solid #e2e8f0;border-radius:999px;background:#fff;padding:8px 14px;font-size:13px;font-weight:500;cursor:pointer;box-shadow:none;transition:border-color .15s ease,background .15s ease}.preset-chip:hover{border-color:#c4b5fd;background:#faf5ff}.preset-chip:focus-visible{outline:2px solid #7c3aed;outline-offset:2px}
.hours-summary{font-size:14px;color:#334155;line-height:1.5;margin:0 0 12px}
.acc{border:1px solid #e2e8f0;border-radius:12px;background:#fff;margin-bottom:10px;overflow:hidden}.acc-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border:0;background:#fff;font:inherit;font-weight:500;text-align:left;cursor:pointer}.acc-body{padding:0 16px 16px;border-top:1px solid #f1f5f9}
.test-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:20px}.test-card{border:1px solid #e2e8f0;border-radius:16px;padding:20px;background:#fff;display:flex;flex-direction:column;gap:10px;min-height:160px;box-shadow:none}.test-card h3{margin:0;font-size:17px}.test-card p{margin:0;font-size:14px;color:#64748b;line-height:1.55}
.manual-header{display:grid;grid-template-columns:minmax(120px,1fr) minmax(0,1.6fr) 72px 72px;gap:10px;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.service-row{display:grid;grid-template-columns:minmax(120px,1fr) minmax(0,1.6fr) 72px 72px;gap:10px;align-items:center;margin-bottom:10px}
.price-wrap,.duration-wrap{position:relative}.price-wrap span,.duration-wrap span{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#64748b;font-size:13px;font-weight:500;pointer-events:none}.price-wrap input{padding-left:28px!important}.duration-wrap input{padding-left:46px!important}
.add-service-btn{border:1.5px dashed #a78bfa;border-radius:10px;background:#fff;color:#6d28d9;padding:0 13px;font-weight:500;cursor:pointer;width:100%;height:44px}
.onb-status{margin-top:14px;padding:12px 14px;border-radius:16px;background:linear-gradient(180deg,#fbfaff 0%,#f7f4ff 52%,#f4f1ff 100%)!important;color:#475569;font-size:14px}
.read-success{color:#047857;font-weight:600}
.onb-sticky-cta{position:fixed;left:0;right:0;bottom:0;z-index:50;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);border-top:1px solid #e2e8f0;backdrop-filter:blur(10px);display:flex;flex-direction:column;gap:10px;align-items:stretch}
.onb-sticky-cta .onb-btn-primary,.onb-sticky-cta .onb-btn-secondary{width:100%;justify-content:center}
@media(min-width:641px){.onb-sticky-cta{display:none}}
@media(max-width:640px){.onb-shell{padding-bottom:120px}.onb-card{padding:16px 0;max-width:none}.onb-progress{gap:10px}.onb-progress-track{grid-template-columns:30px minmax(20px,1fr) 30px minmax(20px,1fr) 30px minmax(20px,1fr) 30px;gap:6px}.onb-progress-node{width:28px;height:28px;font-size:13px}.onb-grid,.onb-compact-grid,.profile-review-grid{grid-template-columns:1fr}.onb-import-row{grid-template-columns:1fr}.onb-import-button{width:100%}.test-grid{grid-template-columns:1fr}.manual-header{display:none}.service-row,.service-item-row{grid-template-columns:1fr}.service-row select{grid-column:1 / -1}.onb-actions:not(.onb-actions-desktop){display:none}}
@media(max-width:640px){.hours-row{display:grid;grid-template-columns:1fr 1fr}}
`,
    ],
    [],
  );

  if (loading) {
    return (
      <UserLayout styles={mergedStyles} scripts={userSettingsScripts} scriptPrefix="user-onboarding-live">
        <main className="main">
          <section className="onb-shell">
            <div className="onb-card">
              <p>Loading onboarding...</p>
            </div>
          </section>
        </main>
      </UserLayout>
    );
  }

  const webDemoHref = verticalToWebDemoPath(vertical);
  function renderAccordionSection(id: string, title: string, body: ReactNode) {
    const open = accordionOpen[id] ?? false;
    return (
      <div className="acc">
        <button type="button" className="acc-btn" onClick={() => setAccordionOpen({ ...accordionOpen, [id]: !open })} aria-expanded={open}>
          <span>{title}</span>
          <span aria-hidden>{open ? '−' : '+'}</span>
        </button>
        {open ? <div className="acc-body">{body}</div> : null}
      </div>
    );
  }

  function renderStep1() {
    if (step1View === 'manual_vertical') {
      return (
        <div>
          <h1 className="onb-title">What type of business are you?</h1>
          <p className="onb-subtitle">This helps RingBooker suggest the right services and tone.</p>
          <div className="onb-grid" style={{ marginTop: 24 }}>
            {MANUAL_PRIMARY_VERTICAL.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`choice-card ${manualPrimaryPick === item.id ? 'active' : ''}`}
                onClick={() => setManualPrimaryPick(item.id)}
              >
                <span className="emoji">{item.emoji}</span>
                <h4>{item.label}</h4>
              </button>
            ))}
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
          Paste your website or Google Maps link — we'll fill in the details.
        </p>
        <div className="onb-stack" style={{ marginTop: 24 }}>
          {!manualEntryOpen ? (
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
                <button className="onb-import-button" type="button" onClick={() => void saveQuickContinue()} disabled={saving || websiteLoading}>
                  ✧ {websiteLoading ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>
          ) : null}
          {websiteLoading ? renderImportProgressCard() : null}
          {!websiteLoading ? (
          <div className="onb-manual-toggle-row">
            <button
              type="button"
              className="onb-help-link"
              onClick={() => {
                if (manualEntryOpen) {
                  setManualEntryOpen(false);
                  setStatus(null);
                } else {
                  enterManualSetup();
                }
              }}
            >
              {manualEntryOpen ? 'Hide manual form ↑' : 'No website? Fill in manually'}
            </button>
          </div>
          ) : null}
          {manualEntryOpen ? (
            <div className="onb-manual-panel">
              <div className="onb-field">
                <label>Business name</label>
                <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="e.g. Glamour Hair Studio" />
              </div>
              <div className="onb-field">
                <label>What best describes your business?</label>
                <div className="onb-grid onb-compact-grid">
                  {MANUAL_PRIMARY_VERTICAL.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`choice-card compact ${manualPrimaryPick === item.id ? 'active' : ''}`}
                      onClick={() => {
                        setManualPrimaryPick(item.id);
                        if (item.id !== 'beauty_umbrella') setBeautySubtype('');
                      }}
                    >
                      <span className="emoji">{item.emoji}</span>
                      <h4>{item.label}</h4>
                    </button>
                  ))}
                </div>
              </div>
              {manualPrimaryPick === 'beauty_umbrella' ? (
                <div className="onb-field">
                  <label>Beauty specialty</label>
                  <div className="preset-row">
                    {BEAUTY_SUBTYPE_OPTIONS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`preset-chip ${beautySubtype === item.id ? 'active' : ''}`}
                        onClick={() => setBeautySubtype(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <p className="onb-section-title">Also offer any of these?</p>
                <p className="onb-help" style={{ marginTop: 4 }}>
                  Select all that apply. Many businesses offer services across categories.
                </p>
                <div className="preset-row" style={{ marginTop: 10 }}>
                  {MIXED_SERVICE_GROUPS.map((group) => (
                    <button
                      key={group}
                      type="button"
                      className={`preset-chip mixed-chip ${selectedServiceGroups.includes(group) ? 'active' : ''}`}
                      onClick={() => toggleServiceGroup(group)}
                    >
                      <span className="chip-icon">{MIXED_SERVICE_GROUP_ICONS[group]}</span>
                      {group}
                    </button>
                  ))}
                </div>
              </div>
              <div className="onb-field">
                <label>Phone number <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(optional)</span></label>
                <input
                  type="tel"
                  value={businessPhone}
                  onChange={(event) => {
                    setBusinessPhone(event.target.value);
                    setBusinessPhoneNeedsRealEntry(false);
                  }}
                  placeholder="(555) 123-4567"
                />
                <p className="onb-help">
                  {businessPhoneNeedsRealEntry
                    ? 'You can add the main business line now or review it later in Profile.'
                    : 'This is the number clients call today. You are not changing it here.'}
                </p>
              </div>
            </div>
          ) : null}
        </div>
        {manualEntryOpen ? (
          <div className="onb-actions onb-actions-desktop">
            <span />
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
            className="onb-btn-secondary"
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
    const selectedTimezoneMeta = countryTimezones?.timezones.find((zone) => zone.value === timezone) ?? countryTimezones?.timezones[0];

    const resolvedVerticalLabel =
      vertical === 'beauty_clinic' && beautySubtype
        ? `${VERTICAL_LABELS.beauty_clinic} · ${BEAUTY_SUBTYPE_LABELS[beautySubtype]}`
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

    const profileCard = (
      field: Exclude<ProfileEditField, null>,
      label: string,
      value: string,
      editor: ReactNode,
      options: { wide?: boolean; imported?: { value?: unknown; confidence?: number; source?: string | null } | null } = {},
    ) => {
      const editing = profileEditField === field;
      const hasUserValue = value.trim().length > 0;
      const showImportState = websiteImportAttempted && options.imported && (!userEditedProfileFields.includes(field) || !hasUserValue);
      return (
        <div className={`profile-review-card ${options.wide ? 'wide' : ''}`}>
          <div className="profile-review-top">
            <span className="profile-review-label">{label}</span>
            <button type="button" className="profile-review-edit" onClick={() => setProfileEditField(editing ? null : field)}>
              {editing ? 'done' : 'edit'}
            </button>
          </div>
          {editing ? <div className="profile-review-editor">{editor}</div> : <div className="profile-review-value">{value || 'Missing'}</div>}
          {showImportState ? importFieldState(options.imported) : null}
        </div>
      );
    };
    const markProfileFieldEdited = (field: Exclude<ProfileEditField, null>) => {
      setUserEditedProfileFields((fields) => (fields.includes(field) ? fields : [...fields, field]));
    };

    return (
      <div>
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
                We also found staff, policies, FAQs, promotions, or booking setup hints you can review later in Business Knowledge.
              </p>
            ) : null}
          </div>
        ) : null}
        {importSource === 'manual' ? (
          <p className="onb-help" style={{ margin: '14px 0' }}>
            No website link saved — you can add one later from the dashboard.
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
              placeholder="https://yourbusiness.com"
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
          <span>Hours and contact are what callers ask most. Fix them now for the best test.</span>
        </div>

        {renderAccordionSection(
          'languages',
          shopPlan === 'starter' ? 'Languages noted for setup' : 'Languages',
          <div>
            <p className="onb-subtitle" style={{ marginTop: 0 }}>
              {shopPlan === 'starter'
                ? 'Stored for your team and onboarding notes. Starter keeps live dialogue in English unless your plan enables bilingual workflows.'
                : 'Beyond English, RingBooker can respond in the languages you enable here during live calls.'}
            </p>
            <div className="lang-list">
              <div className="lang-option">
                <label className="lang-pill required">
                  <input type="checkbox" checked disabled /> EN ✓
                </label>
                <span className="required-badge">Required</span>
              </div>
              {shopPlan === 'starter' ? (
                <>
                  <div className="lang-option">
                    <label className="lang-pill locked">
                      <input type="checkbox" checked={false} disabled /> VI
                    </label>
                    <span className="plan-badge">Pro + Enterprise</span>
                  </div>
                  <div className="lang-option">
                    <label className="lang-pill locked">
                      <input type="checkbox" checked={false} disabled /> ES
                    </label>
                    <span className="plan-badge">Pro + Enterprise</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="lang-option">
                    <label className={`lang-pill ${languages.includes('vi') ? 'selected' : ''}`}>
                      <input type="checkbox" checked={languages.includes('vi')} onChange={(event) => setLanguages(toggleLanguage(languages, 'vi', event.target.checked))} />
                      VI {languages.includes('vi') ? '✓' : ''}
                    </label>
                    <span className="lang-badge-spacer" aria-hidden="true" />
                  </div>
                  {vertical === 'nail_salon' ? <span className="mini-badge">✓ Auto-selected for nail salons</span> : null}
                  <div className="lang-option">
                    <label className={`lang-pill ${languages.includes('es') ? 'selected' : ''}`}>
                      <input type="checkbox" checked={languages.includes('es')} onChange={(event) => setLanguages(toggleLanguage(languages, 'es', event.target.checked))} />
                      ES {languages.includes('es') ? '✓' : ''}
                    </label>
                    <span className="lang-badge-spacer" aria-hidden="true" />
                  </div>
                </>
              )}
            </div>
          </div>,
        )}

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
    );
  }

  function renderStep3() {
    const presetLabel =
      vertical === 'beauty_clinic' && beautySubtype ? BEAUTY_SUBTYPE_LABELS[beautySubtype] : vertical ? VERTICAL_LABELS[vertical] : 'industry';
    const groupNames = [
      ...new Set([
        ...selectedServiceGroups,
        ...services.map((service) => service.group || 'General Services'),
        services.length === 0 ? 'General Services' : '',
      ].filter(Boolean)),
    ];
    const groupedServices = groupNames.map((group) => ({
      group,
      items: services.map((service, index) => ({ service, index })).filter(({ service }) => (service.group || 'General Services') === group),
    }));

    return (
      <div>
        <h1 className="onb-title">Add a few services <span style={{ color: '#64748b', fontSize: '1rem', fontWeight: 500 }}>optional</span></h1>
        <p className="onb-subtitle">
          So AI can answer pricing questions. You can skip this and add everything later in Business Knowledge.
        </p>
        {servicesFound > 0 ? (
          <p className="onb-service-import-badge">✓ {servicesFound} {servicesFound === 1 ? 'service' : 'services'} imported from your website — review below</p>
        ) : websiteImportAttempted && (importSource === 'website' || importSource === 'google_business') ? (
          <p className="onb-help">
            {WEBSITE_IMPORT_EXTRACTION_ACTIVE
              ? 'Review imported services below, or add your own.'
              : 'Automated service extraction is rolling out. Use presets for your vertical or add services manually.'}
          </p>
        ) : null}
        {(vertical === 'med_spa' || vertical === 'beauty_clinic') && (
          <p className="onb-help" style={{ marginTop: 12 }}>
            RingBooker can capture consultation requests and follow-up details. Your licensed team confirms treatment recommendations.
          </p>
        )}
        <div className="preset-row">
          <button type="button" className="preset-chip" onClick={applyPresetServices} disabled={!vertical || (vertical === 'beauty_clinic' && !beautySubtype)}>
            Add {presetLabel} presets
          </button>
          <button type="button" className="preset-chip" onClick={applySuggestedServiceGroups} disabled={!vertical}>
            Group services
          </button>
        </div>
        <div style={{ marginTop: 18 }}>
          <p className="onb-section-title">Also offers</p>
          <p className="onb-help" style={{ marginTop: 4 }}>
            Select all that apply. Many businesses offer services across categories, and you can edit this later.
          </p>
          <div className="preset-row" style={{ marginTop: 10 }}>
            {MIXED_SERVICE_GROUPS.map((group) => (
              <button
                key={group}
                type="button"
                className={`preset-chip mixed-chip ${selectedServiceGroups.includes(group) ? 'active' : ''}`}
                onClick={() => toggleServiceGroup(group)}
              >
                <span className="chip-icon">{MIXED_SERVICE_GROUP_ICONS[group]}</span>
                {group}
              </button>
            ))}
          </div>
        </div>
        {groupedServices.map(({ group, items }) => {
          const collapsed = collapsedServiceGroups.includes(group);
          return (
          <div className="service-group-card" key={group}>
            <div className="service-group-head">
              <div>
                <span className="service-group-kicker">Service group</span>
                <h3 className="service-group-title">{group}</h3>
              </div>
              <div className="service-group-actions">
                <button
                  className="service-collapse-btn"
                  type="button"
                  onClick={() => toggleServiceGroupCollapsed(group)}
                  aria-expanded={!collapsed}
                  aria-label={`${collapsed ? 'Show' : 'Hide'} services in ${group}`}
                >
                  {collapsed ? '+' : '-'}
                </button>
                <button className="onb-help-link" type="button" onClick={() => setServices([...services, { name: '', duration_min: 60, price: 0, group }])}>
                  + Add service
                </button>
              </div>
            </div>
            {!collapsed ? <div className="service-group-body">
              {items.length === 0 ? (
                <div className="service-empty">No services in this group yet. Add one callers usually ask about.</div>
              ) : null}
              {items.map(({ service, index }) => (
                <div className="service-item-row" key={index}>
                  <input
                    value={service.name}
                    onChange={(event) => setServiceRow(index, { ...service, name: event.target.value })}
                    placeholder="Service name"
                  />
                  <div className="price-wrap">
                    <span>$</span>
                    <input
                      type="number"
                      value={service.price}
                      onChange={(event) => setServiceRow(index, { ...service, price: Number(event.target.value) })}
                      placeholder="Price"
                    />
                  </div>
                  <div className="duration-wrap">
                    <span>Min</span>
                    <input
                      type="number"
                      min={1}
                      value={service.duration_min || ''}
                      placeholder="60"
                      onChange={(event) =>
                        setServiceRow(index, { ...service, duration_min: event.target.value === '' ? 0 : Number(event.target.value) })
                      }
                    />
                  </div>
                </div>
              ))}
            </div> : null}
          </div>
          );
        })}
        <button className="add-service-btn" type="button" onClick={() => setServices([...services, { name: '', duration_min: 60, price: 0, group: groupNames[0] ?? 'General Services' }])}>
          + Add service
        </button>
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
          <button className="onb-btn-secondary" type="button" onClick={() => void continueServices()} disabled={saving}>
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
                  className="onb-btn-primary"
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
                <button className="onb-btn-primary" style={{ marginTop: 'auto', alignSelf: 'flex-start' }} type="button" onClick={() => void requestTestCall()}>
                  Call me now
                </button>
                {testCallStatus ? <p className="onb-help">{testCallStatus}</p> : null}
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
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
      <main className="main">
        <section className="onb-shell">
          <div className={`onb-card ${currentStep === 4 ? 'wide' : ''}`}>
            <Progress currentStep={currentStep} step1View={step1View} onBack={() => void handleBack()} />
            {currentStep === 1 ? renderStep1() : null}
            {currentStep === 2 ? renderStep2() : null}
            {currentStep === 3 ? renderStep3() : null}
            {currentStep === 4 ? renderStep4() : null}
            {status ? <div className="onb-status">{status}</div> : null}
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
