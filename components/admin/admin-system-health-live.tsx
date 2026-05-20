'use client';

import { useEffect, useState } from 'react';

import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { adminSidebarAddonStyles } from '@/components/admin/admin-sidebar-styles';
import { adminCallsScripts, adminCallsStyles } from '@/components/admin/admin-calls';

type HealthResponse = { ok: boolean };
type ReadinessCheck = { key: string; ok: boolean };
type ReadinessResponse = {
  ok: boolean;
  mode?: string;
  commProvider?: string;
  agentRuntimeMode?: string;
  checks?: ReadinessCheck[];
};
type RuntimeResponse = {
  ok: boolean;
  mode?: string;
  commProvider?: string;
  agentRuntimeMode?: string;
  agentTransportMode?: string;
  agentVoiceProviderMode?: string;
  agentVoiceModel?: string | null;
  emailProvider?: 'noop' | 'resend';
};
type DurationMetricSummary = {
  count: number;
  avg: number;
  min: number;
  max: number;
};
type SystemHealthMetricsResponse = {
  ok: boolean;
  generatedAt?: string;
  realtime?: {
    responseLatencyMs: DurationMetricSummary;
    queueLatencyMs: DurationMetricSummary;
    jitterMs: DurationMetricSummary;
  };
  toolcalls?: {
    total: number;
    queueFailed: number;
    durationMs: DurationMetricSummary;
  };
  webhooks?: {
    total: number;
    processed: number;
    duplicate: number;
    invalidSignature: number;
    failed: number;
  };
  jobs?: {
    queued: number;
    running: number;
    leased: number;
    completed: number;
    failed: number;
    deadLetter: number;
  };
  apiStatus?: {
    status401: number;
    status403: number;
    status429: number;
    status5xx: number;
  };
  email?: {
    emailProvider: 'noop' | 'resend';
    emailFromDomain: string;
    emailFounderFromDomain: string;
    lifecycleEmailJobs: {
      pending: number;
      failed: number;
    };
    recentBillingEmailNotifications: Array<{
      shopId: string;
      type: string;
      sentAt: string;
      skipped?: boolean;
      skipReason?: string;
    }>;
  };
};

