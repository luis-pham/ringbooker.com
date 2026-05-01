import { AdminLayout } from '@/components/admin/admin-layout';

export const adminShopsStyles: string[] = [
  String.raw`
:root{
  --bg:#0b1020;
  --panel:#11182b;
  --panel-2:#151f36;
  --panel-3:#0f1729;
  --text:#e5edf9;
  --muted:#93a0ba;
  --line:#22304d;
  --line-soft:#1a2741;
  --purple:#7c3aed;
  --purple-2:#8b5cf6;
  --purple-3:#c4b5fd;
  --green:#22c55e;
  --orange:#f59e0b;
  --red:#ef4444;
  --blue:#3b82f6;
  --shadow:0 18px 48px rgba(0,0,0,.35);
  --r-xl:28px;
  --r-lg:22px;
  --r-md:16px;
  --r-sm:12px;
  --r-pill:999px;
}
*{box-sizing:border-box}
html{scrollbar-gutter:stable}
body{margin:0;font-family:'Mona Sans Variable',system-ui,sans-serif;background:radial-gradient(circle at top left,#17213a 0,#0b1020 35%,#0a0f1d 100%);color:var(--text);min-height:100vh}
a{text-decoration:none;color:inherit}
button,input,select,textarea{font:inherit}
body.app-body{overflow-y:scroll}
.app-shell{display:grid;grid-template-columns:288px minmax(0,1fr);min-height:100vh}
.sidebar{position:sticky;top:0;height:100vh;padding:24px 18px;border-right:1px solid var(--line);background:linear-gradient(180deg,rgba(17,24,43,.96),rgba(12,18,32,.98));backdrop-filter:blur(18px)}
.brand{display:flex;align-items:center;gap:12px;font-weight:800;font-size:20px;letter-spacing:-.02em;margin-bottom:22px}
.brand-mark{position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex:0 0 40px}
.brand-ripple{position:absolute;border-radius:50%;background:rgba(139,92,246,.18)}
.brand-ripple.r3{width:40px;height:40px}.brand-ripple.r2{width:31px;height:31px;background:rgba(139,92,246,.24)}
.brand-core{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--purple-2));display:flex;align-items:center;justify-content:center;position:relative;z-index:1;box-shadow:0 8px 18px rgba(124,58,237,.35)}
.brand-core svg{width:13px;height:13px;fill:#fff}
.nav-label{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#7f8baa;padding:10px 12px}
.nav-list{display:flex;flex-direction:column;gap:7px}
.nav-item{display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;color:#c7d2e8;font-size:14px;font-weight:700;transition:background .18s ease,color .18s ease,border-color .18s ease;border:1px solid transparent}
.nav-item:hover{background:rgba(255,255,255,.03);border-color:var(--line-soft)}
.nav-item.active{background:linear-gradient(180deg,rgba(124,58,237,.2),rgba(124,58,237,.1));border-color:rgba(139,92,246,.28);color:#fff}
.nav-icon{width:34px;height:34px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#0f1729;border:1px solid var(--line);flex:0 0 34px}
.nav-icon svg{width:16px;height:16px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
.nav-item.active .nav-icon{background:rgba(139,92,246,.18);border-color:rgba(139,92,246,.4)}
.main{padding:28px 30px 34px;overflow-x:hidden}
.topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px}
.page-title h1{margin:0;font-size:34px;line-height:1.06;letter-spacing:-.04em}
.page-title p{margin:10px 0 0;color:var(--muted);font-size:14px;line-height:1.6;max-width:760px}
.top-actions{display:flex;flex-wrap:wrap;gap:12px;justify-content:flex-end}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:12px 18px;border-radius:999px;font-size:14px;font-weight:800;border:1px solid var(--line);background:linear-gradient(180deg,#11182b,#0c1425);color:var(--text);box-shadow:var(--shadow);transition:transform .15s ease,border-color .18s ease}
.btn:hover{transform:translateY(-1px);border-color:#33466f}
.btn.purple{background:linear-gradient(135deg,var(--purple),var(--purple-2));border-color:transparent;color:#fff}
.btn.ghost{background:transparent;box-shadow:none}
.grid{display:grid;gap:18px}.grid-4{grid-template-columns:repeat(4,minmax(0,1fr))}.grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}.grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.card{background:linear-gradient(180deg,var(--panel),var(--panel-3));border:1px solid var(--line);border-radius:24px;padding:22px;box-shadow:var(--shadow)}
.card.soft{background:linear-gradient(180deg,#131d33,#10182c)}
.card h3{margin:0 0 6px;font-size:18px;letter-spacing:-.02em}
.sub{margin:0;color:var(--muted);font-size:13px;line-height:1.6}
.panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:18px}
.badge-right,.tag{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:11px;font-weight:800}
.tag.purple,.badge-right{background:rgba(139,92,246,.14);color:#d8c9ff;border:1px solid rgba(139,92,246,.18)}
.tag.green{background:rgba(34,197,94,.12);color:#adf2bf}.tag.orange{background:rgba(245,158,11,.12);color:#ffd697}.tag.red{background:rgba(239,68,68,.12);color:#feb2b2}.tag.blue{background:rgba(59,130,246,.12);color:#b8d6ff}
.stat-card{background:linear-gradient(180deg,var(--panel),#0f1628);border:1px solid var(--line);border-radius:22px;padding:20px;box-shadow:var(--shadow)}
.stat-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.stat-icon{width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.15);color:#e8dbff}.stat-icon svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8}.stat-value{font-size:31px;font-weight:800;letter-spacing:-.04em}.stat-meta{font-size:13px;color:var(--muted)}
.table{width:100%;border-collapse:collapse}.table th,.table td{padding:14px 0;border-bottom:1px solid rgba(255,255,255,.06);text-align:left;font-size:13.5px;vertical-align:top}.table th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7f8baa}.table tr:last-child td{border-bottom:none}
.list{display:flex;flex-direction:column;gap:12px}.list-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;border-radius:18px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05)}
.item-main{display:flex;align-items:center;gap:12px;min-width:0}.avatar{width:40px;height:40px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:rgba(139,92,246,.14);color:#f0e8ff;font-size:13px;font-weight:800;border:1px solid rgba(139,92,246,.18);flex:0 0 40px}.item-main h4{margin:0 0 4px;font-size:14px}.item-main p{margin:0;color:var(--muted);font-size:12.5px;line-height:1.55}
.note{padding:16px 18px;border-radius:18px;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.15);color:#d8c9ff;font-size:13px;line-height:1.7}
.kpi-row{display:grid;grid-template-columns:1.16fr .84fr;gap:18px}.call-grid{display:grid;grid-template-columns:1.08fr .92fr;gap:18px}
.call-live,.hero-admin{position:relative;overflow:hidden;background:linear-gradient(145deg,#180a36,#22134e 45%,#11182b);color:#fff}.call-live::before,.hero-admin::before{content:'';position:absolute;right:-80px;top:-80px;width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,.05)}
.live-label{display:inline-flex;align-items:center;gap:8px;background:rgba(34,197,94,.14);color:#b8f3c6;padding:7px 11px;border-radius:999px;font-size:11px;font-weight:800;margin-bottom:14px}.dot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 0 6px rgba(34,197,94,.08)}.live-name{font-size:26px;font-weight:800;letter-spacing:-.04em;margin-bottom:8px}.live-copy{font-size:14px;color:rgba(255,255,255,.72);line-height:1.7;max-width:560px}.subtitle-box{margin-top:18px;padding:16px;border-radius:18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1)}.subtitle-box .mini{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.45);font-weight:800;margin-bottom:8px}.subtitle-box p{margin:0;color:#fff;line-height:1.7;font-size:13.5px}.wave{display:flex;gap:3px;align-items:flex-end;height:28px;margin-top:18px}.wave span{width:4px;border-radius:99px;background:rgba(196,181,253,.8);animation:wave .8s ease-in-out infinite}.wave span:nth-child(1){height:10px}.wave span:nth-child(2){height:18px;animation-delay:.1s}.wave span:nth-child(3){height:25px;animation-delay:.2s}.wave span:nth-child(4){height:15px;animation-delay:.3s}.wave span:nth-child(5){height:20px;animation-delay:.4s}.wave span:nth-child(6){height:12px;animation-delay:.5s}.wave span:nth-child(7){height:21px;animation-delay:.6s}.wave span:nth-child(8){height:16px;animation-delay:.7s}.wave span:nth-child(9){height:24px;animation-delay:.8s}@keyframes wave{0%,100%{transform:scaleY(.45);opacity:.45}50%{transform:scaleY(1);opacity:1}}
.progress-list{display:flex;flex-direction:column;gap:12px}.progress-item{display:grid;grid-template-columns:170px 1fr auto;gap:12px;align-items:center;font-size:13px}.progress-item strong{font-size:13px}.bar{height:10px;border-radius:999px;background:#0e1527;overflow:hidden;border:1px solid rgba(255,255,255,.06)}.bar span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--purple),#c4b5fd)}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.field{display:flex;flex-direction:column;gap:8px}.field label{font-size:12px;font-weight:800;letter-spacing:.03em;color:#a7b4cf}.field input,.field select,.field textarea{width:100%;background:#0c1425;border:1px solid var(--line);color:var(--text);border-radius:14px;padding:13px 14px;outline:none}.field textarea{min-height:110px;resize:vertical}
.pricing-mini{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.price-mini{padding:18px;border-radius:20px;background:#0d1527;border:1px solid var(--line)}.price-mini.featured{background:linear-gradient(180deg,rgba(124,58,237,.18),rgba(17,24,43,.9));border-color:rgba(139,92,246,.24)}.price-mini h4{margin:0 0 10px;font-size:16px}.amt{font-size:30px;font-weight:800;letter-spacing:-.04em;margin-bottom:12px}.price-mini ul{margin:0;padding-left:18px;color:var(--muted);font-size:13px;line-height:1.8}
.auth-shell{min-height:100vh;display:grid;grid-template-columns:1.05fr .95fr;background:radial-gradient(circle at top left,#1b2442 0,#0d1223 40%,#0a0f1d 100%)}
.auth-side{padding:44px;display:flex;flex-direction:column;justify-content:space-between;border-right:1px solid var(--line)}
.auth-panel{display:flex;align-items:center;justify-content:center;padding:36px}
.auth-card{width:100%;max-width:480px;background:linear-gradient(180deg,var(--panel),var(--panel-3));border:1px solid var(--line);border-radius:28px;padding:30px;box-shadow:var(--shadow)}
.auth-card h1{margin:0 0 8px;font-size:32px;letter-spacing:-.04em}.auth-card p{margin:0 0 24px;color:var(--muted);line-height:1.7}.auth-brand-copy h2{font-size:46px;line-height:1.02;letter-spacing:-.06em;margin:18px 0 14px}.auth-brand-copy p{max-width:520px;color:#a7b4cf;line-height:1.8}.auth-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:24px}.auth-stat{padding:16px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.05)}.auth-stat strong{display:block;font-size:28px;letter-spacing:-.04em}.auth-stat span{display:block;color:#9fb0cc;font-size:13px;line-height:1.55;margin-top:6px}.auth-foot{display:flex;justify-content:space-between;gap:10px;color:#8191ac;font-size:12px;line-height:1.6;margin-top:22px}.divider{height:1px;background:var(--line);margin:18px 0}.inline{display:flex;align-items:center;justify-content:space-between;gap:12px}.checkbox{display:flex;align-items:center;gap:9px;color:var(--muted);font-size:13px}.checkbox input{accent-color:var(--purple)}
.helper-links{display:flex;justify-content:space-between;gap:12px;margin-top:12px;font-size:13px;color:#b8c6e2}.helper-links a{color:#cfbfff}.center{text-align:center}
.empty{padding:26px;border-radius:20px;border:1px dashed #314261;background:rgba(255,255,255,.02);text-align:center;color:var(--muted)}
dialog.rb-admin-modal{max-width:min(520px,94vw);width:100%;border:none;border-radius:24px;padding:0;background:linear-gradient(180deg,var(--panel),var(--panel-3));color:var(--text);box-shadow:var(--shadow)}
dialog.rb-admin-modal::backdrop{background:rgba(5,8,16,.72);backdrop-filter:blur(4px)}
.rb-admin-modal-head{padding:20px 22px 16px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.rb-admin-modal-body{padding:18px 22px 22px;max-height:min(70vh,560px);overflow:auto}
@media (max-width:1200px){.grid-4{grid-template-columns:repeat(2,minmax(0,1fr))}.kpi-row,.call-grid,.grid-2,.grid-3,.pricing-mini{grid-template-columns:1fr}.progress-item{grid-template-columns:1fr}.app-shell{grid-template-columns:94px minmax(0,1fr)}.sidebar{padding:20px 12px}.brand span,.nav-label,.nav-item span{display:none}.brand{justify-content:center}.nav-item{justify-content:center}.nav-icon{margin:0}.main{padding:24px 22px 30px}}
@media (max-width:880px){.auth-shell{grid-template-columns:1fr}.auth-side{display:none}.app-shell{grid-template-columns:1fr}.sidebar{position:relative;height:auto;border-right:none;border-bottom:1px solid var(--line)}.brand,.nav-list{flex-wrap:wrap}.nav-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.topbar{flex-direction:column;align-items:flex-start}.grid-4,.grid-3,.grid-2,.kpi-row,.call-grid,.pricing-mini,.form-grid{grid-template-columns:1fr}.page-title h1{font-size:28px}}
`,
];

