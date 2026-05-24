import { AdminLayout } from '@/components/admin/admin-layout';
import { adminBaseStyles } from '@/components/admin/admin-base-styles';

export const adminUsersStyles = adminBaseStyles;


export const adminUsersScripts: string[] = [

];

export const templateTitle = "Users and roles.";

export function AdminUsersTemplate() {
  return (
    <AdminLayout
      styles={adminUsersStyles}
      scripts={adminUsersScripts}
      scriptPrefix="admin-users"
      bodyClass="app-body"
    >
      <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></div></div><span>RingBooker Admin</span></div><div className="nav-label">Backoffice</div><div className="nav-list"><a className="nav-item " href="/admin"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" /></svg></div><span>Overview</span></a><a className="nav-item " href="/admin/shops"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 10l2-5h14l2 5" /><path d="M4 10h16v10H4z" /><path d="M9 20v-6h6v6" /></svg></div><span>Businesses</span></a><a className="nav-item " href="/admin/shops/luxe-hair-studio"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M5 20c1.5-3 4-4.5 7-4.5S17.5 17 19 20" /></svg></div><span>Business detail</span></a><a className="nav-item " href="/admin/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" /></svg></div><span>Calls &amp; Incidents</span></a><a className="nav-item " href="/admin/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span>Billing</span></a><a className="nav-item active" href="/admin/users"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy={7} r={3} /><path d="M20 8v6" /><path d="M17 11h6" /></svg></div><span>Users &amp; Roles</span></a><a className="nav-item " href="/admin/system-health"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span>System Health</span></a></div></aside><main className="main"><div className="topbar"><div className="page-title"><h1>Users and roles.</h1><p>Manage internal admin access, invites, role scope, and authentication expectations.</p></div><div className="top-actions"><a className="btn" href="/user/login">Open login</a><a className="btn purple" href="#invite">Invite admin</a></div></div>
          <section className="grid grid-3">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy={7} r={3} /><path d="M20 8v6" /><path d="M17 11h6" /></svg></div><span className="tag purple">6 total</span></div><div className="stat-value">4</div><div className="stat-meta">Admins with full access</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><circle cx={12} cy={12} r={3} /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .67.39 1.28 1 1.51.16.06.33.09.51.09H21a2 2 0 0 1 0 4h-.09c-.18 0-.35.03-.51.09-.61.23-1 .84-1 1.51Z" /></svg></div><span className="tag green">2FA</span></div><div className="stat-value">83%</div><div className="stat-meta">Team accounts with 2FA enabled</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span className="tag orange">1 pending</span></div><div className="stat-value">2</div><div className="stat-meta">Outstanding invites</div></div>
          </section>
          <section className="grid grid-2" style={{marginTop: 18}}><div className="card"><div className="panel-head"><div><h3>Team directory</h3><p className="sub">People with access to the admin backoffice.</p></div><a className="btn purple" href="#invite">Invite admin</a></div>
              <table className="table"><thead><tr><th>Name</th><th>Role</th><th>Last seen</th><th>Status</th></tr></thead><tbody>
                  <tr><td>Huy Pham</td><td>Super admin</td><td>2 min ago</td><td><span className="tag green">Active</span></td></tr>
                  <tr><td>Mai Tran</td><td>Ops admin</td><td>18 min ago</td><td><span className="tag green">Active</span></td></tr>
                  <tr><td>Chris Nguyen</td><td>Support lead</td><td>1h ago</td><td><span className="tag green">Active</span></td></tr>
                  <tr><td>Lan Le</td><td>Billing admin</td><td>Yesterday</td><td><span className="tag orange">Limited</span></td></tr>
                  <tr><td>Quynh Ho</td><td>Support admin</td><td>Invite pending</td><td><span className="tag blue">Pending</span></td></tr>
                </tbody></table></div>
            <div className="card soft" id="invite"><div className="panel-head"><div><h3>Invite and permissions</h3><p className="sub">Mock flow for admin access control.</p></div></div>
              <div className="form-grid">
                <div className="field"><label>Full name</label><input defaultValue="" /></div>
                <div className="field"><label>Email</label><input defaultValue="" /></div>
                <div className="field"><label>Role</label><select><option>Support admin</option><option>Ops admin</option><option>Billing admin</option><option>Super admin</option></select></div>
                <div className="field"><label>Require 2FA</label><select><option>Required</option><option>Optional</option></select></div>
                <div className="field" style={{gridColumn: '1 / -1'}}><label>Access notes</label><textarea defaultValue={"Can review calls and businesses, but should not change billing settings."} /></div>
              </div>
              <div className="top-actions" style={{marginTop: 16}}><a className="btn" href="/user/login">Preview login</a><a className="btn purple" href="/admin/users">Send invite</a></div></div></section>
        </main></div>

    </AdminLayout>
  );
}
