import type { Shop } from '@/src/backend/domain/types';
import { parseAcuityCredentials } from '@/src/backend/services/booking-providers/acuity';
import { parseMindbodyCredentials } from '@/src/backend/services/booking-providers/mindbody';
import { CALENDAR_PROVIDER_CATALOG, parseCalendarProviderId, type CalendarProviderId } from '@/src/backend/services/calendar/provider-catalog';
import { parseSquareConnectionCredentials } from '@/src/backend/services/calendar/provider-connections';
import { parseVagaroCredentials } from '@/src/backend/services/calendar/vagaro';

export type BookingProviderReadinessStatus =
  | 'ready'
  | 'missing_config'
  | 'disconnected'
  | 'auth_expired'
  | 'invalid_credentials';

export type BookingProviderReadiness = {
  providerId: CalendarProviderId;
  selectedIntegration: CalendarProviderId | null;
  status: BookingProviderReadinessStatus;
  connected: boolean;
  configured: boolean;
  liveReady: boolean;
  missingFields: string[];
  canCheckAvailability: boolean;
  canCreateBooking: boolean;
  canSendBookingLink: boolean;
  message: string;
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function selectedProvider(shop: Shop): CalendarProviderId | null {
  return parseCalendarProviderId(shop.selected_integration);
}

function readinessFromMissing(params: {
  providerId: CalendarProviderId;
  selectedIntegration?: CalendarProviderId | null;
  connected: boolean;
  missingFields: string[];
  canCheckAvailability?: boolean;
  canCreateBooking?: boolean;
  canSendBookingLink?: boolean;
  readyMessage: string;
  missingMessage: string;
}): BookingProviderReadiness {
  const liveReady = params.connected && params.missingFields.length === 0;
  return {
    providerId: params.providerId,
    selectedIntegration: params.selectedIntegration ?? null,
    status: liveReady ? 'ready' : params.connected ? 'missing_config' : 'disconnected',
    connected: params.connected,
    configured: liveReady,
    liveReady,
    missingFields: params.missingFields,
    canCheckAvailability: liveReady && Boolean(params.canCheckAvailability),
    canCreateBooking: liveReady && Boolean(params.canCreateBooking),
    canSendBookingLink: liveReady && Boolean(params.canSendBookingLink),
    message: liveReady ? params.readyMessage : params.missingMessage,
  };
}

export function resolveSelectedCalendarProviderId(shop: Shop): CalendarProviderId {
  const selected = selectedProvider(shop);
  if (selected) return selected;
  if (hasText(shop.google_cal_id)) return 'google_calendar';
  return 'manual';
}

export function resolveBookingProviderReadinessForId(
  shop: Shop,
  providerId: CalendarProviderId,
): BookingProviderReadiness {
  const selectedIntegration = selectedProvider(shop);
  const meta = CALENDAR_PROVIDER_CATALOG[providerId];

  if (providerId === 'manual') {
    return {
      providerId,
      selectedIntegration,
      status: 'ready',
      connected: true,
      configured: true,
      liveReady: true,
      missingFields: [],
      canCheckAvailability: true,
      canCreateBooking: true,
      canSendBookingLink: false,
      message: 'Manual request capture is ready.',
    };
  }

  if (providerId === 'google_calendar') {
    const connected = hasText(shop.google_cal_id);
    return readinessFromMissing({
      providerId,
      selectedIntegration,
      connected,
      missingFields: connected ? [] : ['google_cal_id'],
      canCheckAvailability: true,
      canCreateBooking: true,
      readyMessage: 'Google Calendar is ready.',
      missingMessage: 'Connect Google Calendar before using live calendar checks.',
    });
  }

  if (providerId === 'square_appointments') {
    const credentials = parseSquareConnectionCredentials(shop.google_cal_credentials_encrypted);
    const squareConnected = hasText(credentials?.access_token) && hasText(credentials?.refresh_token);
    const missingFields = [
      hasText(credentials?.access_token) ? null : 'access_token',
      hasText(credentials?.refresh_token) ? null : 'refresh_token',
      hasText(credentials?.location_id) ? null : 'location_id',
    ].filter((item): item is string => Boolean(item));
    return readinessFromMissing({
      providerId,
      selectedIntegration,
      connected: squareConnected,
      missingFields,
      canCheckAvailability: true,
      canCreateBooking: true,
      readyMessage: 'Square Appointments is ready for live booking.',
      missingMessage: squareConnected
        ? 'Square is connected, but a location is required before live booking.'
        : 'Connect Square before live booking.',
    });
  }

  if (providerId === 'vagaro') {
    const credentials = parseVagaroCredentials(shop.google_cal_credentials_encrypted);
    const mode = shop.vagaro_mode ?? 'link_only';
    if (mode !== 'live_sync') {
      const bookingUrl = shop.vagaro_booking_url ?? shop.booking_url;
      return readinessFromMissing({
        providerId,
        selectedIntegration,
        connected: hasText(bookingUrl),
        missingFields: hasText(bookingUrl) ? [] : ['booking_url'],
        canSendBookingLink: true,
        readyMessage: 'Vagaro booking link is ready.',
        missingMessage: 'Add a Vagaro booking URL before callers can receive a booking link.',
      });
    }

    const missingFields = [
      shop.vagaro_connection_status === 'connected' ? null : 'connection_status',
      hasText(shop.vagaro_region ?? credentials.region) ? null : 'region',
      hasText(shop.vagaro_business_id ?? credentials.businessId) ? null : 'business_id',
      hasText(shop.vagaro_client_id ?? credentials.clientId) ? null : 'client_id',
      hasText(shop.vagaro_client_secret_encrypted ?? credentials.clientSecretKey) ? null : 'client_secret',
    ].filter((item): item is string => Boolean(item));
    return readinessFromMissing({
      providerId,
      selectedIntegration,
      connected: shop.vagaro_connection_status === 'connected',
      missingFields,
      canCheckAvailability: true,
      canSendBookingLink: hasText(shop.vagaro_booking_url ?? shop.booking_url ?? shop.vagaro_fallback_url),
      readyMessage: 'Vagaro live sync is ready for availability checks.',
      missingMessage: shop.vagaro_connection_status === 'connected'
        ? 'Vagaro live sync is connected, but setup is incomplete.'
        : 'Connect Vagaro live sync before live availability checks.',
    });
  }

  if (providerId === 'mindbody') {
    const credentials =
      parseMindbodyCredentials(shop.integration_credentials_encrypted) ??
      parseMindbodyCredentials(shop.google_cal_credentials_encrypted);
    const missingFields = [
      hasText(credentials?.siteId) ? null : 'site_id',
      hasText(credentials?.apiKey) ? null : 'api_key',
    ].filter((item): item is string => Boolean(item));
    return readinessFromMissing({
      providerId,
      selectedIntegration,
      connected: hasText(credentials?.siteId) && hasText(credentials?.apiKey),
      missingFields,
      canCheckAvailability: true,
      canCreateBooking: false,
      canSendBookingLink: hasText(credentials?.bookingUrl ?? shop.booking_url),
      readyMessage: 'Mindbody is ready for availability checks.',
      missingMessage: 'Mindbody needs Site ID and API key before live checks.',
    });
  }

  if (providerId === 'acuity') {
    const credentials =
      parseAcuityCredentials(shop.integration_credentials_encrypted) ??
      parseAcuityCredentials(shop.google_cal_credentials_encrypted);
    const hasOAuth = shop.acuity_connection_status === 'connected' && hasText(shop.acuity_access_token_encrypted);
    const hasLegacy = hasText(credentials?.accessToken) || (hasText(credentials?.userId) && hasText(credentials?.apiKey));
    const connected = hasOAuth || hasLegacy;
    const missingFields = [
      connected ? null : 'credentials',
      hasText(credentials?.appointmentTypeId) ? null : 'appointment_type_id',
    ].filter((item): item is string => Boolean(item));
    const directReady =
      process.env.ACUITY_DIRECT_BOOKING_ENABLED === 'true' &&
      hasText(credentials?.appointmentTypeId) &&
      hasText(credentials?.defaultCalendarId ?? credentials?.calendarId);
    return readinessFromMissing({
      providerId,
      selectedIntegration,
      connected,
      missingFields,
      canCheckAvailability: true,
      canCreateBooking: directReady,
      canSendBookingLink: hasText(credentials?.bookingUrl ?? shop.booking_url),
      readyMessage: directReady
        ? 'Acuity is ready for direct booking.'
        : 'Acuity is ready for availability checks.',
      missingMessage: connected
        ? 'Acuity is connected, but an appointment type mapping is required before live availability.'
        : 'Connect Acuity before live availability checks.',
    });
  }

  if (meta?.type === 'booking_link') {
    const ready = hasText(shop.booking_url);
    return readinessFromMissing({
      providerId,
      selectedIntegration,
      connected: ready,
      missingFields: ready ? [] : ['booking_url'],
      canSendBookingLink: true,
      readyMessage: `${meta.label} booking link is ready.`,
      missingMessage: `Add a ${meta.label} booking URL before callers can receive a booking link.`,
    });
  }

  return {
    providerId,
    selectedIntegration,
    status: 'disconnected',
    connected: false,
    configured: false,
    liveReady: false,
    missingFields: ['provider_configuration'],
    canCheckAvailability: false,
    canCreateBooking: false,
    canSendBookingLink: false,
    message: 'Provider is not configured.',
  };
}

export function resolveBookingProviderReadiness(shop: Shop): BookingProviderReadiness {
  return resolveBookingProviderReadinessForId(shop, resolveSelectedCalendarProviderId(shop));
}
