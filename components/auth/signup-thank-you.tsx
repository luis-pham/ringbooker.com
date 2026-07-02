'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import styles from '@/components/auth/user-auth-template.module.css';

type WindowWithTracking = Window & {
  dataLayer?: Array<Record<string, unknown>>;
  gtag?: (...args: unknown[]) => void;
};

const GTAG_POLL_INTERVAL_MS = 100;
const GTAG_POLL_TIMEOUT_MS = 3000;

function pushSignupCompleteEvent(shopId: string): void {
  const w = window as WindowWithTracking;
  if (!Array.isArray(w.dataLayer)) return;
  w.dataLayer.push({ event: 'signup_complete', shopId });
}

/**
 * GTM loads gtag.js asynchronously, so window.gtag may not exist yet at mount. Polls briefly
 * rather than firing-or-skipping immediately, so a slow-loading GTM container doesn't
 * permanently mark the conversion as fired. Only marks the dedupe flag once gtag was actually
 * called — a timeout leaves it unset so a later page load can still succeed.
 */
function fireGoogleAdsConversion(shopId: string): () => void {
  const w = window as WindowWithTracking;
  const conversionKey = `signup:conversion_fired:${shopId}`;

  const attempt = (): boolean => {
    if (typeof w.gtag !== 'function') return false;
    w.gtag('event', 'conversion', {
      send_to: 'AW-18285870762/BROlCNTnt8kcEKr9sI9E',
    });
    try {
      sessionStorage.setItem(conversionKey, '1');
    } catch {
      // Storage disabled / quota / sandbox — the conversion still fired, dedupe just can't persist.
    }
    return true;
  };

  if (attempt()) return () => {};

  let elapsedMs = 0;
  const intervalId = setInterval(() => {
    elapsedMs += GTAG_POLL_INTERVAL_MS;
    if (attempt()) {
      clearInterval(intervalId);
      return;
    }
    if (elapsedMs >= GTAG_POLL_TIMEOUT_MS) {
      clearInterval(intervalId);
      console.warn('[signup-thank-you] gtag not available after 3s, conversion event skipped');
    }
  }, GTAG_POLL_INTERVAL_MS);

  return () => clearInterval(intervalId);
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
    let analyticsAlreadyFired = false;
    try {
      analyticsAlreadyFired = Boolean(sessionStorage.getItem(analyticsKey));
    } catch {
      // Storage unavailable — nothing to dedupe against, fall through and fire once for this mount.
    }
    if (!analyticsAlreadyFired) {
      pushSignupCompleteEvent(shopId);
      try {
        sessionStorage.setItem(analyticsKey, '1');
      } catch {
        // Storage disabled / quota / sandbox — the push above still happened, dedupe just can't persist.
      }
    }

    const conversionKey = `signup:conversion_fired:${shopId}`;
    let conversionAlreadyFired = false;
    try {
      conversionAlreadyFired = Boolean(sessionStorage.getItem(conversionKey));
    } catch {
      // Storage unavailable — nothing to dedupe against, fall through and attempt for this mount.
    }
    if (conversionAlreadyFired) return;

    return fireGoogleAdsConversion(shopId);
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
