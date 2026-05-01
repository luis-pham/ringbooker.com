'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { CallForwardingSetup } from '@/components/user/call-forwarding-setup';
import type { ForwardingType } from '@/lib/call-forwarding/carrier-data';
import { UserLayout } from '@/components/user/user-layout';
import { userSettingsScripts, userSettingsStyles } from '@/components/user/user-settings';

type Vertical = 'nail_salon' | 'hair_salon' | 'day_spa' | 'med_spa' | 'beauty_clinic';
type WizardStep = 1 | 2 | 3 | 4;
type ServiceItem = { name: string; duration_min: number; price: number };
type ApiHours = Record<string, { closed: true } | { open: string; close: string }>;
type WizardHours = Record<string, { open: boolean; from: string; to: string }>;

type OnboardingStatusResponse = {
  ok: boolean;
  onboardingRequired?: boolean;
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
    current_onboarding_step?: number | null;
    setup_method?: 'forward' | 'new_number' | null;
    forwarding_type?: ForwardingType | null;
    forwarding_carrier?: string | null;
    forwarding_country?: string | null;
    telnyx_number?: string | null;
  };
  error?: string;
};

type CalendarProviderSummary = {
  id: string;
  label: string;
  implemented: boolean;
  connected: boolean;
  configured: boolean;
  details: { bookingUrl?: string | null; capabilityNote?: string | null } | null;
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

const STEP_LABELS = ['Business', 'Hours', 'Services', 'Go Live'] as const;

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

const PROVIDER_BADGES: Record<string, string> = {
  square_appointments: 'Live integration',
  vagaro: 'Availability + Booking link',
  glossgenius: 'Booking link',
  fresha: 'Booking link',
  booksy: 'Booking link',
  mindbody: 'Coming soon',
};

const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  square_appointments: 'Direct calendar connection for availability and booking workflows.',
  vagaro: 'Availability checks plus booking link SMS for callers who want to book.',
  glossgenius: 'Send your GlossGenius booking link by SMS when callers want to book.',
  fresha: 'Send your Fresha booking link by SMS when callers want to book.',
  booksy: 'Send your Booksy booking link by SMS when callers want to book.',
  mindbody: 'Mindbody API support is planned for a later release.',
};

const BOOKING_LINK_PROVIDERS = ['glossgenius', 'fresha', 'booksy'] as const;

export function validateOnboardingStep1(input: { businessName: string; vertical: string; businessPhone: string }): string[] {
  const errors: string[] = [];
  if (!input.businessName.trim()) errors.push('Business name is required.');
  if (!input.vertical.trim()) errors.push('Business type is required.');
  if (!input.businessPhone.trim()) errors.push('Business phone number is required.');
  return errors;
}

export function applyVerticalLanguageSelection(vertical: string, languages: string[]): string[] {
  const next = new Set(['en', ...languages]);
  if (vertical === 'nail_salon') next.add('vi');
  return [...next];
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
      duration_min: item.duration_min || 60,
      price: Number.isFinite(item.price) ? item.price : 0,
    }));
}

function findCountryForTimezone(timezone: string) {
  return COUNTRY_TIMEZONES.find((item) => item.timezones.some((zone) => zone.value === timezone));
}

