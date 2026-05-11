import { z } from 'zod';

import type { GooglePlacesSuggestion } from './google-places';
import type {
  BookingSetupSuggestion,
  FaqSuggestion,
  ImportedServiceSuggestion,
  LlmImportExtraction,
  PagePreview,
  PolicySuggestion,
  PromotionSuggestion,
  SelectedPageDiagnostic,
  StaffSuggestion,
} from './types';

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export type LlmExtractionOptions = { enabled?: boolean; apiKey?: string | null; model?: string | null; maxTokens?: number | null; fetcher?: Fetcher; timeoutMs?: number };
type LlmPayloadInput = { sourceUrl: string; previews: PagePreview[]; googlePlaces?: GooglePlacesSuggestion | null; selectedPages?: SelectedPageDiagnostic[] };

const confidenceSchema = z.number().min(0).max(1);
const sourceEvidenceSchema = z.array(z.string()).optional().default([]);
const nullableStringFieldSchema = z.object({ value: z.string().nullable(), confidence: confidenceSchema, sourceEvidence: sourceEvidenceSchema }).strict();
const primaryTypeFieldSchema = z.object({
  value: z.enum(['nail_salon', 'hair_salon', 'day_spa', 'med_spa', 'beauty_clinic', 'mixed', 'other']).nullable(),
  confidence: confidenceSchema,
  sourceEvidence: sourceEvidenceSchema,
}).strict();
const hoursFieldSchema = z.object({ value: z.record(z.string(), z.unknown()).nullable(), confidence: confidenceSchema, sourceEvidence: sourceEvidenceSchema }).strict();
const serviceSchema = z.object({
  categoryName: z.string().nullable().optional(),
  groupName: z.string().nullable().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  durationText: z.string().max(80).nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  priceAmount: z.number().nonnegative().nullable().optional(),
  priceCurrency: z.string().optional().default('USD'),
  priceType: z.enum(['fixed', 'from', 'varies', 'consultation']),
  aliases: z.array(z.string()).optional().default([]),
  bookingNotes: z.string().nullable().optional(),
  bookable: z.boolean().optional().default(true),
  confidence: confidenceSchema,
  sourceEvidence: sourceEvidenceSchema,
}).strict();
const categorySchema = z.object({
  name: z.string().min(1),
  confidence: confidenceSchema,
  groupKind: z.enum(['primary', 'addon', 'custom']).nullable().optional(),
}).strict();
const snippetSchema = z.string().max(260).optional();
const staffSuggestionSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().max(120).optional(),
  specialties: z.array(z.string().max(80)).optional().default([]),
  bio: z.string().max(500).optional(),
  sourceUrl: z.string().url().optional(),
  confidence: confidenceSchema,
  evidenceSnippet: snippetSchema,
}).strict();
const policySuggestionSchema = z.object({
  type: z.enum(['cancellation', 'no_show', 'deposit', 'late_arrival', 'walk_ins', 'refund', 'appointment_prep', 'consultation', 'other']),
  title: z.string().min(1).max(160),
  content: z.string().min(1).max(1200),
  sourceUrl: z.string().url().optional(),
  confidence: confidenceSchema,
  evidenceSnippet: snippetSchema,
}).strict();
const faqSuggestionSchema = z.object({
  question: z.string().min(1).max(240),
  answer: z.string().min(1).max(1200),
  sourceUrl: z.string().url().optional(),
  confidence: confidenceSchema,
  evidenceSnippet: snippetSchema,
}).strict();
const promotionSuggestionSchema = z.object({
  title: z.string().min(1).max(180),
  description: z.string().max(800).optional(),
  expiresAt: z.string().nullable().optional(),
  sourceUrl: z.string().url().optional(),
  confidence: confidenceSchema,
  evidenceSnippet: snippetSchema,
}).strict();
const bookingSetupSuggestionSchema = z.object({
  type: z.enum(['booking_link', 'booking_platform', 'provider_booking', 'consultation_required', 'call_to_book', 'other']),
  label: z.string().min(1).max(160),
  value: z.string().max(500).optional(),
  platform: z.enum(['vagaro', 'booksy', 'fresha', 'glossgenius', 'square', 'calendly', 'other']).nullable().optional(),
  sourceUrl: z.string().url().optional(),
  confidence: confidenceSchema,
}).strict();
const llmImportSchema = z.object({
  businessProfile: z.object({
    name: nullableStringFieldSchema.optional(),
    primaryType: primaryTypeFieldSchema.optional(),
    phone: nullableStringFieldSchema.optional(),
    website: nullableStringFieldSchema.optional(),
    address: nullableStringFieldSchema.optional(),
    timezone: nullableStringFieldSchema.optional(),
  }).strict().optional(),
  hours: hoursFieldSchema.optional(),
  serviceCatalog: z.object({
    confidence: confidenceSchema,
    categories: z.array(categorySchema).optional().default([]),
    services: z.array(serviceSchema).optional().default([]),
  }).strict().optional(),
  alsoOffers: z.array(nullableStringFieldSchema).optional().default([]),
  bookingUrl: nullableStringFieldSchema.optional(),
  languages: z.array(nullableStringFieldSchema).optional().default([]),
  staffSuggestions: z.array(staffSuggestionSchema).optional().default([]).catch([]),
  policySuggestions: z.array(policySuggestionSchema).optional().default([]).catch([]),
  faqSuggestions: z.array(faqSuggestionSchema).optional().default([]).catch([]),
  promotionSuggestions: z.array(promotionSuggestionSchema).optional().default([]).catch([]),
  bookingSetupSuggestions: z.array(bookingSetupSuggestionSchema).optional().default([]).catch([]),
  warnings: z.array(z.string()).optional().default([]),
}).strict();

