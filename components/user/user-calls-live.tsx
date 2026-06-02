'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  IconAlertTriangle,
  IconCalendarCheck,
  IconChartBar,
  IconFileDescription,
  IconHeadphones,
  IconPhoneCall,
  IconPhoneOff,
  IconLock,
} from '@tabler/icons-react';

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
  | 'booking_request'
  | 'booking_contacted'
  | 'booking_confirmed'
  | 'booking_cancel_pending'
  | 'booking_declined'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'booking_completed'
  | 'captured_call'
  | 'pricing_inquiry'
  | 'hours_inquiry'
  | 'general_inquiry'
  | 'follow_up_needed'
  | 'cancelled_request'
  | 'reschedule_request'
  | 'complaint'
  | 'no_response'
  | 'no_outcome';
type CallFilter = 'all' | 'follow_up' | 'high_urgency' | 'missed' | 'insights';

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
  recordingAvailable?: boolean;
  recordingStatus?: string;
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
  missedFollowupSmsSent?: boolean;
};

type CallsStats = {
  total: number;
  last7Days: number;
  bookings: number;
  followUp: number;
  missed: number;
  highUrgency: number;
};

type ShopLiveSummary = {
  timezone?: string | null;
  liveCallsEnabled?: boolean;
  goLiveAt?: string | null;
};

export type CallsResponse = {
  ok: boolean;
  calls?: Call[];
  total?: number;
  stats?: CallsStats;
  capabilities?: { call_recovery_insights?: boolean };
  shop?: ShopLiveSummary;
  pagination?: { page: number; limit?: number; pageSize?: number; total: number; totalPages?: number };
  summary?: { total: number; booked: number; missed: number; transcriptsReady?: number };
  error?: string;
};

type CallRecoveryInsights = {
  missedOpportunities: { percentage: number; trend: Array<{ date: string; count: number }> };
  topServices: Array<{ service: string; count: number; percentage: number }>;
  peakCallTimes: Array<{ hour: number; count: number }>;
};

export type IntentSummaryResponse = {
  ok: boolean;
  totalLast7Days?: number;
  bookingsCount?: number;
  followUpCount?: number;
  missedCount?: number;
};

const USER_CALLS_PAGE_SIZE = 25;
const EMPTY_STATS: CallsStats = { total: 0, last7Days: 0, bookings: 0, followUp: 0, missed: 0, highUrgency: 0 };

function normalizeInitialStats(data?: CallsResponse | null, summary?: IntentSummaryResponse | null): CallsStats {
  if (data?.ok && data.stats) {
    return {
      ...EMPTY_STATS,
      ...data.stats,
      total: data.stats.total ?? data.summary?.total ?? data.total ?? 0,
    };
  }
  return {
    total: data?.summary?.total ?? data?.total ?? 0,
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
    booking_request: { label: 'Appointment request', className: 'calls-outcome calls-outcome--booking' },
    booking_contacted: { label: 'Client contacted', className: 'calls-outcome calls-outcome--booking' },
    booking_confirmed: { label: 'Booking confirmed', className: 'calls-outcome calls-outcome--booking' },
    booking_cancel_pending: { label: 'Cancellation pending', className: 'calls-outcome calls-outcome--followup' },
    booking_declined: { label: 'Booking declined', className: 'calls-outcome calls-outcome--muted' },
    booking_cancelled: { label: 'Booking cancelled', className: 'calls-outcome calls-outcome--muted' },
    booking_rescheduled: { label: 'Booking rescheduled', className: 'calls-outcome calls-outcome--booking' },
    booking_completed: { label: 'Booking completed', className: 'calls-outcome calls-outcome--booking' },
    captured_call: { label: 'Captured call', className: 'calls-outcome' },
    pricing_inquiry: { label: 'Pricing inquiry', className: 'calls-outcome' },
    hours_inquiry: { label: 'Hours inquiry', className: 'calls-outcome' },
    general_inquiry: { label: 'General inquiry', className: 'calls-outcome' },
    follow_up_needed: { label: '⚠ Follow-up needed', className: 'calls-outcome calls-outcome--followup' },
    cancelled_request: { label: 'Cancel request', className: 'calls-outcome' },
    reschedule_request: { label: 'Reschedule request', className: 'calls-outcome' },
    complaint: { label: '🔴 Complaint', className: 'calls-outcome calls-outcome--complaint' },
    no_response: { label: 'No caller response', className: 'calls-outcome calls-outcome--muted' },
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
  if (value === 'follow_up' || value === 'high_urgency' || value === 'missed' || value === 'insights') return value;
  return 'all';
}

function callsEmptyState(filter: CallFilter, shopHasGoneLive: boolean, hasAnyCalls: boolean): { title: string; message: string; showGoLiveCta: boolean } {
  if (filter === 'follow_up') {
    return {
      title: 'No follow-ups needed',
      message: hasAnyCalls
        ? 'Calls that need owner follow-up will appear here.'
        : shopHasGoneLive
          ? 'Follow-up calls will appear here once customers start calling.'
          : 'Complete Go Live to start tracking calls that need follow-up.',
      showGoLiveCta: !shopHasGoneLive && !hasAnyCalls,
    };
  }
  if (filter === 'high_urgency') {
    return {
      title: 'No high urgency calls',
      message: hasAnyCalls
        ? 'Urgent complaints, cancellations, and priority follow-ups will appear here.'
        : shopHasGoneLive
          ? 'High urgency calls will appear here if a customer needs immediate attention.'
          : 'Complete Go Live to start tracking urgent calls.',
      showGoLiveCta: !shopHasGoneLive && !hasAnyCalls,
    };
  }
  if (filter === 'missed') {
    return {
      title: 'No missed calls',
      message: hasAnyCalls
        ? 'Missed or unanswered calls will appear here.'
        : shopHasGoneLive
          ? 'Missed calls will appear here if customers call when the AI cannot connect.'
          : 'Complete Go Live to start tracking missed calls.',
      showGoLiveCta: !shopHasGoneLive && !hasAnyCalls,
    };
  }
  return {
    title: 'No calls yet',
    message: shopHasGoneLive
      ? 'Your AI receptionist is active and ready. Calls will appear here once customers start calling.'
      : 'Complete Go Live to start receiving calls on your business number.',
    showGoLiveCta: !shopHasGoneLive,
  };
}

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? 'pm' : 'am';
  const displayed = hour % 12 || 12;
  return `${displayed}${suffix}`;
}

