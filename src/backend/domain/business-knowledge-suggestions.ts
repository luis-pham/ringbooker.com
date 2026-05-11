import { createHash } from 'node:crypto';
import { z } from 'zod';

import type {
  BusinessKnowledgeSuggestion,
  BusinessKnowledgeSuggestionSource,
  BusinessKnowledgeSuggestionType,
  BusinessFaqItem,
  Shop,
  StaffMember,
} from '@/src/backend/domain/types';
import type { ImportSuggestions } from '@/src/backend/services/website-import/types';

export type BusinessKnowledgeSuggestionCreate = {
  suggestionType: BusinessKnowledgeSuggestionType;
  payload: Record<string, unknown>;
  payloadHash: string;
  confidence: number;
  source: BusinessKnowledgeSuggestionSource;
  evidenceSnippet?: string | null;
};

const urlSchema = z.string().url().optional();
const confidenceSchema = z.number().min(0).max(1);
const staffPayloadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120).nullable().optional(),
  specialties: z.array(z.string().trim().min(1).max(80)).max(12).optional().default([]),
  notes: z.string().trim().max(500).nullable().optional(),
  active: z.boolean().optional().default(true),
}).strict();
const policyPayloadSchema = z.object({
  type: z.enum(['cancellation', 'no_show', 'deposit', 'late_arrival', 'walk_ins', 'refund', 'appointment_prep', 'consultation', 'other']),
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(1200),
}).strict();
const faqPayloadSchema = z.object({ question: z.string().trim().min(1).max(240), answer: z.string().trim().min(1).max(1200) }).strict();
const promotionPayloadSchema = z.object({ title: z.string().trim().min(1).max(180), description: z.string().trim().max(800).nullable().optional(), expiresAt: z.string().nullable().optional() }).strict();
const bookingHintPayloadSchema = z.object({
  type: z.enum(['booking_link', 'booking_platform', 'provider_booking', 'consultation_required', 'call_to_book', 'other']),
  label: z.string().trim().min(1).max(160),
  value: z.string().trim().max(500).optional(),
  platform: z.enum(['vagaro', 'booksy', 'fresha', 'glossgenius', 'square', 'calendly', 'other']).nullable().optional(),
}).strict();

export const suggestionPayloadSchemas = {
  staff: staffPayloadSchema,
  policy: policyPayloadSchema,
  faq: faqPayloadSchema,
  promotion: promotionPayloadSchema,
  booking_hint: bookingHintPayloadSchema,
} as const;

function sanitizeText(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/<[^>]*>/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

function sanitizePayloadValue(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeText(value, 1200) ?? '';
  if (Array.isArray(value)) return value.map(sanitizePayloadValue).filter((item) => item !== '');
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sanitizePayloadValue(item)]));
  }
  return value;
}

