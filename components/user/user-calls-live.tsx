'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { UserPortalPageContent } from '@/components/user/user-portal-page-content';
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

/** Desktop table avatar: initials from saved caller name when present, else last two digits of phone. */
function callerAvatarGlyph(call: Call): string {
  const rawName = call.summaryCallerName?.trim();
  if (rawName) {
    const parts = rawName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0][0];
      const b = parts[parts.length - 1][0];
      if (a && b) return `${a}${b}`.toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length === 1) {
      return `${parts[0][0]}?`.toUpperCase();
    }
  }
  const digits = call.callerPhone?.replace(/\D/g, '') ?? '';
  if (digits.length >= 2) return digits.slice(-2);
  const fallback = call.callerPhone ?? '?';
  return fallback.slice(-2).toUpperCase();
}

function callerKindBadge(call: Call, isVip: boolean): { label: string; className: string } {
  if (call.outcome === 'missed') return { label: 'Missed', className: 'calls-caller-kind calls-caller-kind--missed' };
  if (isVip) return { label: 'Repeat caller', className: 'calls-caller-kind calls-caller-kind--repeat' };
  return { label: 'New caller', className: 'calls-caller-kind calls-caller-kind--new' };
}

/** Visual-only pill mapping for the calls table status column (API outcome values unchanged). */
function outcomePillMeta(outcome?: string | null): { className: string; label: string } {
  if (outcome === 'missed') return { className: 'calls-status-pill calls-status-pill--missed', label: 'Missed' };
  if (outcome === 'booked') return { className: 'calls-status-pill calls-status-pill--captured', label: 'Captured' };
  if (outcome === 'error') return { className: 'calls-status-pill calls-status-pill--followup', label: 'Follow-up' };
  if (!outcome || outcome === 'in_progress') {
    return { className: 'calls-status-pill calls-status-pill--inprogress', label: 'In progress' };
  }
  return { className: 'calls-status-pill calls-status-pill--inprogress', label: formatOutcomeLabel(outcome) };
}

function formatOutcomeLabel(outcome?: string | null) {
  if (outcome === 'booked') return 'Booked';
  if (outcome === 'missed') return 'Missed';
  if (outcome === 'error') return 'Needs review';
  if (outcome === 'in_progress' || !outcome) return 'In progress';
  return outcome.replace(/_/g, ' ');
}

function transcriptStatusLabel(call: Call) {
  if (call.transcriptStatus === 'completed') return 'Ready';
  if (call.transcriptStatus === 'failed') return 'Failed';
  return 'Pending';
}

/** Longer status line for mobile cards (matches portal tone). */
function transcriptStatusLine(status?: string) {
  if (status === 'completed') return 'Transcript ready';
  if (status === 'failed') return 'Transcript failed';
  return 'Transcript pending';
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
  if (call.humanAnswered) return 'AI with human handoff';
  if (call.agentJoined) return 'AI handled call';
  return 'No AI session';
}



function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    booking_created: 'Booking created',
    booking_link_sent: 'Booking link sent',
    cancellation_requested: 'Cancellation requested',
    reschedule_requested: 'Reschedule requested',
    callback_scheduled: 'Callback scheduled',
    info_provided: 'Information only',
    escalated: 'Escalated',
    no_action_needed: 'No action required',
  };
  return labels[action] ?? action.replace(/_/g, ' ');
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
      return { className: 'tag green', label: 'Booking created' };
    case 'booking_link_sent':
      return { className: 'tag blue', label: 'Booking link sent' };
    case 'cancellation_requested':
      return { className: 'tag orange', label: 'Cancellation requested' };
    case 'reschedule_requested':
      return { className: 'tag orange', label: 'Reschedule requested' };
    case 'callback_scheduled':
      return { className: 'tag purple', label: 'Callback scheduled' };
    case 'info_provided':
      return { className: 'tag gray', label: 'Information only' };
    case 'escalated':
      return { className: 'tag red', label: 'Escalated' };
    default:
      return null;
  }
}

