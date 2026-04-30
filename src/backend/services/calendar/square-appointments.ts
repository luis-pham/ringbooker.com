import { DateTime } from 'luxon';

import type { BookingInput, BookingResult, Shop, TimeSlot } from '@/src/backend/domain/types';
import type { CalendarProvider } from '@/src/backend/services/calendar/types';

type SquareCredentials = {
  accessToken: string;
  refreshToken: string;
  expiresAt?: string;
  locationId: string;
  serviceVariationId: string;
  teamMemberId?: string;
};

type SquareErrorItem = {
  category?: string;
  code?: string;
  detail?: string;
};

type SquareAvailabilitySegment = {
  duration_minutes?: number;
  team_member_id?: string;
  service_variation_id?: string;
};

type SquareAvailability = {
  start_at?: string;
  location_id?: string;
  appointment_segments?: SquareAvailabilitySegment[];
};

type SquareSearchAvailabilityResponse = {
  availabilities?: SquareAvailability[];
  errors?: SquareErrorItem[];
};

type SquareBooking = {
  id?: string;
  version?: number;
  status?: string;
  location_id?: string;
  customer_id?: string;
  start_at?: string;
  appointment_segments?: Array<{
    duration_minutes?: number;
    team_member_id?: string;
    service_variation_id?: string;
    service_variation_version?: number;
  }>;
};

type SquareBookingResponse = {
  booking?: SquareBooking;
  errors?: SquareErrorItem[];
};

type SquareCustomer = {
  id?: string;
  phone_number?: string;
  given_name?: string;
};

export interface SquareTeamMember {
  id: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
}

type SquareTeamMemberApiItem = {
  id?: string;
  display_name?: string;
  given_name?: string;
  family_name?: string;
};

type SquareSearchCustomersResponse = {
  customers?: SquareCustomer[];
  errors?: SquareErrorItem[];
};

type SquareCreateCustomerResponse = {
  customer?: SquareCustomer;
  errors?: SquareErrorItem[];
};

type SquareTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
};

type SquareTeamMembersResponse = {
  team_members?: SquareTeamMemberApiItem[];
  errors?: SquareErrorItem[];
};

function parseSquareCredentials(raw: string | null | undefined): Partial<SquareCredentials> {
  if (!raw) return {};
  const candidates = [raw];
  try {
    candidates.push(Buffer.from(raw, 'base64').toString('utf-8'));
  } catch {
    // ignore
  }

  for (const item of candidates) {
    try {
      const parsed = JSON.parse(item) as Record<string, unknown>;
      const provider = typeof parsed.provider === 'string' ? parsed.provider.trim().toLowerCase() : '';
      if (provider && provider !== 'square_appointments') continue;
      return {
        accessToken:
          typeof parsed.access_token === 'string'
            ? parsed.access_token
            : typeof parsed.accessToken === 'string'
              ? parsed.accessToken
              : undefined,
        refreshToken:
          typeof parsed.refresh_token === 'string'
            ? parsed.refresh_token
            : typeof parsed.refreshToken === 'string'
              ? parsed.refreshToken
              : undefined,
        expiresAt:
          typeof parsed.expires_at === 'string'
            ? parsed.expires_at
            : typeof parsed.expiresAt === 'string'
              ? parsed.expiresAt
              : undefined,
        locationId:
          typeof parsed.location_id === 'string'
            ? parsed.location_id
            : typeof parsed.locationId === 'string'
              ? parsed.locationId
              : undefined,
        serviceVariationId:
          typeof parsed.service_variation_id === 'string'
            ? parsed.service_variation_id
            : typeof parsed.serviceVariationId === 'string'
              ? parsed.serviceVariationId
              : undefined,
        teamMemberId:
          typeof parsed.team_member_id === 'string'
            ? parsed.team_member_id
            : typeof parsed.teamMemberId === 'string'
              ? parsed.teamMemberId
              : undefined,
      };
    } catch {
      continue;
    }
  }

  return {};
}

