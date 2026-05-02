'use client';

import { useEffect, useState } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { useRouter } from 'next/navigation';

import styles from '@/components/auth/user-auth-template.module.css';
import { apiUserVisibleMessage } from '@/lib/api-user-message';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export function UserResetPasswordForm() {
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
      setMessage(
        'This page needs a valid reset link. Open the link from your password reset email.',
      );
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
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
      if (!response.ok || !body?.ok) {
        setFeedback('error');
        if (body?.error === 'invalid_or_expired_token') {
          setMessage('This reset link is invalid or has expired. Request a new password reset email.');
        } else if (body?.error === 'invalid_payload') {
          setMessage('Invalid request. Please try again.');
        } else {
          setMessage(apiUserVisibleMessage(body, 'Could not reset your password. Please try again.'));
        }
        setLoading(false);
        return;
      }
      setFeedback('success');
      setMessage('Password updated. Redirecting to sign in…');
      setTimeout(() => router.push('/user/login'), 900);
    } catch {
      setFeedback('error');
      setMessage('Network error. Please try again.');
      setLoading(false);
    }
  }

  const showBanner = !token.trim();

  return (
    <main className={`${styles.page} ${plusJakarta.className}`}>
      <div className={styles.topbar}>
        <a className={styles.brand} href="/">
          <span className={styles.brandMark}>
            <img src="/images/logo.png" alt="RingBooker logo" className={styles.brandLogoImage} />
          </span>
          <span>RingBooker</span>
        </a>
      </div>
      <section className={styles.wrap}>
        <div className={styles.card}>
          <h1 className={styles.title}>Reset password</h1>
          <p className={styles.sub}>Choose a new password. Use the link from your reset email.</p>

          {showBanner ? (
            <p className={styles.error}>
              Missing reset link. Open this page from the link in your password reset email, or request a new one.
            </p>
          ) : null}

          <form onSubmit={onSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="reset-new-password">New password</label>
              <input
                id="reset-new-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 characters"
                disabled={!token.trim()}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="reset-confirm-password">Confirm password</label>
              <input
                id="reset-confirm-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter password"
                disabled={!token.trim()}
              />
            </div>

            {feedback && message ? (
              <p className={feedback === 'success' ? styles.success : styles.error}>{message}</p>
            ) : null}

            <button
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={loading || !token.trim()}
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>

          <div className={`${styles.foot} ${styles.footQuiet}`}>
            <p>
              <a href="/user/login">Back to login</a>
            </p>
          </div>
        </div>
      </section>
      <footer className={styles.pageFooter}>
        <div className={styles.pageFooterLinks}>
          <a href="/pricing">Pricing</a>
          <a href="/blog">Blog</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </div>
        <div className={styles.pageFooterLegal}>© {new Date().getFullYear()} RingBooker. All rights reserved.</div>
      </footer>
    </main>
  );
}
