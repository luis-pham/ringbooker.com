'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  BOOKING_LINK_APPS,
  FULL_SYNC_APPS,
  findIntegrationApp,
  toBackendProviderKey,
  type IntegrationApp,
  type IntegrationAppKey,
} from '@/lib/integrations-config';
import { useIntegrations } from '@/hooks/useIntegrations';

function AppLogo({ app }: { app: IntegrationApp }) {
  return (
    <span
      className="integration-app-logo"
      style={{ background: app.logoColor, color: app.logoTextColor }}
      aria-hidden="true"
    >
      {app.logoText}
    </span>
  );
}

function StatusDot({ connected }: { connected: boolean }) {
  return <span className={`integration-status-dot ${connected ? 'connected' : ''}`} aria-hidden="true" />;
}

function BookingMethodQuestion({ onChoose }: { onChoose: (method: 'app' | 'direct' | 'later') => void }) {
  return (
    <div className="integrations-flow-stack">
      <div>
        <h4 className="integrations-flow-title">How do your clients book appointments?</h4>
        <p className="sub integrations-flow-sub">
          This helps RingBooker give callers the right information when they ask to book.
        </p>
      </div>
      <div className="integrations-method-grid">
        <button type="button" className="integration-method-card" onClick={() => onChoose('app')}>
          <span className="integration-method-icon" aria-hidden="true">📱</span>
          <span>
            <strong>I use a booking app</strong>
            <small>Square, Fresha, Boulevard, Calendly, Vagaro, or similar</small>
          </span>
        </button>
        <button type="button" className="integration-method-card" onClick={() => onChoose('direct')}>
          <span className="integration-method-icon" aria-hidden="true">📞</span>
          <span>
            <strong>Clients call or message me directly</strong>
            <small>No booking app — I manage appointments myself</small>
          </span>
        </button>
      </div>
      <button type="button" className="subtle-link integrations-later-link" onClick={() => onChoose('later')}>
        I&apos;ll set this up later
      </button>
    </div>
  );
}

function AppCard({ app, selected, connected, onSelect }: { app: IntegrationApp; selected: boolean; connected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={`integration-app-card ${selected ? 'selected' : ''} ${app.comingSoon ? 'soon' : ''}`}
      onClick={onSelect}
    >
      <AppLogo app={app} />
      <span className="integration-app-copy">
        <strong>{app.name}</strong>
        <small>{app.category === 'full-sync' ? 'Full sync' : 'Link only'}</small>
      </span>
      {connected ? <span className="integration-app-badge connected">Connected</span> : null}
      {app.comingSoon ? <span className="integration-app-badge">Coming soon</span> : null}
    </button>
  );
}

