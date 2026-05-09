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

function subscriptionLooksHealthy(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing';
}

function IconBadge(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden className={props.className}>
      <path
        fill="currentColor"
        d="M14 12c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-2.21 0-4 1.79-4 4v3H7c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2h-1V8c0-2.21-1.79-4-4-4zm0 2c1.1 0 2 .9 2 2v3H8V8c0-1.1.9-2 2-2zm8 10v8H4v-8h16z"
      />
    </svg>
  );
}

function IconLock(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden className={props.className}>
      <path
        fill="currentColor"
        d="M18 10h-1V8c0-3.31-2.69-6-6-6S5 4.69 5 8v2H4c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2zm-7 7c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4-7H9V8c0-2.21 1.79-4 4-4s4 1.79 4 4v2z"
      />
    </svg>
  );
}

function IconBolt(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden className={props.className}>
      <path fill="currentColor" d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08-.07-.12C8.48 10.94 10.42 7.54 11 7h1l-1 7h3.5c.49 0 .56.33.47.51-.1.17-.51 1.03-.51 1.03-.17.34-.66 1.46-.66 1.46z" />
    </svg>
  );
}

function IconInfo(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden className={props.className}>
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
      />
    </svg>
  );
}

function IconSettingsRow(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden className={props.className}>
      <path
        fill="currentColor"
        d="M19.43 12.98c.04-.32.07-.64.07-.98 0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98 0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"
      />
    </svg>
  );
}

function IconLogoutRow(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden className={props.className}>
      <path
        fill="currentColor"
        d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
      />
    </svg>
  );
}

function IconChevronRight(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden className={props.className}>
      <path fill="currentColor" d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
    </svg>
  );
}

