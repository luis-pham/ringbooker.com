'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { adminSidebarAddonStyles } from '@/components/admin/admin-sidebar-styles';
import { adminCallsScripts, adminCallsStyles } from '@/components/admin/admin-calls';

type OutboundSmsListItem = {
  id: string;
  shopId: string;
  shopName?: string | null;
  messageType?: string | null;
  status: string;
  fromNumber?: string | null;
  toNumber?: string | null;
  bodyPreview?: string | null;
  createdAt?: string | null;
  submittedAt?: string | null;
  deliveredAt?: string | null;
  failedAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  attempts: number;
  telnyxMessageId?: string | null;
};

type OutboundSmsMessage = OutboundSmsListItem & {
  locationId?: string | null;
  customerId?: string | null;
  bookingId?: string | null;
  callId?: string | null;
  jobId?: string | null;
  category?: string | null;
  customerPhone?: string | null;
  body?: string | null;
  mediaUrls?: string[];
  provider?: string | null;
  providerMessageId?: string | null;
  telnyxEventId?: string | null;
  idempotencyKey?: string | null;
  providerRequest?: unknown | null;
  providerResponse?: unknown | null;
  providerStatusPayload?: unknown | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  updatedAt?: string | null;
  lastAttemptAt?: string | null;
};

type OutboundSmsResponse = {
  ok: boolean;
  items?: OutboundSmsListItem[];
  pagination?: { page: number; pageSize: number; total: number };
  error?: string;
};

