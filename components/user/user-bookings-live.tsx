'use client';

import { useEffect, useMemo, useState } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { userBookingsScripts, userBookingsStyles } from '@/components/user/user-bookings';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';

type Booking = {
  id: string;
  service: string;
  customerPhone: string;
  customerName?: string | null;
  datetimeUtc: string;
  status: string;
  timezone?: string;
  techName?: string | null;
  confirmed?: boolean;
};

type BookingsResponse = {
  ok: boolean;
  bookings?: Booking[];
  error?: string;
};

function formatDateTime(value?: string, timezone?: string) {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone || undefined,
  });
}

function formatPhone(value?: string) {
  if (!value) return 'Unknown';
  if (value.length <= 4) return value;
  return `${value.slice(0, Math.min(3, value.length - 4))}•••${value.slice(-4)}`;
}

function statusClass(status?: string, confirmed?: boolean) {
  if (status === 'confirmed' || confirmed) return 'tag green';
  if (status === 'pending') return 'tag orange';
  if (status === 'cancelled' || status === 'no_show') return 'tag red';
  return 'tag purple';
}

export function UserBookingsLive() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/backend/user/bookings')
      .then(async (response) => {
        const body = (await response.json()) as BookingsResponse;
        if (!body.ok) {
          setError(body.error ?? 'unknown_error');
          return;
        }
        setBookings(body.bookings ?? []);
      })
      .catch(() => setError('network_error'));
  }, []);

  const metrics = useMemo(() => {
    return {
      total: bookings.length,
      pending: bookings.filter((booking) => booking.status === 'pending').length,
      confirmed: bookings.filter((booking) => booking.status === 'confirmed' || booking.confirmed).length,
    };
  }, [bookings]);

  return (
    <UserLayout styles={userBookingsStyles} scripts={userBookingsScripts} scriptPrefix="user-bookings-live">
      <>
      <div className="app-shell user-app-shell">
        <UserPortalSidebar active="bookings" />
        <main className="main">
          <UserPortalTopbar
            title="Bookings and calendar flow."
            subtitle="See every appointment RingBooker has created, confirmed, or recovered."
            actions={<><a className="btn" href="/user/settings">Business hours</a><a className="btn purple" href="/user/bookings">Create manual booking</a></>}
          />

          {error ? <div className="note" style={{ marginBottom: 18 }}>Unable to load bookings: {error}</div> : null}

          <section className="grid grid-3">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span className="tag purple">Total</span></div><div className="stat-value">{metrics.total}</div><div className="stat-meta">Appointments returned by the live bookings API</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4.5A8 8 0 1 1 21 12Z" /></svg></div><span className="tag orange">Pending</span></div><div className="stat-value">{metrics.pending}</div><div className="stat-meta">Appointments still waiting for confirmation</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 19h16" /><path d="M7 15l3-3 3 2 4-5" /></svg></div><span className="tag green">Confirmed</span></div><div className="stat-value">{metrics.confirmed}</div><div className="stat-meta">Appointments already confirmed with customers</div></div>
          </section>

          <section className="grid grid-2" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="panel-head"><div><h3>Upcoming appointments</h3><p className="sub">Live bookings returned by the current business API.</p></div><span className="badge-right">Live data</span></div>
              {bookings.length === 0 ? (
                <div className="note">No bookings have been recorded for this business yet.</div>
              ) : (
                <table className="table">
                  <thead><tr><th>Client</th><th>Service</th><th>Stylist</th><th>When</th><th>Status</th></tr></thead>
                  <tbody>
                    {bookings.map((booking) => (
                      <tr key={booking.id}>
                        <td>{booking.customerName?.trim() || formatPhone(booking.customerPhone)}</td>
                        <td>{booking.service}</td>
                        <td>{booking.techName?.trim() || 'No preference'}</td>
                        <td>{formatDateTime(booking.datetimeUtc, booking.timezone)}</td>
                        <td><span className={statusClass(booking.status, booking.confirmed)}>{booking.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="card soft">
              <div className="panel-head"><div><h3>Calendar rules</h3><p className="sub">How RingBooker decides what to offer callers.</p></div></div>
              <div className="list">
                <div className="list-item"><div className="item-main"><div className="avatar">1</div><div><h4>Check availability first</h4><p>AI checks live availability before offering an appointment.</p></div></div></div>
                <div className="list-item"><div className="item-main"><div className="avatar">2</div><div><h4>Suggest alternatives automatically</h4><p>Nearby times are offered immediately when the first slot is unavailable.</p></div></div></div>
                <div className="list-item"><div className="item-main"><div className="avatar">3</div><div><h4>Confirm after the call</h4><p>Successful bookings can trigger confirmation and reminder messages.</p></div></div></div>
                <div className="list-item"><div className="item-main"><div className="avatar">4</div><div><h4>Manual fallback still works</h4><p>If there is no calendar sync, the booking is still captured for the business.</p></div></div></div>
              </div>
            </div>
          </section>

          <div className="footer-inline"><span>RingBooker business panel</span><span>Bookings page restored with live data</span></div>
        </main>
      </div>
      <UserPortalMobileTabbar active="bookings" />
      </>
    </UserLayout>
  );
}
