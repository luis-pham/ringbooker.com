'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

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

const TIMEZONES = [
  ['America/New_York', 'Eastern (America/New_York)'],
  ['America/Chicago', 'Central (America/Chicago)'],
  ['America/Denver', 'Mountain (America/Denver)'],
  ['America/Los_Angeles', 'Pacific (America/Los_Angeles)'],
  ['America/Anchorage', 'Alaska (America/Anchorage)'],
  ['Pacific/Honolulu', 'Hawaii (Pacific/Honolulu)'],
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
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [languages, setLanguages] = useState<string[]>(['en']);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [websiteLoading, setWebsiteLoading] = useState(false);
  const [websiteReadSuccess, setWebsiteReadSuccess] = useState(false);
  const [servicesFound, setServicesFound] = useState(0);
  const [services, setServices] = useState<ServiceItem[]>([{ name: '', duration_min: 60, price: 0 }]);
  const [providers, setProviders] = useState<CalendarProviderSummary[]>([]);
  const [bookingLinkInputs, setBookingLinkInputs] = useState<Record<string, string>>({});
  const [vagaroOpen, setVagaroOpen] = useState(false);
  const [vagaroForm, setVagaroForm] = useState({ clientId: '', clientSecretKey: '', region: 'us', businessId: '', bookingUrl: '' });

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONES.some(([value]) => value === detected)) setTimezone(detected);
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
    setTimezone(body.shop.timezone || 'America/Los_Angeles');
    setHours(apiHoursToWizard(body.shop.hours ?? {}));
    setLanguages(applyVerticalLanguageSelection(body.shop.vertical ?? '', body.shop.languages ?? ['en']));
    setWebsiteUrl(body.shop.website_url ?? '');
    setServices(body.shop.services.length > 0 ? body.shop.services : [{ name: '', duration_min: 60, price: 0 }]);
    setCurrentStep(normalizeStep(body.shop.current_onboarding_step));
    setLoading(false);
    void loadProviders();
  }

  async function loadProviders() {
    const response = await fetch('/api/backend/user/calendar/providers');
    const body = (await response.json().catch(() => null)) as { ok?: boolean; providers?: CalendarProviderSummary[] } | null;
    if (!body?.ok) return;
    setProviders(body.providers ?? []);
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
.onb-card{background:#fff;border:1px solid #eceef4;border-radius:16px;box-shadow:0 22px 70px rgba(15,23,42,.08);padding:32px;max-width:760px;margin:0 auto}
.onb-card.wide{max-width:980px}
.onb-progress{display:grid;gap:10px;margin-bottom:28px}
.onb-step-label{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.14em;font-weight:800}
.onb-progress-pills{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.onb-progress-pill{display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid #d9deea;border-radius:999px;padding:10px 12px;color:#64748b;background:#fff;font-size:13px;font-weight:800;white-space:nowrap}
.onb-progress-pill.done{background:#ede9fe;border-color:#8b5cf6;color:#5b21b6}
.onb-progress-pill.current{background:#6d28d9;border-color:#6d28d9;color:#fff;box-shadow:0 12px 28px rgba(109,40,217,.22)}
.onb-progress-mark{width:18px;height:18px;border-radius:999px;display:inline-grid;place-items:center;background:currentColor;color:inherit;box-shadow:inset 0 0 0 999px rgba(255,255,255,.8);font-size:11px}
.onb-progress-pill.current .onb-progress-mark{background:#fff;color:#6d28d9;box-shadow:none}
.onb-progress-pill.done .onb-progress-mark{background:#6d28d9;color:#fff;box-shadow:none}
.onb-title{margin:0;color:#0f172a;font-size:clamp(30px,4vw,42px);line-height:1.04;font-weight:900;letter-spacing:-.04em}
.onb-subtitle{margin:10px 0 0;color:#64748b;font-size:17px;line-height:1.6;font-weight:500}
.onb-section-title{margin:0 0 10px;color:#111827;font-size:15px;font-weight:900;letter-spacing:-.01em}
.onb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.onb-grid.three{grid-template-columns:repeat(2,minmax(0,1fr))}
.onb-stack{display:grid;gap:18px}
.choice-card{min-height:100px;border:1px solid #e5e7eb;border-radius:18px;padding:20px;background:#fff;text-align:left;cursor:pointer;transition:.18s ease}
.choice-card:hover{background:#faf7ff;border-color:#c4b5fd;box-shadow:0 14px 32px rgba(124,58,237,.1);transform:translateY(-1px)}
.choice-card.active{background:#f3f0ff;border-color:#7c3aed;border-width:2px;box-shadow:0 16px 36px rgba(124,58,237,.15)}
.choice-card .emoji{font-size:2rem;line-height:1}.choice-card h4{margin:12px 0 0;font-size:15px;font-weight:800;color:#111827}
.onb-field{display:grid;gap:7px}.onb-field label{font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.04em}
.onb-field input,.onb-field select{border:1px solid #dfe3ec;border-radius:14px;padding:12px 13px;font:inherit;background:#fff;color:#111827}
.onb-help{font-size:13px;color:#64748b;margin:0}.onb-actions{display:flex;justify-content:space-between;gap:12px;margin-top:24px;align-items:center}
.onb-btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:999px;background:#6d28d9;color:#fff;padding:12px 32px;font-weight:800;box-shadow:0 12px 28px rgba(109,40,217,.22);cursor:pointer;text-decoration:none}
.onb-btn-primary:disabled{opacity:.6;cursor:not-allowed}.onb-btn-secondary{display:inline-flex;align-items:center;justify-content:center;border:1px solid #dbe2ee;border-radius:999px;background:#fff;color:#475569;padding:9px 24px;font-weight:800;cursor:pointer;text-decoration:none}.onb-text-link{border:0;background:transparent;color:#64748b;font-weight:800;cursor:pointer;padding:8px 0}
.hours-list{display:grid;gap:8px}.hours-row{display:grid;grid-template-columns:minmax(46px,70px) 108px 1fr 1fr;gap:10px;align-items:center;border:1px solid #eef1f6;border-radius:16px;padding:12px;background:#fff}.hours-row:nth-child(even){background:#f8fafc}.hours-row.closed select{opacity:.45;background:#f1f5f9}
.hours-day{font-weight:900;color:#111827;min-width:40px}.toggle-pill{position:relative;display:inline-flex;align-items:center;gap:8px;border:1px solid #dbe2ee;border-radius:999px;padding:8px 12px;background:#fff;font-weight:800;color:#64748b;cursor:pointer}.toggle-pill input{position:absolute;opacity:0;pointer-events:none}.toggle-dot{width:28px;height:16px;border-radius:999px;background:#cbd5e1;position:relative;transition:.18s ease}.toggle-dot:after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;transition:.18s ease}.toggle-pill.active{border-color:#8b5cf6;color:#5b21b6;background:#f5f3ff}.toggle-pill.active .toggle-dot{background:#7c3aed}.toggle-pill.active .toggle-dot:after{transform:translateX(12px)}
.lang-list{display:flex;flex-wrap:wrap;gap:10px}.check-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid #e5e7eb;border-radius:999px;padding:10px 13px;background:#fff}.lang-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid #dbe2ee;border-radius:999px;padding:10px 15px;background:#fff;color:#475569;font-weight:900;cursor:pointer}.lang-pill input{position:absolute;opacity:0;pointer-events:none}.lang-pill.selected{background:#6d28d9;border-color:#6d28d9;color:#fff}.lang-pill.locked{background:#f1f5f9;color:#475569;cursor:not-allowed}.required-badge{border-radius:999px;background:#e2e8f0;color:#475569;padding:3px 7px;font-size:10px;font-weight:900}.mini-badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;background:#dcfce7;color:#047857;padding:5px 9px;font-size:11px;font-weight:900}
.provider-card{border:1px solid #eef1f6;border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:12px;min-height:210px;background:#fff}
.provider-card.recommended{border-top:4px solid #22c55e;box-shadow:0 18px 40px rgba(34,197,94,.08)}
.provider-card.disabled{opacity:.5;background:#f8fafc;position:relative}
.provider-card.disabled:after{content:"Coming soon";position:absolute;inset:auto 16px 16px auto;border-radius:999px;background:#f59e0b;color:#fff;padding:6px 10px;font-size:11px;font-weight:900}
.provider-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.provider-head h4{margin:0}.provider-head p{margin:3px 0 0;color:#64748b;font-size:13px}
.provider-action{margin-top:auto}.provider-badge{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:900;white-space:nowrap}.provider-badge.live{background:#dcfce7;color:#047857}.provider-badge.combo{background:#6d28d9;color:#fff}.provider-badge.link{background:#f1f5f9;color:#334155}.provider-badge.soon{background:#f59e0b;color:#fff}.provider-badge.connected{background:#dcfce7;color:#047857}
.manual-header{display:grid;grid-template-columns:1fr 120px;gap:10px;color:#64748b;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.service-row{display:grid;grid-template-columns:1fr 120px;gap:10px;align-items:center}.price-wrap{position:relative}.price-wrap span{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#64748b}.price-wrap input{padding-left:28px!important}.add-service-btn{border:1px dashed #a78bfa;border-radius:14px;background:#faf7ff;color:#6d28d9;padding:13px;font-weight:900;cursor:pointer;width:100%}
.section-divider{display:flex;align-items:center;gap:12px;margin:28px 0;color:#94a3b8;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.12em}.section-divider:before,.section-divider:after{content:"";height:1px;background:#e5e7eb;flex:1}
.number-box{display:flex;align-items:center;justify-content:space-between;gap:12px;border-radius:18px;background:#111827;color:#fff;padding:16px 18px;font-weight:900}.number-copy{border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(255,255,255,.1);color:#fff;padding:8px 13px;font-weight:900}
.onb-status{margin-top:14px;padding:12px 14px;border-radius:16px;background:#f8fafc;color:#475569;font-size:14px}
.read-success{color:#047857;font-weight:800}
@media(max-width:1024px){.onb-grid.three{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.onb-shell{padding:0}.onb-card{border-radius:0;border-left:0;border-right:0;box-shadow:none;padding:20px 16px;max-width:none;min-height:100vh}.onb-progress-pills{display:flex;justify-content:center}.onb-progress-pill{width:11px;height:11px;padding:0;border-radius:999px;font-size:0}.onb-progress-pill .onb-progress-mark,.onb-progress-pill span:not(.onb-progress-mark){display:none}.onb-grid,.onb-grid.three{grid-template-columns:1fr}.hours-row{grid-template-columns:1fr 1fr}.onb-actions{flex-direction:column;align-items:stretch}.onb-actions .onb-btn-primary{width:100%}.onb-text-link{text-align:center}.service-row,.manual-header{grid-template-columns:1fr}.provider-card{min-height:auto}.number-box{align-items:flex-start;flex-direction:column}}
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
            <Progress currentStep={currentStep} />
            {currentStep > 1 ? <button className="onb-btn-secondary" type="button" onClick={() => setCurrentStep((currentStep - 1) as WizardStep)}>← Back</button> : null}
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
        <div className="onb-field" style={{ marginTop: 18 }}>
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
    return (
      <div>
        <h1 className="onb-title">When are you open?</h1>
        <div className="onb-stack" style={{ marginTop: 24 }}>
          <section>
          <h3 className="onb-section-title">Business Hours</h3>
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
              <label>Your timezone</label>
              <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>{TIMEZONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </div>
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
        <div className="onb-grid" style={{ marginTop: 18 }}>
          <div className="provider-card recommended">
            <span className="mini-badge">✨ Recommended</span>
            <h3>🌐 Read from your website</h3>
            <p className="sub">Paste your website URL and we'll automatically learn your services, prices, and hours</p>
            <input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://happynails.com" />
            <button className="onb-btn-primary provider-action" type="button" onClick={readWebsite} disabled={websiteLoading}>{websiteLoading ? 'Reading your website...' : 'Read Website →'}</button>
            {websiteReadSuccess ? <div className="read-success">Found {servicesFound} services on your website ✓</div> : null}
          </div>
          <div className="provider-card">
            <h3>Or enter manually</h3>
            <div className="manual-header"><span>Service Name</span><span>Price (optional)</span></div>
            {services.map((service, index) => (
              <div className="service-row" key={index}>
                <input value={service.name} onChange={(event) => setServiceRow(index, { ...service, name: event.target.value })} placeholder="Gel Manicure" />
                <div className="price-wrap"><span>$</span><input type="number" value={service.price} onChange={(event) => setServiceRow(index, { ...service, price: Number(event.target.value) })} placeholder="0" /></div>
              </div>
            ))}
            <button className="add-service-btn" type="button" onClick={() => setServices([...services, { name: '', duration_min: 60, price: 0 }])}>+ Add service</button>
          </div>
        </div>
        <div className="onb-actions">
          <button className="onb-text-link" type="button" onClick={() => setCurrentStep(4)}>Skip for now →</button>
          <button className="onb-btn-primary" type="button" onClick={continueStep3} disabled={saving}>{saving ? 'Saving...' : 'Continue →'}</button>
        </div>
      </div>
    );
  }

  function renderStep4() {
    return (
      <div>
        <h1 className="onb-title">You're almost ready!</h1>
        <p className="onb-subtitle">Connect your booking software (optional) and set up call forwarding</p>
        <h3>Connect your booking software</h3>
        <p className="sub">Optional — RingBooker works without this</p>
        <div className="onb-grid three" style={{ marginTop: 16 }}>
          {providers.filter((provider) => provider.id !== 'manual' && provider.id !== 'google_calendar').map((provider) => (
            <div className={`provider-card ${provider.id === 'mindbody' ? 'disabled' : ''}`} key={provider.id}>
              <div className="provider-head">
                <div><h4>{provider.label}</h4><p>{PROVIDER_DESCRIPTIONS[provider.id] ?? 'Connect this provider to RingBooker.'}</p></div>
                <span className={`provider-badge ${provider.connected ? 'connected' : getProviderBadgeClass(provider.id)}`}>{provider.connected ? 'Connected ✓' : PROVIDER_BADGES[provider.id]}</span>
              </div>
              {provider.id === 'square_appointments' && !provider.connected ? <a className="onb-btn-secondary provider-action" href="/api/backend/user/calendar/providers/square_appointments/connect/start">Connect</a> : null}
              {provider.id === 'vagaro' && !provider.connected ? (
                <>
                  <button className="onb-btn-secondary provider-action" type="button" onClick={() => setVagaroOpen(!vagaroOpen)}>Connect</button>
                  {vagaroOpen ? (
                    <div className="onb-field">
                      <input placeholder="Client ID" value={vagaroForm.clientId} onChange={(event) => setVagaroForm({ ...vagaroForm, clientId: event.target.value })} />
                      <input placeholder="Client Secret Key" value={vagaroForm.clientSecretKey} onChange={(event) => setVagaroForm({ ...vagaroForm, clientSecretKey: event.target.value })} />
                      <input placeholder="Business ID" value={vagaroForm.businessId} onChange={(event) => setVagaroForm({ ...vagaroForm, businessId: event.target.value })} />
                      <input placeholder="https://vagaro.com/your-business" value={vagaroForm.bookingUrl} onChange={(event) => setVagaroForm({ ...vagaroForm, bookingUrl: event.target.value })} />
                      <button className="onb-btn-primary" type="button" onClick={connectVagaro}>Save Vagaro</button>
                    </div>
                  ) : null}
                </>
              ) : null}
              {BOOKING_LINK_PROVIDERS.includes(provider.id as (typeof BOOKING_LINK_PROVIDERS)[number]) && !provider.connected ? (
                <div className="onb-field">
                  <input value={bookingLinkInputs[provider.id] ?? ''} onChange={(event) => setBookingLinkInputs({ ...bookingLinkInputs, [provider.id]: event.target.value })} placeholder="https://..." />
                  <button className="onb-btn-secondary provider-action" type="button" onClick={() => saveBookingLink(provider.id)}>Add booking link</button>
                </div>
              ) : null}
              {provider.id === 'mindbody' ? <button className="onb-btn-secondary provider-action" type="button" disabled>Coming soon</button> : null}
            </div>
          ))}
        </div>
        <div className="section-divider">then</div>
        <h3>Set up call forwarding</h3>
        <p className="sub">Forward your business number to RingBooker to start capturing missed calls</p>
        <div className="provider-card">
          <strong>📞 Your RingBooker number:</strong>
          <div className="number-box">
            <span>{businessPhone || 'Being assigned...'}</span>
            <button className="number-copy" type="button">Copy</button>
          </div>
          <a href="/current-number/call-forwarding" target="_blank" rel="noreferrer">View setup guides for your carrier →</a>
        </div>
        <div className="onb-actions">
          <button className="onb-text-link" type="button" onClick={completeSetup}>I'll finish this later →</button>
          <button className="onb-btn-primary" type="button" onClick={completeSetup}>Complete Setup ✓</button>
        </div>
      </div>
    );
  }

  function setServiceRow(index: number, value: ServiceItem) {
    setServices(services.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }
}

function Progress({ currentStep }: { currentStep: WizardStep }) {
  return (
    <div className="onb-progress">
      <span className="onb-step-label">Step {currentStep} of 4</span>
      <div className="onb-progress-pills" aria-label={`Step ${currentStep} of 4`}>
        {[1, 2, 3, 4].map((step) => (
          <span key={step} className={`onb-progress-pill ${step < currentStep ? 'done' : ''} ${step === currentStep ? 'current' : ''}`}>
            <span className="onb-progress-mark">{step < currentStep ? '✓' : step === currentStep ? '●' : '○'}</span>
            <span>{STEP_LABELS[step - 1]}</span>
          </span>
        ))}
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

function toggleLanguage(current: string[], language: string, checked: boolean): string[] {
  const next = new Set(['en', ...current]);
  if (checked) next.add(language);
  else next.delete(language);
  return [...next];
}
