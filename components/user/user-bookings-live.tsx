'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconCalendarCheck, IconClock, IconPhone, IconStack2 } from '@tabler/icons-react';

import { UserLayout } from '@/components/user/user-layout';
import { UserPortalPageContent } from '@/components/user/user-portal-page-content';
import { userBookingsScripts, userBookingsStyles } from '@/components/user/user-bookings';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import {
  USER_PORTAL_TOPBAR_ACTIONS_CLASS,
  UserPortalStandardTopActions,
} from '@/components/user/user-portal-standard-top-actions';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';
import { formatShopDate, formatShopDateTime, formatShopTime, getShopTimezone } from '@/src/shared/timezone';

type BookingStatus =
  | 'captured'
  | 'link_sent'
  | 'contacted'
  | 'confirmed'
  | 'reminder_sent'
  | 'cancel_link_sent'
  | 'declined'
  | 'cancelled'
  | 'rescheduled'
  | 'completed';
type BookingFilter = 'all' | 'awaiting_action' | 'contacted' | 'confirmed' | 'declined' | 'rescheduled' | 'cancelled' | 'completed';
type SmsType = 'booking_link' | 'confirmation' | 'reminder' | 'cancel_link' | 'reschedule_link' | 'owner_summary';

type SmsLogEntry = {
  id: string;
  bookingRequestId: string;
  type: SmsType;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  phoneNumber: string;
};

type ParentCall = {
  id: string;
  callerPhone?: string;
  startedAt?: string;
  durationSeconds?: number;
  transcriptAvailable?: boolean;
};

type Booking = {
  id: string;
  shopId: string;
  callerPhone: string;
  callerName?: string | null;
  serviceRequested?: string | null;
  providerRequested?: string | null;
  durationMinutes?: number | null;
  appointmentDate?: string | null;
  appointmentTime?: string | null;
  datetimeUtc?: string | null;
  timezone?: string | null;
  status: BookingStatus | string;
  callId?: string | null;
  integrationId?: string | null;
  smsLog?: SmsLogEntry[];
  parentCall?: ParentCall | null;
  createdAt?: string;
  updatedAt?: string;
};

type BookingsStats = {
  total: number;
  awaitingAction: number;
  contacted: number;
  confirmed: number;
  declined: number;
  cancelled: number;
  completed: number;
};

export type BookingsResponse = {
  ok: boolean;
  bookings?: Booking[];
  booking?: Booking;
  stats?: BookingsStats;
  total?: number;
  shop?: { timezone?: string | null };
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  error?: string;
};

const USER_BOOKINGS_PAGE_SIZE = 25;
const EMPTY_STATS: BookingsStats = { total: 0, awaitingAction: 0, contacted: 0, confirmed: 0, declined: 0, cancelled: 0, completed: 0 };

function formatPhone(value?: string | null) {
  if (!value) return 'Unknown';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  if (value.length <= 4) return value;
  return `${value.slice(0, Math.min(3, value.length - 4))}•••${value.slice(-4)}`;
}

