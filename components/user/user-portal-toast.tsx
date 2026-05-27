'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { userPortalToastStyles } from '@/components/user/user-portal-toast-styles';

type ToastType = 'success' | 'error';

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

type ShowToastInput = {
  type: ToastType;
  message: string;
  durationMs?: number;
};

type UserPortalToastContextValue = {
  showToast: (input: ShowToastInput) => void;
};

const UserPortalToastContext = createContext<UserPortalToastContextValue | null>(null);

const SUCCESS_MS = 3200;
const ERROR_MS = 5200;

export function UserPortalToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const showToast = useCallback(({ type, message, durationMs }: ShowToastInput) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    clearHideTimer();
    idRef.current += 1;
    const next: ToastItem = { id: idRef.current, type, message: trimmed };
    setToast(next);

    const ms = durationMs ?? (type === 'error' ? ERROR_MS : SUCCESS_MS);
    hideTimerRef.current = setTimeout(() => {
      setToast((current) => (current?.id === next.id ? null : current));
    }, ms);
  }, [clearHideTimer]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <UserPortalToastContext.Provider value={value}>
      <style dangerouslySetInnerHTML={{ __html: userPortalToastStyles }} />
      {children}
      <div className="user-portal-toast-host" aria-live="polite" aria-relevant="additions">
        {toast ? (
          <div
            key={toast.id}
            className={`user-portal-toast user-portal-toast--${toast.type}`}
            role={toast.type === 'error' ? 'alert' : 'status'}
          >
            <span className="user-portal-toast__icon" aria-hidden>
              {toast.type === 'success' ? '✓' : '!'}
            </span>
            <span className="user-portal-toast__message">{toast.message}</span>
            {toast.type === 'error' ? (
              <button
                type="button"
                className="user-portal-toast__dismiss"
                aria-label="Dismiss"
                onClick={() => {
                  clearHideTimer();
                  setToast(null);
                }}
              >
                ×
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </UserPortalToastContext.Provider>
  );
}

export function useUserPortalToast(): UserPortalToastContextValue {
  const ctx = useContext(UserPortalToastContext);
  if (!ctx) {
    throw new Error('useUserPortalToast must be used within UserPortalToastProvider');
  }
  return ctx;
}
