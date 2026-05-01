'use client';

import { useEffect, useState } from 'react';

import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { adminSidebarAddonStyles } from '@/components/admin/admin-sidebar-styles';
import { adminCallsScripts, adminCallsStyles } from '@/components/admin/admin-calls';

type DashboardMetrics = {
  shopCount: number;
  activeShops: number;
  callCount: number;
  missedCalls: number;
};

type ChartPeriod = 'today' | 'week' | 'month' | 'year';

type DashboardChartMetric = 'demo-calls' | 'leads' | 'shops' | 'calls';

type SingleChartResponse = {
  ok: boolean;
  error?: string;
  metric?: DashboardChartMetric;
  period?: ChartPeriod;
  from?: string;
  to?: string;
  labels?: string[];
  labelTitles?: string[];
  values?: number[];
  repositoryAvailable?: boolean;
};

const PERIODS: { id: ChartPeriod; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
];

const METRIC_SOURCE: Record<DashboardChartMetric, string> = {
  'demo-calls': 'Aggregated from `demo_call_runs.created_at` (same source as Admin → Demo calls).',
  leads: 'Aggregated from `contact_requests.created_at` (same source as Admin → Leads).',
  shops: 'Aggregated from `shops.created_at` (new business rows in the selected UTC window).',
  calls: 'Aggregated from `call_logs.started_at` (inbound / logged calls).',
};

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function AdminTrendSvg({
  chartId,
  ariaLabel,
  values,
  labels,
  labelTitles,
  stroke,
}: {
  chartId: string;
  ariaLabel: string;
  values: number[];
  labels: string[];
  labelTitles: string[];
  stroke: string;
}) {
  const max = Math.max(1, ...values);
  const w = 400;
  const h = 132;
  const padL = 10;
  const padR = 10;
  const padB = 26;
  const padT = 12;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const n = values.length;
  const xAt = (i: number) => padL + (n <= 1 ? chartW / 2 : (i / Math.max(n - 1, 1)) * chartW);
  const yAt = (v: number) => padT + chartH - (v / max) * chartH;
  const linePoints = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');
  const areaPath =
    n > 0
      ? `M ${xAt(0)},${padT + chartH} L ${values
          .map((v, i) => `${xAt(i)},${yAt(v)}`)
          .join(' L ')} L ${xAt(n - 1)},${padT + chartH} Z`
      : '';

  const tickStep = Math.max(1, Math.ceil(n / 8));

  return (
    <svg className="admin-chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={`admin-dash-grad-${chartId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#admin-dash-grad-${chartId})`} stroke="none" />
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={linePoints}
        />
        {labels.map((_, i) =>
          i % tickStep === 0 || i === n - 1 ? (
            <text
              key={`t-${labels[i]}-${i}`}
              className="admin-chart-x"
              x={xAt(i)}
              y={h - 6}
              textAnchor="middle"
            >
              {labelTitles[i] ?? labels[i]}
            </text>
          ) : null,
        )}
      </svg>
  );
}

