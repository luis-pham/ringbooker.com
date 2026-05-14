import { DateTime } from 'luxon';

import type { BookingInput, BookingResult, Shop, TimeSlot } from '@/src/backend/domain/types';
import { logger } from '@/src/backend/observability/logger';
import type { CalendarProvider } from '@/src/backend/services/calendar/types';

export type MindbodyCredentials = {
  provider: 'mindbody';
  siteId: string;
  apiKey: string;
  sourceName?: string;
  staffToken?: string;
  locationId?: string;
  sessionTypeId?: string;
  staffId?: string;
  bookingUrl?: string;
};

type MindbodyApiOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type MindbodyEnvelope<T> = T & {
  Error?: { Message?: string; Code?: string };
  Errors?: Array<{ Message?: string; Code?: string }>;
};

export type MindbodyService = {
  Id?: number | string;
  Name?: string;
  Description?: string | null;
  Category?: string | null;
  SessionType?: { Id?: number | string; Name?: string };
  Program?: { Id?: number | string; Name?: string };
  Price?: number | string | null;
  ProductId?: number | string | null;
  Duration?: number | string | null;
};

export type MindbodyStaff = {
  Id?: number | string;
  FirstName?: string;
  LastName?: string;
  Name?: string;
  DisplayName?: string;
};

type MindbodyAvailabilitySlot = {
  StartDateTime?: string;
  EndDateTime?: string;
  Staff?: MindbodyStaff;
  StaffId?: number | string;
};

type MindbodyServicesResponse = MindbodyEnvelope<{
  Services?: MindbodyService[];
  SessionTypes?: MindbodyService[];
}>;

type MindbodyStaffResponse = MindbodyEnvelope<{
  StaffMembers?: MindbodyStaff[];
  Staff?: MindbodyStaff[];
}>;

type MindbodyAvailabilityResponse = MindbodyEnvelope<{
  Availabilities?: MindbodyAvailabilitySlot[];
  Availability?: MindbodyAvailabilitySlot[];
}>;

export type MindbodyConnectionOptions = {
  services: MindbodyService[];
  staff: MindbodyStaff[];
  capabilityNote: string;
};

const MINDBODY_UNSUPPORTED_WRITE_ERROR =
  'mindbody_write_deferred: Mindbody appointment writes require verified API contracts, approved site access, and service/client mappings. RingBooker captured the booking request instead.';

export function parseMindbodyCredentials(raw: string | null | undefined): Partial<MindbodyCredentials> | null {
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
      if (provider !== 'mindbody') continue;
      return {
        provider: 'mindbody',
        siteId: stringValue(parsed.siteId ?? parsed.site_id),
        apiKey: stringValue(parsed.apiKey ?? parsed.api_key),
        sourceName: stringValue(parsed.sourceName ?? parsed.source_name),
        staffToken: stringValue(parsed.staffToken ?? parsed.staff_token),
        locationId: stringValue(parsed.locationId ?? parsed.location_id),
        sessionTypeId: stringValue(parsed.sessionTypeId ?? parsed.session_type_id),
        staffId: stringValue(parsed.staffId ?? parsed.staff_id),
        bookingUrl: stringValue(parsed.bookingUrl ?? parsed.booking_url),
      };
    } catch {
      continue;
    }
  }
  return null;
}

