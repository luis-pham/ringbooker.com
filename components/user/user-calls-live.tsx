'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { userCallsScripts, userCallsStyles } from '@/components/user/user-calls';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import {
  USER_PORTAL_TOPBAR_ACTIONS_CLASS,
  UserPortalStandardTopActions,
} from '@/components/user/user-portal-standard-top-actions';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';
import { formatShopDate, formatShopDateTime, formatShopTime, getShopTimezone } from '@/src/shared/timezone';

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

export type CallsResponse = {
  ok: boolean;
  calls?: Call[];
  shop?: { timezone?: string | null };
  pagination?: { page: number; pageSize: number; total: number };
  summary?: CallsSummary;
  error?: string;
};

export type IntentSummaryResponse = {
  ok: boolean;
  totalLast7Days?: number;
  bookingsCount?: number;
  followUpCount?: number;
  missedCount?: number;
};

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

function nextActionTagClass(action: NonNullable<Call['summaryNextAction']>): string {
  switch (action) {
    case 'booking_created':
      return 'tag green';
    case 'booking_link_sent':
      return 'tag blue';
    case 'cancellation_requested':
    case 'reschedule_requested':
      return 'tag orange';
    case 'callback_scheduled':
      return 'tag purple';
    case 'info_provided':
      return 'tag gray';
    case 'escalated':
      return 'tag red';
    default:
      return 'tag purple';
  }
}

function nextActionBadge(action?: Call['summaryNextAction']) {
  switch (action) {
    case 'booking_created':
      return { className: 'tag green', label: 'Booking created ✓' };
    case 'booking_link_sent':
      return { className: 'tag blue', label: 'Link sent' };
    case 'cancellation_requested':
      return { className: 'tag orange', label: 'Cancel requested' };
    case 'reschedule_requested':
      return { className: 'tag orange', label: 'Reschedule needed' };
    case 'callback_scheduled':
      return { className: 'tag purple', label: 'Callback scheduled' };
    case 'info_provided':
      return { className: 'tag gray', label: 'Info only' };
    case 'escalated':
      return { className: 'tag red', label: 'Escalated' };
    default:
      return null;
  }
}