function resolveSquareCredentials(shop: Shop): SquareCredentials {
  const fromShop = parseSquareCredentials(shop.google_cal_credentials_encrypted);
  if (
    !fromShop.accessToken ||
    !fromShop.refreshToken ||
    !fromShop.locationId ||
    !fromShop.serviceVariationId
  ) {
    throw new Error('square_calendar_missing_credentials');
  }
  return {
    accessToken: fromShop.accessToken,
    refreshToken: fromShop.refreshToken,
    expiresAt: fromShop.expiresAt,
    locationId: fromShop.locationId,
    serviceVariationId: fromShop.serviceVariationId,
    teamMemberId: fromShop.teamMemberId,
  };
}

function squareApiBaseUrl() {
  const env = process.env.SQUARE_ENVIRONMENT?.trim().toLowerCase();
  if (env === 'sandbox') return 'https://connect.squareupsandbox.com';
  return 'https://connect.squareup.com';
}

function squareApiVersion() {
  return process.env.SQUARE_API_VERSION?.trim() || '2026-01-22';
}

function squareTimeoutMs() {
  const raw = Number(process.env.CALENDAR_TIMEOUT_MS ?? 3000);
  if (!Number.isFinite(raw) || raw <= 0) return 3000;
  return Math.floor(raw);
}

function extractSquareError(errors?: SquareErrorItem[]): string {
  if (!errors || errors.length === 0) return 'unknown_square_error';
  const first = errors[0];
  return `${first.category ?? 'unknown'}:${first.code ?? 'unknown'}:${first.detail ?? 'no_detail'}`;
}

function isUnauthorizedStatus(status: number): boolean {
  return status === 401 || status === 403;
}

function isTokenNearExpiry(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  const expires = DateTime.fromISO(expiresAt, { zone: 'utc' });
  if (!expires.isValid) return false;
  return expires.diffNow('seconds').seconds <= 120;
}

function normalizeTeamMemberName(name: string): string {
  return name.trim().toLowerCase();
}

export class SquareAppointmentsProvider implements CalendarProvider {
  readonly shop: Shop;
  private credentials: SquareCredentials;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private refreshInFlight: Promise<void> | null = null;
  private teamMembersCache: { items: SquareTeamMember[]; fetchedAtMs: number } | null = null;

