'use client';

import { useState } from 'react';

const showDevResetToken = process.env.NEXT_PUBLIC_SHOW_DEV_RESET_TOKEN === 'true';

export function AdminForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setResetToken(null);
    const response = await fetch('/api/backend/auth/admin/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; resetToken?: string; error?: string } | null;
    if (!response.ok || !body?.ok) {
      setStatus(body?.error ?? 'request_failed');
      return;
    }
    setStatus('accepted');
    setResetToken(body.resetToken ?? null);
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
        <h1 style={{ marginTop: 8, marginBottom: 10, fontSize: 34, lineHeight: 1.08, letterSpacing: -1.2 }}>Forgot password</h1>
        <p style={{ marginTop: 0, marginBottom: 22, color: '#93a0ba', lineHeight: 1.65 }}>Request a secure reset link for your admin account.</p>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: '#a7b4cf' }}>
            Work email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
            Send reset request
          </button>
        </form>
        <p style={{ marginTop: 12, minHeight: 22, color: status === 'accepted' ? '#86efac' : '#fca5a5' }}>
          {status ? `Status: ${status}` : ''}
        </p>
        {showDevResetToken && resetToken ? (
          <p style={{ marginTop: 2, color: '#cbd5e1', fontSize: 13 }}>
            Dev reset token: <code>{resetToken}</code>
          </p>
        ) : null}
        <p style={{ marginTop: 16, marginBottom: 0, color: '#93a0ba' }}>
          Back to <a href="/admin/login" style={{ color: '#cfbfff' }}>admin login</a>
        </p>
      </section>
    </main>
  );
}
