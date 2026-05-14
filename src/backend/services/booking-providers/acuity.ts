import { DateTime } from 'luxon';

import type { BookingInput, BookingResult, Shop, TimeSlot } from '@/src/backend/domain/types';
import { logger } from '@/src/backend/observability/logger';
import type { CalendarProvider } from '@/src/backend/services/calendar/types';

export type AcuityCredentials = {
  provider: 'acuity';
  userId?: string;
  apiKey?: string;
  accessToken?: string;
  appointmentTypeId?: string;
  calendarId?: string;
  timezone?: string;
  bookingUrl?: string;
};

type AcuityApiOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type AcuityAppointmentType = {
  id?: number | string;
  name?: string;
  active?: boolean;
  duration?: number | string;
  price?: string | number | null;
  category?: string | null;
  type?: string | null;
  calendarIDs?: Array<number | string>;
};

export type AcuityCalendar = {
  id?: number | string;
  name?: string;
  email?: string | null;
  timezone?: string | null;
};

type AcuityAvailabilityTime = {
  time?: string;
  datetime?: string;
  calendarID?: number | string;
  slotsAvailable?: number;
};

type AcuityAvailabilityCheck = {
  valid?: boolean;
  available?: boolean;
  time?: string;
  datetime?: string;
  calendarID?: number | string;
  reason?: string;
  error?: string;
};

type AcuityAppointmentResponse = {
  id?: number | string;
  appointmentTypeID?: number | string;
  calendarID?: number | string;
  datetime?: string;
  canceled?: boolean;
  error?: string;
  message?: string;
};

export type AcuityConnectionOptions = {
  appointmentTypes: AcuityAppointmentType[];
  calendars: AcuityCalendar[];
  directAppointmentCreation: 'enabled' | 'not_enabled';
  bookingMode: 'direct_booking_with_fallback' | 'capture_request_only';
  capabilityNote: string;
};

export function parseAcuityCredentials(raw: string | null | undefined): Partial<AcuityCredentials> | null {
  if (!raw) return null;
  const candidates = [raw];
  try {
    candidates.push(Buffer.from(raw, 'base64').toString('utf-8'));
  } catch {
    // ignore invalid base64 candidate
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const provider = parsed.provider ?? parsed.provider_id;
      if (provider !== 'acuity') continue;
      return {
        provider: 'acuity',
        userId: stringValue(parsed.userId ?? parsed.user_id),
        apiKey: stringValue(parsed.apiKey ?? parsed.api_key),
        accessToken: stringValue(parsed.accessToken ?? parsed.access_token),
        appointmentTypeId: stringValue(parsed.appointmentTypeId ?? parsed.appointment_type_id),
        calendarId: stringValue(parsed.calendarId ?? parsed.calendar_id),
        timezone: stringValue(parsed.timezone),
        bookingUrl: stringValue(parsed.bookingUrl ?? parsed.booking_url),
      };
    } catch {
      continue;
    }
  }
  return null;
}

export function encodeAcuityCredentials(input: AcuityCredentials): string {
  return JSON.stringify(input);
}

