import { AdminLayout } from '@/components/admin/admin-layout';
import { adminBaseStyles } from '@/components/admin/admin-base-styles';

const adminShopDetailAddonStyles: string[] = [
  String.raw`
.shop-tab-bar{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 20px;padding:6px;background:var(--panel-2);border:1px solid var(--line);border-radius:var(--r-md)}
.shop-tab{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:var(--r-sm);border:1px solid transparent;background:transparent;color:var(--muted);font:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease}
.shop-tab:hover{background:rgba(255,255,255,.04);border-color:var(--line);color:var(--text)}
.shop-tab.active{background:var(--accent-soft);border-color:var(--accent-border);color:var(--text);font-weight:600}
.shop-tab .nav-icon{width:28px;height:28px;border-radius:7px;flex-shrink:0}
.shop-tab .nav-icon svg{width:15px;height:15px;stroke:currentColor;stroke-width:1.85;fill:none;stroke-linecap:round;stroke-linejoin:round}
.shop-tab.active .nav-icon{background:rgba(37,99,235,.14);border-color:transparent;color:#93c5fd}
.shop-info-stack{display:flex;flex-direction:column;gap:16px}
.shop-ai-layout{display:flex;flex-direction:column;gap:18px}
.shop-ai-hero .form-grid{grid-template-columns:1fr}
.shop-ai-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
.shop-ai-panel{background:var(--panel-2);border:1px solid var(--line);border-radius:var(--r-md);padding:16px}
.shop-ai-panel-head{margin:0 0 12px;padding-bottom:10px;border-bottom:1px solid var(--line)}
.shop-ai-panel-head h4{margin:0 0 4px;font-size:14px;font-weight:600;color:var(--text)}
.shop-ai-panel-head p{margin:0;font-size:12px;color:var(--muted);line-height:1.5}
.shop-ai-toggle-grid{display:flex;flex-direction:column;gap:10px;margin-top:4px}
.shop-ai-toggle-grid .checkbox{padding:10px 12px;border-radius:var(--r-sm);background:var(--panel);border:1px solid var(--line);color:var(--text);transition:background .15s ease,border-color .15s ease}
.shop-ai-toggle-grid .checkbox:hover{background:var(--panel-3);border-color:var(--line-soft)}
.call-detail-dl{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;font-size:13px;margin:0 0 16px}
.call-detail-dl dt{margin:0;color:var(--muted);font-weight:600;font-size:11px;letter-spacing:.04em;text-transform:uppercase}
.call-detail-dl dd{margin:0;color:var(--text);line-height:1.45}
.call-detail-transcript{margin-top:8px;padding:12px 14px;border-radius:var(--r-md);background:var(--panel-2);border:1px solid var(--line);font-size:13px;line-height:1.6;color:var(--text);white-space:pre-wrap;max-height:min(48vh,420px);overflow:auto}
dialog.rb-admin-modal{max-width:min(640px,94vw)}
.admin-status-overview{margin-bottom:16px}
.admin-status-dl{margin:0;padding:0;display:grid;gap:0}
.admin-status-row{display:grid;grid-template-columns:minmax(140px,32%) minmax(0,1fr);gap:10px 16px;padding:10px 0;border-bottom:1px solid var(--line);align-items:baseline}
.admin-status-row:last-child{border-bottom:none;padding-bottom:0}
.admin-status-row dt{margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.admin-status-row dd{margin:0;font-size:14px;color:var(--text);line-height:1.45;word-break:break-word}
@media (max-width:900px){.shop-ai-cols{grid-template-columns:1fr}}
@media (max-width:880px){.shop-tab-bar{flex-direction:column;align-items:stretch}.shop-tab{justify-content:flex-start}}
@media (max-width:640px){.admin-status-row{grid-template-columns:1fr;gap:4px}}
`,
];

export const adminShopDetailStyles = [...adminBaseStyles, ...adminShopDetailAddonStyles];


export const adminShopDetailScripts: string[] = [

];

