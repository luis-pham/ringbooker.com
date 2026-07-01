import {
  composeVoicePrompt,
  inferVerticalFromBusinessConfig,
  renderPublicDemoFallbackCustomInstructions,
  renderRuntimeEssentials,
  renderRuntimeOptional,
  type VoicePromptVertical,
} from '@/src/agent/prompts';
import type { VoicePromptCallType } from '@/src/agent/prompts/types';
import type { BusinessHours } from '@/src/backend/domain/types';
import { buildDefaultRuntimeGreeting } from '@/src/backend/domain/resolve-effective-runtime-config';
import { resolveShopTimeContext } from '@/src/backend/services/calls/business-hours';

export type DemoConfigInput = {
  address?: string;
  city?: string;
  primaryHours?: string;
  secondaryHours?: string;
  staffNames?: string[];
  useDefaultFallbacks?: boolean;
  services?: Array<{
    category: string;
    name: string;
    price?: number | null;
    duration?: string | null;
    enabled?: boolean;
    variants?: Array<{
      label: string;
      price?: number | null;
      duration?: string | null;
      priceType?: 'fixed' | 'from' | 'varies' | 'consultation' | null;
      notes?: string | null;
    }>;
  }>;
};

type DemoVerticalDefaults = {
  city: string;
  timezone: string;
  primaryHours: string;
  secondaryHours: string;
  /** Structured hours keyed by full weekday name (monday … sunday) — used for appointment validation. */
  structuredHours: BusinessHours;
  staffNames: string[];
  services: Array<{ category: string; name: string; price: number; duration: string }>;
};

/** Default demo data per vertical — used when demoConfig fields are missing */
const VERTICAL_DEMO_DEFAULTS: Record<string, DemoVerticalDefaults> = {
  'nail-salon': {
    city: 'Garden Grove, CA',
    timezone: 'America/Los_Angeles',
    primaryHours: 'Mon–Sat 9am–7pm',
    secondaryHours: 'Sun 10am–5pm',
    structuredHours: {
      monday:    { open: '09:00', close: '19:00' },
      tuesday:   { open: '09:00', close: '19:00' },
      wednesday: { open: '09:00', close: '19:00' },
      thursday:  { open: '09:00', close: '19:00' },
      friday:    { open: '09:00', close: '19:00' },
      saturday:  { open: '09:00', close: '19:00' },
      sunday:    { open: '10:00', close: '17:00' },
    },
    staffNames: ['Lan', 'Mai', 'Thu'],
    services: [
      { category: 'Manicure', name: 'Regular Manicure', price: 18, duration: '30 min' },
      { category: 'Manicure', name: 'Gel Manicure', price: 32, duration: '45 min' },
      { category: 'Manicure', name: 'Dip Powder', price: 40, duration: '60 min' },
      { category: 'Manicure', name: 'Acrylic Full Set', price: 50, duration: '75 min' },
      { category: 'Pedicure', name: 'Regular Pedicure', price: 28, duration: '35 min' },
      { category: 'Pedicure', name: 'Gel Pedicure', price: 42, duration: '50 min' },
      { category: 'Pedicure', name: 'Deluxe Pedicure', price: 55, duration: '60 min' },
    ],
  },
  'hair-salon': {
    city: 'Austin, TX',
    timezone: 'America/Chicago',
    primaryHours: 'Tue–Sat 9am–6pm',
    secondaryHours: 'Sun–Mon closed',
    structuredHours: {
      monday:    { closed: true },
      tuesday:   { open: '09:00', close: '18:00' },
      wednesday: { open: '09:00', close: '18:00' },
      thursday:  { open: '09:00', close: '18:00' },
      friday:    { open: '09:00', close: '18:00' },
      saturday:  { open: '09:00', close: '18:00' },
      sunday:    { closed: true },
    },
    staffNames: ['Mia', 'Jordan', 'Alex'],
    services: [
      { category: 'Cut & Style', name: "Women's Haircut", price: 65, duration: '60 min' },
      { category: 'Cut & Style', name: "Men's Haircut", price: 40, duration: '45 min' },
      { category: 'Cut & Style', name: 'Blowout', price: 45, duration: '45 min' },
      { category: 'Color', name: 'Color Consultation', price: 0, duration: '20 min' },
      { category: 'Color', name: 'Partial Highlights', price: 145, duration: '2 hr' },
      { category: 'Color', name: 'Keratin Treatment', price: 220, duration: '2.5 hr' },
    ],
  },
  'day-spa': {
    city: 'Scottsdale, AZ',
    timezone: 'America/Phoenix',
    primaryHours: 'Mon–Sat 10am–7pm',
    secondaryHours: 'Sun 10am–4pm',
    structuredHours: {
      monday:    { open: '10:00', close: '19:00' },
      tuesday:   { open: '10:00', close: '19:00' },
      wednesday: { open: '10:00', close: '19:00' },
      thursday:  { open: '10:00', close: '19:00' },
      friday:    { open: '10:00', close: '19:00' },
      saturday:  { open: '10:00', close: '19:00' },
      sunday:    { open: '10:00', close: '16:00' },
    },
    staffNames: ['Avery', 'Naomi', 'Sam'],
    services: [
      { category: 'Massage', name: 'Signature Massage', price: 120, duration: '60 min' },
      { category: 'Massage', name: 'Deep Tissue Massage', price: 140, duration: '60 min' },
      { category: 'Massage', name: 'Couples Massage', price: 260, duration: '60 min' },
      { category: 'Facial', name: 'Hydrating Facial', price: 115, duration: '50 min' },
      { category: 'Facial', name: 'Spa Day Package', price: 220, duration: '2 hr' },
    ],
  },
  'med-spa': {
    city: 'Newport Beach, CA',
    timezone: 'America/Los_Angeles',
    primaryHours: 'Mon–Fri 9am–6pm',
    secondaryHours: 'Sat 10am–3pm',
    structuredHours: {
      monday:    { open: '09:00', close: '18:00' },
      tuesday:   { open: '09:00', close: '18:00' },
      wednesday: { open: '09:00', close: '18:00' },
      thursday:  { open: '09:00', close: '18:00' },
      friday:    { open: '09:00', close: '18:00' },
      saturday:  { open: '10:00', close: '15:00' },
      sunday:    { closed: true },
    },
    staffNames: ['Dr. Lee', 'Nurse Ava', 'Morgan'],
    services: [
      { category: 'Consults', name: 'Injectables Consultation', price: 0, duration: '20 min' },
      { category: 'Consults', name: 'Laser Consultation', price: 0, duration: '20 min' },
      { category: 'Consults', name: 'Skin Consultation', price: 50, duration: '30 min' },
      { category: 'Treatments', name: 'Botox / Dysport', price: 0, duration: 'Consult required' },
      { category: 'Treatments', name: 'Microneedling', price: 275, duration: '60 min' },
    ],
  },
  'beauty-clinic': {
    city: 'Seattle, WA',
    timezone: 'America/Los_Angeles',
    primaryHours: 'Mon–Fri 8:30am–5:30pm',
    secondaryHours: 'Sat by appointment',
    structuredHours: {
      monday:    { open: '08:30', close: '17:30' },
      tuesday:   { open: '08:30', close: '17:30' },
      wednesday: { open: '08:30', close: '17:30' },
      thursday:  { open: '08:30', close: '17:30' },
      friday:    { open: '08:30', close: '17:30' },
      saturday:  { open: '09:00', close: '13:00' },
      sunday:    { closed: true },
    },
    staffNames: ['Dr. Patel', 'Erin', 'Sofia'],
    services: [
      { category: 'Appointments', name: 'New Patient Consultation', price: 75, duration: '30 min' },
      { category: 'Appointments', name: 'Follow-up Visit', price: 0, duration: '20 min' },
      { category: 'Appointments', name: 'Skin Treatment Session', price: 180, duration: '60 min' },
    ],
  },
};