type OutboundSmsDetailResponse = {
  ok: boolean;
  message?: OutboundSmsMessage;
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

function outboundStatusClass(status: string): string {
  if (status === 'delivered') return 'tag green';
  if (status === 'submitted' || status === 'sent') return 'tag blue';
  if (status === 'send_failed' || status === 'sending_failed' || status === 'delivery_failed' || status === 'failed') return 'tag red';
  if (status === 'sending') return 'tag blue';
  if (status === 'delivery_unconfirmed' || status === 'unknown') return 'tag purple';
  return 'tag gray';
}

function prettyJson(value: unknown): string {
  if (value == null) return 'Not provided';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const adminOutSmsStyles = [
  String.raw`
.out-sms-filter-grid{display:grid;grid-template-columns:minmax(200px,1fr) minmax(150px,190px) minmax(150px,190px) minmax(130px,170px) minmax(140px,180px) minmax(130px,160px) minmax(130px,160px) max-content;gap:12px;align-items:end}
.out-sms-filter-grid .field{margin:0}
.out-sms-filter-grid .btn{height:40px}
.out-sms-muted{color:var(--muted);font-size:13px;line-height:1.5}
.out-sms-message-cell{max-width:520px}
.out-sms-message-preview{color:var(--text);line-height:1.55;white-space:normal;overflow-wrap:anywhere}
.out-sms-phone{font-variant-numeric:tabular-nums;white-space:nowrap}
.out-sms-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
.out-sms-detail-box{padding:12px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--panel-2)}
.out-sms-detail-box .out-sms-detail-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin-bottom:4px}
.out-sms-body-box{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}
.out-sms-json-box{max-height:280px;overflow:auto;white-space:pre-wrap;font-size:12px;line-height:1.45}
.out-sms-dialog{width:min(820px,calc(100vw - 32px));border:1px solid var(--line);border-radius:var(--r-lg);background:var(--panel);color:var(--text);padding:0;box-shadow:var(--shadow)}
.out-sms-dialog::backdrop{background:rgba(0,0,0,.58)}
.out-sms-dialog-inner{padding:20px}
.out-sms-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}
.out-sms-dialog-head h3{margin:0;font-size:18px}
@media (max-width:1100px){.out-sms-filter-grid{grid-template-columns:1fr 1fr 1fr}.out-sms-filter-grid .field--search{grid-column:1/-1}.out-sms-filter-grid .field--apply{grid-column:span 1}}
@media (max-width:720px){.out-sms-filter-grid{grid-template-columns:1fr}.out-sms-detail-grid{grid-template-columns:1fr}.out-sms-phone{white-space:normal}.out-sms-message-cell{max-width:none}}
`,
];

export function AdminOutSmsLive() {
  const [query, setQuery] = useState('');
  const [shopId, setShopId] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [toNumber, setToNumber] = useState('');
  const [status, setStatus] = useState('');
  const [messageType, setMessageType] = useState('');
  const [dateFrom, setDateFrom] = useState(() => utcDaysAgoIso(30));
  const [dateTo, setDateTo] = useState(() => utcTodayIso());
  const [applied, setApplied] = useState(() => ({
    query: '',
    shopId: '',
    fromNumber: '',
    toNumber: '',
    status: '',
    messageType: '',
    dateFrom: utcDaysAgoIso(30),
    dateTo: utcTodayIso(),
  }));
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<OutboundSmsListItem[]>([]);
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<OutboundSmsMessage | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailDialogRef = useRef<HTMLDialogElement>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (applied.query) qs.set('q', applied.query);
    if (applied.shopId) qs.set('shopId', applied.shopId);
    if (applied.fromNumber) qs.set('fromNumber', applied.fromNumber);
    if (applied.toNumber) qs.set('toNumber', applied.toNumber);
    if (applied.status) qs.set('status', applied.status);
    if (applied.messageType) qs.set('messageType', applied.messageType);
    if (applied.dateFrom) qs.set('dateFrom', applied.dateFrom);
    if (applied.dateTo) qs.set('dateTo', applied.dateTo);
    qs.set('page', String(page));

    setLoading(true);
    try {
      const response = await fetch(`/api/backend/admin/sms/outbound?${qs.toString()}`);
      const body = (await response.json()) as OutboundSmsResponse;
      if (!body.ok) {
        setError(body.error ?? 'unable_to_load');
        setItems([]);
        setPagination(null);
        return;
      }
      setError(null);
      setItems(body.items ?? []);
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
    setApplied({
      query: query.trim(),
      shopId: shopId.trim(),
      fromNumber: fromNumber.trim(),
      toNumber: toNumber.trim(),
      status,
      messageType: messageType.trim(),
      dateFrom,
      dateTo,
    });
  }

  async function openDetail(id: string) {
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/backend/admin/sms/outbound/${encodeURIComponent(id)}`);
      const body = (await response.json()) as OutboundSmsDetailResponse;
      if (!body.ok || !body.message) {
        setDetailError(body.error ?? 'unable_to_load_message');
        return;
      }
      setDetail(body.message);
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
      styles={[...adminCallsStyles, ...adminOutSmsStyles, ...adminSidebarAddonStyles]}
      scripts={adminCallsScripts}
      scriptPrefix="admin-out-sms-live"
      bodyClass="app-body"
    >
      <div className="app-shell">
        <AdminSidebar />
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Out SMS.</h1>
              <p>System SMS sent from shop Telnyx numbers to customers.</p>
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
                <p className="sub">Inspect outbound SMS lifecycle and Telnyx submission status.</p>
              </div>
              {pagination ? <span className="tag purple">{pagination.total} messages</span> : null}
            </div>
            <div className="out-sms-filter-grid">
              <div className="field field--search">
                <label htmlFor="out-sms-q">Search</label>
                <input
                  id="out-sms-q"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="From, to, body, or Telnyx ID"
                />
              </div>
              <div className="field">
                <label htmlFor="out-sms-shop">Shop ID</label>
                <input id="out-sms-shop" value={shopId} onChange={(event) => setShopId(event.target.value)} placeholder="UUID" />
              </div>
              <div className="field">
                <label htmlFor="out-sms-from">From</label>
                <input id="out-sms-from" value={fromNumber} onChange={(event) => setFromNumber(event.target.value)} placeholder="+1..." />
              </div>
              <div className="field">
                <label htmlFor="out-sms-to">To</label>
                <input id="out-sms-to" value={toNumber} onChange={(event) => setToNumber(event.target.value)} placeholder="+1..." />
              </div>
              <div className="field">
                <label htmlFor="out-sms-status">Status</label>
                <select id="out-sms-status" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">All</option>
                  <option value="queued">Queued</option>
                  <option value="sending">Sending</option>
                  <option value="submitted">Submitted</option>
                  <option value="delivered">Delivered</option>
                  <option value="delivery_failed">Delivery failed</option>
                  <option value="delivery_unconfirmed">Delivery unconfirmed</option>
                  <option value="send_failed">Send failed</option>
                  <option value="unknown">Unknown</option>
                  <option value="sent">Legacy sent</option>
                  <option value="failed">Legacy failed</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="out-sms-type">Type</label>
                <input
                  id="out-sms-type"
                  value={messageType}
                  onChange={(event) => setMessageType(event.target.value)}
                  placeholder="reminder_24h"
                />
              </div>
              <div className="field">
                <label htmlFor="out-sms-date-from">From</label>
                <input id="out-sms-date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="out-sms-date-to">To</label>
                <input id="out-sms-date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
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
          <section className="card">
            <div className="panel-head">
              <div>
                <h3>Outbound messages</h3>
                <p className="sub">{loading ? 'Loading messages...' : 'Sorted by created time, newest first.'}</p>
              </div>
            </div>
            {items.length === 0 ? (
              <div className="empty">No outbound SMS messages match the current filters.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Shop</th>
                    <th>Type</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Message</th>
                    <th>Created</th>
                    <th>Latest status</th>
                    <th>Attempts</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((message) => (
                    <tr key={message.id}>
                      <td>
                        <span className={outboundStatusClass(message.status)}>{message.status}</span>
                        {message.errorCode ? <div className="out-sms-muted">{message.errorCode}</div> : null}
                      </td>
                      <td>{message.shopName ?? message.shopId}</td>
                      <td>{message.messageType ?? 'unknown'}</td>
                      <td className="out-sms-phone">{message.fromNumber ?? 'Not set'}</td>
                      <td className="out-sms-phone">{message.toNumber ?? 'Not set'}</td>
                      <td className="out-sms-message-cell">
                        <div className="out-sms-message-preview">{message.bodyPreview || 'No text body'}</div>
                        {message.telnyxMessageId ? <div className="out-sms-muted">{message.telnyxMessageId}</div> : null}
                      </td>
                      <td>{formatDateTime(message.createdAt)}</td>
                      <td>{formatDateTime(message.deliveredAt ?? message.failedAt ?? message.submittedAt)}</td>
                      <td>{message.attempts}</td>
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
              <span className="out-sms-muted">
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

          <dialog ref={detailDialogRef} className="out-sms-dialog" onClose={() => { setDetail(null); setDetailError(null); }}>
            <div className="out-sms-dialog-inner">
              <div className="out-sms-dialog-head">
                <div>
                  <h3>Outbound SMS detail</h3>
                  <p className="sub">{detail ? `${detail.fromNumber ?? 'Not set'} to ${detail.toNumber ?? 'Not set'}` : 'Loading message detail.'}</p>
                </div>
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
              {detailLoading ? <div className="note">Loading...</div> : null}
              {detailError ? <div className="note">{detailError}</div> : null}
              {detail ? (
                <>
                  <div className="out-sms-detail-grid">
                    <div className="out-sms-detail-box">
                      <div className="out-sms-detail-label">Status</div>
                      <span className={outboundStatusClass(detail.status)}>{detail.status}</span>
                    </div>
                    <div className="out-sms-detail-box">
                      <div className="out-sms-detail-label">Shop</div>
                      <div>{detail.shopName ?? detail.shopId}</div>
                    </div>
                    <div className="out-sms-detail-box">
                      <div className="out-sms-detail-label">Type</div>
                      <div>{detail.messageType ?? detail.category ?? 'unknown'}</div>
                    </div>
                    <div className="out-sms-detail-box">
                      <div className="out-sms-detail-label">Attempts</div>
                      <div>{detail.attempts}</div>
                    </div>
                    <div className="out-sms-detail-box">
                      <div className="out-sms-detail-label">From</div>
                      <div className="out-sms-phone">{detail.fromNumber ?? 'Not set'}</div>
                    </div>
                    <div className="out-sms-detail-box">
                      <div className="out-sms-detail-label">To</div>
                      <div className="out-sms-phone">{detail.toNumber ?? detail.customerPhone ?? 'Not set'}</div>
                    </div>
                    <div className="out-sms-detail-box">
                      <div className="out-sms-detail-label">Telnyx message</div>
                      <div className="out-sms-phone">{detail.telnyxMessageId ?? detail.providerMessageId ?? 'Not provided'}</div>
                    </div>
                    <div className="out-sms-detail-box">
                      <div className="out-sms-detail-label">Telnyx status event</div>
                      <div className="out-sms-phone">{detail.telnyxEventId ?? 'Not provided'}</div>
                    </div>
                    <div className="out-sms-detail-box">
                      <div className="out-sms-detail-label">Idempotency</div>
                      <div className="out-sms-phone">{detail.idempotencyKey ?? 'Not provided'}</div>
                    </div>
                    <div className="out-sms-detail-box">
                      <div className="out-sms-detail-label">Related IDs</div>
                      <div className="out-sms-muted">
                        Job: {detail.jobId ?? 'none'}<br />
                        Call: {detail.callId ?? 'none'}<br />
                        Booking: {detail.bookingId ?? 'none'}<br />
                        Location: {detail.locationId ?? 'none'}
                      </div>
                    </div>
                    <div className="out-sms-detail-box">
                      <div className="out-sms-detail-label">Timeline</div>
                      <div className="out-sms-muted">
                        Created: {formatDateTime(detail.createdAt)}<br />
                        Sending: {formatDateTime(detail.lastAttemptAt)}<br />
                        Submitted: {formatDateTime(detail.submittedAt)}<br />
                        Delivered: {formatDateTime(detail.deliveredAt)}<br />
                        Failed: {formatDateTime(detail.failedAt)}
                      </div>
                    </div>
                    <div className="out-sms-detail-box">
                      <div className="out-sms-detail-label">Error</div>
                      <div>{detail.errorCode ? `${detail.errorCode}: ${detail.errorMessage ?? ''}` : 'None'}</div>
                    </div>
                  </div>
                  <div className="note out-sms-body-box" style={{ marginBottom: 14 }}>{detail.body || 'No text body'}</div>
                  <div className="out-sms-detail-grid">
                    <div className="out-sms-detail-box">
                      <div className="out-sms-detail-label">Provider request</div>
                      <pre className="out-sms-json-box">{prettyJson(detail.providerRequest)}</pre>
                    </div>
                    <div className="out-sms-detail-box">
                      <div className="out-sms-detail-label">Provider response</div>
                      <pre className="out-sms-json-box">{prettyJson(detail.providerResponse)}</pre>
                    </div>
                    <div className="out-sms-detail-box">
                      <div className="out-sms-detail-label">Provider status payload</div>
                      <pre className="out-sms-json-box">{prettyJson(detail.providerStatusPayload)}</pre>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </dialog>
        </main>
      </div>
    </AdminLayout>
  );
}
