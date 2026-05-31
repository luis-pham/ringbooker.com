'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconBolt,
  IconCopy,
  IconDeviceMobile,
  IconEye,
  IconEyeOff,
  IconLink,
  IconLoader2,
  IconPhoneCall,
  IconRefresh,
} from '@tabler/icons-react';

import {
  BOOKING_LINK_APPS,
  type BookingMethod,
  FULL_SYNC_APPS,
  findIntegrationApp,
  fromBackendProviderKey,
  toBackendProviderKey,
  type IntegrationApp,
  type IntegrationAppKey,
} from '@/lib/integrations-config';
import { useIntegrations } from '@/hooks/useIntegrations';
import { integrationErrorMessage, normalizeIntegrationError } from '@/hooks/useIntegrations';
import type { IntegrationError, VagaroConnectionStatus, VagaroMode } from '@/hooks/useIntegrations';

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

function GenericLinkLogo() {
  return (
    <span className="integration-app-logo integration-app-logo--generic" aria-hidden="true">
      <IconLink size={26} stroke={2} />
    </span>
  );
}

function StatusDot({ connected, warning = false }: { connected: boolean; warning?: boolean }) {
  return <span className={`integration-status-dot ${connected ? 'connected' : ''} ${warning ? 'warning' : ''}`} aria-hidden="true" />;
}

function SectionBadge({ icon, label, variant }: { icon: 'refresh' | 'link'; label: string; variant: 'teal' | 'gray' }) {
  const Icon = icon === 'refresh' ? IconRefresh : IconLink;
  return (
    <span
      className={`integration-section-badge integration-section-badge--${variant}`}
    >
      <Icon size={12} stroke={2.2} aria-hidden="true" />
      {label}
    </span>
  );
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

function validateHttpsBookingUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? null : 'Booking link must start with https://';
  } catch {
    return 'Booking link must be a valid URL.';
  }
}

function IntegrationInlineError({ error }: { error: IntegrationError | null }) {
  if (!error) return null;
  return <div className="note integration-error-note">{error.message}</div>;
}

function BookingMethodQuestion({
  onChoose,
  showLater = true,
  title = 'How do your clients book?',
  subtitle = null,
  selectedMethod = null,
  disabled = false,
  savingMethod = null,
}: {
  onChoose: (method: 'app' | 'direct' | 'later') => void;
  showLater?: boolean;
  title?: string;
  subtitle?: string | null;
  selectedMethod?: BookingMethod;
  disabled?: boolean;
  savingMethod?: BookingMethod;
}) {
  const methodCardStyle = (method: 'app' | 'direct') => selectedMethod === method
    ? {
        border: '1.5px solid var(--starter-method-selected-border)',
        background: 'var(--starter-method-selected-bg)',
      }
    : {
        border: '0.5px solid var(--color-border-tertiary, var(--border))',
        background: 'var(--color-background-primary, var(--surface-card))',
      };

  return (
    <div className="integrations-flow-stack">
      <div>
        <h4 className="integrations-flow-title">{title}</h4>
        {subtitle ? <p className="sub integrations-flow-sub">{subtitle}</p> : null}
      </div>
      <div className="integrations-method-grid">
        <button type="button" className="integration-method-card" style={methodCardStyle('app')} aria-pressed={selectedMethod === 'app'} disabled={disabled} onClick={() => onChoose('app')}>
          <span className="integration-method-icon" aria-hidden="true">
            <IconDeviceMobile size={26} stroke={2} />
          </span>
          <span>
            <strong>I use a booking app</strong>
            <small>Square, Fresha, Boulevard, Calendly, Vagaro, or similar</small>
          </span>
          {savingMethod === 'app' ? <IconLoader2 className="integration-method-loading" size={16} stroke={2} aria-label="Saving" /> : null}
        </button>
        <button type="button" className="integration-method-card" style={methodCardStyle('direct')} aria-pressed={selectedMethod === 'direct'} disabled={disabled} onClick={() => onChoose('direct')}>
          <span className="integration-method-icon" aria-hidden="true">
            <IconPhoneCall size={26} stroke={2} />
          </span>
          <span>
            <strong>Clients call or message me directly</strong>
            <small>No booking app — I manage appointments myself</small>
          </span>
          {savingMethod === 'direct' ? <IconLoader2 className="integration-method-loading" size={16} stroke={2} aria-label="Saving" /> : null}
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

function AppCard({ app, selected, connected, liveReady = connected, onSelect, displayName, displayTag, displayTagVariant = 'default', upgradePill, dashed = false, useLinkIcon = false }: {
  app: IntegrationApp;
  selected: boolean;
  connected: boolean;
  liveReady?: boolean;
  onSelect: () => void;
  displayName?: string;
  displayTag?: string;
  displayTagVariant?: 'default' | 'success';
  upgradePill?: string;
  dashed?: boolean;
  useLinkIcon?: boolean;
}) {
  const tag = displayTag ?? (app.category === 'full-sync' ? 'Full sync' : 'Link only');
  return (
    <button
      type="button"
      className={`integration-app-card ${selected ? 'selected' : ''} ${app.comingSoon ? 'soon' : ''}`}
      onClick={onSelect}
      style={dashed ? { borderStyle: 'dashed' } : undefined}
    >
      {useLinkIcon ? (
        <span className="integration-app-logo" style={{ background: 'var(--bg-gray)', color: 'var(--text-gray)' }} aria-hidden="true">
          <IconLink size={20} stroke={2} />
        </span>
      ) : <AppLogo app={app} />}
      <span className="integration-app-copy">
        <strong>{displayName ?? app.name}</strong>
        {displayTagVariant === 'success' ? <small className="integration-app-badge connected">{tag}</small> : <small>{tag}</small>}
      </span>
      {upgradePill ? (
        <span
          className="integration-app-badge"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'var(--purple-ultra)',
            borderColor: 'var(--purple-dark)',
            color: 'var(--purple-dark)',
          }}
        >
          {upgradePill}
        </span>
      ) : null}
      {connected ? <span className={`integration-app-badge ${liveReady ? 'connected' : ''}`}>{liveReady ? 'Connected' : 'Setup needed'}</span> : null}
      {app.comingSoon ? <span className="integration-app-badge">Coming soon</span> : null}
    </button>
  );
}

