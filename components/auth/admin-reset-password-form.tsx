'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminResetPasswordForm() {
  const router = useRouter();
  const [token, setToken] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('token');
    if (fromQuery) setToken(fromQuery);
  }, []);
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
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
    setTimeout(() => router.push('/admin/login'), 800);
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        background: 'radial-gradient(circle at top left,#1b2442 0,#0d1223 40%,#0a0f1d 100%)',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'linear-gradient(180deg,#11182b,#0f1729)',
          border: '1px solid #22304d',
          borderRadius: 24,
          padding: 30,
          boxShadow: '0 18px 48px rgba(0,0,0,.35)',
          color: '#e5edf9',
        }}
      >
        <p style={{ margin: 0, color: '#a7b4cf', fontWeight: 700, fontSize: 12, letterSpacing: 0.5 }}>RINGBOOKER ADMIN</p>
        <h1 style={{ marginTop: 8, marginBottom: 10, fontSize: 34, lineHeight: 1.08, letterSpacing: -1.2 }}>Reset password</h1>
        <p style={{ marginTop: 0, marginBottom: 22, color: '#93a0ba', lineHeight: 1.65 }}>Enter your reset token and set a new password.</p>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: '#a7b4cf' }}>
            Reset token
            <input
              type="text"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
              style={{
                width: '100%',
                padding: '12px 13px',
                borderRadius: 12,
                border: '1px solid #22304d',
                background: '#0c1425',
                color: '#e5edf9',
              }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: '#a7b4cf' }}>
            New password
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              style={{
                width: '100%',
                padding: '12px 13px',
                borderRadius: 12,
                border: '1px solid #22304d',
                background: '#0c1425',
                color: '#e5edf9',
              }}
            />
          </label>
          <button
            type="submit"
            style={{
              marginTop: 2,
              padding: '12px 14px',
              borderRadius: 999,
              border: 'none',
              background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)',
              color: '#fff',
              fontWeight: 800,
            }}
          >
            Reset password
          </button>
        </form>
        <p style={{ marginTop: 12, minHeight: 22, color: status === 'password_updated' ? '#86efac' : '#fca5a5' }}>
          {status ? `Status: ${status}` : ''}
        </p>
        <p style={{ marginTop: 16, marginBottom: 0, color: '#93a0ba' }}>
          Back to <a href="/admin/login" style={{ color: '#cfbfff' }}>admin login</a>
        </p>
      </section>
    </main>
  );
}