function IconOpenInNew(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden className={props.className}>
      <path
        fill="currentColor"
        d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"
      />
    </svg>
  );
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
.rb-account-page{margin-top:0}
.rb-account-intro{margin:0 0 24px;font-size:15px;line-height:1.55;color:var(--text-gray)}
.rb-account-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:24px;align-items:start;max-width:80rem;margin:0 auto}
.rb-account-col-main{grid-column:span 12;display:flex;flex-direction:column;gap:24px}
.rb-account-col-aside{grid-column:span 12;display:flex;flex-direction:column;gap:24px}
@media(min-width:1024px){
  .rb-account-col-main{grid-column:span 7}
  .rb-account-col-aside{grid-column:span 5}
}
.rb-account-card{
  background:var(--surface-card);border-radius:12px;padding:24px;
  border:1px solid var(--border);
  box-shadow:var(--card-shadow-material);
}
.rb-account-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:24px}
.rb-account-card-head-main{display:flex;align-items:center;gap:10px;min-width:0}
.rb-account-section-icon{flex-shrink:0;color:var(--purple-dark)}
.rb-account-card-head h2{margin:0;font-size:20px;font-weight:600;letter-spacing:-.02em;line-height:1.3;color:var(--text-dark)}
.rb-account-link{font-size:14px;font-weight:600;color:var(--purple-dark);text-decoration:none}
.rb-account-link:hover{text-decoration:underline}
.rb-account-rows{display:flex;flex-direction:column}
.rb-account-row{
  display:flex;flex-direction:column;gap:4px;padding:10px 0;border-bottom:1px solid var(--border);
}
@media(min-width:640px){
  .rb-account-row{flex-direction:row;align-items:center;gap:16px}
}
.rb-account-row:last-child{border-bottom:none;padding-bottom:0}
.rb-account-row dt{margin:0;width:12rem;flex-shrink:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-gray)}
.rb-account-row dd{margin:0;font-size:15px;font-weight:500;color:var(--text-dark);line-height:1.45;word-break:break-word}
.rb-account-plan-pill{
  display:inline-flex;align-items:center;margin-left:8px;padding:2px 10px;border-radius:999px;
  font-size:11px;font-weight:700;background:#f5f3ff;color:var(--purple-dark);vertical-align:middle;
}
.rb-account-billing-warn{color:var(--red-deep);font-weight:600}
.rb-account-callout{
  margin-top:24px;padding:14px 16px;border-radius:10px;background:#f3f4f6;
  display:flex;align-items:flex-start;gap:12px;
}
.rb-account-callout p{margin:0;font-size:13px;line-height:1.55;color:var(--text-gray)}
.rb-account-banner{
  position:relative;height:192px;border-radius:12px;overflow:hidden;
  box-shadow:var(--card-shadow-material);
  background:linear-gradient(135deg,#7c3aed 0%,#630ed4 45%,#4648d4 100%);
}
.rb-account-banner::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(to top,rgba(99,14,212,.88),transparent 65%);
  pointer-events:none;
}
.rb-account-banner-inner{position:relative;z-index:1;height:100%;padding:24px;display:flex;flex-direction:column;justify-content:flex-end}
.rb-account-banner-inner h3{margin:0 0 6px;font-size:20px;font-weight:600;color:#fff;letter-spacing:-.02em}
.rb-account-banner-inner p{margin:0;font-size:15px;line-height:1.5;color:rgba(237,224,255,.95)}
.rb-account-actions{display:flex;flex-direction:column;gap:10px}
.rb-account-action{
  width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:14px 16px;border-radius:10px;border:1px solid var(--border);
  background:var(--surface-card);font:inherit;font-size:14px;font-weight:600;color:var(--text-dark);
  cursor:pointer;text-align:left;text-decoration:none;transition:background .15s ease;
}
.rb-account-action:hover{background:#f3f4f6}
.rb-account-action-left{display:flex;align-items:center;gap:12px;min-width:0}
.rb-account-action-danger{border-color:rgba(186,26,26,.25);color:var(--red-deep)}
.rb-account-action-danger:hover{background:rgba(186,26,26,.06)}
.rb-account-action-danger .rb-account-action-icon{color:var(--red-deep)}
.rb-account-action-icon{color:var(--text-gray);flex-shrink:0}
.rb-account-action:hover .rb-account-action-icon{color:var(--purple-dark)}
.rb-account-help{
  background:var(--secondary-accent);color:#fff;border-radius:12px;padding:24px;
  box-shadow:var(--card-shadow-material);
}
.rb-account-help h4{margin:0 0 8px;font-size:20px;font-weight:600;letter-spacing:-.02em}
.rb-account-help p{margin:0 0 16px;font-size:13px;line-height:1.55;opacity:.92}
.rb-account-help a{
  display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;
}
.rb-account-help a:hover{text-decoration:underline}
.rb-account-password-actions{margin-top:18px}
.rb-account-action-danger:hover .rb-account-chevron-muted{opacity:.45;color:rgba(186,26,26,.55)}
.rb-account-chevron-muted{opacity:.35}
@media(min-width:521px){
  .rb-account-password-actions .btn.purple{width:100%}
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

  const displayName = nav?.userName?.trim() || nav?.email?.split('@')[0] || 'Your account';
  const userSubtitle = nav?.email?.includes('@') ? nav.email : undefined;
  const showBillingHint = nav?.ok && !subscriptionLooksHealthy(nav.subscriptionStatus);

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

          <main className="main account-page rb-account-page">
            <UserPortalTopbar
              title="Your account"
              userSummary={
                nav?.ok
                  ? {
                      displayName,
                      subtitle: userSubtitle,
                    }
                  : null
              }
            />

            <p className="rb-account-intro">Manage your login, plan, and security settings.</p>

            {navError ? (
              <div className="note" style={{ marginBottom: 16 }}>
                Unable to load account details: {navError}
              </div>
            ) : null}

            <div className="rb-account-grid">
              <div className="rb-account-col-main">
                <section className="rb-account-card">
                  <div className="rb-account-card-head">
                    <div className="rb-account-card-head-main">
                      <IconBadge className="rb-account-section-icon" />
                      <h2>Account details</h2>
                    </div>
                    <a className="rb-account-link" href="/user/settings">
                      Edit details
                    </a>
                  </div>

                  {!nav?.ok ? (
                    <p className="sub" style={{ margin: 0 }}>
                      Loading…
                    </p>
                  ) : (
                    <dl className="rb-account-rows">
                      <div className="rb-account-row">
                        <dt>Email</dt>
                        <dd>{nav.email ?? '—'}</dd>
                      </div>
                      <div className="rb-account-row">
                        <dt>Display name</dt>
                        <dd>{nav.userName?.trim() ? nav.userName : '—'}</dd>
                      </div>
                      <div className="rb-account-row">
                        <dt>Business</dt>
                        <dd>{nav.shopName ?? '—'}</dd>
                      </div>
                      <div className="rb-account-row">
                        <dt>Plan</dt>
                        <dd>
                          <span>{planLabel(nav.plan)}</span>
                          {subscriptionLooksHealthy(nav.subscriptionStatus) ? (
                            <span className="rb-account-plan-pill">Active</span>
                          ) : null}
                        </dd>
                      </div>
                      <div className="rb-account-row">
                        <dt>Billing status</dt>
                        <dd
                          className={
                            subscriptionLooksHealthy(nav.subscriptionStatus) ? undefined : 'rb-account-billing-warn'
                          }
                        >
                          {subscriptionFriendlyLabel(nav.subscriptionStatus)}
                        </dd>
                      </div>
                    </dl>
                  )}

                  {showBillingHint ? (
                    <div className="rb-account-callout">
                      <IconInfo className="rb-account-section-icon" />
                      <p>Update your billing information to unlock premium enterprise features.</p>
                    </div>
                  ) : null}
                </section>

                <section className="rb-account-banner" aria-hidden={false}>
                  <div className="rb-account-banner-inner">
                    <h3>Enterprise ready</h3>
                    <p>Scale RingBooker across your organization with consistent AI reception on every line.</p>
                  </div>
                </section>
              </div>

              <div className="rb-account-col-aside">
                <section className="rb-account-card">
                  <div className="rb-account-card-head" style={{ marginBottom: 16 }}>
                    <div className="rb-account-card-head-main">
                      <IconLock className="rb-account-section-icon" />
                      <h2>Change password</h2>
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
                    <div className="account-password-actions rb-account-password-actions">
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

                <section className="rb-account-card">
                  <div className="rb-account-card-head" style={{ marginBottom: 16 }}>
                    <div className="rb-account-card-head-main">
                      <IconBolt className="rb-account-section-icon" />
                      <h2>Account actions</h2>
                    </div>
                  </div>
                  <div className="rb-account-actions">
                    <a className="rb-account-action" href="/user/settings">
                      <span className="rb-account-action-left">
                        <IconSettingsRow className="rb-account-action-icon" />
                        <span>Edit business settings</span>
                      </span>
                      <IconChevronRight className="rb-account-action-icon" />
                    </a>
                    <button type="button" className="rb-account-action rb-account-action-danger" onClick={() => void signOut()}>
                      <span className="rb-account-action-left">
                        <IconLogoutRow className="rb-account-action-icon" />
                        <span>Sign out</span>
                      </span>
                      <IconChevronRight className="rb-account-action-icon rb-account-chevron-muted" />
                    </button>
                  </div>
                </section>

                <section className="rb-account-help">
                  <h4>Need assistance?</h4>
                  <p>Our team can help with account access, onboarding, or billing questions.</p>
                  <a href="/contact">
                    Contact support
                    <IconOpenInNew />
                  </a>
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
