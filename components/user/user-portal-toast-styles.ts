/** Toast/snackbar styles for the authenticated user portal. */
export const userPortalToastStyles = String.raw`
.user-portal-toast-host{
  position:fixed;
  inset:auto 0 max(24px, env(safe-area-inset-bottom, 0px)) 0;
  z-index:1200;
  display:flex;
  justify-content:center;
  padding:0 16px;
  pointer-events:none;
}
@media (max-width:860px){
  .user-portal-toast-host{
    bottom:calc(76px + env(safe-area-inset-bottom, 0px));
  }
}
.user-portal-toast{
  pointer-events:auto;
  display:inline-flex;
  align-items:center;
  gap:10px;
  max-width:min(360px, calc(100vw - 32px));
  padding:12px 14px;
  border-radius:12px;
  background:#111827;
  color:#fff;
  font-size:14px;
  font-weight:500;
  line-height:1.35;
  box-shadow:0 12px 32px rgba(15,23,42,.28);
  animation:user-portal-toast-in .22s ease-out;
}
.user-portal-toast--error{
  background:#1f2937;
  border:1px solid rgba(248,113,113,.35);
}
.user-portal-toast__icon{
  width:20px;height:20px;border-radius:999px;
  display:inline-flex;align-items:center;justify-content:center;
  flex-shrink:0;font-size:12px;font-weight:700;line-height:1;
}
.user-portal-toast--success .user-portal-toast__icon{
  background:rgba(16,185,129,.2);color:#6ee7b7;
}
.user-portal-toast--error .user-portal-toast__icon{
  background:rgba(248,113,113,.18);color:#fca5a5;
}
.user-portal-toast__message{flex:1;min-width:0}
.user-portal-toast__dismiss{
  flex-shrink:0;width:28px;height:28px;border:none;border-radius:8px;
  background:transparent;color:rgba(255,255,255,.72);font-size:18px;line-height:1;
  cursor:pointer;padding:0;
}
.user-portal-toast__dismiss:hover{background:rgba(255,255,255,.1);color:#fff}
@keyframes user-portal-toast-in{
  from{opacity:0;transform:translateY(10px)}
  to{opacity:1;transform:translateY(0)}
}
html[data-user-theme="dark"] .user-portal-toast{
  background:#21262d;
  border:1px solid #30363d;
  box-shadow:0 16px 40px rgba(0,0,0,.45);
}
html[data-user-theme="dark"] .user-portal-toast--error{
  border-color:rgba(248,113,113,.4);
}
`;
