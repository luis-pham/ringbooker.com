/** Collapsed sidebar + light theme overrides for admin backoffice shell. */
export const adminShellStyles: string[] = [
  String.raw`
.sidebar{display:flex;flex-direction:column;gap:0}
.nav-groups{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}
.sidebar-shell-controls{margin-top:auto;padding-top:14px;border-top:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;gap:8px}
.sidebar-shell-btn{width:100%;display:flex;align-items:center;gap:10px;padding:10px 10px;border-radius:12px;border:1px solid var(--line-soft);background:rgba(255,255,255,.03);color:#cbd5e1;font:inherit;font-size:13px;font-weight:600;text-align:left;cursor:pointer;transition:background .16s ease,border-color .16s ease,color .16s ease}
.sidebar-shell-btn:hover{background:rgba(255,255,255,.06);border-color:var(--line);color:#f8fafc}
.sidebar-shell-btn[aria-pressed="true"]{background:rgba(124,58,237,.14);border-color:rgba(139,92,246,.28);color:#f1f5f9}
.sidebar-shell-btn svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.85;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
.sidebar-control-label{flex:1;min-width:0;line-height:1.35}

html.sidebar-collapsed .app-shell{grid-template-columns:94px minmax(0,1fr)}
html.sidebar-collapsed .nav-label,
html.sidebar-collapsed .brand span,
html.sidebar-collapsed .nav-group-title,
html.sidebar-collapsed .nav-sub-label,
html.sidebar-collapsed .sidebar-control-label,
html.sidebar-collapsed .nav-group-chevron{display:none}
html.sidebar-collapsed .brand{justify-content:center}
html.sidebar-collapsed .nav-group-toggle{justify-content:center;padding:10px 8px;gap:6px}
html.sidebar-collapsed .nav-group-toggle .nav-icon--group{margin:0}
html.sidebar-collapsed .nav-sub-item{justify-content:center;padding:10px 8px;margin-left:0}
html.sidebar-collapsed .nav-sub-item .nav-icon--sub{margin:0}
html.sidebar-collapsed .nav-sub{padding:2px 0 4px}
html.sidebar-collapsed .sidebar-shell-btn{justify-content:center;padding:10px 8px}
html.sidebar-collapsed .sidebar-shell-controls{align-items:stretch}
@media (max-width:1200px){
  .sidebar-control-label{display:none}
  .sidebar-shell-btn{justify-content:center;padding:10px 8px}
}

html.admin-theme-light{
  --bg:#eef2f8;
  --panel:#ffffff;
  --panel-2:#f8fafc;
  --panel-3:#f1f5f9;
  --text:#0f172a;
  --muted:#64748b;
  --line:#dbe3ef;
  --line-soft:#e2e8f0;
  --shadow:0 14px 36px rgba(15,23,42,.08);
}
html.admin-theme-light body{
  background:radial-gradient(circle at top left,#e8eef7 0,#eef2f8 35%,#e2e8f0 100%);
  color:var(--text);
}
html.admin-theme-light .sidebar{
  border-right-color:var(--line);
  background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(248,250,252,.98));
}
html.admin-theme-light .nav-label{color:#64748b}
html.admin-theme-light .nav-group-toggle{color:#334155}
html.admin-theme-light .nav-group-toggle:hover{background:rgba(15,23,42,.04);color:#0f172a}
html.admin-theme-light .nav-group.has-active .nav-group-toggle{color:#1e293b}
html.admin-theme-light .nav-group-chevron{color:#94a3b8}
html.admin-theme-light .nav-icon--group{color:#475569}
html.admin-theme-light .nav-icon--sub{color:#64748b}
html.admin-theme-light .nav-sub-item{color:#64748b}
html.admin-theme-light .nav-sub-item:hover{background:rgba(15,23,42,.04);color:#334155}
html.admin-theme-light .nav-sub-item.active{background:rgba(124,58,237,.1);color:#5b21b6}
html.admin-theme-light .nav-sub-item.active .nav-icon--sub{color:#7c3aed}
html.admin-theme-light .sidebar-shell-controls{border-top-color:var(--line)}
html.admin-theme-light .sidebar-shell-btn{background:#fff;color:#334155;border-color:var(--line)}
html.admin-theme-light .sidebar-shell-btn:hover{background:#f8fafc;border-color:#cbd5e1;color:#0f172a}
html.admin-theme-light .sidebar-shell-btn[aria-pressed="true"]{background:rgba(124,58,237,.08);border-color:rgba(124,58,237,.22);color:#5b21b6}
html.admin-theme-light .btn{background:linear-gradient(180deg,#fff,#f8fafc);color:var(--text);box-shadow:var(--shadow)}
html.admin-theme-light .btn:hover{border-color:#cbd5e1}
html.admin-theme-light .btn-icon{background:linear-gradient(180deg,#fff,#f8fafc);color:var(--text)}
html.admin-theme-light .card,
html.admin-theme-light .stat-card,
html.admin-theme-light .admin-chart-card,
html.admin-theme-light .admin-trial-watchlist{background:linear-gradient(180deg,#fff,#f8fafc)}
html.admin-theme-light .card.soft{background:linear-gradient(180deg,#f8fafc,#f1f5f9)}
html.admin-theme-light .table th,
html.admin-theme-light .table td{border-bottom-color:rgba(15,23,42,.08)}
html.admin-theme-light .table th{color:#64748b}
html.admin-theme-light .list-item{background:rgba(15,23,42,.02);border-color:rgba(15,23,42,.06)}
html.admin-theme-light .field input,
html.admin-theme-light .field select,
html.admin-theme-light .field textarea{background:#fff;border-color:var(--line);color:var(--text)}
html.admin-theme-light .nav-item{color:#475569}
html.admin-theme-light .nav-item:hover{background:rgba(15,23,42,.04)}
html.admin-theme-light .nav-icon{background:#f8fafc;border-color:var(--line)}
html.admin-theme-light .empty{border-color:#cbd5e1;background:rgba(15,23,42,.02)}
html.admin-theme-light .admin-period-filter button{background:#fff;color:#475569;border-color:var(--line-soft)}
html.admin-theme-light .admin-period-filter button:hover{border-color:var(--line);color:#0f172a}
html.admin-theme-light .admin-trial-watchlist li{background:rgba(15,23,42,.03);border-color:var(--line-soft)}
html.admin-theme-light .admin-chart-svg{background:rgba(15,23,42,.04)}
html.admin-theme-light .admin-chart-x{fill:#64748b}
html.admin-theme-light dialog.rb-admin-modal::backdrop{background:rgba(15,23,42,.35)}
`,
];
