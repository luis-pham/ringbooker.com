import type { Customer, Shop, ShopRoutingRule, ShopStaff, ShopStaffService } from '@/src/backend/domain/types';
import { canUseReturningCallerContext, isCapabilityAllowed } from '@/src/backend/domain/shop-plan-capabilities';
import { buildProductionLanguageRuntimeFields } from '@/src/backend/prompts/production-language-policy';
import { resolveEffectiveRuntimeConfig } from '@/src/backend/domain/resolve-effective-runtime-config';
import { resolveShopTimeContext } from '@/src/backend/services/calls/business-hours';
import { getShopCalendarProviderMetadata } from '@/src/backend/services/calendar/types';
import { formatHour } from '@/src/backend/utils/time-format';
import {
  composeVoicePrompt,
  inferVerticalFromBusinessConfig,
  renderProductionCustomInstructions,
  renderRuntimeEssentials,
  renderRuntimeOptional,
  type RuntimeBusinessConfig,
  type VoicePromptCallType,
  type VoicePromptVertical,
} from '@/src/agent/prompts';

type PromptMode = 'inbound' | 'outbound_reminder' | 'callback';
const MAX_LINE_CHARS = 260;
const MANUAL_BOOKING_REQUEST_INSTRUCTION =
  'Silently call validate_appointment_time when time is given. Do not claim availability. Capture service, name, and preferred date/time before noting a request. Use caller ID for phone; ask only if caller ID is missing or caller wants another number. No booking window: accept approved future times.';
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABEL: Record<(typeof DAY_ORDER)[number], string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};
const DAY_SOURCE_KEYS: Record<(typeof DAY_ORDER)[number], string[]> = {
  mon: ['mon', 'monday'],
  tue: ['tue', 'tuesday'],
  wed: ['wed', 'wednesday'],
  thu: ['thu', 'thursday'],
  fri: ['fri', 'friday'],
  sat: ['sat', 'saturday'],
  sun: ['sun', 'sunday'],
};