  constructor(shop: Shop) {
    this.shop = shop;
    this.credentials = resolveSquareCredentials(shop);
    this.baseUrl = squareApiBaseUrl();
    this.timeoutMs = squareTimeoutMs();
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

  private async refreshAccessTokenIfNeeded(force = false): Promise<void> {
    if (!force && !isTokenNearExpiry(this.credentials.expiresAt)) return;
    if (this.refreshInFlight) {
      await this.refreshInFlight;
      return;
    }

    this.refreshInFlight = (async () => {
      const appId = process.env.SQUARE_APPLICATION_ID?.trim();
      const appSecret = process.env.SQUARE_APPLICATION_SECRET?.trim();
      if (!appId || !appSecret) {
        throw new Error('square_oauth_refresh_not_configured');
      }

      const response = await this.fetchWithTimeout(`${this.baseUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Square-Version': squareApiVersion(),
        },
        body: JSON.stringify({
          client_id: appId,
          client_secret: appSecret,
          grant_type: 'refresh_token',
          refresh_token: this.credentials.refreshToken,
        }),
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(`square_oauth_refresh_failed:${response.status}:${bodyText}`);
      }

      const payload = (await response.json()) as SquareTokenResponse;
      if (!payload.access_token) {
        throw new Error('square_oauth_refresh_missing_access_token');
      }
      this.credentials.accessToken = payload.access_token;
      if (payload.refresh_token) {
        this.credentials.refreshToken = payload.refresh_token;
      }
      if (payload.expires_at) {
        this.credentials.expiresAt = payload.expires_at;
      }
    })();

    try {
      await this.refreshInFlight;
    } finally {
      this.refreshInFlight = null;
    }
  }

  private async squareJsonRequest<T>(params: {
    path: string;
    method: 'GET' | 'POST' | 'PUT';
    body?: Record<string, unknown>;
    retryOnAuth?: boolean;
  }): Promise<T> {
    await this.refreshAccessTokenIfNeeded(false);
    const response = await this.fetchWithTimeout(`${this.baseUrl}${params.path}`, {
      method: params.method,
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': squareApiVersion(),
      },
      body: params.body ? JSON.stringify(params.body) : undefined,
    });

    if (response.ok) {
      if (response.status === 204) {
        return {} as T;
      }
      return (await response.json()) as T;
    }

    if (params.retryOnAuth !== false && isUnauthorizedStatus(response.status)) {
      await this.refreshAccessTokenIfNeeded(true);
      const retried = await this.fetchWithTimeout(`${this.baseUrl}${params.path}`, {
        method: params.method,
        headers: {
          Authorization: `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': squareApiVersion(),
        },
        body: params.body ? JSON.stringify(params.body) : undefined,
      });
      if (retried.ok) {
        if (retried.status === 204) {
          return {} as T;
        }
        return (await retried.json()) as T;
      }
      const retryBody = await retried.text().catch(() => '');
      throw new Error(`square_request_failed_after_refresh:${retried.status}:${retryBody}`);
    }

    const bodyText = await response.text().catch(() => '');
    throw new Error(`square_request_failed:${response.status}:${bodyText}`);
  }

  private async findOrCreateCustomerId(phone: string, customerName?: string): Promise<string> {
    const search = await this.squareJsonRequest<SquareSearchCustomersResponse>({
      path: '/v2/customers/search',
      method: 'POST',
      body: {
        limit: 1,
        query: {
          filter: {
            phone_number: {
              exact: phone,
            },
          },
        },
      },
    });

    const existing = search.customers?.[0]?.id;
    if (existing) return existing;

    const create = await this.squareJsonRequest<SquareCreateCustomerResponse>({
      path: '/v2/customers',
      method: 'POST',
      body: {
        phone_number: phone,
        given_name: customerName?.trim() || undefined,
      },
    });
    const createdId = create.customer?.id;
    if (!createdId) {
      throw new Error(`square_customer_create_failed:${extractSquareError(create.errors)}`);
    }
    return createdId;
  }

  async getTeamMembers(): Promise<SquareTeamMember[]> {
    const now = Date.now();
    if (this.teamMembersCache && now - this.teamMembersCache.fetchedAtMs < 5 * 60 * 1000) {
      return this.teamMembersCache.items;
    }

    try {
      const response = await this.squareJsonRequest<SquareTeamMembersResponse>({
        path: '/v2/team-members?status=ACTIVE',
        method: 'GET',
      });

      if (response.errors?.length) {
        console.warn(`Square team member lookup failed: ${extractSquareError(response.errors)}`);
        return [];
      }

      const items: SquareTeamMember[] = [];
      for (const member of response.team_members ?? []) {
        if (!member.id) continue;
        const displayName = member.display_name?.trim() || [member.given_name, member.family_name].filter(Boolean).join(' ').trim();
        if (!displayName) continue;
        items.push({
          id: member.id,
          displayName,
          ...(member.given_name ? { givenName: member.given_name } : {}),
          ...(member.family_name ? { familyName: member.family_name } : {}),
        });
      }

      this.teamMembersCache = {
        items,
        fetchedAtMs: now,
      };
      return items;
    } catch (error) {
      console.warn(`Square team member lookup failed: ${error instanceof Error ? error.message : 'unknown_error'}`);
      return [];
    }
  }

