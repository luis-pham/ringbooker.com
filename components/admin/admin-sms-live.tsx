'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { adminSidebarAddonStyles } from '@/components/admin/admin-sidebar-styles';
import { adminCallsScripts, adminCallsStyles } from '@/components/admin/admin-calls';

type ReadFilter = 'all' | 'read' | 'unread';

type SmsListItem = {
  id: string;
  telnyxMessageId?: string | null;
  telnyxEventId: string;
  direction: 'inbound' | 'outbound';
  fromNumber: string;
  toNumber: string;
  bodyPreview?: string | null;
  mediaUrls: string[];
  provider: string;
  eventType: string;
  receivedAt: string;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type SmsMessage = SmsListItem & {
  body?: string | null;
  rawPayload?: unknown;
};

type SmsResponse = {
  ok: boolean;
  items?: SmsListItem[];
  allowedNumbers?: string[];
  inboxConfigured?: boolean;
  pagination?: { page: number; pageSize: number; total: number };
  error?: string;
};

type SmsDetailResponse = {
  ok: boolean;
  message?: SmsMessage;
  error?: string;
};

function utcTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcDaysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString();
}

function statusClass(message: Pick<SmsListItem, 'readAt'>): string {
  return message.readAt ? 'tag gray' : 'tag blue';
}

function statusLabel(message: Pick<SmsListItem, 'readAt'>): string {
  return message.readAt ? 'Read' : 'Unread';
}

const adminSmsStyles = [
  String.raw`
.sms-filter-grid{display:grid;grid-template-columns:minmax(220px,1fr) minmax(160px,220px) minmax(130px,160px) minmax(140px,160px) minmax(140px,160px) max-content;gap:12px;align-items:end}
.sms-filter-grid .field{margin:0}
.sms-filter-grid .btn{height:40px}
.sms-muted{color:var(--muted);font-size:13px;line-height:1.5}
.sms-message-cell{max-width:520px}
.sms-message-preview{color:var(--text);line-height:1.55;white-space:normal;overflow-wrap:anywhere}
.sms-phone{font-variant-numeric:tabular-nums;white-space:nowrap}
.sms-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
.sms-detail-box{padding:12px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--panel-2)}
.sms-detail-box .sms-detail-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin-bottom:4px}
.sms-body-box{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}
.sms-raw{max-height:320px;overflow:auto;padding:12px;border-radius:var(--r-sm);border:1px solid var(--line);background:#050506;color:#d4d4d8;font-size:12px;line-height:1.55}
.sms-dialog{width:min(760px,calc(100vw - 32px));border:1px solid var(--line);border-radius:var(--r-lg);background:var(--panel);color:var(--text);padding:0;box-shadow:var(--shadow)}
.sms-dialog::backdrop{background:rgba(0,0,0,.58)}
.sms-dialog-inner{padding:20px}
.sms-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}
.sms-dialog-head h3{margin:0;font-size:18px}
.sms-dialog-actions{display:flex;gap:8px;align-items:center}
@media (max-width:1100px){.sms-filter-grid{grid-template-columns:1fr 1fr 1fr}.sms-filter-grid .field--search{grid-column:1/-1}.sms-filter-grid .field--apply{grid-column:span 1}}
@media (max-width:720px){.sms-filter-grid{grid-template-columns:1fr}.sms-detail-grid{grid-template-columns:1fr}.sms-phone{white-space:normal}.sms-message-cell{max-width:none}}
`,
];

