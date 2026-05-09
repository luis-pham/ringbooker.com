'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { readCachedAccountNavPanel, writeCachedAccountNavPanel } from '@/components/user/user-account-nav-cache';
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

const ACCOUNT_TABS: Array<{ id: AccountTabId; label: string; description: string }> = [
  { id: 'details', label: 'Account Details', description: 'Email, name, and workspace summary.' },
  { id: 'password', label: 'Change password', description: 'Update the password you use to sign in.' },
];

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

/** Stable layout while `/api/backend/user/nav-state` loads (no “Loading…” flash). */
function AccountDetailsSkeleton() {
  const bar = (wide?: boolean) => (
    <span className={`rb-account-skel-bar${wide ? ' rb-account-skel-bar--wide' : ''}`} />
  );
  return (
    <>
      <div className="rb-account-subsection">
        <div className="rb-account-subsection-head rb-account-skel-head">{bar()}</div>
        <dl className="rb-account-rows">
          <div className="rb-account-row">
            <dt>{bar()}</dt>
            <dd>{bar(true)}</dd>
          </div>
          <div className="rb-account-row">
            <dt>{bar()}</dt>
            <dd>{bar(true)}</dd>
          </div>
        </dl>
      </div>
      <div className="rb-account-subsection">
        <div className="rb-account-subsection-head rb-account-skel-head">{bar()}</div>
        <dl className="rb-account-rows">
          {[1, 2, 3].map((key) => (
            <div key={key} className="rb-account-row">
              <dt>{bar()}</dt>
              <dd>{bar(true)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
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

  useLayoutEffect(() => {
    const cached = readCachedAccountNavPanel();
    if (!cached) return;
    setNav((prev) => {
      if (prev?.ok) return prev;
      return {
        ok: true,
        email: cached.email,
        shopName: cached.shopName,
        userName: cached.userName ?? '',
        plan: cached.plan,
        subscriptionStatus: cached.subscriptionStatus ?? null,
      };
    });
  }, []);

  useEffect(() => {
    void fetch('/api/backend/user/nav-state')
      .then(async (r) => (await r.json()) as NavStateResponse)
      .then((body) => {
        if (!body.ok) setNavError(body.error ?? 'unknown_error');
        else {
          setNav(body);
          writeCachedAccountNavPanel({
            email: body.email,
            shopName: body.shopName,
            userName: body.userName,
            plan: body.plan,
            subscriptionStatus: body.subscriptionStatus ?? null,
          });
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
/* Centered shell — widened on desktop; compact on mobile */
.rb-account-shell{
  width:100%;max-width:680px;margin:0 auto;padding:22px 0 36px;box-sizing:border-box;
}
.rb-account-frame{
  background:var(--surface-card);border:1px solid var(--border);border-radius:16px;
  overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.06);
}
.rb-account-frame-head{
  padding:20px 22px 16px;border-bottom:1px solid var(--border);
}
.rb-account-frame-head h2{
  margin:0;font-size:18px;font-weight:780;letter-spacing:-.03em;line-height:1.25;color:var(--text-dark);
}
/* Same subtabs as Messaging (SMS automations / Messaging notes) in Settings */
.rb-account-subtabs.business-subtabs{margin-bottom:0;padding:12px 22px 14px;border-bottom:1px solid var(--border)}
.rb-account-panel{padding:22px 22px 24px}
.rb-account-panel-title{
  margin:0 0 18px;font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-gray);
}
@media(min-width:861px){
  .rb-account-shell{max-width:760px;padding:26px 0 40px}
  .rb-account-frame-head{padding:22px 28px 18px}
  .rb-account-frame-head h2{font-size:19px}
  .rb-account-subtabs.business-subtabs{padding:14px 28px 16px}
  .rb-account-panel{padding:26px 28px 30px}
}
@media(max-width:860px){
  .rb-account-shell{padding:18px 0 30px;max-width:100%}
  .rb-account-subtabs.business-subtabs{padding:10px 18px 12px}
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
  display:flex;align-items:center;gap:12px;
  border:1px solid var(--border);
}
.rb-account-subsection{margin-top:28px;padding-top:22px;border-top:1px solid var(--border)}
.rb-account-subsection:first-of-type{margin-top:0;padding-top:0;border-top:none}
.rb-account-subsection-head{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
.rb-account-subsection-title{margin:0;font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-gray)}
.rb-account-inline-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:12px}
.rb-account-btn-ghost{
  font:inherit;font-size:13px;font-weight:650;color:var(--text-dark);
  background:var(--surface-card);border:1px solid var(--border);border-radius:8px;padding:8px 14px;cursor:pointer;
}
.rb-account-btn-ghost:hover:not(:disabled){background:#f9fafb;border-color:#d1d5db}
.rb-account-btn-ghost:disabled{opacity:.55;cursor:not-allowed}
.rb-account-password-actions{margin-top:18px}
@media(min-width:521px){
  .rb-account-password-actions .btn.user-save{width:100%}
}
html[data-user-theme="dark"] .rb-account-callout{background:#161b22;border-color:var(--border)}
html[data-user-theme="dark"] .rb-account-btn-ghost:hover:not(:disabled){background:#21262d;border-color:#58a6ff}
html[data-user-theme="dark"] .rb-account-frame{box-shadow:none}
html[data-user-theme="dark"] .rb-account-frame-head{border-bottom-color:var(--border)}
html[data-user-theme="dark"] .rb-account-subtabs.business-subtabs{border-bottom-color:var(--border)}
.rb-account-skel-head .rb-account-skel-bar{max-width:128px;height:12px}
.rb-account-skel-bar{
  display:inline-block;height:14px;border-radius:7px;width:100%;max-width:200px;
  background:linear-gradient(90deg,#eef0f2 0%,#dfe3e8 45%,#eef0f2 90%);
  background-size:200% 100%;
  animation:rb-go-live-nav-shimmer 1.15s ease-in-out infinite;
  vertical-align:middle;
}
.rb-account-skel-bar--wide{max-width:min(100%,280px)}
.rb-account-row dt .rb-account-skel-bar{max-width:92px;height:11px}
html[data-user-theme="dark"] .rb-account-skel-bar{
  background:linear-gradient(90deg,#21262d 0%,#30363d 45%,#21262d 90%);
  background-size:200% 100%;
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
              subtitle={undefined}
              actionsClassName={USER_PORTAL_TOPBAR_ACTIONS_CLASS}
              actions={<UserPortalStandardTopActions />}
            />

            <div className="rb-account-shell">
              {navError ? (
                <div className="note" style={{ marginBottom: 16 }}>
                  Unable to load account details: {navError}
                </div>
              ) : null}

              <div className="rb-account-frame">
                <header className="rb-account-frame-head">
                  <h2>Your account</h2>
                </header>

                <div className="business-subtabs rb-account-subtabs" role="tablist" aria-label="Account sections">
                  {ACCOUNT_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      id={`account-tab-${tab.id}`}
                      aria-selected={activeTab === tab.id}
                      aria-controls={`account-panel-${tab.id}`}
                      title={tab.description}
                      className={`business-subtab ${activeTab === tab.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab(tab.id);
                        if (tab.id !== 'details') {
                          setAccountEditOpen(false);
                          setAccountSaveMessage(null);
                        }
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'details' ? (
                  <div
                    className="rb-account-panel"
                    role="tabpanel"
                    id="account-panel-details"
                    aria-labelledby="account-tab-details"
                  >
                    <p className="rb-account-panel-title">Profile &amp; workspace</p>

                    {!nav?.ok ? (
                      <AccountDetailsSkeleton />
                    ) : (
                      <>
                        <div className="rb-account-subsection">
                          <div className="rb-account-subsection-head">
                            <h3 className="rb-account-subsection-title">Your account</h3>
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
                              <dd>{nav.email ?? '—'}</dd>
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
                            <h3 className="rb-account-subsection-title">Business & subscription</h3>
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
                        <a href="/user/billing" className="rb-account-link">
                          Billing
                        </a>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {activeTab === 'password' ? (
                  <div
                    className="rb-account-panel"
                    role="tabpanel"
                    id="account-panel-password"
                    aria-labelledby="account-tab-password"
                  >
                    <p className="rb-account-panel-title">Security</p>

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
                  </div>
                ) : null}
              </div>
            </div>
          </main>
        </div>
        <UserPortalMobileTabbar active="account" />
      </>
    </UserLayout>
  );
}
