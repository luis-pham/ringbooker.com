import {
  matchServiceFromCallerText,
  normalizeServiceText,
} from '@/src/backend/domain/service-catalog';
import type { Shop } from '@/src/backend/domain/types';

export type BookingDraftIntent = 'unknown' | 'book_appointment';
export type BookingDraftIntentSource = 'transcript' | 'tool_call' | null;

export type BookingDraftConfidence = {
  intent?: number;
  service?: number;
  date?: number;
  time?: number;
  phone?: number;
  callerName?: number;
};

export type BookingDraft = {
  intent: BookingDraftIntent;
  intentSource: BookingDraftIntentSource;
  serviceCandidates: string[];
  dateCandidates: string[];
  timeCandidates: string[];
  phoneDigits: string[];
  callerNameCandidates: string[];
  rawTranscriptEvidence: string[];
  confidence: BookingDraftConfidence;
  missingFields: string[];
  lastUpdatedAt: string;
  phoneCaptureActive: boolean;
  phoneConfirmed: boolean;
  callerRequestedNewPhone: boolean;
};

export type BookingDraftUpdateOptions = {
  now?: Date;
  shop?: Pick<Shop, 'service_catalog' | 'services' | 'vertical'>;
  callerPhone?: string | null;
};

export type BookingDraftReasonCode =
  | 'booking_intent_detected'
  | 'service_candidate_accumulated'
  | 'date_candidate_accumulated'
  | 'time_candidate_accumulated'
  | 'time_candidate_low_confidence'
  | 'phone_digits_accumulated'
  | 'phone_incomplete'
  | 'phone_complete'
  | 'caller_name_candidate_accumulated';

const MAX_CANDIDATES = 8;
const MAX_TRANSCRIPT_EVIDENCE = 12;
const MAX_PHONE_DIGITS = 15;

const STRICT_DIGIT_WORDS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

const PHONE_MODE_DIGIT_WORDS: Record<string, string> = {
  ...STRICT_DIGIT_WORDS,
  oh: '0',
  o: '0',
};

const HOMOPHONE_DIGIT_WORDS: Record<string, string> = {
  for: '4',
  ate: '8',
};

const TIME_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const BOOKING_INTENT_RE =
  /\b(?:book|booking|appointment|appoint(?:ment)?|schedule|scheduled|reserve|reservation|get\s+(?:me\s+)?in|come\s+in|make\s+(?:an\s+)?appointment)\b/i;
const NON_BOOKING_INTENT_RE = /\b(?:cancel|cancellation|reschedule|move\s+my\s+appointment|change\s+my\s+appointment)\b/i;
const PHONE_CUE_RE = /\b(?:phone|number|cell|mobile|reach\s+me|call\s+me|text\s+me|contact)\b/i;
const NEW_PHONE_REQUEST_RE =
  /\b(?:my|new|different|another|best|preferred|use\s+(?:this|that)|reach\s+me|call\s+me|text\s+me|contact\s+me)\b.{0,40}\b(?:phone|number|cell|mobile)\b|\b(?:phone|number|cell|mobile)\b.{0,40}\b(?:is|new|different|another|best|preferred|instead|use\s+(?:this|that)|reach\s+me|call\s+me|text\s+me)\b/i;

const FALLBACK_SERVICE_RE =
  /\b(?:color|colour|hair\s*color|haircut|hair\s*cut|blowout|manicure|pedicure|mani|pedi|massage|facial|wax(?:ing)?|lash(?:es)?|brow(?:s)?|botox|filler|consultation|cleaning)\b/i;

function uniquePush(values: string[], value: string): string[] {
  const normalized = value.trim();
  if (!normalized) return values;
  if (values.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) {
    return values;
  }
  return [...values, normalized].slice(-MAX_CANDIDATES);
}

