/**
 * Cross-page marketing styles for non-hub pages (pricing, how-it-works, verticals).
 * Hub/solutions variant eyebrow colors live in html-hub-scoped-css.ts.
 */
export const MARKETING_SHARED_SCOPED_CSS = `
/* ── Hero eyebrow (plain uppercase label — matches marketing-home .hero-eyebrow) ── */
.hero-eyebrow,
.mk-marketing .hero-eyebrow,
.pricing-page .hero-eyebrow,
.hiw-page .hero-eyebrow{
  font-size:var(--mk-eyebrow);
  font-weight:600;
  letter-spacing:var(--mk-eyebrow-ls);
  text-transform:uppercase;
  line-height:1.4;
  margin-bottom:16px;
  border:none;
  background:none;
  padding:0;
  border-radius:0;
  backdrop-filter:none;
  box-shadow:none;
}
.pricing-page .hero-eyebrow{color:var(--mk-brand-purple-dark,#7c3aed)}
.hiw-page .hero-eyebrow{color:var(--mk-brand-purple-dark,#7c3aed)}

/* Section eyebrows — vertical landings (hero uses .hero-eyebrow above) */
.mk-section-eyebrow{
  font-size:var(--mk-eyebrow);
  font-weight:600;
  letter-spacing:var(--mk-eyebrow-ls);
  text-transform:uppercase;
  line-height:1.4;
}

/* Belt-and-suspenders: keep marketing eyebrows uppercase */
.pricing-page .sec-label,
.hiw-page .hiw-label,
.hiw-page .hiw-summary-label,
.mfaq-eyebrow{
  text-transform:uppercase;
  letter-spacing:var(--mk-eyebrow-ls);
}

/* ── Primary demo CTA on pricing / how-it-works (black pill — matches marketing-home) ── */
.pricing-page .btn-demo-live,
.hiw-page .hiw-btn-dark{
  background:#0d0d0d !important;
  color:#fff !important;
  border:none !important;
  box-shadow:0 8px 24px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.1) !important;
  filter:none !important;
}
.pricing-page .btn-demo-live:hover,
.hiw-page .hiw-btn-dark:hover{
  background:#1a1a1a !important;
  box-shadow:0 12px 32px rgba(0,0,0,.22),0 4px 12px rgba(0,0,0,.12) !important;
  filter:none !important;
}

/* ── Hero trial CTA — black text + border (hero only, not bottom CTA bands) ── */
.hiw-page .hiw-hero .hiw-btn-outline,
.pricing-page .pricing-hero-plans .btn-trial-soft,
.pricing-page .hero-copy .btn-trial-soft{
  background:#fff;
  color:#0d0d0d;
  border:1px solid #0d0d0d;
  padding:11px 20px;
  border-radius:var(--mk-radius-pill,999px);
  font-size:var(--mk-btn-sm,14px);
  font-weight:600;
}
.hiw-page .hiw-hero .hiw-btn-outline:hover,
.pricing-page .pricing-hero-plans .btn-trial-soft:hover,
.pricing-page .hero-copy .btn-trial-soft:hover{
  background:#f5f5f5;
  border-color:#0d0d0d;
  color:#0d0d0d;
  transform:translateY(-1px);
}

/* Bottom CTA bands — ghost trial on gradient (pricing) */
.pricing-page .cta-box .btn-trial-soft{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:11px 20px;
  border-radius:var(--mk-radius-pill,999px);
  font-size:var(--mk-btn-sm,14px);
  font-weight:600;
  background:rgba(255,255,255,.14) !important;
  color:#fff !important;
  border:1px solid rgba(255,255,255,.35) !important;
  box-shadow:none !important;
}
.pricing-page .cta-box .btn-trial-soft:hover{
  background:rgba(255,255,255,.22) !important;
  border-color:rgba(255,255,255,.5) !important;
  color:#fff !important;
  transform:translateY(-1px);
}

.pricing-page .sec-label,
.hiw-page .hiw-label{
  color:var(--mk-brand-purple-dark,#7c3aed);
}

/* Vertical landing hero phone — aspect-ratio keeps portrait regardless of JS */
.vertical-hero-visual{
  position:relative;
  align-self:start;
  min-width:0;
  width:100%;
  display:flex;
  flex-direction:column;
  align-items:center;
}
.vertical-hero-visual .cp{
  width:100%;
  display:flex;
  flex-direction:column;
  align-items:center;
}
.vertical-hero-visual .cp-caption{display:none}
.vertical-hero-visual .cp-frame{
  flex:none;
  width:100%;
  max-width:260px;
  height:480px;
  margin:0 auto;
  display:flex;
  flex-direction:column;
}
.vertical-hero-visual .cp-frame.iph-shell{
  min-height:0;
}
.vertical-hero-visual .cp-screen.iph-shell{
  flex:1;
  min-height:0;
  height:100%;
}

/* ── Hero CTAs (marketing-home .hero-btns) — vertical landings ── */
.hero-btns{
  display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:12px;
  flex-wrap:wrap;
}
.hero-btns .btn-hero-live{
  background:#0d0d0d;
  color:#fff;
  padding:15px 32px;
  border-radius:var(--mk-radius-pill,999px);
  font-size:var(--mk-btn-lg,16px);
  font-weight:500;
  text-decoration:none;
  display:inline-flex;
  align-items:center;
  gap:10px;
  box-shadow:0 8px 24px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.1);
  border:none;
  transition:transform .15s,background .2s,box-shadow .2s;
}
.hero-btns .btn-hero-live:hover{
  background:#1a1a1a;
  transform:translateY(-1px);
  box-shadow:0 12px 32px rgba(0,0,0,.22),0 4px 12px rgba(0,0,0,.12);
}
.hero-btns .btn-hero-live svg{width:16px;height:16px;flex-shrink:0}
.hero-btns .btn-hero-live .btn-hero-live-phone{width:18px;height:18px}
.hero-btns .btn-hero-live .btn-hero-live-phone path{fill:#FACC15}
.hero-btns .btn-hero-live .btn-hero-live-arrow{color:#fff}
.hero-btns .btn-outline.btn-hero-trial{
  background:#fff;
  color:#0d0d0d;
  border:1px solid #0d0d0d;
  padding:11px 20px;
  font-size:var(--mk-btn-sm,14px);
  font-weight:600;
  border-radius:var(--mk-radius-pill,999px);
  text-decoration:none;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  transition:border-color .2s,color .2s,background .2s,transform .15s;
}
.hero-btns .btn-outline.btn-hero-trial:hover{
  background:#f5f5f5;
  border-color:#0d0d0d;
  color:#0d0d0d;
  transform:translateY(-1px);
}
@media(max-width:640px){
  .hero-btns{flex-direction:column;align-items:stretch;gap:10px}
  .hero-btns .btn-hero-live,
  .hero-btns .btn-outline.btn-hero-trial{width:100%;justify-content:center}
}

/* Bottom final CTA on vertical landings — demo matches hero; trial ghost on gradient band */
.vertical-final-cta-btns{
  justify-content:center;
  width:100%;
  gap:20px 28px;
  position:relative;
  z-index:1;
}
.vertical-final-cta-btns .btn-outline.btn-hero-trial{
  background:rgba(255,255,255,.14);
  color:#fff;
  border:1px solid rgba(255,255,255,.35);
}
.vertical-final-cta-btns .btn-outline.btn-hero-trial:hover{
  background:rgba(255,255,255,.22);
  border-color:rgba(255,255,255,.5);
  color:#fff;
  transform:translateY(-1px);
}

/* ── Section intros: left-aligned like marketing-home (not hero / FAQ / bottom CTA bands) ── */
.mk-section-head{
  text-align:left;
}
.mk-section-head .mk-section-eyebrow,
.mk-section-head > h2,
.mk-section-head > p{
  text-align:left;
  margin-left:0;
  margin-right:0;
}
.mk-section-head > h2{
  max-width:none;
  text-wrap:balance;
}
.mk-section-head > h2 em{
  font-style:italic;
  font-weight:500;
}
.vertical-landing-page--nail-salon .mk-section-head > h2 em{color:#7c3aed}
.vertical-landing-page--hair-salon .mk-section-head > h2 em{color:#d97706}
.vertical-landing-page--spa .mk-section-head > h2 em{color:#0d9488}
.vertical-landing-page--med-spa .mk-section-head > h2 em{color:#4f46e5}
.vertical-landing-page--beauty-clinic .mk-section-head > h2 em{color:#c026d3}
.mk-section-head > p{
  max-width:min(760px,100%);
}

/* ── FAQ "Common Questions" eyebrow: per-vertical accent color (overrides default purple) ── */
.vertical-landing-page--nail-salon .mfaq-eyebrow{color:#7c3aed}
.vertical-landing-page--hair-salon .mfaq-eyebrow{color:#d97706}
.vertical-landing-page--spa .mfaq-eyebrow{color:#0d9488}
.vertical-landing-page--med-spa .mfaq-eyebrow{color:#4f46e5}
.vertical-landing-page--beauty-clinic .mfaq-eyebrow{color:#c026d3}

.pricing-page .pricing-plans-inner,
.pricing-page .compare-section{
  text-align:left;
}
.pricing-page .pricing-plans-inner .sec-label,
.pricing-page .pricing-plans-inner .sec-title,
.pricing-page .pricing-plans-inner .sec-sub,
.pricing-page .compare-section .sec-label,
.pricing-page .compare-section .sec-title,
.pricing-page .compare-section .sec-sub{
  text-align:left;
  margin-left:0;
  margin-right:0;
}
.pricing-page .pricing-plans-inner .sec-title,
.pricing-page .compare-section .sec-title{
  max-width:none;
}
.pricing-page .sec-title em{
  font-style:italic;
  font-weight:500;
  color:#7c3aed;
}
.pricing-page .pricing-plans-inner .sec-sub,
.pricing-page .compare-section .sec-sub{
  max-width:min(760px,100%);
}
.pricing-page .pricing-plans-inner .pt-toggle{
  margin-left:0;
  margin-right:auto;
}

.hiw-page .hiw-section .hiw-label,
.hiw-page .hiw-section .hiw-title,
.hiw-page .hiw-section .hiw-sub{
  text-align:left;
  margin-left:0;
  margin-right:0;
}
.hiw-page .hiw-section .hiw-title{
  max-width:none;
}
.hiw-page .hiw-section .hiw-title em{
  font-style:italic;
  font-weight:500;
  color:#7c3aed;
}
.hiw-page .hiw-section .hiw-sub{
  max-width:min(760px,100%);
  margin-bottom:42px;
}

/* ── Vertical landing stat strip (unified 3-column row) ── */
.vertical-stat-strip-section .vertical-stat-strip{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  background:#fff;
  border:1px solid rgba(17,24,39,.12);
  border-radius:12px;
  box-shadow:none;
  overflow:hidden;
}
.vertical-stat-strip__col{
  padding:28px 32px;
  border-right:1px solid rgba(17,24,39,.12);
}
.vertical-stat-strip__col--last{
  border-right:none;
}
.vertical-stat-strip__eyebrow{
  margin:0 0 8px;
  font-size:10px;
  font-weight:600;
  letter-spacing:.12em;
  text-transform:uppercase;
  line-height:1.35;
}
.vertical-stat-strip__value{
  margin:0 0 6px;
  font-size:44px;
  font-weight:500;
  line-height:1;
  color:var(--mk-text-strong,#111827);
  font-variant-numeric:tabular-nums;
}
.vertical-stat-strip__desc{
  margin:0 0 12px;
  font-size:14px;
  font-weight:400;
  line-height:1.6;
  color:var(--mk-text-muted,#64748b);
}
.vertical-stat-strip__source{
  margin:0;
  font-size:12px;
  font-style:italic;
  font-weight:400;
  line-height:1.45;
  color:var(--mk-text-soft,#94a3b8);
}
@media (max-width:639px){
  .vertical-stat-strip-section .vertical-stat-strip{
    grid-template-columns:1fr;
  }
  .vertical-stat-strip__col{
    border-right:none;
    border-bottom:1px solid rgba(17,24,39,.12);
  }
  .vertical-stat-strip__col--last{
    border-bottom:none;
  }
}

/* ── Vertical landing pain / "why calls get missed" ── */
.vertical-pain-section .vertical-pain-section__eyebrow{
  margin:0 0 12px;
  font-size:11px;
  font-weight:600;
  letter-spacing:.12em;
  text-transform:uppercase;
  line-height:1.35;
}
.vertical-pain-section__grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:12px;
  margin-top:32px;
}
.vertical-pain-card{
  background:#fef9f9;
  border:1px solid rgba(192,57,43,.14);
  border-radius:12px;
  padding:20px;
  box-shadow:none;
}
.vertical-pain-card__header{
  display:flex;
  align-items:center;
  gap:10px;
  margin-bottom:10px;
}
.vertical-pain-card__icon{
  display:flex;
  align-items:center;
  justify-content:center;
  width:32px;
  height:32px;
  flex-shrink:0;
  border-radius:8px;
  background:#fcebeb;
}
.vertical-pain-card__title{
  margin:0;
  font-size:14px;
  font-weight:500;
  line-height:1.35;
  color:var(--mk-text-strong,#111827);
}
.vertical-pain-card__desc{
  margin:0;
  font-size:13px;
  font-weight:400;
  line-height:1.65;
  color:var(--mk-text-muted,#64748b);
}
@media (max-width:639px){
  .vertical-pain-section__grid{
    grid-template-columns:1fr;
  }
}

`;
