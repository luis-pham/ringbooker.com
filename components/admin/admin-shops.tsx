import { AdminLayout } from '@/components/admin/admin-layout';
import { adminBaseStyles } from '@/components/admin/admin-base-styles';

const adminShopsAddonStyles: string[] = [
  String.raw`
.admin-shop-meta-line{margin:6px 0 8px;font-size:12px;color:var(--muted);line-height:1.45;max-width:min(560px,100%)}
.admin-shop-forward-line{margin:0 0 2px;font-size:11px;color:var(--muted);line-height:1.35}
.admin-shop-chip-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:2px}
dialog.rb-admin-modal{max-width:min(520px,94vw)}
`,
];

export const adminShopsStyles = [...adminBaseStyles, ...adminShopsAddonStyles];


export const adminShopsScripts: string[] = [

];

export const templateTitle = "Business accounts.";

export function AdminShopsTemplate() {
  return (
    <AdminLayout
      styles={adminShopsStyles}
      scripts={adminShopsScripts}
      scriptPrefix="admin-shops"
      bodyClass="app-body"
    >
      <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></div></div><span>RingBooker Admin</span></div><div className="nav-label">Backoffice</div><div className="nav-list"><a className="nav-item " href="/admin"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" /></svg></div><span>Overview</span></a><a className="nav-item active" href="/admin/shops"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 10l2-5h14l2 5" /><path d="M4 10h16v10H4z" /><path d="M9 20v-6h6v6" /></svg></div><span>Businesses</span></a><a className="nav-item " href="/admin/shops/luxe-hair-studio"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M5 20c1.5-3 4-4.5 7-4.5S17.5 17 19 20" /></svg></div><span>Business detail</span></a><a className="nav-item " href="/admin/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" /></svg></div><span>Calls &amp; Incidents</span></a><a className="nav-item " href="/admin/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span>Billing</span></a><a className="nav-item " href="/admin/users"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy={7} r={3} /><path d="M20 8v6" /><path d="M17 11h6" /></svg></div><span>Users &amp; Roles</span></a><a className="nav-item " href="/admin/system-health"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span>System Health</span></a></div></aside><main className="main"><div className="topbar"><div className="page-title"><h1>Shop accounts.</h1><p>Create, inspect, and monitor every salon account running on RingBooker.</p></div><div className="top-actions"><a className="btn" href="/admin/billing">Billing view</a><a className="btn purple" href="/admin/shops">Add shop</a></div></div>
          <section className="grid grid-3">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M3 10l2-5h14l2 5" /><path d="M4 10h16v10H4z" /><path d="M9 20v-6h6v6" /></svg></div><span className="tag green">24 active</span></div><div className="stat-value">31</div><div className="stat-meta">Total businesses created</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span className="tag purple">13 paid</span></div><div className="stat-value">7</div><div className="stat-meta">Trials in progress</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span className="tag orange">Needs setup</span></div><div className="stat-value">3</div><div className="stat-meta">Accounts missing complete routing</div></div>
          </section>
          <section className="card" style={{marginTop: 18}}><div className="panel-head"><div><h3>All businesses</h3><p className="sub">Operational list of every merchant account.</p></div><div className="top-actions"><a className="btn" href="/admin/shops/luxe-hair-studio">Open example</a><a className="btn purple" href="/admin/shops">Create business</a></div></div>
            <table className="table"><thead><tr><th>Business</th><th>Phone</th><th>Plan</th><th>Status</th><th>Calls today</th><th>User</th></tr></thead><tbody>
                <tr><td>Luxe Hair Studio</td><td>+1 714 555 0199</td><td>Professional</td><td><span className="tag green">Healthy</span></td><td>74</td><td>Mai Nguyen</td></tr>
                <tr><td>Bloom Nail Studio</td><td>+1 657 555 0131</td><td>Starter trial</td><td><span className="tag orange">Expires in 2d</span></td><td>39</td><td>Linh Tran</td></tr>
                <tr><td>Velvet Glow Spa</td><td>+1 949 555 0167</td><td>Professional</td><td><span className="tag green">Healthy</span></td><td>61</td><td>Thao Le</td></tr>
                <tr><td>Modern Shears OC</td><td>+1 714 555 0188</td><td>Custom</td><td><span className="tag red">Escalation spike</span></td><td>28</td><td>Chris Pham</td></tr>
                <tr><td>Golden Touch Nails</td><td>+1 562 555 0120</td><td>Starter</td><td><span className="tag blue">Onboarding</span></td><td>11</td><td>Jenny Ho</td></tr>
              </tbody></table></section>
        </main></div>

    </AdminLayout>
  );
}
