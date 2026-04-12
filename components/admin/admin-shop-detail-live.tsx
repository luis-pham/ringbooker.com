'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';

import { AdminLayout } from '@/components/admin/admin-layout';
import { adminShopDetailScripts, adminShopDetailStyles } from '@/components/admin/admin-shop-detail';

type ServiceItem = {
  name: string;
  duration_min: number;
  price: number;
};

type HoursValue =
  | {
      closed: true;
    }
  | {
      open: string;
      close: string;
    };

type ShopDetail = {
  id: string;
  name: string;
  brand_slug?: string | null;
  phone_number: string;
  user_phone: string;
  backup_phone?: string | null;
  user_name?: string | null;
  address?: string | null;
  timezone: string;
  services: ServiceItem[];
  hours: Record<string, HoursValue>;
  cancel_policy: string;
  promotions?: string | null;
  booking_url?: string | null;
  ai_voice?: string | null;
  ai_welcome_message?: string | null;
  ai_custom_instructions?: string | null;
  allow_transfers: boolean;
  allow_callbacks: boolean;
  send_reminder_sms: boolean;
  send_review_request_sms: boolean;
  send_missed_call_followup_sms: boolean;
  plan: string;
  active: boolean;
};

type LoadResponse = {
  ok: boolean;
  shop?: ShopDetail;
  recentCalls?: ShopCall[];
  error?: string;
};

type ShopCall = {
  provider: string;
  providerCallId: string;
  shopId: string;
  callerPhone?: string;
  destinationPhone?: string;
  requestId?: string;
  roomName?: string;
  startedAt?: string;
  endedAt?: string;
  agentJoined: boolean;
  humanAnswered: boolean;
  transcriptStatus?: string;
  transcriptText?: string;
  outcome?: string;
};

