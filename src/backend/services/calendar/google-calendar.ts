import { DateTime } from 'luxon';
import { SignJWT, importPKCS8 } from 'jose';
import { setTimeout as delay } from 'node:timers/promises';

import type { BookingInput, BookingResult, Shop, TimeSlot } from '@/src/backend/domain/types';
import { getEnv } from '@/src/backend/config/env';
import { getRedisClient } from '@/src/backend/cache/redis';
import type { CalendarProvider } from '@/src/backend/services/calendar/types';

type GoogleCredentials = {
  clientEmail: string;
  privateKey: string;
  calendarId: string;
};

type FreeBusyResponse = {
  calendars?: Record<
    string,
    {
      busy?: Array<{ start: string; end: string }>;
    }
  >;
};

type EventsListResponse = {
  items?: Array<{
    id?: string;
  }>;
};

type EventInsertResponse = {
  id?: string;
};

type CachedValue<T> = {
  value: T;
  expiresAtMs: number;
};

type BusyRangeUtc = {
  startUtcIso: string;
  endUtcIso: string;
};

const accessTokenMemoryCache = new Map<string, CachedValue<string>>();
const freeBusyMemoryCache = new Map<string, CachedValue<BusyRangeUtc[]>>();
const freeBusySingleflight = new Map<string, Promise<BusyRangeUtc[]>>();

function parseShopCredentials(raw: string | null | undefined): Partial<GoogleCredentials> {
  if (!raw) return {};
  const candidates = [raw, Buffer.from(raw, 'base64').toString('utf-8')];

  for (const value of candidates) {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return {
        clientEmail: typeof parsed.client_email === 'string' ? parsed.client_email : undefined,
        privateKey: typeof parsed.private_key === 'string' ? parsed.private_key : undefined,
        calendarId:
          typeof parsed.calendar_id === 'string'
            ? parsed.calendar_id
            : typeof parsed.calendarId === 'string'
              ? parsed.calendarId
              : undefined,
      };
    } catch {
      continue;
    }
  }

  return {};
}

function resolveGoogleCredentials(shop: Shop): GoogleCredentials {
  const fromShop = parseShopCredentials(shop.google_cal_credentials_encrypted);
  const env = getEnv();

  const clientEmail = fromShop.clientEmail ?? env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (fromShop.privateKey ?? env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)?.replace(/\\n/g, '\n');
  const calendarId = shop.google_cal_id ?? fromShop.calendarId;

  if (!clientEmail || !privateKey || !calendarId) {
    throw new Error('google_calendar_missing_credentials');
  }

  return {
    clientEmail,
    privateKey,
    calendarId,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestGoogleAccessToken(credentials: GoogleCredentials): Promise<{ accessToken: string; expiresInSec: number }> {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = 'https://oauth2.googleapis.com/token';
  const key = await importPKCS8(credentials.privateKey, 'RS256');

  const assertion = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/calendar',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(credentials.clientEmail)
    .setSubject(credentials.clientEmail)
    .setAudience(tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60)
    .sign(key);

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetchWithTimeout(
    tokenUri,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    },
    getEnv().CALENDAR_TIMEOUT_MS,
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`google_oauth_token_failed:${response.status}:${text}`);
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error('google_oauth_token_missing_access_token');
  }

  const expiresInSec = typeof (json as { expires_in?: number }).expires_in === 'number' ? (json as { expires_in?: number }).expires_in! : 3600;

  return {
    accessToken: json.access_token,
    expiresInSec,
  };
}

function toLocalDateTime(params: { date: string; time: string; timezone: string }): DateTime {
  return DateTime.fromISO(`${params.date}T${params.time}:00`, { zone: params.timezone });
}

function rangesOverlap(aStart: DateTime, aEnd: DateTime, bStart: DateTime, bEnd: DateTime): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function buildSuggestions(params: {
  requestedStart: DateTime;
  durationMin: number;
  timezone: string;
  busyRanges: Array<{ start: DateTime; end: DateTime }>;
  techName?: string;
}): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const endBoundary = params.requestedStart.endOf('day');
  let cursor = params.requestedStart.plus({ minutes: 30 });

  while (cursor < endBoundary && slots.length < 3) {
    const slotEnd = cursor.plus({ minutes: params.durationMin });
    const hasConflict = params.busyRanges.some((busy) => rangesOverlap(cursor, slotEnd, busy.start, busy.end));
    if (!hasConflict) {
      slots.push({
        date: cursor.setZone(params.timezone).toFormat('yyyy-LL-dd'),
        time: cursor.setZone(params.timezone).toFormat('HH:mm'),
        techName: params.techName,
      });
    }
    cursor = cursor.plus({ minutes: 30 });
  }

  return slots;
}

