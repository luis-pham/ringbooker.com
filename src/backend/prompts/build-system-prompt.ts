import type { Customer, Shop, ShopRoutingRule } from '@/src/backend/domain/types';
import { canUseReturningCallerContext } from '@/src/backend/domain/shop-plan-capabilities';
import { buildProductionLanguageRuntimeFields } from '@/src/backend/prompts/production-language-policy';
import {
  composeVoicePrompt,
  inferVerticalFromBusinessConfig,
  renderProductionCustomInstructions,
  type RuntimeBusinessConfig,
  type VoicePromptCallType,
  type VoicePromptVertical,
} from '@/src/agent/prompts';

type PromptMode = 'inbound' | 'outbound_reminder' | 'callback';
const MAX_LINE_CHARS = 260;

function compactLine(input: string, maxChars = MAX_LINE_CHARS): string {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}…`;
}

function renderHours(shop: Shop): string {
  const hoursList = Object.entries(shop.hours)
    .map(([day, value]) => {
      if ('open' in value && 'close' in value) {
        return compactLine(`${day}: ${value.open}-${value.close}`);
      }
      return `${day}: closed`;
    })
    .join(', ');
  return hoursList;
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

function mapPromptModeToCallType(mode: PromptMode): VoicePromptCallType {
  if (mode === 'outbound_reminder') return 'outbound_reminder';
  if (mode === 'callback') return 'callback';
  return 'inbound_booking';
}


function renderRoutingRules(rules?: ShopRoutingRule[]): string | null {
  const active = (rules ?? []).filter((rule) => rule.active).sort((a, b) => a.priority - b.priority).slice(0, 12);
  if (!active.length) return null;
  return [
    'CUSTOM ROUTING / ESCALATION RULES:',
    ...active.map((rule) =>
      compactLine(
        `- priority ${rule.priority} ${rule.ruleType}: if ${JSON.stringify(rule.conditionJson)} then ${JSON.stringify(rule.actionJson)}`,
        500,
      ),
    ),
    'Follow these rules when they apply. For escalation actions, use configured human handoff/callback tools; do not claim a completed transfer unless the tool confirms it.',
  ].join('\n');
}

function renderFaqs(shop: Shop): string | null {
  const faqs = (shop.faqs ?? []).slice(0, 12);
  if (!faqs.length) return null;
  return [
    'APPROVED FAQ ANSWERS:',
    ...faqs.map((item) => compactLine(`- Q: ${item.question} A: ${item.answer}`, 500)),
    'Use these answers when callers ask matching questions. Do not invent FAQ answers that are not listed.',
  ].join('\n');
}

function buildRuntimeServices(shop: Shop): RuntimeBusinessConfig['services'] {
  const catalog = shop.service_catalog;
  if (catalog?.services.some((service) => service.active !== false)) {
    return catalog.services
      .filter((service) => service.active !== false)
      .sort((a, b) => {
        const categoryA = catalog.categories.find((category) => category.id === a.categoryId)?.sortOrder ?? 0;
        const categoryB = catalog.categories.find((category) => category.id === b.categoryId)?.sortOrder ?? 0;
        if (categoryA !== categoryB) return categoryA - categoryB;
        return a.sortOrder - b.sortOrder;
      })
      .map((service) => {
        const category = catalog.categories.find((item) => item.id === service.categoryId);
        return {
          name: service.name,
          category: category?.name ?? 'General Services',
          price: service.priceAmount,
          priceType: service.priceType,
          duration: service.durationText || (service.durationMinutes ? `${service.durationMinutes} min` : null),
          notes: [
            service.bookingNotes ?? service.description ?? null,
            service.aliases.length ? `Customers may call this: ${service.aliases.join(', ')}` : null,
          ].filter(Boolean).join(' | ') || null,
          bookable: service.bookable,
        };
      });
  }

  return shop.services.map((service) => ({
    name: service.name,
    category: 'General Services',
    price: service.price,
    priceType: service.price > 0 ? 'fixed' : 'varies',
    duration: `${service.duration_min} min`,
  }));
}

function buildProductionBusinessConfig(shop: Shop, customer: Customer | null, routingRules?: ShopRoutingRule[]): RuntimeBusinessConfig {
  const promptCustomer = canUseReturningCallerContext(shop.plan) ? customer : null;
  const languageFields = buildProductionLanguageRuntimeFields(shop.plan, shop.languages);
  const businessType = shop.vertical
    ? `${shop.vertical.replace(/_/g, ' ')}${shop.vertical_detail ? ` (${shop.vertical_detail.replace(/_/g, ' ')})` : ''}`
    : 'service business';
  return {
    businessName: shop.name,
    businessType,
    location: shop.address ?? null,
    timezone: shop.timezone,
    hours: renderHours(shop),
    services: buildRuntimeServices(shop),
    notOfferedServices: (shop.not_offered_services ?? []).filter((service) => service.trim().length > 0),
    providers: (shop.staff ?? [])
      .filter((member) => member.active !== false)
      .map((member) => {
        const parts = [
          member.name,
          member.role ?? null,
          member.specialties?.length ? `specialties: ${member.specialties.join(', ')}` : null,
          member.notes ?? null,
        ].filter(Boolean);
        return compactLine(parts.join(' | '), 180);
      }),
    promotions: shop.promotions ?? null,
    cancellationPolicy: shop.cancel_policy,
    bookingUrl: shop.booking_url ?? null,
    welcomeMessage: shop.ai_welcome_message ? compactLine(shop.ai_welcome_message, 240) : null,
    customInstructions: renderProductionCustomInstructions({
      voiceStyle: shop.ai_voice,
      shopCustomInstructions: [
        shop.ai_custom_instructions ? compactLine(shop.ai_custom_instructions, 700) : null,
        renderFaqs(shop),
        renderRoutingRules(routingRules),
      ].filter(Boolean).join('\n\n') || null,
    }),
    ...(languageFields.languageOptions?.length ? { languageOptions: languageFields.languageOptions } : {}),
    productionLanguageDirective: languageFields.productionLanguageDirective,
    callerContext: buildCustomerSection(promptCustomer),
  };
}

export function buildSystemPrompt(input: {
  shop: Shop;
  customer: Customer | null;
  mode: PromptMode;
  vertical?: VoicePromptVertical;
  routingRules?: ShopRoutingRule[];
}): string {
  const business = buildProductionBusinessConfig(input.shop, input.customer, input.routingRules);
  return composeVoicePrompt({
    vertical: input.vertical ?? inferVerticalFromBusinessConfig(business),
    callType: mapPromptModeToCallType(input.mode),
    mode: 'production',
    business,
    shopPlan: input.shop.plan,
    shopLanguages: input.shop.languages,
  });
}