export const adminShopDetailTemplateTitle = "Business detail.";

export function AdminShopDetailTemplate() {
  return (
    <AdminLayout
      styles={adminShopDetailStyles}
      scripts={adminShopDetailScripts}
      scriptPrefix="admin-shop-detail"
      bodyClass="app-body"
    >
      <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></div></div><span>RingBooker Admin</span></div><div className="nav-label">Backoffice</div><div className="nav-list"><a className="nav-item " href="/admin"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" /></svg></div><span>Overview</span></a><a className="nav-item " href="/admin/shops"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 10l2-5h14l2 5" /><path d="M4 10h16v10H4z" /><path d="M9 20v-6h6v6" /></svg></div><span>Businesses</span></a><a className="nav-item active" href="/admin/shops/luxe-hair-studio"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M5 20c1.5-3 4-4.5 7-4.5S17.5 17 19 20" /></svg></div><span>Business detail</span></a><a className="nav-item " href="/admin/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" /></svg></div><span>Calls &amp; Incidents</span></a><a className="nav-item " href="/admin/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span>Billing</span></a><a className="nav-item " href="/admin/users"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy={7} r={3} /><path d="M20 8v6" /><path d="M17 11h6" /></svg></div><span>Users &amp; Roles</span></a><a className="nav-item " href="/admin/system-health"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span>System Health</span></a></div></aside><main className="main"><div className="topbar"><div className="page-title"><h1>Shop detail.</h1><p>Inspect one salon account deeply across routing, AI behavior, billing, and support context.</p></div><div className="top-actions"><a className="btn" href="/admin/shops">Back to shops</a><a className="btn purple" href="/admin/shops">Edit account</a></div></div>
          <section className="grid grid-3">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" /></svg></div><span className="tag green">This week</span></div><div className="stat-value">412</div><div className="stat-meta">Calls handled</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span className="tag purple">Professional</span></div><div className="stat-value">$149</div><div className="stat-meta">Monthly billing</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span className="tag green">Healthy</span></div><div className="stat-value">98%</div><div className="stat-meta">Call success rate</div></div>
          </section>
          <section className="grid grid-2" style={{marginTop: 18}}><div className="card"><div className="panel-head"><div><h3>Luxe Hair Studio</h3><p className="sub">Operational profile and routing setup.</p></div><span className="badge-right">Business detail</span></div><div className="list">
                <div className="list-item"><div className="item-main"><div className="avatar">#</div><div><h4>Business number</h4><p>+1 714 555 0199 · forwarding enabled</p></div></div></div>
                <div className="list-item"><div className="item-main"><div className="avatar">GC</div><div><h4>Calendar provider</h4><p>Google Calendar connected and healthy</p></div></div></div>
                <div className="list-item"><div className="item-main"><div className="avatar">AI</div><div><h4>Voice + summaries</h4><p>Aoede voice · Vietnamese user summaries enabled</p></div></div></div>
                <div className="list-item"><div className="item-main"><div className="avatar">P</div><div><h4>Billing</h4><p>Paddle subscription active · renews May 8, 2026</p></div></div></div>
              </div></div>
            <div className="card soft"><div className="panel-head"><div><h3>Recent issues</h3><p className="sub">Latest support and incident context.</p></div></div>
              <div className="list">
                <div className="list-item"><div className="item-main"><div className="avatar">1</div><div><h4>Complaint escalation</h4><p>Caller transferred to user after dissatisfaction with prior service</p></div></div><span className="tag red">QA</span></div>
                <div className="list-item"><div className="item-main"><div className="avatar">2</div><div><h4>Missed-call recovery burst</h4><p>8 callbacks triggered after-hours with good conversion</p></div></div><span className="tag green">Good</span></div>
                <div className="list-item"><div className="item-main"><div className="avatar">3</div><div><h4>Prompt update requested</h4><p>User wants pricing wording adjusted for balayage consults</p></div></div><span className="tag orange">Pending</span></div>
              </div></div></section>
        </main></div>

    </AdminLayout>
  );
}
