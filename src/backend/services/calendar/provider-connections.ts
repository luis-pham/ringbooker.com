import { DateTime } from 'luxon';

import { getEnv } from '@/src/backend/config/env';
import type { AcuityTokenResponse } from '@/src/backend/domain/types';
import { logger } from '@/src/backend/observability/logger';
import { decrypt, encrypt } from '@/src/backend/services/crypto/encrypt';

export type CalendarConnectionProviderId = 'square_appointments' | 'google_calendar' | 'vagaro' | 'mindbody' | 'acuity' | 'booksy';

export type SquareConnectionCredentials = {
  provider: 'square_appointments';
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  merchant_id?: string;
  location_id?: string;
  service_variation_id?: string;
  team_member_id?: string;
};

type SquareTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  merchant_id?: string;
};

type RawAcuityTokenResponse = {
  access_token?: string;
  token_type?: string;
};

export type AcuityCurrentUser = {
  id?: string | number;
  userID?: string | number;
  userId?: string | number;
  email?: string;
  firstName?: string;
  lastName?: string;
};

type SquareLocation = {
  id: string;
  name: string;
  status?: string;
  business_name?: string;
};

type SquareCatalogObject = {
  id?: string;
  type?: string;
  is_deleted?: boolean;
  item_variation_data?: {
    name?: string;
    item_id?: string;
    service_duration?: number;
    pricing_type?: string;
    price_money?: { amount?: number; currency?: string };
  };
};

export type SquareConnectionOptions = {
  locations: Array<{ id: string; name: string; status?: string }>;
  serviceVariations: Array<{ id: string; name: string; durationMin?: number; amount?: number; currency?: string }>;
};

export function parseCalendarConnectionCredentials(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  const parseCandidates = [raw];
  try {
    parseCandidates.push(decrypt(raw));
  } catch {
    // ignore non-encrypted or invalid ciphertext
  }
  try {
    parseCandidates.push(Buffer.from(raw, 'base64').toString('utf-8'));
  } catch {
    // ignore invalid base64
  }
  for (const candidate of parseCandidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

export function parseSquareConnectionCredentials(raw: string | null | undefined): SquareConnectionCredentials | null {
  const parsed = parseCalendarConnectionCredentials(raw);
  if (!parsed) return null;
  const provider = typeof parsed.provider === 'string' ? parsed.provider.trim().toLowerCase() : '';
  if (provider !== 'square_appointments') return null;
  return {
    provider: 'square_appointments',
    access_token: typeof parsed.access_token === 'string' ? parsed.access_token : undefined,
    refresh_token: typeof parsed.refresh_token === 'string' ? parsed.refresh_token : undefined,
    expires_at: typeof parsed.expires_at === 'string' ? parsed.expires_at : undefined,
    merchant_id: typeof parsed.merchant_id === 'string' ? parsed.merchant_id : undefined,
    location_id: typeof parsed.location_id === 'string' ? parsed.location_id : undefined,
    service_variation_id: typeof parsed.service_variation_id === 'string' ? parsed.service_variation_id : undefined,
    team_member_id: typeof parsed.team_member_id === 'string' ? parsed.team_member_id : undefined,
  };
}

export function encodeSquareConnectionCredentials(input: SquareConnectionCredentials): string {
  return encrypt(JSON.stringify(input));
}

export function squareApiBaseUrl(): string {
  const env = getEnv().SQUARE_ENVIRONMENT;
  return env === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
}

export function acuityAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  if (!params.clientId.trim()) throw new Error('acuity_oauth_not_configured');
  const url = new URL('https://acuityscheduling.com/oauth2/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'api-v1');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', params.state);
  return url.toString();
}

export async function acuityExchangeAuthorizationCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<AcuityTokenResponse> {
  if (!params.clientId.trim() || !params.clientSecret.trim()) throw new Error('acuity_oauth_not_configured');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });
  const response = await squareFetchWithTimeout('https://acuityscheduling.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`acuity_oauth_exchange_failed:${response.status}:${bodyText}`);
  }

  const payload = (await response.json()) as RawAcuityTokenResponse;
  if (!payload.access_token) throw new Error('acuity_oauth_exchange_missing_access_token');
  return {
    access_token: payload.access_token,
    token_type: 'Bearer',
  };
}

export async function acuityRevokeToken(params: {
  accessToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<void> {
  if (!params.accessToken.trim() || !params.clientId.trim() || !params.clientSecret.trim()) {
    logger.warn({ provider: 'acuity' }, 'acuity_oauth_revoke_skipped_missing_config');
    return;
  }
  try {
    const response = await squareFetchWithTimeout('https://acuityscheduling.com/oauth2/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        access_token: params.accessToken,
        client_id: params.clientId,
        client_secret: params.clientSecret,
      }),
    });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      logger.warn({ provider: 'acuity', status: response.status, body: bodyText }, 'acuity_oauth_revoke_failed');
    }
  } catch (error) {
    logger.warn({ err: error, provider: 'acuity' }, 'acuity_oauth_revoke_failed');
  }
}

export async function acuityFetchCurrentUser(accessToken: string): Promise<AcuityCurrentUser> {
  const response = await squareFetchWithTimeout('https://acuityscheduling.com/api/v1/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`acuity_current_user_failed:${response.status}:${bodyText}`);
  }
  return (await response.json()) as AcuityCurrentUser;
}