export function AdminSmsLive() {
  const [query, setQuery] = useState('');
  const [toNumber, setToNumber] = useState('');
  const [read, setRead] = useState<ReadFilter>('all');
  const [dateFrom, setDateFrom] = useState(() => utcDaysAgoIso(30));
  const [dateTo, setDateTo] = useState(() => utcTodayIso());
  const [applied, setApplied] = useState(() => ({
    query: '',
    toNumber: '',
    read: 'all' as ReadFilter,
    dateFrom: utcDaysAgoIso(30),
    dateTo: utcTodayIso(),
  }));
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SmsListItem[]>([]);
  const [allowedNumbers, setAllowedNumbers] = useState<string[]>([]);
  const [inboxConfigured, setInboxConfigured] = useState(true);
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<SmsMessage | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailDialogRef = useRef<HTMLDialogElement>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (applied.query) qs.set('q', applied.query);
    if (applied.toNumber) qs.set('toNumber', applied.toNumber);
    qs.set('read', applied.read);
    if (applied.dateFrom) qs.set('dateFrom', applied.dateFrom);
    if (applied.dateTo) qs.set('dateTo', applied.dateTo);
    qs.set('page', String(page));

    setLoading(true);
    try {
      const response = await fetch(`/api/backend/admin/sms?${qs.toString()}`);
      const body = (await response.json()) as SmsResponse;
      if (!body.ok) {
        setError(body.error ?? 'unable_to_load');
        setItems([]);
        setPagination(null);
        return;
      }
      setError(null);
      setItems(body.items ?? []);
      setAllowedNumbers(body.allowedNumbers ?? []);
      setInboxConfigured(body.inboxConfigured ?? true);
      setPagination(body.pagination ?? null);
    } catch {
      setError('network_error');
      setItems([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const el = detailDialogRef.current;
    if (!el) return;
    if (detail || detailLoading || detailError) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [detail, detailLoading, detailError]);

  const totalPages = useMemo(() => {
    if (!pagination) return 1;
    return Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  }, [pagination]);

  function applyFilters() {
    setPage(1);
    setApplied({ query: query.trim(), toNumber, read, dateFrom, dateTo });
  }

  async function markRead(id: string) {
    const response = await fetch(`/api/backend/admin/sms/${encodeURIComponent(id)}/read`, { method: 'POST' });
    const body = (await response.json()) as SmsDetailResponse;
    if (!body.ok || !body.message) return null;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, readAt: body.message?.readAt ?? item.readAt } : item)));
    setDetail((prev) => (prev?.id === id ? { ...prev, readAt: body.message?.readAt ?? prev.readAt } : prev));
    return body.message;
  }

  async function openDetail(id: string) {
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/backend/admin/sms/${encodeURIComponent(id)}`);
      const body = (await response.json()) as SmsDetailResponse;
      if (!body.ok || !body.message) {
        setDetailError(body.error ?? 'unable_to_load_message');
        return;
      }
      setDetail(body.message);
      if (!body.message.readAt) void markRead(id);
    } catch {
      setDetailError('network_error');
    } finally {
      setDetailLoading(false);
    }
  }

  async function signOut() {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  return (
    <AdminLayout
      styles={[...adminCallsStyles, ...adminSmsStyles, ...adminSidebarAddonStyles]}
      scripts={adminCallsScripts}
      scriptPrefix="admin-sms-live"
      bodyClass="app-body"
    >
      <div className="app-shell">
        <AdminSidebar />
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>SMS Inbox.</h1>
              <p>Review inbound SMS received by the whitelisted Telnyx demo numbers.</p>
            </div>
            <div className="top-actions">
              <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
                Refresh
              </button>
              <button type="button" className="btn ghost" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </div>

          <section className="card soft" style={{ marginBottom: 18 }}>
            <div className="panel-head">
              <div>
                <h3>Filters</h3>
                <p className="sub">
                  {inboxConfigured
                    ? `${allowedNumbers.length} allowed inbox number${allowedNumbers.length === 1 ? '' : 's'} configured.`
                    : 'No SMS inbox whitelist is configured.'}
                </p>
              </div>
              {pagination ? <span className="tag purple">{pagination.total} messages</span> : null}
            </div>
            <div className="sms-filter-grid">
              <div className="field field--search">
                <label htmlFor="sms-q">Search</label>
                <input
                  id="sms-q"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="From, to, or message text"
                />
              </div>
              <div className="field">
                <label htmlFor="sms-to">To number</label>
                <select id="sms-to" value={toNumber} onChange={(event) => setToNumber(event.target.value)}>
                  <option value="">All numbers</option>
                  {allowedNumbers.map((number) => (
                    <option key={number} value={number}>
                      {number}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sms-read">Status</label>
                <select id="sms-read" value={read} onChange={(event) => setRead(event.target.value as ReadFilter)}>
                  <option value="all">All</option>
                  <option value="unread">Unread</option>
                  <option value="read">Read</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="sms-from">From</label>
                <input id="sms-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="sms-date-to">To</label>
                <input id="sms-date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </div>
              <div className="field field--apply">
                <label aria-hidden="true">&nbsp;</label>
                <button type="button" className="btn purple" onClick={applyFilters}>
                  Apply
                </button>
              </div>
            </div>
          </section>

          {error ? <div className="note" style={{ marginBottom: 18 }}>{error}</div> : null}
          {!inboxConfigured ? (
            <div className="empty">Set TELNYX_SMS_INBOX_ALLOWED_NUMBERS to start collecting admin SMS.</div>
          ) : (
            <section className="card">
              <div className="panel-head">
                <div>
                  <h3>Inbound messages</h3>
                  <p className="sub">{loading ? 'Loading messages...' : 'Sorted by received time, newest first.'}</p>
                </div>
              </div>
              {items.length === 0 ? (
                <div className="empty">No SMS messages match the current filters.</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Message</th>
                      <th>Received</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((message) => (
                      <tr key={message.id}>
                        <td>
                          <span className={statusClass(message)}>{statusLabel(message)}</span>
                        </td>
                        <td className="sms-phone">{message.fromNumber}</td>
                        <td className="sms-phone">{message.toNumber}</td>
                        <td className="sms-message-cell">
                          <div className="sms-message-preview">{message.bodyPreview || 'No text body'}</div>
                          {message.mediaUrls.length > 0 ? (
                            <div className="sms-muted">{message.mediaUrls.length} media attachment(s)</div>
                          ) : null}
                        </td>
                        <td>{formatDateTime(message.receivedAt)}</td>
                        <td className="admin-table-actions">
                          <div className="admin-table-actions-inner">
                            <button type="button" className="btn" onClick={() => void openDetail(message.id)}>
                              Open
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="inline" style={{ marginTop: 16 }}>
                <span className="sms-muted">
                  Page {pagination?.page ?? page} of {totalPages}
                </span>
                <div className="top-actions">
                  <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </button>
                  <button type="button" className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              </div>
            </section>
          )}

          <dialog ref={detailDialogRef} className="sms-dialog" onClose={() => { setDetail(null); setDetailError(null); }}>
            <div className="sms-dialog-inner">
              <div className="sms-dialog-head">
                <div>
                  <h3>SMS detail</h3>
                  <p className="sub">{detail ? `${detail.fromNumber} to ${detail.toNumber}` : 'Loading message detail.'}</p>
                </div>
                <div className="sms-dialog-actions">
                  {detail && !detail.readAt ? (
                    <button type="button" className="btn" onClick={() => void markRead(detail.id)}>
                      Mark read
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setDetail(null);
                      setDetailError(null);
                      detailDialogRef.current?.close();
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
              {detailLoading ? <div className="note">Loading...</div> : null}
              {detailError ? <div className="note">{detailError}</div> : null}
              {detail ? (
                <>
                  <div className="sms-detail-grid">
                    <div className="sms-detail-box">
                      <div className="sms-detail-label">Received</div>
                      <div>{formatDateTime(detail.receivedAt)}</div>
                    </div>
                    <div className="sms-detail-box">
                      <div className="sms-detail-label">Status</div>
                      <span className={statusClass(detail)}>{statusLabel(detail)}</span>
                    </div>
                    <div className="sms-detail-box">
                      <div className="sms-detail-label">Telnyx event</div>
                      <div className="sms-phone">{detail.telnyxEventId}</div>
                    </div>
                    <div className="sms-detail-box">
                      <div className="sms-detail-label">Telnyx message</div>
                      <div className="sms-phone">{detail.telnyxMessageId ?? 'Not provided'}</div>
                    </div>
                  </div>
                  <div className="note sms-body-box">{detail.body || 'No text body'}</div>
                  <h3 style={{ marginTop: 18 }}>Raw payload</h3>
                  <pre className="sms-raw">{JSON.stringify(detail.rawPayload ?? null, null, 2)}</pre>
                </>
              ) : null}
            </div>
          </dialog>
        </main>
      </div>
    </AdminLayout>
  );
}
