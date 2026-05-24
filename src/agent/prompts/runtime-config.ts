import type { RuntimeBusinessConfig, RuntimeService, VoicePromptVertical } from './types';

const MAX_SERVICES_IN_PROMPT = 28;
const MAX_LINE_CHARS = 280;

export const STATIC_SERVICE_SCOPE_RULES = [
  'SERVICE SCOPE RULES:',
  '- Services in SERVICES / PRICING are offered; answer with the configured group, price, duration, notes, and booking behavior.',
  '- If a caller asks for a broad service group, ask which specific service they want.',
  '- If a caller asks for a service in NOT OFFERED SERVICES, say it is not offered and redirect to configured services.',
  '- If a caller asks for an unknown service that is neither in SERVICES / PRICING nor NOT OFFERED SERVICES, do not deny it; say you are not certain and offer team follow-up.',
  '- If a caller asks for a cross-service combo, confirm only the configured services and offer follow-up for anything uncertain.',
].join('\n');

export const RUNTIME_CONFIG_TEMPLATE = [
  'RUNTIME CONFIG TEMPLATE',
  'Purpose:',
  '- Inject business-specific facts after core, guardrail, vertical, and call-type layers.',
  '',
  'Tone goals:',
  '- Fact source only. Do not introduce new style beyond approved business preferences.',
  '',
  'Fields:',
  '- BUSINESS NAME: official business name used in greeting and caller-facing references.',
  '- PRIMARY BUSINESS TYPE: operational category or vertical label.',
  '- ADDITIONAL SERVICES: secondary services or specialties that do not change the primary business type.',
  '- LOCATION: address/city if available.',
  '- TIMEZONE: business timezone for date/time interpretation.',
  '- CURRENT LOCAL TIME: current shop-local weekday and time.',
  '- SHOP STATUS: whether the shop is open or closed right now.',
  "- TODAY'S HOURS: today's configured hours.",
  '- HOURS: compact hours summary.',
  '- PROVIDERS / STAFF: approved staff, stylist, technician, provider, or clinician names.',
  '- SERVICES / PRICING: approved service names, prices/ranges, duration, and category.',
  '- NOT OFFERED SERVICES: user-confirmed services this business definitely does not offer.',
  '- PROMOTIONS: current approved promotions.',
  '- CANCELLATION POLICY: approved policy wording.',
  '- BOOKING URL: optional booking link.',
  '- WELCOME MESSAGE: exact opening message if configured.',
  '- LANGUAGE OPTIONS: when present, caller-facing languages enabled for bilingual workflow on paid plans.',
  '- LANGUAGE DIRECTIVE: production policy (Starter English-only, bilingual workflow rules, enterprise routing hints).',
  '- CALLER CONTEXT: returning customer or caller-specific details.',
  '- DEMO CONTEXT: demo-only scenario and safety framing.',
  '- CUSTOM INSTRUCTIONS: business-approved prompt overrides that do not violate guardrails.',
  '',
  'Must-do rules:',
  '- Treat runtime data as the source of truth for business facts.',
  '- If runtime data is missing, say you can check or offer human follow-up instead of guessing.',
  '- When services are grouped, use the group as context. If a caller asks for a broad group, ask which specific service item they want.',
  '- Respect service price wording: "starts at" means a minimum price, "price varies" or "consultation required" is not a fixed quote.',
  '- If a service says capture request only, capture the request for the team instead of implying direct booking.',
  '- If a caller asks for a service listed under NOT OFFERED SERVICES, answer clearly that it is not offered and redirect to configured services.',
  '- If a caller asks for an unknown service that is neither in SERVICES / PRICING nor NOT OFFERED SERVICES, do not deny it. Say you are not certain and offer team follow-up.',
  '- If a caller asks for a cross-service combo, confirm only the parts that are configured as offered.',
  '',
  'Must-avoid rules:',
  '- Do not use stale, invented, or cross-business data.',
  '- Do not let demo context affect production calls.',
  '',
  'Escalation behavior:',
  '- If runtime data is insufficient for a caller request, offer callback/transfer rather than inventing details.',
  '',
  'Special notes:',
  '- Runtime config is last in the composed prompt so business facts can override generic examples, but it cannot override guardrails.',
].join('\n');

