'use client';

import Script from 'next/script';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type PaddleEnvironment = 'sandbox' | 'production';

type PaddleCheckoutClientProps = {
  clientToken: string;
  environment: PaddleEnvironment;
  transactionId: string;
};

declare global {
  interface Window {
    Paddle?: {
      Environment?: {
        set?: (environment: PaddleEnvironment) => void;
      };
      Initialize?: (options: { token: string; eventCallback?: (event: unknown) => void }) => void;
      Checkout?: {
        open?: (options: {
          transactionId: string;
          settings?: {
            displayMode?: 'overlay' | 'inline';
            theme?: 'light' | 'dark';
            successUrl?: string;
          };
        }) => void;
      };
    };
  }
}

function getEventName(event: unknown): string {
  if (!event || typeof event !== 'object') return '';
  const record = event as { name?: unknown; event?: unknown };
  return typeof record.name === 'string'
    ? record.name
    : typeof record.event === 'string'
      ? record.event
      : '';
}

export function PaddleCheckoutClient({
  clientToken,
  environment,
  transactionId,
}: PaddleCheckoutClientProps) {
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openedRef = useRef(false);

  const urls = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        success: '/user/billing?checkout=success',
        cancelled: '/user/billing?checkout=cancelled',
      };
    }
    return {
      success: `${window.location.origin}/user/billing?checkout=success`,
      cancelled: `${window.location.origin}/user/billing?checkout=cancelled`,
    };
  }, []);

  const openCheckout = useCallback(() => {
    if (openedRef.current) return;
    if (!transactionId) {
      setError('Checkout session is missing. Please return to Billing and try again.');
      return;
    }
    if (!clientToken) {
      setError('Checkout is not configured for this environment yet.');
      return;
    }
    const paddle = window.Paddle;
    if (!paddle?.Initialize || !paddle.Checkout?.open) {
      setError('Paddle checkout could not load. Please refresh and try again.');
      return;
    }

    openedRef.current = true;
    if (environment === 'sandbox') {
      paddle.Environment?.set?.('sandbox');
    }
    paddle.Initialize({
      token: clientToken,
      eventCallback: (event) => {
        const eventName = getEventName(event);
        if (eventName === 'checkout.completed') {
          window.location.href = urls.success;
        }
        if (eventName === 'checkout.closed') {
          window.location.href = urls.cancelled;
        }
      },
    });
    paddle.Checkout.open({
      transactionId,
      settings: {
        displayMode: 'overlay',
        theme: 'light',
        successUrl: urls.success,
      },
    });
  }, [clientToken, environment, transactionId, urls.cancelled, urls.success]);

  useEffect(() => {
    if (scriptReady) openCheckout();
  }, [openCheckout, scriptReady]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#f8fafc',
        color: '#0f172a',
      }}
    >
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setError('Paddle checkout could not load. Please refresh and try again.')}
      />
      <section
        style={{
          width: 'min(100%, 460px)',
          background: '#ffffff',
          border: '0.5px solid #e2e8f0',
          borderRadius: 18,
          padding: 28,
          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '3px solid #e2e8f0',
            borderTopColor: '#7c3aed',
            margin: '0 auto 16px',
            animation: error ? undefined : 'rb-paddle-spin 1s linear infinite',
          }}
        />
        <h1 style={{ fontSize: 22, lineHeight: 1.2, margin: '0 0 8px', fontWeight: 650 }}>
          {error ? 'Checkout could not open' : 'Opening secure checkout'}
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          {error
            ? error
            : 'A secure Paddle checkout should appear in a moment so you can add your payment method.'}
        </p>
        {error ? (
          <a
            href="/user/billing"
            style={{
              display: 'inline-flex',
              marginTop: 18,
              padding: '10px 14px',
              borderRadius: 999,
              background: '#7c3aed',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Back to Billing
          </a>
        ) : null}
      </section>
      <style jsx>{`
        @keyframes rb-paddle-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}
