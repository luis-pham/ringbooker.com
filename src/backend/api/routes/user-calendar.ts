import { randomUUID } from 'node:crypto';

import type { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

import { isCapabilityAllowed } from '@/src/backend/domain/shop-plan-capabilities';
import type { VagaroSettings } from '@/src/backend/domain/types';
import { logger } from '@/src/backend/observability/logger';
import type {
  BillingSubscriptionsRepository,
  ShopsRepository,
  ShopStaffRepository,
  ShopStaffServicesRepository,
} from '@/src/backend/ports/repositories';
import {
  AcuityProvider,
  buildAcuityConnectionPayload,
  encodeAcuityCredentials,
  parseAcuityCredentials,
} from '@/src/backend/services/booking-providers/acuity';
import {
  encodeMindbodyCredentials,
  MindbodyProvider,
  parseMindbodyCredentials,
} from '@/src/backend/services/booking-providers/mindbody';
import { CALENDAR_PROVIDER_CATALOG } from '@/src/backend/services/calendar/provider-catalog';
import {
  acuityAuthorizeUrl,
  acuityExchangeAuthorizationCode,
  acuityFetchCurrentUser,
  acuityRevokeToken,
  encodeSquareConnectionCredentials,
  parseSquareConnectionCredentials,
  squareAuthorizeUrl,
  squareExchangeAuthorizationCode,
  squareFetchConnectionOptions,
} from '@/src/backend/services/calendar/provider-connections';
import { resolveBookingProviderReadinessForId } from '@/src/backend/services/calendar/provider-readiness';
import {
  encodeVagaroCredentials,
  generateVagaroAccessToken,
  generateWebhookToken,
  parseVagaroCredentials,
  VagaroProvider,
  verifyVagaroCredentials,
  type VagaroCredentials,
} from '@/src/backend/services/calendar/vagaro';
import { decrypt, encrypt } from '@/src/backend/services/crypto/encrypt';
import {
  runPlatformSync,
  triggerPlatformSync,
  type PlatformSyncDeps,
} from '@/src/backend/services/platform-sync';
import {
  acuityConnectSchema,
  acuitySettingsSchema,
  bookingLinkConnectSchema,
  buildAcuityCallbackUrl,
  buildBookingLinkConnectionPayload,
  buildCalendarSettingsRedirect,
  buildMindbodyConnectionPayload,
  buildSquareCallbackUrl,
  buildSquareConnectionPayload,
  buildVagaroConnectionPayload,
  enforceRateLimit,
  enforceSameOriginForCookieMutation,
  extractAcuityUserId,
  getAcuityOAuthConfig,
  getAppBaseUrl,
  integrationsPreferencesSchema,
  isBookingLinkProviderId,
  mindbodyConnectSchema,
  normalizeHttpsBookingUrl,
  parseBookingLinkConnectionProvider,
  parseCalendarProviderParam,
  planFeatureLockedJson,
  RATE_LIMIT_POLICIES,
  requireSession,
  selectSquareLocationId,
  squareConfigureSchema,
  vagaroBookingUrlSchema,
  vagaroConfigureSchema,
  vagaroConnectSchema,
  vagaroSettingsSchema,
  vagaroVerifySchema,
} from '../app-shared';

type UserCalendarDeps = {
  shopsRepository?: ShopsRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  shopStaffRepository?: ShopStaffRepository;
  shopStaffServicesRepository?: ShopStaffServicesRepository;
};

export function registerUserCalendarRoutes(
  app: Hono,
  path: (route: string) => string,
  deps: UserCalendarDeps,
) {
  const platformSyncLastRunByShop = new Map<string, number>();
  const getPlatformSyncDeps = (): PlatformSyncDeps | null => {
    if (!deps.shopsRepository) return null;
    return {
      shopsRepository: deps.shopsRepository,
      billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
      shopStaffRepository: deps.shopStaffRepository,
      shopStaffServicesRepository: deps.shopStaffServicesRepository,
      logger,
    };
  };

  app.get(path('/user/integrations/preferences'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_integrations_preferences_get');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    return c.json({
      ok: true,
      bookingMethod: shop.booking_method ?? null,
      selectedIntegration: shop.selected_integration ?? null,
    });
  });

  app.patch(path('/user/integrations/preferences'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_integrations_preferences_patch');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = integrationsPreferencesSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const enablesIntegration =
      parsed.data.bookingMethod === 'app' ||
      (parsed.data.selectedIntegration !== undefined && parsed.data.selectedIntegration !== null);
    if (enablesIntegration && !isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
      return planFeatureLockedJson(c, 'third_party_integrations');
    }

    const updated = await deps.shopsRepository.updateUserSettings(sessionResult.shopId ?? '', {
      ...(parsed.data.bookingMethod !== undefined ? { booking_method: parsed.data.bookingMethod } : {}),
      ...(parsed.data.selectedIntegration !== undefined ? { selected_integration: parsed.data.selectedIntegration } : {}),
    });
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    return c.json({
      ok: true,
      bookingMethod: updated.booking_method ?? null,
      selectedIntegration: updated.selected_integration ?? null,
    });
  });

  app.get(path('/user/calendar/providers'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_providers_get');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
      return planFeatureLockedJson(c, 'third_party_integrations');
    }

    const squareCredentials = parseSquareConnectionCredentials(shop.google_cal_credentials_encrypted);
    const vagaroCredentials = parseVagaroCredentials(shop.google_cal_credentials_encrypted);
    const mindbodyCredentials =
      parseMindbodyCredentials(shop.integration_credentials_encrypted) ??
      parseMindbodyCredentials(shop.google_cal_credentials_encrypted);
    const acuityCredentials =
      parseAcuityCredentials(shop.integration_credentials_encrypted) ??
      parseAcuityCredentials(shop.google_cal_credentials_encrypted);
    const bookingLinkProvider = parseBookingLinkConnectionProvider(shop.google_cal_credentials_encrypted);
    const providers = (Object.keys(CALENDAR_PROVIDER_CATALOG) as Array<keyof typeof CALENDAR_PROVIDER_CATALOG>)
      .filter((id) => id !== 'manual' && id !== 'google_calendar')
      .map((id) => {
        const meta = CALENDAR_PROVIDER_CATALOG[id];
        const readiness = resolveBookingProviderReadinessForId(shop, id);
        const readinessPayload = {
          status: readiness.status,
          liveReady: readiness.liveReady,
          missingFields: readiness.missingFields,
          canCheckAvailability: readiness.canCheckAvailability,
          canCreateBooking: readiness.canCreateBooking,
          canSendBookingLink: readiness.canSendBookingLink,
          message: readiness.message,
        };
        if (id === 'square_appointments') {
          return {
            id,
            label: meta.label,
            implemented: meta.implemented,
            connected: readiness.connected,
            configured: readiness.configured,
            liveReady: readiness.liveReady,
            readiness: readinessPayload,
            details: readiness.connected
              ? {
                  merchantId: squareCredentials?.merchant_id ?? null,
                  locationId: squareCredentials?.location_id ?? null,
                  serviceVariationId: squareCredentials?.service_variation_id ?? null,
                  teamMemberId: squareCredentials?.team_member_id ?? null,
                  readinessStatus: readiness.status,
                  liveReady: readiness.liveReady,
                  missingFields: readiness.missingFields,
                  healthMessage: readiness.message,
                  servicesCatalogSync: 'available',
                  staffSync: 'available',
                  availabilityCheck: readiness.canCheckAvailability ? 'available' : 'needs_mapping',
                  directAppointmentCreation: readiness.canCreateBooking ? 'enabled' : 'not_enabled',
                  bookingMode: readiness.canCreateBooking ? 'direct_booking_with_fallback' : 'capture_request_only',
                  capabilityNote:
                    'Square Appointments is a booking provider. RingBooker can check availability and create appointments directly after location and service mapping are configured.',
                }
              : null,
          };
        }
        if (id === 'vagaro') {
          const vagaroMode = shop.vagaro_mode ?? 'link_only';
          const vagaroConnectionStatus = shop.vagaro_connection_status ?? 'disconnected';
          const vagaroBookingUrl =
            shop.vagaro_booking_url ??
            (((bookingLinkProvider === 'vagaro' || shop.selected_integration === 'vagaro') && shop.booking_url) ? shop.booking_url : null);
          const businessId = shop.vagaro_business_id ?? vagaroCredentials?.businessId ?? null;
          const liveSyncConnected =
            vagaroMode === 'live_sync' &&
            vagaroConnectionStatus === 'connected' &&
            Boolean(businessId);
          const legacyCredentialsConnected = Boolean(vagaroCredentials?.accessToken || vagaroCredentials?.clientId);
          return {
            id,
            label: meta.label,
            implemented: true,
            connected: readiness.connected || Boolean(vagaroBookingUrl) || liveSyncConnected || legacyCredentialsConnected,
            configured: readiness.configured,
            liveReady: readiness.liveReady,
            readiness: readinessPayload,
            details: {
              vagaroMode,
              vagaroConnectionStatus,
              region: shop.vagaro_region ?? vagaroCredentials?.region ?? null,
              businessId,
              businessName: shop.vagaro_business_name ?? null,
              locationId: shop.vagaro_location_id ?? null,
              clientId: shop.vagaro_client_id ?? vagaroCredentials?.clientId ?? null,
              locations: shop.vagaro_locations ?? null,
              webhookTokenMasked: shop.vagaro_webhook_token ? 'whk_••••••••••••' : null,
              bookingUrl: vagaroBookingUrl,
              fallbackUrl: shop.vagaro_fallback_url ?? null,
              readinessStatus: readiness.status,
              liveReady: readiness.liveReady,
              missingFields: readiness.missingFields,
              healthMessage: readiness.message,
              availabilityCheck: readiness.canCheckAvailability ? 'available' : 'needs_credentials',
              directAppointmentCreation: 'not_available',
              type: vagaroMode === 'live_sync' ? 'live_sync' : 'booking_link',
              capabilityNote: liveSyncConnected
                ? 'Vagaro live sync connected for availability reads. Booking links are still sent by SMS for caller confirmation.'
                : 'Vagaro booking link saved. Live sync requires Vagaro APIs & Webhooks access.',
            },
          };
        }
        if (id === 'mindbody') {
          return {
            id,
            label: meta.label,
            implemented: meta.implemented,
            connected: readiness.connected,
            configured: readiness.configured,
            liveReady: readiness.liveReady,
            readiness: readinessPayload,
            details: readiness.connected
              ? {
                  siteId: mindbodyCredentials?.siteId ?? null,
                  sourceName: mindbodyCredentials?.sourceName ?? null,
                  locationId: mindbodyCredentials?.locationId ?? null,
                  sessionTypeId: mindbodyCredentials?.sessionTypeId ?? null,
                  staffId: mindbodyCredentials?.staffId ?? null,
                  bookingUrl: mindbodyCredentials?.bookingUrl ?? shop.booking_url ?? null,
                  readinessStatus: readiness.status,
                  liveReady: readiness.liveReady,
                  missingFields: readiness.missingFields,
                  healthMessage: readiness.message,
                  servicesStaffSync: 'available',
                  availabilityCheck: readiness.canCheckAvailability ? 'best_effort' : 'needs_credentials',
                  directAppointmentCreation: 'not_enabled',
                  bookingMode: 'capture_request_only',
                  capabilityNote:
                    'Mindbody API connected for services/staff sync and best-effort availability. Direct appointment creation is not enabled; RingBooker captures booking requests for owner confirmation.',
                }
              : null,
          };
        }
        if (id === 'acuity') {
          const oauthConnected = shop.acuity_connection_status === 'connected' && Boolean(shop.acuity_access_token_encrypted);
          const serviceMappingCount = Object.keys(acuityCredentials?.serviceMappings ?? {}).length;
          const staffMappingCount = Object.keys(acuityCredentials?.staffMappings ?? {}).length;
          const defaultCalendarId = acuityCredentials?.defaultCalendarId ?? acuityCredentials?.calendarId ?? null;
          const directFlagEnabled = process.env.ACUITY_DIRECT_BOOKING_ENABLED === 'true';
          const hasRequiredMappings = serviceMappingCount > 0 && Boolean(defaultCalendarId);
          const directEnabled = directFlagEnabled && hasRequiredMappings;
          const missingMappings = [
            serviceMappingCount > 0 ? null : 'Add at least one RingBooker service to Acuity appointment type mapping.',
            defaultCalendarId ? null : 'Set a default Acuity calendar or staff calendar mapping.',
          ].filter(Boolean);
          return {
            id,
            label: meta.label,
            implemented: meta.implemented,
            connected: readiness.connected,
            configured: readiness.configured,
            liveReady: readiness.liveReady,
            readiness: readinessPayload,
            details: readiness.connected
              ? {
                  userId: shop.acuity_user_id ?? acuityCredentials?.userId ?? null,
                  appointmentTypeId: acuityCredentials?.appointmentTypeId ?? null,
                  calendarId: acuityCredentials?.calendarId ?? null,
                  defaultCalendarId,
                  serviceMappings: acuityCredentials?.serviceMappings ?? {},
                  staffMappings: acuityCredentials?.staffMappings ?? {},
                  serviceMappingCount,
                  staffMappingCount,
                  requiresCallerEmail: acuityCredentials?.requiresCallerEmail ?? false,
                  missingMappings,
                  timezone: acuityCredentials?.timezone ?? shop.timezone ?? null,
                  bookingUrl: acuityCredentials?.bookingUrl ?? shop.booking_url ?? null,
                  connectionStatus: shop.acuity_connection_status ?? 'disconnected',
                  authMode: oauthConnected ? 'oauth' : 'legacy',
                  readinessStatus: readiness.status,
                  liveReady: readiness.liveReady,
                  missingFields: readiness.missingFields,
                  healthMessage: readiness.message,
                  appointmentTypesSync: 'available',
                  calendarsSync: 'available',
                  availabilityCheck: readiness.canCheckAvailability ? 'available' : 'needs_mapping',
                  directAppointmentCreation: directEnabled ? 'enabled' : 'not_enabled',
                  bookingMode: directEnabled ? 'direct_booking_with_fallback' : 'capture_request_only',
                  capabilityNote: directEnabled
                    ? 'Acuity direct appointment creation is enabled. Failed API bookings still fall back to captured booking requests.'
                    : 'Acuity is connected for appointment types, calendars, and availability. Direct appointment creation requires service mapping, default calendar mapping, and ACUITY_DIRECT_BOOKING_ENABLED=true.',
                }
              : null,
          };
        }
        if (isBookingLinkProviderId(id)) {
          const connected = bookingLinkProvider === id && Boolean(shop.booking_url);
          return {
            id,
            label: meta.label,
            implemented: meta.implemented,
            connected,
            configured: connected,
            liveReady: connected,
            readiness: readinessPayload,
            details: connected
              ? {
                  bookingUrl: shop.booking_url,
                  type: 'booking_link',
                  readinessStatus: readiness.status,
                  liveReady: readiness.liveReady,
                  missingFields: readiness.missingFields,
                  healthMessage: readiness.message,
                  capabilityNote: 'When clients call to book, they will receive your booking link via SMS.',
                }
              : null,
          };
        }
        return {
          id,
          label: meta.label,
          implemented: meta.implemented,
          connected: false,
          configured: false,
          liveReady: false,
          readiness: readinessPayload,
          details: null,
        };
      });

    return c.json({
      ok: true,
      providers,
    });
  });

  app.post(path('/user/calendar/providers/vagaro/verify'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_vagaro_verify');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ success: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = vagaroVerifySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: 'invalid_payload' }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ success: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
      return planFeatureLockedJson(c, 'third_party_integrations');
    }

    const verification = await verifyVagaroCredentials(
      parsed.data.clientId,
      parsed.data.clientSecretKey,
      parsed.data.region,
    );
    if (!verification.valid) {
      await deps.shopsRepository.updateVagaroSettings(shop.id, {
        vagaro_connection_status: 'error',
      });
      return c.json({ success: false, error: verification.error }, 400);
    }

    const generatedToken = shop.vagaro_webhook_token?.trim() ? null : generateWebhookToken();
    await deps.shopsRepository.updateVagaroSettings(shop.id, {
      vagaro_mode: 'live_sync',
      vagaro_client_id: parsed.data.clientId,
      vagaro_client_secret_encrypted: encrypt(parsed.data.clientSecretKey),
      vagaro_region: parsed.data.region,
      vagaro_connection_status: 'connected',
      ...(generatedToken ? { vagaro_webhook_token: generatedToken } : {}),
      vagaro_business_id: verification.businessId,
      vagaro_business_name: verification.businessName ?? null,
      vagaro_location_id: verification.locations[0]?.locationId ?? null,
      vagaro_locations: verification.locations,
    });
    const settingsUpdated = await deps.shopsRepository.updateUserSettings(shop.id, {
      booking_method: 'app',
      selected_integration: 'vagaro',
    });
    if (!settingsUpdated) return c.json({ success: false, error: 'shop_not_found' }, 404);
    const syncDeps = getPlatformSyncDeps();
    if (syncDeps) {
      void triggerPlatformSync(settingsUpdated, syncDeps);
    }

    return c.json({
      success: true,
      webhook_token: generatedToken,
      connection_status: 'connected',
      business_name: verification.businessName ?? null,
      locations: verification.locations,
    });
  });

  app.patch(path('/user/calendar/providers/vagaro/settings'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_vagaro_settings');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ success: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = vagaroSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: 'invalid_payload' }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ success: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
      return planFeatureLockedJson(c, 'third_party_integrations');
    }

    const settings: Partial<VagaroSettings> = {};
    if (parsed.data.mode !== undefined) settings.vagaro_mode = parsed.data.mode;
    if (parsed.data.booking_url !== undefined) {
      if (parsed.data.booking_url === null || parsed.data.booking_url.trim() === '') {
        settings.vagaro_booking_url = null;
      } else {
        const bookingUrl = normalizeHttpsBookingUrl(parsed.data.booking_url);
        if (!bookingUrl) return c.json({ success: false, error: 'bookingUrl must start with https://' }, 400);
        settings.vagaro_booking_url = bookingUrl;
      }
    }
    if (parsed.data.fallback_url !== undefined) {
      if (parsed.data.fallback_url === null || parsed.data.fallback_url.trim() === '') {
        settings.vagaro_fallback_url = null;
      } else {
        const fallbackUrl = normalizeHttpsBookingUrl(parsed.data.fallback_url);
        if (!fallbackUrl) return c.json({ success: false, error: 'fallbackUrl must start with https://' }, 400);
        settings.vagaro_fallback_url = fallbackUrl;
      }
    }

    await deps.shopsRepository.updateVagaroSettings(shop.id, settings);
    if (parsed.data.booking_url !== undefined) {
      const updated = await deps.shopsRepository.updateUserSettings(shop.id, {
        booking_url: settings.vagaro_booking_url ?? null,
        booking_method: 'app',
        selected_integration: 'vagaro',
      });
      if (!updated) return c.json({ success: false, error: 'shop_not_found' }, 404);
    }

    return c.json({ success: true });
  });

  app.post(path('/user/calendar/providers/vagaro/regenerate-token'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_vagaro_regenerate_token');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ success: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ success: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
      return planFeatureLockedJson(c, 'third_party_integrations');
    }

    const webhookToken = generateWebhookToken();
    await deps.shopsRepository.updateVagaroSettings(shop.id, {
      vagaro_webhook_token: webhookToken,
    });
    return c.json({ success: true, webhook_token: webhookToken });
  });

  app.post(path('/user/calendar/providers/vagaro/connect'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_vagaro_connect');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = vagaroConnectSchema.safeParse(body);
    if (!parsed.success) {
      const businessIdIssue = parsed.error.issues.find((issue) => issue.path.join('.') === 'businessId');
      return c.json(
        {
          ok: false,
          error: businessIdIssue ? 'Business ID is required for Vagaro integration' : 'invalid_payload',
        },
        400,
      );
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
      return planFeatureLockedJson(c, 'third_party_integrations');
    }
    const bookingUrl = parsed.data.bookingUrl ? normalizeHttpsBookingUrl(parsed.data.bookingUrl) : null;
    if (parsed.data.bookingUrl && !bookingUrl) {
      return c.json({ ok: false, error: 'bookingUrl must start with https://' }, 400);
    }

    try {
      const token = await generateVagaroAccessToken({
        region: parsed.data.region,
        clientId: parsed.data.clientId,
        clientSecretKey: parsed.data.clientSecretKey,
        scope: parsed.data.scope,
      });
      const current = parseVagaroCredentials(shop.google_cal_credentials_encrypted);
      const payload = buildVagaroConnectionPayload(current, {
        region: parsed.data.region,
        businessId: parsed.data.businessId,
        clientId: parsed.data.clientId,
        clientSecretKey: parsed.data.clientSecretKey,
        scope: parsed.data.scope,
        accessToken: token.accessToken,
        expiresAt: token.expiresAt,
      });
      const updated = await deps.shopsRepository.updateCalendarConnection(shop.id, {
        google_cal_id: shop.google_cal_id ?? null,
        google_cal_credentials_encrypted: encodeVagaroCredentials(payload),
      });
      if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
      if (bookingUrl) {
        const settingsUpdated = await deps.shopsRepository.updateUserSettings(shop.id, {
          booking_url: bookingUrl,
          booking_method: 'app',
          selected_integration: 'vagaro',
        });
        if (!settingsUpdated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
      }

      return c.json({
        ok: true,
        provider: 'vagaro',
        connected: true,
        configured: Boolean(payload.businessId),
      });
    } catch (error) {
      logger.error({ err: error, provider: 'vagaro' }, 'calendar_provider_vagaro_connect_failed');
      return c.json({ ok: false, error: 'vagaro_connect_failed' }, 502);
    }
  });

  app.patch(path('/user/calendar/providers/vagaro/booking-url'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_vagaro_booking_url');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = vagaroBookingUrlSchema.safeParse(body);
    const bookingUrl = parsed.success ? normalizeHttpsBookingUrl(parsed.data.bookingUrl) : null;
    if (!bookingUrl) {
      return c.json({ ok: false, error: 'bookingUrl must start with https://' }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
      return planFeatureLockedJson(c, 'third_party_integrations');
    }

    const settingsUpdated = await deps.shopsRepository.updateUserSettings(shop.id, {
      booking_url: bookingUrl,
      booking_method: 'app',
      selected_integration: 'vagaro',
    });
    if (!settingsUpdated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    await deps.shopsRepository.updateVagaroSettings(shop.id, {
      vagaro_mode: 'link_only',
      vagaro_booking_url: bookingUrl,
    });

    return c.json({
      ok: true,
      provider: 'vagaro',
      bookingUrl,
    });
  });

  app.post(path('/user/calendar/providers/mindbody/connect'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_mindbody_connect');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = mindbodyConnectSchema.safeParse(body);
    if (!parsed.success) {
      const siteIdIssue = parsed.error.issues.find((issue) => issue.path.join('.') === 'siteId');
      const apiKeyIssue = parsed.error.issues.find((issue) => issue.path.join('.') === 'apiKey');
      return c.json(
        {
          ok: false,
          error: siteIdIssue ? 'Mindbody Site ID is required' : apiKeyIssue ? 'Mindbody API key is required' : 'invalid_payload',
        },
        400,
      );
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
      return planFeatureLockedJson(c, 'third_party_integrations');
    }

    const bookingUrl = parsed.data.bookingUrl ? normalizeHttpsBookingUrl(parsed.data.bookingUrl) : null;
    if (parsed.data.bookingUrl && !bookingUrl) {
      return c.json({ ok: false, error: 'bookingUrl must start with https://' }, 400);
    }

    const current =
      parseMindbodyCredentials(shop.integration_credentials_encrypted) ??
      parseMindbodyCredentials(shop.google_cal_credentials_encrypted);
    const payload = buildMindbodyConnectionPayload(current, {
      siteId: parsed.data.siteId,
      apiKey: parsed.data.apiKey,
      sourceName: parsed.data.sourceName,
      staffToken: parsed.data.staffToken,
      locationId: parsed.data.locationId,
      sessionTypeId: parsed.data.sessionTypeId,
      staffId: parsed.data.staffId,
      bookingUrl: bookingUrl ?? undefined,
    });

    const updated = await deps.shopsRepository.updateIntegrationConnection(shop.id, {
      integration_credentials_encrypted: encodeMindbodyCredentials(payload),
    });
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const connectedShop = await deps.shopsRepository.updateUserSettings(shop.id, {
      booking_url: null,
      booking_method: 'app',
      selected_integration: 'mindbody',
    });
    if (!connectedShop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const syncDeps = getPlatformSyncDeps();
    if (syncDeps) {
      void triggerPlatformSync(connectedShop, syncDeps);
    }

    logger.info(
      {
        provider: 'mindbody',
        shop_id: shop.id,
        user_id: null, user_email: sessionResult.email,
        status: 'success',
        has_booking_url: Boolean(bookingUrl),
      },
      'integration_mindbody_connect',
    );
    return c.json({
      ok: true,
      provider: 'mindbody',
      connected: true,
      configured: true,
    });
  });

  app.post(path('/user/calendar/providers/acuity/connect'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_acuity_connect');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = acuityConnectSchema.safeParse(body);
    if (!parsed.success) {
      logger.warn(
        { provider: 'acuity', shop_id: sessionResult.shopId ?? null, user_email: sessionResult.email, status: 'failed', error_kind: 'invalid_payload' },
        'integration_acuity_connect',
      );
      return c.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_payload' }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
      return planFeatureLockedJson(c, 'third_party_integrations');
    }

    const bookingUrl = parsed.data.bookingUrl ? normalizeHttpsBookingUrl(parsed.data.bookingUrl) : null;
    if (parsed.data.bookingUrl && !bookingUrl) {
      return c.json({ ok: false, error: 'bookingUrl must start with https://' }, 400);
    }

    const current =
      parseAcuityCredentials(shop.integration_credentials_encrypted) ??
      parseAcuityCredentials(shop.google_cal_credentials_encrypted);
    const payload = buildAcuityConnectionPayload(current, {
      provider: 'acuity',
      userId: parsed.data.userId,
      apiKey: parsed.data.apiKey,
      accessToken: parsed.data.accessToken,
      appointmentTypeId: parsed.data.appointmentTypeId,
      calendarId: parsed.data.calendarId,
      defaultCalendarId: parsed.data.defaultCalendarId ?? parsed.data.calendarId,
      serviceMappings: parsed.data.serviceMappings,
      staffMappings: parsed.data.staffMappings,
      requiresCallerEmail: parsed.data.requiresCallerEmail,
      timezone: parsed.data.timezone,
      bookingUrl: bookingUrl ?? undefined,
    });

    const updated = await deps.shopsRepository.updateIntegrationConnection(shop.id, {
      integration_credentials_encrypted: encodeAcuityCredentials(payload),
    });
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    await deps.shopsRepository.updateUserSettings(shop.id, {
      ...(bookingUrl ? { booking_url: bookingUrl } : {}),
      booking_method: 'app',
      selected_integration: 'acuity',
    });

    logger.info(
      {
        provider: 'acuity',
        shop_id: shop.id,
        user_id: null,
        user_email: sessionResult.email,
        status: 'success',
        has_booking_url: Boolean(bookingUrl),
        has_appointment_type_id: Boolean(payload.appointmentTypeId),
        has_calendar_id: Boolean(payload.calendarId ?? payload.defaultCalendarId),
        service_mapping_count: Object.keys(payload.serviceMappings ?? {}).length,
        staff_mapping_count: Object.keys(payload.staffMappings ?? {}).length,
      },
      'integration_acuity_connect',
    );
    return c.json({
      ok: true,
      provider: 'acuity',
      connected: true,
      configured: true,
    });
  });

  app.patch(path('/user/calendar/providers/acuity/settings'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_acuity_settings');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = acuitySettingsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_payload' }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
      return planFeatureLockedJson(c, 'third_party_integrations');
    }

    const bookingUrl = parsed.data.bookingUrl ? normalizeHttpsBookingUrl(parsed.data.bookingUrl) : null;
    if (parsed.data.bookingUrl && !bookingUrl) {
      return c.json({ ok: false, error: 'bookingUrl must start with https://' }, 400);
    }

    const current =
      parseAcuityCredentials(shop.integration_credentials_encrypted) ??
      parseAcuityCredentials(shop.google_cal_credentials_encrypted);
    const payload = buildAcuityConnectionPayload(current, {
      provider: 'acuity',
      appointmentTypeId: parsed.data.appointmentTypeId,
      calendarId: parsed.data.calendarId,
      defaultCalendarId: parsed.data.defaultCalendarId ?? parsed.data.calendarId,
      serviceMappings: parsed.data.serviceMappings,
      staffMappings: parsed.data.staffMappings,
      requiresCallerEmail: parsed.data.requiresCallerEmail,
      timezone: parsed.data.timezone,
      bookingUrl: bookingUrl ?? undefined,
    });

    const updated = await deps.shopsRepository.updateIntegrationConnection(shop.id, {
      integration_credentials_encrypted: encodeAcuityCredentials(payload),
    });
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    await deps.shopsRepository.updateUserSettings(shop.id, {
      ...(bookingUrl ? { booking_url: bookingUrl } : {}),
      booking_method: 'app',
      selected_integration: 'acuity',
    });

    return c.json({
      ok: true,
      provider: 'acuity',
      configured: true,
    });
  });

  app.post(path('/user/calendar/providers/:provider/connect'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_booking_link_connect');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const provider = parseCalendarProviderParam(c.req.param('provider') ?? '');
    if (!isBookingLinkProviderId(provider)) {
      return c.json({ ok: false, error: 'provider_not_supported' }, 400);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = bookingLinkConnectSchema.safeParse(body);
    const bookingUrl = parsed.success ? normalizeHttpsBookingUrl(parsed.data.bookingUrl) : null;
    if (!bookingUrl) {
      return c.json({ ok: false, error: 'bookingUrl must be a valid https URL' }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
      return planFeatureLockedJson(c, 'third_party_integrations');
    }

    const settingsUpdated = await deps.shopsRepository.updateUserSettings(shop.id, {
      booking_url: bookingUrl,
      booking_method: 'app',
      selected_integration: provider,
    });
    if (!settingsUpdated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const connectionUpdated = await deps.shopsRepository.updateCalendarConnection(shop.id, {
      google_cal_id: shop.google_cal_id ?? null,
      google_cal_credentials_encrypted: buildBookingLinkConnectionPayload(provider, bookingUrl),
    });
    if (!connectionUpdated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    return c.json({
      ok: true,
      connected: true,
      provider,
    });
  });

  app.get(path('/user/calendar/providers/:provider/connect/start'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_connect_start');
    if (limited) return limited;
    const appBaseUrl = getAppBaseUrl(c.req);
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) {
      logger.warn({ path: c.req.path }, 'square_oauth_start_unauthenticated');
      return c.redirect(`${appBaseUrl}/user/login?error=calendar_connect_login_required`, 302);
    }
    const provider = parseCalendarProviderParam(c.req.param('provider') ?? '');
    if (!provider) return c.json({ ok: false, error: 'provider_not_supported' }, 400);

    if (provider !== 'square_appointments' && provider !== 'acuity') {
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider,
          message: 'provider_not_implemented_yet',
        }),
      );
    }

    if (!deps.shopsRepository) {
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider,
          message: 'user_dependencies_unavailable',
        }),
      );
    }
    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) {
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider,
          message: 'shop_not_found',
        }),
      );
    }
    if (!isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider,
          message: 'plan_feature_locked',
        }),
      );
    }

    const state = randomUUID();
    setCookie(c, 'rb_calendar_provider_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: 600,
    });
    setCookie(c, 'rb_calendar_provider_name', provider, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: 600,
    });
    setCookie(c, 'rb_calendar_provider_shop', sessionResult.shopId ?? '', {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: 600,
    });

    try {
      const redirectUri = provider === 'acuity' ? buildAcuityCallbackUrl(appBaseUrl) : buildSquareCallbackUrl(appBaseUrl);
      const authorizeUrl =
        provider === 'acuity'
          ? acuityAuthorizeUrl({
              clientId: getAcuityOAuthConfig().clientId,
              redirectUri,
              state,
            })
          : squareAuthorizeUrl({
              state,
              redirectUri,
            });
      let authorizeHost = '';
      try {
        authorizeHost = new URL(authorizeUrl).host;
      } catch {
        /* ignore malformed URL (should not happen) */
      }
      logger.info(
        {
          event: `${provider}_oauth_start`,
          provider,
          authorize_host: authorizeHost,
          redirect_uri_suffix: provider === 'acuity'
            ? '/api/backend/user/calendar/providers/acuity/connect/callback'
            : '/api/backend/user/calendar/providers/square_appointments/connect/callback',
          state_len: state.length,
        },
        'calendar_provider_oauth_authorize_redirect',
      );
      return c.redirect(authorizeUrl);
    } catch (error) {
      logger.error({ err: error, provider }, 'calendar_provider_oauth_start_failed');
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider,
          message: provider === 'acuity' ? 'acuity_oauth_not_configured' : 'square_oauth_not_configured',
        }),
      );
    }
  });

  app.get(path('/user/calendar/providers/:provider/connect/callback'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_connect_callback');
    if (limited) return limited;
    const appBaseUrl = getAppBaseUrl(c.req);
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) {
      logger.warn({ path: c.req.path }, 'square_oauth_callback_unauthenticated');
      return c.redirect(`${appBaseUrl}/user/login?error=calendar_oauth_login_required`, 302);
    }
    if (!deps.shopsRepository) {
      logger.error({ path: c.req.path }, 'square_oauth_callback_shops_repository_unavailable');
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider: 'square_appointments',
          message: 'user_dependencies_unavailable',
        }),
      );
    }

    const provider = parseCalendarProviderParam(c.req.param('provider') ?? '');
    const state = c.req.query('state') ?? '';
    const code = c.req.query('code') ?? '';
    const oauthError = c.req.query('error') ?? '';
    const cookieState = getCookie(c, 'rb_calendar_provider_state') ?? '';
    const cookieProvider = getCookie(c, 'rb_calendar_provider_name') ?? '';
    const cookieShopId = getCookie(c, 'rb_calendar_provider_shop') ?? '';

    logger.info(
      {
        event: `${provider || 'unknown'}_oauth_callback`,
        provider: provider || undefined,
        oauth_error: oauthError || undefined,
        has_code: Boolean(code),
        has_state: Boolean(state),
        has_state_cookie: Boolean(cookieState),
      },
      'calendar_provider_oauth_callback_received',
    );

    deleteCookie(c, 'rb_calendar_provider_state', { path: '/' });
    deleteCookie(c, 'rb_calendar_provider_name', { path: '/' });
    deleteCookie(c, 'rb_calendar_provider_shop', { path: '/' });

    if (!provider || provider !== cookieProvider || cookieShopId !== (sessionResult.shopId ?? '')) {
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider: provider ?? 'unknown',
          message: 'invalid_oauth_context',
        }),
      );
    }

    if (oauthError) {
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider,
          message: oauthError,
        }),
      );
    }

    if (!state || !cookieState || state !== cookieState || !code) {
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider,
          message: 'invalid_oauth_state',
        }),
      );
    }

    if (provider !== 'square_appointments' && provider !== 'acuity') {
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider,
          message: 'provider_not_implemented_yet',
        }),
      );
    }

    try {
      if (provider === 'acuity') {
        const { clientId, clientSecret } = getAcuityOAuthConfig();
        const redirectUri = buildAcuityCallbackUrl(appBaseUrl);
        const exchanged = await acuityExchangeAuthorizationCode({
          code,
          clientId,
          clientSecret,
          redirectUri,
        });
        const existingShop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
        if (!existingShop) {
          return c.redirect(
            buildCalendarSettingsRedirect({
              appBaseUrl,
              result: 'error',
              provider,
              message: 'shop_not_found',
            }),
          );
        }
        if (!isCapabilityAllowed(existingShop.plan, 'third_party_integrations')) {
          return c.redirect(
            buildCalendarSettingsRedirect({
              appBaseUrl,
              result: 'error',
              provider,
              message: 'plan_feature_locked',
            }),
          );
        }

        let acuityUserId: string | null = null;
        try {
          const currentUser = await acuityFetchCurrentUser(exchanged.access_token);
          acuityUserId = extractAcuityUserId(currentUser);
        } catch (identityError) {
          logger.warn({ err: identityError, provider, shop_id: existingShop.id }, 'acuity_oauth_identity_lookup_failed');
        }

        const updated = await deps.shopsRepository.updateAcuityOAuthCredentials(existingShop.id, {
          acuity_access_token_encrypted: encrypt(exchanged.access_token),
          acuity_user_id: acuityUserId,
          acuity_connection_status: 'connected',
        });
        if (!updated) {
          return c.redirect(
            buildCalendarSettingsRedirect({
              appBaseUrl,
              result: 'error',
              provider,
              message: 'shop_not_found',
            }),
          );
        }
        const connectedShop = await deps.shopsRepository.updateUserSettings(existingShop.id, {
          booking_url: null,
          booking_method: 'app',
          selected_integration: 'acuity',
        });
        if (connectedShop) {
          const syncDeps = getPlatformSyncDeps();
          if (syncDeps) {
            void triggerPlatformSync(connectedShop, syncDeps);
          }
        }
        return c.redirect(
          buildCalendarSettingsRedirect({
            appBaseUrl,
            result: 'success',
            provider,
          }),
        );
      }

      const existingShop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
      if (!existingShop) {
        return c.redirect(
          buildCalendarSettingsRedirect({
            appBaseUrl,
            result: 'error',
            provider,
            message: 'shop_not_found',
          }),
        );
      }
      if (!isCapabilityAllowed(existingShop.plan, 'third_party_integrations')) {
        return planFeatureLockedJson(c, 'third_party_integrations');
      }
      const exchanged = await squareExchangeAuthorizationCode({
        code,
        redirectUri: buildSquareCallbackUrl(appBaseUrl),
      });
      const current = parseSquareConnectionCredentials(existingShop.google_cal_credentials_encrypted);
      let payload = buildSquareConnectionPayload(current, exchanged);
      let squareOptions: Awaited<ReturnType<typeof squareFetchConnectionOptions>>['options'] | null = null;
      try {
        const optionsResult = await squareFetchConnectionOptions(payload);
        squareOptions = optionsResult.options;
        payload = buildSquareConnectionPayload(payload, {
          ...optionsResult.credentials,
          location_id: selectSquareLocationId(optionsResult.options.locations) ?? payload.location_id,
        });
      } catch (catalogError) {
        logger.warn({ err: catalogError, provider, shop_id: existingShop.id }, 'square_oauth_catalog_prefetch_failed');
      }

      const updated = await deps.shopsRepository.updateCalendarConnection(existingShop.id, {
        google_cal_id: existingShop.google_cal_id ?? null,
        google_cal_credentials_encrypted: encodeSquareConnectionCredentials(payload),
      });
      if (!updated) {
        return c.redirect(
          buildCalendarSettingsRedirect({
            appBaseUrl,
            result: 'error',
            provider,
            message: 'shop_not_found',
          }),
        );
      }
      const connectedShop = await deps.shopsRepository.updateUserSettings(existingShop.id, {
        booking_url: null,
        booking_method: 'app',
        selected_integration: 'square_appointments',
      });
      if (connectedShop) {
        const syncDeps = getPlatformSyncDeps();
        if (syncDeps) {
          void triggerPlatformSync(connectedShop, syncDeps);
        }
      }
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'success',
          provider,
        }),
      );
    } catch (error) {
      logger.error({ err: error, provider }, 'calendar_provider_oauth_callback_failed');
      return c.redirect(
        buildCalendarSettingsRedirect({
          appBaseUrl,
          result: 'error',
          provider,
          message: 'oauth_exchange_failed',
        }),
      );
    }
  });

	  app.get(path('/user/calendar/providers/:provider/options'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_options');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const provider = parseCalendarProviderParam(c.req.param('provider') ?? '');
    if (provider !== 'vagaro' && isBookingLinkProviderId(provider)) {
      return c.json({
        ok: true,
        provider,
        type: 'booking_link',
        capabilities: { hasBookingLink: true },
        note: 'When clients call to book, they will receive your booking link via SMS.',
      });
    }
    if (provider !== 'square_appointments' && provider !== 'vagaro' && provider !== 'mindbody' && provider !== 'acuity') {
      return c.json({ ok: false, error: 'provider_not_supported' }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
      return planFeatureLockedJson(c, 'third_party_integrations');
    }

    if (provider === 'vagaro') {
      const credentials = parseVagaroCredentials(shop.google_cal_credentials_encrypted);
      const hasNewLiveSyncCredentials =
        shop.vagaro_mode === 'live_sync' &&
        shop.vagaro_connection_status === 'connected' &&
        Boolean(shop.vagaro_business_id?.trim()) &&
        Boolean(shop.vagaro_region?.trim()) &&
        Boolean(shop.vagaro_client_id?.trim()) &&
        Boolean(shop.vagaro_client_secret_encrypted?.trim());
      const hasLegacyCredentials = Boolean(credentials?.businessId && (credentials.accessToken || credentials.clientId));
      if (!hasNewLiveSyncCredentials && !hasLegacyCredentials) {
        return c.json({ ok: false, error: 'provider_not_connected' }, 400);
      }
      if (!hasNewLiveSyncCredentials && !credentials.businessId) {
        return c.json({ ok: false, error: 'Business ID is required for Vagaro integration' }, 400);
      }

      try {
        const options = await new VagaroProvider(shop, {
          persistCredentials: async (encodedCredentials) => {
            await deps.shopsRepository?.updateCalendarConnection(shop.id, {
              google_cal_id: shop.google_cal_id ?? null,
              google_cal_credentials_encrypted: encodedCredentials,
            });
          },
        }).getConnectionOptions();
        return c.json({
          ok: true,
          provider,
          options,
          configured: true,
        });
      } catch (error) {
        logger.error({ err: error, provider, shop_id: shop.id, user_id: null, user_email: sessionResult.email, status: 'failed', error_kind: 'options_fetch_failed' }, 'integration_mindbody_sync_attempt');
        return c.json({ ok: false, error: 'provider_options_failed' }, 502);
      }
    }

    if (provider === 'mindbody') {
      const credentials =
        parseMindbodyCredentials(shop.integration_credentials_encrypted) ??
        parseMindbodyCredentials(shop.google_cal_credentials_encrypted);
      if (!credentials?.siteId || !credentials?.apiKey) {
        return c.json({ ok: false, error: 'provider_not_connected' }, 400);
      }

      try {
        const options = await new MindbodyProvider(shop).getConnectionOptions();
        logger.info(
          {
            provider,
            shop_id: shop.id,
            user_id: null,
            user_email: sessionResult.email,
            status: 'success',
            services_count: options.services.length,
            staff_count: options.staff.length,
          },
          'integration_mindbody_sync_attempt',
        );
        return c.json({
          ok: true,
          provider,
          options,
          configured: true,
        });
      } catch (error) {
        logger.error({ err: error, provider }, 'calendar_provider_options_failed');
        return c.json({ ok: false, error: 'provider_options_failed' }, 502);
      }
    }

    if (provider === 'acuity') {
      const credentials =
        parseAcuityCredentials(shop.integration_credentials_encrypted) ??
        parseAcuityCredentials(shop.google_cal_credentials_encrypted);
      const oauthConnected = shop.acuity_connection_status === 'connected' && Boolean(shop.acuity_access_token_encrypted);
      if (!oauthConnected && !credentials?.accessToken && (!credentials?.userId || !credentials?.apiKey)) {
        return c.json({ ok: false, error: 'provider_not_connected' }, 400);
      }

      try {
        const options = await new AcuityProvider(shop).getConnectionOptions();
        logger.info(
          {
            provider,
            shop_id: shop.id,
            user_id: null,
            user_email: sessionResult.email,
            status: 'success',
            appointment_types_count: options.appointmentTypes.length,
            calendars_count: options.calendars.length,
          },
          'integration_acuity_sync_attempt',
        );
        return c.json({
          ok: true,
          provider,
          options,
          configured: true,
        });
      } catch (error) {
        logger.error(
          { err: error, provider, shop_id: shop.id, user_id: null, user_email: sessionResult.email, status: 'failed', error_kind: 'options_fetch_failed' },
          'integration_acuity_sync_attempt',
        );
        return c.json({ ok: false, error: 'provider_options_failed' }, 502);
      }
    }

    const credentials = parseSquareConnectionCredentials(shop.google_cal_credentials_encrypted);
    if (!credentials?.access_token || !credentials.refresh_token) {
      return c.json({ ok: false, error: 'provider_not_connected' }, 400);
    }

    try {
      const result = await squareFetchConnectionOptions(credentials);
      if (
        result.credentials.access_token !== credentials.access_token ||
        result.credentials.refresh_token !== credentials.refresh_token ||
        result.credentials.expires_at !== credentials.expires_at
      ) {
        const nextPayload = buildSquareConnectionPayload(credentials, result.credentials);
        await deps.shopsRepository.updateCalendarConnection(shop.id, {
          google_cal_id: shop.google_cal_id ?? null,
          google_cal_credentials_encrypted: encodeSquareConnectionCredentials(nextPayload),
        });
      }
      return c.json({
        ok: true,
        provider,
        options: result.options,
      });
    } catch (error) {
      logger.error({ err: error, provider }, 'calendar_provider_options_failed');
      return c.json({ ok: false, error: 'provider_options_failed' }, 502);
    }
  });

  app.post(path('/user/platform-sync/trigger'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_platform_sync_trigger');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ success: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ success: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
      return planFeatureLockedJson(c, 'third_party_integrations');
    }

    const now = Date.now();
    const lastSync = platformSyncLastRunByShop.get(shop.id);
    const minIntervalMs = 5 * 60 * 1000;
    if (lastSync && now - lastSync < minIntervalMs) {
      return c.json(
        {
          success: false,
          error: 'rate_limited',
          retryAfterMs: minIntervalMs - (now - lastSync),
        },
        429,
      );
    }

    const syncDeps = getPlatformSyncDeps();
    if (!syncDeps) return c.json({ success: false, error: 'sync_dependencies_unavailable' }, 500);

    const result = await runPlatformSync(shop, syncDeps);
    if (!result) return c.json({ success: false, error: 'no_sync_adapter' }, 400);

    platformSyncLastRunByShop.set(shop.id, now);
    return c.json({ success: true, result });
  });

  app.post(path('/user/calendar/providers/:provider/configure'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_configure');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const provider = parseCalendarProviderParam(c.req.param('provider') ?? '');
    if (provider !== 'square_appointments' && provider !== 'vagaro') {
      return c.json({ ok: false, error: 'provider_not_supported' }, 400);
    }

    const body = await c.req.json().catch(() => null);
    if (provider === 'vagaro') {
      const parsed = vagaroConfigureSchema.safeParse(body);
      if (!parsed.success) {
        const businessIdIssue = parsed.error.issues.find((issue) => issue.path.join('.') === 'businessId');
        return c.json(
          {
            ok: false,
            error: businessIdIssue ? 'Business ID is required for Vagaro integration' : 'invalid_payload',
          },
          400,
        );
      }

      const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
      if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
      if (!isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
        return planFeatureLockedJson(c, 'third_party_integrations');
      }

      const current = parseVagaroCredentials(shop.google_cal_credentials_encrypted);
      if (!current?.accessToken && !current?.clientId) {
        return c.json({ ok: false, error: 'provider_not_connected' }, 400);
      }

      let tokenPatch: Partial<VagaroCredentials> = {};
      const nextClientId = parsed.data.clientId ?? current.clientId;
      const nextClientSecretKey = parsed.data.clientSecretKey ?? current.clientSecretKey;
      const nextRegion = parsed.data.region ?? current.region ?? 'us';
      if (nextClientId && nextClientSecretKey && (parsed.data.clientId || parsed.data.clientSecretKey || parsed.data.region || !current.accessToken)) {
        const token = await generateVagaroAccessToken({
          region: nextRegion,
          clientId: nextClientId,
          clientSecretKey: nextClientSecretKey,
          scope: parsed.data.scope ?? current.scope,
        });
        tokenPatch = {
          accessToken: token.accessToken,
          expiresAt: token.expiresAt,
        };
      }

      const payload = buildVagaroConnectionPayload(current, {
        ...parsed.data,
        ...tokenPatch,
      });
      const updated = await deps.shopsRepository.updateCalendarConnection(shop.id, {
        google_cal_id: shop.google_cal_id ?? null,
        google_cal_credentials_encrypted: encodeVagaroCredentials(payload),
      });
      if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

      return c.json({
        ok: true,
        provider,
        configured: Boolean(payload.businessId),
      });
    }

    const parsed = squareConfigureSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'third_party_integrations')) {
      return planFeatureLockedJson(c, 'third_party_integrations');
    }

    const credentials = parseSquareConnectionCredentials(shop.google_cal_credentials_encrypted);
    if (!credentials?.access_token || !credentials.refresh_token) {
      return c.json({ ok: false, error: 'provider_not_connected' }, 400);
    }

    const payload = buildSquareConnectionPayload(credentials, {
      location_id: parsed.data.locationId,
      service_variation_id: parsed.data.serviceVariationId,
      team_member_id: parsed.data.teamMemberId,
    });

    const updated = await deps.shopsRepository.updateCalendarConnection(shop.id, {
      google_cal_id: shop.google_cal_id ?? null,
      google_cal_credentials_encrypted: encodeSquareConnectionCredentials(payload),
    });
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    return c.json({
      ok: true,
      provider,
      configured: true,
    });
  });

  app.post(path('/user/calendar/providers/:provider/disconnect'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calendar_provider_disconnect');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const provider = parseCalendarProviderParam(c.req.param('provider') ?? '');
    if (!provider) return c.json({ ok: false, error: 'provider_not_supported' }, 400);

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const parsed = parseSquareConnectionCredentials(shop.google_cal_credentials_encrypted);
    if (provider === 'square_appointments' && parsed?.provider === 'square_appointments') {
      const updated = await deps.shopsRepository.updateCalendarConnection(shop.id, {
        google_cal_id: shop.google_cal_id ?? null,
        google_cal_credentials_encrypted: null,
      });
      if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
      await deps.shopsRepository.updateUserSettings(shop.id, {
        selected_integration: null,
      });
      return c.json({ ok: true, disconnected: true, provider });
    }

    const mindbody =
      parseMindbodyCredentials(shop.integration_credentials_encrypted) ??
      parseMindbodyCredentials(shop.google_cal_credentials_encrypted);
    if (provider === 'mindbody' && mindbody?.provider === 'mindbody') {
      const updated = await deps.shopsRepository.updateIntegrationConnection(shop.id, {
        integration_credentials_encrypted: null,
      });
      if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
      if (parseMindbodyCredentials(shop.google_cal_credentials_encrypted)?.provider === 'mindbody') {
        await deps.shopsRepository.updateCalendarConnection(shop.id, {
          google_cal_id: shop.google_cal_id ?? null,
          google_cal_credentials_encrypted: null,
        });
      }
      await deps.shopsRepository.updateUserSettings(shop.id, {
        selected_integration: null,
      });
      logger.info({ provider: 'mindbody', shop_id: shop.id, user_id: null, user_email: sessionResult.email, status: 'success' }, 'integration_mindbody_disconnect');
      return c.json({ ok: true, disconnected: true, provider });
    }

    if (provider === 'acuity') {
      if (shop.acuity_access_token_encrypted) {
        try {
          const { clientId, clientSecret } = getAcuityOAuthConfig();
          await acuityRevokeToken({
            accessToken: decrypt(shop.acuity_access_token_encrypted),
            clientId,
            clientSecret,
          });
        } catch (error) {
          logger.warn({ err: error, provider: 'acuity', shop_id: shop.id }, 'acuity_oauth_revoke_skipped');
        }
      }
      const oauthUpdated = await deps.shopsRepository.updateAcuityOAuthCredentials(shop.id, {
        acuity_access_token_encrypted: null,
        acuity_user_id: null,
        acuity_connection_status: 'disconnected',
      });
      if (!oauthUpdated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
      const updated = await deps.shopsRepository.updateIntegrationConnection(shop.id, {
        integration_credentials_encrypted: null,
      });
      if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
      if (parseAcuityCredentials(shop.google_cal_credentials_encrypted)?.provider === 'acuity') {
        await deps.shopsRepository.updateCalendarConnection(shop.id, {
          google_cal_id: shop.google_cal_id ?? null,
          google_cal_credentials_encrypted: null,
        });
      }
      await deps.shopsRepository.updateUserSettings(shop.id, {
        selected_integration: null,
      });
      logger.info({ provider: 'acuity', shop_id: shop.id, user_id: null, user_email: sessionResult.email, status: 'success' }, 'integration_acuity_disconnect');
      return c.json({ ok: true, disconnected: true, provider });
    }

    return c.json({ ok: true, disconnected: false, provider });
  });
}
