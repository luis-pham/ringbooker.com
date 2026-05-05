'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { isSignupSyntheticPlaceholderPhone } from '@/lib/shop-phone-placeholder';
import { UserLayout } from '@/components/user/user-layout';
import { userSettingsScripts, userSettingsStyles } from '@/components/user/user-settings';

type Vertical = 'nail_salon' | 'hair_salon' | 'day_spa' | 'med_spa' | 'beauty_clinic';
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

const VERTICAL_OPTIONS: Array<{ id: Vertical; emoji: string; label: string }> = [
  { id: 'nail_salon', emoji: '💅', label: 'Nail Salon' },
  { id: 'hair_salon', emoji: '✂️', label: 'Hair Salon' },
  { id: 'day_spa', emoji: '🧖', label: 'Day Spa' },
  { id: 'med_spa', emoji: '💉', label: 'Med Spa' },
  { id: 'beauty_clinic', emoji: '✨', label: 'Beauty Clinic / Wax / Lash Studio' },
];

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

const STEP_LABELS = ['Find business', 'Review profile', 'Services', 'Test AI'] as const;

const BOOKING_SOFTWARE_OPTIONS = [
  { id: 'square', label: 'Square' },
  { id: 'vagaro', label: 'Vagaro' },
  { id: 'fresha', label: 'Fresha' },
  { id: 'glossgenius', label: 'GlossGenius' },
  { id: 'boulevard', label: 'Boulevard' },
  { id: 'mindbody', label: 'Mindbody' },
  { id: 'booksy', label: 'Booksy' },
  { id: 'other', label: 'Other' },
  { id: 'not_sure', label: 'Not sure' },
] as const;