function InsightChartBars({ values, highlightIndex }: { values: number[]; highlightIndex?: number }) {
  const max = Math.max(1, ...values);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, minHeight: 62, marginTop: 18 }}>
      {values.map((count, index) => (
        <span
          key={`${index}:${count}`}
          title={`${count} calls`}
          style={{
            display: 'block',
            flex: 1,
            height: Math.max(5, Math.round((count / max) * 60)),
            background: index === highlightIndex ? 'var(--purple-dark)' : 'var(--border)',
            borderRadius: 6,
          }}
        />
      ))}
    </div>
  );
}

function CallRecoveryInsightsPanel({ insights }: { insights: CallRecoveryInsights }) {
  const visibleHours = insights.peakCallTimes.filter(({ hour }) => hour >= 8 && hour <= 22);
  const peak = visibleHours.reduce<{ hour: number; count: number } | null>(
    (best, item) => (!best || item.count > best.count ? item : best),
    null,
  );
  const visiblePeakIndex = peak ? visibleHours.findIndex(({ hour }) => hour === peak.hour) : -1;
  return (
    <section className="grid grid-3 calls-insights-grid" aria-label="Call recovery insights">
      <div className="card">
        <div className="panel-head">
          <div><h3>Missed opportunities</h3><p className="sub">Calls not captured</p></div>
        </div>
        {insights.missedOpportunities.percentage === 0 ? (
          <p className="sub">No missed calls this period 🎉</p>
        ) : (
          <>
            <div className="stat-value">{insights.missedOpportunities.percentage}%</div>
            <div className="stat-meta">of calls this billing period</div>
          </>
        )}
        <InsightChartBars values={insights.missedOpportunities.trend.map(({ count }) => count)} />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, marginTop: 8, fontSize: 10, color: 'var(--text-light)' }}>
          {insights.missedOpportunities.trend.map(({ date }) => <span key={date}>{date.slice(5)}</span>)}
        </div>
      </div>
      <div className="card">
        <div className="panel-head">
          <div><h3>Top requested services</h3><p className="sub">Demand this billing period</p></div>
        </div>
        {insights.topServices.length === 0 ? <p className="sub">Not enough data yet — check back after more calls</p> : (
          <div className="progress-list">
            {insights.topServices.map((item) => (
              <div className="progress-item" key={item.service}>
                <strong>{item.service}</strong>
                <div className="bar"><span style={{ width: `${item.percentage}%` }} /></div>
                <span>{item.percentage}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card">
        <div className="panel-head">
          <div><h3>Peak call times</h3><p className="sub">Volume by local hour</p></div>
        </div>
        {visibleHours.length === 0 || !peak || peak.count === 0 ? <p className="sub">Not enough data yet</p> : (
          <>
            <InsightChartBars values={visibleHours.map(({ count }) => count)} highlightIndex={visiblePeakIndex} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--text-light)' }}>
              <span>8am</span><span>3pm</span><span>10pm</span>
            </div>
            <p className="sub" style={{ marginTop: 18 }}>Busiest time: {hourLabel(peak.hour)} – {hourLabel((peak.hour + 1) % 24)}</p>
          </>
        )}
      </div>
    </section>
  );
}

function CallRecoveryInsightsUpsell() {
  const preview: CallRecoveryInsights = {
    missedOpportunities: { percentage: 18, trend: [1, 0, 2, 1, 3, 1, 2].map((count, index) => ({ date: `05-${18 + index}`, count })) },
    topServices: [
      { service: 'Haircut', count: 14, percentage: 42 },
      { service: 'Color', count: 9, percentage: 27 },
      { service: 'Blowout', count: 5, percentage: 15 },
    ],
    peakCallTimes: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hour === 17 ? 12 : hour >= 8 && hour <= 22 ? (hour % 5) + 2 : 0 })),
  };
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.58 }} aria-hidden="true">
        <CallRecoveryInsightsPanel insights={preview} />
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div className="modal-card" style={{ width: 'min(440px, 100%)', textAlign: 'center', padding: 28 }}>
          <span className="calls-stat-icon calls-stat-icon--purple" style={{ margin: '0 auto 14px' }}><IconChartBar size={26} stroke={2} /></span>
          <div className="modal-title"><h3>Call recovery insights</h3></div>
          <p className="sub" style={{ lineHeight: 1.6, margin: '10px 0 22px' }}>See missed opportunities, top requested services, and peak call times. Available on Professional.</p>
          <a className="btn user-save" href="/user/billing#upgrade">Upgrade to Professional</a>
          <p className="sub" style={{ margin: '14px 0 0' }}>$149/month · 14-day free trial</p>
        </div>
      </div>
    </div>
  );
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
  const callIdParam = searchParams.get('callId');
  const didUseInitialCalls = useRef(Boolean(initialData?.ok));
  const openedCallIdRef = useRef<string | null>(null);
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
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [useMobileCallsList, setUseMobileCallsList] = useState(false);
  const [shopTimezone, setShopTimezone] = useState<string>(getShopTimezone(initialData?.ok ? initialData.shop : null));
  const [shopLiveStatus, setShopLiveStatus] = useState(() => ({
    liveCallsEnabled: Boolean(initialData?.ok ? initialData.shop?.liveCallsEnabled : false),
    goLiveAt: initialData?.ok ? initialData.shop?.goLiveAt ?? null : null,
  }));
  const [canViewRecoveryInsights, setCanViewRecoveryInsights] = useState(Boolean(initialData?.capabilities?.call_recovery_insights));
  const [insights, setInsights] = useState<CallRecoveryInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const update = () => setUseMobileCallsList(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const next = callIdParam ? 'all' : tabFromSearch(searchParams.get('tab'));
    setActiveFilter((current) => (current === next ? current : next));
  }, [callIdParam, searchParams]);

  useEffect(() => {
    if (activeFilter === 'insights') {
      setLoading(false);
      return;
    }
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
        setCanViewRecoveryInsights(Boolean(body.capabilities?.call_recovery_insights));
        setShopTimezone(getShopTimezone(body.shop));
        setShopLiveStatus({
          liveCallsEnabled: Boolean(body.shop?.liveCallsEnabled),
          goLiveAt: body.shop?.goLiveAt ?? null,
        });
        setTotalCount(body.pagination?.total ?? body.total ?? 0);
        setTotalPages(body.pagination?.totalPages ?? Math.max(1, Math.ceil((body.pagination?.total ?? body.total ?? 0) / USER_CALLS_PAGE_SIZE)));
        setStats(normalizeInitialStats(body, null));
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

  useEffect(() => {
    if (activeFilter !== 'insights' || !canViewRecoveryInsights) return;
    const controller = new AbortController();
    setInsightsLoading(true);
    setInsightsError(null);
    void fetch('/api/backend/user/calls/insights', { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { ok?: boolean; error?: string } & Partial<CallRecoveryInsights>;
        if (!response.ok || !body.ok || !body.missedOpportunities || !body.topServices || !body.peakCallTimes) {
          setInsightsError(body.error ?? 'unable_to_load');
          return;
        }
        setInsights({
          missedOpportunities: body.missedOpportunities,
          topServices: body.topServices,
          peakCallTimes: body.peakCallTimes,
        });
      })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setInsightsError('network_error');
      })
      .finally(() => setInsightsLoading(false));
    return () => controller.abort();
  }, [activeFilter, canViewRecoveryInsights]);

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
    setRecordingUrl(null);
    setRecordingError(null);
    try {
      const res = await fetch(`/api/backend/user/calls/${encodeURIComponent(call.id)}`);
      const body = (await res.json()) as { ok: boolean; call?: Call };
      if (body.ok && body.call) setActiveCall(body.call);
    } catch {
      // Keep list data if detail fetch fails.
    }
  }

  useEffect(() => {
    if (!callIdParam || openedCallIdRef.current === callIdParam) return;
    openedCallIdRef.current = callIdParam;
    setActiveFilter('all');
    setPage(1);

    const existingCall = calls.find((call) =>
      call.id === callIdParam || call.requestId === callIdParam || call.providerCallId === callIdParam
    );
    const clearCallIdParam = () => router.replace('/user/calls', { scroll: false });

    if (existingCall) {
      void openCall(existingCall).finally(clearCallIdParam);
      return;
    }

    setShowTranscript(false);
    setRecordingUrl(null);
    setRecordingError(null);
    void fetch(`/api/backend/user/calls/${encodeURIComponent(callIdParam)}`)
      .then(async (res) => {
        const body = (await res.json()) as { ok: boolean; call?: Call };
        if (body.ok && body.call) setActiveCall(body.call);
      })
      .catch(() => undefined)
      .finally(clearCallIdParam);
  }, [callIdParam, calls, router]);

  function listenToCall(call: Call) {
    setActiveCall(call);
    setShowTranscript(false);
    setRecordingError(null);
    setRecordingLoading(false);
    // Use the server-side proxy endpoint as the audio src.
    // This avoids cross-origin CORS/CSP issues that block <audio> when using
    // presigned R2 URLs directly (range requests trigger CORS enforcement).
    const recordingCallId = call.providerCallId ?? call.id;
    setRecordingUrl(`/api/backend/user/calls/${encodeURIComponent(recordingCallId)}/recording-audio`);
  }

  function openBookingForCall(call: Call) {
    router.push(`/user/bookings?callId=${encodeURIComponent(call.id)}`);
  }

  async function markAttentionResolved(call: Call) {
    const res = await fetch(`/api/backend/user/calls/${encodeURIComponent(call.id)}/follow-up-done`, { method: 'PATCH' });
    const body = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !body.ok) {
      setError(body.error ?? 'Unable to mark follow-up complete');
      return;
    }
    setActiveCall((current) => current?.id === call.id ? { ...current, followUpNeeded: false, highUrgency: false } : current);
    setCalls((current) => current.map((item) => item.id === call.id ? { ...item, followUpNeeded: false, highUrgency: false } : item));
    setStats((current) => ({
      ...current,
      followUp: call.followUpNeeded ? Math.max(0, current.followUp - 1) : current.followUp,
      highUrgency: call.highUrgency ? Math.max(0, current.highUrgency - 1) : current.highUrgency,
    }));
    const query = new URLSearchParams();
    query.set('page', String(page));
    query.set('limit', String(USER_CALLS_PAGE_SIZE));
    if (activeFilter !== 'all' && activeFilter !== 'insights') query.set('tab', activeFilter);
    const refreshed = await fetch(`/api/backend/user/calls?${query.toString()}`);
    const refreshedBody = (await refreshed.json()) as CallsResponse;
    if (refreshed.ok && refreshedBody.ok) {
      setCalls(refreshedBody.calls ?? []);
      setStats(normalizeInitialStats(refreshedBody, null));
      setShopLiveStatus({
        liveCallsEnabled: Boolean(refreshedBody.shop?.liveCallsEnabled),
        goLiveAt: refreshedBody.shop?.goLiveAt ?? null,
      });
      setTotalCount(refreshedBody.pagination?.total ?? refreshedBody.total ?? 0);
      setTotalPages(refreshedBody.pagination?.totalPages ?? 1);
    }
  }

  const tabs = useMemo(
    () => [
      { value: 'all' as const, label: 'All', count: 0 },
      { value: 'follow_up' as const, label: 'Follow up needed', count: stats.followUp },
      { value: 'high_urgency' as const, label: 'High urgency', count: stats.highUrgency },
      { value: 'missed' as const, label: 'Missed', count: stats.missed },
      { value: 'insights' as const, label: 'Insights', count: 0 },
    ],
    [stats],
  );

  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;
  const shopHasGoneLive = shopLiveStatus.liveCallsEnabled || Boolean(shopLiveStatus.goLiveAt);
  const hasAnyCalls = stats.total > 0;
  const emptyState = callsEmptyState(activeFilter, shopHasGoneLive, hasAnyCalls);

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

              {activeFilter !== 'insights' ? (
                <section className="calls-metric-grid" aria-label="Call activity summary">
                  <div className="calls-metric-card">
                    <span className="calls-stat-icon calls-stat-icon--blue" aria-hidden><IconPhoneCall size={26} stroke={2} /></span>
                    <div><p>This week</p><strong>{stats.last7Days}</strong></div>
                  </div>
                  <div className="calls-metric-card">
                    <span className="calls-stat-icon calls-stat-icon--purple" aria-hidden><IconCalendarCheck size={26} stroke={2} /></span>
                    <div><p>Booking requests</p><strong>{stats.bookings}</strong></div>
                  </div>
                  <div className="calls-metric-card">
                    <span className="calls-stat-icon calls-stat-icon--amber" aria-hidden><IconAlertTriangle size={26} stroke={2} /></span>
                    <div><p>Follow-up</p><strong>{stats.followUp}</strong></div>
                  </div>
                  <div className="calls-metric-card">
                    <span className="calls-stat-icon calls-stat-icon--red" aria-hidden><IconPhoneOff size={26} stroke={2} /></span>
                    <div><p>Missed</p><strong>{stats.missed}</strong></div>
                  </div>
                </section>
              ) : null}

              <div className="calls-filter-bar">
                <div className="calls-filter-tabs" role="tablist" aria-label="Call filters">
                  {tabs.map((tab) => (
                    <button key={tab.value} type="button" role="tab" aria-selected={activeFilter === tab.value} className={`calls-filter-tab${tab.value === 'insights' ? ' calls-filter-tab--insights' : ''}${activeFilter === tab.value ? ' active' : ''}`} onClick={() => changeFilter(tab.value)}>
                      {tab.value === 'insights' && !canViewRecoveryInsights ? <IconLock size={13} stroke={2} style={{ marginRight: 5, verticalAlign: '-2px' }} /> : null}
                      {tab.label}
                      {tab.count > 0 ? <span>{`(${tab.count})`}</span> : null}
                    </button>
                  ))}
                </div>
              </div>

              {activeFilter === 'insights' ? (
                <>
                  {!canViewRecoveryInsights ? <CallRecoveryInsightsUpsell /> : null}
                  {canViewRecoveryInsights && insightsLoading && !insights ? <div className="calls-empty"><p>Loading insights…</p></div> : null}
                  {canViewRecoveryInsights && insightsError ? <div className="calls-error">Unable to load insights: {insightsError}</div> : null}
                  {canViewRecoveryInsights && insights ? <CallRecoveryInsightsPanel insights={insights} /> : null}
                </>
              ) : <div className="calls-list-card">
                {!loading && calls.length === 0 ? (
                  <div className="calls-empty">
                    <div className="calls-empty-icon">☎</div>
                    <h3>{emptyState.title}</h3>
                    <p>{emptyState.message}</p>
                    {emptyState.showGoLiveCta ? (
                      <a className="btn user-save" href="/user/go-live">Complete Go Live →</a>
                    ) : null}
                  </div>
                ) : null}
                {loading && calls.length === 0 ? <div className="calls-empty"><p>Loading calls…</p></div> : null}
                {calls.length > 0 ? (
                  <>
                    {!useMobileCallsList ? <table className="calls-table calls-table-desktop">
                      <thead>
                        <tr>
                          <th>Caller</th>
                          <th>Date &amp; Time</th>
                          <th>Outcome</th>
                          <th>Status</th>
                          <th>Logs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calls.map((call) => {
                          const outcome = outcomeMeta(call.outcome);
                          const status = statusMeta(call.status);
                          const duration = formatDuration(call.durationSeconds);
                          const supportsRecordingPlayback =
                            call.recordingAvailable !== undefined || call.recordingStatus !== undefined;
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
                              <td>
                                <span className={status.className}>{status.label}</span>
                                {call.missedFollowupSmsSent ? <span className="calls-sms-sent-badge">SMS sent</span> : null}
                              </td>
                              <td>
                                <div className="calls-row-actions">
                                  {call.transcriptAvailable ? (
                                    <button
                                      className="calls-log-icon-btn"
                                      type="button"
                                      title="View transcript"
                                      aria-label="View transcript"
                                      onClick={(event) => { event.stopPropagation(); void openCall(call); }}
                                    >
                                      <IconFileDescription size={18} stroke={1.7} />
                                    </button>
                                  ) : (
                                    <span className="calls-transcript-pending">Pending</span>
                                  )}
                                  {supportsRecordingPlayback ? (
                                    <span
                                      className="calls-log-action"
                                      title={call.recordingAvailable ? 'Play recording' : 'Recording not available'}
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <button
                                        className="calls-log-icon-btn"
                                        type="button"
                                        disabled={!call.recordingAvailable}
                                        title={call.recordingAvailable ? 'Play recording' : 'Recording not available'}
                                        aria-label={call.recordingAvailable ? 'Play recording' : 'Recording not available'}
                                        onClick={(event) => { event.stopPropagation(); void listenToCall(call); }}
                                      >
                                        <IconHeadphones size={18} stroke={1.7} />
                                      </button>
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table> : null}

                    {useMobileCallsList ? <div className="mobile-calls">
                      {calls.map((call) => {
                        const outcome = outcomeMeta(call.outcome);
                        const status = statusMeta(call.status);
                        return (
                          <button type="button" className={`mobile-call-card${call.highUrgency ? ' is-high-urgency' : ''}${call.followUpNeeded ? ' is-follow-up' : ''}`} key={call.id} onClick={() => void openCall(call)}>
                            <div className="mobile-call-top">
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
                              <div className="mobile-call-top-trailing">
                                {call.transcriptAvailable ? (
                                  <button
                                    className="calls-log-icon-btn"
                                    type="button"
                                    title="View transcript"
                                    aria-label="View transcript"
                                    onClick={(event) => { event.stopPropagation(); void openCall(call); }}
                                  >
                                    <IconFileDescription size={18} stroke={1.7} />
                                  </button>
                                ) : null}
                                {call.recordingAvailable ? (
                                  <button
                                    className="calls-log-icon-btn"
                                    type="button"
                                    title="Play recording"
                                    aria-label="Play recording"
                                    onClick={(event) => { event.stopPropagation(); void listenToCall(call); }}
                                  >
                                    <IconHeadphones size={18} stroke={1.7} />
                                  </button>
                                ) : null}
                                <span className={status.className}>{status.label}</span>
                              </div>
                            </div>
                            <div className="mobile-call-meta">
                              <span className="mobile-call-meta-primary">
                                {call.missedFollowupSmsSent ? <span className="calls-sms-sent-badge">SMS sent</span> : null}
                                {call.bookingCaptured ? (
                                  <span className={`${outcome.className} calls-outcome-link`} role="link" tabIndex={0} onClick={(event) => { event.stopPropagation(); openBookingForCall(call); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); openBookingForCall(call); } }}>{outcome.label}</span>
                                ) : (
                                  <span className={outcome.className}>{outcome.label}</span>
                                )}
                              </span>
                              <span className="mobile-call-meta-datetime">{formatShopDate(call.startedAt, shopTimezone)} · {formatShopTime(call.startedAt, shopTimezone)}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div> : null}
                  </>
                ) : null}
              </div>}

              {activeFilter !== 'insights' && totalPages > 1 ? (
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
              {activeCall.followUpNeeded || activeCall.highUrgency ? (
                <div className="calls-attention-actions">
                  <p>{activeCall.highUrgency ? 'High urgency follow-up required.' : 'Follow-up required.'}</p>
                  <button className="btn user-save" type="button" onClick={() => void markAttentionResolved(activeCall)}>Mark resolved</button>
                </div>
              ) : null}
              {activeCall.recordingAvailable ? (
                <div className="recording-panel">
                  <div className="recording-head">
                    <strong>Call recording</strong>
                    {!recordingUrl && !recordingLoading ? <button className="calls-pager-btn" type="button" onClick={() => void listenToCall(activeCall)}>Listen</button> : null}
                  </div>
                  {recordingLoading ? <p>Loading recording...</p> : null}
                  {recordingError ? <p>Recording is unavailable right now.</p> : null}
                  {recordingUrl ? <audio controls preload="metadata" src={recordingUrl} onError={() => setRecordingError('recording_unavailable')}>Your browser cannot play this recording.</audio> : null}
                </div>
              ) : null}
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
