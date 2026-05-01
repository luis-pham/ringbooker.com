'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { adminSidebarAddonStyles } from '@/components/admin/admin-sidebar-styles';
import { adminCallsScripts, adminCallsStyles } from '@/components/admin/admin-calls';

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

export function AdminDemosLive() {
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
  const [transcriptDialogRow, setTranscriptDialogRow] = useState<DemoCallRow | null>(null);
  const transcriptDialogRef = useRef<HTMLDialogElement>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [transcriptStatus, setTranscriptStatus] = useState<string | null>(null);

  const load = useCallback(async (from: string, to: string, page: number) => {
    const qs = new URLSearchParams({
      dateFrom: from,
      dateTo: to,
      page: String(page),
    });
    void fetch(`/api/backend/admin/demo-calls?${qs.toString()}`)
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

  useEffect(() => {
    void load(appliedFrom, appliedTo, listPage);
  }, [appliedFrom, appliedTo, listPage, load]);

  useEffect(() => {
    const el = transcriptDialogRef.current;
    if (!el) return;
    if (transcriptDialogRow) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [transcriptDialogRow]);

  useEffect(() => {
    if (!transcriptDialogRow) {
      setTranscriptText(null);
      setTranscriptStatus(null);
      setTranscriptError(null);
      setTranscriptLoading(false);
      return;
    }
    const requestId = transcriptDialogRow.requestId;
    let cancelled = false;
    setTranscriptLoading(true);
    setTranscriptError(null);
    setTranscriptText(null);
    setTranscriptStatus(null);
    void fetch(`/api/backend/admin/demo-calls/${encodeURIComponent(requestId)}/transcript`)
      .then(async (response) => {
        const body = (await response.json()) as {
          ok: boolean;
          transcriptText?: string | null;
          transcriptStatus?: string | null;
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
        setTranscriptStatus(body.transcriptStatus ?? null);
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
  }, [transcriptDialogRow?.requestId]);

  async function signOut() {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  function applyFilters() {
    setListPage(1);
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
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
              <h1>Marketing demo calls</h1>
              <p>
                Filter by UTC date range, inspect IP and country (CF-IPCountry when present, otherwise inferred from
                callback number), and open transcripts from the demo business call log.
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

          <section className="card soft" style={{ marginBottom: 18 }}>
            <div className="panel-head">
              <div>
                <h3>Date range (UTC)</h3>
                <p className="sub">Applies to when the demo call run was created.</p>
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
          </section>

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
                <h3>Demo call runs</h3>
                <p className="sub">Open a transcript in the dialog to read the demo business call log for that run.</p>
              </div>
            </div>
            {error ? null : !pagination ? (
              <p className="sub" style={{ margin: 0 }}>
                Loading demo runs…
              </p>
            ) : pagination.total === 0 ? (
              <div className="empty">No demo runs in this range yet.</div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Started</th>
                        <th>Business</th>
                        <th>Vertical</th>
                        <th>Callback</th>
                        <th>IP</th>
                        <th>Country</th>
                        <th>Demo duration</th>
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
                                onClick={() => setTranscriptDialogRow(row)}
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

          <dialog
            ref={transcriptDialogRef}
            className="rb-admin-modal"
            onClose={() => setTranscriptDialogRow(null)}
          >
            {transcriptDialogRow ? (
              <>
                <div className="rb-admin-modal-head">
                  <div>
                    <h3 style={{ margin: '0 0 6px' }}>Transcript</h3>
                    <p className="sub" style={{ margin: 0 }}>
                      Request{' '}
                      <span style={{ fontFamily: 'ui-monospace, monospace' }}>{transcriptDialogRow.requestId}</span>
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
                    <div
                      className="note"
                      style={{ whiteSpace: 'pre-wrap', color: 'var(--text)', maxHeight: 'none' }}
                    >
                      {transcriptText?.trim()
                        ? transcriptText
                        : 'No transcript text stored for this request yet.'}
                    </div>
                  ) : null}
                  <div className="list" style={{ marginTop: 16 }}>
                    <div className="list-item">
                      <div className="item-main">
                        <div className="avatar">IP</div>
                        <div>
                          <h4>Client IP</h4>
                          <p>{transcriptDialogRow.clientIp ?? 'Not captured'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="list-item">
                      <div className="item-main">
                        <div className="avatar">CC</div>
                        <div>
                          <h4>Country</h4>
                          <p>
                            {transcriptDialogRow.clientCountry ??
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
                          <p>{transcriptDialogRow.roomName ?? '—'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="list-item">
                      <div className="item-main">
                        <div className="avatar">PR</div>
                        <div>
                          <h4>Provider call</h4>
                          <p style={{ wordBreak: 'break-all' }}>{transcriptDialogRow.providerCallId ?? '—'}</p>
                        </div>
                      </div>
                    </div>
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
