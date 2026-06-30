'use client';

import Link from 'next/link';
import Script from 'next/script';
import { flushSync } from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';

import type { MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import { MarketingFaqAccordion } from '@/components/marketing/marketing-faq-accordion';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { DEMO_VERTICALS, type DemoServiceCategory, type DemoServiceVariant, type DemoVerticalConfig, type DemoVerticalSlug } from '@/components/marketing/demo-vertical-config';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { apiUserVisibleMessage } from '@/lib/api-user-message';
import { assistantTranscriptEndsDemo } from '@/lib/marketing/demo-end-call';
import { DIRECT_REALTIME_DEMO_DURATION_MESSAGE, userMessageForDirectDemoRealtimeJson } from '@/lib/marketing-vertical-demo-errors';
import { buildFaqPageJsonLd } from '@/lib/seo/faq-page-jsonld';
import {
  IMPORT_PROGRESS_STEPS,
  importProgressStepIndex,
} from '@/components/user/user-onboarding-live';

type DemoStage = 'idle' | 'queued' | 'dialing' | 'live' | 'completed' | 'failed';
type SitePhase = 'idle' | 'loading' | 'ready' | 'error';
type DemoApiHours = Record<string, { closed: true } | { open: string; close: string }>;
type ExtractedDemoData = {
  businessName: string;
  address: string;
  city: string;
  hours: string;
  /** Flat service names — feeds suggested-questions generation. */
  services: string[];
  /** Imported stylist/staff names — lets suggested questions name a real provider (never invented). */
  staff: string[];
  /** Policy types the salon actually documents (e.g. cancellation, no_show) — lets a suggested
   *  question reference a policy the demo agent can answer; empty when none were imported. */
  policies: string[];
  /** Parent service categories with item counts — shown as chips in the "What we found" card. */
  serviceCategories: Array<{ label: string; count: number }>;
};
type TranscriptTurn = { role: 'user' | 'assistant'; text: string };
type CallExtracted = {
  callerIntent: string | null;
  serviceRequested: string | null;
  requestedTime: string | null;
  callerName: string | null;
  additionalNotes: string | null;
  hasRealData: boolean;
};
type DemoImportSuggestions = {
  status?: string;
  businessProfile?: {
    name?: { value: string | null };
    address?: { value: string | null };
  };
  hours?: { value: DemoApiHours | null };
  staffSuggestions?: Array<{ name: string; role?: string | null }>;
  policySuggestions?: Array<{ type: string; title?: string | null }>;
  serviceCatalog?: {
    services: Array<{
      name: string;
      categoryName?: string | null;
      priceAmount?: number | null;
      durationText?: string | null;
      durationMinutes?: number | null;
      confidence?: number;
      needsReview?: boolean;
      variants?: Array<{
        label: string;
        durationMinutes?: number | null;
        durationText?: string | null;
        priceAmount?: number | null;
        priceType?: 'fixed' | 'from' | 'varies' | 'consultation';
        notes?: string | null;
      }>;
    }>;
  };
};

type PreparedDemoServiceDetail = {
  category?: string | null;
  name: string;
  price?: number | null;
  duration?: string | null;
  variants?: DemoServiceVariant[];
};

/** SMS preview text driven by real extracted call data; never references a hardcoded sample booking. */
function buildPersonalizedSmsPreview(extraction: CallExtracted | null, businessName: string): string {
  if (extraction?.hasRealData) {
    const { serviceRequested, requestedTime } = extraction;
    if (serviceRequested && requestedTime) {
      return `${businessName}: Hi! Your ${serviceRequested} on ${requestedTime} has been noted. We'll confirm shortly.`;
    }
    if (serviceRequested) {
      return `${businessName}: Hi! Your ${serviceRequested} request has been noted. We'll confirm your appointment shortly.`;
    }
  }
  return `${businessName}: Thanks for calling! We captured your request and will follow up to confirm your appointment.`;
}

function formatDemoApiHours(hours: DemoApiHours | null | undefined): string {
  if (!hours) return '';
  const ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const ABB: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  // The website-import core emits 3-letter day keys (mon/tue/...); normalize any key
  // shape (full names, capitalized) to 3-letter so a lookup never silently misses.
  const byDay: DemoApiHours = {};
  for (const [k, v] of Object.entries(hours)) {
    const short = k.trim().toLowerCase().slice(0, 3);
    if (ORDER.includes(short)) byDay[short] = v;
  }
  hours = byDay;
  const fmtTime = (t: string) => {
    const [hStr, mStr] = t.split(':');
    const h = parseInt(hStr ?? '0', 10);
    const m = parseInt(mStr ?? '0', 10);
    if (isNaN(h)) return t;
    const ampm = h < 12 ? 'am' : 'pm';
    const hr = h % 12 || 12;
    return m === 0 ? `${hr}${ampm}` : `${hr}:${String(m).padStart(2, '0')}${ampm}`;
  };
  const parts: string[] = [];
  let rangeStart: string | null = null;
  let rangePrev: string | null = null;
  let rangeValue: string | null = null;
  const flush = () => {
    if (!rangeStart) return;
    const label = rangeStart === rangePrev
      ? (ABB[rangeStart] ?? rangeStart)
      : `${ABB[rangeStart] ?? rangeStart}–${ABB[rangePrev ?? rangeStart] ?? rangePrev}`;
    if (rangeValue) parts.push(`${label} ${rangeValue}`);
    rangeStart = null; rangePrev = null; rangeValue = null;
  };
  for (const day of ORDER) {
    const entry = hours[day];
    if (!entry) { flush(); continue; }
    const value = 'closed' in entry ? 'closed' : `${fmtTime(entry.open)}–${fmtTime(entry.close)}`;
    if (value === rangeValue) { rangePrev = day; }
    else { flush(); rangeStart = day; rangePrev = day; rangeValue = value; }
  }
  flush();
  return parts.join(', ');
}

const STATE_ABBR: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY', 'district of columbia': 'DC',
};

function parseCityFromAddress(address: string): { displayCity: string; formCity: string } {
  let parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  while (parts.length > 1 && /^(?:usa|u\.s\.a\.|us|united states|united states of america)$/i.test(parts[parts.length - 1] ?? '')) {
    parts = parts.slice(0, -1);
  }
  // Strip trailing pure-digit zip codes (e.g. "75204")
  while (parts.length > 1 && /^\d{4,5}$/.test(parts[parts.length - 1] ?? '')) {
    parts = parts.slice(0, -1);
  }
  if (parts.length >= 3) {
    // "3699 McKinney Ave, Dallas, Texas" → city = "Dallas", state = "Texas"
    const cityPart = parts[parts.length - 2] ?? '';
    const statePart = parts[parts.length - 1] ?? '';
    const stateAbbr = STATE_ABBR[statePart.toLowerCase()] ?? statePart.replace(/\s*\d{5}.*$/, '').trim();
    return { displayCity: stateAbbr ? `${cityPart}, ${stateAbbr}` : cityPart, formCity: cityPart };
  }
  if (parts.length === 2) {
    const cityPart = parts[0] ?? '';
    const statePart = parts[1] ?? '';
    const stateAbbr = STATE_ABBR[statePart.toLowerCase()] ?? statePart.replace(/\s*\d{5}.*$/, '').trim();
    return { displayCity: stateAbbr ? `${cityPart}, ${stateAbbr}` : cityPart, formCity: cityPart };
  }
  return { displayCity: parts[0] ?? '', formCity: parts[0] ?? '' };
}

const NAV_SERVICE_BLOCKLIST = new Set([
  'home', 'about', 'about us', 'contact', 'contact us', 'gallery', 'photos', 'portfolio',
  'blog', 'news', 'faq', 'faqs', 'shop', 'store', 'careers', 'jobs', 'promotions',
  'specials', 'deals', 'offers', 'gift cards', 'gift card', 'login', 'sign in',
  'register', 'book now', 'booking', 'appointments', 'appointment', 'schedule',
  'reviews', 'testimonials', 'our team', 'team', 'staff', 'menu', 'sitemap',
  'privacy policy', 'terms', 'terms of service', 'cookie policy',
]);

function isUsableDemoServiceName(rawName: string): string | null {
  const name = rawName.replace(/^Add\s+/i, '').replace(/[™®]/g, '').trim();
  if (!name || name.length < 2) return null;
  if (NAV_SERVICE_BLOCKLIST.has(name.toLowerCase())) return null;
  if (/^shop\s+\S/i.test(name)) return null;
  // Reject rows the importer mangled — a real service name never contains an embedded
  // price token (e.g. "Lip 425+ Brow and Lip" from a broken price-table parse).
  if (/\d{2,}\s*\+/.test(name)) return null;
  return name;
}

function filterDemoServices(services: Array<{ name: string; confidence?: number; needsReview?: boolean }>): string[] {
  // Show the same services onboarding shows — do NOT drop low-confidence rows here
  // (that made the demo list far shorter than onboarding for the same site). Only
  // strip nav junk and de-duplicate, since the importer can list a service twice.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sv of services) {
    const name = isUsableDemoServiceName(sv.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function normalizeDemoServiceVariants(
  variants: Array<{
    label?: string | null;
    durationMinutes?: number | null;
    durationText?: string | null;
    priceAmount?: number | null;
    price?: number | null;
    duration?: string | null;
    priceType?: 'fixed' | 'from' | 'varies' | 'consultation' | null;
    notes?: string | null;
  }> | undefined,
): DemoServiceVariant[] {
  return (variants ?? [])
    .slice(0, 20)
    .map((variant, index) => {
      const duration = (variant.durationText ?? variant.duration ?? '').trim() || (variant.durationMinutes ? `${variant.durationMinutes} min` : null);
      const price = typeof variant.priceAmount === 'number'
        ? variant.priceAmount
        : typeof variant.price === 'number'
          ? variant.price
          : null;
      return {
        label: (variant.label ?? '').trim() || duration || (price !== null ? `$${price}` : `Option ${index + 1}`),
        price,
        duration,
        priceType: variant.priceType ?? null,
        notes: variant.notes ?? null,
      };
    })
    .filter((variant) => variant.label || variant.duration || variant.price !== null);
}

/**
 * Groups the flat imported service list into the demo's category/item shape so the
 * voice agent answers with the salon's REAL services (and prices/durations) instead
 * of the vertical's default sample catalog. Returns [] when nothing usable was imported.
 */
function buildDemoServiceCategoriesFromImport(
  services: Array<{
    name: string;
    categoryName?: string | null;
    priceAmount?: number | null;
    durationText?: string | null;
    durationMinutes?: number | null;
    confidence?: number;
    needsReview?: boolean;
    variants?: Array<{
      label: string;
      durationMinutes?: number | null;
      durationText?: string | null;
      priceAmount?: number | null;
      priceType?: 'fixed' | 'from' | 'varies' | 'consultation';
      notes?: string | null;
    }>;
  }>,
): DemoServiceCategory[] {
  const byCategory = new Map<string, DemoServiceCategory>();
  let total = 0;
  for (const sv of services) {
    if (total >= 40) break;
    // Parity with onboarding: keep low-confidence / review-flagged rows too.
    const name = isUsableDemoServiceName(sv.name);
    if (!name) continue;
    const label = (sv.categoryName ?? '').trim() || 'Services';
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'services';
    let category = byCategory.get(id);
    if (!category) {
      category = { id, label, items: [] };
      byCategory.set(id, category);
    }
    if (category.items.some((it) => it.name.toLowerCase() === name.toLowerCase())) continue;
    const duration =
      (sv.durationText ?? '').trim() ||
      (typeof sv.durationMinutes === 'number' && sv.durationMinutes > 0 ? `${sv.durationMinutes} min` : undefined);
    const variants = normalizeDemoServiceVariants(sv.variants);
    const firstVariantPrice = variants.find((variant) => typeof variant.price === 'number' && variant.price > 0)?.price;
    const firstVariantDuration = variants.find((variant) => variant.duration)?.duration;
    category.items.push({
      name,
      price: typeof sv.priceAmount === 'number' && sv.priceAmount > 0 ? sv.priceAmount : firstVariantPrice ?? 0,
      duration: duration || firstVariantDuration || undefined,
      enabled: true,
      variants,
    });
    total += 1;
  }
  return [...byCategory.values()].filter((c) => c.items.length > 0);
}

function buildDemoServiceCategoriesFromPrepared(services: PreparedDemoServiceDetail[] | undefined): DemoServiceCategory[] {
  const byCategory = new Map<string, DemoServiceCategory>();
  let total = 0;
  for (const sv of services ?? []) {
    if (total >= 40) break;
    const name = isUsableDemoServiceName(sv.name);
    if (!name) continue;
    const label = (sv.category ?? '').trim() || 'Services';
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'services';
    let category = byCategory.get(id);
    if (!category) {
      category = { id, label, items: [] };
      byCategory.set(id, category);
    }
    if (category.items.some((it) => it.name.toLowerCase() === name.toLowerCase())) continue;
    const variants = normalizeDemoServiceVariants(sv.variants);
    const firstVariantPrice = variants.find((variant) => typeof variant.price === 'number' && variant.price > 0)?.price;
    const firstVariantDuration = variants.find((variant) => variant.duration)?.duration;
    category.items.push({
      name,
      price: typeof sv.price === 'number' && sv.price > 0 ? sv.price : firstVariantPrice ?? 0,
      duration: (sv.duration ?? '').trim() || firstVariantDuration || undefined,
      enabled: true,
      variants,
    });
    total += 1;
  }
  return [...byCategory.values()].filter((c) => c.items.length > 0);
}

/** Mobile (≤768px) import checklist — labels differ from onboarding IMPORT_PROGRESS_STEPS on purpose. */
const MOBILE_IMPORT_STEPS = [
  'Fetching your site',
  'Scanning pages',
  'Extracting services and hours',
  'Building your profile',
] as const;

type MobileImportRowStatus = 'pending' | 'spinning' | 'done';

function useMediaMax768(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width:768px)');
    const fn = () => setM(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return m;
}

function useMediaMax400(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width:399px)');
    const fn = () => setM(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return m;
}

function initialsForBusinessName(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'RB';
}

function demoHostnameFromUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return 'your site';
  try {
    const u = new URL(t.includes('://') ? t : `https://${t}`);
    return u.hostname || 'your site';
  } catch {
    return 'your site';
  }
}

type DemoBusinessConfig = {
  businessName: string;
  address: string;
  city: string;
  primaryHours: string;
  secondaryHours: string;
  staff: string;
  notes: string;
  services: DemoServiceCategory[];
};

type DemoApiResponse = {
  ok: boolean;
  requestId?: string;
  previewToken?: string;
  liveKitUrl?: string;
  liveKitToken?: string;
  error?: string;
  message?: string;
};
type DirectRealtimeApiResponse = {
  ok: boolean;
  requestId?: string;
  clientSecret?: string;
  expiresAt?: number;
  model?: string;
  voice?: string;
  error?: string;
  code?: string;
  message?: string;
  retryAfterSeconds?: number;
  /** Present when server VAD is on: apply via `session.update` after scripted welcome so mic turns get replies. */
  turnDetectionAfterWelcome?: Record<string, unknown> | null;
  /** Exact first-spoken greeting (matches WELCOME MESSAGE in system prompt). */
  scriptedWelcomeLine?: string;
};
type DemoStatusResponse = {
  ok: boolean;
  stage?: 'queued' | 'dialing' | 'live' | 'completed' | 'failed';
  call?: { startedAt?: string | null; endedAt?: string | null; outcome?: string | null } | null;
  error?: string;
  message?: string;
};

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
const visibleTurnstileStyle = { marginBottom: 14 } as const;
const hiddenTurnstileStyle = {
  position: 'absolute',
  opacity: 0,
  pointerEvents: 'none',
  width: 0,
  height: 0,
  overflow: 'hidden',
} as const;

/** Legacy shared demo line when per-vertical `DEMO_PHONE_*` env is unset (server passes prop from env). */
const LEGACY_VERTICAL_DEMO_PHONE_E164 = '+16265013960';

function normalizeDemoPhoneE164(raw?: string | null): string {
  const t = raw?.trim();
  if (!t) return LEGACY_VERTICAL_DEMO_PHONE_E164;
  const compact = t.replace(/[^\d+]/g, '');
  if (compact.startsWith('+') && compact.length >= 8) return compact;
  const d = t.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return LEGACY_VERTICAL_DEMO_PHONE_E164;
}

function formatE164ForDisplay(e164: string): string {
  const d = e164.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) {
    const n = d.slice(1);
    return `+1 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  if (d.length === 10) {
    return `+1 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }
  return e164;
}

const DEMO_STATUS_POLL_INTERVAL_MS = 2200;
const DEMO_STATUS_MAX_POLL_ATTEMPTS = 30;
const DEMO_STATUS_TIMEOUT_MESSAGE = 'The web demo is taking longer than expected. Please try again, or call the demo number instead.';
const LIVEKIT_CONNECT_ERROR_MESSAGE = 'Unable to connect to the voice room. Please check your network and try again, or call the demo number instead.';
const DIRECT_OPENAI_CONNECT_TIMEOUT_MS = 45_000;
const DIRECT_OPENAI_MAX_SESSION_MS = 5 * 60 * 1000;
/**
 * Mic is muted while the AI delivers the opening greeting so speaker echo and
 * room noise cannot trigger OpenAI's semantic_vad and truncate the greeting.
 * Mic is re-enabled on `output_audio_buffer.stopped` for the first response.
 * This fallback guarantees the mic is re-enabled even if that event never fires
 * (greeting fails, OpenAI cancels mid-stream without a clean `stopped`, etc.).
 */
const DIRECT_OPENAI_GREETING_MIC_UNMUTE_FALLBACK_MS = 10_000;
const DIRECT_OPENAI_END_CALL_AUDIO_STOP_FALLBACK_MS = 6_000;
const DIRECT_OPENAI_END_CALL_AUDIO_STOP_HARD_FALLBACK_MS = 30_000;
const DIRECT_OPENAI_END_CALL_AUDIO_TAIL_GRACE_MS = 1_000;
const OPENAI_REALTIME_WEBRTC_URL = 'https://api.openai.com/v1/realtime/calls';
const demoWebCallMode = process.env.NEXT_PUBLIC_DEMO_WEB_CALL_MODE === 'direct_openai' ? 'direct_openai' : 'livekit';

/** Set `NEXT_PUBLIC_DEMO_WEB_REALTIME_DEBUG=true` to log WebRTC + VAD milestones in the browser console (no secrets). */
const demoWebRealtimeDebug = process.env.NEXT_PUBLIC_DEMO_WEB_REALTIME_DEBUG === 'true';

const DEMO_REALTIME_LOG_EVENT_TYPES = new Set([
  'session.created',
  'session.updated',
  'response.created',
  'response.done',
  'response.cancelled',
  'output_audio_buffer.started',
  'output_audio_buffer.stopped',
  'input_audio_buffer.speech_started',
  'input_audio_buffer.speech_stopped',
  'input_audio_buffer.committed',
  'error',
]);

function logDemoRealtime(phase: string, detail?: Record<string, unknown>) {
  if (!demoWebRealtimeDebug) return;
  if (typeof window === 'undefined') return;
  const payload = detail && Object.keys(detail).length > 0 ? detail : undefined;
  console.info('[rb-demo-realtime]', phase, payload ?? '');
}

const VERTICAL_DEMO_FAQ_ITEMS: MarketingFaqItem[] = [
  {
    q: 'Does this demo use my real business phone line?',
    a: 'No. The browser demo runs in this page with your microphone — it does not change forwarding or settings on your live business line. If you call the optional demo phone number, that uses a fixed sample profile for this vertical.',
  },
  {
    q: 'How long does a demo take?',
    a: 'Most demos take about two to three minutes. You can try natural booking, reschedule, or pricing-style questions during the session.',
  },
  {
    q: 'Is the demo free?',
    a: 'Yes. Live web demos are free and intended to help you evaluate tone, pacing, and call handling before you start a trial.',
  },
  {
    q: 'What if the browser demo does not connect?',
    a: 'Allow microphone access, check your network, and try again. You can also call the demo line listed on this page. If it still fails, use the contact page and we can help troubleshoot.',
  },
  {
    q: 'Will RingBooker work with my current number later?',
    a: 'Yes. Production setup uses call forwarding on your existing business number. The demo is only a preview experience.',
  },
];

function buildPreparedDemoFaqItems(businessName: string): MarketingFaqItem[] {
  return [
    {
      q: `Does this demo use ${businessName}'s real phone line?`,
      a: `No. This is a browser demo customized with ${businessName}'s services and hours. Your real phone line is not affected.`,
    },
    {
      q: 'How long does a demo take?',
      a: `About 1-2 minutes. Just ask to book an appointment or ask about services at ${businessName}.`,
    },
    {
      q: 'Is this demo free?',
      a: 'Yes, completely free. No card required.',
    },
    {
      q: `What if the demo doesn't connect?`,
      a: 'Try Chrome or Edge. If issues persist, contact us at hello@ringbooker.com.',
    },
    {
      q: `Will RingBooker work with ${businessName}'s current number later?`,
      a: 'Yes. RingBooker works with your existing phone number via call forwarding.',
    },
  ];
}

