'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

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
type ServiceItem = { name: string; duration_min: number; price: number };
type ApiHours = Record<string, { closed: true } | { open: string; close: string }>;
type WizardHours = Record<string, { open: boolean; from: string; to: string }>;
type ImportSource = 'none' | 'website' | 'google_business' | 'manual';

type OnboardingStatusResponse = {
  ok: boolean;
  onboardingRequired?: boolean;
  onboardingCompleted?: boolean;
  liveCallsEnabled?: boolean;
  forwardingSetupVerified?: boolean;
  paymentMethodStatus?: 'none' | 'pending' | 'valid' | 'failed' | 'unknown';
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
type VerticalConfidence = 'high' | 'low' | 'none';

const MANUAL_PRIMARY_VERTICAL: Array<{ id: Vertical | 'beauty_umbrella'; emoji: string; label: string }> = [
  { id: 'nail_salon', emoji: '💅', label: 'Nail Salon' },
  { id: 'hair_salon', emoji: '✂️', label: 'Hair Salon' },
  { id: 'day_spa', emoji: '🧖', label: 'Day Spa' },
  { id: 'med_spa', emoji: '💉', label: 'Med Spa' },
  { id: 'beauty_umbrella', emoji: '✨', label: 'Beauty Clinic / Aesthetic / Wax / Lash' },
];

const BEAUTY_SUBTYPE_OPTIONS: Array<{ id: BeautySubtype; label: string }> = [
  { id: 'beauty_clinic', label: 'Beauty clinic' },
  { id: 'aesthetic_clinic', label: 'Aesthetic clinic' },
  { id: 'wax_studio', label: 'Wax studio' },
  { id: 'lash_studio', label: 'Lash studio' },
  { id: 'brow_studio', label: 'Brow studio' },
  { id: 'other_beauty', label: 'Other beauty service' },
];

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

/** Step 1 quick path (website/GBP optional): business phone required; business type inferred or chosen later. */
export function validateOnboardingStep1Quick(input: { businessPhone: string }): string[] {
  const errors: string[] = [];
  if (!input.businessPhone.trim()) errors.push('Business phone number is required.');
  return errors;
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
    }));
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

