'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type AuthMeResponse = {
  ok?: boolean;
  session?: {
    emailVerified?: boolean;
  };
};

export function EmailVerificationBanner({ initialEmailVerified }: { initialEmailVerified?: boolean }) {
  const pathname = usePathname();
  const [emailVerified, setEmailVerified] = useState(initialEmailVerified);
  const [message, setMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/backend/auth/me', { credentials: 'include' });
      if (!response.ok) return;
      const body = (await response.json()) as AuthMeResponse;
      if (body.ok && body.session) {
        setEmailVerified(body.session.emailVerified === true);
      }
    } catch {
      /* ignore polling errors */
    }
  }, []);

  useEffect(() => {
    if (emailVerified === true) return;
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [emailVerified, refresh]);

  const resend = useCallback(async () => {
    setResending(true);
    setMessage(null);
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
      if (response.ok && body?.ok) {
        setMessage('Verification email sent.');
        return;
      }
      if (body?.error === 'email_already_verified') {
        setEmailVerified(true);
        return;
      }
      setMessage(body?.message ?? 'Could not resend yet. Please try again later.');
    } catch {
      setMessage('Network error. Please try again.');
    } finally {
      setResending(false);
    }
  }, []);

  if (
    emailVerified !== false ||
    pathname === '/user/login' ||
    pathname === '/user/signup' ||
    pathname === '/user/forgot-password' ||
    pathname === '/user/reset-password'
  ) {
    return null;
  }

  return (
    <div className="email-verification-banner" role="status">
      <span>Please confirm your email address. Check your inbox or resend the link.</span>
      <button type="button" onClick={resend} disabled={resending}>
        {resending ? 'Sending...' : 'Resend'}
      </button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}
