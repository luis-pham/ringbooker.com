'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function UserResetPasswordForm() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('token');
    if (fromQuery) setToken(fromQuery);
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    if (newPassword !== confirmPassword) {
      setStatus('password_mismatch');
      return;
    }
    const response = await fetch('/api/backend/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        newPassword,
      }),
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !body?.ok) {
      setStatus(body?.error ?? 'reset_failed');
      return;
    }
    setStatus('password_updated');
    setTimeout(() => router.push('/user/login'), 900);
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', display: 'grid', placeItems: 'center', padding: 16 }}>
      <section
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
        }}
      >
        <p style={{ margin: 0, fontSize: 12, color: '#475569', fontWeight: 700, letterSpacing: 0.4 }}>RINGBOOKER</p>
        <h1 style={{ marginTop: 8, marginBottom: 8, fontSize: 30, lineHeight: 1.15 }}>Reset password</h1>
        <p style={{ marginTop: 0, marginBottom: 18, color: '#475569' }}>
          Enter your reset token and choose a new password.
        </p>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 5, color: '#0f172a', fontWeight: 600, fontSize: 14 }}>
            Reset token
            <input
              type="text"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
              style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 5, color: '#0f172a', fontWeight: 600, fontSize: 14 }}>
            New password
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 5, color: '#0f172a', fontWeight: 600, fontSize: 14 }}>
            Confirm new password
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}
            />
          </label>
          <button
            type="submit"
            style={{
              padding: '11px 14px',
              borderRadius: 10,
              border: 'none',
              background: '#0f172a',
              color: '#fff',
              fontWeight: 700,
            }}
          >
            Reset password
          </button>
        </form>
        {status ? <p style={{ marginTop: 12, color: status === 'password_updated' ? '#166534' : '#b42318' }}>Status: {status}</p> : null}
        <p style={{ marginTop: 16, marginBottom: 0, color: '#475569' }}>
          Back to <a href="/user/login">login</a>
        </p>
      </section>
    </main>
  );
}
