'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import styles from '@/components/auth/user-auth-template.module.css';

type WindowWithTracking = Window & {
  dataLayer?: Array<Record<string, unknown>>;
  gtag?: (...args: unknown[]) => void;
};

function pushSignupCompleteEvent(shopId: string): void {
  const w = window as WindowWithTracking;
  if (!Array.isArray(w.dataLayer)) return;
  w.dataLayer.push({ event: 'signup_complete', shopId });
}

function fireGoogleAdsConversion(): void {
  const w = window as WindowWithTracking;
  if (typeof w.gtag !== 'function') {
    console.warn('[signup-thank-you] gtag not available, conversion event skipped');
    return;
  }
  w.gtag('event', 'conversion', {
    send_to: 'AW-18285870762/BROlCNTnt8kcEKr9sI9E',
  });
}

export function SignupThankYou() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopId = searchParams.get('shopId') ?? '';
  const nextParam = searchParams.get('next');
  const next = nextParam && nextParam.startsWith('/') ? nextParam : '/user/onboarding';

  useEffect(() => {
    if (!shopId) return;
    const key = `signup:conversion_fired:${shopId}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // Storage unavailable — nothing to dedupe against, fall through and fire once for this mount.
    }
    pushSignupCompleteEvent(shopId);
    fireGoogleAdsConversion();
    try {
      sessionStorage.setItem(key, '1');
    } catch {
      // Storage disabled / quota / sandbox — the push above still happened, dedupe just can't persist.
    }
  }, [shopId]);

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <span className={styles.brand}>
          <span className={styles.brandMark}>
            <img src="/images/logo.webp" alt="RingBooker logo" className={styles.brandLogoImage} />
          </span>
          <span>RingBooker</span>
        </span>
      </div>
      <section className={styles.wrap}>
        <div className={`${styles.card} ${styles.centeredContent}`}>
          <div className={styles.successIcon} aria-hidden="true">
            ✓
          </div>
          <h1 className={styles.title}>You&apos;re all set!</h1>
          <p className={styles.sub}>Your RingBooker account is ready. Next, set up your business so callers can start booking.</p>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => router.push(next)}>
            Continue setup
          </button>
        </div>
      </section>
    </main>
  );
}