function setMaxConfidence(confidence: BookingDraftConfidence, key: keyof BookingDraftConfidence, value: number): BookingDraftConfidence {
  return {
    ...confidence,
    [key]: Math.max(confidence[key] ?? 0, value),
  };
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function hasUsableCallerPhone(callerPhone: string | null | undefined): boolean {
  const trimmed = callerPhone?.trim();
  if (!trimmed) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 8;
}

function tokenizeWords(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function hasPhoneCue(text: string): boolean {
  return PHONE_CUE_RE.test(text);
}

function callerRequestedNewPhone(text: string): boolean {
  return NEW_PHONE_REQUEST_RE.test(text);
}

function textFromPhoneCue(text: string): string {
  const match = PHONE_CUE_RE.exec(text);
  if (!match || match.index === undefined) return text;
  return text.slice(match.index);
}

function isStrictDigitToken(token: string): boolean {
  return /^\d+$/.test(token) || token in STRICT_DIGIT_WORDS;
}

function digitForToken(token: string, phoneMode: boolean, previousStrict: boolean, nextStrict: boolean): string | null {
  if (/^\d+$/.test(token)) return token;
  const strict = STRICT_DIGIT_WORDS[token];
  if (strict) return strict;
  if (!phoneMode) return null;
  const phoneModeDigit = PHONE_MODE_DIGIT_WORDS[token];
  if (phoneModeDigit) return phoneModeDigit;
  const homophone = HOMOPHONE_DIGIT_WORDS[token];
  if (homophone && (previousStrict || nextStrict)) return homophone;
  return null;
}

export function normalizeSpokenDigits(text: string, options?: { phoneMode?: boolean }): string[] {
  const phoneMode = options?.phoneMode ?? hasPhoneCue(text);
  const tokens = tokenizeWords(text);
  const digits: string[] = [];
  let run: string[] = [];

  const flush = () => {
    if (run.length >= 2 || (phoneMode && run.length > 0)) {
      digits.push(...run.join('').split('').filter((digit) => /\d/.test(digit)));
    }
    run = [];
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const previousStrict = i > 0 && isStrictDigitToken(tokens[i - 1]);
    const nextStrict = i + 1 < tokens.length && isStrictDigitToken(tokens[i + 1]);
    const digit = digitForToken(token, phoneMode, previousStrict, nextStrict);
    if (digit) {
      run.push(...digit.split(''));
    } else {
      flush();
    }
  }
  flush();

  return digits;
}

function appendDigitsWithOverlap(existing: string[], incoming: string[]): string[] {
  if (incoming.length === 0) return existing;
  if (existing.length === 0) return incoming.slice(0, MAX_PHONE_DIGITS);

  const existingText = existing.join('');
  const incomingText = incoming.join('');
  if (existingText.includes(incomingText)) return existing;

  let overlap = 0;
  const maxOverlap = Math.min(existingText.length, incomingText.length);
  for (let size = 1; size <= maxOverlap; size += 1) {
    if (existingText.endsWith(incomingText.slice(0, size))) {
      overlap = size;
    }
  }

  return [...existing, ...incoming.slice(overlap)].slice(0, MAX_PHONE_DIGITS);
}

function phoneConfidence(phoneDigitCount: number): number | undefined {
  if (phoneDigitCount >= 10) return 0.85;
  if (phoneDigitCount >= 7) return 0.55;
  if (phoneDigitCount > 0) return 0.35;
  return undefined;
}

function extractDateCandidates(text: string): string[] {
  const lower = text.toLowerCase();
  const candidates: string[] = [];

  for (const phrase of ['day after tomorrow', 'tomorrow', 'today']) {
    if (new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`).test(lower)) {
      candidates.push(phrase);
    }
  }

  const weekdayMatches = lower.match(/\b(?:next\s+|this\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g) ?? [];
  candidates.push(...weekdayMatches.map(normalizeWhitespace));

  const monthMatches =
    lower.match(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/g) ?? [];
  candidates.push(...monthMatches.map(normalizeWhitespace));

  return candidates;
}

function normalizeHour(hour: number, meridiem: 'AM' | 'PM'): string {
  const normalizedHour = hour === 0 ? 12 : hour;
  return `${normalizedHour} ${meridiem}`;
}

function extractTimeCandidates(text: string, context: { hasBookingIntent: boolean; hasDateCandidate: boolean }): Array<{ value: string; confidence: number }> {
  const lower = text.toLowerCase();
  const candidates: Array<{ value: string; confidence: number }> = [];

  if (/\bnoon\b/.test(lower)) candidates.push({ value: '12 PM', confidence: 0.8 });
  if (/\bmidnight\b/.test(lower)) candidates.push({ value: '12 AM', confidence: 0.8 });

  const numericTimeRe = /\b(\d{1,2})(?::([0-5]\d))?\s*(?:o'clock\s+)?(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)\b/gi;
  for (const match of lower.matchAll(numericTimeRe)) {
    const hour = Number.parseInt(match[1], 10);
    if (hour < 1 || hour > 12) continue;
    const meridiem = match[3].startsWith('p') ? 'PM' : 'AM';
    const minute = match[2];
    candidates.push({
      value: minute ? `${hour}:${minute} ${meridiem}` : normalizeHour(hour, meridiem),
      confidence: 0.8,
    });
  }

  const wordNumbers = Object.keys(TIME_WORDS).join('|');
  const wordTimeRe = new RegExp(`\\b(${wordNumbers})\\s*(?:o'clock\\s+)?(a\\.?\\s*m\\.?|p\\.?\\s*m\\.?|am|pm|ay\\s*em|pee\\s*em|ayam)\\b`, 'gi');
  for (const match of lower.matchAll(wordTimeRe)) {
    const hour = TIME_WORDS[match[1]];
    const marker = match[2].replace(/\s+/g, '');
    const meridiem = marker.startsWith('p') || marker.startsWith('pee') ? 'PM' : 'AM';
    candidates.push({ value: normalizeHour(hour, meridiem), confidence: 0.78 });
  }

  if (/\b(?:nae|nay)\s*(?:a\.?\s*m\.?|am|ay\s*em|ayam)\b/i.test(lower)) {
    candidates.push({ value: '9 AM', confidence: 0.5 });
  }

  if (context.hasBookingIntent && context.hasDateCandidate && /\bnow\s+i\s+am\b/i.test(lower)) {
    candidates.push({ value: '9 AM', confidence: 0.45 });
  }

  return candidates;
}

function extractCallerNameCandidate(text: string): string | null {
  const match = /\b(?:my name is|this is|it's|it is)\s+([a-z][a-z'-]{1,24})(?:\s+([a-z][a-z'-]{1,24}))?/i.exec(text);
  if (!match) return null;
  const name = [match[1], match[2]].filter(Boolean).join(' ');
  if (/^(calling|about|for|to|uh|um|yeah|yes|maybe)$/i.test(name)) return null;
  return name
    .split(/\s+/)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function extractServiceCandidate(
  text: string,
  shop?: Pick<Shop, 'service_catalog' | 'services' | 'vertical'>,
): { value: string; confidence: number } | null {
  if (shop?.service_catalog?.services.length) {
    const match = matchServiceFromCallerText({
      shopServiceCatalog: shop.service_catalog,
      callerText: text,
      vertical: shop.vertical ?? null,
    });
    if (!match.requiresClarification && match.matchedName && match.confidence >= 0.6) {
      return { value: match.matchedName, confidence: Math.min(0.9, Math.max(0.65, match.confidence)) };
    }
  }

  const normalizedText = normalizeServiceText(text);
  const service = shop?.services?.find((item) => {
    const normalizedService = normalizeServiceText(item.name);
    return normalizedService.length > 0 && normalizedText.includes(normalizedService);
  });
  if (service) return { value: service.name, confidence: 0.74 };

  const fallback = FALLBACK_SERVICE_RE.exec(text);
  if (fallback) return { value: normalizeWhitespace(fallback[0].toLowerCase()), confidence: 0.62 };

  return null;
}

function missingFieldsFor(
  draft: Pick<BookingDraft, 'intent' | 'serviceCandidates' | 'dateCandidates' | 'timeCandidates' | 'phoneDigits' | 'callerNameCandidates' | 'confidence'>,
  options?: Pick<BookingDraftUpdateOptions, 'callerPhone'>,
): string[] {
  if (draft.intent !== 'book_appointment') return [];

  const missing: string[] = [];
  if (draft.serviceCandidates.length === 0 || (draft.confidence.service ?? 0) < 0.55) missing.push('service');
  if (draft.dateCandidates.length === 0 || (draft.confidence.date ?? 0) < 0.55) missing.push('date');
  if (draft.timeCandidates.length === 0 || (draft.confidence.time ?? 0) < 0.55) missing.push('time');
  if (!hasUsableCallerPhone(options?.callerPhone) && (draft.phoneDigits.length < 10 || (draft.confidence.phone ?? 0) < 0.8)) {
    missing.push('phone');
  }
  if (draft.callerNameCandidates.length === 0 || (draft.confidence.callerName ?? 0) < 0.55) missing.push('callerName');
  return missing;
}

export function createBookingDraft(now: Date = new Date()): BookingDraft {
  return {
    intent: 'unknown',
    intentSource: null,
    serviceCandidates: [],
    dateCandidates: [],
    timeCandidates: [],
    phoneDigits: [],
    callerNameCandidates: [],
    rawTranscriptEvidence: [],
    confidence: {},
    missingFields: [],
    lastUpdatedAt: now.toISOString(),
    phoneCaptureActive: false,
    phoneConfirmed: false,
    callerRequestedNewPhone: false,
  };
}

export function updateBookingDraftFromTranscript(
  draft: BookingDraft,
  transcript: string,
  options?: BookingDraftUpdateOptions,
): BookingDraft {
  const text = normalizeWhitespace(transcript);
  if (!text) return draft;

  const now = options?.now ?? new Date();
  const hasBookingIntent = BOOKING_INTENT_RE.test(text) && !NON_BOOKING_INTENT_RE.test(text);
  const dateCandidates = extractDateCandidates(text);
  const timeCandidates = extractTimeCandidates(text, {
    hasBookingIntent: hasBookingIntent || draft.intent === 'book_appointment',
    hasDateCandidate: dateCandidates.length > 0 || draft.dateCandidates.length > 0,
  });
  const phoneCue = hasPhoneCue(text);
  const phoneMode = draft.phoneCaptureActive || phoneCue;
  const phoneText = phoneCue && !draft.phoneCaptureActive ? textFromPhoneCue(text) : text;
  let spokenDigits = normalizeSpokenDigits(phoneText, { phoneMode });
  if (phoneCue && spokenDigits.length === 0) {
    spokenDigits = normalizeSpokenDigits(text, { phoneMode });
  }
  const serviceCandidate = extractServiceCandidate(text, options?.shop);
  const callerName = extractCallerNameCandidate(text);

  let next: BookingDraft = {
    ...draft,
    serviceCandidates: [...draft.serviceCandidates],
    dateCandidates: [...draft.dateCandidates],
    timeCandidates: [...draft.timeCandidates],
    phoneDigits: [...draft.phoneDigits],
    callerNameCandidates: [...draft.callerNameCandidates],
    rawTranscriptEvidence: [...draft.rawTranscriptEvidence, text].slice(-MAX_TRANSCRIPT_EVIDENCE),
    confidence: { ...draft.confidence },
    lastUpdatedAt: now.toISOString(),
  };

  if (hasBookingIntent) {
    next.intent = 'book_appointment';
    if (next.intentSource !== 'tool_call') next.intentSource = 'transcript';
    next.confidence = setMaxConfidence(next.confidence, 'intent', 0.8);
  }

  if (serviceCandidate) {
    next.serviceCandidates = uniquePush(next.serviceCandidates, serviceCandidate.value);
    next.confidence = setMaxConfidence(next.confidence, 'service', serviceCandidate.confidence);
  }

  for (const dateCandidate of dateCandidates) {
    next.dateCandidates = uniquePush(next.dateCandidates, dateCandidate);
    next.confidence = setMaxConfidence(next.confidence, 'date', 0.75);
  }

  for (const timeCandidate of timeCandidates) {
    next.timeCandidates = uniquePush(next.timeCandidates, timeCandidate.value);
    next.confidence = setMaxConfidence(next.confidence, 'time', timeCandidate.confidence);
  }

  const shouldAccumulatePhoneDigits = phoneCue || draft.phoneCaptureActive || spokenDigits.length >= 3;
  if (shouldAccumulatePhoneDigits && spokenDigits.length > 0) {
    next.phoneDigits = appendDigitsWithOverlap(next.phoneDigits, spokenDigits);
    next.phoneCaptureActive = next.phoneDigits.length > 0 && next.phoneDigits.length < 10;
    const confidence = phoneConfidence(next.phoneDigits.length);
    if (confidence !== undefined) next.confidence = setMaxConfidence(next.confidence, 'phone', confidence);
    if (callerRequestedNewPhone(text)) next.callerRequestedNewPhone = true;
  } else if (phoneCue) {
    next.phoneCaptureActive = true;
    if (callerRequestedNewPhone(text)) next.callerRequestedNewPhone = true;
  }

  if (next.phoneDigits.length >= 10) {
    next.phoneCaptureActive = false;
  }

  if (
    next.phoneDigits.length >= 10 &&
    /\b(?:yes|yeah|yep|correct|right|that's right|that is right)\b/i.test(text)
  ) {
    next.phoneConfirmed = true;
  }

  if (callerName) {
    next.callerNameCandidates = uniquePush(next.callerNameCandidates, callerName);
    next.confidence = setMaxConfidence(next.confidence, 'callerName', 0.65);
  }

  next.missingFields = missingFieldsFor(next, options);

  return next;
}

export function deriveBookingDraftReasonCodes(previous: BookingDraft | null | undefined, next: BookingDraft): BookingDraftReasonCode[] {
  const codes: BookingDraftReasonCode[] = [];
  const before = previous ?? createBookingDraft(new Date(next.lastUpdatedAt));

  if (before.intent !== 'book_appointment' && next.intent === 'book_appointment') {
    codes.push('booking_intent_detected');
  }
  if (next.serviceCandidates.length > before.serviceCandidates.length) {
    codes.push('service_candidate_accumulated');
  }
  if (next.dateCandidates.length > before.dateCandidates.length) {
    codes.push('date_candidate_accumulated');
  }
  if (next.timeCandidates.length > before.timeCandidates.length) {
    codes.push('time_candidate_accumulated');
    if ((next.confidence.time ?? 0) < 0.6) codes.push('time_candidate_low_confidence');
  }
  if (next.phoneDigits.length > before.phoneDigits.length) {
    codes.push('phone_digits_accumulated');
    if (next.phoneDigits.length >= 10) {
      codes.push('phone_complete');
    } else {
      codes.push('phone_incomplete');
    }
  }
  if (next.callerNameCandidates.length > before.callerNameCandidates.length) {
    codes.push('caller_name_candidate_accumulated');
  }

  return codes;
}

export function summarizeBookingDraftForLog(draft: BookingDraft | null | undefined): Record<string, unknown> | null {
  if (!draft) return null;
  const phoneText = draft.phoneDigits.join('');
  return {
    intent: draft.intent,
    intentSource: draft.intentSource,
    serviceCandidates: draft.serviceCandidates,
    dateCandidates: draft.dateCandidates,
    timeCandidates: draft.timeCandidates,
    callerNameCandidates: draft.callerNameCandidates,
    phoneDigitCount: draft.phoneDigits.length,
    phoneLast4: phoneText.length >= 4 ? phoneText.slice(-4) : null,
    phoneComplete: draft.phoneDigits.length >= 10,
    phoneCaptureActive: draft.phoneCaptureActive,
    phoneConfirmed: draft.phoneConfirmed,
    callerRequestedNewPhone: draft.callerRequestedNewPhone,
    confidence: draft.confidence,
    missingFields: draft.missingFields,
    evidenceCount: draft.rawTranscriptEvidence.length,
    lastUpdatedAt: draft.lastUpdatedAt,
  };
}
