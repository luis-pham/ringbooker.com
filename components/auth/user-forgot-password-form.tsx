'use client';

import { useState } from 'react';

import styles from '@/components/auth/user-auth-template.module.css';
import { apiUserVisibleMessage } from '@/lib/api-user-message';

const showDevResetToken = process.env.NEXT_PUBLIC_SHOW_DEV_RESET_TOKEN === 'true';

const FORGOT_USER_MSG = {
  sent: 'If an account exists for this email, reset instructions are on the way. Check your inbox (including Spam).',
} as const;

export function UserForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState<'sent' | 'error' | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setErrorDetail(null);
    setResetToken(null);
    const response = await fetch('/api/backend/auth/user/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      resetToken?: string;
      error?: string;
      message?: string;
    } | null;
    if (!response.ok || !body?.ok) {
      setFeedback('error');
      setErrorDetail(apiUserVisibleMessage(body, 'Something went wrong. Please try again.'));
      return;
    }
    setFeedback('sent');
    setResetToken(body.resetToken ?? null);
  }

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <a className={styles.brand} href="/">
          <span className={styles.brandMark}>
            <img src="/images/logo.webp" alt="RingBooker logo" className={styles.brandLogoImage} />
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
          {feedback ? (
            <p className={feedback === 'sent' ? styles.success : styles.error}>
              {feedback === 'sent' ? FORGOT_USER_MSG.sent : errorDetail ?? 'Something went wrong. Please try again.'}
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
