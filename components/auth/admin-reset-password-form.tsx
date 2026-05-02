'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminResetPasswordForm() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('token');
    if (fromQuery) setToken(fromQuery);
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setMessage(null);

    if (!token.trim()) {
      setFeedback('error');
      setMessage('This page needs a valid reset link. Open the link from your admin reset email.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback('error');
      setMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
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
        setFeedback('error');
        if (body?.error === 'invalid_or_expired_token') {
          setMessage('This reset link is invalid or has expired. Request a new email.');
        } else {
          setMessage('Could not reset your password. Please try again.');
        }
        setLoading(false);
        return;
      }
      setFeedback('success');
      setMessage('Password updated. Redirecting to sign in…');
      setTimeout(() => router.push('/admin/login'), 800);
    } catch {
      setFeedback('error');
      setMessage('Network error. Please try again.');
      setLoading(false);
    }
  }

  const showBanner = !token.trim();
  const msgColor = feedback === 'success' ? '#86efac' : '#fca5a5';
  const bannerBg = 'rgba(248, 113, 113, 0.12)';
  const bannerBorder = '1px solid rgba(248, 113, 113, 0.35)';

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
        <p style={{ marginTop: 0, marginBottom: 22, color: '#93a0ba', lineHeight: 1.65 }}>
          Enter a new password. Use the link from your reset email (no token field needed).
        </p>

        {showBanner ? (
          <p
            style={{
              margin: '0 0 18px',
              padding: '10px 12px',
              borderRadius: 12,
              border: bannerBorder,
              background: bannerBg,
              color: '#fecaca',
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            Missing reset link. Open this page from the link in your password reset email.
          </p>
        ) : null}

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: '#a7b4cf' }}>
            New password
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={!token.trim()}
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
            Confirm password
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={!token.trim()}
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

          {feedback && message ? (
            <p style={{ margin: 0, minHeight: 22, color: msgColor, fontSize: 13, lineHeight: 1.5 }}>{message}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            style={{
              marginTop: 2,
              padding: '12px 14px',
              borderRadius: 999,
              border: 'none',
              background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)',
              color: '#fff',
              fontWeight: 800,
              cursor: loading || !token.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !token.trim() ? 0.7 : 1,
            }}
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <p
          style={{
            marginTop: 18,
            marginBottom: 0,
            textAlign: 'center',
          }}
        >
          <a
            href="/admin/login"
            style={{
              fontSize: 11,
              fontWeight: 400,
              letterSpacing: '0.02em',
              color: '#94a3b8',
              textDecoration: 'none',
            }}
          >
            Back to login
          </a>
        </p>
      </section>
    </main>
  );
}
