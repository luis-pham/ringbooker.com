import { UserLayout } from '@/components/user/user-layout';

const styles: string[] = [
  String.raw`
:root{
  --purple:#8B5CF6;
  --purple-dark:#7C3AED;
  --purple-light:#EDE9FE;
  --purple-ultra:#F5F3FF;
  --text-dark:#111827;
  --text-gray:#6B7280;
  --text-light:#9CA3AF;
  --bg:#fff;
  --bg-gray:#F9FAFB;
  --border:#E5E7EB;
  --green:#10B981;
  --orange:#F59E0B;
  --red:#EF4444;
  --blue:#3B82F6;
  --sidebar-width:284px;
  --r-pill:999px;
  --r-xl:28px;
  --r-lg:24px;
  --r-md:16px;
  --r-sm:12px;
  --shadow:0 18px 48px rgba(17,24,39,.06);
  --shadow-soft:0 8px 24px rgba(17,24,39,.04);
}
*{box-sizing:border-box}
html{scrollbar-gutter:stable;background:linear-gradient(180deg,#faf7ff 0%,#fff 24%,#fff 100%)}
body{
  margin:0;
  min-height:100vh;
  font-family:'Mona Sans Variable',sans-serif;
  color:var(--text-dark);
  background:linear-gradient(180deg,#faf7ff 0%,#fff 24%,#fff 100%);
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
}
a{text-decoration:none;color:inherit}
button,input,select,textarea{font:inherit}
.app-shell{display:grid;grid-template-columns:var(--sidebar-width) minmax(0,1fr);min-height:100vh}
.sidebar{
  position:sticky;top:0;height:100vh;overflow:auto;
  background:rgba(255,255,255,.86);backdrop-filter:blur(16px);
  border-right:1px solid rgba(229,231,235,.9);
  padding:22px 18px 22px;
}
.sidebar-inner{display:flex;flex-direction:column;min-height:calc(100vh - 44px)}
.brand{
  display:flex;align-items:center;gap:12px;
  font-weight:800;font-size:20px;letter-spacing:-.02em;
  margin-bottom:22px;
}
.brand-mark{position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.brand-ripple{position:absolute;border-radius:50%;background:var(--purple)}
.brand-ripple.r3{width:38px;height:38px;opacity:.1}
.brand-ripple.r2{width:30px;height:30px;opacity:.18}
.brand-core{
  position:relative;z-index:1;
  width:24px;height:24px;border-radius:50%;
  background:var(--purple);
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 10px 24px rgba(139,92,246,.28);
}
.brand-core svg{width:13px;height:13px;fill:#fff}
.workspace{
  background:linear-gradient(135deg,#f5f3ff,#fff);
  border:1px solid var(--border);
  border-radius:20px;
  padding:16px 15px;
  margin-bottom:18px;
}
.workspace h3{margin:0 0 4px;font-size:15px;letter-spacing:-.02em}
.workspace p{margin:0;color:var(--text-gray);font-size:12px;line-height:1.5}
.nav-section{margin-top:6px}
.nav-label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-light);font-weight:700;padding:0 10px 10px}
.nav-list{display:flex;flex-direction:column;gap:6px}
.nav-item{
  display:flex;align-items:center;gap:12px;
  padding:12px;border-radius:14px;color:#4b5563;
  font-weight:650;font-size:14px;transition:all .18s ease;
}
.nav-item:hover{background:#f9f7ff;color:var(--text-dark)}
.nav-item.active{
  background:linear-gradient(135deg,#f5f3ff,#ede9fe);
  color:var(--purple-dark);
  box-shadow:inset 0 0 0 1px rgba(139,92,246,.15);
}
.nav-icon{
  width:34px;height:34px;border-radius:12px;background:transparent;border:none;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.nav-icon svg{width:16px;height:16px;stroke:#6b7280;stroke-width:2;fill:none}
.nav-item.active .nav-icon{background:transparent;border-color:transparent}
.nav-item.active .nav-icon svg{stroke:var(--purple-dark)}
.sidebar-spacer{flex:1}

.main{padding:28px 30px 34px;min-width:0}
.topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:24px}
.page-title h1{margin:0;font-size:34px;letter-spacing:-1.4px;line-height:1.06}
.page-title p{margin:8px 0 0;color:var(--text-gray);font-size:14px;line-height:1.6;max-width:760px}
.top-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:9px;
  padding:12px 18px;border-radius:999px;font-weight:700;font-size:14px;
  border:1px solid var(--border);background:#fff;color:var(--text-dark);
  transition:transform .15s ease, box-shadow .2s ease, border-color .2s ease;
}
.btn:hover{transform:translateY(-1px);box-shadow:var(--shadow-soft)}
.btn.purple{background:var(--purple);color:#fff;border-color:var(--purple)}
.btn.dark{background:#111827;color:#fff;border-color:#111827}

.grid{display:grid;gap:18px}
.grid-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.kpi-row{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:18px}
.call-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);gap:18px}
.forward-guide-card{border-left:4px solid #c4b5fd}
.forward-guide-intro{margin:0 0 14px;font-size:13px;color:var(--text-gray);line-height:1.65}
.forward-num{
  display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:14px;
  background:#f5f3ff;border:1px solid #e9d5ff;font-weight:800;font-size:15px;letter-spacing:.02em;color:#4c1d95;margin-bottom:14px;
}
.carrier-links{display:flex;flex-direction:column;gap:10px}
a.carrier-link{
  display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:12px 14px;border-radius:16px;border:1px solid #f0f1f3;
  background:#fff;text-decoration:none;color:inherit;transition:.15s ease;
}
a.carrier-link:hover{border-color:#c4b5fd;box-shadow:0 0 0 3px rgba(139,92,246,.07)}
.carrier-link-row{display:flex;justify-content:space-between;align-items:center;width:100%;gap:10px}
a.carrier-link strong{font-size:14px;letter-spacing:-.02em;color:#111827}
.carrier-hint{font-size:12px;color:var(--text-gray);line-height:1.45}
.carrier-hint-single{display:block;margin-top:2px}
.carrier-callcenter-tip{margin-top:12px;padding:12px 14px;border-radius:16px;border:1px dashed #e5e7eb;background:#fafafa}
.carrier-tip-line{margin:0;font-size:12.5px;line-height:1.55;color:var(--text-gray)}
.ext-ico{
  width:12px;height:12px;
  display:inline-flex;align-items:center;justify-content:center;
  color:var(--text-light);flex-shrink:0;
}
.ext-ico svg{display:block;width:12px;height:12px}
.forward-guide-disclaimer{margin:14px 0 0;font-size:11px;color:var(--text-light);line-height:1.5}

.card,.stat-card{
  background:#fff;border:1px solid var(--border);
  border-radius:26px;box-shadow:var(--shadow);padding:22px;min-width:0;
}
.card.soft{background:linear-gradient(180deg,#fff 0%,#fcfbff 100%)}
.card h3{margin:0 0 6px;font-size:18px;letter-spacing:-.3px}
.card p.sub{margin:0 0 18px;color:var(--text-gray);font-size:13px;line-height:1.6}
.stat-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
.stat-icon{
  width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;
  background:transparent;
}
.stat-icon svg{width:20px;height:20px;stroke:var(--purple-dark);stroke-width:2;fill:none}
.stat-value{font-size:32px;font-weight:800;letter-spacing:-1px}
.stat-meta{font-size:13px;color:var(--text-gray);line-height:1.55}
.tag{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:11px;font-weight:700}
.tag.green{background:#ecfdf5;color:#047857}
.tag.purple{background:#f5f3ff;color:var(--purple-dark)}
.tag.orange{background:#fff7ed;color:#c2410c}
.tag.red{background:#fef2f2;color:#b91c1c}
.badge-right{padding:6px 10px;border-radius:999px;background:#111827;color:#fff;font-size:11px;font-weight:700;white-space:nowrap}

.panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.table{width:100%;border-collapse:collapse}
.table th,.table td{padding:14px 0;border-bottom:1px solid #f0f1f3;text-align:left;font-size:13.5px;vertical-align:top}
.table th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-light)}
.table tr:last-child td{border-bottom:none}

.list{display:flex;flex-direction:column;gap:12px}
.list-item{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:14px 16px;border:1px solid #f0f1f3;border-radius:18px;background:#fff;min-width:0;
}
.item-main{display:flex;align-items:center;gap:12px;min-width:0}
.avatar{
  width:42px;height:42px;border-radius:14px;background:transparent;
  display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--purple-dark);flex-shrink:0;
}
.avatar.quick-avatar--bookings{background:transparent;color:#6d28d9}
.avatar.quick-avatar--calls{background:transparent;color:#1d4ed8}
.avatar.quick-avatar--settings{background:transparent;color:#b45309}
.avatar.quick-avatar--bookings svg,.avatar.quick-avatar--calls svg,.avatar.quick-avatar--settings svg{
  display:block;width:22px;height:22px;flex-shrink:0;
}
.item-main h4{margin:0 0 3px;font-size:14px;letter-spacing:-.02em}
.item-main p{margin:0;color:var(--text-gray);font-size:12px;line-height:1.5}
.metric{font-weight:800;font-size:20px;letter-spacing:-.7px}
.metric-sub{font-size:12px;color:var(--text-gray)}
.note{
  padding:14px 16px;border-radius:18px;background:#f9fafb;border:1px solid var(--border);
  color:var(--text-gray);font-size:13px;line-height:1.6;
}

.call-live{
  background:linear-gradient(145deg,#1a0533,#2d1b69 50%,#1a0d3a);
  color:#fff;position:relative;overflow:hidden;
}
.call-live::before{
  content:'';position:absolute;right:-80px;top:-80px;width:240px;height:240px;border-radius:50%;
  background:rgba(255,255,255,.06)
}
.live-label{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:999px;background:rgba(16,185,129,.14);color:#86efac;font-size:11px;font-weight:700;margin-bottom:12px}
.dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 6px rgba(34,197,94,.08)}
.live-name{font-size:24px;font-weight:800;letter-spacing:-.6px;margin:0 0 5px}
.live-copy{color:rgba(255,255,255,.72);font-size:13px;line-height:1.7}
.subtitle-box{margin-top:16px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:14px}
.subtitle-box .mini{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.48);font-weight:700;margin-bottom:4px}
.subtitle-box p{margin:0;color:#fff;font-size:13px;line-height:1.6}
.wave{display:flex;align-items:flex-end;gap:4px;height:56px;margin-top:18px}
.wave span{width:5px;background:rgba(196,181,253,.92);border-radius:999px;animation:w 1s ease-in-out infinite}
.wave span:nth-child(odd){animation-delay:.12s}
.wave span:nth-child(3n){animation-delay:.22s}
.wave span:nth-child(1){height:24px}.wave span:nth-child(2){height:42px}.wave span:nth-child(3){height:34px}.wave span:nth-child(4){height:50px}.wave span:nth-child(5){height:28px}.wave span:nth-child(6){height:45px}.wave span:nth-child(7){height:20px}.wave span:nth-child(8){height:38px}.wave span:nth-child(9){height:30px}
@keyframes w{0%,100%{transform:scaleY(.45);opacity:.45}50%{transform:scaleY(1);opacity:1}}

.progress-list{display:flex;flex-direction:column;gap:14px;margin-top:10px}
.progress-item{display:grid;grid-template-columns:110px 1fr auto;gap:12px;align-items:center;font-size:13px}
.bar{height:10px;background:#f3f4f6;border-radius:999px;overflow:hidden}
.bar > span{display:block;height:100%;background:linear-gradient(90deg,#8b5cf6,#a78bfa);border-radius:999px}

.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.field label{display:block;font-size:12px;font-weight:700;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em}
.field input,.field textarea,.field select{
  width:100%;padding:13px 14px;border-radius:14px;border:1px solid var(--border);background:#fff;
  font:inherit;color:var(--text-dark);outline:none;
}
.field input:focus,.field textarea:focus,.field select:focus{border-color:#c4b5fd;box-shadow:0 0 0 4px rgba(139,92,246,.08)}
.field textarea{min-height:108px;resize:vertical}

.billing-banner{
  display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:18px;align-items:center;
  background:linear-gradient(135deg,#111827,#2b3445);color:#fff
}
.billing-banner p{color:rgba(255,255,255,.72)}
.pricing-mini{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.price-mini{border:1px solid var(--border);border-radius:20px;padding:18px;background:#fff}
.price-mini.featured{border-color:var(--purple);box-shadow:0 0 0 4px rgba(139,92,246,.08)}
.price-mini h4{margin:0 0 4px}
.price-mini .amt{font-size:32px;font-weight:800;letter-spacing:-1px;margin:10px 0 12px}
.price-mini ul{margin:0;padding-left:18px;color:var(--text-gray);font-size:12.5px;line-height:1.7}

.footer-inline{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:18px;color:var(--text-light);font-size:12px}

@media (max-width:1200px){
  .grid-4{grid-template-columns:repeat(2,minmax(0,1fr))}
  .kpi-row,.call-grid,.billing-banner,.pricing-mini{grid-template-columns:1fr}
  .app-shell{grid-template-columns:96px minmax(0,1fr)}
  .sidebar{padding:18px 12px}
  .sidebar-inner{min-height:calc(100vh - 36px)}
  .brand span,.workspace,.nav-item span,.nav-label{display:none}
  .nav-item{justify-content:center;padding:10px}
  .nav-icon{margin:0}
}
@media (max-width:860px){
  .main{padding:18px;padding-bottom:calc(18px + 76px + env(safe-area-inset-bottom, 0px))}
  .grid-2,.form-grid{grid-template-columns:1fr}
  .grid.grid-3,.grid.grid-4{
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:10px;
  }
  .grid.grid-3 > .stat-card,.grid.grid-4 > .stat-card{
    padding:11px 11px 12px;
    border-radius:16px;
    box-shadow:0 8px 22px rgba(17,24,39,.05);
  }
  .grid.grid-3 .stat-top,.grid.grid-4 .stat-top{
    margin-bottom:7px;
    gap:6px;
    align-items:flex-start;
  }
  .grid.grid-3 .stat-icon,.grid.grid-4 .stat-icon{
    width:32px;height:32px;border-radius:10px;flex-shrink:0;
  }
  .grid.grid-3 .stat-icon svg,.grid.grid-4 .stat-icon svg{width:15px;height:15px}
  .grid.grid-3 .stat-value,.grid.grid-4 .stat-value{
    font-size:21px;
    font-weight:800;
    letter-spacing:-.45px;
    line-height:1.1;
  }
  .grid.grid-3 .stat-meta,.grid.grid-4 .stat-meta{
    font-size:10.5px;
    line-height:1.3;
    display:-webkit-box;
    -webkit-line-clamp:2;
    -webkit-box-orient:vertical;
    overflow:hidden;
  }
  .grid.grid-3 .tag,.grid.grid-4 .tag{
    padding:3px 6px;
    font-size:9px;
    max-width:100%;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .topbar{align-items:flex-start;flex-direction:column}
  .overview-top-actions{display:none}
  .page-title h1{font-size:28px}
  .app-shell{grid-template-columns:1fr}
  .sidebar{position:static;height:auto;border-right:none;border-bottom:1px solid var(--border)}
  .sidebar-inner{min-height:auto}
  .sidebar-spacer{display:none}
  .brand span,.workspace{display:block}
  .user-app-shell .nav-section{display:none !important}
}
`,
];

