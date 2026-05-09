'use client';

import { useCallback, useEffect, useState } from 'react';

import { CallForwardingSetup } from '@/components/user/call-forwarding-setup';
import { useUserWorkspace } from '@/components/user/user-workspace-context';

type ShopPlan = 'starter' | 'professional' | 'enterprise';

type GoLiveBillingResponse = {
  ok: boolean;
  shop?: { id: string; name: string; plan: ShopPlan; active: boolean };
  billing?: {
    hasPaymentMethod?: boolean;
    liveCallsEnabled?: boolean;
    forwardingNumber?: string | null;
    commercialApprovalRequired?: boolean;
  };
  error?: string;
};

/**
 * Phone forwarding / go-live steps (provision number + carrier instructions).
 * Lives under Settings — billing stays subscription-only.
 */
export function GoLiveForwardingPanel() {
  const { setWorkspace } = useUserWorkspace();
  const [data, setData] = useState<GoLiveBillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisionForwardingLoading, setProvisionForwardingLoading] = useState(false);
  const [provisionForwardingError, setProvisionForwardingError] = useState<string | null>(null);

  const refreshBilling = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch('/api/backend/user/billing', { signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error('invalid_billing_response');
    }
    const body = (await response.json()) as GoLiveBillingResponse;
    setData(body);
    if (body.ok && body.shop) {
      setWorkspace({
        shopName: body.shop.name,
        plan: body.shop.plan,
        active: body.shop.active,
      });
    }
  }, [setWorkspace]);

  useEffect(() => {
    let active = true;
    void refreshBilling()
      .catch(() => {
        if (active) setData({ ok: false, error: 'network_error' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshBilling]);

  async function provisionForwardingNumber() {
    setProvisionForwardingLoading(true);
    setProvisionForwardingError(null);
    try {
      const response = await fetch('/api/backend/user/phone-numbers/provision-forwarding-number', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmGoLiveIntent: true }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !body?.ok) {
        if (body?.error === 'payment_method_required') {
          setProvisionForwardingError('Add a payment method in Billing before provisioning a forwarding number.');
        } else if (body?.error === 'confirmation_required') {
          setProvisionForwardingError('Confirmation failed. Please try again.');
        } else {
          setProvisionForwardingError(body?.error ?? 'Could not create forwarding number.');
        }
        return;
      }
      await refreshBilling();
    } finally {
      setProvisionForwardingLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="card">
        <p className="sub">Loading go-live status…</p>
      </section>
    );
  }

  if (!data?.ok) {
    return (
      <section className="card">
        <h3 style={{ marginTop: 0 }}>Unable to load status</h3>
        <p className="sub">{data?.error ?? 'unknown_error'}</p>
      </section>
    );
  }

  const currentPlan = data.shop?.plan ?? 'starter';
  const enterpriseApprovalPending = currentPlan === 'enterprise' && data.billing?.commercialApprovalRequired === true;
  const hasPaymentMethod = data.billing?.hasPaymentMethod === true;
  const liveEnabled = data.billing?.liveCallsEnabled;
  const forwardingNumber = data.billing?.forwardingNumber?.trim() ?? '';

  const showProvision =
    Boolean(data.billing) && !liveEnabled && hasPaymentMethod && !forwardingNumber && !enterpriseApprovalPending;
  const showForwardingReady =
    Boolean(data.billing) && !liveEnabled && hasPaymentMethod && Boolean(forwardingNumber) && !enterpriseApprovalPending;

  return (
    <div className="section-stack">
      <section className="card">
        <div className="panel-head">
          <div>
            <h3 style={{ marginTop: 0 }}>Go live on your business line</h3>
            <p className="sub">
              After billing is ready, RingBooker gives you a forwarding number. Your clients keep dialing your existing
              business number — forwarding sends eligible calls to RingBooker behind the scenes.
            </p>
          </div>
        </div>
        <p className="sub" style={{ marginBottom: 0 }}>
          Payment method and plan status are managed on{' '}
          <a href="/user/billing" style={{ fontWeight: 700 }}>
            Billing
          </a>
          .
        </p>
      </section>

      {showProvision ? (
        <section className="card" id="go-live-forwarding">
          <h3 style={{ marginTop: 0 }}>Set up call forwarding</h3>
          <p className="sub">
            RingBooker will create a forwarding number used only behind the scenes. Your customers will keep calling your
            current business number.
          </p>
          <button
            type="button"
            className="btn purple"
            disabled={provisionForwardingLoading}
            onClick={() => void provisionForwardingNumber()}
          >
            {provisionForwardingLoading ? 'Setting up your forwarding number...' : 'Set up call forwarding'}
          </button>
          {provisionForwardingError ? (
            <p className="sub" style={{ color: '#b45309', marginTop: 12 }}>
              {provisionForwardingError}{' '}
              <a href="/user/billing">Open Billing</a>
            </p>
          ) : null}
        </section>
      ) : null}

      {showForwardingReady ? (
        <section className="card">
          <h3 style={{ marginTop: 0 }}>Your RingBooker forwarding number is ready</h3>
          <p className="sub">
            Forward missed, busy, overflow, or after-hours calls from your current business number to this RingBooker
            forwarding number.
          </p>
          <div
            style={{
              border: '1px solid #bfdbfe',
              background: '#eff6ff',
              borderRadius: 12,
              padding: 12,
              marginTop: 10,
              fontSize: 14,
              color: '#1e3a5f',
              lineHeight: 1.5,
            }}
          >
            Your customers keep calling your current business number. This forwarding number is used only behind the scenes.
          </div>
          <p className="sub" style={{ marginTop: 14 }}>
            <strong>RingBooker forwarding number:</strong>{' '}
            <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{forwardingNumber}</span>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12, alignItems: 'center' }}>
            <button type="button" className="btn" disabled title="Forwarding verification is coming next. Live answering stays off.">
              I&apos;ve set up forwarding
            </button>
            <a href="/contact" style={{ fontWeight: 600 }}>
              Need help? Contact support
            </a>
          </div>
          <p className="sub" style={{ marginTop: 8, marginBottom: 16 }}>
            We&apos;ll verify forwarding in a later step — RingBooker won&apos;t enable live answering yet.
          </p>
          <CallForwardingSetup
            ringbookerNumber={forwardingNumber}
            callForwardingPageUrl="/current-number/call-forwarding"
            initialMethod="forward"
            suppressForwardingTestCta
            onComplete={() => {}}
            onSkip={() => {}}
          />
        </section>
      ) : null}

      {!showProvision && !showForwardingReady ? (
        <section className="card soft">
          <h3 style={{ marginTop: 0 }}>Forwarding status</h3>
          {liveEnabled ? (
            <p className="sub" style={{ marginBottom: 0 }}>
              Live answering is enabled. Call forwarding is configured for your account; contact support if you need to change
              routing.
            </p>
          ) : enterpriseApprovalPending ? (
            <p className="sub" style={{ marginBottom: 0 }}>
              Custom plans coordinate forwarding and go-live with your RingBooker contact. See{' '}
              <a href="/user/billing" style={{ fontWeight: 700 }}>
                Billing
              </a>{' '}
              for implementation links.
            </p>
          ) : !hasPaymentMethod ? (
            <>
              <p className="sub">
                Add a payment method in Billing to provision your RingBooker forwarding number and unlock carrier-specific
                steps here.
              </p>
              <a className="btn purple" href="/user/billing">
                Open Billing
              </a>
            </>
          ) : (
            <p className="sub" style={{ marginBottom: 0 }}>
              When your account is ready for go-live, provisioning and forwarding instructions will appear here automatically.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
