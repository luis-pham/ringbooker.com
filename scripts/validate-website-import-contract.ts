import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };
type SchemaObject = Record<string, unknown>;
type WebSource = { url: string; title?: string | null };
type OpenAiUsage = {
  input_tokens?: number;
  input_tokens_details?: { cached_tokens?: number };
  output_tokens?: number;
  output_tokens_details?: { reasoning_tokens?: number };
  total_tokens?: number;
};
type OpenAiJsonResult = {
  content: string;
  json: JsonObject;
  sources: WebSource[];
  usage: OpenAiUsage | null;
  model: string;
  webSearchCallCount: number | null;
  webSearchCountNote?: string;
};
type QualityResult = { qualityErrors: string[]; qualityWarnings: string[] };
type NormalizationReport = {
  staffBefore: number;
  staffAfter: number;
  servicesBefore: number;
  servicesAfter: number;
  categoriesBefore: number;
  categoriesAfter: number;
  staffDuplicatesRemoved: number;
  serviceDuplicatesRemoved: number;
  categoryDuplicatesRemoved: number;
  warningsAdded: number;
};
type FetchedServicePage = {
  url: string;
  title: string | null;
  textLength: number;
  debugTextPath: string | null;
  fetched: boolean;
  error: string | null;
  text?: string;
};
type ServiceFetchResult = {
  mode: 'self_fetch' | 'web_search' | 'none';
  candidateUrls: string[];
  fetchedPages: FetchedServicePage[];
};

const DEFAULT_SCHEMA_PATH = '/Users/huypq/Downloads/ringbooker_website_import_json_schema.json';
const DEFAULT_TEMPLATE_PATH = '/Users/huypq/Downloads/ringbooker_website_import_template.json';
const DEFAULT_PROMPT_PATH = '/Users/huypq/.codex/attachments/b3c499e6-e378-46c8-b969-05542488f3b4/pasted-text.txt';
const DEFAULT_URLS = ['https://avalon-salon.com/', 'https://www.20volumesalon.com/'];
const OUTPUT_PATH = path.resolve(process.cwd(), 'tmp/website-import-output.json');
const DEBUG_PATH = path.resolve(process.cwd(), 'tmp/website-import-debug.json');
const SERVICE_PAGE_DEBUG_ROOT = path.resolve(process.cwd(), 'tmp/service-pages');

function loadDotenvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value.replace(/\\n/g, '\n');
  }
}

function loadLocalEnv() {
  loadDotenvFile(path.resolve(process.cwd(), '.env.local'));
  loadDotenvFile(path.resolve(process.cwd(), '.env'));
}

function asObject(value: unknown): SchemaObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as SchemaObject : null;
}

function readJsonFile(filePath: string): Promise<JsonObject> {
  return readFile(filePath, 'utf8').then((raw) => JSON.parse(raw) as JsonObject);
}

function removeSchemaMetaForOpenAi(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeSchemaMetaForOpenAi);
  const object = asObject(value);
  if (!object) return value;
  if (Object.keys(object).length === 0) return { type: ['string', 'null'] };
  const out: SchemaObject = {};
  for (const [key, child] of Object.entries(object)) {
    if (key === '$schema') continue;
    out[key] = removeSchemaMetaForOpenAi(child);
  }
  return out;
}

function schemaForOpenAiStrict(schema: JsonObject): JsonObject {
  const normalized = removeSchemaMetaForOpenAi(schema) as JsonObject;
  delete normalized.title;

  const defs = asObject(normalized.$defs);
  const evidenceField = asObject(defs?.evidenceField);
  const evidenceProperties = asObject(evidenceField?.properties);
  if (evidenceProperties) {
    evidenceProperties.value = { type: ['string', 'null'] };
  }

  const properties = asObject(normalized.properties);
  if (properties && 'hours' in properties) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    properties.hours = {
      type: 'object',
      additionalProperties: false,
      required: ['value', 'confidence', 'sourceEvidence'],
      properties: {
        value: {
          type: 'object',
          additionalProperties: false,
          required: days,
          properties: Object.fromEntries(days.map((day) => [day, { type: ['string', 'null'] }])),
        },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        sourceEvidence: { type: 'array', items: { type: 'string' } },
      },
    };
  }

  return normalized;
}

function resolveRef(ref: string, root: SchemaObject): SchemaObject {
  if (!ref.startsWith('#/')) throw new Error(`unsupported_ref:${ref}`);
  let cursor: unknown = root;
  for (const part of ref.slice(2).split('/')) {
    const object = asObject(cursor);
    if (!object || !(part in object)) throw new Error(`missing_ref:${ref}`);
    cursor = object[part];
  }
  const resolved = asObject(cursor);
  if (!resolved) throw new Error(`invalid_ref:${ref}`);
  return resolved;
}

function schemaTypes(schema: SchemaObject): string[] {
  const type = schema.type;
  if (typeof type === 'string') return [type];
  if (Array.isArray(type)) return type.filter((item): item is string => typeof item === 'string');
  return [];
}

function valueType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function enumContains(values: unknown[], value: unknown): boolean {
  return values.some((item) => JSON.stringify(item) === JSON.stringify(value));
}

function validateJsonSchema(value: unknown, schema: SchemaObject, root: SchemaObject, at = '$'): string[] {
  const ref = typeof schema.$ref === 'string' ? schema.$ref : null;
  if (ref) return validateJsonSchema(value, resolveRef(ref, root), root, at);

  const errors: string[] = [];
  const types = schemaTypes(schema);
  if (types.length && !types.includes(valueType(value))) {
    errors.push(`${at}: expected ${types.join('|')}, got ${valueType(value)}`);
    return errors;
  }
  if (Array.isArray(schema.enum) && !enumContains(schema.enum, value)) errors.push(`${at}: value is not in enum`);
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) errors.push(`${at}: below minimum ${schema.minimum}`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) errors.push(`${at}: above maximum ${schema.maximum}`);
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const object = value as Record<string, unknown>;
    const properties = asObject(schema.properties) ?? {};
    const required = Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === 'string') : [];
    for (const key of required) {
      if (!(key in object)) errors.push(`${at}.${key}: missing required field`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(object)) {
        if (!(key in properties)) errors.push(`${at}.${key}: additional property is not allowed`);
      }
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in object) {
        const child = asObject(childSchema);
        if (child) errors.push(...validateJsonSchema(object[key], child, root, `${at}.${key}`));
      }
    }
  }
  if (Array.isArray(value)) {
    const itemSchema = asObject(schema.items);
    if (itemSchema) value.forEach((item, index) => errors.push(...validateJsonSchema(item, itemSchema, root, `${at}[${index}]`)));
  }
  return errors;
}