function toImportField(value: { value: string | null; confidence: number } | undefined): { value: string | null; confidence: number; source: string | null } | undefined {
  if (!value) return undefined;
  return { value: value.value, confidence: value.value === null ? 0 : value.confidence, source: value.value === null ? null : 'AI' };
}

function toService(raw: z.infer<typeof serviceSchema>): ImportedServiceSuggestion {
  const categoryName = raw.categoryName?.trim() || raw.groupName?.trim() || 'General Services';
  return {
    categoryName,
    name: raw.name.trim(),
    description: raw.description ?? null,
    durationText: raw.durationText?.trim() || (raw.durationMinutes ? `${raw.durationMinutes} min` : null),
    durationMinutes: raw.durationMinutes ?? null,
    priceAmount: raw.priceAmount ?? null,
    priceCurrency: raw.priceCurrency || 'USD',
    priceType: raw.priceType,
    aliases: raw.aliases.slice(0, 8),
    bookingNotes: raw.bookingNotes ?? null,
    bookable: raw.bookable,
    confidence: raw.confidence,
    source: 'AI',
  };
}

function sanitizeSnippet(value?: string): string | undefined {
  const cleaned = (value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, 240) : undefined;
}

function toStaffSuggestion(raw: z.infer<typeof staffSuggestionSchema>): StaffSuggestion {
  return { name: raw.name.trim(), role: raw.role?.trim(), specialties: raw.specialties.slice(0, 8), bio: raw.bio?.trim(), source: 'llm', sourceUrl: raw.sourceUrl, confidence: raw.confidence, evidenceSnippet: sanitizeSnippet(raw.evidenceSnippet) };
}

function toPolicySuggestion(raw: z.infer<typeof policySuggestionSchema>): PolicySuggestion {
  return { type: raw.type, title: raw.title.trim(), content: raw.content.trim(), source: 'llm', sourceUrl: raw.sourceUrl, confidence: raw.confidence, evidenceSnippet: sanitizeSnippet(raw.evidenceSnippet) };
}

function toFaqSuggestion(raw: z.infer<typeof faqSuggestionSchema>): FaqSuggestion {
  return { question: raw.question.trim(), answer: raw.answer.trim(), source: 'llm', sourceUrl: raw.sourceUrl, confidence: raw.confidence, evidenceSnippet: sanitizeSnippet(raw.evidenceSnippet) };
}

function toPromotionSuggestion(raw: z.infer<typeof promotionSuggestionSchema>): PromotionSuggestion {
  return { title: raw.title.trim(), description: raw.description?.trim(), expiresAt: raw.expiresAt ?? null, source: 'llm', sourceUrl: raw.sourceUrl, confidence: raw.confidence, evidenceSnippet: sanitizeSnippet(raw.evidenceSnippet) };
}

