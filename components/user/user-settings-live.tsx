'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalNav } from '@/components/user/user-portal-nav';
import { userSettingsScripts, userSettingsStyles } from '@/components/user/user-settings';

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
type ShopSettings = {
  id: string;
  name: string;
  phone_number: string;
  user_name?: string | null;
  user_phone: string;
  backup_phone?: string | null;
  address?: string | null;
  timezone: string;
  services: ServiceItem[];
  hours: Record<string, BusinessHoursEntry>;
  cancel_policy: string;
  promotions?: string | null;
  booking_url?: string | null;
  ai_voice?: string | null;
  ai_welcome_message?: string | null;
  ai_custom_instructions?: string | null;
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
    merchantId?: string | null;
    locationId?: string | null;
    serviceVariationId?: string | null;
    teamMemberId?: string | null;
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
  user_name: string;
  user_phone: string;
  backup_phone: string;
  address: string;
  timezone: string;
  booking_url: string;
  cancel_policy: string;
  promotions: string;
  services: ServiceItem[];
  hours: Record<string, BusinessHoursEntry>;
  ai_voice: string;
  ai_welcome_message: string;
  ai_custom_instructions: string;
  allow_transfers: boolean;
  allow_callbacks: boolean;
  send_reminder_sms: boolean;
  send_review_request_sms: boolean;
  send_missed_call_followup_sms: boolean;
};

type SettingsTabId =
  | 'business'
  | 'services-hours'
  | 'ai-call-behavior'
  | 'messaging'
  | 'integrations';

/** Logos under /public/images — used in Calendar integrations cards. */
const CALENDAR_PROVIDER_LOGOS: Record<string, string> = {
  vagaro: '/images/vagaro.png',
  square_appointments: '/images/square.png',
  mindbody: '/images/mindbody.webp',
  booksy: '/images/booksy.png',
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
  'Thanks for calling {shop}. How can I help you today?',
  'Welcome to {shop}. I can help with bookings, pricing, and availability.',
  'Hi, this is the AI booking desk for {shop}. What service would you like today?',
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

const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string; description: string }> = [
  { id: 'business', label: 'Business', description: 'Profile, policy, and promo details.' },
  { id: 'services-hours', label: 'Services & Hours', description: 'What you offer and when you are open.' },
  { id: 'ai-call-behavior', label: 'AI Call Behavior', description: 'Voice, greeting, and call handling.' },
  { id: 'messaging', label: 'Messaging', description: 'Reminders, reviews, and follow-up SMS.' },
  { id: 'integrations', label: 'Integrations', description: 'Calendar providers and booking targets.' },
];

const REQUIRED_PLAN_BY_CAPABILITY: Partial<Record<keyof ShopCapabilities, ShopPlan>> = {
  edit_ai_voice: 'professional',
  edit_ai_greeting: 'professional',
  edit_reminder_sms: 'professional',
  edit_review_request_sms: 'professional',
  edit_ai_custom_instructions: 'enterprise',
};

function cloneHours(hours: Record<string, BusinessHoursEntry>) {
  return JSON.parse(JSON.stringify(hours)) as Record<string, BusinessHoursEntry>;
}

function normalizeGreeting(template: string, shopName: string) {
  return template.replaceAll('{shop}', shopName || 'your salon');
}

function buildInitialState(shop: ShopSettings): SettingsState {
  return {
    user_name: shop.user_name ?? '',
    user_phone: shop.user_phone,
    backup_phone: shop.backup_phone ?? '',
    address: shop.address ?? '',
    timezone: shop.timezone,
    booking_url: shop.booking_url ?? '',
    cancel_policy: shop.cancel_policy,
    promotions: shop.promotions ?? '',
    services: shop.services,
    hours: cloneHours(shop.hours),
    ai_voice: shop.ai_voice ?? 'Aoede',
    ai_welcome_message: shop.ai_welcome_message ?? normalizeGreeting(AI_GREETING_PRESETS[0], shop.name),
    ai_custom_instructions: shop.ai_custom_instructions ?? '',
    allow_transfers: shop.allow_transfers,
    allow_callbacks: shop.allow_callbacks,
    send_reminder_sms: shop.send_reminder_sms,
    send_review_request_sms: shop.send_review_request_sms,
    send_missed_call_followup_sms: shop.send_missed_call_followup_sms,
  };
}