function walkStrings(value: unknown, visit: (value: string, at: string) => void, at = '$') {
  if (typeof value === 'string') {
    visit(value, at);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, visit, `${at}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) walkStrings(child, visit, `${at}.${key}`);
  }
}

function isPlainUrl(value: string): boolean {
  if (/\[[^\]]+]\(https?:\/\/[^)]+\)/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getPath(value: unknown, pathParts: string[]): unknown {
  let cursor = value;
  for (const part of pathParts) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function domainForUrl(value: string): string {
  const hostname = new URL(value).hostname.toLowerCase();
  return hostname.replace(/^www\./, '');
}

const SERVICE_KEYWORDS = [
  'service', 'services', 'pricing', 'menu',
  'cut', 'style', 'haircut', 'haircuts',
  'color', 'colour', 'balayage', 'highlight',
  'treatment', 'treatments', 'scalp',
  'waxing', 'facial', 'facials', 'spa', 'massage',
  'extension', 'extensions', 'texture',
  'bridal', 'occasion', 'add-services',
  'nails', 'manicure', 'pedicure',
];
const SERVICE_URL_RE = new RegExp(SERVICE_KEYWORDS.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
const POLICY_URL_RE = /\b(policy|policies|cancellation|cancel|no-show|no show|refund|deposit|late arrival|appointment policy)\b/i;
const STAFF_URL_RE = /\b(staff|team|stylists?|providers?|artists?|specialists?|owners?|educators?)\b/i;
const LOW_SERVICE_WARNING_RE = /low service coverage|multiple service pages|only \d+ services|service pages found|many services.*null prices|broad service categories/i;
const BROAD_SERVICE_NAME_RE = /(?:services$|treatments$|conditioning and scalp treatments|waxing services|bridal services|updos)/i;
const HOURS_FRONT_DESK_RE = /communication center|call center|front desk hours/i;

function sourceSignals(sources: WebSource[]) {
  const text = sources.map((source) => `${source.url} ${source.title ?? ''}`).join('\n').toLowerCase();
  const servicePageCount = sources.filter((source) => SERVICE_URL_RE.test(`${source.url} ${source.title ?? ''}`)).length;
  const policyPageCount = sources.filter((source) => POLICY_URL_RE.test(`${source.url} ${source.title ?? ''}`)).length;
  const staffPageCount = sources.filter((source) => STAFF_URL_RE.test(`${source.url} ${source.title ?? ''}`)).length;
  return {
    hasServicePage: servicePageCount > 0 || SERVICE_URL_RE.test(text),
    hasPolicyPage: policyPageCount > 0 || POLICY_URL_RE.test(text),
    hasStaffPage: staffPageCount > 0 || STAFF_URL_RE.test(text),
    hasBookOnline: /\b(book|booking|appointment|schedule|reserve)\b/i.test(text),
    servicePageCount,
    policyPageCount,
    staffPageCount,
  };
}

function getWarnings(output: unknown): string[] {
  const warnings = getPath(output, ['warnings']);
  return Array.isArray(warnings) ? warnings.filter((item): item is string => typeof item === 'string') : [];
}

function getServices(output: unknown): JsonObject[] {
  const services = getPath(output, ['serviceCatalog', 'services']);
  return Array.isArray(services) ? services.filter((item): item is JsonObject => Boolean(asObject(item))) : [];
}

function getPolicySuggestions(output: unknown): JsonObject[] {
  const policies = getPath(output, ['policySuggestions']);
  return Array.isArray(policies) ? policies.filter((item): item is JsonObject => Boolean(asObject(item))) : [];
}

function getStaffSuggestions(output: unknown): JsonObject[] {
  const staff = getPath(output, ['staffSuggestions']);
  return Array.isArray(staff) ? staff.filter((item): item is JsonObject => Boolean(asObject(item))) : [];
}

function detectLowServiceCoverage(output: JsonObject, sources: WebSource[] = []): { shouldRetry: boolean; reasons: string[] } {
  const servicesCount = getServices(output).length;
  const warnings = getWarnings(output);
  const signals = sourceSignals(sources);
  const reasons: string[] = [];
  if (servicesCount < 15 && warnings.some((warning) => LOW_SERVICE_WARNING_RE.test(warning))) {
    reasons.push(`warnings indicate low service coverage with ${servicesCount} service(s)`);
  }
  if (signals.servicePageCount >= 3 && servicesCount < 15) {
    reasons.push(`servicePageCount=${signals.servicePageCount} and servicesCount=${servicesCount}`);
  }
  return { shouldRetry: reasons.length > 0, reasons };
}

function validateSourceEvidenceArrays(value: unknown, at = '$'): string[] {
  const errors: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => errors.push(...validateSourceEvidenceArrays(item, `${at}[${index}]`)));
    return errors;
  }
  const object = asObject(value);
  if (!object) return errors;
  if ('sourceEvidence' in object) {
    const sourceEvidence = object.sourceEvidence;
    if (!Array.isArray(sourceEvidence) || sourceEvidence.some((item) => typeof item !== 'string')) {
      errors.push(`${at}.sourceEvidence: must be string[]`);
    }
  }
  for (const [key, child] of Object.entries(object)) {
    errors.push(...validateSourceEvidenceArrays(child, `${at}.${key}`));
  }
  return errors;
}

function validateQuality(output: JsonObject, sources: WebSource[]): QualityResult {
  const qualityErrors: string[] = [];
  const qualityWarnings: string[] = [];
  const signals = sourceSignals(sources);
  walkStrings(output, (value, at) => {
    if (/\[[^\]]+]\(https?:\/\/[^)]+\)/i.test(value)) qualityErrors.push(`${at}: markdown link is not allowed`);
    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        qualityErrors.push(`${at}: escaped JSON fragment string is not allowed`);
      } catch {
        // Not JSON; normal string.
      }
    }
  });

  const website = getPath(output, ['businessProfile', 'website', 'value']);
  if (website !== null && website !== undefined && (typeof website !== 'string' || !isPlainUrl(website))) {
    qualityErrors.push('$.businessProfile.website.value: must be a plain URL string or null');
  }
  const bookingUrl = getPath(output, ['bookingUrl', 'value']);
  if (bookingUrl !== null && bookingUrl !== undefined && (typeof bookingUrl !== 'string' || !isPlainUrl(bookingUrl))) {
    qualityErrors.push('$.bookingUrl.value: must be a plain URL string or null');
  }
  const services = getServices(output);
  qualityErrors.push(...validateSourceEvidenceArrays(output));
  if (services.length === 0) {
    qualityErrors.push('$.serviceCatalog.services: empty service catalog is not usable');
  } else if (signals.hasServicePage && services.length === 0) {
    qualityWarnings.push('$.serviceCatalog.services: empty even though OpenAI sources include service/menu URLs');
  }
  const lowCoverage = detectLowServiceCoverage(output, sources);
  qualityWarnings.push(...lowCoverage.reasons.map((reason) => `service_retry_candidate: ${reason}`));

  const nullPricedCount = services.filter((service) => service.priceAmount === null || service.priceAmount === undefined).length;
  if (signals.hasServicePage && services.length > 0 && nullPricedCount / services.length > 0.5) {
    qualityWarnings.push(`partial service pricing: ${nullPricedCount}/${services.length} services have null priceAmount`);
  }

  const policies = getPolicySuggestions(output);
  if (signals.hasPolicyPage && policies.length === 0) {
    qualityWarnings.push('$.policySuggestions: empty even though OpenAI sources include policy/cancellation URLs');
  }
  const staff = getStaffSuggestions(output);
  if (signals.hasStaffPage && staff.length === 0) {
    qualityWarnings.push('$.staffSuggestions: empty even though OpenAI sources include staff/team URLs');
  }
  if (signals.hasBookOnline && (bookingUrl === null || bookingUrl === undefined || bookingUrl === '')) {
    qualityWarnings.push('$.bookingUrl.value: null/empty even though OpenAI sources include booking signals');
  }
  return { qualityErrors, qualityWarnings };
}

function defaultPrompt(url: string, template: JsonObject) {
  return [
    'Read the public website and return one JSON object that matches the JSON Schema exactly.',
    'Use OpenAI web search/browser results to inspect the homepage and relevant internal pages from the same domain.',
    'Search/open pages for services, menu, pricing, cut/style, color, treatments, waxing, facials, team/staff/stylists, policies, cancellation, FAQ, contact, hours, and booking.',
    'Return JSON only. Do not include prose outside JSON.',
    'The output must be compatible with this frontend template shape; use real extracted values, not placeholders:',
    JSON.stringify(template, null, 2),
    'Rules:',
    '- Do not invent facts, prices, staff, policies, booking links, languages, or hours.',
    '- Prefer specific internal pages over homepage summaries.',
    '- Extract individual services and visible prices. Do not return broad categories when rows/items/prices are visible.',
    '- If a page lists Women $55+ and Men $45+, output separate services with priceType "from".',
    '- If one service has multiple duration/price options, keep one service and put options in variants.',
    '- Keep sourceEvidence as string[] only. Each string should include a plain source URL and a short quote, e.g. "Source: https://example.com/services - Women $55+".',
    '- Keep sourceEvidence short: max 1-2 strings per item, each under 180 characters.',
    '- Keep descriptions, policy content, bios, promotion text, and warnings concise. Do not copy long website sections.',
    '- Never output markdown links in any string. Use plain URLs only.',
    '- Map gift card, payment fee, service guarantee, product return, or other unsupported policy types to "other" or "refund"; do not add enum values.',
    '- Use bookingSetupSuggestions for booking link/platform, provider booking, consultation required, call to book, and services not available online.',
    '- Add warnings for missing, inaccessible, unclear, malformed, or incomplete info.',
    `Website URL: ${url}`,
  ].join('\n\n');
}

function buildPrompt(url: string, template: JsonObject) {
  const promptPath = process.env.WEBSITE_IMPORT_CONTRACT_PROMPT_PATH || DEFAULT_PROMPT_PATH;
  if (existsSync(promptPath)) {
    return readFileSync(promptPath, 'utf8')
      .replaceAll('{{WEBSITE_URL}}', url)
      .trim()
      + '\n\nFrontend-compatible output template shape:\n'
      + JSON.stringify(template, null, 2);
  }
  return defaultPrompt(url, template);
}

function serviceRetrySchemaFromFullSchema(fullSchema: JsonObject): JsonObject {
  const properties = asObject(fullSchema.properties);
  const serviceCatalog = properties?.serviceCatalog;
  const warnings = properties?.warnings;
  if (!serviceCatalog || !warnings) throw new Error('service_retry_schema_missing_full_schema_parts');
  return {
    $defs: (fullSchema.$defs ?? {}) as JsonValue,
    type: 'object',
    additionalProperties: false,
    required: ['serviceCatalog', 'warnings'],
    properties: {
      serviceCatalog: serviceCatalog as JsonValue,
      warnings: warnings as JsonValue,
    },
  };
}

function collectPlainUrlsFromStrings(value: unknown): string[] {
  const urls = new Set<string>();
  walkStrings(value, (text) => {
    for (const match of text.matchAll(/https?:\/\/[^\s)\]"'<>]+/gi)) {
      urls.add(match[0].replace(/[.,;:]+$/g, ''));
    }
  });
  return [...urls];
}

function serviceRelatedUrls(output: JsonObject, sources: WebSource[]): string[] {
  const candidates = [
    ...sources.map((source) => source.url),
    ...collectPlainUrlsFromStrings(output),
  ];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const candidate of candidates) {
    if (!SERVICE_URL_RE.test(candidate)) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    urls.push(candidate);
  }
  return urls.slice(0, 24);
}

function sameDomainUrl(candidate: string, baseUrl: string): string | null {
  try {
    const url = new URL(candidate, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (domainForUrl(url.href) !== domainForUrl(baseUrl)) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function safePathSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'page';
}

function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/\s(?:href|data-href)=["']([^"']+)["']/gi)) {
    const url = sameDomainUrl(match[1], baseUrl);
    if (url) links.add(url);
  }
  return [...links];
}

function extractSitemapUrls(xml: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  for (const match of xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) {
    const decoded = decodeHtmlEntities(match[1].trim());
    const url = sameDomainUrl(decoded, baseUrl);
    if (url) urls.add(url);
  }
  return [...urls];
}

function stripTrackingUrlNoise(urlValue: string): string {
  try {
    const url = new URL(urlValue);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_|^(fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return urlValue;
  }
}

function serviceUrlScore(urlValue: string): number {
  const text = urlValue.toLowerCase();
  let score = 0;
  for (const keyword of SERVICE_KEYWORDS) {
    if (text.includes(keyword)) score += keyword.length > 7 ? 3 : 2;
  }
  if (/\/(?:services?|pricing|menu)(?:\/|$)/i.test(text)) score += 8;
  if (/(?:cut|style|color|colour|treatment|texture|waxing|facial)/i.test(text)) score += 5;
  if (/(?:blog|post|privacy|terms|policy|contact|about|career|gift-card)/i.test(text)) score -= 6;
  return score;
}

function dedupeAndRankServiceUrls(urls: string[], baseUrl: string, limit = 12): string[] {
  const byUrl = new Map<string, string>();
  for (const url of urls) {
    const normalized = sameDomainUrl(stripTrackingUrlNoise(url), baseUrl);
    if (!normalized || !SERVICE_URL_RE.test(normalized)) continue;
    byUrl.set(normalized, normalized);
  }
  return [...byUrl.values()]
    .sort((a, b) => serviceUrlScore(b) - serviceUrlScore(a) || a.length - b.length)
    .slice(0, limit);
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    copy: '(c)',
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
    reg: '(r)',
    trade: '(tm)',
  };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (_, name) => named[String(name).toLowerCase()] ?? `&${name};`);
}

function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].replace(/\s+/g, ' ').trim()) || null : null;
}

function htmlToCleanText(html: string): string {
  const withoutHidden = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ');
  const withBreaks = withoutHidden
    .replace(/<(h[1-6]|p|div|section|article|header|footer|main|aside|nav|ul|ol|li|table|thead|tbody|tfoot|tr|td|th|br)\b[^>]*>/gi, '\n')
    .replace(/<\/(h[1-6]|p|div|section|article|header|footer|main|aside|nav|ul|ol|li|table|thead|tbody|tfoot|tr|td|th)>/gi, '\n');
  return decodeHtmlEntities(withBreaks)
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 20_000);
}

async function fetchText(url: string, timeoutMs = 15_000): Promise<{ body: string; contentType: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
        'user-agent': 'RingBooker Website Import Contract Test/1.0',
      },
    });
    if (!response.ok) throw new Error(`http_${response.status}`);
    return {
      body: await response.text(),
      contentType: response.headers.get('content-type'),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverServiceCandidateUrls(opts: { websiteUrl: string; output: JsonObject; sources: WebSource[] }): Promise<string[]> {
  const candidates = [
    ...serviceRelatedUrls(opts.output, opts.sources),
    ...opts.sources.map((source) => source.url),
    ...collectPlainUrlsFromStrings(opts.output),
  ];

  try {
    const homepage = await fetchText(opts.websiteUrl);
    candidates.push(...extractLinksFromHtml(homepage.body, opts.websiteUrl));
  } catch {
    // Homepage discovery is best-effort; sourceEvidence and sitemap may still help.
  }

  try {
    const sitemapUrl = new URL('/sitemap.xml', opts.websiteUrl).href;
    const sitemap = await fetchText(sitemapUrl);
    candidates.push(...extractSitemapUrls(sitemap.body, opts.websiteUrl));
  } catch {
    // Many sites do not expose a sitemap.xml, and this is only a test helper.
  }

  return dedupeAndRankServiceUrls(candidates, opts.websiteUrl, 12);
}

async function fetchAndSaveServicePage(url: string, websiteUrl: string): Promise<FetchedServicePage> {
  const safeDomain = safePathSegment(domainForUrl(websiteUrl));
  const safeSlug = safePathSegment(new URL(url).pathname || 'home');
  const debugDir = path.join(SERVICE_PAGE_DEBUG_ROOT, safeDomain);
  const debugTextPath = path.join(debugDir, `${safeSlug}.txt`);
  try {
    const fetched = await fetchText(url);
    const title = extractHtmlTitle(fetched.body);
    const cleanText = htmlToCleanText(fetched.body);
    const textLength = cleanText.length;
    await mkdir(debugDir, { recursive: true });
    await writeFile(debugTextPath, [
      `URL: ${url}`,
      `TITLE: ${title ?? ''}`,
      `TEXT_LENGTH: ${textLength}`,
      '---',
      cleanText,
    ].join('\n'));
    return {
      url,
      title,
      textLength,
      debugTextPath,
      fetched: true,
      error: null,
      text: cleanText,
    };
  } catch (error) {
    return {
      url,
      title: null,
      textLength: 0,
      debugTextPath: null,
      fetched: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchServicePagesForRetry(opts: { websiteUrl: string; output: JsonObject; sources: WebSource[] }): Promise<ServiceFetchResult> {
  const candidateUrls = await discoverServiceCandidateUrls(opts);
  const fetchedPages: FetchedServicePage[] = [];
  for (const candidateUrl of candidateUrls) {
    fetchedPages.push(await fetchAndSaveServicePage(candidateUrl, opts.websiteUrl));
  }
  const hasUsefulPage = fetchedPages.some((page) => page.fetched && page.textLength > 500);
  return {
    mode: hasUsefulPage ? 'self_fetch' : 'web_search',
    candidateUrls,
    fetchedPages,
  };
}

function buildServiceRetryPrompt(opts: { url: string; servicesCount: number; warnings: string[]; knownServiceUrls: string[] }) {
  const knownPages = opts.knownServiceUrls.length
    ? ['Known service-related pages:', ...opts.knownServiceUrls.map((url) => `- ${url}`)].join('\n')
    : 'Known service-related pages: none captured from the first pass.';
  return `
You are RingBooker's service catalog extraction specialist.

Goal:
Extract a more complete service catalog from the same website.

Website:
${opts.url}

Previous extraction had low service coverage:
- It found only ${opts.servicesCount} services.
- Warnings: ${opts.warnings.join(' | ') || 'None'}

${knownPages}

Task:
Focus only on service/menu/pricing pages.

You must inspect all discoverable pages related to:
- services
- service menu
- pricing
- cut
- style
- haircuts
- color
- hair color
- highlights
- balayage
- treatments
- scalp
- waxing
- facials
- spa
- massage
- extensions
- texture
- bridal
- special occasion
- add-ons

Critical rules:
- Extract every visible individual service row/item.
- Do not return representative examples only.
- Do not summarize a category if individual services are visible.
- Each visible service row should become a separate serviceCatalog.services item.
- Include add-ons either as separate services or variants.
- Preserve prices, "+", "starts at", "from", "consultation required", "not available online", and "call to book".
- If a page lists:
  - Blow-Dry Style $50+
  - Children's Cut $35+
  - Clipper Cut $45+
  then return 3 separate service items.
- Do not invent services.
- Return JSON only.
- Do not use markdown links.
- URLs must be plain strings only.
- sourceEvidence must always be string[].

Return exactly this shape:

{
  "serviceCatalog": {
    "confidence": 0,
    "categories": [],
    "services": []
  },
  "warnings": []
}

Before final JSON, internally check:
- Did you inspect every discovered service category page?
- Did you extract individual services from each category page?
- Did you include add-ons?
- Did you include consultation-only / call-to-book / not-online-booking notes?
- If multiple service pages were found but fewer than 15 services were extracted, add warning:
  "Possible low service coverage: multiple service pages found but only X services extracted."

Return JSON only.
`.trim();
}

function buildSelfFetchedServiceRetryPrompt(opts: { url: string; servicesCount: number; warnings: string[]; fetchedPages: FetchedServicePage[] }) {
  const pages = opts.fetchedPages
    .filter((page) => page.fetched && page.textLength > 500 && page.text)
    .map((page, index) => [
      `Fetched service page ${index + 1}`,
      `URL: ${page.url}`,
      `TITLE: ${page.title ?? ''}`,
      `TEXT_LENGTH: ${page.textLength}`,
      'TEXT:',
      page.text,
    ].join('\n'))
    .join('\n\n---\n\n');

  return `
You are RingBooker's service catalog extraction specialist.

Goal:
Extract a more complete service catalog from fetched service/menu/pricing pages.

Website:
${opts.url}

Previous extraction had low service coverage:
- It found only ${opts.servicesCount} services.
- Warnings: ${opts.warnings.join(' | ') || 'None'}

Use only the provided fetched service pages as source context.
Do not use outside knowledge.
Do not invent services, prices, durations, or policies.

Critical rules:
- Extract every visible individual service row/item from the fetched text.
- Do not return representative examples only.
- Do not summarize a category if individual services are visible.
- Each visible service row should become a separate serviceCatalog.services item.
- Include add-ons either as separate services or variants.
- Preserve prices, "+", "starts at", "from", "consultation required", "not available online", and "call to book".
- If a page lists:
  - Blow-Dry Style $50+
  - Children's Cut $35+
  - Clipper Cut $45+
  then return 3 separate service items.
- Do not use markdown links.
- URLs must be plain strings only.
- sourceEvidence must always be string[].
- For each service sourceEvidence, cite the fetched page URL and the visible service row text.

Return exactly this shape:

{
  "serviceCatalog": {
    "confidence": 0,
    "categories": [],
    "services": []
  },
  "warnings": []
}

Fetched service pages:

${pages}

Before final JSON, internally check:
- Did you extract individual services from each fetched service page?
- Did you include add-ons?
- Did you include consultation-only / call-to-book / not-online-booking notes?
- If fetched pages contain multiple service categories but fewer than 15 services were extracted, add warning:
  "Possible low service coverage: fetched service pages contain multiple categories but only X services extracted."

Return JSON only.
`.trim();
}

function normalizeKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeDedupeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cloneJsonObject<T extends JsonObject>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function numberConfidence(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = stringOrNull(value);
    if (!text) continue;
    const key = normalizeDedupeText(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function splitRole(value: unknown): string[] {
  const text = stringOrNull(value);
  return text ? text.split(/\s*(?:\/|,|\|)\s*/).filter(Boolean) : [];
}

function arrayStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function joinShort(values: string[], separator: string, maxLength: number): string | null {
  const unique = uniqueStrings(values);
  if (!unique.length) return null;
  const joined = unique.join(separator);
  return joined.length <= maxLength ? joined : `${joined.slice(0, maxLength - 1).trimEnd()}...`;
}

function longerString(a: unknown, b: unknown): string | null {
  const left = stringOrNull(a);
  const right = stringOrNull(b);
  if (!left) return right;
  if (!right) return left;
  return right.length > left.length ? right : left;
}

function mergeVariantArrays(values: unknown[]): JsonObject[] {
  const byKey = new Map<string, JsonObject>();
  for (const value of values) {
    const variants = Array.isArray(value) ? value : [];
    for (const variant of variants) {
      const object = asObject(variant);
      if (!object) continue;
      const key = [
        normalizeDedupeText(object.name),
        String(object.priceAmount ?? 'null'),
        normalizeKey(object.priceType),
      ].join('|');
      if (!byKey.has(key)) {
        byKey.set(key, cloneJsonObject(object as JsonObject));
        continue;
      }
      const existing = byKey.get(key);
      if (!existing) continue;
      existing.description = longerString(existing.description, object.description) as JsonValue;
      existing.bookingNotes = joinShort([stringOrNull(existing.bookingNotes), stringOrNull(object.bookingNotes)].filter((item): item is string => Boolean(item)), ' | ', 300) as JsonValue;
      existing.sourceEvidence = uniqueStrings([...arrayStrings(existing.sourceEvidence), ...arrayStrings(object.sourceEvidence)]) as JsonValue;
      existing.confidence = Math.max(numberConfidence(existing.confidence), numberConfidence(object.confidence));
    }
  }
  return [...byKey.values()];
}

function isGenericCategoryName(value: unknown): boolean {
  const key = normalizeDedupeText(value);
  return !key || /^(services?|hair services?|salon services?|beauty services?|menu|other|treatments?)$/.test(key);
}

function dedupeStaffSuggestions(staff: JsonObject[]): JsonObject[] {
  const groups = new Map<string, JsonObject[]>();
  const order: string[] = [];
  staff.forEach((item, index) => {
    const key = normalizeDedupeText(item.name) || `__staff_${index}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)?.push(item);
  });

  return order.map((key) => {
    const group = groups.get(key) ?? [];
    if (group.length <= 1) return cloneJsonObject(group[0] ?? {});
    const base = cloneJsonObject(group.reduce((best, item) => (
      numberConfidence(item.confidence) > numberConfidence(best.confidence) ? item : best
    ), group[0]));
    const roles = uniqueStrings(group.flatMap((item) => splitRole(item.role)));
    const specialties = uniqueStrings(group.flatMap((item) => arrayStrings(item.specialties)));
    const bestBio = group.reduce<string | null>((best, item) => longerString(best, item.bio), null);
    const bestSource = [...group]
      .sort((a, b) => numberConfidence(b.confidence) - numberConfidence(a.confidence))
      .map((item) => stringOrNull(item.sourceUrl))
      .find(Boolean) ?? null;
    const evidence = joinShort(group.map((item) => stringOrNull(item.evidenceSnippet)).filter((item): item is string => Boolean(item)), ' | ', 300);

    if (roles.length) base.role = roles.join(' / ') as JsonValue;
    base.specialties = specialties as JsonValue;
    if (bestBio) base.bio = bestBio as JsonValue;
    if (bestSource) base.sourceUrl = bestSource as JsonValue;
    if (evidence) base.evidenceSnippet = evidence as JsonValue;
    base.confidence = Math.max(...group.map((item) => numberConfidence(item.confidence)));
    return base;
  });
}