export function squareAuthorizeUrl(params: {
  redirectUri: string;
  state: string;
}): string {
  const env = getEnv();
  if (!env.SQUARE_APPLICATION_ID) {
    throw new Error('square_oauth_not_configured');
  }
  const url = new URL(`${squareApiBaseUrl()}/oauth2/authorize`);
  url.searchParams.set('client_id', env.SQUARE_APPLICATION_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', params.state);
  url.searchParams.set(
    'scope',
    ['APPOINTMENTS_READ', 'APPOINTMENTS_WRITE', 'CUSTOMERS_READ', 'CUSTOMERS_WRITE', 'ITEMS_READ', 'MERCHANT_PROFILE_READ'].join(' '),
  );
  return url.toString();
}

async function squareFetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const timeoutMs = getEnv().CALENDAR_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function squareJsonRequest<T>(params: {
  path: string;
  accessToken: string;
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
}): Promise<T> {
  const env = getEnv();
  const response = await squareFetchWithTimeout(`${squareApiBaseUrl()}${params.path}`, {
    method: params.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': env.SQUARE_API_VERSION,
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
  });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`square_api_request_failed:${response.status}:${bodyText}`);
  }
  return (await response.json()) as T;
}

export async function squareExchangeAuthorizationCode(params: {
  code: string;
  redirectUri: string;
}): Promise<SquareConnectionCredentials> {
  const env = getEnv();
  if (!env.SQUARE_APPLICATION_ID || !env.SQUARE_APPLICATION_SECRET) {
    throw new Error('square_oauth_not_configured');
  }

  const response = await squareFetchWithTimeout(`${squareApiBaseUrl()}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Square-Version': env.SQUARE_API_VERSION,
    },
    body: JSON.stringify({
      client_id: env.SQUARE_APPLICATION_ID,
      client_secret: env.SQUARE_APPLICATION_SECRET,
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`square_oauth_exchange_failed:${response.status}:${bodyText}`);
  }

  const payload = (await response.json()) as SquareTokenResponse;
  if (!payload.access_token || !payload.refresh_token) {
    throw new Error('square_oauth_exchange_missing_tokens');
  }

  return {
    provider: 'square_appointments',
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: payload.expires_at,
    merchant_id: payload.merchant_id,
  };
}

function tokenNearExpiry(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  const iso = DateTime.fromISO(expiresAt, { zone: 'utc' });
  if (!iso.isValid) return false;
  return iso.diffNow('seconds').seconds <= 120;
}

export async function squareRefreshIfNeeded(
  credentials: SquareConnectionCredentials,
): Promise<SquareConnectionCredentials> {
  if (!credentials.refresh_token || !tokenNearExpiry(credentials.expires_at)) return credentials;
  const env = getEnv();
  if (!env.SQUARE_APPLICATION_ID || !env.SQUARE_APPLICATION_SECRET) return credentials;

  const response = await squareFetchWithTimeout(`${squareApiBaseUrl()}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Square-Version': env.SQUARE_API_VERSION,
    },
    body: JSON.stringify({
      client_id: env.SQUARE_APPLICATION_ID,
      client_secret: env.SQUARE_APPLICATION_SECRET,
      grant_type: 'refresh_token',
      refresh_token: credentials.refresh_token,
    }),
  });
  if (!response.ok) return credentials;

  const payload = (await response.json()) as SquareTokenResponse;
  if (!payload.access_token) return credentials;
  return {
    ...credentials,
    access_token: payload.access_token,
    refresh_token: payload.refresh_token ?? credentials.refresh_token,
    expires_at: payload.expires_at ?? credentials.expires_at,
    merchant_id: payload.merchant_id ?? credentials.merchant_id,
  };
}

// M2: paginate through catalog so shops with >100 service variations don't lose items
async function squareFetchAllCatalogItems(accessToken: string): Promise<SquareCatalogObject[]> {
  const items: SquareCatalogObject[] = [];
  let cursor: string | undefined;
  const MAX_PAGES = 20;
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await squareJsonRequest<{ objects?: SquareCatalogObject[]; cursor?: string }>({
      path: '/v2/catalog/search',
      accessToken,
      method: 'POST',
      body: {
        include_related_objects: false,
        object_types: ['ITEM_VARIATION'],
        limit: 100,
        ...(cursor ? { cursor } : {}),
      },
    });
    items.push(...(response.objects ?? []));
    cursor = response.cursor;
    if (!cursor) break;
  }
  return items;
}

export async function squareFetchConnectionOptions(
  credentials: SquareConnectionCredentials,
): Promise<{ credentials: SquareConnectionCredentials; options: SquareConnectionOptions }> {
  const freshCredentials = await squareRefreshIfNeeded(credentials);
  if (!freshCredentials.access_token) {
    throw new Error('square_connection_missing_access_token');
  }

  const [locationsResponse, allCatalogItems] = await Promise.all([
    squareJsonRequest<{ locations?: SquareLocation[] }>({
      path: '/v2/locations',
      accessToken: freshCredentials.access_token,
      method: 'GET',
    }),
    squareFetchAllCatalogItems(freshCredentials.access_token),
  ]);

  const options: SquareConnectionOptions = {
    locations: (locationsResponse.locations ?? []).map((location) => ({
      id: location.id,
      name: location.name || location.business_name || location.id,
      status: location.status,
    })),
    serviceVariations: allCatalogItems
      .filter((item) => item.type === 'ITEM_VARIATION' && item.id && !item.is_deleted)
      .map((item) => ({
        id: item.id as string,
        name: item.item_variation_data?.name || item.id || 'Service',
        durationMin:
          typeof item.item_variation_data?.service_duration === 'number'
            ? Math.round(item.item_variation_data.service_duration / 60000)
            : undefined,
        amount: item.item_variation_data?.price_money?.amount,
        currency: item.item_variation_data?.price_money?.currency,
      })),
  };

  return {
    credentials: freshCredentials,
    options,
  };
}
