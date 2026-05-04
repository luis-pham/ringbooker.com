'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';
import { useUserWorkspace } from '@/components/user/user-workspace-context';
import { userDashboardScripts, userDashboardStyles } from '@/components/user/user-dashboard';
import { apiUserVisibleMessage } from '@/lib/api-user-message';

type NavStateResponse = {
  ok: boolean;
  email?: string;
  shopName?: string;
  userName?: string;
  plan?: string;
  subscriptionStatus?: string | null;
  error?: string;
};

function planLabel(plan?: string) {
  const raw = plan ?? 'starter';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Friendly copy for account page only; subscription values mirror billing domain. */
function subscriptionFriendlyLabel(status: string | null | undefined): string {
  if (status == null || status === '') return 'No active subscription';
  switch (status) {
    case 'active':
      return 'Active';
    case 'trialing':
      return 'Trial';
    case 'past_due':
      return 'Past due';
    case 'paused':
      return 'Paused';
    case 'canceled':
      return 'Canceled';
    case 'trial_expired':
      return 'Trial ended';
    case 'unpaid':
      return 'Unpaid';
    case 'incomplete':
      return 'Payment incomplete';
    case 'unknown':
      return 'Status unavailable';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function UserAccountLive() {
  const { workspace, setWorkspace } = useUserWorkspace();
  const [nav, setNav] = useState<NavStateResponse | null>(null);
  const [navError, setNavError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMessage, setPwMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    void fetch('/api/backend/user/nav-state')
      .then(async (r) => (await r.json()) as NavStateResponse)
      .then((body) => {
        if (!body.ok) setNavError(body.error ?? 'unknown_error');
        else {
          setNav(body);
          setWorkspace({
            shopName: body.shopName?.trim() || workspace.shopName,
            plan: body.plan?.trim() || workspace.plan,
          });
        }
      })
      .catch(() => setNavError('network_error'));
  }, []);

  const extraStyles = useMemo(
    () => [
      ...userDashboardStyles,
      String.raw`
.account-page{margin-top:0}
.account-page-grid{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr);
  gap:18px;
  align-items:start;
}
@media (max-width:900px){
  .account-page-grid{grid-template-columns:1fr}
}
.account-col-right{display:flex;flex-direction:column;gap:18px}
.account-card-compact{padding:24px}
.account-card-compact .panel-head{margin-bottom:12px}
.account-card-compact h3{margin:0 0 4px;font-size:17px;letter-spacing:-.28px}
.account-card-compact p.sub{margin:0 0 12px;font-size:13px;line-height:1.5;color:var(--text-gray)}
.account-dl{margin:0;padding:0}
.account-dl-row{
  display:grid;
  grid-template-columns:minmax(100px,36%) minmax(0,1fr);
  gap:10px 16px;
  padding:10px 0;
  border-bottom:1px solid #f0f1f3;
  align-items:baseline;
}
.account-dl-row:last-child{border-bottom:none;padding-bottom:0}
.account-dl-row dt{
  margin:0;
  font-size:11px;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:.08em;
  color:var(--text-light);
}
.account-dl-row dd{margin:0;font-size:14px;color:var(--text-dark);line-height:1.45;word-break:break-word}
@media (max-width:520px){
  .account-dl-row{grid-template-columns:1fr;gap:4px;padding:12px 0}
}
.account-password-inner{max-width:520px}
.account-password-inner .field{margin-bottom:14px}
.account-password-inner .field:last-of-type{margin-bottom:0}
.account-password-hint{margin:0 0 14px;font-size:12px;color:var(--text-gray);line-height:1.5}
.account-password-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.account-password-actions .btn.purple{width:auto;min-width:140px}
@media (max-width:520px){
  .account-password-actions .btn.purple{width:100%;min-width:0}
}
.account-actions-stack{display:flex;flex-direction:column;gap:10px;align-items:stretch;margin-top:4px}
.account-actions-stack .btn{justify-content:center}
@media (min-width:521px){
  .account-actions-stack .btn{align-self:flex-start;width:auto;min-width:200px}
}
      `,
    ],
    [],
  );

  const submitPassword = useCallback(async () => {
    setPwMessage(null);
    if (newPassword.length < 8) {
      setPwMessage({ type: 'err', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'err', text: 'New password and confirmation do not match.' });
      return;
    }
    setPwLoading(true);
    try {
      const response = await fetch('/api/backend/user/password', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || !body.ok) {
        const err =
          body.error === 'invalid_current_password'
            ? 'Current password is incorrect.'
            : body.error === 'password_unchanged'
              ? 'Choose a different new password.'
              : body.error === 'invalid_payload'
                ? 'Check password fields and try again.'
                : apiUserVisibleMessage(body, 'Could not update password.');
        setPwMessage({ type: 'err', text: err });
        return;
      }
      setPwMessage({ type: 'ok', text: 'Password updated. Use it next time you sign in.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPwMessage({ type: 'err', text: 'Network error. Try again.' });
    } finally {
      setPwLoading(false);
    }
  }, [confirmPassword, currentPassword, newPassword]);

  async function signOut() {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
    window.location.href = '/user/login';
  }

  return (
    <UserLayout styles={extraStyles} scripts={userDashboardScripts} scriptPrefix="user-account-live">
      <>
        <div className="app-shell user-app-shell">
          <UserPortalSidebar
            active="account"
            workspaceOverride={{
              shopName: workspace.shopName,
              plan: workspace.plan,
              active: workspace.active,
            }}
          />

          <main className="main account-page">
            <UserPortalTopbar
              title="Your account"
              subtitle="Manage your login, plan, and security settings."
            />

            {navError ? (
              <div className="note" style={{ marginBottom: 16 }}>
                Unable to load account details: {navError}
              </div>
            ) : null}

            <div className="account-page-grid">
              <div className="account-col account-col-left">
                <section className="card account-card-compact">
                  <div className="panel-head">
                    <div>
                      <h3>Account details</h3>
                      <p className="sub">Signed-in user and your business on RingBooker.</p>
                    </div>
                  </div>
                  {!nav?.ok ? (
                    <p className="sub" style={{ marginBottom: 0 }}>
                      Loading…
                    </p>
                  ) : (
                    <dl className="account-dl">
                      <div className="account-dl-row">
                        <dt>Email</dt>
                        <dd>{nav.email ?? '—'}</dd>
                      </div>
                      <div className="account-dl-row">
                        <dt>Display name</dt>
                        <dd>{nav.userName?.trim() ? nav.userName : '—'}</dd>
                      </div>
                      <div className="account-dl-row">
                        <dt>Business</dt>
                        <dd>{nav.shopName ?? '—'}</dd>
                      </div>
                      <div className="account-dl-row">
                        <dt>Plan</dt>
                        <dd>{planLabel(nav.plan)}</dd>
                      </div>
                      <div className="account-dl-row">
                        <dt>Billing status</dt>
                        <dd>{subscriptionFriendlyLabel(nav.subscriptionStatus)}</dd>
                      </div>
                    </dl>
                  )}
                </section>
              </div>

              <div className="account-col account-col-right">
                <section className="card account-card-compact">
                  <div className="panel-head">
                    <div>
                      <h3>Change password</h3>
                      <p className="sub">Use a strong password you do not reuse elsewhere.</p>
                    </div>
                  </div>

                  {pwMessage ? (
                    <div
                      className="note"
                      style={{
                        marginBottom: 14,
                        color: pwMessage.type === 'err' ? '#b91c1c' : '#047857',
                      }}
                    >
                      {pwMessage.text}
                    </div>
                  ) : null}

                  <div className="account-password-inner">
                    <p className="account-password-hint">Use at least 8 characters.</p>
                    <div className="field">
                      <label htmlFor="account-current-password">Current password</label>
                      <input
                        id="account-current-password"
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="account-new-password">New password</label>
                      <input
                        id="account-new-password"
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="account-confirm-password">Confirm new password</label>
                      <input
                        id="account-confirm-password"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                    <div className="account-password-actions">
                      <button
                        type="button"
                        className="btn purple"
                        disabled={pwLoading}
                        onClick={() => void submitPassword()}
                      >
                        {pwLoading ? 'Updating…' : 'Update password'}
                      </button>
                    </div>
                  </div>
                </section>

                <section className="card account-card-compact">
                  <div className="panel-head">
                    <div>
                      <h3>Account actions</h3>
                      <p className="sub">Business profile and session.</p>
                    </div>
                  </div>
                  <div className="account-actions-stack">
                    <a className="btn purple" href="/user/settings">
                      Edit business settings
                    </a>
                    <button type="button" className="btn" onClick={() => void signOut()}>
                      Sign out
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </main>
        </div>
        <UserPortalMobileTabbar active="account" />
      </>
    </UserLayout>
  );
}