function formatDateTime(value?: string) {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString();
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJsonField<T>(input: FormDataEntryValue | null, fallback: T): T {
  if (typeof input !== 'string' || input.trim().length === 0) return fallback;
  return JSON.parse(input) as T;
}

export function AdminShopDetailLive() {
  const params = useParams<{ id: string }>();
  const shopId = params?.id;
  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [recentCalls, setRecentCalls] = useState<ShopCall[]>([]);
  const [activeCall, setActiveCall] = useState<ShopCall | null>(null);

  useEffect(() => {
    if (!shopId) return;
    let active = true;
    void fetch(`/api/backend/admin/shops/${shopId}`)
      .then(async (response) => (await response.json()) as LoadResponse)
      .then((body) => {
        if (!active) return;
        if (!body.ok || !body.shop) {
          setError(body.error ?? 'unable_to_load');
          return;
        }
        setShop(body.shop);
        setRecentCalls(body.recentCalls ?? []);
        setActiveCall((body.recentCalls ?? [])[0] ?? null);
      })
      .catch(() => {
        if (active) setError('network_error');
      });

    return () => {
      active = false;
    };
  }, [shopId]);

  async function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shopId || !shop) return;
    const formData = new FormData(event.currentTarget);
    setSavingProfile(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/backend/admin/shops/${shopId}/settings`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          user_name: String(formData.get('user_name') ?? ''),
          user_phone: String(formData.get('user_phone') ?? ''),
          backup_phone: String(formData.get('backup_phone') ?? '') || null,
          address: String(formData.get('address') ?? '') || null,
          timezone: String(formData.get('timezone') ?? shop.timezone),
          cancel_policy: String(formData.get('cancel_policy') ?? shop.cancel_policy),
          promotions: String(formData.get('promotions') ?? '') || null,
          booking_url: String(formData.get('booking_url') ?? '') || null,
          services: parseJsonField(formData.get('services_json'), shop.services),
          hours: parseJsonField(formData.get('hours_json'), shop.hours),
        }),
      });
      const body = (await response.json()) as LoadResponse;
      if (!response.ok || !body.ok || !body.shop) {
        setError(body.error ?? 'save_failed');
        return;
      }
      setShop(body.shop);
      setNotice('Shop profile and operational settings saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'network_error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function onSaveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shopId || !shop) return;
    const formData = new FormData(event.currentTarget);
    setSavingConfig(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/backend/admin/shops/${shopId}/config`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ai_voice: String(formData.get('ai_voice') ?? '') || null,
          ai_welcome_message: String(formData.get('ai_welcome_message') ?? '') || null,
          ai_custom_instructions: String(formData.get('ai_custom_instructions') ?? '') || null,
          allow_transfers: formData.get('allow_transfers') === 'on',
          allow_callbacks: formData.get('allow_callbacks') === 'on',
          send_reminder_sms: formData.get('send_reminder_sms') === 'on',
          send_review_request_sms: formData.get('send_review_request_sms') === 'on',
          send_missed_call_followup_sms: formData.get('send_missed_call_followup_sms') === 'on',
        }),
      });
      const body = (await response.json()) as LoadResponse;
      if (!response.ok || !body.ok || !body.shop) {
        setError(body.error ?? 'save_failed');
        return;
      }
      setShop(body.shop);
      setNotice('AI and automation config saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'network_error');
    } finally {
      setSavingConfig(false);
    }
  }

  async function onSavePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shopId || !shop) return;
    const formData = new FormData(event.currentTarget);
    setSavingPlan(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/backend/admin/shops/${shopId}/plan`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          plan: String(formData.get('plan') ?? shop.plan),
          active: formData.get('active') === 'on',
        }),
      });
      const body = (await response.json()) as LoadResponse;
      if (!response.ok || !body.ok || !body.shop) {
        setError(body.error ?? 'save_failed');
        return;
      }
      setShop(body.shop);
      setNotice('Billing status updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'network_error');
    } finally {
      setSavingPlan(false);
    }
  }

  return (
    <AdminLayout styles={adminShopDetailStyles} scripts={adminShopDetailScripts} scriptPrefix="admin-shop-detail-live" bodyClass="app-body">
      <div className="app-shell">
        <aside className="sidebar"><div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></div></div><span>RingBooker Admin</span></div><div className="nav-label">Backoffice</div><div className="nav-list"><a className="nav-item " href="/admin"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" /></svg></div><span>Overview</span></a><a className="nav-item " href="/admin/shops"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 10l2-5h14l2 5" /><path d="M4 10h16v10H4z" /><path d="M9 20v-6h6v6" /></svg></div><span>Shops</span></a><a className="nav-item active" href={`/admin/shops/${shopId ?? ''}`}><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M5 20c1.5-3 4-4.5 7-4.5S17.5 17 19 20" /></svg></div><span>Shop Detail</span></a><a className="nav-item " href="/admin/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" /></svg></div><span>Calls &amp; Incidents</span></a><a className="nav-item " href="/admin/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span>Billing</span></a><a className="nav-item " href="/admin/users"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy={7} r={3} /><path d="M20 8v6" /><path d="M17 11h6" /></svg></div><span>Users &amp; Roles</span></a><a className="nav-item " href="/admin/system-health"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span>System Health</span></a></div></aside>
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Shop detail.</h1>
              <p>Configure one salon account across business profile, AI prompt behavior, transfer rules, callback rules, and messaging automation.</p>
            </div>
            <div className="top-actions">
              <a className="btn" href="/admin/shops">Back to shops</a>
              <a className="btn" href={`/admin/calls?shopId=${encodeURIComponent(shopId ?? '')}`}>View shop calls</a>
            </div>
          </div>

          {error ? <div className="note" style={{ marginBottom: 18 }}>{error}</div> : null}
          {notice ? <div className="note" style={{ marginBottom: 18 }}>{notice}</div> : null}
          {!shop ? (
            <div className="card"><p className="sub">Loading shop detail...</p></div>
          ) : (
            <>
              <section className="grid grid-3">
                <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" /></svg></div><span className={`tag ${shop.allow_transfers ? 'green' : 'orange'}`}>{shop.allow_transfers ? 'Transfers on' : 'Transfers off'}</span></div><div className="stat-value">{shop.allow_callbacks ? 'Live' : 'Paused'}</div><div className="stat-meta">Callback workflow is {shop.allow_callbacks ? 'enabled' : 'disabled'} for this shop</div></div>
                <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span className="tag purple">{shop.plan}</span></div><div className="stat-value">{shop.active ? 'Active' : 'Paused'}</div><div className="stat-meta">Billing plan and shop activation state</div></div>
                <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span className="tag blue">{shop.ai_voice ?? 'Aoede'}</span></div><div className="stat-value">{shop.send_reminder_sms ? 'SMS on' : 'SMS off'}</div><div className="stat-meta">Reminder, review, and missed-call automation controls</div></div>
              </section>

              <section className="grid grid-2" style={{ marginTop: 18 }}>
                <form className="card" onSubmit={onSaveProfile}>
                  <div className="panel-head"><div><h3>Business profile</h3><p className="sub">Dynamic operational data used by booking, availability, prompts, and dashboard views.</p></div></div>
                  <div className="form-grid">
                    <div className="field"><label>Shop name</label><input value={shop.name} readOnly /></div>
                    <div className="field"><label>Timezone</label><input name="timezone" defaultValue={shop.timezone} /></div>
                    <div className="field"><label>User name</label><input name="user_name" defaultValue={shop.user_name ?? ''} /></div>
                    <div className="field"><label>User phone</label><input name="user_phone" defaultValue={shop.user_phone} /></div>
                    <div className="field"><label>Backup phone</label><input name="backup_phone" defaultValue={shop.backup_phone ?? ''} /></div>
                    <div className="field"><label>Booking URL</label><input name="booking_url" defaultValue={shop.booking_url ?? ''} /></div>
                    <div className="field" style={{ gridColumn: '1 / -1' }}><label>Address</label><textarea name="address" defaultValue={shop.address ?? ''} /></div>
                    <div className="field" style={{ gridColumn: '1 / -1' }}><label>Cancel policy</label><textarea name="cancel_policy" defaultValue={shop.cancel_policy} /></div>
                    <div className="field" style={{ gridColumn: '1 / -1' }}><label>Promotions</label><textarea name="promotions" defaultValue={shop.promotions ?? ''} /></div>
                    <div className="field" style={{ gridColumn: '1 / -1' }}><label>Services JSON</label><textarea name="services_json" defaultValue={prettyJson(shop.services)} /></div>
                    <div className="field" style={{ gridColumn: '1 / -1' }}><label>Hours JSON</label><textarea name="hours_json" defaultValue={prettyJson(shop.hours)} /></div>
                  </div>
                  <div className="top-actions" style={{ marginTop: 18, justifyContent: 'flex-start' }}>
                    <button className="btn purple" type="submit" disabled={savingProfile}>{savingProfile ? 'Saving profile...' : 'Save profile'}</button>
                  </div>
                </form>

                <form className="card soft" onSubmit={onSaveConfig}>
                  <div className="panel-head"><div><h3>AI and automation config</h3><p className="sub">These controls are live and affect prompt building, tool behavior, and outbound automation jobs.</p></div></div>
                  <div className="form-grid">
                    <div className="field"><label>AI voice</label><input name="ai_voice" defaultValue={shop.ai_voice ?? 'Aoede'} /></div>
                    <div className="field" style={{ alignSelf: 'end' }}>
                      <label>Feature toggles</label>
                      <div className="list" style={{ gap: 10 }}>
                        <label className="checkbox"><input name="allow_transfers" type="checkbox" defaultChecked={shop.allow_transfers} />Allow live transfers</label>
                        <label className="checkbox"><input name="allow_callbacks" type="checkbox" defaultChecked={shop.allow_callbacks} />Allow callbacks</label>
                        <label className="checkbox"><input name="send_reminder_sms" type="checkbox" defaultChecked={shop.send_reminder_sms} />Send reminder SMS</label>
                        <label className="checkbox"><input name="send_review_request_sms" type="checkbox" defaultChecked={shop.send_review_request_sms} />Send review request SMS</label>
                        <label className="checkbox"><input name="send_missed_call_followup_sms" type="checkbox" defaultChecked={shop.send_missed_call_followup_sms} />Send missed-call follow-up SMS</label>
                      </div>
                    </div>
                    <div className="field" style={{ gridColumn: '1 / -1' }}><label>AI welcome message</label><textarea name="ai_welcome_message" defaultValue={shop.ai_welcome_message ?? ''} /></div>
                    <div className="field" style={{ gridColumn: '1 / -1' }}><label>AI custom instructions</label><textarea name="ai_custom_instructions" defaultValue={shop.ai_custom_instructions ?? ''} /></div>
                  </div>
                  <div className="top-actions" style={{ marginTop: 18, justifyContent: 'flex-start' }}>
                    <button className="btn purple" type="submit" disabled={savingConfig}>{savingConfig ? 'Saving config...' : 'Save AI config'}</button>
                  </div>
                </form>
              </section>

              <section className="grid grid-2" style={{ marginTop: 18 }}>
                <form className="card" onSubmit={onSavePlan}>
                  <div className="panel-head"><div><h3>Billing and activation</h3><p className="sub">Control commercial state without editing billing provider secrets.</p></div></div>
                  <div className="form-grid">
                    <div className="field">
                      <label>Plan</label>
                      <select name="plan" defaultValue={shop.plan}>
                        <option value="starter">starter</option>
                        <option value="professional">professional</option>
                        <option value="enterprise">enterprise</option>
                      </select>
                    </div>
                    <div className="field" style={{ alignSelf: 'end' }}>
                      <label>Activation</label>
                      <label className="checkbox"><input name="active" type="checkbox" defaultChecked={shop.active} />Shop is active</label>
                    </div>
                  </div>
                  <div className="top-actions" style={{ marginTop: 18, justifyContent: 'flex-start' }}>
                    <button className="btn purple" type="submit" disabled={savingPlan}>{savingPlan ? 'Saving billing...' : 'Save billing state'}</button>
                  </div>
                </form>

                <div className="card soft">
                  <div className="panel-head"><div><h3>What changes live right now</h3><p className="sub">These config values already affect the production code paths.</p></div></div>
                  <div className="list">
                    <div className="list-item"><div className="item-main"><div className="avatar">AI</div><div><h4>Prompt behavior</h4><p>`ai_voice`, welcome message, and custom instructions flow into the system prompt builder.</p></div></div></div>
                    <div className="list-item"><div className="item-main"><div className="avatar">TL</div><div><h4>Tool permissions</h4><p>`allow_transfers` and `allow_callbacks` gate transfer and callback tools immediately.</p></div></div></div>
                    <div className="list-item"><div className="item-main"><div className="avatar">SMS</div><div><h4>Job automation</h4><p>Reminder, review, and missed-call follow-up jobs respect the toggles you save here.</p></div></div></div>
                    <div className="list-item"><div className="item-main"><div className="avatar">OP</div><div><h4>Operational data</h4><p>Services, hours, policy, promotions, and booking URL are used by tools and prompts without restart.</p></div></div></div>
                  </div>
                </div>
              </section>

              <section className="grid grid-2" style={{ marginTop: 18 }}>
                <div className="card">
                  <div className="panel-head">
                    <div>
                      <h3>Recent calls</h3>
                      <p className="sub">Jump into the shop's latest calls, then open the full call list if you need more history.</p>
                    </div>
                    <div className="top-actions" style={{ justifyContent: 'flex-start' }}>
                      <a className="btn" href={`/admin/calls?shopId=${encodeURIComponent(shopId ?? '')}`}>Open all calls</a>
                    </div>
                  </div>
                  {recentCalls.length === 0 ? (
                    <div className="empty">No calls recorded for this shop yet.</div>
                  ) : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Caller</th>
                          <th>Started</th>
                          <th>Outcome</th>
                          <th>Transcript</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentCalls.map((call) => (
                          <tr key={`${call.shopId}:${call.providerCallId}`}>
                            <td>{call.callerPhone ?? 'Unknown caller'}</td>
                            <td>{formatDateTime(call.startedAt)}</td>
                            <td><span className={`tag ${call.outcome === 'booked' ? 'green' : call.outcome === 'missed' ? 'orange' : 'blue'}`}>{call.outcome ?? 'in_progress'}</span></td>
                            <td><button className="btn ghost" type="button" onClick={() => setActiveCall(call)}>Transcript preview</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="card soft">
                  <div className="panel-head">
                    <div>
                      <h3>Selected call preview</h3>
                      <p className="sub">Quick QA state from the shop page without leaving into the network-wide calls screen.</p>
                    </div>
                  </div>
                  {!activeCall ? (
                    <div className="empty">Choose a recent call to preview transcript state.</div>
                  ) : (
                    <div className="list">
                      <div className="list-item"><div className="item-main"><div className="avatar">CL</div><div><h4>{activeCall.callerPhone ?? 'Unknown caller'}</h4><p>{formatDateTime(activeCall.startedAt)} · {activeCall.providerCallId}</p></div></div></div>
                      <div className="list-item"><div className="item-main"><div className="avatar">TX</div><div><h4>{activeCall.transcriptStatus === 'completed' ? 'Transcript ready' : activeCall.transcriptStatus === 'failed' ? 'Transcript failed' : 'Transcript pending'}</h4><p>Room {activeCall.roomName ?? 'n/a'} · Request {activeCall.requestId ?? 'n/a'}</p></div></div></div>
                      <div className="note">
                        {activeCall.transcriptText
                          ? <div style={{ whiteSpace: 'pre-wrap' }}>{activeCall.transcriptText}</div>
                          : activeCall.transcriptStatus === 'completed'
                          ? 'This call is marked transcript-ready, but the transcript body is still missing.'
                          : activeCall.transcriptStatus === 'failed'
                            ? 'Transcript generation failed for this call. Inspect provider logs or reprocess the call summary job.'
                            : 'Transcript is not available yet for this call. The preview entry point is wired now, so transcript text can drop into this panel later without another UX change.'}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </AdminLayout>
  );
}