export function compactPromptLine(input: string, maxChars = MAX_LINE_CHARS): string {
  const normalized = input
    .replace(/\s+/g, ' ')
    .replace(/[-]{3,}/g, '--')
    .trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}...`;
}

function renderServicePrice(service: RuntimeService): string | null {
  if (service.priceType === 'consultation') return 'consultation required';
  if (service.priceType === 'varies') return 'price varies';
  if (service.price !== undefined && service.price !== null && service.price > 0) {
    return service.priceType === 'from' ? `starts at $${service.price}` : `$${service.price}`;
  }
  if (service.price !== undefined && service.price !== null) return 'consultation / varies';
  return null;
}

function renderService(service: RuntimeService): string {
  const parts = [service.name];
  if (service.variants?.length) {
    const options = service.variants
      .slice(0, 12)
      .map((variant) => {
        const price = renderServicePrice({ name: variant.label, price: variant.price, priceType: variant.priceType });
        const duration = variant.duration ? String(variant.duration) : '';
        const label = variant.label && variant.label !== duration ? variant.label : '';
        return [label || duration, label ? duration : null, price, variant.notes].filter(Boolean).join(': ').replace(': starts', ' starts');
      })
      .join('; ');
    parts.push(`Options: ${options}`);
  } else {
  const price = renderServicePrice(service);
  if (price) parts.push(price);
  if (service.duration !== undefined && service.duration !== null && service.duration !== '') {
    parts.push(`${service.duration}`);
  }
  }
  if (service.notes) parts.push(compactPromptLine(service.notes, 120));
  if (service.bookable === false) parts.push('capture request only; do not imply direct booking');
  return `- ${compactPromptLine(parts.join(' | '), 220)}`;
}

function renderGroupedServices(config: RuntimeBusinessConfig): string[] {
  const services = (config.services ?? []).slice(0, MAX_SERVICES_IN_PROMPT);
  const omitted = Math.max(0, (config.services?.length ?? 0) - MAX_SERVICES_IN_PROMPT);
  const groups = new Map<string, RuntimeService[]>();
  for (const service of services) {
    const category = service.category?.trim() || 'General Services';
    groups.set(category, [...(groups.get(category) ?? []), service]);
  }
  const lines: string[] = [];
  for (const [category, groupServices] of groups.entries()) {
    lines.push(`${category}:`);
    lines.push(...groupServices.map(renderService));
  }
  if (omitted > 0) lines.push(`- +${omitted} more services omitted for latency budget.`);
  return lines;
}

export function renderRuntimeBusinessConfig(config: RuntimeBusinessConfig): string {
  const services = renderGroupedServices(config);

  return [
    'RUNTIME BUSINESS CONFIG',
    `BUSINESS NAME: ${compactPromptLine(config.businessName, 120)}`,
    config.businessType ? `PRIMARY BUSINESS TYPE: ${compactPromptLine(config.businessType, 80)}` : null,
    config.additionalServices ? `ADDITIONAL SERVICES: ${compactPromptLine(config.additionalServices, 160)}` : null,
    config.location ? `LOCATION: ${compactPromptLine(config.location, 200)}` : null,
    config.timezone ? `TIMEZONE: ${compactPromptLine(config.timezone, 80)}` : null,
    config.currentLocalTime ? `CURRENT LOCAL TIME: ${compactPromptLine(config.currentLocalTime, 80)}` : null,
    typeof config.currentlyOpen === 'boolean' ? `SHOP STATUS: ${config.currentlyOpen ? 'OPEN' : 'CLOSED'}` : null,
    `TODAY'S HOURS: ${config.todayHours ? compactPromptLine(config.todayHours, 80) : 'Not specified'}`,
    config.hours ? `HOURS: ${compactPromptLine(config.hours, 700)}` : null,
    config.providers?.length ? `PROVIDERS / STAFF: ${config.providers.slice(0, 12).join(', ')}` : null,
    services.length ? ['SERVICES / PRICING:', ...services].join('\n') : 'SERVICES / PRICING: Not configured. Use consultation or callback framing.',
    config.services?.some((service) => service.variants?.length) ? 'SERVICE OPTION RULE: When a service has options, explain the available durations/prices and ask which option the caller prefers; do not quote only the cheapest option as the full answer.' : null,
    config.notOfferedServices?.length ? `NOT OFFERED SERVICES: ${config.notOfferedServices.slice(0, 30).join(', ')}` : null,
    config.promotions ? `PROMOTIONS: ${compactPromptLine(config.promotions, 400)}` : null,
    config.cancellationPolicy ? `CANCELLATION POLICY: ${compactPromptLine(config.cancellationPolicy, 400)}` : null,
    config.bookingUrl ? `BOOKING URL: ${config.bookingUrl}` : null,
    config.bookingRequestInstruction ? `BOOKING REQUEST INSTRUCTION: ${compactPromptLine(config.bookingRequestInstruction, 300)}` : null,
    config.welcomeMessage ? `WELCOME MESSAGE: ${compactPromptLine(config.welcomeMessage, 260)}` : null,
    config.languageOptions?.length ? `LANGUAGE OPTIONS: ${config.languageOptions.join(', ')}` : null,
    config.productionLanguageDirective
      ? `LANGUAGE DIRECTIVE: ${compactPromptLine(config.productionLanguageDirective, 1200)}`
      : null,
    config.handoffPolicy ? `HANDOFF POLICY: ${compactPromptLine(config.handoffPolicy, 400)}` : null,
    config.callerContext ? `CALLER CONTEXT: ${compactPromptLine(config.callerContext, 900)}` : null,
    config.demoContext ? `DEMO CONTEXT: ${compactPromptLine(config.demoContext, 900)}` : null,
    config.customInstructions ? `CUSTOM INSTRUCTIONS: ${compactPromptLine(config.customInstructions, 900)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function inferVerticalFromBusinessConfig(config: RuntimeBusinessConfig): VoicePromptVertical {
  const haystack = [
    config.businessName,
    config.businessType,
    config.customInstructions,
    ...(config.services ?? []).flatMap((service) => [service.name, service.category, service.notes]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/\b(med\s*spa|botox|dysport|injectable|filler|microneedling)\b/.test(haystack)) return 'med-spa';
  if (/\b(clinic|patient|acne|scar|laser session|pre-treatment|recovery)\b/.test(haystack)) return 'beauty-clinic';
  if (/\b(hair|balayage|keratin|haircut|blowout|stylist|color)\b/.test(haystack)) return 'hair-salon';
  if (/\b(day\s*spa|massage|couples|facial|gift card|spa package)\b/.test(haystack)) return 'day-spa';
  console.warn('[inferVerticalFromBusinessConfig] vertical_inference_fallback_hair_salon');
  return 'hair-salon';
}