function serviceDedupeKey(service: JsonObject): string {
  return [
    normalizeDedupeText(service.name),
    String(service.priceAmount ?? 'null'),
    normalizeKey(service.priceType),
  ].join('|');
}

function dedupeServices(services: JsonObject[]): JsonObject[] {
  const groups = new Map<string, JsonObject[]>();
  const order: string[] = [];
  services.forEach((service, index) => {
    const key = serviceDedupeKey(service) || `__service_${index}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)?.push(service);
  });

  return order.map((key) => {
    const group = groups.get(key) ?? [];
    if (group.length <= 1) return cloneJsonObject(group[0] ?? {});
    const base = cloneJsonObject(group.reduce((best, item) => (
      numberConfidence(item.confidence) > numberConfidence(best.confidence) ? item : best
    ), group[0]));
    const bestDescription = group.reduce<string | null>((best, item) => longerString(best, item.description), null);
    const bookingNotes = joinShort(group.map((item) => stringOrNull(item.bookingNotes)).filter((item): item is string => Boolean(item)), ' | ', 300);
    const categoryCandidate = group.find((item) => !isGenericCategoryName(item.categoryName));

    base.aliases = uniqueStrings(group.flatMap((item) => arrayStrings(item.aliases))) as JsonValue;
    base.sourceEvidence = uniqueStrings(group.flatMap((item) => arrayStrings(item.sourceEvidence))) as JsonValue;
    base.variants = mergeVariantArrays(group.map((item) => item.variants)) as JsonValue;
    if (bestDescription) base.description = bestDescription as JsonValue;
    if (bookingNotes) base.bookingNotes = bookingNotes as JsonValue;
    if (isGenericCategoryName(base.categoryName) && categoryCandidate?.categoryName) base.categoryName = categoryCandidate.categoryName;
    base.confidence = Math.max(...group.map((item) => numberConfidence(item.confidence)));
    return base;
  });
}

function groupKindRank(value: unknown): number {
  const kind = normalizeKey(value);
  if (kind === 'primary') return 3;
  if (kind === 'addon') return 2;
  if (kind === 'custom') return 1;
  return 0;
}

function dedupeCategories(categories: JsonObject[]): JsonObject[] {
  const groups = new Map<string, JsonObject[]>();
  const order: string[] = [];
  categories.forEach((category, index) => {
    const key = normalizeDedupeText(category.name) || `__category_${index}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)?.push(category);
  });

  return order.map((key) => {
    const group = groups.get(key) ?? [];
    const base = cloneJsonObject(group[0] ?? {});
    base.confidence = Math.max(...group.map((item) => numberConfidence(item.confidence)));
    const bestKind = group.reduce((best, item) => (
      groupKindRank(item.groupKind) > groupKindRank(best.groupKind) ? item : best
    ), group[0]);
    base.groupKind = (bestKind?.groupKind ?? null) as JsonValue;
    return base;
  });
}

