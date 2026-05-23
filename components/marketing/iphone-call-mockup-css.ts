/** Shared realistic iPhone call-screen shell (hero + vertical CallPreviewPlayer). */
export const IPHONE_CALL_MOCKUP_CSS = `
.iph-shell{
  --iph-frame:linear-gradient(155deg,#2a2a2a 0%,#0a0a0a 28%,#000 52%,#141414 78%,#050505 100%);
  --iph-bezel:#050505;
}
.iph-shell.phone-frame,
.iph-shell.cp-frame,
.iph-shell.vd-phone-frame{
  background:var(--iph-frame);
  border-radius:44px;
  padding:5px;
  box-shadow:
    0 40px 80px rgba(0,0,0,.38),
    0 12px 28px rgba(0,0,0,.22),
    inset 0 1px 0 rgba(255,255,255,.14),
    inset 0 -1px 0 rgba(0,0,0,.55);
}
.iph-shell.vd-phone-frame{width:min(100%,288px);margin:0 auto}
.iph-shell.phone-screen,
.iph-shell.cp-screen,
.iph-shell.vd-phone-screen{
  border:none;
  border-radius:40px;
  background:var(--iph-bezel);
  overflow:hidden;
  position:relative;
  display:flex;
  flex-direction:column;
}
.iph-shell.cp-screen{min-height:520px}
.iph-shell.vd-phone-screen{min-height:0}
.iph-bg{
  position:absolute;
  inset:0;
  pointer-events:none;
  background:
    radial-gradient(ellipse 95% 75% at 18% 12%,rgba(56,189,198,.42) 0%,transparent 52%),
    radial-gradient(ellipse 85% 65% at 82% 18%,rgba(37,99,235,.38) 0%,transparent 48%),
    radial-gradient(ellipse 120% 80% at 50% 100%,rgba(0,0,0,.85) 0%,transparent 55%),
    linear-gradient(165deg,#0c1a2e 0%,#071018 38%,#000 100%);
}
.iph-bg::after{
  content:"";
  position:absolute;
  inset:0;
  backdrop-filter:blur(28px) saturate(1.35);
  -webkit-backdrop-filter:blur(28px) saturate(1.35);
  background:rgba(0,0,0,.12);
  pointer-events:none;
}
.iph-status{
  position:relative;
  z-index:3;
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:14px 22px 8px;
  min-height:48px;
}
.iph-time{
  font-size:15px;
  font-weight:600;
  color:#fff;
  letter-spacing:-.02em;
  flex:1;
  line-height:1;
}
.iph-island{
  position:absolute;
  left:50%;
  top:10px;
  transform:translateX(-50%);
  width:88px;
  height:26px;
  border-radius:999px;
  background:#000;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);
  z-index:5;
  pointer-events:none;
}
.iph-signals{
  flex:1;
  display:inline-flex;
  align-items:center;
  justify-content:flex-end;
  gap:5px;
  color:#fff;
}
.iph-signal-cell{
  display:flex;
  align-items:flex-end;
  gap:1.5px;
  height:10px;
}
.iph-signal-cell span{
  display:block;
  width:2.5px;
  border-radius:1px;
  background:#fff;
}
.iph-signal-cell span:nth-child(1){height:3px;opacity:.45}
.iph-signal-cell span:nth-child(2){height:5px;opacity:.65}
.iph-signal-cell span:nth-child(3){height:7px;opacity:.85}
.iph-signal-cell span:nth-child(4){height:10px}
.iph-signal-wifi svg,
.iph-signal-batt svg{
  display:block;
  fill:#fff;
}
.iph-signal-batt svg{width:22px;height:11px}
.iph-signal-wifi svg{width:14px;height:11px}
.iph-home-bar{
  position:relative;
  z-index:3;
  width:108px;
  height:4px;
  border-radius:999px;
  background:rgba(255,255,255,.92);
  margin:8px auto 10px;
  flex-shrink:0;
}
.iph-shell .vc-content,
.iph-shell .cp-content,
.iph-shell .vd-phone-body{
  position:relative;
  z-index:2;
  flex:1;
  min-height:0;
}
.iph-shell .vc-label,
.iph-shell .cp-eyebrow{
  font-size:11px;
  font-weight:500;
  color:rgba(255,255,255,.55);
  letter-spacing:.08em;
  text-transform:uppercase;
}
.iph-shell .vc-name,
.iph-shell .cp-business-name{
  font-size:clamp(22px,5vw,28px);
  font-weight:600;
  color:#fff;
  letter-spacing:-.03em;
  text-align:center;
  line-height:1.15;
  margin-bottom:6px;
}
.iph-shell .vc-timer{
  font-size:15px;
  font-weight:400;
  color:rgba(255,255,255,.55);
}
.iph-shell .vc-mini-status{display:none}
.iph-shell .vc-glow,
.iph-shell .cp-glow{
  position:absolute;
  inset:0;
  pointer-events:none;
  background:radial-gradient(circle,rgba(56,189,198,.22) 0%,transparent 68%);
}
.iph-shell .vc-ctrl-mute,
.iph-shell .vc-ctrl-spk,
.iph-shell .cp-control-soft{
  background:rgba(255,255,255,.14);
  border:1px solid rgba(255,255,255,.12);
  backdrop-filter:blur(8px);
  -webkit-backdrop-filter:blur(8px);
}
.iph-shell .vc-ctrl-mute svg,
.iph-shell .vc-ctrl-spk svg,
.iph-shell .cp-control-soft .cp-icon-small{
  fill:rgba(255,255,255,.9);
}
.iph-shell .vc-ctrl-end,
.iph-shell .cp-control-end{
  width:58px;
  height:58px;
  background:#ff3b30;
  box-shadow:0 6px 22px rgba(255,59,48,.45);
}
.iph-shell .cp-control-main{
  background:#34c759;
  box-shadow:0 6px 22px rgba(52,199,89,.4);
}
.iph-shell .cp-dialog-ai{
  background:rgba(255,255,255,.12);
  border:1px solid rgba(255,255,255,.14);
  color:#fff;
}
.iph-shell .cp-dialog-caller{
  background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.1);
  color:rgba(255,255,255,.92);
}
.iph-shell .cp-speaker-ai{color:#86efac;border-color:rgba(134,239,172,.35);background:rgba(16,185,129,.12)}
.iph-shell .cp-speaker-caller{color:#fff}
.iph-shell .cp-speaker-listening,
.iph-shell .cp-speaker-done,
.iph-shell .cp-speaker-paused{color:rgba(255,255,255,.5)}
.iph-shell .cp-live-pill{
  background:rgba(255,255,255,.1);
  border-color:rgba(255,255,255,.18);
  color:#86efac;
}
.iph-shell .cp-live-pill span{background:#34c759}
@media(max-width:960px){
  .iph-shell.phone-frame,
  .iph-shell.cp-frame,
  .iph-shell.vd-phone-frame{border-radius:40px;padding:5px}
  .iph-shell.phone-screen,
  .iph-shell.cp-screen,
  .iph-shell.vd-phone-screen{border-radius:34px}
  .iph-shell.cp-screen{min-height:500px}
  .iph-island{width:76px;height:24px;top:9px}
}
@media(max-width:640px){
  .iph-shell.phone-frame,
  .iph-shell.cp-frame,
  .iph-shell.vd-phone-frame{border-radius:38px;padding:4px}
  .iph-shell.phone-screen,
  .iph-shell.cp-screen,
  .iph-shell.vd-phone-screen{border-radius:32px}
  .iph-shell.cp-screen{min-height:480px}
  .iph-status{padding:12px 18px 6px;min-height:44px}
  .iph-island{width:72px;height:22px;top:8px}
}
`;
