'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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

type CallStatus = 'in_progress' | 'completed' | 'missed' | 'voicemail';
type CallOutcome =
  | 'booking_captured'
  | 'pricing_inquiry'
  | 'hours_inquiry'
  | 'general_inquiry'
  | 'follow_up_needed'
  | 'cancelled_request'
  | 'reschedule_request'
  | 'complaint'
  | 'wrong_number'
  | 'no_outcome';
type CallFilter = 'all' | 'follow_up' | 'high_urgency' | 'missed';

type Call = {
  id: string;
  shopId: string;
  callerPhone: string;
  callerName?: string;
  isRepeatCaller: boolean;
  forwardedTo?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  status: CallStatus;
  outcome: CallOutcome;
  bookingCaptured: boolean;
  bookingRequestId?: string;
  transcriptAvailable: boolean;
  transcriptUrl?: string;
  recordingUrl?: string;
  summary?: string;
  transcriptText?: string;
  followUpNeeded: boolean;
  highUrgency: boolean;
  urgencyReason?: string;
  provider?: string;
  providerCallId?: string;
  requestId?: string;
  transcriptStatus?: string;
  createdAt?: string;
  updatedAt?: string;
};

type CallsStats = {
  last7Days: number;
  bookings: number;
  followUp: number;
  missed: number;
  highUrgency: number;
};

export type CallsResponse = {
  ok: boolean;
  calls?: Call[];
  total?: number;
  stats?: CallsStats;
  shop?: { timezone?: string | null };
  pagination?: { page: number; limit?: number; pageSize?: number; total: number; totalPages?: number };
  summary?: { total: number; booked: number; missed: number; transcriptsReady?: number };
  error?: string;
};

export type IntentSummaryResponse = {
  ok: boolean;
  totalLast7Days?: number;
  bookingsCount?: number;
  followUpCount?: number;
  missedCount?: number;
};

const USER_CALLS_PAGE_SIZE = 25;
const EMPTY_STATS: CallsStats = { last7Days: 0, bookings: 0, followUp: 0, missed: 0, highUrgency: 0 };

function normalizeInitialStats(data?: CallsResponse | null, summary?: IntentSummaryResponse | null): CallsStats {
  if (data?.ok && data.stats) return data.stats;
  return {
    last7Days: summary?.ok ? summary.totalLast7Days ?? 0 : data?.summary?.total ?? 0,
    bookings: summary?.ok ? summary.bookingsCount ?? 0 : data?.summary?.booked ?? 0,
    followUp: summary?.ok ? summary.followUpCount ?? 0 : 0,
    missed: summary?.ok ? summary.missedCount ?? 0 : data?.summary?.missed ?? 0,
    highUrgency: data?.stats?.highUrgency ?? 0,
  };
}

function formatPhone(value?: string) {
  if (!value) return 'Unknown caller';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  if (value.length <= 4) return value;
  return `${value.slice(0, Math.min(3, value.length - 4))}•••${value.slice(-4)}`;
}

function callerAvatarGlyph(call: Call): string {
  const name = call.callerName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : parts[0]?.[1] ?? '';
    return `${first}${last}`.toUpperCase() || '??';
  }
  const digits = call.callerPhone?.replace(/\D/g, '') ?? '';
  return digits.length >= 2 ? digits.slice(-2) : '??';
}

function formatDuration(seconds?: number) {
  if (!seconds || seconds <= 0) return '';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes <= 0) return `${secs} sec`;
  if (secs <= 0) return `${minutes} min`;
  return `${minutes} min ${secs} sec`;
}

function outcomeMeta(outcome: CallOutcome) {
  const map: Record<CallOutcome, { label: string; className: string }> = {
    booking_captured: { label: '📅 Booking captured', className: 'calls-outcome calls-outcome--booking' },
    pricing_inquiry: { label: 'Pricing inquiry', className: 'calls-outcome' },
    hours_inquiry: { label: 'Hours inquiry', className: 'calls-outcome' },
    general_inquiry: { label: 'General inquiry', className: 'calls-outcome' },
    follow_up_needed: { label: '⚠ Follow-up needed', className: 'calls-outcome calls-outcome--followup' },
    cancelled_request: { label: 'Cancel request', className: 'calls-outcome' },
    reschedule_request: { label: 'Reschedule request', className: 'calls-outcome' },
    complaint: { label: '🔴 Complaint', className: 'calls-outcome calls-outcome--complaint' },
    wrong_number: { label: 'Wrong number', className: 'calls-outcome calls-outcome--muted' },
    no_outcome: { label: '—', className: 'calls-outcome calls-outcome--muted' },
  };
  return map[outcome] ?? map.no_outcome;
}