/**
 * Returns the timezone and structured BusinessHours for a demo vertical.
 * Used by the validate-appointment-time endpoint to run server-side validation
 * without the full production Shop record.
 */
export function getDemoVerticalShopContext(
  vertical: string,
): { timezone: string; hours: BusinessHours } | null {
  const defaults = VERTICAL_DEMO_DEFAULTS[vertical];
  if (!defaults) return null;
  return { timezone: defaults.timezone, hours: defaults.structuredHours };
}

/** Sanitize a plain-text user input to prevent prompt injection via newlines/separators */
export function sanitizeDemoTextField(value: string | undefined, maxLen = 280): string {
  if (!value) return '';
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/[-]{3,}/g, '--')
    .trim()
    .slice(0, maxLen);
}

export function buildPublicDemoScriptedWelcomeLine(input: {
  shopName: string;
  businessType: string;
  demoVertical?: VoicePromptVertical;
}): string {
  const businessName = sanitizeDemoTextField(input.shopName, 120);
  return businessName
    ? buildDefaultRuntimeGreeting(businessName)
    : 'Thank you for calling, how can I help you today?';
}

export function buildPublicDemoSystemPrompt(input: {
  shopName: string;
  businessType: string;
  demoVertical?: VoicePromptVertical;
  staffName?: string;
  notes?: string;
  demoConfig?: DemoConfigInput;
  /** Default browser web voice demo; use inbound_sip for OpenAI SIP pilot. */
  demoChannel?: 'outbound_web' | 'inbound_sip';
  /** Prompt pack: inbound_booking for SIP callers; demo_outbound for marketing web voice demo (legacy key name). */
  voiceCallType?: VoicePromptCallType;
}) {
  const businessName = sanitizeDemoTextField(input.shopName, 120) || 'the business';
  const businessType = sanitizeDemoTextField(input.businessType, 80) || 'business';

  const resolvedVertical =
    input.demoVertical ?? (businessType.toLowerCase().includes('nail') ? 'nail-salon' : undefined);

  const welcomeMessage = buildPublicDemoScriptedWelcomeLine(input);

  const defaults = resolvedVertical ? VERTICAL_DEMO_DEFAULTS[resolvedVertical] : undefined;
  const allowDefaultFallbacks = input.demoConfig?.useDefaultFallbacks !== false;

  const providers: string[] = [];
  if (input.demoConfig?.staffNames?.length) {
    providers.push(...input.demoConfig.staffNames.slice(0, 8).map((n) => sanitizeDemoTextField(n, 80)).filter(Boolean));
  } else if (input.staffName) {
    providers.push(sanitizeDemoTextField(input.staffName, 80));
  } else if (allowDefaultFallbacks && defaults?.staffNames?.length) {
    providers.push(...defaults.staffNames);
  }

  const rawServices = input.demoConfig?.services?.filter((s) => s.enabled !== false).length
    ? input.demoConfig.services.filter((s) => s.enabled !== false)
    : allowDefaultFallbacks ? defaults?.services ?? [] : [];

  const services = rawServices.slice(0, 40).map((s) => {
    const variants = 'variants' in s ? s.variants : undefined;
    return {
      category: sanitizeDemoTextField(s.category, 60),
      name: sanitizeDemoTextField(s.name, 100),
      price: typeof s.price === 'number' ? s.price : undefined,
      duration: s.duration ? sanitizeDemoTextField(s.duration, 60) : undefined,
      variants: variants?.slice(0, 20).map((variant) => ({
        label: sanitizeDemoTextField(variant.label, 80),
        price: typeof variant.price === 'number' ? variant.price : undefined,
        duration: variant.duration ? sanitizeDemoTextField(variant.duration, 60) : undefined,
        priceType: variant.priceType ?? undefined,
        notes: variant.notes ? sanitizeDemoTextField(variant.notes, 160) : undefined,
      })).filter((variant) => variant.label || variant.duration || typeof variant.price === 'number'),
    };
  });

  const primaryHours = input.demoConfig?.primaryHours || (allowDefaultFallbacks ? defaults?.primaryHours : undefined);
  const secondaryHours = input.demoConfig?.secondaryHours || (allowDefaultFallbacks ? defaults?.secondaryHours : undefined);
  const hoursRaw = [primaryHours, secondaryHours].filter(Boolean).map((h) => sanitizeDemoTextField(h, 200)).join(', ');

  const address = input.demoConfig?.address;
  const city = input.demoConfig?.city || (allowDefaultFallbacks ? defaults?.city : undefined);

  // Compute real-time business context so the AI knows whether the shop is currently open
  // and can correctly answer time-related questions. Uses vertical default timezone; falls
  // back to graceful nulls when the vertical is unknown.
  const demoTimezone = allowDefaultFallbacks ? defaults?.timezone ?? null : null;
  const demoTimeContext = allowDefaultFallbacks && demoTimezone
    ? resolveShopTimeContext({ hours: defaults!.structuredHours, timezone: demoTimezone })
    : null;

  const demoContext =
    input.demoChannel === 'inbound_sip'
      ? 'Inbound SIP pilot demo — isolated from production. No real bookings are written.'
      : 'Web voice demo — isolated from production. No outbound call is placed to the visitor. No real bookings are written.';

  const business = {
    businessName,
    businessType,
    welcomeMessage,
    location: address
      ? sanitizeDemoTextField(address, 500)
      : city
        ? sanitizeDemoTextField(city, 120)
        : undefined,
    hours: hoursRaw || undefined,
    timezone: demoTimezone ?? undefined,
    currentLocalTime: demoTimeContext?.currentLocalTime ?? undefined,
    currentlyOpen: demoTimeContext?.currentlyOpen ?? undefined,
    todayHours: demoTimeContext?.todayHours ?? undefined,
    providers: providers.length > 0 ? providers : [],
    languageOptions:
      resolvedVertical === 'nail-salon' || resolvedVertical === 'beauty-clinic'
        ? ['English', 'Vietnamese']
        : ['English'],
    services: services.length > 0 ? services : undefined,
    demoContext,
    // Sanitize like every other free-text field: notes can carry website-imported or
    // visitor-supplied text into the live demo agent's system prompt, so strip newlines
    // and section separators to prevent prompt-injection breakout.
    customInstructions: renderPublicDemoFallbackCustomInstructions(sanitizeDemoTextField(input.notes, 500) || undefined),
  };

  const callType: VoicePromptCallType = input.voiceCallType ?? 'demo_outbound';

  return composeVoicePrompt({
    vertical: input.demoVertical ?? inferVerticalFromBusinessConfig(business),
    callType,
    mode: 'demo',
    business,
    runtimeEssentials: renderRuntimeEssentials(business),
    runtimeOptional: renderRuntimeOptional(business),
  });
}
