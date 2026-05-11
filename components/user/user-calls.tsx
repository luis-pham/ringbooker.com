import { UserLayout } from '@/components/user/user-layout';
import { userDashboardStyles } from '@/components/user/user-dashboard';

/** Calls metrics mirror billing status cards; filter tabs match portal billing subtabs. */
const callsPortalStyles = String.raw`
.calls-metric-grid{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px;
}
.calls-metric-card{
  background:#fff;border:1px solid var(--border);border-radius:22px;box-shadow:none;
  padding:22px;min-width:0;min-height:100%;display:flex;flex-direction:column;gap:6px;
}
.calls-metric-card .bst-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-light)}
.calls-metric-card .bst-value{font-size:17px;font-weight:600;letter-spacing:-.02em;color:var(--text-dark);line-height:1.25}
.calls-metric-card .bst-meta{font-size:12px;color:var(--text-gray);line-height:1.45;margin-top:auto}
.calls-filter-bar{margin-bottom:16px}
.calls-list-card{margin-top:18px}
.calls-list-card .calls-table-wrap{border-radius:12px}
.calls-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:12px;background:var(--surface-card)}
.calls-table .mini-avatar{
  width:40px;height:40px;border-radius:999px;background:var(--purple-light);
  display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--purple-dark);flex-shrink:0;font-size:13px;
}
.calls-table .value-strong{font-weight:600;color:var(--text-dark);font-size:14px;letter-spacing:-.02em}
.calls-table .subline{margin-top:2px;color:var(--text-gray);font-size:12px;line-height:1.45}
.calls-table .vip-inline{margin-left:6px;font-size:11px;font-weight:500}
.call-status-pill{
  display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;
  background:var(--bg-gray);color:var(--text-dark);font-size:12px;font-weight:600;white-space:nowrap;
}
.call-status-pill svg{width:14px;height:14px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
.calls-pagination{
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;
  margin-top:16px;padding-top:16px;border-top:1px solid var(--border);
}
.calls-pagination .pager-meta{color:var(--text-gray);font-size:13px;line-height:1.45}
.calls-pagination .pager-actions{display:flex;align-items:center;gap:8px}
.business-subtabs.calls-filter-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:0}
.business-subtabs.calls-filter-tabs .business-subtab{
  border:1px solid var(--border);background:var(--surface-card);border-radius:8px;padding:8px 14px;
  font-size:13px;font-weight:600;color:var(--text-gray);cursor:pointer;font:inherit;
  transition:background .15s ease,border-color .15s ease,color .15s ease;box-shadow:none;
}
.business-subtabs.calls-filter-tabs .business-subtab:hover{background:#f9fafb;border-color:#d1d5db;color:var(--text-dark)}
.business-subtabs.calls-filter-tabs .business-subtab.active{
  background:#0d1117;color:#fff;border-color:#0d1117;font-weight:600;
}
.business-subtabs.calls-filter-tabs .business-subtab.active:hover{background:#161b22;border-color:#161b22;color:#fff}
.intent-filter-count{
  margin-left:6px;background:#b91c1c;color:#fff;font-size:10px;font-weight:600;min-width:18px;height:18px;
  border-radius:999px;display:inline-flex;align-items:center;justify-content:center;padding:0 5px;vertical-align:middle;
}
@media (max-width:1200px){
  .calls-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:860px){
  .calls-metric-grid{grid-template-columns:1fr}
}
html[data-user-theme="dark"] .calls-metric-card{
  background:var(--surface-card);border-color:var(--border);
}
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs .business-subtab{
  background:var(--surface-card);border-color:var(--border);color:var(--text-gray);
}
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs .business-subtab:hover{background:#21262d;color:var(--text-dark)}
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs .business-subtab.active{
  background:#1f6feb;border-color:#1f6feb;color:#fff;
}
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs .business-subtab.active:hover{
  background:#388bfd;border-color:#388bfd;color:#fff;
}
.mobile-calls{display:none}
.desktop-calls{}
.intent-call-summary{margin-top:10px;display:flex;flex-direction:column;gap:8px}
.intent-badges{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.intent-fields{font-size:13px;color:var(--text-gray);display:flex;flex-direction:column;gap:4px}
.intent-fields > span > span:first-child{color:var(--text-light);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-right:0}
.intent-fields > span > span:first-child::after{content:': '}
.intent-follow-up{
  background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;font-size:13px;color:#92400e;
  display:flex;justify-content:space-between;align-items:center;gap:10px;
}
.intent-follow-up button{font-size:12px;font-weight:600;color:#92400e;background:transparent;border:1px solid #fde68a;border-radius:999px;padding:4px 12px;cursor:pointer;white-space:nowrap}
.modal-backdrop{
  position:fixed;inset:0;background:rgba(17,24,39,.58);backdrop-filter:blur(8px);
  display:flex;align-items:center;justify-content:center;padding:24px;z-index:160;
}
.modal-card{
  width:min(920px,100%);max-height:min(88vh,920px);overflow:auto;background:var(--surface-card);border:1px solid var(--border);
  border-radius:22px;box-shadow:0 24px 80px rgba(17,24,39,.18);padding:22px;
}
.modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}
.modal-title h3{margin:0;font-size:15px;font-weight:500;letter-spacing:-.01em;color:var(--text-dark)}
.modal-title p{margin:6px 0 0;color:var(--text-gray);font-size:13px;line-height:1.55}
.modal-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:18px}
.meta-tile{border:1px solid var(--border);border-radius:12px;padding:14px 16px;background:var(--bg-gray)}
.meta-tile strong{display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-light);margin-bottom:6px}
.meta-tile span{display:block;font-size:13px;color:var(--text-dark);line-height:1.5}
.summary-panel{border:1px solid var(--border);border-radius:12px;padding:14px 16px;background:var(--bg-gray);margin-bottom:18px}
.summary-badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center}
.summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px;font-size:13px;line-height:1.5;color:var(--text-dark)}
.summary-grid .full{grid-column:1/-1}
.summary-grid > div > span:first-child{
  color:var(--text-light);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-right:0;
}
.summary-grid > div > span:first-child::after{content:': '}
.follow-up-banner{
  display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;
  background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;font-size:13px;color:#92400e;
}
.follow-up-banner button{font-size:12px;font-weight:600;color:#92400e;background:transparent;border:1px solid #fde68a;border-radius:999px;padding:4px 12px;cursor:pointer;white-space:nowrap}
.transcript-toggle{display:flex;justify-content:flex-start;margin-bottom:10px}
.transcript-note{
  background:var(--bg-gray);border:1px solid var(--border);border-radius:12px;padding:16px;white-space:pre-wrap;
  font-size:13px;line-height:1.65;color:var(--text-dark);
}
@media (max-width:860px){
  .desktop-calls{display:none}
  .mobile-calls{display:flex;flex-direction:column;gap:14px}
  .mobile-call-card{
    border:1px solid var(--border);border-radius:22px;padding:22px;background:var(--surface-card);box-shadow:none;
    min-height:0;display:flex;flex-direction:column;gap:0;
  }
  .mobile-call-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .mobile-call-card h4{margin:0;font-size:15px;font-weight:600;letter-spacing:-.02em;color:var(--text-dark)}
  .mobile-call-meta{margin-top:6px;color:var(--text-gray);font-size:13px;line-height:1.5}
  .mobile-call-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
  .modal-backdrop{padding:12px}
  .modal-card{padding:18px}
  .modal-head{flex-direction:column;align-items:stretch}
  .modal-meta{grid-template-columns:1fr}
  .summary-grid{grid-template-columns:1fr}
}
html[data-user-theme="dark"] .follow-up-banner{background:rgba(187,128,9,0.12);border-color:rgba(210,153,34,.35);color:#d29922}
html[data-user-theme="dark"] .follow-up-banner button{color:#d29922;border-color:rgba(210,153,34,.35)}
html[data-user-theme="dark"] .intent-follow-up{background:rgba(187,128,9,0.12);border-color:rgba(210,153,34,.35);color:#d29922}
html[data-user-theme="dark"] .intent-follow-up button{color:#d29922;border-color:rgba(210,153,34,.35)}
html[data-user-theme="dark"] .modal-card{box-shadow:0 24px 80px rgba(0,0,0,.55)}
html[data-user-theme="dark"] .meta-tile{background:#161b22}
html[data-user-theme="dark"] .summary-panel{background:#161b22}
html[data-user-theme="dark"] .transcript-note{background:#0d1117}
`;