export function AdminSystemHealthLive() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [runtime, setRuntime] = useState<RuntimeResponse | null>(null);
  const [metrics, setMetrics] = useState<SystemHealthMetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [healthRes, readinessRes, runtimeRes, metricsRes] = await Promise.all([
          fetch('/api/backend/health', { cache: 'no-store' }),
          fetch('/api/backend/readiness', { cache: 'no-store' }),
          fetch('/api/backend/runtime', { cache: 'no-store' }),
          fetch('/api/backend/admin/system-health/metrics', { cache: 'no-store' }),
        ]);
        if (cancelled) return;
        setHealth((await healthRes.json()) as HealthResponse);
        setReadiness((await readinessRes.json()) as ReadinessResponse);
        setRuntime((await runtimeRes.json()) as RuntimeResponse);
        setMetrics((await metricsRes.json()) as SystemHealthMetricsResponse);
      } catch {
        if (!cancelled) {
          setError('Unable to load live system health status.');
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const failedChecks = readiness?.checks?.filter((check) => !check.ok).length ?? 0;
  const webhookFailures = (metrics?.webhooks?.failed ?? 0) + (metrics?.webhooks?.invalidSignature ?? 0);
  const openJobs = (metrics?.jobs?.queued ?? 0) + (metrics?.jobs?.running ?? 0) + (metrics?.jobs?.leased ?? 0);
  const criticalApiSpikes = (metrics?.apiStatus?.status5xx ?? 0) + (metrics?.apiStatus?.status429 ?? 0);

  async function signOut() {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  return (
    <AdminLayout
      styles={[...adminCallsStyles, ...adminSidebarAddonStyles]}
      scripts={adminCallsScripts}
      scriptPrefix="admin-system-health-live"
      bodyClass="app-body"
    >
      <div className="app-shell">
        <AdminSidebar />
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>System health</h1>
              <p>Live status from `/health`, `/readiness`, `/runtime`, and `/admin/system-health/metrics`.</p>
            </div>
            <div className="top-actions">
              <button type="button" className="btn ghost" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </div>

          {error ? <div className="note" style={{ marginBottom: 18 }}>{error}</div> : null}

          <section className="grid grid-3">
            <div className="card">
              <h3 style={{ margin: '0 0 8px' }}>Health</h3>
              <p className="sub" style={{ margin: 0 }}>
                {health ? (health.ok ? 'OK' : 'NOT OK') : 'Loading...'}
              </p>
            </div>
            <div className="card">
              <h3 style={{ margin: '0 0 8px' }}>Readiness</h3>
              <p className="sub" style={{ margin: 0 }}>
                {readiness ? (readiness.ok ? 'READY' : `NOT READY (${failedChecks} failed checks)`) : 'Loading...'}
              </p>
            </div>
            <div className="card">
              <h3 style={{ margin: '0 0 8px' }}>Runtime</h3>
              <p className="sub" style={{ margin: 0 }}>
                {runtime
                  ? `${runtime.mode ?? 'unknown'} / ${runtime.commProvider ?? 'unknown'} / ${runtime.agentRuntimeMode ?? 'unknown'}`
                  : 'Loading...'}
              </p>
            </div>
          </section>

          <section className="grid grid-3" style={{ marginTop: 18 }}>
            <div className="card">
              <h3 style={{ margin: '0 0 8px' }}>Realtime latency</h3>
              <p className="sub" style={{ margin: 0 }}>
                {metrics?.realtime
                  ? `${metrics.realtime.responseLatencyMs.avg} ms avg (${metrics.realtime.responseLatencyMs.count} samples)`
                  : 'Loading...'}
              </p>
            </div>
            <div className="card">
              <h3 style={{ margin: '0 0 8px' }}>Audio queue / jitter</h3>
              <p className="sub" style={{ margin: 0 }}>
                {metrics?.realtime
                  ? `queue ${metrics.realtime.queueLatencyMs.avg} ms | jitter ${metrics.realtime.jitterMs.avg} ms`
                  : 'Loading...'}
              </p>
            </div>
            <div className="card">
              <h3 style={{ margin: '0 0 8px' }}>Toolcalls</h3>
              <p className="sub" style={{ margin: 0 }}>
                {metrics?.toolcalls
                  ? `${metrics.toolcalls.total} total | ${metrics.toolcalls.durationMs.avg} ms avg | queue failed ${metrics.toolcalls.queueFailed}`
                  : 'Loading...'}
              </p>
            </div>
            <div className="card">
              <h3 style={{ margin: '0 0 8px' }}>Webhooks</h3>
              <p className="sub" style={{ margin: 0 }}>
                {metrics?.webhooks
                  ? `${metrics.webhooks.processed}/${metrics.webhooks.total} processed | failures ${webhookFailures}`
                  : 'Loading...'}
              </p>
            </div>
            <div className="card">
              <h3 style={{ margin: '0 0 8px' }}>Job queue</h3>
              <p className="sub" style={{ margin: 0 }}>
                {metrics?.jobs
                  ? `open ${openJobs} | dead-letter ${metrics.jobs.deadLetter} | failed ${metrics.jobs.failed}`
                  : 'Loading...'}
              </p>
            </div>
            <div className="card">
              <h3 style={{ margin: '0 0 8px' }}>API alerts proxy</h3>
              <p className="sub" style={{ margin: 0 }}>
                {metrics?.apiStatus
                  ? `401:${metrics.apiStatus.status401} 403:${metrics.apiStatus.status403} 429:${metrics.apiStatus.status429} 5xx:${metrics.apiStatus.status5xx}`
                  : 'Loading...'}
              </p>
              <p className="sub" style={{ margin: '8px 0 0', color: criticalApiSpikes > 0 ? 'var(--red)' : undefined }}>
                {criticalApiSpikes > 0 ? 'Investigate spikes now.' : 'No critical spikes in current in-memory counters.'}
              </p>
            </div>
          </section>

          <section className="card" style={{ marginTop: 18 }}>
            <div className="panel-head">
              <div>
                <h3>Email lifecycle</h3>
                <p className="sub">Provider, lifecycle job backlog, and recent billing notification sends.</p>
              </div>
            </div>
            {!metrics?.email ? (
              <p className="sub" style={{ margin: 0 }}>
                No email diagnostics returned.
              </p>
            ) : (
              <>
                <p className="sub" style={{ margin: '0 0 12px' }}>
                  Provider: <strong>{metrics.email.emailProvider}</strong> · from{' '}
                  <code>{metrics.email.emailFromDomain}</code> · founder{' '}
                  <code>{metrics.email.emailFounderFromDomain}</code>
                  {runtime?.emailProvider ? ` · runtime ${runtime.emailProvider}` : ''}
                </p>
                <p className="sub" style={{ margin: '0 0 12px' }}>
                  Lifecycle email jobs — pending: {metrics.email.lifecycleEmailJobs.pending} · failed:{' '}
                  {metrics.email.lifecycleEmailJobs.failed}
                </p>
                {metrics.email.recentBillingEmailNotifications.length === 0 ? (
                  <p className="sub" style={{ margin: 0 }}>
                    No recent billing email notifications recorded.
                  </p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {metrics.email.recentBillingEmailNotifications.map((row) => (
                      <li key={`${row.shopId}-${row.type}-${row.sentAt}`} style={{ marginBottom: 8 }}>
                        <code>{row.type}</code> · shop {row.shopId.slice(0, 8)}… · {row.sentAt}
                        {row.skipped ? ` · skipped (${row.skipReason ?? 'unknown'})` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>

          <section className="card" style={{ marginTop: 18 }}>
            <div className="panel-head">
              <div>
                <h3>Readiness checks</h3>
                <p className="sub">Individual dependency gates.</p>
              </div>
            </div>
            {!readiness?.checks?.length ? (
              <p className="sub" style={{ margin: 0 }}>
                No checks returned.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {readiness.checks.map((check) => (
                  <li key={check.key} style={{ marginBottom: 8 }}>
                    {check.key}:{' '}
                    <span className={check.ok ? 'tag green' : 'tag red'}>{check.ok ? 'OK' : 'FAIL'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </AdminLayout>
  );
}
