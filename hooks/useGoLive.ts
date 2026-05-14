'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { detectCountry, detectCountryFromAddress, detectCountryFromPhone } from '@/lib/detect-country';

export type GoLiveBillingStatus = 'none' | 'trial' | 'active' | 'cancelled' | 'past_due';
export type GoLiveProvisionStatus = 'none' | 'provisioning' | 'ready' | 'failed';
export type GoLiveForwardingStatus = 'none' | 'configured' | 'verified';
export type GoLiveForwardingType = 'no_answer' | 'all' | 'busy' | 'unreachable';

export type KnowledgeGateItem = {
  key: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  fixPath: string;
};

export type GoLiveStatus = {
  knowledgeGate: {
    businessName: boolean;
    timezone: boolean;
    hours: boolean;
    hasServices: boolean;
    passed: boolean;
  };
  billing: {
    status: GoLiveBillingStatus;
    trialEndsAt: string | null;
    paymentMethodAdded: boolean;
  };
  provision: {
    status: GoLiveProvisionStatus;
    ringbookerNumber: string | null;
    telnyx_number_id: string | null;
  };
  forwarding: {
    status: GoLiveForwardingStatus;
    country: string;
    carrier: string | null;
    forwardingType: GoLiveForwardingType;
    dialCode: string | null;
    verifiedAt: string | null;
  };
  liveAnswering: {
    enabled: boolean;
    enabledAt: string | null;
  };
};

export type GoLiveStatusResponse = {
  ok: boolean;
  businessPhone?: string | null;
  businessAddress?: string | null;
  status?: GoLiveStatus;
  gate?: KnowledgeGateItem[];
  canGoLive?: boolean;
  blockReason?: string | null;
  primaryCta?: string | null;
  forwardingNumber?: string | null;
  forwardingTestStatus?: 'none' | 'pending' | 'passed' | 'expired' | 'failed';
  forwardingTestExpiresAt?: string | null;
  error?: string;
};

export type DialCodeResult = {
  dialCode: string | null;
  turnOffCode: string | null;
  instructions: string[];
};

function fallbackStatus(): GoLiveStatus {
  return {
    knowledgeGate: { businessName: false, timezone: false, hours: false, hasServices: false, passed: false },
    billing: { status: 'none', trialEndsAt: null, paymentMethodAdded: false },
    provision: { status: 'none', ringbookerNumber: null, telnyx_number_id: null },
    forwarding: { status: 'none', country: 'us', carrier: null, forwardingType: 'no_answer', dialCode: null, verifiedAt: null },
    liveAnswering: { enabled: false, enabledAt: null },
  };
}

async function saveForwardingPreference(patch: Record<string, unknown>) {
  await fetch('/api/backend/user/settings', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).catch(() => undefined);
}

function detectKnownCountry(phone: string | null | undefined, address: string | null | undefined): string | null {
  if (phone) {
    const fromPhone = detectCountryFromPhone(phone);
    if (fromPhone) return fromPhone;
  }
  if (address) {
    const fromAddress = detectCountryFromAddress(address);
    if (fromAddress) return fromAddress;
  }
  return null;
}