function tokenCacheKey(shopId: string): string {
  return `rb:calendar:google:token:${shopId}`;
}

function freeBusyCacheKey(input: { shopId: string; calendarId: string; timezone: string; date: string }): string {
  return `rb:calendar:google:freebusy:${input.shopId}:${input.calendarId}:${input.timezone}:${input.date}`;
}

function freeBusyLockKey(cacheKey: string): string {
  return `${cacheKey}:lock`;
}

function getMemoryCached<T>(cache: Map<string, CachedValue<T>>, key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAtMs <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setMemoryCached<T>(cache: Map<string, CachedValue<T>>, key: string, value: T, ttlSeconds: number): void {
  cache.set(key, {
    value,
    expiresAtMs: Date.now() + ttlSeconds * 1000,
  });
}

async function getGoogleAccessTokenCached(params: {
  shopId: string;
  credentials: GoogleCredentials;
}): Promise<string> {
  const env = getEnv();
  const key = tokenCacheKey(params.shopId);
  const tokenFromMemory = getMemoryCached(accessTokenMemoryCache, key);
  if (tokenFromMemory) return tokenFromMemory;

  const redis = getRedisClient();
  if (redis) {
    const redisToken = await redis.get(key).catch(() => null);
    if (redisToken) {
      setMemoryCached(accessTokenMemoryCache, key, redisToken, Math.max(30, env.CALENDAR_TOKEN_CACHE_TTL_SECONDS - 15));
      return redisToken;
    }
  }

  const fresh = await requestGoogleAccessToken(params.credentials);
  const ttlSec = Math.max(30, Math.min(env.CALENDAR_TOKEN_CACHE_TTL_SECONDS, fresh.expiresInSec - 15));
  setMemoryCached(accessTokenMemoryCache, key, fresh.accessToken, ttlSec);
  if (redis) {
    await redis.set(key, fresh.accessToken, 'EX', ttlSec).catch(() => {
      // best effort cache write
    });
  }
  return fresh.accessToken;
}

async function getBusyRangesForDayCached(params: {
  shop: Shop;
  credentials: GoogleCredentials;
  accessToken: string;
  timezone: string;
  date: string;
  dayStartIso: string;
  dayEndIso: string;
}): Promise<BusyRangeUtc[]> {
  const env = getEnv();
  const cacheKey = freeBusyCacheKey({
    shopId: params.shop.id,
    calendarId: params.credentials.calendarId,
    timezone: params.timezone,
    date: params.date,
  });

  const memoryHit = getMemoryCached(freeBusyMemoryCache, cacheKey);
  if (memoryHit) return memoryHit;

  const redis = getRedisClient();
  if (redis) {
    const redisHitRaw = await redis.get(cacheKey).catch(() => null);
    if (redisHitRaw) {
      try {
        const parsed = JSON.parse(redisHitRaw) as BusyRangeUtc[];
        setMemoryCached(freeBusyMemoryCache, cacheKey, parsed, env.CALENDAR_FREEBUSY_CACHE_TTL_SECONDS);
        return parsed;
      } catch {
        // ignore bad cache payload
      }
    }
  }

  const localInflight = freeBusySingleflight.get(cacheKey);
  if (localInflight) return await localInflight;

  const fetchBusyRanges = async (): Promise<BusyRangeUtc[]> => {
    const freeBusyResponse = await fetchWithTimeout(
      'https://www.googleapis.com/calendar/v3/freeBusy',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeMin: params.dayStartIso,
          timeMax: params.dayEndIso,
          timeZone: params.timezone,
          items: [{ id: params.credentials.calendarId }],
        }),
      },
      env.CALENDAR_TIMEOUT_MS,
    );

    if (!freeBusyResponse.ok) {
      const bodyText = await freeBusyResponse.text().catch(() => '');
      throw new Error(`google_freebusy_failed:${freeBusyResponse.status}:${bodyText}`);
    }

    const freeBusy = (await freeBusyResponse.json()) as FreeBusyResponse;
    const ranges = (freeBusy.calendars?.[params.credentials.calendarId]?.busy ?? [])
      .map((range) => ({
        startUtcIso: range.start,
        endUtcIso: range.end,
      }))
      .filter((range) => typeof range.startUtcIso === 'string' && typeof range.endUtcIso === 'string');

    setMemoryCached(freeBusyMemoryCache, cacheKey, ranges, env.CALENDAR_FREEBUSY_CACHE_TTL_SECONDS);
    if (redis) {
      await redis
        .set(cacheKey, JSON.stringify(ranges), 'EX', env.CALENDAR_FREEBUSY_CACHE_TTL_SECONDS)
        .catch(() => {
          // best effort cache write
        });
    }
    return ranges;
  };

  const task = (async () => {
    const lockWindowMs = env.CALENDAR_SINGLEFLIGHT_LOCK_MS;
    if (!redis) return fetchBusyRanges();

    const lockKey = freeBusyLockKey(cacheKey);
    const lockToken = `${Date.now()}-${Math.random()}`;
    const lockAcquired = await redis.set(lockKey, lockToken, 'PX', lockWindowMs, 'NX').catch(() => null);

    if (lockAcquired === 'OK') {
      try {
        return await fetchBusyRanges();
      } finally {
        const currentLockToken = await redis.get(lockKey).catch(() => null);
        if (currentLockToken === lockToken) {
          await redis.del(lockKey).catch(() => {
            // best effort lock cleanup
          });
        }
      }
    }

    const pollIntervalMs = 60;
    const waitUntilMs = Date.now() + lockWindowMs + 400;
    while (Date.now() < waitUntilMs) {
      const cached = await redis.get(cacheKey).catch(() => null);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as BusyRangeUtc[];
          setMemoryCached(freeBusyMemoryCache, cacheKey, parsed, env.CALENDAR_FREEBUSY_CACHE_TTL_SECONDS);
          return parsed;
        } catch {
          break;
        }
      }
      await delay(pollIntervalMs);
    }

    return await fetchBusyRanges();
  })();

  freeBusySingleflight.set(cacheKey, task);
  try {
    return await task;
  } finally {
    freeBusySingleflight.delete(cacheKey);
  }
}