export function buildAcuityConnectionPayload(
  current: Partial<AcuityCredentials> | null | undefined,
  patch: Partial<AcuityCredentials>,
): AcuityCredentials {
  return {
    provider: 'acuity',
    userId: patch.userId ?? current?.userId,
    apiKey: patch.apiKey ?? current?.apiKey,
    accessToken: patch.accessToken ?? current?.accessToken,
    appointmentTypeId: patch.appointmentTypeId ?? current?.appointmentTypeId,
    calendarId: patch.calendarId ?? current?.calendarId,
    timezone: patch.timezone ?? current?.timezone,
    bookingUrl: patch.bookingUrl ?? current?.bookingUrl,
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function acuityApiBaseUrl(): string {
  return process.env.ACUITY_API_BASE_URL?.trim().replace(/\/+$/, '') || 'https://acuityscheduling.com/api/v1';
}

function acuityTimeoutMs(): number {
  const raw = Number(process.env.ACUITY_TIMEOUT_MS ?? 12_000);
  return Number.isFinite(raw) && raw > 0 ? raw : 12_000;
}

function isDirectBookingEnabled(): boolean {
  return process.env.ACUITY_DIRECT_BOOKING_ENABLED === 'true';
}

function resolveAcuityCredentials(shop: Shop): AcuityCredentials {
  const parsed =
    parseAcuityCredentials(shop.integration_credentials_encrypted) ??
    parseAcuityCredentials(shop.google_cal_credentials_encrypted);
  const accessToken = parsed?.accessToken?.trim() || process.env.ACUITY_ACCESS_TOKEN?.trim();
  const userId = parsed?.userId?.trim() || process.env.ACUITY_USER_ID?.trim();
  const apiKey = parsed?.apiKey?.trim() || process.env.ACUITY_API_KEY?.trim();
  if (!accessToken && (!userId || !apiKey)) {
    throw new Error('acuity_missing_credentials');
  }
  return {
    provider: 'acuity',
    accessToken,
    userId,
    apiKey,
    appointmentTypeId: parsed?.appointmentTypeId?.trim() || process.env.ACUITY_APPOINTMENT_TYPE_ID?.trim(),
    calendarId: parsed?.calendarId?.trim() || process.env.ACUITY_CALENDAR_ID?.trim(),
    timezone: parsed?.timezone?.trim() || shop.timezone?.trim() || process.env.ACUITY_TIMEZONE?.trim(),
    bookingUrl: parsed?.bookingUrl?.trim() || shop.booking_url?.trim() || process.env.ACUITY_BOOKING_URL?.trim(),
  };
}

function extractAcuityError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const message = stringValue(record.message) ?? stringValue(record.error);
  if (message) return message;
  const errors = record.errors;
  if (Array.isArray(errors)) {
    const first = errors.find((item) => item && typeof item === 'object') as Record<string, unknown> | undefined;
    return stringValue(first?.message) ?? stringValue(first?.error) ?? null;
  }
  return null;
}

function normalizeId(value: string | number | undefined | null): string | undefined {
  if (value === undefined || value === null) return undefined;
  const id = String(value).trim();
  return id ? id : undefined;
}

function parseOptionalInt(value: string | number | undefined | null): number | undefined {
  const normalized = normalizeId(value);
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstAndLastName(fullName: string | undefined): { firstName: string; lastName: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'RingBooker', lastName: 'Caller' };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: 'Caller' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1)! };
}

function normalizeAvailabilityTime(slot: AcuityAvailabilityTime, timezone: string): TimeSlot | null {
  const raw = slot.time ?? slot.datetime;
  if (!raw) return null;
  const start = DateTime.fromISO(raw, { setZone: true });
  const normalized = (start.isValid ? start : DateTime.fromFormat(raw, 'yyyy-LL-dd HH:mm:ss', { zone: timezone })).setZone(timezone);
  if (!normalized.isValid) return null;
  return {
    date: normalized.toFormat('yyyy-LL-dd'),
    time: normalized.toFormat('HH:mm'),
  };
}

