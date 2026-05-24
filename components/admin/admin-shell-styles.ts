/** Collapsed sidebar + light/dark theme overrides for admin backoffice shell. */
export const adminShellStyles: string[] = [
  String.raw`
.sidebar{display:flex;flex-direction:column;gap:0}
.nav-groups{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}
.sidebar-shell-controls{margin-top:auto;padding-top:14px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:6px}
.sidebar-shell-btn{width:100%;display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--panel-2);color:var(--muted);font:inherit;font-size:13px;font-weight:500;text-align:left;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease}
.sidebar-shell-btn:hover{background:var(--panel-3);border-color:var(--line-soft);color:var(--text)}
.sidebar-shell-btn[aria-pressed="true"]{background:var(--accent-soft);border-color:var(--accent-border);color:var(--text);font-weight:600}
.sidebar-shell-btn svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.85;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
.sidebar-control-label{flex:1;min-width:0;line-height:1.35}

html.sidebar-collapsed .app-shell{grid-template-columns:72px minmax(0,1fr)}
html.sidebar-collapsed .nav-label,
html.sidebar-collapsed .brand span,
html.sidebar-collapsed .nav-group-title,
html.sidebar-collapsed .nav-sub-label,
html.sidebar-collapsed .sidebar-control-label,
html.sidebar-collapsed .nav-group-chevron{display:none}
html.sidebar-collapsed .nav-item span{display:none}
html.sidebar-collapsed .nav-item{justify-content:center;padding:9px 8px}
html.sidebar-collapsed .brand{justify-content:center}
html.sidebar-collapsed .nav-group-toggle{justify-content:center;padding:9px 8px;gap:6px}
html.sidebar-collapsed .nav-group-toggle .nav-icon--group{margin:0}
html.sidebar-collapsed .nav-sub-item{justify-content:center;padding:9px 8px;margin-left:0}
html.sidebar-collapsed .nav-sub-item .nav-icon--sub{margin:0}
html.sidebar-collapsed .nav-sub{padding:2px 0 4px}
html.sidebar-collapsed .sidebar-shell-btn{justify-content:center;padding:9px 8px}
@media (max-width:1200px){
  .sidebar-control-label{display:none}
  .sidebar-shell-btn{justify-content:center;padding:9px 8px}
}

html.admin-theme-light{
  --bg:#fafafa;
  --panel:#ffffff;
  --panel-2:#f4f4f5;
  --panel-3:#ececee;
  --text:#18181b;
  --muted:#52525b;
  --line:#e4e4e7;
  --line-soft:#d4d4d8;
  --accent:#2563eb;
  --accent-hover:#1d4ed8;
  --accent-soft:rgba(37,99,235,.08);
  --accent-border:rgba(37,99,235,.22);
  --purple:var(--accent);
  --purple-2:var(--accent-hover);
  --tag-green-bg:#dcfce7;
  --tag-green-fg:#15803d;
  --tag-green-border:#86efac;
  --tag-blue-bg:#dbeafe;
  --tag-blue-fg:#1d4ed8;
  --tag-blue-border:#93c5fd;
  --tag-orange-bg:#ffedd5;
  --tag-orange-fg:#c2410c;
  --tag-orange-border:#fdba74;
  --tag-red-bg:#fee2e2;
  --tag-red-fg:#b91c1c;
  --tag-red-border:#fca5a5;
  --tag-purple-bg:#dbeafe;
  --tag-purple-fg:#1d4ed8;
  --tag-purple-border:#93c5fd;
  --tag-gray-bg:#f4f4f5;
  --tag-gray-fg:#3f3f46;
  --tag-gray-border:#d4d4d8;
  --tag-slate-bg:#e0f2fe;
  --tag-slate-fg:#0369a1;
  --tag-slate-border:#7dd3fc;
  --shadow:0 1px 2px rgba(0,0,0,.04),0 4px 16px rgba(0,0,0,.05);
}
html.admin-theme-light body{background:var(--bg);color:var(--text)}
html.admin-theme-light .sidebar{background:var(--panel);border-right-color:var(--line)}
html.admin-theme-light .main{background:var(--bg)}
html.admin-theme-light .nav-label{color:#71717a;font-weight:600}
html.admin-theme-light .nav-group-toggle{color:#3f3f46;font-weight:600}
html.admin-theme-light .nav-group-toggle:hover{background:#f4f4f5;color:#18181b}
html.admin-theme-light .nav-group.has-active .nav-group-toggle{color:#18181b}
html.admin-theme-light .nav-group-chevron{color:#a1a1aa}
html.admin-theme-light .nav-icon--group{color:#52525b}
html.admin-theme-light .nav-icon--sub{color:#71717a;opacity:1}
html.admin-theme-light .nav-sub-item{color:#52525b;font-weight:500}
html.admin-theme-light .nav-sub-item:hover{background:#f4f4f5;color:#18181b}
html.admin-theme-light .nav-sub-item.active{background:var(--accent-soft);color:#1d4ed8;font-weight:600}
html.admin-theme-light .nav-sub-item.active .nav-icon--sub{color:#2563eb;opacity:1}
html.admin-theme-light .sidebar-shell-controls{border-top-color:var(--line)}
html.admin-theme-light .sidebar-shell-btn{background:#fff;color:#3f3f46}
html.admin-theme-light .sidebar-shell-btn:hover{background:#f4f4f5;color:#18181b}
html.admin-theme-light .sidebar-shell-btn[aria-pressed="true"]{background:var(--accent-soft);border-color:var(--accent-border);color:#1d4ed8}
html.admin-theme-light .btn{background:#fff;color:#18181b;border-color:var(--line);box-shadow:none}
html.admin-theme-light .btn:hover{background:#f4f4f5;border-color:#d4d4d8}
html.admin-theme-light .btn.purple{background:var(--accent);border-color:var(--accent);color:#fff}
html.admin-theme-light .btn.purple:hover{background:var(--accent-hover);border-color:var(--accent-hover)}
html.admin-theme-light .btn-icon{background:#fff;color:#18181b;border-color:var(--line);box-shadow:none}
html.admin-theme-light .btn-icon.purple{background:var(--accent);border-color:var(--accent);color:#fff}
html.admin-theme-light .card,
html.admin-theme-light .stat-card,
html.admin-theme-light .admin-chart-card,
html.admin-theme-light .admin-trial-watchlist{background:var(--panel);box-shadow:none}
html.admin-theme-light .card.soft{background:var(--panel-2)}
html.admin-theme-light .table th,
html.admin-theme-light .table td{border-bottom-color:var(--line);color:var(--text)}
html.admin-theme-light .table th{color:#71717a;font-weight:600}
html.admin-theme-light .list-item{background:var(--panel-2);border-color:var(--line)}
html.admin-theme-light .item-main h4{color:#18181b;font-weight:600}
html.admin-theme-light .item-main p{color:#52525b}
html.admin-theme-light .field input,
html.admin-theme-light .field select,
html.admin-theme-light .field textarea{background:#fff;border-color:var(--line);color:#18181b}
html.admin-theme-light .field label{color:#52525b;font-weight:600}
html.admin-theme-light .page-title h1{color:#18181b}
html.admin-theme-light .page-title p{color:#52525b}
html.admin-theme-light .stat-value{color:#18181b}
html.admin-theme-light .stat-meta{color:#71717a}
html.admin-theme-light .sub{color:#52525b}
html.admin-theme-light .card h3{color:#18181b}
html.admin-theme-light .nav-item{color:#52525b}
html.admin-theme-light .nav-item:hover{background:#f4f4f5;color:#18181b}
html.admin-theme-light .nav-item.active{background:var(--accent-soft);border-color:var(--accent-border);color:#1d4ed8}
html.admin-theme-light .nav-item.active .nav-icon{background:rgba(37,99,235,.1);color:#2563eb}
html.admin-theme-light .nav-icon{background:transparent;border-color:transparent;color:#71717a}
html.admin-theme-light .badge-right{background:var(--tag-purple-bg);color:var(--tag-purple-fg);border-color:var(--tag-purple-border)}
html.admin-theme-light .avatar{background:#f4f4f5;color:#3f3f46;border-color:var(--line)}
html.admin-theme-light .note{background:var(--panel-2);border-color:var(--line);color:#3f3f46}
html.admin-theme-light .empty{border-color:#d4d4d8;background:#fafafa;color:#71717a}
html.admin-theme-light .admin-period-filter button{background:#fff;color:#52525b;border-color:var(--line)}
html.admin-theme-light .admin-period-filter button:hover{border-color:#d4d4d8;color:#18181b}
html.admin-theme-light .admin-period-filter button.active{background:var(--accent);border-color:var(--accent);color:#fff}
html.admin-theme-light .admin-trial-watchlist li{background:var(--panel-2);border-color:var(--line)}
html.admin-theme-light .admin-chart-svg{background:#f4f4f5}
html.admin-theme-light .admin-chart-x{fill:#71717a}
html.admin-theme-light .admin-breakdown-card{background:var(--panel);border-color:var(--line)}
html.admin-theme-light .admin-breakdown-card>h3{color:#18181b}
html.admin-theme-light .admin-breakdown-meta span:first-child{color:#18181b}
html.admin-theme-light .admin-breakdown-meta span:last-child{color:#52525b}
html.admin-theme-light .admin-breakdown-bar{background:#ececee;border-color:var(--line)}
html.admin-theme-light .admin-section-head h2{color:#52525b}
html.admin-theme-light .admin-table-note-btn{background:#fff;color:#3f3f46;border-color:var(--line)}
html.admin-theme-light .admin-table-note-btn:hover{background:#f4f4f5;color:#18181b}
html.admin-theme-light .admin-table-note-btn.has-note{color:#1d4ed8;border-color:var(--accent-border)}
html.admin-theme-light .shop-tab{color:#52525b}
html.admin-theme-light .shop-tab:hover{background:#f4f4f5;color:#18181b}
html.admin-theme-light .shop-tab.active{background:var(--accent-soft);border-color:var(--accent-border);color:#1d4ed8}
html.admin-theme-light .shop-tab-bar{background:#f4f4f5;border-color:var(--line)}
html.admin-theme-light .shop-ai-panel{background:var(--panel-2);border-color:var(--line)}
html.admin-theme-light .shop-ai-panel-head h4{color:#18181b}
html.admin-theme-light .shop-ai-toggle-grid .checkbox{background:#fff;border-color:var(--line);color:#3f3f46}
html.admin-theme-light dialog.rb-admin-modal::backdrop{background:rgba(24,24,27,.35)}
html.admin-theme-light .helper-links a{color:var(--accent)}
html.admin-theme-light .auth-card{background:var(--panel);border-color:var(--line)}
html.admin-theme-light .auth-side{background:var(--panel);border-right-color:var(--line)}
html.admin-theme-light .auth-shell{background:var(--bg)}
html.admin-theme-light .auth-brand-copy h2{color:#18181b}
html.admin-theme-light .auth-stat{background:var(--panel-2);border-color:var(--line)}
html.admin-theme-light .auth-stat strong{color:#18181b}
html.admin-theme-light .auth-foot{color:#71717a}
html.admin-theme-light .call-live,
html.admin-theme-light .hero-admin{background:var(--panel-2);border-color:var(--line);color:var(--text)}
html.admin-theme-light .live-copy{color:#52525b}
html.admin-theme-light .subtitle-box{background:var(--panel);border-color:var(--line)}
html.admin-theme-light .subtitle-box .mini{color:#71717a}
html.admin-theme-light .subtitle-box p{color:#18181b}
html.admin-theme-light .live-name{color:#18181b}
html.admin-theme-light .brand-core{background:var(--accent)}
`,
];