function AppPicker({ selectedApp, providers, onBack, onSelect }: {
  selectedApp: IntegrationAppKey | null;
  providers: Array<{ id: string; connected: boolean }>;
  onBack: () => void;
  onSelect: (key: IntegrationAppKey) => void;
}) {
  const isConnected = (app: IntegrationApp) => providers.some((provider) => provider.id === toBackendProviderKey(app.key) && provider.connected);

  return (
    <div className="integrations-flow-stack">
      <button type="button" className="subtle-link integrations-back-link" onClick={onBack}>← Back</button>
      <section className="integrations-app-section">
        <div>
          <h4>Full sync — live availability</h4>
          <p className="sub">RingBooker checks your calendar in real time.</p>
        </div>
        <div className="integrations-app-grid integrations-app-grid--sync">
          {FULL_SYNC_APPS.map((app) => (
            <AppCard key={app.key} app={app} selected={selectedApp === app.key} connected={isConnected(app)} onSelect={() => onSelect(app.key)} />
          ))}
        </div>
      </section>
      <section className="integrations-app-section">
        <div>
          <h4>Booking link — SMS to caller</h4>
          <p className="sub">RingBooker texts your URL to callers who ask to book.</p>
        </div>
        <div className="integrations-app-grid integrations-app-grid--link">
          {BOOKING_LINK_APPS.map((app) => (
            <AppCard key={app.key} app={app} selected={selectedApp === app.key} connected={isConnected(app)} onSelect={() => onSelect(app.key)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function LinkConfigPanel({ app, savedUrl, onSave }: { app: IntegrationApp; savedUrl: string | null; onSave: (url: string) => Promise<void> }) {
  const [url, setUrl] = useState(savedUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setUrl(savedUrl ?? ''), [savedUrl, app.key]);

  const isVagaro = app.key === 'vagaro';
  return (
    <div className="integration-config-body">
      {isVagaro ? (
        <div className="integration-info-box">
          Full calendar sync requires Vagaro API access. In the meantime, paste your booking page URL — callers will receive it by SMS when they ask to book.
        </div>
      ) : (
        <p className="calendar-int-desc">
          When callers ask to book, RingBooker texts this link automatically. No calendar sync.
        </p>
      )}
      <div className="field integration-config-field">
        <label>{isVagaro ? 'Your Vagaro booking URL' : 'Your booking URL'}</label>
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={app.placeholder ?? 'https://yourbookingsite.com/book'} />
      </div>
      {savedUrl ? <div className="note integration-saved-url">✓ Saved: {savedUrl}</div> : null}
      {message ? <div className="note">{message}</div> : null}
      <div className="integrations-inline-actions">
        <button
          type="button"
          className="btn user-save integrations-primary-button"
          disabled={saving || !url.trim()}
          onClick={async () => {
            setSaving(true);
            setMessage(null);
            try {
              await onSave(url.trim());
              setMessage('Booking link saved.');
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Unable to save booking link.');
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? 'Saving...' : 'Save booking link'}
        </button>
        {isVagaro && app.helpUrl ? (
          <a className="subtle-link" href={app.helpUrl} target="_blank" rel="noreferrer">
            Want full sync? Apply for Vagaro API access →
          </a>
        ) : null}
      </div>
      <div className="note">One link per account. Callers receive it by SMS.</div>
    </div>
  );
}

function SquareConfigPanel({ connected, provider, onDisconnect, onRefresh }: {
  connected: boolean;
  provider: { details: Record<string, unknown> | null } | null;
  onDisconnect: () => Promise<void>;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="integration-config-body">
      {connected ? (
        <>
          <div className="integration-success-box">Connected · Merchant: {String(provider?.details?.merchantId ?? 'Square')}</div>
          <p className="calendar-int-desc">Use the existing Square settings flow to choose location and service target.</p>
          <div className="integrations-inline-actions">
            <button type="button" className="btn" onClick={onRefresh}>Refresh</button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try { await onDisconnect(); } finally { setBusy(false); }
              }}
            >
              {busy ? 'Disconnecting...' : 'Disconnect Square'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="calendar-int-desc">Sign in with your Square account — RingBooker will ask which location and service to use.</p>
          <button
            type="button"
            className="btn user-save integrations-primary-button"
            onClick={() => { window.location.href = '/api/backend/user/calendar/providers/square_appointments/connect/start'; }}
          >
            Sign in with Square
          </button>
        </>
      )}
    </div>
  );
}

function ComingSoonPanel({ app, onSave }: { app: IntegrationApp; onSave: (url: string) => Promise<void> }) {
  return (
    <div className="integration-config-body">
      <div className="integration-info-box">{app.name} integration is coming soon.</div>
      <LinkConfigPanel app={{ ...app, connectionType: 'link', category: 'booking-link' }} savedUrl={null} onSave={onSave} />
    </div>
  );
}

function AppConfigPanel({ appKey, providers, selectedProvider, saveBookingLink, disconnectSquare, refresh }: {
  appKey: IntegrationAppKey | null;
  providers: Array<{ id: string; connected: boolean; details: Record<string, unknown> | null }>;
  selectedProvider: { id: string; connected: boolean; details: { bookingUrl?: string | null; merchantId?: string | null } | null } | null;
  saveBookingLink: (url: string, key: IntegrationAppKey) => Promise<void>;
  disconnectSquare: () => Promise<void>;
  refresh: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const app = findIntegrationApp(appKey);
  const connected = app ? providers.some((provider) => provider.id === toBackendProviderKey(app.key) && provider.connected) : false;

  useEffect(() => {
    if (app && panelRef.current) panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [app]);

  if (!app) return null;

  const savedUrl = selectedProvider?.details?.bookingUrl ?? null;
  return (
    <section ref={panelRef} className="integration-config-panel">
      <div className="integration-config-head">
        <AppLogo app={app} />
        <div>
          <h4>{app.name}</h4>
          <span className="integration-status-line"><StatusDot connected={connected} />{connected ? 'Connected' : 'Not connected'}</span>
        </div>
        <button type="button" className="btn" onClick={refresh}>Refresh</button>
      </div>
      {app.key === 'square' ? (
        <SquareConfigPanel connected={connected} provider={selectedProvider} onDisconnect={disconnectSquare} onRefresh={refresh} />
      ) : app.comingSoon ? (
        <ComingSoonPanel app={app} onSave={(url) => saveBookingLink(url, app.key)} />
      ) : (
        <LinkConfigPanel app={app} savedUrl={savedUrl} onSave={(url) => saveBookingLink(url, app.key)} />
      )}
    </section>
  );
}

function DirectBookingConfirm({ onChange }: { onChange: () => void }) {
  return (
    <div className="integration-confirm-card success">
      <strong>✓ No integration needed</strong>
      <p>When callers ask to book, RingBooker captures their request and alerts you. You follow up and schedule directly. If you ever add a booking app, come back to connect it.</p>
      <div className="integrations-inline-actions integration-confirm-actions">
        <button type="button" className="btn" onClick={onChange}>
          Change booking setup
        </button>
      </div>
    </div>
  );
}

function SetupLaterConfirm({ onChange }: { onChange: () => void }) {
  return (
    <div className="integration-confirm-card">
      <strong>No problem — you can set this up anytime.</strong>
      <p>RingBooker will still answer calls and capture booking requests.</p>
      <div className="integrations-inline-actions integration-confirm-actions">
        <button type="button" className="btn" onClick={onChange}>
          Choose booking setup
        </button>
      </div>
    </div>
  );
}

export function IntegrationsRedesign() {
  const {
    status,
    selectedProvider,
    setBookingMethod,
    setSelectedApp,
    saveBookingLink,
    disconnectSquare,
    goBack,
    refresh,
  } = useIntegrations();

  const selectedApp = useMemo(() => findIntegrationApp(status.selectedApp), [status.selectedApp]);

  if (status.isLoading) {
    return <div className="note">Loading integrations...</div>;
  }

  return (
    <div className="integrations-redesign">
      <div className="panel-head integrations-redesign-head">
        <div>
          <h3>Integrations</h3>
          <p className="sub">Connect how clients book so RingBooker gives callers the right next step.</p>
        </div>
        <button type="button" className="btn" onClick={() => void refresh()}>Refresh</button>
      </div>

      {status.error ? <div className="note integration-error-note">{status.error}</div> : null}

      {status.step === 'question' ? (
        <BookingMethodQuestion onChoose={(method) => void setBookingMethod(method)} />
      ) : null}

      {status.step === 'app-picker' ? (
        <>
          <AppPicker
            selectedApp={status.selectedApp}
            providers={status.providers}
            onBack={() => void goBack()}
            onSelect={(key) => void setSelectedApp(key)}
          />
          <AppConfigPanel
            appKey={selectedApp?.key ?? null}
            providers={status.providers}
            selectedProvider={selectedProvider}
            saveBookingLink={saveBookingLink}
            disconnectSquare={disconnectSquare}
            refresh={() => void refresh()}
          />
        </>
      ) : null}

      {status.step === 'direct' ? <DirectBookingConfirm onChange={() => void goBack()} /> : null}
      {status.step === 'later' ? <SetupLaterConfirm onChange={() => void goBack()} /> : null}
    </div>
  );
}
