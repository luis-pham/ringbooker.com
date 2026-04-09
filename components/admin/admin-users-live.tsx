'use client';

import { useState, type FormEvent } from 'react';

export function AdminUsersLive() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    } catch {
      setError('network_error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ marginTop: 12 }}>
      <h2>Admin Invite (Live)</h2>
      <form onSubmit={onInvite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ops-admin@ringbooker.local"
          style={{ padding: 8, minWidth: 280 }}
        />
        <button type="submit" disabled={loading} style={{ padding: '8px 12px' }}>
          {loading ? 'Inviting...' : 'Send invite'}
        </button>
      </form>
      {message ? <p>{message}</p> : null}
      {error ? <p>Invite failed: {error}</p> : null}
    </section>
  );
}
