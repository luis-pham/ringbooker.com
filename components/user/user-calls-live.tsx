'use client';

import { useEffect, useMemo, useState } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { userCallsScripts, userCallsStyles } from '@/components/user/user-calls';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';

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
  summaryServiceRequest?: string | null;
  summaryUrgency?: 'low' | 'medium' | 'high' | null;
  summaryNextAction?:
    | 'booking_created'
    | 'booking_link_sent'
    | 'callback_scheduled'
    | 'cancellation_requested'
    | 'reschedule_requested'
    | 'info_provided'
    | 'escalated'
    | 'no_action_needed'
    | null;
  summaryCallerQuestion?: string | null;
  summaryCallerName?: string | null;
  summaryPreferredTech?: string | null;
  summaryPreferredDatetime?: string | null;
  summaryFollowUpRequired?: boolean;
};

const USER_CALLS_PAGE_SIZE = 20;

type CallsSummary = {
  total: number;
  booked: number;
  missed: number;
  transcriptsReady: number;
};

type IntentSummary = {
  totalLast7Days: number;
  bookingsCount: number;
  followUpCount: number;
  missedCount: number;
};

type CallFilter = 'all' | 'follow_up_needed' | 'high_urgency' | 'bookings' | 'missed';

type CallsResponse = {
  ok: boolean;
  calls?: Call[];
  pagination?: { page: number; pageSize: number; total: number };
  summary?: CallsSummary;
  error?: string;
};

type IntentSummaryResponse = {
  ok: boolean;
  totalLast7Days?: number;
  bookingsCount?: number;
  followUpCount?: number;
  missedCount?: number;
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



function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    booking_created: '✓ Booking created',
    booking_link_sent: 'Link sent',
    cancellation_requested: 'Cancel requested',
    reschedule_requested: 'Reschedule needed',
    callback_scheduled: 'Callback scheduled',
    info_provided: 'Info provided',
    escalated: 'Escalated',
  };
  return labels[action] || action;
}

function getBadgeStyle(action: string): { background: string; color: string } {
  const styles: Record<string, { background: string; color: string }> = {
    booking_created: { background: '#dcfce7', color: '#16a34a' },
    booking_link_sent: { background: '#dbeafe', color: '#1d4ed8' },
    cancellation_requested: { background: '#fed7aa', color: '#c2410c' },
    reschedule_requested: { background: '#fed7aa', color: '#c2410c' },
    callback_scheduled: { background: '#ede9fe', color: '#7c3aed' },
    info_provided: { background: '#f1f5f9', color: '#475569' },
    escalated: { background: '#fee2e2', color: '#dc2626' },
  };
  return styles[action] || { background: '#f1f5f9', color: '#475569' };
}

function nextActionBadge(action?: Call['summaryNextAction']) {
  switch (action) {
    case 'booking_created':
      return { className: 'summary-badge green', label: 'Booking created ✓' };
    case 'booking_link_sent':
      return { className: 'summary-badge blue', label: 'Link sent' };
    case 'cancellation_requested':
      return { className: 'summary-badge orange', label: 'Cancel requested' };
    case 'reschedule_requested':
      return { className: 'summary-badge orange', label: 'Reschedule needed' };
    case 'callback_scheduled':
      return { className: 'summary-badge purple', label: 'Callback scheduled' };
    case 'info_provided':
      return { className: 'summary-badge gray', label: 'Info only' };
    case 'escalated':
      return { className: 'summary-badge red', label: 'Escalated' };
    default:
      return null;
  }
}

function urgencyBadge(urgency?: Call['summaryUrgency']) {
  if (urgency === 'high') return { className: 'summary-badge red', label: 'Urgent ⚠️' };
  if (urgency === 'medium') return { className: 'summary-badge blue', label: 'Medium priority' };
  return null;
}