const scripts: string[] = [

];

export const userDashboardStyles = styles;
export const userDashboardScripts = scripts;
export const templateTitle = 'Overview';

export function UserDashboardTemplate() {
  return (
    <UserLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="user-dashboard"
    >
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-inner">
            <div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#fff" stroke="none" /></svg></div></div><span>RingBooker</span></div>
            <div className="workspace"><h3>Luxe Hair Studio</h3><p>AI Phone Agent is active. 1 number connected · Professional plan.</p></div>
            <div className="nav-section"><div className="nav-label">User Portal</div><div className="nav-list"><a className="nav-item active" href="/user"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={4} width={7} height={7} rx="1.5" /><rect x={14} y={4} width={7} height={4} rx="1.5" /><rect x={14} y={11} width={7} height={9} rx="1.5" /><rect x={3} y={14} width={7} height={6} rx="1.5" /></svg></div><span>Overview</span></a><a className="nav-item" href="/user/bookings"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span>Bookings</span></a><a className="nav-item" href="/user/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span>Calls &amp; Transcripts</span></a><a className="nav-item" href="/user/settings"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" /></svg></div><span>Settings</span></a><a className="nav-item" href="/user/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /><path d="M7 15h4" /></svg></div><span>Billing</span></a></div></div>
            <div className="sidebar-spacer" />
          </div>
        </aside>
        <main className="main">
          <div className="topbar">
            <div className="page-title"><h1>Overview</h1><p>Track calls, bookings, and reminders.</p></div>
            <div className="top-actions"><a className="btn" href="/user/settings">Edit business info</a><a className="btn purple" href="/user/bookings">View bookings</a></div>
          </div>
          <section className="grid grid-4">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span className="tag green">+18% this week</span></div><div className="stat-value">142</div><div className="stat-meta">Calls answered by RingBooker</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span className="tag purple">31 booked</span></div><div className="stat-value">76%</div><div className="stat-meta">Call-to-booking conversion</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z" /><path d="M4 8l8 6 8-6" /></svg></div><span className="tag orange">9 pending replies</span></div><div className="stat-value">54</div><div className="stat-meta">SMS confirmations and reminders sent</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 19h16" /><path d="M7 15l3-3 3 2 4-5" /></svg></div><span className="tag green">Recovered value</span></div><div className="stat-value">$3.4k</div><div className="stat-meta">Estimated monthly value from answered calls</div></div>
          </section>
          <section className="call-grid" style={{marginTop: 18}}>
            <div className="card call-live">
              <div className="live-label"><span className="dot" /> Live right now</div>
              <div className="live-name">RingBooker is handling a call</div>
              <div className="live-copy">Incoming customer wants a color + trim on Thursday afternoon. AI is checking the calendar and preferred stylist availability.</div>
              <div className="subtitle-box"><div className="mini">Live subtitle</div><p>“I can help with that. Thursday at 2:30 PM is open with Sophia. Would you like me to book it for you?”</p></div>
              <div className="wave"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
            </div>
            <div className="card soft">
              <div className="panel-head"><div><h3>Today’s performance</h3><p className="sub">Where bookings are coming from.</p></div><span className="badge-right">Updated 2 min ago</span></div>
              <div className="progress-list">
                <div className="progress-item"><strong>New callers</strong><div className="bar"><span style={{width: '68%'}} /></div><span>34</span></div>
                <div className="progress-item"><strong>Returning VIPs</strong><div className="bar"><span style={{width: '44%'}} /></div><span>12</span></div>
                <div className="progress-item"><strong>Missed-call recovery</strong><div className="bar"><span style={{width: '76%'}} /></div><span>19</span></div>
                <div className="progress-item"><strong>Booked after hours</strong><div className="bar"><span style={{width: '59%'}} /></div><span>16</span></div>
              </div>
            </div>
          </section>
          <section className="kpi-row" style={{marginTop: 18}}>
            <div className="card">
              <div className="panel-head"><div><h3>Upcoming bookings</h3><p className="sub">The next appointments RingBooker has placed on your calendar.</p></div><a className="btn" href="/user/bookings">Open all</a></div>
              <table className="table">
                <thead><tr><th>Client</th><th>Service</th><th>Time</th><th>Status</th></tr></thead>
                <tbody>
                  <tr><td>Emma L.</td><td>Balayage + Trim</td><td>Today · 2:30 PM</td><td><span className="tag green">Confirmed</span></td></tr>
                  <tr><td>Jasmine T.</td><td>Gel Manicure</td><td>Today · 4:00 PM</td><td><span className="tag purple">Booked by AI</span></td></tr>
                  <tr><td>Nicole V.</td><td>Hair Color</td><td>Tomorrow · 10:00 AM</td><td><span className="tag orange">Reminder sent</span></td></tr>
                  <tr><td>Grace H.</td><td>Pedicure</td><td>Tomorrow · 1:15 PM</td><td><span className="tag green">Confirmed</span></td></tr>
                </tbody>
              </table>
            </div>
            <div className="card">
              <div className="panel-head"><div><h3>Messages &amp; follow-ups</h3><p className="sub">Recent SMS activity from your AI phone agent.</p></div></div>
              <div className="list">
                <div className="list-item"><div className="item-main"><div className="avatar">EV</div><div><h4>Reminder sent to Emma</h4><p>“See you tomorrow at 2:30 PM at Luxe Hair Studio.”</p></div></div><span className="tag green">Delivered</span></div>
                <div className="list-item"><div className="item-main"><div className="avatar">JT</div><div><h4>Missed-call text back</h4><p>Caller replied YES and requested a callback.</p></div></div><span className="tag orange">Pending</span></div>
                <div className="list-item"><div className="item-main"><div className="avatar">NH</div><div><h4>Booking confirmation</h4><p>Saturday at 10:00 AM · Sophia · Hair Color</p></div></div><span className="tag purple">Sent by AI</span></div>
              </div>
            </div>
          </section>
          <div className="footer-inline"><span>RingBooker user portal concept · aligned to the public landing page styling.</span><span>Mona Sans Variable · Stable layout · Shared design system</span></div>
        </main>
      </div>

    </UserLayout>
  );
}