function DashboardMetricChart({
  metric,
  title,
  stroke,
  chartId,
}: {
  metric: DashboardChartMetric;
  title: string;
  stroke: string;
  chartId: string;
}) {
  const [period, setPeriod] = useState<ChartPeriod>('week');
  const [data, setData] = useState<SingleChartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLocalError(null);
    const qs = new URLSearchParams({ period });
    void fetch(`/api/backend/admin/dashboard/charts/${encodeURIComponent(metric)}?${qs.toString()}`)
      .then(async (response) => (await response.json()) as SingleChartResponse)
      .then((body) => {
        if (cancelled) return;
        if (!body.ok || !body.values || !body.labels || !body.labelTitles) {
          setData(null);
          setLocalError(body.error ?? 'unable_to_load');
          return;
        }
        setData(body);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setLocalError('network_error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [metric, period]);

  const values = data?.values ?? [];
  const labels = data?.labels ?? [];
  const labelTitles = data?.labelTitles ?? [];
  const repoOk = data?.repositoryAvailable !== false;

  return (
    <div className="admin-chart-card">
      <div className="chart-head">
        <h3>{title}</h3>
      </div>
      <div className="admin-period-filter">
        <span className="period-label">UTC</span>
        {PERIODS.map((p) => (
          <button key={p.id} type="button" className={period === p.id ? 'active' : ''} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="chart-source">{METRIC_SOURCE[metric]}</p>
      {!repoOk ? (
        <div className="note" style={{ marginBottom: 10, fontSize: 12 }}>
          Repository not configured for this metric in this environment — chart shows zeros.
        </div>
      ) : null}
      {localError ? (
        <div className="note" style={{ marginBottom: 10, fontSize: 12 }}>
          {localError}
        </div>
      ) : null}
      {loading ? <p className="sub">Loading…</p> : null}
      {!loading && !localError && labels.length > 0 ? (
        <>
          <div className="chart-total" style={{ marginBottom: 8 }}>
            Total in range: {sum(values)}
          </div>
          <AdminTrendSvg
            chartId={chartId}
            ariaLabel={`${title} trend`}
            values={values}
            labels={labels}
            labelTitles={labelTitles}
            stroke={stroke}
          />
        </>
      ) : null}
    </div>
  );
}

export function AdminDashboardLive() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/backend/admin/dashboard')
      .then(async (response) => {
        const body = (await response.json()) as {
          ok: boolean;
          metrics?: DashboardMetrics;
          error?: string;
        };
        if (!body.ok || !body.metrics) {
          setError(body.error ?? 'unable_to_load');
          return;
        }
        setError(null);
        setMetrics(body.metrics);
      })
      .catch(() => setError('network_error'));
  }, []);

  async function signOut() {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  return (
    <AdminLayout
      styles={[...adminCallsStyles, ...adminSidebarAddonStyles]}
      scripts={adminCallsScripts}
      scriptPrefix="admin-dashboard-live"
      bodyClass="app-body"
    >
      <div className="app-shell">
        <AdminSidebar />
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Admin overview</h1>
              <p>
                KPI snapshot plus four independent charts. Each chart loads its own period from the backend and counts
                real database rows (UTC buckets) — no mock series.
              </p>
            </div>
            <div className="top-actions">
              <a className="btn" href="/admin/calls">
                Open calls
              </a>
              <button type="button" className="btn ghost" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </div>

          {error ? (
            <div className="note" style={{ marginBottom: 18 }}>
              Unable to load admin dashboard: {error}
            </div>
          ) : null}

          {!error && !metrics ? (
            <div className="note" style={{ marginBottom: 18 }}>
              Loading admin dashboard…
            </div>
          ) : null}

          {metrics ? (
            <>
              <section className="grid grid-4">
                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M3 10l2-5h14l2 5" />
                        <path d="M4 10h16v10H4z" />
                        <path d="M9 20v-6h6v6" />
                      </svg>
                    </div>
                    <span className="tag blue">Businesses</span>
                  </div>
                  <div className="stat-value">{metrics.shopCount}</div>
                  <div className="stat-meta">Total businesses in the system</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4" />
                        <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
                      </svg>
                    </div>
                    <span className="tag green">Active</span>
                  </div>
                  <div className="stat-value">{metrics.activeShops}</div>
                  <div className="stat-meta">Businesses marked active</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" />
                      </svg>
                    </div>
                    <span className="tag purple">Calls</span>
                  </div>
                  <div className="stat-value">{metrics.callCount}</div>
                  <div className="stat-meta">Total calls recorded</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M3 12h4l2-5 4 10 2-5h6" />
                      </svg>
                    </div>
                    <span className="tag orange">Missed</span>
                  </div>
                  <div className="stat-value">{metrics.missedCalls}</div>
                  <div className="stat-meta">Missed or dropped calls</div>
                </div>
              </section>

              <section className="admin-chart-grid" style={{ marginTop: 22 }}>
                <DashboardMetricChart metric="demo-calls" title="Demo calls" stroke="#a78bfa" chartId="demo" />
                <DashboardMetricChart metric="leads" title="Leads" stroke="#60a5fa" chartId="leads" />
                <DashboardMetricChart metric="shops" title="Businesses created" stroke="#4ade80" chartId="shops" />
                <DashboardMetricChart metric="calls" title="Calls" stroke="#c4b5fd" chartId="calls" />
              </section>
            </>
          ) : null}
        </main>
      </div>
    </AdminLayout>
  );
}
