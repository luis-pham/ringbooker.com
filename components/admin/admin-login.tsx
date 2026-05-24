import { AdminLayout } from '@/components/admin/admin-layout';
import { adminBaseStyles } from '@/components/admin/admin-base-styles';

const styles = adminBaseStyles;

const scripts: string[] = [

];

export const templateTitle = "Admin login.";

export function AdminLoginTemplate() {
  return (
    <AdminLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="admin-login"
    >
      <div className="auth-shell"><section className="auth-side"><div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></div></div><span>RingBooker Admin</span></div><div className="auth-brand-copy"><span className="tag purple">Admin backoffice</span><h2>Operate RingBooker with confidence.</h2><p>Internal backoffice for businesses, telecom health, billing, and AI operations. Built for a small team that needs fast context, safe access, and clean escalation paths.</p><div className="auth-grid"><div className="auth-stat"><strong>24</strong><span>Live salon accounts under monitoring</span></div><div className="auth-stat"><strong>99.94%</strong><span>Platform uptime across telecom, media, and jobs</span></div><div className="auth-stat"><strong>1.4k</strong><span>Calls processed today across all merchants</span></div><div className="auth-stat"><strong>6</strong><span>Internal team accounts with role-based access</span></div></div></div><div className="auth-foot"><span>Use role-based access and 2FA for every admin.</span><span>RingBooker internal use only.</span></div></section><section className="auth-panel"><div className="auth-card"><h1>Admin login.</h1><p>Sign in to the RingBooker backoffice with your internal team account.</p><div className="form-grid" style={{gridTemplateColumns: '1fr'}}>
              <div className="field"><label>Work email</label><input type="email" defaultValue="ops@ringbooker.com" /></div>
              <div className="field"><label>Password</label><input type="password" defaultValue="password" /></div>
            </div>
            <div className="inline" style={{marginTop: 14}}><label className="checkbox"><input type="checkbox" defaultChecked /> Keep me signed in on this device</label><a href="/admin/forgot-password" style={{ fontSize: 13 }}>Forgot password?</a></div>
            <div className="top-actions" style={{marginTop: 18}}><a className="btn" href="/admin/users">Back to users</a><a className="btn purple" href="/admin">Sign in</a></div>
            <div className="divider" /><div className="helper-links"><a href="/admin/reset-password">Preview reset flow</a><a href="/admin/login">SSO coming later</a></div></div></section></div>

    </AdminLayout>
  );
}
