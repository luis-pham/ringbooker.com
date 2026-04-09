'use client';

import { useEffect, useState } from 'react';

type Booking = {
  id: string;
  service: string;
  customerPhone: string;
  datetimeUtc: string;
  status: string;
};

export function UserBookingsLive() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/backend/user/bookings')
      .then(async (response) => {
        const body = (await response.json()) as { ok: boolean; bookings?: Booking[]; error?: string };
        if (!body.ok) {
          setError(body.error ?? 'unknown_error');
          return;
        }
        setBookings(body.bookings ?? []);
      })
      .catch(() => setError('network_error'));
  }, []);

  if (error) return <p>Unable to load bookings: {error}</p>;

  return (
    <section>
      <h2>User Bookings (Live)</h2>
      <ul>
        {bookings.map((booking) => (
          <li key={booking.id}>
            {booking.service} - {booking.customerPhone} - {booking.datetimeUtc} - {booking.status}
          </li>
        ))}
      </ul>
    </section>
  );
}
