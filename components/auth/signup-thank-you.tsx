'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import styles from '@/components/auth/user-auth-template.module.css';

type WindowWithTracking = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

const SIGNUP_CONVERSION_SEND_TO = 'AW-18285870762/-ZAMCNHCxckcEKr9sI9E';

function pushSignupCompleteEvent(shopId: string): void {
  const w = window as WindowWithTracking;
  if (!Array.isArray(w.dataLayer)) return;
  w.dataLayer.push({ event: 'signup_complete', shopId });
}

function fireSignupConversionEvent(): void {
  const w = window as WindowWithTracking;
  if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
  if (typeof w.gtag !== 'function') {
    w.gtag = (...args: unknown[]) => {
      w.dataLayer?.push(args);
    };
  }
  w.gtag('event', 'conversion', { send_to: SIGNUP_CONVERSION_SEND_TO });
}

export function SignupThankYou() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopId = searchParams.get('shopId') ?? '';
  const nextParam = searchParams.get('next');
  const next = nextParam && nextParam.startsWith('/') ? nextParam : '/user/onboarding';

  useEffect(() => {
    if (!shopId) return;

    const analyticsKey = `signup:analytics_fired:${shopId}`;
    const conversionKey = `signup:conversion_fired:${shopId}:${SIGNUP_CONVERSION_SEND_TO}`;
    let analyticsAlreadyFired = false;
    let conversionAlreadyFired = false;
    try {
      analyticsAlreadyFired = Boolean(sessionStorage.getItem(analyticsKey));
      conversionAlreadyFired = Boolean(sessionStorage.getItem(conversionKey));
    } catch {
      // Storage unavailable — nothing to dedupe against, fall through and fire once for this mount.
    }

    if (!analyticsAlreadyFired) pushSignupCompleteEvent(shopId);
    if (!conversionAlreadyFired) fireSignupConversionEvent();

    try {
      if (!analyticsAlreadyFired) sessionStorage.setItem(analyticsKey, '1');
      if (!conversionAlreadyFired) sessionStorage.setItem(conversionKey, '1');
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
