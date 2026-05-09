'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { CallForwardingSetup } from '@/components/user/call-forwarding-setup';
import { getPhoneSetupCopy, resolvePhoneSetupState, type PhoneSetupState } from '@/components/user/go-live-phone-setup-state';
import { useUserWorkspace } from '@/components/user/user-workspace-context';

type ShopPlan = 'starter' | 'professional' | 'enterprise';

type GoLiveBillingResponse = {
  ok: boolean;
  shop?: { id: string; name: string; plan: ShopPlan; active: boolean };
  billing?: {
    checkoutAvailable?: boolean;
    checkoutDisabledReason?: string | null;
  };
  error?: string;
};

type GoLiveStatusResponse = {
  ok: boolean;
  businessPhone?: string | null;
  paymentMethodStatus?: string | null;
  subscriptionStatus?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  hasPaymentMethod?: boolean;
  forwardingNumber?: string | null;
  hasForwardingNumber?: boolean;
  forwardingSetupVerified?: boolean;
  forwardingSetupVerifiedAt?: string | null;
  forwardingSetupVerifiedVia?: string | null;
  forwardingTestStatus?: 'none' | 'pending' | 'passed' | 'expired' | 'failed';
  forwardingTestExpiresAt?: string | null;
  liveCallsEnabled?: boolean;
  canGoLive?: boolean;
  primaryCta?: string | null;
  blockReason?: string | null;
  commercialApprovalRequired?: boolean;
  error?: string;
};

type PhoneSetupData = {
  billing: GoLiveBillingResponse | null;
  status: GoLiveStatusResponse | null;
};

function formatPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return 'Not set';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    const n = digits.slice(1);
    return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  }
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone;
}

function checkoutUnavailableCopy(reason?: string | null): string {
  if (reason === 'billing_checkout_disabled') return 'Payment setup is not enabled yet. Contact support when you are ready to go live.';
  return 'Payment setup is temporarily unavailable. Contact support when you are ready to go live.';
}

function goLiveSetupStatusVariant(state: PhoneSetupState): 'live' | 'blocked' | 'ready' | 'next' {
  if (state === 'live_answering_active') return 'live';
  if (state === 'billing_issue') return 'blocked';
  if (state === 'ready_to_enable_live') return 'ready';
  return 'next';
}

function toneBadgeLabel(variant: ReturnType<typeof goLiveSetupStatusVariant>): string {
  switch (variant) {
    case 'live':
      return 'Live';
    case 'blocked':
      return 'Blocked';
    case 'ready':
      return 'Ready';
    default:
      return 'Next step';
  }
}

/**
 * Phone forwarding / go-live steps: payment gate, managed forwarding number, carrier instructions, verification, enable live.
 */