export class AcuityProvider implements CalendarProvider {
  readonly shop: Shop;
  private readonly credentials: AcuityCredentials;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(shop: Shop, options: AcuityApiOptions = {}) {
    this.shop = shop;
    this.credentials = resolveAcuityCredentials(shop);
    this.baseUrl = options.baseUrl?.replace(/\/+$/, '') ?? acuityApiBaseUrl();
    this.timeoutMs = options.timeoutMs ?? acuityTimeoutMs();
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private authHeaders(): Record<string, string> {
    if (this.credentials.accessToken) {
      return { Authorization: `Bearer ${this.credentials.accessToken}` };
    }
    const basic = Buffer.from(`${this.credentials.userId}:${this.credentials.apiKey}`).toString('base64');
    return { Authorization: `Basic ${basic}` };
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async acuityJsonRequest<T>(params: {
    path: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown> | Array<Record<string, unknown>>;
    query?: Record<string, string | number | boolean | undefined>;
  }): Promise<T> {
    const url = new URL(`${this.baseUrl}${params.path}`);
    for (const [key, value] of Object.entries(params.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const method = params.method ?? (params.body ? 'POST' : 'GET');
    const startedAt = Date.now();
    const response = await this.fetchWithTimeout(url.toString(), {
      method,
      headers: {
        ...this.authHeaders(),
        Accept: 'application/json',
        ...(params.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: params.body ? JSON.stringify(params.body) : undefined,
    });

    const logBase = {
      provider: 'acuity',
      shopId: this.shop.id,
      method,
      path: params.path,
      status: response.status,
      durationMs: Date.now() - startedAt,
    };
    if (response.ok) logger.info(logBase, 'acuity_api_request_ok');
    else logger.warn(logBase, 'acuity_api_request_failed');

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as unknown) : {};
    if (!response.ok) {
      throw new Error(`acuity_request_failed:${response.status}:${extractAcuityError(payload) ?? 'unknown_error'}`);
    }
    const apiError = extractAcuityError(payload);
    if (apiError && !Array.isArray(payload)) throw new Error(`acuity_request_error:${apiError}`);
    return payload as T;
  }

  async getAppointmentTypes(): Promise<AcuityAppointmentType[]> {
    const response = await this.acuityJsonRequest<AcuityAppointmentType[]>({ path: '/appointment-types', method: 'GET' });
    return Array.isArray(response) ? response : [];
  }

  async getCalendars(): Promise<AcuityCalendar[]> {
    const response = await this.acuityJsonRequest<AcuityCalendar[]>({ path: '/calendars', method: 'GET' });
    return Array.isArray(response) ? response : [];
  }

  async getTeamMembers(): Promise<Array<{ id: string; displayName: string }>> {
    const calendars = await this.getCalendars();
    return calendars
      .filter((calendar) => calendar.id !== undefined && calendar.id !== null)
      .map((calendar) => ({
        id: String(calendar.id),
        displayName: calendar.name || String(calendar.id),
      }));
  }

  async findTeamMemberByName(name: string): Promise<string | null> {
    const needle = name.trim().toLowerCase();
    if (!needle) return null;
    const calendars = await this.getTeamMembers();
    return calendars.find((calendar) => calendar.displayName.toLowerCase().includes(needle))?.id ?? null;
  }

  async getConnectionOptions(): Promise<AcuityConnectionOptions> {
    const [appointmentTypes, calendars] = await Promise.all([this.getAppointmentTypes(), this.getCalendars()]);
    const directEnabled = isDirectBookingEnabled() && Boolean(this.credentials.appointmentTypeId);
    return {
      appointmentTypes,
      calendars,
      directAppointmentCreation: directEnabled ? 'enabled' : 'not_enabled',
      bookingMode: directEnabled ? 'direct_booking_with_fallback' : 'capture_request_only',
      capabilityNote: directEnabled
        ? 'Acuity direct appointment creation is enabled. RingBooker still falls back to captured booking requests when Acuity rejects a booking.'
        : 'Acuity is connected for appointment type/calendar sync and availability. Direct appointment creation is disabled until mappings and ACUITY_DIRECT_BOOKING_ENABLED are configured.',
    };
  }

  async searchAvailability(params: {
    date: string;
    timezone: string;
    appointmentTypeId?: string;
    calendarId?: string;
  }): Promise<AcuityAvailabilityTime[]> {
    const appointmentTypeId = params.appointmentTypeId ?? this.credentials.appointmentTypeId;
    if (!appointmentTypeId) throw new Error('acuity_missing_appointment_type_id');
    const response = await this.acuityJsonRequest<AcuityAvailabilityTime[]>({
      path: '/availability/times',
      method: 'GET',
      query: {
        date: params.date,
        appointmentTypeID: appointmentTypeId,
        calendarID: params.calendarId ?? this.credentials.calendarId,
        timezone: params.timezone,
      },
    });
    return Array.isArray(response) ? response : [];
  }

  async prefetchAvailability(params: { date: string; timezone: string }): Promise<void> {
    await this.searchAvailability(params).catch((error) => {
      logger.warn({ err: error, provider: 'acuity', shopId: this.shop.id }, 'acuity_prefetch_availability_failed');
    });
  }

  async checkAvailability(params: {
    date: string;
    time: string;
    durationMin: number;
    techName?: string;
    teamMemberId?: string;
    timezone: string;
  }): Promise<{ available: boolean; suggestions?: TimeSlot[] }> {
    if (!this.credentials.appointmentTypeId) return { available: false };
    const requestedStart = DateTime.fromISO(`${params.date}T${params.time}:00`, { zone: params.timezone });
    if (!requestedStart.isValid) throw new Error('acuity_availability_invalid_datetime');

    try {
      const calendarId = params.teamMemberId ?? this.credentials.calendarId;
      const checkPayload = [
        {
          datetime: requestedStart.toISO({ suppressMilliseconds: true }) ?? `${params.date}T${params.time}:00`,
          appointmentTypeID: parseOptionalInt(this.credentials.appointmentTypeId) ?? this.credentials.appointmentTypeId,
          ...(calendarId ? { calendarID: parseOptionalInt(calendarId) ?? calendarId } : {}),
        },
      ];
      const checked = await this.acuityJsonRequest<AcuityAvailabilityCheck[]>({
        path: '/availability/check-times',
        method: 'POST',
        body: checkPayload,
      });
      const first = Array.isArray(checked) ? checked[0] : undefined;
      if (first?.valid === true || first?.available === true) return { available: true };

      const times = await this.searchAvailability({ date: params.date, timezone: params.timezone, calendarId });
      const suggestions = times
        .map((slot) => normalizeAvailabilityTime(slot, params.timezone))
        .filter((slot): slot is TimeSlot => Boolean(slot))
        .slice(0, 3);
      return { available: false, suggestions: suggestions.length ? suggestions : undefined };
    } catch (error) {
      logger.warn({ err: error, provider: 'acuity', shopId: this.shop.id }, 'acuity_check_availability_failed');
      return { available: false };
    }
  }

  async createBooking(input: BookingInput): Promise<BookingResult> {
    if (!isDirectBookingEnabled() || !this.credentials.appointmentTypeId) {
      logger.warn(
        { provider: 'acuity', shopId: this.shop.id, directEnabled: isDirectBookingEnabled(), hasAppointmentTypeId: Boolean(this.credentials.appointmentTypeId) },
        'acuity_create_booking_fallback_request_only',
      );
      return {
        bookingId: `acuity-request-${input.idempotencyKey}`,
        confirmed: false,
        providerStatus: 'fallback_request',
        providerErrorReason: 'direct_booking_disabled_or_unmapped',
      };
    }

    try {
      const { firstName, lastName } = firstAndLastName(input.customerName);
      const calendarId = input.teamMemberId ?? this.credentials.calendarId;
      const response = await this.acuityJsonRequest<AcuityAppointmentResponse>({
        path: '/appointments',
        method: 'POST',
        body: {
          datetime: DateTime.fromISO(input.datetimeIso, { setZone: true }).setZone(input.timezone).toISO({ suppressMilliseconds: true }) ?? input.datetimeIso,
          appointmentTypeID: parseOptionalInt(this.credentials.appointmentTypeId) ?? this.credentials.appointmentTypeId,
          ...(calendarId ? { calendarID: parseOptionalInt(calendarId) ?? calendarId } : {}),
          firstName,
          lastName,
          email: 'booking-request@ringbooker.com',
          phone: input.customerPhone,
          timezone: input.timezone,
          notes: input.notes || `RingBooker phone booking request for ${input.service}`,
          smsOptIn: false,
        },
      });
      const appointmentId = normalizeId(response.id);
      if (!appointmentId) {
        logger.warn({ provider: 'acuity', shopId: this.shop.id }, 'acuity_create_booking_missing_appointment_id');
        return {
          bookingId: `acuity-request-${input.idempotencyKey}`,
          confirmed: false,
          providerStatus: 'fallback_request',
          providerErrorReason: 'missing_appointment_id',
        };
      }
      return {
        bookingId: `acuity-${appointmentId}`,
        calendarEventId: appointmentId,
        confirmed: true,
        providerStatus: 'confirmed',
      };
    } catch (error) {
      logger.error({ err: error, provider: 'acuity', shopId: this.shop.id, error_kind: 'create_booking_failed' }, 'acuity_create_booking_failed_fallback');
      return {
        bookingId: `acuity-request-${input.idempotencyKey}`,
        confirmed: false,
        providerStatus: 'fallback_request',
        providerErrorReason: error instanceof Error ? error.message.slice(0, 240) : 'create_booking_failed',
      };
    }
  }

  async cancelBooking(params: { bookingId: string; reason?: string; idempotencyKey: string }): Promise<void> {
    if (!isDirectBookingEnabled()) throw new Error('acuity_direct_booking_disabled');
    const appointmentId = params.bookingId.replace(/^acuity-/, '');
    await this.acuityJsonRequest<AcuityAppointmentResponse>({
      path: `/appointments/${encodeURIComponent(appointmentId)}/cancel`,
      method: 'PUT',
      query: { admin: true, noEmail: true },
      body: params.reason ? { notes: params.reason } : {},
    });
  }

  async rescheduleBooking(params: {
    bookingId: string;
    newDate: string;
    newTime: string;
    timezone: string;
    idempotencyKey: string;
  }): Promise<BookingResult> {
    if (!isDirectBookingEnabled()) throw new Error('acuity_direct_booking_disabled');
    const appointmentId = params.bookingId.replace(/^acuity-/, '');
    const response = await this.acuityJsonRequest<AcuityAppointmentResponse>({
      path: `/appointments/${encodeURIComponent(appointmentId)}/reschedule`,
      method: 'PUT',
      query: { admin: true, noEmail: true },
      body: {
        datetime: DateTime.fromISO(`${params.newDate}T${params.newTime}:00`, { zone: params.timezone }).toISO({ suppressMilliseconds: true }),
        timezone: params.timezone,
        ...(this.credentials.calendarId ? { calendarID: parseOptionalInt(this.credentials.calendarId) ?? this.credentials.calendarId } : {}),
      },
    });
    const nextId = normalizeId(response.id) ?? appointmentId;
    return { bookingId: `acuity-${nextId}`, calendarEventId: nextId, confirmed: true };
  }
}
