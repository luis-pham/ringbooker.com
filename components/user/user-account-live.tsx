'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import {
  USER_PORTAL_TOPBAR_ACTIONS_CLASS,
  UserPortalStandardTopActions,
} from '@/components/user/user-portal-standard-top-actions';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';
import { userSettingsStyles } from '@/components/user/user-settings';
import { useUserWorkspace } from '@/components/user/user-workspace-context';
import { userDashboardScripts } from '@/components/user/user-dashboard';
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

type AccountSettingsSaveResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  shop?: { user_name?: string | null; name?: string };
};

type AccountTabId = 'details' | 'password';

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

function AccountTabIcon({ tabId }: { tabId: AccountTabId }): ReactNode {
  const wrap = (children: ReactNode) => (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );

  switch (tabId) {
    case 'details':
      return wrap(
        <>
          <circle cx={12} cy={8} r={4} />
          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        </>,
      );
    case 'password':
      return wrap(
        <>
          <rect x={5} y={11} width={14} height={10} rx={2} />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </>,
      );
    default:
      return null;
  }
}

const ACCOUNT_TABS: Array<{ id: AccountTabId; label: string; description: string }> = [
  { id: 'details', label: 'Account details', description: 'Your login identity, business summary, and billing status.' },
  { id: 'password', label: 'Change password', description: 'Update the password you use to sign in.' },
];

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