function hasStructuredSummary(call: Call) {
  return Boolean(
    call.summaryServiceRequest ||
      call.summaryCallerQuestion ||
      call.summaryCallerName ||
      call.summaryPreferredTech ||
      call.summaryPreferredDatetime ||
      call.summaryFollowUpRequired ||
      urgencyBadge(call.summaryUrgency) ||
      nextActionBadge(call.summaryNextAction),
  );
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
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [summary, setSummary] = useState<CallsSummary | null>(null);
  const [intentSummary, setIntentSummary] = useState<IntentSummary>({
    totalLast7Days: 0,
    bookingsCount: 0,
    followUpCount: 0,
    missedCount: 0,
  });
  const [activeFilter, setActiveFilter] = useState<CallFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);


  function fetchSummary() {
    void fetch('/api/backend/user/calls/summary')
      .then(async (response) => {
        const body = (await response.json()) as IntentSummaryResponse;
        if (!body.ok) return;
        setIntentSummary({
          totalLast7Days: body.totalLast7Days ?? 0,
          bookingsCount: body.bookingsCount ?? 0,
          followUpCount: body.followUpCount ?? 0,
          missedCount: body.missedCount ?? 0,
        });
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    setCalls([]);
    const query = new URLSearchParams();
    if (page > 1) query.set('page', String(page));
    if (activeFilter !== 'all') query.set('filter', activeFilter);
    const url = query.toString() ? `/api/backend/user/calls?${query}` : '/api/backend/user/calls';
    void fetch(url)
      .then(async (response) => {
        const body = (await response.json()) as CallsResponse;
        if (!body.ok) {
          setError(body.error ?? 'unknown_error');
          setCalls([]);
          setTotalCount(null);
          setSummary(null);
          return;
        }
        setCalls(body.calls ?? []);
        const total = body.pagination?.total ?? body.calls?.length ?? 0;
        setTotalCount(total);
        setSummary(
          body.summary ?? {
            total,
            booked: 0,
            missed: 0,
            transcriptsReady: 0,
          },
        );
      })
      .catch(() => {
        setError('network_error');
        setCalls([]);
        setTotalCount(null);
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }, [page, activeFilter]);

  useEffect(() => {
    fetchSummary();
  }, []);

  const metrics = useMemo(() => {
    if (summary) return summary;
    return {
      total: 0,
      booked: 0,
      missed: 0,
      transcriptsReady: 0,
    };
  }, [summary]);

  const totalPages =
    totalCount === null ? 1 : Math.max(1, Math.ceil(totalCount / USER_CALLS_PAGE_SIZE));
  const canGoPrev = page > 1;
  const canGoNext = totalCount !== null && page * USER_CALLS_PAGE_SIZE < totalCount;


  async function markFollowUpDone(call: Call) {
    if (!call.requestId) return;
    const response = await fetch(`/api/backend/user/calls/${encodeURIComponent(call.requestId)}/follow-up-done`, {
      method: 'PATCH',
    });
    if (!response.ok) return;
    setCalls((items) =>
      items.map((item) =>
        item.requestId === call.requestId ? { ...item, summaryFollowUpRequired: false } : item,
      ),
    );
    setActiveCall((current) => {
      if (!current || current.requestId !== call.requestId) return current;
      return { ...current, summaryFollowUpRequired: false };
    });
    setIntentSummary((current) => ({
      ...current,
      followUpCount: Math.max(0, current.followUpCount - 1),
    }));
    fetchSummary();
  }



  function changeFilter(filter: CallFilter) {
    setActiveFilter(filter);
    setPage(1);
  }

  function renderCallIntent(call: Call) {
    const actionStyle = call.summaryNextAction ? getBadgeStyle(call.summaryNextAction) : null;
    return (
      <div className="intent-call-summary">
        <div className="intent-badges">
          {call.summaryUrgency === 'high' ? <span className="intent-chip urgent">Urgent ⚠️</span> : null}
          {call.summaryUrgency === 'medium' ? <span className="intent-chip medium">Medium priority</span> : null}
          {call.summaryNextAction && call.summaryNextAction !== 'no_action_needed' && actionStyle ? (
            <span className="intent-chip" style={actionStyle}>{getActionLabel(call.summaryNextAction)}</span>
          ) : null}
        </div>
        <div className="intent-fields">
          {call.summaryCallerName ? <span><span>Caller:</span>{call.summaryCallerName}</span> : null}
          {call.summaryServiceRequest ? <span><span>Service:</span>{call.summaryServiceRequest}</span> : null}
          {call.summaryPreferredDatetime ? <span><span>Wants:</span>{call.summaryPreferredDatetime}</span> : null}
          {call.summaryPreferredTech ? <span><span>With:</span>{call.summaryPreferredTech}</span> : null}
          {call.summaryCallerQuestion ? <span><span>Asked:</span>“{call.summaryCallerQuestion}”</span> : null}
        </div>
        {call.summaryFollowUpRequired ? (
          <div className="intent-follow-up">
            <span>⚠️ Follow up needed</span>
            <button type="button" onClick={() => void markFollowUpDone(call)}>Mark done</button>
          </div>
        ) : null}
      </div>
    );
  }

  const vipSignals = useMemo(() => buildVipSignals(calls), [calls]);

  const modalStyles = useMemo(
    () => [
      ...userCallsStyles,
      String.raw`

.intent-card-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:24px}
.intent-card{background:#fff;border:.5px solid #e5e7eb;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:4px}
.intent-card .intent-icon{font-size:18px}.intent-card .intent-number{font-size:28px;font-weight:800;letter-spacing:-.04em;color:var(--text-dark)}.intent-card .intent-label{font-size:13px;color:var(--text-gray)}
.intent-filter-tabs{display:flex;gap:4px;margin-bottom:16px;border-bottom:.5px solid var(--border);overflow-x:auto}
.intent-filter-tab{position:relative;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--text-gray);padding:10px 12px;font-size:13px;cursor:pointer;white-space:nowrap}
.intent-filter-tab.active{border-bottom-color:#7c3aed;color:#7c3aed;font-weight:600}.intent-filter-count{background:#dc2626;color:#fff;font-size:10px;font-weight:700;min-width:16px;height:16px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;margin-left:6px;padding:0 4px}
.intent-call-summary{margin-top:8px;display:flex;flex-direction:column;gap:8px}.intent-badges{display:flex;gap:6px;flex-wrap:wrap}.intent-chip{font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;background:#f1f5f9;color:#475569}.intent-chip.urgent{background:#fee2e2;color:#dc2626}.intent-chip.medium{background:#dbeafe;color:#1d4ed8}
.intent-fields{font-size:13px;color:var(--text-gray);display:flex;flex-direction:column;gap:2px}.intent-fields span span{color:var(--text-light);font-size:11px;margin-right:4px}
.intent-follow-up{background:#fef3c7;border:.5px solid #fde68a;border-radius:8px;padding:8px 12px;font-size:13px;color:#92400e;display:flex;justify-content:space-between;align-items:center;gap:10px}.intent-follow-up button{font-size:12px;color:#92400e;background:transparent;border:.5px solid #fde68a;border-radius:999px;padding:2px 10px;cursor:pointer;white-space:nowrap}
@media (max-width:860px){.intent-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.summary-grid{grid-template-columns:1fr}}
.calls-table-wrap{overflow:auto}
.calls-pagination{
  display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:12px;
  margin-top:16px;padding-top:16px;border-top:1px solid var(--border);
}
.calls-pagination .pager-meta{color:var(--text-gray);font-size:13px}
.calls-pagination .pager-actions{display:flex;align-items:center;gap:8px}
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

.summary-panel{border:1px solid var(--border);border-radius:18px;padding:14px 16px;background:#fff;margin-bottom:18px}
.summary-badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.summary-badge{display:inline-flex;align-items:center;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;line-height:1}
.summary-badge.green{background:#dcfce7;color:#15803d}.summary-badge.blue{background:#dbeafe;color:#1d4ed8}.summary-badge.orange{background:#ffedd5;color:#c2410c}.summary-badge.purple{background:#ede9fe;color:#6d28d9}.summary-badge.red{background:#fee2e2;color:#b91c1c}.summary-badge.gray{background:#f1f5f9;color:#475569}
.summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px;font-size:14px;line-height:1.5;color:var(--text-dark)}
.summary-grid .full{grid-column:1/-1}.summary-grid span{color:var(--text-gray);font-size:12px;margin-right:4px}
.follow-up-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;background:#fef3c7;border:.5px solid #fde68a;border-radius:12px;padding:8px 12px;font-size:13px;color:#92400e}
.follow-up-banner button{font-size:12px;color:#92400e;background:transparent;border:.5px solid #fde68a;border-radius:999px;padding:3px 10px;cursor:pointer;white-space:nowrap}
.transcript-toggle{display:flex;justify-content:flex-start;margin-bottom:10px}
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
      <>
      <div className="app-shell user-app-shell">
        <UserPortalSidebar active="calls" />

        <main className="main">
          <UserPortalTopbar
            title="Calls, transcripts, and missed revenue recovery."
            subtitle="See the full call list first, then open transcript preview only for the calls that need a closer look."
            actions={<><span className="btn">Realtime call log</span><span className="btn purple">{metrics.transcriptsReady} transcripts ready</span></>}
          />

          {error ? <div className="note" style={{ marginBottom: 18 }}>Unable to load calls: {error}</div> : null}


          <section className="intent-card-grid" aria-label="Call intent summary">
            <div className="intent-card">
              <span className="intent-icon">📞</span>
              <span className="intent-number">{intentSummary.totalLast7Days}</span>
              <span className="intent-label">Calls this week</span>
            </div>
            <div className="intent-card" style={{ borderColor: '#16a34a' }}>
              <span className="intent-icon">✓</span>
              <span className="intent-number" style={{ color: '#16a34a' }}>{intentSummary.bookingsCount}</span>
              <span className="intent-label">Bookings captured</span>
            </div>
            <div className="intent-card" style={{ borderColor: intentSummary.followUpCount > 0 ? '#f59e0b' : '#e5e7eb' }}>
              <span className="intent-icon">⚠️</span>
              <span className="intent-number" style={{ color: intentSummary.followUpCount > 0 ? '#f59e0b' : 'var(--text-dark)' }}>{intentSummary.followUpCount}</span>
              <span className="intent-label">Follow up needed</span>
            </div>
            <div className="intent-card" style={{ borderColor: intentSummary.missedCount > 0 ? '#dc2626' : '#e5e7eb' }}>
              <span className="intent-icon">📵</span>
              <span className="intent-number" style={{ color: intentSummary.missedCount > 0 ? '#dc2626' : 'var(--text-dark)' }}>{intentSummary.missedCount}</span>
              <span className="intent-label">Missed</span>
            </div>
          </section>

          <section className="grid grid-4">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span className="tag purple">Total</span></div><div className="stat-value">{metrics.total}</div><div className="stat-meta">Recent calls in your workspace</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4.5A8 8 0 1 1 21 12Z" /></svg></div><span className="tag green">Booked</span></div><div className="stat-value">{metrics.booked}</div><div className="stat-meta">Calls that turned into bookings</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z" /><path d="M4 8l8 6 8-6" /></svg></div><span className="tag orange">Missed</span></div><div className="stat-value">{metrics.missed}</div><div className="stat-meta">Calls worth recovering with callback or SMS</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></div><span className="tag blue">Ready</span></div><div className="stat-value">{metrics.transcriptsReady}</div><div className="stat-meta">Calls with transcript ready to review</div></div>
          </section>

          <section className="card" style={{ marginTop: 18 }}>

            <div className="intent-filter-tabs" role="tablist" aria-label="Call filters">
              {(['all', 'follow_up_needed', 'high_urgency', 'bookings', 'missed'] as CallFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === filter}
                  className={`intent-filter-tab${activeFilter === filter ? ' active' : ''}`}
                  onClick={() => changeFilter(filter)}
                >
                  {filter === 'all' ? 'All' : null}
                  {filter === 'follow_up_needed' ? 'Follow up needed' : null}
                  {filter === 'high_urgency' ? 'High urgency' : null}
                  {filter === 'bookings' ? 'Bookings' : null}
                  {filter === 'missed' ? 'Missed' : null}
                  {filter === 'follow_up_needed' && intentSummary.followUpCount > 0 ? (
                    <span className="intent-filter-count">{intentSummary.followUpCount > 9 ? '9+' : intentSummary.followUpCount}</span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="panel-head">
              <div>
                <h3>Call list</h3>
                <p className="sub">Desktop stays focused on the full list. Open transcript preview only when needed.</p>
              </div>
              <span className="badge-right">Transcript modal</span>
            </div>

            {!error && !loading && totalCount === 0 ? (
              <div className="note">No calls have been recorded for this business yet.</div>
            ) : !error && totalCount !== null && totalCount > 0 ? (
              <>
                {loading && calls.length === 0 ? (
                  <div className="note" style={{ marginBottom: 14 }}>
                    Loading call list…
                  </div>
                ) : !loading && calls.length === 0 ? (
                  <div className="note" style={{ marginBottom: 14 }}>
                    No calls on this page. Try another page.
                  </div>
                ) : null}
                {calls.length > 0 ? (
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
                                  {renderCallIntent(call)}
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
                                {hasStructuredSummary(call) ? <span className="status-copy">Structured summary ready</span> : null}
                              </div>
                            </td>
                            <td>{speakerLabel(call)}</td>
                            <td>
                              <button className="btn ghost" type="button" onClick={() => { setActiveCall(call); setShowTranscript(false); }}>
                                Preview transcript
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                ) : null}

                {calls.length > 0 ? (
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
                          {hasStructuredSummary(call) ? <span className="tag green">Summary ready</span> : null}
                        </div>
                        {renderCallIntent(call)}
                        <div className="mobile-call-actions">
                          <button className="btn ghost" type="button" onClick={() => { setActiveCall(call); setShowTranscript(false); }}>
                            Preview transcript
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
                ) : null}

                <div className="calls-pagination">
                  <span className="pager-meta">
                    Page {page} of {totalPages}
                    {totalCount !== null ? ` · ${totalCount} total` : null}
                  </span>
                  <div className="pager-actions">
                    <button
                      className="btn ghost"
                      type="button"
                      disabled={!canGoPrev || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      disabled={!canGoNext || loading}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            ) : !error && loading && calls.length === 0 ? (
              <div className="note">Loading call list…</div>
            ) : null}
          </section>
        </main>
      </div>
      <UserPortalMobileTabbar active="calls" />

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


            {hasStructuredSummary(activeCall) ? (
              <div className="summary-panel">
                <div className="summary-badges">
                  {urgencyBadge(activeCall.summaryUrgency) ? (
                    <span className={urgencyBadge(activeCall.summaryUrgency)!.className}>
                      {urgencyBadge(activeCall.summaryUrgency)!.label}
                    </span>
                  ) : null}
                  {nextActionBadge(activeCall.summaryNextAction) ? (
                    <span className={nextActionBadge(activeCall.summaryNextAction)!.className}>
                      {nextActionBadge(activeCall.summaryNextAction)!.label}
                    </span>
                  ) : null}
                </div>
                <div className="summary-grid">
                  {activeCall.summaryCallerName ? <div><span>Caller:</span>{activeCall.summaryCallerName}</div> : null}
                  {activeCall.summaryServiceRequest ? <div><span>Service:</span>{activeCall.summaryServiceRequest}</div> : null}
                  {activeCall.summaryPreferredDatetime ? <div><span>Wants:</span>{activeCall.summaryPreferredDatetime}</div> : null}
                  {activeCall.summaryPreferredTech ? <div><span>With:</span>{activeCall.summaryPreferredTech}</div> : null}
                  {activeCall.summaryCallerQuestion ? <div className="full"><span>Asked:</span>“{activeCall.summaryCallerQuestion}”</div> : null}
                </div>
                {activeCall.summaryFollowUpRequired ? (
                  <div className="follow-up-banner">
                    <span>⚠️ Follow up needed</span>
                    <button type="button" onClick={() => void markFollowUpDone(activeCall)}>Mark done</button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="transcript-toggle">
              <button className="btn ghost" type="button" onClick={() => setShowTranscript((value) => !value)}>
                {showTranscript ? 'Hide transcript ↑' : 'Show transcript ↓'}
              </button>
            </div>

            {showTranscript ? (
            <div className="transcript-note">
              {activeCall.transcriptText
                ? activeCall.transcriptText
                : activeCall.transcriptStatus === 'completed'
                  ? 'Transcript is marked ready, but no transcript body was persisted for this call.'
                  : activeCall.transcriptStatus === 'failed'
                    ? 'Transcript generation failed for this call. Please inspect provider logs and retry if needed.'
                    : 'Transcript is still pending. Open this preview again after the realtime worker finishes persisting the full transcript.'}
            </div>
            ) : null}
          </div>
        </div>
      ) : null}
      </>
    </UserLayout>
  );
}
