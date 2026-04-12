'use client';

import { useEffect, useMemo, useState } from 'react';

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
  };
  error?: string;
};

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

export function AdminCallsLive(props: { initialShopId?: string | null }) {
  const shopId = props.initialShopId ?? null;
  const [calls, setCalls] = useState<Call[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [filterLabel, setFilterLabel] = useState<string | null>(null);

  useEffect(() => {
    const query = shopId ? `?shopId=${encodeURIComponent(shopId)}` : '';
    void fetch(`/api/backend/admin/calls${query}`)
      .then(async (response) => {
        const body = (await response.json()) as CallsResponse;
        if (!body.ok) {
          setError(body.error ?? 'unable_to_load');
          return;
        }
        setCalls(body.calls ?? []);
        setActiveCall((body.calls ?? [])[0] ?? null);
        setFilterLabel(body.filter?.shopName ?? null);
      })
      .catch(() => setError('network_error'));
  }, [shopId]);

  const metrics = useMemo(() => {
    return {
      total: calls.length,
      booked: calls.filter((call) => call.outcome === 'booked').length,
      missed: calls.filter((call) => call.outcome === 'missed').length,
      readyTranscript: calls.filter((call) => call.transcriptStatus === 'completed').length,
    };
  }, [calls]);

  return (
    <AdminLayout styles={adminCallsStyles} scripts={adminCallsScripts} scriptPrefix="admin-calls-live" bodyClass="app-body">
      <div className="app-shell">
        <aside className="sidebar"><div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></div></div><span>RingBooker Admin</span></div><div className="nav-label">Backoffice</div><div className="nav-list"><a className="nav-item " href="/admin"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" /></svg></div><span>Overview</span></a><a className="nav-item " href="/admin/shops"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 10l2-5h14l2 5" /><path d="M4 10h16v10H4z" /><path d="M9 20v-6h6v6" /></svg></div><span>Shops</span></a><a className="nav-item active" href="/admin/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" /></svg></div><span>Calls &amp; Incidents</span></a><a className="nav-item " href="/admin/demos"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg></div><span>Demo calls</span></a><a className="nav-item " href="/admin/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span>Billing</span></a><a className="nav-item " href="/admin/users"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy={7} r={3} /><path d="M20 8v6" /><path d="M17 11h6" /></svg></div><span>Users &amp; Roles</span></a><a className="nav-item " href="/admin/system-health"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span>System Health</span></a></div></aside>
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Calls and incidents.</h1>
              <p>{filterLabel ? `Showing calls for ${filterLabel}.` : 'Review network-wide call outcomes, then open transcript preview on the right.'}</p>
            </div>
            <div className="top-actions">
              {shopId ? <a className="btn" href="/admin/calls">Clear filter</a> : null}
              {shopId ? <a className="btn purple" href={`/admin/shops/${encodeURIComponent(shopId)}`}>Back to shop</a> : null}
            </div>
          </div>

          {error ? <div className="note" style={{ marginBottom: 18 }}>Unable to load calls: {error}</div> : null}

          <section className="grid grid-4">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" /></svg></div><span className="tag blue">Loaded</span></div><div className="stat-value">{metrics.total}</div><div className="stat-meta">Calls in the current view</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" /></svg></div><span className="tag green">Booked</span></div><div className="stat-value">{metrics.booked}</div><div className="stat-meta">Calls that ended in a booking</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span className="tag orange">Missed</span></div><div className="stat-value">{metrics.missed}</div><div className="stat-meta">Missed or dropped calls worth checking</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></div><span className="tag purple">Previewable</span></div><div className="stat-value">{metrics.readyTranscript}</div><div className="stat-meta">Calls marked with transcript ready status</div></div>
          </section>

          <section className="call-grid" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="panel-head">
                <div>
                  <h3>Call list</h3>
                  <p className="sub">Click Transcript preview on any row to inspect the selected call in the side panel.</p>
                </div>
              </div>
              {calls.length === 0 ? (
                <div className="empty">No calls found for this filter yet.</div>
              ) : (
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
                      <tr key={`${call.shopId}:${call.providerCallId}`}>
                        <td>
                          <div>
                            <strong>{call.shopName ?? call.shopId}</strong>
                            <div className="sub" style={{ marginTop: 4 }}>{call.callerPhone ?? 'Unknown caller'} · {call.providerCallId}</div>
                          </div>
                        </td>
                        <td>{formatDateTime(call.startedAt)}</td>
                        <td>
                          <span className={callStatusClass(call)}>{call.outcome ?? 'in_progress'}</span>
                        </td>
                        <td>{call.agentJoined ? 'AI joined' : 'Waiting'}{call.humanAnswered ? ' · human answered' : ''}</td>
                        <td>
                          <button className="btn ghost" type="button" onClick={() => setActiveCall(call)}>
                            Transcript preview
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card soft">
              <div className="panel-head">
                <div>
                  <h3>Transcript preview</h3>
                  <p className="sub">Selected call metadata and transcript state for fast QA review.</p>
                </div>
              </div>
              {!activeCall ? (
                <div className="empty">Choose a call from the table to preview transcript state.</div>
              ) : (
                <div className="list">
                  <div className="list-item"><div className="item-main"><div className="avatar">SH</div><div><h4>{activeCall.shopName ?? activeCall.shopId}</h4><p>{activeCall.callerPhone ?? 'Unknown caller'} to {activeCall.destinationPhone ?? 'unknown destination'}</p></div></div></div>
                  <div className="list-item"><div className="item-main"><div className="avatar">AT</div><div><h4>Started</h4><p>{formatDateTime(activeCall.startedAt)}</p></div></div><span className={callStatusClass(activeCall)}>{activeCall.outcome ?? 'in_progress'}</span></div>
                  <div className="list-item"><div className="item-main"><div className="avatar">TX</div><div><h4>{transcriptStatusLabel(activeCall)}</h4><p>Request ID {activeCall.requestId ?? 'n/a'} · Room {activeCall.roomName ?? 'n/a'}</p></div></div></div>
                  <div className="note">
                    {activeCall.transcriptText
                      ? <div style={{ whiteSpace: 'pre-wrap' }}>{activeCall.transcriptText}</div>
                      : activeCall.transcriptStatus === 'completed'
                      ? 'Transcript is marked ready, but no transcript body was persisted for this call.'
                      : activeCall.transcriptStatus === 'failed'
                        ? 'Transcript generation failed for this call. Re-run or inspect provider logs before QA review.'
                        : 'Transcript is still pending or has not been persisted yet for this call. The preview panel is wired, so once transcript storage is enabled it will surface here.'}
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </AdminLayout>
  );
}
