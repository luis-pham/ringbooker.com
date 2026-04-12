'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { adminSidebarAddonStyles } from '@/components/admin/admin-sidebar-styles';
import { adminUsersScripts, adminUsersStyles } from '@/components/admin/admin-users';

type AdminUserRow = {
  id: string;
  email: string;
  role: 'user' | 'admin';
  shopId?: string | null;
  active: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type UsersListResponse = {
  ok: boolean;
  error?: string;
  users?: AdminUserRow[];
  stats?: {
    total: number;
    adminTotal: number;
    activeAdminCount: number;
    mfaEnabledCount: number;
    mfaPercent: number;
  };
};

function formatCreatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export function AdminUsersLive() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [stats, setStats] = useState<UsersListResponse['stats'] | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const inviteDialogRef = useRef<HTMLDialogElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [editRole, setEditRole] = useState<'user' | 'admin'>('user');
  const [editActive, setEditActive] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const response = await fetch('/api/backend/admin/users', { cache: 'no-store' });
      const body = (await response.json()) as UsersListResponse;
      if (!body.ok || !body.users || !body.stats) {
        setListError(body.error ?? 'load_failed');
        setUsers([]);
        setStats(null);
        return;
      }
      setUsers(body.users);
      setStats(body.stats);
    } catch {
      setListError('network_error');
      setUsers([]);
      setStats(null);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const el = inviteDialogRef.current;
    if (!el) return;
    if (inviteOpen) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [inviteOpen]);

  useEffect(() => {
    const el = editDialogRef.current;
    if (!el) return;
    if (editOpen && editing) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [editOpen, editing]);

  function openEdit(user: AdminUserRow) {
    setEditing(user);
    setEditRole(user.role);
    setEditActive(user.active);
    setNewPassword('');
    setConfirmPassword('');
    setEditError(null);
    setEditOpen(true);
  }

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
      const body = (await response.json()) as {
        ok: boolean;
        error?: string;
        resetToken?: string;
        invited?: boolean;
      };
      if (!body.ok) {
        setError(body.error ?? 'invite_failed');
        return;
      }
      setMessage(
        body.resetToken
          ? `Invite created. Reset token (dev only): ${body.resetToken}`
          : 'Invite created. The new admin can use forgot-password to set a password if needed.',
      );
      setEmail('');
      setInviteOpen(false);
      await loadUsers();
    } catch {
      setError('network_error');
    } finally {
      setLoading(false);
    }
  }

  async function onSaveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setEditLoading(true);
    setEditError(null);
    try {
      if (newPassword || confirmPassword) {
        if (newPassword !== confirmPassword) {
          setEditError('password_mismatch');
          setEditLoading(false);
          return;
        }
        if (newPassword.length < 8) {
          setEditError('password_too_short');
          setEditLoading(false);
          return;
        }
      }

      const roleChanged = editRole !== editing.role;
      const activeChanged = editActive !== editing.active;

      if (roleChanged || activeChanged) {
        const patchResponse = await fetch(`/api/backend/admin/users/${encodeURIComponent(editing.id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...(roleChanged ? { role: editRole } : {}),
            ...(activeChanged ? { active: editActive } : {}),
          }),
        });
        const patchBody = (await patchResponse.json()) as { ok: boolean; error?: string };
        if (!patchBody.ok) {
          setEditError(patchBody.error ?? 'update_failed');
          setEditLoading(false);
          return;
        }
      }

      if (newPassword) {
        const pwResponse = await fetch(`/api/backend/admin/users/${encodeURIComponent(editing.id)}/password`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ newPassword }),
        });
        const pwBody = (await pwResponse.json()) as { ok: boolean; error?: string };
        if (!pwBody.ok) {
          setEditError(pwBody.error ?? 'password_update_failed');
          setEditLoading(false);
          return;
        }
      }

      if (!roleChanged && !activeChanged && !newPassword) {
        setEditError('no_changes');
        setEditLoading(false);
        return;
      }

      setEditOpen(false);
      setEditing(null);
      await loadUsers();
      setMessage('User updated.');
    } catch {
      setEditError('network_error');
    } finally {
      setEditLoading(false);
    }
  }

  async function signOut() {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  const total = stats?.total ?? 0;
  const activeAdminCount = stats?.activeAdminCount ?? 0;
  const mfaPercent = stats?.mfaPercent ?? 0;

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
                <span className="tag purple">Accounts</span>
              </div>
              <div className="stat-value">{listLoading ? '…' : total}</div>
              <div className="stat-meta">Users in auth_users</div>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24">
                    <circle cx={12} cy={12} r={3} />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .67.39 1.28 1 1.51.16.06.33.09.51.09H21a2 2 0 0 1 0 4h-.09c-.18 0-.35.03-.51.09-.61.23-1 .84-1 1.51Z" />
                  </svg>
                </div>
                <span className="tag green">Admins</span>
              </div>
              <div className="stat-value">{listLoading ? '…' : activeAdminCount}</div>
              <div className="stat-meta">Active admin-role accounts</div>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M3 12h4l2-5 4 10 2-5h6" />
                  </svg>
                </div>
                <span className="tag orange">2FA</span>
              </div>
              <div className="stat-value">{listLoading ? '…' : `${mfaPercent}%`}</div>
              <div className="stat-meta">Accounts with MFA enabled</div>
            </div>
          </section>

          <section className="card" style={{ marginTop: 18 }}>
            <div className="panel-head">
              <div>
                <h3>Directory</h3>
                <p className="sub">All auth_users rows (live from database).</p>
              </div>
              <div className="top-actions" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={listLoading}
                  onClick={() => void loadUsers()}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="btn-icon purple"
                  title="Invite admin"
                  aria-label="Invite admin"
                  onClick={() => setInviteOpen(true)}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy={7} r={4} />
                    <path d="M20 8v6M23 11h-6" />
                  </svg>
                </button>
              </div>
            </div>
            {listError ? (
              <div className="note" style={{ margin: '12px 16px' }}>
                Could not load users: {listError}
              </div>
            ) : null}
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Created</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ width: 100 }}> </th>
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr>
                    <td colSpan={5} className="sub">
                      Loading…
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="sub">
                      No users.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td className="sub">{formatCreatedAt(u.createdAt)}</td>
                      <td>{u.role === 'admin' ? 'Admin' : 'User'}</td>
                      <td>
                        <span className={u.active ? 'tag green' : 'tag orange'}>
                          {u.active ? 'Active' : 'Inactive'}
                        </span>
                        {u.mfaEnabled ? (
                          <span className="tag green" style={{ marginLeft: 6 }}>
                            MFA
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <button type="button" className="btn ghost" onClick={() => openEdit(u)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
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
                  Creates an admin account and password reset flow.
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

          <dialog
            ref={editDialogRef}
            className="rb-admin-modal"
            onClose={() => {
              setEditOpen(false);
              setEditing(null);
              setEditError(null);
            }}
          >
            <div className="rb-admin-modal-head">
              <div>
                <h3 style={{ margin: '0 0 6px' }}>Edit user</h3>
                <p className="sub" style={{ margin: 0 }}>
                  {editing?.email}
                </p>
              </div>
              <button type="button" className="btn ghost" onClick={() => editDialogRef.current?.close()}>
                Close
              </button>
            </div>
            <div className="rb-admin-modal-body">
              <form onSubmit={onSaveEdit} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="field">
                  <label htmlFor="edit-role">Role</label>
                  <select
                    id="edit-role"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as 'user' | 'admin')}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="field">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={editActive}
                      onChange={(e) => setEditActive(e.target.checked)}
                    />
                    Active (can sign in)
                  </label>
                </div>
                <div className="field">
                  <label>New password (optional)</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                  />
                </div>
                <div className="field">
                  <label>Confirm new password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat if changing password"
                  />
                </div>
                {editError ? (
                  <div className="note" style={{ marginTop: 0 }}>
                    {editError}
                  </div>
                ) : null}
                <div className="top-actions" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn ghost" onClick={() => editDialogRef.current?.close()}>
                    Cancel
                  </button>
                  <button type="submit" className="btn purple" disabled={editLoading}>
                    {editLoading ? 'Saving…' : 'Save'}
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
