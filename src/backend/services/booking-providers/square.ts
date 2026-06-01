import { DateTime } from 'luxon';

import type { AvailabilityCheckResult, AvailabilityStaffResolution, BookingInput, BookingResult, Shop, TimeSlot } from '@/src/backend/domain/types';
import { matchServiceFromCallerText } from '@/src/backend/domain/service-catalog';
import { logger } from '@/src/backend/observability/logger';
import type { BookingProvider } from '@/src/backend/services/booking-providers/types';
import { decrypt } from '@/src/backend/services/crypto/encrypt';

type SquareCredentials = {
  accessToken: string;
  refreshToken: string;
  expiresAt?: string;
  locationId: string;
  serviceVariationId?: string;
  serviceVariationVersion?: number;
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
  cursor?: string;
  errors?: SquareErrorItem[];
};

type SquareCatalogObject = {
  id?: string;
  type?: string;
  version?: number;
  is_deleted?: boolean;
  item_data?: {
    name?: string;
  };
  item_variation_data?: {
    name?: string;
    item_id?: string;
    available_for_booking?: boolean;
    service_duration?: number;
    price_money?: { amount?: number; currency?: string };
  };
};

type SquareCatalogSearchResponse = {
  objects?: SquareCatalogObject[];
  related_objects?: SquareCatalogObject[];
  cursor?: string;
  errors?: SquareErrorItem[];
};

type SquareResolvedVariation = {
  variationId: string;
  version?: number;
};

type SquareResolvedAvailabilitySlot = {
  startAt: string;
  teamMemberId: string | null;
  teamMemberName: string | null;
};

function parseSquareCredentials(raw: string | null | undefined): Partial<SquareCredentials> {
  if (!raw) return {};
  const candidates = [raw];
  try {
    candidates.push(decrypt(raw));
  } catch {
    // ignore encrypted credentials if the key is unavailable in this process
  }
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
        serviceVariationVersion:
          typeof parsed.service_variation_version === 'number'
            ? parsed.service_variation_version
            : typeof parsed.serviceVariationVersion === 'number'
              ? parsed.serviceVariationVersion
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
    !fromShop.locationId
  ) {
    throw new Error('square_calendar_missing_credentials');
  }
  return {
    accessToken: fromShop.accessToken,
    refreshToken: fromShop.refreshToken,
    expiresAt: fromShop.expiresAt,
    locationId: fromShop.locationId,
    serviceVariationId: fromShop.serviceVariationId,
    serviceVariationVersion: fromShop.serviceVariationVersion,
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

// M1: increased from 120s → 300s so a slow refresh never races against expiry
function isTokenNearExpiry(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  const expires = DateTime.fromISO(expiresAt, { zone: 'utc' });
  if (!expires.isValid) return false;
  return expires.diffNow('seconds').seconds <= 300;
}

function normalizeTeamMemberName(name: string): string {
  return name.trim().toLowerCase();
}

function isSquareExternalProvider(provider?: string | null): boolean {
  return provider === 'square' || provider === 'square_appointments';
}

function coercePositiveVersion(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  }
  return undefined;
}

function squareCatalogServiceName(
  item: SquareCatalogObject,
  parentItemsById: Map<string, SquareCatalogObject>,
): string {
  const variationName = item.item_variation_data?.name?.trim();
  const parentItemId = item.item_variation_data?.item_id;
  const itemName = parentItemId ? parentItemsById.get(parentItemId)?.item_data?.name?.trim() : undefined;
  const genericVariation = variationName && /^(regular|standard|default)$/i.test(variationName);
  if (itemName && variationName && !genericVariation && itemName.toLowerCase() !== variationName.toLowerCase()) {
    return `${itemName} ${variationName}`;
  }
  return itemName || variationName || item.id || 'Service';
}

// H1: encode refreshed credentials so the caller can persist them to the DB
function encodeRefreshedCredentials(c: SquareCredentials): string {
  return Buffer.from(
    JSON.stringify({
      provider: 'square_appointments',
      access_token: c.accessToken,
      refresh_token: c.refreshToken,
      expires_at: c.expiresAt,
      location_id: c.locationId,
      service_variation_id: c.serviceVariationId,
      service_variation_version: c.serviceVariationVersion,
      team_member_id: c.teamMemberId,
    }),
  ).toString('base64');
}

