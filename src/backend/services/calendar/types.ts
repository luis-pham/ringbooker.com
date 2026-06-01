import type { AvailabilityCheckResult, BookingInput, BookingResult, Shop } from '@/src/backend/domain/types';
import { AcuityProvider } from '@/src/backend/services/booking-providers/acuity';
import { GoogleCalendarProvider } from '@/src/backend/services/calendar/google-calendar';
import { ManualCalendarProvider } from '@/src/backend/services/calendar/manual-provider';
import { MindbodyProvider } from '@/src/backend/services/booking-providers/mindbody';
import { SquareAppointmentsProvider } from '@/src/backend/services/booking-providers/square';
import { VagaroProvider } from '@/src/backend/services/calendar/vagaro';
import {
  CALENDAR_PROVIDER_CATALOG,
  parseCalendarProviderId,
  type CalendarProviderId,
} from '@/src/backend/services/calendar/provider-catalog';
import { resolveSelectedCalendarProviderId } from '@/src/backend/services/calendar/provider-readiness';

export interface CalendarProvider {
  shop: Shop;
  prefetchAvailability?(params: { date: string; timezone: string }): Promise<void>;
  checkAvailability(params: {
    date: string;
    time: string;
    durationMin: number;
    techName?: string;
    teamMemberId?: string;
    timezone: string;
    matchedServiceId?: string | null;
  }): Promise<AvailabilityCheckResult>;
  getTeamMembers?(): Promise<Array<{ id: string; displayName: string; givenName?: string; familyName?: string }>>;
  findTeamMemberByName?(name: string): Promise<string | null>;
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

export type CalendarProviderOptions = {
  persistCredentials?: (encodedCredentials: string) => Promise<void>;
  allowManualFallback?: boolean;
};

function hasVagaroLiveSyncConfig(shop: Shop): boolean {
  return (
    shop.selected_integration === 'vagaro' &&
    shop.vagaro_mode === 'live_sync' &&
    shop.vagaro_connection_status === 'connected' &&
    Boolean(shop.vagaro_business_id?.trim()) &&
    Boolean(shop.vagaro_region?.trim()) &&
    Boolean(shop.vagaro_client_id?.trim()) &&
    Boolean(shop.vagaro_client_secret_encrypted?.trim())
  );
}

function resolveShopCalendarProviderId(shop: Shop): CalendarProviderId {
  const selected = parseCalendarProviderId(shop.selected_integration);
  if (selected === 'square_appointments' || selected === 'mindbody' || selected === 'acuity') return selected;
  if (hasVagaroLiveSyncConfig(shop)) return 'vagaro';
  if (selected) return 'manual';
  const explicit = resolveSelectedCalendarProviderId(shop);
  if (explicit !== 'manual') return explicit;
  if (shop.google_cal_id) return 'google_calendar';

  const envDefault = parseCalendarProviderId(process.env.CALENDAR_PROVIDER_DEFAULT);
  if (envDefault) return envDefault;
  return 'manual';
}

export function getShopCalendarProviderMetadata(shop: Shop) {
  const providerId = resolveShopCalendarProviderId(shop);
  return CALENDAR_PROVIDER_CATALOG[providerId];
}

export function getCalendarProvider(shop: Shop, options?: CalendarProviderOptions): CalendarProvider {
  const providerId = resolveShopCalendarProviderId(shop);
  const providerMeta = CALENDAR_PROVIDER_CATALOG[providerId];
  if (!providerMeta) {
    throw new Error(`calendar_provider_unknown:${providerId}`);
  }

  if (providerId === 'google_calendar') {
    return new GoogleCalendarProvider(shop);
  }

  if (providerId === 'square_appointments') {
    return new SquareAppointmentsProvider(shop, { persistCredentials: options?.persistCredentials });
  }

  if (providerId === 'vagaro') {
    return new VagaroProvider(shop, {
      persistCredentials: options?.persistCredentials,
    });
  }

  if (providerId === 'mindbody') {
    return new MindbodyProvider(shop);
  }

  if (providerId === 'acuity') {
    return new AcuityProvider(shop);
  }

  if (providerMeta.type === 'booking_link') {
    return new ManualCalendarProvider(shop);
  }

  if (providerId !== 'manual' && !providerMeta.implemented) {
    throw new Error(`calendar_provider_not_implemented:${providerId}`);
  }

  const productionStrictCalendar = process.env.NODE_ENV === 'production' && process.env.ALLOW_MANUAL_CALENDAR_PROVIDER !== 'true';
  if (productionStrictCalendar && shop.active && !options?.allowManualFallback) {
    throw new Error(`calendar_provider_not_configured_for_shop:${shop.id}:provider=${providerId}`);
  }
  return new ManualCalendarProvider(shop);
}