function clampConfidence(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function payloadHash(payload: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function createSuggestion(input: {
  suggestionType: BusinessKnowledgeSuggestionType;
  payload: Record<string, unknown>;
  confidence: unknown;
  source: BusinessKnowledgeSuggestionSource;
  evidenceSnippet?: unknown;
}): BusinessKnowledgeSuggestionCreate | null {
  const parsed = suggestionPayloadSchemas[input.suggestionType].safeParse(input.payload);
  if (!parsed.success) return null;
  const payload = sanitizePayloadValue(parsed.data) as Record<string, unknown>;
  return {
    suggestionType: input.suggestionType,
    payload,
    payloadHash: payloadHash(payload),
    confidence: clampConfidence(input.confidence),
    source: input.source,
    evidenceSnippet: sanitizeText(input.evidenceSnippet, 500) ?? null,
  };
}

export function secondarySummary(suggestions: ImportSuggestions): { staffCount: number; policyCount: number; faqCount: number; promotionCount: number; bookingHintCount: number } {
  return {
    staffCount: suggestions.staffSuggestions.length,
    policyCount: suggestions.policySuggestions.length,
    faqCount: suggestions.faqSuggestions.length,
    promotionCount: suggestions.promotionSuggestions.length,
    bookingHintCount: suggestions.bookingSetupSuggestions.length,
  };
}

export function pendingSuggestionsFromImport(suggestions: ImportSuggestions): BusinessKnowledgeSuggestionCreate[] {
  const creates: Array<BusinessKnowledgeSuggestionCreate | null> = [];
  for (const item of suggestions.staffSuggestions) creates.push(createSuggestion({ suggestionType: 'staff', payload: { name: item.name, role: item.role ?? null, specialties: item.specialties ?? [], notes: item.bio ?? item.evidenceSnippet ?? null, active: true }, confidence: item.confidence, source: item.source, evidenceSnippet: item.evidenceSnippet }));
  for (const item of suggestions.policySuggestions) creates.push(createSuggestion({ suggestionType: 'policy', payload: { type: item.type, title: item.title, content: item.content }, confidence: item.confidence, source: item.source, evidenceSnippet: item.evidenceSnippet }));
  for (const item of suggestions.faqSuggestions) creates.push(createSuggestion({ suggestionType: 'faq', payload: { question: item.question, answer: item.answer }, confidence: item.confidence, source: item.source, evidenceSnippet: item.evidenceSnippet }));
  for (const item of suggestions.promotionSuggestions) creates.push(createSuggestion({ suggestionType: 'promotion', payload: { title: item.title, description: item.description ?? null, expiresAt: item.expiresAt ?? null }, confidence: item.confidence, source: item.source, evidenceSnippet: item.evidenceSnippet }));
  for (const item of suggestions.bookingSetupSuggestions) creates.push(createSuggestion({ suggestionType: 'booking_hint', payload: { type: item.type, label: item.label, value: item.value, platform: item.platform ?? null }, confidence: item.confidence, source: item.source, evidenceSnippet: item.label }));
  return creates.filter((item): item is BusinessKnowledgeSuggestionCreate => Boolean(item));
}

export function validateSuggestionPayload(type: BusinessKnowledgeSuggestionType, payload: unknown): Record<string, unknown> | null {
  const parsed = suggestionPayloadSchemas[type].safeParse(payload);
  return parsed.success ? sanitizePayloadValue(parsed.data) as Record<string, unknown> : null;
}

function appendUnique<T>(items: T[], item: T, keyFn: (item: T) => string): T[] {
  const key = keyFn(item).trim().toLowerCase();
  if (!key) return items;
  return items.some((existing) => keyFn(existing).trim().toLowerCase() === key) ? items : [...items, item];
}

function appendParagraph(existing: string | null | undefined, paragraph: string): string {
  const clean = sanitizeText(paragraph, 1200) ?? '';
  if (!clean) return existing ?? '';
  const base = (existing ?? '').trim();
  if (!base) return clean;
  if (base.toLowerCase().includes(clean.toLowerCase())) return base;
  return `${base}\n\n${clean}`;
}

export function buildApplyPatchForSuggestions(shop: Shop, suggestions: BusinessKnowledgeSuggestion[], editedPayloads?: Record<string, unknown>): Partial<Pick<Shop, 'staff' | 'faqs' | 'cancel_policy' | 'promotions' | 'booking_url'>> | null {
  let staff = [...(shop.staff ?? [])];
  let faqs = [...(shop.faqs ?? [])];
  let cancelPolicy = shop.cancel_policy ?? '';
  let promotions = shop.promotions ?? '';
  let bookingUrl = shop.booking_url ?? null;
  let changed = false;

  for (const suggestion of suggestions) {
    const edited = editedPayloads?.[suggestion.id];
    const payload = edited !== undefined ? validateSuggestionPayload(suggestion.suggestionType, edited) : suggestion.payload;
    if (!payload) continue;
    if (suggestion.suggestionType === 'staff') {
      const parsed = staffPayloadSchema.parse(payload);
      const member: StaffMember = { name: parsed.name, role: parsed.role ?? null, specialties: parsed.specialties, notes: parsed.notes ?? null, active: parsed.active !== false };
      const next = appendUnique(staff, member, (item) => item.name);
      if (next.length !== staff.length) { staff = next; changed = true; }
    } else if (suggestion.suggestionType === 'faq') {
      const parsed = faqPayloadSchema.parse(payload);
      const faq: BusinessFaqItem = { question: parsed.question, answer: parsed.answer };
      const next = appendUnique(faqs, faq, (item) => item.question);
      if (next.length !== faqs.length) { faqs = next; changed = true; }
    } else if (suggestion.suggestionType === 'policy') {
      const parsed = policyPayloadSchema.parse(payload);
      const next = appendParagraph(cancelPolicy, `${parsed.title}: ${parsed.content}`);
      if (next !== cancelPolicy) { cancelPolicy = next; changed = true; }
    } else if (suggestion.suggestionType === 'promotion') {
      const parsed = promotionPayloadSchema.parse(payload);
      const next = appendParagraph(promotions, [parsed.title, parsed.description].filter(Boolean).join(': '));
      if (next !== promotions) { promotions = next; changed = true; }
    } else if (suggestion.suggestionType === 'booking_hint') {
      const parsed = bookingHintPayloadSchema.parse(payload);
      const maybeUrl = parsed.value && urlSchema.safeParse(parsed.value).success ? parsed.value : null;
      if (maybeUrl && !bookingUrl) { bookingUrl = maybeUrl; changed = true; }
      else {
        const faq: BusinessFaqItem = { question: 'Booking setup note', answer: [parsed.label, parsed.value].filter(Boolean).join(': ') };
        const next = appendUnique(faqs, faq, (item) => `${item.question}:${item.answer}`);
        if (next.length !== faqs.length) { faqs = next; changed = true; }
      }
    }
  }

  if (!changed) return null;
  return { staff, faqs, cancel_policy: cancelPolicy, promotions: promotions || null, booking_url: bookingUrl };
}
