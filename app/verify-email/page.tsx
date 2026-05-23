'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type VerifyState = 'checking' | 'success' | 'expired' | 'used' | 'error';
type PostVerifyHref = '/user/onboarding' | '/user';

function VerifyEmailBody() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<VerifyState>('checking');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [postVerifyHref, setPostVerifyHref] = useState<PostVerifyHref>('/user/onboarding');

  useEffect(() => {
    let active = true;
    async function verify() {
      if (!token) {
        setState('error');
        setMessage('Verification token is missing.');
        return;
      }
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const body = (await response.json().catch(() => null)) as { error?: string; status?: string; message?: string } | null;
        if (!active) return;
        if (response.ok) {
          try {
            const statusRes = await fetch('/api/backend/user/onboarding-status', { credentials: 'include' });
            if (statusRes.ok) {
              const statusBody = (await statusRes.json().catch(() => null)) as { ok?: boolean; onboardingRequired?: boolean } | null;
              if (statusBody?.ok && statusBody.onboardingRequired === false) {
                setPostVerifyHref('/user');
              }
            }
          } catch {
            // default to /user/onboarding on failure
          }
          setState('success');
          setMessage('Email confirmed.');
          return;
        }
        if (body?.status === 'expired' || body?.error === 'verification_token_expired') {
          setState('expired');
          setMessage('This confirmation link has expired.');
          return;
        }
        if (body?.status === 'already_verified' || body?.error === 'verification_token_used') {
          setState('used');
          setMessage('This email is already verified.');
          return;
        }
        setState('error');
        setMessage(body?.message ?? 'This confirmation link is invalid.');
      } catch {
        if (!active) return;
        setState('error');
        setMessage('Network error. Please try again.');
      }
    }
    void verify();
    return () => {
      active = false;
    };
  }, [token]);

  const resend = useCallback(async () => {
    setResending(true);
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
      if (response.ok && body?.ok) {
        setMessage('A new confirmation email has been sent.');
        return;
      }
      setMessage(body?.message ?? 'Could not resend the confirmation email.');
    } catch {
      setMessage('Network error. Please try again.');
    } finally {
      setResending(false);
    }
  }, []);

  const title =
    state === 'checking'
      ? 'Confirming email...'
      : state === 'success'
        ? 'Email confirmed'
        : state === 'expired'
          ? 'Link expired'
          : state === 'used'
            ? 'Already verified'
            : 'Could not confirm email';

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8f9fa', padding: 20 }}>
      <section style={{ width: '100%', maxWidth: 440, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 28, boxShadow: '0 18px 50px rgba(15,23,42,.08)' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, letterSpacing: '-.02em' }}>{title}</h1>
        <p style={{ margin: '0 0 20px', color: '#6b7280', lineHeight: 1.6 }}>{message || 'Please wait while we confirm your email address.'}</p>
        {state === 'success' ? (
          <a href={postVerifyHref} style={primaryButtonStyle}>
            {postVerifyHref === '/user' ? 'Go to dashboard' : 'Continue setup'}
          </a>
        ) : state === 'used' ? (
          <a href="/user" style={primaryButtonStyle}>Go to dashboard</a>
        ) : state === 'expired' ? (
          <button type="button" onClick={resend} disabled={resending} style={primaryButtonStyle}>
            {resending ? 'Sending...' : 'Resend confirmation email'}
          </button>
        ) : state === 'error' ? (
          <a href="/user" style={secondaryButtonStyle}>Back to dashboard</a>
        ) : null}
      </section>
    </main>
  );
}

const primaryButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: 46,
  border: 0,
  borderRadius: 10,
  background: '#191c1d',
  color: '#fff',
  fontWeight: 700,
  textDecoration: 'none',
  cursor: 'pointer',
} as const;

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  background: '#f3f4f6',
  color: '#111827',
} as const;

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailBody />
    </Suspense>
  );
}