function broadServiceWarnings(services: JsonObject[]): string[] {
  const warnings: string[] = [];
  for (const service of services) {
    const name = stringOrNull(service.name);
    if (!name || !BROAD_SERVICE_NAME_RE.test(name)) continue;
    const sourceEvidence = arrayStrings(service.sourceEvidence);
    const sourceText = sourceEvidence.join(' ');
    const sourceTooBroad = sourceEvidence.length === 0 || !/https?:\/\//i.test(sourceText) || !/\$|\d+\s*(?:min|minutes|hr|hour)/i.test(sourceText);
    if ((service.priceAmount === null || service.priceAmount === undefined)
      && normalizeKey(service.priceType) === 'varies'
      && (numberConfidence(service.confidence) < 0.95 || sourceTooBroad)) {
      warnings.push(`Possible broad service item retained for review: ${name}`);
    }
  }
  return warnings;
}

function hasFrontDeskHoursEvidence(output: JsonObject): boolean {
  const hours = asObject(output.hours);
  const sourceEvidence = arrayStrings(hours?.sourceEvidence);
  if (sourceEvidence.some((item) => HOURS_FRONT_DESK_RE.test(item))) return true;
  let found = false;
  walkStrings(output, (value) => {
    if (HOURS_FRONT_DESK_RE.test(value)) found = true;
  });
  return found;
}

