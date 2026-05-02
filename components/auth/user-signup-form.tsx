'use client';

import { useState } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { useRouter } from 'next/navigation';

import styles from '@/components/auth/user-auth-template.module.css';
import { apiUserVisibleMessage } from '@/lib/api-user-message';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export function UserSignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoadingSubmit(true);
    setError(null);
    try {
      const response = await fetch('/api/backend/auth/user/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          remember: true,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        message?: string;
        onboardingRequired?: boolean;
      } | null;
      if (!response.ok) {
        setError(apiUserVisibleMessage(body, 'Signup failed'));
        setLoadingSubmit(false);
        return;
      }
      router.push(body?.onboardingRequired ? '/user/onboarding' : '/user');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoadingSubmit(false);
    }
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
          <h1 className={styles.title}>Start your free trial</h1>
          <p className={styles.sub}>Create account with email now, then complete setup after first login.</p>

          <a href="/api/backend/auth/user/google/start?intent=signup" className={`${styles.btn} ${styles.btnSecondary}`}>
            <svg className={styles.googleIcon} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
              <g clipPath="url(#google-signup-clip)">
                <path d="M8.00018 3.16667C9.18018 3.16667 10.2368 3.57333 11.0702 4.36667L13.3535 2.08333C11.9668 0.793333 10.1568 0 8.00018 0C4.87352 0 2.17018 1.79333 0.853516 4.40667L3.51352 6.47C4.14352 4.57333 5.91352 3.16667 8.00018 3.16667Z" fill="#EA4335" />
                <path d="M15.66 8.18335C15.66 7.66002 15.61 7.15335 15.5333 6.66669H8V9.67335H12.3133C12.12 10.66 11.56 11.5 10.72 12.0667L13.2967 14.0667C14.8 12.6734 15.66 10.6134 15.66 8.18335Z" fill="#4285F4" />
                <path d="M3.51 9.53001C3.35 9.04668 3.25667 8.53334 3.25667 8.00001C3.25667 7.46668 3.34667 6.95334 3.51 6.47001L0.85 4.40668C0.306667 5.48668 0 6.70668 0 8.00001C0 9.29334 0.306667 10.5133 0.853333 11.5933L3.51 9.53001Z" fill="#FBBC05" />
                <path d="M8.0001 16C10.1601 16 11.9768 15.29 13.2968 14.0633L10.7201 12.0633C10.0034 12.5467 9.0801 12.83 8.0001 12.83C5.91343 12.83 4.14343 11.4233 3.5101 9.52667L0.850098 11.59C2.1701 14.2067 4.87343 16 8.0001 16Z" fill="#34A853" />
              </g>
              <defs>
                <clipPath id="google-signup-clip">
                  <rect width="16" height="16" fill="white" />
                </clipPath>
              </defs>
            </svg>
            Continue with Google
          </a>
          <div className={styles.divider}>or sign up with email</div>

          <form onSubmit={onSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="signup-email">Work email</label>
              <input
                id="signup-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@salon.com"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="signup-confirm-password">Confirm password</label>
              <input
                id="signup-confirm-password"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter password"
              />
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}
            <button type="submit" disabled={loadingSubmit} className={`${styles.btn} ${styles.btnPrimary}`}>
              {loadingSubmit ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className={styles.foot}>
            <p>
              Already have an account? <a className={styles.link} href="/user/login">Sign in</a>
            </p>
            <p className={styles.fine}>Google signup creates your account from verified Google profile.</p>
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
