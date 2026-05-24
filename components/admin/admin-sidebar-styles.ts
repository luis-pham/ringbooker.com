/** Grouped admin nav — neutral hierarchy, no purple accents. */
export const adminSidebarAddonStyles: string[] = [
  String.raw`
.sidebar{border-right-color:var(--line)}
.nav-label{color:var(--muted);font-weight:600;letter-spacing:.06em;padding:8px 10px 6px}
.nav-groups{display:flex;flex-direction:column;gap:2px;margin-top:4px}
.nav-group{border:none;background:transparent;border-radius:0}
.nav-group.has-active{background:transparent}
.nav-group-toggle{width:100%;display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--r-sm);border:none;background:transparent;color:var(--muted);font:inherit;font-size:14px;font-weight:500;letter-spacing:-.01em;text-align:left;cursor:pointer;transition:background .15s ease,color .15s ease}
.nav-group-toggle:hover{background:rgba(255,255,255,.04);color:var(--text)}
.nav-group.has-active .nav-group-toggle{color:var(--text);font-weight:600}
.nav-group-title{flex:1;min-width:0}
.nav-group-chevron{display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;border:none;background:transparent;color:var(--muted);flex-shrink:0;transition:transform .2s ease,color .15s ease}
.nav-group-chevron svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.nav-group.open .nav-group-chevron{transform:rotate(90deg);color:var(--text)}
.sidebar .nav-icon.nav-icon--group,
.sidebar .nav-icon.nav-icon--sub{width:auto;min-width:26px;height:auto;min-height:26px;padding:2px;border:none;background:transparent!important;box-shadow:none;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nav-icon--group{color:var(--muted)}
.nav-icon--group svg,.nav-icon--sub svg{width:16px;height:16px;stroke:currentColor;stroke-width:1.75;fill:none;stroke-linecap:round;stroke-linejoin:round}
.nav-icon--sub{color:var(--muted);opacity:.9}
.nav-sub{display:flex;flex-direction:column;gap:1px;padding:2px 0 6px 4px;margin:0}
.nav-sub-item{display:flex;align-items:center;gap:9px;padding:8px 10px 8px 12px;margin-left:4px;border-radius:var(--r-sm);font-size:13px;font-weight:500;letter-spacing:-.01em;color:var(--muted);border:none;background:transparent;transition:background .15s ease,color .15s ease}
.nav-sub-item:hover{background:rgba(255,255,255,.04);color:var(--text)}
.nav-sub-item:hover .nav-icon--sub{color:var(--text);opacity:1}
.nav-sub-item.active{background:var(--accent-soft);color:var(--text);font-weight:600;border:none}
.nav-sub-item.active .nav-icon--sub{color:#93c5fd;opacity:1}
.nav-sub-label{min-width:0;line-height:1.4}
.btn-icon{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;padding:0;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--panel-2);color:var(--text);box-shadow:none;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.btn-icon:hover{background:var(--panel-3);border-color:var(--line-soft)}
.btn-icon.purple{background:var(--accent);border-color:var(--accent);color:#fff}
.btn-icon svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.85;stroke-linecap:round;stroke-linejoin:round}
@media (max-width:1200px){
  .nav-group-title{display:none}
  .nav-sub-label{display:none}
  .nav-group-toggle{justify-content:center;padding:9px 8px;gap:6px}
  .nav-group-toggle .nav-icon--group{margin:0}
  .nav-sub-item{justify-content:center;padding:9px 8px;margin-left:0}
  .nav-sub-item .nav-icon--sub{margin:0}
  .nav-sub{padding:2px 0 4px}
}
`,
];