export class SquareAppointmentsProvider implements BookingProvider {
  readonly shop: Shop;
  private credentials: SquareCredentials;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private refreshInFlight: Promise<void> | null = null;
  private teamMembersCache: { items: SquareTeamMember[]; fetchedAtMs: number } | null = null;
  // H1: optional callback to persist refreshed tokens to DB
  private readonly onCredentialsRefreshed?: (encodedCredentials: string) => Promise<void>;

  constructor(shop: Shop, options?: { persistCredentials?: (encodedCredentials: string) => Promise<void> }) {
    this.shop = shop;
    this.credentials = resolveSquareCredentials(shop);
    this.baseUrl = squareApiBaseUrl();
    this.timeoutMs = squareTimeoutMs();
    this.onCredentialsRefreshed = options?.persistCredentials;
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

      // H1: persist refreshed token to DB so next cold-start doesn't use stale credentials
      if (this.onCredentialsRefreshed) {
        const encoded = encodeRefreshedCredentials(this.credentials);
        this.onCredentialsRefreshed(encoded).catch((err: unknown) => {
          logger.warn({ err, shopId: this.shop.id }, 'square_token_persist_failed');
        });
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

    const makeRequest = () =>
      this.fetchWithTimeout(`${this.baseUrl}${params.path}`, {
        method: params.method,
        headers: {
          Authorization: `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': squareApiVersion(),
        },
        body: params.body ? JSON.stringify(params.body) : undefined,
      });

    const response = await makeRequest();

    if (response.ok) {
      return response.status === 204 ? ({} as T) : ((await response.json()) as T);
    }

    // H2: retry once after Retry-After delay on rate limit
    if (response.status === 429) {
      const retryAfterMs = Math.min(Number(response.headers.get('Retry-After') ?? '1') * 1000, 8000);
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
      const retried = await makeRequest();
      if (retried.ok) {
        return retried.status === 204 ? ({} as T) : ((await retried.json()) as T);
      }
      const rateLimitBody = await retried.text().catch(() => '');
      throw new Error(`square_rate_limit_retry_failed:${retried.status}:${rateLimitBody}`);
    }

    if (params.retryOnAuth !== false && isUnauthorizedStatus(response.status)) {
      await this.refreshAccessTokenIfNeeded(true);
      const retried = await makeRequest();
      if (retried.ok) {
        return retried.status === 204 ? ({} as T) : ((await retried.json()) as T);
      }
      const retryBody = await retried.text().catch(() => '');
      throw new Error(`square_request_failed_after_refresh:${retried.status}:${retryBody}`);
    }

    const bodyText = await response.text().catch(() => '');
    throw new Error(`square_request_failed:${response.status}:${bodyText}`);
  }

  // C2 + M3: idempotency key prevents duplicate customers; DUPLICATE_VALUE handles race condition
  private async findOrCreateCustomerId(
    phone: string,
    customerName?: string,
    idempotencyKey?: string,
  ): Promise<string> {
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
        ...(idempotencyKey ? { idempotency_key: `${idempotencyKey}:customer` } : {}),
      },
    });

    const createdId = create.customer?.id;
    if (createdId) return createdId;

    // M3: concurrent calls with same phone → DUPLICATE_VALUE → search again
    const isDuplicate = create.errors?.some((e) => e.code === 'DUPLICATE_VALUE');
    if (isDuplicate) {
      const retry = await this.squareJsonRequest<SquareSearchCustomersResponse>({
        path: '/v2/customers/search',
        method: 'POST',
        body: { limit: 1, query: { filter: { phone_number: { exact: phone } } } },
      });
      const found = retry.customers?.[0]?.id;
      if (found) return found;
    }

    throw new Error(`square_customer_create_failed:${extractSquareError(create.errors)}`);
  }

  private resolveMappedServiceVariation(matchedServiceId?: string | null): SquareResolvedVariation | null {
    if (!matchedServiceId) return null;
    const service = this.shop.service_catalog?.services.find((item) => item.id === matchedServiceId);
    if (!service?.externalServiceId || !isSquareExternalProvider(service.externalProvider)) return null;

    return {
      variationId: service.externalServiceId,
      version: coercePositiveVersion(
        service.externalMetadata?.variation_version ??
          service.externalMetadata?.service_variation_version ??
          service.externalMetadata?.version,
      ),
    };
  }

  private async fetchBookableServiceVariations(): Promise<Array<SquareResolvedVariation & { name: string }>> {
    const items: SquareCatalogObject[] = [];
    let cursor: string | undefined;
    const maxPages = 20;

    for (let page = 0; page < maxPages; page++) {
      const response = await this.squareJsonRequest<SquareCatalogSearchResponse>({
        path: '/v2/catalog/search',
        method: 'POST',
        body: {
          include_related_objects: true,
          object_types: ['ITEM_VARIATION'],
          limit: 100,
          ...(cursor ? { cursor } : {}),
        },
      });

      if (response.errors?.length) {
        throw new Error(`square_catalog_search_failed:${extractSquareError(response.errors)}`);
      }

      items.push(...(response.objects ?? []), ...(response.related_objects ?? []));
      cursor = response.cursor;
      if (!cursor) break;
    }

    const parentItemsById = new Map(
      items
        .filter((item) => item.type === 'ITEM' && item.id)
        .map((item) => [item.id as string, item]),
    );

    return items
      .filter(
        (item) =>
          item.type === 'ITEM_VARIATION' &&
          item.id &&
          !item.is_deleted &&
          item.item_variation_data?.available_for_booking === true,
      )
      .map((item) => ({
        variationId: item.id as string,
        version: coercePositiveVersion(item.version),
        name: squareCatalogServiceName(item, parentItemsById),
      }));
  }

  private async fetchAndMatchVariation(
    matchedServiceId?: string | null,
    serviceName?: string,
  ): Promise<SquareResolvedVariation | null> {
    if (!matchedServiceId || !this.shop.service_catalog?.services.length) return null;

    const variations = await this.fetchBookableServiceVariations();
    for (const variation of variations) {
      const match = matchServiceFromCallerText({
        shopServiceCatalog: this.shop.service_catalog,
        callerText: variation.name,
        vertical: this.shop.vertical ?? null,
      });
      if (match.matchedServiceId === matchedServiceId && match.confidence >= 0.72) {
        return {
          variationId: variation.variationId,
          version: variation.version,
        };
      }
    }

    if (serviceName) {
      const direct = variations.find((variation) => variation.name.trim().toLowerCase() === serviceName.trim().toLowerCase());
      if (direct) {
        return {
          variationId: direct.variationId,
          version: direct.version,
        };
      }
    }

    return null;
  }

  private async resolveSquareVariationId(
    matchedServiceId?: string | null,
    serviceName?: string,
  ): Promise<SquareResolvedVariation | null> {
    const mapped = this.resolveMappedServiceVariation(matchedServiceId);
    if (mapped) return mapped;

    if (this.credentials.serviceVariationId) {
      return {
        variationId: this.credentials.serviceVariationId,
        version: this.credentials.serviceVariationVersion,
      };
    }

    return this.fetchAndMatchVariation(matchedServiceId, serviceName);
  }

  private async requireSquareVariationId(
    matchedServiceId?: string | null,
    serviceName?: string,
  ): Promise<SquareResolvedVariation> {
    const resolved = await this.resolveSquareVariationId(matchedServiceId, serviceName);
    if (resolved) return resolved;

    logger.warn(
      {
        matchedServiceId: matchedServiceId ?? null,
        shopId: this.shop.id,
      },
      'square_variation_missing',
    );
    throw new Error('square_service_variation_not_found');
  }

  async getTeamMembers(): Promise<SquareTeamMember[]> {
    const now = Date.now();
    if (this.teamMembersCache && now - this.teamMembersCache.fetchedAtMs < 5 * 60 * 1000) {
      return this.teamMembersCache.items;
    }

    try {
      const items: SquareTeamMember[] = [];
      let cursor: string | undefined;
      do {
        const response = await this.squareJsonRequest<SquareTeamMembersResponse>({
          path: '/v2/team-members/search',
          method: 'POST',
          body: {
            limit: 200,
            ...(cursor ? { cursor } : {}),
            query: {
              filter: {
                status: 'ACTIVE',
              },
            },
          },
        });

        if (response.errors?.length) {
          logger.warn({ shopId: this.shop.id, error: extractSquareError(response.errors) }, 'square_team_member_lookup_failed');
          return [];
        }

        for (const member of response.team_members ?? []) {
          if (!member.id || items.some((item) => item.id === member.id)) continue;
          const displayName = member.display_name?.trim() || [member.given_name, member.family_name].filter(Boolean).join(' ').trim();
          if (!displayName) continue;
          items.push({
            id: member.id,
            displayName,
            ...(member.given_name ? { givenName: member.given_name } : {}),
            ...(member.family_name ? { familyName: member.family_name } : {}),
          });
        }
        cursor = response.cursor;
      } while (cursor);

      this.teamMembersCache = {
        items,
        fetchedAtMs: now,
      };
      return items;
    } catch (error) {
      // H3: structured logger
      logger.warn({ shopId: this.shop.id, err: error }, 'square_team_member_lookup_error');
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
      // H3: structured logger (debug level — operational, not a warning)
      logger.debug({ shopId: this.shop.id, name, teamMemberId: match.id }, 'square_team_member_matched');
      return match.id;
    }

    logger.debug({ shopId: this.shop.id, name }, 'square_team_member_not_found');
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

  private teamMemberIdFromAvailability(slot: SquareAvailability | undefined): string | undefined {
    return slot?.appointment_segments?.find((segment) => Boolean(segment.team_member_id))?.team_member_id;
  }

  private async teamMemberName(teamMemberId: string | null | undefined): Promise<string | null> {
    if (!teamMemberId) return null;
    const members = await this.getTeamMembers();
    return members.find((member) => member.id === teamMemberId)?.displayName ?? null;
  }

  private async toResolvedAvailabilitySlot(slot: SquareAvailability | undefined): Promise<SquareResolvedAvailabilitySlot | null> {
    if (!slot?.start_at) return null;
    const teamMemberId = this.teamMemberIdFromAvailability(slot) ?? null;
    return {
      startAt: slot.start_at,
      teamMemberId,
      teamMemberName: await this.teamMemberName(teamMemberId),
    };
  }

  private buildStaffResolution(params: {
    resolvedSlot: SquareResolvedAvailabilitySlot | null;
    requestedTeamMemberId?: string | null;
    requestedTeamMemberName?: string | null;
    requestedStaffUnavailable: boolean;
    fallbackSlot: SquareResolvedAvailabilitySlot | null;
    variation: SquareResolvedVariation;
  }): AvailabilityStaffResolution {
    return {
      resolvedTeamMemberId: params.resolvedSlot?.teamMemberId ?? null,
      resolvedTeamMemberName: params.resolvedSlot?.teamMemberName ?? null,
      requestedTeamMemberId: params.requestedTeamMemberId ?? null,
      requestedTeamMemberName: params.requestedTeamMemberName ?? null,
      requestedStaffUnavailable: params.requestedStaffUnavailable,
      fallbackTeamMemberId: params.fallbackSlot?.teamMemberId ?? null,
      fallbackTeamMemberName: params.fallbackSlot?.teamMemberName ?? null,
      serviceVariationId: params.variation.variationId,
      locationId: this.credentials.locationId,
    };
  }

  private async searchAvailabilityForDay(params: {
    date: string;
    timezone: string;
    variation: SquareResolvedVariation;
    teamMemberId?: string | null;
  }): Promise<SquareAvailability[]> {
    const window = this.buildAvailabilityWindow(params.date, params.timezone);
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
                service_variation_id: params.variation.variationId,
                ...(params.teamMemberId
                  ? {
                      team_member_id_filter: {
                        any: [params.teamMemberId],
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
    return response.availabilities ?? [];
  }

  private async findAvailableTeamMember(params: {
    date: string;
    time: string;
    timezone: string;
    matchedServiceId?: string | null;
    serviceName?: string;
    requestedTeamMemberId?: string | null;
  }): Promise<SquareResolvedAvailabilitySlot | null> {
    const requestedStart = DateTime.fromISO(`${params.date}T${params.time}:00`, { zone: params.timezone });
    if (!requestedStart.isValid) {
      throw new Error('square_availability_invalid_datetime');
    }

    const variation = await this.requireSquareVariationId(params.matchedServiceId, params.serviceName);
    const availabilities = await this.searchAvailabilityForDay({
      date: params.date,
      timezone: params.timezone,
      variation,
      teamMemberId: params.requestedTeamMemberId,
    });
    const requestedIso = requestedStart.toUTC().toISO();
    const exact = availabilities.find((slot) => slot.start_at === requestedIso);
    return this.toResolvedAvailabilitySlot(exact);
  }

  async prefetchAvailability(params: { date: string; timezone: string }): Promise<void> {
    if (!this.credentials.serviceVariationId) return;

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
    matchedServiceId?: string | null;
  }): Promise<AvailabilityCheckResult> {
    const requestedStart = DateTime.fromISO(`${params.date}T${params.time}:00`, { zone: params.timezone });
    if (!requestedStart.isValid) {
      throw new Error('square_availability_invalid_datetime');
    }

    const variation = await this.requireSquareVariationId(params.matchedServiceId);
    const requestedTeamMemberId = params.teamMemberId ?? null;
    const requestedTeamMemberName = params.techName ?? (await this.teamMemberName(requestedTeamMemberId));
    const availabilities = await this.searchAvailabilityForDay({
      date: params.date,
      timezone: params.timezone,
      variation,
    });

    const requestedIso = requestedStart.toUTC().toISO();
    const exactSlots = availabilities.filter((slot) => slot.start_at === requestedIso);
    const requestedSlot = requestedTeamMemberId
      ? exactSlots.find((slot) => this.teamMemberIdFromAvailability(slot) === requestedTeamMemberId)
      : null;
    const fallbackRawSlot = exactSlots[0] ?? null;

    if (requestedTeamMemberId && requestedSlot) {
      const resolvedSlot = await this.toResolvedAvailabilitySlot(requestedSlot);
      return {
        available: true,
        suggestions: [{
          date: params.date,
          time: params.time,
          ...(requestedTeamMemberName ? { techName: requestedTeamMemberName } : {}),
        }],
        staffResolution: this.buildStaffResolution({
          resolvedSlot,
          requestedTeamMemberId,
          requestedTeamMemberName,
          requestedStaffUnavailable: false,
          fallbackSlot: null,
          variation,
        }),
      };
    }

    if (requestedTeamMemberId && fallbackRawSlot) {
      const fallbackSlot = await this.toResolvedAvailabilitySlot(fallbackRawSlot);
      const fallbackName = fallbackSlot?.teamMemberName ?? null;
      return {
        available: true,
        message: requestedTeamMemberName && fallbackName
          ? `${requestedTeamMemberName} isn't available at that time, but ${fallbackName} is.`
          : undefined,
        requestedStaffUnavailable: true,
        ...(requestedTeamMemberName ? { requestedStaffName: requestedTeamMemberName } : {}),
        ...(fallbackName ? { fallbackStaffName: fallbackName } : {}),
        suggestions: [{
          date: params.date,
          time: params.time,
          ...(fallbackName ? { techName: fallbackName } : {}),
        }],
        staffResolution: this.buildStaffResolution({
          resolvedSlot: fallbackSlot,
          requestedTeamMemberId,
          requestedTeamMemberName,
          requestedStaffUnavailable: true,
          fallbackSlot,
          variation,
        }),
      };
    }

    if (!requestedTeamMemberId && fallbackRawSlot) {
      const resolvedSlot = await this.toResolvedAvailabilitySlot(fallbackRawSlot);
      return {
        available: true,
        suggestions: [{
          date: params.date,
          time: params.time,
          ...(resolvedSlot?.teamMemberName ? { techName: resolvedSlot.teamMemberName } : {}),
        }],
        staffResolution: this.buildStaffResolution({
          resolvedSlot,
          requestedTeamMemberId: null,
          requestedTeamMemberName: null,
          requestedStaffUnavailable: false,
          fallbackSlot: null,
          variation,
        }),
      };
    }

    const suggestions: TimeSlot[] = [];
    for (const slot of availabilities.slice(0, 6)) {
      const start = slot.start_at ? DateTime.fromISO(slot.start_at, { zone: 'utc' }).setZone(params.timezone) : null;
      if (!start || !start.isValid) continue;
      const teamMemberName = await this.teamMemberName(this.teamMemberIdFromAvailability(slot));
      suggestions.push({
        date: start.toFormat('yyyy-LL-dd'),
        time: start.toFormat('HH:mm'),
        ...(teamMemberName ? { techName: teamMemberName } : {}),
      });
      if (suggestions.length >= 3) break;
    }

    return {
      available: false,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      staffResolution: this.buildStaffResolution({
        resolvedSlot: null,
        requestedTeamMemberId,
        requestedTeamMemberName,
        requestedStaffUnavailable: false,
        fallbackSlot: null,
        variation,
      }),
    };
  }

  async createBooking(input: BookingInput): Promise<BookingResult> {
    const variation = await this.requireSquareVariationId(input.matchedServiceId, input.service);
    // C2: pass idempotencyKey so customer creation is idempotency-safe
    const customerId = await this.findOrCreateCustomerId(input.customerPhone, input.customerName, input.idempotencyKey);
    let resolvedTeamMemberId = input.teamMemberId ?? this.credentials.teamMemberId;
    if (input.teamMemberId && !input.skipAvailabilitySearch) {
      const localStart = DateTime.fromISO(input.datetimeIso, { zone: 'utc' }).setZone(input.timezone);
      if (!localStart.isValid) {
        throw new Error('square_create_booking_invalid_datetime');
      }
      const requestedSlot = await this.findAvailableTeamMember({
        date: localStart.toFormat('yyyy-LL-dd'),
        time: localStart.toFormat('HH:mm'),
        timezone: input.timezone,
        matchedServiceId: input.matchedServiceId,
        serviceName: input.service,
        requestedTeamMemberId: input.teamMemberId,
      });
      if (!requestedSlot?.teamMemberId) {
        throw new Error('square_requested_staff_unavailable');
      }
      resolvedTeamMemberId = requestedSlot.teamMemberId;
    } else if (!resolvedTeamMemberId) {
      const localStart = DateTime.fromISO(input.datetimeIso, { zone: 'utc' }).setZone(input.timezone);
      if (!localStart.isValid) {
        throw new Error('square_create_booking_invalid_datetime');
      }
      const availableSlot = await this.findAvailableTeamMember({
        date: localStart.toFormat('yyyy-LL-dd'),
        time: localStart.toFormat('HH:mm'),
        timezone: input.timezone,
        matchedServiceId: input.matchedServiceId,
        serviceName: input.service,
      });
      resolvedTeamMemberId = availableSlot?.teamMemberId ?? undefined;
      if (resolvedTeamMemberId) {
        logger.info(
          { shopId: this.shop.id, bookingProvider: 'square_appointments' },
          'square_booking_auto_selected_team_member',
        );
      }
    }
    if (!resolvedTeamMemberId) {
      throw new Error('square_create_booking_no_available_team_member');
    }
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
              service_variation_id: variation.variationId,
              ...(variation.version ? { service_variation_version: variation.version } : {}),
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

    const confirmed = response.booking?.status ? response.booking.status !== 'PENDING' : true;
    return {
      bookingId,
      calendarEventId: bookingId,
      confirmed,
      providerStatus: confirmed ? 'provider_confirmed' : 'request_only',
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
        idempotency_key: params.idempotencyKey, // C1: was missing — prevents duplicate cancels on retry
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

    // M4: throw instead of silently falling back to a hardcoded 60-minute segment
    if (!booking.appointment_segments || booking.appointment_segments.length === 0) {
      throw new Error('square_reschedule_missing_segments');
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
          appointment_segments: booking.appointment_segments,
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
      providerStatus:
        updateResponse.booking?.status && updateResponse.booking.status === 'PENDING'
          ? 'request_only'
          : 'provider_confirmed',
    };
  }
}
