'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { adminSidebarAddonStyles } from '@/components/admin/admin-sidebar-styles';
import { adminCallsScripts, adminCallsStyles } from '@/components/admin/admin-calls';

type DemoTab = 'phone' | 'web';

type DemoCallRow = {
  requestId: string;
  demoSessionId: string;
  publicSessionId: string;
  verticalSlug: string;
  demoMode: string;
  source: string;
  sessionStatus: string;
  runStatus: string;
  outcome: string | null;
  callbackPhone: string;
  businessName: string | null;
  clientIp: string | null;
  clientCountry: string | null;
  provider: string;
  providerCallId: string | null;
  roomName: string | null;
  startedAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  runCreatedAt: string;
  demoDurationSeconds: number | null;
  transcriptStatus?: string;
  hasTranscriptText?: boolean;
};

type WebDemoRow = {
  kind: 'livekit_web' | 'direct_realtime';
  startedAt: string;
  sessionId: string;
  requestId: string | null;
  webDemoRowId: string | null;
  ip: string | null;
  country: string | null;
  durationSeconds: number | null;
  businessName: string | null;
  verticalSlug: string;
  status: string;
  browser: string | null;
  deviceType: string | null;
  userAgent: string | null;
  transcriptAvailable: boolean;
};

type ChartDay = { day: string; count: number; demoSeconds: number };

type DemosSummary = {
  total: number;
  completed: number;
  missed: number;
  withTranscript: number;
  summarySampleSize: number;
  summaryTruncated: boolean;
};

type DemosPagination = { page: number; pageSize: number; total: number };

type ListResponse = {
  ok: boolean;
  calls?: DemoCallRow[];
  chartDaily?: ChartDay[];
  summary?: DemosSummary;
  pagination?: DemosPagination;
  filter?: { dateFrom: string; dateTo: string };
  error?: string;
};

type WebListResponse = {
  ok: boolean;
  sessions?: WebDemoRow[];
  pagination?: DemosPagination;
  filter?: {
    dateFrom: string;
    dateTo: string;
    vertical: string | null;
    status: string | null;
    country: string | null;
    search: string | null;
  };
  truncatedMerge?: boolean;
  error?: string;
};

type TranscriptOpen =
  | { channel: 'phone'; row: DemoCallRow }
  | { channel: 'web'; row: WebDemoRow };

function utcTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcDaysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function runStatusClass(row: DemoCallRow) {
  if (row.outcome === 'missed' || row.runStatus === 'missed') return 'tag orange';
  if (row.outcome === 'error' || row.runStatus === 'failed') return 'tag red';
  if (row.runStatus === 'completed') return 'tag green';
  return 'tag blue';
}

function webDemoStatusClass(status: string) {
  switch (status) {
    case 'started':
      return 'tag gray';
    case 'connected':
      return 'tag blue';
    case 'completed':
      return 'tag green';
    case 'failed':
      return 'tag red';
    case 'timed_out':
      return 'tag orange';
    case 'rate_limited':
      return 'tag orange';
    default:
      return 'tag gray';
  }
}

function transcriptFetchKey(open: TranscriptOpen | null): string | null {
  if (!open) return null;
  if (open.channel === 'phone') return `phone:${open.row.requestId}`;
  const w = open.row;
  if (w.kind === 'livekit_web' && w.requestId) return `livekit:${w.requestId}`;
  if (w.kind === 'direct_realtime' && w.webDemoRowId) return `direct:${w.webDemoRowId}`;
  return null;
}