function urgencyBadge(urgency?: Call['summaryUrgency']) {
  if (urgency === 'high') return { className: 'tag red', label: 'High priority' };
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

  const callsFilterTablistRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = callsFilterTablistRef.current;
    if (!root) return;
    const activeEl = root.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    activeEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeFilter]);

  function renderCallIntent(call: Call) {
    const urgency = urgencyBadge(call.summaryUrgency);
    return (
      <div className="intent-call-summary">
        <div className="intent-badges">
          {urgency ? <span className={urgency.className}>{urgency.label}</span> : null}
          {call.summaryNextAction && call.summaryNextAction !== 'no_action_needed' ? (
            <span className={nextActionTagClass(call.summaryNextAction)}>{getActionLabel(call.summaryNextAction)}</span>
          ) : null}
        </div>
        <div className="intent-fields">
          {call.summaryCallerName ? (
            <span>
              <span>Caller</span>
              {call.summaryCallerName}
            </span>
          ) : null}
          {call.summaryServiceRequest ? (
            <span>
              <span>Service</span>
              {call.summaryServiceRequest}
            </span>
          ) : null}
          {call.summaryPreferredDatetime ? (
            <span>
              <span>Preferred time</span>
              {call.summaryPreferredDatetime}
            </span>
          ) : null}
          {call.summaryPreferredTech ? (
            <span>
              <span>Preferred provider</span>
              {call.summaryPreferredTech}
            </span>
          ) : null}
          {call.summaryCallerQuestion ? (
            <span>
              <span>Question</span>
              “{call.summaryCallerQuestion}”
            </span>
          ) : null}
        </div>
        {call.summaryFollowUpRequired ? (
          <div className="intent-follow-up">
            <span>Follow-up required</span>
            <button type="button" onClick={() => void markFollowUpDone(call)}>
              Mark done
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const vipSignals = useMemo(() => buildVipSignals(calls), [calls]);

  return (
    <UserLayout styles={userCallsStyles} scripts={userCallsScripts} scriptPrefix="user-calls-live">
      <>
      <div className="app-shell user-app-shell">
        <UserPortalSidebar active="calls" />

        <main className="main">
          <UserPortalTopbar
            title="Calls, transcripts, and missed revenue recovery."
            subtitle={`Browse calls by outcome, then open a transcript when you need the full text.${metrics.transcriptsReady > 0 ? ` ${metrics.transcriptsReady} transcript${metrics.transcriptsReady === 1 ? '' : 's'} ready to review.` : ''}`}
            actionsClassName={USER_PORTAL_TOPBAR_ACTIONS_CLASS}
            actions={<UserPortalStandardTopActions />}
          />

          <UserPortalPageContent pageClass="page-calls">
          {error ? <div className="note" style={{ marginBottom: 18 }}>Unable to load calls: {error}</div> : null}


          <section className="calls-metric-grid" aria-label="Call activity summary">
            <div className="calls-metric-card">
              <div className="bst-label">Last 7 days</div>
              <div className="bst-value">{intentSummary.totalLast7Days}</div>
              <div className="bst-meta">Inbound calls in this rolling window</div>
            </div>
            <div className="calls-metric-card">
              <div className="bst-label">Bookings</div>
              <div className="bst-value">{intentSummary.bookingsCount}</div>
              <div className="bst-meta">Calls with a booking outcome</div>
            </div>
            <div className="calls-metric-card">
              <div className="bst-label">Follow-up</div>
              <div className="bst-value">{intentSummary.followUpCount}</div>
              <div className="bst-meta">Needs staff action</div>
            </div>
            <div className="calls-metric-card">
              <div className="bst-label">Missed</div>
              <div className="bst-value">{intentSummary.missedCount}</div>
              <div className="bst-meta">Calls without a booking</div>
            </div>
          </section>

	          <div className="calls-filter-bar">
	            <div ref={callsFilterTablistRef} className="business-subtabs calls-filter-tabs" role="tablist" aria-label="Call filters">
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

          <div className="card calls-list-card">
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
                  <table className="table calls-table calls-table-desktop">
                    <thead>
                      <tr>
                        <th scope="col">Caller</th>
                        <th scope="col">Date &amp; Time</th>
                        <th scope="col">Status</th>
                        <th scope="col">Transcript</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calls.map((call) => {
                        const isVip = call.callerPhone ? vipSignals.get(call.callerPhone) === true : false;
                        const kind = callerKindBadge(call, isVip);
                        const statusPill = outcomePillMeta(call.outcome);
                        return (
                          <tr key={call.providerCallId}>
                            <td>
                              <div className="calls-row-caller">
                                <div className="calls-caller-avatar" aria-hidden>
                                  {callerAvatarGlyph(call)}
                                </div>
                                <div className="calls-caller-body">
                                  <div className="calls-caller-line1">
                                    <span className="calls-caller-phone">{formatPhone(call.callerPhone)}</span>
                                    <span className={kind.className}>{kind.label}</span>
                                  </div>
                                  <div className="calls-caller-routed">
                                    → {call.destinationPhone ? formatPhone(call.destinationPhone) : '—'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="calls-table-datetime">
                                {formatShopDate(call.startedAt, shopTimezone)} · {formatShopTime(call.startedAt, shopTimezone)}
                              </div>
                            </td>
                            <td>
                              <span className={statusPill.className}>{statusPill.label}</span>
                            </td>
                            <td>
                              <button
                                className="calls-transcript-view-btn"
                                type="button"
                                onClick={() => {
                                  setActiveCall(call);
                                  setShowTranscript(false);
                                }}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                          <span className={outcomeClass(call.outcome)}>{formatOutcomeLabel(call.outcome)}</span>
                        </div>
                        <div className="pill-row" style={{ marginTop: 12 }}>
                          {isVip ? <span className="tag purple">Repeat caller</span> : null}
                          <span className={transcriptClass(call.transcriptStatus)}>
                            {transcriptStatusLine(call.transcriptStatus)}
                          </span>
                          {hasStructuredSummary(call) ? <span className="tag green">Summary available</span> : null}
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
          </div>
          </UserPortalPageContent>
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
              <div className="meta-tile">
                <strong>Status</strong>
                <span>
                  {formatOutcomeLabel(activeCall.outcome)} · {transcriptStatusLine(activeCall.transcriptStatus)}
                </span>
              </div>
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
                  {activeCall.summaryCallerName ? (
                    <div>
                      <span>Caller</span>
                      {activeCall.summaryCallerName}
                    </div>
                  ) : null}
                  {activeCall.summaryServiceRequest ? (
                    <div>
                      <span>Service</span>
                      {activeCall.summaryServiceRequest}
                    </div>
                  ) : null}
                  {activeCall.summaryPreferredDatetime ? (
                    <div>
                      <span>Preferred time</span>
                      {activeCall.summaryPreferredDatetime}
                    </div>
                  ) : null}
                  {activeCall.summaryPreferredTech ? (
                    <div>
                      <span>Preferred provider</span>
                      {activeCall.summaryPreferredTech}
                    </div>
                  ) : null}
                  {activeCall.summaryCallerQuestion ? (
                    <div className="full">
                      <span>Question</span>
                      “{activeCall.summaryCallerQuestion}”
                    </div>
                  ) : null}
                </div>
                {activeCall.summaryFollowUpRequired ? (
                  <div className="follow-up-banner">
                    <span>Follow-up required</span>
                    <button type="button" onClick={() => void markFollowUpDone(activeCall)}>
                      Mark done
                    </button>
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
