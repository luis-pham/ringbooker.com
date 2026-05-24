import { AdminLayout } from '@/components/admin/admin-layout';
import { adminBaseStyles } from '@/components/admin/admin-base-styles';

const styles = adminBaseStyles;

const scripts: string[] = [

];

export const templateTitle = "Forgot password.";

export function AdminForgotPasswordTemplate() {
  return (
    <AdminLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="admin-forgot-password"
    >
      <div className="auth-shell"><section className="auth-side"><div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></div></div><span>RingBooker Admin</span></div><div className="auth-brand-copy"><span className="tag purple">Admin backoffice</span><h2>Keep access recovery simple and safe.</h2><p>Admin recovery should be quick for trusted staff, but it still needs throttling, audit logs, and minimal account enumeration risk.</p><div className="auth-grid"><div className="auth-stat"><strong>24</strong><span>Live salon accounts under monitoring</span></div><div className="auth-stat"><strong>99.94%</strong><span>Platform uptime across telecom, media, and jobs</span></div><div className="auth-stat"><strong>1.4k</strong><span>Calls processed today across all merchants</span></div><div className="auth-stat"><strong>6</strong><span>Internal team accounts with role-based access</span></div></div></div><div className="auth-foot"><span>Use role-based access and 2FA for every admin.</span><span>RingBooker internal use only.</span></div></section><section className="auth-panel"><div className="auth-card"><h1>Forgot password.</h1><p>Request a secure password reset link for your admin account.</p><div className="form-grid" style={{gridTemplateColumns: '1fr'}}>
              <div className="field"><label>Work email</label><input type="email" defaultValue="ops@ringbooker.com" /></div>
            </div>
            <div className="note" style={{marginTop: 16}}>This mock flow sends a reset link to the admin email on file. In production, rate-limit requests and avoid revealing whether the email exists.</div>
            <div className="top-actions" style={{marginTop: 18}}><a className="btn" href="/user/login">Back to login</a><a className="btn purple" href="/admin/forgot-password">Send reset link</a></div></div></section></div>

    </AdminLayout>
  );
}