function urgencyBadge(urgency?: Call['summaryUrgency']) {
  if (urgency === 'high') return { className: 'tag red', label: 'Urgent ⚠️' };
  if (urgency === 'medium') return { className: 'tag blue', label: 'Medium priority' };
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

export function UserCallsLive({
  initialData = null,
  initialIntentSummary = null,
}: {
  initialData?: CallsResponse | null;
  initialIntentSummary?: IntentSummaryResponse | null;
}) {
  const didUseInitialCalls = useRef(Boolean(initialData?.ok));
  const [calls, setCalls] = useState<Call[]>(initialData?.ok ? initialData.calls ?? [] : []);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(
    initialData?.ok ? initialData.pagination?.total ?? initialData.calls?.length ?? 0 : null,
  );
  const [summary, setSummary] = useState<CallsSummary | null>(initialData?.ok ? initialData.summary ?? null : null);
  const [intentSummary, setIntentSummary] = useState<IntentSummary>({
    totalLast7Days: initialIntentSummary?.ok ? initialIntentSummary.totalLast7Days ?? 0 : 0,
    bookingsCount: initialIntentSummary?.ok ? initialIntentSummary.bookingsCount ?? 0 : 0,
    followUpCount: initialIntentSummary?.ok ? initialIntentSummary.followUpCount ?? 0 : 0,
    missedCount: initialIntentSummary?.ok ? initialIntentSummary.missedCount ?? 0 : 0,
  });
  const [activeFilter, setActiveFilter] = useState<CallFilter>('all');
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(initialData && !initialData.ok ? initialData.error ?? 'unknown_error' : null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [shopTimezone, setShopTimezone] = useState<string>(getShopTimezone(initialData?.ok ? initialData.shop : null));


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
    if (didUseInitialCalls.current) {
      didUseInitialCalls.current = false;
      return;
    }
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
        setShopTimezone(getShopTimezone(body.shop));
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
    if (initialIntentSummary?.ok) return;
    fetchSummary();
  }, [initialIntentSummary?.ok]);

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
    return (
      <div className="intent-call-summary">
        <div className="intent-badges">
          {call.summaryUrgency === 'high' ? <span className="tag red">Urgent ⚠️</span> : null}
          {call.summaryUrgency === 'medium' ? <span className="tag blue">Medium priority</span> : null}
          {call.summaryNextAction && call.summaryNextAction !== 'no_action_needed' ? (
            <span className={nextActionTagClass(call.summaryNextAction)}>{getActionLabel(call.summaryNextAction)}</span>
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

	.intent-card-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;margin-bottom:28px}
	.intent-card{background:var(--surface-card);border:1px solid var(--border);border-radius:18px;padding:28px 32px;display:flex;align-items:center;gap:22px;min-height:110px}
	.intent-card .intent-icon{width:68px;height:68px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#dbeafe;color:#0d1117}
	.intent-card .intent-icon svg{width:30px;height:30px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
	.intent-card.intent-card--bookings .intent-icon{background:#e8f1d8}
	.intent-card.intent-card--follow-up .intent-icon{background:#f6ead9}
	.intent-card.intent-card--missed .intent-icon{background:#f5e7e7}
	.intent-card .intent-number{display:block;font-size:42px;line-height:.9;font-weight:800;letter-spacing:-.06em;color:#000}
	.intent-card .intent-label{display:block;margin-top:8px;font-size:24px;line-height:1.05;font-weight:500;color:#3f3f3f;letter-spacing:-.04em}
	.calls-filter-bar{display:flex;align-items:center;gap:0;margin-bottom:32px;border-bottom:1px solid var(--border);overflow-x:auto}
	.business-subtabs.calls-filter-tabs{display:flex;gap:0;flex-wrap:nowrap;margin:0}
	.business-subtabs.calls-filter-tabs .business-subtab{
	  border:1px solid #c9c4bd;background:transparent;border-radius:14px;padding:18px 32px;
	  font-size:24px;font-weight:500;color:#111;cursor:pointer;font:inherit;white-space:nowrap;
	  margin:0 -1px -1px 0;box-shadow:none;transition:background .15s ease,border-color .15s ease,color .15s ease;
	}
	.business-subtabs.calls-filter-tabs .business-subtab:hover{background:#f9fafb;border-color:#bdb7af;color:#111}
	.business-subtabs.calls-filter-tabs .business-subtab.active{background:#0d1117;color:#fff;border-color:#0d1117;font-weight:600}
	.intent-filter-count{background:#dc2626;color:#fff;font-size:10px;font-weight:700;min-width:16px;height:16px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;margin-left:8px;padding:0 4px}
	.intent-call-summary{margin-top:8px;display:flex;flex-direction:column;gap:8px}.intent-badges{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
	.intent-fields{font-size:13px;color:var(--text-gray);display:flex;flex-direction:column;gap:2px}.intent-fields span span{color:var(--text-light);font-size:11px;margin-right:4px}
	.intent-follow-up{background:#fef3c7;border:.5px solid #fde68a;border-radius:8px;padding:8px 12px;font-size:13px;color:#92400e;display:flex;justify-content:space-between;align-items:center;gap:10px}.intent-follow-up button{font-size:12px;color:#92400e;background:transparent;border:.5px solid #fde68a;border-radius:999px;padding:2px 10px;cursor:pointer;white-space:nowrap}
	@media (max-width:860px){.intent-card-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.intent-card{padding:18px;min-height:auto}.intent-card .intent-icon{width:52px;height:52px}.intent-card .intent-number{font-size:30px}.intent-card .intent-label{font-size:17px}.business-subtabs.calls-filter-tabs .business-subtab{font-size:15px;padding:12px 16px}.summary-grid{grid-template-columns:1fr}}
	.calls-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:18px;background:var(--surface-card)}
	.calls-pagination{
	  display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:12px;
	  margin-top:16px;padding-top:16px;border-top:1px solid var(--border);
	}
	.calls-pagination .pager-meta{color:var(--text-gray);font-size:13px}
	.calls-pagination .pager-actions{display:flex;align-items:center;gap:8px}
	.calls-table{width:100%;border-collapse:separate;border-spacing:0}
	.calls-table th{padding:20px 28px;text-align:left;font-size:22px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:#3f3f3f;border-bottom:1px solid var(--border)}
	.calls-table td{padding:24px 28px;border-bottom:1px solid var(--border);vertical-align:middle;font-size:24px;color:#3f3f3f}
	.calls-table tbody tr:nth-child(even){background:#f6f4ef}
	.calls-table tbody tr:last-child td{border-bottom:0}
	.calls-table td:last-child,.calls-table th:last-child{text-align:right}
	.calls-table .subline{margin-top:4px;color:#3f3f3f;font-size:18px;line-height:1.3;font-weight:500}
	.calls-table .stack{display:flex;flex-direction:column;gap:6px}
	.calls-table .pill-row{display:flex;flex-wrap:wrap;gap:8px}
	.calls-table .name-row{display:flex;align-items:center;gap:10px;min-width:0}
	.calls-table .mini-avatar{
	  width:58px;height:58px;border-radius:999px;background:#dbeafe;
	  display:flex;align-items:center;justify-content:center;font-weight:800;color:#2b66b1;flex-shrink:0;font-size:20px;
	}
	.calls-table .value-strong{font-weight:800;color:#000;font-size:24px;letter-spacing:-.03em}
	.calls-table .status-copy{color:var(--text-gray);font-size:12px;line-height:1.5}
	.calls-table .vip-inline{margin-left:8px;color:#7c3aed;background:#f3ecff;border:0;font-size:18px;font-weight:800}
	.call-status-pill{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:999px;background:#f6ecd9;color:#5b4215;font-size:19px;font-weight:700;white-space:nowrap}
	.call-status-pill svg{width:18px;height:18px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
	.calls-table .transcript-view-btn{font-size:24px;padding:18px 32px;border-radius:14px;background:#fff;color:#000;border:1px solid #c9c4bd}
	.modal-backdrop{
  position:fixed;inset:0;background:rgba(17,24,39,.58);backdrop-filter:blur(8px);
  display:flex;align-items:center;justify-content:center;padding:24px;z-index:160;
}
.modal-card{
  width:min(920px,100%);max-height:min(88vh,920px);overflow:auto;background:var(--surface-card);border:1px solid var(--border);
  border-radius:28px;box-shadow:0 24px 80px rgba(17,24,39,.18);padding:24px;
}
.modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}
.modal-title h3{margin:0;font-size:24px;letter-spacing:-.03em}
.modal-title p{margin:8px 0 0;color:var(--text-gray);font-size:13px;line-height:1.6}
.modal-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:18px}
.meta-tile{
  border:1px solid var(--border);border-radius:18px;padding:14px 16px;background:var(--bg-gray);
}
.meta-tile strong{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-light);margin-bottom:7px}
.meta-tile span{display:block;font-size:14px;color:var(--text-dark);line-height:1.6}

.summary-panel{border:1px solid var(--border);border-radius:18px;padding:14px 16px;background:var(--bg-gray);margin-bottom:18px}
.summary-badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center}
.summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px;font-size:14px;line-height:1.5;color:var(--text-dark)}
.summary-grid .full{grid-column:1/-1}.summary-grid span{color:var(--text-gray);font-size:12px;margin-right:4px}
.follow-up-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;background:#fef3c7;border:.5px solid #fde68a;border-radius:12px;padding:8px 12px;font-size:13px;color:#92400e}
.follow-up-banner button{font-size:12px;color:#92400e;background:transparent;border:.5px solid #fde68a;border-radius:999px;padding:3px 10px;cursor:pointer;white-space:nowrap}
.transcript-toggle{display:flex;justify-content:flex-start;margin-bottom:10px}
.transcript-note{
  background:var(--bg-gray);border:1px solid var(--border);border-radius:22px;padding:18px 18px 20px;white-space:pre-wrap;
  font-size:14px;line-height:1.7;color:var(--text-dark);
}
.mobile-calls{display:none}
@media (max-width:860px){
  .desktop-calls{display:none}
  .mobile-calls{display:flex;flex-direction:column;gap:14px}
  .mobile-call-card{
    border:1px solid var(--border);border-radius:22px;padding:16px;background:var(--surface-card);box-shadow:var(--shadow-soft);
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
html[data-user-theme="dark"] .intent-filter-tab.active{color:#79c0ff;border-bottom-color:#79c0ff}
html[data-user-theme="dark"] .follow-up-banner{background:rgba(187,128,9,0.12);border-color:rgba(210,153,34,.35);color:#d29922}
html[data-user-theme="dark"] .follow-up-banner button{color:#d29922;border-color:rgba(210,153,34,.35)}
html[data-user-theme="dark"] .intent-follow-up{background:rgba(187,128,9,0.12);border-color:rgba(210,153,34,.35);color:#d29922}
html[data-user-theme="dark"] .intent-follow-up button{color:#d29922;border-color:rgba(210,153,34,.35)}
html[data-user-theme="dark"] .modal-card{box-shadow:0 24px 80px rgba(0,0,0,.55)}
html[data-user-theme="dark"] .meta-tile{background:#161b22}
html[data-user-theme="dark"] .summary-panel{background:#161b22}
html[data-user-theme="dark"] .transcript-note{background:#0d1117}
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
            subtitle={`See the full call list first, then open transcript preview only for the calls that need a closer look.${metrics.transcriptsReady > 0 ? ` ${metrics.transcriptsReady} transcript${metrics.transcriptsReady === 1 ? '' : 's'} ready to review.` : ''}`}
            actionsClassName={USER_PORTAL_TOPBAR_ACTIONS_CLASS}
            actions={<UserPortalStandardTopActions />}
          />

          {error ? <div className="note" style={{ marginBottom: 18 }}>Unable to load calls: {error}</div> : null}


	          <section className="intent-card-grid" aria-label="Call intent summary">
	            <div className="intent-card">
	              <span className="intent-icon">
	                <svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg>
	              </span>
	              <span><span className="intent-number">{intentSummary.totalLast7Days}</span><span className="intent-label">Calls this week</span></span>
	            </div>
	            <div className="intent-card intent-card--bookings">
	              <span className="intent-icon"><svg viewBox="0 0 24 24"><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="m8 15 2.5 2.5L16 12" /></svg></span>
	              <span><span className="intent-number">{intentSummary.bookingsCount}</span><span className="intent-label">Bookings captured</span></span>
	            </div>
	            <div className="intent-card intent-card--follow-up">
	              <span className="intent-icon"><svg viewBox="0 0 24 24"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg></span>
	              <span><span className="intent-number">{intentSummary.followUpCount}</span><span className="intent-label">Follow-up needed</span></span>
	            </div>
	            <div className="intent-card intent-card--missed">
	              <span className="intent-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.2 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.1 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72" /><path d="M15 9l6-6M21 9l-6-6" /></svg></span>
	              <span><span className="intent-number">{intentSummary.missedCount}</span><span className="intent-label">Missed</span></span>
	            </div>
	          </section>

	          <div className="calls-filter-bar">
	            <div className="business-subtabs calls-filter-tabs" role="tablist" aria-label="Call filters">
	              {(['all', 'follow_up_needed', 'high_urgency', 'bookings', 'missed'] as CallFilter[]).map((filter) => (
	                <button
	                  key={filter}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === filter}
	                  className={`business-subtab${activeFilter === filter ? ' active' : ''}`}
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
	          </div>

	          <section>
	
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
	                        <th>Date &amp; Time</th>
	                        <th>Status</th>
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
	                                  <span className="value-strong">
	                                    {formatPhone(call.callerPhone)}
	                                    {isVip ? <span className="tag purple vip-inline">VIP</span> : null}
	                                  </span>
	                                  <span className="subline">→ {call.destinationPhone ? formatPhone(call.destinationPhone) : call.providerCallId}</span>
	                                </div>
	                              </div>
	                            </td>
	                            <td>
	                              {formatShopDate(call.startedAt, shopTimezone)} · {formatShopTime(call.startedAt, shopTimezone)}
	                            </td>
	                            <td><span className="call-status-pill"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{call.outcome === 'booked' ? 'Booked' : call.outcome === 'missed' ? 'Missed' : call.outcome === 'error' ? 'Needs review' : 'In progress'}</span></td>
	                            <td>
	                              <button className="btn ghost transcript-view-btn" type="button" onClick={() => { setActiveCall(call); setShowTranscript(false); }}>
	                                View
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
                              {formatShopDate(call.startedAt, shopTimezone)} at {formatShopTime(call.startedAt, shopTimezone)}
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
                <p>{formatPhone(activeCall.callerPhone)} · {formatShopDateTime(activeCall.startedAt, shopTimezone)}</p>
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