function avatarGlyph(booking: Booking): string {
  const name = booking.callerName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : parts[0]?.[1] ?? ''}`.toUpperCase() || '??';
  }
  const digits = booking.callerPhone?.replace(/\D/g, '') ?? '';
  return digits.length >= 2 ? digits.slice(-2) : '??';
}

function normalizeStatus(status?: string): BookingStatus {
  if (status === 'pending') return 'captured';
  if (status === 'no_show') return 'cancelled';
  if (status === 'link_sent' || status === 'contacted' || status === 'confirmed' || status === 'reminder_sent' || status === 'cancel_link_sent' || status === 'declined' || status === 'cancelled' || status === 'rescheduled' || status === 'completed') return status;
  return 'captured';
}

function statusMeta(statusValue?: string) {
  const status = normalizeStatus(statusValue);
  const map: Record<BookingStatus, { label: string; className: string }> = {
    captured: { label: 'New', className: 'booking-status booking-status--captured' },
    link_sent: { label: '🔗 Link sent', className: 'booking-status booking-status--link' },
    contacted: { label: '📞 Contacted', className: 'booking-status booking-status--contacted' },
    confirmed: { label: '✓ Confirmed', className: 'booking-status booking-status--confirmed' },
    reminder_sent: { label: '🔔 Reminder sent', className: 'booking-status booking-status--confirmed' },
    cancel_link_sent: { label: 'Cancel link sent', className: 'booking-status booking-status--warning' },
    declined: { label: '✕ Declined', className: 'booking-status booking-status--declined' },
    cancelled: { label: '✕ Cancelled', className: 'booking-status booking-status--cancelled' },
    rescheduled: { label: '↻ Rescheduled', className: 'booking-status booking-status--rescheduled' },
    completed: { label: 'Completed', className: 'booking-status booking-status--completed' },
  };
  return map[status];
}

function smsLabel(type: SmsType): string {
  const map: Record<SmsType, string> = {
    booking_link: 'Booking link sent',
    confirmation: 'Confirmation sent',
    reminder: 'Reminder sent',
    cancel_link: 'Cancel link sent',
    reschedule_link: 'Reschedule link sent',
    owner_summary: 'Summary sent to owner',
  };
  return map[type] ?? 'SMS sent';
}

function tabFromSearch(value: string | null): BookingFilter {
  if (value === 'awaiting_action' || value === 'contacted' || value === 'confirmed' || value === 'declined' || value === 'rescheduled' || value === 'cancelled' || value === 'completed') return value;
  return 'all';
}

function hasAnyStats(stats: BookingsStats) {
  return stats.total > 0;
}

function formatDuration(minutes?: number | null) {
  if (!minutes || minutes <= 0) return '';
  return `${minutes} min`;
}

function formatAppointment(booking: Booking, timezone: string) {
  if (booking.datetimeUtc) return `${formatShopDate(booking.datetimeUtc, timezone)} · ${formatShopTime(booking.datetimeUtc, timezone)}`;
  if (booking.appointmentDate) return `${booking.appointmentDate}${booking.appointmentTime ? ` · ${booking.appointmentTime}` : ''}`;
  return '—';
}

export function UserBookingsLive({ initialData = null }: { initialData?: BookingsResponse | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const callIdParam = searchParams.get('callId');
  const didUseInitialBookings = useRef(Boolean(initialData?.ok));
  const [bookings, setBookings] = useState<Booking[]>(initialData?.ok ? initialData.bookings ?? [] : []);
  const [activeFilter, setActiveFilter] = useState<BookingFilter>(() => tabFromSearch(tabParam));
  const [page, setPage] = useState(initialData?.pagination?.page ?? 1);
  const [totalCount, setTotalCount] = useState(initialData?.pagination?.total ?? initialData?.total ?? 0);
  const [totalPages, setTotalPages] = useState(initialData?.pagination?.totalPages ?? 1);
  const [stats, setStats] = useState<BookingsStats>(initialData?.ok ? initialData.stats ?? EMPTY_STATS : EMPTY_STATS);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(initialData && !initialData.ok ? initialData.error ?? 'unknown_error' : null);
  const [shopTimezone, setShopTimezone] = useState<string>(getShopTimezone(initialData?.ok ? initialData.shop : null));
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const next = tabFromSearch(tabParam);
    setActiveFilter((current) => (current === next ? current : next));
  }, [tabParam]);

  useEffect(() => {
    if (didUseInitialBookings.current && activeFilter === 'all' && page === 1 && !callIdParam) {
      didUseInitialBookings.current = false;
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const query = new URLSearchParams();
    query.set('page', String(page));
    query.set('limit', String(USER_BOOKINGS_PAGE_SIZE));
    if (activeFilter !== 'all') query.set('tab', activeFilter);
    if (callIdParam) query.set('callId', callIdParam);
    void fetch(`/api/backend/user/bookings?${query.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as BookingsResponse;
        if (!body.ok) {
          setError(body.error ?? 'unknown_error');
          setBookings([]);
          setTotalCount(0);
          setTotalPages(1);
          return;
        }
        setBookings(body.bookings ?? []);
        setStats(body.stats ?? EMPTY_STATS);
        setShopTimezone(getShopTimezone(body.shop));
        setTotalCount(body.pagination?.total ?? body.total ?? 0);
        setTotalPages(body.pagination?.totalPages ?? Math.max(1, Math.ceil((body.pagination?.total ?? body.total ?? 0) / USER_BOOKINGS_PAGE_SIZE)));
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        setError('network_error');
        setBookings([]);
        setTotalCount(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [activeFilter, page, callIdParam]);

  function changeFilter(filter: BookingFilter) {
    const query = new URLSearchParams(searchParams.toString());
    if (filter === 'all') query.delete('tab');
    else query.set('tab', filter);
    query.delete('page');
    setPage(1);
    setActiveFilter(filter);
    setActiveBooking(null);
    router.replace(query.toString() ? `/user/bookings?${query.toString()}` : '/user/bookings', { scroll: false });
  }

  async function openBooking(booking: Booking) {
    setActiveBooking(booking);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/backend/user/bookings/${encodeURIComponent(booking.id)}`);
      const body = (await res.json()) as BookingsResponse;
      if (body.ok && body.booking) setActiveBooking(body.booking);
    } catch {
      // Keep list row data if detail fetch fails.
    } finally {
      setDetailLoading(false);
    }
  }

  async function updateBookingStatus(status: BookingStatus) {
    if (!activeBooking) return;
    const res = await fetch(`/api/backend/user/bookings/${encodeURIComponent(activeBooking.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const body = (await res.json()) as BookingsResponse;
    if (!body.ok || !body.booking) {
      setError(body.error ?? 'Unable to update booking');
      return;
    }
    setActiveBooking((current) => (current ? { ...current, ...body.booking } : body.booking ?? null));
    setBookings((current) => current.map((booking) => (booking.id === body.booking?.id ? { ...booking, ...body.booking } : booking)));
  }

  const tabs = useMemo(
    () => [
      { value: 'all' as const, label: 'All', count: 0 },
      { value: 'awaiting_action' as const, label: 'New', count: stats.awaitingAction },
      { value: 'contacted' as const, label: 'Contacted', count: stats.contacted },
      { value: 'confirmed' as const, label: 'Confirmed', count: stats.confirmed },
      { value: 'declined' as const, label: 'Declined', count: stats.declined },
      { value: 'rescheduled' as const, label: 'Rescheduled', count: 0 },
      { value: 'cancelled' as const, label: 'Cancelled', count: stats.cancelled },
      { value: 'completed' as const, label: 'Completed', count: stats.completed },
    ],
    [stats],
  );
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;
  const activeStatus = activeBooking ? normalizeStatus(activeBooking.status) : 'captured';

  return (
    <UserLayout styles={userBookingsStyles} scripts={userBookingsScripts} scriptPrefix="user-bookings-live">
      <>
        <div className="app-shell user-app-shell">
          <UserPortalSidebar active="bookings" />
          <main className="main">
            <UserPortalTopbar
              title="Bookings"
              subtitle="Booking requests captured by AI from phone calls."
              actionsClassName={USER_PORTAL_TOPBAR_ACTIONS_CLASS}
              actions={<UserPortalStandardTopActions />}
            />

            <UserPortalPageContent pageClass="page-bookings">
              {error ? <div className="bookings-error">Unable to load bookings: {error}</div> : null}

              {hasAnyStats(stats) ? (
                <section className="bookings-metric-grid" aria-label="Booking summary">
                  <div className="bookings-metric-card">
                    <span className="bookings-stat-icon bookings-stat-icon--blue" aria-hidden><IconStack2 size={22} stroke={1.9} /></span>
                    <div><p>Total requests</p><strong>{stats.total}</strong></div>
                  </div>
                  <div className="bookings-metric-card">
                    <span className="bookings-stat-icon bookings-stat-icon--amber" aria-hidden><IconClock size={22} stroke={1.9} /></span>
                    <div><p>New</p><strong>{stats.awaitingAction}</strong></div>
                  </div>
                  <div className="bookings-metric-card">
                    <span className="bookings-stat-icon bookings-stat-icon--purple" aria-hidden><IconPhone size={22} stroke={1.9} /></span>
                    <div><p>Contacted</p><strong>{stats.contacted}</strong></div>
                  </div>
                  <div className="bookings-metric-card">
                    <span className="bookings-stat-icon bookings-stat-icon--green" aria-hidden><IconCalendarCheck size={22} stroke={1.9} /></span>
                    <div><p>Confirmed</p><strong>{stats.confirmed}</strong></div>
                  </div>
                </section>
              ) : null}

              <div className="bookings-filter-bar">
                <div className="bookings-filter-tabs" role="tablist" aria-label="Booking filters">
                  {tabs.map((tab) => (
                    <button key={tab.value} type="button" role="tab" aria-selected={activeFilter === tab.value} className={`bookings-filter-tab${activeFilter === tab.value ? ' active' : ''}`} onClick={() => changeFilter(tab.value)}>
                      {tab.label}
                      {tab.count > 0 ? <span>{`(${tab.count})`}</span> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bookings-list-card">
                {!loading && bookings.length === 0 ? (
                  <div className="bookings-empty">
                    <div className="bookings-empty-icon">▣</div>
                    <h3>No booking requests yet</h3>
                    <p>RingBooker captures booking requests from phone calls. Complete Go Live to start receiving calls.</p>
                    <a className="btn user-save" href="/user/go-live">Complete Go Live →</a>
                  </div>
                ) : null}
                {loading && bookings.length === 0 ? <div className="bookings-empty"><p>Loading bookings…</p></div> : null}
                {bookings.length > 0 ? (
                  <>
                    <table className="bookings-table bookings-table-desktop">
                      <thead>
                        <tr><th>Client</th><th>Service</th><th>Date &amp; Time</th><th>Status</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {bookings.map((booking) => {
                          const status = statusMeta(booking.status);
                          const duration = formatDuration(booking.durationMinutes);
                          return (
                            <tr key={booking.id} onClick={() => void openBooking(booking)}>
                              <td>
                                <div className="bookings-row-client">
                                  <div className="bookings-client-avatar" aria-hidden>{avatarGlyph(booking)}</div>
                                  <div><div className="bookings-client-name">{booking.callerName?.trim() || 'Unknown'}</div><div className="bookings-client-phone">{formatPhone(booking.callerPhone)}</div></div>
                                </div>
                              </td>
                              <td><div className="bookings-service-name">{booking.serviceRequested?.trim() || <em>Not specified</em>}</div><div className="bookings-provider">{booking.providerRequested?.trim() ? `with ${booking.providerRequested}` : 'Any available'}</div></td>
                              <td><div className="bookings-date-cell">{formatAppointment(booking, shopTimezone)}{duration ? <span>{duration}</span> : <span>Date not set</span>}</div></td>
                              <td><span className={status.className}>{status.label}</span></td>
                              <td><button type="button" className="bookings-view-btn" onClick={(event) => { event.stopPropagation(); void openBooking(booking); }}>View →</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="mobile-bookings">
                      {bookings.map((booking) => {
                        const status = statusMeta(booking.status);
                        return (
                          <button type="button" className="mobile-booking-card" key={booking.id} onClick={() => void openBooking(booking)}>
                            <div className="mobile-booking-top"><div className="bookings-row-client"><div className="bookings-client-avatar" aria-hidden>{avatarGlyph(booking)}</div><div><span className="bookings-client-name">{booking.callerName?.trim() || 'Unknown'}</span><span className="bookings-client-phone">{formatPhone(booking.callerPhone)}</span></div></div><span className={status.className}>{status.label}</span></div>
                            <div className="mobile-booking-meta"><span>{booking.serviceRequested || 'Not specified'}</span><span>{formatAppointment(booking, shopTimezone)}</span></div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>

              {totalPages > 1 ? (
                <div className="bookings-pagination">
                  <button type="button" disabled={!canGoPrev} onClick={() => setPage((current) => Math.max(1, current - 1))}>← Previous</button>
                  <span>Page {page} of {totalPages}</span>
                  <button type="button" disabled={!canGoNext} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next →</button>
                </div>
              ) : null}
              <div className="bookings-count-note">{totalCount} booking request{totalCount === 1 ? '' : 's'}</div>
            </UserPortalPageContent>
          </main>
        </div>

        {activeBooking ? (
          <div className="booking-detail-overlay" onClick={() => setActiveBooking(null)}>
            <aside className="booking-detail-panel" onClick={(event) => event.stopPropagation()}>
              <div className="booking-detail-head"><div><h2>{activeBooking.callerName?.trim() || formatPhone(activeBooking.callerPhone)}</h2><p>{formatPhone(activeBooking.callerPhone)}</p></div><button type="button" onClick={() => setActiveBooking(null)}>×</button></div>
              {detailLoading ? <div className="booking-detail-loading">Loading details…</div> : null}
              <section className="booking-detail-section"><h3>Booking info</h3><dl><dt>Service</dt><dd>{activeBooking.serviceRequested || 'Not specified'}</dd><dt>Provider</dt><dd>{activeBooking.providerRequested || 'Any available'}</dd><dt>Date</dt><dd>{formatAppointment(activeBooking, shopTimezone)}</dd><dt>Duration</dt><dd>{activeBooking.durationMinutes ? `${activeBooking.durationMinutes} min` : 'Not set'}</dd><dt>Status</dt><dd><span className={statusMeta(activeBooking.status).className}>{statusMeta(activeBooking.status).label}</span></dd><dt>Integration</dt><dd>{activeBooking.integrationId || 'No integration'}</dd></dl></section>
              <section className="booking-detail-section"><h3>Parent call</h3>{activeBooking.parentCall ? <dl><dt>Called</dt><dd>{formatShopDateTime(activeBooking.parentCall.startedAt, shopTimezone)}</dd><dt>Duration</dt><dd>{activeBooking.parentCall.durationSeconds ? `${activeBooking.parentCall.durationSeconds}s` : 'Not set'}</dd><dt>Transcript</dt><dd>{activeBooking.parentCall.transcriptAvailable ? <a href={`/user/calls?callId=${encodeURIComponent(activeBooking.parentCall.id)}`}>View transcript →</a> : 'Pending'}</dd></dl> : <p className="booking-muted">No linked call available.</p>}</section>
              <section className="booking-detail-section"><h3>SMS history</h3>{activeBooking.smsLog?.length ? <div className="booking-sms-timeline">{activeBooking.smsLog.map((entry) => <div className="booking-sms-entry" key={entry.id}><span className={entry.failedAt ? 'failed' : ''} /><div><strong>{smsLabel(entry.type)}</strong><p>{formatShopDateTime(entry.failedAt || entry.deliveredAt || entry.sentAt, shopTimezone)}</p></div></div>)}</div> : <p className="booking-muted">No SMS history for this booking yet.</p>}</section>
              {(activeStatus === 'captured' || activeStatus === 'link_sent') ? (
                <section className="booking-detail-section"><h3>Actions</h3><div className="booking-override-actions">
                  <button type="button" onClick={() => void updateBookingStatus('contacted')}>📞 Mark as contacted</button>
                  <button type="button" className="danger" onClick={() => void updateBookingStatus('cancelled')}>✕ Cancel</button>
                </div></section>
              ) : activeStatus === 'contacted' ? (
                <section className="booking-detail-section"><h3>Actions</h3><div className="booking-override-actions">
                  <button type="button" onClick={() => void updateBookingStatus('confirmed')}>✓ Confirm appointment</button>
                  <button type="button" className="warning" onClick={() => void updateBookingStatus('declined')}>✕ Mark as declined</button>
                  <button type="button" className="danger" onClick={() => void updateBookingStatus('cancelled')}>✕ Cancel</button>
                </div></section>
              ) : (activeStatus === 'confirmed' || activeStatus === 'reminder_sent' || activeStatus === 'rescheduled') ? (
                <section className="booking-detail-section"><h3>Actions</h3><div className="booking-override-actions">
                  {activeStatus === 'rescheduled' ? (
                    <button type="button" onClick={() => void updateBookingStatus('confirmed')}>✓ Re-confirm</button>
                  ) : (
                    <><button type="button" onClick={() => void updateBookingStatus('completed')}>✓ Mark as completed</button><button type="button" className="danger" onClick={() => void updateBookingStatus('cancelled')}>✕ Cancel</button></>
                  )}
                </div></section>
              ) : null}
            </aside>
          </div>
        ) : null}

        <UserPortalMobileTabbar active="bookings" />
      </>
    </UserLayout>
  );
}
