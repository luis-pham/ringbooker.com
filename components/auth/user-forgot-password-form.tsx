'use client';

import { useState } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';

import styles from '@/components/auth/user-auth-template.module.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const showDevResetToken = process.env.NEXT_PUBLIC_SHOW_DEV_RESET_TOKEN === 'true';

export function UserForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setResetToken(null);
    const response = await fetch('/api/backend/auth/user/forgot-password', {
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
          <h1 className={styles.title}>Forgot password</h1>
          <p className={styles.sub}>Enter your account email and we will send reset instructions.</p>
          <form onSubmit={onSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="forgot-email">Work email</label>
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@salon.com"
              />
            </div>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
              Send reset link
            </button>
          </form>
          {status ? (
            <p className={status === 'accepted' ? styles.success : styles.error}>
              {status === 'accepted' ? 'If your account exists, reset instructions have been sent.' : status}
            </p>
          ) : null}
          {showDevResetToken && resetToken ? <p className={styles.fine}>Dev reset token: <code>{resetToken}</code></p> : null}
          <div className={styles.foot}>
            <p>
              Back to <a className={styles.link} href="/user/login">login</a>
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
