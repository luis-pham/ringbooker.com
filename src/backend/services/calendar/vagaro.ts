import { DateTime } from 'luxon';

import type { BookingInput, BookingResult, Shop, TimeSlot } from '@/src/backend/domain/types';
import type { CalendarProvider } from '@/src/backend/services/calendar/types';

const VAGARO_UNSUPPORTED_WRITE_ERROR =
  'Vagaro public API does not support this operation. Please complete this action in Vagaro directly.';

export type VagaroCredentials = {
  provider: 'vagaro';
  region: string;
  businessId: string;
  clientId?: string;
  clientSecretKey?: string;
  scope?: string;
  accessToken?: string;
  expiresAt?: string;
};

type VagaroTokenResponse = {
  accessToken?: string;
  access_token?: string;
  token?: string;
  expiresIn?: number;
  expires_in?: number;
  expiresAt?: string;
  expires_at?: string;
};

export type VagaroConnectionOptions = {
  services: VagaroService[];
  staff: VagaroEmployee[];
  capabilityNote: string;
};

type VagaroApiEnvelope<T> = T & {
  data?: T;
  result?: T;
  errors?: unknown;
  error?: unknown;
  message?: string;
};

export type VagaroAvailabilitySlot = {
  startTime?: string;
  startDateTime?: string;
  appointmentDate?: string;
  time?: string;
  serviceProviderId?: string;
  serviceProviderName?: string;
  employeeId?: string;
  employeeName?: string;
};

export type VagaroAvailabilityResponse = {
  availability?: VagaroAvailabilitySlot[];
  availabilities?: VagaroAvailabilitySlot[];
  slots?: VagaroAvailabilitySlot[];
};

export type VagaroService = {
  serviceId?: string;
  id?: string;
  serviceTitle?: string;
  name?: string;
  duration?: number;
  durationMin?: number;
  price?: number;
};

export type VagaroServicesResponse = {
  services?: VagaroService[];
  serviceList?: VagaroService[];
};

export type VagaroEmployee = {
  serviceProviderId?: string;
  employeeId?: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  mobilePhone?: string;
};

export type VagaroEmployeesResponse = {
  employees?: VagaroEmployee[];
  serviceProviders?: VagaroEmployee[];
};

export type VagaroAppointment = {
  appointmentId?: string;
  startTime?: string;
  endTime?: string;
  bookingStatus?: string;
  serviceTitle?: string;
  serviceId?: string;
  customerId?: string;
  serviceProviderId?: string;
};

export type VagaroAppointmentsResponse = {
  appointments?: VagaroAppointment[];
  appointment?: VagaroAppointment;
};

export type VagaroCustomer = {
  customerId?: string;
  customerFirstName?: string;
  customerLastName?: string;
  email?: string;
  mobilePhone?: string;
  dayPhone?: string;
  nightPhone?: string;
};

export type VagaroCustomerResponse = {
  customer?: VagaroCustomer;
};

export function parseVagaroCredentials(raw: string | null | undefined): Partial<VagaroCredentials> {
  if (!raw) return {};
  const candidates = [raw];
  try {
    candidates.push(Buffer.from(raw, 'base64').toString('utf-8'));
  } catch {
    // ignore invalid base64
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const provider = typeof parsed.provider === 'string' ? parsed.provider.trim().toLowerCase() : '';
      if (provider && provider !== 'vagaro') continue;

      return {
        provider: 'vagaro',
        region:
          typeof parsed.region === 'string'
            ? parsed.region
            : typeof parsed.vagaro_region === 'string'
              ? parsed.vagaro_region
              : undefined,
        businessId:
          typeof parsed.business_id === 'string'
            ? parsed.business_id
            : typeof parsed.businessId === 'string'
              ? parsed.businessId
              : undefined,
        clientId:
          typeof parsed.client_id === 'string'
            ? parsed.client_id
            : typeof parsed.clientId === 'string'
              ? parsed.clientId
              : undefined,
        clientSecretKey:
          typeof parsed.client_secret_key === 'string'
            ? parsed.client_secret_key
            : typeof parsed.clientSecretKey === 'string'
              ? parsed.clientSecretKey
              : undefined,
        scope: typeof parsed.scope === 'string' ? parsed.scope : undefined,
        accessToken:
          typeof parsed.access_token === 'string'
            ? parsed.access_token
            : typeof parsed.accessToken === 'string'
              ? parsed.accessToken
              : undefined,
        expiresAt:
          typeof parsed.expires_at === 'string'
            ? parsed.expires_at
            : typeof parsed.expiresAt === 'string'
              ? parsed.expiresAt
              : undefined,
      };
    } catch {
      continue;
    }
  }

  return {};
}

