'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type PortalNotificationItem = {
  id: string;
  severity: 'info' | 'warn' | 'critical';
  title: string;
  body?: string;
  href: string;
};

export function UserPortalNotifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PortalNotificationItem[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    void fetch('/api/backend/user/notifications', { credentials: 'include' })
      .then((r) => r.json() as Promise<{ ok?: boolean; notifications?: PortalNotificationItem[] }>)
      .then((body) => {
        if (body.ok && Array.isArray(body.notifications)) setItems(body.notifications);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const count = items.length;

  return (
    <div className="portal-notif" ref={wrapRef}>
      <button
        type="button"
        className="portal-notif-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count ? `${count} billing or usage alerts` : 'Notifications — no active alerts'}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
          />
        </svg>
        {count > 0 ? <span className="portal-notif-badge">{count > 9 ? '9+' : count}</span> : null}
      </button>
      {open ? (
        <div className="portal-notif-panel" role="dialog" aria-label="Billing and usage alerts">
          <div className="portal-notif-panel-head">
            <strong>Alerts</strong>
            <button type="button" className="portal-notif-refresh" onClick={() => load()}>
              Refresh
            </button>
          </div>
          <div className="portal-notif-list">
            {items.length === 0 ? (
              <p className="portal-notif-empty">No billing or usage alerts right now.</p>
            ) : (
              items.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  className={`portal-notif-item portal-notif-item--${item.severity}`}
                  onClick={() => setOpen(false)}
                >
                  <span className="portal-notif-item-text">
                    <span className="portal-notif-title">{item.title}</span>
                    {item.body ? <span className="portal-notif-body">{item.body}</span> : null}
                  </span>
                </a>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
