'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { AdminLayout } from '@/components/admin/admin-layout';
import { adminShopsScripts, adminShopsStyles } from '@/components/admin/admin-shops';

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'closed' | 'spam';

type LeadRecord = {
  id: string;
  requestId: string;
  fullName: string;
  businessName: string;
  email: string;
  phoneNumber: string;
  businessType: string;
  currentSetup: string;
  helpNeed: string;
  bestTime: string;
  status: LeadStatus;
  source: string;
  notes?: string | null;
  handledBy?: string | null;
  handledAt?: string | null;
  createdAt?: string;
};

type LeadsResponse = {
  ok: boolean;
  leads?: LeadRecord[];
  metrics?: {
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    closed: number;
    spam: number;
  };
  error?: string;
};

type LeadStatusPatchResponse = {
  ok: boolean;
  lead?: LeadRecord;
  error?: string;
};

const STATUS_OPTIONS: Array<{ value: LeadStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'closed', label: 'Closed' },
  { value: 'spam', label: 'Spam' },
];

function formatDateTime(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

function statusTagClass(status: LeadStatus) {
  if (status === 'new') return 'tag blue';
  if (status === 'contacted') return 'tag purple';
  if (status === 'qualified') return 'tag green';
  if (status === 'spam') return 'tag red';
  return 'tag orange';
}

function statusLabel(status: LeadStatus) {
  if (status === 'new') return 'New';
  if (status === 'contacted') return 'Contacted';
  if (status === 'qualified') return 'Qualified';
  if (status === 'closed') return 'Closed';
  return 'Spam';
}

export function AdminLeadsLive() {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '300');
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (query.trim()) params.set('query', query.trim());
      const response = await fetch(`/api/backend/admin/leads?${params.toString()}`);
      const body = (await response.json()) as LeadsResponse;
      if (!body.ok) {
        setError(body.error ?? 'unable_to_load');
        return;
      }
      setLeads(body.leads ?? []);
    } catch {
      setError('network_error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [statusFilter, query]);

  async function updateStatus(lead: LeadRecord, status: LeadStatus) {
    setUpdatingLeadId(lead.id);
    setError(null);
    try {
      const response = await fetch(`/api/backend/admin/leads/${encodeURIComponent(lead.id)}/status`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status,
          notes: lead.notes ?? null,
        }),
      });
      const body = (await response.json()) as LeadStatusPatchResponse;
      if (!body.ok || !body.lead) {
        setError(body.error ?? 'update_failed');
        return;
      }
      setLeads((current) => current.map((item) => (item.id === body.lead?.id ? body.lead : item)));
    } catch {
      setError('network_error');
    } finally {
      setUpdatingLeadId(null);
    }
  }

  async function updateNotes(lead: LeadRecord, notes: string) {
    setUpdatingLeadId(lead.id);
    setError(null);
    try {
      const response = await fetch(`/api/backend/admin/leads/${encodeURIComponent(lead.id)}/status`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: lead.status,
          notes: notes.trim().length > 0 ? notes : null,
        }),
      });
      const body = (await response.json()) as LeadStatusPatchResponse;
      if (!body.ok || !body.lead) {
        setError(body.error ?? 'update_failed');
        return;
      }
      setLeads((current) => current.map((item) => (item.id === body.lead?.id ? body.lead : item)));
    } catch {
      setError('network_error');
    } finally {
      setUpdatingLeadId(null);
    }
  }

  function onSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setQuery(draftQuery);
  }

  const metrics = useMemo(() => {
    return {
      total: leads.length,
      new: leads.filter((lead) => lead.status === 'new').length,
      qualified: leads.filter((lead) => lead.status === 'qualified').length,
      closed: leads.filter((lead) => lead.status === 'closed').length,
    };
  }, [leads]);

  return (
    <AdminLayout styles={adminShopsStyles} scripts={adminShopsScripts} scriptPrefix="admin-leads-live" bodyClass="app-body">
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">
              <div className="brand-ripple r3" />
              <div className="brand-ripple r2" />
              <div className="brand-core">
                <svg viewBox="0 0 24 24">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
              </div>
            </div>
            <span>RingBooker Admin</span>
          </div>
          <div className="workspace">
            <h3>Inbound demand</h3>
            <p>Review contact leads from marketing forms and move them through follow-up status quickly.</p>
          </div>
          <div className="nav-label">Backoffice</div>
          <div className="nav-list">
            <a className="nav-item" href="/admin">
              <div className="nav-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" />
                </svg>
              </div>
              <span>Overview</span>
            </a>
            <a className="nav-item" href="/admin/shops">
              <div className="nav-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M3 10l2-5h14l2 5" />
                  <path d="M4 10h16v10H4z" />
                  <path d="M9 20v-6h6v6" />
                </svg>
              </div>
              <span>Shops</span>
            </a>
            <a className="nav-item" href="/admin/calls">
              <div className="nav-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" />
                </svg>
              </div>
              <span>Calls &amp; Incidents</span>
            </a>
            <a className="nav-item active" href="/admin/leads">
              <div className="nav-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M3 7h18M3 12h18M3 17h12" />
                </svg>
              </div>
              <span>Leads</span>
            </a>
            <a className="nav-item" href="/admin/billing">
              <div className="nav-icon">
                <svg viewBox="0 0 24 24">
                  <rect x={3} y={5} width={18} height={14} rx={2} />
                  <path d="M3 10h18" />
                </svg>
              </div>
              <span>Billing</span>
            </a>
            <a className="nav-item" href="/admin/users">
              <div className="nav-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                  <circle cx="9.5" cy={7} r={3} />
                  <path d="M20 8v6" />
                  <path d="M17 11h6" />
                </svg>
              </div>
              <span>Users &amp; Roles</span>
            </a>
            <a className="nav-item" href="/admin/system-health">
              <div className="nav-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M3 12h4l2-5 4 10 2-5h6" />
                </svg>
              </div>
              <span>System Health</span>
            </a>
          </div>
          <div className="sidebar-foot">
            <strong>Lead handling.</strong>
            <small>Track every inbound contact request with status and handling notes in one place.</small>
          </div>
        </aside>
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Marketing leads.</h1>
              <p>All contact requests submitted from the public marketing form, with quick status management for sales follow-up.</p>
            </div>
            <div className="top-actions">
              <a className="btn" href="/contact">
                Open contact page
              </a>
            </div>
          </div>

          {error ? <div className="note" style={{ marginBottom: 18 }}>Unable to load leads: {error}</div> : null}

          <section className="grid grid-4">
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M3 7h18M3 12h18M3 17h12" />
                  </svg>
                </div>
                <span className="tag blue">Loaded</span>
              </div>
              <div className="stat-value">{metrics.total}</div>
              <div className="stat-meta">Leads in current filter</div>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <span className="tag purple">Queue</span>
              </div>
              <div className="stat-value">{metrics.new}</div>
              <div className="stat-meta">Fresh leads not contacted yet</div>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <span className="tag green">Qualified</span>
              </div>
              <div className="stat-value">{metrics.qualified}</div>
              <div className="stat-meta">Leads marked qualified</div>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12h14" />
                  </svg>
                </div>
                <span className="tag orange">Closed</span>
              </div>
              <div className="stat-value">{metrics.closed}</div>
              <div className="stat-meta">Leads already closed</div>
            </div>
          </section>

          <section className="card" style={{ marginTop: 18 }}>
            <div className="panel-head">
              <div>
                <h3>Filters</h3>
                <p className="sub">Filter by lead status and search by business/name/email/phone.</p>
              </div>
            </div>
            <form onSubmit={onSearchSubmit} className="form-grid">
              <div className="field">
                <label>Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'all')}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Search</label>
                <input
                  value={draftQuery}
                  onChange={(e) => setDraftQuery(e.target.value)}
                  placeholder="Business, contact name, email, phone..."
                />
              </div>
              <div className="field" style={{ alignSelf: 'end' }}>
                <button className="btn purple" type="submit">
                  Apply filters
                </button>
              </div>
              <div className="field" style={{ alignSelf: 'end' }}>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setDraftQuery('');
                    setQuery('');
                  }}
                >
                  Clear
                </button>
              </div>
            </form>
          </section>

          <section className="card" style={{ marginTop: 18 }}>
            <div className="panel-head">
              <div>
                <h3>Lead queue</h3>
                <p className="sub">Set status and notes directly from this table. Changes are saved immediately.</p>
              </div>
            </div>
            {loading ? (
              <div className="empty">Loading leads...</div>
            ) : leads.length === 0 ? (
              <div className="empty">No leads matched your current filters.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Contact</th>
                    <th>Intent</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <div className="item-main">
                          <div className="avatar">{lead.businessName.slice(0, 2).toUpperCase()}</div>
                          <div>
                            <h4 style={{ margin: 0 }}>{lead.businessName}</h4>
                            <p style={{ marginTop: 4 }}>
                              {lead.businessType} · {lead.currentSetup}
                            </p>
                            <p style={{ marginTop: 4 }}>Req: {lead.requestId}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong>{lead.fullName}</strong>
                          <div className="sub" style={{ marginTop: 4 }}>
                            {lead.email}
                          </div>
                          <div className="sub" style={{ marginTop: 4 }}>
                            {lead.phoneNumber} · {lead.bestTime}
                          </div>
                          <div className="sub" style={{ marginTop: 4 }}>
                            {formatDateTime(lead.createdAt)}
                          </div>
                        </div>
                      </td>
                      <td style={{ maxWidth: 320 }}>
                        <div className="note" style={{ whiteSpace: 'pre-wrap' }}>
                          {lead.helpNeed}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'grid', gap: 8 }}>
                          <span className={statusTagClass(lead.status)}>{statusLabel(lead.status)}</span>
                          <select
                            value={lead.status}
                            disabled={updatingLeadId === lead.id}
                            onChange={(e) => void updateStatus(lead, e.target.value as LeadStatus)}
                          >
                            {STATUS_OPTIONS.filter((option) => option.value !== 'all').map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <div className="sub">Handled by: {lead.handledBy ?? '—'}</div>
                          <div className="sub">Handled at: {formatDateTime(lead.handledAt ?? undefined)}</div>
                        </div>
                      </td>
                      <td style={{ minWidth: 260 }}>
                        <LeadNotesEditor
                          lead={lead}
                          disabled={updatingLeadId === lead.id}
                          onSave={async (notes) => {
                            await updateNotes(lead, notes);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </main>
      </div>
    </AdminLayout>
  );
}

function LeadNotesEditor(props: {
  lead: LeadRecord;
  disabled: boolean;
  onSave: (notes: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(props.lead.notes ?? '');

  useEffect(() => {
    setDraft(props.lead.notes ?? '');
  }, [props.lead.id, props.lead.notes]);

  return (
    <div className="field">
      <textarea
        value={draft}
        disabled={props.disabled}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Sales note..."
        style={{ minHeight: 88 }}
      />
      <button
        className="btn ghost"
        type="button"
        disabled={props.disabled}
        onClick={() => {
          void props.onSave(draft);
        }}
      >
        Save note
      </button>
    </div>
  );
}
