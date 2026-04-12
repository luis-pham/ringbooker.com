'use client';

import { useEffect, useState } from 'react';

import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { adminSidebarAddonStyles } from '@/components/admin/admin-sidebar-styles';
import { adminCallsScripts, adminCallsStyles } from '@/components/admin/admin-calls';

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

  return (
    <AdminLayout
      styles={[...adminCallsStyles, ...adminSidebarAddonStyles]}
      scripts={adminCallsScripts}
      scriptPrefix="admin-dashboard-live"
      bodyClass="app-body"
    >
      <div className="app-shell">
        <AdminSidebar />
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Admin overview</h1>
              <p>High-level counts across shops and calls. Open Calls for transcripts and per-call detail.</p>
            </div>
            <div className="top-actions">
              <a className="btn" href="/admin/calls">
                Open calls
              </a>
              <button type="button" className="btn ghost" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </div>

          {error ? (
            <div className="note" style={{ marginBottom: 18 }}>
              Unable to load admin dashboard: {error}
            </div>
          ) : null}

          {!error && !metrics ? (
            <div className="note" style={{ marginBottom: 18 }}>
              Loading admin dashboard…
            </div>
          ) : null}

          {metrics ? (
            <>
              <section className="grid grid-4">
                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M3 10l2-5h14l2 5" />
                        <path d="M4 10h16v10H4z" />
                        <path d="M9 20v-6h6v6" />
                      </svg>
                    </div>
                    <span className="tag blue">Shops</span>
                  </div>
                  <div className="stat-value">{metrics.shopCount}</div>
                  <div className="stat-meta">Total shops in the system</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4" />
                        <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
                      </svg>
                    </div>
                    <span className="tag green">Active</span>
                  </div>
                  <div className="stat-value">{metrics.activeShops}</div>
                  <div className="stat-meta">Shops marked active</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" />
                      </svg>
                    </div>
                    <span className="tag purple">Calls</span>
                  </div>
                  <div className="stat-value">{metrics.callCount}</div>
                  <div className="stat-meta">Total calls recorded</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M3 12h4l2-5 4 10 2-5h6" />
                      </svg>
                    </div>
                    <span className="tag orange">Missed</span>
                  </div>
                  <div className="stat-value">{metrics.missedCalls}</div>
                  <div className="stat-meta">Missed or dropped calls</div>
                </div>
              </section>

              <section className="grid grid-2" style={{ marginTop: 18 }}>
                <div className="card soft">
                  <div className="panel-head">
                    <div>
                      <h3>Quick links</h3>
                      <p className="sub">Leads and CMS open in the same admin shell where available.</p>
                    </div>
                  </div>
                  <div className="top-actions" style={{ justifyContent: 'flex-start' }}>
                    <a className="btn purple" href="/admin/leads">
                      Leads
                    </a>
                    <a className="btn" href="/admin/blog">
                      Blog / CMS
                    </a>
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </main>
      </div>
    </AdminLayout>
  );
}