function toBookingSetupSuggestion(raw: z.infer<typeof bookingSetupSuggestionSchema>): BookingSetupSuggestion {
  return { type: raw.type, label: raw.label.trim(), value: raw.value?.trim(), platform: raw.platform ?? null, source: 'llm', sourceUrl: raw.sourceUrl, confidence: raw.confidence };
}

export function parseLlmImportJson(rawText: string): LlmImportExtraction | null {
  const jsonText = rawText.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  let parsed: unknown;
  try { parsed = JSON.parse(jsonText); } catch { return null; }
  const result = llmImportSchema.safeParse(parsed);
  if (!result.success) return null;
  const raw = result.data;
  return {
    businessProfile: raw.businessProfile ? {
      name: toImportField(raw.businessProfile.name),
      primaryType: toImportField(raw.businessProfile.primaryType),
      phone: toImportField(raw.businessProfile.phone),
      website: toImportField(raw.businessProfile.website),
      address: toImportField(raw.businessProfile.address),
      timezone: toImportField(raw.businessProfile.timezone),
    } : undefined,
    hours: raw.hours ? { value: raw.hours.value, confidence: raw.hours.value === null ? 0 : raw.hours.confidence, source: raw.hours.value === null ? null : 'AI' } : undefined,
    serviceCatalog: raw.serviceCatalog ? {
      confidence: raw.serviceCatalog.confidence,
      source: 'AI',
      categories: raw.serviceCatalog.categories.map((category) => ({ name: category.name.trim(), source: 'AI', confidence: category.confidence, groupKind: category.groupKind ?? null })),
      services: raw.serviceCatalog.services.map(toService),
    } : undefined,
    alsoOffers: raw.alsoOffers.map(toImportField).filter((item): item is NonNullable<ReturnType<typeof toImportField>> => Boolean(item)),
    bookingUrl: toImportField(raw.bookingUrl),
    languages: raw.languages.map(toImportField).filter((item): item is NonNullable<ReturnType<typeof toImportField>> => Boolean(item)),
    staffSuggestions: raw.staffSuggestions.map(toStaffSuggestion),
    policySuggestions: raw.policySuggestions.map(toPolicySuggestion),
    faqSuggestions: raw.faqSuggestions.map(toFaqSuggestion),
    promotionSuggestions: raw.promotionSuggestions.map(toPromotionSuggestion),
    bookingSetupSuggestions: raw.bookingSetupSuggestions.map(toBookingSetupSuggestion),
    warnings: raw.warnings.slice(0, 8),
  };
}

function phoneCandidates(previews: PagePreview[]): string[] {
  const re = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?!\d)/g;
  return [...new Set(previews.flatMap((page) => `${page.title}\n${page.h1}\n${page.firstTextChars}`.match(re) ?? []))].slice(0, 8);
}

function bookingUrlCandidates(previews: PagePreview[]): string[] {
  return [...new Set(previews.flatMap((page) => page.links).filter((link) => /book|appointment|schedule|reserve|vagaro|booksy|fresha|glossgenius|styleseat/i.test(`${link.text} ${link.href}`)).map((link) => link.href))].slice(0, 8);
}

function hoursCandidates(previews: PagePreview[]): string[] {
  const day = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b[^.;\n]{0,80}?(?:closed|\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:-|to)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;
  return [...new Set(previews.flatMap((page) => page.firstTextChars.match(day) ?? []))].slice(0, 12);
}

