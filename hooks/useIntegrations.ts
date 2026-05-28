'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { BookingMethod, IntegrationAppKey } from '@/lib/integrations-config';
import { fromBackendProviderKey, toBackendProviderKey } from '@/lib/integrations-config';

type ProviderSummary = {
  id: string;
  label: string;
  implemented: boolean;
  connected: boolean;
  configured: boolean;
  details: {
    bookingUrl?: string | null;
    merchantId?: string | null;
    locationId?: string | null;
    serviceVariationId?: string | null;
    teamMemberId?: string | null;
    siteId?: string | null;
    userId?: string | null;
    sessionTypeId?: string | null;
    staffId?: string | null;
    appointmentTypeId?: string | null;
    calendarId?: string | null;
    defaultCalendarId?: string | null;
    serviceMappings?: Record<string, string>;
    staffMappings?: Record<string, string>;
    serviceMappingCount?: number | null;
    staffMappingCount?: number | null;
    requiresCallerEmail?: boolean | null;
    missingMappings?: string[];
    timezone?: string | null;
    appointmentTypesSync?: string | null;
    calendarsSync?: string | null;
    availabilityCheck?: string | null;
    directAppointmentCreation?: string | null;
    bookingMode?: string | null;
    region?: string | null;
    businessId?: string | null;
    capabilityNote?: string | null;
    type?: string | null;
  } | null;
};

type PreferencesResponse = {
  ok: boolean;
  bookingMethod?: BookingMethod;
  selectedIntegration?: string | null;
  error?: string;
};

type ProvidersResponse = {
  ok: boolean;
  providers?: ProviderSummary[];
  error?: string;
};

type Step = 'question' | 'app-picker' | 'direct' | 'later';

export type IntegrationsState = {
  bookingMethod: BookingMethod;
  selectedApp: IntegrationAppKey | null;
  step: Step;
  squareConnected: boolean;
  vagaroConnected: boolean;
  mindbodyConnected: boolean;
  acuityConnected: boolean;
  bookingLinkSaved: boolean;
  bookingLinkUrl: string | null;
  providers: ProviderSummary[];
  isLoading: boolean;
  error: string | null;
};

function inferStep(method: BookingMethod): Step {
  if (method === 'app') return 'app-picker';
  if (method === 'direct') return 'direct';
  if (method === 'later') return 'later';
  return 'question';
}

const GENERIC_INTEGRATION_ERROR = 'Something went wrong — please try again.';

export function integrationErrorMessage(error: string | undefined, fallback = GENERIC_INTEGRATION_ERROR): string {
  if (error === 'plan_feature_locked') return 'This feature requires Professional.';
  if (error === 'validation_error' || error === 'invalid_payload') return 'Please check the details and try again.';
  if (error === 'unauthorized') return 'Please sign in and try again.';
  const message = error ?? fallback;
  return message.includes('_') ? GENERIC_INTEGRATION_ERROR : message;
}

