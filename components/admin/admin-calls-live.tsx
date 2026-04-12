'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AdminLayout } from '@/components/admin/admin-layout';
import { adminCallsScripts, adminCallsStyles } from '@/components/admin/admin-calls';

type Call = {
  provider: string;
  providerCallId: string;
  shopId: string;
  shopName?: string;
  callerPhone?: string;
  destinationPhone?: string;
  requestId?: string;
  roomName?: string;
  startedAt?: string;
  endedAt?: string;
  agentJoined: boolean;
  humanAnswered: boolean;
  transcriptStatus?: string;
  transcriptText?: string;
  outcome?: string;
};

type CallsResponse = {
  ok: boolean;
  calls?: Call[];
  filter?: {
    shopId?: string | null;
    shopName?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  };
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

function formatDateTime(value?: string) {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString();
}

function callStatusClass(call: Call) {
  if (call.outcome === 'missed') return 'tag orange';
  if (call.outcome === 'error') return 'tag red';
  if (call.outcome === 'booked') return 'tag green';
  return 'tag blue';
}

function transcriptStatusLabel(call: Call) {
  if (call.transcriptStatus === 'completed') return 'Transcript ready';
  if (call.transcriptStatus === 'failed') return 'Transcript failed';
  return 'Transcript pending';
}

function callDialogKey(call: Call): string {
  return `${call.shopId}:${call.provider}:${call.providerCallId}`;
}

export function AdminCallsLive(props: { initialShopId?: string | null }) {
  const shopId = props.initialShopId ?? null;
  const [dateFrom, setDateFrom] = useState(() => utcDaysAgoIso(30));
  const [dateTo, setDateTo] = useState(() => utcTodayIso());
  const [appliedFrom, setAppliedFrom] = useState(() => utcDaysAgoIso(30));
  const [appliedTo, setAppliedTo] = useState(() => utcTodayIso());
  const [calls, setCalls] = useState<Call[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [transcriptDialogCall, setTranscriptDialogCall] = useState<Call | null>(null);
  const transcriptDialogRef = useRef<HTMLDialogElement>(null);

  const load = useCallback(
    async (from: string, to: string) => {
      const qs = new URLSearchParams();
      qs.set('dateFrom', from);
      qs.set('dateTo', to);
      if (shopId) qs.set('shopId', shopId);
      void fetch(`/api/backend/admin/calls?${qs.toString()}`)
        .then(async (response) => {
          const body = (await response.json()) as CallsResponse;
          if (!body.ok) {
            setError(body.error ?? 'unable_to_load');
            setCalls([]);
            return;
          }
          setError(null);
          setCalls(body.calls ?? []);
          setFilterLabel(body.filter?.shopName ?? null);
        })
        .catch(() => {
          setError('network_error');
          setCalls([]);
        });
    },
    [shopId],
  );

  useEffect(() => {
    void load(appliedFrom, appliedTo);
  }, [appliedFrom, appliedTo, load]);

  useEffect(() => {
    const el = transcriptDialogRef.current;
    if (!el) return;
    if (transcriptDialogCall) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [transcriptDialogCall]);

  function applyFilters() {
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
  }

  const chartDaily = useMemo(() => {
    const map = new Map<string, number>();
    for (const call of calls) {
      const day = call.startedAt?.slice(0, 10);
      if (!day) continue;
      map.set(day, (map.get(day) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, count }));
  }, [calls]);

  const chartMax = useMemo(() => {
    let max = 1;
    for (const d of chartDaily) max = Math.max(max, d.count);
    return max;
  }, [chartDaily]);

  const metrics = useMemo(() => {
    return {
      total: calls.length,
      booked: calls.filter((call) => call.outcome === 'booked').length,
      missed: calls.filter((call) => call.outcome === 'missed').length,
      readyTranscript: calls.filter((call) => call.transcriptStatus === 'completed').length,
    };
  }, [calls]);

  async function signOut() {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  return (
    <AdminLayout styles={adminCallsStyles} scripts={adminCallsScripts} scriptPrefix="admin-calls-live" bodyClass="app-body">
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">
              <div className="brand-ripple r3" />
              <div className="brand-ripple r2" />
              <div className="brand-core">
                <svg viewBox="0 0 24 24">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
              </div>
            </div>
            <span>RingBooker Admin</span>
          </div>
          <div className="nav-label">Backoffice</div>
          <div className="nav-list">
            <a className="nav-item " href="/admin">
              <div className="nav-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" />
                </svg>
              </div>
              <span>Overview</span>
            </a>
            <a className="nav-item " href="/admin/shops">
              <div className="nav-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M3 10l2-5h14l2 5" />
                  <path d="M4 10h16v10H4z" />
                  <path d="M9 20v-6h6v6" />
                </svg>
              </div>
              <span>Shops</span>
            </a>
            <a className="nav-item active" href="/admin/calls">
              <div className="nav-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" />
                </svg>
              </div>
              <span>Calls &amp; Incidents</span>
            </a>
            <a className="nav-item " href="/admin/demos">
              <div className="nav-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <span>Demo calls</span>
            </a>
            <a className="nav-item " href="/admin/billing">
              <div className="nav-icon">
                <svg viewBox="0 0 24 24">
                  <rect x={3} y={5} width={18} height={14} rx={2} />
                  <path d="M3 10h18" />
                </svg>
              </div>
              <span>Billing</span>
            </a>
            <a className="nav-item " href="/admin/users">
              <div className="nav-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                  <circle cx="9.5" cy={7} r={3} />
                  <path d="M20 8v6" />
                  <path d="M17 11h6" />
                </svg>
              </div>
              <span>Users &amp; Roles</span>
            </a>
            <a className="nav-item " href="/admin/system-health">
              <div className="nav-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M3 12h4l2-5 4 10 2-5h6" />
                </svg>
              </div>
              <span>System Health</span>
            </a>
          </div>
        </aside>
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Calls and incidents.</h1>
              <p>
                {filterLabel
                  ? `Showing calls for ${filterLabel} in the selected UTC date range.`
                  : 'Filter by UTC date range, review outcomes, and open transcripts in a dialog when needed.'}
              </p>
            </div>
            <div className="top-actions">
              <a className="btn" href="/admin/demos">
                Demo calls
              </a>
              {shopId ? <a className="btn" href="/admin/calls">Clear shop filter</a> : null}
              {shopId ? (
                <a className="btn purple" href={`/admin/shops/${encodeURIComponent(shopId)}`}>
                  Back to shop
                </a>
              ) : null}
              <button type="button" className="btn ghost" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </div>

          <section className="card soft" style={{ marginBottom: 18 }}>
            <div className="panel-head">
              <div>
                <h3>Date range (UTC)</h3>
                <p className="sub">Applies to call start time in the call log.</p>
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
              Unable to load calls: {error}
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
                <span className="tag blue">Loaded</span>
              </div>
              <div className="stat-value">{metrics.total}</div>
              <div className="stat-meta">Calls in the current view</div>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" />
                  </svg>
                </div>
                <span className="tag green">Booked</span>
              </div>
              <div className="stat-value">{metrics.booked}</div>
              <div className="stat-meta">Calls that ended in a booking</div>
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
              <div className="stat-meta">Missed or dropped calls worth checking</div>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <span className="tag purple">Ready</span>
              </div>
              <div className="stat-value">{metrics.readyTranscript}</div>
              <div className="stat-meta">Calls with transcript status completed</div>
            </div>
          </section>

          <section className="card" style={{ marginTop: 18 }}>
            <div className="panel-head">
              <div>
                <h3>Daily volume</h3>
                <p className="sub">Calls per UTC day in the loaded range (based on started time).</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 140, padding: '8px 0 4px' }}>
              {chartDaily.length === 0 ? (
                <p className="sub" style={{ margin: 0 }}>
                  No dated starts in this view.
                </p>
              ) : (
                chartDaily.map((d) => {
                  const h = Math.max(8, Math.round((d.count / chartMax) * 120));
                  return (
                    <div
                      key={d.day}
                      title={`${d.day}: ${d.count} calls`}
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
                          background: 'linear-gradient(180deg, rgba(59,130,246,.85), rgba(37,99,235,.35))',
                          border: '1px solid rgba(59,130,246,.35)',
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
                <h3>Call list</h3>
                <p className="sub">Use View transcript to open the full transcript for that call.</p>
              </div>
            </div>
            {calls.length === 0 ? (
              <div className="empty">No calls found for this filter yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Call</th>
                      <th>Started</th>
                      <th>Status</th>
                      <th>Booker</th>
                      <th>Transcript</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map((call) => (
                      <tr key={callDialogKey(call)}>
                        <td>
                          <div>
                            <strong>{call.shopName ?? call.shopId}</strong>
                            <div className="sub" style={{ marginTop: 4 }}>
                              {call.callerPhone ?? 'Unknown caller'} · {call.providerCallId}
                            </div>
                          </div>
                        </td>
                        <td>{formatDateTime(call.startedAt)}</td>
                        <td>
                          <span className={callStatusClass(call)}>{call.outcome ?? 'in_progress'}</span>
                        </td>
                        <td>
                          {call.agentJoined ? 'AI joined' : 'Waiting'}
                          {call.humanAnswered ? ' · human answered' : ''}
                        </td>
                        <td>
                          <button type="button" className="btn ghost" onClick={() => setTranscriptDialogCall(call)}>
                            View transcript
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <dialog
            ref={transcriptDialogRef}
            className="rb-admin-modal"
            onClose={() => setTranscriptDialogCall(null)}
          >
            {transcriptDialogCall ? (
              <>
                <div className="rb-admin-modal-head">
                  <div>
                    <h3 style={{ margin: '0 0 6px' }}>Transcript</h3>
                    <p className="sub" style={{ margin: 0 }}>
                      {transcriptDialogCall.shopName ?? transcriptDialogCall.shopId} ·{' '}
                      {transcriptDialogCall.callerPhone ?? 'Unknown caller'}
                    </p>
                  </div>
                  <button type="button" className="btn ghost" onClick={() => transcriptDialogRef.current?.close()}>
                    Close
                  </button>
                </div>
                <div className="rb-admin-modal-body">
                  <div className="list" style={{ marginBottom: 16 }}>
                    <div className="list-item">
                      <div className="item-main">
                        <div className="avatar">AT</div>
                        <div>
                          <h4>Started</h4>
                          <p>{formatDateTime(transcriptDialogCall.startedAt)}</p>
                        </div>
                      </div>
                      <span className={callStatusClass(transcriptDialogCall)}>
                        {transcriptDialogCall.outcome ?? 'in_progress'}
                      </span>
                    </div>
                    <div className="list-item">
                      <div className="item-main">
                        <div className="avatar">TX</div>
                        <div>
                          <h4>{transcriptStatusLabel(transcriptDialogCall)}</h4>
                          <p>
                            Request ID {transcriptDialogCall.requestId ?? 'n/a'} · Room{' '}
                            {transcriptDialogCall.roomName ?? 'n/a'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="note" style={{ whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                    {transcriptDialogCall.transcriptText ? (
                      transcriptDialogCall.transcriptText
                    ) : transcriptDialogCall.transcriptStatus === 'completed' ? (
                      'Transcript is marked ready, but no transcript body was persisted for this call.'
                    ) : transcriptDialogCall.transcriptStatus === 'failed' ? (
                      'Transcript generation failed for this call. Re-run or inspect provider logs before QA review.'
                    ) : (
                      'Transcript is still pending or has not been persisted yet for this call.'
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
