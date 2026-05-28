'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  BOOKING_LINK_APPS,
  type BookingMethod,
  FULL_SYNC_APPS,
  findIntegrationApp,
  toBackendProviderKey,
  type IntegrationApp,
  type IntegrationAppKey,
} from '@/lib/integrations-config';
import { useIntegrations } from '@/hooks/useIntegrations';

function AppLogo({ app }: { app: IntegrationApp }) {
  if (app.logoSrc) {
    return (
      <span className="integration-app-logo integration-app-logo--image" aria-hidden="true">
        <img src={app.logoSrc} alt="" width={38} height={38} loading="lazy" decoding="async" />
      </span>
    );
  }

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

function stringifyMappings(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  return Object.entries(value as Record<string, unknown>)
    .filter(([, mapped]) => typeof mapped === 'string' && mapped.trim())
    .map(([key, mapped]) => `${key}=${String(mapped).trim()}`)
    .join('\n');
}

function parseMappings(value: string): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const rawLine of value.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.includes('=') ? '=' : ':';
    const [rawKey, ...rest] = line.split(separator);
    const key = rawKey?.trim().toLowerCase().replace(/\s+/g, ' ');
    const id = rest.join(separator).trim();
    if (key && id) mapped[key] = id;
  }
  return mapped;
}

