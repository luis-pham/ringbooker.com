'use client';

import { useEffect, useState } from 'react';

type UserDashboardResponse = {
  ok: boolean;
  metrics?: {
    bookingCount: number;
    callCount: number;
    missedCalls: number;
  };
  shop?: {
    id: string;
    name: string;
    timezone: string;
    plan: string;
    active: boolean;
  };
  error?: string;
};

export function UserDashboardLive() {
  const [data, setData] = useState<UserDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/backend/user/dashboard')
      .then(async (response) => (await response.json()) as UserDashboardResponse)
      .then((body) => setData(body))
      .finally(() => setLoading(false));
  }, []);

  async function signOut() {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
    window.location.href = '/user/login';
  }

  if (loading) return <p>Loading dashboard...</p>;
  if (!data?.ok) return <p>Unable to load user dashboard: {data?.error ?? 'unknown_error'}</p>;

  return (
    <section style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>User Live Dashboard</h2>
        <button type="button" onClick={signOut}>
          Sign out
        </button>
      </div>
      <p style={{ marginTop: 8 }}>
        Shop: <strong>{data.shop?.name}</strong> ({data.shop?.plan})
      </p>
      <ul>
        <li>Bookings: {data.metrics?.bookingCount ?? 0}</li>
        <li>Calls: {data.metrics?.callCount ?? 0}</li>
        <li>Missed calls: {data.metrics?.missedCalls ?? 0}</li>
      </ul>
    </section>
  );
}