function AppPicker({ selectedApp, providers, vagaroMode, vagaroConnectionStatus, onBack, onSelect }: {
  selectedApp: IntegrationAppKey | null;
  providers: Array<{ id: string; connected: boolean; liveReady?: boolean; configured?: boolean; readiness?: { liveReady: boolean } }>;
  vagaroMode: VagaroMode;
  vagaroConnectionStatus: VagaroConnectionStatus;
  onBack: () => void;
  onSelect: (key: IntegrationAppKey) => void;
}) {
  const isConnected = (app: IntegrationApp) => providers.some((provider) => provider.id === toBackendProviderKey(app.key) && provider.connected);
  const isLiveReady = (app: IntegrationApp) => {
    const provider = providers.find((item) => item.id === toBackendProviderKey(app.key));
    return Boolean(provider?.readiness?.liveReady ?? provider?.liveReady ?? provider?.configured ?? provider?.connected);
  };
  const visibleBookingLinkApps = BOOKING_LINK_APPS.filter((app) => (
    app.key === 'vagaro'
    || app.key === 'fresha'
    || app.key === 'boulevard'
    || app.key === 'booksy'
    || app.key === 'custom'
  ));

  return (
    <div className="integrations-flow-stack">
      <button type="button" className="user-link--subtle integrations-back-link" onClick={onBack}>← Back</button>
      <section className="integrations-app-section">
        <div>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Full sync <SectionBadge icon="refresh" label="Live availability" variant="teal" />
          </h4>
        </div>
        <div className="integrations-app-grid integrations-app-grid--sync">
          {FULL_SYNC_APPS.map((app) => (
            <AppCard key={app.key} app={app} selected={selectedApp === app.key} connected={isConnected(app)} liveReady={isLiveReady(app)} onSelect={() => onSelect(app.key)} />
          ))}
        </div>
      </section>
      <section className="integrations-app-section">
        <div>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Booking link <SectionBadge icon="link" label="SMS to caller" variant="gray" />
          </h4>
        </div>
        <div className="integrations-app-grid integrations-app-grid--link">
          {visibleBookingLinkApps.map((app) => (
            <AppCard
              key={app.key}
              app={app}
              selected={selectedApp === app.key}
              connected={isConnected(app)}
              liveReady={isLiveReady(app)}
              onSelect={() => onSelect(app.key)}
              displayName={app.key === 'custom' ? 'Any booking link' : undefined}
              displayTag={
                app.key === 'custom'
                  ? 'Works with any URL'
                  : app.key === 'vagaro' && vagaroMode === 'live_sync' && vagaroConnectionStatus === 'connected'
                    ? 'Live sync'
                    : undefined
              }
              displayTagVariant={app.key === 'vagaro' && vagaroMode === 'live_sync' && vagaroConnectionStatus === 'connected' ? 'success' : 'default'}
              upgradePill={app.supportsLiveSync && app.key === 'vagaro' && vagaroMode === 'link_only' ? '+ Live sync' : undefined}
              dashed={app.key === 'custom'}
              useLinkIcon={app.key === 'custom'}
            />
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

function VagaroStatusRow({
  title,
  description,
  status,
  alwaysOn = false,
}: {
  title: string;
  description: string;
  status: VagaroConnectionStatus;
  alwaysOn?: boolean;
}) {
  const isConnected = alwaysOn || status === 'connected';
  const label = alwaysOn ? 'Always on' : status === 'connected' ? 'Connected' : status === 'error' ? 'Connection error' : 'Awaiting credentials';
  const badgeStyle = isConnected
    ? undefined
    : status === 'error'
      ? { background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }
      : { background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' };
  return (
    <div className="integration-info-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span>
        <strong style={{ color: 'var(--text-dark)' }}>{title}</strong>
        <br />
        {description}
      </span>
      <span className={`integration-app-badge ${isConnected ? 'connected' : ''}`} style={badgeStyle}>
        {label}
      </span>
    </div>
  );
}

function VagaroConfigPanel({
  provider,
  vagaroMode,
  connectionStatus,
  rawWebhookToken,
  onSaveBookingLink,
  onConnect,
  onRegenerate,
  onSaveSettings,
}: {
  provider: { details: Record<string, unknown> | null } | null;
  vagaroMode: VagaroMode;
  connectionStatus: VagaroConnectionStatus;
  rawWebhookToken: string | null;
  onSaveBookingLink: (url: string) => Promise<void>;
  onConnect: (credentials: { clientId: string; clientSecretKey: string; region: string }) => Promise<unknown>;
  onRegenerate: () => Promise<string>;
  onSaveSettings: (settings: { mode?: VagaroMode; fallback_url?: string | null; booking_url?: string | null }) => Promise<void>;
}) {
  const details = provider?.details ?? {};
  const savedBookingUrl = typeof details.bookingUrl === 'string' ? details.bookingUrl : '';
  const savedFallbackUrl = typeof details.fallbackUrl === 'string' ? details.fallbackUrl : '';
  const savedRegion = typeof details.region === 'string' ? details.region : '';
  const savedClientId = typeof details.clientId === 'string' ? details.clientId : '';
  const maskedToken = typeof details.webhookTokenMasked === 'string' ? details.webhookTokenMasked : null;
  const businessName = typeof details.businessName === 'string' ? details.businessName : null;
  const readAvailabilityStatus = connectionStatus === 'connected' && typeof details.businessId === 'string' && details.businessId
    ? 'connected'
    : connectionStatus === 'error'
      ? 'error'
      : 'pending';
  const [localMode, setLocalMode] = useState<VagaroMode>(vagaroMode);
  const [bookingUrl, setBookingUrl] = useState(savedBookingUrl);
  const [clientId, setClientId] = useState(savedClientId);
  const [clientSecretKey, setClientSecretKey] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [region, setRegion] = useState(savedRegion);
  const [fallbackUrl, setFallbackUrl] = useState(savedFallbackUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<IntegrationError | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!isDirty) setLocalMode(vagaroMode);
  }, [isDirty, vagaroMode]);

  useEffect(() => {
    if (isDirty) return;
    setBookingUrl(savedBookingUrl);
    setFallbackUrl(savedFallbackUrl);
    setClientId(savedClientId);
    setRegion(savedRegion);
    setMessage(null);
    setInlineError(null);
  }, [isDirty, savedBookingUrl, savedFallbackUrl, savedClientId, savedRegion]);

  const webhookBase = typeof window === 'undefined'
    ? 'https://api.[your-domain]/api/backend/webhooks/vagaro'
    : `${window.location.origin}/api/backend/webhooks/vagaro`;
  const displayedEndpoint = webhookBase;
  const displayedHeaderToken = rawWebhookToken ?? maskedToken ?? 'whk_...';

  const modeButtonStyle = (mode: VagaroMode) => localMode === mode
    ? { border: '2px solid var(--purple-dark)', background: 'var(--purple-ultra)', color: 'var(--purple-dark)' }
    : { border: '1px solid var(--border)', background: 'var(--surface-card)', color: 'var(--text-dark)' };

  return (
    <div className="integration-config-body">
      <div className="integrations-inline-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
        <button
          type="button"
          className="btn"
          style={modeButtonStyle('link_only')}
          aria-pressed={localMode === 'link_only'}
          onClick={() => {
            setLocalMode('link_only');
            setIsDirty(true);
            setMessage(null);
            setInlineError(null);
          }}
        >
          Booking link
        </button>
        <button
          type="button"
          className="btn"
          style={modeButtonStyle('live_sync')}
          aria-pressed={localMode === 'live_sync'}
          onClick={() => {
            setLocalMode('live_sync');
            setIsDirty(true);
            setMessage(null);
            setInlineError(null);
          }}
        >
          Live sync
        </button>
      </div>
      {localMode !== vagaroMode ? <small className="sub">Unsaved changes</small> : null}

      {localMode === 'link_only' ? (
        <>
          <div className="field integration-config-field">
            <label>Your Vagaro booking URL</label>
            <input
              value={bookingUrl}
              onChange={(event) => {
                setIsDirty(true);
                setInlineError(null);
                setMessage(null);
                setBookingUrl(event.target.value);
              }}
              placeholder="https://vagaro.com/your-salon"
            />
            <small>Find this in Vagaro → Share → Copy booking link</small>
          </div>
          <div className="integration-info-box">The AI will text this link to callers who ask to book.</div>
          {message ? <div className="note">{message}</div> : null}
          <div className="integrations-inline-actions">
            <button
              type="button"
              className="btn user-save integrations-primary-button"
              disabled={busy || !bookingUrl.trim()}
              onClick={async () => {
                setBusy(true);
                setMessage(null);
                setInlineError(null);
                try {
	                  await onSaveBookingLink(bookingUrl.trim());
                  setIsDirty(false);
	                  setMessage('Booking link saved.');
	                } catch (err) {
	                  setInlineError(normalizeIntegrationError('vagaro', err, 'booking_link_save_failed'));
	                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Saving...' : 'Save'}
            </button>
          </div>
          <IntegrationInlineError error={inlineError} />
        </>
      ) : (
        <>
          <div className="integration-info-box" style={{ borderColor: 'var(--purple-dark)', background: 'var(--purple-ultra)' }}>
            Requires Vagaro&apos;s APIs & Webhooks add-on ($10/mo from Vagaro). Go to Settings → Developers → APIs & Webhooks → Contact Us to request access — takes up to 5 business days.{' '}
            <a className="user-link" href="#" target="_blank" rel="noreferrer">Setup guide →</a>
          </div>
          {businessName ? <div className="integration-success-box">Connected · Business: {businessName}</div> : null}
          <div className="field integration-config-field" style={{ maxWidth: 'none' }}>
            <label>Your webhook endpoint — paste this into Vagaro</label>
            <div className="integrations-inline-actions" style={{ gap: 8 }}>
              <input value={displayedEndpoint} readOnly style={{ flex: '1 1 340px', minWidth: 0 }} />
              <button
                type="button"
                className="btn"
                title="Copy webhook endpoint"
                onClick={async () => {
                  await navigator.clipboard.writeText(webhookBase);
                  setMessage('Webhook endpoint copied.');
                }}
              >
                <IconCopy size={16} stroke={2} aria-hidden="true" />
                Copy
              </button>
              {connectionStatus === 'connected' ? (
                <button
                  type="button"
                  className="user-link--subtle"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setMessage(null);
                    setInlineError(null);
                    try {
	                      await onRegenerate();
	                      setMessage('Webhook token regenerated. Copy the new header now.');
	                    } catch (err) {
	                      setInlineError(normalizeIntegrationError('vagaro', err, 'vagaro_token_regenerate_failed'));
	                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Regenerate token
                </button>
              ) : null}
            </div>
            <small>Set trigger to Appointment and Customer in Vagaro.</small>
          </div>
          <div className="field integration-config-field" style={{ maxWidth: 'none' }}>
            <label>Webhook header — add this in Vagaro</label>
            <div className="integrations-inline-actions" style={{ gap: 8 }}>
              <input value={`X-RingBooker-Shop-Token: ${displayedHeaderToken}`} readOnly style={{ flex: '1 1 340px', minWidth: 0 }} />
              <button
                type="button"
                className="btn"
                disabled={!rawWebhookToken}
                title={rawWebhookToken ? 'Copy webhook header' : 'Connect or regenerate to copy the full token once'}
                onClick={async () => {
                  if (!rawWebhookToken) return;
                  await navigator.clipboard.writeText(`X-RingBooker-Shop-Token: ${rawWebhookToken}`);
                  setMessage('Webhook header copied.');
                }}
              >
                <IconCopy size={16} stroke={2} aria-hidden="true" />
                Copy header
              </button>
            </div>
            <small>Raw tokens are shown only when first generated or regenerated.</small>
          </div>

          <div className="calendar-int-grid">
	            <div className="field integration-config-field">
	              <label>Client ID</label>
	              <input
                  value={clientId}
                  onChange={(event) => {
                    setIsDirty(true);
                    setInlineError(null);
                    setMessage(null);
                    setClientId(event.target.value);
                  }}
                  placeholder="Vagaro client ID"
                />
	            </div>
            <div className="field integration-config-field">
              <label>Client Secret</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
	                  type={showSecret ? 'text' : 'password'}
	                  value={clientSecretKey}
	                  onChange={(event) => {
                      setIsDirty(true);
                      setInlineError(null);
                      setMessage(null);
                      setClientSecretKey(event.target.value);
                    }}
	                  placeholder="Vagaro client secret"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button type="button" className="btn" onClick={() => setShowSecret((current) => !current)} aria-label={showSecret ? 'Hide secret' : 'Show secret'}>
                  {showSecret ? <IconEyeOff size={16} stroke={2} /> : <IconEye size={16} stroke={2} />}
                </button>
              </div>
            </div>
	            <div className="field integration-config-field">
	              <label>Region</label>
	              <input
                  value={region}
                  onChange={(event) => {
                    setIsDirty(true);
                    setInlineError(null);
                    setMessage(null);
                    setRegion(event.target.value);
                  }}
                  placeholder="usa03"
                />
              <small>Found at the start of your Vagaro URL</small>
            </div>
          </div>
	          <div className="field integration-config-field" style={{ maxWidth: 'none' }}>
	            <label>Booking URL fallback (optional)</label>
	            <input
                value={fallbackUrl}
                onChange={(event) => {
                  setIsDirty(true);
                  setInlineError(null);
                  setMessage(null);
                  setFallbackUrl(event.target.value);
                }}
                placeholder="https://vagaro.com/your-salon — sent to caller after booking"
              />
	          </div>

          <div className="integration-config-body">
            <VagaroStatusRow title="Webhook — appointment events" description="Notified when bookings change" status={connectionStatus} />
            <VagaroStatusRow title="Read availability" description="AI checks open slots in real time" status={readAvailabilityStatus} />
            <VagaroStatusRow title="SMS booking link" description="Sent to caller after AI confirms slot" status="connected" alwaysOn />
          </div>

	          <IntegrationInlineError error={inlineError} />
	          {message ? <div className="note">{message}</div> : null}
          <div className="integrations-inline-actions">
            <button
              type="button"
              className="btn user-save integrations-primary-button"
              disabled={busy || !clientId.trim() || !clientSecretKey.trim() || !region.trim()}
              onClick={async () => {
                setBusy(true);
                setMessage(null);
                setInlineError(null);
                try {
                  await onConnect({
                    clientId: clientId.trim(),
                    clientSecretKey: clientSecretKey.trim(),
                    region: region.trim(),
                  });
	                  await onSaveSettings({
	                    mode: 'live_sync',
	                    fallback_url: fallbackUrl.trim() || null,
	                  });
	                  setClientSecretKey('');
                  setIsDirty(false);
	                  setMessage('Vagaro live sync connected. Copy the webhook endpoint and header if this is the first connection.');
	                } catch (err) {
	                  setInlineError(normalizeIntegrationError('vagaro', err, 'connection_failed'));
	                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Connecting...' : 'Connect Vagaro'}
            </button>
            <a className="user-link" href="https://docs.vagaro.com" target="_blank" rel="noreferrer">
              Vagaro developer docs →
            </a>
          </div>
          <div className="note">
            RingBooker reads availability and sends booking links. Direct appointment creation in Vagaro is not available via API — callers confirm via the Vagaro booking link sent by SMS.
          </div>
        </>
      )}
    </div>
  );
}

function SquareConfigPanel({ connected, provider, onDisconnect, onRefresh }: {
  connected: boolean;
  provider: { configured?: boolean; details: Record<string, unknown> | null; readiness?: { liveReady: boolean; missingFields?: string[]; message?: string } } | null;
  onDisconnect: () => Promise<void>;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const liveReady = Boolean(provider?.readiness?.liveReady ?? provider?.details?.liveReady ?? provider?.configured ?? false);
  const missingFields = provider?.readiness?.missingFields ?? (Array.isArray(provider?.details?.missingFields) ? provider.details.missingFields.map(String) : []);
  const healthMessage = provider?.readiness?.message ?? (typeof provider?.details?.healthMessage === 'string' ? provider.details.healthMessage : null);
  return (
    <div className="integration-config-body">
      {connected ? (
        <>
          <div className={liveReady ? 'integration-success-box' : 'integration-info-box'}>
            {liveReady ? 'Live-ready' : 'Connected · setup needed'} · Merchant: {String(provider?.details?.merchantId ?? 'Square')}
            {!liveReady && healthMessage ? (
              <>
                <br />
                {healthMessage}
              </>
            ) : null}
            {!liveReady && missingFields.length ? (
              <>
                <br />
                Missing: {missingFields.join(', ')}
              </>
            ) : null}
          </div>
          <div className="integration-info-box">
            <strong>Square Appointments booking provider.</strong>
            <br />
            Services/catalog sync: available · Staff sync: available · Availability check: {provider?.details?.availabilityCheck === 'available' ? 'available' : 'needs setup'} · Direct appointment creation: {provider?.details?.directAppointmentCreation === 'enabled' ? 'enabled' : 'not enabled'}.
          </div>
          <p className="calendar-int-desc">Choose a Square location before RingBooker creates appointments directly. If Square is incomplete or fails, RingBooker captures the booking request instead.</p>
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
  const [inlineError, setInlineError] = useState<IntegrationError | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (isDirty) return;
    setSiteId(String(details.siteId ?? ''));
    setSourceName(String(details.sourceName ?? 'RingBooker'));
    setLocationId(String(details.locationId ?? ''));
    setSessionTypeId(String(details.sessionTypeId ?? ''));
    setStaffId(String(details.staffId ?? ''));
    setBookingUrl(String(details.bookingUrl ?? ''));
  }, [isDirty, provider?.details]);

  function markMindbodyDirty() {
    setIsDirty(true);
    setInlineError(null);
    setMessage(null);
  }

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
	          <input value={siteId} onChange={(event) => { markMindbodyDirty(); setSiteId(event.target.value); }} placeholder="123456" />
	        </div>
	        <div className="field integration-config-field">
	          <label>API key</label>
	          <input type="password" value={apiKey} onChange={(event) => { markMindbodyDirty(); setApiKey(event.target.value); }} placeholder="Your Mindbody API key" />
	        </div>
	        <div className="field integration-config-field">
	          <label>Source name</label>
	          <input value={sourceName} onChange={(event) => { markMindbodyDirty(); setSourceName(event.target.value); }} placeholder="RingBooker" />
	        </div>
	        <div className="field integration-config-field">
	          <label>Location ID optional</label>
	          <input value={locationId} onChange={(event) => { markMindbodyDirty(); setLocationId(event.target.value); }} placeholder="1" />
	        </div>
	        <div className="field integration-config-field">
	          <label>Session type ID optional</label>
	          <input value={sessionTypeId} onChange={(event) => { markMindbodyDirty(); setSessionTypeId(event.target.value); }} placeholder="17" />
	        </div>
	        <div className="field integration-config-field">
	          <label>Staff ID optional</label>
	          <input value={staffId} onChange={(event) => { markMindbodyDirty(); setStaffId(event.target.value); }} placeholder="5" />
	        </div>
      </div>
	      <div className="field integration-config-field">
	        <label>Booking URL fallback optional</label>
	        <input value={bookingUrl} onChange={(event) => { markMindbodyDirty(); setBookingUrl(event.target.value); }} placeholder="https://clients.mindbodyonline.com/..." />
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
              setIsDirty(false);
              setInlineError(null);
	              setMessage('Mindbody settings saved.');
	            } catch (err) {
	              setInlineError(normalizeIntegrationError('mindbody', err, 'mindbody_connect_failed'));
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
	              try {
                  await onDisconnect();
                  setIsDirty(false);
                } finally { setBusy(false); }
	            }}
          >
            Disconnect Mindbody
          </button>
        ) : null}
        <a className="user-link" href="https://developers.mindbodyonline.com/" target="_blank" rel="noreferrer">
          Mindbody developer docs →
	        </a>
	      </div>
	      <IntegrationInlineError error={inlineError} />
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
  const [appointmentTypeId, setAppointmentTypeId] = useState(String(details.appointmentTypeId ?? ''));
  const [defaultCalendarId, setDefaultCalendarId] = useState(String(details.defaultCalendarId ?? details.calendarId ?? ''));
  const [serviceMappingsText, setServiceMappingsText] = useState(stringifyMappings(details.serviceMappings));
  const [staffMappingsText, setStaffMappingsText] = useState(stringifyMappings(details.staffMappings));
  const [requiresCallerEmail, setRequiresCallerEmail] = useState(Boolean(details.requiresCallerEmail ?? false));
  const [timezone, setTimezone] = useState(String(details.timezone ?? ''));
  const [bookingUrl, setBookingUrl] = useState(String(details.bookingUrl ?? ''));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<IntegrationError | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (isDirty) return;
    setAppointmentTypeId(String(details.appointmentTypeId ?? ''));
    setDefaultCalendarId(String(details.defaultCalendarId ?? details.calendarId ?? ''));
    setServiceMappingsText(stringifyMappings(details.serviceMappings));
    setStaffMappingsText(stringifyMappings(details.staffMappings));
    setRequiresCallerEmail(Boolean(details.requiresCallerEmail ?? false));
    setTimezone(String(details.timezone ?? ''));
    setBookingUrl(String(details.bookingUrl ?? ''));
  }, [isDirty, provider?.details]);

  function markAcuityDirty() {
    setIsDirty(true);
    setInlineError(null);
    setMessage(null);
  }

  const directAppointmentCreation = String(details.directAppointmentCreation ?? 'not_enabled');
  const bookingMode = String(details.bookingMode ?? 'capture_request_only');
  const missingMappings = Array.isArray(details.missingMappings) ? details.missingMappings.map(String) : [];
  const accountLabel = String(details.userId ?? 'Acuity account');

  if (!connected) {
    return (
      <div className="integration-config-body">
        <div className="integration-info-box">
          Connect Acuity securely with OAuth. RingBooker will use Acuity to sync appointment types, calendars, and availability after you configure mappings.
        </div>
        <button
          type="button"
          className="btn user-save integrations-primary-button"
          onClick={() => { window.location.href = '/api/backend/user/calendar/providers/acuity/connect/start'; }}
        >
          Connect with Acuity
        </button>
        <div className="integrations-inline-actions">
          <a className="user-link" href="https://developers.acuityscheduling.com/" target="_blank" rel="noreferrer">
            Acuity developer docs →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="integration-config-body">
      <div className="integration-success-box">Connected via Acuity · {accountLabel}</div>
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
	          <label>Legacy default appointment type ID optional</label>
	          <input value={appointmentTypeId} onChange={(event) => { markAcuityDirty(); setAppointmentTypeId(event.target.value); }} placeholder="1001" />
	        </div>
	        <div className="field integration-config-field">
	          <label>Default Acuity calendar ID</label>
	          <input value={defaultCalendarId} onChange={(event) => { markAcuityDirty(); setDefaultCalendarId(event.target.value); }} placeholder="2002" />
	        </div>
	        <div className="field integration-config-field">
	          <label>Timezone optional</label>
	          <input value={timezone} onChange={(event) => { markAcuityDirty(); setTimezone(event.target.value); }} placeholder="America/Chicago" />
	        </div>
	        <div className="field integration-config-field">
	          <label>Booking URL fallback optional</label>
	          <input value={bookingUrl} onChange={(event) => { markAcuityDirty(); setBookingUrl(event.target.value); }} placeholder="https://your-business.as.me/" />
	        </div>
      </div>
      <div className="field integration-config-field">
        <label>RingBooker service → Acuity appointment type ID</label>
        <textarea
	          value={serviceMappingsText}
	          onChange={(event) => { markAcuityDirty(); setServiceMappingsText(event.target.value); }}
          placeholder={'haircut=1001\nhair color=1002'}
          rows={4}
        />
        <small>One mapping per line. Direct booking requires a matching service mapping.</small>
      </div>
      <div className="field integration-config-field">
        <label>RingBooker staff/provider → Acuity calendar ID optional</label>
        <textarea
	          value={staffMappingsText}
	          onChange={(event) => { markAcuityDirty(); setStaffMappingsText(event.target.value); }}
          placeholder={'alex=2002\njamie=2003'}
          rows={3}
        />
        <small>If no staff mapping matches, RingBooker uses the default Acuity calendar ID.</small>
      </div>
      <label className="integration-checkbox-row">
	        <input type="checkbox" checked={requiresCallerEmail} onChange={(event) => { markAcuityDirty(); setRequiresCallerEmail(event.target.checked); }} />
        <span>Require caller email before direct Acuity booking. If missing, RingBooker captures a booking request instead.</span>
      </label>
      {message ? <div className="note">{message}</div> : null}
      <div className="integrations-inline-actions">
        <button
          type="button"
          className="btn user-save integrations-primary-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage(null);
            try {
              await onConnect({
                appointmentTypeId: appointmentTypeId.trim() || undefined,
                calendarId: defaultCalendarId.trim() || undefined,
                defaultCalendarId: defaultCalendarId.trim() || undefined,
                serviceMappings: parseMappings(serviceMappingsText),
                staffMappings: parseMappings(staffMappingsText),
                requiresCallerEmail,
                timezone: timezone.trim() || undefined,
                bookingUrl: bookingUrl.trim() || undefined,
	              });
              setIsDirty(false);
              setInlineError(null);
	              setMessage('Acuity settings saved.');
	            } catch (err) {
	              setInlineError(normalizeIntegrationError('acuity', err, 'acuity_connect_failed'));
	            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Saving...' : 'Save Acuity settings'}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
	          onClick={async () => {
	            setBusy(true);
	            try {
                await onDisconnect();
                setIsDirty(false);
              } finally { setBusy(false); }
	          }}
        >
          Disconnect Acuity
        </button>
        <a className="user-link" href="https://developers.acuityscheduling.com/" target="_blank" rel="noreferrer">
          Acuity developer docs →
        </a>
	      </div>
	      <IntegrationInlineError error={inlineError} />
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

function AppConfigPanel({
  appKey,
  providers,
  selectedProvider,
  saveBookingLink,
  vagaroMode,
  vagaroConnectionStatus,
  vagaroWebhookToken,
  saveVagaroBookingLink,
  connectVagaroLiveSync,
  regenerateVagaroToken,
  saveVagaroLiveSyncSettings,
  connectMindbody,
  connectAcuity,
  disconnectMindbody,
  disconnectAcuity,
  disconnectSquare,
  refresh,
}: {
  appKey: IntegrationAppKey | null;
  providers: Array<{ id: string; connected: boolean; configured?: boolean; liveReady?: boolean; readiness?: { liveReady: boolean; missingFields?: string[]; message?: string }; details: Record<string, unknown> | null }>;
  selectedProvider: { id: string; connected: boolean; configured?: boolean; liveReady?: boolean; readiness?: { liveReady: boolean; missingFields?: string[]; message?: string }; details: Record<string, unknown> | null } | null;
  saveBookingLink: (url: string, key: IntegrationAppKey) => Promise<void>;
  vagaroMode: VagaroMode;
  vagaroConnectionStatus: VagaroConnectionStatus;
  vagaroWebhookToken: string | null;
  saveVagaroBookingLink: (url: string) => Promise<void>;
  connectVagaroLiveSync: (credentials: { clientId: string; clientSecretKey: string; region: string }) => Promise<unknown>;
  regenerateVagaroToken: () => Promise<string>;
  saveVagaroLiveSyncSettings: (settings: { mode?: VagaroMode; fallback_url?: string | null; booking_url?: string | null }) => Promise<void>;
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
  const liveReady = Boolean(selectedProvider?.readiness?.liveReady ?? selectedProvider?.liveReady ?? selectedProvider?.configured ?? connected);
  const statusLabel = connected ? (liveReady ? 'Connected' : 'Connected · setup needed') : 'Not connected';

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
          <span className="integration-status-line"><StatusDot connected={connected && liveReady} warning={connected && !liveReady} />{statusLabel}</span>
        </div>
        <button type="button" className="btn" onClick={refresh}>Refresh</button>
      </div>
      {app.key === 'square' ? (
        <SquareConfigPanel connected={connected} provider={selectedProvider} onDisconnect={disconnectSquare} onRefresh={refresh} />
      ) : app.key === 'mindbody' ? (
        <MindbodyConfigPanel connected={connected} provider={selectedProvider} onConnect={connectMindbody} onDisconnect={disconnectMindbody} />
      ) : app.key === 'acuity' ? (
        <AcuityConfigPanel connected={connected} provider={selectedProvider} onConnect={connectAcuity} onDisconnect={disconnectAcuity} />
      ) : app.key === 'vagaro' ? (
        <VagaroConfigPanel
          provider={selectedProvider}
          vagaroMode={vagaroMode}
	          connectionStatus={vagaroConnectionStatus}
	          rawWebhookToken={vagaroWebhookToken}
	          onSaveBookingLink={saveVagaroBookingLink}
          onConnect={connectVagaroLiveSync}
          onRegenerate={regenerateVagaroToken}
          onSaveSettings={saveVagaroLiveSyncSettings}
        />
      ) : app.comingSoon ? (
        <ComingSoonPanel app={app} onSave={(url) => saveBookingLink(url, app.key)} />
      ) : (
        <LinkConfigPanel app={app} savedUrl={savedUrl} onSave={(url) => saveBookingLink(url, app.key)} />
      )}
    </section>
  );
}

function DirectBookingConfirm({ onChange, configured = false }: { onChange: () => void; configured?: boolean }) {
  return (
    <div className="integration-confirm-card success">
      <strong>✓ No integration needed</strong>
      <p>
        When callers ask to book, RingBooker captures their request and alerts you. You follow up and schedule directly.
        {configured ? null : ' If you ever add a booking app, come back to connect it.'}
      </p>
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

function StarterUpgradeBanner() {
  return (
    <section className="integration-config-panel integration-upgrade-banner" aria-disabled="true">
      <div className="integration-upgrade-banner-inner">
        <div className="integrations-inline-actions integration-upgrade-banner-row">
          <span aria-hidden="true" className="integration-method-icon">
            <IconBolt size={26} stroke={2} />
          </span>
          <div className="integration-upgrade-banner-copy">
            <strong>Live sync with Square, Mindbody & more</strong>
            <p className="sub integration-upgrade-banner-sub">
              RingBooker checks real-time availability — Professional and above.
            </p>
          </div>
          <a className="btn user-save integrations-primary-button" href="/user/billing">Upgrade to Pro</a>
        </div>
      </div>
    </section>
  );
}

function ConfiguredIntegrationView({
  bookingMethod,
  selectedAppKey,
  bookingUrl,
  fullSyncConnected,
  fullSyncSetupNeeded = false,
  canUseThirdPartyIntegrations,
  onChange,
  onReconnect,
  onSaveBookingUrl,
}: {
  bookingMethod: BookingMethod;
  selectedAppKey: IntegrationAppKey | null;
  bookingUrl: string | null;
  fullSyncConnected: boolean;
  fullSyncSetupNeeded?: boolean;
  canUseThirdPartyIntegrations: boolean;
  onChange: () => void;
  onReconnect?: () => void;
  onSaveBookingUrl: (url: string) => Promise<void>;
}) {
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState(bookingUrl ?? '');
  const [savingUrl, setSavingUrl] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const app = findIntegrationApp(selectedAppKey);
  const isFullSyncApp = Boolean(app && app.category === 'full-sync');
  const isFullSync = Boolean(fullSyncConnected);
  const needsSetup = Boolean(isFullSyncApp && fullSyncSetupNeeded && !fullSyncConnected);
  const needsReconnect = Boolean(isFullSyncApp && !fullSyncConnected && !needsSetup);
  const displayName = app?.key === 'custom' ? 'Any booking link' : app?.name ?? 'Booking link';

  useEffect(() => {
    setUrlDraft(bookingUrl ?? '');
    setEditingUrl(false);
    setMessage(null);
  }, [bookingUrl, selectedAppKey, bookingMethod]);

  if (bookingMethod === 'direct') {
    return (
      <>
        <DirectBookingConfirm onChange={onChange} configured />
        {!canUseThirdPartyIntegrations ? <StarterUpgradeBanner /> : null}
      </>
    );
  }

  return (
    <>
      <section className="integration-configured-card">
        <div className="integration-configured-main">
          {app ? <AppLogo app={app} /> : <GenericLinkLogo />}
          <div className="integration-configured-copy">
            <div className="integration-configured-title-row">
              <strong>{displayName}</strong>
              {isFullSync || needsReconnect || needsSetup ? (
                <SectionBadge icon="refresh" label="Live sync" variant="teal" />
              ) : (
                <SectionBadge icon="link" label="Booking link" variant="gray" />
              )}
            </div>
            <span className="integration-status-line">
              <StatusDot connected={isFullSync || (!needsReconnect && !needsSetup)} warning={needsReconnect || needsSetup} />
              {needsSetup
                ? 'Connected — finish setup before live booking'
                : needsReconnect
                  ? 'Connection lost — reconnect to restore live sync'
                  : isFullSync
                    ? 'Connected — checking availability in real time'
                    : 'Link saved — RingBooker will text this to callers'}
            </span>
          </div>
          {needsReconnect || needsSetup ? (
            <button type="button" className="btn" onClick={onReconnect}>{needsSetup ? 'Finish setup' : 'Reconnect'}</button>
          ) : (
            <button type="button" className="btn" onClick={onChange}>Change</button>
          )}
        </div>
        {!isFullSync && !needsReconnect ? (
          <div className="integration-configured-url-row">
            <IconLink size={18} stroke={2} aria-hidden="true" />
            {editingUrl ? (
              <div className="integration-configured-url-edit">
                <input value={urlDraft} onChange={(event) => setUrlDraft(event.target.value)} placeholder="https://yourbookingsite.com/book" />
                <button
                  type="button"
                  className="btn user-save integrations-primary-button"
                  disabled={savingUrl || !urlDraft.trim()}
                  onClick={async () => {
                    setSavingUrl(true);
                    setMessage(null);
                    try {
                      await onSaveBookingUrl(urlDraft.trim());
                      setEditingUrl(false);
                      setMessage('Booking link saved.');
                    } catch (err) {
                      setMessage(err instanceof Error ? integrationErrorMessage(err.message, 'Unable to save booking link.') : 'Something went wrong — please try again.');
                    } finally {
                      setSavingUrl(false);
                    }
                  }}
                >
                  {savingUrl ? 'Saving...' : 'Save'}
                </button>
                <button type="button" className="btn" disabled={savingUrl} onClick={() => { setUrlDraft(bookingUrl ?? ''); setEditingUrl(false); }}>Cancel</button>
              </div>
            ) : (
              <>
                <span className="integration-configured-url-text">{bookingUrl || 'No booking link saved'}</span>
                <button type="button" className="user-link--subtle integration-edit-link-button" onClick={() => setEditingUrl(true)}>Edit link</button>
              </>
            )}
          </div>
        ) : null}
      </section>
      {message ? <div className="note">{message}</div> : null}
      {!canUseThirdPartyIntegrations ? <StarterUpgradeBanner /> : null}
    </>
  );
}

type IntegrationsRedesignProps = {
  canUseThirdPartyIntegrations: boolean;
  initialBookingMethod?: BookingMethod;
  initialSelectedIntegration?: string | null;
  initialBookingUrl?: string | null;
  calendarStatus?: string | null;
  calendarStatusKind?: 'connected' | 'error' | null;
};

function StarterIntegrationsView({ initialBookingMethod, initialSelectedIntegration, initialBookingUrl }: {
  initialBookingMethod?: BookingMethod;
  initialSelectedIntegration?: string | null;
  initialBookingUrl?: string | null;
}) {
  const [savedBookingMethod, setSavedBookingMethod] = useState<BookingMethod>(initialBookingMethod ?? null);
  const [savedSelectedApp, setSavedSelectedApp] = useState<IntegrationAppKey | null>(fromBackendProviderKey(initialSelectedIntegration));
  const [savedBookingUrl, setSavedBookingUrl] = useState(initialBookingUrl ?? '');
  const [showSetupFlow, setShowSetupFlow] = useState(false);
  const [bookingMethod, setBookingMethodState] = useState<BookingMethod>(null);
  const [bookingUrl, setBookingUrl] = useState(initialBookingUrl ?? '');
  const [savingMethod, setSavingMethod] = useState<BookingMethod | null>(null);
  const [savingUrl, setSavingUrl] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSavedBookingMethod(initialBookingMethod ?? null);
    setSavedSelectedApp(fromBackendProviderKey(initialSelectedIntegration));
  }, [initialBookingMethod, initialSelectedIntegration]);

  useEffect(() => {
    const nextUrl = initialBookingUrl ?? '';
    setSavedBookingUrl(nextUrl);
    setBookingUrl(nextUrl);
  }, [initialBookingUrl]);

  async function saveSettings(patch: Record<string, unknown>) {
    const response = await fetch('/api/backend/user/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const body = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !body.ok) {
      throw new Error(integrationErrorMessage(body.error, 'Unable to save changes.'));
    }
  }

  async function chooseMethod(method: BookingMethod) {
    if (savingMethod) return;
    setMessage(null);
    if (method === 'app') {
      setBookingMethodState(method);
      return;
    }
    setSavingMethod(method);
    try {
      await saveSettings({ booking_method: method });
      if (method === 'direct') {
        setSavedBookingMethod('direct');
        setSavedSelectedApp(null);
        setShowSetupFlow(false);
        setBookingMethodState(null);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to save booking setup.');
    } finally {
      setSavingMethod(null);
    }
  }

  async function saveBookingUrl() {
    const validationError = validateHttpsBookingUrl(bookingUrl);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    setSavingUrl(true);
    setMessage(null);
    try {
      await saveSettings({
        booking_method: 'app',
        booking_url: bookingUrl.trim() || null,
      });
      setBookingMethodState('app');
      setSavedBookingMethod('app');
      setSavedBookingUrl(bookingUrl.trim());
      setShowSetupFlow(false);
      setMessage('Booking link saved.');
    } catch (err) {
      setMessage(err instanceof Error ? integrationErrorMessage(err.message, 'Unable to save booking link.') : 'Something went wrong — please try again.');
    } finally {
      setSavingUrl(false);
    }
  }

  const hasConfiguredState = savedBookingMethod === 'direct' || (savedBookingMethod === 'app' && (Boolean(savedBookingUrl.trim()) || Boolean(savedSelectedApp)));

  return (
    <div className="integrations-redesign starter-integrations-view">
      <style jsx global>{`
        .starter-integrations-view {
          --starter-method-selected-bg: #EEEDFE;
          --starter-method-selected-border: #534AB7;
          --starter-method-selected-icon: #534AB7;
          --starter-upgrade-banner-bg: #EEEDFE;
        }
        .starter-integrations-view .panel-head h3,
        .starter-integrations-view .integrations-flow-title,
        .starter-integrations-view .integration-method-card strong,
        .starter-integrations-view .integration-config-field label,
        .starter-integrations-view .integrations-app-section h4,
        .starter-integrations-view .integration-app-copy strong {
          color: var(--color-text-primary, var(--text-dark));
        }
        .starter-integrations-view .panel-head .sub,
        .starter-integrations-view .integration-method-card small,
        .starter-integrations-view .integration-config-field small,
        .starter-integrations-view .integrations-app-section .sub,
        .starter-integrations-view .integration-app-copy small {
          color: var(--color-text-secondary, var(--text-gray));
        }
        html[data-user-theme="dark"] .starter-integrations-view {
          --starter-method-selected-bg: #26215C;
          --starter-method-selected-border: #8B7CF6;
          --starter-method-selected-icon: #B8AFFF;
          --starter-upgrade-banner-bg: #26215C;
        }
        .starter-integrations-view .starter-booking-link-row {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .starter-integrations-view .starter-booking-link-save {
          width: 100%;
          height: 40px;
        }
        .starter-integrations-view .starter-booking-link-field {
          width: 100%;
          margin-bottom: 0;
        }
        .starter-integrations-view .starter-booking-link-field input {
          width: 100%;
          height: 40px;
          box-sizing: border-box;
        }
        @media (min-width: 768px) {
          .starter-integrations-view .starter-booking-link-row {
            flex-direction: row;
            align-items: flex-start;
          }
          .starter-integrations-view .starter-booking-link-field {
            flex: 0 1 60%;
            max-width: 60%;
            min-width: 0;
          }
          .starter-integrations-view .starter-booking-link-save {
            width: auto;
            flex: 0 0 auto;
            min-width: 120px;
            white-space: nowrap;
          }
        }
      `}</style>
      <div className="panel-head integrations-redesign-head">
        <div>
          <h3>Integrations</h3>
          <p className="sub">Tell RingBooker how clients book so it gives callers the right next step.</p>
        </div>
      </div>

      {!showSetupFlow && hasConfiguredState ? (
        <ConfiguredIntegrationView
          bookingMethod={savedBookingMethod}
          selectedAppKey={savedSelectedApp}
          bookingUrl={savedBookingUrl.trim() || null}
          fullSyncConnected={false}
          canUseThirdPartyIntegrations={false}
          onChange={() => {
            setShowSetupFlow(true);
            setBookingMethodState(null);
            setMessage(null);
          }}
          onSaveBookingUrl={async (url) => {
            const validationError = validateHttpsBookingUrl(url);
            if (validationError) throw new Error(validationError);
            await saveSettings({ booking_url: url || null });
            setSavedBookingUrl(url);
          }}
        />
      ) : (
        <>

      <BookingMethodQuestion
        onChoose={(method) => void chooseMethod(method)}
        showLater={false}
        title="How do your clients book?"
        subtitle={null}
        selectedMethod={bookingMethod}
        disabled={Boolean(savingMethod)}
        savingMethod={savingMethod}
      />

      {bookingMethod === 'app' ? (
        <div className="integration-config-panel starter-booking-link-panel">
          <div className="field integration-config-field">
            <label>Your booking link</label>
            <small>RingBooker texts this to callers who ask to book.</small>
          </div>
          <div className="starter-booking-link-row">
            <div className="field starter-booking-link-field">
              <input value={bookingUrl} onChange={(event) => setBookingUrl(event.target.value)} placeholder="https://yourbookingsite.com/book" />
            </div>
            <button
              type="button"
              className="btn user-save integrations-primary-button starter-booking-link-save"
              disabled={savingUrl || !bookingUrl.trim()}
              onClick={() => void saveBookingUrl()}
            >
              {savingUrl ? 'Saving...' : 'Save link'}
            </button>
          </div>
        </div>
      ) : null}

      {bookingMethod === 'direct' ? <DirectBookingConfirm onChange={() => setBookingMethodState(null)} /> : null}

      {message ? <div className="note">{message}</div> : null}

      <hr className="integration-divider" />

      <StarterUpgradeBanner />

      <button type="button" className="user-link--subtle integrations-later-link" onClick={() => void chooseMethod('later')}>
        I&apos;ll set this up later
      </button>
        </>
      )}
    </div>
  );
}

export function IntegrationsRedesign({
  canUseThirdPartyIntegrations,
  initialBookingMethod = null,
  initialSelectedIntegration = null,
  initialBookingUrl = null,
  calendarStatus = null,
  calendarStatusKind = null,
}: IntegrationsRedesignProps) {
  const {
	    status,
	    selectedProvider,
		    setBookingMethod,
		    setSelectedApp,
		    saveBookingLink,
		    saveVagaroBookingLink,
	    connectVagaroLiveSync,
	    regenerateVagaroToken,
	    saveVagaroLiveSyncSettings,
	    connectMindbody,
    connectAcuity,
    disconnectMindbody,
    disconnectAcuity,
    disconnectSquare,
    navigateBack,
    goBack,
    refresh,
  } = useIntegrations({
    enabled: canUseThirdPartyIntegrations,
    initialBookingMethod,
    initialSelectedIntegration,
  });

  const selectedApp = useMemo(() => findIntegrationApp(status.selectedApp), [status.selectedApp]);
  const [showSetupFlow, setShowSetupFlow] = useState(false);
  const [forceMethodQuestion, setForceMethodQuestion] = useState(false);
  const [bookingUrlOverride, setBookingUrlOverride] = useState<string | null>(null);
  const [showCalendarStatusBanner, setShowCalendarStatusBanner] = useState(Boolean(calendarStatus));
  const configuredBookingUrl = bookingUrlOverride ?? status.bookingLinkUrl ?? initialBookingUrl ?? null;
  const configuredSelectedAppKey = status.selectedApp ?? fromBackendProviderKey(initialSelectedIntegration);
  const configuredSelectedApp = useMemo(() => findIntegrationApp(configuredSelectedAppKey), [configuredSelectedAppKey]);
  const effectiveBookingMethod = status.bookingMethod
    ?? initialBookingMethod
    ?? (configuredBookingUrl?.trim() || configuredSelectedAppKey ? 'app' : null);
	  const selectedProviderConnected = configuredSelectedApp
	    ? status.providers.some((provider) => provider.id === toBackendProviderKey(configuredSelectedApp.key) && provider.connected)
	    : false;
  const configuredProvider = configuredSelectedApp
    ? status.providers.find((provider) => provider.id === toBackendProviderKey(configuredSelectedApp.key)) ?? null
    : null;
  const configuredProviderLiveReady = Boolean(configuredProvider?.readiness?.liveReady ?? configuredProvider?.liveReady ?? configuredProvider?.configured ?? selectedProviderConnected);
  const configuredProviderSetupNeeded = Boolean(selectedProviderConnected && !configuredProviderLiveReady);
	  const selectedAppIsFullSync = Boolean(configuredSelectedApp && configuredSelectedApp.category === 'full-sync');
	  const vagaroLiveSyncConnected = configuredSelectedAppKey === 'vagaro' && status.vagaroMode === 'live_sync' && status.vagaroConnectionStatus === 'connected';
	  const hasConfiguredState = effectiveBookingMethod === 'direct' || (
	    effectiveBookingMethod === 'app' && (
	      Boolean(configuredBookingUrl?.trim()) || vagaroLiveSyncConnected || (selectedAppIsFullSync && Boolean(configuredSelectedAppKey))
	    )
	  );
  const showMethodQuestion = status.step === 'question' || forceMethodQuestion;

  useEffect(() => {
    if (!calendarStatus) {
      setShowCalendarStatusBanner(false);
      return;
    }
    setShowCalendarStatusBanner(true);
    const timeout = window.setTimeout(() => setShowCalendarStatusBanner(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [calendarStatus]);

  if (!canUseThirdPartyIntegrations) {
    return (
      <StarterIntegrationsView
        initialBookingMethod={initialBookingMethod}
        initialSelectedIntegration={initialSelectedIntegration}
        initialBookingUrl={initialBookingUrl}
      />
    );
  }

  return (
    <div className="integrations-redesign">
      <div className="panel-head integrations-redesign-head">
        <div>
          <h3>Integrations</h3>
          <p className="sub">Tell RingBooker how clients book so it gives callers the right next step.</p>
        </div>
        <button type="button" className="btn" disabled={status.isLoading} onClick={() => void refresh()}>
          {status.isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {calendarStatus && showCalendarStatusBanner ? (
        <div
          className={calendarStatusKind === 'connected' ? 'integration-success-box' : 'note integration-error-note'}
          role="status"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
        >
          <span>{calendarStatusKind === 'connected' ? 'Connected successfully' : calendarStatus}</span>
          <button type="button" className="user-link--subtle" onClick={() => setShowCalendarStatusBanner(false)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {status.error ? <div className="note integration-error-note">{status.error}</div> : null}

      {!showSetupFlow && hasConfiguredState && effectiveBookingMethod ? (
        <ConfiguredIntegrationView
          bookingMethod={effectiveBookingMethod}
          selectedAppKey={configuredSelectedAppKey}
          bookingUrl={configuredBookingUrl?.trim() || null}
	          fullSyncConnected={Boolean(vagaroLiveSyncConnected || (configuredSelectedApp && configuredSelectedApp.category === 'full-sync' && configuredProviderLiveReady))}
          fullSyncSetupNeeded={Boolean(configuredSelectedApp && configuredSelectedApp.category === 'full-sync' && configuredProviderSetupNeeded)}
          canUseThirdPartyIntegrations
          onChange={() => {
            void (async () => {
              await goBack();
              setShowSetupFlow(true);
              setForceMethodQuestion(true);
            })();
          }}
          onReconnect={() => {
            if (configuredSelectedAppKey) void setSelectedApp(configuredSelectedAppKey);
            setShowSetupFlow(true);
            setForceMethodQuestion(false);
          }}
          onSaveBookingUrl={async (url) => {
            const validationError = validateHttpsBookingUrl(url);
            if (validationError) throw new Error(validationError);
	            if (configuredSelectedAppKey === 'vagaro') {
	              await saveVagaroBookingLink(url);
	            } else {
	              const response = await fetch('/api/backend/user/settings', {
	                method: 'PUT',
	                headers: { 'content-type': 'application/json' },
	                body: JSON.stringify({ booking_url: url || null }),
	              });
	              const body = (await response.json()) as { ok: boolean; error?: string };
	              if (!response.ok || !body.ok) throw new Error(integrationErrorMessage(body.error, 'Unable to save booking link.'));
	            }
	            setBookingUrlOverride(url);
	            await refresh();
          }}
        />
      ) : (
        <>
      {showMethodQuestion ? (
        <BookingMethodQuestion
          onChoose={(method) => {
            void (async () => {
              setForceMethodQuestion(false);
              await setBookingMethod(method);
              if (method === 'direct') setShowSetupFlow(false);
            })();
          }}
        />
      ) : null}

      {!forceMethodQuestion && status.step === 'app-picker' ? (
        <>
	          <AppPicker
	            selectedApp={status.selectedApp}
	            providers={status.providers}
	            vagaroMode={status.vagaroMode}
	            vagaroConnectionStatus={status.vagaroConnectionStatus}
	            onBack={navigateBack}
	            onSelect={(key) => void setSelectedApp(key)}
	          />
          <AppConfigPanel
            appKey={selectedApp?.key ?? null}
            providers={status.providers}
	            selectedProvider={selectedProvider}
	            saveBookingLink={async (url, appKey) => {
	              await saveBookingLink(url, appKey);
	              setBookingUrlOverride(url);
              setForceMethodQuestion(false);
	              setShowSetupFlow(false);
	            }}
		            vagaroMode={status.vagaroMode}
		            vagaroConnectionStatus={status.vagaroConnectionStatus}
		            vagaroWebhookToken={status.vagaroWebhookToken}
		            saveVagaroBookingLink={async (url) => {
	              await saveVagaroBookingLink(url);
	              setBookingUrlOverride(url);
	              setForceMethodQuestion(false);
	              setShowSetupFlow(false);
	            }}
	            connectVagaroLiveSync={connectVagaroLiveSync}
	            regenerateVagaroToken={regenerateVagaroToken}
	            saveVagaroLiveSyncSettings={saveVagaroLiveSyncSettings}
	            connectMindbody={async (credentials) => {
              await connectMindbody(credentials);
              setForceMethodQuestion(false);
              setShowSetupFlow(false);
            }}
            connectAcuity={async (credentials) => {
              await connectAcuity(credentials);
              setForceMethodQuestion(false);
              setShowSetupFlow(false);
            }}
            disconnectMindbody={disconnectMindbody}
            disconnectAcuity={disconnectAcuity}
            disconnectSquare={disconnectSquare}
            refresh={() => void refresh()}
          />
        </>
      ) : null}

      {!forceMethodQuestion && status.step === 'direct' ? <DirectBookingConfirm onChange={() => void goBack()} /> : null}
      {!forceMethodQuestion && status.step === 'later' ? <SetupLaterConfirm onChange={() => void goBack()} /> : null}
        </>
      )}
    </div>
  );
}