function BookingMethodQuestion({ onChoose, showLater = true }: {
  onChoose: (method: 'app' | 'direct' | 'later') => void;
  showLater?: boolean;
}) {
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
      {showLater ? (
        <button type="button" className="user-link--subtle integrations-later-link" onClick={() => onChoose('later')}>
          I&apos;ll set this up later
        </button>
      ) : null}
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
      <button type="button" className="user-link--subtle integrations-back-link" onClick={onBack}>← Back</button>
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
          <a className="user-link" href={app.helpUrl} target="_blank" rel="noreferrer">
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
          <div className="integration-info-box">
            <strong>Square Appointments booking provider.</strong>
            <br />
            Services/catalog sync: available · Staff sync: available · Availability check: {provider?.details?.availabilityCheck === 'available' ? 'available' : 'needs mapping'} · Direct appointment creation: {provider?.details?.directAppointmentCreation === 'enabled' ? 'enabled' : 'not enabled'}.
          </div>
          <p className="calendar-int-desc">Choose a Square location and service variation before RingBooker creates appointments directly. If Square fails, RingBooker captures the booking request instead.</p>
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
          <p className="calendar-int-desc">Sign in with your Square account — RingBooker will use Square Appointments as a booking provider after you choose the location and service target.</p>
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

function MindbodyConfigPanel({
  connected,
  provider,
  onConnect,
  onDisconnect,
}: {
  connected: boolean;
  provider: { details: Record<string, unknown> | null } | null;
  onConnect: (creds: {
    siteId: string;
    apiKey: string;
    sourceName?: string;
    staffToken?: string;
    locationId?: string;
    sessionTypeId?: string;
    staffId?: string;
    bookingUrl?: string;
  }) => Promise<void>;
  onDisconnect: () => Promise<void>;
}) {
  const details = provider?.details ?? {};
  const [siteId, setSiteId] = useState(String(details.siteId ?? ''));
  const [apiKey, setApiKey] = useState('');
  const [sourceName, setSourceName] = useState(String(details.sourceName ?? 'RingBooker'));
  const [locationId, setLocationId] = useState(String(details.locationId ?? ''));
  const [sessionTypeId, setSessionTypeId] = useState(String(details.sessionTypeId ?? ''));
  const [staffId, setStaffId] = useState(String(details.staffId ?? ''));
  const [bookingUrl, setBookingUrl] = useState(String(details.bookingUrl ?? ''));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSiteId(String(details.siteId ?? ''));
    setSourceName(String(details.sourceName ?? 'RingBooker'));
    setLocationId(String(details.locationId ?? ''));
    setSessionTypeId(String(details.sessionTypeId ?? ''));
    setStaffId(String(details.staffId ?? ''));
    setBookingUrl(String(details.bookingUrl ?? ''));
  }, [provider?.details]);

  return (
    <div className="integration-config-body">
      {connected ? (
        <div className="integration-success-box">Connected · Site ID: {String(details.siteId ?? siteId)}</div>
      ) : (
        <div className="integration-info-box">
          Mindbody API access requires an approved developer account and activated site access. If API booking is unavailable, RingBooker will capture the request and alert you instead.
        </div>
      )}
      <div className="integration-info-box">
        <strong>Current Mindbody mode: capture request only.</strong>
        <br />
        Services/staff sync: available · Availability check: best-effort · Direct appointment creation: not enabled.
      </div>
      <div className="calendar-int-grid">
        <div className="field integration-config-field">
          <label>Mindbody Site ID</label>
          <input value={siteId} onChange={(event) => setSiteId(event.target.value)} placeholder="123456" />
        </div>
        <div className="field integration-config-field">
          <label>API key</label>
          <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Your Mindbody API key" />
        </div>
        <div className="field integration-config-field">
          <label>Source name</label>
          <input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="RingBooker" />
        </div>
        <div className="field integration-config-field">
          <label>Location ID optional</label>
          <input value={locationId} onChange={(event) => setLocationId(event.target.value)} placeholder="1" />
        </div>
        <div className="field integration-config-field">
          <label>Session type ID optional</label>
          <input value={sessionTypeId} onChange={(event) => setSessionTypeId(event.target.value)} placeholder="17" />
        </div>
        <div className="field integration-config-field">
          <label>Staff ID optional</label>
          <input value={staffId} onChange={(event) => setStaffId(event.target.value)} placeholder="5" />
        </div>
      </div>
      <div className="field integration-config-field">
        <label>Booking URL fallback optional</label>
        <input value={bookingUrl} onChange={(event) => setBookingUrl(event.target.value)} placeholder="https://clients.mindbodyonline.com/..." />
      </div>
      {message ? <div className="note">{message}</div> : null}
      <div className="integrations-inline-actions">
        <button
          type="button"
          className="btn user-save integrations-primary-button"
          disabled={busy || !siteId.trim() || !apiKey.trim()}
          onClick={async () => {
            setBusy(true);
            setMessage(null);
            try {
              await onConnect({
                siteId: siteId.trim(),
                apiKey: apiKey.trim(),
                sourceName: sourceName.trim() || undefined,
                locationId: locationId.trim() || undefined,
                sessionTypeId: sessionTypeId.trim() || undefined,
                staffId: staffId.trim() || undefined,
                bookingUrl: bookingUrl.trim() || undefined,
              });
              setApiKey('');
              setMessage('Mindbody settings saved.');
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Unable to connect Mindbody.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Saving...' : connected ? 'Save Mindbody settings' : 'Connect Mindbody'}
        </button>
        {connected ? (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await onDisconnect(); } finally { setBusy(false); }
            }}
          >
            Disconnect Mindbody
          </button>
        ) : null}
        <a className="user-link" href="https://developers.mindbodyonline.com/" target="_blank" rel="noreferrer">
          Mindbody developer docs →
        </a>
      </div>
      <div className="note">RingBooker will not tell callers an appointment is confirmed. Mindbody booking creation is not enabled in this release.</div>
    </div>
  );
}

