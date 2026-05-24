import { AdminLayout } from '@/components/admin/admin-layout';
import { adminBaseStyles } from '@/components/admin/admin-base-styles';

const styles = adminBaseStyles;

const scripts: string[] = [

];

export const templateTitle = "Reset password.";

export function AdminResetPasswordTemplate() {
  return (
    <AdminLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="admin-reset-password"
    >
      <div className="auth-shell"><section className="auth-side"><div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></div></div><span>RingBooker Admin</span></div><div className="auth-brand-copy"><span className="tag purple">Admin backoffice</span><h2>Protect every layer of admin access.</h2><p>The admin panel controls businesses, telecom routing, billing, and incident workflows. Treat account security like production infrastructure.</p><div className="auth-grid"><div className="auth-stat"><strong>24</strong><span>Live salon accounts under monitoring</span></div><div className="auth-stat"><strong>99.94%</strong><span>Platform uptime across telecom, media, and jobs</span></div><div className="auth-stat"><strong>1.4k</strong><span>Calls processed today across all merchants</span></div><div className="auth-stat"><strong>6</strong><span>Internal team accounts with role-based access</span></div></div></div><div className="auth-foot"><span>Use role-based access and 2FA for every admin.</span><span>RingBooker internal use only.</span></div></section><section className="auth-panel"><div className="auth-card"><h1>Reset password.</h1><p>Set a new password for your RingBooker admin account.</p><div className="form-grid" style={{gridTemplateColumns: '1fr'}}>
              <div className="field"><label>New password</label><input type="password" defaultValue="" /></div>
              <div className="field"><label>Confirm new password</label><input type="password" defaultValue="" /></div>
            </div>
            <div className="note" style={{marginTop: 16}}>Strong passwords plus 2FA are required for all production admins. Sessions from other devices should be revoked after a successful reset.</div>
            <div className="top-actions" style={{marginTop: 18}}><a className="btn" href="/user/login">Return to login</a><a className="btn purple" href="/admin">Reset password</a></div></div></section></div>

    </AdminLayout>
  );
}
