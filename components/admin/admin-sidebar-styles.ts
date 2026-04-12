/** Grouped admin nav styled like legacy flat `nav-item` + `nav-icon` rows (append to admin shell stylesheet array). */
export const adminSidebarAddonStyles: string[] = [
  String.raw`
.nav-groups{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.nav-group{border-radius:16px;border:1px solid transparent;transition:border-color .18s ease,background .18s ease}
.nav-group.has-active{border-color:rgba(139,92,246,.22);background:rgba(124,58,237,.06)}
.nav-group-toggle{width:100%;display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;border:none;background:transparent;color:#c7d2e8;font:inherit;font-size:14px;font-weight:700;text-align:left;cursor:pointer;transition:background .18s ease,color .18s ease,border-color .18s ease;border:1px solid transparent}
.nav-group-toggle:hover{background:rgba(255,255,255,.03);border-color:var(--line-soft);color:#fff}
.nav-group.has-active .nav-group-toggle{color:#e5edf9}
.nav-group-title{flex:1;min-width:0;letter-spacing:-.01em}
.nav-group-chevron{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:10px;background:#0f1729;border:1px solid var(--line);color:#93a0ba;flex-shrink:0;transition:transform .2s ease,background .18s ease,color .18s ease,border-color .18s ease}
.nav-group-chevron svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.nav-group.open .nav-group-chevron{transform:rotate(90deg);color:#d8c9ff;border-color:rgba(139,92,246,.35);background:rgba(139,92,246,.12)}
.nav-icon--group svg,.nav-icon--sub svg{width:16px;height:16px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
.nav-icon--sub{width:30px;height:30px;border-radius:11px;flex:0 0 30px}
.nav-icon--sub svg{width:15px;height:15px}
.nav-sub{display:flex;flex-direction:column;gap:6px;padding:4px 4px 8px 6px;margin:0 0 4px 0}
.nav-sub-item{display:flex;align-items:center;gap:10px;padding:10px 12px 10px 10px;margin-left:6px;border-radius:14px;font-size:14px;font-weight:700;color:#c7d2e8;border:1px solid transparent;transition:background .18s ease,border-color .18s ease,color .18s ease}
.nav-sub-item:hover{background:rgba(255,255,255,.03);border-color:var(--line-soft);color:#fff}
.nav-sub-item.active{background:linear-gradient(180deg,rgba(124,58,237,.2),rgba(124,58,237,.1));border-color:rgba(139,92,246,.28);color:#fff}
.nav-sub-item.active .nav-icon{background:rgba(139,92,246,.18);border-color:rgba(139,92,246,.4)}
.nav-sub-label{min-width:0;line-height:1.35}
.btn-icon{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border-radius:14px;border:1px solid var(--line);background:linear-gradient(180deg,#11182b,#0c1425);color:var(--text);box-shadow:var(--shadow);cursor:pointer;transition:transform .15s ease,border-color .18s ease,background .18s ease}
.btn-icon:hover{transform:translateY(-1px);border-color:#33466f}
.btn-icon.purple{background:linear-gradient(135deg,var(--purple),var(--purple-2));border-color:transparent;color:#fff}
.btn-icon svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.85;stroke-linecap:round;stroke-linejoin:round}
@media (max-width:1200px){
  .nav-group-title{display:none}
  .nav-sub-label{display:none}
  .nav-group-toggle{justify-content:center;padding:12px 10px;gap:8px}
  .nav-group-toggle .nav-icon--group{margin:0}
  .nav-sub-item{justify-content:center;padding:12px 10px;margin-left:0}
  .nav-sub-item .nav-icon--sub{margin:0}
  .nav-sub{padding:4px 2px 6px}
}
`,
];