const styles: string[] = [
  String.raw`.vd-faq-outer{max-width:1120px;margin:0 auto;padding:8px 20px 48px;background:transparent;border-top:none}@media(min-width:800px){.vd-faq-outer{padding:12px 40px 64px}}.vd-page{padding-top:80px;background:linear-gradient(160deg,color-mix(in srgb,var(--va) 7%,#fff) 0%,#fff 55%);min-height:100dvh}.vd-theme-nail-salon{--va:#7C3AED}.vd-theme-hair-salon{--va:#B45309}.vd-theme-day-spa{--va:#0D9488}.vd-theme-med-spa{--va:#4F46E5}.vd-theme-beauty-clinic{--va:#A21CAF}.vd-wrap{margin:0 auto;padding:18px 20px 56px;display:flex;flex-direction:column}.vd-page-header{max-width:1120px;margin:0 auto;padding:24px 20px 18px;display:flex;flex-direction:column;align-items:center}.vd-breadcrumb{align-self:flex-start;font-size:14px;line-height:1.35;color:var(--mk-text-soft,#94a3b8);margin-bottom:10px}.vd-breadcrumb a{color:var(--mk-text-soft,#94a3b8);text-decoration:none;font-weight:400}.vd-breadcrumb a:hover{color:var(--va)}.vd-breadcrumb>span{margin:0 6px}.vd-page-header .vd-hero-eyebrow{display:block;width:100%;text-align:center;margin:0 auto 16px;color:var(--mk-hero-eyebrow,#64748b)}.vd-icon{width:22px;height:22px;border-radius:7px;background:var(--va);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0}.vd-hero-h1{margin:0 auto 12px;max-width:min(920px,100%);font-size:clamp(26px,3.6vw,40px);font-weight:600;letter-spacing:-.03em;line-height:1.1;text-align:center;color:#111827;text-wrap:balance}.vd-hero-sub{margin:0 auto 0;max-width:min(560px,100%);font-size:16px;line-height:1.62;text-align:center;color:#64748B;font-weight:500}@media(min-width:800px){.vd-hero-h1{margin-bottom:14px}.vd-hero-sub{font-size:17px;max-width:min(600px,100%);line-height:1.65}.vd-page-header{padding:34px 40px 26px}}.vd-field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}.vd-field-compact{margin:0}.vd-field label{font-size:13px;font-weight:500;color:#374151}.vd-field input,.vd-field textarea{width:100%;border:1px solid #E5E7EB;border-radius:13px;padding:11px 13px;font-size:14px;color:#111827;background:#fff;outline:none;transition:border-color .15s;-webkit-appearance:none}.vd-field input:focus,.vd-field textarea:focus{border-color:var(--va)}.vd-field textarea{min-height:68px;resize:vertical}.vd-2col{display:grid;grid-template-columns:1fr 1fr;gap:10px}.vd-adv-toggle{display:flex;align-items:center;gap:8px;background:none;border:none;cursor:pointer;font-size:13px;font-weight:500;color:#6B7280;padding:10px 0;margin-bottom:14px}.vd-adv-toggle:hover{color:var(--va)}.vd-adv-chevron{font-size:10px;transition:transform .2s;display:inline-block}.vd-adv-chevron.open{transform:rotate(180deg)}.vd-adv-body{background:#F9FAFB;border:1px solid #E5E7EB;border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:12px;margin-bottom:14px}.vd-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.vd-tab{border:1px solid #E5E7EB;background:#fff;border-radius:999px;padding:6px 11px;font-size:12px;font-weight:600;cursor:pointer}.vd-tab.on{background:var(--va);border-color:var(--va);color:#fff}.vd-svc-row{display:grid;grid-template-columns:18px 1fr auto auto;gap:8px;align-items:center;border:1px solid #E5E7EB;border-radius:13px;padding:10px 12px;background:#fff}.vd-svc-row input[type=checkbox]{accent-color:var(--va);width:16px;height:16px}.vd-svc-name{font-size:13px;font-weight:500;color:#1F2937}.vd-svc-dur{font-size:11px;color:#9CA3AF;margin-top:1px}.vd-svc-price{width:72px;border:1px solid #E5E7EB;border-radius:9px;padding:7px 8px;text-align:right;font-size:13px;font-weight:500;-webkit-appearance:none}.vd-svc-info{min-width:0}.vd-svc-label{font-size:12px;font-weight:600;color:#6B7280;margin-bottom:8px}.vd-svc-list{display:flex;flex-direction:column;gap:7px}.vd-prompts-head{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#9CA3AF;margin:16px 0 10px}.vd-prompts{display:flex;flex-direction:column;gap:7px;margin-bottom:12px}.vd-prompt{display:flex;align-items:center;justify-content:space-between;border:1px solid color-mix(in srgb,var(--va) 22%,#E5E7EB);background:color-mix(in srgb,var(--va) 4%,#fff);border-radius:13px;padding:11px 13px;font-size:13px;font-weight:500;color:#243041;cursor:pointer;text-align:left;transition:.15s}.vd-prompt:hover{border-color:var(--va);background:#fff;box-shadow:0 4px 12px color-mix(in srgb,var(--va) 10%,transparent)}.vd-prompt-copy{font-size:10px;font-weight:900;color:#C4C9D4;text-transform:uppercase;flex-shrink:0;margin-left:8px}.vd-prompt:hover .vd-prompt-copy{color:var(--va)}.vd-prompt-more{background:none;border:none;cursor:pointer;font-size:12px;font-weight:600;color:var(--va);padding:2px 0;margin-bottom:10px}.vd-copied{font-size:12px;font-weight:600;color:var(--va);margin:0 0 8px}.vd-errors{display:flex;flex-direction:column;gap:7px;margin-bottom:12px}.vd-error{font-size:13px;color:#B91C1C;background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:9px 12px}.vd-cta{width:100%;border:none;border-radius:999px;background:#0d0d0d;color:#fff;padding:15px 32px;font-size:16px;font-weight:500;cursor:pointer;transition:transform .15s,background .2s,box-shadow .2s;box-shadow:0 8px 24px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.1);-webkit-appearance:none}.vd-cta:hover:not(:disabled){background:#1a1a1a;transform:translateY(-1px);box-shadow:0 12px 32px rgba(0,0,0,.22),0 4px 12px rgba(0,0,0,.12)}.vd-cta:disabled{opacity:.55;cursor:not-allowed}.vd-cta-note{font-size:12px;color:#9CA3AF;text-align:center;margin-top:8px;line-height:1.5}.vd-phone-demo-secondary{margin-top:22px;padding:16px;border-radius:18px;border:1px solid #E5E7EB;background:#F9FAFB}.vd-phone-demo-title{font-size:13px;font-weight:900;color:#111827;margin-bottom:6px}.vd-phone-demo-text{font-size:13px;color:#64748B;line-height:1.55;margin:0 0 10px}.vd-phone-demo-num-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:10px}.vd-phone-demo-num{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--va)}.vd-phone-demo-copy{border:1px solid #E5E7EB;background:#fff;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:600;color:#374151;cursor:pointer}.vd-phone-demo-copy:hover{border-color:var(--va);color:var(--va)}.vd-phone-demo-tel{display:none}.vd-phone-demo-note{font-size:11px;color:#9CA3AF;line-height:1.45;margin:10px 0 0}@media(max-width:799px){.vd-phone-demo-tel{display:inline-flex;align-items:center;justify-content:center;width:100%;border-radius:999px;border:2px solid color-mix(in srgb,var(--va) 45%,#E5E7EB);background:#fff;color:var(--va);padding:12px;font-size:14px;font-weight:900;text-decoration:none;margin-top:4px}}.vd-sip-panel{margin-top:18px;padding:16px;border-radius:18px;border:1px dashed color-mix(in srgb,var(--va) 35%,#E5E7EB);background:color-mix(in srgb,var(--va) 4%,#fff)}.vd-sip-head{font-size:13px;font-weight:900;color:#111827;margin-bottom:6px}.vd-sip-copy{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--va);margin:6px 0 10px;word-break:break-all}.vd-sip-hint{font-size:12px;color:#6B7280;line-height:1.55;margin-bottom:12px}.vd-sip-secondary{width:100%;border-radius:999px;border:2px solid color-mix(in srgb,var(--va) 45%,#E5E7EB);background:#fff;color:var(--va);padding:14px;font-size:14px;font-weight:900;cursor:pointer;transition:.18s}.vd-sip-secondary:hover:not(:disabled){background:color-mix(in srgb,var(--va) 8%,#fff)}.vd-sip-secondary:disabled{opacity:.5;cursor:not-allowed}.vd-captcha{margin-bottom:14px;min-height:70px;min-width:240px;border:1px dashed #E5E7EB;border-radius:14px;padding:10px;background:#FAFAFA;display:flex;align-items:center;justify-content:center}.vd-captcha-inner{min-height:65px;width:100%;max-width:340px;display:flex;align-items:center;justify-content:center}.vd-captcha-label{font-size:13px;font-weight:500;color:#374151;margin-bottom:8px}.vd-captcha-hint{font-size:12px;color:#9CA3AF;margin-top:8px;line-height:1.45}.vd-status-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid #E5E7EB;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:600;color:#374151;background:#fff;margin-bottom:16px;width:fit-content}.vd-status-pill.live{background:#ECFDF5;border-color:#A7F3D0;color:#047857}.vd-status-pill.failed{background:#FEF2F2;border-color:#FECACA;color:#B91C1C}.vd-status-pill.completed{background:#EFF6FF;border-color:#BFDBFE;color:#1D4ED8}.vd-status-dot{width:8px;height:8px;border-radius:50%;background:currentColor}.vd-status-dot.pulse{animation:vdPulse 1.2s ease-in-out infinite}@keyframes vdPulse{0%,100%{opacity:1}50%{opacity:.35}}.vd-status-h{font-size:22px;font-weight:600;letter-spacing:-.5px;color:#111827;margin:0 0 6px}.vd-status-body{font-size:14px;line-height:1.6;color:#6B7280;margin:0 0 18px}.vd-wave{height:30px;display:flex;justify-content:center;align-items:center;gap:3px;margin-bottom:14px}.vd-wave span{display:block;width:3px;border-radius:4px;background:#10B981;animation:vdWave 1.65s ease-in-out infinite}.vd-wave span:nth-child(1){height:8px}.vd-wave span:nth-child(2){height:20px;animation-delay:.12s}.vd-wave span:nth-child(3){height:28px;animation-delay:.24s}.vd-wave span:nth-child(4){height:16px;animation-delay:.36s}.vd-wave span:nth-child(5){height:24px;animation-delay:.48s}@keyframes vdWave{0%,100%{transform:scaleY(.4);opacity:.45}50%{transform:scaleY(1);opacity:1}}.vd-sms{border:1px solid #E5E7EB;border-radius:18px;background:#F8FAFC;padding:14px;margin-bottom:14px}.vd-sms-label{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#64748B;margin-bottom:8px}.vd-sms-bubble{background:#fff;border:1px solid #E2E8F0;border-radius:16px 16px 16px 5px;padding:12px 14px;color:#334155;font-size:13px;line-height:1.55}.vd-complete-cta{display:flex;flex-direction:column;gap:9px;margin-top:4px}.vd-btn-primary{display:flex;align-items:center;justify-content:center;background:#111827;color:#fff;border:none;border-radius:999px;padding:14px 20px;font-size:15px;font-weight:900;cursor:pointer;text-decoration:none;transition:.18s}.vd-btn-primary:hover{background:#1F2937;transform:translateY(-1px)}.vd-btn-ghost{display:flex;align-items:center;justify-content:center;background:#EF4444;color:#fff;border:1px solid #EF4444;border-radius:999px;padding:12px 20px;font-size:14px;font-weight:500;cursor:pointer;transition:.18s;box-shadow:0 4px 14px rgba(239,68,68,.35)}.vd-btn-ghost:hover{background:#DC2626;border-color:#DC2626;color:#fff;transform:translateY(-1px);box-shadow:0 6px 18px rgba(220,38,38,.38)}.vd-btn-ghost:focus-visible{outline:2px solid #FECACA;outline-offset:2px}.vd-others{display:flex;flex-wrap:wrap;gap:7px;padding-top:22px;border-top:1px solid #F1F5F9;margin-top:28px}.vd-other{border:1px solid #E5E7EB;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:500;color:#4B5563;background:#fff;text-decoration:none}.vd-other:hover{border-color:var(--va);color:var(--va)}.vd-disclaimer{font-size:12px;color:#9CA3AF;line-height:1.5;padding-top:16px;margin-top:16px}.vd-right{display:none}.vd-phone{width:min(100%,286px);min-height:500px;margin:0 auto;background:linear-gradient(165deg,#1a0533 0%,#2d1b69 50%,#1a0d3a 100%);border:10px solid #0B0B10;border-radius:42px;padding:22px 18px;position:relative;overflow:hidden;color:#fff;box-shadow:0 34px 70px rgba(17,24,39,.25),0 0 0 1px rgba(255,255,255,.06) inset;display:flex;flex-direction:column}.vd-phone::before{content:'';position:absolute;inset:-70px -60px auto auto;width:200px;height:200px;border-radius:50%;background:color-mix(in srgb,var(--va) 35%,transparent)}.vd-phone-top{display:flex;justify-content:space-between;color:rgba(255,255,255,.5);font-size:12px;margin-bottom:34px;position:relative}.vd-phone-time{font-weight:500}.vd-phone-icons{font-size:9px}.vd-phone-avatar{width:68px;height:68px;border-radius:50%;background:linear-gradient(135deg,var(--va),color-mix(in srgb,var(--va) 60%,#000));display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;margin:0 auto 10px;box-shadow:0 0 0 8px rgba(255,255,255,.07),0 0 32px color-mix(in srgb,var(--va) 40%,transparent);position:relative}.vd-phone-name{text-align:center;position:relative;margin-bottom:4px;font-size:17px;font-weight:600}.vd-phone-subtitle{color:rgba(255,255,255,.5);font-size:11px;font-weight:500;letter-spacing:.06em;text-align:center;text-transform:uppercase;position:relative;margin-bottom:16px}.vd-phone-wave{height:26px;display:flex;justify-content:center;align-items:center;gap:3px;margin-bottom:16px}.vd-phone-wave span{display:block;width:3px;border-radius:3px;background:#10B981;animation:vdWave 1.1s ease-in-out infinite}.vd-phone-wave span:nth-child(1){height:7px}.vd-phone-wave span:nth-child(2){height:18px;animation-delay:.08s}.vd-phone-wave span:nth-child(3){height:24px;animation-delay:.16s}.vd-phone-wave span:nth-child(4){height:14px;animation-delay:.24s}.vd-phone-wave span:nth-child(5){height:20px;animation-delay:.32s}.vd-phone-mid{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:120px;padding:4px 0 8px}.vd-phone-connecting{display:flex;align-items:center;justify-content:center;gap:9px;color:#10B981;font-size:15px;font-weight:600;letter-spacing:.02em;margin-bottom:4px}.vd-phone-connecting-dot{width:8px;height:8px;border-radius:50%;background:#10B981;animation:vdPulse 1s ease-in-out infinite}.vd-phone-dock{display:flex;justify-content:center;align-items:flex-end;padding:8px 0 6px;width:100%}.vd-phone-ios-act{display:flex;flex-direction:column;align-items:center;gap:7px;width:100%}.vd-phone-ios-btn{border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;transition:transform .15s,filter .15s,box-shadow .15s}.vd-phone-ios-btn--accept,.vd-phone-ios-btn--end{width:auto;height:auto;padding:0;background:transparent;box-shadow:none;border-radius:0}.vd-phone-ios-btn--accept:hover:not(:disabled),.vd-phone-ios-btn--end:hover:not(:disabled){filter:none;transform:none;box-shadow:none}.vd-phone-ios-btn-face{width:40px;height:40px;aspect-ratio:1;border-radius:999px;display:flex;align-items:center;justify-content:center;background:#10B981;color:#fff;flex-shrink:0;box-shadow:0 12px 28px rgba(16,185,129,.42);transition:transform .15s,filter .15s,box-shadow .15s}.vd-phone-ios-btn--accept:hover:not(:disabled) .vd-phone-ios-btn-face{filter:brightness(1.06);transform:scale(1.03);box-shadow:0 14px 34px rgba(16,185,129,.48)}.vd-phone-ios-btn--accept:disabled .vd-phone-ios-btn-face{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}.vd-phone-ios-btn--accept:disabled{cursor:not-allowed}.vd-phone-ios-btn-face svg{width:16px;height:16px;display:block}.vd-phone-ios-btn-face.vd-phone-ios-btn-face--end{background:#EF4444;box-shadow:0 12px 28px rgba(239,68,68,.45)}.vd-phone-ios-btn-face.vd-phone-ios-btn-face--end svg path{fill:currentColor}.vd-phone-ios-btn--end:hover:not(:disabled) .vd-phone-ios-btn-face.vd-phone-ios-btn-face--end{filter:brightness(1.06);transform:scale(1.03);box-shadow:0 14px 34px rgba(239,68,68,.52)}.vd-phone-ios-btn--end:disabled .vd-phone-ios-btn-face.vd-phone-ios-btn-face--end{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}.vd-phone-ios-btn:focus-visible{outline:2px solid rgba(255,255,255,.55);outline-offset:3px}.vd-phone-ios-btn:disabled{opacity:1;cursor:not-allowed}.vd-phone-ios-btn--end:disabled{cursor:not-allowed}.vd-phone-ios-label{font-size:11px;font-weight:600;color:rgba(255,255,255,.88);letter-spacing:.02em;line-height:1.25;text-align:center;max-width:200px}.vd-form-card{border:1px solid #E5E7EB;border-radius:24px;background:#fff;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.04)}@media(min-width:800px){.vd-page{background:linear-gradient(145deg,color-mix(in srgb,var(--va) 6%,#fff) 0%,#fff 60%)}.vd-wrap{max-width:1100px;display:grid;grid-template-columns:1fr 320px;gap:52px;align-items:start;padding:8px 40px 72px}.vd-right{display:flex;flex-direction:column;gap:0;position:sticky;top:96px;align-items:center}.vd-wave{display:none}.vd-phone-ios-btn-face{width:56px;height:56px}.vd-phone-ios-btn-face svg{width:20px;height:20px}}@media(min-width:1200px){.vd-wrap{max-width:1120px;grid-template-columns:1fr 340px;gap:64px;padding:8px 48px 80px}}`,
];

