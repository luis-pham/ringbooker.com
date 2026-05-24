import { AdminLayout } from '@/components/admin/admin-layout';
import { adminBaseStyles } from '@/components/admin/admin-base-styles';

const styles = adminBaseStyles;

const scripts: string[] = [

];

export const templateTitle = "Operations overview.";

export function AdminDashboardTemplate() {
  return (
    <AdminLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="admin-dashboard"
      bodyClass="app-body"
    >
      <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></div></div><span>RingBooker Admin</span></div><div className="nav-label">Backoffice</div><div className="nav-list"><a className="nav-item active" href="/admin"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" /></svg></div><span>Overview</span></a><a className="nav-item " href="/admin/shops"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 10l2-5h14l2 5" /><path d="M4 10h16v10H4z" /><path d="M9 20v-6h6v6" /></svg></div><span>Businesses</span></a><a className="nav-item " href="/admin/shops/luxe-hair-studio"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M5 20c1.5-3 4-4.5 7-4.5S17.5 17 19 20" /></svg></div><span>Business detail</span></a><a className="nav-item " href="/admin/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" /></svg></div><span>Calls &amp; Incidents</span></a><a className="nav-item " href="/admin/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span>Billing</span></a><a className="nav-item " href="/admin/users"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy={7} r={3} /><path d="M20 8v6" /><path d="M17 11h6" /></svg></div><span>Users &amp; Roles</span></a><a className="nav-item " href="/admin/system-health"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span>System Health</span></a></div></aside><main className="main"><div className="topbar"><div className="page-title"><h1>Operations overview.</h1><p>Monitor shops, calls, billing, jobs, and incident signals across the full RingBooker network.</p></div><div className="top-actions"><a className="btn" href="/admin/users">Review admins</a><a className="btn purple" href="/admin/shops">Open shops</a></div></div>
          <section className="grid grid-4">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M3 10l2-5h14l2 5" /><path d="M4 10h16v10H4z" /><path d="M9 20v-6h6v6" /></svg></div><span className="tag purple">Active</span></div><div className="stat-value">24</div><div className="stat-meta">Live salon accounts</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" /></svg></div><span className="tag green">Today</span></div><div className="stat-value">1,482</div><div className="stat-meta">Calls processed</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span className="tag orange">MRR</span></div><div className="stat-value">$3.7k</div><div className="stat-meta">Paddle subscription revenue</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span className="tag green">Healthy</span></div><div className="stat-value">99.94%</div><div className="stat-meta">Platform uptime</div></div>
          </section>
          <section className="call-grid" style={{marginTop: 18}}>
            <div className="card hero-admin">
              <div className="live-label"><span className="dot" /> Operations live</div>
              <div className="live-name">RingBooker is handling traffic across all connected salons.</div>
              <div className="live-copy">Telnyx voice, LiveKit media, Gemini realtime, and background jobs are running inside healthy thresholds. Two businesses need onboarding follow-up and one account is approaching trial expiry.</div>
              <div className="subtitle-box"><div className="mini">Focus now</div><p>Luxe Hair Studio has a spike in after-hours bookings. Bella Nails has three repeated customer replies that need manual review. One Telnyx webhook retry was safely deduplicated.</p></div>
              <div className="wave"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
            </div>
            <div className="card soft">
              <div className="panel-head"><div><h3>Priority queue</h3><p className="sub">What the ops team should look at first.</p></div><span className="badge-right">Updated now</span></div>
              <div className="list">
                <div className="list-item"><div className="item-main"><div className="avatar">T1</div><div><h4>Trial ending in 2 days</h4><p>Bloom Nail Studio · send renewal reminder</p></div></div><span className="tag orange">Action</span></div>
                <div className="list-item"><div className="item-main"><div className="avatar">T2</div><div><h4>Webhook retry cluster</h4><p>1 Telnyx endpoint had duplicate retries, all safely ignored</p></div></div><span className="tag green">Handled</span></div>
                <div className="list-item"><div className="item-main"><div className="avatar">T3</div><div><h4>User transfer escalation</h4><p>Complaint call at Luxe Hair Studio marked for QA review</p></div></div><span className="tag red">Review</span></div>
              </div>
            </div>
          </section>
          <section className="kpi-row" style={{marginTop: 18}}>
            <div className="card"><div className="panel-head"><div><h3>Account activity</h3><p className="sub">Newest operational signals across the network.</p></div><a className="btn ghost" href="/admin/shops">Open businesses</a></div>
              <table className="table"><thead><tr><th>Business</th><th>Status</th><th>Calls today</th><th>Conversion</th><th>Plan</th></tr></thead><tbody>
                  <tr><td>Luxe Hair Studio</td><td><span className="tag green">Healthy</span></td><td>74</td><td>78%</td><td>Professional</td></tr>
                  <tr><td>Bloom Nail Studio</td><td><span className="tag orange">Trial ending</span></td><td>39</td><td>71%</td><td>Starter</td></tr>
                  <tr><td>Velvet Glow Spa</td><td><span className="tag green">Healthy</span></td><td>61</td><td>74%</td><td>Professional</td></tr>
                  <tr><td>Modern Shears OC</td><td><span className="tag red">Needs review</span></td><td>28</td><td>59%</td><td>Custom</td></tr>
                </tbody></table></div>
            <div className="card soft"><div className="panel-head"><div><h3>System mix</h3><p className="sub">Current platform usage.</p></div></div>
              <div className="progress-list">
                <div className="progress-item"><strong>Google Calendar businesses</strong><div className="bar"><span style={{width: '82%'}} /></div><span>19</span></div>
                <div className="progress-item"><strong>Manual fallback businesses</strong><div className="bar"><span style={{width: '24%'}} /></div><span>5</span></div>
                <div className="progress-item"><strong>Number forwarding enabled</strong><div className="bar"><span style={{width: '63%'}} /></div><span>15</span></div>
                <div className="progress-item"><strong>Bilingual summaries enabled</strong><div className="bar"><span style={{width: '58%'}} /></div><span>14</span></div>
              </div>
            </div>
          </section>
        </main></div>

    </AdminLayout>
  );
}
