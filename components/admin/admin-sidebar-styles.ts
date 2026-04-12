/** Extra styles for grouped admin nav + icon toolbar + native dialogs (append to any admin shell stylesheet array). */
export const adminSidebarAddonStyles: string[] = [
  String.raw`
.nav-groups{display:flex;flex-direction:column;gap:6px;margin-top:2px}
.nav-group{border-radius:16px;border:1px solid transparent;transition:border-color .18s ease,background .18s ease}
.nav-group.has-active{border-color:rgba(139,92,246,.22);background:rgba(124,58,237,.06)}
.nav-group-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;border-radius:14px;border:none;background:transparent;color:#a7b4cf;font:inherit;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;text-align:left;cursor:pointer;transition:background .18s ease,color .18s ease}
.nav-group-toggle:hover{background:rgba(255,255,255,.04);color:#e5edf9}
.nav-group-chevron{display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);color:#93a0ba;transition:transform .2s ease,background .18s ease}
.nav-group-chevron svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.nav-group.open .nav-group-chevron{transform:rotate(90deg);color:#d8c9ff}
.nav-sub{display:flex;flex-direction:column;gap:3px;padding:4px 4px 10px 8px;margin:0 0 2px 10px;border-left:2px solid rgba(139,92,246,.28)}
.nav-sub-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;font-size:13.5px;font-weight:700;color:#c7d2e8;border:1px solid transparent;transition:background .18s ease,border-color .18s ease,color .18s ease}
.nav-sub-item:hover{background:rgba(255,255,255,.04);border-color:var(--line-soft);color:#fff}
.nav-sub-item.active{background:linear-gradient(180deg,rgba(124,58,237,.2),rgba(124,58,237,.1));border-color:rgba(139,92,246,.28);color:#fff}
.btn-icon{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border-radius:14px;border:1px solid var(--line);background:linear-gradient(180deg,#11182b,#0c1425);color:var(--text);box-shadow:var(--shadow);cursor:pointer;transition:transform .15s ease,border-color .18s ease,background .18s ease}
.btn-icon:hover{transform:translateY(-1px);border-color:#33466f}
.btn-icon.purple{background:linear-gradient(135deg,var(--purple),var(--purple-2));border-color:transparent;color:#fff}
.btn-icon svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.85;stroke-linecap:round;stroke-linejoin:round}
@media (max-width:1200px){.nav-group-title{font-size:10px}}
`,
];
