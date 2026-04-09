import type { Customer, Shop } from '@/src/backend/domain/types';

type PromptMode = 'inbound' | 'outbound_reminder' | 'callback';
const MAX_PROMPT_CHARS = 6000;
const MAX_LINE_CHARS = 260;
const MAX_SERVICES_IN_PROMPT = 24;

function compactLine(input: string, maxChars = MAX_LINE_CHARS): string {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}…`;
}

function buildRoleSection(mode: PromptMode, shopName: string): string {
  if (mode === 'outbound_reminder') {
    return [
      `You are calling a customer on behalf of ${shopName} to remind them about an appointment.`,
      'Be polite, brief, and professional.',
      'Keep the call short.',
      'Your goal is to confirm attendance or guide them to call/text the shop if they need changes.',
    ].join('\n');
  }

  if (mode === 'callback') {
    return [
      `You are calling a customer back on behalf of ${shopName} because they requested help or the shop missed their call.`,
      'Be warm and efficient.',
      'First confirm you have the right person, then address the reason for the callback.',
      'If you cannot fully resolve the issue, offer to have the user follow up.',
    ].join('\n');
  }

  return [
    `You are the phone receptionist for a service business called ${shopName}.`,
    'Speak in natural, conversational American English.',
    'Keep responses brief and clear.',
    'Sound warm, confident, and efficient.',
    'Your job is to help the caller book, reschedule, get basic shop information, or reach a human when needed.',
    'Do not mention internal systems, tools, or policies unless relevant to the caller.',
    'Never guess facts that are not in the provided shop information.',
    'If something is uncertain or unavailable, offer a callback or human follow-up.',
  ].join('\n');
}

function buildShopSection(shop: Shop): string {
  const allServices = shop.services.map((service) => compactLine(`${service.name} ($${service.price}, ${service.duration_min} min)`));
  const servicePreview = allServices.slice(0, MAX_SERVICES_IN_PROMPT);
  const servicesList =
    allServices.length > MAX_SERVICES_IN_PROMPT
      ? `${servicePreview.join(', ')}, +${allServices.length - MAX_SERVICES_IN_PROMPT} more`
      : servicePreview.join(', ');

  const hoursList = Object.entries(shop.hours)
    .map(([day, value]) => {
      if ('open' in value && 'close' in value) {
        return compactLine(`${day}: ${value.open}-${value.close}`);
      }
      return `${day}: closed`;
    })
    .join(', ');

  return [
    `SHOP NAME: ${shop.name}`,
    `ADDRESS: ${shop.address ?? 'not provided'}`,
    `TIMEZONE: ${shop.timezone}`,
    `VOICE STYLE: ${shop.ai_voice ?? 'Aoede'}`,
    `HOURS: ${hoursList}`,
    `SERVICES: ${servicesList}`,
    shop.promotions ? `PROMOTIONS: ${compactLine(shop.promotions, 400)}` : null,
    `CANCELLATION POLICY: ${shop.cancel_policy}`,
    shop.booking_url ? `BOOKING URL: ${shop.booking_url}` : null,
    shop.ai_welcome_message ? `WELCOME MESSAGE: ${compactLine(shop.ai_welcome_message, 240)}` : null,
    shop.ai_custom_instructions ? `CUSTOM INSTRUCTIONS: ${compactLine(shop.ai_custom_instructions, 700)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildCustomerSection(customer: Customer | null): string {
  if (!customer) return 'CUSTOMER: New customer. Be welcoming and clear.';

  return [
    'RETURNING CUSTOMER:',
    `- Name: ${customer.full_name ?? 'unknown'}`,
    `- Visits: ${customer.visit_count}`,
    `- Last service: ${customer.last_service ?? 'unknown'}`,
    `- Preferred tech: ${customer.preferred_tech ?? 'none'}`,
    customer.notes ? `- Notes: ${customer.notes}` : null,
    'Use this naturally if helpful, but do not sound creepy or overfamiliar.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildRulesSection(): string {
  return [
    'RULES - follow these strictly:',
    '1. Always call check_availability before confirming any new or changed appointment time.',
    '2. If a slot is unavailable, immediately offer the alternatives returned by the tool.',
    '3. Before creating a booking, confirm date, time, service, and customer name.',
    '4. After booking is created, tell the customer they will receive a confirmation text.',
    '5. If caller asks for a human or sounds upset, transfer if possible; otherwise offer callback.',
    '6. If caller asks about payment/deposit, say a team member will follow up. Do not take payment in v1.',
    '7. Do not invent prices, services, technicians, promotions, or hours.',
    '8. Keep answers to 1-2 sentences unless the caller asks for detail.',
    '9. If audio is unclear, ask the caller to repeat the specific missing detail.',
    '10. If caller interrupts, stop and listen.',
    '11. If a tool fails, avoid blame. Offer user follow-up or callback.',
    '12. Scope lock: only answer using SHOP section + CUSTOMER section + tool outputs in this call.',
    '13. If asked outside scope, say you can only help with this shop booking/info and offer transfer/callback.',
    '14. Never answer general knowledge, legal, medical, financial, politics, or unrelated advice.',
    "15. If caller asks anything not in available data, reply: 'I can only help with this shop’s booking and service information.'",
  ].join('\n');
}

export function buildSystemPrompt(input: {
  shop: Shop;
  customer: Customer | null;
  mode: PromptMode;
}): string {
  const sections = [
    buildRoleSection(input.mode, input.shop.name),
    buildShopSection(input.shop),
    buildCustomerSection(input.customer),
    buildRulesSection(),
  ];

  const prompt = sections.filter(Boolean).join('\n\n').trim();
  if (prompt.length <= MAX_PROMPT_CHARS) return prompt;
  return `${prompt.slice(0, MAX_PROMPT_CHARS)}\n\n[Prompt compacted to fit latency/context budget]`;
}
