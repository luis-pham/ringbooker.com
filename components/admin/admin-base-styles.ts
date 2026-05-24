/** Shared admin shell tokens + layout primitives (modern neutral SaaS). */
export const adminBaseStyles: string[] = [
  String.raw`
:root{
  --bg:#09090b;
  --panel:#111113;
  --panel-2:#18181b;
  --panel-3:#131316;
  --text:#fafafa;
  --muted:#a1a1aa;
  --line:#27272a;
  --line-soft:#3f3f46;
  --accent:#2563eb;
  --accent-hover:#1d4ed8;
  --accent-soft:rgba(37,99,235,.12);
  --accent-border:rgba(37,99,235,.28);
  --purple:var(--accent);
  --purple-2:var(--accent-hover);
  --purple-3:#93c5fd;
  --green:#16a34a;
  --orange:#d97706;
  --red:#dc2626;
  --blue:#2563eb;
  --tag-green-bg:rgba(22,163,74,.16);
  --tag-green-fg:#4ade80;
  --tag-green-border:rgba(34,197,94,.32);
  --tag-blue-bg:rgba(37,99,235,.16);
  --tag-blue-fg:#60a5fa;
  --tag-blue-border:rgba(59,130,246,.32);
  --tag-orange-bg:rgba(217,119,6,.16);
  --tag-orange-fg:#fb923c;
  --tag-orange-border:rgba(251,146,60,.32);
  --tag-red-bg:rgba(220,38,38,.16);
  --tag-red-fg:#f87171;
  --tag-red-border:rgba(248,113,113,.32);
  --tag-purple-bg:var(--accent-soft);
  --tag-purple-fg:#93c5fd;
  --tag-purple-border:var(--accent-border);
  --tag-gray-bg:rgba(161,161,170,.14);
  --tag-gray-fg:#d4d4d8;
  --tag-gray-border:rgba(161,161,170,.28);
  --tag-slate-bg:rgba(14,165,233,.14);
  --tag-slate-fg:#38bdf8;
  --tag-slate-border:rgba(56,189,248,.32);
  --shadow:0 1px 2px rgba(0,0,0,.24),0 8px 24px rgba(0,0,0,.18);
  --r-xl:16px;
  --r-lg:12px;
  --r-md:10px;
  --r-sm:8px;
  --r-pill:999px;
}
*{box-sizing:border-box}
html{scrollbar-gutter:stable}
body{margin:0;font-family:'Mona Sans Variable',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;-webkit-font-smoothing:antialiased}
a{text-decoration:none;color:inherit}
button,input,select,textarea{font:inherit}
body.app-body{overflow:hidden;height:100vh}
.app-shell{min-height:100vh;height:100vh}
.sidebar{position:fixed;top:0;left:0;z-index:30;width:260px;height:100vh;max-height:100vh;overflow:hidden;padding:20px 16px;border-right:1px solid var(--line);background:var(--panel)}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;letter-spacing:-.02em;margin-bottom:20px;color:var(--text)}
.brand-mark{position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;flex:0 0 32px}
.brand-ripple{display:none}
.brand-core{width:32px;height:32px;border-radius:8px;background:var(--accent);display:flex;align-items:center;justify-content:center;position:relative;z-index:1;box-shadow:none}
.brand-core svg{width:14px;height:14px;fill:#fff}
.nav-label{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:8px 10px 6px}
.nav-list{display:flex;flex-direction:column;gap:4px}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--r-sm);color:var(--muted);font-size:14px;font-weight:500;transition:background .15s ease,color .15s ease;border:1px solid transparent}
.nav-item:hover{background:rgba(255,255,255,.04);color:var(--text)}
.nav-item.active{background:var(--accent-soft);border-color:var(--accent-border);color:var(--text);font-weight:600}
.nav-icon{width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;background:transparent;border:1px solid transparent;flex:0 0 28px;color:inherit}
.nav-icon svg{width:16px;height:16px;stroke:currentColor;stroke-width:1.75;fill:none;stroke-linecap:round;stroke-linejoin:round}
.nav-item.active .nav-icon{background:rgba(37,99,235,.16);border-color:transparent;color:#bfdbfe}
.main{margin-left:260px;width:calc(100% - 260px);height:100vh;max-height:100vh;padding:24px 28px 32px;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;background:var(--bg)}
.topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}
.page-title h1{margin:0;font-size:28px;line-height:1.15;letter-spacing:-.03em;font-weight:700}
.page-title p{margin:8px 0 0;color:var(--muted);font-size:14px;line-height:1.55;max-width:760px}
.top-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:9px 14px;border-radius:var(--r-sm);font-size:13px;font-weight:600;border:1px solid var(--line);background:var(--panel-2);color:var(--text);box-shadow:none;transition:background .15s ease,border-color .15s ease,color .15s ease}
.btn:hover{background:var(--panel-3);border-color:var(--line-soft)}
.btn.purple{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.purple:hover{background:var(--accent-hover);border-color:var(--accent-hover)}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted)}
.btn.ghost:hover{background:rgba(255,255,255,.04);color:var(--text)}
.grid{display:grid;gap:16px}.grid-4{grid-template-columns:repeat(4,minmax(0,1fr))}.grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}.grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--r-lg);padding:20px;box-shadow:none}
.card.soft{background:var(--panel-2)}
.card h3{margin:0 0 6px;font-size:16px;letter-spacing:-.02em;font-weight:600}
.sub{margin:0;color:var(--muted);font-size:13px;line-height:1.55}
.panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:16px}
.badge-right,.tag{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;line-height:1.25;letter-spacing:.01em;white-space:nowrap}
.tag.purple,.badge-right{background:var(--tag-purple-bg);color:var(--tag-purple-fg);border:1px solid var(--tag-purple-border)}
.tag.green{background:var(--tag-green-bg);color:var(--tag-green-fg);border:1px solid var(--tag-green-border)}
.tag.orange{background:var(--tag-orange-bg);color:var(--tag-orange-fg);border:1px solid var(--tag-orange-border)}
.tag.red{background:var(--tag-red-bg);color:var(--tag-red-fg);border:1px solid var(--tag-red-border)}
.tag.blue{background:var(--tag-blue-bg);color:var(--tag-blue-fg);border:1px solid var(--tag-blue-border)}
.tag.gray{background:var(--tag-gray-bg);color:var(--tag-gray-fg);border:1px solid var(--tag-gray-border)}
.tag.slate{background:var(--tag-slate-bg);color:var(--tag-slate-fg);border:1px solid var(--tag-slate-border)}
.stat-card{background:var(--panel);border:1px solid var(--line);border-radius:var(--r-lg);padding:18px;box-shadow:none}
.stat-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.stat-icon{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.04);border:1px solid var(--line);color:var(--muted)}
.stat-icon svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.75}
.stat-value{font-size:28px;font-weight:700;letter-spacing:-.03em}
.stat-meta{font-size:13px;color:var(--muted)}
.table{width:100%;border-collapse:collapse}
.table th,.table td{padding:12px 0;border-bottom:1px solid var(--line);text-align:left;font-size:13px;vertical-align:top}
.table th{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);font-weight:600}
.table tr:last-child td{border-bottom:none}
.list{display:flex;flex-direction:column;gap:8px}
.list-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border-radius:var(--r-md);background:var(--panel-2);border:1px solid var(--line)}
.item-main{display:flex;align-items:center;gap:12px;min-width:0}
.avatar{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);color:var(--text);font-size:12px;font-weight:600;border:1px solid var(--line);flex:0 0 36px}
.item-main h4{margin:0 0 3px;font-size:14px;font-weight:600}
.item-main p{margin:0;color:var(--muted);font-size:13px;line-height:1.5}
.note{padding:14px 16px;border-radius:var(--r-md);background:var(--panel-2);border:1px solid var(--line);color:var(--text);font-size:13px;line-height:1.6}
.kpi-row{display:grid;grid-template-columns:1.16fr .84fr;gap:16px}.call-grid{display:grid;grid-template-columns:1.08fr .92fr;gap:16px}
.call-live,.hero-admin{position:relative;overflow:hidden;background:var(--panel-2);border:1px solid var(--line);color:var(--text)}
.call-live::before,.hero-admin::before{display:none}
.live-label{display:inline-flex;align-items:center;gap:8px;background:rgba(22,163,74,.12);color:#86efac;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:600;margin-bottom:12px;border:1px solid rgba(22,163,74,.2)}
.dot{width:7px;height:7px;border-radius:50%;background:var(--green)}
.live-name{font-size:22px;font-weight:700;letter-spacing:-.03em;margin-bottom:8px}
.live-copy{font-size:14px;color:var(--muted);line-height:1.6;max-width:560px}
.subtitle-box{margin-top:16px;padding:14px;border-radius:var(--r-md);background:var(--panel);border:1px solid var(--line)}
.subtitle-box .mini{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:6px}
.subtitle-box p{margin:0;color:var(--text);line-height:1.6;font-size:13px}
.wave{display:flex;gap:3px;align-items:flex-end;height:24px;margin-top:16px}
.wave span{width:3px;border-radius:99px;background:var(--accent);opacity:.7;animation:wave .8s ease-in-out infinite}
.wave span:nth-child(1){height:10px}.wave span:nth-child(2){height:16px;animation-delay:.1s}.wave span:nth-child(3){height:22px;animation-delay:.2s}.wave span:nth-child(4){height:14px;animation-delay:.3s}.wave span:nth-child(5){height:18px;animation-delay:.4s}.wave span:nth-child(6){height:11px;animation-delay:.5s}.wave span:nth-child(7){height:19px;animation-delay:.6s}.wave span:nth-child(8){height:14px;animation-delay:.7s}.wave span:nth-child(9){height:21px;animation-delay:.8s}
@keyframes wave{0%,100%{transform:scaleY(.5);opacity:.45}50%{transform:scaleY(1);opacity:1}}
.progress-list{display:flex;flex-direction:column;gap:10px}
.progress-item{display:grid;grid-template-columns:170px 1fr auto;gap:12px;align-items:center;font-size:13px}
.bar{height:8px;border-radius:999px;background:var(--panel-3);overflow:hidden;border:1px solid var(--line)}
.bar span{display:block;height:100%;border-radius:999px;background:var(--accent)}
.admin-section-head{margin-top:24px;margin-bottom:8px}
.admin-section-head h2{margin:0;font-size:14px;font-weight:600;color:var(--muted);letter-spacing:-.01em}
.admin-breakdown-card{background:var(--panel);border:1px solid var(--line);border-radius:var(--r-lg);padding:16px 20px;margin-top:16px;box-shadow:none}
.admin-breakdown-card>h3{margin:0 0 12px;font-size:15px;font-weight:600;color:var(--text)}
.admin-breakdown-list{display:flex;flex-direction:column;gap:8px}
.admin-breakdown-meta{display:flex;justify-content:space-between;gap:12px;font-size:12px;line-height:1.35;margin-bottom:4px}
.admin-breakdown-meta span:first-child{color:var(--text);font-weight:500}
.admin-breakdown-meta span:last-child{color:var(--muted);font-weight:600;font-variant-numeric:tabular-nums}
.admin-breakdown-bar{height:8px;border-radius:999px;background:var(--panel-3);overflow:hidden;border:1px solid var(--line)}
.admin-breakdown-fill{display:block;height:100%;border-radius:999px;transition:width .4s ease;min-width:0}
.admin-breakdown-fill.tone-green{background:var(--green)}
.admin-breakdown-fill.tone-yellow{background:var(--orange)}
.admin-breakdown-fill.tone-red{background:var(--red)}
.admin-breakdown-fill.tone-blue{background:var(--accent)}
.admin-breakdown-extra{margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}
.admin-breakdown-extra-label{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.admin-breakdown-chips{display:flex;flex-wrap:wrap;gap:6px}
.admin-table-note-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--panel-2);color:var(--text);font:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease;white-space:nowrap}
.admin-table-note-btn:hover{background:var(--panel-3);border-color:var(--line-soft)}
.admin-table-note-btn svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.85;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
.admin-table-note-btn.has-note{border-color:var(--accent-border);color:var(--accent)}
.admin-table-note-btn:disabled{opacity:.55;cursor:not-allowed}
.admin-table-actions{text-align:right;vertical-align:middle;width:1%;white-space:nowrap}
.admin-table-actions-inner{display:flex;justify-content:flex-end;align-items:center;gap:8px}
a.admin-table-icon-btn{text-decoration:none;color:inherit}
.admin-filter-bar{display:grid;grid-template-columns:minmax(140px,180px) minmax(140px,180px) minmax(200px,1fr) max-content max-content;gap:12px;align-items:end}
.admin-filter-bar .field{margin:0;min-width:0}
.admin-filter-bar .field label{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.admin-filter-bar select,.admin-filter-bar input{width:100%}
.admin-filter-bar .field--apply,.admin-filter-bar .field--clear{width:auto;max-width:max-content;justify-self:start}
.admin-filter-bar .field--apply .btn,.admin-filter-bar .field--clear .btn{display:inline-flex;width:auto}
.admin-filter-bar .btn{white-space:nowrap}
.admin-filter-bar--phone-demos{grid-template-columns:minmax(130px,150px) minmax(130px,150px) max-content}
.admin-filter-bar--web-demos{grid-template-columns:minmax(120px,160px) minmax(110px,140px) minmax(72px,96px) minmax(160px,1fr) minmax(130px,150px) minmax(130px,150px) max-content}
@media (max-width:960px){.admin-filter-bar{grid-template-columns:1fr 1fr}.admin-filter-bar .field--search{grid-column:1/-1}.admin-filter-bar .field--apply,.admin-filter-bar .field--clear{grid-column:span 1}.admin-filter-bar--web-demos .field--from,.admin-filter-bar--web-demos .field--to{grid-column:span 1}}
@media (max-width:560px){.admin-filter-bar,.admin-filter-bar--phone-demos,.admin-filter-bar--web-demos{grid-template-columns:1fr}}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.field{display:flex;flex-direction:column;gap:6px}
.field label{font-size:12px;font-weight:600;color:var(--muted)}
.field input,.field select,.field textarea{width:100%;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:var(--r-sm);padding:10px 12px;outline:none;transition:border-color .15s ease}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--accent-border)}
.field textarea{min-height:100px;resize:vertical}
.pricing-mini{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.price-mini{padding:16px;border-radius:var(--r-lg);background:var(--panel-2);border:1px solid var(--line)}
.price-mini.featured{background:var(--panel);border-color:var(--accent-border)}
.price-mini h4{margin:0 0 8px;font-size:15px;font-weight:600}
.amt{font-size:26px;font-weight:700;letter-spacing:-.03em;margin-bottom:10px}
.price-mini ul{margin:0;padding-left:18px;color:var(--muted);font-size:13px;line-height:1.7}
.auth-shell{min-height:100vh;display:grid;grid-template-columns:1.05fr .95fr;background:var(--bg)}
.auth-side{padding:40px;display:flex;flex-direction:column;justify-content:space-between;border-right:1px solid var(--line)}
.auth-panel{display:flex;align-items:center;justify-content:center;padding:32px}
.auth-card{width:100%;max-width:440px;background:var(--panel);border:1px solid var(--line);border-radius:var(--r-xl);padding:28px;box-shadow:var(--shadow)}
.auth-card h1{margin:0 0 8px;font-size:28px;letter-spacing:-.03em;font-weight:700}
.auth-card p{margin:0 0 20px;color:var(--muted);line-height:1.6}
.auth-brand-copy h2{font-size:40px;line-height:1.05;letter-spacing:-.04em;margin:16px 0 12px;font-weight:700}
.auth-brand-copy p{max-width:520px;color:var(--muted);line-height:1.7}
.auth-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:20px}
.auth-stat{padding:14px;border-radius:var(--r-md);background:var(--panel-2);border:1px solid var(--line)}
.auth-stat strong{display:block;font-size:24px;letter-spacing:-.03em;font-weight:700}
.auth-stat span{display:block;color:var(--muted);font-size:13px;line-height:1.5;margin-top:4px}
.auth-foot{display:flex;justify-content:space-between;gap:10px;color:var(--muted);font-size:12px;line-height:1.5;margin-top:20px}
.divider{height:1px;background:var(--line);margin:16px 0}
.inline{display:flex;align-items:center;justify-content:space-between;gap:12px}
.checkbox{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:13px}
.checkbox input{accent-color:var(--accent)}
.helper-links{display:flex;justify-content:space-between;gap:12px;margin-top:12px;font-size:13px;color:var(--muted)}
.helper-links a{color:var(--accent)}
.center{text-align:center}
.empty{padding:24px;border-radius:var(--r-lg);border:1px dashed var(--line-soft);background:var(--panel-2);text-align:center;color:var(--muted)}
.admin-period-filter{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 4px;align-items:center}
.admin-period-filter .period-label{font-size:11px;font-weight:600;color:var(--muted);margin-right:4px;text-transform:uppercase;letter-spacing:.05em}
.admin-period-filter button{padding:7px 12px;border-radius:var(--r-sm);font-size:12px;font-weight:600;border:1px solid var(--line);background:var(--panel-2);color:var(--muted);cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease}
.admin-period-filter button:hover{border-color:var(--line-soft);color:var(--text)}
.admin-period-filter button.active{background:var(--accent);border-color:var(--accent);color:#fff}
.admin-overview-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,320px);gap:20px;margin-top:20px;align-items:start}
.admin-overview-split .admin-chart-grid{margin-top:0}
.admin-trial-watchlist{background:var(--panel);border:1px solid var(--line);border-radius:var(--r-lg);padding:16px;box-shadow:none;position:sticky;top:18px}
.admin-trial-watchlist h3{margin:0 0 6px;font-size:15px;font-weight:600}
.admin-trial-watchlist .trial-sub{font-size:12px;line-height:1.45;color:var(--muted);margin:0 0 12px}
.admin-trial-watchlist ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.admin-trial-watchlist li{border:1px solid var(--line);border-radius:var(--r-sm);padding:10px 12px;background:var(--panel-2)}
.admin-trial-watchlist .trial-shop{font-weight:600;font-size:14px;margin:0 0 4px;line-height:1.35}
.admin-trial-watchlist .trial-shop a{color:inherit;text-decoration:none}
.admin-trial-watchlist .trial-shop a:hover{text-decoration:underline;color:var(--accent)}
.admin-trial-watchlist .trial-meta{font-size:11px;color:var(--muted);line-height:1.45}
.admin-trial-watchlist .trial-days{display:inline-block;margin-top:6px;font-size:11px;font-weight:600;padding:3px 7px;border-radius:6px;background:rgba(217,119,6,.12);color:#fcd34d;border:1px solid rgba(217,119,6,.2)}
.admin-trial-watchlist .trial-days.urgent{background:rgba(220,38,38,.12);color:#fca5a5;border:1px solid rgba(220,38,38,.2)}
.admin-chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:16px}
.admin-chart-card{background:var(--panel);border:1px solid var(--line);border-radius:var(--r-lg);padding:16px;box-shadow:none}
.admin-chart-card .admin-period-filter{margin:0 0 10px}
.admin-chart-card .admin-period-filter .period-label{font-size:10px;margin-right:4px}
.admin-chart-card .admin-period-filter button{padding:6px 10px;font-size:12px}
.admin-chart-card .chart-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}
.admin-chart-card h3{margin:0;font-size:15px;font-weight:600}
.admin-chart-card .chart-total{font-size:12px;font-weight:600;color:var(--muted)}
.admin-chart-card .chart-source{font-size:11px;color:var(--muted);line-height:1.45;margin:0 0 4px}
.admin-chart-svg{width:100%;height:auto;display:block;border-radius:var(--r-sm);background:var(--panel-2)}
.admin-chart-x{font-size:9px;fill:var(--muted);font-weight:600}
dialog.rb-admin-modal{max-width:min(720px,94vw);width:100%;border:none;border-radius:var(--r-lg);padding:0;background:var(--panel);color:var(--text);box-shadow:var(--shadow)}
dialog.rb-admin-modal::backdrop{background:rgba(0,0,0,.55);backdrop-filter:blur(2px)}
.rb-admin-modal-head{padding:18px 20px 14px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.rb-admin-modal-body{padding:16px 20px 20px;max-height:min(70vh,560px);overflow:auto}
@media (max-width:1100px){.admin-overview-split{grid-template-columns:1fr}.admin-trial-watchlist{position:relative;top:0}.admin-chart-grid{grid-template-columns:1fr}}
@media (max-width:1200px){.grid-4{grid-template-columns:repeat(2,minmax(0,1fr))}.kpi-row,.call-grid,.grid-2,.grid-3,.pricing-mini{grid-template-columns:1fr}.progress-item{grid-template-columns:1fr}.sidebar{width:72px;padding:16px 10px}.main{margin-left:72px;width:calc(100% - 72px);padding:20px 18px 28px}.brand span,.nav-label,.nav-item span{display:none}.brand{justify-content:center}.nav-item{justify-content:center}.nav-icon{margin:0}}
@media (max-width:880px){.auth-shell{grid-template-columns:1fr}.auth-side{display:none}body.app-body{overflow-y:auto;height:auto}.app-shell{height:auto}.sidebar{position:relative;width:auto;height:auto;max-height:none;border-right:none;border-bottom:1px solid var(--line)}.main{margin-left:0;width:100%;height:auto;max-height:none;overflow:visible;padding:20px 16px 28px}.brand,.nav-list{flex-wrap:wrap}.nav-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.topbar{flex-direction:column;align-items:flex-start}.grid-4,.grid-3,.grid-2,.kpi-row,.call-grid,.pricing-mini,.form-grid{grid-template-columns:1fr}.page-title h1{font-size:24px}}
`,
];