export function UserOnboardingLive() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [shopId, setShopId] = useState('');
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [vertical, setVertical] = useState<Vertical | ''>('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessPhoneNeedsRealEntry, setBusinessPhoneNeedsRealEntry] = useState(false);
  const [hours, setHours] = useState<WizardHours>(() => defaultHours());
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [languages, setLanguages] = useState<string[]>(['en']);
  const [shopPlan, setShopPlan] = useState<ShopPlan>('starter');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [websiteLoading, setWebsiteLoading] = useState(false);
  const [websiteImportAttempted, setWebsiteImportAttempted] = useState(false);
  const [servicesFound, setServicesFound] = useState(0);
  const [services, setServices] = useState<ServiceItem[]>([{ name: '', duration_min: 60, price: 0 }]);
  const [importSource, setImportSource] = useState<ImportSource>('none');
  const [step1View, setStep1View] = useState<Step1View>('quick');
  const [manualPrimaryPick, setManualPrimaryPick] = useState<Vertical | 'beauty_umbrella' | ''>('');
  const [beautySubtype, setBeautySubtype] = useState<BeautySubtype | ''>('');
  const [verticalConfidence, setVerticalConfidence] = useState<VerticalConfidence>('none');
  const [profileTypeEditOpen, setProfileTypeEditOpen] = useState(false);
  const [profilePickPrimary, setProfilePickPrimary] = useState<Vertical | 'beauty_umbrella' | ''>('');
  const [profilePickSubtype, setProfilePickSubtype] = useState<BeautySubtype | ''>('');
  const [accordionOpen, setAccordionOpen] = useState<Record<string, boolean>>({
    profile: true,
    hours: false,
    languages: false,
  });
  const [testCallStatus, setTestCallStatus] = useState<string | null>(null);
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
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const match = findCountryForTimezone(detected);
    if (match) {
      setSelectedCountry(match.country);
      setTimezone(detected);
    }
  }, []);

  useEffect(() => {
    void loadOnboarding();
  }, []);

  useEffect(() => {
    trackOnboarding('onboarding_start');
  }, []);

  useEffect(() => {
    if (vertical === 'nail_salon') {
      setLanguages((current) => applyVerticalLanguageSelection(vertical, current));
    }
  }, [vertical]);

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
    setServices(body.shop.services.length > 0 ? body.shop.services : [{ name: '', duration_min: 60, price: 0 }]);
    setCurrentStep(normalizeStep(body.shop.current_onboarding_step));
    setShopPlan(body.shop.plan ?? 'starter');
    if (normalizeStep(body.shop.current_onboarding_step) === 1) {
      setStep1View('quick');
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

    trackOnboarding('business_import_started', { mode: 'quick' });
    setStatus(null);

    const trimmed = websiteUrl.trim();
    let inferred = inferBusinessFromUrl(trimmed);
    let nextVertical = inferred.vertical;
    let nextSubtype = inferred.beautySubtype;
    let nextConfidence = inferred.confidence;

    if (trimmed) {
      if (!isHttpsWebsiteUrl(trimmed)) {
        setStatus('Enter a valid https:// website URL or Google Maps link, leave blank, or use manual setup.');
        return;
      }
      const canonicalUrl = normalizeWebsiteUrl(trimmed);
      setWebsiteLoading(true);
      try {
        const response = await fetch('/api/backend/user/read-website', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: canonicalUrl }),
        });
        const body = (await response.json().catch(() => null)) as { ok?: boolean; servicesFound?: number } | null;
        setWebsiteImportAttempted(true);
        if (response.ok && body?.ok) {
          setServicesFound(body.servicesFound ?? 0);
          trackOnboarding('business_import_success', { servicesFound: body.servicesFound ?? 0 });
        } else {
          trackOnboarding('business_import_failed', { reason: 'read_website' });
        }
      } catch {
        trackOnboarding('business_import_failed', { reason: 'network' });
        setWebsiteImportAttempted(true);
      }
      setWebsiteLoading(false);
      setWebsiteUrl(canonicalUrl);
      setImportSource(isProbablyGoogleBusinessUrl(trimmed) ? 'google_business' : 'website');
      inferred = inferBusinessFromUrl(canonicalUrl);
      nextVertical = inferred.vertical;
      nextSubtype = inferred.beautySubtype;
      nextConfidence = inferred.confidence;
    } else {
      setImportSource('none');
      setWebsiteImportAttempted(false);
      nextVertical = '';
      nextSubtype = '';
      nextConfidence = 'none';
    }

    setVertical(nextVertical);
    setBeautySubtype(nextVertical === 'beauty_clinic' ? nextSubtype : '');
    setVerticalConfidence(nextConfidence);

    const patch: Record<string, unknown> = {
      phone_number: businessPhone,
      user_phone: businessPhone,
      current_onboarding_step: 2,
    };
    if (trimmed) patch.website_url = normalizeWebsiteUrl(trimmed);
    if (nextVertical) {
      patch.vertical = nextVertical;
      patch.vertical_detail = nextVertical === 'beauty_clinic' && nextSubtype ? nextSubtype : null;
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
    const errors = validateOnboardingStep1Quick({ businessPhone });
    if (errors.length > 0) {
      setStatus(errors.join(' '));
      return;
    }
    trackOnboarding('business_import_started', { mode: 'manual_wizard' });
    setImportSource('manual');
    setVerticalConfidence('none');
    setVertical('');
    setBeautySubtype('');
    setManualPrimaryPick('');
    setStep1View('manual_vertical');
    setStatus(null);
  }

  async function finalizeManualStep1AndGoProfile(v: Vertical, subtype: BeautySubtype | '') {
    const patch: Record<string, unknown> = {
      phone_number: businessPhone,
      user_phone: businessPhone,
      vertical: v,
      vertical_detail: v === 'beauty_clinic' && subtype ? subtype : null,
      current_onboarding_step: 2,
    };

    const trimmed = websiteUrl.trim();
    if (trimmed && isHttpsWebsiteUrl(trimmed)) {
      const canonicalUrl = normalizeWebsiteUrl(trimmed);
      setWebsiteLoading(true);
      try {
        await fetch('/api/backend/user/read-website', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: canonicalUrl }),
        });
      } catch {
        // ignore — settings PUT still persists URL
      }
      setWebsiteLoading(false);
      setWebsiteImportAttempted(true);
      patch.website_url = canonicalUrl;
      setWebsiteUrl(canonicalUrl);
      setImportSource(isProbablyGoogleBusinessUrl(trimmed) ? 'google_business' : 'website');
    }

    setVertical(v);
    setBeautySubtype(v === 'beauty_clinic' ? subtype : '');
    setVerticalConfidence('high');

    const ok = await saveSettings(patch);
    if (ok) {
      setCurrentStep(2);
      setStep1View('quick');
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
      setStep1View('manual_beauty_subtype');
      setBeautySubtype('');
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

  function applyProfileBusinessType() {
    if (!profilePickPrimary) {
      setStatus('Choose a business type.');
      return;
    }
    if (profilePickPrimary === 'beauty_umbrella') {
      if (!profilePickSubtype) {
        setStatus('Choose the option that best describes your business.');
        return;
      }
      setVertical('beauty_clinic');
      setBeautySubtype(profilePickSubtype);
      setVerticalConfidence('high');
      setProfileTypeEditOpen(false);
      setStatus(null);
      return;
    }
    setVertical(profilePickPrimary);
    setBeautySubtype('');
    setVerticalConfidence('high');
    setProfileTypeEditOpen(false);
    setStatus(null);
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
    const ok = await saveSettings({
      name: businessName,
      user_name: businessName,
      phone_number: businessPhone,
      user_phone: businessPhone,
      vertical,
      vertical_detail: vertical === 'beauty_clinic' && beautySubtype ? beautySubtype : null,
      hours: wizardHoursToApi(hours),
      timezone,
      languages: applyVerticalLanguageSelection(vertical, languages),
      ...(addr ? { address: addr } : { address: null }),
      current_onboarding_step: 3,
    });
    if (ok) setCurrentStep(3);
  }

  async function continueServices() {
    const nextServices = cleanServices(services);
    if (nextServices.length === 0) {
      setStatus('Add at least one service so RingBooker can answer pricing questions.');
      return;
    }
    trackOnboarding('onboarding_services_reviewed');
    const patch: Record<string, unknown> = { current_onboarding_step: 4, services: nextServices };
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
      .map((name) => ({ name, duration_min: 60, price: 0 }));
    if (toAdd.length === 0) {
      setStatus('Those preset services are already on your list.');
      return;
    }
    setServices([...services.filter((s) => s.name.trim().length > 0), ...toAdd]);
    setStatus(null);
  }

  function setServiceRow(index: number, value: ServiceItem) {
    setServices(services.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  async function handleBack() {
    if (currentStep === 1) {
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
.onb-shell{max-width:1120px;margin:0 auto;padding:18px;padding-bottom:110px;box-sizing:border-box}
.onb-card{background:transparent;border:none;box-shadow:none;border-radius:0;padding:32px;max-width:680px;margin:0 auto;width:100%}
.onb-card.wide{max-width:720px}
.onb-progress{display:flex;align-items:center;gap:16px;margin-bottom:32px}
.onb-back-inline{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:999px;background:#000;color:#fff;padding:8px 16px;font-size:14px;font-weight:500;cursor:pointer;white-space:nowrap;flex-shrink:0}.onb-back-inline:hover{background:#1a1a1a}.onb-back-inline.hidden{visibility:hidden}
.onb-progress-divider{width:1px;height:24px;background:#e2e8f0;flex-shrink:0}
.onb-progress-main{display:flex;justify-content:flex-end;flex:1;min-width:0}
.onb-progress-pills{display:flex;justify-content:flex-end;gap:8px;flex-wrap:nowrap;flex-shrink:0;min-width:0;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
.onb-progress-pill{display:flex;align-items:center;justify-content:center;gap:7px;border:1px solid #d9deea;border-radius:999px;padding:6px 14px;color:#64748b;background:#fff;font-size:13px;font-weight:800;white-space:nowrap;flex-shrink:0;min-width:auto;box-shadow:none}
.onb-progress-pill.done{background:transparent;border-color:#8b5cf6;color:#5b21b6;box-shadow:none}
.onb-progress-pill.current{background:#6d28d9;border-color:#6d28d9;color:#fff;box-shadow:none}
.onb-progress-mark{width:auto;min-width:1em;height:auto;border-radius:0;display:inline-flex;align-items:center;justify-content:center;background:transparent!important;color:inherit;box-shadow:none!important;border:0;font-size:13px;line-height:1}
.onb-title{margin:0;color:#020617;font-size:1.5rem;line-height:1.3;letter-spacing:-.02em;font-weight:500}
.onb-subtitle{margin:8px 0 10px;color:var(--text-gray);font-size:14px;line-height:1.6;max-width:760px;font-weight:400}
.onb-section-title{display:block;margin:0 0 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em}
.onb-source-badge{display:inline-flex;align-items:center;border-radius:999px;background:#eef2ff;color:#4338ca;padding:3px 10px;font-size:11px;font-weight:700;margin-left:8px}
.onb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.onb-stack{display:grid;gap:18px}
.choice-card{min-height:100px;border:1.5px solid #e2e8f0;border-radius:12px;padding:20px;background:#fff;text-align:left;cursor:pointer;transition:.18s ease;box-shadow:none}
.choice-card:hover{background:#faf5ff;border-color:#e2e8f0;box-shadow:none}
.choice-card.active{background:#faf5ff;border-color:#7c3aed;border-width:1.5px;box-shadow:none}
.choice-card .emoji{font-size:2rem;line-height:1}.choice-card h4{margin:12px 0 0;font-size:15px;font-weight:800;color:#111827}
.onb-field{display:grid;gap:6px;margin-bottom:20px}.onb-field label{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
.onb-field input,.onb-field select,.onb-field textarea,.hours-row select{min-height:40px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;line-height:1.5;background:#fff;color:#111827;width:100%;font-family:inherit;box-sizing:border-box}.onb-field textarea{min-height:72px;resize:vertical}
.onb-field input:focus,.onb-field select:focus,.onb-field textarea:focus,.hours-row select:focus{border-color:#7c3aed;outline:none;box-shadow:0 0 0 2px rgba(124,58,237,.15)}
.onb-help{font-size:13px;color:#64748b;margin:0}.onb-help-link{border:0;background:transparent;padding:8px 0;cursor:pointer;text-decoration:none;font-family:inherit;font-weight:400;line-height:1.5;text-align:inherit;transition:color .15s ease}.onb-help-link:hover{color:#334155;text-decoration:underline;text-underline-offset:2px}
.onb-actions{display:flex;justify-content:space-between;gap:12px;margin-top:24px;align-items:center}
.onb-btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;border:0;border-radius:8px;background:#000;color:#fff;padding:10px 18px;font-size:15px;font-weight:600;box-shadow:0 8px 18px rgba(0,0,0,.18);cursor:pointer;text-decoration:none;transition:background .15s ease,transform .15s ease,box-shadow .15s ease}.onb-btn-primary:hover:not(:disabled){background:#1f1f1f;transform:translateY(-1px);box-shadow:0 12px 24px rgba(0,0,0,.24)}
.onb-btn-primary:disabled{opacity:.6;cursor:not-allowed}.onb-btn-secondary{display:inline-flex;align-items:center;justify-content:center;min-height:44px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;padding:10px 18px;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none}
.hours-list{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff}.hours-row{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff;border-bottom:1px solid #f1f5f9}.hours-row:last-child{border-bottom:0}.hours-row.closed{background:#f9fafb}.hours-row.closed select{opacity:.4;background:#f1f5f9}
.hours-day{font-weight:900;color:#111827;min-width:40px}.toggle-pill{position:relative;display:inline-flex;align-items:center;gap:8px;border:1px solid #dbe2ee;border-radius:999px;padding:8px 12px;background:#fff;font-weight:800;color:#64748b;cursor:pointer;box-shadow:none}.toggle-pill input{position:absolute;opacity:0;pointer-events:none}.toggle-dot{width:28px;height:16px;border-radius:999px;background:#cbd5e1;position:relative;transition:.18s ease;box-shadow:none}.toggle-dot:after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:none;transition:.18s ease}.toggle-pill.active{border-color:#8b5cf6;color:#5b21b6;background:transparent}.toggle-pill.active .toggle-dot{background:#7c3aed}.toggle-pill.active .toggle-dot:after{transform:translateX(12px)}
.lang-list{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.lang-pill{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1.5px solid #e2e8f0;border-radius:999px;padding:10px 15px;background:#fff;color:#374151;font-weight:900;cursor:pointer;box-shadow:none}.lang-pill input{position:absolute;opacity:0;pointer-events:none}.lang-pill.selected{background:#7c3aed;border-color:#7c3aed;color:#fff;box-shadow:none}.lang-pill.locked{background:#f1f5f9;color:#9ca3af;cursor:not-allowed;flex-direction:column;gap:2px}.required-badge{border-radius:999px;background:transparent;color:#9ca3af;padding:0;font-size:10px;font-weight:800}.mini-badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;background:#dcfce7;color:#16a34a;padding:2px 8px;font-size:11px;font-weight:900}
.preset-row{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 14px}.preset-chip{border:1px solid #e2e8f0;border-radius:999px;background:#fff;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:none;transition:border-color .15s ease,background .15s ease}.preset-chip:hover{border-color:#c4b5fd;background:#faf5ff}.preset-chip:focus-visible{outline:2px solid #7c3aed;outline-offset:2px}
.hours-summary{font-size:14px;color:#334155;line-height:1.5;margin:0 0 12px}
.acc{border:1px solid #e2e8f0;border-radius:12px;background:#fff;margin-bottom:10px;overflow:hidden}.acc-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border:0;background:#fff;font:inherit;font-weight:800;text-align:left;cursor:pointer}.acc-body{padding:0 16px 16px;border-top:1px solid #f1f5f9}
.test-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:20px}.test-card{border:1px solid #e2e8f0;border-radius:16px;padding:20px;background:#fff;display:flex;flex-direction:column;gap:10px;min-height:160px;box-shadow:none}.test-card h3{margin:0;font-size:17px}.test-card p{margin:0;font-size:14px;color:#64748b;line-height:1.55}
.manual-header{display:grid;grid-template-columns:minmax(0,2fr) 72px 72px;gap:10px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
.service-row{display:grid;grid-template-columns:minmax(0,2fr) 72px 72px;gap:10px;align-items:center;margin-bottom:10px}
.price-wrap{position:relative}.price-wrap span{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#64748b}.price-wrap input{padding-left:28px!important}
.add-service-btn{border:1.5px dashed #a78bfa;border-radius:10px;background:#fff;color:#6d28d9;padding:0 13px;font-weight:900;cursor:pointer;width:100%;height:44px}
.onb-status{margin-top:14px;padding:12px 14px;border-radius:16px;background:#f8fafc;color:#475569;font-size:14px}
.read-success{color:#047857;font-weight:800}
.onb-sticky-cta{position:fixed;left:0;right:0;bottom:0;z-index:50;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);border-top:1px solid #e2e8f0;backdrop-filter:blur(10px);display:flex;flex-direction:column;gap:10px;align-items:stretch}
.onb-sticky-cta .onb-btn-primary,.onb-sticky-cta .onb-btn-secondary{width:100%;justify-content:center}
@media(min-width:641px){.onb-sticky-cta{display:none}}
@media(max-width:640px){.onb-shell{padding-bottom:120px}.onb-card{padding:16px;max-width:none}.onb-progress-pills{justify-content:flex-start}.onb-progress-pill span:not(.onb-progress-mark){display:none}.onb-grid{grid-template-columns:1fr}.test-grid{grid-template-columns:1fr}.manual-header,.service-row{grid-template-columns:minmax(0,1fr) 64px 64px}.onb-actions:not(.onb-actions-desktop){display:none}}
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
    const urlHelper = WEBSITE_IMPORT_EXTRACTION_ACTIVE ? (
      <p className="onb-help">RingBooker will look for your business details, hours, services, and booking link.</p>
    ) : (
      <p className="onb-help">
        We&apos;ll save this link today. Automated website import is rolling out soon.
      </p>
    );

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
        <h1 className="onb-title">Set up your AI receptionist</h1>
        <p className="onb-subtitle">
          Add your website or Google Business Profile if you have one. RingBooker will use it to pre-fill your setup when available.
        </p>
        <div className="onb-stack" style={{ marginTop: 24 }}>
          <div className="onb-field">
            <label>Website or Google Business Profile URL (optional)</label>
            <input
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://yourbusiness.com or Google Maps link"
              inputMode="url"
            />
            {urlHelper}
          </div>
          <div className="onb-field">
            <label>Business phone number</label>
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
                ? 'Enter the main line your clients call. Signup did not include a verified business number yet.'
                : 'This is the number clients call today. You are not changing it here.'}
            </p>
          </div>
        </div>
        <div className="onb-actions onb-actions-desktop">
          <button className="onb-btn-secondary" type="button" onClick={() => enterManualSetup()} disabled={saving || websiteLoading}>
            I&apos;ll enter details manually
          </button>
          <button className="onb-btn-primary" type="button" onClick={() => void saveQuickContinue()} disabled={saving || websiteLoading}>
            {websiteLoading ? 'Saving…' : 'Save and continue'}
          </button>
        </div>
        <div className="onb-sticky-cta">
          <button className="onb-btn-primary" type="button" onClick={() => void saveQuickContinue()} disabled={saving || websiteLoading}>
            {websiteLoading ? 'Saving…' : 'Save and continue'}
          </button>
          <button className="onb-btn-secondary" type="button" onClick={() => enterManualSetup()} disabled={saving || websiteLoading}>
            I&apos;ll enter details manually
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

    const showBusinessTypePicker = verticalConfidence !== 'high' || profileTypeEditOpen;

    return (
      <div>
        <h1 className="onb-title">Review your business profile</h1>
        <p className="onb-subtitle">Please check this information before RingBooker uses it to answer callers.</p>

        {renderAccordionSection(
          'profile',
          'Business details',
          <div>
            {websiteImportAttempted && (importSource === 'website' || importSource === 'google_business') ? (
              <p className="onb-help" style={{ marginTop: 0 }}>
                <span className="onb-source-badge">{importSource === 'google_business' ? 'Found on Google' : 'Found on website'}</span>{' '}
                <span className="onb-source-badge" style={{ background: '#fff7ed', color: '#c2410c' }}>
                  Needs review
                </span>
              </p>
            ) : null}
            {importSource === 'manual' ? (
              <p className="onb-help" style={{ marginBottom: 14 }}>
                No website link saved — you can add one later from the dashboard.
              </p>
            ) : null}
            <div className="onb-field">
              <label>Business name</label>
              <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Happy Nails & Spa" />
            </div>
            <div className="onb-field">
              <label>Business phone number</label>
              <input
                type="tel"
                value={businessPhone}
                onChange={(event) => {
                  setBusinessPhone(event.target.value);
                  setBusinessPhoneNeedsRealEntry(false);
                }}
              />
            </div>
            <div className="onb-field">
              <label>Business type</label>
              {showBusinessTypePicker ? (
                <div>
                  {verticalConfidence === 'high' && profileTypeEditOpen ? (
                    <p className="onb-help" style={{ marginBottom: 12 }}>
                      Update your business type below.
                    </p>
                  ) : (
                    <p className="onb-help" style={{ marginBottom: 12 }}>
                      We couldn&apos;t confidently detect your business type. Please choose one so RingBooker can suggest the right services.
                    </p>
                  )}
                  <div className="onb-grid">
                    {MANUAL_PRIMARY_VERTICAL.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`choice-card ${profilePickPrimary === item.id ? 'active' : ''}`}
                        onClick={() => {
                          setProfilePickPrimary(item.id);
                          if (item.id !== 'beauty_umbrella') setProfilePickSubtype('');
                        }}
                      >
                        <span className="emoji">{item.emoji}</span>
                        <h4>{item.label}</h4>
                      </button>
                    ))}
                  </div>
                  {profilePickPrimary === 'beauty_umbrella' ? (
                    <div className="onb-stack" style={{ marginTop: 16 }}>
                      <p className="onb-section-title">What best describes your business?</p>
                      {BEAUTY_SUBTYPE_OPTIONS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`choice-card ${profilePickSubtype === item.id ? 'active' : ''}`}
                          style={{ minHeight: 72 }}
                          onClick={() => setProfilePickSubtype(item.id)}
                        >
                          <h4 style={{ margin: 0 }}>{item.label}</h4>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div style={{ marginTop: 16 }}>
                    <button className="onb-btn-primary" type="button" onClick={() => applyProfileBusinessType()}>
                      Apply business type
                    </button>
                  </div>
                </div>
              ) : (
                <div className="timezone-readonly" style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span>
                    <strong>Business type:</strong> {resolvedVerticalLabel || 'Not set'}
                  </span>
                  <button
                    type="button"
                    className="onb-help-link"
                    style={{ padding: 0 }}
                    onClick={() => {
                      setProfileTypeEditOpen(true);
                      if (vertical === 'beauty_clinic' && beautySubtype) {
                        setProfilePickPrimary('beauty_umbrella');
                        setProfilePickSubtype(beautySubtype);
                      } else if (vertical) {
                        setProfilePickPrimary(vertical);
                        setProfilePickSubtype('');
                      }
                    }}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>
            <div className="onb-field">
              <label>Address (optional)</label>
              <textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, city, region (if you want it mentioned on calls)" />
            </div>
          </div>,
        )}

        {renderAccordionSection(
          'hours',
          'Hours & timezone',
          <div>
            <div>
              <p className="onb-section-title">Quick presets</p>
              <div className="preset-row">
                <button type="button" className="preset-chip" onClick={() => setHours(defaultHours())}>
                  Standard salon hours
                </button>
                <button type="button" className="preset-chip" onClick={() => setHours((h) => presetWeekendClosed({ ...h }))}>
                  Weekend closed
                </button>
                <button type="button" className="preset-chip" onClick={() => setHours(presetOpen7Days(defaultHours()))}>
                  Open 7 days
                </button>
              </div>
            </div>
            <p className="hours-summary">{summarizeHours(hours)}</p>
            <button type="button" className="onb-help-link" style={{ marginBottom: 12 }} onClick={() => setHoursExpanded(!hoursExpanded)}>
              {hoursExpanded ? 'Hide day-by-day editor' : 'Edit hours by day'}
            </button>
            {hoursExpanded ? (
              <div className="hours-list">
                {DAYS.map(([day, label]) => (
                  <div className={`hours-row ${hours[day].open ? '' : 'closed'}`} key={day}>
                    <strong className="hours-day">{label}</strong>
                    <label className={`toggle-pill ${hours[day].open ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={hours[day].open}
                        onChange={(event) => setHours({ ...hours, [day]: { ...hours[day], open: event.target.checked } })}
                      />
                      <span className="toggle-dot" />
                      {hours[day].open ? 'Open' : 'Closed'}
                    </label>
                    <select
                      disabled={!hours[day].open}
                      value={hours[day].from}
                      onChange={(event) => setHours({ ...hours, [day]: { ...hours[day], from: event.target.value } })}
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {formatTimeLabel(time)}
                        </option>
                      ))}
                    </select>
                    <select
                      disabled={!hours[day].open}
                      value={hours[day].to}
                      onChange={(event) => setHours({ ...hours, [day]: { ...hours[day], to: event.target.value } })}
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
            ) : null}
            <div className="onb-field" style={{ marginTop: 16 }}>
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
            {countryTimezones ? (
              <div className="onb-field">
                <label>Timezone</label>
                {countryTimezones.timezones.length === 1 && selectedTimezoneMeta ? (
                  <div className="timezone-readonly" style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', background: '#f9fafb' }}>
                    {countryTimezones.flag} {selectedTimezoneMeta.label} ({selectedTimezoneMeta.offset})
                  </div>
                ) : (
                  <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                    {countryTimezones.timezones.map((zone) => (
                      <option key={zone.value} value={zone.value}>
                        {zone.label} ({zone.offset})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : null}
          </div>,
        )}

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
              <label className="lang-pill locked">
                <input type="checkbox" checked disabled /> EN ✓ <span className="required-badge">Required</span>
              </label>
              <label className={`lang-pill ${languages.includes('vi') ? 'selected' : ''}`}>
                <input type="checkbox" checked={languages.includes('vi')} onChange={(event) => setLanguages(toggleLanguage(languages, 'vi', event.target.checked))} />
                VI {languages.includes('vi') ? '✓' : ''}
              </label>
              {vertical === 'nail_salon' ? <span className="mini-badge">✓ Auto-selected for nail salons</span> : null}
              <label className={`lang-pill ${languages.includes('es') ? 'selected' : ''}`}>
                <input type="checkbox" checked={languages.includes('es')} onChange={(event) => setLanguages(toggleLanguage(languages, 'es', event.target.checked))} />
                ES {languages.includes('es') ? '✓' : ''}
              </label>
            </div>
          </div>,
        )}

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

    return (
      <div>
        <h1 className="onb-title">Review your services</h1>
        <p className="onb-subtitle">
          RingBooker uses this to answer questions about services, pricing, and booking requests.
        </p>
        {servicesFound > 0 ? (
          <p className="read-success">Imported {servicesFound} services from your website — edit below.</p>
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
        </div>
        <div className="manual-header">
          <span>Service</span>
          <span>Min</span>
          <span>Price</span>
        </div>
        {services.map((service, index) => (
          <div className="service-row" key={index}>
            <input
              value={service.name}
              onChange={(event) => setServiceRow(index, { ...service, name: event.target.value })}
              placeholder="Service name"
            />
            <input
              type="number"
              min={1}
              value={service.duration_min || ''}
              placeholder="—"
              onChange={(event) =>
                setServiceRow(index, { ...service, duration_min: event.target.value === '' ? 0 : Number(event.target.value) })
              }
            />
            <div className="price-wrap">
              <span>$</span>
              <input
                type="number"
                value={service.price}
                onChange={(event) => setServiceRow(index, { ...service, price: Number(event.target.value) })}
                placeholder="—"
              />
            </div>
          </div>
        ))}
        <button className="add-service-btn" type="button" onClick={() => setServices([...services, { name: '', duration_min: 60, price: 0 }])}>
          + Add service
        </button>
        <div className="onb-actions onb-actions-desktop" style={{ marginTop: 28 }}>
          <span />
          <button className="onb-btn-primary" type="button" onClick={() => void continueServices()} disabled={saving}>
            {saving ? 'Saving…' : 'Save services'}
          </button>
        </div>
        <div className="onb-sticky-cta">
          <button className="onb-btn-primary" type="button" onClick={() => void continueServices()} disabled={saving}>
            {saving ? 'Saving…' : 'Save services'}
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
      <div className="onb-progress-divider" />
      <div className="onb-progress-main">
        <div className="onb-progress-pills" aria-label={`Step ${currentStep} of 4`}>
          {[1, 2, 3, 4].map((step) => (
            <span key={step} className={`onb-progress-pill ${step < currentStep ? 'done' : ''} ${step === currentStep ? 'current' : ''}`}>
              <span className="onb-progress-mark">{step < currentStep ? '✓' : step === currentStep ? '●' : '○'}</span>
              <span>{STEP_LABELS[step - 1]}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