function normalizeWebsiteImportOutputWithReport(output: JsonObject): { output: JsonObject; normalization: NormalizationReport } {
  const normalized = cloneJsonObject(output);
  const staffBefore = getStaffSuggestions(normalized).length;
  const servicesBefore = getServices(normalized).length;
  const serviceCatalog = asObject(normalized.serviceCatalog);
  const categoriesBefore = Array.isArray(serviceCatalog?.categories)
    ? serviceCatalog.categories.filter((item) => Boolean(asObject(item))).length
    : 0;
  const warningsBefore = getWarnings(normalized);
  const warningKeysBefore = new Set(warningsBefore);

  if (Array.isArray(normalized.staffSuggestions)) {
    normalized.staffSuggestions = dedupeStaffSuggestions(normalized.staffSuggestions.filter((item): item is JsonObject => Boolean(asObject(item)))) as JsonValue;
  }

  if (serviceCatalog) {
    const services = Array.isArray(serviceCatalog.services)
      ? serviceCatalog.services.filter((item): item is JsonObject => Boolean(asObject(item)))
      : [];
    const categories = Array.isArray(serviceCatalog.categories)
      ? serviceCatalog.categories.filter((item): item is JsonObject => Boolean(asObject(item)))
      : [];
    serviceCatalog.services = dedupeServices(services) as JsonValue;
    serviceCatalog.categories = dedupeCategories(categories) as JsonValue;
  }

  const warningsToAppend = [
    ...broadServiceWarnings(getServices(normalized)),
    ...(hasFrontDeskHoursEvidence(normalized)
      ? ['Hours may refer to communication/front desk hours rather than full service appointment hours.']
      : []),
  ];
  normalized.warnings = uniqueStrings([...getWarnings(normalized), ...warningsToAppend]) as JsonValue;

  const staffAfter = getStaffSuggestions(normalized).length;
  const servicesAfter = getServices(normalized).length;
  const normalizedCatalog = asObject(normalized.serviceCatalog);
  const categoriesAfter = Array.isArray(normalizedCatalog?.categories)
    ? normalizedCatalog.categories.filter((item) => Boolean(asObject(item))).length
    : 0;
  const warningsAfter = getWarnings(normalized);
  const warningsAdded = warningsAfter.filter((warning) => !warningKeysBefore.has(warning)).length;

  return {
    output: normalized,
    normalization: {
      staffBefore,
      staffAfter,
      servicesBefore,
      servicesAfter,
      categoriesBefore,
      categoriesAfter,
      staffDuplicatesRemoved: Math.max(0, staffBefore - staffAfter),
      serviceDuplicatesRemoved: Math.max(0, servicesBefore - servicesAfter),
      categoryDuplicatesRemoved: Math.max(0, categoriesBefore - categoriesAfter),
      warningsAdded,
    },
  };
}