export function AdminDemosLive() {
  const [activeTab, setActiveTab] = useState<DemoTab>('phone');

  const [dateFrom, setDateFrom] = useState(() => utcDaysAgoIso(30));
  const [dateTo, setDateTo] = useState(() => utcTodayIso());
  const [appliedFrom, setAppliedFrom] = useState(() => utcDaysAgoIso(30));
  const [appliedTo, setAppliedTo] = useState(() => utcTodayIso());
  const [listPage, setListPage] = useState(1);
  const [calls, setCalls] = useState<DemoCallRow[]>([]);
  const [chartDaily, setChartDaily] = useState<ChartDay[]>([]);
  const [summary, setSummary] = useState<DemosSummary | null>(null);
  const [pagination, setPagination] = useState<DemosPagination | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [webVertical, setWebVertical] = useState('');
  const [webStatus, setWebStatus] = useState('');
  const [webCountry, setWebCountry] = useState('');
  const [webSearch, setWebSearch] = useState('');
  const [appliedWebVertical, setAppliedWebVertical] = useState('');
  const [appliedWebStatus, setAppliedWebStatus] = useState('');
  const [appliedWebCountry, setAppliedWebCountry] = useState('');
  const [appliedWebSearch, setAppliedWebSearch] = useState('');
  const [webSessions, setWebSessions] = useState<WebDemoRow[]>([]);
  const [webPagination, setWebPagination] = useState<DemosPagination | null>(null);
  const [webError, setWebError] = useState<string | null>(null);
  const [webTruncated, setWebTruncated] = useState(false);
  const [webPage, setWebPage] = useState(1);

  const [transcriptOpen, setTranscriptOpen] = useState<TranscriptOpen | null>(null);
  const transcriptDialogRef = useRef<HTMLDialogElement>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [transcriptStatus, setTranscriptStatus] = useState<string | null>(null);

  const loadPhone = useCallback(async (from: string, to: string, page: number) => {
    const qs = new URLSearchParams({
      dateFrom: from,
      dateTo: to,
      page: String(page),
    });
    void fetch(`/api/backend/admin/demos/phone?${qs.toString()}`)
      .then(async (response) => {
        const body = (await response.json()) as ListResponse;
        if (!body.ok) {
          setError(body.error ?? 'unable_to_load');
          setCalls([]);
          setChartDaily([]);
          setSummary(null);
          setPagination(null);
          return;
        }
        setError(null);
        setCalls(body.calls ?? []);
        setChartDaily(body.chartDaily ?? []);
        setSummary(body.summary ?? null);
        setPagination(body.pagination ?? null);
      })
      .catch(() => {
        setError('network_error');
        setCalls([]);
        setChartDaily([]);
        setSummary(null);
        setPagination(null);
      });
  }, []);

  const loadWeb = useCallback(
    async (
      from: string,
      to: string,
      page: number,
      filters: { vertical: string; status: string; country: string; search: string },
    ) => {
      const qs = new URLSearchParams({
        dateFrom: from,
        dateTo: to,
        page: String(page),
      });
      if (filters.vertical.trim()) qs.set('vertical', filters.vertical.trim());
      if (filters.status.trim()) qs.set('status', filters.status.trim());
      if (filters.country.trim()) qs.set('country', filters.country.trim());
      if (filters.search.trim()) qs.set('search', filters.search.trim());

      void fetch(`/api/backend/admin/demos/web?${qs.toString()}`)
        .then(async (response) => {
          const body = (await response.json()) as WebListResponse;
          if (!body.ok) {
            setWebError(body.error ?? 'unable_to_load');
            setWebSessions([]);
            setWebPagination(null);
            setWebTruncated(false);
            return;
          }
          setWebError(null);
          setWebSessions(body.sessions ?? []);
          setWebPagination(body.pagination ?? null);
          setWebTruncated(Boolean(body.truncatedMerge));
        })
        .catch(() => {
          setWebError('network_error');
          setWebSessions([]);
          setWebPagination(null);
          setWebTruncated(false);
        });
    },
    [],
  );

  useEffect(() => {
    if (activeTab !== 'phone') return;
    void loadPhone(appliedFrom, appliedTo, listPage);
  }, [activeTab, appliedFrom, appliedTo, listPage, loadPhone]);

  useEffect(() => {
    if (activeTab !== 'web') return;
    void loadWeb(appliedFrom, appliedTo, webPage, {
      vertical: appliedWebVertical,
      status: appliedWebStatus,
      country: appliedWebCountry,
      search: appliedWebSearch,
    });
  }, [
    activeTab,
    appliedFrom,
    appliedTo,
    webPage,
    appliedWebVertical,
    appliedWebStatus,
    appliedWebCountry,
    appliedWebSearch,
    loadWeb,
  ]);

  useEffect(() => {
    const el = transcriptDialogRef.current;
    if (!el) return;
    if (transcriptOpen) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [transcriptOpen]);

  const tfKey = transcriptFetchKey(transcriptOpen);
  useEffect(() => {
    if (!transcriptOpen || !tfKey) {
      setTranscriptText(null);
      setTranscriptStatus(null);
      setTranscriptError(null);
      setTranscriptLoading(false);
      return;
    }

    let cancelled = false;
    setTranscriptLoading(true);
    setTranscriptError(null);
    setTranscriptText(null);
    setTranscriptStatus(null);

    let url = '';
    if (transcriptOpen.channel === 'phone') {
      url = `/api/backend/admin/demo-calls/${encodeURIComponent(transcriptOpen.row.requestId)}/transcript`;
    } else if (transcriptOpen.row.kind === 'livekit_web' && transcriptOpen.row.requestId) {
      url = `/api/backend/admin/demo-calls/${encodeURIComponent(transcriptOpen.row.requestId)}/transcript`;
    } else if (transcriptOpen.row.kind === 'direct_realtime' && transcriptOpen.row.webDemoRowId) {
      url = `/api/backend/admin/demos/web/${encodeURIComponent(transcriptOpen.row.webDemoRowId)}/transcript`;
    } else {
      setTranscriptLoading(false);
      setTranscriptError('invalid_row');
      return;
    }

    void fetch(url)
      .then(async (response) => {
        const body = (await response.json()) as {
          ok: boolean;
          transcriptText?: string | null;
          transcriptStatus?: string | null;
          status?: string | null;
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok || !body.ok) {
          setTranscriptError(body.error ?? `http_${response.status}`);
          setTranscriptText(null);
          setTranscriptStatus(null);
          return;
        }
        setTranscriptText(body.transcriptText ?? null);
        setTranscriptStatus(body.transcriptStatus ?? body.status ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setTranscriptError('network_error');
          setTranscriptText(null);
        }
      })
      .finally(() => {
        if (!cancelled) setTranscriptLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tfKey, transcriptOpen]);

  async function signOut() {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  function applyFilters() {
    setListPage(1);
    setWebPage(1);
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
    setAppliedWebVertical(webVertical);
    setAppliedWebStatus(webStatus);
    setAppliedWebCountry(webCountry);
    setAppliedWebSearch(webSearch);
  }

  const chartMax = useMemo(() => {
    let max = 1;
    for (const d of chartDaily) {
      max = Math.max(max, d.count, Math.ceil(d.demoSeconds / 60));
    }
    return max;
  }, [chartDaily]);

  const metrics = summary ?? {
    total: 0,
    completed: 0,
    missed: 0,
    withTranscript: 0,
    summarySampleSize: 0,
    summaryTruncated: false,
  };

  return (
    <AdminLayout
      styles={[...adminCallsStyles, ...adminSidebarAddonStyles]}
      scripts={adminCallsScripts}
      scriptPrefix="admin-demos-live"
      bodyClass="app-body"
    >
      <div className="app-shell">
        <AdminSidebar />
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Marketing demos</h1>
              <p>
                Phone tab: PSTN / SIP-backed demo call runs (excludes LiveKit browser rows). Web tab: browser LiveKit plus
                direct OpenAI Realtime sessions — IP and country are admin-only operational signals.
              </p>
            </div>
            <div className="top-actions">
              <a className="btn" href="/admin/calls">
                Operations calls
              </a>
              <button type="button" className="btn ghost" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </div>

          <div className="card soft" style={{ marginBottom: 18, padding: '12px 16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <span className="sub" style={{ marginRight: 8 }}>
                View
              </span>
              <button
                type="button"
                className={activeTab === 'phone' ? 'btn purple' : 'btn ghost'}
                style={{ padding: '8px 14px', fontSize: 13 }}
                onClick={() => setActiveTab('phone')}
              >
                Phone Call Demo
              </button>
              <button
                type="button"
                className={activeTab === 'web' ? 'btn purple' : 'btn ghost'}
                style={{ padding: '8px 14px', fontSize: 13 }}
                onClick={() => setActiveTab('web')}
              >
                Web Call Demo
              </button>
            </div>
          </div>

          <section className="card soft" style={{ marginBottom: 18 }}>
            <div className="panel-head">
              <div>
                <h3>Date range (UTC)</h3>
                <p className="sub">
                  {activeTab === 'phone'
                    ? 'Applies to when the demo call run was created.'
                    : 'Applies to web session start time (direct) or demo call run creation (LiveKit web).'}
                </p>
              </div>
              <div className="top-actions" style={{ flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                  From
                  <input
                    className="btn ghost"
                    style={{ padding: '10px 14px', cursor: 'pointer', minWidth: 140 }}
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                  To
                  <input
                    className="btn ghost"
                    style={{ padding: '10px 14px', cursor: 'pointer', minWidth: 140 }}
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </label>
                <button type="button" className="btn purple" style={{ alignSelf: 'flex-end' }} onClick={applyFilters}>
                  Apply
                </button>
              </div>
            </div>
            {activeTab === 'web' ? (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(148,163,184,.25)' }}>
                <p className="sub" style={{ margin: '0 0 10px' }}>
                  Optional filters (direct sessions only use DB filters; LiveKit rows are filtered after fetch — large ranges may be
                  truncated).
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                    Vertical slug
                    <input
                      className="btn ghost"
                      style={{ padding: '10px 14px', minWidth: 140 }}
                      value={webVertical}
                      onChange={(e) => setWebVertical(e.target.value)}
                      placeholder="e.g. nail-salon"
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                    Status
                    <select
                      className="btn ghost"
                      style={{ padding: '10px 14px', minWidth: 140, cursor: 'pointer' }}
                      value={webStatus}
                      onChange={(e) => setWebStatus(e.target.value)}
                    >
                      <option value="">All</option>
                      <option value="started">started</option>
                      <option value="connected">connected</option>
                      <option value="completed">completed</option>
                      <option value="failed">failed</option>
                      <option value="timed_out">timed_out</option>
                      <option value="rate_limited">rate_limited</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                    Country
                    <input
                      className="btn ghost"
                      style={{ padding: '10px 14px', width: 90 }}
                      value={webCountry}
                      onChange={(e) => setWebCountry(e.target.value)}
                      placeholder="US"
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                    Search
                    <input
                      className="btn ghost"
                      style={{ padding: '10px 14px', minWidth: 180 }}
                      value={webSearch}
                      onChange={(e) => setWebSearch(e.target.value)}
                      placeholder="business or session id"
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </section>

          {activeTab === 'phone' ? (
            <>
              {error ? (
                <div className="note" style={{ marginBottom: 18 }}>
                  Unable to load demo calls: {error}
                </div>
              ) : null}

              <section className="grid grid-4">
                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" />
                      </svg>
                    </div>
                    <span className="tag blue">Runs</span>
                  </div>
                  <div className="stat-value">{metrics.total}</div>
                  <div className="stat-meta">Runs in the selected date range (all pages)</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" />
                      </svg>
                    </div>
                    <span className="tag green">Completed</span>
                  </div>
                  <div className="stat-value">{metrics.completed}</div>
                  <div className="stat-meta">
                    Completed runs
                    {metrics.summaryTruncated ? ` (sample of ${metrics.summarySampleSize})` : ''}
                  </div>
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
                  <div className="stat-value">{metrics.missed}</div>
                  <div className="stat-meta">
                    Missed / failed
                    {metrics.summaryTruncated ? ` (sample of ${metrics.summarySampleSize})` : ''}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <span className="tag purple">Transcripts</span>
                  </div>
                  <div className="stat-value">{metrics.withTranscript}</div>
                  <div className="stat-meta">
                    With transcript text
                    {metrics.summaryTruncated ? ` (sample of ${metrics.summarySampleSize})` : ''}
                  </div>
                </div>
              </section>

              <section className="card" style={{ marginTop: 18 }}>
                <div className="panel-head">
                  <div>
                    <h3>Daily volume</h3>
                    <p className="sub">
                      Bar height = demo count per UTC day (from run created time).
                      {metrics.summaryTruncated
                        ? ` Chart uses the ${metrics.summarySampleSize} most recent runs in range (${metrics.total} total).`
                        : null}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 140, padding: '8px 0 4px' }}>
                  {chartDaily.length === 0 ? (
                    <p className="sub" style={{ margin: 0 }}>
                      No data in this range.
                    </p>
                  ) : (
                    chartDaily.map((d) => {
                      const h = Math.max(8, Math.round((d.count / chartMax) * 120));
                      return (
                        <div
                          key={d.day}
                          title={`${d.day}: ${d.count} demos, ${formatDuration(d.demoSeconds)} connected/total audio`}
                          style={{
                            flex: 1,
                            minWidth: 8,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              maxWidth: 28,
                              height: h,
                              borderRadius: 10,
                              background: 'linear-gradient(180deg, rgba(139,92,246,.85), rgba(124,58,237,.35))',
                              border: '1px solid rgba(139,92,246,.35)',
                            }}
                          />
                          <span style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center' }}>{d.day.slice(5)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="card" style={{ marginTop: 18 }}>
                <div className="panel-head">
                  <div>
                    <h3>Phone Call Demo runs</h3>
                    <p className="sub">
                      Time (started / run created), phone (callback), business, vertical, IP, country, duration, status, transcript
                      (demo shop call log).
                    </p>
                  </div>
                </div>
                {error ? null : !pagination ? (
                  <p className="sub" style={{ margin: 0 }}>
                    Loading demo runs…
                  </p>
                ) : pagination.total === 0 ? (
                  <div className="empty">No phone demo runs in this range yet.</div>
                ) : (
                  <>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Business</th>
                            <th>Vertical</th>
                            <th>Phone</th>
                            <th>IP</th>
                            <th>Country</th>
                            <th>Duration</th>
                            <th>Status</th>
                            <th>Transcript</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calls.length === 0 ? (
                            <tr>
                              <td colSpan={9}>
                                <div className="sub" style={{ padding: '12px 0' }}>
                                  No rows on this page. Try the previous page.
                                </div>
                              </td>
                            </tr>
                          ) : (
                            calls.map((row) => (
                              <tr key={row.requestId}>
                                <td>{formatDateTime(row.startedAt ?? row.runCreatedAt)}</td>
                                <td>{row.businessName ?? '—'}</td>
                                <td>{row.verticalSlug}</td>
                                <td>{row.callbackPhone}</td>
                                <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{row.clientIp ?? '—'}</td>
                                <td>{row.clientCountry ?? '—'}</td>
                                <td>{formatDuration(row.demoDurationSeconds)}</td>
                                <td>
                                  <span className={runStatusClass(row)}>{row.runStatus}</span>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn ghost"
                                    style={{ padding: '8px 12px', fontSize: 12 }}
                                    onClick={() => setTranscriptOpen({ channel: 'phone', row })}
                                  >
                                    View transcript
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {pagination.total > 0 ? (
                      <div className="top-actions" style={{ marginTop: 14, justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                        <p className="sub" style={{ margin: 0 }}>
                          {pagination.total > pagination.pageSize ? (
                            <>
                              Page {pagination.page} of {Math.max(1, Math.ceil(pagination.total / pagination.pageSize))}
                              <span style={{ opacity: 0.75 }}>
                                {' '}
                                · {pagination.total} runs · {pagination.pageSize} per page
                              </span>
                            </>
                          ) : (
                            <span style={{ opacity: 0.85 }}>
                              {pagination.total} run{pagination.total === 1 ? '' : 's'} · {pagination.pageSize} per page
                            </span>
                          )}
                        </p>
                        {pagination.total > pagination.pageSize ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              className="btn ghost"
                              disabled={pagination.page <= 1}
                              onClick={() => setListPage((p) => Math.max(1, p - 1))}
                            >
                              Previous
                            </button>
                            <button
                              type="button"
                              className="btn ghost"
                              disabled={pagination.page * pagination.pageSize >= pagination.total}
                              onClick={() => setListPage((p) => p + 1)}
                            >
                              Next
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            </>
          ) : (
            <>
              {webError ? (
                <div className="note" style={{ marginBottom: 18 }}>
                  Unable to load web demos: {webError}
                </div>
              ) : null}
              {webTruncated ? (
                <div className="note" style={{ marginBottom: 18 }}>
                  Results may be incomplete: merge cap reached for LiveKit or direct rows in this range. Narrow the date range or
                  filters.
                </div>
              ) : null}
              <section className="card" style={{ marginTop: 0 }}>
                <div className="panel-head">
                  <div>
                    <h3>Web Call Demo sessions</h3>
                    <p className="sub">
                      LiveKit browser demos (`marketing_demo_web`) and direct OpenAI Realtime rows. Session ID is the public browser
                      session key.
                    </p>
                  </div>
                </div>
                {!webPagination ? (
                  <p className="sub" style={{ margin: 0 }}>
                    Loading web demos…
                  </p>
                ) : webPagination.total === 0 ? (
                  <div className="empty">
                    <h4 style={{ margin: '0 0 8px' }}>No web demo calls yet</h4>
                    <p className="sub" style={{ margin: 0 }}>
                      When visitors start a live web demo, sessions will appear here with duration, location, business context, and
                      transcript.
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>IP</th>
                            <th>Country</th>
                            <th>Duration</th>
                            <th>Business</th>
                            <th>Vertical</th>
                            <th>Kind</th>
                            <th>Status</th>
                            <th>Session ID</th>
                            <th>Device</th>
                            <th>Transcript</th>
                          </tr>
                        </thead>
                        <tbody>
                          {webSessions.map((row) => (
                            <tr key={`${row.kind}:${row.requestId ?? row.webDemoRowId ?? row.sessionId}`}>
                              <td>{formatDateTime(row.startedAt)}</td>
                              <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{row.ip ?? '—'}</td>
                              <td>{row.country ?? '—'}</td>
                              <td>{formatDuration(row.durationSeconds)}</td>
                              <td>{row.businessName ?? '—'}</td>
                              <td>{row.verticalSlug}</td>
                              <td>
                                <span className="tag purple">{row.kind === 'livekit_web' ? 'LiveKit' : 'Direct'}</span>
                              </td>
                              <td>
                                <span className={webDemoStatusClass(row.status)}>{row.status}</span>
                              </td>
                              <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, maxWidth: 160 }} title={row.sessionId}>
                                {row.sessionId.length > 22 ? `${row.sessionId.slice(0, 22)}…` : row.sessionId}
                              </td>
                              <td style={{ fontSize: 12 }}>
                                {[row.deviceType, row.browser].filter(Boolean).join(' · ') || '—'}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn ghost"
                                  style={{ padding: '8px 12px', fontSize: 12 }}
                                  onClick={() => setTranscriptOpen({ channel: 'web', row })}
                                >
                                  View transcript
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="top-actions" style={{ marginTop: 14, justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <p className="sub" style={{ margin: 0 }}>
                        {webPagination.total > webPagination.pageSize ? (
                          <>
                            Page {webPagination.page} of {Math.max(1, Math.ceil(webPagination.total / webPagination.pageSize))}
                            <span style={{ opacity: 0.75 }}>
                              {' '}
                              · {webPagination.total} sessions · {webPagination.pageSize} per page
                            </span>
                          </>
                        ) : (
                          <span style={{ opacity: 0.85 }}>
                            {webPagination.total} session{webPagination.total === 1 ? '' : 's'} · {webPagination.pageSize} per page
                          </span>
                        )}
                      </p>
                      {webPagination.total > webPagination.pageSize ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn ghost"
                            disabled={webPagination.page <= 1}
                            onClick={() => setWebPage((p) => Math.max(1, p - 1))}
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            className="btn ghost"
                            disabled={webPagination.page * webPagination.pageSize >= webPagination.total}
                            onClick={() => setWebPage((p) => p + 1)}
                          >
                            Next
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </section>
            </>
          )}

          <dialog
            ref={transcriptDialogRef}
            className="rb-admin-modal"
            onClose={() => setTranscriptOpen(null)}
          >
            {transcriptOpen ? (
              <>
                <div className="rb-admin-modal-head">
                  <div>
                    <h3 style={{ margin: '0 0 6px' }}>Transcript</h3>
                    <p className="sub" style={{ margin: 0 }}>
                      {transcriptOpen.channel === 'phone' ? (
                        <>
                          Request{' '}
                          <span style={{ fontFamily: 'ui-monospace, monospace' }}>{transcriptOpen.row.requestId}</span>
                        </>
                      ) : (
                        <>
                          Session{' '}
                          <span style={{ fontFamily: 'ui-monospace, monospace' }}>{transcriptOpen.row.sessionId}</span>
                          {transcriptOpen.row.requestId ? (
                            <>
                              {' '}
                              · request{' '}
                              <span style={{ fontFamily: 'ui-monospace, monospace' }}>{transcriptOpen.row.requestId}</span>
                            </>
                          ) : null}
                        </>
                      )}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    <span className="tag purple">{transcriptStatus ?? 'unknown'}</span>
                    <button type="button" className="btn ghost" onClick={() => transcriptDialogRef.current?.close()}>
                      Close
                    </button>
                  </div>
                </div>
                <div className="rb-admin-modal-body">
                  {transcriptLoading ? <p className="sub">Loading transcript…</p> : null}
                  {transcriptError ? (
                    <div className="note">
                      {transcriptError === 'transcript_not_found'
                        ? 'No call log row yet for this request (call may not have hit the demo business log).'
                        : transcriptError}
                    </div>
                  ) : null}
                  {!transcriptLoading && !transcriptError ? (
                    <div className="note" style={{ whiteSpace: 'pre-wrap', color: 'var(--text)', maxHeight: 'none' }}>
                      {transcriptText?.trim()
                        ? transcriptText
                        : transcriptOpen.channel === 'web'
                          ? 'No transcript was captured for this session.'
                          : 'No transcript text stored for this request yet.'}
                    </div>
                  ) : null}
                  <div className="list" style={{ marginTop: 16 }}>
                    {transcriptOpen.channel === 'phone' ? (
                      <>
                        <div className="list-item">
                          <div className="item-main">
                            <div className="avatar">IP</div>
                            <div>
                              <h4>Client IP</h4>
                              <p>{transcriptOpen.row.clientIp ?? 'Not captured'}</p>
                            </div>
                          </div>
                        </div>
                        <div className="list-item">
                          <div className="item-main">
                            <div className="avatar">CC</div>
                            <div>
                              <h4>Country</h4>
                              <p>
                                {transcriptOpen.row.clientCountry ??
                                  'Not available (no valid CF-IPCountry and number did not map to a country code)'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="list-item">
                          <div className="item-main">
                            <div className="avatar">RM</div>
                            <div>
                              <h4>Room</h4>
                              <p>{transcriptOpen.row.roomName ?? '—'}</p>
                            </div>
                          </div>
                        </div>
                        <div className="list-item">
                          <div className="item-main">
                            <div className="avatar">PR</div>
                            <div>
                              <h4>Provider call</h4>
                              <p style={{ wordBreak: 'break-all' }}>{transcriptOpen.row.providerCallId ?? '—'}</p>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="list-item">
                          <div className="item-main">
                            <div className="avatar">VS</div>
                            <div>
                              <h4>Vertical</h4>
                              <p>{transcriptOpen.row.verticalSlug}</p>
                            </div>
                          </div>
                        </div>
                        <div className="list-item">
                          <div className="item-main">
                            <div className="avatar">BN</div>
                            <div>
                              <h4>Business</h4>
                              <p>{transcriptOpen.row.businessName ?? '—'}</p>
                            </div>
                          </div>
                        </div>
                        <div className="list-item">
                          <div className="item-main">
                            <div className="avatar">CC</div>
                            <div>
                              <h4>Country</h4>
                              <p>{transcriptOpen.row.country ?? '—'}</p>
                            </div>
                          </div>
                        </div>
                        <div className="list-item">
                          <div className="item-main">
                            <div className="avatar">DU</div>
                            <div>
                              <h4>Duration</h4>
                              <p>{formatDuration(transcriptOpen.row.durationSeconds)}</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </dialog>
        </main>
      </div>
    </AdminLayout>
  );
}
