import type { BookingInput, BookingResult, Shop, TimeSlot } from '@/src/backend/domain/types';
import { GoogleCalendarProvider } from '@/src/backend/services/calendar/google-calendar';
import { ManualCalendarProvider } from '@/src/backend/services/calendar/manual-provider';
import { SquareAppointmentsProvider } from '@/src/backend/services/calendar/square-appointments';
import {
  CALENDAR_PROVIDER_CATALOG,
  parseCalendarProviderId,
  type CalendarProviderId,
} from '@/src/backend/services/calendar/provider-catalog';

export interface CalendarProvider {
  shop: Shop;
  prefetchAvailability?(params: { date: string; timezone: string }): Promise<void>;
  checkAvailability(params: {
    date: string;
    time: string;
    durationMin: number;
    techName?: string;
    timezone: string;
  }): Promise<{ available: boolean; suggestions?: TimeSlot[] }>;
  createBooking(input: BookingInput): Promise<BookingResult>;
  cancelBooking(params: {
    bookingId: string;
    reason?: string;
    idempotencyKey: string;
  }): Promise<void>;
  rescheduleBooking(params: {
    bookingId: string;
    newDate: string;
    newTime: string;
    timezone: string;
    idempotencyKey: string;
  }): Promise<BookingResult>;
}

function parseShopCalendarProviderHint(shop: Shop): CalendarProviderId | null {
  const rawCredentials = shop.google_cal_credentials_encrypted;
  if (!rawCredentials) return null;
  const parseCandidates = [rawCredentials];
  try {
    parseCandidates.push(Buffer.from(rawCredentials, 'base64').toString('utf-8'));
  } catch {
    // ignore invalid base64 candidate
  }

  for (const candidate of parseCandidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const hintedProvider =
        parsed.provider ??
        parsed.provider_id ??
        (parsed.connection && typeof parsed.connection === 'object'
          ? (parsed.connection as Record<string, unknown>).provider
          : null);
      const providerId = parseCalendarProviderId(hintedProvider);
      if (providerId) return providerId;
    } catch {
      continue;
    }
  }
  return null;
}

function resolveShopCalendarProviderId(shop: Shop): CalendarProviderId {
  const hinted = parseShopCalendarProviderHint(shop);
  if (hinted) return hinted;
  if (shop.google_cal_id) return 'google_calendar';

  const envDefault = parseCalendarProviderId(process.env.CALENDAR_PROVIDER_DEFAULT);
  if (envDefault) return envDefault;
  return 'manual';
}

export function getShopCalendarProviderMetadata(shop: Shop) {
  const providerId = resolveShopCalendarProviderId(shop);
  return CALENDAR_PROVIDER_CATALOG[providerId];
}

export function getCalendarProvider(shop: Shop): CalendarProvider {
  const providerId = resolveShopCalendarProviderId(shop);
  const providerMeta = CALENDAR_PROVIDER_CATALOG[providerId];
  if (!providerMeta) {
    throw new Error(`calendar_provider_unknown:${providerId}`);
  }

  if (providerId === 'google_calendar') {
    return new GoogleCalendarProvider(shop);
  }

  if (providerId === 'square_appointments') {
    return new SquareAppointmentsProvider(shop);
  }

  if (providerId !== 'manual' && !providerMeta.implemented) {
    throw new Error(`calendar_provider_not_implemented:${providerId}`);
  }

  const productionStrictCalendar = process.env.NODE_ENV === 'production' && process.env.ALLOW_MANUAL_CALENDAR_PROVIDER !== 'true';
  if (productionStrictCalendar && shop.active) {
    throw new Error(`calendar_provider_not_configured_for_shop:${shop.id}:provider=${providerId}`);
  }
  return new ManualCalendarProvider(shop);
}