  async findTeamMemberByName(name: string): Promise<string | null> {
    const requested = normalizeTeamMemberName(name);
    if (!requested) return null;

    const members = await this.getTeamMembers();
    const match =
      members.find((member) => normalizeTeamMemberName(member.displayName) === requested) ??
      members.find((member) => normalizeTeamMemberName(member.displayName).includes(requested)) ??
      members.find((member) => member.givenName && normalizeTeamMemberName(member.givenName) === requested) ??
      members.find((member) => member.familyName && normalizeTeamMemberName(member.familyName) === requested) ??
      null;

    if (match) {
      console.warn(`Team member found: ${name} -> ${match.id}`);
      return match.id;
    }

    console.warn(`Team member not found: ${name}`);
    return null;
  }

  private buildAvailabilityWindow(date: string, timezone: string): { startAt: string; endAt: string } {
    const start = DateTime.fromISO(`${date}T00:00:00`, { zone: timezone });
    if (!start.isValid) {
      throw new Error('square_availability_invalid_date');
    }
    const end = start.plus({ days: 1 });
    return {
      startAt: start.toUTC().toISO()!,
      endAt: end.toUTC().toISO()!,
    };
  }

  async prefetchAvailability(params: { date: string; timezone: string }): Promise<void> {
    const window = this.buildAvailabilityWindow(params.date, params.timezone);
    const resolvedTeamMemberId = this.credentials.teamMemberId;
    await this.squareJsonRequest<SquareSearchAvailabilityResponse>({
      path: '/v2/bookings/availability/search',
      method: 'POST',
      body: {
        query: {
          filter: {
            start_at_range: {
              start_at: window.startAt,
              end_at: window.endAt,
            },
            location_id: this.credentials.locationId,
            segment_filters: [
              {
                service_variation_id: this.credentials.serviceVariationId,
                ...(resolvedTeamMemberId
                  ? {
                      team_member_id_filter: {
                        any: [resolvedTeamMemberId],
                      },
                    }
                  : {}),
              },
            ],
          },
        },
      },
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
    if (!requestedStart.isValid) {
      throw new Error('square_availability_invalid_datetime');
    }

    const window = this.buildAvailabilityWindow(params.date, params.timezone);
    const resolvedTeamMemberId = params.teamMemberId ?? this.credentials.teamMemberId;
    const response = await this.squareJsonRequest<SquareSearchAvailabilityResponse>({
      path: '/v2/bookings/availability/search',
      method: 'POST',
      body: {
        query: {
          filter: {
            start_at_range: {
              start_at: window.startAt,
              end_at: window.endAt,
            },
            location_id: this.credentials.locationId,
            segment_filters: [
              {
                service_variation_id: this.credentials.serviceVariationId,
                ...(resolvedTeamMemberId
                  ? {
                      team_member_id_filter: {
                        any: [resolvedTeamMemberId],
                      },
                    }
                  : {}),
              },
            ],
          },
        },
      },
    });

    if (response.errors?.length) {
      throw new Error(`square_search_availability_failed:${extractSquareError(response.errors)}`);
    }

    const availabilities = response.availabilities ?? [];
    const requestedIso = requestedStart.toUTC().toISO();
    const exact = availabilities.find((slot) => slot.start_at === requestedIso);
    if (exact) {
      return { available: true };
    }

    const suggestions: TimeSlot[] = [];
    for (const slot of availabilities.slice(0, 6)) {
      const start = slot.start_at ? DateTime.fromISO(slot.start_at, { zone: 'utc' }).setZone(params.timezone) : null;
      if (!start || !start.isValid) continue;
      suggestions.push({
        date: start.toFormat('yyyy-LL-dd'),
        time: start.toFormat('HH:mm'),
        techName: params.techName,
      });
      if (suggestions.length >= 3) break;
    }

    return {
      available: false,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  async createBooking(input: BookingInput): Promise<BookingResult> {
    const customerId = await this.findOrCreateCustomerId(input.customerPhone, input.customerName);
    const resolvedTeamMemberId = input.teamMemberId ?? this.credentials.teamMemberId;
    const response = await this.squareJsonRequest<SquareBookingResponse>({
      path: '/v2/bookings',
      method: 'POST',
      body: {
        idempotency_key: input.idempotencyKey,
        booking: {
          customer_id: customerId,
          location_id: this.credentials.locationId,
          start_at: input.datetimeIso,
          customer_note: input.notes ?? '',
          appointment_segments: [
            {
              duration_minutes: input.durationMin,
              service_variation_id: this.credentials.serviceVariationId,
              ...(resolvedTeamMemberId ? { team_member_id: resolvedTeamMemberId } : {}),
            },
          ],
        },
      },
    });

    if (response.errors?.length) {
      throw new Error(`square_create_booking_failed:${extractSquareError(response.errors)}`);
    }
    const bookingId = response.booking?.id;
    if (!bookingId) {
      throw new Error('square_create_booking_missing_id');
    }

    return {
      bookingId,
      calendarEventId: bookingId,
      confirmed: response.booking?.status ? response.booking.status !== 'PENDING' : true,
    };
  }

  async cancelBooking(params: { bookingId: string; reason?: string; idempotencyKey: string }): Promise<void> {
    const current = await this.squareJsonRequest<SquareBookingResponse>({
      path: `/v2/bookings/${encodeURIComponent(params.bookingId)}`,
      method: 'GET',
    });
    const version = current.booking?.version;
    if (typeof version !== 'number') {
      throw new Error('square_cancel_missing_booking_version');
    }

    const cancelResponse = await this.squareJsonRequest<SquareBookingResponse>({
      path: `/v2/bookings/${encodeURIComponent(params.bookingId)}/cancel`,
      method: 'POST',
      body: {
        booking_version: version,
      },
    });

    if (cancelResponse.errors?.length) {
      throw new Error(`square_cancel_booking_failed:${extractSquareError(cancelResponse.errors)}`);
    }
  }

  async rescheduleBooking(params: {
    bookingId: string;
    newDate: string;
    newTime: string;
    timezone: string;
    idempotencyKey: string;
  }): Promise<BookingResult> {
    const localStart = DateTime.fromISO(`${params.newDate}T${params.newTime}:00`, { zone: params.timezone });
    if (!localStart.isValid) {
      throw new Error('square_reschedule_invalid_datetime');
    }

    const current = await this.squareJsonRequest<SquareBookingResponse>({
      path: `/v2/bookings/${encodeURIComponent(params.bookingId)}`,
      method: 'GET',
    });

    const booking = current.booking;
    if (!booking?.id || typeof booking.version !== 'number') {
      throw new Error('square_reschedule_missing_current_booking');
    }

    const updateResponse = await this.squareJsonRequest<SquareBookingResponse>({
      path: `/v2/bookings/${encodeURIComponent(params.bookingId)}`,
      method: 'PUT',
      body: {
        idempotency_key: params.idempotencyKey,
        booking: {
          version: booking.version,
          start_at: localStart.toUTC().toISO(),
          location_id: booking.location_id ?? this.credentials.locationId,
          appointment_segments:
            booking.appointment_segments && booking.appointment_segments.length > 0
              ? booking.appointment_segments
              : [
                  {
                    duration_minutes: 60,
                    service_variation_id: this.credentials.serviceVariationId,
                    ...(this.credentials.teamMemberId ? { team_member_id: this.credentials.teamMemberId } : {}),
                  },
                ],
        },
      },
    });

    if (updateResponse.errors?.length) {
      throw new Error(`square_reschedule_booking_failed:${extractSquareError(updateResponse.errors)}`);
    }

    return {
      bookingId: params.bookingId,
      calendarEventId: updateResponse.booking?.id ?? params.bookingId,
      confirmed: updateResponse.booking?.status ? updateResponse.booking.status !== 'PENDING' : true,
    };
  }
}
