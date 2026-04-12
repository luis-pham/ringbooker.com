'use client';

import { useEffect, useMemo, useState } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { userCallsScripts, userCallsStyles } from '@/components/user/user-calls';

type Call = {
  provider: string;
  providerCallId: string;
  callerPhone?: string;
  destinationPhone?: string;
  startedAt?: string;
  endedAt?: string;
  outcome?: string;
  transcriptStatus?: string;
  transcriptText?: string;
  requestId?: string;
  roomName?: string;
  agentJoined: boolean;
  humanAnswered: boolean;
};

type CallsResponse = {
  ok: boolean;
  calls?: Call[];
  error?: string;
};

function formatDate(value?: string) {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(value?: string) {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDateTime(value?: string) {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString();
}

function formatPhone(value?: string) {
  if (!value) return 'Unknown';
  if (value.length <= 4) return value;
  return `${value.slice(0, Math.min(3, value.length - 4))}•••${value.slice(-4)}`;
}

function transcriptStatusLabel(call: Call) {
  if (call.transcriptStatus === 'completed') return 'Ready';
  if (call.transcriptStatus === 'failed') return 'Failed';
  return 'Pending';
}

function outcomeClass(outcome?: string) {
  if (outcome === 'booked') return 'tag green';
  if (outcome === 'missed') return 'tag orange';
  if (outcome === 'error') return 'tag red';
  return 'tag purple';
}

function transcriptClass(status?: string) {
  if (status === 'completed') return 'tag green';
  if (status === 'failed') return 'tag red';
  return 'tag purple';
}

function speakerLabel(call: Call) {
  if (call.humanAnswered) return 'AI + human handoff';
  if (call.agentJoined) return 'AI handled';
  return 'Agent not joined';
}

function buildVipSignals(calls: Call[]) {
  const counts = new Map<string, number>();
  for (const call of calls) {
    if (!call.callerPhone) continue;
    counts.set(call.callerPhone, (counts.get(call.callerPhone) ?? 0) + 1);
  }

  return new Map<string, boolean>(
    Array.from(counts.entries()).map(([phone, count]) => [phone, count >= 3]),
  );
}

export function UserCallsLive() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);

  useEffect(() => {
    void fetch('/api/backend/user/calls')
      .then(async (response) => {
        const body = (await response.json()) as CallsResponse;
        if (!body.ok) {
          setError(body.error ?? 'unknown_error');
          return;
        }
        setCalls(body.calls ?? []);
      })
      .catch(() => setError('network_error'));
  }, []);

  const metrics = useMemo(() => {
    return {
      total: calls.length,
      booked: calls.filter((call) => call.outcome === 'booked').length,
      missed: calls.filter((call) => call.outcome === 'missed').length,
      transcriptsReady: calls.filter((call) => call.transcriptStatus === 'completed').length,
    };
  }, [calls]);

  const vipSignals = useMemo(() => buildVipSignals(calls), [calls]);

  const modalStyles = useMemo(
    () => [
      ...userCallsStyles,
      String.raw`
.calls-table-wrap{overflow:auto}
.calls-table td:last-child,.calls-table th:last-child{text-align:right}
.calls-table .subline{margin-top:4px;color:var(--text-gray);font-size:12px;line-height:1.5}
.calls-table .stack{display:flex;flex-direction:column;gap:6px}
.calls-table .pill-row{display:flex;flex-wrap:wrap;gap:8px}
.calls-table .name-row{display:flex;align-items:center;gap:10px;min-width:0}
.calls-table .mini-avatar{
  width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#ede9fe,#ddd6fe);
  display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--purple-dark);flex-shrink:0;
}
.calls-table .value-strong{font-weight:700;color:var(--text-dark)}
.calls-table .status-copy{color:var(--text-gray);font-size:12px;line-height:1.5}
.modal-backdrop{
  position:fixed;inset:0;background:rgba(17,24,39,.58);backdrop-filter:blur(8px);
  display:flex;align-items:center;justify-content:center;padding:24px;z-index:160;
}
.modal-card{
  width:min(920px,100%);max-height:min(88vh,920px);overflow:auto;background:#fff;border:1px solid var(--border);
  border-radius:28px;box-shadow:0 24px 80px rgba(17,24,39,.18);padding:24px;
}
.modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}
.modal-title h3{margin:0;font-size:24px;letter-spacing:-.03em}
.modal-title p{margin:8px 0 0;color:var(--text-gray);font-size:13px;line-height:1.6}
.modal-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:18px}
.meta-tile{
  border:1px solid var(--border);border-radius:18px;padding:14px 16px;background:linear-gradient(180deg,#fff 0%,#fcfbff 100%);
}
.meta-tile strong{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-light);margin-bottom:7px}
.meta-tile span{display:block;font-size:14px;color:var(--text-dark);line-height:1.6}
.transcript-note{
  background:#fff;border:1px solid var(--border);border-radius:22px;padding:18px 18px 20px;white-space:pre-wrap;
  font-size:14px;line-height:1.7;color:var(--text-dark);
}
.mobile-calls{display:none}
@media (max-width:860px){
  .desktop-calls{display:none}
  .mobile-calls{display:flex;flex-direction:column;gap:14px}
  .mobile-call-card{
    border:1px solid var(--border);border-radius:22px;padding:16px;background:#fff;box-shadow:var(--shadow-soft);
  }
  .mobile-call-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .mobile-call-card h4{margin:0;font-size:15px;letter-spacing:-.02em}
  .mobile-call-meta{margin-top:6px;color:var(--text-gray);font-size:12.5px;line-height:1.6}
  .mobile-call-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
  .modal-backdrop{padding:12px}
  .modal-card{padding:18px;border-radius:22px}
  .modal-head{flex-direction:column}
  .modal-meta{grid-template-columns:1fr}
}
      `,
    ],
    [],
  );

  return (
    <UserLayout styles={modalStyles} scripts={userCallsScripts} scriptPrefix="user-calls-live">
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-inner">
            <div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#fff" stroke="none" /></svg></div></div><span>RingBooker</span></div>
            <div className="workspace"><h3>Calls workspace</h3><p>Review outcomes fast, then open a transcript only when you need to inspect the details.</p></div>
            <div className="nav-section"><div className="nav-label">User Portal</div><div className="nav-list"><a className="nav-item" href="/user"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={4} width={7} height={7} rx="1.5" /><rect x={14} y={4} width={7} height={4} rx="1.5" /><rect x={14} y={11} width={7} height={9} rx="1.5" /><rect x={3} y={14} width={7} height={6} rx="1.5" /></svg></div><span>Overview</span></a><a className="nav-item" href="/user/bookings"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span>Bookings</span></a><a className="nav-item active" href="/user/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span>Calls &amp; Transcripts</span></a><a className="nav-item" href="/user/settings"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" /></svg></div><span>Settings</span></a><a className="nav-item" href="/user/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /><path d="M7 15h4" /></svg></div><span>Billing</span></a></div></div>
            <div className="sidebar-spacer" />
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Calls, transcripts, and missed revenue recovery.</h1>
              <p>See the full call list first, then open transcript preview only for the calls that need a closer look.</p>
            </div>
            <div className="top-actions">
              <span className="btn">Realtime call log</span>
              <span className="btn purple">{metrics.transcriptsReady} transcripts ready</span>
            </div>
          </div>

          {error ? <div className="note" style={{ marginBottom: 18 }}>Unable to load calls: {error}</div> : null}

          <section className="grid grid-4">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span className="tag purple">Total</span></div><div className="stat-value">{metrics.total}</div><div className="stat-meta">Recent calls in your workspace</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4.5A8 8 0 1 1 21 12Z" /></svg></div><span className="tag green">Booked</span></div><div className="stat-value">{metrics.booked}</div><div className="stat-meta">Calls that turned into bookings</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z" /><path d="M4 8l8 6 8-6" /></svg></div><span className="tag orange">Missed</span></div><div className="stat-value">{metrics.missed}</div><div className="stat-meta">Calls worth recovering with callback or SMS</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></div><span className="tag blue">Ready</span></div><div className="stat-value">{metrics.transcriptsReady}</div><div className="stat-meta">Calls with transcript ready to review</div></div>
          </section>

          <section className="card" style={{ marginTop: 18 }}>
            <div className="panel-head">
              <div>
                <h3>Call list</h3>
                <p className="sub">Desktop stays focused on the full list. Open transcript preview only when needed.</p>
              </div>
              <span className="badge-right">Transcript modal</span>
            </div>

            {calls.length === 0 ? (
              <div className="note">No calls have been recorded for this shop yet.</div>
            ) : (
              <>
                <div className="desktop-calls calls-table-wrap">
                  <table className="table calls-table">
                    <thead>
                      <tr>
                        <th>Caller</th>
                        <th>VIP</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Handler</th>
                        <th>Transcript</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calls.map((call) => {
                        const isVip = call.callerPhone ? vipSignals.get(call.callerPhone) === true : false;
                        return (
                          <tr key={call.providerCallId}>
                            <td>
                              <div className="name-row">
                                <div className="mini-avatar">{(call.callerPhone ?? '?').slice(-2).toUpperCase()}</div>
                                <div className="stack">
                                  <span className="value-strong">{formatPhone(call.callerPhone)}</span>
                                  <span className="subline">{call.destinationPhone ? `To ${formatPhone(call.destinationPhone)}` : call.providerCallId}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={isVip ? 'tag purple' : 'tag blue'}>{isVip ? 'VIP signal' : 'Standard'}</span>
                            </td>
                            <td>{formatDate(call.startedAt)}</td>
                            <td>{formatTime(call.startedAt)}</td>
                            <td>
                              <div className="stack">
                                <span className={outcomeClass(call.outcome)}>{call.outcome ?? 'in_progress'}</span>
                                <span className="status-copy">{transcriptStatusLabel(call)} transcript</span>
                              </div>
                            </td>
                            <td>{speakerLabel(call)}</td>
                            <td>
                              <button className="btn ghost" type="button" onClick={() => setActiveCall(call)}>
                                Preview transcript
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-calls">
                  {calls.map((call) => {
                    const isVip = call.callerPhone ? vipSignals.get(call.callerPhone) === true : false;
                    return (
                      <article className="mobile-call-card" key={call.providerCallId}>
                        <div className="mobile-call-top">
                          <div>
                            <h4>{formatPhone(call.callerPhone)}</h4>
                            <div className="mobile-call-meta">
                              {formatDate(call.startedAt)} at {formatTime(call.startedAt)}
                              <br />
                              {speakerLabel(call)}
                            </div>
                          </div>
                          <span className={outcomeClass(call.outcome)}>{call.outcome ?? 'in_progress'}</span>
                        </div>
                        <div className="pill-row" style={{ marginTop: 12 }}>
                          <span className={isVip ? 'tag purple' : 'tag blue'}>{isVip ? 'VIP signal' : 'Standard'}</span>
                          <span className={transcriptClass(call.transcriptStatus)}>{transcriptStatusLabel(call)} transcript</span>
                        </div>
                        <div className="mobile-call-actions">
                          <button className="btn ghost" type="button" onClick={() => setActiveCall(call)}>
                            Preview transcript
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </main>
      </div>

      {activeCall ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="transcript-preview-title" onClick={() => setActiveCall(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">
                <h3 id="transcript-preview-title">Transcript preview</h3>
                <p>{formatPhone(activeCall.callerPhone)} · {formatDateTime(activeCall.startedAt)}</p>
              </div>
              <button className="btn ghost" type="button" onClick={() => setActiveCall(null)}>
                Close
              </button>
            </div>

            <div className="modal-meta">
              <div className="meta-tile"><strong>Caller</strong><span>{formatPhone(activeCall.callerPhone)}</span></div>
              <div className="meta-tile"><strong>Destination</strong><span>{formatPhone(activeCall.destinationPhone)}</span></div>
              <div className="meta-tile"><strong>Status</strong><span>{activeCall.outcome ?? 'in_progress'} · {transcriptStatusLabel(activeCall)} transcript</span></div>
              <div className="meta-tile"><strong>Handled by</strong><span>{speakerLabel(activeCall)}</span></div>
            </div>

            <div className="transcript-note">
              {activeCall.transcriptText
                ? activeCall.transcriptText
                : activeCall.transcriptStatus === 'completed'
                  ? 'Transcript is marked ready, but no transcript body was persisted for this call.'
                  : activeCall.transcriptStatus === 'failed'
                    ? 'Transcript generation failed for this call. Please inspect provider logs and retry if needed.'
                    : 'Transcript is still pending. Open this preview again after the realtime worker finishes persisting the full transcript.'}
            </div>
          </div>
        </div>
      ) : null}
    </UserLayout>
  );
}
