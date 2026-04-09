'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/backend/auth/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          remember,
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? 'Login failed');
        setLoading(false);
        return;
      }
      router.push('/admin');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
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
        <h1 style={{ marginTop: 8, marginBottom: 10, fontSize: 34, lineHeight: 1.08, letterSpacing: -1.2 }}>Admin login</h1>
        <p style={{ marginTop: 0, marginBottom: 22, color: '#93a0ba', lineHeight: 1.65 }}>Sign in to access internal backoffice tools.</p>

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
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: '#a7b4cf' }}>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#93a0ba', fontSize: 13 }}>
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              Keep me signed in
            </label>
            <a href="/admin/forgot-password" style={{ color: '#cfbfff', fontSize: 13 }}>
              Forgot password?
            </a>
          </div>
          {error ? <p style={{ color: '#fca5a5', margin: 0 }}>{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
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
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