const SERVICE_PRESETS: Record<Vertical, string[]> = {
  nail_salon: ['Manicure', 'Pedicure', 'Gel polish', 'Acrylic full set', 'Dip powder', 'Nail art', 'Removal'],
  hair_salon: ['Haircut', 'Blowout', 'Color', 'Highlights', 'Balayage', 'Treatment'],
  day_spa: ['Facial', 'Massage', 'Waxing', 'Body treatment'],
  med_spa: ['Facial', 'Massage', 'Waxing', 'Body treatment'],
  beauty_clinic: ['Facial', 'Massage', 'Waxing', 'Body treatment'],
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

/** @deprecated Use validateOnboardingFindBusiness — step 1 no longer collects business name. */
export function validateOnboardingStep1(input: { businessName: string; vertical: string; businessPhone: string }): string[] {
  const next = validateOnboardingFindBusiness({
    vertical: input.vertical,
    businessPhone: input.businessPhone,
    websiteUrl: '',
    mode: 'manual',
  });
  if (!input.businessName.trim()) return ['Business name is required.', ...next];
  return next;
}

export function validateOnboardingFindBusiness(input: {
  vertical: string;
  businessPhone: string;
  websiteUrl: string;
  mode: 'import' | 'manual';
}): string[] {
  const errors: string[] = [];
  if (!input.vertical.trim()) errors.push('Business type is required.');
  if (!input.businessPhone.trim()) errors.push('Business phone number is required.');
  if (input.mode === 'import' && !input.websiteUrl.trim()) {
    errors.push('Add your website or Google Business Profile URL to import details.');
  }
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
  const [bookingSoftwareChoice, setBookingSoftwareChoice] = useState<string>('');
  const [accordionOpen, setAccordionOpen] = useState<Record<string, boolean>>({
    profile: true,
    hours: false,
    languages: false,
  });
  const [testCallStatus, setTestCallStatus] = useState<string | null>(null);
  const [step4Phase, setStep4Phase] = useState<'try' | 'done'>('try');

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
    setServices(body.shop.services.length > 0 ? body.shop.services : [{ name: '', duration_min: 60, price: 0 }]);
    setCurrentStep(normalizeStep(body.shop.current_onboarding_step));
    setShopPlan(body.shop.plan ?? 'starter');
    setImportSource(savedSite.trim() ? 'website' : 'none');
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

  async function importBusinessDetails() {
    const errors = validateOnboardingFindBusiness({
      vertical,
      businessPhone,
      websiteUrl,
      mode: 'import',
    });
    if (errors.length > 0) {
      setStatus(errors.join(' '));
      return;
    }

    trackOnboarding('business_import_started', { mode: 'website_or_gbp' });

    if (isProbablyGoogleBusinessUrl(websiteUrl)) {
      trackOnboarding('business_import_failed', { reason: 'gbp_not_implemented' });
      setStatus('Google Business Profile import is coming soon. Paste your website URL instead, or choose manual setup.');
      return;
    }

    if (!isHttpsWebsiteUrl(websiteUrl)) {
      setStatus('Use a secure website URL (https://) to save your site for import, or choose manual setup.');
      trackOnboarding('business_import_failed', { reason: 'invalid_website_url' });
      return;
    }

    const canonicalUrl = normalizeWebsiteUrl(websiteUrl);
    setWebsiteLoading(true);
    setStatus(null);
    const response = await fetch('/api/backend/user/read-website', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: canonicalUrl }),
    });
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      success?: boolean;
      servicesFound?: number;
      todo?: string;
      error?: string;
    } | null;
    setWebsiteLoading(false);

    if (!response.ok || !body?.ok) {
      setWebsiteImportAttempted(true);
      trackOnboarding('business_import_failed', { reason: body?.error ?? 'request_failed' });
      setStatus("We couldn't save your website URL. Check the link or use manual setup.");
      return;
    }

    setWebsiteImportAttempted(true);
    setServicesFound(body.servicesFound ?? 0);
    trackOnboarding('business_import_success', { servicesFound: body.servicesFound ?? 0, todo: body.todo ?? null });
    setImportSource('website');

    const ok = await saveSettings({
      website_url: canonicalUrl,
      phone_number: businessPhone,
      user_phone: businessPhone,
      vertical,
      current_onboarding_step: 2,
    });
    if (ok) {
      setWebsiteUrl(canonicalUrl);
      setCurrentStep(2);
    }
  }

  async function enterManualSetup() {
    const errors = validateOnboardingFindBusiness({
      vertical,
      businessPhone,
      websiteUrl: '',
      mode: 'manual',
    });
    if (errors.length > 0) {
      setStatus(errors.join(' '));
      return;
    }
    trackOnboarding('business_import_started', { mode: 'manual' });
    setImportSource('manual');
    const ok = await saveSettings({
      phone_number: businessPhone,
      user_phone: businessPhone,
      vertical,
      current_onboarding_step: 2,
    });
    if (ok) setCurrentStep(2);
  }

  async function continueProfileReview() {
    const errors = validateOnboardingProfileReview({ businessName });
    if (errors.length > 0) {
      setStatus(errors.join(' '));
      return;
    }
    trackOnboarding('onboarding_profile_reviewed');
    const addr = address.trim();
    const ok = await saveSettings({
      name: businessName,
      user_name: businessName,
      phone_number: businessPhone,
      user_phone: businessPhone,
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
    const preset = SERVICE_PRESETS[vertical];
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
    if (currentStep <= 1) return;
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
.onb-progress-pills{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.onb-progress-pill{display:flex;align-items:center;justify-content:center;gap:7px;border:1px solid #d9deea;border-radius:999px;padding:6px 14px;color:#64748b;background:#fff;font-size:13px;font-weight:800;white-space:nowrap;min-width:auto}
.onb-progress-pill.done{background:transparent;border-color:#8b5cf6;color:#5b21b6}
.onb-progress-pill.current{background:#6d28d9;border-color:#6d28d9;color:#fff;box-shadow:0 12px 28px rgba(109,40,217,.22)}
.onb-progress-mark{width:auto;min-width:1em;height:auto;border-radius:0;display:inline-flex;align-items:center;justify-content:center;background:transparent!important;color:inherit;box-shadow:none!important;border:0;font-size:13px;line-height:1}
.onb-title{margin:0;color:#0f172a;font-size:1.5rem;line-height:1.3;letter-spacing:-.02em;font-weight:500}
.onb-subtitle{margin:8px 0 0;color:var(--text-gray);font-size:14px;line-height:1.6;max-width:760px;font-weight:400}
.onb-section-title{display:block;margin:0 0 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em}
.onb-source-badge{display:inline-flex;align-items:center;border-radius:999px;background:#eef2ff;color:#4338ca;padding:3px 10px;font-size:11px;font-weight:700;margin-left:8px}
.onb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.onb-stack{display:grid;gap:18px}
.choice-card{min-height:100px;border:1.5px solid #e2e8f0;border-radius:12px;padding:20px;background:#fff;text-align:left;cursor:pointer;transition:.18s ease}
.choice-card:hover{background:#faf5ff;border-color:#e2e8f0}
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
.hours-day{font-weight:900;color:#111827;min-width:40px}.toggle-pill{position:relative;display:inline-flex;align-items:center;gap:8px;border:1px solid #dbe2ee;border-radius:999px;padding:8px 12px;background:#fff;font-weight:800;color:#64748b;cursor:pointer}.toggle-pill input{position:absolute;opacity:0;pointer-events:none}.toggle-dot{width:28px;height:16px;border-radius:999px;background:#cbd5e1;position:relative;transition:.18s ease}.toggle-dot:after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;transition:.18s ease}.toggle-pill.active{border-color:#8b5cf6;color:#5b21b6;background:transparent}.toggle-pill.active .toggle-dot{background:#7c3aed}.toggle-pill.active .toggle-dot:after{transform:translateX(12px)}
.lang-list{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.lang-pill{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1.5px solid #e2e8f0;border-radius:999px;padding:10px 15px;background:#fff;color:#374151;font-weight:900;cursor:pointer}.lang-pill input{position:absolute;opacity:0;pointer-events:none}.lang-pill.selected{background:#7c3aed;border-color:#7c3aed;color:#fff}.lang-pill.locked{background:#f1f5f9;color:#9ca3af;cursor:not-allowed;flex-direction:column;gap:2px}.required-badge{border-radius:999px;background:transparent;color:#9ca3af;padding:0;font-size:10px;font-weight:800}.mini-badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;background:#dcfce7;color:#16a34a;padding:2px 8px;font-size:11px;font-weight:900}
.preset-row{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 14px}.preset-chip{border:1px solid #e2e8f0;border-radius:999px;background:#fff;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer}.preset-chip:hover{border-color:#c4b5fd;background:#faf5ff}
.hours-summary{font-size:14px;color:#334155;line-height:1.5;margin:0 0 12px}
.acc{border:1px solid #e2e8f0;border-radius:12px;background:#fff;margin-bottom:10px;overflow:hidden}.acc-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border:0;background:#fff;font:inherit;font-weight:800;text-align:left;cursor:pointer}.acc-body{padding:0 16px 16px;border-top:1px solid #f1f5f9}
.test-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:20px}.test-card{border:1px solid #e2e8f0;border-radius:16px;padding:20px;background:#fff;display:flex;flex-direction:column;gap:10px;min-height:160px}.test-card h3{margin:0;font-size:17px}.test-card p{margin:0;font-size:14px;color:#64748b;line-height:1.55}
.manual-header{display:grid;grid-template-columns:minmax(0,2fr) 72px 72px;gap:10px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
.service-row{display:grid;grid-template-columns:minmax(0,2fr) 72px 72px;gap:10px;align-items:center;margin-bottom:10px}
.price-wrap{position:relative}.price-wrap span{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#64748b}.price-wrap input{padding-left:28px!important}
.add-service-btn{border:1.5px dashed #a78bfa;border-radius:10px;background:#fff;color:#6d28d9;padding:0 13px;font-weight:900;cursor:pointer;width:100%;height:44px}
.onb-status{margin-top:14px;padding:12px 14px;border-radius:16px;background:#f8fafc;color:#475569;font-size:14px}
.read-success{color:#047857;font-weight:800}
.onb-sticky-cta{position:fixed;left:0;right:0;bottom:0;z-index:50;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);border-top:1px solid #e2e8f0;backdrop-filter:blur(10px);display:flex;flex-direction:column;gap:10px;align-items:stretch}
.onb-sticky-cta .onb-btn-primary,.onb-sticky-cta .onb-btn-secondary{width:100%;justify-content:center}
@media(min-width:641px){.onb-sticky-cta{display:none}}
@media(max-width:640px){.onb-shell{padding-bottom:120px}.onb-card{padding:16px;max-width:none}.onb-progress-pill span:not(.onb-progress-mark){display:none}.onb-grid{grid-template-columns:1fr}.test-grid{grid-template-columns:1fr}.manual-header,.service-row{grid-template-columns:minmax(0,1fr) 64px 64px}.onb-actions:not(.onb-actions-desktop){display:none}}
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
  const importBadgeWebsite = importSource === 'website' && websiteImportAttempted;

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
    return (
      <div>
        <h1 className="onb-title">Let&apos;s set up your AI receptionist</h1>
        <p className="onb-subtitle">
          Add your website or Google Business Profile. RingBooker will pre-fill your business details, hours, and services.
        </p>
        <div className="onb-stack" style={{ marginTop: 24 }}>
          <div className="onb-field">
            <label>Website or Google Business Profile URL</label>
            <input
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://yourbusiness.com or Google Maps link"
              inputMode="url"
            />
            <p className="onb-help">
              Website import saves your URL today; automated extraction is rolling out. Google Business Profile import is coming soon.
            </p>
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
                : 'This is the number clients call today — you are not changing it here.'}
            </p>
          </div>
          <div className="onb-field">
            <label>Business type</label>
            <div className="onb-grid">
              {VERTICAL_OPTIONS.map((item) => (
                <button key={item.id} type="button" className={`choice-card ${vertical === item.id ? 'active' : ''}`} onClick={() => setVertical(item.id)}>
                  <span className="emoji">{item.emoji}</span>
                  <h4>{item.label}</h4>
                </button>
              ))}
            </div>
          </div>
          <div className="onb-field">
            <label>
              Do you use booking software? <span style={{ textTransform: 'none', fontWeight: 500, color: '#94a3b8' }}>(optional)</span>
            </label>
            <p className="onb-help">You can connect calendars later from the dashboard — nothing is required here.</p>
            <select value={bookingSoftwareChoice} onChange={(event) => setBookingSoftwareChoice(event.target.value)}>
              <option value="">Prefer not to say</option>
              {BOOKING_SOFTWARE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="onb-actions onb-actions-desktop">
          <button className="onb-btn-secondary" type="button" onClick={() => void enterManualSetup()} disabled={saving || websiteLoading}>
            I&apos;ll enter details manually
          </button>
          <button className="onb-btn-primary" type="button" onClick={() => void importBusinessDetails()} disabled={saving || websiteLoading}>
            {websiteLoading ? 'Importing…' : 'Import business details'}
          </button>
        </div>
        <div className="onb-sticky-cta">
          <button className="onb-btn-primary" type="button" onClick={() => void importBusinessDetails()} disabled={saving || websiteLoading}>
            {websiteLoading ? 'Importing…' : 'Import business details'}
          </button>
          <button className="onb-btn-secondary" type="button" onClick={() => void enterManualSetup()} disabled={saving || websiteLoading}>
            I&apos;ll enter details manually
          </button>
        </div>
      </div>
    );
  }

  function renderStep2() {
    const countryTimezones = COUNTRY_TIMEZONES.find((item) => item.country === selectedCountry);
    const selectedTimezoneMeta = countryTimezones?.timezones.find((zone) => zone.value === timezone) ?? countryTimezones?.timezones[0];

    const verticalLabel = VERTICAL_OPTIONS.find((v) => v.id === vertical)?.label ?? 'Business';

    return (
      <div>
        <h1 className="onb-title">Review your business profile</h1>
        <p className="onb-subtitle">
          Confirm how RingBooker should introduce your business. No card is needed for setup and test calls.
        </p>

        {renderAccordionSection(
          'profile',
          'Business details',
          <div>
            {importBadgeWebsite ? <p className="read-success" style={{ marginTop: 0 }}>Found on website — please confirm fields below.</p> : null}
            {importSource === 'manual' ? (
              <p className="onb-help" style={{ marginBottom: 14 }}>
                No website? Start with a simple setup you can edit later.
              </p>
            ) : null}
            <div className="onb-field">
              <label>
                Business name
                {importBadgeWebsite ? <span className="onb-source-badge">Website</span> : null}
              </label>
              <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Happy Nails & Spa" />
            </div>
            <div className="onb-field">
              <label>
                Business phone number
                {importBadgeWebsite ? <span className="onb-source-badge">Website</span> : null}
              </label>
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
              <label>Address {importBadgeWebsite ? <span className="onb-source-badge">Website</span> : <span style={{ fontWeight: 500 }}>(optional)</span>}</label>
              <textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, city, region (if you want it mentioned on calls)" />
            </div>
            <div className="onb-field">
              <label>Business type</label>
              <div className="timezone-readonly" style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', background: '#f9fafb' }}>
                {verticalLabel}
              </div>
            </div>
          </div>,
        )}

        {renderAccordionSection(
          'hours',
          'Hours & timezone',
          <div>
            {importSource === 'manual' ? (
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
            ) : null}
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
    return (
      <div>
        <h1 className="onb-title">Review your services</h1>
        <p className="onb-subtitle">
          RingBooker uses this to answer questions about services, pricing, and booking requests.
        </p>
        {servicesFound > 0 ? (
          <p className="read-success">Imported {servicesFound} services from your website — edit below.</p>
        ) : websiteImportAttempted && importSource === 'website' ? (
          <p className="onb-help">
            Automated service extraction isn&apos;t available yet. Use presets for your industry or add services manually.
          </p>
        ) : null}
        <div className="preset-row">
          <button type="button" className="preset-chip" onClick={applyPresetServices} disabled={!vertical}>
            Add {vertical ? VERTICAL_OPTIONS.find((v) => v.id === vertical)?.label ?? 'industry' : 'industry'} presets
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
                <p>
                  Talk to RingBooker in your browser using an industry demo tuned to businesses like yours. Your saved profile is used on phone
                  calls after you go live.
                </p>
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
                <p>RingBooker will call your saved business phone so you can hear how it sounds on a real call.</p>
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
              Open your dashboard to review calls and summaries. Add a payment method when you&apos;re ready for RingBooker to answer real callers on
              your business number.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              <button className="onb-btn-primary" type="button" onClick={completeSetup}>
                Open dashboard
              </button>
              <a className="onb-btn-secondary" href="/user/billing">
                Add payment method to go live
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
                Add payment method to go live
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
            <Progress currentStep={currentStep} onBack={() => void handleBack()} />
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

function Progress({ currentStep, onBack }: { currentStep: WizardStep; onBack: () => void }) {
  return (
    <div className="onb-progress">
      <button
        className={`onb-back-inline ${currentStep === 1 ? 'hidden' : ''}`}
        type="button"
        onClick={onBack}
        aria-hidden={currentStep === 1}
        tabIndex={currentStep === 1 ? -1 : 0}
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
