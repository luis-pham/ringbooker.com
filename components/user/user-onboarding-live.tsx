'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { UserLayout } from '@/components/user/user-layout';
import { userSettingsScripts, userSettingsStyles } from '@/components/user/user-settings';

type ServiceItem = {
  name: string;
  duration_min: number;
  price: number;
};

type BusinessHours = Record<string, { closed: true } | { open: string; close: string }>;

type OnboardingStatusResponse = {
  ok: boolean;
  onboardingRequired?: boolean;
  shop?: {
    id: string;
    name: string;
    user_name?: string;
    user_phone?: string;
    timezone: string;
    cancel_policy: string;
    services: ServiceItem[];
    hours: BusinessHours;
  };
  error?: string;
};

function defaultBusinessHours(): BusinessHours {
  return {
    mon: { open: '09:00', close: '18:00' },
    tue: { open: '09:00', close: '18:00' },
    wed: { open: '09:00', close: '18:00' },
    thu: { open: '09:00', close: '18:00' },
    fri: { open: '09:00', close: '18:00' },
    sat: { open: '09:00', close: '16:00' },
    sun: { closed: true },
  };
}

export function UserOnboardingLive() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [cancelPolicy, setCancelPolicy] = useState('24-hour cancellation policy.');
  const [serviceName, setServiceName] = useState('Haircut');
  const [serviceDuration, setServiceDuration] = useState(45);
  const [servicePrice, setServicePrice] = useState(45);
  const [saving, setSaving] = useState(false);
  const [shopName, setShopName] = useState('Your shop');

  useEffect(() => {
    void fetch('/api/backend/user/onboarding-status')
      .then(async (response) => (await response.json()) as OnboardingStatusResponse)
      .then((body) => {
        if (!body.ok) {
          setStatus(body.error ?? 'unable_to_load');
          return;
        }
        if (!body.onboardingRequired) {
          router.replace('/user');
          return;
        }
        if (body.shop) {
          setShopName(body.shop.name || 'Your shop');
          setName(body.shop.user_name ?? '');
          setPhone(body.shop.user_phone ?? '');
          setTimezone(body.shop.timezone || 'America/Los_Angeles');
          setCancelPolicy(body.shop.cancel_policy || '24-hour cancellation policy.');
          if (body.shop.services?.[0]) {
            setServiceName(body.shop.services[0].name);
            setServiceDuration(body.shop.services[0].duration_min);
            setServicePrice(body.shop.services[0].price);
          }
        }
      })
      .catch(() => setStatus('network_error'))
      .finally(() => setLoading(false));
  }, [router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    const response = await fetch('/api/backend/user/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_name: name,
        user_phone: phone,
        timezone,
        cancel_policy: cancelPolicy,
        services: [
          {
            name: serviceName,
            duration_min: serviceDuration,
            price: servicePrice,
          },
        ],
        hours: defaultBusinessHours(),
      }),
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !body?.ok) {
      setStatus(body?.error ?? 'save_failed');
      setSaving(false);
      return;
    }
    setStatus('saved');
    router.replace('/user');
    router.refresh();
  }

  const mergedStyles = [
    ...userSettingsStyles,
    String.raw`
.onboarding-shell{max-width:920px}
.onboarding-kicker{display:inline-flex;align-items:center;gap:8px;padding:7px 11px;border-radius:999px;background:#f5f3ff;color:#7c3aed;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.onboarding-grid{display:grid;grid-template-columns:1.25fr .75fr;gap:16px}
.onboarding-panel{display:grid;gap:14px}
.onboarding-summary{display:grid;gap:12px}
.onboarding-summary .list-item{padding:12px 14px}
.status-note{margin:0}
@media (max-width:980px){
  .onboarding-grid{grid-template-columns:1fr}
}
`,
  ];

  if (loading) {
    return (
      <UserLayout styles={mergedStyles} scripts={userSettingsScripts} scriptPrefix="user-onboarding-live">
        <div className="app-shell">
          <aside className="sidebar">
            <div className="sidebar-inner">
              <div className="brand">
                <div className="brand-mark">
                  <div className="brand-ripple r3" />
                  <div className="brand-ripple r2" />
                  <div className="brand-core">
                    <svg viewBox="0 0 24 24">
                      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#fff" stroke="none" />
                    </svg>
                  </div>
                </div>
                <span>RingBooker</span>
              </div>
              <div className="workspace">
                <h3>Onboarding in progress</h3>
                <p>We are preparing your workspace. This takes a few seconds.</p>
              </div>
              <div className="sidebar-spacer" />
            </div>
          </aside>
          <main className="main">
            <section className="card onboarding-shell">
              <h3>Loading onboarding...</h3>
              <p className="sub">Please wait while we load your shop profile.</p>
            </section>
          </main>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout styles={mergedStyles} scripts={userSettingsScripts} scriptPrefix="user-onboarding-live">
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-inner">
            <div className="brand">
              <div className="brand-mark">
                <div className="brand-ripple r3" />
                <div className="brand-ripple r2" />
                <div className="brand-core">
                  <svg viewBox="0 0 24 24">
                    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#fff" stroke="none" />
                  </svg>
                </div>
              </div>
              <span>RingBooker</span>
            </div>
            <div className="workspace">
              <h3>{shopName}</h3>
              <p>Finish setup once to unlock bookings, calls, and billing in your user portal.</p>
            </div>
            <div className="nav-section">
              <div className="nav-label">User Portal</div>
              <div className="nav-list">
                <a className="nav-item active" href="/user/onboarding">
                  <div className="nav-icon">
                    <svg viewBox="0 0 24 24"><path d="M5 12l4 4L19 6" /></svg>
                  </div>
                  <span>Onboarding</span>
                </a>
                <span className="nav-item">
                  <div className="nav-icon">
                    <svg viewBox="0 0 24 24"><rect x={3} y={4} width={7} height={7} rx="1.5" /><rect x={14} y={4} width={7} height={4} rx="1.5" /><rect x={14} y={11} width={7} height={9} rx="1.5" /><rect x={3} y={14} width={7} height={6} rx="1.5" /></svg>
                  </div>
                  <span>Overview (after setup)</span>
                </span>
                <span className="nav-item">
                  <div className="nav-icon">
                    <svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" /></svg>
                  </div>
                  <span>Settings (after setup)</span>
                </span>
              </div>
            </div>
            <div className="sidebar-spacer" />
            <div className="sidebar-foot">
              <strong>Fast setup, then refine later.</strong>
              <small>This page captures only the essentials. You can adjust full AI behavior in Settings after entering the dashboard.</small>
            </div>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <span className="onboarding-kicker">Step 1 of 1 · Quick Setup</span>
              <h1 style={{ marginTop: 10 }}>Welcome to RingBooker</h1>
              <p>Complete this quick setup once. We will take you to your dashboard right after save.</p>
            </div>
            <div className="top-actions">
              <span className="btn">Estimated time: 2 minutes</span>
              <button className="btn purple" type="submit" form="onboarding-form" disabled={saving}>
                {saving ? 'Saving...' : 'Finish setup and go to dashboard'}
              </button>
            </div>
          </div>

          <div className="onboarding-grid">
            <section className="card onboarding-panel">
              <div className="panel-head">
                <div>
                  <h3>Business essentials</h3>
                  <p className="sub">These values are used immediately by your AI receptionist for call handling and booking logic.</p>
                </div>
                <span className="badge-right">Required</span>
              </div>

              <form id="onboarding-form" onSubmit={onSubmit} className="card-section">
                <div className="form-grid">
                  <div className="field">
                    <label>Your name</label>
                    <input required value={name} onChange={(event) => setName(event.target.value)} />
                  </div>
                  <div className="field">
                    <label>Business phone</label>
                    <input required value={phone} onChange={(event) => setPhone(event.target.value)} />
                  </div>
                  <div className="field">
                    <label>Timezone</label>
                    <input required value={timezone} onChange={(event) => setTimezone(event.target.value)} />
                  </div>
                  <div className="field">
                    <label>Default cancel policy</label>
                    <input required value={cancelPolicy} onChange={(event) => setCancelPolicy(event.target.value)} />
                  </div>
                </div>

                <div className="panel-head" style={{ marginTop: 4 }}>
                  <div>
                    <h3>First service</h3>
                    <p className="sub">Add one core service so your AI can start answering pricing and booking questions correctly.</p>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>Service name</label>
                    <input required value={serviceName} onChange={(event) => setServiceName(event.target.value)} />
                  </div>
                  <div className="field">
                    <label>Duration (minutes)</label>
                    <input
                      type="number"
                      min={5}
                      step={5}
                      required
                      value={serviceDuration}
                      onChange={(event) => setServiceDuration(Number(event.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label>Price</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      required
                      value={servicePrice}
                      onChange={(event) => setServicePrice(Number(event.target.value))}
                    />
                  </div>
                </div>

                {status ? (
                  <div className="note status-note">
                    {status === 'saved' ? 'Setup saved successfully. Redirecting to your dashboard...' : `Unable to save setup: ${status}`}
                  </div>
                ) : null}
              </form>
            </section>

            <aside className="card onboarding-summary">
              <div className="panel-head">
                <div>
                  <h3>What happens next</h3>
                  <p className="sub">After this step, your shop panel is ready for live operations.</p>
                </div>
              </div>
              <div className="list">
                <div className="list-item">
                  <div className="item-main">
                    <div className="avatar">1</div>
                    <div>
                      <h4>Dashboard unlocked</h4>
                      <p>See live bookings, calls, and key health metrics.</p>
                    </div>
                  </div>
                </div>
                <div className="list-item">
                  <div className="item-main">
                    <div className="avatar">2</div>
                    <div>
                      <h4>Settings expanded</h4>
                      <p>Configure full service menu, hours, AI greeting, and transfer rules.</p>
                    </div>
                  </div>
                </div>
                <div className="list-item">
                  <div className="item-main">
                    <div className="avatar">3</div>
                    <div>
                      <h4>Go live quickly</h4>
                      <p>Your AI can already respond with the first service and cancellation policy you set here.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="note">Tip: keep this setup simple now. You can refine every detail later in Settings without downtime.</div>
            </aside>
          </div>
        </main>
      </div>
    </UserLayout>
  );
}