function normalizeWebsiteImportOutput(output: JsonObject): JsonObject {
  return normalizeWebsiteImportOutputWithReport(output).output;
}

function combineNormalizationReports(reports: NormalizationReport[]): NormalizationReport {
  if (!reports.length) {
    return {
      staffBefore: 0,
      staffAfter: 0,
      servicesBefore: 0,
      servicesAfter: 0,
      categoriesBefore: 0,
      categoriesAfter: 0,
      staffDuplicatesRemoved: 0,
      serviceDuplicatesRemoved: 0,
      categoryDuplicatesRemoved: 0,
      warningsAdded: 0,
    };
  }
  const first = reports[0];
  const last = reports[reports.length - 1];
  return {
    staffBefore: first.staffBefore,
    staffAfter: last.staffAfter,
    servicesBefore: first.servicesBefore,
    servicesAfter: last.servicesAfter,
    categoriesBefore: first.categoriesBefore,
    categoriesAfter: last.categoriesAfter,
    staffDuplicatesRemoved: reports.reduce((sum, report) => sum + report.staffDuplicatesRemoved, 0),
    serviceDuplicatesRemoved: reports.reduce((sum, report) => sum + report.serviceDuplicatesRemoved, 0),
    categoryDuplicatesRemoved: reports.reduce((sum, report) => sum + report.categoryDuplicatesRemoved, 0),
    warningsAdded: reports.reduce((sum, report) => sum + report.warningsAdded, 0),
  };
}

function serviceKey(service: JsonObject): string {
  return [
    normalizeKey(service.categoryName),
    normalizeKey(service.name),
    String(service.priceAmount ?? 'null'),
    normalizeKey(service.priceType),
  ].join('|');
}

function mergeServiceCatalog(fullOutput: JsonObject, retryOutput: JsonObject): { output: JsonObject; improved: boolean; before: number; after: number } {
  const fullServices = getServices(fullOutput);
  const retryCatalog = asObject(retryOutput.serviceCatalog);
  const retryServicesRaw = retryCatalog?.services;
  const retryServices = Array.isArray(retryServicesRaw) ? retryServicesRaw.filter((item): item is JsonObject => Boolean(asObject(item))) : [];
  const merged = JSON.parse(JSON.stringify(fullOutput)) as JsonObject;
  const existingWarnings = getWarnings(merged);
  const retryWarnings = getWarnings(retryOutput).map((warning) => `Service retry: ${warning}`);
  merged.warnings = [...existingWarnings, ...retryWarnings] as JsonValue;

  if (retryServices.length > fullServices.length && retryCatalog) {
    merged.serviceCatalog = JSON.parse(JSON.stringify(retryCatalog)) as JsonValue;
    return { output: merged, improved: true, before: fullServices.length, after: retryServices.length };
  }

  const currentCatalog = asObject(merged.serviceCatalog);
  if (currentCatalog) {
    const currentServices = Array.isArray(currentCatalog.services) ? currentCatalog.services.filter((item): item is JsonObject => Boolean(asObject(item))) : [];
    const seen = new Set(currentServices.map(serviceKey));
    const additions = retryServices.filter((service) => {
      const key = serviceKey(service);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (additions.length > 0) {
      currentCatalog.services = [...currentServices, ...additions] as JsonValue;
      const currentCategories = Array.isArray(currentCatalog.categories) ? currentCatalog.categories.filter((item): item is JsonObject => Boolean(asObject(item))) : [];
      const retryCategories = Array.isArray(retryCatalog?.categories) ? retryCatalog.categories.filter((item): item is JsonObject => Boolean(asObject(item))) : [];
      const categoryNames = new Set(currentCategories.map((category) => normalizeKey(category.name)));
      const categoryAdditions = retryCategories.filter((category) => {
        const key = normalizeKey(category.name);
        if (!key || categoryNames.has(key)) return false;
        categoryNames.add(key);
        return true;
      });
      currentCatalog.categories = [...currentCategories, ...categoryAdditions] as JsonValue;
      return { output: merged, improved: true, before: fullServices.length, after: currentServices.length + additions.length };
    }
  }

  return { output: merged, improved: false, before: fullServices.length, after: fullServices.length };
}

function collectOutputText(value: unknown): string | null {
  const root = asObject(value);
  if (typeof root?.output_text === 'string') return root.output_text;
  const output = Array.isArray(root?.output) ? root.output : [];
  const parts: string[] = [];
  for (const item of output) {
    const object = asObject(item);
    const content = Array.isArray(object?.content) ? object.content : [];
    for (const contentItem of content) {
      const contentObject = asObject(contentItem);
      if (typeof contentObject?.text === 'string') parts.push(contentObject.text);
    }
  }
  return parts.join('\n').trim() || null;
}

function collectSources(value: unknown): WebSource[] {
  const sources = new Map<string, WebSource>();
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const object = asObject(node);
    if (!object) return;
    const rawUrl = object.url ?? object.uri;
    if (typeof rawUrl === 'string' && /^https?:\/\//i.test(rawUrl)) {
      sources.set(rawUrl, {
        url: rawUrl,
        title: typeof object.title === 'string' ? object.title : null,
      });
    }
    for (const child of Object.values(object)) visit(child);
  };
  visit(value);
  return [...sources.values()];
}

function countWebSearchCalls(value: unknown): { count: number | null; note?: string } {
  let count = 0;
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const object = asObject(node);
    if (!object) return;
    const type = typeof object.type === 'string' ? object.type : '';
    const name = typeof object.name === 'string' ? object.name : '';
    if (/web_search/i.test(`${type} ${name}`)) count += 1;
    for (const child of Object.values(object)) visit(child);
  };
  visit(value);
  return count > 0 ? { count } : { count: null, note: 'No web_search output item was found in the response body shape.' };
}

function usageFrom(value: unknown): OpenAiUsage | null {
  const usage = asObject(value);
  return usage ? usage as OpenAiUsage : null;
}

function combineUsage(usages: Array<OpenAiUsage | null>): OpenAiUsage | null {
  const present = usages.filter((usage): usage is OpenAiUsage => Boolean(usage));
  if (!present.length) return null;
  return present.reduce<OpenAiUsage>((acc, usage) => ({
    input_tokens: (acc.input_tokens ?? 0) + (usage.input_tokens ?? 0),
    input_tokens_details: {
      cached_tokens: (acc.input_tokens_details?.cached_tokens ?? 0) + (usage.input_tokens_details?.cached_tokens ?? 0),
    },
    output_tokens: (acc.output_tokens ?? 0) + (usage.output_tokens ?? 0),
    output_tokens_details: {
      reasoning_tokens: (acc.output_tokens_details?.reasoning_tokens ?? 0) + (usage.output_tokens_details?.reasoning_tokens ?? 0),
    },
    total_tokens: (acc.total_tokens ?? 0) + (usage.total_tokens ?? 0),
  }), {});
}

function estimateTokenCost(usage: OpenAiUsage | null, model: string): number | null {
  if (!usage) return null;
  const defaultInput = /mini/i.test(model) ? 0.75 : 1.25;
  const defaultCached = /mini/i.test(model) ? 0.075 : 0.125;
  const defaultOutput = /mini/i.test(model) ? 4.5 : 10;
  const inputRate = Number(process.env.WEBSITE_IMPORT_TOKEN_INPUT_RATE ?? defaultInput);
  const cachedRate = Number(process.env.WEBSITE_IMPORT_TOKEN_CACHED_INPUT_RATE ?? defaultCached);
  const outputRate = Number(process.env.WEBSITE_IMPORT_TOKEN_OUTPUT_RATE ?? defaultOutput);
  const input = usage.input_tokens ?? 0;
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  return ((input - cached) / 1_000_000 * inputRate) + (cached / 1_000_000 * cachedRate) + (output / 1_000_000 * outputRate);
}