export function UserOnboardingLive() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [shopId, setShopId] = useState('');
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [businessName, setBusinessName] = useState('');
  const [vertical, setVertical] = useState<Vertical | ''>('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [hours, setHours] = useState<WizardHours>(() => defaultHours());
  const [selectedCountry, setSelectedCountry] = useState('');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [languages, setLanguages] = useState<string[]>(['en']);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [websiteLoading, setWebsiteLoading] = useState(false);
  const [websiteReadSuccess, setWebsiteReadSuccess] = useState(false);
  const [servicesFound, setServicesFound] = useState(0);
  const [services, setServices] = useState<ServiceItem[]>([{ name: '', duration_min: 60, price: 0 }]);
  const [providers, setProviders] = useState<CalendarProviderSummary[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [bookingLinkInputs, setBookingLinkInputs] = useState<Record<string, string>>({});
  const [vagaroOpen, setVagaroOpen] = useState(false);
  const [vagaroForm, setVagaroForm] = useState({ clientId: '', clientSecretKey: '', region: 'us', businessId: '', bookingUrl: '' });
  const [forwardingConfirmed, setForwardingConfirmed] = useState(false);
  const [setupMethod, setSetupMethod] = useState<'forward' | 'new_number' | undefined>();
  const [forwardingType, setForwardingType] = useState<ForwardingType>('no_answer');
  const [forwardingCarrier, setForwardingCarrier] = useState<string | undefined>();
  const [forwardingCountry, setForwardingCountry] = useState('us');
  const [telnyxNumber, setTelnyxNumber] = useState('');

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
    if (vertical === 'nail_salon') {
      setLanguages((current) => applyVerticalLanguageSelection(vertical, current));
    }
  }, [vertical]);

  async function loadOnboarding() {
    setLoading(true);
    const response = await fetch('/api/backend/user/onboarding-status');
    const body = (await response.json().catch(() => null)) as OnboardingStatusResponse | null;
    if (!body?.ok || !body.shop) {
      setStatus(body?.error ?? 'Unable to load onboarding.');
      setLoading(false);
      return;
    }
    if (!body.onboardingRequired) {
      router.replace('/user');
      return;
    }
    setShopId(body.shop.id);
    setBusinessName(body.shop.name ?? '');
    setVertical(body.shop.vertical ?? '');
    setBusinessPhone(body.shop.phone_number ?? body.shop.user_phone ?? '');
    const savedTimezone = body.shop.timezone || 'America/Los_Angeles';
    setTimezone(savedTimezone);
    setSelectedCountry(findCountryForTimezone(savedTimezone)?.country ?? 'United States');
    setHours(apiHoursToWizard(body.shop.hours ?? {}));
    setLanguages(applyVerticalLanguageSelection(body.shop.vertical ?? '', body.shop.languages ?? ['en']));
    setWebsiteUrl(body.shop.website_url ?? '');
    setServices(body.shop.services.length > 0 ? body.shop.services : [{ name: '', duration_min: 60, price: 0 }]);
    setCurrentStep(normalizeStep(body.shop.current_onboarding_step));
    setSetupMethod(body.shop.setup_method ?? undefined);
    setForwardingType(body.shop.forwarding_type ?? 'no_answer');
    setForwardingCarrier(body.shop.forwarding_carrier ?? undefined);
    setForwardingCountry(body.shop.forwarding_country ?? 'us');
    setTelnyxNumber(body.shop.telnyx_number ?? '');
    setLoading(false);
    void loadProviders();
  }

  async function loadProviders() {
    const response = await fetch('/api/backend/user/calendar/providers');
    const body = (await response.json().catch(() => null)) as { ok?: boolean; providers?: CalendarProviderSummary[] } | null;
    if (!body?.ok) return;
    setProviders(body.providers ?? []);
    setSelectedProvider((current) => current || ((body.providers ?? []).find((provider) => provider.connected)?.id ?? ''));
    setBookingLinkInputs(
      Object.fromEntries((body.providers ?? []).map((provider) => [provider.id, provider.details?.bookingUrl ?? ''])),
    );
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

  async function continueStep1() {
    const errors = validateOnboardingStep1({ businessName, vertical, businessPhone });
    if (errors.length > 0) {
      setStatus(errors.join(' '));
      return;
    }
    const ok = await saveSettings({
      name: businessName,
      user_name: businessName,
      vertical,
      phone_number: businessPhone,
      user_phone: businessPhone,
      current_onboarding_step: 2,
    });
    if (ok) setCurrentStep(2);
  }

  async function continueStep2() {
    const ok = await saveSettings({
      hours: wizardHoursToApi(hours),
      timezone,
      languages: applyVerticalLanguageSelection(vertical, languages),
      current_onboarding_step: 3,
    });
    if (ok) setCurrentStep(3);
  }

  async function readWebsite() {
    if (!websiteUrl.trim()) {
      setStatus('Website URL is required to read your site.');
      return;
    }
    setWebsiteLoading(true);
    setStatus('Reading your website...');
    const response = await fetch('/api/backend/user/read-website', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: websiteUrl.trim() }),
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; success?: boolean; servicesFound?: number; error?: string } | null;
    setWebsiteLoading(false);
    if (!response.ok || !body?.ok) {
      setWebsiteReadSuccess(false);
      setStatus("Couldn't read website. Try entering services manually.");
      return;
    }
    setWebsiteReadSuccess(true);
    setServicesFound(body.servicesFound ?? 0);
    setStatus(null);
  }

  async function continueStep3() {
    const patch: Record<string, unknown> = { current_onboarding_step: 4 };
    if (websiteUrl.trim()) patch.website_url = websiteUrl.trim();
    const nextServices = cleanServices(services);
    if (nextServices.length > 0) patch.services = nextServices;
    const ok = await saveSettings(patch);
    if (ok) setCurrentStep(4);
  }

  async function saveBookingLink(providerId: string) {
    const bookingUrl = bookingLinkInputs[providerId]?.trim();
    if (!bookingUrl) {
      setStatus('Booking link URL is required.');
      return;
    }
    setSaving(true);
    const response = await fetch(`/api/backend/user/calendar/providers/${providerId}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingUrl }),
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setSaving(false);
    if (!response.ok || !body?.ok) {
      setStatus(body?.error ?? 'Unable to save booking link.');
      return;
    }
    setStatus('Booking link saved.');
    void loadProviders();
  }

  async function connectVagaro() {
    setSaving(true);
    const response = await fetch('/api/backend/user/calendar/providers/vagaro/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vagaroForm),
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setSaving(false);
    if (!response.ok || !body?.ok) {
      setStatus(body?.error ?? 'Unable to connect Vagaro.');
      return;
    }
    setStatus('Vagaro connected.');
    setVagaroOpen(false);
    void loadProviders();
  }

  function completeSetup() {
    try {
      localStorage.setItem(`ringbooker_welcome_started_${shopId}`, String(Date.now()));
    } catch {
      // localStorage can be unavailable in private browsing.
    }
    router.replace('/user');
    router.refresh();
  }

  const mergedStyles = useMemo(
    () => [
      ...userSettingsStyles,
      String.raw`
.onb-shell{max-width:1120px;margin:0 auto;padding:18px}
.onb-card{background:transparent;border:none;box-shadow:none;border-radius:0;padding:32px;max-width:680px;margin:0 auto;width:100%}
.onb-card.wide{max-width:680px}
.onb-progress{display:flex;align-items:center;gap:16px;margin-bottom:32px}
.onb-back-inline{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:999px;background:#000;color:#fff;padding:8px 16px;font-size:14px;font-weight:500;cursor:pointer;white-space:nowrap;flex-shrink:0}.onb-back-inline:hover{background:#1a1a1a}.onb-back-inline.hidden{visibility:hidden}
.onb-progress-divider{width:1px;height:24px;background:#e2e8f0;flex-shrink:0}
.onb-progress-main{display:flex;justify-content:flex-end;flex:1;min-width:0}
.onb-progress-pills{display:flex;justify-content:flex-end;gap:8px}
.onb-progress-pill{display:flex;align-items:center;justify-content:center;gap:7px;border:1px solid #d9deea;border-radius:999px;padding:6px 14px;color:#64748b;background:#fff;font-size:13px;font-weight:800;white-space:nowrap;min-width:auto}
.onb-progress-pill.done{background:transparent;border-color:#8b5cf6;color:#5b21b6}
.onb-progress-pill.current{background:#6d28d9;border-color:#6d28d9;color:#fff;box-shadow:0 12px 28px rgba(109,40,217,.22)}
.onb-progress-mark{width:18px;height:18px;border-radius:999px;display:inline-grid;place-items:center;background:currentColor;color:inherit;box-shadow:inset 0 0 0 999px rgba(255,255,255,.8);font-size:11px}
.onb-progress-pill.current .onb-progress-mark{background:#fff;color:#6d28d9;box-shadow:none}
.onb-progress-pill.done .onb-progress-mark{background:#6d28d9;color:#fff;box-shadow:none}
.onb-title{margin:0;color:#0f172a;font-size:1.5rem;line-height:1.3;letter-spacing:-.02em;font-weight:500}
.onb-subtitle{margin:8px 0 0;color:var(--text-gray);font-size:14px;line-height:1.6;max-width:760px;font-weight:400}
.onb-section-title{display:block;margin:0 0 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em}
.onb-optional-badge{display:inline-flex;align-items:center;margin-left:8px;border-radius:999px;background:#f1f5f9;color:#64748b;padding:3px 8px;font-size:11px;font-weight:600;letter-spacing:0;text-transform:none;vertical-align:middle}
.onb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.onb-grid.three{grid-template-columns:repeat(2,minmax(0,1fr))}
.onb-stack{display:grid;gap:18px}
.choice-card{min-height:100px;border:1.5px solid #e2e8f0;border-radius:12px;padding:20px;background:#fff;text-align:left;cursor:pointer;transition:.18s ease}
.choice-card:hover{background:#faf5ff;border-color:#e2e8f0}
.choice-card.active{background:#faf5ff;border-color:#7c3aed;border-width:1.5px;box-shadow:none}
.choice-card .emoji{font-size:2rem;line-height:1}.choice-card h4{margin:12px 0 0;font-size:15px;font-weight:800;color:#111827}
.onb-field{display:grid;gap:6px;margin-bottom:20px}.onb-field label{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
.onb-field input,.onb-field select,.provider-card input,.provider-card select,.platform-selector select,.platform-panel input,.platform-panel select,.hours-row select{height:40px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;line-height:1.5;background:#fff;color:#111827;width:100%;font-family:inherit}.onb-field input:focus,.onb-field select:focus,.provider-card input:focus,.provider-card select:focus,.platform-selector select:focus,.platform-panel input:focus,.platform-panel select:focus,.hours-row select:focus{border-color:#7c3aed;outline:none;box-shadow:0 0 0 2px rgba(124,58,237,.15)}.onb-field input::placeholder,.provider-card input::placeholder,.platform-panel input::placeholder{color:#9ca3af;font-size:14px}.onb-field input:disabled,.onb-field select:disabled,.provider-card input:disabled,.provider-card select:disabled,.platform-selector select:disabled,.platform-panel input:disabled,.platform-panel select:disabled,.hours-row select:disabled{background:#f9fafb;color:#6b7280;cursor:not-allowed}.timezone-readonly{height:40px;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:14px;line-height:1.4;background:#f9fafb;color:#374151;width:100%}
.onb-help{font-size:13px;color:#64748b;margin:0}.onb-help-link{border:0;background:transparent;padding:8px 0;cursor:pointer;text-decoration:none;font-family:inherit;font-weight:400;line-height:1.5;text-align:inherit;transition:color .15s ease}.onb-help-link:hover{color:#334155;text-decoration:underline;text-underline-offset:2px}.onb-help-link:focus-visible{outline:2px solid rgba(124,58,237,.35);outline-offset:2px}.onb-actions{display:flex;justify-content:space-between;gap:12px;margin-top:24px;align-items:center}
.onb-btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:36px;border:0;border-radius:8px;background:#000;color:#fff;padding:8px 16px;font-size:14px;font-weight:500;box-shadow:0 8px 18px rgba(0,0,0,.18);cursor:pointer;text-decoration:none;transition:background .15s ease,transform .15s ease,box-shadow .15s ease}.onb-btn-primary:hover:not(:disabled){background:#1f1f1f;transform:translateY(-1px);box-shadow:0 12px 24px rgba(0,0,0,.24)}
.onb-btn-primary:disabled{opacity:.6;cursor:not-allowed}.onb-btn-secondary{display:inline-flex;align-items:center;justify-content:center;height:36px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;padding:8px 16px;font-size:14px;font-weight:500;cursor:pointer;text-decoration:none}
.hours-list{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff}.hours-row{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff;border-bottom:1px solid #f1f5f9}.hours-row:last-child{border-bottom:0}.hours-row:hover{background:#fafafa}.hours-row.closed{background:#f9fafb}.hours-row.closed select{opacity:.4;background:#f1f5f9}
.hours-day{font-weight:900;color:#111827;min-width:40px}.toggle-pill{position:relative;display:inline-flex;align-items:center;gap:8px;border:1px solid #dbe2ee;border-radius:999px;padding:8px 12px;background:#fff;font-weight:800;color:#64748b;cursor:pointer}.toggle-pill input{position:absolute;opacity:0;pointer-events:none}.toggle-dot{width:28px;height:16px;border-radius:999px;background:#cbd5e1;position:relative;transition:.18s ease}.toggle-dot:after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;transition:.18s ease}.toggle-pill.active{border-color:#8b5cf6;color:#5b21b6;background:transparent}.toggle-pill.active .toggle-dot{background:#7c3aed}.toggle-pill.active .toggle-dot:after{transform:translateX(12px)}
.lang-list{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.check-pill{display:inline-flex;align-items:center;gap:8px;border:1.5px solid #e2e8f0;border-radius:999px;padding:10px 13px;background:#fff}.lang-pill{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1.5px solid #e2e8f0;border-radius:999px;padding:10px 15px;background:#fff;color:#374151;font-weight:900;cursor:pointer}.lang-pill input{position:absolute;opacity:0;pointer-events:none}.lang-pill.selected{background:#7c3aed;border-color:#7c3aed;color:#fff}.lang-pill.locked{background:#f1f5f9;color:#9ca3af;cursor:not-allowed;flex-direction:column;gap:2px}.required-badge{border-radius:999px;background:transparent;color:#9ca3af;padding:0;font-size:10px;font-weight:800}.mini-badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;background:#dcfce7;color:#16a34a;padding:2px 8px;font-size:11px;font-weight:900}.recommended-badge{display:inline-flex;width:fit-content;border-radius:999px;background:#dcfce7;color:#16a34a;padding:3px 10px;font-size:12px;font-weight:500;margin-bottom:12px}.onb-card-title{font-size:15px;font-weight:700;color:#111827;margin:0}
.provider-card{border:1.5px solid #e2e8f0;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:12px;min-height:210px;background:#fff;box-shadow:none}
.provider-card.recommended{border-top:1.5px solid #e2e8f0;box-shadow:none}
.provider-card.disabled{opacity:.5;background:#f8fafc;position:relative}
.provider-card.disabled:after{content:"Coming soon";position:absolute;inset:auto 16px 16px auto;border-radius:999px;background:#f59e0b;color:#fff;padding:6px 10px;font-size:11px;font-weight:900}
.provider-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.provider-head h4{margin:0}.provider-head p{margin:3px 0 0;color:#64748b;font-size:13px}
.provider-action{margin-top:auto}.provider-badge{display:inline-flex;align-items:center;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:500;white-space:nowrap}.provider-badge.live{background:#dcfce7;color:#16a34a}.provider-badge.combo{background:#ede9fe;color:#7c3aed}.provider-badge.link{background:#f1f5f9;color:#475569}.provider-badge.soon{background:#fef3c7;color:#d97706}.provider-badge.connected{background:#dcfce7;color:#16a34a}
.platform-selector{display:grid;gap:6px;margin-top:16px}.platform-selector select,.platform-panel select{appearance:none;padding-right:36px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M6 8l4 4 4-4' stroke='%236b7280' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;background-size:16px}
.platform-panel{margin-top:16px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;padding:24px;animation:onbPanelIn .2s ease both;display:grid;gap:16px}.platform-panel .onb-btn-primary{align-self:flex-end;display:inline-flex;align-items:center;justify-content:center;height:36px;border:0;border-radius:8px;background:#6d28d9;color:#fff;padding:8px 16px;font-size:14px;font-weight:500;box-shadow:0 8px 18px rgba(109,40,217,.18);cursor:pointer;text-decoration:none}.platform-panel .onb-btn-primary:hover{background:#5b21b6;box-shadow:0 12px 24px rgba(109,40,217,.24)}.platform-panel .onb-btn-secondary{align-self:flex-end;height:36px;border:1.5px solid #7c3aed;color:#7c3aed;background:transparent;box-shadow:none;border-radius:8px;padding:8px 16px;font-size:14px;font-weight:500}.platform-panel .onb-btn-secondary:hover{background:#faf5ff}.platform-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:2px}.platform-title{display:flex;align-items:flex-start;gap:10px;min-width:0}.platform-logo-img{width:28px;height:28px;object-fit:contain;flex-shrink:0;margin-top:1px}.platform-title-name{font-size:16px;font-weight:600;color:#1a1a1a;line-height:1.25}.platform-title-desc{font-size:13px;color:#6b7280;margin-top:2px;line-height:1.4}.platform-panel h4,.platform-panel h3{margin:0}.platform-panel p{margin:0}.feature-list{display:grid;gap:4px;margin:12px 0;color:#374151;font-size:13px}.feature-list span{display:flex;align-items:center;gap:8px}.feature-list strong{color:#16a34a;font-weight:900}.feature-list .no{color:#374151}.feature-list .no strong{color:#9ca3af}.connected-banner{display:flex;align-items:center;gap:8px;border-radius:12px;background:#ecfdf5;color:#047857;padding:11px 13px;font-weight:900}.platform-subsection{border-top:1px solid #f1f5f9;padding-top:16px;margin-top:16px;display:grid;gap:10px}.platform-subsection h4{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}.platform-field{display:grid;gap:6px;margin-bottom:20px}.platform-field label{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}.disconnect-link{justify-self:end;border:0;background:transparent;color:#64748b;font-size:12px;font-weight:800;cursor:pointer}.no-platform-box{margin-top:16px;background:#f8fafc;border-radius:12px;padding:24px;text-align:center}.no-platform-box .onb-subtitle{margin-left:auto;margin-right:auto}.no-platform-box .onb-subtitle:first-of-type{margin-top:0}.no-platform-icon{font-size:32px;line-height:1;margin-bottom:10px}.connect-another{display:block;margin:12px auto 0;border:0;background:transparent;color:#64748b;font-size:13px;font-weight:700;cursor:pointer}
@keyframes onbPanelIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.step3-stack{display:grid;gap:0;margin-top:24px}.step3-card{min-height:auto}.step3-website-input{width:100%}.step3-read-btn{align-self:flex-start;max-width:200px;width:100%;margin-top:2px}.step3-or{display:flex;align-items:center;gap:12px;margin:24px 0;color:#94a3b8;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.12em}.step3-or:before,.step3-or:after{content:"";height:1px;background:#e5e7eb;flex:1}.step3-actions{justify-content:space-between}
.manual-header{display:grid;grid-template-columns:minmax(0,1fr) 80px;gap:10px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}.service-row{display:grid;grid-template-columns:minmax(0,1fr) 80px;gap:10px;align-items:center}.price-wrap{position:relative}.price-wrap span{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#64748b}.price-wrap input{padding-left:28px!important}.add-service-btn{border:1.5px dashed #a78bfa;border-radius:10px;background:#fff;color:#6d28d9;padding:0 13px;font-weight:900;cursor:pointer;width:100%;height:44px}
.section-divider{display:flex;align-items:center;gap:12px;margin:28px 0;color:#94a3b8;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.12em}.section-divider:before,.section-divider:after{content:"";height:1px;background:#e5e7eb;flex:1}
.number-box{display:flex;align-items:center;justify-content:space-between;gap:12px;border-radius:18px;background:#111827;color:#fff;padding:16px 18px;font-weight:900}.number-copy{border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(255,255,255,.1);color:#fff;padding:8px 13px;font-weight:900}
.onb-status{margin-top:14px;padding:12px 14px;border-radius:16px;background:#f8fafc;color:#475569;font-size:14px}
.read-success{color:#047857;font-weight:800}
@media(max-width:1024px){.onb-grid.three{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:767px){.step3-read-btn{max-width:none}.step3-actions{flex-direction:column;align-items:stretch}.step3-actions .onb-btn-primary{order:1;width:100%}.step3-actions .onb-help-link{order:2;text-align:center}}
@media(max-width:640px){.onb-shell{padding:0}.onb-card{padding:16px;max-width:none;min-height:100vh}.onb-progress{gap:12px}.onb-back-inline{padding:8px;width:36px;height:36px}.onb-back-text{display:none}.onb-progress-main{display:flex;justify-content:flex-end}.onb-progress-pills{display:flex;justify-content:center}.onb-progress-pill{width:34px;height:34px;padding:8px;border-radius:999px;font-size:0}.onb-progress-pill .onb-progress-mark{width:auto;height:auto;background:transparent!important;box-shadow:none!important;color:inherit}.onb-progress-pill span:not(.onb-progress-mark){display:none}.onb-grid,.onb-grid.three{grid-template-columns:1fr}.hours-row{display:grid;grid-template-columns:1fr 1fr}.onb-actions{flex-direction:column;align-items:stretch}.onb-actions .onb-btn-primary{order:1;width:100%}.onb-actions .onb-help-link{order:2}.onb-help-link{text-align:center}.service-row,.manual-header{grid-template-columns:minmax(0,1fr) 80px}.provider-card{min-height:auto}.platform-panel{padding:20px}.platform-panel-head{flex-direction:column}.number-box{align-items:flex-start;flex-direction:column}}
`,
    ],
    [],
  );

  if (loading) {
    return (
      <UserLayout styles={mergedStyles} scripts={userSettingsScripts} scriptPrefix="user-onboarding-live">
        <main className="main"><section className="onb-shell"><div className="onb-card"><p>Loading onboarding...</p></div></section></main>
      </UserLayout>
    );
  }

  return (
    <UserLayout styles={mergedStyles} scripts={userSettingsScripts} scriptPrefix="user-onboarding-live">
      <main className="main">
        <section className="onb-shell">
          <div className={`onb-card ${currentStep === 4 ? 'wide' : ''}`}>
            <Progress
              currentStep={currentStep}
              onBack={() => setCurrentStep((currentStep - 1) as WizardStep)}
            />
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

  function renderStep1() {
    return (
      <div>
        <h1 className="onb-title">Tell us about your business</h1>
        <p className="onb-subtitle">This helps RingBooker answer calls correctly for your clients</p>
        <div className="onb-stack" style={{ marginTop: 24 }}>
          <div className="onb-field">
            <label>Business name</label>
            <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Happy Nails & Spa" />
          </div>
          <div className="onb-field">
            <label>Your business phone number</label>
            <input type="tel" value={businessPhone} onChange={(event) => setBusinessPhone(event.target.value)} placeholder="(555) 123-4567" />
            <p className="onb-help">This is the number your clients call to book appointments</p>
          </div>
        </div>
        <div className="onb-field" style={{ marginTop: 24 }}>
          <label>What type of business are you?</label>
          <div className="onb-grid">
            {VERTICAL_OPTIONS.map((item) => (
              <button key={item.id} type="button" className={`choice-card ${vertical === item.id ? 'active' : ''}`} onClick={() => setVertical(item.id)}>
                <span className="emoji">{item.emoji}</span>
                <h4>{item.label}</h4>
              </button>
            ))}
          </div>
        </div>
        <div className="onb-actions">
          <span />
          <button className="onb-btn-primary" type="button" onClick={continueStep1} disabled={saving}>{saving ? 'Saving...' : 'Continue →'}</button>
        </div>
      </div>
    );
  }

  function renderStep2() {
    const countryTimezones = COUNTRY_TIMEZONES.find((item) => item.country === selectedCountry);
    const selectedTimezoneMeta = countryTimezones?.timezones.find((zone) => zone.value === timezone) ?? countryTimezones?.timezones[0];

    return (
      <div>
        <h1 className="onb-title">When are you open?</h1>
        <div className="onb-stack" style={{ marginTop: 24 }}>
          <section>
          <p className="onb-section-title">Business Hours</p>
          <div className="hours-list">
            {DAYS.map(([day, label]) => (
              <div className={`hours-row ${hours[day].open ? '' : 'closed'}`} key={day}>
                <strong className="hours-day">{label}</strong>
                <label className={`toggle-pill ${hours[day].open ? 'active' : ''}`}>
                  <input type="checkbox" checked={hours[day].open} onChange={(event) => setHours({ ...hours, [day]: { ...hours[day], open: event.target.checked } })} />
                  <span className="toggle-dot" />
                  {hours[day].open ? 'Open' : 'Closed'}
                </label>
                <select disabled={!hours[day].open} value={hours[day].from} onChange={(event) => setHours({ ...hours, [day]: { ...hours[day], from: event.target.value } })}>{TIME_OPTIONS.map((time) => <option key={time} value={time}>{formatTimeLabel(time)}</option>)}</select>
                <select disabled={!hours[day].open} value={hours[day].to} onChange={(event) => setHours({ ...hours, [day]: { ...hours[day], to: event.target.value } })}>{TIME_OPTIONS.map((time) => <option key={time} value={time}>{formatTimeLabel(time)}</option>)}</select>
              </div>
            ))}
          </div>
          </section>
          <section>
            <div className="onb-field">
              <label>Country</label>
              <select value={selectedCountry} onChange={(event) => {
                const nextCountry = event.target.value;
                const nextCountryMeta = COUNTRY_TIMEZONES.find((item) => item.country === nextCountry);
                setSelectedCountry(nextCountry);
                if (nextCountryMeta && !nextCountryMeta.timezones.some((zone) => zone.value === timezone)) {
                  setTimezone(nextCountryMeta.timezones[0].value);
                }
              }}>
                <option value="">Select your country...</option>
                {COUNTRY_TIMEZONES.map((item) => <option key={item.country} value={item.country}>{item.flag} {item.country}</option>)}
              </select>
            </div>
            {countryTimezones ? (
              <div className="onb-field">
                <label>Timezone</label>
                {countryTimezones.timezones.length === 1 && selectedTimezoneMeta ? (
                  <div className="timezone-readonly">{countryTimezones.flag} {selectedTimezoneMeta.label} ({selectedTimezoneMeta.offset})</div>
                ) : (
                  <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                    {countryTimezones.timezones.map((zone) => <option key={zone.value} value={zone.value}>{zone.label} ({zone.offset})</option>)}
                  </select>
                )}
              </div>
            ) : null}
          </section>
          <section>
            <div className="onb-field">
              <label>Languages for call handling</label>
              <div className="lang-list">
                <label className="lang-pill locked"><input type="checkbox" checked disabled /> EN ✓ <span className="required-badge">Required</span></label>
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
            </div>
          </section>
        </div>
        <div className="onb-actions">
          <span />
          <button className="onb-btn-primary" type="button" onClick={continueStep2} disabled={saving}>{saving ? 'Saving...' : 'Continue →'}</button>
        </div>
      </div>
    );
  }

  function renderStep3() {
    return (
      <div>
        <h1 className="onb-title">What services do you offer?</h1>
        <p className="onb-subtitle">RingBooker uses this to answer questions about pricing and services</p>
        <div className="step3-stack">
          <div className="provider-card recommended step3-card">
            <span className="recommended-badge">✨ Recommended</span>
            <h3 className="onb-card-title">🌐 Read from your website</h3>
            <p className="onb-subtitle">Paste your website URL and we&apos;ll automatically learn your services, prices, and hours</p>
            <input className="step3-website-input" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://happynails.com" />
            <button className="onb-btn-primary provider-action step3-read-btn" type="button" onClick={readWebsite} disabled={websiteLoading}>{websiteLoading ? 'Reading your website...' : 'Read Website →'}</button>
            {websiteReadSuccess ? <div className="read-success">Found {servicesFound} services on your website ✓</div> : null}
          </div>
          <div className="step3-or">or</div>
          <div className="provider-card step3-card">
            <h3 className="onb-card-title">Enter services manually</h3>
            <div className="manual-header"><span>Service Name</span><span>Price (optional)</span></div>
            {services.map((service, index) => (
              <div className="service-row" key={index}>
                <input value={service.name} onChange={(event) => setServiceRow(index, { ...service, name: event.target.value })} placeholder="e.g. Gel Manicure, Haircut..." />
                <div className="price-wrap"><span>$</span><input type="number" value={service.price} onChange={(event) => setServiceRow(index, { ...service, price: Number(event.target.value) })} placeholder="0" /></div>
              </div>
            ))}
            <button className="add-service-btn" type="button" onClick={() => setServices([...services, { name: '', duration_min: 60, price: 0 }])}>+ Add service</button>
          </div>
        </div>
        <div className="onb-actions step3-actions">
          <button className="onb-help onb-help-link" type="button" onClick={() => setCurrentStep(4)}>Skip for now →</button>
          <button className="onb-btn-primary" type="button" onClick={continueStep3} disabled={saving}>{saving ? 'Saving...' : 'Continue →'}</button>
        </div>
      </div>
    );
  }

  function renderStep4() {
    return (
      <div>
        <h1 className="onb-title">You&apos;re almost ready!</h1>
        <p className="onb-subtitle">Connect your booking software and set up call handling — both optional</p>
        <p className="onb-section-title">Booking software <span className="onb-optional-badge">Optional</span></p>
        <div className="platform-selector">
          <select id="booking-platform-select" value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value)}>
            <option value="">Select your booking platform...</option>
            <optgroup label="Live Integration">
              <option value="square_appointments">Square Appointments</option>
              <option value="vagaro">Vagaro</option>
            </optgroup>
            <optgroup label="Booking Link">
              <option value="glossgenius">GlossGenius</option>
              <option value="fresha">Fresha</option>
              <option value="booksy">Booksy</option>
            </optgroup>
            <optgroup label="Coming Soon">
              <option value="mindbody" disabled>Mindbody</option>
            </optgroup>
            <option value="none">I don't use booking software</option>
          </select>
        </div>
        {selectedProvider ? renderPlatformPanel(selectedProvider) : null}
        <button className="onb-help onb-help-link" type="button" onClick={() => document.getElementById('call-forwarding-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Skip — I'll connect my booking software later →</button>
        <div className="section-divider">then</div>
        <div id="call-forwarding-section">
          <p className="onb-section-title">Call handling <span className="onb-optional-badge">Optional</span></p>
          <CallForwardingSetup
            ringbookerNumber={telnyxNumber || businessPhone || ''}
            callForwardingPageUrl="/current-number/call-forwarding"
            initialMethod={setupMethod}
            initialCarrier={forwardingCarrier}
            initialCountry={forwardingCountry}
            initialForwardingType={forwardingType}
            onComplete={(method) => {
              setForwardingConfirmed(true);
              setSetupMethod(method);
              fetch('/api/backend/user/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ setup_method: method }),
              }).catch(console.error);
            }}
            onSkip={() => {}}
          />
          {forwardingConfirmed ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#16a34a', marginTop: 8 }}><span>✓</span><span>Call handling configured</span></div> : null}
        </div>
        <div className="onb-actions">
          <button className="onb-help onb-help-link" type="button" onClick={completeSetup}>I'll finish this later →</button>
          <button id="complete-setup-btn" className="onb-btn-primary" type="button" onClick={completeSetup}>{forwardingConfirmed ? 'Forwarding Confirmed - Complete Setup ✓' : 'Complete Setup ✓'}</button>
        </div>
      </div>
    );
  }

  function renderPlatformPanel(providerId: string) {
    if (providerId === 'none') {
      return (
        <div className="no-platform-box">
          <div className="no-platform-icon">💬</div>
          <p className="onb-subtitle">No problem!</p>
          <p className="onb-subtitle">RingBooker works great without booking software. We&apos;ll capture caller details and send you a full summary after every call.</p>
        </div>
      );
    }

    const provider = providers.find((item) => item.id === providerId);
    const providerLabel = provider?.label ?? providerId;
    const connected = provider?.connected === true;
    const badgeClass = connected ? 'connected' : getProviderBadgeClass(providerId);

    return (
      <div className="platform-panel">
        {connected ? <div className="connected-banner">✓ Connected to {providerLabel}</div> : null}
        <div className="platform-panel-head">
          <div className="platform-title">
            <img className="platform-logo-img" src={getProviderLogoSrc(providerId)} alt={`${providerLabel} logo`} />
            <div>
              <div className="platform-title-name">{providerLabel}</div>
              <div className="platform-title-desc">{PROVIDER_DESCRIPTIONS[providerId] ?? 'Connect this provider to RingBooker.'}</div>
            </div>
          </div>
          <span className={`provider-badge ${badgeClass}`}>{connected ? 'Connected ✓' : PROVIDER_BADGES[providerId]}</span>
        </div>

        {providerId === 'square_appointments' ? (
          <>
            <p className="onb-subtitle">Direct calendar connection — RingBooker checks availability and books appointments in real time.</p>
            <div className="feature-list">
              <span><strong>✓</strong> Real-time availability checking</span>
              <span><strong>✓</strong> Direct appointment booking</span>
              <span><strong>✓</strong> Stylist preference matching</span>
            </div>
            {!connected ? <a className="onb-btn-primary" href="/api/backend/user/calendar/providers/square_appointments/connect/start">Connect Square Appointments →</a> : null}
          </>
        ) : null}

        {providerId === 'vagaro' ? (
          <>
            <p className="onb-subtitle">RingBooker checks your Vagaro availability and sends callers your booking link via SMS.</p>
            <div className="feature-list">
              <span><strong>✓</strong> Real-time availability checking</span>
              <span><strong>✓</strong> Booking link sent via SMS</span>
            </div>
            <div className="platform-subsection">
              <h4>Connect Vagaro</h4>
              <div className="platform-field"><label>Client ID</label><input placeholder="Client ID" value={vagaroForm.clientId} onChange={(event) => setVagaroForm({ ...vagaroForm, clientId: event.target.value })} /></div>
              <div className="platform-field"><label>Client Secret</label><input placeholder="Client Secret" value={vagaroForm.clientSecretKey} onChange={(event) => setVagaroForm({ ...vagaroForm, clientSecretKey: event.target.value })} /></div>
              <div className="platform-field"><label>Region</label><select value={vagaroForm.region} onChange={(event) => setVagaroForm({ ...vagaroForm, region: event.target.value })}>
                  <option value="us">US</option>
                  <option value="ca">Canada</option>
                  <option value="uk">UK</option>
                  <option value="au">Australia</option>
                </select></div>
              <div className="platform-field"><label>Business ID</label><input placeholder="Business ID" value={vagaroForm.businessId} onChange={(event) => setVagaroForm({ ...vagaroForm, businessId: event.target.value })} /></div>
              <button className="onb-btn-primary" type="button" onClick={connectVagaro}>Connect Vagaro →</button>
            </div>
            <div className="platform-subsection">
              <h4>Booking Link</h4>
              <div className="platform-field">
                <label>Your Vagaro booking URL (optional)</label>
                <input placeholder="https://vagaro.com/your-business" value={vagaroForm.bookingUrl} onChange={(event) => setVagaroForm({ ...vagaroForm, bookingUrl: event.target.value })} />
              </div>
              <button className="onb-btn-secondary" type="button" onClick={connectVagaro}>Save Booking Link</button>
            </div>
          </>
        ) : null}

        {BOOKING_LINK_PROVIDERS.includes(providerId as (typeof BOOKING_LINK_PROVIDERS)[number]) ? (
          <>
            <p className="onb-subtitle">{getBookingLinkDescription(providerId)}</p>
            <div className="feature-list">
              <span><strong>✓</strong> Booking link sent via SMS to callers</span>
              <span className="no"><strong>✗</strong> No direct calendar integration available</span>
            </div>
            <div className="platform-subsection">
              <div className="platform-field">
                <label>{getBookingLinkInputLabel(providerId)}</label>
                <input value={bookingLinkInputs[providerId] ?? ''} onChange={(event) => setBookingLinkInputs({ ...bookingLinkInputs, [providerId]: event.target.value })} placeholder={getBookingLinkPlaceholder(providerId)} />
              </div>
              {providerId === 'glossgenius' ? <p className="onb-help">Find this in your GlossGenius dashboard → Online Booking</p> : null}
              <button className="onb-btn-primary" type="button" onClick={() => saveBookingLink(providerId)}>Save booking link →</button>
            </div>
          </>
        ) : null}

        {providerId === 'mindbody' ? (
          <p className="onb-subtitle">Mindbody integration is coming soon. We&apos;ll notify you when it&apos;s available.</p>
        ) : null}

        {connected ? <button className="disconnect-link" type="button">Disconnect</button> : null}
        {connected ? <button className="connect-another" type="button" onClick={() => setSelectedProvider('')}>+ Connect another platform</button> : null}
      </div>
    );
  }

  function setServiceRow(index: number, value: ServiceItem) {
    setServices(services.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }
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

function formatTimeLabel(value: string): string {
  const [hourRaw, minute = '00'] = value.split(':');
  const hour = Number(hourRaw);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function getProviderBadgeClass(providerId: string): string {
  if (providerId === 'square_appointments') return 'live';
  if (providerId === 'vagaro') return 'combo';
  if (providerId === 'mindbody') return 'soon';
  return 'link';
}

function getProviderLogoSrc(providerId: string): string {
  if (providerId === 'square_appointments') return '/images/square.png';
  if (providerId === 'mindbody') return '/images/mindbody.webp';
  return `/images/${providerId}.png`;
}

function getBookingLinkDescription(providerId: string): string {
  if (providerId === 'fresha') {
    return 'When callers want to book, RingBooker sends your Fresha booking link via SMS automatically.';
  }
  if (providerId === 'booksy') {
    return 'When callers want to book, RingBooker sends your Booksy booking link via SMS automatically.';
  }
  return 'When callers want to book, RingBooker sends your GlossGenius booking link via SMS automatically.';
}

function getBookingLinkInputLabel(providerId: string): string {
  if (providerId === 'fresha') return 'Your Fresha booking link';
  if (providerId === 'booksy') return 'Your Booksy booking link';
  return 'Your GlossGenius booking link';
}

function getBookingLinkPlaceholder(providerId: string): string {
  if (providerId === 'fresha') return 'https://fresha.com/your-business-name';
  if (providerId === 'booksy') return 'https://booksy.com/en-us/your-profile';
  return 'https://glossgenius.com/your-business or your custom domain';
}

function toggleLanguage(current: string[], language: string, checked: boolean): string[] {
  const next = new Set(['en', ...current]);
  if (checked) next.add(language);
  else next.delete(language);
  return [...next];
}