export function useGoLive(initial?: GoLiveStatusResponse | null) {
  const [response, setResponse] = useState<GoLiveStatusResponse | null>(initial ?? null);
  const [isLoading, setIsLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const [countryPickerVisible, setCountryPickerVisible] = useState(() => !initial?.status?.forwarding.carrier && !detectKnownCountry(initial?.businessPhone ?? null, initial?.businessAddress ?? null));
  const [selectedCountry, setSelectedCountry] = useState<string>(() => (
    initial?.status?.forwarding.carrier
      ? initial.status.forwarding.country
      : detectCountry(initial?.businessPhone ?? null, initial?.businessAddress ?? null)
  ));
  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(initial?.status?.forwarding.carrier ?? null);
  const [selectedForwardingType, setSelectedForwardingType] = useState<GoLiveForwardingType>(initial?.status?.forwarding.forwardingType ?? 'no_answer');

  const refresh = useCallback(async () => {
    setError(null);
    const res = await fetch('/api/backend/user/go-live/status', { credentials: 'include' });
    const body = (await res.json().catch(() => null)) as GoLiveStatusResponse | null;
    if (!res.ok || !body?.ok) {
      throw new Error(body?.error ?? 'go_live_status_failed');
    }
    setResponse(body);
    const detectedCountry = detectKnownCountry(body.businessPhone ?? null, body.businessAddress ?? null);
    setSelectedCountry(body.status?.forwarding.carrier
      ? body.status.forwarding.country
      : detectedCountry ?? detectCountry(body.businessPhone ?? null, body.businessAddress ?? null));
    if (!body.status?.forwarding.carrier) setCountryPickerVisible(!detectedCountry);
    if (body.status?.forwarding.carrier) setSelectedCarrier(body.status.forwarding.carrier);
    if (body.status?.forwarding.forwardingType) setSelectedForwardingType(body.status.forwarding.forwardingType);
    return body;
  }, []);

  useEffect(() => {
    if (initial) return;
    let active = true;
    setIsLoading(true);
    void refresh()
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Could not load Go Live status.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [initial, refresh]);

  useEffect(() => {
    if (response?.status?.provision.status !== 'provisioning') return;
    const id = window.setInterval(() => void refresh().catch(() => undefined), 3000);
    return () => window.clearInterval(id);
  }, [response?.status?.provision.status, refresh]);

  const status = response?.status ?? fallbackStatus();
  const gate = response?.gate ?? [];
  const canGoLive = Boolean(response?.canGoLive && status.knowledgeGate.passed);

  async function postJson<T>(url: string, payload: Record<string, unknown> = {}): Promise<T> {
    setError(null);
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => null)) as (T & { ok?: boolean; message?: string; error?: string }) | null;
    if (!res.ok || body?.ok === false) {
      const msg = body?.message ?? body?.error ?? 'Request failed.';
      setError(msg);
      throw new Error(msg);
    }
    return body as T;
  }

  const startTrial = useCallback(async () => {
    setError(null);
    const shouldReactivate = status.billing.status === 'cancelled' || status.billing.status === 'past_due';
    const res = await fetch(shouldReactivate ? '/api/backend/user/billing/reactivate' : '/api/backend/user/billing/checkout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billing_interval: 'monthly' }),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; checkoutUrl?: string; message?: string; error?: string } | null;
    if (!res.ok || !body?.ok || !body.checkoutUrl) {
      const msg = body?.message ?? body?.error ?? 'Payment setup could not start.';
      setError(msg);
      throw new Error(msg);
    }
    window.location.href = body.checkoutUrl;
  }, [status.billing.status]);

  const provisionNumber = useCallback(async () => {
    await postJson('/api/backend/user/phone-numbers/provision-forwarding-number', { confirmGoLiveIntent: true });
    await refresh();
  }, [refresh]);

  const getDialCode = useCallback(async (): Promise<DialCodeResult> => {
    if (!selectedCarrier) throw new Error('Choose a carrier first.');
    const params = new URLSearchParams({ carrier: selectedCarrier, country: selectedCountry, forwardingType: selectedForwardingType });
    const res = await fetch(`/api/backend/user/go-live/forwarding-code?${params.toString()}`, { credentials: 'include' });
    const body = (await res.json().catch(() => null)) as (DialCodeResult & { ok?: boolean; error?: string }) | null;
    if (!res.ok || !body?.ok) throw new Error(body?.error ?? 'Could not generate forwarding code.');
    return { dialCode: body.dialCode, turnOffCode: body.turnOffCode, instructions: body.instructions ?? [] };
  }, [selectedCarrier, selectedCountry, selectedForwardingType]);

  const markConfigured = useCallback(async () => {
    if (!selectedCarrier) throw new Error('Choose a carrier first.');
    await postJson('/api/backend/user/go-live/mark-forwarding-configured', { carrier: selectedCarrier, country: selectedCountry, forwardingType: selectedForwardingType });
    await refresh();
  }, [refresh, selectedCarrier, selectedCountry, selectedForwardingType]);

  const selectCountry = useCallback((country: string) => {
    setSelectedCountry(country);
    setSelectedCarrier(null);
    setCountryPickerVisible(false);
    void saveForwardingPreference({ forwarding_country: country, forwarding_carrier: '' });
  }, []);

  const showCountryPicker = useCallback(() => {
    setCountryPickerVisible(true);
  }, []);

  const selectCarrier = useCallback((carrier: string | null) => {
    setSelectedCarrier(carrier);
    void saveForwardingPreference({ forwarding_country: selectedCountry, forwarding_carrier: carrier });
  }, [selectedCountry]);

  const selectForwardingType = useCallback((type: GoLiveForwardingType) => {
    setSelectedForwardingType(type);
    void saveForwardingPreference({ forwarding_type: type });
  }, []);

  const runVerification = useCallback(async () => {
    await postJson('/api/backend/user/go-live/start-forwarding-test', {});
    await refresh();
  }, [refresh]);

  const confirmForwarding = useCallback(async () => {
    await postJson('/api/backend/user/go-live/confirm-forwarding-setup', { confirmForwardingReady: true });
    await refresh();
  }, [refresh]);

  const enableLive = useCallback(async () => {
    await postJson('/api/backend/user/go-live/enable', {});
    await refresh();
  }, [refresh]);

  const disableLive = useCallback(async () => {
    await postJson('/api/backend/user/go-live/disable', {});
    await refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      raw: response,
      status,
      gate,
      canGoLive,
      businessPhone: response?.businessPhone ?? null,
      businessAddress: response?.businessAddress ?? null,
      forwardingTestStatus: response?.forwardingTestStatus ?? 'none',
      startTrial,
      provisionNumber,
      selectedCountry,
      countryPickerVisible,
      selectedCarrier,
      selectedForwardingType,
      selectCountry,
      showCountryPicker,
      selectCarrier,
      selectForwardingType,
      getDialCode,
      markConfigured,
      runVerification,
      confirmForwarding,
      enableLive,
      disableLive,
      refresh,
      isLoading,
      error,
    }),
    [
      response,
      status,
      gate,
      canGoLive,
      startTrial,
      provisionNumber,
      selectedCountry,
      countryPickerVisible,
      selectedCarrier,
      selectedForwardingType,
      selectCountry,
      showCountryPicker,
      selectCarrier,
      selectForwardingType,
      getDialCode,
      markConfigured,
      runVerification,
      confirmForwarding,
      enableLive,
      disableLive,
      refresh,
      isLoading,
      error,
    ],
  );
}
