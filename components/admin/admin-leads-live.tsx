'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { adminSidebarAddonStyles } from '@/components/admin/admin-sidebar-styles';
import { adminShopsScripts, adminShopsStyles } from '@/components/admin/admin-shops';

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'closed' | 'spam';
type LeadIntent = 'demo' | 'enterprise' | 'sales' | 'support' | 'general';

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
  intent: LeadIntent;
  sourceDetail?: string | null;
  planInterest?: 'starter' | 'professional' | 'enterprise' | 'unknown';
  locationCount?: number | null;
  estimatedCallVolume?: string | null;
  bookingSoftware?: string | null;
  routingNeeds?: string | null;
  goLiveTimeline?: string | null;
  numberOfLocations?: number | null;
  estimatedMonthlyCallVolume?: string | null;
  currentBookingSoftware?: string | null;
  routingRules?: string | null;
  preferredGoLiveTimeline?: string | null;
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


const INTENT_OPTIONS: Array<{ value: LeadIntent | 'all'; label: string }> = [
  { value: 'all', label: 'All intents' },
  { value: 'enterprise', label: 'Enterprise / Custom' },
  { value: 'demo', label: 'Demo' },
  { value: 'sales', label: 'Sales' },
  { value: 'support', label: 'Support' },
  { value: 'general', label: 'General' },
];

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

function intentTagClass(intent: LeadIntent) {
  if (intent === 'enterprise') return 'tag orange';
  if (intent === 'demo') return 'tag blue';
  if (intent === 'support') return 'tag red';
  if (intent === 'sales') return 'tag purple';
  return 'tag';
}

function intentLabel(intent?: LeadIntent) {
  if (intent === 'enterprise') return 'Enterprise';
  if (intent === 'demo') return 'Demo';
  if (intent === 'sales') return 'Sales';
  if (intent === 'support') return 'Support';
  return 'General';
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
  const [intentFilter, setIntentFilter] = useState<LeadIntent | 'all'>('all');
  const [query, setQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [noteLead, setNoteLead] = useState<LeadRecord | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const noteDialogRef = useRef<HTMLDialogElement>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '300');
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (intentFilter !== 'all') params.set('intent', intentFilter);
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
  }, [statusFilter, intentFilter, query]);

  useEffect(() => {
    const el = noteDialogRef.current;
    if (!el) return;
    if (noteLead) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [noteLead]);

  function openNoteDialog(lead: LeadRecord) {
    setNoteDraft(lead.notes ?? '');
    setNoteLead(lead);
  }

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

  async function updateNotes(lead: LeadRecord, notes: string): Promise<boolean> {
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
        return false;
      }
      setLeads((current) => current.map((item) => (item.id === body.lead?.id ? body.lead : item)));
      return true;
    } catch {
      setError('network_error');
      return false;
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
    <AdminLayout
      styles={[...adminShopsStyles, ...adminSidebarAddonStyles]}
      scripts={adminShopsScripts}
      scriptPrefix="admin-leads-live"
      bodyClass="app-body"
    >
      <div className="app-shell">
        <AdminSidebar />
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
            <form onSubmit={onSearchSubmit} className="admin-filter-bar">
              <div className="field field--status">
                <label htmlFor="leads-filter-status">Status</label>
                <select
                  id="leads-filter-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'all')}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field field--intent">
                <label htmlFor="leads-filter-intent">Intent</label>
                <select
                  id="leads-filter-intent"
                  value={intentFilter}
                  onChange={(e) => setIntentFilter(e.target.value as LeadIntent | 'all')}
                >
                  {INTENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field field--search">
                <label htmlFor="leads-filter-search">Search</label>
                <input
                  id="leads-filter-search"
                  value={draftQuery}
                  onChange={(e) => setDraftQuery(e.target.value)}
                  placeholder="Business, contact name, email, phone..."
                />
              </div>
              <div className="field field--apply">
                <button className="btn purple" type="submit">
                  Apply filters
                </button>
              </div>
              <div className="field field--clear">
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setIntentFilter('all');
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
                <p className="sub">Update status inline. Open Note to add or edit sales notes in a dialog.</p>
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
                      <td style={{ maxWidth: 360 }}>
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span className={intentTagClass(lead.intent)}>{intentLabel(lead.intent)}</span>
                            {lead.planInterest && lead.planInterest !== 'unknown' ? <span className="tag purple">{lead.planInterest}</span> : null}
                            {lead.sourceDetail ? <span className="tag">{lead.sourceDetail}</span> : null}
                          </div>
                          {lead.intent === 'enterprise' ? (
                            <div className="note" style={{ whiteSpace: 'pre-wrap' }}>
                              {[
                                lead.locationCount || lead.numberOfLocations ? `Locations: ${lead.locationCount ?? lead.numberOfLocations}` : null,
                                lead.estimatedCallVolume || lead.estimatedMonthlyCallVolume ? `Calls: ${lead.estimatedCallVolume ?? lead.estimatedMonthlyCallVolume}` : null,
                                lead.bookingSoftware || lead.currentBookingSoftware ? `Booking software: ${lead.bookingSoftware ?? lead.currentBookingSoftware}` : null,
                                lead.goLiveTimeline || lead.preferredGoLiveTimeline ? `Timeline: ${lead.goLiveTimeline ?? lead.preferredGoLiveTimeline}` : null,
                                lead.routingNeeds || lead.routingRules ? `Routing: ${lead.routingNeeds ?? lead.routingRules}` : null,
                              ].filter(Boolean).join('\n')}
                            </div>
                          ) : null}
                          <div className="note" style={{ whiteSpace: 'pre-wrap' }}>
                            {lead.helpNeed}
                          </div>
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
                      <td>
                        <button
                          type="button"
                          className={`admin-table-note-btn${lead.notes?.trim() ? ' has-note' : ''}`}
                          disabled={updatingLeadId === lead.id}
                          onClick={() => openNoteDialog(lead)}
                          aria-label={lead.notes?.trim() ? 'Edit sales note' : 'Add sales note'}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden>
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                          Note
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <dialog
            ref={noteDialogRef}
            className="rb-admin-modal"
            onClose={() => {
              setNoteLead(null);
              setNoteDraft('');
            }}
          >
            {noteLead ? (
              <>
                <div className="rb-admin-modal-head">
                  <div>
                    <h3 style={{ margin: '0 0 6px' }}>Sales note</h3>
                    <p className="sub" style={{ margin: 0 }}>
                      {noteLead.businessName} · {noteLead.fullName}
                    </p>
                  </div>
                  <button type="button" className="btn ghost" onClick={() => noteDialogRef.current?.close()}>
                    Close
                  </button>
                </div>
                <div className="rb-admin-modal-body">
                  <div className="field">
                    <label htmlFor="lead-note-textarea">Note</label>
                    <textarea
                      id="lead-note-textarea"
                      value={noteDraft}
                      disabled={updatingLeadId === noteLead.id}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Sales note..."
                      rows={6}
                      autoFocus
                    />
                  </div>
                  <div className="top-actions" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn ghost" onClick={() => noteDialogRef.current?.close()}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn purple"
                      disabled={updatingLeadId === noteLead.id}
                      onClick={() => {
                        void (async () => {
                          const saved = await updateNotes(noteLead, noteDraft);
                          if (saved) noteDialogRef.current?.close();
                        })();
                      }}
                    >
                      {updatingLeadId === noteLead.id ? 'Saving…' : 'Save note'}
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </dialog>
        </main>
      </div>
    </AdminLayout>
  );
}