export function encodeVagaroCredentials(input: VagaroCredentials): string {
  return JSON.stringify(input);
}

export async function generateVagaroAccessToken(params: {
  region: string;
  clientId: string;
  clientSecretKey: string;
  scope?: string;
  timeoutMs?: number;
}): Promise<{ accessToken: string; expiresAt?: string }> {
  const region = params.region.trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? vagaroTimeoutMs());
  try {
    const response = await fetch(
      `https://api.vagaro.com/${encodeURIComponent(region)}/api/v2/merchants/generate-access-token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          clientId: params.clientId,
          clientSecretKey: params.clientSecretKey,
          scope: params.scope?.trim() || 'read access',
        }),
      },
    );

    if (!response.ok) {
      const safeError = { status: response.status, path: response.url };
      throw new Error(`vagaro_generate_access_token_failed:${JSON.stringify(safeError)}`);
    }

    const payload = (await response.json()) as VagaroTokenResponse;
    const token = extractAccessToken(payload);
    if (!token) throw new Error('vagaro_generate_access_token_missing_token');
    return {
      accessToken: token,
      expiresAt: extractExpiresAt(payload),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function resolveVagaroCredentials(shop: Shop): VagaroCredentials {
  const parsed = parseVagaroCredentials(shop.google_cal_credentials_encrypted);
  const region = parsed.region?.trim() || process.env.VAGARO_REGION?.trim();
  const businessId = parsed.businessId?.trim() || process.env.VAGARO_BUSINESS_ID?.trim();
  if (!region || !businessId) {
    throw new Error('vagaro_calendar_missing_region_or_business_id');
  }

  return {
    provider: 'vagaro',
    region,
    businessId,
    clientId: parsed.clientId?.trim() || process.env.VAGARO_CLIENT_ID?.trim(),
    clientSecretKey: parsed.clientSecretKey?.trim() || process.env.VAGARO_CLIENT_SECRET_KEY?.trim(),
    scope: parsed.scope?.trim() || process.env.VAGARO_SCOPE?.trim() || 'read access',
    accessToken: parsed.accessToken?.trim() || process.env.VAGARO_ACCESS_TOKEN?.trim(),
    expiresAt: parsed.expiresAt,
  };
}

function vagaroTimeoutMs() {
  const raw = Number(process.env.CALENDAR_TIMEOUT_MS ?? 3000);
  if (!Number.isFinite(raw) || raw <= 0) return 3000;
  return Math.floor(raw);
}

function isTokenNearExpiry(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  const expires = DateTime.fromISO(expiresAt, { zone: 'utc' });
  if (!expires.isValid) return false;
  return expires.diffNow('seconds').seconds <= 120;
}

function extractAccessToken(payload: VagaroTokenResponse): string | null {
  return payload.accessToken ?? payload.access_token ?? payload.token ?? null;
}

function extractExpiresAt(payload: VagaroTokenResponse): string | undefined {
  const explicit = payload.expiresAt ?? payload.expires_at;
  if (explicit) return explicit;
  const expiresIn = payload.expiresIn ?? payload.expires_in;
  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0) {
    return DateTime.utc().plus({ seconds: expiresIn }).toISO() ?? undefined;
  }
  return undefined;
}

function unwrapVagaroResponse<T>(payload: VagaroApiEnvelope<T>): T {
  if (payload.data && typeof payload.data === 'object') return payload.data;
  if (payload.result && typeof payload.result === 'object') return payload.result;
  return payload as T;
}

function normalizeSlotDateTime(slot: VagaroAvailabilitySlot, timezone: string): DateTime | null {
  const raw = slot.startTime ?? slot.startDateTime ?? slot.appointmentDate;
  if (raw) {
    const parsed = DateTime.fromISO(raw, { zone: raw.endsWith('Z') ? 'utc' : timezone }).setZone(timezone);
    if (parsed.isValid) return parsed;
  }
  if (slot.time) {
    const parsed = DateTime.fromISO(slot.time, { zone: timezone });
    if (parsed.isValid) return parsed;
  }
  return null;
}

export class VagaroProvider implements CalendarProvider {
  readonly shop: Shop;
  private credentials: VagaroCredentials;
  private readonly baseUrl = 'https://api.vagaro.com';
  private readonly timeoutMs: number;
  private tokenInFlight: Promise<void> | null = null;

  constructor(
    shop: Shop,
    private readonly options?: {
      persistCredentials?: (encodedCredentials: string) => Promise<void>;
    },
  ) {
    this.shop = shop;
    this.credentials = resolveVagaroCredentials(shop);
    this.timeoutMs = vagaroTimeoutMs();
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async ensureAccessToken(force = false): Promise<void> {
    if (!force && this.credentials.accessToken && !isTokenNearExpiry(this.credentials.expiresAt)) return;
    if (this.tokenInFlight) {
      await this.tokenInFlight;
      return;
    }

    this.tokenInFlight = (async () => {
      if (!this.credentials.clientId || !this.credentials.clientSecretKey || !this.credentials.scope) {
        if (this.credentials.accessToken) return;
        throw new Error('vagaro_access_token_not_configured');
      }

      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/${encodeURIComponent(this.credentials.region)}/api/v2/merchants/generate-access-token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: this.credentials.clientId,
            clientSecretKey: this.credentials.clientSecretKey,
            scope: this.credentials.scope,
          }),
        },
      );

      if (!response.ok) {
        const safeError = { status: response.status, path: response.url };
        throw new Error(`vagaro_generate_access_token_failed:${JSON.stringify(safeError)}`);
      }

      const payload = (await response.json()) as VagaroTokenResponse;
      const token = extractAccessToken(payload);
      if (!token) throw new Error('vagaro_generate_access_token_missing_token');
      this.credentials.accessToken = token;
      this.credentials.expiresAt = extractExpiresAt(payload);
      await this.options?.persistCredentials?.(encodeVagaroCredentials(this.credentials));
    })();

    try {
      await this.tokenInFlight;
    } finally {
      this.tokenInFlight = null;
    }
  }

  private async vagaroJsonRequest<T>(params: {
    path: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown>;
    query?: Record<string, string | number | undefined>;
    retryOnAuth?: boolean;
  }): Promise<T> {
    await this.ensureAccessToken(false);
    const url = new URL(`${this.baseUrl}/${encodeURIComponent(this.credentials.region)}${params.path}`);
    for (const [key, value] of Object.entries(params.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const request = async () =>
      this.fetchWithTimeout(url.toString(), {
        method: params.method ?? 'POST',
        headers: {
          accessToken: this.credentials.accessToken ?? '',
          'Content-Type': 'application/json',
        },
        body: params.body ? JSON.stringify(params.body) : undefined,
      });

    let response = await request();
    if (response.status === 401 && params.retryOnAuth !== false) {
      await this.ensureAccessToken(true);
      response = await request();
    }

    if (!response.ok) {
      const safeError = { status: response.status, path: response.url };
      throw new Error(`vagaro_request_failed:${JSON.stringify(safeError)}`);
    }

    const payload = (await response.json()) as VagaroApiEnvelope<T>;
    if (payload.errors || payload.error) {
      throw new Error(`vagaro_request_error:${JSON.stringify(payload.errors ?? payload.error)}`);
    }
    return unwrapVagaroResponse(payload);
  }

  async prefetchAvailability(params: { date: string; timezone: string }): Promise<void> {
    await this.searchAvailability({ date: params.date, timezone: params.timezone });
  }

  async searchAvailability(params: {
    date: string;
    timezone: string;
    serviceId?: string;
    staffId?: string;
  }): Promise<VagaroAvailabilityResponse> {
    const start = DateTime.fromISO(`${params.date}T00:00:00`, { zone: params.timezone });
    if (!start.isValid) throw new Error('vagaro_availability_invalid_date');

    // TODO(vagaro): Public docs do not expose full request body fields for availability.
    // Keep field names explicit and easy to adjust once Vagaro supplies partner examples.
    return this.vagaroJsonRequest<VagaroAvailabilityResponse>({
      path: '/api/v2/appointments/availability',
      method: 'POST',
      body: {
        businessId: this.credentials.businessId,
        serviceId: params.serviceId,
        serviceProviderId: params.staffId,
        startDate: start.toFormat('yyyy-LL-dd'),
        endDate: start.toFormat('yyyy-LL-dd'),
      },
    });
  }

  async checkAvailability(params: {
    date: string;
    time: string;
    durationMin: number;
    techName?: string;
    timezone: string;
  }): Promise<{ available: boolean; suggestions?: TimeSlot[] }> {
    const requestedStart = DateTime.fromISO(`${params.date}T${params.time}:00`, { zone: params.timezone });
    if (!requestedStart.isValid) throw new Error('vagaro_availability_invalid_datetime');

    const response = await this.searchAvailability({ date: params.date, timezone: params.timezone });
    const slots = response.availability ?? response.availabilities ?? response.slots ?? [];
    const requestedIso = requestedStart.toFormat("yyyy-LL-dd'T'HH:mm");
    const suggestions: TimeSlot[] = [];

    for (const slot of slots) {
      const slotStart = normalizeSlotDateTime(slot, params.timezone);
      if (!slotStart) continue;
      const normalized = slotStart.toFormat("yyyy-LL-dd'T'HH:mm");
      if (normalized === requestedIso) return { available: true };
      if (suggestions.length < 3) {
        suggestions.push({
          date: slotStart.toFormat('yyyy-LL-dd'),
          time: slotStart.toFormat('HH:mm'),
          techName: slot.serviceProviderName ?? slot.employeeName ?? params.techName,
        });
      }
    }

    return {
      available: false,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  async retrieveAppointments(params: {
    appointmentId?: string;
    customerId?: string;
    pageNumber?: number;
    pageSize?: number;
    orderBy?: 'asc' | 'desc';
  }): Promise<VagaroAppointmentsResponse> {
    return this.vagaroJsonRequest<VagaroAppointmentsResponse>({
      path: '/api/v2/appointments',
      method: 'POST',
      query: {
        pageNumber: params.pageNumber,
        pageSize: params.pageSize,
        orderBy: params.orderBy,
      },
      body: {
        businessId: this.credentials.businessId,
        appointmentId: params.appointmentId,
        customerId: params.customerId,
      },
    });
  }

  async retrieveCustomer(customerId: string): Promise<VagaroCustomerResponse> {
    return this.vagaroJsonRequest<VagaroCustomerResponse>({
      path: '/api/v2/customers',
      method: 'POST',
      body: {
        businessId: this.credentials.businessId,
        customerId,
      },
    });
  }

  async getCustomerByPhone(_phoneNumber: string): Promise<VagaroCustomer | null> {
    throw new Error(
      'vagaro_not_supported: getCustomerByPhone is not ' +
        'available in Vagaro public API. ' +
        'Caller identification requires manual lookup ' +
        'in Vagaro dashboard.',
    );
  }

  async getServices(): Promise<VagaroService[]> {
    const response = await this.vagaroJsonRequest<VagaroServicesResponse>({
      path: '/api/v2/services',
      method: 'POST',
      body: {
        businessId: this.credentials.businessId,
      },
    });
    return response.services ?? response.serviceList ?? [];
  }

  async getStaff(): Promise<VagaroEmployee[]> {
    const response = await this.vagaroJsonRequest<VagaroEmployeesResponse>({
      path: '/api/v2/employees',
      method: 'POST',
      body: {
        businessId: this.credentials.businessId,
      },
    });
    return response.employees ?? response.serviceProviders ?? [];
  }

  async getConnectionOptions(): Promise<VagaroConnectionOptions> {
    const [services, staff] = await Promise.all([this.getServices(), this.getStaff()]);
    return {
      services,
      staff,
      capabilityNote: 'Availability checking supported. Booking creation requires Vagaro app.',
    };
  }

  async createBooking(_input: BookingInput): Promise<BookingResult> {
    throw new Error(VAGARO_UNSUPPORTED_WRITE_ERROR);
  }

  async cancelBooking(_params: { bookingId: string; reason?: string; idempotencyKey: string }): Promise<void> {
    throw new Error(VAGARO_UNSUPPORTED_WRITE_ERROR);
  }

  async rescheduleBooking(_params: {
    bookingId: string;
    newDate: string;
    newTime: string;
    timezone: string;
    idempotencyKey: string;
  }): Promise<BookingResult> {
    throw new Error(VAGARO_UNSUPPORTED_WRITE_ERROR);
  }
}