export function GoLiveForwardingPanel() {
  const { setWorkspace } = useUserWorkspace();
  const [data, setData] = useState<PhoneSetupData>({ billing: null, status: null });
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const [billingResponse, statusResponse] = await Promise.all([
        fetch('/api/backend/user/billing', { signal: controller.signal }),
        fetch('/api/backend/user/go-live/status', { signal: controller.signal }),
      ]);
      const [billing, status] = await Promise.all([
        billingResponse.json() as Promise<GoLiveBillingResponse>,
        statusResponse.json() as Promise<GoLiveStatusResponse>,
      ]);
      setData({ billing, status });
      if (billing.ok && billing.shop) {
        setWorkspace({ shopName: billing.shop.name, plan: billing.shop.plan, active: billing.shop.active });
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }, [setWorkspace]);

  useEffect(() => {
    let active = true;
    void refresh()
      .catch(() => {
        if (active) setData({ billing: { ok: false, error: 'network_error' }, status: { ok: false, error: 'network_error' } });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const billing = data.billing;
  const status = data.status;
  const checkoutAvailable = billing?.billing?.checkoutAvailable === true;
  const forwardingNumber = status?.forwardingNumber?.trim() ?? '';
  const businessPhone = status?.businessPhone ?? null;
  const state = useMemo(
    () =>
      resolvePhoneSetupState({
        onboardingRequired: status?.blockReason === 'onboarding_incomplete',
        subscriptionStatus: status?.subscriptionStatus,
        paymentMethodStatus: status?.paymentMethodStatus,
        providerCustomerId: status?.providerCustomerId,
        providerSubscriptionId: status?.providerSubscriptionId,
        hasPaymentMethod: status?.hasPaymentMethod,
        hasForwardingNumber: status?.hasForwardingNumber,
        forwardingSetupVerified: status?.forwardingSetupVerified,
        liveCallsEnabled: status?.liveCallsEnabled,
        primaryCta: status?.primaryCta,
        blockReason: status?.blockReason,
        commercialApprovalRequired: status?.commercialApprovalRequired,
      }),
    [status],
  );
  const copy = getPhoneSetupCopy(state);
  const statusVariant = goLiveSetupStatusVariant(state);

  async function openPaymentSetup() {
    setBusyAction('checkout');
    setMessage(null);
    try {
      const response = await fetch('/api/backend/user/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billing_interval: 'monthly' }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; checkoutUrl?: string; error?: string; message?: string } | null;
      if (!response.ok || !body?.ok || !body.checkoutUrl) {
        setMessage(body?.message ?? body?.error ?? 'Payment setup could not start. Open Billing or contact support.');
        return;
      }
      window.location.href = body.checkoutUrl;
    } catch {
      setMessage('Network error. Please try again or open Billing.');
    } finally {
      setBusyAction(null);
    }
  }

  async function provisionForwardingNumber() {
    setBusyAction('provision_forwarding_number');
    setMessage(null);
    try {
      const response = await fetch('/api/backend/user/phone-numbers/provision-forwarding-number', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmGoLiveIntent: true }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
      if (!response.ok || !body?.ok) {
        setMessage(body?.message ?? body?.error ?? 'Could not create your RingBooker forwarding number.');
        return;
      }
      setMessage('Your RingBooker forwarding number is ready. Follow the steps below to connect your phone.');
      await refresh();
    } catch {
      setMessage('Network error. Please try again.');
    } finally {
      setBusyAction(null);
    }
  }

  async function startForwardingTest() {
    setBusyAction('start_forwarding_test');
    setMessage(null);
    try {
      const response = await fetch('/api/backend/user/go-live/start-forwarding-test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string; instruction?: string } | null;
      if (!response.ok || !body?.ok) {
        setMessage(body?.message ?? body?.error ?? 'Forwarding verification could not start.');
        return;
      }
      setMessage(body.instruction ?? 'Call your current business number from another phone and let it forward to RingBooker.');
      await refresh();
    } catch {
      setMessage('Network error. Please try again.');
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmForwardingManually() {
    setBusyAction('confirm_forwarding');
    setMessage(null);
    try {
      const response = await fetch('/api/backend/user/go-live/confirm-forwarding-setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmForwardingReady: true }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
      if (!response.ok || !body?.ok) {
        setMessage(body?.message ?? body?.error ?? 'Forwarding could not be confirmed.');
        return;
      }
      setMessage('Forwarding is marked verified. You can enable live answering when ready.');
      await refresh();
    } catch {
      setMessage('Network error. Please try again.');
    } finally {
      setBusyAction(null);
    }
  }

  async function enableLiveAnswering() {
    setBusyAction('enable_live');
    setMessage(null);
    try {
      const response = await fetch('/api/backend/user/go-live/enable', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
      if (!response.ok || !body?.ok) {
        setMessage(body?.message ?? body?.error ?? 'Could not enable live answering yet.');
        return;
      }
      setMessage('Live answering is now active.');
      await refresh();
    } catch {
      setMessage('Network error. Please try again.');
    } finally {
      setBusyAction(null);
    }
  }

  async function requestTestCall() {
    setBusyAction('test_call');
    setMessage(null);
    try {
      const response = await fetch('/api/backend/user/test-calls/call-me', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
      setMessage(response.ok && body?.ok ? 'Test call started. Please answer your phone.' : body?.message ?? body?.error ?? 'Could not start a test call.');
    } catch {
      setMessage('Network error. Please try again.');
    } finally {
      setBusyAction(null);
    }
  }

  function runAction(target: string) {
    if (target === 'refresh') {
      setBusyAction('refresh');
      setMessage(null);
      void refresh()
        .catch(() => setMessage('Could not refresh status. Please try again.'))
        .finally(() => setBusyAction(null));
      return;
    }
    if (target === 'checkout') return void openPaymentSetup();
    if (target === 'provision_forwarding_number') return void provisionForwardingNumber();
    if (target === 'start_forwarding_test') return void startForwardingTest();
    if (target === 'confirm_forwarding') return void confirmForwardingManually();
    if (target === 'enable_live') return void enableLiveAnswering();
    if (target === 'test_call') return void requestTestCall();
  }

  function renderAction(label: string, target: string, primary = false) {
    const primaryClass = primary ? ' user-save' : '';
    if (target.startsWith('/') || target.startsWith('#')) {
      return <a className={`btn${primaryClass}`} href={target}>{label}</a>;
    }
    if (target === 'checkout' && !checkoutAvailable) {
      return <button type="button" className="btn" disabled>{checkoutUnavailableCopy(billing?.billing?.checkoutDisabledReason)}</button>;
    }
    return (
      <button type="button" className={`btn${primaryClass}`} disabled={busyAction === target} onClick={() => runAction(target)}>
        {busyAction === target ? 'Working...' : label}
      </button>
    );
  }

  if (!loading && (!billing?.ok || !status?.ok)) {
    return (
      <div className="section-stack">
        <section className="card">
          <h3 style={{ marginTop: 0 }}>Unable to load phone setup</h3>
          <p className="sub">{billing?.error ?? status?.error ?? 'unknown_error'}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="section-stack">
      <section className={`card go-live-setup-status go-live-setup-status--${statusVariant}`}>
        <div className="panel-head" style={{ alignItems: 'flex-start', gap: 16 }}>
          <div>
            <span className={`tag go-live-setup-status__badge go-live-setup-status__badge--${statusVariant}`}>{toneBadgeLabel(statusVariant)}</span>
            <h3 style={{ marginTop: 10 }}>{copy.title}</h3>
            <p className="sub go-live-setup-status__lead">{copy.explanation}</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 14 }}>
          <div className="card soft" style={{ margin: 0 }}>
            <div className="sub" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em' }}>Current business phone number</div>
            <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 16, marginTop: 4 }}>{formatPhone(businessPhone)}</div>
          </div>
          <div className="card soft" style={{ margin: 0 }}>
            <div className="sub" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em' }}>RingBooker forwarding number</div>
            <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 16, marginTop: 4 }}>{forwardingNumber || 'Created after payment method'}</div>
          </div>
        </div>
        {copy.blockingReason ? <p className="sub" style={{ marginTop: 12, color: '#92400e' }}>{copy.blockingReason}</p> : null}
        {message ? <p className="sub" style={{ marginTop: 12, color: message.includes('error') ? '#b91c1c' : '#1e3a8a' }}>{message}</p> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          {renderAction(copy.primaryLabel, copy.primaryTarget, true)}
          {copy.secondaryLabel && copy.secondaryTarget ? renderAction(copy.secondaryLabel, copy.secondaryTarget) : null}
        </div>
      </section>

      <section className="card" id="forwarding-instructions">
        <h3 style={{ marginTop: 0 }}>Connect your phone</h3>
        <p className="sub">
          Your clients keep calling your current business phone number. Your carrier forwards missed, busy, after-hours, or overflow calls to RingBooker behind the scenes.
        </p>
        {forwardingNumber ? (
          <CallForwardingSetup
            ringbookerNumber={forwardingNumber}
            callForwardingPageUrl="/current-number/call-forwarding"
            initialMethod="forward"
            suppressForwardingTestCta
            onComplete={() => {}}
            onSkip={() => {}}
          />
        ) : (
          <div className="card soft" style={{ margin: 0 }}>
            <p className="sub" style={{ margin: 0 }}>
              Add a valid payment method first. Then RingBooker will create your managed forwarding number and show carrier-specific forwarding steps here.
            </p>
          </div>
        )}
      </section>

      {state === 'live_answering_active' ? (
        <section className="card soft">
          <h3 style={{ marginTop: 0 }}>Live answering controls</h3>
          <p className="sub">Use test calls to confirm the experience. If you need to pause live answering, contact support until self-serve pause is available.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {renderAction('Run a test call', 'test_call')}
            <a className="btn" href="/user/calls">View call logs</a>
            <a className="btn" href="/contact?topic=pause-live-answering">Pause live answering</a>
          </div>
        </section>
      ) : null}
    </div>
  );
}