function combineNullableCounts(values: Array<number | null>): number | null {
  if (values.some((value) => value === null)) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

async function callOpenAiJson(opts: {
  url: string;
  schema: JsonObject;
  model: string;
  prompt: string;
  schemaName: string;
  systemPrompt: string;
  useWebSearch?: boolean;
}): Promise<OpenAiJsonResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is required');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.WEBSITE_IMPORT_CONTRACT_OPENAI_TIMEOUT_MS ?? 120_000));
  const useWebSearch = opts.useWebSearch !== false;
  const requestBody: JsonObject = {
    model: opts.model,
    reasoning: { effort: process.env.WEBSITE_IMPORT_CONTRACT_REASONING_EFFORT?.trim() || 'low' } as JsonValue,
    max_output_tokens: Number(process.env.WEBSITE_IMPORT_CONTRACT_MAX_TOKENS ?? 20_000),
    input: [
      {
        role: 'system',
        content: opts.systemPrompt,
      },
      { role: 'user', content: opts.prompt },
    ] as JsonValue,
    text: {
      format: {
        type: 'json_schema',
        name: opts.schemaName,
        strict: true,
        schema: schemaForOpenAiStrict(opts.schema),
      },
    } as JsonValue,
  };
  if (useWebSearch) {
    requestBody.tools = [{
      type: 'web_search',
      search_context_size: process.env.WEBSITE_IMPORT_CONTRACT_SEARCH_CONTEXT_SIZE?.trim() || 'high',
      filters: { allowed_domains: [domainForUrl(opts.url)] },
    }] as JsonValue;
    requestBody.tool_choice = 'required';
    requestBody.include = ['web_search_call.action.sources'] as JsonValue;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        ...(process.env.OPENAI_ORGANIZATION?.trim() ? { 'OpenAI-Organization': process.env.OPENAI_ORGANIZATION.trim() } : {}),
        ...(process.env.OPENAI_PROJECT?.trim() ? { 'OpenAI-Project': process.env.OPENAI_PROJECT.trim() } : {}),
      },
      body: JSON.stringify(requestBody),
    });
    const rawBody = await response.text();
    if (!response.ok) throw new Error(`openai_http_${response.status}:${rawBody.slice(0, 1600)}`);
    const body = JSON.parse(rawBody) as JsonObject;
    const content = collectOutputText(body);
    if (!content) throw new Error(`openai_missing_output_text:${rawBody.slice(0, 1600)}`);
    const webSearchCount = countWebSearchCalls(body);
    return {
      content,
      json: JSON.parse(content) as JsonObject,
      sources: collectSources(body),
      usage: usageFrom(body.usage),
      model: opts.model,
      webSearchCallCount: useWebSearch ? webSearchCount.count : 0,
      webSearchCountNote: useWebSearch ? webSearchCount.note : 'web_search disabled; self-fetched service context was provided.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAiWebsiteImport(opts: { url: string; schema: JsonObject; template: JsonObject }) {
  const model = process.env.WEBSITE_IMPORT_CONTRACT_MODEL?.trim() || 'gpt-4.1-mini';
  return callOpenAiJson({
    url: opts.url,
    schema: opts.schema,
    model,
    prompt: buildPrompt(opts.url, opts.template),
    schemaName: 'ringbooker_website_import_extraction',
    systemPrompt: 'You extract RingBooker salon/spa website import data. Use web search to read the target website, return JSON only, match the schema exactly, use no markdown links, and never invent missing facts.',
  });
}

async function callOpenAiServiceRetry(opts: { url: string; schema: JsonObject; model: string; prompt: string; useWebSearch?: boolean }) {
  return callOpenAiJson({
    url: opts.url,
    schema: opts.schema,
    model: opts.model,
    prompt: opts.prompt,
    schemaName: 'ringbooker_service_catalog_retry',
    systemPrompt: opts.useWebSearch === false
      ? 'You extract only RingBooker service catalog data from provided fetched page text. Return JSON only, match the schema exactly, use no markdown links, and never invent missing services or prices.'
      : 'You extract only RingBooker service catalog data. Use web search to inspect all service/menu/pricing pages, return JSON only, match the schema exactly, use no markdown links, and never invent missing services or prices.',
    useWebSearch: opts.useWebSearch,
  });
}