const siteReadStyles: string = String.raw`.vd-url-section{margin-bottom:14px}.vd-url-label{font-size:13px;font-weight:500;color:#374151;margin-bottom:8px;display:block}.vd-url-row{display:flex;gap:8px;align-items:center}.vd-url-input{flex:1;border:1px solid #E5E7EB;border-radius:13px;padding:11px 13px;font-size:14px;color:#111827;background:#fff;outline:none;transition:border-color .15s;-webkit-appearance:none;min-width:0}.vd-url-input:focus{border-color:var(--va)}.vd-url-btn{flex-shrink:0;border:none;border-radius:999px;background:var(--va);color:#fff;padding:11px 16px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:.15s}.vd-url-btn:hover:not(:disabled){filter:brightness(1.08)}.vd-url-btn:disabled{opacity:.55;cursor:not-allowed}.vd-url-divider{display:flex;align-items:center;gap:10px;margin:14px 0;color:#9CA3AF;font-size:12px;font-weight:500}.vd-url-divider::before,.vd-url-divider::after{content:'';flex:1;height:1px;background:#E5E7EB}.vd-loading-card{min-height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;text-align:center}.vd-spinner{width:28px;height:28px;border:3px solid color-mix(in srgb,var(--va) 20%,#E5E7EB);border-top-color:var(--va);border-radius:999px;animation:vdSpin .75s linear infinite;margin:0 auto 18px;flex-shrink:0}@keyframes vdSpin{to{transform:rotate(360deg)}}.vd-load-head{font-size:16px;font-weight:900;color:#111827;margin:0 0 4px}.vd-load-sub{font-size:13px;color:#6B7280;margin:0 0 20px}.vd-load-steps{display:flex;flex-direction:column;gap:10px;width:100%;text-align:left}.vd-load-step{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:500;color:#9CA3AF;transition:color .25s}.vd-load-step.done{color:#10B981}.vd-load-step.active{color:#111827}.vd-load-step-icon{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;border:2px solid #E5E7EB;background:#fff;transition:border-color .25s,background .25s}.vd-load-step.done .vd-load-step-icon{background:#10B981;border-color:#10B981;color:#fff}.vd-load-step.active .vd-load-step-icon{border-color:var(--va)}.vd-load-step-spinner{width:10px;height:10px;border:2px solid #D1D5DB;border-top-color:var(--va);border-radius:999px;animation:vdSpin .75s linear infinite}.vd-load-delay{font-size:12px;color:#6B7280;margin-top:14px;line-height:1.5;text-align:center}.vd-load-escape{background:none;border:none;cursor:pointer;font-size:12px;font-weight:500;color:#9CA3AF;padding:0;margin-top:8px;display:inline-block;text-decoration:underline;text-underline-offset:2px}.vd-load-escape:hover{color:#6B7280}.vd-found-card{border:1px solid color-mix(in srgb,var(--va) 25%,#E5E7EB);border-radius:18px;background:color-mix(in srgb,var(--va) 4%,#fff);padding:16px;margin-bottom:14px}.vd-found-head{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--va);margin-bottom:12px}.vd-found-row{display:flex;gap:8px;align-items:baseline;margin-bottom:8px;font-size:13px}.vd-found-row:last-child{margin-bottom:0}.vd-found-key{font-weight:500;color:#6B7280;flex-shrink:0;min-width:60px}.vd-found-val{color:#111827;font-weight:600}.vd-found-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:4px}.vd-found-chip{background:rgba(255,255,255,.85);border:1px solid color-mix(in srgb,var(--va) 20%,#E5E7EB);border-radius:999px;padding:3px 9px;font-size:11px;font-weight:500;color:#374151}.vd-found-edit{background:none;border:none;cursor:pointer;font-size:12px;font-weight:500;color:var(--va);padding:0;margin-top:10px;display:block}.vd-found-edit:hover{text-decoration:underline}.vd-retry-wrap{display:flex;justify-content:center;width:100%;margin-top:8px}.vd-retry-link{background:none;border:none;cursor:pointer;font-size:13px;font-weight:400;color:#9CA3AF;padding:0;text-align:center;text-decoration:none}.vd-retry-link:hover{color:#6B7280;text-decoration:none}.vd-post-steps{display:flex;align-items:center;justify-content:center;gap:0;margin-top:28px;margin-bottom:20px}.vd-post-step{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}.vd-post-step-dot{width:28px;height:28px;border-radius:50%;background:var(--va);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900}.vd-post-step-label{font-size:11px;font-weight:500;color:#6B7280;text-align:center;line-height:1.3}.vd-post-step-bar{flex:1;height:2px;background:color-mix(in srgb,var(--va) 30%,#E5E7EB);margin:-14px 0 0}.vd-pd-label{font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#64748B;margin-bottom:8px}.vd-pd-sms-card{border-radius:16px;background:#F1F5F9;padding:14px 16px;margin-bottom:14px}.vd-pd-sms-text{font-size:14px;line-height:1.55;color:#334155}.vd-pd-cap{background:#F8FAFC;border-radius:16px;padding:14px 16px;margin-bottom:14px}.vd-pd-cap-row{display:grid;grid-template-columns:22px minmax(4.75rem,auto) minmax(0,1fr);column-gap:16px;align-items:center;font-size:13px;padding:9px 0;border-bottom:1px solid #E2E8F0}.vd-pd-cap-row:last-child{border-bottom:none}.vd-pd-cap-ic{font-size:15px;width:22px;text-align:center;flex-shrink:0}.vd-pd-cap-k{color:#64748B;font-weight:500;white-space:nowrap}.vd-pd-cap-v{color:#111827;font-weight:500;min-width:0}.vd-pd-cap-empty{font-size:13px;color:#64748B;line-height:1.5}.vd-pd-cap-empty-sub{font-size:12px;color:#9CA3AF;line-height:1.5;margin-top:4px}.vd-pd-no-capture{font-size:13px;color:#64748B;line-height:1.6;margin:0 0 14px;padding:12px 14px;background:#F8FAFC;border-radius:12px;border:1px solid #E2E8F0}.vd-pd-trust{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 14px;font-size:12px;font-weight:600;color:#64748B;margin-top:8px}.vd-pd-trust-check{color:#10B981;font-weight:900}.vd-pd-pay-wrap{display:flex;justify-content:center;margin-top:8px}.vd-pd-pay{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#64748B;background:#F3F4F6;border-radius:999px;padding:6px 14px}`;

/** Mobile-only (≤768px). Desktop uses existing rules from `styles` / `siteReadStyles`. */
const verticalDemoMobileStyles = String.raw`@media (max-width:768px){.vd-page-header{align-items:flex-start}.vd-page-header .vd-hero-eyebrow{display:none}.vd-hero-h1{text-align:left;margin-left:0;margin-right:0;max-width:100%}.vd-hero-sub{text-align:left;margin-left:0;margin-right:0;max-width:100%}.vd-m-card{border:2px solid var(--va);border-radius:20px;background:#fff;padding:18px 16px;margin-bottom:14px;box-shadow:0 2px 12px rgba(0,0,0,.04)}.vd-m-card-title{margin:0 0 6px;font-size:15px;font-weight:900;color:#111827;letter-spacing:-.02em}.vd-m-card-sub{margin:0 0 12px;font-size:13px;color:#64748B;line-height:1.5}.vd-m-url-row{display:flex;flex-direction:column;gap:10px}.vd-m-url-row .vd-url-btn{width:100%;padding:14px 16px;font-size:15px;text-align:center}.vd-m-divider{display:flex;align-items:center;gap:10px;margin:14px 0;color:#9CA3AF;font-size:12px;font-weight:500}.vd-m-divider::before,.vd-m-divider::after{content:'';flex:1;height:1px;background:#E5E7EB}.vd-m-acc{border:0;background:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;color:#6B7280;padding:10px 0;width:100%;text-align:left}.vd-m-acc-chev{font-size:10px;transition:transform .2s;display:inline-block}.vd-m-acc-chev.open{transform:rotate(180deg)}.vd-m-acc-body{border:1px solid #E5E7EB;border-radius:16px;background:#F9FAFB;padding:14px;display:flex;flex-direction:column;gap:12px;margin-bottom:12px}.vd-m-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.vd-m-load-subtitle{margin:0 0 14px;font-size:14px;line-height:1.5;color:#475569;text-align:center}.vd-m-spin{border:3px solid color-mix(in srgb,var(--va) 22%,#E5E7EB);border-top-color:var(--va);border-radius:999px;width:32px;height:32px;animation:vdSpin .75s linear infinite;margin:0 auto 14px}.vd-m-prog{height:6px;border-radius:999px;background:#E5E7EB;overflow:hidden;margin:14px 0 16px}.vd-m-prog-fill{height:100%;border-radius:999px;background:var(--va);width:0;transition:width .45s ease}.vd-m-rows{display:flex;flex-direction:column;gap:10px;text-align:left}.vd-m-row{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:500;color:#9CA3AF}.vd-m-row.done{color:#10B981}.vd-m-row.active{color:#111827}.vd-m-ico{width:22px;height:22px;border-radius:999px;border:2px solid #E5E7EB;background:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}.vd-m-row.done .vd-m-ico{background:#10B981;border-color:#10B981;color:#fff}.vd-m-row.active .vd-m-ico{border-color:var(--va)}.vd-m-row-spin{width:10px;height:10px;border:2px solid #D1D5DB;border-top-color:var(--va);border-radius:999px;animation:vdSpin .75s linear infinite}.vd-m-pill{font-size:12px;color:#6B7280;line-height:1.45;text-align:center;background:#F3F4F6;border-radius:12px;padding:10px 12px;margin-top:10px}.vd-m-escape{background:none;border:none;cursor:pointer;font-size:12px;font-weight:500;color:#9CA3AF;padding:0;margin-top:10px;display:block;width:100%;text-align:center;text-decoration:underline;text-underline-offset:2px}.vd-m-escape:hover{color:#6B7280}.vd-m-badge{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:6px 14px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin:0 auto 12px;width:fit-content}.vd-m-badge-dot{width:8px;height:8px;border-radius:50%}.vd-m-badge--ready{border:1px solid #A7F3D0;background:#ECFDF5;color:#047857}.vd-m-badge--ready .vd-m-badge-dot{background:#10B981}.vd-m-badge--amber{border:1px solid #FDE68A;background:#FFFBEB;color:#92400E}.vd-m-badge--amber .vd-m-badge-dot{background:#F59E0B}.vd-m-badge--grey{border:1px solid #E5E7EB;background:#F9FAFB;color:#6B7280}.vd-m-badge--grey .vd-m-badge-dot{background:#9CA3AF}.vd-m-found-info{font-size:12px;color:#64748B;line-height:1.5;margin:12px 0 0;padding:10px 12px;background:#F8FAFC;border-radius:12px;border:1px solid #E2E8F0}.vd-m-found-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:13px}.vd-m-found-row:last-child{margin-bottom:0}.vd-m-found-ic{font-size:16px;line-height:1;width:24px;text-align:center;flex-shrink:0}.vd-m-found-k{font-weight:600;color:#64748B;min-width:72px;flex-shrink:0}.vd-m-found-v{color:#111827;font-weight:600;flex:1;min-width:0}.vd-m-link{background:none;border:none;cursor:pointer;padding:0;margin-top:8px;font-size:13px;font-weight:500;color:var(--va);text-decoration:underline;text-underline-offset:2px;text-align:left}.vd-m-sms-card{border-radius:16px;background:#F1F5F9;padding:14px;margin:14px 0;font-size:14px;line-height:1.55;color:#334155}.vd-m-cap{background:#F8FAFC;border-radius:16px;padding:14px;margin-bottom:14px}.vd-m-cap-label{font-size:10px;font-weight:900;letter-spacing:.1em;color:#64748B;margin-bottom:10px}.vd-m-cap-row{display:flex;gap:10px;font-size:13px;margin-bottom:8px;align-items:flex-start}.vd-m-cap-row:last-child{margin-bottom:0}.vd-m-banner{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:14px;background:#EFF6FF;border:1px solid #BFDBFE;font-size:13px;color:#1E40AF;line-height:1.5;margin-bottom:14px}.vd-m-trust-line{display:flex;flex-wrap:wrap;justify-content:center;gap:12px 18px;font-size:12px;font-weight:600;color:#64748B;margin:12px 0 8px}.vd-m-pay-pill{display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;font-weight:600;color:#475569;background:#F3F4F6;border-radius:999px;padding:10px 14px;margin:0 auto 12px;max-width:420px;text-align:center}.vd-m-try{font-size:13px;color:#9CA3AF;text-decoration:underline;text-underline-offset:3px;background:none;border:none;cursor:pointer;padding:0;margin:10px auto 0;display:block;text-align:center;font-weight:500}.vd-m-try:hover{color:#64748B}.vd-m-live-tweak .vd-status-pill.completed{background:#F3F4F6;border-color:#E5E7EB;color:#6B7280}.vd-m-live-tweak .vd-status-pill.completed .vd-status-dot{background:#9CA3AF;animation:none}.vd-m-live-tweak .vd-status-body{color:#6B7280}.vd-field input,.vd-field textarea,.vd-url-input{font-size:16px !important}}`;
const verticalDemoUiTweaks = String.raw`@media (max-width:768px){.vd-page-header{align-items:center}.vd-hero-h1,.vd-hero-sub{text-align:center;margin-left:auto;margin-right:auto}.vd-m-card{border:1px solid #e5e7eb}}`;
const serviceVariantStyles = String.raw`.vd-svc-chevron{width:28px;height:28px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;color:#6B7280;display:inline-flex;align-items:center;justify-content:center;font-size:14px;line-height:1;cursor:pointer;transition:transform .16s,border-color .16s,color .16s,background .16s;-webkit-appearance:none}.vd-svc-chevron:hover{border-color:var(--va);color:var(--va);background:color-mix(in srgb,var(--va) 5%,#fff)}.vd-svc-chevron.open{transform:rotate(180deg);border-color:color-mix(in srgb,var(--va) 35%,#E5E7EB);color:var(--va)}.vd-svc-chevron-placeholder{width:28px;height:28px;display:inline-block}.vd-svc-variant-panel{border:0;border-radius:0;background:#F9FAFB;padding:14px 12px 12px 48px;margin:-7px 0 7px}.vd-svc-variant-panel.mobile{margin:0;border:solid #E5E7EB;border-width:1px 0 0;border-radius:0;background:#fff;padding:12px 10px 10px 34px}.vd-svc-variant-heading{font-size:12px;font-weight:600;color:#8A8A8A;margin:0 0 8px}.vd-svc-variant{display:grid;grid-template-columns:minmax(0,1fr) 82px;gap:10px;align-items:center;padding:5px 0;font-size:13px}.vd-svc-variant-main{min-width:0}.vd-svc-variant-label-input{width:100%;border:0;background:transparent;padding:8px 0;font-size:13px;font-weight:500;color:#111827;outline:none;-webkit-appearance:none}.vd-svc-variant-label-input:focus{color:var(--va)}.vd-svc-variant-meta{color:#9CA3AF;margin-top:-2px;font-size:11px}.vd-svc-variant-price-wrap{position:relative;width:82px}.vd-svc-variant-price-wrap span{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:12px;color:#6B7280;pointer-events:none}.vd-svc-variant-price-input{width:100%;border:1px solid #E5E7EB;border-radius:12px;background:#fff;padding:9px 10px 9px 23px;text-align:right;font-size:13px;font-weight:600;color:#111827;outline:none;font-variant-numeric:tabular-nums;-webkit-appearance:none}.vd-svc-variant-price-input:focus{border-color:var(--va);box-shadow:0 0 0 2px color-mix(in srgb,var(--va) 12%,transparent)}.vd-svc-variant-price-input::-webkit-outer-spin-button,.vd-svc-variant-price-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}.vd-svc-variant-price-input[type=number]{appearance:textfield}`;