async function findExistingEventByIdempotencyKey(params: {
  accessToken: string;
  calendarId: string;
  idempotencyKey: string;
}): Promise<string | null> {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(params.calendarId)}/events`);
  url.searchParams.set('maxResults', '1');
  url.searchParams.set('singleEvents', 'false');
  url.searchParams.set('privateExtendedProperty', `rb_idempotency_key=${params.idempotencyKey}`);

  const response = await fetchWithTimeout(
    url.toString(),
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
      },
    },
    getEnv().CALENDAR_TIMEOUT_MS,
  );

  if (!response.ok) return null;
  const data = (await response.json()) as EventsListResponse;
  return data.items?.[0]?.id ?? null;
}

export class GoogleCalendarProvider implements CalendarProvider {
  readonly shop: Shop;

  constructor(shop: Shop) {
    this.shop = shop;
  }

  async prefetchAvailability(params: { date: string; timezone: string }): Promise<void> {
    const credentials = resolveGoogleCredentials(this.shop);
    const accessToken = await getGoogleAccessTokenCached({
      shopId: this.shop.id,
      credentials,
    });
    const startOfDay = DateTime.fromISO(`${params.date}T00:00:00`, { zone: params.timezone });
    if (!startOfDay.isValid) return;
    const dayStartIso = startOfDay.toUTC().toISO();
    const dayEndIso = startOfDay.endOf('day').toUTC().toISO();
    if (!dayStartIso || !dayEndIso) return;

    await getBusyRangesForDayCached({
      shop: this.shop,
      credentials,
      accessToken,
      timezone: params.timezone,
      date: params.date,
      dayStartIso,
      dayEndIso,
    });
  }

  async checkAvailability(params: {
    date: string;
    time: string;
    durationMin: number;
    techName?: string;
    timezone: string;
  }): Promise<{ available: boolean; suggestions?: TimeSlot[] }> {
    const credentials = resolveGoogleCredentials(this.shop);
    const accessToken = await getGoogleAccessTokenCached({
      shopId: this.shop.id,
      credentials,
    });
    const requestedStart = toLocalDateTime({
      date: params.date,
      time: params.time,
      timezone: params.timezone,
    });

    if (!requestedStart.isValid) {
      throw new Error('google_calendar_invalid_datetime');
    }

    const requestedEnd = requestedStart.plus({ minutes: params.durationMin });
    const dayStart = requestedStart.startOf('day').toUTC().toISO();
    const dayEnd = requestedStart.endOf('day').toUTC().toISO();
    if (!dayStart || !dayEnd) {
      throw new Error('google_calendar_invalid_day_range');
    }
    const busyRangesUtc = await getBusyRangesForDayCached({
      shop: this.shop,
      credentials,
      accessToken,
      timezone: params.timezone,
      date: requestedStart.toFormat('yyyy-LL-dd'),
      dayStartIso: dayStart,
      dayEndIso: dayEnd,
    });

    const busyRanges = busyRangesUtc
      .map((range) => ({
        start: DateTime.fromISO(range.startUtcIso, { zone: 'utc' }).setZone(params.timezone),
        end: DateTime.fromISO(range.endUtcIso, { zone: 'utc' }).setZone(params.timezone),
      }))
      .filter((range) => range.start.isValid && range.end.isValid);

    const available = !busyRanges.some((busy) => rangesOverlap(requestedStart, requestedEnd, busy.start, busy.end));
    if (available) {
      return { available: true };
    }

    return {
      available: false,
      suggestions: buildSuggestions({
        requestedStart,
        durationMin: params.durationMin,
        timezone: params.timezone,
        busyRanges,
        techName: params.techName,
      }),
    };
  }

  async createBooking(input: BookingInput): Promise<BookingResult> {
    const credentials = resolveGoogleCredentials(this.shop);
    const accessToken = await getGoogleAccessTokenCached({
      shopId: this.shop.id,
      credentials,
    });
    const existingEventId = await findExistingEventByIdempotencyKey({
      accessToken,
      calendarId: credentials.calendarId,
      idempotencyKey: input.idempotencyKey,
    });

    if (existingEventId) {
      return {
        bookingId: existingEventId,
        calendarEventId: existingEventId,
        confirmed: true,
      };
    }

    const startUtc = DateTime.fromISO(input.datetimeIso, { zone: 'utc' });
    if (!startUtc.isValid) {
      throw new Error('google_calendar_invalid_start_time');
    }
    const endUtc = startUtc.plus({ minutes: input.durationMin });

    const response = await fetchWithTimeout(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(credentials.calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: `${input.service} - ${input.customerName ?? input.customerPhone}`,
          description: `RingBooker booking\nCustomer: ${input.customerName ?? 'Unknown'}\nPhone: ${input.customerPhone}\nSource: ${input.source}\nNotes: ${input.notes ?? ''}`,
          start: {
            dateTime: startUtc.toISO(),
            timeZone: 'UTC',
          },
          end: {
            dateTime: endUtc.toISO(),
            timeZone: 'UTC',
          },
          extendedProperties: {
            private: {
              rb_shop_id: input.shopId,
              rb_idempotency_key: input.idempotencyKey,
            },
          },
        }),
      },
      getEnv().CALENDAR_TIMEOUT_MS,
    );

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(`google_create_event_failed:${response.status}:${bodyText}`);
    }

    const event = (await response.json()) as EventInsertResponse;
    if (!event.id) {
      throw new Error('google_create_event_missing_id');
    }

    return {
      bookingId: event.id,
      calendarEventId: event.id,
      confirmed: true,
    };
  }

  async cancelBooking(params: { bookingId: string; reason?: string; idempotencyKey: string }): Promise<void> {
    const credentials = resolveGoogleCredentials(this.shop);
    const accessToken = await getGoogleAccessTokenCached({
      shopId: this.shop.id,
      credentials,
    });
    const response = await fetchWithTimeout(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(credentials.calendarId)}/events/${encodeURIComponent(params.bookingId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
      getEnv().CALENDAR_TIMEOUT_MS,
    );

    if (!response.ok && response.status !== 404) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(`google_cancel_event_failed:${response.status}:${bodyText}`);
    }
  }

  async rescheduleBooking(params: {
    bookingId: string;
    newDate: string;
    newTime: string;
    timezone: string;
    idempotencyKey: string;
  }): Promise<BookingResult> {
    const credentials = resolveGoogleCredentials(this.shop);
    const accessToken = await getGoogleAccessTokenCached({
      shopId: this.shop.id,
      credentials,
    });
    const localStart = toLocalDateTime({
      date: params.newDate,
      time: params.newTime,
      timezone: params.timezone,
    });

    if (!localStart.isValid) {
      throw new Error('google_reschedule_invalid_datetime');
    }

    const startUtc = localStart.toUTC();
    const endUtc = startUtc.plus({ minutes: 60 });

    const response = await fetchWithTimeout(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(credentials.calendarId)}/events/${encodeURIComponent(params.bookingId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start: {
            dateTime: startUtc.toISO(),
            timeZone: 'UTC',
          },
          end: {
            dateTime: endUtc.toISO(),
            timeZone: 'UTC',
          },
          extendedProperties: {
            private: {
              rb_reschedule_key: params.idempotencyKey,
            },
          },
        }),
      },
      getEnv().CALENDAR_TIMEOUT_MS,
    );

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(`google_reschedule_event_failed:${response.status}:${bodyText}`);
    }

    const event = (await response.json()) as EventInsertResponse;
    return {
      bookingId: params.bookingId,
      calendarEventId: event.id ?? params.bookingId,
      confirmed: true,
    };
  }
}
