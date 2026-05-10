import { z } from 'zod';

import type { GooglePlacesSuggestion } from './google-places';
import type { ImportedServiceSuggestion, LlmImportExtraction, PagePreview, SelectedPageDiagnostic } from './types';

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
  name: z.string().min(1),
  description: z.string().nullable().optional(),
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
  warnings: z.array(z.string()).optional().default([]),
}).strict();

function toImportField(value: { value: string | null; confidence: number } | undefined): { value: string | null; confidence: number; source: string | null } | undefined {
  if (!value) return undefined;
  return { value: value.value, confidence: value.value === null ? 0 : value.confidence, source: value.value === null ? null : 'AI' };
}

function toService(raw: z.infer<typeof serviceSchema>): ImportedServiceSuggestion {
  return {
    categoryName: raw.categoryName?.trim() || 'General Services',
    name: raw.name.trim(),
    description: raw.description ?? null,
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
    schemaHint: 'Use {value, confidence, sourceEvidence} for profile fields. priceType must be fixed/from/varies/consultation.',
    sourceUrl: input.sourceUrl,
    deterministicFacts: {
      jsonLd: input.previews.flatMap((page) => page.jsonLd).slice(0, 10),
      phoneCandidates: phoneCandidates(input.previews),
      addressCandidates: addressCandidates(input.previews),
      hoursCandidates: hoursCandidates(input.previews),
      bookingUrlCandidates: bookingUrlCandidates(input.previews),
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
          { role: 'system', content: 'You extract salon/spa business knowledge. Return valid JSON only. Never invent missing facts.' },
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
