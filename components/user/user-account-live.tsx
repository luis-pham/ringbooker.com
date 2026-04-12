'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalNav } from '@/components/user/user-portal-nav';
import { userDashboardScripts, userDashboardStyles } from '@/components/user/user-dashboard';

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

function subscriptionLabel(status: string | null | undefined) {
  if (!status) return 'No subscription record';
  return status.replace(/_/g, ' ');
}

export function UserAccountLive() {
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
        else setNav(body);
      })
      .catch(() => setNavError('network_error'));
  }, []);

  const extraStyles = useMemo(
    () => [
      ...userDashboardStyles,
      String.raw`
.account-readonly{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
@media (max-width:720px){.account-readonly{grid-template-columns:1fr}}
.account-readonly .meta-tile{
  border:1px solid var(--border);border-radius:18px;padding:14px 16px;
  background:linear-gradient(180deg,#fff 0%,#fcfbff 100%);
}
.account-readonly .meta-tile strong{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-light);margin-bottom:7px}
.account-readonly .meta-tile span{display:block;font-size:14px;color:var(--text-dark);line-height:1.5;word-break:break-all}
.account-password-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
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
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) {
        const err =
          body.error === 'invalid_current_password'
            ? 'Current password is incorrect.'
            : body.error === 'password_unchanged'
              ? 'Choose a different new password.'
              : body.error === 'invalid_payload'
                ? 'Check password fields and try again.'
                : body.error ?? 'Could not update password.';
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
          <aside className="sidebar">
            <div className="sidebar-inner">
              <div className="brand">
                <div className="brand-mark">
                  <div className="brand-ripple r3" />
                  <div className="brand-ripple r2" />
                  <div className="brand-core">
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"
                        fill="#fff"
                        stroke="none"
                      />
                    </svg>
                  </div>
                </div>
                <span>RingBooker</span>
              </div>
              <div className="workspace">
                <h3>Account</h3>
                <p>Sign-in email, plan, and password for your RingBooker user.</p>
              </div>
              <UserPortalNav active="account" />
              <div className="sidebar-spacer" />
            </div>
          </aside>

          <main className="main">
            <div className="topbar">
              <div className="page-title">
                <h1>Your account</h1>
                <p>Review how you sign in and update your password without leaving the portal.</p>
              </div>
              <div className="top-actions">
                <a className="btn" href="/user/settings">
                  Business settings
                </a>
                <button type="button" className="btn" onClick={signOut}>
                  Sign out
                </button>
              </div>
            </div>

            {navError ? (
              <div className="note" style={{ marginBottom: 18 }}>
                Unable to load account details: {navError}
              </div>
            ) : null}

            <section className="card" style={{ marginBottom: 18 }}>
              <div className="panel-head">
                <div>
                  <h3>Profile &amp; plan</h3>
                  <p className="sub">Data from your authenticated session and shop record.</p>
                </div>
              </div>
              {!nav?.ok ? (
                <p className="sub">Loading…</p>
              ) : (
                <div className="account-readonly">
                  <div className="meta-tile">
                    <strong>Email</strong>
                    <span>{nav.email ?? '—'}</span>
                  </div>
                  <div className="meta-tile">
                    <strong>Display name</strong>
                    <span>{nav.userName?.trim() ? nav.userName : '—'}</span>
                  </div>
                  <div className="meta-tile">
                    <strong>Shop</strong>
                    <span>{nav.shopName ?? '—'}</span>
                  </div>
                  <div className="meta-tile">
                    <strong>Plan</strong>
                    <span>{planLabel(nav.plan)}</span>
                  </div>
                  <div className="meta-tile" style={{ gridColumn: '1 / -1' }}>
                    <strong>Billing status</strong>
                    <span>{subscriptionLabel(nav.subscriptionStatus)}</span>
                  </div>
                </div>
              )}
            </section>

            <section className="card">
              <div className="panel-head">
                <div>
                  <h3>Change password</h3>
                  <p className="sub">Enter your current password, then choose a new one (min. 8 characters).</p>
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
              <div className="field" style={{ marginTop: 14 }}>
                <label htmlFor="account-new-password">New password</label>
                <input
                  id="account-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="field" style={{ marginTop: 14 }}>
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
                <button type="button" className="btn purple" disabled={pwLoading} onClick={() => void submitPassword()}>
                  {pwLoading ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </section>
          </main>
        </div>
        <UserPortalMobileTabbar active="account" />
      </>
    </UserLayout>
  );
}