function statusMeta(status: CallStatus) {
  const map: Record<CallStatus, { label: string; className: string }> = {
    in_progress: { label: 'In progress', className: 'calls-status calls-status--progress' },
    completed: { label: 'Completed', className: 'calls-status calls-status--completed' },
    missed: { label: 'Missed', className: 'calls-status calls-status--missed' },
    voicemail: { label: 'Voicemail', className: 'calls-status calls-status--completed' },
  };
  return map[status] ?? map.completed;
}

function tabFromSearch(value: string | null): CallFilter {
  if (value === 'follow_up' || value === 'high_urgency' || value === 'missed') return value;
  return 'all';
}

function hasAnyStats(stats: CallsStats) {
  return stats.last7Days + stats.bookings + stats.followUp + stats.missed + stats.highUrgency > 0;
}

export function UserCallsLive({
  initialData = null,
  initialIntentSummary = null,
}: {
  initialData?: CallsResponse | null;
  initialIntentSummary?: IntentSummaryResponse | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const didUseInitialCalls = useRef(Boolean(initialData?.ok));
  const [calls, setCalls] = useState<Call[]>(initialData?.ok ? initialData.calls ?? [] : []);
  const [page, setPage] = useState(initialData?.pagination?.page ?? 1);
  const [totalCount, setTotalCount] = useState(initialData?.ok ? initialData.pagination?.total ?? initialData.total ?? 0 : 0);
  const [totalPages, setTotalPages] = useState(initialData?.ok ? initialData.pagination?.totalPages ?? 1 : 1);
  const [stats, setStats] = useState<CallsStats>(normalizeInitialStats(initialData, initialIntentSummary));
  const [activeFilter, setActiveFilter] = useState<CallFilter>(() => tabFromSearch(searchParams.get('tab')));
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(initialData && !initialData.ok ? initialData.error ?? 'unknown_error' : null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [shopTimezone, setShopTimezone] = useState<string>(getShopTimezone(initialData?.ok ? initialData.shop : null));

  useEffect(() => {
    const next = tabFromSearch(searchParams.get('tab'));
    setActiveFilter((current) => (current === next ? current : next));
  }, [searchParams]);

  useEffect(() => {
    if (didUseInitialCalls.current && activeFilter === 'all' && page === 1) {
      didUseInitialCalls.current = false;
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const query = new URLSearchParams();
    query.set('page', String(page));
    query.set('limit', String(USER_CALLS_PAGE_SIZE));
    if (activeFilter !== 'all') query.set('tab', activeFilter);
    void fetch(`/api/backend/user/calls?${query.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as CallsResponse;
        if (!body.ok) {
          setError(body.error ?? 'unknown_error');
          setCalls([]);
          setTotalCount(0);
          setTotalPages(1);
          return;
        }
        setCalls(body.calls ?? []);
        setShopTimezone(getShopTimezone(body.shop));
        setTotalCount(body.pagination?.total ?? body.total ?? 0);
        setTotalPages(body.pagination?.totalPages ?? Math.max(1, Math.ceil((body.pagination?.total ?? body.total ?? 0) / USER_CALLS_PAGE_SIZE)));
        setStats(body.stats ?? EMPTY_STATS);
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        setError('network_error');
        setCalls([]);
        setTotalCount(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [activeFilter, page]);

  function changeFilter(filter: CallFilter) {
    const query = new URLSearchParams(searchParams.toString());
    if (filter === 'all') query.delete('tab');
    else query.set('tab', filter);
    query.delete('page');
    setPage(1);
    setActiveFilter(filter);
    router.replace(query.toString() ? `/user/calls?${query.toString()}` : '/user/calls', { scroll: false });
  }

  async function openCall(call: Call) {
    setActiveCall(call);
    setShowTranscript(false);
    try {
      const res = await fetch(`/api/backend/user/calls/${encodeURIComponent(call.id)}`);
      const body = (await res.json()) as { ok: boolean; call?: Call };
      if (body.ok && body.call) setActiveCall(body.call);
    } catch {
      // Keep list data if detail fetch fails.
    }
  }

  function openBookingForCall(call: Call) {
    const id = call.bookingRequestId ?? call.id;
    router.push(`/user/bookings?callId=${encodeURIComponent(id)}`);
  }

  const tabs = useMemo(
    () => [
      { value: 'all' as const, label: 'All', count: 0 },
      { value: 'follow_up' as const, label: 'Follow up needed', count: stats.followUp },
      { value: 'high_urgency' as const, label: 'High urgency', count: stats.highUrgency },
      { value: 'missed' as const, label: 'Missed', count: stats.missed },
    ],
    [stats],
  );

  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <UserLayout styles={userCallsStyles} scripts={userCallsScripts} scriptPrefix="user-calls-live">
      <>
        <div className="app-shell user-app-shell">
          <UserPortalSidebar active="calls" />
          <main className="main">
            <UserPortalTopbar
              title="Calls"
              subtitle="Browse calls by outcome — open a transcript when you need the full text."
              actionsClassName={USER_PORTAL_TOPBAR_ACTIONS_CLASS}
              actions={<UserPortalStandardTopActions />}
            />

            <UserPortalPageContent pageClass="page-calls">
              {error ? <div className="calls-error">Unable to load calls: {error}</div> : null}

              {hasAnyStats(stats) ? (
                <section className="calls-metric-grid" aria-label="Call activity summary">
                  <div className="calls-metric-card"><span className="calls-stat-icon calls-stat-icon--blue">☎</span><div><p>This week</p><strong>{stats.last7Days}</strong></div></div>
                  <div className="calls-metric-card"><span className="calls-stat-icon calls-stat-icon--purple">▣</span><div><p>Bookings captured</p><strong>{stats.bookings}</strong></div></div>
                  <div className="calls-metric-card"><span className="calls-stat-icon calls-stat-icon--amber">⚠</span><div><p>Follow-up</p><strong>{stats.followUp}</strong></div></div>
                  <div className="calls-metric-card"><span className="calls-stat-icon calls-stat-icon--red">▢</span><div><p>Missed</p><strong>{stats.missed}</strong></div></div>
                </section>
              ) : null}

              <div className="calls-filter-bar">
                <div className="calls-filter-tabs" role="tablist" aria-label="Call filters">
                  {tabs.map((tab) => (
                    <button key={tab.value} type="button" role="tab" aria-selected={activeFilter === tab.value} className={`calls-filter-tab${activeFilter === tab.value ? ' active' : ''}`} onClick={() => changeFilter(tab.value)}>
                      {tab.label}
                      {tab.count > 0 ? <span>{`(${tab.count})`}</span> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="calls-list-card">
                {!loading && calls.length === 0 ? (
                  <div className="calls-empty">
                    <div className="calls-empty-icon">☎</div>
                    <h3>No calls yet</h3>
                    <p>Complete Go Live to start receiving calls on your business number.</p>
                    <a className="calls-empty-btn" href="/user/go-live">Complete Go Live →</a>
                  </div>
                ) : null}
                {loading && calls.length === 0 ? <div className="calls-empty"><p>Loading calls…</p></div> : null}
                {calls.length > 0 ? (
                  <>
                    <table className="calls-table calls-table-desktop">
                      <thead>
                        <tr>
                          <th>Caller</th>
                          <th>Date &amp; Time</th>
                          <th>Outcome</th>
                          <th>Status</th>
                          <th>Transcript</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calls.map((call) => {
                          const outcome = outcomeMeta(call.outcome);
                          const status = statusMeta(call.status);
                          const duration = formatDuration(call.durationSeconds);
                          return (
                            <tr key={call.id} className={`${call.highUrgency ? 'is-high-urgency' : ''}${call.followUpNeeded ? ' is-follow-up' : ''}`} onClick={() => void openCall(call)}>
                              <td>
                                <div className="calls-row-caller">
                                  <div className="calls-caller-avatar" aria-hidden>{callerAvatarGlyph(call)}</div>
                                  <div className="calls-caller-body">
                                    <div className="calls-caller-line1">
                                      <span className="calls-caller-phone">{formatPhone(call.callerPhone)}</span>
                                      {call.isRepeatCaller ? <span className="calls-repeat-badge">Repeat caller</span> : null}
                                    </div>
                                    {call.forwardedTo ? <div className="calls-caller-routed">Forwarded to {formatPhone(call.forwardedTo)}</div> : null}
                                  </div>
                                </div>
                              </td>
                              <td><div className="calls-table-datetime">{formatShopDate(call.startedAt, shopTimezone)} · {formatShopTime(call.startedAt, shopTimezone)}{duration ? <span>{duration}</span> : null}</div></td>
                              <td>
                                {call.bookingCaptured ? (
                                  <button className={`${outcome.className} calls-outcome-link`} type="button" onClick={(event) => { event.stopPropagation(); openBookingForCall(call); }}>{outcome.label}</button>
                                ) : (
                                  <span className={outcome.className}>{outcome.label}</span>
                                )}
                              </td>
                              <td><span className={status.className}>{status.label}</span></td>
                              <td>
                                {call.transcriptAvailable ? (
                                  <button className="calls-transcript-view-btn" type="button" onClick={(event) => { event.stopPropagation(); void openCall(call); }}>View</button>
                                ) : (
                                  <span className="calls-transcript-pending">Pending</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="mobile-calls">
                      {calls.map((call) => {
                        const outcome = outcomeMeta(call.outcome);
                        const status = statusMeta(call.status);
                        return (
                          <button type="button" className={`mobile-call-card${call.highUrgency ? ' is-high-urgency' : ''}${call.followUpNeeded ? ' is-follow-up' : ''}`} key={call.id} onClick={() => void openCall(call)}>
                            <div className="mobile-call-top">
                              <div className="calls-row-caller">
                                <div className="calls-caller-avatar" aria-hidden>{callerAvatarGlyph(call)}</div>
                                <div className="calls-caller-body">
                                  <span className="calls-caller-phone">{formatPhone(call.callerPhone)}</span>
                                  <span className="calls-caller-routed">{formatShopDate(call.startedAt, shopTimezone)} · {formatShopTime(call.startedAt, shopTimezone)}</span>
                                </div>
                              </div>
                              <span className={status.className}>{status.label}</span>
                            </div>
                            <div className="mobile-call-tags">
                              {call.bookingCaptured ? (
                                <span className={`${outcome.className} calls-outcome-link`} role="link" tabIndex={0} onClick={(event) => { event.stopPropagation(); openBookingForCall(call); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); openBookingForCall(call); } }}>{outcome.label}</span>
                              ) : (
                                <span className={outcome.className}>{outcome.label}</span>
                              )}
                              {call.transcriptAvailable ? <span className="calls-outcome">Transcript ready</span> : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>

              {totalPages > 1 ? (
                <div className="calls-pagination">
                  <button type="button" className="calls-pager-btn" disabled={!canGoPrev || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Previous</button>
                  <span>Page {page} of {totalPages}</span>
                  <button type="button" className="calls-pager-btn" disabled={!canGoNext || loading} onClick={() => setPage((p) => p + 1)}>Next →</button>
                </div>
              ) : null}
            </UserPortalPageContent>
          </main>
        </div>
        <UserPortalMobileTabbar active="calls" />

        {activeCall ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="transcript-preview-title" onClick={() => setActiveCall(null)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <div className="modal-title">
                  <h3 id="transcript-preview-title">Call details</h3>
                  <p>{formatPhone(activeCall.callerPhone)} · {formatShopDateTime(activeCall.startedAt, shopTimezone)}</p>
                </div>
                <button className="calls-pager-btn" type="button" onClick={() => setActiveCall(null)}>Close</button>
              </div>
              <div className="modal-meta">
                <div className="meta-tile"><strong>Outcome</strong><span>{outcomeMeta(activeCall.outcome).label}</span></div>
                <div className="meta-tile"><strong>Status</strong><span>{statusMeta(activeCall.status).label}</span></div>
                <div className="meta-tile"><strong>Duration</strong><span>{formatDuration(activeCall.durationSeconds) || '—'}</span></div>
                <div className="meta-tile"><strong>Forwarded to</strong><span>{activeCall.forwardedTo ? formatPhone(activeCall.forwardedTo) : '—'}</span></div>
              </div>
              {activeCall.summary ? <div className="summary-panel">{activeCall.summary}</div> : null}
              <div className="transcript-toggle">
                <button className="calls-pager-btn" type="button" onClick={() => setShowTranscript((value) => !value)}>
                  {showTranscript ? 'Hide transcript ↑' : 'Show transcript ↓'}
                </button>
              </div>
              {showTranscript ? <div className="transcript-note">{activeCall.transcriptText?.trim() || 'Transcript is not available yet.'}</div> : null}
            </div>
          </div>
        ) : null}
      </>
    </UserLayout>
  );
}
