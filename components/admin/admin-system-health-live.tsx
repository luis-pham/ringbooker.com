'use client';

import { useEffect, useState } from 'react';

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

  return (
    <main style={{ padding: 24, fontFamily: 'Mona Sans Variable, system-ui, sans-serif' }}>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>System health</h1>
      <p style={{ marginTop: 0, color: '#6b7280' }}>
        Live status from `/health`, `/readiness`, `/runtime`, and `/admin/system-health/metrics`.
      </p>
      {error ? <p style={{ color: '#dc2626' }}>{error}</p> : null}

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', marginBottom: 16 }}>
        <article style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
          <strong>Health</strong>
          <p style={{ margin: '8px 0 0' }}>{health ? (health.ok ? 'OK' : 'NOT OK') : 'Loading...'}</p>
        </article>
        <article style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
          <strong>Readiness</strong>
          <p style={{ margin: '8px 0 0' }}>
            {readiness ? (readiness.ok ? 'READY' : `NOT READY (${failedChecks} failed checks)`) : 'Loading...'}
          </p>
        </article>
        <article style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
          <strong>Runtime</strong>
          <p style={{ margin: '8px 0 0' }}>
            {runtime ? `${runtime.mode ?? 'unknown'} / ${runtime.commProvider ?? 'unknown'} / ${runtime.agentRuntimeMode ?? 'unknown'}` : 'Loading...'}
          </p>
        </article>
      </section>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', marginBottom: 16 }}>
        <article style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
          <strong>Realtime latency</strong>
          <p style={{ margin: '8px 0 0' }}>
            {metrics?.realtime
              ? `${metrics.realtime.responseLatencyMs.avg} ms avg (${metrics.realtime.responseLatencyMs.count} samples)`
              : 'Loading...'}
          </p>
        </article>
        <article style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
          <strong>Audio queue/jitter</strong>
          <p style={{ margin: '8px 0 0' }}>
            {metrics?.realtime
              ? `queue ${metrics.realtime.queueLatencyMs.avg} ms | jitter ${metrics.realtime.jitterMs.avg} ms`
              : 'Loading...'}
          </p>
        </article>
        <article style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
          <strong>Toolcalls</strong>
          <p style={{ margin: '8px 0 0' }}>
            {metrics?.toolcalls
              ? `${metrics.toolcalls.total} total | ${metrics.toolcalls.durationMs.avg} ms avg | queue failed ${metrics.toolcalls.queueFailed}`
              : 'Loading...'}
          </p>
        </article>
        <article style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
          <strong>Webhooks</strong>
          <p style={{ margin: '8px 0 0' }}>
            {metrics?.webhooks
              ? `${metrics.webhooks.processed}/${metrics.webhooks.total} processed | failures ${webhookFailures}`
              : 'Loading...'}
          </p>
        </article>
        <article style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
          <strong>Job queue</strong>
          <p style={{ margin: '8px 0 0' }}>
            {metrics?.jobs
              ? `open ${openJobs} | dead-letter ${metrics.jobs.deadLetter} | failed ${metrics.jobs.failed}`
              : 'Loading...'}
          </p>
        </article>
        <article style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
          <strong>API alerts proxy</strong>
          <p style={{ margin: '8px 0 0' }}>
            {metrics?.apiStatus
              ? `401:${metrics.apiStatus.status401} 403:${metrics.apiStatus.status403} 429:${metrics.apiStatus.status429} 5xx:${metrics.apiStatus.status5xx}`
              : 'Loading...'}
          </p>
          <p style={{ margin: '6px 0 0', color: criticalApiSpikes > 0 ? '#b91c1c' : '#6b7280' }}>
            {criticalApiSpikes > 0 ? 'Investigate spikes now.' : 'No critical spikes in current in-memory counters.'}
          </p>
        </article>
      </section>

      <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Readiness checks</h2>
        {!readiness?.checks?.length ? (
          <p style={{ marginBottom: 0, color: '#6b7280' }}>No checks returned.</p>
        ) : (
          <ul style={{ marginBottom: 0 }}>
            {readiness.checks.map((check) => (
              <li key={check.key}>
                {check.key}: <strong style={{ color: check.ok ? '#15803d' : '#b91c1c' }}>{check.ok ? 'OK' : 'FAIL'}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