function compactLine(input: string, maxChars = MAX_LINE_CHARS): string {
  const normalized = input
    .replace(/\s+/g, ' ')
    .replace(/[-]{3,}/g, '--')
    .trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}…`;
}

function renderHours(shop: Shop): string {
  return DAY_ORDER
    .filter((day) => DAY_SOURCE_KEYS[day].some((key) => shop.hours[key] !== undefined))
    .map((day) => {
      const value = DAY_SOURCE_KEYS[day].map((key) => shop.hours[key]).find((entry) => entry !== undefined);
      if (!value || !('open' in value) || !('close' in value)) {
        return `${DAY_LABEL[day]}: closed`;
      }
      return `${DAY_LABEL[day]}: ${formatHour(value.open)} to ${formatHour(value.close)}`;
    })
    .join(', ');
}

function renderHandoffPolicy(shop: Shop): string | null {
  if (!shop.allow_transfers) return null;
  switch (shop.handoff_availability) {
    case 'always':
      return 'Live transfer available at any time; attempt request_human_handoff when appropriate.';
    case 'custom': {
      if (!shop.handoff_custom_hours || !shop.timezone) {
        return 'Live transfer available during custom hours; attempt request_human_handoff when appropriate.';
      }
      const customHoursSummary = Object.entries(shop.handoff_custom_hours)
        .map(([day, value]) => ('closed' in value ? `${day}: closed` : `${day}: ${value.open}-${value.close}`))
        .join(', ');
      return `Live transfer available during custom hours (${shop.timezone}): ${customHoursSummary}. Outside these hours, capture details for follow-up.`;
    }
    case 'business_hours':
    default:
      return 'Live transfer available during business hours only. Outside business hours, capture details for follow-up instead of attempting transfer.';
  }
}

function buildCustomerSection(customer: Customer | null): string {
  if (!customer) return 'CUSTOMER: New customer. Be welcoming and clear.';

  return [
    'RETURNING CUSTOMER:',
    `- Name: ${compactLine(customer.full_name ?? 'unknown', 80)}`,
    `- Visits: ${customer.visit_count}`,
    `- Last service: ${compactLine(customer.last_service ?? 'unknown', 120)}`,
    `- Preferred tech: ${compactLine(customer.preferred_tech ?? 'none', 80)}`,
    customer.notes ? `- Notes: ${compactLine(customer.notes, 240)}` : null,
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
          variants: service.variants?.map((variant) => ({
            label: variant.label,
            price: variant.priceAmount,
            priceType: variant.priceType,
            duration: variant.durationText || (variant.durationMinutes ? `${variant.durationMinutes} min` : null),
            notes: variant.notes ?? null,
          })),
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

function buildStaffForPrompt(
  shop: Shop,
  shopStaff?: ShopStaff[],
  staffServiceMappings?: ShopStaffService[],
): string[] {
  if (isCapabilityAllowed(shop.plan, 'provider_context') && shopStaff && shopStaff.length > 0) {
    const serviceNameById = new Map((shop.service_catalog?.services ?? []).map((service) => [service.id, service.name]));
    const mappingsByStaffId = new Map<string, string[]>();
    for (const mapping of staffServiceMappings ?? []) {
      const serviceIds = mappingsByStaffId.get(mapping.staffId) ?? [];
      serviceIds.push(mapping.serviceId);
      mappingsByStaffId.set(mapping.staffId, serviceIds);
    }
    return shopStaff
      .filter((staff) => staff.active !== false)
      .slice(0, 12)
      .map((staff) => {
        const serviceIds = mappingsByStaffId.get(staff.id) ?? [];
        const assignedServiceNames = serviceIds
          .map((serviceId) => serviceNameById.get(serviceId))
          .filter((name): name is string => Boolean(name));
        const serviceContext =
          staff.allServices === false
            ? assignedServiceNames.length > 0
              ? `services: ${assignedServiceNames.slice(0, 8).join(', ')}${assignedServiceNames.length > 8 ? `, +${assignedServiceNames.length - 8} more` : ''}`
              : 'services: no assigned services'
            : staff.specialties?.length
              ? `specialties: ${staff.specialties.join(', ')}`
              : null;
        const parts = [
          staff.name,
          staff.role ?? null,
          serviceContext,
          staff.notes ?? null,
        ].filter(Boolean);
        return compactLine(parts.join(' | '), 180);
      });
  }

  const effectiveConfig = resolveEffectiveRuntimeConfig(shop);
  return (effectiveConfig.staff ?? [])
    .filter((member) => member.active !== false)
    .map((member) => {
      const parts = [
        member.name,
        member.role ?? null,
        member.specialties?.length ? `specialties: ${member.specialties.join(', ')}` : null,
        member.notes ?? null,
      ].filter(Boolean);
      return compactLine(parts.join(' | '), 180);
    });
}

function buildProductionBusinessConfig(
  shop: Shop,
  customer: Customer | null,
  routingRules?: ShopRoutingRule[],
  callerPhone?: string | null,
  shopStaff?: ShopStaff[],
  staffServiceMappings?: ShopStaffService[],
): RuntimeBusinessConfig {
  const promptCustomer = canUseReturningCallerContext(shop.plan) ? customer : null;
  const languageFields = buildProductionLanguageRuntimeFields(shop.plan, shop.languages);
  const effectiveRuntimeConfig = resolveEffectiveRuntimeConfig(shop);
  const thirdPartyIntegrationsEnabled = isCapabilityAllowed(shop.plan, 'third_party_integrations');
  const selectedIntegration = thirdPartyIntegrationsEnabled ? shop.selected_integration ?? null : null;
  const promptProviderShop = selectedIntegration === (shop.selected_integration ?? null)
    ? shop
    : { ...shop, selected_integration: selectedIntegration };
  const providerMeta = getShopCalendarProviderMetadata(promptProviderShop);
  const timeContext = resolveShopTimeContext(shop, new Date());
  const hasBookingIntegration = Boolean(selectedIntegration?.trim() || shop.booking_url?.trim());
  const businessType = shop.vertical
    ? shop.vertical.replace(/_/g, ' ')
    : 'service business';
  const runtimeConfig = {
    businessName: compactLine(shop.name, 120),
    businessType,
    additionalServices: shop.vertical_detail ? shop.vertical_detail.replace(/_/g, ' ') : null,
    location: shop.address ? compactLine(shop.address, 200) : null,
    timezone: shop.timezone,
    currentLocalTime: timeContext.currentLocalTime,
    currentlyOpen: timeContext.currentlyOpen,
    todayHours: timeContext.todayHours,
    hours: renderHours(shop),
    services: buildRuntimeServices(shop),
    notOfferedServices: (shop.not_offered_services ?? []).filter((service) => service.trim().length > 0),
    providers: buildStaffForPrompt(shop, shopStaff ?? shop.shopStaff, staffServiceMappings),
    promotions: shop.promotions ?? null,
    cancellationPolicy: shop.cancel_policy,
    bookingMethod: shop.booking_method ?? null,
    selectedIntegration,
    thirdPartyIntegrationsEnabled,
    vagaroMode: shop.vagaro_mode ?? null,
    vagaroConnectionStatus: shop.vagaro_connection_status ?? null,
    bookingUrl: shop.booking_url ?? null,
    bookingRequestInstruction: providerMeta.id === 'manual' && !hasBookingIntegration ? MANUAL_BOOKING_REQUEST_INSTRUCTION : null,
    welcomeMessage: compactLine(effectiveRuntimeConfig.aiWelcomeMessage, 240),
    customInstructions: renderProductionCustomInstructions({
      voiceStyle: effectiveRuntimeConfig.aiVoice,
      conversationalStyle: effectiveRuntimeConfig.aiConversationalStyle,
      shopCustomInstructions: [
        effectiveRuntimeConfig.aiCustomInstructions ? compactLine(effectiveRuntimeConfig.aiCustomInstructions, 700) : null,
        renderFaqs(shop),
        renderRoutingRules(routingRules),
      ].filter(Boolean).join('\n\n') || null,
    }),
    ...(languageFields.languageOptions?.length ? { languageOptions: languageFields.languageOptions } : {}),
    productionLanguageDirective: languageFields.productionLanguageDirective,
    handoffPolicy: renderHandoffPolicy(shop),
    ...(callerPhone !== undefined ? { callerPhone } : {}),
    callerContext: buildCustomerSection(promptCustomer),
  } as RuntimeBusinessConfig & { thirdPartyIntegrationsEnabled?: boolean };
  return runtimeConfig;
}

export function buildSystemPrompt(input: {
  shop: Shop;
  customer: Customer | null;
  mode: PromptMode;
  vertical?: VoicePromptVertical;
  routingRules?: ShopRoutingRule[];
  callerPhone?: string | null;
  shopStaff?: ShopStaff[];
  staffServiceMappings?: ShopStaffService[];
}): string {
  const business = buildProductionBusinessConfig(
    input.shop,
    input.customer,
    input.routingRules,
    input.callerPhone,
    input.shopStaff,
    input.staffServiceMappings,
  );
  return composeVoicePrompt({
    vertical: input.vertical ?? inferVerticalFromBusinessConfig(business),
    callType: mapPromptModeToCallType(input.mode),
    mode: 'production',
    business,
    runtimeEssentials: renderRuntimeEssentials(business),
    runtimeOptional: renderRuntimeOptional(business),
    shopPlan: input.shop.plan,
    shopLanguages: input.shop.languages,
  });
}