export function useIntegrations(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled !== false;
  const [bookingMethod, setBookingMethodState] = useState<BookingMethod>(null);
  const [selectedApp, setSelectedAppState] = useState<IntegrationAppKey | null>(null);
  const [step, setStep] = useState<Step>('question');
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedBackendProvider = selectedApp ? toBackendProviderKey(selectedApp) : null;
  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedBackendProvider) ?? null,
    [providers, selectedBackendProvider],
  );

  const squareProvider = providers.find((provider) => provider.id === 'square_appointments') ?? null;
  const vagaroProvider = providers.find((provider) => provider.id === 'vagaro') ?? null;
  const mindbodyProvider = providers.find((provider) => provider.id === 'mindbody') ?? null;
  const acuityProvider = providers.find((provider) => provider.id === 'acuity') ?? null;
  const bookingLinkProvider = selectedProvider?.details?.type === 'booking_link' ? selectedProvider : null;

  const load = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      setError(null);
      setProviders([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [preferencesResponse, providersResponse] = await Promise.all([
        fetch('/api/backend/user/integrations/preferences'),
        fetch('/api/backend/user/calendar/providers'),
      ]);
      const preferences = (await preferencesResponse.json()) as PreferencesResponse;
      const providersBody = (await providersResponse.json()) as ProvidersResponse;
      if (!preferencesResponse.ok || !preferences.ok) {
        if (preferences.error === 'plan_feature_locked') return;
        throw new Error(integrationErrorMessage(preferences.error, 'integrations_preferences_failed'));
      }
      if (!providersResponse.ok || !providersBody.ok) {
        if (providersBody.error === 'plan_feature_locked') return;
        throw new Error(integrationErrorMessage(providersBody.error, 'integrations_providers_failed'));
      }

      const method = preferences.bookingMethod ?? null;
      const persistedApp = fromBackendProviderKey(preferences.selectedIntegration);
      setBookingMethodState(method);
      setSelectedAppState(persistedApp);
      setStep(inferStep(method));
      setProviders(providersBody.providers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'integrations_load_failed');
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchPreferences = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch('/api/backend/user/integrations/preferences', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as PreferencesResponse;
    if (!response.ok || !payload.ok) throw new Error(integrationErrorMessage(payload.error, 'integrations_preferences_save_failed'));
    return payload;
  }, []);

  const setBookingMethod = useCallback(
    async (method: BookingMethod) => {
      setError(null);
      setBookingMethodState(method);
      setStep(inferStep(method));
      if (method === 'app') return;
      try {
        await patchPreferences({ bookingMethod: method });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'booking_method_save_failed');
      }
    },
    [patchPreferences],
  );

  const setSelectedApp = useCallback(
    async (key: IntegrationAppKey | null) => {
      setError(null);
      setSelectedAppState(key);
      if (key) {
        setBookingMethodState('app');
        setStep('app-picker');
      }
    },
    [],
  );

  const saveBookingLink = useCallback(
    async (url: string, key: IntegrationAppKey) => {
      setError(null);
      const provider = toBackendProviderKey(key);
      if (key === 'vagaro') {
        const response = await fetch('/api/backend/user/calendar/providers/vagaro/booking-url', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ bookingUrl: url }),
        });
        const payload = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !payload.ok) {
          const message = integrationErrorMessage(payload.error, 'booking_link_save_failed');
          setError(message);
          throw new Error(message);
        }
        await patchPreferences({ bookingMethod: 'app', selectedIntegration: 'vagaro' });
        await load();
        return;
      }
      const response = await fetch(`/api/backend/user/calendar/providers/${provider}/connect`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookingUrl: url }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        const message = integrationErrorMessage(payload.error, 'booking_link_save_failed');
        setError(message);
        throw new Error(message);
      }
      await patchPreferences({ bookingMethod: 'app', selectedIntegration: provider });
      await load();
    },
    [load, patchPreferences],
  );

  const connectVagaro = useCallback(
    async (creds: { clientId: string; clientSecret: string; region: string; businessId: string; bookingLink?: string }) => {
      setError(null);
      const response = await fetch('/api/backend/user/calendar/providers/vagaro/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientId: creds.clientId,
          clientSecretKey: creds.clientSecret,
          region: creds.region,
          businessId: creds.businessId,
          bookingUrl: creds.bookingLink || undefined,
        }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        const message = integrationErrorMessage(payload.error, 'vagaro_connect_failed');
        setError(message);
        throw new Error(message);
      }
      await patchPreferences({ bookingMethod: 'app', selectedIntegration: 'vagaro' });
      await load();
    },
    [load, patchPreferences],
  );

  const connectMindbody = useCallback(
    async (creds: {
      siteId: string;
      apiKey: string;
      sourceName?: string;
      staffToken?: string;
      locationId?: string;
      sessionTypeId?: string;
      staffId?: string;
      bookingUrl?: string;
    }) => {
      setError(null);
      const response = await fetch('/api/backend/user/calendar/providers/mindbody/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(creds),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        const message = integrationErrorMessage(payload.error, 'mindbody_connect_failed');
        setError(message);
        throw new Error(message);
      }
      await patchPreferences({ bookingMethod: 'app', selectedIntegration: 'mindbody' });
      await load();
    },
    [load, patchPreferences],
  );

  const connectAcuity = useCallback(
    async (creds: {
      userId?: string;
      apiKey?: string;
      accessToken?: string;
      appointmentTypeId?: string;
      calendarId?: string;
      defaultCalendarId?: string;
      serviceMappings?: Record<string, string>;
      staffMappings?: Record<string, string>;
      requiresCallerEmail?: boolean;
      timezone?: string;
      bookingUrl?: string;
    }) => {
      setError(null);
      const response = await fetch('/api/backend/user/calendar/providers/acuity/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(creds),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        const message = integrationErrorMessage(payload.error, 'acuity_connect_failed');
        setError(message);
        throw new Error(message);
      }
      await patchPreferences({ bookingMethod: 'app', selectedIntegration: 'acuity' });
      await load();
    },
    [load, patchPreferences],
  );

  const disconnectProvider = useCallback(
    async (provider: string) => {
      setError(null);
      const response = await fetch(`/api/backend/user/calendar/providers/${provider}/disconnect`, { method: 'POST' });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        const message = integrationErrorMessage(payload.error, 'disconnect_failed');
        setError(message);
        throw new Error(message);
      }
      await load();
    },
    [load],
  );

  const navigateBack = useCallback(() => {
    setSelectedAppState(null);
    setStep('question');
  }, []);

  // UI navigation only uses navigateBack(). goBack clears persisted preferences
  // and is reserved for explicit reset actions such as changing a configured setup.
  const goBack = useCallback(async () => {
    setSelectedAppState(null);
    setStep('question');
    setBookingMethodState(null);
    try {
      await patchPreferences({ bookingMethod: null, selectedIntegration: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'integrations_reset_failed');
    }
  }, [patchPreferences]);

  return {
    status: {
      bookingMethod,
      selectedApp,
      step,
      squareConnected: Boolean(squareProvider?.connected),
      vagaroConnected: Boolean(vagaroProvider?.connected),
      mindbodyConnected: Boolean(mindbodyProvider?.connected),
      acuityConnected: Boolean(acuityProvider?.connected),
      bookingLinkSaved: Boolean(bookingLinkProvider?.connected),
      bookingLinkUrl: selectedProvider?.details?.bookingUrl ?? null,
      providers,
      isLoading,
      error,
    } satisfies IntegrationsState,
    selectedProvider,
    setBookingMethod,
    setSelectedApp,
    saveBookingLink,
    connectVagaro,
    connectMindbody,
    connectAcuity,
    disconnectVagaro: () => disconnectProvider('vagaro'),
    disconnectMindbody: () => disconnectProvider('mindbody'),
    disconnectAcuity: () => disconnectProvider('acuity'),
    disconnectSquare: () => disconnectProvider('square_appointments'),
    navigateBack,
    goBack,
    refresh: load,
  };
}