function AcuityConfigPanel({
  connected,
  provider,
  onConnect,
  onDisconnect,
}: {
  connected: boolean;
  provider: { details: Record<string, unknown> | null } | null;
  onConnect: (creds: {
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
  }) => Promise<void>;
  onDisconnect: () => Promise<void>;
}) {
  const details = provider?.details ?? {};
  const [userId, setUserId] = useState(String(details.userId ?? ''));
  const [apiKey, setApiKey] = useState('');
  const [appointmentTypeId, setAppointmentTypeId] = useState(String(details.appointmentTypeId ?? ''));
  const [defaultCalendarId, setDefaultCalendarId] = useState(String(details.defaultCalendarId ?? details.calendarId ?? ''));
  const [serviceMappingsText, setServiceMappingsText] = useState(stringifyMappings(details.serviceMappings));
  const [staffMappingsText, setStaffMappingsText] = useState(stringifyMappings(details.staffMappings));
  const [requiresCallerEmail, setRequiresCallerEmail] = useState(Boolean(details.requiresCallerEmail ?? false));
  const [timezone, setTimezone] = useState(String(details.timezone ?? ''));
  const [bookingUrl, setBookingUrl] = useState(String(details.bookingUrl ?? ''));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setUserId(String(details.userId ?? ''));
    setAppointmentTypeId(String(details.appointmentTypeId ?? ''));
    setDefaultCalendarId(String(details.defaultCalendarId ?? details.calendarId ?? ''));
    setServiceMappingsText(stringifyMappings(details.serviceMappings));
    setStaffMappingsText(stringifyMappings(details.staffMappings));
    setRequiresCallerEmail(Boolean(details.requiresCallerEmail ?? false));
    setTimezone(String(details.timezone ?? ''));
    setBookingUrl(String(details.bookingUrl ?? ''));
  }, [provider?.details]);

  const directAppointmentCreation = String(details.directAppointmentCreation ?? 'not_enabled');
  const bookingMode = String(details.bookingMode ?? 'capture_request_only');
  const missingMappings = Array.isArray(details.missingMappings) ? details.missingMappings.map(String) : [];

  return (
    <div className="integration-config-body">
      {connected ? (
        <div className="integration-success-box">Connected · User ID: {String(details.userId ?? userId)}</div>
      ) : (
        <div className="integration-info-box">
          Acuity API credentials are stored server-side. RingBooker can sync appointment types and calendars, then use direct booking only when mappings and the direct booking flag are enabled.
        </div>
      )}
      <div className="integration-info-box">
        <strong>Current Acuity mode: {bookingMode === 'direct_booking_with_fallback' ? 'direct booking with fallback' : 'capture request only'}.</strong>
        <br />
        Appointment types sync: available · Calendars sync: available · Availability check: {details.availabilityCheck === 'available' ? 'available' : 'needs service mapping'} · Direct appointment creation: {directAppointmentCreation === 'enabled' ? 'On' : 'Off'}.
      </div>
      {missingMappings.length ? (
        <div className="integration-info-box">
          <strong>Missing mapping before direct booking can run:</strong>
          <br />
          {missingMappings.join(' ')}
        </div>
      ) : null}
      <div className="calendar-int-grid">
        <div className="field integration-config-field">
          <label>Acuity User ID</label>
          <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="12345678" />
        </div>
        <div className="field integration-config-field">
          <label>API key</label>
          <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Your Acuity API key" />
        </div>
        <div className="field integration-config-field">
          <label>Legacy default appointment type ID optional</label>
          <input value={appointmentTypeId} onChange={(event) => setAppointmentTypeId(event.target.value)} placeholder="1001" />
        </div>
        <div className="field integration-config-field">
          <label>Default Acuity calendar ID</label>
          <input value={defaultCalendarId} onChange={(event) => setDefaultCalendarId(event.target.value)} placeholder="2002" />
        </div>
        <div className="field integration-config-field">
          <label>Timezone optional</label>
          <input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="America/Chicago" />
        </div>
        <div className="field integration-config-field">
          <label>Booking URL fallback optional</label>
          <input value={bookingUrl} onChange={(event) => setBookingUrl(event.target.value)} placeholder="https://your-business.as.me/" />
        </div>
      </div>
      <div className="field integration-config-field">
        <label>RingBooker service → Acuity appointment type ID</label>
        <textarea
          value={serviceMappingsText}
          onChange={(event) => setServiceMappingsText(event.target.value)}
          placeholder={'haircut=1001\nhair color=1002'}
          rows={4}
        />
        <small>One mapping per line. Direct booking requires a matching service mapping.</small>
      </div>
      <div className="field integration-config-field">
        <label>RingBooker staff/provider → Acuity calendar ID optional</label>
        <textarea
          value={staffMappingsText}
          onChange={(event) => setStaffMappingsText(event.target.value)}
          placeholder={'alex=2002\njamie=2003'}
          rows={3}
        />
        <small>If no staff mapping matches, RingBooker uses the default Acuity calendar ID.</small>
      </div>
      <label className="integration-checkbox-row">
        <input type="checkbox" checked={requiresCallerEmail} onChange={(event) => setRequiresCallerEmail(event.target.checked)} />
        <span>Require caller email before direct Acuity booking. If missing, RingBooker captures a booking request instead.</span>
      </label>
      {message ? <div className="note">{message}</div> : null}
      <div className="integrations-inline-actions">
        <button
          type="button"
          className="btn user-save integrations-primary-button"
          disabled={busy || !userId.trim() || !apiKey.trim()}
          onClick={async () => {
            setBusy(true);
            setMessage(null);
            try {
              await onConnect({
                userId: userId.trim(),
                apiKey: apiKey.trim(),
                appointmentTypeId: appointmentTypeId.trim() || undefined,
                calendarId: defaultCalendarId.trim() || undefined,
                defaultCalendarId: defaultCalendarId.trim() || undefined,
                serviceMappings: parseMappings(serviceMappingsText),
                staffMappings: parseMappings(staffMappingsText),
                requiresCallerEmail,
                timezone: timezone.trim() || undefined,
                bookingUrl: bookingUrl.trim() || undefined,
              });
              setApiKey('');
              setMessage('Acuity settings saved.');
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Unable to connect Acuity.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Saving...' : connected ? 'Save Acuity settings' : 'Connect Acuity'}
        </button>
        {connected ? (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await onDisconnect(); } finally { setBusy(false); }
            }}
          >
            Disconnect Acuity
          </button>
        ) : null}
        <a className="user-link" href="https://developers.acuityscheduling.com/" target="_blank" rel="noreferrer">
          Acuity developer docs →
        </a>
      </div>
      <div className="note">RingBooker only tells callers an appointment is confirmed after Acuity returns a real appointment ID. Failed API bookings become normal booking requests.</div>
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

function AppConfigPanel({ appKey, providers, selectedProvider, saveBookingLink, connectMindbody, connectAcuity, disconnectMindbody, disconnectAcuity, disconnectSquare, refresh }: {
  appKey: IntegrationAppKey | null;
  providers: Array<{ id: string; connected: boolean; details: Record<string, unknown> | null }>;
  selectedProvider: { id: string; connected: boolean; details: Record<string, unknown> | null } | null;
  saveBookingLink: (url: string, key: IntegrationAppKey) => Promise<void>;
  connectMindbody: (creds: {
    siteId: string;
    apiKey: string;
    sourceName?: string;
    staffToken?: string;
    locationId?: string;
    sessionTypeId?: string;
    staffId?: string;
    bookingUrl?: string;
  }) => Promise<void>;
  connectAcuity: (creds: {
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
  }) => Promise<void>;
  disconnectMindbody: () => Promise<void>;
  disconnectAcuity: () => Promise<void>;
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

  const savedUrl = typeof selectedProvider?.details?.bookingUrl === 'string' ? selectedProvider.details.bookingUrl : null;
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
      ) : app.key === 'mindbody' ? (
        <MindbodyConfigPanel connected={connected} provider={selectedProvider} onConnect={connectMindbody} onDisconnect={disconnectMindbody} />
      ) : app.key === 'acuity' ? (
        <AcuityConfigPanel connected={connected} provider={selectedProvider} onConnect={connectAcuity} onDisconnect={disconnectAcuity} />
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

type IntegrationsRedesignProps = {
  canUseThirdPartyIntegrations: boolean;
  initialBookingMethod?: BookingMethod;
  initialBookingUrl?: string | null;
};

function StarterIntegrationsView({ initialBookingMethod, initialBookingUrl }: {
  initialBookingMethod?: BookingMethod;
  initialBookingUrl?: string | null;
}) {
  const [bookingMethod, setBookingMethodState] = useState<BookingMethod>(initialBookingMethod ?? null);
  const [bookingUrl, setBookingUrl] = useState(initialBookingUrl ?? '');
  const [savingMethod, setSavingMethod] = useState<BookingMethod | null>(null);
  const [savingUrl, setSavingUrl] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setBookingMethodState(initialBookingMethod ?? null);
  }, [initialBookingMethod]);

  useEffect(() => {
    setBookingUrl(initialBookingUrl ?? '');
  }, [initialBookingUrl]);

  async function saveSettings(patch: Record<string, unknown>) {
    const response = await fetch('/api/backend/user/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const body = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !body.ok) {
      throw new Error(body.error === 'plan_feature_locked' ? 'This feature requires Professional.' : 'Unable to save changes.');
    }
  }

  async function chooseMethod(method: BookingMethod) {
    setSavingMethod(method);
    setMessage(null);
    setBookingMethodState(method);
    try {
      await saveSettings({ booking_method: method });
      setMessage(method === 'app' ? 'Booking app selected.' : method === 'direct' ? 'Direct booking selected.' : 'Saved for later.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to save booking setup.');
    } finally {
      setSavingMethod(null);
    }
  }

  async function saveBookingUrl() {
    setSavingUrl(true);
    setMessage(null);
    try {
      await saveSettings({
        booking_method: 'app',
        booking_url: bookingUrl.trim() || null,
      });
      setBookingMethodState('app');
      setMessage('Booking link saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to save booking link.');
    } finally {
      setSavingUrl(false);
    }
  }

  const lockedApps = FULL_SYNC_APPS.filter((app) => app.key === 'square' || app.key === 'mindbody' || app.key === 'acuity');

  return (
    <div className="integrations-redesign">
      <div className="panel-head integrations-redesign-head">
        <div>
          <h3>Integrations</h3>
          <p className="sub">Connect how clients book so RingBooker gives callers the right next step.</p>
        </div>
      </div>

      <div className="integration-info-box">
        <div className="integrations-inline-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span aria-hidden="true" className="integration-method-icon">⚡</span>
          <div style={{ flex: 1 }}>
            <strong>Live sync with Square, Mindbody & more</strong>
            <p className="sub" style={{ margin: '4px 0 0' }}>
              RingBooker checks real-time availability when callers ask to book — Professional plan and above.
            </p>
          </div>
          <a className="btn user-save integrations-primary-button" href="/user/billing">Upgrade to Pro</a>
        </div>
      </div>

      <BookingMethodQuestion onChoose={(method) => void chooseMethod(method)} showLater={false} />

      {bookingMethod === 'app' ? (
        <div className="integration-config-panel">
          <div className="field integration-config-field">
            <label>Booking link</label>
            <small>RingBooker texts this link to callers who ask to book.</small>
            <input value={bookingUrl} onChange={(event) => setBookingUrl(event.target.value)} placeholder="https://yourbookingsite.com/book" />
          </div>
          <button
            type="button"
            className="btn user-save integrations-primary-button"
            disabled={savingUrl || !bookingUrl.trim()}
            onClick={() => void saveBookingUrl()}
          >
            {savingUrl ? 'Saving...' : 'Save booking link'}
          </button>
        </div>
      ) : null}

      {message ? <div className="note">{message}</div> : null}
      {savingMethod ? <div className="note">Saving booking setup...</div> : null}

      <section className="integrations-app-section" aria-disabled="true">
        <div>
          <h4>Live availability sync <span className="integration-app-badge">Pro</span></h4>
          <p className="sub">Requires Professional plan.</p>
        </div>
        <div className="integrations-app-grid integrations-app-grid--sync">
          {lockedApps.map((app) => (
            <button
              key={app.key}
              type="button"
              className="integration-app-card"
              disabled
              style={{ opacity: 0.4, cursor: 'not-allowed' }}
            >
              <AppLogo app={app} />
              <span className="integration-app-copy">
                <strong>{app.name}</strong>
                <small>Full sync</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <button type="button" className="user-link--subtle integrations-later-link" onClick={() => void chooseMethod('later')}>
        I&apos;ll set this up later
      </button>
    </div>
  );
}

export function IntegrationsRedesign({
  canUseThirdPartyIntegrations,
  initialBookingMethod = null,
  initialBookingUrl = null,
}: IntegrationsRedesignProps) {
  const {
    status,
    selectedProvider,
    setBookingMethod,
    setSelectedApp,
    saveBookingLink,
    connectMindbody,
    connectAcuity,
    disconnectMindbody,
    disconnectAcuity,
    disconnectSquare,
    goBack,
    refresh,
  } = useIntegrations({ enabled: canUseThirdPartyIntegrations });

  const selectedApp = useMemo(() => findIntegrationApp(status.selectedApp), [status.selectedApp]);

  if (!canUseThirdPartyIntegrations) {
    return <StarterIntegrationsView initialBookingMethod={initialBookingMethod} initialBookingUrl={initialBookingUrl} />;
  }

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
            connectMindbody={connectMindbody}
            connectAcuity={connectAcuity}
            disconnectMindbody={disconnectMindbody}
            disconnectAcuity={disconnectAcuity}
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
