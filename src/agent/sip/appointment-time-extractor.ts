import { DateTime } from 'luxon';

import type { Shop } from '@/src/backend/domain/types';

export type ExtractedAppointmentDateTime = {
  /** YYYY-MM-DD in the shop's local timezone */
  date: string;
  /** HH:MM in 24-hour format */
  time: string;
};

/** 0 = Sunday … 6 = Saturday (JS convention) */
const DOW_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const MONTH_MAP: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

/**
 * Extract a 24-hour time string (HH:MM) from natural-language text.
 *
 * Requires explicit AM/PM or a noon/midnight noun.
 * Returns `null` for ambiguous times like "9 o'clock" without a period marker.
 *
 * @example
 * extractTime24("Maybe 9 a.m.") // "09:00"
 * extractTime24("2:30 PM")      // "14:30"
 * extractTime24("noon")         // "12:00"
 * extractTime24("midnight")     // "00:00"
 * extractTime24("9 o'clock")    // null — ambiguous
 */
export function extractTime24(text: string): string | null {
  const lower = text.toLowerCase();

  if (/\bnoon\b/.test(lower)) return '12:00';
  if (/\bmidnight\b/.test(lower)) return '00:00';

  // Match "9 AM", "9:30 AM", "9 o'clock AM", "2 p.m.", "2:30pm", etc.
  // Requires explicit (a\.?m\.?) or (p\.?m\.?) — rejects bare "o'clock"
  const m = /\b(\d{1,2})(?::([0-5]\d))?\s*(?:o'clock\s+)?(?:(a\.?\s*m\.?)|(p\.?\s*m\.?))\b/i.exec(text);
  if (!m) return null;

  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const isPm = Boolean(m[4]);
  const isAm = Boolean(m[3]);

  if (h < 1 || h > 12) return null;
  if (isPm && h !== 12) h += 12;
  if (isAm && h === 12) h = 0;

  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Extract a YYYY-MM-DD date from natural-language text, relative to `nowDt`.
 * Returns `null` when no recognizable date expression is found.
 */
function extractDate(text: string, nowDt: DateTime): string | null {
  const lower = text.toLowerCase();

  if (/\btoday\b/.test(lower)) return nowDt.toFormat('yyyy-MM-dd');
  // Check specific multi-word phrases first so "day after tomorrow" is not caught by "tomorrow".
  if (/\bday after tomorrow\b/.test(lower)) return nowDt.plus({ days: 2 }).toFormat('yyyy-MM-dd');
  if (/\btomorrow\b/.test(lower)) return nowDt.plus({ days: 1 }).toFormat('yyyy-MM-dd');

  // Day-of-week: "Monday", "next Monday", "this Monday"
  const dayNames = Object.keys(DOW_MAP).join('|');
  const dayMatch = new RegExp(`\\b(?:(next)\\s+)?(${dayNames})\\b`).exec(lower);
  if (dayMatch) {
    const hasNext = Boolean(dayMatch[1]);
    const targetDow = DOW_MAP[dayMatch[2]];
    // Convert Luxon weekday (1=Mon … 7=Sun) to JS-style (0=Sun … 6=Sat)
    const currentDow = nowDt.weekday === 7 ? 0 : nowDt.weekday;
    let delta = (targetDow - currentDow + 7) % 7;
    if (delta === 0) delta = 7; // Same weekday as today → push to next week
    if (hasNext) {
      // "next Monday" always means at least 7 days away
      while (delta < 7) delta += 7;
    }
    return nowDt.plus({ days: delta }).toFormat('yyyy-MM-dd');
  }

  // Month + day: "June 15", "June 15th", "Jun 15"
  const monthNames = Object.keys(MONTH_MAP).join('|');
  const mdMatch = new RegExp(`\\b(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`).exec(lower);
  if (mdMatch) {
    const month = MONTH_MAP[mdMatch[1]];
    const day = parseInt(mdMatch[2], 10);
    if (month && day >= 1 && day <= 31) {
      // Build the date; if it's already past today, roll forward one year
      let dt = nowDt.set({ month, day, hour: 0, minute: 0, second: 0, millisecond: 0 });
      if (dt < nowDt.startOf('day')) dt = dt.plus({ years: 1 });
      return dt.toFormat('yyyy-MM-dd');
    }
  }

  return null;
}

/**
 * Infer today or tomorrow based on whether the extracted time is still in the future today.
 */
function inferDateFromTime(time24: string, nowDt: DateTime): string {
  const [hStr, mStr] = time24.split(':');
  const requestedMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
  const currentMinutes = nowDt.hour * 60 + nowDt.minute;
  return requestedMinutes > currentMinutes
    ? nowDt.toFormat('yyyy-MM-dd')              // still upcoming today
    : nowDt.plus({ days: 1 }).toFormat('yyyy-MM-dd'); // already past → tomorrow
}

/**
 * Extract a structured `{ date, time }` from a caller transcript utterance for
 * server-side pre-population of `ctx.appointmentTimeValidation.latest`.
 *
 * Returns `null` when:
 * - No time expression is found, or the time is ambiguous (no explicit AM/PM)
 * - Extraction confidence is insufficient
 *
 * When a time is found but no explicit date, the date is inferred:
 * - Time still upcoming today → today's date
 * - Time already past today → tomorrow's date
 *
 * @param transcript - Raw caller utterance (from OpenAI transcription)
 * @param shop       - Used for `shop.timezone` to resolve relative dates
 * @param now        - Override current time (useful for deterministic tests)
 */
export function extractAppointmentDateTime(
  transcript: string,
  shop: Pick<Shop, 'timezone'>,
  now?: Date,
): ExtractedAppointmentDateTime | null {
  const nowDt = DateTime.fromJSDate(now ?? new Date(), { zone: shop.timezone });

  const time24 = extractTime24(transcript);
  if (!time24) return null;

  const date = extractDate(transcript, nowDt) ?? inferDateFromTime(time24, nowDt);

  return { date, time: time24 };
}
