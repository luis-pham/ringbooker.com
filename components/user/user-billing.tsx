import { UserLayout } from '@/components/user/user-layout';

export const userBillingStyles: string[] = [
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
.nav-icon svg{width:18px;height:18px;stroke:#6b7280;stroke-width:2;fill:none}
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
  height:36px;padding:8px 16px;border-radius:8px;font-weight:500;font-size:14px;
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
.stat-icon svg{width:22px;height:22px;stroke:var(--purple-dark);stroke-width:2;fill:none}
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
.field{margin-bottom:20px}
.field label{display:block;font-size:12px;font-weight:600;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em}
.field input,.field textarea,.field select{
  width:100%;height:40px;padding:8px 12px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;
  color:#111827;outline:none;font:inherit;font-size:14px;line-height:1.5;
}
.field input::placeholder,.field textarea::placeholder{color:#9ca3af;font-size:14px}
.field input:disabled,.field textarea:disabled,.field select:disabled{background:#f9fafb;color:#6b7280;cursor:not-allowed}
.field input:focus,.field textarea:focus,.field select:focus{border-color:#7c3aed;box-shadow:0 0 0 2px rgba(124,58,237,.15);outline:none}
.field textarea{height:auto;min-height:80px;resize:vertical;padding:10px 12px}
.field select{appearance:none;padding-right:36px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M6 8l4 4 4-4' stroke='%236b7280' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;background-size:16px}

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
  .grid-2,.grid-3,.grid-4,.form-grid{grid-template-columns:1fr}
  .topbar{align-items:flex-start;flex-direction:column}
  .page-title h1{font-size:28px}
  .app-shell{grid-template-columns:1fr}
  .sidebar{position:static;height:auto;border-right:none;border-bottom:1px solid var(--border)}
  .sidebar-inner{min-height:auto}
  .sidebar-spacer{display:none}
  .brand span{display:block}
  .workspace{display:none}
  .user-app-shell .nav-section{display:none !important}
}
`,
];

export const userBillingScripts: string[] = [

];

export const userBillingTemplateTitle = "Billing, plan, and growth options.";

export function UserBillingTemplate() {
  return (
    <UserLayout
      styles={userBillingStyles}
      scripts={userBillingScripts}
      scriptPrefix="user-billing"
    >
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-inner">
            <div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#fff" stroke="none" /></svg></div></div><span>RingBooker</span></div>
            <div className="workspace"><h3>Luxe Hair Studio</h3><p>Paddle subscription active · Next renewal on May 8.</p></div>
            <div className="nav-section"><div className="nav-label">User Portal</div><div className="nav-list"><a className="nav-item" href="/user"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={4} width={7} height={7} rx="1.5" /><rect x={14} y={4} width={7} height={4} rx="1.5" /><rect x={14} y={11} width={7} height={9} rx="1.5" /><rect x={3} y={14} width={7} height={6} rx="1.5" /></svg></div><span>Overview</span></a><a className="nav-item" href="/user/bookings"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span>Bookings</span></a><a className="nav-item" href="/user/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span>Calls &amp; Transcripts</span></a><a className="nav-item" href="/user/settings"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" /></svg></div><span>Settings</span></a><a className="nav-item active" href="/user/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /><path d="M7 15h4" /></svg></div><span>Billing</span></a></div></div>
            <div className="sidebar-spacer" />
          </div>
        </aside>
        <main className="main">
          <div className="topbar">
            <div className="page-title"><h1>Billing, plan, and growth options.</h1><p>Manage your RingBooker subscription and see what is included in your current plan.</p></div>
            <div className="top-actions"><a className="btn" href="/user/billing">Open Paddle portal</a><a className="btn purple" href="/user/billing">Update plan</a></div>
          </div>
          <section className="card billing-banner">
            <div><span className="tag purple">Professional plan</span><h3 style={{fontSize: 30, marginTop: 14, marginBottom: 8, letterSpacing: '-1px'}}>Your AI phone agent is active and renewing monthly.</h3><p>Billing for your salon subscription runs through Paddle. Customer booking deposits are not enabled in this MVP.</p></div>
            <div><div className="metric" style={{fontSize: 44}}>$149<span style={{fontSize: 15, fontWeight: 600, letterSpacing: 0}}> / month</span></div><div className="metric-sub" style={{color: 'rgba(255,255,255,.72)', marginTop: 6}}>Next renewal: May 8, 2026</div><div style={{marginTop: 16}}><span className="tag green">Paid</span></div></div>
          </section>
          <section className="pricing-mini" style={{marginTop: 18}}>
            <div className="price-mini"><h4>Starter</h4><div className="amt">$79</div><ul><li>AI answers calls 24/7</li><li>Booking + confirmations</li><li>1 number included or forwarding</li><li>Basic call logs</li></ul></div>
            <div className="price-mini featured"><span className="tag purple">Current plan</span><h4 style={{marginTop: 10}}>Professional</h4><div className="amt">$149</div><ul><li>Everything in Starter</li><li>Reminder SMS</li><li>Customer memory</li><li>Bilingual user summaries</li></ul></div>
            <div className="price-mini"><h4>Custom</h4><div className="amt">Let’s talk</div><ul><li>Multi-location setup</li><li>Custom integrations</li><li>Higher call volume</li><li>Concierge onboarding</li></ul></div>
          </section>
          <section className="grid grid-2" style={{marginTop: 18}}>
            <div className="card">
              <div className="panel-head"><div><h3>Billing history</h3><p className="sub">Recent subscription charges.</p></div></div>
              <table className="table">
                <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  <tr><td>Apr 8, 2026</td><td>Professional plan</td><td>$149</td><td><span className="tag green">Paid</span></td></tr>
                  <tr><td>Mar 8, 2026</td><td>Professional plan</td><td>$149</td><td><span className="tag green">Paid</span></td></tr>
                  <tr><td>Feb 8, 2026</td><td>Trial converted</td><td>$149</td><td><span className="tag green">Paid</span></td></tr>
                </tbody>
              </table>
            </div>
            <div className="card soft">
              <div className="panel-head"><div><h3>What your plan covers</h3><p className="sub">Clear scope for this MVP version.</p></div></div>
              <div className="list">
                <div className="list-item"><div className="item-main"><div className="avatar">☎</div><div><h4>Phone agent subscription</h4><p>Your salon’s monthly RingBooker billing</p></div></div></div>
                <div className="list-item"><div className="item-main"><div className="avatar">SMS</div><div><h4>Confirmation and reminder messaging</h4><p>Included in your active subscription flow</p></div></div></div>
                <div className="list-item"><div className="item-main"><div className="avatar">MVP</div><div><h4>No customer deposit flow yet</h4><p>Paddle is for salon billing, not end-customer appointment payments</p></div></div></div>
              </div>
            </div>
          </section>
          <div className="footer-inline"><span>RingBooker user portal concept · aligned to the public landing page styling.</span><span>Mona Sans Variable · Stable layout · Shared design system</span></div>
        </main>
      </div>

    </UserLayout>
  );
}