export function encodeMindbodyCredentials(input: MindbodyCredentials): string {
  return JSON.stringify(input);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function mindbodyApiBaseUrl(): string {
  return process.env.MINDBODY_API_BASE_URL?.trim().replace(/\/+$/, '') || 'https://api.mindbodyonline.com/public/v6';
}

function mindbodyTimeoutMs(): number {
  const raw = Number(process.env.MINDBODY_TIMEOUT_MS ?? 12_000);
  return Number.isFinite(raw) && raw > 0 ? raw : 12_000;
}

function resolveMindbodyCredentials(shop: Shop): MindbodyCredentials {
  const parsed =
    parseMindbodyCredentials(shop.integration_credentials_encrypted) ??
    parseMindbodyCredentials(shop.google_cal_credentials_encrypted);
  const siteId = parsed?.siteId?.trim() || process.env.MINDBODY_SITE_ID?.trim();
  const apiKey = parsed?.apiKey?.trim() || process.env.MINDBODY_API_KEY?.trim();
  if (!siteId || !apiKey) {
    throw new Error('mindbody_calendar_missing_site_id_or_api_key');
  }
  return {
    provider: 'mindbody',
    siteId,
    apiKey,
    sourceName: parsed?.sourceName?.trim() || process.env.MINDBODY_SOURCE_NAME?.trim(),
    staffToken: parsed?.staffToken?.trim() || process.env.MINDBODY_STAFF_TOKEN?.trim(),
    locationId: parsed?.locationId?.trim() || process.env.MINDBODY_LOCATION_ID?.trim(),
    sessionTypeId: parsed?.sessionTypeId?.trim() || process.env.MINDBODY_SESSION_TYPE_ID?.trim(),
    staffId: parsed?.staffId?.trim() || process.env.MINDBODY_STAFF_ID?.trim(),
    bookingUrl: parsed?.bookingUrl?.trim() || shop.booking_url?.trim() || process.env.MINDBODY_BOOKING_URL?.trim(),
  };
}

function extractMindbodyError(payload: MindbodyEnvelope<unknown>): string | null {
  const first = payload.Errors?.[0];
  if (first?.Message || first?.Code) return `${first.Code ?? 'mindbody_error'}:${first.Message ?? ''}`;
  if (payload.Error?.Message || payload.Error?.Code) return `${payload.Error.Code ?? 'mindbody_error'}:${payload.Error.Message ?? ''}`;
  return null;
}

function staffDisplayName(staff: MindbodyStaff): string {
  const explicit = staff.DisplayName || staff.Name;
  if (explicit) return explicit;
  return [staff.FirstName, staff.LastName].filter(Boolean).join(' ').trim() || String(staff.Id ?? 'Mindbody staff');
}

function normalizeAvailabilitySlot(slot: MindbodyAvailabilitySlot, timezone: string): TimeSlot | null {
  if (!slot.StartDateTime) return null;
  const start = DateTime.fromISO(slot.StartDateTime, { setZone: true }).setZone(timezone);
  if (!start.isValid) return null;
  return {
    date: start.toFormat('yyyy-LL-dd'),
    time: start.toFormat('HH:mm'),
    techName: slot.Staff ? staffDisplayName(slot.Staff) : undefined,
  };
}

export class MindbodyProvider implements CalendarProvider {
  readonly shop: Shop;
  private readonly credentials: MindbodyCredentials;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(shop: Shop, options: MindbodyApiOptions = {}) {
    this.shop = shop;
    this.credentials = resolveMindbodyCredentials(shop);
    this.baseUrl = options.baseUrl?.replace(/\/+$/, '') ?? mindbodyApiBaseUrl();
    this.timeoutMs = options.timeoutMs ?? mindbodyTimeoutMs();
    this.fetchImpl = options.fetchImpl ?? fetch;
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

  private async mindbodyJsonRequest<T>(params: {
    path: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown>;
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
        'API-Key': this.credentials.apiKey,
        SiteId: this.credentials.siteId,
        'User-Agent': this.credentials.sourceName || 'RingBooker',
        ...(this.credentials.staffToken ? { Authorization: this.credentials.staffToken } : {}),
        ...(params.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: params.body ? JSON.stringify(params.body) : undefined,
    });

    const logBase = {
      provider: 'mindbody',
      shopId: this.shop.id,
      method,
      path: params.path,
      status: response.status,
      durationMs: Date.now() - startedAt,
    };
    if (response.ok) logger.info(logBase, 'mindbody_api_request_ok');
    else logger.warn(logBase, 'mindbody_api_request_failed');

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as MindbodyEnvelope<T>) : ({} as MindbodyEnvelope<T>);
    if (!response.ok) {
      throw new Error(`mindbody_request_failed:${response.status}:${extractMindbodyError(payload) ?? 'unknown_error'}`);
    }
    const apiError = extractMindbodyError(payload);
    if (apiError) throw new Error(`mindbody_request_error:${apiError}`);
    return payload as T;
  }

  async getServices(): Promise<MindbodyService[]> {
    const response = await this.mindbodyJsonRequest<MindbodyServicesResponse>({ path: '/sale/services', method: 'GET' });
    return response.Services ?? response.SessionTypes ?? [];
  }

  async getStaff(): Promise<MindbodyStaff[]> {
    const response = await this.mindbodyJsonRequest<MindbodyStaffResponse>({ path: '/staff/staff', method: 'GET' });
    return response.StaffMembers ?? response.Staff ?? [];
  }

  async getTeamMembers(): Promise<Array<{ id: string; displayName: string; givenName?: string; familyName?: string }>> {
    const staff = await this.getStaff();
    return staff
      .filter((member) => member.Id !== undefined && member.Id !== null)
      .map((member) => ({
        id: String(member.Id),
        displayName: staffDisplayName(member),
        givenName: member.FirstName,
        familyName: member.LastName,
      }));
  }

  async findTeamMemberByName(name: string): Promise<string | null> {
    const needle = name.trim().toLowerCase();
    if (!needle) return null;
    const staff = await this.getTeamMembers();
    return staff.find((member) => member.displayName.toLowerCase().includes(needle))?.id ?? null;
  }

  async getConnectionOptions(): Promise<MindbodyConnectionOptions> {
    const [services, staff] = await Promise.all([this.getServices(), this.getStaff()]);
    return {
      services,
      staff,
      capabilityNote: 'Mindbody API connection is active. Booking creation is request-only until Mindbody write contracts and service/client mappings are verified.',
    };
  }

  async searchAvailability(params: {
    date: string;
    timezone: string;
    sessionTypeId?: string;
    staffId?: string;
  }): Promise<MindbodyAvailabilitySlot[]> {
    const start = DateTime.fromISO(`${params.date}T00:00:00`, { zone: params.timezone });
    if (!start.isValid) throw new Error('mindbody_availability_invalid_date');
    const response = await this.mindbodyJsonRequest<MindbodyAvailabilityResponse>({
      path: '/appointment/availability',
      method: 'GET',
      query: {
        startDate: start.toISODate() ?? params.date,
        endDate: start.toISODate() ?? params.date,
        sessionTypeIds: params.sessionTypeId ?? this.credentials.sessionTypeId,
        staffIds: params.staffId ?? this.credentials.staffId,
        locationIds: this.credentials.locationId,
      },
    });
    return response.Availabilities ?? response.Availability ?? [];
  }

  async prefetchAvailability(params: { date: string; timezone: string }): Promise<void> {
    await this.searchAvailability({ date: params.date, timezone: params.timezone }).catch((error) => {
      logger.warn({ err: error, provider: 'mindbody', shopId: this.shop.id }, 'mindbody_prefetch_availability_failed');
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
    const requestedStart = DateTime.fromISO(`${params.date}T${params.time}:00`, { zone: params.timezone });
    if (!requestedStart.isValid) throw new Error('mindbody_availability_invalid_datetime');

    try {
      const slots = await this.searchAvailability({ date: params.date, timezone: params.timezone, staffId: params.teamMemberId });
      const requestedIso = requestedStart.toFormat("yyyy-LL-dd'T'HH:mm");
      const suggestions: TimeSlot[] = [];
      for (const slot of slots) {
        const normalized = normalizeAvailabilitySlot(slot, params.timezone);
        if (!normalized) continue;
        if (`${normalized.date}T${normalized.time}` === requestedIso) return { available: true };
        if (suggestions.length < 3) suggestions.push(normalized);
      }
      return { available: false, suggestions: suggestions.length ? suggestions : undefined };
    } catch (error) {
      logger.warn({ err: error, provider: 'mindbody', shopId: this.shop.id }, 'mindbody_check_availability_failed');
      return { available: false };
    }
  }

  async createBooking(input: BookingInput): Promise<BookingResult> {
    if (process.env.MINDBODY_WRITE_CONTRACT_VERIFIED !== 'true') {
      logger.warn({ provider: 'mindbody', shopId: this.shop.id }, 'mindbody_create_booking_write_deferred');
      return {
        bookingId: `mindbody-request-${input.idempotencyKey}`,
        confirmed: false,
      };
    }

    // Appointment writes require approved Mindbody API access plus site-specific client,
    // service/session, staff, and location mappings. Do not confirm from RingBooker until
    // that contract is explicitly enabled and implemented.
    throw new Error(MINDBODY_UNSUPPORTED_WRITE_ERROR);
  }

  async cancelBooking(_params: { bookingId: string; reason?: string; idempotencyKey: string }): Promise<void> {
    throw new Error(MINDBODY_UNSUPPORTED_WRITE_ERROR);
  }

  async rescheduleBooking(_params: {
    bookingId: string;
    newDate: string;
    newTime: string;
    timezone: string;
    idempotencyKey: string;
  }): Promise<BookingResult> {
    throw new Error(MINDBODY_UNSUPPORTED_WRITE_ERROR);
  }
}