export const userCallsStyles: string[] = [...userDashboardStyles, callsPortalStyles];

export const userCallsScripts: string[] = [];

export const templateTitle = 'Calls, transcripts, and missed revenue recovery.';

export function UserCallsTemplate() {
  return (
    <UserLayout
      styles={userCallsStyles}
      scripts={userCallsScripts}
      scriptPrefix="user-calls"
    >
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-inner">
            <div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#fff" stroke="none" /></svg></div></div><span>RingBooker</span></div>
            <div className="nav-section"><div className="nav-label">User Portal</div><div className="nav-list"><a className="nav-item" href="/user"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={4} width={7} height={7} rx="1.5" /><rect x={14} y={4} width={7} height={4} rx="1.5" /><rect x={14} y={11} width={7} height={9} rx="1.5" /><rect x={3} y={14} width={7} height={6} rx="1.5" /></svg></div><span>Overview</span></a><a className="nav-item" href="/user/bookings"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span>Bookings</span></a><a className="nav-item active" href="/user/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span>Calls &amp; Transcripts</span></a><a className="nav-item" href="/user/settings"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" /></svg></div><span>Settings</span></a><a className="nav-item" href="/user/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /><path d="M7 15h4" /></svg></div><span>Billing</span></a></div></div>
            <div className="sidebar-spacer" />
          </div>
        </aside>
        <main className="main">
          <div className="topbar">
            <div className="page-title"><h1>Calls, transcripts, and missed revenue recovery.</h1><p>Review how your AI phone agent handled every caller.</p></div>
            <div className="top-actions overview-top-actions"><a className="btn" href="/user/knowledge">Edit business info</a><a className="btn user-save" href="/user/bookings">View bookings</a></div>
          </div>
          <section className="grid grid-3">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span className="tag green">Handled</span></div><div className="stat-value">142</div><div className="stat-meta">Calls answered this week</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z" /><path d="M4 8l8 6 8-6" /></svg></div><span className="tag purple">Recovered</span></div><div className="stat-value">19</div><div className="stat-meta">Missed calls converted by text back</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4.5A8 8 0 1 1 21 12Z" /></svg></div><span className="tag orange">Avg 2m 14s</span></div><div className="stat-value">31</div><div className="stat-meta">Calls that became bookings</div></div>
          </section>
          <section className="grid grid-2" style={{marginTop: 18}}>
            <div className="card">
              <div className="panel-head"><div><h3>Recent calls</h3><p className="sub">A high-level timeline of outcomes.</p></div><span className="badge-right">Telnyx + LiveKit</span></div>
              <div className="list">
                <div className="list-item"><div className="item-main"><div className="avatar">EL</div><div><h4>Booked appointment</h4><p>Emma L. · Balayage + Trim · 2m 41s</p></div></div><span className="tag green">Booked</span></div>
                <div className="list-item"><div className="item-main"><div className="avatar">JT</div><div><h4>Pricing question only</h4><p>Gel extensions price and availability · 1m 12s</p></div></div><span className="tag purple">Info only</span></div>
                <div className="list-item"><div className="item-main"><div className="avatar">MK</div><div><h4>Caller hung up early</h4><p>Missed-call text sent after 2 minutes</p></div></div><span className="tag orange">Recovered</span></div>
                <div className="list-item"><div className="item-main"><div className="avatar">AH</div><div><h4>User handoff</h4><p>Complaint about previous service · transferred</p></div></div><span className="tag red">Transferred</span></div>
              </div>
            </div>
            <div className="card soft">
              <div className="panel-head"><div><h3>Transcript preview</h3><p className="sub">The latest conversation summary.</p></div></div>
              <div className="note" style={{background: '#fff', borderRadius: 20}}>
                <strong>Caller:</strong> “Hi, do you have anything for Thursday after work?”<br /><br />
                <strong>RingBooker:</strong> “Yes — Thursday at 6:00 PM is available for a wash and blowout. Would you like me to book that?”<br /><br />
                <strong>Caller:</strong> “Yes, with Sophia if possible.”<br /><br />
                <strong>RingBooker:</strong> “Perfect. I’ve booked you for Thursday at 6:00 PM with Sophia. You’ll receive a confirmation text right away.”
              </div>
              <div className="progress-list" style={{marginTop: 18}}>
                <div className="progress-item"><strong>Booked calls</strong><div className="bar"><span style={{width: '72%'}} /></div><span>31</span></div>
                <div className="progress-item"><strong>Info-only calls</strong><div className="bar"><span style={{width: '38%'}} /></div><span>26</span></div>
                <div className="progress-item"><strong>Transferred calls</strong><div className="bar"><span style={{width: '14%'}} /></div><span>4</span></div>
              </div>
            </div>
          </section>
          <div className="footer-inline"><span>RingBooker user portal concept · aligned to the public landing page styling.</span><span>Mona Sans Variable · Stable layout · Shared design system</span></div>
        </main>
      </div>

    </UserLayout>
  );
}
