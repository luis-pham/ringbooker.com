/** Grouped admin nav: soft hierarchy, no boxed borders; child links lighter than group headers. */
export const adminSidebarAddonStyles: string[] = [
  String.raw`
.sidebar{border-right-color:rgba(255,255,255,.07)}
.nav-label{color:#6b7a95;font-weight:700;letter-spacing:.06em;padding:8px 10px 6px}
.nav-groups{display:flex;flex-direction:column;gap:2px;margin-top:6px}
.nav-group{border:none;background:transparent;border-radius:0}
.nav-group.has-active{background:transparent}
.nav-group-toggle{width:100%;display:flex;align-items:center;gap:10px;padding:10px 8px;border-radius:12px;border:none;background:transparent;color:#e2e8f0;font:inherit;font-size:14px;font-weight:600;letter-spacing:-.01em;text-align:left;cursor:pointer;transition:background .16s ease,color .16s ease}
.nav-group-toggle:hover{background:rgba(255,255,255,.04);color:#f8fafc}
.nav-group.has-active .nav-group-toggle{color:#f1f5f9}
.nav-group-title{flex:1;min-width:0}
.nav-group-chevron{display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:8px;border:none;background:transparent;color:#8b9cb8;flex-shrink:0;transition:transform .2s ease,color .16s ease}
.nav-group-chevron svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.nav-group.open .nav-group-chevron{transform:rotate(90deg);color:#a5b4c8}
.sidebar .nav-icon.nav-icon--group,
.sidebar .nav-icon.nav-icon--sub{width:auto;min-width:28px;height:auto;min-height:28px;padding:2px;border:none;background:transparent!important;box-shadow:none;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nav-icon--group{color:#cbd5e1}
.nav-icon--group svg,.nav-icon--sub svg{width:17px;height:17px;stroke:currentColor;stroke-width:1.75;fill:none;stroke-linecap:round;stroke-linejoin:round}
.nav-icon--sub{color:#94a3b8;opacity:.92}
.nav-sub{display:flex;flex-direction:column;gap:1px;padding:2px 0 6px 4px;margin:0}
.nav-sub-item{display:flex;align-items:center;gap:9px;padding:8px 10px 8px 12px;margin-left:6px;border-radius:10px;font-size:13px;font-weight:500;letter-spacing:-.01em;color:#8b9cb8;border:none;background:transparent;transition:background .16s ease,color .16s ease}
.nav-sub-item:hover{background:rgba(255,255,255,.04);color:#cbd5e1}
.nav-sub-item:hover .nav-icon--sub{color:#94a3b8;opacity:1}
.nav-sub-item.active{background:rgba(124,58,237,.1);color:#f1f5f9;border:none}
.nav-sub-item.active .nav-icon--sub{color:#c4b5fd;opacity:1}
.nav-sub-label{min-width:0;line-height:1.4}
.btn-icon{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border-radius:14px;border:1px solid var(--line);background:linear-gradient(180deg,#11182b,#0c1425);color:var(--text);box-shadow:var(--shadow);cursor:pointer;transition:transform .15s ease,border-color .18s ease,background .18s ease}
.btn-icon:hover{transform:translateY(-1px);border-color:#33466f}
.btn-icon.purple{background:linear-gradient(135deg,var(--purple),var(--purple-2));border-color:transparent;color:#fff}
.btn-icon svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.85;stroke-linecap:round;stroke-linejoin:round}
@media (max-width:1200px){
  .nav-group-title{display:none}
  .nav-sub-label{display:none}
  .nav-group-toggle{justify-content:center;padding:10px 8px;gap:6px}
  .nav-group-toggle .nav-icon--group{margin:0}
  .nav-sub-item{justify-content:center;padding:10px 8px;margin-left:0}
  .nav-sub-item .nav-icon--sub{margin:0}
  .nav-sub{padding:2px 0 4px}
}
`,
];
