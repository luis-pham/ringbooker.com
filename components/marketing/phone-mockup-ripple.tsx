export const PHONE_MOCKUP_RIPPLE_CSS = `
.phone-mockup-ripple-wrap{
  position:relative;
  display:flex;
  align-items:center;
  justify-content:center;
}
.phone-mockup-ripple-wrap .ripple-ring{
  position:absolute;
  top:50%;
  left:50%;
  width:100%;
  height:100%;
  border-radius:50%;
  border:1px solid rgba(255,255,255,.2);
  background:transparent;
  pointer-events:none;
  z-index:0;
  opacity:0;
  animation:ripple 3s ease-out infinite;
}
.phone-mockup-ripple-wrap .ripple-ring--2{animation-delay:1s}
.phone-mockup-ripple-wrap .ripple-ring--3{animation-delay:2s}
.phone-mockup-ripple-wrap .phone-frame,
.phone-mockup-ripple-wrap .cp-frame{
  position:relative;
  z-index:1;
}
@keyframes ripple{
  0%{transform:translate(-50%,-50%) scale(.8);opacity:.6}
  100%{transform:translate(-50%,-50%) scale(1.6);opacity:0}
}
@media (prefers-reduced-motion:reduce){
  .phone-mockup-ripple-wrap .ripple-ring{animation:none}
}
`;

export function PhoneMockupRippleRings() {
  return (
    <>
      <span className="ripple-ring ripple-ring--1" aria-hidden />
      <span className="ripple-ring ripple-ring--2" aria-hidden />
      <span className="ripple-ring ripple-ring--3" aria-hidden />
    </>
  );
}
