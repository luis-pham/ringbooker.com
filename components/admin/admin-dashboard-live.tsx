'use client';

import { useEffect, useState } from 'react';

type DashboardMetrics = {
  shopCount: number;
  activeShops: number;
  callCount: number;
  missedCalls: number;
};

export function AdminDashboardLive() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/backend/admin/dashboard')
      .then(async (response) => {
        const body = (await response.json()) as {
          ok: boolean;
          metrics?: DashboardMetrics;
          error?: string;
        };
        if (!body.ok || !body.metrics) {
          setError(body.error ?? 'unable_to_load');
          return;
        }
        setMetrics(body.metrics);
      })
      .catch(() => setError('network_error'));
  }, []);

  async function signOut() {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  if (error) return <p>Unable to load admin dashboard: {error}</p>;
  if (!metrics) return <p>Loading admin dashboard...</p>;

  return (
    <section style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Admin Live Dashboard</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/admin/leads">Open leads</a>
          <a href="/admin/blog">Open CMS</a>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
      <ul>
        <li>Shops: {metrics.shopCount}</li>
        <li>Active shops: {metrics.activeShops}</li>
        <li>Total calls: {metrics.callCount}</li>
        <li>Missed calls: {metrics.missedCalls}</li>
      </ul>
    </section>
  );
}