function cloneServices(services: DemoServiceCategory[]): DemoServiceCategory[] {
  return services.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i, variants: i.variants?.map((variant) => ({ ...variant })) })) }));
}
function ensureSessionId(): string {
  if (typeof window === 'undefined') return 'demo_session_server';
  const key = 'rb_demo_session_id';
  const cur = window.localStorage.getItem(key);
  if (cur) return cur;
  const next = `demo_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  window.localStorage.setItem(key, next);
  return next;
}
function splitStaff(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8);
}
function stageLabel(stage: DemoStage): string {
  if (stage === 'queued') return 'Connecting';
  if (stage === 'dialing') return 'Connecting';
  if (stage === 'live') return 'Live';
  if (stage === 'completed') return 'Ended';
  if (stage === 'failed') return 'Error';
  return 'Ready';
}

function microphoneErrorMessage(error: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Microphone access requires HTTPS or localhost. Please open the web demo on a secure URL, or call the demo number instead.';
  }

  const name =
    error instanceof DOMException
      ? error.name
      : typeof error === 'object' && error !== null && 'name' in error
        ? String((error as { name?: unknown }).name ?? '')
        : '';

  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
    return 'Microphone access is blocked for this site. Please allow microphone access in your browser site settings, then try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found. Please connect a microphone or call the demo number instead.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Your microphone is busy or unavailable. Please close other apps using it, then try again.';
  }

  return 'Microphone access is needed to start the web demo. Please allow microphone access and try again.';
}


type DemoExperienceMode = 'public' | 'prepared';

type DemoExperienceProps = {
  mode: DemoExperienceMode;
  vertical: DemoVerticalSlug;
  /** E.164 from server `DEMO_PHONE_*` env; falls back to legacy shared line when unset. */
  demoPhoneE164?: string | null;
  /** Set on the sales /try/<slug> page so demo tracking is reported back to sales. */
  preparedDemoSlug?: string;
  /** Seed values for a sales prepared demo — pre-fills the business so the demo is personalized. */
  initialBusinessName?: string;
  initialAddress?: string | null;
  initialCity?: string | null;
  initialLogoUrl?: string | null;
  initialServices?: string[];
  initialServiceDetails?: PreparedDemoServiceDetail[];
  initialStaffNames?: string[];
  initialPrimaryHours?: string | null;
  initialSecondaryHours?: string | null;
};

type LegacyMarketingVerticalDemoTemplateProps = Omit<DemoExperienceProps, 'mode'>;

export function MarketingVerticalDemoTemplate(props: LegacyMarketingVerticalDemoTemplateProps) {
  return (
    <DemoExperience
      {...props}
      mode={props.preparedDemoSlug ? 'prepared' : 'public'}
    />
  );
}

export function DemoExperience({
  mode,
  vertical,
  demoPhoneE164,
  preparedDemoSlug,
  initialBusinessName,
  initialAddress,
  initialCity,
  initialLogoUrl,
  initialServices,
  initialServiceDetails,
  initialStaffNames,
  initialPrimaryHours,
  initialSecondaryHours,
}: DemoExperienceProps) {
  const config = DEMO_VERTICALS[vertical];
  const isPreparedDemo = mode === 'prepared';
  const ctaLabel = isPreparedDemo ? 'Try it now' : 'Start Demo Call';
  const turnstileWrapperStyle = isPreparedDemo ? hiddenTurnstileStyle : visibleTurnstileStyle;
  const otherDemoVerticals = useMemo((): DemoVerticalConfig[] => [], []);
  const resolvedDemoPhoneE164 = useMemo(() => normalizeDemoPhoneE164(demoPhoneE164), [demoPhoneE164]);
  const verticalDemoPhoneTel = useMemo(() => `tel:${resolvedDemoPhoneE164}`, [resolvedDemoPhoneE164]);
  const verticalDemoPhoneDisplay = useMemo(() => formatE164ForDisplay(resolvedDemoPhoneE164), [resolvedDemoPhoneE164]);
  const initialPreparedServiceCategories: DemoServiceCategory[] = buildDemoServiceCategoriesFromPrepared(initialServiceDetails);
  const initialLegacyServiceCategories: DemoServiceCategory[] =
    initialServices && initialServices.length > 0
      ? [{
          id: 'services',
          label: 'Services',
          items: initialServices.slice(0, 40).map((name) => ({ name, price: 0, enabled: true })),
        }]
      : [];
  const initialDemoServiceCategories: DemoServiceCategory[] =
    initialPreparedServiceCategories.length > 0
      ? initialPreparedServiceCategories
      : initialLegacyServiceCategories.length > 0
        ? initialLegacyServiceCategories
        : config.serviceCategories;

  const [business, setBusiness] = useState<DemoBusinessConfig>({
    businessName: initialBusinessName?.trim() || config.defaultBusinessName,
    address: initialAddress?.trim() || '',
    city: initialCity?.trim() || config.defaultCity,
    primaryHours: initialPrimaryHours?.trim() || config.hours.primary,
    secondaryHours: initialSecondaryHours?.trim() || config.hours.secondary,
    staff: initialStaffNames && initialStaffNames.length > 0 ? initialStaffNames.join(', ') : config.staffPlaceholder,
    notes: '',
    services: cloneServices(initialDemoServiceCategories),
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(initialDemoServiceCategories[0]?.id ?? config.serviceCategories[0]?.id ?? '');
  const [expandedServiceRows, setExpandedServiceRows] = useState<Record<string, boolean>>({});
  const [stage, setStage] = useState<DemoStage>('idle');
  const [statusText, setStatusText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [demoLineCopied, setDemoLineCopied] = useState(false);
  const [showAllPrompts, setShowAllPrompts] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(!turnstileSiteKey);
  const pollTimerRef = useRef<number | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileRenderedRef = useRef(false);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const directPeerRef = useRef<RTCPeerConnection | null>(null);
  const directStreamRef = useRef<MediaStream | null>(null);
  const directDataChannelRef = useRef<RTCDataChannel | null>(null);
  const directAudioRef = useRef<HTMLAudioElement | null>(null);
  const directConnectTimerRef = useRef<number | null>(null);
  const directMaxDurationTimerRef = useRef<number | null>(null);
  const directEndCallTailGraceTimerRef = useRef<number | null>(null);
  const directRealtimeRequestIdRef = useRef<string | null>(null);
  const directDurationTimerStartedRef = useRef(false);
  const directPeerFailureMutedRef = useRef(false);
  const demoStartLockRef = useRef(false);
  const transcriptTurnsRef = useRef<TranscriptTurn[]>([]);
  const suggestionsLoadedRef = useRef(false);

  const [suggestedQuestions, setSuggestedQuestions] = useState<string[] | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [callExtracted, setCallExtracted] = useState<CallExtracted | null>(null);
  const [callExtracting, setCallExtracting] = useState(false);

  const [sitePhase, setSitePhase] = useState<SitePhase>('idle');
  const [siteLoadStep, setSiteLoadStep] = useState(0);
  const [siteDelayMessage, setSiteDelayMessage] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState('');
  const [extractedData, setExtractedData] = useState<ExtractedDemoData | null>(null);
  const [siteLoadError, setSiteLoadError] = useState<string | null>(null);
  const siteLoadTimersRef = useRef<number[]>([]);
  const siteLoadStartRef = useRef<number>(0);

  const isMobileDemo = useMediaMax768();
  const isVerySmallDemo = useMediaMax400();
  const isMobileDemoRef = useRef(false);
  useEffect(() => {
    isMobileDemoRef.current = isMobileDemo;
  }, [isMobileDemo]);

  const preparedLogoUrl = isPreparedDemo && initialLogoUrl?.trim() ? initialLogoUrl.trim() : null;
  const [preparedLogoFailed, setPreparedLogoFailed] = useState(false);
  useEffect(() => {
    setPreparedLogoFailed(false);
  }, [preparedLogoUrl]);

  const demoDisplayName = useMemo(
    () => business.businessName.trim() || config.defaultBusinessName,
    [business.businessName, config.defaultBusinessName],
  );
  const demoInitials = useMemo(() => initialsForBusinessName(demoDisplayName), [demoDisplayName]);
  const displayedPreparedLogoUrl = preparedLogoUrl && !preparedLogoFailed ? preparedLogoUrl : null;
  const preparedDemoCity = initialCity?.trim() ?? '';
  const pageEyebrow = isPreparedDemo ? null : config.eyebrow;
  const pageTitle = isPreparedDemo
    ? isVerySmallDemo
      ? `${demoDisplayName}'s AI Receptionist`
      : `Try ${demoDisplayName}'s AI Receptionist`
    : config.title;
  const pageSubtitle = isPreparedDemo
    ? preparedDemoCity
      ? `This demo is customized for ${demoDisplayName} in ${preparedDemoCity}`
      : `This demo is customized for ${demoDisplayName}`
    : config.subtitle;
  const preparedDemoFaqItems = useMemo(() => buildPreparedDemoFaqItems(demoDisplayName), [demoDisplayName]);
  const demoFaqItems = isPreparedDemo ? preparedDemoFaqItems : VERTICAL_DEMO_FAQ_ITEMS;
  const demoFaqTitle = isPreparedDemo ? `About this demo for ${demoDisplayName}` : 'About this live demo';
  const demoFaqJsonLd = useMemo(() => buildFaqPageJsonLd(demoFaqItems), [demoFaqItems]);
  const importAddressDisplay = business.address.trim() || extractedData?.address?.trim() || '';
  const importAddressPlaceholder = extractedData?.address?.trim() || 'e.g. 123 Main St, Los Angeles, CA';

  const [siteManualFallback, setSiteManualFallback] = useState(false);
  const [importedDetailsEdit, setImportedDetailsEdit] = useState(false);
  const [mobileFoundEdit, setMobileFoundEdit] = useState(false);
  const [mobileImportRows, setMobileImportRows] = useState<MobileImportRowStatus[]>(['pending', 'pending', 'pending', 'pending']);
  const [mobileImportProgress, setMobileImportProgress] = useState(0);
  const [mobileImportHeadline, setMobileImportHeadline] = useState('Reading your website...');
  const [mobileImportSubline, setMobileImportSubline] = useState('Pulling business name, hours, and services.');
  const [mobileImportPill, setMobileImportPill] = useState<string | null>(null);
  const [mobileImportEscape, setMobileImportEscape] = useState(false);
  const mobileImportTimersRef = useRef<number[]>([]);

  const [captchaHint, setCaptchaHint] = useState<string | null>(null);
  const [captchaEpoch, setCaptchaEpoch] = useState(0);

  const activeCategory = useMemo(
    () => business.services.find((c) => c.id === selectedCategory) ?? business.services[0],
    [business.services, selectedCategory],
  );
  const currentServiceCategorySummary = useMemo(
    () =>
      business.services
        .map((cat) => ({ label: cat.label, count: cat.items.filter((item) => item.enabled).length }))
        .filter((cat) => cat.count > 0),
    [business.services],
  );

  // Personalized AI questions when available; otherwise the static per-vertical defaults.
  const activePrompts = suggestedQuestions ?? config.tryAsking;
  const visiblePrompts = showAllPrompts ? activePrompts : activePrompts.slice(0, 5);
  const hiddenCount = Math.max(0, activePrompts.length - 5);
  const isSubmitting = stage === 'queued' || stage === 'dialing' || stage === 'live';
  const isActive = stage !== 'idle';
  useEffect(() => () => {
    clearPollTimer();
    cleanupDirectRealtime();
    cancelSiteLoadTimers();
    mobileImportTimersRef.current.forEach((t) => window.clearTimeout(t));
    mobileImportTimersRef.current = [];
  }, []);

  /** When leaving the form for the live demo, remove Turnstile so the widget can mount again on return. */
  useEffect(() => {
    if (!isActive || !turnstileSiteKey) return;
    return () => {
      const tw = (window as Window & { turnstile?: { remove: (id: string) => void } }).turnstile;
      if (turnstileWidgetIdRef.current && tw) {
        try {
          tw.remove(turnstileWidgetIdRef.current);
        } catch {
          /* ignore */
        }
      }
      turnstileWidgetIdRef.current = null;
      turnstileRenderedRef.current = false;
      setCaptchaToken(null);
    };
  }, [isActive, turnstileSiteKey]);

  useEffect(() => {
    if (!turnstileSiteKey || turnstileReady) return;
    const t = window.setInterval(() => {
      if ((window as Window & { turnstile?: unknown }).turnstile) setTurnstileReady(true);
    }, 300);
    return () => window.clearInterval(t);
  }, [turnstileReady, turnstileSiteKey]);

  useLayoutEffect(() => {
    if (!turnstileSiteKey || !turnstileReady || turnstileRenderedRef.current || isActive) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = turnstileRef.current;
        const tw = (window as Window & { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id: string) => void } }).turnstile;
        if (!el || !tw || turnstileRenderedRef.current) return;
        try {
          turnstileWidgetIdRef.current = tw.render(el, {
            sitekey: turnstileSiteKey,
            theme: 'light',
            callback: (token: string) => {
              setCaptchaHint(null);
              setCaptchaToken(token);
            },
            'error-callback': () => {
              setCaptchaToken(null);
              setCaptchaHint('Verification could not load. Try disabling ad blockers or allow challenges.cloudflare.com.');
            },
            'expired-callback': () => setCaptchaToken(null),
          });
          turnstileRenderedRef.current = true;
        } catch {
          setCaptchaHint('Verification widget failed to start. Please refresh the page.');
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [turnstileReady, turnstileSiteKey, isActive, captchaEpoch]);

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileReady || isActive) return;
    const t = window.setTimeout(() => {
      if (!turnstileRenderedRef.current) {
        setCaptchaHint((h) => h ?? 'If you do not see a checkbox, allow scripts from Cloudflare or try another browser.');
      }
    }, 8000);
    return () => window.clearTimeout(t);
  }, [turnstileReady, turnstileSiteKey, isActive, captchaEpoch]);

  function updateService(catId: string, idx: number, patch: Partial<DemoServiceCategory['items'][number]>) {
    setBusiness((cur) => ({
      ...cur,
      services: cur.services.map((c) =>
        c.id === catId ? { ...c, items: c.items.map((item, i) => (i === idx ? { ...item, ...patch } : item)) } : c,
      ),
    }));
  }

  function updateServiceVariant(catId: string, itemIdx: number, variantIdx: number, patch: Partial<DemoServiceVariant>) {
    setBusiness((cur) => ({
      ...cur,
      services: cur.services.map((c) =>
        c.id === catId
          ? {
              ...c,
              items: c.items.map((item, i) =>
                i === itemIdx
                  ? {
                      ...item,
                      variants: (item.variants ?? []).map((variant, vIdx) => (vIdx === variantIdx ? { ...variant, ...patch } : variant)),
                    }
                  : item,
              ),
            }
          : c,
      ),
    }));
  }

  function serviceRowKey(catId: string, itemName: string, idx: number) {
    return `${catId}:${idx}:${itemName.toLowerCase()}`;
  }

  function renderServiceVariantChevron(catId: string, item: DemoServiceCategory['items'][number], idx: number) {
    const rowKey = serviceRowKey(catId, item.name, idx);
    const hasVariants = (item.variants?.length ?? 0) > 0;
    if (!hasVariants) return <span className="vd-svc-chevron-placeholder" aria-hidden="true" />;
    const expanded = Boolean(expandedServiceRows[rowKey]);
    return (
      <button
        type="button"
        className={`vd-svc-chevron${expanded ? ' open' : ''}`}
        aria-label={`${expanded ? 'Hide' : 'Show'} variants for ${item.name}`}
        aria-expanded={expanded}
        onClick={() => setExpandedServiceRows((cur) => ({ ...cur, [rowKey]: !cur[rowKey] }))}
      >
        ▾
      </button>
    );
  }

  function renderServiceVariantPanel(catId: string, item: DemoServiceCategory['items'][number], idx: number, mobile = false) {
    const rowKey = serviceRowKey(catId, item.name, idx);
    const variants = item.variants ?? [];
    if (!variants.length || !expandedServiceRows[rowKey]) return null;
    return (
      <div className={`vd-svc-variant-panel${mobile ? ' mobile' : ''}`}>
        <div className="vd-svc-variant-heading">Variants</div>
        {variants.map((variant, variantIdx) => {
          const meta = [variant.duration, variant.notes].map((value) => value?.trim()).filter(Boolean).join(' · ');
          return (
            <div className="vd-svc-variant" key={`${rowKey}-variant-${variantIdx}`}>
              <div className="vd-svc-variant-main">
                <input
                  className="vd-svc-variant-label-input"
                  value={variant.label}
                  onChange={(event) => updateServiceVariant(catId, idx, variantIdx, { label: event.target.value })}
                  aria-label={`Variant name for ${item.name}`}
                />
                {meta ? <div className="vd-svc-variant-meta">{meta}</div> : null}
              </div>
              <div className="vd-svc-variant-price-wrap">
                <span aria-hidden="true">$</span>
                <input
                  className="vd-svc-variant-price-input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={variant.price ?? ''}
                  onChange={(event) => updateServiceVariant(catId, idx, variantIdx, { price: event.target.value === '' ? null : Number(event.target.value) || 0 })}
                  aria-label={`Variant price for ${variant.label || item.name}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function validate(): string[] {
    const errs: string[] = [];
    if (!business.businessName.trim()) errs.push('Business name is required.');
    if (turnstileSiteKey && !captchaToken) errs.push('Please complete human verification (checkbox above).');
    return errs;
  }

  function cancelSiteLoadTimers() {
    siteLoadTimersRef.current.forEach((t) => window.clearTimeout(t));
    siteLoadTimersRef.current = [];
  }

  function cancelMobileImportUiTimers() {
    mobileImportTimersRef.current.forEach((t) => window.clearTimeout(t));
    mobileImportTimersRef.current = [];
  }

  function resetMobileImportUi() {
    cancelMobileImportUiTimers();
    setMobileImportRows(['pending', 'pending', 'pending', 'pending']);
    setMobileImportProgress(0);
    setMobileImportHeadline('Reading your website...');
    setMobileImportSubline('Pulling business name, hours, and services.');
    setMobileImportPill(null);
    setMobileImportEscape(false);
  }

  function startMobileImportUi() {
    cancelMobileImportUiTimers();
    setMobileImportRows(['spinning', 'pending', 'pending', 'pending']);
    setMobileImportProgress(12);
    setMobileImportHeadline('Reading your website...');
    setMobileImportSubline('Pulling business name, hours, and services.');
    setMobileImportPill(null);
    setMobileImportEscape(false);
    mobileImportTimersRef.current.push(
      window.setTimeout(() => {
        setMobileImportRows(['done', 'spinning', 'pending', 'pending']);
        setMobileImportProgress(34);
      }, 2000),
    );
    mobileImportTimersRef.current.push(
      window.setTimeout(() => {
        setMobileImportRows(['done', 'done', 'spinning', 'pending']);
        setMobileImportProgress(60);
        setMobileImportPill('This usually takes 1–2 minutes.');
      }, 5000),
    );
    mobileImportTimersRef.current.push(
      window.setTimeout(() => {
        setMobileImportSubline('Still reading your site — this usually takes 1–2 minutes.');
        setMobileImportEscape(true);
      }, 25000),
    );
  }

  function completeMobileImportUiSuccess() {
    cancelMobileImportUiTimers();
    setMobileImportRows(['done', 'done', 'done', 'done']);
    setMobileImportProgress(100);
    setMobileImportPill(null);
    setMobileImportEscape(false);
  }

  function exitToManualForm() {
    cancelSiteLoadTimers();
    cancelMobileImportUiTimers();
    resetMobileImportUi();
    resetTurnstile();
    setImportedDetailsEdit(false);
    if (isMobileDemoRef.current) {
      setSiteManualFallback(true);
    }
    setSitePhase('idle');
    setSiteLoadStep(0);
    setSiteDelayMessage(null);
    setSiteLoadError(null);
  }

  async function readWebsite() {
    const url = siteUrl.trim();
    if (!url) return;
    cancelSiteLoadTimers();
    cancelMobileImportUiTimers();
    setSitePhase('loading');
    setSiteLoadStep(0);
    setSiteLoadError(null);
    setSiteDelayMessage(null);
    setImportedDetailsEdit(false);
    siteLoadStartRef.current = Date.now();

    const mobile = isMobileDemoRef.current;
    if (mobile) {
      startMobileImportUi();
    } else {
      const stepCheckpoints = [1800, 4000, 6500];
      const delayCheckpoints: Array<[number, string]> = [
        [25000, 'Still reading your site — this usually takes 1–2 minutes.'],
        [60000, 'Almost there — larger menus take a little longer.'],
        [100000, 'Wrapping up… hang tight.'],
      ];
      siteLoadTimersRef.current = [
        ...stepCheckpoints.map((delay) =>
          window.setTimeout(() => setSiteLoadStep(importProgressStepIndex(delay)), delay),
        ),
        ...delayCheckpoints.map(([delay, msg]) =>
          window.setTimeout(() => setSiteDelayMessage(msg), delay),
        ),
      ];
    }
    if (mobile) {
      mobileImportTimersRef.current.push(
        window.setTimeout(() => {
          setMobileImportSubline('Wrapping up… hang tight.');
          setMobileImportPill('Almost there — larger menus take a little longer.');
          setMobileImportEscape(true);
        }, 100000),
      );
    }

    try {
      const res = await fetch('/api/backend/public/demo/import-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as { ok: boolean; suggestions?: DemoImportSuggestions; error?: string; message?: string };

      cancelSiteLoadTimers();
      cancelMobileImportUiTimers();

      if (data.ok && data.suggestions) {
        const s = data.suggestions;
        const businessName = s.businessProfile?.name?.value ?? '';
        const address = s.businessProfile?.address?.value ?? '';
        const { displayCity } = parseCityFromAddress(address);
        const hours = formatDemoApiHours(s.hours?.value);
        const services = filterDemoServices(s.serviceCatalog?.services ?? []).slice(0, 40);
        const staffNames = (s.staffSuggestions ?? [])
          .map((staff) => staff.name.trim())
          .filter(Boolean)
          .slice(0, 8);
        const policyTypes = (s.policySuggestions ?? [])
          .map((p) => p.type)
          .filter((t): t is string => Boolean(t))
          .slice(0, 10);
        // Real categorized services for the voice agent (not just the display chips).
        const importedServiceCategories = buildDemoServiceCategoriesFromImport(s.serviceCatalog?.services ?? []);

        if (isMobileDemoRef.current) {
          completeMobileImportUiSuccess();
        } else {
          setSiteLoadStep(IMPORT_PROGRESS_STEPS.length);
        }
        setSiteDelayMessage(null);

        const elapsed = Date.now() - siteLoadStartRef.current;
        window.setTimeout(() => {
          const extractedResult: ExtractedDemoData = {
            businessName,
            address,
            city: displayCity,
            hours,
            services,
            staff: staffNames,
            policies: policyTypes,
            serviceCategories: importedServiceCategories.map((c) => ({ label: c.label, count: c.items.length })),
          };
          setExtractedData(extractedResult);
          setBusiness((cur) => ({
            ...cur,
            businessName: businessName || cur.businessName,
            address,
            city: displayCity,
            primaryHours: hours,
            secondaryHours: '',
            staff: staffNames.join(', '),
            // Voice agent uses only the salon's imported services after a website read.
            // If none were found, keep this empty instead of falling back to sample services.
            services: importedServiceCategories,
          }));
          if (importedServiceCategories.length > 0 && importedServiceCategories[0]) {
            setSelectedCategory(importedServiceCategories[0].id);
          }
          setSiteManualFallback(false);
          setImportedDetailsEdit(false);
          resetTurnstile();
          setSitePhase('ready');
          setMobileFoundEdit(false);
          // Pre-generate personalized questions once the website read succeeds with real services.
          if (services.length > 0) void fetchSuggestedQuestions(extractedResult);
        }, Math.max(0, 900 - elapsed));
      } else {
        setSiteLoadError(data.message ?? 'Could not read that website. You can fill in the details manually.');
        resetTurnstile();
        setSitePhase('error');
        if (isMobileDemoRef.current) resetMobileImportUi();
      }
    } catch {
      cancelSiteLoadTimers();
      cancelMobileImportUiTimers();
      setSiteLoadError('Network error. Please try again.');
      resetTurnstile();
      setSitePhase('error');
      if (isMobileDemoRef.current) resetMobileImportUi();
    }
  }

  function clearPollTimer() {
    if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
  }

  async function pollStatus(p: { requestId: string; previewToken: string; attempt?: number }) {
    const attempt = p.attempt ?? 1;
    if (attempt > DEMO_STATUS_MAX_POLL_ATTEMPTS) {
      clearPollTimer();
      setStage('failed');
      setStatusText(DEMO_STATUS_TIMEOUT_MESSAGE);
      setRequestError(DEMO_STATUS_TIMEOUT_MESSAGE);
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      return;
    }

    try {
      const res = await fetch(`/api/backend/public/demo/status/${encodeURIComponent(p.requestId)}?token=${encodeURIComponent(p.previewToken)}`);
      const body = (await res.json()) as DemoStatusResponse;
      if (!body.ok || !body.stage) {
        clearPollTimer();
        setRequestError(apiUserVisibleMessage(body, 'Unable to check demo status.'));
        setStage('failed');
        setStatusText('Unable to check demo status. Please try again.');
        return;
      }
      setStage(body.stage);
      if (body.stage === 'queued') setStatusText('Connecting your browser session to the demo room…');
      if (body.stage === 'dialing') setStatusText('Connecting your browser session to the demo room…');
      if (body.stage === 'live') setStatusText('You\'re connected — speak naturally or tap a prompt below.');
      if (body.stage === 'completed') {
        setStatusText('Session ended.');
        return;
      }
      if (body.stage === 'failed') {
        setStatusText('The demo session could not complete. You can try again or call the demo line.');
        return;
      }
      const nextAttempt = body.stage === 'live' ? 1 : attempt + 1;
      pollTimerRef.current = window.setTimeout(() => void pollStatus({ ...p, attempt: nextAttempt }), DEMO_STATUS_POLL_INTERVAL_MS);
    } catch {
      clearPollTimer();
      setStage('failed');
      setStatusText('Network error while checking demo status.');
      setRequestError('Network error while checking demo status.');
    }
  }

  function resetTurnstile() {
    if (!turnstileSiteKey) return;
    const tw = (window as Window & { turnstile?: { reset: (id: string) => void; remove: (id: string) => void } }).turnstile;
    if (turnstileWidgetIdRef.current && tw) {
      try {
        tw.remove(turnstileWidgetIdRef.current);
      } catch {
        try {
          tw.reset(turnstileWidgetIdRef.current);
        } catch {
          /* ignore */
        }
      }
    }
    turnstileWidgetIdRef.current = null;
    turnstileRenderedRef.current = false;
    setCaptchaToken(null);
    setCaptchaHint(null);
    setCaptchaEpoch((e) => e + 1);
  }

  async function copyDemoPhoneNumber() {
    try {
      await navigator.clipboard.writeText(resolvedDemoPhoneE164);
      setDemoLineCopied(true);
      window.setTimeout(() => setDemoLineCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function requestDemoMicrophone({ keepAlive }: { keepAlive: boolean }): Promise<MediaStream | null> {
    if (!window.isSecureContext) {
      setErrors([microphoneErrorMessage(null)]);
      return null;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrors([
        'Your browser does not support microphone access for the web demo. Please try Chrome or Safari, or call the demo number instead.',
      ]);
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!keepAlive) {
        stream.getTracks().forEach((track) => track.stop());
      }
      return stream;
    } catch (error) {
      setErrors([microphoneErrorMessage(error)]);
      return null;
    }
  }

  function buildDemoPayload() {
    return {
      shopName: business.businessName,
      businessType: config.businessType,
      notes: business.notes || undefined,
      captchaToken: turnstileSiteKey ? captchaToken : 'dev-turnstile-bypass',
      sessionId: ensureSessionId(),
      website: '',
      demoConfig: {
        address: business.address || undefined,
        city: business.address ? undefined : business.city || (sitePhase === 'ready' ? undefined : config.defaultCity),
        primaryHours: business.primaryHours,
        secondaryHours: business.secondaryHours,
        staffNames: splitStaff(business.staff),
        useDefaultFallbacks: sitePhase !== 'ready',
        services: business.services.flatMap((c) =>
          c.items.map((item) => ({
            category: c.label,
            name: item.name,
            price: item.price,
            duration: item.duration,
            enabled: item.enabled,
            variants: item.variants?.map((variant) => ({
              label: variant.label,
              price: variant.price ?? null,
              duration: variant.duration ?? null,
              priceType: variant.priceType ?? null,
              notes: variant.notes ?? null,
            })),
          })),
        ),
      },
      demoVertical: config.slug,
      demoMode: 'quick',
      demoSource: isPreparedDemo ? 'sales_prepared_try_page' : 'public_demo_page',
      importedSiteUrl: sitePhase === 'ready' ? siteUrl.trim() || undefined : undefined,
      ...(preparedDemoSlug ? { preparedDemoSlug } : {}),
    };
  }

  function clearDirectConnectTimer() {
    if (directConnectTimerRef.current) window.clearTimeout(directConnectTimerRef.current);
    directConnectTimerRef.current = null;
  }

  function clearDirectMaxDurationTimer() {
    if (directMaxDurationTimerRef.current != null) {
      window.clearTimeout(directMaxDurationTimerRef.current);
      directMaxDurationTimerRef.current = null;
    }
  }

  function clearDirectEndCallTailGraceTimer() {
    if (directEndCallTailGraceTimerRef.current != null) {
      window.clearTimeout(directEndCallTailGraceTimerRef.current);
      directEndCallTailGraceTimerRef.current = null;
    }
  }

  function releaseDirectRealtimeSlotFireAndForget(
    requestId: string,
    endReason: 'completed' | 'timeout' = 'completed',
  ) {
    const url = '/api/backend/public/demo/realtime-session/release';
    const payload = JSON.stringify({ requestId, endReason });
    // sendBeacon is more reliable during page unload (tab close, navigation away).
    // Use a Blob to preserve application/json so the server-side body parser works.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const sent = navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
      if (sent) return;
    }
    void fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(typeof window !== 'undefined' && window.location?.origin
          ? { Origin: window.location.origin }
          : {}),
      },
      body: payload,
    }).catch(() => {
      /* ignore */
    });
  }

  /**
   * Awaitable variant of the slot release — used at the start of a new demo so
   * the concurrent-slot ledger on the server has time to free the previous slot
   * before `POST /realtime-session` is issued. Without this, a fast End→Start
   * sequence races with the sendBeacon release and hits `demo_concurrent_
   * session_limit`. Any HTTP status (200, 404 already-expired, 429, 5xx) is
   * treated as "proceed" — the new POST will surface the real state.
   */
  async function awaitDirectRealtimeSlotRelease(
    requestId: string,
    endReason: 'completed' | 'timeout' = 'completed',
  ): Promise<void> {
    const url = '/api/backend/public/demo/realtime-session/release';
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(typeof window !== 'undefined' && window.location?.origin
            ? { Origin: window.location.origin }
            : {}),
        },
        body: JSON.stringify({ requestId, endReason }),
      });
    } catch {
      /* network error — proceed; new POST will surface any state issue */
    }
  }

  function beginDirectDemoMaxDurationTimer() {
    if (directDurationTimerStartedRef.current) return;
    directDurationTimerStartedRef.current = true;
    clearDirectMaxDurationTimer();
    directMaxDurationTimerRef.current = window.setTimeout(() => {
      directPeerFailureMutedRef.current = true;
      cleanupDirectRealtime({ endReason: 'timeout' });
      resetTurnstile();
      setStage('failed');
      setStatusText(DIRECT_REALTIME_DEMO_DURATION_MESSAGE);
      setRequestError(DIRECT_REALTIME_DEMO_DURATION_MESSAGE);
    }, DIRECT_OPENAI_MAX_SESSION_MS);
  }

  function cleanupDirectRealtime(opts?: { endReason?: 'completed' | 'timeout' }) {
    clearDirectMaxDurationTimer();
    clearDirectConnectTimer();
    clearDirectEndCallTailGraceTimer();
    const releaseRequestId = directRealtimeRequestIdRef.current;
    directRealtimeRequestIdRef.current = null;
    directDurationTimerStartedRef.current = false;
    if (releaseRequestId) {
      releaseDirectRealtimeSlotFireAndForget(releaseRequestId, opts?.endReason ?? 'completed');
    }
    directDataChannelRef.current?.close();
    directDataChannelRef.current = null;
    if (directPeerRef.current) {
      directPeerRef.current.ontrack = null;
      directPeerRef.current.onconnectionstatechange = null;
      directPeerRef.current.close();
    }
    directPeerRef.current = null;
    directStreamRef.current?.getTracks().forEach((track) => track.stop());
    directStreamRef.current = null;
    if (directAudioRef.current) {
      directAudioRef.current.pause();
      directAudioRef.current.srcObject = null;
      directAudioRef.current = null;
    }
  }

  async function startDirectOpenAiDemo(preauthorizedStream?: MediaStream) {
    // Capture previous requestId BEFORE cleanup (cleanup will null the ref out).
    // Used to await server-side slot release and avoid the End→Start race that
    // hits `demo_concurrent_session_limit`.
    const previousRequestId = directRealtimeRequestIdRef.current;
    cleanupDirectRealtime();
    directPeerFailureMutedRef.current = false;
    clearPollTimer();

    // Race fix: cleanupDirectRealtime fires the slot release via sendBeacon
    // (fire-and-forget). If the user just ended a demo and is starting another
    // within ~500ms, the new POST /realtime-session may reach the server before
    // sendBeacon is processed → server sees the old slot still occupied → 429
    // `demo_concurrent_session_limit`. Awaiting the release here guarantees the
    // slot is freed before the new POST goes out. Adds ~100-300ms only when
    // there IS a previous demo; first-start path stays fast.
    if (previousRequestId) {
      await awaitDirectRealtimeSlotRelease(previousRequestId);
    }

    setStatusText('Requesting microphone…');

    const stream = preauthorizedStream ?? await requestDemoMicrophone({ keepAlive: true });
    if (!stream) {
      setStage('idle');
      setStatusText('');
      return;
    }
    directStreamRef.current = stream;

    setStatusText('Creating demo session…');
    const sessionResponse = await fetch('/api/backend/public/demo/realtime-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(typeof window !== 'undefined' && window.location?.origin
          ? { Origin: window.location.origin }
          : {}),
      },
      body: JSON.stringify(buildDemoPayload()),
    });
    const sessionBody = (await sessionResponse.json().catch(() => ({}))) as DirectRealtimeApiResponse;

    if (!sessionResponse.ok || !sessionBody.ok || !sessionBody.clientSecret) {
      const msg = userMessageForDirectDemoRealtimeJson(sessionResponse.status, sessionBody as Record<string, unknown>);
      cleanupDirectRealtime();
      resetTurnstile();
      setRequestError(msg);
      setStage('idle');
      setStatusText('');
      return;
    }

    directRealtimeRequestIdRef.current = sessionBody.requestId ?? null;
    logDemoRealtime('session_ok', {
      mode: 'direct_openai',
      hasScriptedWelcome: Boolean(sessionBody.scriptedWelcomeLine?.trim()),
      hasVadResumePayload: Boolean(sessionBody.turnDetectionAfterWelcome),
      vadResumeCreateResponse: sessionBody.turnDetectionAfterWelcome?.create_response,
    });

    try {
      setStatusText('Connecting to the voice demo…');
      const pc = new RTCPeerConnection();
      directPeerRef.current = pc;
      let connected = false;

      directConnectTimerRef.current = window.setTimeout(() => {
        if (connected) return;
        directPeerFailureMutedRef.current = true;
        cleanupDirectRealtime();
        resetTurnstile();
        setStage('failed');
        setStatusText(DEMO_STATUS_TIMEOUT_MESSAGE);
        setRequestError(DEMO_STATUS_TIMEOUT_MESSAGE);
      }, DIRECT_OPENAI_CONNECT_TIMEOUT_MS);

      const audio = new Audio();
      audio.autoplay = true;
      directAudioRef.current = audio;
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0] ?? null;
        void audio.play().catch(() => {
          /* Browser may require the user gesture already used to start the demo. */
        });
        connected = true;
        clearDirectConnectTimer();
        beginDirectDemoMaxDurationTimer();
        setStage('live');
        setStatusText('You\'re connected — the receptionist will greet you first, then you can speak or tap a prompt below.');
      };
      pc.onconnectionstatechange = () => {
        logDemoRealtime('connection_state_change', { state: pc.connectionState });
        if (pc.connectionState === 'connected') {
          connected = true;
          clearDirectConnectTimer();
          beginDirectDemoMaxDurationTimer();
          setStage('live');
          setStatusText('You\'re connected — the receptionist will greet you first, then you can speak or tap a prompt below.');
        }
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          if (directPeerFailureMutedRef.current) return;
          logDemoRealtime('webrtc_ice_failed', { state: pc.connectionState, connected });
          directPeerFailureMutedRef.current = true;
          clearDirectConnectTimer();
          cleanupDirectRealtime();
          resetTurnstile();
          setStage('failed');
          setStatusText('The web demo could not connect. Please check your connection and try again.');
          setRequestError('The web demo could not connect. Please check your connection and try again.');
        }
      };

      // Mute mic during greeting: prevents speaker echo / room noise from
      // reaching OpenAI's semantic_vad and truncating the opening greeting.
      // Tracks are re-enabled on `output_audio_buffer.stopped` for the first
      // response (or via fallback timer if that event never arrives).
      const micTracks: MediaStreamTrack[] = [];
      for (const track of stream.getAudioTracks()) {
        track.enabled = false;
        micTracks.push(track);
        logDemoRealtime('mic_track', {
          trackId: track.id,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          label: track.label,
          mutedForGreeting: true,
        });
        pc.addTrack(track, stream);
      }
      let micEnableFallbackTimer: number | null = window.setTimeout(() => {
        micEnableFallbackTimer = null;
        const needsEnable = micTracks.some((t) => !t.enabled && t.readyState === 'live');
        if (needsEnable) {
          for (const t of micTracks) {
            if (t.readyState === 'live') t.enabled = true;
          }
          logDemoRealtime('mic_unmuted', { reason: 'greeting_fallback_timeout' });
        }
      }, DIRECT_OPENAI_GREETING_MIC_UNMUTE_FALLBACK_MS);
      const enableMicTracks = (reason: string) => {
        if (micEnableFallbackTimer !== null) {
          window.clearTimeout(micEnableFallbackTimer);
          micEnableFallbackTimer = null;
        }
        let anyChanged = false;
        for (const t of micTracks) {
          if (!t.enabled && t.readyState === 'live') {
            t.enabled = true;
            anyChanged = true;
          }
        }
        if (anyChanged) logDemoRealtime('mic_unmuted', { reason });
      };

      const dc = pc.createDataChannel('oai-events');
      directDataChannelRef.current = dc;
      let initialGreetingRequested = false;
      let realtimeSessionReady = false;
      let vadResumeAfterWelcomeSent = false;
      let awaitingInitialGreetingAudioStop = false;
      let toolsRegistered = false;
      let assistantAudioPlaying = false;
      let endCallPending = false;
      let endCallFallbackTimer: number | null = null;
      let endCallFallbackStartedAtMs: number | null = null;
      let latestResponseDone = false;
      let lastResponseCreatedAtMs: number | null = null;
      let lastOutputAudioBufferStoppedAtMs: number | null = null;

      const clearEndCallFallbackTimer = () => {
        if (endCallFallbackTimer !== null) {
          window.clearTimeout(endCallFallbackTimer);
          endCallFallbackTimer = null;
        }
        endCallFallbackStartedAtMs = null;
      };

      const completeDirectDemoAfterEndCall = (reason: string) => {
        if (!endCallPending) return;
        endCallPending = false;
        clearEndCallFallbackTimer();
        clearDirectEndCallTailGraceTimer();
        logDemoRealtime('end_call_complete', { reason });
        endDirectDemo();
      };

      const armEndCallTailGrace = (reason: string) => {
        if (directEndCallTailGraceTimerRef.current !== null) return;
        directEndCallTailGraceTimerRef.current = window.setTimeout(() => {
          directEndCallTailGraceTimerRef.current = null;
          completeDirectDemoAfterEndCall(`${reason}_tail_grace`);
        }, DIRECT_OPENAI_END_CALL_AUDIO_TAIL_GRACE_MS);
        logDemoRealtime('end_call_tail_grace_started', {
          reason,
          delayMs: DIRECT_OPENAI_END_CALL_AUDIO_TAIL_GRACE_MS,
        });
      };

      const armEndCallCompletion = () => {
        if (endCallFallbackTimer !== null) return;
        const startedAt = endCallFallbackStartedAtMs ?? Date.now();
        endCallFallbackStartedAtMs = startedAt;
        endCallFallbackTimer = window.setTimeout(() => {
          endCallFallbackTimer = null;
          if (!endCallPending) {
            endCallFallbackStartedAtMs = null;
            return;
          }
          const elapsedMs = Date.now() - startedAt;
          if (assistantAudioPlaying && elapsedMs < DIRECT_OPENAI_END_CALL_AUDIO_STOP_HARD_FALLBACK_MS) {
            logDemoRealtime('end_call_audio_still_active_fallback_deferred', {
              elapsedMs,
              nextDelayMs: DIRECT_OPENAI_END_CALL_AUDIO_STOP_FALLBACK_MS,
              hardFallbackMs: DIRECT_OPENAI_END_CALL_AUDIO_STOP_HARD_FALLBACK_MS,
            });
            armEndCallCompletion();
            return;
          }
          if (assistantAudioPlaying) {
            logDemoRealtime('end_call_audio_active_hard_fallback', {
              elapsedMs,
              hardFallbackMs: DIRECT_OPENAI_END_CALL_AUDIO_STOP_HARD_FALLBACK_MS,
            });
          }
          completeDirectDemoAfterEndCall('fallback_timeout');
        }, DIRECT_OPENAI_END_CALL_AUDIO_STOP_FALLBACK_MS);
      };

      const finalResponseAudioAlreadyStopped = () =>
        latestResponseDone &&
        lastResponseCreatedAtMs !== null &&
        lastOutputAudioBufferStoppedAtMs !== null &&
        lastOutputAudioBufferStoppedAtMs >= lastResponseCreatedAtMs;

      /** Register demo tools via session.update (once). */
      const registerDemoTools = () => {
        if (toolsRegistered || dc.readyState !== 'open') return;
        toolsRegistered = true;
        try {
          dc.send(
            JSON.stringify({
              type: 'session.update',
              session: {
                type: 'realtime',
                tools: [
                  {
                    type: 'function',
                    name: 'validate_appointment_time',
                    description:
                      'Validates whether a requested appointment date and time falls within business hours. ' +
                      'Call this whenever the caller provides a specific date and time for a booking before confirming it.',
                    parameters: {
                      type: 'object',
                      properties: {
                        date: {
                          type: 'string',
                          description: 'Appointment date in YYYY-MM-DD format.',
                        },
                        time: {
                          type: 'string',
                          description: 'Appointment time in HH:MM 24-hour format.',
                        },
                      },
                      required: ['date', 'time'],
                    },
                  },
                  {
                    type: 'function',
                    name: 'end_call',
                    description:
                      'End the browser demo session after the caller request is fully complete. ' +
                      'Say a brief warm goodbye before calling this tool. ' +
                      'Do not call this as a standalone action; speak the goodbye in the same final response first.',
                    parameters: {
                      type: 'object',
                      properties: {
                        reason: {
                          type: 'string',
                          enum: [
                            'booking_completed',
                            'link_sent',
                            'question_answered',
                            'callback_scheduled',
                            'handoff_initiated',
                            'other',
                          ],
                        },
                      },
                      required: ['reason'],
                    },
                  },
                ],
                tool_choice: 'auto',
              },
            }),
          );
          logDemoRealtime('demo_tools_registered', { tools: ['validate_appointment_time', 'end_call'] });
        } catch (err) {
          toolsRegistered = false;
          logDemoRealtime('demo_tools_register_failed', { err: err instanceof Error ? err.message : String(err) });
        }
      };

      const maybeResumeVadAfterWelcome = (fromEvent: string) => {
        const td = sessionBody.turnDetectionAfterWelcome;
        if (!td || typeof td !== 'object' || Array.isArray(td)) {
          logDemoRealtime('vad_resume_skip', { fromEvent, reason: 'no_turn_detection_payload' });
          return;
        }
        if (vadResumeAfterWelcomeSent) {
          logDemoRealtime('vad_resume_skip', { fromEvent, reason: 'already_sent' });
          return;
        }
        if (dc.readyState !== 'open') {
          logDemoRealtime('vad_resume_skip', { fromEvent, reason: 'data_channel_not_open', dcState: dc.readyState });
          return;
        }
        if (td.create_response !== true) {
          logDemoRealtime('vad_resume_skip', { fromEvent, reason: 'create_response_not_true', create_response: td.create_response });
          return;
        }
        vadResumeAfterWelcomeSent = true;
        try {
          dc.send(
            JSON.stringify({
              type: 'session.update',
              session: {
                type: 'realtime',
                audio: {
                  input: {
                    turn_detection: td,
                  },
                },
              },
            }),
          );
          logDemoRealtime('vad_resume_sent', { fromEvent, vadType: (td as { type?: string }).type });
        } catch (err) {
          vadResumeAfterWelcomeSent = false;
          logDemoRealtime('vad_resume_send_failed', { fromEvent, err: err instanceof Error ? err.message : String(err) });
        }
      };

      const requestInitialGreeting = () => {
        if (initialGreetingRequested || !realtimeSessionReady || dc.readyState !== 'open') return;
        // Set before sends: `session.created` / `session.updated` may arrive back-to-back; guard must flip before I/O.
        initialGreetingRequested = true;
        awaitingInitialGreetingAudioStop = true;
        setStatusText('The receptionist is greeting you…');
        try {
          const scripted = sessionBody.scriptedWelcomeLine?.trim();
          const greetingInstructions = scripted
            ? `Speak first now. Say this opening line exactly once (natural contractions allowed), then stop and listen for the caller: ${scripted}`
            : 'Speak first now. Say only the exact WELCOME MESSAGE from RUNTIME BUSINESS CONFIG, naturally and once, then stop and listen. Do not say "welcome to the demo" or mention the demo unless the WELCOME MESSAGE itself says it. Do not wait for the caller to speak.';
          dc.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'user',
                content: [
                  {
                    type: 'input_text',
                    text: 'The call just connected. Please say the configured WELCOME MESSAGE before I say anything.',
                  },
                ],
              },
            }),
          );
          dc.send(
            JSON.stringify({
              type: 'response.create',
              response: {
                instructions: greetingInstructions,
              },
            }),
          );
          logDemoRealtime('greeting_sent', {
            scriptedWelcomeChars: scripted?.length ?? 0,
            fallbackRuntimeWelcome: !scripted,
          });
        } catch {
          initialGreetingRequested = false;
          awaitingInitialGreetingAudioStop = false;
        }
      };
      dc.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(String(event.data)) as {
            error?: { message?: string; code?: string; type?: string };
            // response.done nests status under data.response.status, not top-level
            response?: { status?: string };
            type?: string;
            transcript?: string;
            // Tool call fields (response.function_call_arguments.done)
            call_id?: string;
            name?: string;
            arguments?: string;
          };
          const evType = data.type;
          if (evType && DEMO_REALTIME_LOG_EVENT_TYPES.has(evType)) {
            logDemoRealtime('oai_event', { type: evType, status: data.response?.status });
          }
          if (data.type === 'output_audio_buffer.started') {
            assistantAudioPlaying = true;
            lastOutputAudioBufferStoppedAtMs = null;
          }
          if (data.type === 'session.created' || data.type === 'session.updated') {
            // Caller-speech transcription is enabled at client-secret mint time
            // (audio.input.transcription) — no session.update needed here.
            realtimeSessionReady = true;
            // Register tools on session.created (once). The resulting session.updated
            // will call requestInitialGreeting() again but the guard prevents duplicates.
            if (data.type === 'session.created') registerDemoTools();
            requestInitialGreeting();
          }
          // Transcript capture (in-memory only, used for post-call extraction; never persisted).
          // GA Realtime emits `response.output_audio_transcript.done`; the legacy name is kept
          // as a fallback so a beta-mode session still captures the assistant transcript.
          if (
            (data.type === 'response.output_audio_transcript.done' ||
              data.type === 'response.audio_transcript.done') &&
            typeof data.transcript === 'string'
          ) {
            const text = data.transcript.trim();
            if (text) transcriptTurnsRef.current.push({ role: 'assistant', text: text.slice(0, 1000) });
            if (text && !awaitingInitialGreetingAudioStop && assistantTranscriptEndsDemo(text)) {
              endCallPending = true;
              setStatusText('Wrapping up the demo…');
              armEndCallCompletion();
              logDemoRealtime('demo_goodbye_without_end_call_detected', {
                assistantAudioPlaying,
                latestResponseDone,
              });
              if (!assistantAudioPlaying && finalResponseAudioAlreadyStopped()) {
                armEndCallTailGrace('goodbye_transcript_after_audio_stop');
              }
            }
          }
          if (data.type === 'conversation.item.input_audio_transcription.completed' && typeof data.transcript === 'string') {
            const text = data.transcript.trim();
            if (text) transcriptTurnsRef.current.push({ role: 'user', text: text.slice(0, 1000) });
          }
          if (data.type === 'response.created') {
            lastResponseCreatedAtMs = Date.now();
            lastOutputAudioBufferStoppedAtMs = null;
            latestResponseDone = false;
            if (!endCallPending) setStatusText('AI receptionist is responding…');
          }
          if (data.type === 'response.done') {
            // data.response.status is 'completed' | 'cancelled' | 'failed' | 'incomplete'.
            const responseDoneStatus = data.response?.status;
            latestResponseDone = true;
            logDemoRealtime('response_done', { status: responseDoneStatus });
            if (endCallPending && !assistantAudioPlaying && finalResponseAudioAlreadyStopped()) {
              armEndCallTailGrace('response.done_after_audio_stop');
            } else if (!awaitingInitialGreetingAudioStop && !endCallPending) {
              setStatusText('You\'re connected — speak naturally or tap a prompt below.');
            }
          }
          // Tool call dispatcher — executes validate_appointment_time on behalf of the model.
          // The model emits this event when it needs to validate a date/time the caller gave.
          if (data.type === 'response.function_call_arguments.done' && data.name === 'validate_appointment_time') {
            const callId = data.call_id;
            const rawArgs = data.arguments ?? '{}';
            const currentRequestId = directRealtimeRequestIdRef.current;
            logDemoRealtime('tool_call_start', { tool: 'validate_appointment_time', callId });
            void (async () => {
              let toolOutput: Record<string, unknown>;
              try {
                const args = JSON.parse(rawArgs) as { date?: string; time?: string };
                const validateRes = await fetch('/api/backend/public/demo/realtime-session/validate-appointment-time', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(typeof window !== 'undefined' && window.location?.origin
                      ? { Origin: window.location.origin }
                      : {}),
                  },
                  body: JSON.stringify({
                    requestId: currentRequestId,
                    demoVertical: config.slug,
                    date: args.date,
                    time: args.time,
                  }),
                });
                const validateBody = (await validateRes.json().catch(() => ({}))) as Record<string, unknown>;
                if (validateRes.ok && validateBody.ok === true) {
                  toolOutput = {
                    valid: validateBody.valid,
                    reason: validateBody.reason,
                    normalizedDatetimeUtc: validateBody.normalizedDatetimeUtc,
                    messageForAi: validateBody.messageForAi,
                  };
                  logDemoRealtime('tool_call_ok', { tool: 'validate_appointment_time', callId, reason: validateBody.reason });
                } else {
                  // Endpoint error — return not_configured so the model doesn't block the booking.
                  toolOutput = {
                    valid: true,
                    reason: 'business_hours_not_configured',
                    messageForAi: 'The requested time may be captured. Continue without saying you checked anything.',
                  };
                  logDemoRealtime('tool_call_fallback', { tool: 'validate_appointment_time', callId, status: validateRes.status });
                }
              } catch (err) {
                toolOutput = {
                  valid: true,
                  reason: 'business_hours_not_configured',
                  messageForAi: 'The requested time may be captured. Continue without saying you checked anything.',
                };
                logDemoRealtime('tool_call_error', { tool: 'validate_appointment_time', callId, err: err instanceof Error ? err.message : String(err) });
              }
              // Send result back to the model via the data channel.
              if (dc.readyState === 'open') {
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: JSON.stringify(toolOutput),
                  },
                }));
                dc.send(JSON.stringify({ type: 'response.create' }));
                logDemoRealtime('tool_call_result_sent', { tool: 'validate_appointment_time', callId });
              } else {
                logDemoRealtime('tool_call_result_skip', { tool: 'validate_appointment_time', callId, reason: 'dc_closed' });
              }
            })();
          }
          if (data.type === 'response.function_call_arguments.done' && data.name === 'end_call') {
            const callId = data.call_id;
            endCallPending = true;
            setStatusText('Wrapping up the demo…');
            armEndCallCompletion();
            logDemoRealtime('end_call_tool_called', { callId, assistantAudioPlaying });
            if (!assistantAudioPlaying && finalResponseAudioAlreadyStopped()) {
              armEndCallTailGrace('end_call_tool_after_audio_stop');
            }
            if (dc.readyState === 'open') {
              try {
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: JSON.stringify({ ok: true, message: 'Demo session will end after the goodbye audio finishes.' }),
                  },
                }));
                logDemoRealtime('end_call_tool_ack_sent', { callId });
              } catch (err) {
                logDemoRealtime('end_call_tool_ack_failed', { callId, err: err instanceof Error ? err.message : String(err) });
              }
            }
          }
          if (awaitingInitialGreetingAudioStop && data.type === 'output_audio_buffer.stopped') {
            awaitingInitialGreetingAudioStop = false;
            // Unmute mic BEFORE re-enabling VAD: while VAD is still in greeting-safe
            // mode (create_response:false, interrupt_response:false), any tail-echo
            // of the greeting cannot produce a stray response.
            enableMicTracks('output_audio_buffer.stopped');
            setStatusText('You\'re connected — speak naturally or tap a prompt below.');
            maybeResumeVadAfterWelcome('output_audio_buffer.stopped');
          }
          if (data.type === 'output_audio_buffer.stopped') {
            assistantAudioPlaying = false;
            lastOutputAudioBufferStoppedAtMs = Date.now();
            if (endCallPending) {
              armEndCallTailGrace('output_audio_buffer.stopped');
            }
          }
          if (data.type === 'input_audio_buffer.speech_started' && !endCallPending) setStatusText('Listening…');
          if (data.type === 'error') {
            console.warn('OpenAI Realtime web demo event error', data);
            logDemoRealtime('oai_error', {
              message: data.error?.message,
              code: data.error?.code,
              errType: data.error?.type,
            });
          }
        } catch {
          logDemoRealtime('oai_parse_non_json', { dataType: typeof event.data });
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      logDemoRealtime('sdp_offer_created', { sdpLines: offer.sdp?.split('\n').length ?? 0 });
      const sdpResponse = await fetch(OPENAI_REALTIME_WEBRTC_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionBody.clientSecret}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });
      logDemoRealtime('sdp_response', { status: sdpResponse.status, ok: sdpResponse.ok });
      if (!sdpResponse.ok) {
        const errBody = await sdpResponse.text().catch(() => '');
        logDemoRealtime('sdp_error_body', { status: sdpResponse.status, body: errBody.slice(0, 300) });
        throw new Error('webrtc_connect_failed');
      }
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: await sdpResponse.text(),
      });
      logDemoRealtime('remote_desc_set', {});
    } catch (err) {
      logDemoRealtime('webrtc_connect_catch', {
        errMessage: err instanceof Error ? err.message : String(err),
        errName: err instanceof Error ? err.name : 'unknown',
      });
      directPeerFailureMutedRef.current = true;
      cleanupDirectRealtime();
      resetTurnstile();
      setStage('failed');
      setStatusText('The web demo could not connect. Please check your connection and try again.');
      setRequestError('The web demo could not connect. Please check your connection and try again.');
    }
  }

  async function startLiveKitWebDemo(params: { micStream: MediaStream }) {
    const { micStream } = params;
    const micTrack = micStream.getAudioTracks()[0];
    if (!micTrack) {
      resetTurnstile();
      setStage('idle');
      setStatusText('');
      setErrors(['No microphone audio track was returned. Please try again or call the demo number instead.']);
      return;
    }

    clearPollTimer();
    setStatusText('Starting browser demo…');
    const payload = buildDemoPayload();
    try {
      const res = await fetch('/api/backend/public/demo/web-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(typeof window !== 'undefined' && window.location?.origin
            ? { Origin: window.location.origin }
            : {}),
        },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as DemoApiResponse;
      if (!body.ok || !body.requestId || !body.previewToken) {
        resetTurnstile();
        micStream.getTracks().forEach((t) => t.stop());
        setStage('failed');
        setRequestError(apiUserVisibleMessage(body, 'Unable to start browser demo.'));
        return;
      }
      const liveKitUrl = body.liveKitUrl;
      const liveKitToken = body.liveKitToken;
      if (typeof liveKitUrl === 'string' && typeof liveKitToken === 'string' && liveKitUrl && liveKitToken) {
        const room = new Room();
        roomRef.current = room;
        room.on(RoomEvent.Disconnected, () => {
          roomRef.current = null;
        });
        try {
          await room.connect(liveKitUrl, liveKitToken);
          // Publish the mic track acquired during the Start click (same user-gesture chain). Calling
          // setMicrophoneEnabled after await fetch often loses activation and surfaces NotAllowedError.
          await room.localParticipant.publishTrack(micTrack, { source: Track.Source.Microphone });
        } catch {
          room.disconnect();
          roomRef.current = null;
          throw new Error('livekit_connect_failed');
        }
      }
      setStatusText('Joining demo room…');
      await pollStatus({ requestId: body.requestId, previewToken: body.previewToken });
    } catch (error) {
      resetTurnstile();
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      micStream.getTracks().forEach((t) => t.stop());
      setStage('failed');
      const message = error instanceof Error && error.message === 'livekit_connect_failed'
        ? LIVEKIT_CONNECT_ERROR_MESSAGE
        : 'Network error. Please try again.';
      setStatusText(message);
      setRequestError(message);
    }
  }

  async function startWebDemo() {
    const errs = validate();
    setErrors(errs);
    setRequestError(null);
    if (errs.length > 0) return;
    if (demoStartLockRef.current) return;
    demoStartLockRef.current = true;
    try {
      // Request mic while the Start button click is still the active user gesture.
      // Some browsers are flaky on first permission prompt if we unmount the form first.
      // Keep the LiveKit preflight stream alive until publishTrack — do not stop tracks before async work.
      setStatusText('Requesting microphone…');
      const preflightStream = await requestDemoMicrophone({ keepAlive: true });
      if (!preflightStream) return;

      flushSync(() => {
        setStage('queued');
        setStatusText(
          demoWebCallMode === 'direct_openai' ? 'Requesting microphone…' : 'Starting browser demo…',
        );
      });

      if (demoWebCallMode === 'direct_openai') await startDirectOpenAiDemo(preflightStream);
      else await startLiveKitWebDemo({ micStream: preflightStream });
    } finally {
      demoStartLockRef.current = false;
    }
  }

  async function copyPrompt(prompt: string) {
    try { await navigator.clipboard.writeText(prompt); setCopied(prompt); window.setTimeout(() => setCopied(null), 1600); } catch { /* ignore */ }
  }

  /**
   * Personalized suggested questions — generated from real website-read salon data.
   * Called once per session after website import succeeds with a non-empty services list.
   * Falls back silently to the static `config.tryAsking` defaults on any error/timeout.
   */
  async function fetchSuggestedQuestions(extracted: ExtractedDemoData) {
    if (suggestionsLoadedRef.current) return;
    if (!extracted.services.length) return;
    suggestionsLoadedRef.current = true;
    setSuggestionsLoading(true);
    const controller = new AbortController();
    // Generated during the post-import review step (before the call starts), so there is ample
    // wall-clock budget; a tight timeout just forces the generic static fallback unnecessarily.
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch('/api/backend/public/demo/suggested-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: business.businessName.trim() || config.defaultBusinessName,
          vertical: config.slug,
          services: extracted.services.slice(0, 40),
          staff: extracted.staff.slice(0, 12),
          policies: extracted.policies.slice(0, 10),
          hours: extracted.hours || business.primaryHours || undefined,
          city: extracted.city || business.city || undefined,
          sessionId: ensureSessionId(),
        }),
        signal: controller.signal,
      });
      const data = (await res.json()) as { ok?: boolean; questions?: Array<{ id: string; text: string }> | null; source?: string };
      if (data.ok && Array.isArray(data.questions) && data.questions.length > 0) {
        const texts = data.questions.map((q) => q.text).filter((t) => typeof t === 'string' && t.trim());
        if (texts.length > 0) setSuggestedQuestions(texts);
      }
    } catch {
      /* timeout or network — keep defaults silently */
    } finally {
      window.clearTimeout(timeoutId);
      setSuggestionsLoading(false);
    }
  }

  /**
   * Post-call extraction — sends the captured browser transcript to gpt-4o-mini for structured data.
   * Transcript is processed in-memory only (never persisted client-side beyond this call).
   * On error/timeout (>5s) `callExtracted` stays null so the UI shows the description card (State C).
   */
  async function extractCallData(turns: TranscriptTurn[]) {
    if (turns.length < 2) return;
    setCallExtracting(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch('/api/backend/public/demo/extract-call-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: turns.slice(0, 80),
          vertical: config.slug,
          businessName: business.businessName.trim() || config.defaultBusinessName,
          sessionId: ensureSessionId(),
        }),
        signal: controller.signal,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        extracted?: Omit<CallExtracted, 'hasRealData'> | null;
        hasRealData?: boolean;
      };
      if (data.ok && data.extracted) {
        setCallExtracted({ ...data.extracted, hasRealData: Boolean(data.hasRealData) });
      }
      /* extracted == null → leave callExtracted null → State C description card */
    } catch {
      /* timeout or network — leave null → State C */
    } finally {
      window.clearTimeout(timeoutId);
      setCallExtracting(false);
    }
  }

  /** Persist the captured transcript onto the web_demo_session row so Admin → Demos can show it. */
  function persistDemoTranscript(requestId: string, turns: TranscriptTurn[]) {
    const url = '/api/backend/public/demo/realtime-session/transcript';
    const payload = JSON.stringify({ requestId, transcript: turns.slice(0, 120) });
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }))) return;
    }
    void fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(typeof window !== 'undefined' && window.location?.origin ? { Origin: window.location.origin } : {}),
      },
      body: payload,
    }).catch(() => {
      /* ignore */
    });
  }

  function endDirectDemo() {
    directPeerFailureMutedRef.current = true;
    const turns = transcriptTurnsRef.current.slice();
    transcriptTurnsRef.current = [];
    const transcriptRequestId = directRealtimeRequestIdRef.current;
    cleanupDirectRealtime();
    resetTurnstile();
    setStage('completed');
    setRequestError(null);
    setStatusText('Session ended.');
    if (turns.length >= 2) {
      void extractCallData(turns);
      if (transcriptRequestId) persistDemoTranscript(transcriptRequestId, turns);
    }
  }

  function endWebDemoFromPhone() {
    if (demoWebCallMode === 'direct_openai') {
      endDirectDemo();
      return;
    }
    clearPollTimer();
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    resetTurnstile();
    setStage('completed');
    setRequestError(null);
    setStatusText('Session ended.');
  }

  function resetDemo() {
    directPeerFailureMutedRef.current = false;
    clearPollTimer();
    cleanupDirectRealtime();
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    resetTurnstile();
    setStage('idle');
    setRequestError(null);
    setStatusText('');
    setSiteManualFallback(false);
    setImportedDetailsEdit(false);
    setMobileFoundEdit(false);
    resetMobileImportUi();
    setSitePhase(extractedData ? 'ready' : 'idle');
    transcriptTurnsRef.current = [];
    setCallExtracted(null);
    setCallExtracting(false);
  }

  const verticalLabel = config.businessType.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://ringbooker.com/' },
      { '@type': 'ListItem', position: 2, name: 'Demo', item: 'https://ringbooker.com/demo' },
      { '@type': 'ListItem', position: 3, name: verticalLabel, item: `https://ringbooker.com/demo/${config.slug}` },
    ],
  };

  function PreparedDemoStartPanel() {
    const preparedStaff = initialStaffNames?.map((name) => name.trim()).filter(Boolean).slice(0, 8) ?? [];
    const preparedHours = [business.primaryHours, business.secondaryHours]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(' / ');
    const preparedLocation = business.address.trim();

    return (
      <div className="vd-form-card" style={{ background: 'var(--surface-1, #fff)', border: '0.5px solid var(--border, #E8ECF1)', borderRadius: 16, padding: '24px 28px' }}>
        <div className="vd-found-card" style={{ border: 'none', background: 'transparent', borderRadius: 0, padding: '0 0 14px' }}>
          <div className="vd-found-row">
            <span className="vd-found-key">Business Name</span>
            <span className="vd-found-val">{demoDisplayName}</span>
          </div>
          {preparedLocation ? (
            <div className="vd-found-row">
              <span className="vd-found-key">Address</span>
              <span className="vd-found-val">{preparedLocation}</span>
            </div>
          ) : null}
          {preparedHours ? (
            <div className="vd-found-row">
              <span className="vd-found-key">Hours</span>
              <span className="vd-found-val">{preparedHours}</span>
            </div>
          ) : null}
          {currentServiceCategorySummary.length > 0 ? (
            <div className="vd-found-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span className="vd-found-key">Services</span>
              <div className="vd-found-chips">
                {currentServiceCategorySummary.slice(0, 8).map((cat) => (
                  <span key={cat.label} className="vd-found-chip">{cat.label} · {cat.count}</span>
                ))}
                {currentServiceCategorySummary.length > 8 ? (
                  <span className="vd-found-chip">+{currentServiceCategorySummary.length - 8} more</span>
                ) : null}
              </div>
            </div>
          ) : null}
          {preparedStaff.length > 0 ? (
            <div className="vd-found-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span className="vd-found-key">Staffs</span>
              <div className="vd-found-chips">
                {preparedStaff.slice(0, 6).map((name) => (
                  <span key={name} className="vd-found-chip">{name}</span>
                ))}
                {preparedStaff.length > 6 ? <span className="vd-found-chip">+{preparedStaff.length - 6} more</span> : null}
              </div>
            </div>
          ) : null}
        </div>

        {turnstileSiteKey ? (
          <div style={turnstileWrapperStyle}>
            <div className="vd-captcha">
              <div className="vd-captcha-inner" ref={turnstileRef} />
            </div>
            {captchaHint ? <p className="vd-captcha-hint">{captchaHint}</p> : null}
          </div>
        ) : null}

        {errors.length > 0 || requestError ? (
          <div className="vd-errors">
            {errors.map((e) => <div key={e} className="vd-error">{e}</div>)}
            {requestError ? <div className="vd-error">{requestError}</div> : null}
          </div>
        ) : null}

        <button type="button" className="vd-cta" onClick={() => void startWebDemo()} disabled={isSubmitting}>
          {isSubmitting ? 'Starting…' : ctaLabel}
        </button>
      </div>
    );
  }

  return (
    <MarketingLayout styles={[...styles, siteReadStyles, serviceVariantStyles, verticalDemoMobileStyles, verticalDemoUiTweaks]} scriptPrefix={`vertical-demo-${config.slug}`}>
      <>
        {turnstileSiteKey ? (
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" onLoad={() => setTurnstileReady(true)} />
        ) : null}
        <MarketingChromeStyles />
        <MarketingHeader active="demo" />

        <div className={`vd-page vd-theme-${config.slug}${isPreparedDemo ? ' vd-sales' : ''}`}>
          {/* ══ PAGE HEADER (centered, full-width) ════════════════ */}
          <div className="vd-page-header">
            <nav className="vd-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>›</span>
              <Link href="/demo">Demo</Link>
              <span>›</span>
              <span>{verticalLabel}</span>
            </nav>
            {isPreparedDemo ? (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 14px' }}>
                {displayedPreparedLogoUrl ? (
                  <img
                    src={displayedPreparedLogoUrl}
                    alt={demoDisplayName}
                    height={56}
                    onError={() => setPreparedLogoFailed(true)}
                    style={{
                      height: 56,
                      width: 'auto',
                      borderRadius: 12,
                      border: '0.5px solid var(--mk-border-soft,#E8ECF1)',
                      objectFit: 'contain',
                      background: '#fff',
                    }}
                  />
                ) : (
                  <div
                    aria-hidden
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      background: 'color-mix(in srgb,var(--va) 12%,#fff)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 500,
                      color: 'var(--va)',
                      border: '0.5px solid color-mix(in srgb,var(--va) 20%,#E8ECF1)',
                    }}
                  >
                    {demoInitials}
                  </div>
                )}
              </div>
            ) : null}
            {pageEyebrow ? <p className="hero-eyebrow vd-hero-eyebrow">{pageEyebrow}</p> : null}
            <h1 className="vd-hero-h1">{pageTitle}</h1>
            <p className="vd-hero-sub">{pageSubtitle}</p>
          </div>

          <div className="vd-wrap">

            {/* ══ LEFT COLUMN ══════════════════════════════════════ */}
            <div>
              {/* ── FORM ── */}
              {!isActive ? (
                isPreparedDemo ? (
                  <PreparedDemoStartPanel />
                ) : isMobileDemo ? (
                  sitePhase === 'loading' ? (
                    <div className="vd-form-card">
                      <p className="vd-m-load-subtitle">
                        Reading {demoHostnameFromUrl(siteUrl)} to personalise your AI receptionist.
                      </p>
                      <div className="vd-m-spin" role="status" aria-label="Loading" />
                      <p className="vd-load-head">{mobileImportHeadline}</p>
                      <p className="vd-load-sub">{mobileImportSubline}</p>
                      <div className="vd-m-prog" aria-hidden>
                        <div className="vd-m-prog-fill" style={{ width: `${mobileImportProgress}%` }} />
                      </div>
                      <div className="vd-m-rows">
                        {MOBILE_IMPORT_STEPS.map((label, i) => {
                          const st = mobileImportRows[i] ?? 'pending';
                          return (
                            <div
                              key={label}
                              className={`vd-m-row${st === 'done' ? ' done' : ''}${st === 'spinning' ? ' active' : ''}`}
                            >
                              <span className="vd-m-ico">
                                {st === 'done' ? '✓' : st === 'spinning' ? <span className="vd-m-row-spin" aria-hidden /> : i + 1}
                              </span>
                              <span>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                      {mobileImportPill ? <div className="vd-m-pill">{mobileImportPill}</div> : null}
                      {mobileImportEscape ? (
                        <button type="button" className="vd-m-escape" onClick={exitToManualForm}>
                          Continue without website →
                        </button>
                      ) : null}
                    </div>
                  ) : sitePhase === 'ready' && extractedData && !siteManualFallback ? (
                    <div className="vd-form-card">
                      <h2 className="vd-status-h" style={{ marginTop: 0 }}>Your AI receptionist is ready</h2>
                      <p className="vd-status-body">We set up the demo using your salon&apos;s info.</p>
                      {!mobileFoundEdit ? (
                        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: '#9CA3AF', textTransform: 'uppercase' }}>WHAT WE FOUND</span>
                            <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: 'var(--va)', padding: 0 }} onClick={() => setMobileFoundEdit(true)}>Edit</button>
                          </div>
                          {business.businessName || extractedData.businessName ? (
                            <div style={{ display: 'flex', gap: 8, marginBottom: 7, fontSize: 12 }}>
                              <span style={{ color: '#9CA3AF', minWidth: 64, flexShrink: 0 }}>Business</span>
                              <span style={{ color: '#111827', fontWeight: 500 }}>{business.businessName || extractedData.businessName}</span>
                            </div>
                          ) : null}
                          {importAddressDisplay ? (
                            <div style={{ display: 'flex', gap: 8, marginBottom: 7, fontSize: 12 }}>
                              <span style={{ color: '#9CA3AF', minWidth: 64, flexShrink: 0 }}>Address</span>
                              <span style={{ color: '#111827' }}>{importAddressDisplay}</span>
                            </div>
                          ) : null}
                          <div style={{ display: 'flex', gap: 8, marginBottom: 7, fontSize: 12 }}>
                            <span style={{ color: '#9CA3AF', minWidth: 64, flexShrink: 0 }}>Hours</span>
                            <span style={{ color: '#111827' }}>{business.primaryHours || extractedData.hours || '—'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginBottom: currentServiceCategorySummary.length > 0 ? 7 : 0, fontSize: 12 }}>
                            <span style={{ color: '#9CA3AF', minWidth: 64, flexShrink: 0 }}>Stylists</span>
                            <span style={{ color: '#111827' }}>{business.staff || '—'}</span>
                          </div>
                          {currentServiceCategorySummary.length > 0 ? (
                            <div style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'flex-start' }}>
                              <span style={{ color: '#9CA3AF', minWidth: 64, flexShrink: 0, paddingTop: 2 }}>Services</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {currentServiceCategorySummary.slice(0, 4).map((cat) => (
                                  <span key={cat.label} className="vd-found-chip">{cat.label} · {cat.count}</span>
                                ))}
                                {currentServiceCategorySummary.length > 4 ? (
                                  <span className="vd-found-chip">+{currentServiceCategorySummary.length - 4} more</span>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div style={{ borderTop: '1px solid #E5E7EB' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #E5E7EB', marginBottom: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>Edit details</span>
                            <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--va)', padding: 0 }} onClick={() => setMobileFoundEdit(false)}>Done</button>
                          </div>
                          <div style={{ paddingBottom: 12, borderBottom: '1px solid #E5E7EB' }}>
                            <div className="vd-field vd-field-compact" style={{ marginBottom: 10 }}>
                              <label htmlFor="vd-m-edit-name" style={{ fontSize: 11, color: '#9CA3AF' }}>Business</label>
                              <input
                                id="vd-m-edit-name"
                                value={business.businessName}
                                onChange={(e) => setBusiness((c) => ({ ...c, businessName: e.target.value }))}
                              />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                              <div className="vd-field vd-field-compact">
                                <label htmlFor="vd-m-edit-address" style={{ fontSize: 11, color: '#9CA3AF' }}>Address</label>
                                <input
                                  id="vd-m-edit-address"
                                  value={business.address}
                                  placeholder={importAddressPlaceholder}
                                  onChange={(e) => setBusiness((c) => ({ ...c, address: e.target.value }))}
                                />
                              </div>
                              <div className="vd-field vd-field-compact">
                                <label htmlFor="vd-m-edit-hours" style={{ fontSize: 11, color: '#9CA3AF' }}>Hours</label>
                                <input
                                  id="vd-m-edit-hours"
                                  value={business.primaryHours}
                                  onChange={(e) => setBusiness((c) => ({ ...c, primaryHours: e.target.value }))}
                                  placeholder="e.g. Mon–Sat 9am–7pm"
                                />
                              </div>
                            </div>
                            <div className="vd-field vd-field-compact">
                              <label htmlFor="vd-m-edit-staff" style={{ fontSize: 11, color: '#9CA3AF' }}>{config.staffLabel} (optional)</label>
                              <input
                                id="vd-m-edit-staff"
                                value={business.staff}
                                placeholder="Not found on website"
                                onChange={(e) => setBusiness((c) => ({ ...c, staff: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div style={{ paddingTop: 14, marginTop: 14 }}>
                            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>Services</div>
                            <div style={{ display: 'flex', overflowX: 'auto', gap: 6, paddingBottom: 8, scrollbarWidth: 'none' }}>
                              {business.services.map((cat) => (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => setSelectedCategory(cat.id)}
                                  style={{
                                    flexShrink: 0,
                                    border: selectedCategory === cat.id ? 'none' : '0.5px solid #E5E7EB',
                                    borderRadius: 20,
                                    padding: '5px 12px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    background: selectedCategory === cat.id ? '#1a1a1a' : '#F9FAFB',
                                    color: selectedCategory === cat.id ? '#fff' : '#6B7280',
                                  }}
                                >
                                  {cat.label}
                                </button>
                              ))}
                            </div>
                            <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                              {activeCategory?.items.map((item, idx) => (
                                <div key={`${activeCategory.id}-${item.name}`}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      padding: '9px 10px',
                                      background: '#F9FAFB',
                                      borderTop: idx === 0 ? 'none' : '0.5px solid #E5E7EB',
                                    }}
                                  >
                                    <input type="checkbox" checked={item.enabled} onChange={(e) => updateService(activeCategory.id, idx, { enabled: e.target.checked })} style={{ flexShrink: 0, accentColor: 'var(--va)' }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 13, color: item.enabled ? '#1F2937' : '#9CA3AF', textDecoration: item.enabled ? 'none' : 'line-through' }}>{item.name}</div>
                                      {item.duration ? <div style={{ fontSize: 11, color: '#9CA3AF' }}>{item.duration}</div> : null}
                                    </div>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 1, opacity: item.enabled ? 1 : 0.4 }}>
                                      <span style={{ fontSize: 12, color: '#6B7280' }}>$</span>
                                      <input
                                        className="vd-svc-price"
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        value={item.price}
                                        onChange={(e) => updateService(activeCategory.id, idx, { price: Number(e.target.value) || 0 })}
                                        style={{ width: 44, fontSize: 12, textAlign: 'center' }}
                                      />
                                    </div>
                                    {renderServiceVariantChevron(activeCategory.id, item, idx)}
                                  </div>
                                  {renderServiceVariantPanel(activeCategory.id, item, idx, true)}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      <div style={{ borderTop: '1px solid #E5E7EB', padding: '12px 0 0', marginTop: 14 }}>
                        <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', lineHeight: 1.4 }}>You&apos;ll review everything during onboarding before going live.</p>
                      </div>
                      {turnstileSiteKey ? (
                        <div style={turnstileWrapperStyle}>
                          <div className="vd-captcha">
                            <div className="vd-captcha-inner" ref={turnstileRef} />
                          </div>
                          {captchaHint ? <p className="vd-captcha-hint">{captchaHint}</p> : null}
                        </div>
                      ) : null}
                      {errors.length > 0 || requestError ? (
                        <div className="vd-errors">
                          {errors.map((e) => <div key={e} className="vd-error">{e}</div>)}
                          {requestError ? <div className="vd-error">{requestError}</div> : null}
                        </div>
                      ) : null}
                      <button type="button" className="vd-cta" onClick={() => void startWebDemo()} disabled={isSubmitting}>
                        {isSubmitting ? 'Starting…' : ctaLabel}
                      </button>
                      <p className="vd-cta-note">AI receptionist configured with your real salon data.</p>
                      <div className="vd-phone-demo-secondary">
                        <div className="vd-phone-demo-title">Prefer to call?</div>
                        <p className="vd-phone-demo-text">Call the demo line and speak with the AI receptionist.</p>
                        <div className="vd-phone-demo-num-row">
                          <span className="vd-phone-demo-num">{verticalDemoPhoneDisplay}</span>
                          <button type="button" className="vd-phone-demo-copy" onClick={() => void copyDemoPhoneNumber()}>
                            {demoLineCopied ? 'Copied' : 'Copy number'}
                          </button>
                        </div>
                        <a className="vd-phone-demo-tel" href={verticalDemoPhoneTel}>
                          Call demo number
                        </a>
                        <p className="vd-phone-demo-note">The phone demo uses a sample nail salon profile.</p>
                      </div>
                    </div>
                  ) : sitePhase === 'error' || siteManualFallback ? (
                    <div className="vd-form-card">
                      <div className="vd-m-badge vd-m-badge--amber">
                        <span className="vd-m-badge-dot" aria-hidden />
                        Couldn&apos;t read your website
                      </div>
                      <h2 className="vd-status-h" style={{ marginTop: 0 }}>Set up manually</h2>
                      <p className="vd-status-body">Takes 30 seconds — then hear your AI in action.</p>
                      <div className="vd-m-banner" role="note">
                        <span aria-hidden>ℹ️</span>
                        <span>
                          {siteLoadError
                            ? "We couldn't read your website. Enter your salon info below."
                            : 'Enter your salon info below to personalise the browser demo.'}
                        </span>
                      </div>
                      <div className="vd-m-card" style={{ borderWidth: 1, borderColor: '#E5E7EB' }}>
                        <div className="vd-field vd-field-compact">
                          <label htmlFor="vd-m6-biz">Business name</label>
                          <input
                            id="vd-m6-biz"
                            required
                            value={business.businessName}
                            onChange={(e) => setBusiness((c) => ({ ...c, businessName: e.target.value }))}
                          />
                        </div>
                        <div className="vd-m-grid2" style={{ marginTop: 10 }}>
                          <div className="vd-field vd-field-compact">
                            <label htmlFor="vd-m6-address">Address</label>
                            <input
                              id="vd-m6-address"
                              value={business.address}
                              placeholder="e.g. 123 Main St, Los Angeles, CA"
                              onChange={(e) => setBusiness((c) => ({ ...c, address: e.target.value }))}
                            />
                          </div>
                          <div className="vd-field vd-field-compact">
                            <label htmlFor="vd-m6-hours">Hours</label>
                            <input
                              id="vd-m6-hours"
                              value={business.primaryHours}
                              onChange={(e) => setBusiness((c) => ({ ...c, primaryHours: e.target.value }))}
                              placeholder="e.g. Mon–Sat 9am–7pm"
                            />
                          </div>
                        </div>
                        <div className="vd-field vd-field-compact" style={{ marginTop: 10 }}>
                          <label htmlFor="vd-m6-staff">{config.staffLabel} (optional)</label>
                          <input
                            id="vd-m6-staff"
                            value={business.staff}
                            placeholder={config.staffPlaceholder}
                            onChange={(e) => setBusiness((c) => ({ ...c, staff: e.target.value }))}
                          />
                        </div>
                      </div>
                      {turnstileSiteKey ? (
                        <div style={turnstileWrapperStyle}>
                          <div className="vd-captcha">
                            <div className="vd-captcha-inner" ref={turnstileRef} />
                          </div>
                          {captchaHint ? <p className="vd-captcha-hint">{captchaHint}</p> : null}
                        </div>
                      ) : null}
                      {errors.length > 0 || requestError ? (
                        <div className="vd-errors">
                          {errors.map((e) => <div key={e} className="vd-error">{e}</div>)}
                          {requestError ? <div className="vd-error">{requestError}</div> : null}
                        </div>
                      ) : null}
                      <button type="button" className="vd-cta" onClick={() => void startWebDemo()} disabled={isSubmitting}>
                        {isSubmitting ? 'Starting…' : ctaLabel}
                      </button>
                      <p className="vd-cta-note">Talk to RingBooker in your browser. No phone number required.</p>
                      <div className="vd-phone-demo-secondary">
                        <div className="vd-phone-demo-title">Prefer to call?</div>
                        <p className="vd-phone-demo-text">Call the demo line and speak with the AI receptionist.</p>
                        <div className="vd-phone-demo-num-row">
                          <span className="vd-phone-demo-num">{verticalDemoPhoneDisplay}</span>
                          <button type="button" className="vd-phone-demo-copy" onClick={() => void copyDemoPhoneNumber()}>
                            {demoLineCopied ? 'Copied' : 'Copy number'}
                          </button>
                        </div>
                        <a className="vd-phone-demo-tel" href={verticalDemoPhoneTel}>
                          Call demo number
                        </a>
                        <p className="vd-phone-demo-note">{config.phoneDemoProfileCopy}</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="vd-m-card">
                        <h3 className="vd-m-card-title">Try with your real {config.businessType.replace(/-/g, ' ')}</h3>
                        <p className="vd-m-card-sub">Paste your website — we&apos;ll personalise the demo automatically.</p>
                        <div className="vd-m-url-row">
                          <input
                            className="vd-url-input"
                            type="url"
                            placeholder="https://yoursalon.com"
                            value={siteUrl}
                            onChange={(e) => setSiteUrl(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void readWebsite();
                            }}
                          />
                          <button type="button" className="vd-url-btn" onClick={() => void readWebsite()} disabled={!siteUrl.trim()}>
                            Read site
                          </button>
                        </div>
                        {siteLoadError && !siteManualFallback ? <div className="vd-error" style={{ marginTop: 8 }}>{siteLoadError}</div> : null}
                      </div>
                      <div className="vd-m-divider">or use sample data below</div>
                      <div className="vd-field" style={{ marginBottom: 12 }}>
                        <label htmlFor="vd-m-biz">Business name</label>
                        <input id="vd-m-biz" value={business.businessName} onChange={(e) => setBusiness((c) => ({ ...c, businessName: e.target.value }))} />
                      </div>
                      <button type="button" className="vd-m-acc" onClick={() => setShowAdvanced((v) => !v)}>
                        <span className={`vd-m-acc-chev ${showAdvanced ? 'open' : ''}`}>▼</span>
                        Customize hours, staff &amp; services
                      </button>
                      {showAdvanced ? (
                        <div className="vd-m-acc-body">
                          <div className="vd-m-grid2">
                            <div className="vd-field vd-field-compact">
                              <label htmlFor="vd-m-address">Address</label>
                              <input id="vd-m-address" value={business.address} placeholder="e.g. 123 Main St, Los Angeles, CA" onChange={(e) => setBusiness((c) => ({ ...c, address: e.target.value }))} />
                            </div>
                            <div className="vd-field vd-field-compact">
                              <label htmlFor="vd-m-hours">Hours</label>
                              <input
                                id="vd-m-hours"
                                value={business.primaryHours}
                                onChange={(e) => setBusiness((c) => ({ ...c, primaryHours: e.target.value }))}
                                placeholder="e.g. Mon–Sat 9am–7pm"
                              />
                            </div>
                          </div>
                          <div className="vd-field vd-field-compact">
                            <label htmlFor="vd-m-staff">{config.staffLabel} (optional)</label>
                            <input
                              id="vd-m-staff"
                              value={business.staff}
                              placeholder={config.staffPlaceholder}
                              onChange={(e) => setBusiness((c) => ({ ...c, staff: e.target.value }))}
                            />
                          </div>
                          <div>
                            <div className="vd-svc-label">{config.serviceLabel}</div>
                            <div className="vd-tabs">
                              {business.services.map((cat) => (
                                <button key={cat.id} type="button" className={`vd-tab ${selectedCategory === cat.id ? 'on' : ''}`} onClick={() => setSelectedCategory(cat.id)}>
                                  {cat.label}
                                </button>
                              ))}
                            </div>
                            <div className="vd-svc-list">
                              {activeCategory?.items.map((item, idx) => (
                                <div key={`${activeCategory.id}-${item.name}`}>
                                  <div className="vd-svc-row">
                                    <input type="checkbox" checked={item.enabled} onChange={(e) => updateService(activeCategory.id, idx, { enabled: e.target.checked })} />
                                    <div className="vd-svc-info">
                                      <div className="vd-svc-name">{item.name}</div>
                                      {item.duration ? <div className="vd-svc-dur">{item.duration}</div> : null}
                                    </div>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                      <span style={{ fontSize: 13, color: '#6B7280' }}>$</span>
                                      <input className="vd-svc-price" type="number" inputMode="numeric" min={0} value={item.price} onChange={(e) => updateService(activeCategory.id, idx, { price: Number(e.target.value) || 0 })} />
                                    </div>
                                    {renderServiceVariantChevron(activeCategory.id, item, idx)}
                                  </div>
                                  {renderServiceVariantPanel(activeCategory.id, item, idx)}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {turnstileSiteKey ? (
                        <div style={turnstileWrapperStyle}>
                          <div className="vd-captcha">
                            <div className="vd-captcha-inner" ref={turnstileRef} />
                          </div>
                          {captchaHint ? <p className="vd-captcha-hint">{captchaHint}</p> : null}
                        </div>
                      ) : null}
                      {errors.length > 0 || requestError ? (
                        <div className="vd-errors">
                          {errors.map((e) => <div key={e} className="vd-error">{e}</div>)}
                          {requestError ? <div className="vd-error">{requestError}</div> : null}
                        </div>
                      ) : null}
                      <button type="button" className="vd-cta" onClick={() => void startWebDemo()} disabled={isSubmitting}>
                        {isSubmitting ? 'Starting…' : ctaLabel}
                      </button>
                      <p className="vd-cta-note">
                        Talk to RingBooker in your browser using this demo setup. No phone number required.
                      </p>
                      <div className="vd-phone-demo-secondary">
                        <div className="vd-phone-demo-title">Prefer to call?</div>
                        <p className="vd-phone-demo-text">Call the demo line and speak with the AI receptionist.</p>
                        <div className="vd-phone-demo-num-row">
                          <span className="vd-phone-demo-num">{verticalDemoPhoneDisplay}</span>
                          <button type="button" className="vd-phone-demo-copy" onClick={() => void copyDemoPhoneNumber()}>
                            {demoLineCopied ? 'Copied' : 'Copy number'}
                          </button>
                        </div>
                        <a className="vd-phone-demo-tel" href={verticalDemoPhoneTel}>
                          Call demo number
                        </a>
                        <p className="vd-phone-demo-note">{config.phoneDemoProfileCopy}</p>
                      </div>
                    </div>
                  )
                ) : (
                sitePhase === 'loading' ? (
                  <div className="vd-form-card vd-loading-card">
                    {siteLoadStep < IMPORT_PROGRESS_STEPS.length ? (
                      <div className="vd-spinner" role="status" aria-label="Loading" />
                    ) : null}
                    <p className="vd-load-head">
                      {IMPORT_PROGRESS_STEPS[Math.min(siteLoadStep, IMPORT_PROGRESS_STEPS.length - 1)]}
                    </p>
                    <p className="vd-load-sub">Pulling business name, hours, and services — this usually takes 1–2 minutes.</p>
                    <div className="vd-load-steps">
                      {IMPORT_PROGRESS_STEPS.map((label, i) => {
                        const isDone = i < siteLoadStep;
                        const isActive = i === siteLoadStep;
                        return (
                          <div key={label} className={`vd-load-step${isDone ? ' done' : isActive ? ' active' : ''}`}>
                            <span className="vd-load-step-icon">
                              {isDone ? '✓' : isActive ? <span className="vd-load-step-spinner" aria-hidden /> : i + 1}
                            </span>
                            {label}
                          </div>
                        );
                      })}
                    </div>
                    {siteDelayMessage ? <p className="vd-load-delay">{siteDelayMessage}</p> : null}
                    {siteDelayMessage ? (
                      <button type="button" className="vd-load-escape" onClick={exitToManualForm}>
                        Continue without website →
                      </button>
                    ) : null}
                  </div>
                ) : sitePhase === 'ready' && extractedData ? (
                  <div className="vd-form-card">
                    {importedDetailsEdit ? (
                      <div style={{ paddingTop: 16, marginBottom: 14 }}>
                        <div className="vd-found-head" style={{ marginBottom: 14 }}>Edit imported details</div>
                        <div className="vd-field" style={{ marginBottom: 10 }}>
                          <label htmlFor="vd-imported-biz">Business name</label>
                          <input
                            id="vd-imported-biz"
                            value={business.businessName}
                            onChange={(e) => setBusiness((c) => ({ ...c, businessName: e.target.value }))}
                          />
                        </div>
                        <div className="vd-2col" style={{ marginBottom: 10 }}>
                          <div className="vd-field vd-field-compact">
                            <label htmlFor="vd-imported-address">Address</label>
                            <input
                              id="vd-imported-address"
                              value={business.address}
                              placeholder={importAddressPlaceholder}
                              onChange={(e) => setBusiness((c) => ({ ...c, address: e.target.value }))}
                            />
                          </div>
                          <div className="vd-field vd-field-compact">
                            <label htmlFor="vd-imported-primary-hours">Hours</label>
                            <input
                              id="vd-imported-primary-hours"
                              value={business.primaryHours}
                              onChange={(e) => setBusiness((c) => ({ ...c, primaryHours: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="vd-field" style={{ marginBottom: 14 }}>
                          <label htmlFor="vd-imported-staff">{config.staffLabel}</label>
                          <input
                            id="vd-imported-staff"
                            value={business.staff}
                            placeholder="Not found on website"
                            onChange={(e) => setBusiness((c) => ({ ...c, staff: e.target.value }))}
                          />
                        </div>
                        <div style={{ paddingTop: 14 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 8 }}>Services</div>
                          <div className="vd-tabs">
                            {business.services.map((cat) => (
                              <button key={cat.id} type="button" className={`vd-tab ${selectedCategory === cat.id ? 'on' : ''}`} onClick={() => setSelectedCategory(cat.id)}>
                                {cat.label}
                              </button>
                            ))}
                          </div>
                          <div className="vd-svc-list">
                            {activeCategory?.items.map((item, idx) => (
                              <div key={`${activeCategory.id}-${item.name}`}>
                                <div className="vd-svc-row">
                                  <input type="checkbox" checked={item.enabled} onChange={(e) => updateService(activeCategory.id, idx, { enabled: e.target.checked })} />
                                  <div className="vd-svc-info">
                                    <div className="vd-svc-name">{item.name}</div>
                                    {item.duration ? <div className="vd-svc-dur">{item.duration}</div> : null}
                                  </div>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                    <span style={{ fontSize: 13, color: '#6B7280' }}>$</span>
                                    <input className="vd-svc-price" type="number" inputMode="numeric" min={0} value={item.price} onChange={(e) => updateService(activeCategory.id, idx, { price: Number(e.target.value) || 0 })} />
                                  </div>
                                  {renderServiceVariantChevron(activeCategory.id, item, idx)}
                                </div>
                                {renderServiceVariantPanel(activeCategory.id, item, idx)}
                              </div>
                            ))}
                          </div>
                        </div>
                        <button type="button" className="vd-found-edit" onClick={() => setImportedDetailsEdit(false)}>Done editing</button>
                      </div>
                    ) : (
                      <div>
                        <div className="vd-found-head" style={{ marginBottom: 12 }}>What we found</div>
                        {business.businessName || extractedData.businessName ? (
                          <div className="vd-found-row">
                            <span className="vd-found-key">Business</span>
                            <span className="vd-found-val">{business.businessName || extractedData.businessName}</span>
                          </div>
                        ) : null}
                        {importAddressDisplay ? (
                          <div className="vd-found-row">
                            <span className="vd-found-key">Address</span>
                            <span className="vd-found-val">
                              {importAddressDisplay}
                            </span>
                          </div>
                        ) : null}
                        <div className="vd-found-row">
                          <span className="vd-found-key">Hours</span>
                          {business.primaryHours || extractedData.hours ? (
                            <span className="vd-found-val">{business.primaryHours || extractedData.hours}</span>
                          ) : (
                            <input
                              className="vd-url-input"
                              style={{ fontSize: 13, padding: '6px 10px' }}
                              placeholder="e.g. Mon–Sat 9am–7pm"
                              value={business.primaryHours}
                              onChange={(e) => setBusiness((c) => ({ ...c, primaryHours: e.target.value }))}
                            />
                          )}
                        </div>
                        <div className="vd-found-row">
                          <span className="vd-found-key">Stylists</span>
                          <span className="vd-found-val">{business.staff || '—'}</span>
                        </div>
                        {currentServiceCategorySummary.length > 0 ? (
                          <div className="vd-found-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span className="vd-found-key">Services</span>
                            <div className="vd-found-chips">
                              {currentServiceCategorySummary.slice(0, 8).map((cat) => (
                                <span key={cat.label} className="vd-found-chip">{cat.label} · {cat.count}</span>
                              ))}
                              {currentServiceCategorySummary.length > 8 ? (
                                <span className="vd-found-chip">+{currentServiceCategorySummary.length - 8} more</span>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        <button type="button" className="vd-found-edit" onClick={() => setImportedDetailsEdit(true)}>Edit details →</button>
                      </div>
                    )}

                    {/* Captcha */}
                    {turnstileSiteKey ? (
                      <div style={turnstileWrapperStyle}>
                        <div className="vd-captcha">
                          <div className="vd-captcha-inner" ref={turnstileRef} />
                        </div>
                        {captchaHint ? <p className="vd-captcha-hint">{captchaHint}</p> : null}
                      </div>
                    ) : null}

                    {errors.length > 0 || requestError ? (
                      <div className="vd-errors">
                        {errors.map((e) => <div key={e} className="vd-error">{e}</div>)}
                        {requestError ? <div className="vd-error">{requestError}</div> : null}
                      </div>
                    ) : null}

                    <button type="button" className="vd-cta" onClick={() => void startWebDemo()} disabled={isSubmitting}>
                      {isSubmitting ? 'Starting…' : ctaLabel}
                    </button>
                    <p className="vd-cta-note">AI receptionist configured with your real salon data.</p>
                  </div>
                ) : (
                <div className="vd-form-card">
                  {/* URL input */}
                  <div className="vd-url-section">
                    <label className="vd-url-label">Try with your real {config.businessType.replace(/-/g, ' ')}</label>
                    <div className="vd-url-row">
                      <input
                        className="vd-url-input"
                        type="url"
                        placeholder="https://yoursalon.com"
                        value={siteUrl}
                        onChange={(e) => setSiteUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void readWebsite(); }}
                      />
                      <button type="button" className="vd-url-btn" onClick={() => void readWebsite()} disabled={!siteUrl.trim()}>
                        Read site
                      </button>
                    </div>
                    {siteLoadError ? <div className="vd-error" style={{ marginTop: 8 }}>{siteLoadError}</div> : null}
                  </div>
                  <div className="vd-url-divider">or use sample data below</div>

                  <div className="vd-field" style={{ marginBottom: 14 }}>
                    <label htmlFor="vd-biz">Business name</label>
                    <input id="vd-biz" value={business.businessName} onChange={(e) => setBusiness((c) => ({ ...c, businessName: e.target.value }))} />
                  </div>

                  <button type="button" className="vd-adv-toggle" onClick={() => setShowAdvanced((v) => !v)}>
                    <span className={`vd-adv-chevron ${showAdvanced ? 'open' : ''}`}>▼</span>
                    Customize hours, staff &amp; services
                  </button>

                  {showAdvanced ? (
                    <div className="vd-adv-body">
                      <div className="vd-2col">
                        <div className="vd-field vd-field-compact">
                          <label htmlFor="vd-address">Address</label>
                          <input id="vd-address" value={business.address} placeholder="e.g. 123 Main St, Los Angeles, CA" onChange={(e) => setBusiness((c) => ({ ...c, address: e.target.value }))} />
                        </div>
                        <div className="vd-field vd-field-compact">
                          <label htmlFor="vd-staff">{config.staffLabel}</label>
                          <input id="vd-staff" value={business.staff} placeholder={config.staffPlaceholder} onChange={(e) => setBusiness((c) => ({ ...c, staff: e.target.value }))} />
                        </div>
                      </div>
                      <div className="vd-2col">
                        <div className="vd-field vd-field-compact">
                          <label htmlFor="vd-ph">Primary hours</label>
                          <input id="vd-ph" value={business.primaryHours} onChange={(e) => setBusiness((c) => ({ ...c, primaryHours: e.target.value }))} />
                        </div>
                        <div className="vd-field vd-field-compact">
                          <label htmlFor="vd-sh">Secondary hours</label>
                          <input id="vd-sh" value={business.secondaryHours} onChange={(e) => setBusiness((c) => ({ ...c, secondaryHours: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <div className="vd-svc-label">{config.serviceLabel}</div>
                        <div className="vd-tabs">
                          {business.services.map((cat) => (
                            <button key={cat.id} type="button" className={`vd-tab ${selectedCategory === cat.id ? 'on' : ''}`} onClick={() => setSelectedCategory(cat.id)}>
                              {cat.label}
                            </button>
                          ))}
                        </div>
                        <div className="vd-svc-list">
                          {activeCategory?.items.map((item, idx) => (
                            <div key={`${activeCategory.id}-${item.name}`}>
                              <div className="vd-svc-row">
                                <input type="checkbox" checked={item.enabled} onChange={(e) => updateService(activeCategory.id, idx, { enabled: e.target.checked })} />
                                <div className="vd-svc-info">
                                  <div className="vd-svc-name">{item.name}</div>
                                  {item.duration ? <div className="vd-svc-dur">{item.duration}</div> : null}
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <span style={{ fontSize: 13, color: '#6B7280' }}>$</span>
                                  <input className="vd-svc-price" type="number" inputMode="numeric" min={0} value={item.price} onChange={(e) => updateService(activeCategory.id, idx, { price: Number(e.target.value) || 0 })} />
                                </div>
                                {renderServiceVariantChevron(activeCategory.id, item, idx)}
                              </div>
                              {renderServiceVariantPanel(activeCategory.id, item, idx)}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="vd-field vd-field-compact">
                        <label htmlFor="vd-notes">Extra context</label>
                        <textarea id="vd-notes" value={business.notes} placeholder={config.safetyNote} onChange={(e) => setBusiness((c) => ({ ...c, notes: e.target.value }))} />
                      </div>
                    </div>
                  ) : null}

                  {/* Captcha */}
                  {turnstileSiteKey ? (
                    <div style={turnstileWrapperStyle}>
                      <div className="vd-captcha">
                        <div className="vd-captcha-inner" ref={turnstileRef} />
                      </div>
                      {captchaHint ? <p className="vd-captcha-hint">{captchaHint}</p> : null}
                    </div>
                  ) : null}

                  {/* Errors */}
                  {errors.length > 0 || requestError ? (
                    <div className="vd-errors">
                      {errors.map((e) => <div key={e} className="vd-error">{e}</div>)}
                      {requestError ? <div className="vd-error">{requestError}</div> : null}
                    </div>
                  ) : null}

                  {/* CTA */}
                  <button type="button" className="vd-cta" onClick={() => void startWebDemo()} disabled={isSubmitting}>
                    {isSubmitting ? 'Starting…' : ctaLabel}
                  </button>
                  <p className="vd-cta-note">
                    Talk to RingBooker in your browser using this demo setup. No phone number required.
                  </p>

                  <div className="vd-phone-demo-secondary">
                    <div className="vd-phone-demo-title">Prefer to call?</div>
                    <p className="vd-phone-demo-text">Call the demo line and speak with the AI receptionist.</p>
                    <div className="vd-phone-demo-num-row">
                      <span className="vd-phone-demo-num">{verticalDemoPhoneDisplay}</span>
                      <button type="button" className="vd-phone-demo-copy" onClick={() => void copyDemoPhoneNumber()}>
                        {demoLineCopied ? 'Copied' : 'Copy number'}
                      </button>
                    </div>
                    <a className="vd-phone-demo-tel" href={verticalDemoPhoneTel}>
                      Call demo number
                    </a>
                    <p className="vd-phone-demo-note">{config.phoneDemoProfileCopy}</p>
                  </div>
                </div>
                )
                )
              ) : (
                /* ── STATUS VIEW ── */
                <div className={isMobileDemo ? 'vd-m-live-tweak' : undefined}>
                  <div className={`vd-status-pill ${stage}`}>
                    <span className={`vd-status-dot ${stage === 'queued' || stage === 'dialing' || stage === 'live' ? 'pulse' : ''}`} />
                    {stageLabel(stage)}
                  </div>

                  <h2 className="vd-status-h">
                    {stage === 'queued' || stage === 'dialing' ? 'Connecting…' :
                     stage === 'live' ? 'Your AI receptionist demo is ready' :
                     stage === 'completed' ? `Your AI just answered as ${demoDisplayName}` : 'Something went wrong'}
                  </h2>
                  <p className="vd-status-body">
                    {statusText}
                    {stage === 'completed' && !callExtracting && callExtracted?.hasRealData && callExtracted.serviceRequested && callExtracted.requestedTime
                      ? ' Here\'s what a follow-up SMS could look like.'
                      : null}
                  </p>

                  {stage === 'live' ? (
                    <>
                      <div className="vd-wave"><span /><span /><span /><span /><span /></div>
                      <div className="vd-prompts-head">Say one of these</div>
                      {suggestionsLoading ? (
                        <div className="vd-prompts">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <div key={i} className="vd-prompt" style={{ opacity: 0.45, pointerEvents: 'none' }}>
                              <span>Preparing your demo…</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="vd-prompts">
                          {visiblePrompts.map((p) => (
                            <button key={p} type="button" className="vd-prompt" onClick={() => void copyPrompt(p)}>
                              <span>"{p}"</span>
                              <span className="vd-prompt-copy">Copy</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {!suggestionsLoading && hiddenCount > 0 ? (
                        <button type="button" className="vd-prompt-more" onClick={() => setShowAllPrompts((v) => !v)}>
                          {showAllPrompts ? 'Show fewer' : `+${hiddenCount} more`}
                        </button>
                      ) : null}
                      {copied ? <div className="vd-copied">Copied!</div> : null}
                      {demoWebCallMode === 'direct_openai' ? (
                        <div className="vd-complete-cta">
                          <button type="button" className="vd-btn-ghost" onClick={endDirectDemo}>End demo</button>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {stage === 'completed' ? (
                    <>
                      {/* Block 1 — Sample SMS to client
                          Only shown when both service and requested time were captured.
                          Showing it with just a name (or nothing) would be misleading. */}
                      {!callExtracting && callExtracted?.hasRealData && callExtracted.serviceRequested && callExtracted.requestedTime ? (
                        <div className="vd-pd-sms-card">
                          <div className="vd-pd-label">Sample SMS to client</div>
                          <div className="vd-pd-sms-text">
                            {buildPersonalizedSmsPreview(callExtracted, demoDisplayName)}
                          </div>
                        </div>
                      ) : null}

                      {/* Block 2 — AI captured from this call
                          • Still extracting → show spinner row.
                          • Extracted with at least service or time → show non-null rows.
                          • Only name captured (or nothing at all) → hide both blocks and show
                            the "didn't capture" message instead of misleading empty rows. */}
                      {callExtracting ? (
                        <div className="vd-pd-cap">
                          <div className="vd-pd-label">AI captured from this call</div>
                          <div className="vd-pd-cap-empty">Capturing call details…</div>
                        </div>
                      ) : callExtracted?.hasRealData && (callExtracted.serviceRequested || callExtracted.requestedTime) ? (
                        <div className="vd-pd-cap">
                          <div className="vd-pd-label">AI captured from this call</div>
                          {callExtracted.callerName ? (
                            <div className="vd-pd-cap-row">
                              <span className="vd-pd-cap-ic" aria-hidden>👤</span>
                              <span className="vd-pd-cap-k">Client</span>
                              <span className="vd-pd-cap-v">{callExtracted.callerName}</span>
                            </div>
                          ) : null}
                          {callExtracted.serviceRequested ? (
                            <div className="vd-pd-cap-row">
                              <span className="vd-pd-cap-ic" aria-hidden>✂️</span>
                              <span className="vd-pd-cap-k">Service</span>
                              <span className="vd-pd-cap-v">{callExtracted.serviceRequested}</span>
                            </div>
                          ) : null}
                          {callExtracted.requestedTime ? (
                            <div className="vd-pd-cap-row">
                              <span className="vd-pd-cap-ic" aria-hidden>📅</span>
                              <span className="vd-pd-cap-k">Requested</span>
                              <span className="vd-pd-cap-v">{callExtracted.requestedTime}</span>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="vd-pd-no-capture">
                          The AI answered but didn&apos;t capture booking details from this call. In a real call, the conversation continues until your team has what they need.
                        </p>
                      )}

                      {/* Block 3 — CTA */}
                      <div className="vd-complete-cta">
                        <Link href="/pricing" className="vd-btn-primary">Start 14-Day Free Trial →</Link>
                      </div>

                      <div className="vd-post-steps">
                        <div className="vd-post-step">
                          <div className="vd-post-step-dot">✓</div>
                          <div className="vd-post-step-label">Demo call</div>
                        </div>
                        <div className="vd-post-step-bar" />
                        <div className="vd-post-step">
                          <div className="vd-post-step-dot">2</div>
                          <div className="vd-post-step-label">Start trial</div>
                        </div>
                        <div className="vd-post-step-bar" />
                        <div className="vd-post-step">
                          <div className="vd-post-step-dot">3</div>
                          <div className="vd-post-step-label">Go live</div>
                        </div>
                      </div>

                      {/* Block 4 — trust signals */}
                      <div className="vd-pd-trust">
                        <span><span className="vd-pd-trust-check">✓</span> No charge for 14 days</span>
                        <span><span className="vd-pd-trust-check">✓</span> Cancel anytime</span>
                      </div>
                      <div className="vd-pd-pay-wrap">
                        <span className="vd-pd-pay">
                          <span aria-hidden>🔒</span>
                          Card required to go live — not charged until day 15.
                        </span>
                      </div>

                      {/* Block 5 — try another scenario */}
                      <div className="vd-retry-wrap">
                        <button type="button" className="vd-retry-link" onClick={resetDemo}>
                          Try another scenario
                        </button>
                      </div>
                    </>
                  ) : null}

                  {stage === 'failed' ? (
                    <div className="vd-complete-cta">
                      {requestError ? <div className="vd-errors"><div className="vd-error">{requestError}</div></div> : null}
                      <button type="button" className="vd-btn-ghost" onClick={resetDemo}>← Try again</button>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Other verticals + disclaimer */}
              {otherDemoVerticals.length > 0 ? (
                <div className="vd-others">
                  {otherDemoVerticals.map((v) => (
                    <Link key={v.slug} href={`/demo/${v.slug}`} className="vd-other">
                      {v.businessType.replace(/-/g, ' ')}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            {/* ══ RIGHT COLUMN (desktop only) ══════════════════════ */}
            <div className="vd-right">
              {/* Phone preview card */}
              <div className="vd-phone">
                <div className="vd-phone-top">
                  <span className="vd-phone-time">9:41</span>
                  <span className="vd-phone-icons">● ▲ ■</span>
                </div>
                {displayedPreparedLogoUrl && !isPreparedDemo ? (
                  <img
                    src={displayedPreparedLogoUrl}
                    alt=""
                    width={40}
                    height={40}
                    onError={() => setPreparedLogoFailed(true)}
                    className="vd-phone-avatar"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      objectFit: 'cover',
                      border: '0.5px solid rgba(255,255,255,.24)',
                      background: '#fff',
                    }}
                  />
                ) : (
                  <div className="vd-phone-avatar" aria-hidden />
                )}
                <div className="vd-phone-name">{demoDisplayName}</div>
                <div className="vd-phone-subtitle">
                  {stage === 'queued' || stage === 'dialing'
                    ? 'Connecting…'
                    : stage === 'live'
                      ? 'Active Call'
                      : stage === 'completed'
                        ? 'Call Summary'
                        : stage === 'failed'
                          ? 'Call failed'
                          : sitePhase === 'loading'
                            ? 'Reading site…'
                            : sitePhase === 'ready'
                              ? 'Ready to call'
                              : 'LIVE DEMO CALL'}
                </div>
                <div className="vd-phone-mid">
                  {stage === 'queued' || stage === 'dialing' ? (
                    <div className="vd-phone-connecting" aria-live="polite">
                      <span className="vd-phone-connecting-dot" aria-hidden />
                      Connecting…
                    </div>
                  ) : sitePhase === 'loading' ? (
                    <div className="vd-phone-connecting" aria-live="polite">
                      <span className="vd-phone-connecting-dot" aria-hidden />
                      Reading…
                    </div>
                  ) : sitePhase === 'ready' && stage === 'idle' ? (
                    <div style={{ textAlign: 'center', fontSize: 28 }}>✓</div>
                  ) : (
                    <div className="vd-phone-wave">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                </div>
                <div className="vd-phone-dock">
                  {stage === 'live' ? (
                    <div className="vd-phone-ios-act">
                      <button type="button" className="vd-phone-ios-btn vd-phone-ios-btn--end" onClick={endWebDemoFromPhone} aria-label="End call">
                        <span className="vd-phone-ios-btn-face vd-phone-ios-btn-face--end" aria-hidden>
                          <svg viewBox="0 0 24 24">
                            <path
                              d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"
                              transform="rotate(135 12 12)"
                            />
                          </svg>
                        </span>
                      </button>
                      <span className="vd-phone-ios-label">End Call</span>
                    </div>
                  ) : null}
                  {stage === 'idle' ? (
                    <div className="vd-phone-ios-act">
                      <button type="button" className="vd-phone-ios-btn vd-phone-ios-btn--accept" onClick={() => void startWebDemo()} disabled={isSubmitting || sitePhase === 'loading'} aria-label={ctaLabel}>
                        <span className="vd-phone-ios-btn-face" aria-hidden>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </span>
                      </button>
                      <span className="vd-phone-ios-label">{sitePhase === 'ready' ? 'Start Your Demo' : ctaLabel}</span>
                    </div>
                  ) : null}
                  {stage === 'completed' || stage === 'failed' ? (
                    <div className="vd-phone-ios-act">
                      <button type="button" className="vd-phone-ios-btn vd-phone-ios-btn--accept" onClick={resetDemo} aria-label="Start Demo Call">
                        <span className="vd-phone-ios-btn-face" aria-hidden>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </span>
                      </button>
                      <span className="vd-phone-ios-label">Start Demo Call</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

          </div>

          <div className="vd-faq-outer">
            <MarketingFaqAccordion
              items={demoFaqItems}
              eyebrow="Common Questions"
              title={demoFaqTitle}
              subtitle={null}
              embedded
            />
          </div>
        </div>

        <MarketingFooter />
        {demoFaqJsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(demoFaqJsonLd) }}
          />
        ) : null}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      </>
    </MarketingLayout>
  );
}