export function UserAccountLive() {
  const { workspace, setWorkspace } = useUserWorkspace();
  const [nav, setNav] = useState<NavStateResponse | null>(null);
  const [navError, setNavError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AccountTabId>('details');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMessage, setPwMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);
  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [contactNameDraft, setContactNameDraft] = useState('');
  const [accountSaveLoading, setAccountSaveLoading] = useState(false);
  const [accountSaveMessage, setAccountSaveMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

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

  const accountStyles = useMemo(
    () => [
      ...userSettingsStyles,
      String.raw`
.rb-account-page{margin-top:0}
.rb-account-intro{margin:0 0 18px;font-size:15px;line-height:1.55;color:var(--text-gray)}
@media(max-width:860px){
  .rb-account-page .tab-strip{grid-template-columns:repeat(2,minmax(0,1fr));}
}
.rb-account-card{
  background:var(--surface-card);border-radius:12px;padding:24px;
  border:1px solid var(--border);
  box-shadow:none;
}
.rb-account-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:24px}
.rb-account-card-head-main{display:flex;align-items:center;gap:10px;min-width:0}
.rb-account-section-icon{flex-shrink:0;color:var(--purple-dark)}
.rb-account-card-head h2{margin:0;font-size:20px;font-weight:600;letter-spacing:-.02em;line-height:1.3;color:var(--text-dark)}
.rb-account-link{font-size:14px;font-weight:600;color:var(--purple-dark);text-decoration:none}
.rb-account-link:hover{text-decoration:underline}
button.rb-account-link{font:inherit;font-size:14px;font-weight:600;color:var(--purple-dark);background:none;border:none;padding:0;cursor:pointer;text-decoration:none;text-align:right}
button.rb-account-link:hover{text-decoration:underline}
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
  margin-top:24px;padding:14px 16px;border-radius:10px;background:#f9fafb;
  display:flex;align-items:flex-start;gap:12px;
  border:1px solid var(--border);
}
.rb-account-callout p{margin:0;font-size:13px;line-height:1.55;color:var(--text-gray)}
.rb-account-subsection{margin-top:28px;padding-top:22px;border-top:1px solid var(--border)}
.rb-account-subsection:first-of-type{margin-top:0;padding-top:0;border-top:none}
.rb-account-subsection-head{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
.rb-account-subsection-title{margin:0;font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-gray)}
.rb-account-subsection-lead{margin:6px 0 0;flex:1 1 100%;font-size:13px;line-height:1.5;color:var(--text-gray);max-width:40rem}
.rb-account-field-hint{margin:6px 0 0;font-size:12px;line-height:1.45;color:var(--text-gray);max-width:36rem}
.rb-account-inline-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:12px}
.rb-account-btn-ghost{
  font:inherit;font-size:13px;font-weight:650;color:var(--text-dark);
  background:var(--surface-card);border:1px solid var(--border);border-radius:8px;padding:8px 14px;cursor:pointer;
}
.rb-account-btn-ghost:hover:not(:disabled){background:#f9fafb;border-color:#d1d5db}
.rb-account-btn-ghost:disabled{opacity:.55;cursor:not-allowed}
.rb-account-password-actions{margin-top:18px}
.account-password-hint{margin:0 0 14px;font-size:13px;color:var(--text-gray);line-height:1.5}
@media(min-width:521px){
  .rb-account-password-actions .btn.user-save{width:100%}
}
html[data-user-theme="dark"] .rb-account-callout{background:#161b22;border-color:var(--border)}
html[data-user-theme="dark"] .rb-account-btn-ghost:hover:not(:disabled){background:#21262d;border-color:#58a6ff}
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

  const submitAccountContact = useCallback(async () => {
    setAccountSaveMessage(null);
    const trimmed = contactNameDraft.trim();
    if (trimmed.length < 1) {
      setAccountSaveMessage({ type: 'err', text: 'Enter your name (at least one character).' });
      return;
    }
    if (trimmed.length > 120) {
      setAccountSaveMessage({ type: 'err', text: 'Name must be 120 characters or fewer.' });
      return;
    }
    setAccountSaveLoading(true);
    try {
      const response = await fetch('/api/backend/user/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_name: trimmed }),
      });
      const body = (await response.json()) as AccountSettingsSaveResponse;
      if (!response.ok || !body.ok) {
        const msg =
          body.error === 'plan_feature_locked'
            ? 'Your plan does not allow updating this field. Upgrade to continue.'
            : apiUserVisibleMessage(body, 'Could not save your name.');
        setAccountSaveMessage({ type: 'err', text: msg });
        return;
      }
      const nextName = body.shop?.user_name?.trim() ?? trimmed;
      setNav((prev) => (prev?.ok ? { ...prev, userName: nextName } : prev));
      setAccountSaveMessage({ type: 'ok', text: 'Your name was updated.' });
      setAccountEditOpen(false);
    } catch {
      setAccountSaveMessage({ type: 'err', text: 'Network error. Try again.' });
    } finally {
      setAccountSaveLoading(false);
    }
  }, [contactNameDraft]);

  const showBillingHint = nav?.ok && !subscriptionLooksHealthy(nav.subscriptionStatus);

  return (
    <UserLayout styles={accountStyles} scripts={userDashboardScripts} scriptPrefix="user-account-live">
      <>
        <div className="app-shell user-app-shell">
          <UserPortalSidebar active="account" />

          <main className="main account-page rb-account-page">
            <UserPortalTopbar
              title="Your account"
              subtitle="Manage your login and security."
              actionsClassName={USER_PORTAL_TOPBAR_ACTIONS_CLASS}
              actions={<UserPortalStandardTopActions />}
            />

            {navError ? (
              <div className="note" style={{ marginBottom: 16 }}>
                Unable to load account details: {navError}
              </div>
            ) : null}

            <div className="tab-strip" role="tablist" aria-label="Account sections">
              {ACCOUNT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`account-tab-${tab.id}`}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`account-panel-${tab.id}`}
                  title={tab.description}
                  className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id !== 'details') {
                      setAccountEditOpen(false);
                      setAccountSaveMessage(null);
                    }
                  }}
                >
                  <span className="tab-button-icon">
                    <AccountTabIcon tabId={tab.id} />
                  </span>
                  <span className="tab-button-body">
                    <strong>{tab.label}</strong>
                    <span className="tab-button-desc">{tab.description}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="section-stack">
              {activeTab === 'details' ? (
                <section className="rb-account-card" role="tabpanel" id="account-panel-details" aria-labelledby="account-tab-details">
                  <div className="rb-account-card-head">
                    <div className="rb-account-card-head-main">
                      <IconBadge className="rb-account-section-icon" />
                      <h2>Account details</h2>
                    </div>
                  </div>

                  {!nav?.ok ? (
                    <p className="sub" style={{ margin: 0 }}>
                      Loading…
                    </p>
                  ) : (
                    <>
                      <div className="rb-account-subsection">
                        <div className="rb-account-subsection-head">
                          <div>
                            <h3 className="rb-account-subsection-title">Your account</h3>
                            <p className="rb-account-subsection-lead">
                              Sign-in identity and how your name appears in the product (same as “Primary contact name” in business settings).
                            </p>
                          </div>
                          {!accountEditOpen ? (
                            <button
                              type="button"
                              className="rb-account-link"
                              onClick={() => {
                                setContactNameDraft(nav.userName?.trim() ?? '');
                                setAccountSaveMessage(null);
                                setAccountEditOpen(true);
                              }}
                            >
                              Edit details
                            </button>
                          ) : null}
                        </div>

                        {accountSaveMessage ? (
                          <div
                            className="note"
                            style={{
                              marginBottom: 14,
                              color: accountSaveMessage.type === 'err' ? '#b91c1c' : '#047857',
                            }}
                          >
                            {accountSaveMessage.text}
                          </div>
                        ) : null}

                        <dl className="rb-account-rows">
                          <div className="rb-account-row">
                            <dt>Email</dt>
                            <dd>
                              <div>{nav.email ?? '—'}</div>
                              <p className="rb-account-field-hint">
                                This is the email you use to sign in. Changing it is not available in the app yet—contact
                                support if you need to update it.
                              </p>
                            </dd>
                          </div>
                          <div className="rb-account-row">
                            <dt>Your name</dt>
                            <dd>
                              {accountEditOpen ? (
                                <div className="field" style={{ marginBottom: 0, maxWidth: 420 }}>
                                  <label htmlFor="account-contact-name">Primary contact name</label>
                                  <input
                                    id="account-contact-name"
                                    type="text"
                                    autoComplete="name"
                                    maxLength={120}
                                    value={contactNameDraft}
                                    onChange={(e) => setContactNameDraft(e.target.value)}
                                  />
                                  <div className="rb-account-inline-actions">
                                    <button
                                      type="button"
                                      className="btn user-save"
                                      disabled={accountSaveLoading}
                                      onClick={() => void submitAccountContact()}
                                    >
                                      {accountSaveLoading ? 'Saving…' : 'Save'}
                                    </button>
                                    <button
                                      type="button"
                                      className="rb-account-btn-ghost"
                                      disabled={accountSaveLoading}
                                      onClick={() => {
                                        setAccountEditOpen(false);
                                        setAccountSaveMessage(null);
                                        setContactNameDraft(nav.userName?.trim() ?? '');
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <span>{nav.userName?.trim() ? nav.userName : '—'}</span>
                              )}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="rb-account-subsection">
                        <div className="rb-account-subsection-head">
                          <div>
                            <h3 className="rb-account-subsection-title">Business & subscription</h3>
                            <p className="rb-account-subsection-lead">
                              Business profile, plan, and billing are managed separately from your login.
                            </p>
                          </div>
                          <a className="rb-account-link" href="/user/settings">
                            Business settings
                          </a>
                        </div>
                        <dl className="rb-account-rows">
                          <div className="rb-account-row">
                            <dt>Business name</dt>
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
                      </div>
                    </>
                  )}

                  {showBillingHint ? (
                    <div className="rb-account-callout">
                      <IconInfo className="rb-account-section-icon" />
                      <p>
                        Your subscription may need attention. Open{' '}
                        <a href="/user/billing" className="rb-account-link">
                          Billing
                        </a>{' '}
                        to review payment and plan status.
                      </p>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {activeTab === 'password' ? (
                <section className="rb-account-card" role="tabpanel" id="account-panel-password" aria-labelledby="account-tab-password">
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
                        className="btn user-save"
                        disabled={pwLoading}
                        onClick={() => void submitPassword()}
                      >
                        {pwLoading ? 'Updating…' : 'Update password'}
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </main>
        </div>
        <UserPortalMobileTabbar active="account" />
      </>
    </UserLayout>
  );
}