async function run() {
  loadLocalEnv();
  const schemaPath = process.env.WEBSITE_IMPORT_CONTRACT_SCHEMA_PATH || DEFAULT_SCHEMA_PATH;
  const templatePath = process.env.WEBSITE_IMPORT_CONTRACT_TEMPLATE_PATH || DEFAULT_TEMPLATE_PATH;
  const urls = process.argv.slice(2).filter(Boolean);
  const testUrls = urls.length ? urls : DEFAULT_URLS;
  const [schema, template] = await Promise.all([readJsonFile(schemaPath), readJsonFile(templatePath)]);
  const serviceRetrySchema = serviceRetrySchemaFromFullSchema(schema);
  const outputResults: Array<{ url: string; ok: boolean; extraction: JsonObject | null }> = [];
  const debugResults: Array<Record<string, unknown>> = [];

  for (const url of testUrls) {
    try {
      console.error(`[contract] asking OpenAI to read ${url}`);
      const generated = await callOpenAiWebsiteImport({ url, schema, template });
      const normalizationReports: NormalizationReport[] = [];
      const initialNormalization = normalizeWebsiteImportOutputWithReport(generated.json);
      normalizationReports.push(initialNormalization.normalization);
      let finalOutput = initialNormalization.output;
      let mergedSources = generated.sources;
      let serviceRetryResult: OpenAiJsonResult | null = null;
      let serviceRetryTriggered = false;
      let serviceRetryImproved = false;
      let serviceRetryMode: ServiceFetchResult['mode'] = 'none';
      let serviceCandidateUrls: string[] = [];
      let fetchedServicePages: FetchedServicePage[] = [];
      const initialSchemaErrors = validateJsonSchema(finalOutput, schema, schema);
      const initialQuality = validateQuality(finalOutput, generated.sources);
      const serviceRetryReasons = initialSchemaErrors.length === 0
        ? detectLowServiceCoverage(finalOutput, generated.sources).reasons
        : [];
      const serviceRetryServicesBefore = getServices(finalOutput).length;
      let serviceRetryServicesAfter = serviceRetryServicesBefore;
      const serviceRetryModel = process.env.WEBSITE_IMPORT_CONTRACT_SERVICE_RETRY_MODEL?.trim()
        || process.env.WEBSITE_IMPORT_CONTRACT_MODEL?.trim()
        || 'gpt-4.1-mini';
      const difficultFallbackModel = process.env.WEBSITE_IMPORT_CONTRACT_DIFFICULT_FALLBACK_MODEL?.trim()
        || 'gpt-5.4-mini';

      if (initialSchemaErrors.length === 0 && serviceRetryReasons.length > 0) {
        serviceRetryTriggered = true;
        console.error(`[contract] ${url}: service retry triggered (${serviceRetryReasons.join('; ')})`);
        const selfFetch = await fetchServicePagesForRetry({ websiteUrl: url, output: finalOutput, sources: generated.sources });
        serviceRetryMode = selfFetch.mode;
        serviceCandidateUrls = selfFetch.candidateUrls;
        fetchedServicePages = selfFetch.fetchedPages;
        console.error(`[contract] ${url}: service retry mode ${serviceRetryMode}; fetched ${fetchedServicePages.filter((page) => page.fetched).length}/${serviceCandidateUrls.length} candidate page(s)`);
        const usefulFetchedPages = fetchedServicePages.filter((page) => page.fetched && page.textLength > 500);
        const retryPrompt = serviceRetryMode === 'self_fetch'
          ? buildSelfFetchedServiceRetryPrompt({
            url,
            servicesCount: serviceRetryServicesBefore,
            warnings: getWarnings(finalOutput),
            fetchedPages: usefulFetchedPages,
          })
          : buildServiceRetryPrompt({
            url,
            servicesCount: serviceRetryServicesBefore,
            warnings: getWarnings(finalOutput),
            knownServiceUrls: serviceRelatedUrls(finalOutput, generated.sources),
          });
        serviceRetryResult = await callOpenAiServiceRetry({
          url,
          schema: serviceRetrySchema,
          model: serviceRetryModel,
          prompt: retryPrompt,
          useWebSearch: serviceRetryMode !== 'self_fetch',
        });
        const retrySchemaErrors = validateJsonSchema(serviceRetryResult.json, serviceRetrySchema, serviceRetrySchema);
        if (retrySchemaErrors.length === 0) {
          const merged = mergeServiceCatalog(finalOutput, serviceRetryResult.json);
          const retryNormalization = normalizeWebsiteImportOutputWithReport(merged.output);
          normalizationReports.push(retryNormalization.normalization);
          finalOutput = retryNormalization.output;
          serviceRetryImproved = merged.improved;
          serviceRetryServicesAfter = getServices(finalOutput).length;
          mergedSources = [
            ...generated.sources,
            ...serviceRetryResult.sources,
            ...usefulFetchedPages.map((page) => ({ url: page.url, title: page.title })),
          ];
          if (!serviceRetryImproved && difficultFallbackModel && difficultFallbackModel !== serviceRetryModel) {
            console.error(`[contract] ${url}: service retry did not improve; trying difficult fallback ${difficultFallbackModel}`);
            const hardRetryResult = await callOpenAiServiceRetry({
              url,
              schema: serviceRetrySchema,
              model: difficultFallbackModel,
              prompt: retryPrompt,
              useWebSearch: serviceRetryMode !== 'self_fetch',
            });
            const hardRetrySchemaErrors = validateJsonSchema(hardRetryResult.json, serviceRetrySchema, serviceRetrySchema);
            if (hardRetrySchemaErrors.length === 0) {
              const hardMerged = mergeServiceCatalog(finalOutput, hardRetryResult.json);
              const hardRetryNormalization = normalizeWebsiteImportOutputWithReport(hardMerged.output);
              normalizationReports.push(hardRetryNormalization.normalization);
              if (hardMerged.improved) {
                finalOutput = hardRetryNormalization.output;
                serviceRetryResult = hardRetryResult;
                serviceRetryImproved = true;
                serviceRetryServicesAfter = getServices(finalOutput).length;
                mergedSources = [
                  ...mergedSources,
                  ...hardRetryResult.sources,
                ];
              }
            }
          }
        } else {
          const retryErrorOutput = {
            ...finalOutput,
            warnings: [...getWarnings(finalOutput), ...retrySchemaErrors.map((error) => `Service retry validation failed: ${error}`)],
          } as JsonObject;
          const retryErrorNormalization = normalizeWebsiteImportOutputWithReport(retryErrorOutput);
          normalizationReports.push(retryErrorNormalization.normalization);
          finalOutput = retryErrorNormalization.output;
        }
      }
      finalOutput = normalizeWebsiteImportOutput(finalOutput);
      const normalization = combineNormalizationReports(normalizationReports);

      const schemaErrors = validateJsonSchema(finalOutput, schema, schema);
      const quality = validateQuality(finalOutput, mergedSources);
      const qualityErrors = quality.qualityErrors;
      const qualityWarnings = quality.qualityWarnings;
      const errors = [...schemaErrors, ...qualityErrors];
      const ok = errors.length === 0;
      const servicesCount = getServices(finalOutput).length;
      const serviceCatalog = asObject(finalOutput.serviceCatalog);
      const categories = Array.isArray(serviceCatalog?.categories) ? serviceCatalog.categories : [];
      const policies = getPolicySuggestions(finalOutput);
      const staff = getStaffSuggestions(finalOutput);
      const bookingUrl = getPath(finalOutput, ['bookingUrl', 'value']);
      const webSearchCallCount = combineNullableCounts([generated.webSearchCallCount, serviceRetryResult?.webSearchCallCount ?? 0]);
      const webSearchUnitCost = Number(process.env.WEBSITE_IMPORT_WEB_SEARCH_UNIT_COST ?? 0.01);
      const estimatedWebSearchCost = webSearchCallCount == null ? null : webSearchCallCount * webSearchUnitCost;
      const usage = combineUsage([generated.usage, serviceRetryResult?.usage ?? null]);
      const estimatedTokenCost = (estimateTokenCost(generated.usage, generated.model) ?? 0)
        + (serviceRetryResult ? (estimateTokenCost(serviceRetryResult.usage, serviceRetryResult.model) ?? 0) : 0);
      const estimatedTotalCost = estimatedWebSearchCost == null ? null : estimatedTokenCost + estimatedWebSearchCost;

      outputResults.push({ url, ok, extraction: finalOutput });
      debugResults.push({
        websiteUrl: url,
        url,
        ok,
        model: generated.model,
        serviceRetryModel,
        difficultFallbackModel,
        serviceRetryTriggered,
        serviceRetryMode,
        serviceRetryReasons,
        serviceRetryServicesBefore,
        serviceRetryServicesAfter,
        serviceRetryImproved,
        serviceCandidateUrls,
        fetchedServicePages: fetchedServicePages.map(({ text: _text, ...page }) => page),
        validationPassed: ok,
        usage,
        fullUsage: generated.usage,
        serviceRetryUsage: serviceRetryResult?.usage ?? null,
        estimatedTokenCost,
        webSearchCallCount,
        webSearchCountNote: generated.webSearchCountNote ?? serviceRetryResult?.webSearchCountNote ?? null,
        estimatedWebSearchCost,
        estimatedTotalCost,
        schemaPath,
        templatePath,
        sourceCount: mergedSources.length,
        sources: mergedSources,
        signals: sourceSignals(mergedSources),
        initialSchemaErrors,
        initialQualityErrors: initialQuality.qualityErrors,
        initialQualityWarnings: initialQuality.qualityWarnings,
        normalization,
        schemaErrors,
        qualityErrors,
        qualityWarnings,
        servicesCount,
        categoriesCount: categories.length,
        staffCount: staff.length,
        policiesCount: policies.length,
        bookingUrl,
        warnings: getWarnings(finalOutput),
        serviceRetrySchemaErrors: serviceRetryResult ? validateJsonSchema(serviceRetryResult.json, serviceRetrySchema, serviceRetrySchema) : [],
        serviceRetryRawServicesCount: serviceRetryResult ? getServices(serviceRetryResult.json).length : null,
        serviceRetrySources: serviceRetryResult?.sources ?? [],
        serviceRetryWebSearchCallCount: serviceRetryResult?.webSearchCallCount ?? null,
        rawContentChars: generated.content.length,
        serviceRetryRawContentChars: serviceRetryResult?.content.length ?? null,
      });
      console.error(`[contract] ${url}: ${ok ? 'passed' : 'failed'}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outputResults.push({ url, ok: false, extraction: null });
      debugResults.push({ url, ok: false, schemaPath, templatePath, error: message });
      console.error(`[contract] ${url}: failed - ${message}`);
    }
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await Promise.all([
    writeFile(OUTPUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), results: outputResults }, null, 2)),
    writeFile(DEBUG_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), results: debugResults }, null, 2)),
  ]);

  const failed = debugResults.filter((result) => !result.ok);
  console.log(JSON.stringify({
    ok: failed.length === 0,
    outputPath: OUTPUT_PATH,
    debugPath: DEBUG_PATH,
    tested: testUrls,
    failed: failed.map((result) => ({
      url: result.url,
      error: result.error,
      schemaErrors: result.schemaErrors,
      qualityErrors: result.qualityErrors,
      qualityWarnings: result.qualityWarnings,
    })),
  }, null, 2));
  if (failed.length) process.exit(1);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
