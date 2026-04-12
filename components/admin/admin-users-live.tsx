'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { adminSidebarAddonStyles } from '@/components/admin/admin-sidebar-styles';
import { adminUsersScripts, adminUsersStyles } from '@/components/admin/admin-users';

export function AdminUsersLive() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const inviteDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = inviteDialogRef.current;
    if (!el) return;
    if (inviteOpen) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [inviteOpen]);

  async function onInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch('/api/backend/admin/users/invite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string; resetToken?: string };
      if (!body.ok) {
        setError(body.error ?? 'invite_failed');
        return;
      }
      setMessage(body.resetToken ? `Invite created. Reset token: ${body.resetToken}` : 'Invite created.');
      setEmail('');
      setInviteOpen(false);
    } catch {
      setError('network_error');
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  return (
    <AdminLayout
      styles={[...adminUsersStyles, ...adminSidebarAddonStyles]}
      scripts={adminUsersScripts}
      scriptPrefix="admin-users-live"
      bodyClass="app-body"
    >
      <div className="app-shell">
        <AdminSidebar />
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Users and roles.</h1>
              <p>Manage internal admin access, invites, role scope, and authentication expectations.</p>
            </div>
            <div className="top-actions">
              <a className="btn" href="/user/login">
                Open login
              </a>
              <button type="button" className="btn ghost" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </div>

          <section className="grid grid-3">
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                    <circle cx="9.5" cy={7} r={3} />
                    <path d="M20 8v6" />
                    <path d="M17 11h6" />
                  </svg>
                </div>
                <span className="tag purple">6 total</span>
              </div>
              <div className="stat-value">4</div>
              <div className="stat-meta">Admins with full access</div>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24">
                    <circle cx={12} cy={12} r={3} />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .67.39 1.28 1 1.51.16.06.33.09.51.09H21a2 2 0 0 1 0 4h-.09c-.18 0-.35.03-.51.09-.61.23-1 .84-1 1.51Z" />
                  </svg>
                </div>
                <span className="tag green">2FA</span>
              </div>
              <div className="stat-value">83%</div>
              <div className="stat-meta">Team accounts with 2FA enabled</div>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M3 12h4l2-5 4 10 2-5h6" />
                  </svg>
                </div>
                <span className="tag orange">1 pending</span>
              </div>
              <div className="stat-value">2</div>
              <div className="stat-meta">Outstanding invites</div>
            </div>
          </section>

          <section className="card" style={{ marginTop: 18 }}>
            <div className="panel-head">
              <div>
                <h3>Team directory</h3>
                <p className="sub">People with access to the admin backoffice.</p>
              </div>
              <button
                type="button"
                className="btn-icon purple"
                title="Invite user"
                aria-label="Invite user"
                onClick={() => setInviteOpen(true)}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy={7} r={4} />
                  <path d="M20 8v6M23 11h-6" />
                </svg>
              </button>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Last seen</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Huy Pham</td>
                  <td>Super admin</td>
                  <td>2 min ago</td>
                  <td>
                    <span className="tag green">Active</span>
                  </td>
                </tr>
                <tr>
                  <td>Mai Tran</td>
                  <td>Ops admin</td>
                  <td>18 min ago</td>
                  <td>
                    <span className="tag green">Active</span>
                  </td>
                </tr>
                <tr>
                  <td>Chris Nguyen</td>
                  <td>Support lead</td>
                  <td>1h ago</td>
                  <td>
                    <span className="tag green">Active</span>
                  </td>
                </tr>
                <tr>
                  <td>Lan Le</td>
                  <td>Billing admin</td>
                  <td>Yesterday</td>
                  <td>
                    <span className="tag orange">Limited</span>
                  </td>
                </tr>
                <tr>
                  <td>Quynh Ho</td>
                  <td>Support admin</td>
                  <td>Invite pending</td>
                  <td>
                    <span className="tag blue">Pending</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {message ? (
            <div className="note" style={{ marginTop: 18 }}>
              {message}
            </div>
          ) : null}
          {error && !inviteOpen ? (
            <div className="note" style={{ marginTop: 18 }}>
              Invite failed: {error}
            </div>
          ) : null}

          <dialog
            ref={inviteDialogRef}
            className="rb-admin-modal"
            onClose={() => {
              setInviteOpen(false);
              setError(null);
            }}
          >
            <div className="rb-admin-modal-head">
              <div>
                <h3 style={{ margin: '0 0 6px' }}>Invite admin</h3>
                <p className="sub" style={{ margin: 0 }}>
                  Send an email invite. The recipient completes signup from the link.
                </p>
              </div>
              <button type="button" className="btn ghost" onClick={() => inviteDialogRef.current?.close()}>
                Close
              </button>
            </div>
            <div className="rb-admin-modal-body">
              <form onSubmit={onInvite} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ops-admin@ringbooker.local"
                    autoFocus
                  />
                </div>
                {error ? (
                  <div className="note" style={{ marginTop: 0 }}>
                    {error}
                  </div>
                ) : null}
                <div className="top-actions" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn ghost" onClick={() => inviteDialogRef.current?.close()}>
                    Cancel
                  </button>
                  <button type="submit" className="btn purple" disabled={loading}>
                    {loading ? 'Sending…' : 'Send invite'}
                  </button>
                </div>
              </form>
            </div>
          </dialog>
        </main>
      </div>
    </AdminLayout>
  );
}