export const adminShopsScripts: string[] = [

];

export const templateTitle = "Business accounts.";

export function AdminShopsTemplate() {
  return (
    <AdminLayout
      styles={adminShopsStyles}
      scripts={adminShopsScripts}
      scriptPrefix="admin-shops"
      bodyClass="app-body"
    >
      <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></div></div><span>RingBooker Admin</span></div><div className="nav-label">Backoffice</div><div className="nav-list"><a className="nav-item " href="/admin"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" /></svg></div><span>Overview</span></a><a className="nav-item active" href="/admin/shops"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 10l2-5h14l2 5" /><path d="M4 10h16v10H4z" /><path d="M9 20v-6h6v6" /></svg></div><span>Businesses</span></a><a className="nav-item " href="/admin/shops/luxe-hair-studio"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M5 20c1.5-3 4-4.5 7-4.5S17.5 17 19 20" /></svg></div><span>Business detail</span></a><a className="nav-item " href="/admin/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" /></svg></div><span>Calls &amp; Incidents</span></a><a className="nav-item " href="/admin/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span>Billing</span></a><a className="nav-item " href="/admin/users"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy={7} r={3} /><path d="M20 8v6" /><path d="M17 11h6" /></svg></div><span>Users &amp; Roles</span></a><a className="nav-item " href="/admin/system-health"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span>System Health</span></a></div></aside><main className="main"><div className="topbar"><div className="page-title"><h1>Shop accounts.</h1><p>Create, inspect, and monitor every salon account running on RingBooker.</p></div><div className="top-actions"><a className="btn" href="/admin/billing">Billing view</a><a className="btn purple" href="/admin/shops">Add shop</a></div></div>
          <section className="grid grid-3">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M3 10l2-5h14l2 5" /><path d="M4 10h16v10H4z" /><path d="M9 20v-6h6v6" /></svg></div><span className="tag green">24 active</span></div><div className="stat-value">31</div><div className="stat-meta">Total businesses created</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span className="tag purple">13 paid</span></div><div className="stat-value">7</div><div className="stat-meta">Trials in progress</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span className="tag orange">Needs setup</span></div><div className="stat-value">3</div><div className="stat-meta">Accounts missing complete routing</div></div>
          </section>
          <section className="card" style={{marginTop: 18}}><div className="panel-head"><div><h3>All businesses</h3><p className="sub">Operational list of every merchant account.</p></div><div className="top-actions"><a className="btn" href="/admin/shops/luxe-hair-studio">Open example</a><a className="btn purple" href="/admin/shops">Create business</a></div></div>
            <table className="table"><thead><tr><th>Business</th><th>Phone</th><th>Plan</th><th>Status</th><th>Calls today</th><th>User</th></tr></thead><tbody>
                <tr><td>Luxe Hair Studio</td><td>+1 714 555 0199</td><td>Professional</td><td><span className="tag green">Healthy</span></td><td>74</td><td>Mai Nguyen</td></tr>
                <tr><td>Bloom Nail Studio</td><td>+1 657 555 0131</td><td>Starter trial</td><td><span className="tag orange">Expires in 2d</span></td><td>39</td><td>Linh Tran</td></tr>
                <tr><td>Velvet Glow Spa</td><td>+1 949 555 0167</td><td>Professional</td><td><span className="tag green">Healthy</span></td><td>61</td><td>Thao Le</td></tr>
                <tr><td>Modern Shears OC</td><td>+1 714 555 0188</td><td>Custom</td><td><span className="tag red">Escalation spike</span></td><td>28</td><td>Chris Pham</td></tr>
                <tr><td>Golden Touch Nails</td><td>+1 562 555 0120</td><td>Starter</td><td><span className="tag blue">Onboarding</span></td><td>11</td><td>Jenny Ho</td></tr>
              </tbody></table></section>
        </main></div>

    </AdminLayout>
  );
}
