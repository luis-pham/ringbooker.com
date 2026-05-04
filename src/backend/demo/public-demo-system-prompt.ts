import {
  composeVoicePrompt,
  inferVerticalFromBusinessConfig,
  renderPublicDemoFallbackCustomInstructions,
  type VoicePromptVertical,
} from '@/src/agent/prompts';
import type { VoicePromptCallType } from '@/src/agent/prompts/types';

export type DemoConfigInput = {
  city?: string;
  primaryHours?: string;
  secondaryHours?: string;
  staffNames?: string[];
  services?: Array<{
    category: string;
    name: string;
    price?: number | null;
    duration?: string | null;
    enabled?: boolean;
  }>;
};

/** Default demo data per vertical — used when demoConfig fields are missing */
const VERTICAL_DEMO_DEFAULTS: Record<
  string,
  {
    city: string;
    primaryHours: string;
    secondaryHours: string;
    staffNames: string[];
    services: Array<{ category: string; name: string; price: number; duration: string }>;
  }
> = {
  'nail-salon': {
    city: 'Garden Grove, CA',
    primaryHours: 'Mon–Sat 9am–7pm',
    secondaryHours: 'Sun 10am–5pm',
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
    primaryHours: 'Tue–Sat 9am–6pm',
    secondaryHours: 'Sun–Mon closed',
    staffNames: ['Mia', 'Jordan', 'Alex'],
    services: [
      { category: 'Cut & Style', name: "Women's Haircut", price: 65, duration: '60 min' },
      { category: 'Cut & Style', name: "Men's Haircut", price: 40, duration: '45 min' },
      { category: 'Cut & Style', name: 'Blowout', price: 45, duration: '45 min' },
      { category: 'Color', name: 'Balayage Consultation', price: 0, duration: '20 min' },
      { category: 'Color', name: 'Partial Highlights', price: 145, duration: '2 hr' },
      { category: 'Color', name: 'Keratin Treatment', price: 220, duration: '2.5 hr' },
    ],
  },
  'day-spa': {
    city: 'Scottsdale, AZ',
    primaryHours: 'Mon–Sat 10am–7pm',
    secondaryHours: 'Sun 10am–4pm',
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
    primaryHours: 'Mon–Fri 9am–6pm',
    secondaryHours: 'Sat 10am–3pm',
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
    primaryHours: 'Mon–Fri 8:30am–5:30pm',
    secondaryHours: 'Sat by appointment',
    staffNames: ['Dr. Patel', 'Erin', 'Sofia'],
    services: [
      { category: 'Appointments', name: 'New Patient Consultation', price: 75, duration: '30 min' },
      { category: 'Appointments', name: 'Follow-up Visit', price: 0, duration: '20 min' },
      { category: 'Appointments', name: 'Skin Treatment Session', price: 180, duration: '60 min' },
    ],
  },
};

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
  const businessName = sanitizeDemoTextField(input.shopName, 120) || 'the business';
  const businessType = sanitizeDemoTextField(input.businessType, 80) || 'business';
  const resolvedVertical =
    input.demoVertical ?? (businessType.toLowerCase().includes('nail') ? 'nail-salon' : undefined);
  const hour = new Date().getUTCHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  switch (resolvedVertical) {
    case 'nail-salon':
      return `Hi, it's Mai at ${businessName} — what can I help with?`;
    case 'hair-salon':
      return `Hi, Maya at ${businessName} — how can I help?`;
    case 'day-spa':
      return `Good ${timeOfDay}, Lily at ${businessName}. What brings you in?`;
    case 'med-spa':
      return `Hi, Alex at ${businessName}. What can I help with today?`;
    case 'beauty-clinic':
      return `Hi, Morgan at ${businessName}. How can I help you today?`;
    default:
      return `Hi, you're through to ${businessName} — what would you like to try?`;
  }
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

  const providers: string[] = [];
  if (input.demoConfig?.staffNames?.length) {
    providers.push(...input.demoConfig.staffNames.slice(0, 8).map((n) => sanitizeDemoTextField(n, 80)).filter(Boolean));
  } else if (input.staffName) {
    providers.push(sanitizeDemoTextField(input.staffName, 80));
  } else if (defaults?.staffNames?.length) {
    providers.push(...defaults.staffNames);
  }

  const rawServices = input.demoConfig?.services?.filter((s) => s.enabled !== false).length
    ? input.demoConfig.services.filter((s) => s.enabled !== false)
    : defaults?.services ?? [];

  const services = rawServices.slice(0, 40).map((s) => ({
    category: sanitizeDemoTextField(s.category, 60),
    name: sanitizeDemoTextField(s.name, 100),
    price: typeof s.price === 'number' ? s.price : undefined,
    duration: s.duration ? sanitizeDemoTextField(s.duration, 60) : undefined,
  }));

  const primaryHours = input.demoConfig?.primaryHours || defaults?.primaryHours;
  const secondaryHours = input.demoConfig?.secondaryHours || defaults?.secondaryHours;
  const hoursRaw = [primaryHours, secondaryHours].filter(Boolean).map((h) => sanitizeDemoTextField(h, 200)).join(', ');

  const city = input.demoConfig?.city || defaults?.city;

  const demoContext =
    input.demoChannel === 'inbound_sip'
      ? 'Inbound SIP pilot demo — isolated from production. No real bookings are written.'
      : 'Web voice demo — isolated from production. No outbound call is placed to the visitor. No real bookings are written.';

  const business = {
    businessName,
    businessType,
    welcomeMessage,
    location: city ? sanitizeDemoTextField(city, 120) : undefined,
    hours: hoursRaw || undefined,
    providers: providers.length > 0 ? providers : [],
    languageOptions:
      resolvedVertical === 'nail-salon' || resolvedVertical === 'beauty-clinic'
        ? ['English', 'Vietnamese']
        : ['English'],
    services: services.length > 0 ? services : undefined,
    demoContext,
    customInstructions: renderPublicDemoFallbackCustomInstructions(input.notes),
  };

  const callType: VoicePromptCallType = input.voiceCallType ?? 'demo_outbound';

  return composeVoicePrompt({
    vertical: input.demoVertical ?? inferVerticalFromBusinessConfig(business),
    callType,
    mode: 'demo',
    business,
  });
}