function addressCandidates(previews: PagePreview[]): string[] {
  const re = /\b\d{1,6}\s+[A-Za-z0-9 .'-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Plaza|Suite|Ste)\b[^\n]{0,80}/gi;
  return [...new Set(previews.flatMap((page) => page.firstTextChars.match(re) ?? []))].slice(0, 8);
}

function staffPageHints(previews: PagePreview[], selectedPages?: SelectedPageDiagnostic[]) {
  const selectedByUrl = new Map((selectedPages ?? []).map((page) => [page.url, page]));
  return previews
    .filter((page) => {
      const selected = selectedByUrl.get(page.url);
      const context = `${page.url} ${page.title} ${page.h1} ${page.h2s.join(' ')} ${page.firstTextChars.slice(0, 500)}`;
      return selected?.bucket === 'staff_team'
        || selected?.bucket === 'about_team'
        || /\b(artists?|staff|team|stylists?|providers?|technicians?)\b/i.test(context)
        || /STAFF_MEMBER:/i.test(page.firstTextChars);
    })
    .slice(0, 3)
    .map((page) => ({
      url: page.url,
      bucket: selectedByUrl.get(page.url)?.bucket ?? 'staff_team',
      title: page.title,
      h1: page.h1,
      h2s: page.h2s.slice(0, 8),
      text: page.firstTextChars.slice(0, 2500),
    }));
}

export function buildLlmImportPayload(input: LlmPayloadInput) {
  const selectedByUrl = new Map((input.selectedPages ?? []).map((page) => [page.url, page]));
  const pages = input.previews.slice(0, 8).map((page) => {
    const selected = selectedByUrl.get(page.url);
    return {
      url: page.url,
      bucket: selected?.bucket ?? 'homepage',
      source: selected?.source ?? 'homepage',
      title: page.title,
      h1: page.h1,
      h2s: page.h2s.slice(0, 8),
      text: page.firstTextChars.slice(0, 2500),
    };
  });
  return {
    task: 'Extract reviewable business knowledge for an AI receptionist. Return JSON only. Do not invent missing fields or prices.',
    schemaHint: [
      'Use {value, confidence, sourceEvidence} for profile fields.',
      'For services, return serviceCatalog.categories as service groups and give every service a categoryName matching one group. If you see groupName, map it to categoryName.',
      'Preserve the website service grouping language when available. Do not flatten unrelated service groups.',
      'Service names must contain only the menu item name. If a line is "Essential Blowout Shampoo & Condition • Smooth Blow Dry • 30 min+", return name "Essential Blowout", description "Shampoo & Condition • Smooth Blow Dry", and durationText "30 min+".',
      'durationText is the caller-facing duration exactly as shown, e.g. "60 min", "1 hour+", "30-45 min", "Varies".',
      'durationMinutes is only the numeric baseline when directly parseable. For "1 hour+" use durationText "1 hour+" and durationMinutes 60. If no duration is shown, use null; never invent 60.',
      'priceType must be fixed/from/varies/consultation. Put "Consultation Required" or booking caveats in bookingNotes, not in service names.',
      'Optional secondary arrays: staffSuggestions, policySuggestions, faqSuggestions, promotionSuggestions, bookingSetupSuggestions.',
      'For staffSuggestions, inspect artist/team/staff/stylist/provider pages and extract each person name, role/title, specialties, and bio only when supported by page text. A heading plus text below it can be a staff bio.',
      'Extract only evidence-backed website facts; do not auto-apply.',
    ].join(' '),
    sourceUrl: input.sourceUrl,
    deterministicFacts: {
      jsonLd: input.previews.flatMap((page) => page.jsonLd).slice(0, 10),
      phoneCandidates: phoneCandidates(input.previews),
      addressCandidates: addressCandidates(input.previews),
      hoursCandidates: hoursCandidates(input.previews),
      bookingUrlCandidates: bookingUrlCandidates(input.previews),
    },
    secondaryKnowledgeHints: {
      staffPages: staffPageHints(input.previews, input.selectedPages),
    },
    googlePlaces: input.googlePlaces ? { name: input.googlePlaces.name, phone: input.googlePlaces.phone, address: input.googlePlaces.address, website: input.googlePlaces.website, categories: input.googlePlaces.categories, hours: input.googlePlaces.hours, timezone: input.googlePlaces.timezone } : null,
    pages,
  };
}

export function buildLlmImportPrompt(input: LlmPayloadInput): string {
  return JSON.stringify(buildLlmImportPayload(input));
}

export async function extractWebsiteImportWithLlm(input: LlmPayloadInput, opts: LlmExtractionOptions): Promise<LlmImportExtraction | null> {
  if (!opts.enabled || !opts.apiKey) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8_000);
  try {
    const response = await (opts.fetcher ?? fetch)('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: opts.model?.trim() || 'gpt-4o-mini',
        temperature: 0,
        max_tokens: opts.maxTokens ?? 1800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You extract salon/spa business knowledge for user review. Return valid JSON only. Never invent missing facts, staff, policies, FAQs, promotions, prices, or booking integrations. Keep evidence snippets short and sanitized.' },
          { role: 'user', content: buildLlmImportPrompt(input) },
        ],
      }),
    });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null;
    const content = body?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? parseLlmImportJson(content) : null;
  } catch { return null; } finally { clearTimeout(timeout); }
}