function getPresetMatch(value: string, presets: string[]) {
  return presets.includes(value) ? value : 'custom';
}

function getHourPresetId(hours: Record<string, BusinessHoursEntry>) {
  const serialized = JSON.stringify(hours);
  const match = HOURS_PRESETS.find((preset) => JSON.stringify(preset.hours) === serialized);
  return match?.id ?? 'custom';
}

export function UserSettingsLive() {
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [capabilities, setCapabilities] = useState<ShopCapabilities | null>(null);
  const [form, setForm] = useState<SettingsState | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [cancelPreset, setCancelPreset] = useState<string>('custom');
  const [promoPreset, setPromoPreset] = useState<string>('custom');
  const [greetingPreset, setGreetingPreset] = useState<string>('custom');
  const [hourPreset, setHourPreset] = useState<string>('custom');
  const [activeTab, setActiveTab] = useState<SettingsTabId>('business');
  const [calendarProviders, setCalendarProviders] = useState<CalendarProviderSummary[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<string | null>(null);
  const [loadingCalendarProviders, setLoadingCalendarProviders] = useState(false);
  const [squareOptions, setSquareOptions] = useState<SquareOptionsResponse['options'] | null>(null);
  const [loadingSquareOptions, setLoadingSquareOptions] = useState(false);
  const [squareLocationId, setSquareLocationId] = useState('');
  const [squareServiceVariationId, setSquareServiceVariationId] = useState('');
  const [squareTeamMemberId, setSquareTeamMemberId] = useState('');
  const [savingSquareConfig, setSavingSquareConfig] = useState(false);

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
        setCapabilities(body.capabilities);
        const nextState = buildInitialState(nextShop);
        setForm(nextState);
        setCancelPreset(getPresetMatch(nextState.cancel_policy, CANCEL_POLICY_PRESETS));
        setPromoPreset(getPresetMatch(nextState.promotions, PROMOTION_PRESETS));
        setGreetingPreset(getPresetMatch(nextState.ai_welcome_message, AI_GREETING_PRESETS.map((item) => normalizeGreeting(item, nextShop.name))));
        setHourPreset(getHourPresetId(nextState.hours));
      })
      .catch(() => {
        if (active) setStatus('network_error');
      });
    return () => {
      active = false;
    };
  }, []);

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

  async function loadCalendarProviders() {
    setLoadingCalendarProviders(true);
    try {
      const response = await fetch('/api/backend/user/calendar/providers');
      const body = (await response.json()) as CalendarProvidersResponse;
      if (!response.ok || !body.ok || !body.providers) {
        setCalendarStatus(body.error ?? 'unable_to_load_calendar_providers');
        return;
      }
      setCalendarProviders(body.providers);
      const square = body.providers.find((item) => item.id === 'square_appointments');
      if (square?.details?.locationId) setSquareLocationId(square.details.locationId);
      if (square?.details?.serviceVariationId) setSquareServiceVariationId(square.details.serviceVariationId);
      if (square?.details?.teamMemberId) setSquareTeamMemberId(square.details.teamMemberId);
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

  useEffect(() => {
    if (squareProvider?.connected && !squareOptions) {
      void loadSquareOptions();
    }
  }, [squareProvider?.connected]);

  const serviceChoices = useMemo(() => {
    const selected = new Map((form?.services ?? []).map((item) => [item.name, item]));
    return SERVICE_CATALOG.map((item) => ({
      ...item,
      selected: selected.has(item.name),
      current: selected.get(item.name) ?? item,
    })).concat(
      (form?.services ?? [])
        .filter((item) => !SERVICE_CATALOG.some((catalogItem) => catalogItem.name === item.name))
        .map((item) => ({
          key: item.name.toLowerCase().replace(/\s+/g, '-'),
          name: item.name,
          description: 'Imported from current shop settings.',
          duration_min: item.duration_min,
          price: item.price,
          selected: true,
          current: item,
        })),
    );
  }, [form?.services]);

  if (!shop || !capabilities || !form) {
    return (
      <UserLayout styles={userSettingsStyles} scripts={userSettingsScripts} scriptPrefix="user-settings-live">
        <section className="card" style={{ margin: 24 }}>
          <p className="sub">{status === null ? 'Loading settings...' : `Unable to load settings: ${status}`}</p>
        </section>
      </UserLayout>
    );
  }

  const currentCapabilities = capabilities;
  const currentForm = form;

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

  function updateHours(day: (typeof DAY_ORDER)[number], next: BusinessHoursEntry) {
    patchState('hours', { ...currentForm.hours, [day]: next });
    setHourPreset('custom');
  }

  async function commitSettingsPatch(sectionId: string, patch: Record<string, unknown>) {
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
        <aside className="sidebar">
          <div className="sidebar-inner">
            <div className="brand">
              <div className="brand-mark">
                <div className="brand-ripple r3" />
                <div className="brand-ripple r2" />
                <div className="brand-core">
                  <svg viewBox="0 0 24 24">
                    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#fff" stroke="none" />
                  </svg>
                </div>
              </div>
              <span>RingBooker</span>
            </div>
            <div className="workspace">
              <h3>{shop.name}</h3>
              <p>{shop.plan[0].toUpperCase() + shop.plan.slice(1)} plan · AI agent {shop.active ? 'active' : 'paused'} · Number {shop.phone_number}</p>
            </div>
            <UserPortalNav active="settings" />
            <div className="sidebar-spacer" />
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Business settings and AI behavior.</h1>
              <p>Choose how RingBooker should answer, what it can offer, and which automations your current plan unlocks for this shop.</p>
            </div>
            <div className="top-actions">
              <span className="plan-chip">{shop.plan[0].toUpperCase() + shop.plan.slice(1)} plan</span>
              <a className="btn" href="/user/billing">See upgrade options</a>
            </div>
          </div>

          <div className="tab-strip" role="tablist" aria-label="Settings tabs">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                title={tab.description}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-button-icon">
                  <SettingsTabIcon tabId={tab.id} />
                </span>
                <span className="tab-button-body">
                  <strong>{tab.label}</strong>
                  <span className="tab-button-desc">{tab.description}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="section-stack">
            {activeTab === 'integrations' ? (
            <section className="card">
              <div className="panel-head">
                <div>
                  <h3>Calendar integrations</h3>
                  <p className="sub">Connect once, then choose location and service variation so the AI can check availability and create bookings correctly.</p>
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

              <div className="calendar-int-grid">
                {calendarProviders.map((provider) => {
                  const isSquare = provider.id === 'square_appointments';
                  const logoSrc = CALENDAR_PROVIDER_LOGOS[provider.id] ?? '/images/calendar.png';
                  const cardClass = [
                    'calendar-int-card',
                    isSquare && provider.connected ? 'connected-active' : '',
                    !isSquare ? 'soon' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  const statusCopy = isSquare
                    ? provider.connected
                      ? provider.configured
                        ? 'Connected and configured — live availability and booking to Square.'
                        : 'Connected. Pick location and service below, then save.'
                      : 'OAuth to Square, then choose location and service for the AI.'
                    : 'Integration is on the roadmap.';

                  return (
                    <div key={provider.id} className={cardClass}>
                      <div className="calendar-int-head">
                        <div className="calendar-int-logo-wrap">
                          <img
                            src={logoSrc}
                            alt={`${provider.label} logo`}
                            width={52}
                            height={52}
                            loading="lazy"
                          />
                        </div>
                        <span className="calendar-int-name">{provider.label}</span>
                      </div>
                      <p className="calendar-int-desc">{statusCopy}</p>
                      <div className="calendar-int-actions">
                        {isSquare ? (
                          <>
                            <button
                              type="button"
                              className="btn purple"
                              onClick={() => {
                                window.location.href =
                                  '/api/backend/user/calendar/providers/square_appointments/connect/start';
                              }}
                            >
                              {provider.connected ? 'Reconnect' : 'Connect'}
                            </button>
                            {provider.connected ? (
                              <>
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
                                  {loadingSquareOptions ? 'Loading…' : 'Reload options'}
                                </button>
                              </>
                            ) : null}
                          </>
                        ) : (
                          <span className="calendar-int-badge" aria-label="Coming soon">
                            Soon
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {squareProvider?.connected ? (
              <div className="card-section" style={{ marginTop: 18 }}>
                <div className="hint-row">
                  <strong className="option-title">Square booking targets</strong>
                  <span className="hint-copy">Choose the location and service the AI should use.</span>
                </div>
                  <div className="form-grid" style={{ marginTop: 12 }}>
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
                      <select value={squareServiceVariationId} onChange={(event) => setSquareServiceVariationId(event.target.value)}>
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
                        className="btn purple"
                        disabled={savingSquareConfig || !squareLocationId || !squareServiceVariationId}
                        onClick={async () => {
                          setSavingSquareConfig(true);
                          try {
                            const response = await fetch('/api/backend/user/calendar/providers/square_appointments/configure', {
                              method: 'POST',
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({
                                locationId: squareLocationId,
                                serviceVariationId: squareServiceVariationId,
                                teamMemberId: squareTeamMemberId || undefined,
                              }),
                            });
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

              {calendarStatus ? (
                <div className="note" style={{ marginTop: 14 }}>{calendarStatus}</div>
              ) : null}
            </section>
            ) : null}

            {activeTab === 'business' ? (
            <section className="grid grid-2">
              <form
                className="card"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitSettingsPatch('business-profile', {
                    user_name: form.user_name,
                    user_phone: form.user_phone,
                    backup_phone: form.backup_phone || null,
                    address: form.address || null,
                    timezone: form.timezone,
                    booking_url: form.booking_url.trim() ? form.booking_url.trim() : null,
                  });
                }}
              >
                <div className="panel-head"><div><h3>Business profile</h3><p className="sub">Keep core shop details accurate so the AI stays grounded in real data.</p></div></div>
                <div className="form-grid">
                  <div className="field"><label>Shop display name</label><input value={form.user_name} onChange={(event) => patchState('user_name', event.target.value)} /></div>
                  <div className="field"><label>Main user phone</label><input value={form.user_phone} onChange={(event) => patchState('user_phone', event.target.value)} /></div>
                  <div className="field"><label>Backup phone</label><input value={form.backup_phone} onChange={(event) => patchState('backup_phone', event.target.value)} placeholder="Optional handoff line" /></div>
                  <div className="field"><label>Timezone</label><select value={form.timezone} onChange={(event) => patchState('timezone', event.target.value)}><option value="America/Los_Angeles">America/Los_Angeles</option><option value="America/New_York">America/New_York</option><option value="America/Chicago">America/Chicago</option><option value="America/Denver">America/Denver</option></select></div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}><label>Address</label><input value={form.address} onChange={(event) => patchState('address', event.target.value)} /></div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}><label>Booking link</label><input value={form.booking_url} onChange={(event) => patchState('booking_url', event.target.value)} placeholder="https://..." /></div>
                </div>
                <div className="settings-save-footer">
                  <button type="submit" className="btn purple" disabled={savingSection !== null}>
                    {savingSection === 'business-profile' ? 'Saving...' : 'Save business profile'}
                  </button>
                </div>
              </form>

              <form
                className="card"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitSettingsPatch('business-policies', {
                    cancel_policy: form.cancel_policy,
                    promotions: form.promotions || null,
                  });
                }}
              >
                <div className="panel-head"><div><h3>Policies and promos</h3><p className="sub">Use presets first so callers hear clean, consistent rules without extra typing.</p></div></div>
                <div className="card-section">
                  <div>
                    <div className="hint-row"><strong className="option-title">Cancellation policy</strong><span className="hint-copy">Choose a preset, then edit only if your shop needs a special case.</span></div>
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
                      <textarea value={form.cancel_policy} onChange={(event) => {
                        setCancelPreset('custom');
                        patchState('cancel_policy', event.target.value);
                      }} />
                    </div>
                  </div>

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
                    <div className="field" style={{ marginTop: 14 }}>
                      <label>Promotion text</label>
                      <textarea value={form.promotions} onChange={(event) => {
                        setPromoPreset('custom');
                        patchState('promotions', event.target.value);
                      }} placeholder="Optional. Leave blank if you are not running a promotion." />
                    </div>
                  </div>
                </div>
                <div className="settings-save-footer">
                  <button type="submit" className="btn purple" disabled={savingSection !== null}>
                    {savingSection === 'business-policies' ? 'Saving...' : 'Save policies & promos'}
                  </button>
                </div>
              </form>
            </section>
            ) : null}

            {activeTab === 'services-hours' ? (
            <section className="grid grid-2">
              <form
                className="card"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitSettingsPatch('services', { services: form.services });
                }}
              >
                <div className="panel-head"><div><h3>Services</h3><p className="sub">Tap to include common services. Duration and price stay editable in a lightweight way.</p></div></div>
                <div className="services-grid">
                  {serviceChoices.map((service) => (
                    <div key={service.key} className={`service-chip ${service.selected ? 'active' : ''}`}>
                      <div className="service-copy">
                        <h4>{service.name}</h4>
                        <p>{service.description}</p>
                      </div>
                      <button type="button" className={`btn ${service.selected ? '' : 'purple'}`} onClick={() => toggleService(service)}>
                        {service.selected ? 'Remove' : 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
                {form.services.length > 0 ? (
                  <div className="card-section" style={{ marginTop: 16 }}>
                    {form.services.map((service) => (
                      <div key={service.name} className="service-controls">
                        <div className="small-field">
                          <label>{service.name} duration</label>
                          <select value={String(service.duration_min)} onChange={(event) => updateService(service.name, { duration_min: Number(event.target.value) })}>
                            {[15, 30, 45, 60, 75, 90, 120, 150].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
                          </select>
                        </div>
                        <div className="small-field">
                          <label>{service.name} price</label>
                          <input type="number" min={0} value={service.price} onChange={(event) => updateService(service.name, { price: Number(event.target.value) })} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="note" style={{ marginTop: 16 }}>Pick at least one service so availability checks and voice bookings stay consistent.</div>
                )}
                <div className="settings-save-footer">
                  <button type="submit" className="btn purple" disabled={savingSection !== null}>
                    {savingSection === 'services' ? 'Saving...' : 'Save services'}
                  </button>
                </div>
              </form>

              <form
                className="card"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitSettingsPatch('hours', { hours: form.hours });
                }}
              >
                <div className="panel-head"><div><h3>Business hours</h3><p className="sub">Start from a schedule template, then fine-tune only the days that differ.</p></div></div>
                <div className="preset-pills" style={{ marginBottom: 14 }}>
                  {HOURS_PRESETS.map((preset) => (
                    <button key={preset.id} type="button" className={`preset-pill ${hourPreset === preset.id ? 'active' : ''}`} onClick={() => applyHourPreset(preset.id)}>
                      {preset.label}
                    </button>
                  ))}
                  <button type="button" className={`preset-pill ${hourPreset === 'custom' ? 'active' : ''}`} onClick={() => setHourPreset('custom')}>Custom</button>
                </div>
                <div className="hours-grid">
                  {DAY_ORDER.map((day) => {
                    const entry = form.hours[day] ?? { closed: true };
                    const isClosed = 'closed' in entry;
                    return (
                      <div key={day} className={`hours-row ${isClosed ? 'closed' : ''}`}>
                        <div className="hours-day">{DAY_LABELS[day]}</div>
                        <div className="small-field">
                          <label>Open</label>
                          <select value={isClosed ? '09:00' : entry.open} disabled={isClosed} onChange={(event) => updateHours(day, { open: event.target.value, close: isClosed ? '18:00' : entry.close })}>
                            {TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
                          </select>
                        </div>
                        <div className="small-field">
                          <label>Close</label>
                          <select value={isClosed ? '18:00' : entry.close} disabled={isClosed} onChange={(event) => updateHours(day, { open: isClosed ? '09:00' : entry.open, close: event.target.value })}>
                            {TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
                          </select>
                        </div>
                        <label className="inline-check">
                          <input type="checkbox" checked={isClosed} onChange={(event) => updateHours(day, event.target.checked ? { closed: true } : { open: '09:00', close: '18:00' })} />
                          Closed that day
                        </label>
                      </div>
                    );
                  })}
                </div>
                <div className="settings-save-footer">
                  <button type="submit" className="btn purple" disabled={savingSection !== null}>
                    {savingSection === 'hours' ? 'Saving...' : 'Save hours'}
                  </button>
                </div>
              </form>
            </section>
            ) : null}

            {activeTab === 'ai-call-behavior' ? (
            <section className="grid grid-2">
              <form
                className="card"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitSettingsPatch('call-handling', {
                    allow_transfers: form.allow_transfers,
                    allow_callbacks: form.allow_callbacks,
                  });
                }}
              >
                <div className="panel-head"><div><h3>Call handling</h3><p className="sub">Starter plan includes practical routing controls for day-to-day salon operations.</p></div></div>
                <div className="switch-list">
                  <div className="switch-row">
                    <div className="switch-copy"><h4>Allow transfers</h4><p>Let the AI hand urgent or frustrated callers to your salon line.</p></div>
                    <div className="switch-stack"><button type="button" className={`switch ${form.allow_transfers ? 'on' : ''}`} onClick={() => patchState('allow_transfers', !form.allow_transfers)}><span className="sr-only">Toggle transfers</span></button></div>
                  </div>
                  <div className="switch-row">
                    <div className="switch-copy"><h4>Offer callbacks</h4><p>When the team is busy, the AI can queue a callback instead of losing the lead.</p></div>
                    <div className="switch-stack"><button type="button" className={`switch ${form.allow_callbacks ? 'on' : ''}`} onClick={() => patchState('allow_callbacks', !form.allow_callbacks)}><span className="sr-only">Toggle callbacks</span></button></div>
                  </div>
                </div>
                <div className="settings-save-footer">
                  <button type="submit" className="btn purple" disabled={savingSection !== null}>
                    {savingSection === 'call-handling' ? 'Saving...' : 'Save call handling'}
                  </button>
                </div>
              </form>
            </section>
            ) : null}

            {activeTab === 'messaging' ? (
            <section className="grid grid-2">
              <form
                className="card"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitSettingsPatch('messaging', {
                    send_reminder_sms: form.send_reminder_sms,
                    send_review_request_sms: form.send_review_request_sms,
                    send_missed_call_followup_sms: form.send_missed_call_followup_sms,
                  });
                }}
              >
                <div className="panel-head"><div><h3>SMS automations</h3><p className="sub">Choose which outbound messages RingBooker sends after calls and bookings.</p></div></div>
                <div className="switch-list">
                  <div className="switch-row">
                    <div className="switch-copy"><h4>Missed-call follow-up SMS</h4><p>Send a quick text when a caller hangs up before the salon team can connect.</p></div>
                    <div className="switch-stack">
                      <button type="button" className={`switch ${form.send_missed_call_followup_sms ? 'on' : ''}`} onClick={() => patchState('send_missed_call_followup_sms', !form.send_missed_call_followup_sms)} />
                    </div>
                  </div>
                  <div className="switch-row">
                    <div className="switch-copy"><h4>Reminder SMS</h4><p>Automatic appointment reminders that reduce no-shows.</p></div>
                    <div className="switch-stack">
                      <button type="button" className={`switch ${form.send_reminder_sms ? 'on' : ''}`} disabled={isLocked('edit_reminder_sms')} onClick={() => patchState('send_reminder_sms', !form.send_reminder_sms)} />
                      {renderLockCopy('edit_reminder_sms')}
                    </div>
                  </div>
                  <div className="switch-row">
                    <div className="switch-copy"><h4>Review request SMS</h4><p>Follow up completed appointments with a review request.</p></div>
                    <div className="switch-stack">
                      <button type="button" className={`switch ${form.send_review_request_sms ? 'on' : ''}`} disabled={isLocked('edit_review_request_sms')} onClick={() => patchState('send_review_request_sms', !form.send_review_request_sms)} />
                      {renderLockCopy('edit_review_request_sms')}
                    </div>
                  </div>
                </div>
                <div className="settings-save-footer">
                  <button type="submit" className="btn purple" disabled={savingSection !== null}>
                    {savingSection === 'messaging' ? 'Saving...' : 'Save messaging'}
                  </button>
                </div>
              </form>

              <div className="card">
                <div className="panel-head"><div><h3>Messaging notes</h3><p className="sub">Keep your outbound communication intentional and aligned with your plan.</p></div></div>
                <div className="card-section">
                  <div className="note">Reminder and review request controls unlock by plan. Missed-call follow-up stays available because it directly protects lost revenue from unanswered calls.</div>
                </div>
              </div>
            </section>
            ) : null}

            {activeTab === 'ai-call-behavior' ? (
            <section className="grid grid-2">
              <form
                className="card"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitSettingsPatch('ai-voice', {
                    ai_voice: form.ai_voice || null,
                    ai_welcome_message: form.ai_welcome_message.trim() ? form.ai_welcome_message : null,
                    ai_custom_instructions: form.ai_custom_instructions.trim() ? form.ai_custom_instructions : null,
                  });
                }}
              >
                <div className="panel-head"><div><h3>AI tone and voice</h3><p className="sub">These controls unlock by plan so the shop only sees the level of customization it can really use.</p></div></div>
                <div className="card-section">
                  <div className="field">
                    <label>Voice style</label>
                    <select value={form.ai_voice} disabled={isLocked('edit_ai_voice')} onChange={(event) => patchState('ai_voice', event.target.value)}>
                      {AI_VOICE_OPTIONS.map((voice) => <option key={voice.value} value={voice.value}>{voice.label}</option>)}
                    </select>
                    {renderLockCopy('edit_ai_voice')}
                  </div>

                  <div>
                    <div className="hint-row"><strong className="option-title">Greeting preset</strong>{renderLockCopy('edit_ai_greeting')}</div>
                    <div className="preset-pills" style={{ marginTop: 12 }}>
                      {AI_GREETING_PRESETS.map((preset, index) => {
                        const resolved = normalizeGreeting(preset, shop.name);
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
                      <textarea value={form.ai_welcome_message} disabled={isLocked('edit_ai_greeting')} onChange={(event) => {
                        setGreetingPreset('custom');
                        patchState('ai_welcome_message', event.target.value);
                      }} />
                    </div>
                  </div>

                  <div className="field">
                    <label>Advanced AI instructions</label>
                    <textarea value={form.ai_custom_instructions} disabled={isLocked('edit_ai_custom_instructions')} onChange={(event) => patchState('ai_custom_instructions', event.target.value)} placeholder="Only show for Enterprise shops." />
                    {renderLockCopy('edit_ai_custom_instructions')}
                  </div>
                </div>
                <div className="settings-save-footer">
                  <button type="submit" className="btn purple" disabled={savingSection !== null}>
                    {savingSection === 'ai-voice' ? 'Saving...' : 'Save AI voice & greeting'}
                  </button>
                </div>
              </form>
            </section>
            ) : null}

          </div>

          <div className="footer-inline">
            <span>Settings are plan-aware in both UI and API. Save each card separately; no hidden toggles can bypass the current shop subscription.</span>
            <span>{status === 'saved' ? 'Saved just now' : status ? status : 'After you save, changes apply on the next call flow immediately.'}</span>
          </div>
        </main>
      </div>
      <UserPortalMobileTabbar active="settings" />
      </>
    </UserLayout>
  );
}
