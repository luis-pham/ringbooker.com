import { AdminLayout } from '@/components/admin/admin-layout';
import { adminBaseStyles } from '@/components/admin/admin-base-styles';

export const adminBillingStyles = adminBaseStyles;


export const adminBillingScripts: string[] = [

];

export const adminBillingTemplateTitle = "Billing operations.";

export function AdminBillingTemplate() {
  return (
    <AdminLayout
      styles={adminBillingStyles}
      scripts={adminBillingScripts}
      scriptPrefix="admin-billing"
      bodyClass="app-body"
    >
      <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></div></div><span>RingBooker Admin</span></div><div className="nav-label">Backoffice</div><div className="nav-list"><a className="nav-item " href="/admin"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" /></svg></div><span>Overview</span></a><a className="nav-item " href="/admin/shops"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 10l2-5h14l2 5" /><path d="M4 10h16v10H4z" /><path d="M9 20v-6h6v6" /></svg></div><span>Businesses</span></a><a className="nav-item " href="/admin/shops/luxe-hair-studio"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M5 20c1.5-3 4-4.5 7-4.5S17.5 17 19 20" /></svg></div><span>Business detail</span></a><a className="nav-item " href="/admin/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" /></svg></div><span>Calls &amp; Incidents</span></a><a className="nav-item active" href="/admin/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span>Billing</span></a><a className="nav-item " href="/admin/users"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy={7} r={3} /><path d="M20 8v6" /><path d="M17 11h6" /></svg></div><span>Users &amp; Roles</span></a><a className="nav-item " href="/admin/system-health"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span>System Health</span></a></div></aside><main className="main"><div className="topbar"><div className="page-title"><h1>Billing operations.</h1><p>Track subscriptions, revenue, trial conversion, and billing health for all shop accounts.</p></div><div className="top-actions"><a className="btn" href="/admin/billing">Open Paddle</a><a className="btn purple" href="/admin/billing">Review failed payments</a></div></div>
          <section className="grid grid-3">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span className="tag green">Collected</span></div><div className="stat-value">$3.7k</div><div className="stat-meta">Monthly recurring revenue</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" /></svg></div><span className="tag orange">2 failed</span></div><div className="stat-value">13</div><div className="stat-meta">Active paid subscriptions</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy={7} r={3} /><path d="M20 8v6" /><path d="M17 11h6" /></svg></div><span className="tag purple">Paddle</span></div><div className="stat-value">7</div><div className="stat-meta">Trials in progress</div></div>
          </section>
          <section className="grid grid-2" style={{marginTop: 18}}><div className="card"><div className="panel-head"><div><h3>Subscription ledger</h3><p className="sub">High-level billing status by merchant.</p></div></div><table className="table"><thead><tr><th>Shop</th><th>Plan</th><th>Amount</th><th>Status</th></tr></thead><tbody>
                  <tr><td>Luxe Hair Studio</td><td>Professional</td><td>$149</td><td><span className="tag green">Paid</span></td></tr>
                  <tr><td>Velvet Glow Spa</td><td>Professional</td><td>$149</td><td><span className="tag green">Paid</span></td></tr>
                  <tr><td>Bloom Nail Studio</td><td>Starter trial</td><td>$0</td><td><span className="tag orange">Trial</span></td></tr>
                  <tr><td>Modern Shears OC</td><td>Custom</td><td>Custom</td><td><span className="tag green">Manual invoice</span></td></tr>
                </tbody></table></div>
            <div className="card soft"><div className="panel-head"><div><h3>Billing scope reminder</h3><p className="sub">Keep internal billing language accurate.</p></div></div><div className="note">Paddle is used only for salon subscription billing. End-customer deposit or appointment payment flows are not enabled in this MVP and should not be described as live.</div></div></section>
        </main></div>

    </AdminLayout>
  );
}
