/**
 * Styles from static `html/*.html` hubs, scoped under `.html-hub-page` so marketing chrome
 * nav/footer are unaffected. Font uses project stack (Mona Sans) instead of Plus Jakarta.
 */
export const HTML_HUB_SCOPED_CSS = `
.html-hub-page{
  --purple:var(--mk-brand-purple-dark,#7C3AED);
  --purple-light:var(--mk-brand-purple,#8B5CF6);
  --purple-bg:var(--mk-brand-purple-wash,#F5F3FF);
  --purple-border:#DDD6FE;
  --green:var(--mk-brand-green,#059669);
  --green-bg:#ECFDF5;
  --green-border:#A7F3D0;
  --blue:#2563EB;
  --blue-bg:#EFF6FF;
  --blue-border:#BFDBFE;
  --amber:#D97706;
  --amber-bg:#FFFBEB;
  --red:#DC2626;
  --navy:var(--mk-text-strong,#0F0F1A);
  --gray-800:var(--mk-text-strong,#1F2937);
  --gray-700:var(--mk-text-body,#374151);
  --gray-600:var(--mk-text-muted,#4B5563);
  --gray-400:var(--mk-text-soft,#9CA3AF);
  --gray-100:var(--mk-bg-section,#F9FAFB);
  --border:var(--mk-border-soft,#E8ECF1);
  --white:#FFFFFF;
  --radius:var(--mk-radius-input,16px);
  --radius-lg:var(--mk-radius-card,22px);
  --radius-pill:var(--mk-radius-pill,9999px);
  --shadow:var(--mk-shadow-soft,0 1px 3px rgba(0,0,0,.07),0 4px 16px rgba(0,0,0,.06));
  --shadow-lg:var(--mk-shadow-hover,0 8px 32px rgba(124,58,237,.12));
  font-family:'Mona Sans Variable',ui-sans-serif,system-ui,sans-serif;
  color:var(--navy);
  background:#fff;
  -webkit-font-smoothing:antialiased;
  line-height:1.6;
  min-height:100vh;
  /* Flush under fixed .mk-nav: height 68px + 1px border (extra 76/80px caused a white strip above hero) */
  padding-top:calc(68px + 1px);
}
/* Hairline (~1–2px) between nav and hero: pull first hero up so gradient overlaps padding band (subpixel + border). */
.html-hub-page > .hero:first-child{margin-top:-2px;position:relative;z-index:0}

/* Breadcrumb */
.html-hub-page .breadcrumb{font-size:14px;line-height:1.35;color:var(--mk-text-soft,#94a3b8)}
.html-hub-page .breadcrumb a{color:var(--mk-text-soft,#94a3b8);text-decoration:none;font-weight:400}
.html-hub-page .breadcrumb a:hover{color:var(--purple)}
.html-hub-page .breadcrumb > span{margin:0 6px}
.html-hub-page .breadcrumb > span:last-child{font-size:14px;font-weight:400;color:var(--mk-text-soft,#94a3b8)}
.html-hub-page .hero .breadcrumb{margin:0 0 20px;padding:0;text-align:left;max-width:100%}

/* ── Hero base ── */
.html-hub-page .hero{padding:72px 24px 88px;text-align:center;position:relative;overflow:hidden}
.html-hub-page .hero::before{content:'';position:absolute;inset:0;pointer-events:none}
.html-hub-page .hero-inner{max-width:820px;margin:0 auto;position:relative;z-index:1}
.html-hub-page .pill-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.88);border:1px solid rgba(139,92,246,0.28);border-radius:var(--radius-pill);padding:7px 18px;font-size:var(--mk-eyebrow);font-weight:700;line-height:1.2;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;color:#5B21B6;margin-bottom:22px;backdrop-filter:blur(8px)}
.html-hub-page .hero h1{font-size:var(--mk-hero-title);font-weight:800;line-height:var(--mk-hero-title-lh);letter-spacing:var(--mk-hero-title-track);margin-bottom:20px;color:var(--gray-800)}
.html-hub-page .hero h1 mark{border-radius:12px;padding:2px 14px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.html-hub-page .hero-sub{font-size:var(--mk-hero-lead);color:var(--mk-text-desc,#64748B);max-width:640px;margin:0 auto 36px;line-height:var(--mk-hero-lead-lh);font-weight:400}
.html-hub-page .hero-entity-definition{
  font-size:clamp(15px,1.5vw,16px);
  font-weight:500;
  line-height:1.65;
  color:var(--gray-800);
  max-width:640px;
  margin:-12px auto 28px;
  text-align:center;
}
.html-hub-page .hero-ctas{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.html-hub-page .hero-tags{margin-top:40px;display:flex;justify-content:center;gap:24px;flex-wrap:wrap}
.html-hub-page .hero-tag{font-size:13px;color:var(--gray-600);display:flex;align-items:center;gap:6px}

/* Home-style hero (opt-in: .hero--landing) — matches marketing-home .hero shell */
/* .html-hub-page padding-top matches .mk-nav. Shell adds ~30px from hero top to breadcrumb (blog-like rhythm). */
.html-hub-page .hero.hero--landing{
  min-height:0;
  padding:0;
  display:block;
  position:relative;
  overflow:hidden;
  background:radial-gradient(ellipse 80% 55% at 50% 0%,#EDE9FE 0%,#FDF4FF 45%,#fff 72%);
}
.html-hub-page .hero.hero--landing::before{display:none}
.html-hub-page .hero.hero--landing .hero-blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:.3;pointer-events:none;z-index:0}
.html-hub-page .hero.hero--landing .hero-blob-1{width:560px;height:560px;background:#C4B5FD;top:-200px;left:-140px}
.html-hub-page .hero.hero--landing .hero-blob-2{width:460px;height:460px;background:#F9A8D4;top:-100px;right:-120px}
.html-hub-page .hero-landing-shell{position:relative;z-index:2;width:100%;max-width:var(--mk-container-tight,1100px);margin:0 auto;padding:30px 48px 72px;box-sizing:border-box}
.html-hub-page .hero-landing-shell .breadcrumb{align-self:stretch}
.html-hub-page .hero.hero--landing .hero-inner{position:relative;z-index:2;max-width:820px;width:100%;margin:0 auto}
.html-hub-page .hero.hero--landing h1.hero-h{font-size:var(--mk-hero-title);font-weight:800;line-height:var(--mk-hero-title-home-lh);letter-spacing:var(--mk-hero-title-home-track);color:#111827;margin-bottom:20px;word-break:break-word}
.html-hub-page .hero.hero--landing h1.hero-h .hl{display:inline-block;background:var(--purple);color:#fff;border-radius:var(--radius-pill);padding:0.12em 0.55em;margin:0.08em 0.12em;max-width:100%;box-sizing:border-box;line-height:1.2;vertical-align:baseline}
.html-hub-page .hero.hero--landing .hero-sub{font-size:var(--mk-hero-lead);color:var(--mk-text-desc,#64748B);line-height:var(--mk-hero-lead-lh);max-width:min(640px,100%);margin:0 auto 36px;padding:0 12px;font-weight:400}
.html-hub-page .hero.hero--landing .hero-entity-definition{
  max-width:min(680px,100%);
  margin:-8px auto 28px;
  padding:0 12px;
  text-align:center;
}
.html-hub-page .hero.hero--landing .hero-btns{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin-bottom:0}
.html-hub-page .hero.hero--landing .btn-hero-live{background:linear-gradient(135deg,#5B21B6 0%,#7C3AED 48%,#8B5CF6 100%);color:#fff;padding:15px 32px;border-radius:var(--radius-pill);font-size:var(--mk-btn-lg);font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:10px;box-shadow:0 8px 28px rgba(91,33,182,.22),0 2px 8px rgba(91,33,182,.12);border:none;transition:transform .15s,filter .2s,box-shadow .2s;font-family:inherit;cursor:pointer;box-sizing:border-box}
.html-hub-page .hero.hero--landing .btn-hero-live:hover{filter:brightness(1.04);transform:translateY(-1px);box-shadow:0 12px 36px rgba(91,33,182,.28),0 4px 12px rgba(91,33,182,.14)}
.html-hub-page .hero.hero--landing .btn-hero-live svg{width:16px;height:16px;flex-shrink:0}
.html-hub-page .hero.hero--landing .btn-hero-live .btn-hero-live-phone{width:18px;height:18px}
.html-hub-page .hero.hero--landing .btn-hero-live .btn-hero-live-phone path{fill:#FACC15}
.html-hub-page .hero.hero--landing .btn-hero-live .btn-hero-live-arrow{color:#fff}
.html-hub-page .hero.hero--landing .btn-outline{background:transparent;color:var(--gray-800);padding:13px 26px;border-radius:var(--radius-pill);font-size:var(--mk-btn);font-weight:600;text-decoration:none;border:1px solid var(--border);display:inline-flex;align-items:center;gap:8px;transition:border-color .2s,color .2s,background .2s,transform .15s;font-family:inherit;cursor:pointer;box-sizing:border-box}
.html-hub-page .hero.hero--landing .btn-outline:hover{border-color:rgba(139,92,246,.45);color:#5B21B6;background:rgba(245,243,255,.5)}
/* Secondary hero CTA — same language as marketing-home / current-btn-secondary; tint follows hub variant below */
.html-hub-page .hero.hero--landing .hero-btns .btn-outline.btn-hero-trial{
  background:rgba(255,255,255,.56);
  color:#5b21b6;
  border:1px solid rgba(196,181,253,.55);
  padding:11px 20px;
  font-size:var(--mk-btn-sm);
  font-weight:600;
}
.html-hub-page .hero.hero--landing .hero-btns .btn-outline.btn-hero-trial:hover{
  background:#fff;
  border-color:rgba(196,181,253,.75);
  color:#5b21b6;
  transform:translateY(-1px);
}
@media(max-width:640px){
  .html-hub-page .hero-landing-shell{padding-left:24px;padding-right:24px;padding-top:34px;padding-bottom:64px}
  .html-hub-page .hero-ctas{
    flex-direction:column;
    align-items:stretch;
    gap:10px;
  }
  /* Solutions landing hero: left stack + pill CTAs like industry vertical (flex-wrap, not full-width column) */
  .html-hub-page .hero.hero--landing .hero-inner{
    margin-left:0;
    margin-right:0;
    text-align:left;
  }
  .html-hub-page .hero.hero--landing h1.hero-h{text-align:left}
  .html-hub-page .hero.hero--landing .hero-sub{
    margin-left:0;
    margin-right:0;
    padding-left:0;
    padding-right:0;
    text-align:left;
  }
  .html-hub-page .hero.hero--landing .hero-entity-definition{
    margin-left:0;
    margin-right:0;
    padding-left:0;
    padding-right:0;
    text-align:left;
  }
  .html-hub-page .hero.hero--landing .hero-btns{
    flex-direction:row;
    flex-wrap:wrap;
    align-items:center;
    justify-content:flex-start;
    gap:12px;
  }
  /* Match marketing-vertical DEMO_CTA_BASE / TRIAL_CTA_SECONDARY (14px type, px-7 py-3.5 / px-6 py-3) */
  .html-hub-page .hero.hero--landing .btn-hero-live{
    padding:14px 28px;
    font-size:14px;
    font-weight:700;
    gap:8px;
    width:auto;
    justify-content:center;
  }
  .html-hub-page .hero.hero--landing .hero-btns .btn-outline.btn-hero-trial{
    padding:12px 24px;
    font-size:14px;
    font-weight:600;
    width:auto;
    justify-content:center;
  }
  .html-hub-page .btn,
  .html-hub-page .btn-lg{
    width:100%;
    justify-content:center;
  }
  .html-hub-page .hero.hero--landing .hero-btns .btn,
  .html-hub-page .hero.hero--landing .hero-btns .btn-lg{
    width:auto;
  }
  .html-hub-page .hero-tags{gap:12px 18px;margin-top:28px}
}

/* Landing page width — align with marketing-home content rails (~1100px, 48px gutters) */
.html-hub-page--landing-width .section{padding:var(--mk-space-section-y,88px) 48px}
/* .section-inner max-width for landing: see “Must follow” rule after .section-inner{1200px} */
@media(max-width:640px){
  .html-hub-page--landing-width .section{padding:56px 24px}
}

/* Landing-width: center section badge + title + sub (marketing-home sec-label / sec-title) */
.html-hub-page--landing-width .section .section-inner > .section-label,
.html-hub-page--landing-width .section .section-inner--narrow > .section-label{
  display:flex;
  width:fit-content;
  max-width:100%;
  margin-left:auto;
  margin-right:auto;
}
.html-hub-page--landing-width .section .section-inner > h2,
.html-hub-page--landing-width .section .section-inner--narrow > h2{
  text-align:center;
}
.html-hub-page--landing-width .section .section-inner > .section-sub,
.html-hub-page--landing-width .section .section-inner--narrow > .section-sub{
  text-align:center;
  margin-left:auto;
  margin-right:auto;
}
.html-hub-page--landing-width .hub-prose-section > h2{
  text-align:center;
}

/* Centered stack — eyebrow/h2/sub inside a wrapper (matrix, alt links, dark strip) */
.html-hub-page--landing-width .section .section-inner > .hub-center-stack,
.html-hub-page--landing-width .section .section-inner--narrow > .hub-center-stack{
  display:flex;
  flex-direction:column;
  align-items:center;
  width:100%;
}
.html-hub-page--landing-width .hub-center-stack > .section-label{
  display:flex;
  width:fit-content;
  max-width:100%;
}
.html-hub-page--landing-width .hub-center-stack > h2{
  text-align:center;
  width:100%;
}
.html-hub-page--landing-width .hub-center-stack > .section-sub{
  text-align:center;
  margin-left:auto;
  margin-right:auto;
  max-width:min(720px,100%);
}
.html-hub-page--landing-width .hub-center-stack > .compare-table-wrap,
.html-hub-page--landing-width .hub-center-stack > .alt-link-grid,
.html-hub-page--landing-width .hub-center-stack > .card-grid{
  width:100%;
  align-self:stretch;
}
/* Leak grid — optional “Deep Comparisons” badges above / between card rows */
.html-hub-page--landing-width .section-label.section-label--between-rows{
  margin-top:28px;
  margin-bottom:20px;
}
.html-hub-page .section-inner > .section-sub + .section-label.section-label--between-rows{
  margin-top:20px;
}

/* Alt comparison links (static compare.html .alt-grid / .alt-card) */
.html-hub-page .alt-link-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(300px,1fr));
  gap:16px;
}
/* Compare hub: The Landscape + Deep Comparisons — keep 3 cards per row until narrow phones */
.html-hub-page .alt-link-grid.hub-grid-cols-3{
  grid-template-columns:repeat(3,minmax(0,1fr));
}
@media(max-width:640px){
  .html-hub-page .alt-link-grid.hub-grid-cols-3{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:480px){
  .html-hub-page .alt-link-grid.hub-grid-cols-3{grid-template-columns:1fr}
}
.html-hub-page .alt-link-card{
  background:#fff;
  border:1px solid var(--border);
  border-radius:var(--radius);
  padding:22px 24px;
  text-decoration:none;
  color:var(--navy);
  display:block;
  transition:all .2s;
  box-sizing:border-box;
}
.html-hub-page .alt-link-card:hover{
  border-color:rgba(167,139,250,.55);
  box-shadow:var(--mk-shadow-hover,var(--shadow));
  transform:translateY(-2px);
}
.html-hub-page .alt-link-card h4{
  font-size:15px;
  font-weight:700;
  margin-bottom:8px;
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.html-hub-page .alt-link-card h4 span{
  font-size:12px;
  color:var(--purple);
  font-weight:600;
  flex-shrink:0;
}
.html-hub-page .alt-link-card p{
  font-size:13px;
  color:var(--mk-text-desc,#64748B);
  line-height:1.55;
  font-weight:400;
}
.html-hub-page .section-sub--alt-link-grid{margin-bottom:32px}
/* Deep Comparisons: lock 3 columns on desktop (beats any stray auto-fill from parent context) */
.html-hub-page--landing-width .hub-center-stack .alt-link-grid.hub-grid-cols-3{
  grid-template-columns:repeat(3,minmax(0,1fr));
}

/* Purple (missed booking protection hub default) */
.html-hub-page--purple .hero{background:linear-gradient(160deg,#F5F3FF 0%,#ffffff 50%,#FDF2F8 100%)}
.html-hub-page--purple .hero::before{background:radial-gradient(ellipse 60% 40% at 30% 20%,rgba(124,58,237,.06) 0%,transparent 70%),radial-gradient(ellipse 50% 35% at 75% 70%,rgba(236,72,153,.05) 0%,transparent 70%)}
.html-hub-page--purple .pill-badge{background:rgba(255,255,255,0.88);border:1px solid var(--purple-border);color:var(--purple)}
.html-hub-page--purple .hero h1 mark{background:var(--purple);color:#fff}
.html-hub-page--purple .hero-tag::before{content:'✓';color:var(--green);font-weight:700}

/* Green (current number) */
.html-hub-page--green .hero{background:linear-gradient(160deg,#ECFDF5 0%,#ffffff 55%,#F5F3FF 100%)}
.html-hub-page--green .hero::before{background:radial-gradient(ellipse 55% 40% at 20% 20%,rgba(5,150,105,.06) 0%,transparent 70%),radial-gradient(ellipse 45% 35% at 80% 75%,rgba(124,58,237,.06) 0%,transparent 70%)}
.html-hub-page--green .pill-badge{background:rgba(255,255,255,0.88);border:1px solid var(--green-border);color:var(--green)}
.html-hub-page--green .hero h1 mark{background:var(--green);color:#fff}
.html-hub-page--green .hero-tag::before{content:'✓';color:var(--green);font-weight:700}

/* Teal / emerald — hero/blobs keep spa accents; page shell matches purple hub (white) so section bands read like /missed-booking-protection */
.html-hub-page--teal{
  background:#fff;
}
.html-hub-page--teal .breadcrumb a:hover{color:#0d9488}
.html-hub-page--teal .hero{background:linear-gradient(160deg,#CCFBF1 0%,#ffffff 52%,#F0FDFA 100%)}
.html-hub-page--teal .hero::before{background:radial-gradient(ellipse 55% 42% at 22% 18%,rgba(13,148,136,.10) 0%,transparent 72%),radial-gradient(ellipse 48% 36% at 78% 78%,rgba(52,211,153,.08) 0%,transparent 72%)}
.html-hub-page--teal .pill-badge{background:rgba(255,255,255,0.88);border:1px solid #99F6E4;color:#115e59}
.html-hub-page--teal .hero h1 mark{background:linear-gradient(135deg,#115e59 0%,#0d9488 55%,#14b8a6 100%);color:#fff}
.html-hub-page--teal .hero-tag::before{content:'✓';color:#0d9488;font-weight:700}
/* Landing hero — same shell as marketing-home; wash + blobs + CTAs match /industries spa */
.html-hub-page--teal .hero.hero--landing{
  background:radial-gradient(ellipse 80% 55% at 50% 0%,#CCFBF1 0%,#F0FDFA 46%,#fff 74%);
}
.html-hub-page--teal .hero.hero--landing .hero-blob-1{background:#5EEAD4}
.html-hub-page--teal .hero.hero--landing .hero-blob-2{background:#A7F3D0}
.html-hub-page--teal .hero.hero--landing h1.hero-h .hl{
  background:linear-gradient(135deg,#115e59 0%,#0d9488 50%,#14b8a6 100%);
  color:#fff;
}
.html-hub-page--teal .hero.hero--landing .btn-hero-live{
  background:linear-gradient(135deg,#115e59 0%,#0d9488 48%,#14b8a6 100%);
  box-shadow:0 8px 28px rgba(13,148,136,.32);
}
.html-hub-page--teal .hero.hero--landing .btn-hero-live:hover{
  box-shadow:0 12px 36px rgba(13,148,136,.38);
}
.html-hub-page--teal .hero.hero--landing .btn-outline:hover{border-color:#0d9488;color:#0f7669}
.html-hub-page--teal .hero.hero--landing .hero-btns .btn-outline.btn-hero-trial{
  color:#115e59;
  border-color:rgba(94,234,212,.65);
}
.html-hub-page--teal .hero.hero--landing .hero-btns .btn-outline.btn-hero-trial:hover{
  background:#fff;
  border-color:rgba(13,148,136,.75);
  color:#0f7669;
}
.html-hub-page--teal .section-label:not(.dark){
  color:#115e59;
}
.html-hub-page--teal .section-label.green{color:#047857}
.html-hub-page--teal .card-accent{border-top-color:#0d9488}
.html-hub-page--teal .stat-num{color:#0d9488}
.html-hub-page--teal .scenario-icon{background:transparent}
.html-hub-page--teal .scenario .who{color:#0f7669}
.html-hub-page--teal .flow-arrow{color:#0d9488}
.html-hub-page--teal .leak-card h3{color:#134e4a}
.html-hub-page--teal .industry-card:hover{border-color:#5EEAD4}
.html-hub-page--teal .industry-card .arrow{color:#0d9488}
.html-hub-page--teal .hub-cta-banner{
  background:linear-gradient(125deg,#115e59 0%,#0d9488 52%,#14b8a6 100%);
}
.html-hub-page--teal .hub-cta-btn-white{color:#134e4a}
.html-hub-page--teal .hub-cta-btn-white .hub-cta-btn-white-arrow{color:#134e4a}

/* Hair salon — warm amber / orange (matches industry landing hair-salon theme) */
.html-hub-page--hair{
  background:radial-gradient(ellipse 76% 54% at 50% 0%,#ffedd5 0%,#fffbeb 38%,#ffffff 68%);
}
.html-hub-page--hair .breadcrumb a:hover{color:#d97706}
.html-hub-page--hair .hero{background:linear-gradient(160deg,#FFFBEB 0%,#ffffff 52%,#FFF7ED 100%)}
.html-hub-page--hair .hero::before{background:radial-gradient(ellipse 55% 42% at 24% 18%,rgba(217,119,6,.10) 0%,transparent 72%),radial-gradient(ellipse 48% 36% at 76% 76%,rgba(251,146,60,.09) 0%,transparent 72%)}
.html-hub-page--hair .pill-badge{background:rgba(255,255,255,0.88);border:1px solid #FDE68A;color:#b45309}
.html-hub-page--hair .hero h1 mark{background:linear-gradient(135deg,#92400e 0%,#d97706 50%,#f59e0b 100%);color:#fff}
.html-hub-page--hair .hero-tag::before{content:'✓';color:#d97706;font-weight:700}
.html-hub-page--hair .hero.hero--landing{
  background:radial-gradient(ellipse 80% 55% at 50% 0%,#ffedd5 0%,#fffbeb 44%,#ffffff 70%);
}
.html-hub-page--hair .hero.hero--landing .hero-blob-1{background:#FCD34D}
.html-hub-page--hair .hero.hero--landing .hero-blob-2{background:#FDBA74}
.html-hub-page--hair .hero.hero--landing h1.hero-h .hl{
  background:linear-gradient(135deg,#92400e 0%,#d97706 48%,#f59e0b 100%);
  color:#fff;
}
.html-hub-page--hair .hero.hero--landing .btn-hero-live{
  background:linear-gradient(135deg,#92400e 0%,#d97706 48%,#f59e0b 100%);
  box-shadow:0 8px 28px rgba(180,83,9,.35);
}
.html-hub-page--hair .hero.hero--landing .btn-hero-live:hover{
  box-shadow:0 12px 36px rgba(180,83,9,.42);
}
.html-hub-page--hair .hero.hero--landing .btn-outline:hover{border-color:#d97706;color:#b45309}
.html-hub-page--hair .hero.hero--landing .hero-btns .btn-outline.btn-hero-trial{
  color:#92400e;
  border-color:rgba(251,191,36,.65);
}
.html-hub-page--hair .hero.hero--landing .hero-btns .btn-outline.btn-hero-trial:hover{
  background:#fff;
  border-color:rgba(217,119,6,.75);
  color:#b45309;
}
.html-hub-page--hair .section-label:not(.dark){
  color:#b45309;
}
.html-hub-page--hair .section-label.green{color:#047857}
.html-hub-page--hair .card-accent{border-top-color:#d97706}
.html-hub-page--hair .stat-num{color:#d97706}
.html-hub-page--hair .scenario-icon{background:transparent}
.html-hub-page--hair .scenario .who{color:#b45309}
.html-hub-page--hair .flow-arrow{color:#d97706}
.html-hub-page--hair .leak-card h3{color:#78350f}
.html-hub-page--hair .industry-card:hover{border-color:#FCD34D}
.html-hub-page--hair .industry-card .arrow{color:#d97706}
.html-hub-page--hair .hub-cta-banner{
  background:linear-gradient(125deg,#9a3412 0%,#d97706 48%,#f59e0b 100%);
}
.html-hub-page--hair .hub-cta-btn-white{color:#451a03}
.html-hub-page--hair .hub-cta-btn-white .hub-cta-btn-white-arrow{color:#451a03}

/* Med spa (works-with) — soft wash into white (like teal/purple hubs); sections carry accent bands */
.html-hub-page--med-spa{
  background:#fff;
}
.html-hub-page--med-spa .breadcrumb a:hover{color:#4f46e5}
.html-hub-page--med-spa .hero{background:linear-gradient(160deg,#F5F7FF 0%,#ffffff 58%,#F8FAFC 100%)}
.html-hub-page--med-spa .hero::before{background:radial-gradient(ellipse 55% 42% at 24% 18%,rgba(79,70,229,.06) 0%,transparent 72%),radial-gradient(ellipse 48% 36% at 76% 76%,rgba(99,102,241,.05) 0%,transparent 72%)}
.html-hub-page--med-spa .pill-badge{background:rgba(255,255,255,0.88);border:1px solid #C7D2FE;color:#4338ca}
.html-hub-page--med-spa .hero h1 mark{background:linear-gradient(135deg,#312e81 0%,#4f46e5 50%,#6366f1 100%);color:#fff}
.html-hub-page--med-spa .hero-tag::before{content:'✓';color:#4f46e5;font-weight:700}
.html-hub-page--med-spa .hero.hero--landing{
  background:radial-gradient(ellipse 85% 58% at 50% 0%,#eef2ff 0%,#f8fafc 52%,#ffffff 92%);
}
.html-hub-page--med-spa .hero.hero--landing .hero-blob-1{background:#DDD6FE}
.html-hub-page--med-spa .hero.hero--landing .hero-blob-2{background:#E0E7FF}
.html-hub-page--med-spa .hero.hero--landing h1.hero-h .hl{
  background:linear-gradient(135deg,#312e81 0%,#4f46e5 48%,#6366f1 100%);
  color:#fff;
}
.html-hub-page--med-spa .hero.hero--landing .btn-hero-live{
  background:linear-gradient(135deg,#312e81 0%,#4f46e5 48%,#6366f1 100%);
  box-shadow:0 8px 28px rgba(67,56,202,.38);
}
.html-hub-page--med-spa .hero.hero--landing .btn-hero-live:hover{
  box-shadow:0 12px 36px rgba(67,56,202,.45);
}
.html-hub-page--med-spa .hero.hero--landing .btn-outline:hover{border-color:#4f46e5;color:#4338ca}
.html-hub-page--med-spa .hero.hero--landing .hero-btns .btn-outline.btn-hero-trial{
  color:#3730a3;
  border-color:rgba(165,180,252,.75);
}
.html-hub-page--med-spa .hero.hero--landing .hero-btns .btn-outline.btn-hero-trial:hover{
  background:#fff;
  border-color:rgba(79,70,229,.75);
  color:#4338ca;
}
.html-hub-page--med-spa .section-label:not(.dark){
  color:#4338ca;
}
/* Works-with: keep eyebrow color consistent with page accent (no per-variant color switching). */
.html-hub-page--med-spa .section-label.green,
.html-hub-page--med-spa .section-label.purple,
.html-hub-page--med-spa .section-label.blue,
.html-hub-page--med-spa .section-label.amber{
  color:#4338ca;
}
.html-hub-page--med-spa .card-accent{border-top-color:#4f46e5}
.html-hub-page--med-spa .stat-num{color:#4f46e5}
.html-hub-page--med-spa .scenario-icon{background:transparent}
.html-hub-page--med-spa .scenario .who{color:#4338ca}
.html-hub-page--med-spa .flow-arrow{color:#4f46e5}
.html-hub-page--med-spa .leak-card h3{color:#312e81}
.html-hub-page--med-spa .industry-card:hover{border-color:#A5B4FC}
.html-hub-page--med-spa .industry-card .arrow{color:#4f46e5}
.html-hub-page--med-spa .hub-cta-banner{
  background:linear-gradient(125deg,#312e81 0%,#4f46e5 52%,#818cf8 100%);
}
.html-hub-page--med-spa .hub-cta-btn-white{color:#1e1b4b}
.html-hub-page--med-spa .hub-cta-btn-white .hub-cta-btn-white-arrow{color:#1e1b4b}

/* Beauty clinic — fuchsia / pink (matches industry landing beauty-clinic theme) */
.html-hub-page--beauty-clinic{
  background:#fff;
}
.html-hub-page--beauty-clinic .breadcrumb a:hover{color:#c026d3}
.html-hub-page--beauty-clinic .hero{background:linear-gradient(160deg,#FDF4FF 0%,#ffffff 58%,#FAF5FF 100%)}
.html-hub-page--beauty-clinic .hero::before{background:radial-gradient(ellipse 55% 42% at 22% 18%,rgba(192,38,211,.07) 0%,transparent 72%),radial-gradient(ellipse 48% 36% at 78% 76%,rgba(236,72,153,.06) 0%,transparent 72%)}
.html-hub-page--beauty-clinic .pill-badge{background:rgba(255,255,255,0.88);border:1px solid #F5D0FE;color:#a21caf}
.html-hub-page--beauty-clinic .hero h1 mark{background:linear-gradient(135deg,#86198f 0%,#c026d3 50%,#ec4899 100%);color:#fff}
.html-hub-page--beauty-clinic .hero-tag::before{content:'✓';color:#c026d3;font-weight:700}
.html-hub-page--beauty-clinic .hero.hero--landing{
  background:radial-gradient(ellipse 85% 58% at 50% 0%,#fae8ff 0%,#fdf4ff 52%,#ffffff 92%);
}
.html-hub-page--beauty-clinic .hero.hero--landing .hero-blob-1{background:#f0abfc}
.html-hub-page--beauty-clinic .hero.hero--landing .hero-blob-2{background:#f9a8d4}
.html-hub-page--beauty-clinic .hero.hero--landing h1.hero-h .hl{
  background:linear-gradient(135deg,#701a75 0%,#c026d3 48%,#ec4899 100%);
  color:#fff;
}
.html-hub-page--beauty-clinic .hero.hero--landing .btn-hero-live{
  background:linear-gradient(135deg,#701a75 0%,#c026d3 48%,#ec4899 100%);
  box-shadow:0 8px 28px rgba(192,38,211,.35);
}
.html-hub-page--beauty-clinic .hero.hero--landing .btn-hero-live:hover{
  box-shadow:0 12px 36px rgba(192,38,211,.42);
}
.html-hub-page--beauty-clinic .hero.hero--landing .btn-outline:hover{border-color:#c026d3;color:#a21caf}
.html-hub-page--beauty-clinic .hero.hero--landing .hero-btns .btn-outline.btn-hero-trial{
  color:#86198f;
  border-color:rgba(240,171,252,.65);
}
.html-hub-page--beauty-clinic .hero.hero--landing .hero-btns .btn-outline.btn-hero-trial:hover{
  background:#fff;
  border-color:rgba(192,38,211,.75);
  color:#a21caf;
}
.html-hub-page--beauty-clinic .section-label:not(.dark){
  color:#a21caf;
}
.html-hub-page--beauty-clinic .section-label.green,
.html-hub-page--beauty-clinic .section-label.purple,
.html-hub-page--beauty-clinic .section-label.blue,
.html-hub-page--beauty-clinic .section-label.amber{
  color:#a21caf;
}
.html-hub-page--beauty-clinic .card-accent{border-top-color:#c026d3}
.html-hub-page--beauty-clinic .stat-num{color:#c026d3}
.html-hub-page--beauty-clinic .scenario-icon{background:transparent}
.html-hub-page--beauty-clinic .scenario .who{color:#86198f}
.html-hub-page--beauty-clinic .flow-arrow{color:#c026d3}
.html-hub-page--beauty-clinic .leak-card h3{color:#86198f}
.html-hub-page--beauty-clinic .industry-card:hover{border-color:#f0abfc}
.html-hub-page--beauty-clinic .industry-card .arrow{color:#c026d3}
.html-hub-page--beauty-clinic .hub-cta-banner{
  background:linear-gradient(125deg,#86198f 0%,#c026d3 50%,#e879f9 100%);
}
.html-hub-page--beauty-clinic .hub-cta-btn-white{color:#4a044e}
.html-hub-page--beauty-clinic .hub-cta-btn-white .hub-cta-btn-white-arrow{color:#4a044e}

/* Blue (legacy hub) */
.html-hub-page--blue .hero{background:linear-gradient(160deg,#EFF6FF 0%,#ffffff 55%,#F5F3FF 100%)}
.html-hub-page--blue .hero::before{background:radial-gradient(ellipse 55% 40% at 25% 20%,rgba(37,99,235,.06) 0%,transparent 70%),radial-gradient(ellipse 45% 35% at 75% 75%,rgba(124,58,237,.06) 0%,transparent 70%)}
.html-hub-page--blue .pill-badge{background:rgba(255,255,255,0.88);border:1px solid var(--blue-border);color:var(--blue)}
.html-hub-page--blue .hero h1 mark{background:var(--purple);color:#fff}
.html-hub-page--blue .hero-tag::before{content:'✓';color:var(--purple);font-weight:700}

/* Amber (compare) — white shell, soft landing hero, amber CTA band */
.html-hub-page--amber{
  background:#fff;
}
.html-hub-page--amber .breadcrumb a:hover{color:#d97706}
.html-hub-page--amber .hero{background:linear-gradient(160deg,#FFFBEB 0%,#ffffff 58%,#F8FAFC 100%)}
.html-hub-page--amber .hero::before{background:radial-gradient(ellipse 55% 40% at 25% 20%,rgba(217,119,6,.06) 0%,transparent 70%),radial-gradient(ellipse 45% 35% at 80% 75%,rgba(124,58,237,.05) 0%,transparent 70%)}
.html-hub-page--amber .pill-badge{background:rgba(255,255,255,0.88);border:1px solid #FDE68A;color:var(--amber)}
.html-hub-page--amber .hero h1 mark{background:var(--purple);color:#fff}
.html-hub-page--amber .hero-tag::before{content:'✓';color:#d97706;font-weight:700}
.html-hub-page--amber .hero.hero--landing{
  background:radial-gradient(ellipse 85% 58% at 50% 0%,#fffbeb 0%,#f8fafc 52%,#ffffff 92%);
}
.html-hub-page--amber .hero.hero--landing .hero-blob-1{background:#FDE68A}
.html-hub-page--amber .hero.hero--landing .hero-blob-2{background:#FCD34D}
.html-hub-page--amber .hero.hero--landing h1.hero-h .hl{
  background:linear-gradient(135deg,#92400e 0%,#d97706 48%,#f59e0b 100%);
  color:#fff;
}
.html-hub-page--amber .hero.hero--landing .btn-hero-live{
  background:linear-gradient(135deg,#92400e 0%,#d97706 48%,#f59e0b 100%);
  box-shadow:0 8px 28px rgba(180,83,9,.35);
}
.html-hub-page--amber .hero.hero--landing .btn-hero-live:hover{
  box-shadow:0 12px 36px rgba(180,83,9,.42);
}
.html-hub-page--amber .hero.hero--landing .btn-outline:hover{border-color:#d97706;color:#b45309}
.html-hub-page--amber .hero.hero--landing .hero-btns .btn-outline.btn-hero-trial{
  color:#92400e;
  border-color:rgba(251,191,36,.65);
}
.html-hub-page--amber .hero.hero--landing .hero-btns .btn-outline.btn-hero-trial:hover{
  background:#fff;
  border-color:rgba(217,119,6,.75);
  color:#b45309;
}
.html-hub-page--amber .section-label:not(.dark){
  color:#b45309;
}
.html-hub-page--amber .hub-cta-banner{
  background:linear-gradient(125deg,#9a3412 0%,#d97706 48%,#f59e0b 100%);
}
.html-hub-page--amber .hub-cta-btn-white{color:#451a03}
.html-hub-page--amber .hub-cta-btn-white .hub-cta-btn-white-arrow{color:#451a03}

/* Trust — light landing + purple accents (same rhythm as missed-booking-protection) */
.html-hub-page--trust{
  background:#fff;
}
.html-hub-page--trust .breadcrumb a:hover{color:var(--purple)}
.html-hub-page--trust .hero{background:linear-gradient(160deg,#F5F3FF 0%,#ffffff 58%,#F8FAFC 100%)}
.html-hub-page--trust .hero::before{background:radial-gradient(ellipse 55% 40% at 25% 20%,rgba(124,58,237,.06) 0%,transparent 70%),radial-gradient(ellipse 45% 35% at 78% 72%,rgba(236,72,153,.05) 0%,transparent 70%)}
.html-hub-page--trust .pill-badge{background:rgba(255,255,255,0.88);border:1px solid var(--purple-border);color:var(--purple)}
.html-hub-page--trust .hero h1 mark{background:var(--purple);color:#fff}
.html-hub-page--trust .hero-tag::before{content:'✓';color:var(--green);font-weight:700}
.html-hub-page--trust .hero.hero--landing{
  background:radial-gradient(ellipse 85% 58% at 50% 0%,#ede9fe 0%,#f8fafc 52%,#ffffff 92%);
}
.html-hub-page--trust .hero.hero--landing .hero-blob-1{background:#DDD6FE}
.html-hub-page--trust .hero.hero--landing .hero-blob-2{background:#F9A8D4}
.html-hub-page--trust .hero.hero--landing h1.hero-h .hl{
  display:inline;
  background:none;
  color:var(--purple);
  border-radius:0;
  padding:0;
  margin:0;
  box-shadow:none;
  vertical-align:baseline;
  line-height:inherit;
  font-weight:inherit;
}
.html-hub-page--trust .hero.hero--landing .btn-hero-live{
  background:linear-gradient(135deg,#5B21B6 0%,#7C3AED 48%,#8B5CF6 100%);
  box-shadow:0 8px 28px rgba(91,33,182,.32);
}
.html-hub-page--trust .hero.hero--landing .btn-hero-live:hover{
  box-shadow:0 12px 36px rgba(91,33,182,.38);
}
.html-hub-page--trust .hero.hero--landing .btn-outline:hover{border-color:var(--purple);color:var(--purple)}
.html-hub-page--trust .hero.hero--landing .hero-btns .btn-outline.btn-hero-trial{
  color:#5b21b6;
  border-color:rgba(196,181,253,.55);
}
.html-hub-page--trust .hero.hero--landing .hero-btns .btn-outline.btn-hero-trial:hover{
  background:#fff;
  border-color:rgba(139,92,246,.65);
  color:var(--purple);
}
/* Must beat .html-hub-page .section-label.green|blue|amber below (same specificity, source order). */
.html-hub-page.html-hub-page--trust .section-label:not(.dark){
  color:var(--purple);
}
.html-hub-page.html-hub-page--trust .section-label.green,
.html-hub-page.html-hub-page--trust .section-label.purple,
.html-hub-page.html-hub-page--trust .section-label.blue,
.html-hub-page.html-hub-page--trust .section-label.amber{
  color:var(--purple);
}

/* Buttons (hub body + hero) */
.html-hub-page .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:var(--radius-pill);font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;transition:all .2s;border:1.5px solid transparent;box-sizing:border-box;font-family:inherit}
.html-hub-page .btn-purple{background:var(--purple);color:#fff;box-shadow:0 2px 12px rgba(124,58,237,.25)}
.html-hub-page .btn-purple:hover{background:#6D28D9}
.html-hub-page .btn-outline{color:var(--navy);border-color:var(--navy);background:transparent}
.html-hub-page .btn-outline:hover{background:var(--navy);color:#fff}
.html-hub-page .btn-lg{padding:14px 28px;font-size:15px}

/* Sections */
.html-hub-page .section{padding:88px 24px}
.html-hub-page .section-inner{max-width:1200px;margin:0 auto}
/* Must follow the rule above: landing hubs use 1100px rails (otherwise auto-fill card grids hit 4 cols). */
.html-hub-page.html-hub-page--landing-width .section-inner{max-width:1100px}
.html-hub-page .section-inner--narrow{max-width:760px}
.html-hub-page .section-alt{background:var(--gray-100)}
.html-hub-page .section-dark{background:var(--navy);color:#fff}
.html-hub-page .section-purple-soft{background:var(--purple-bg)}
.html-hub-page .section-green-soft{background:var(--green-bg)}
.html-hub-page .section-blue-soft{background:var(--blue-bg)}
/* Marketing-home leak-section (Missed-Call Recovery) — paired with .leak-grid / .leak-card */
.html-hub-page .section-leak{background:linear-gradient(180deg,#fff,#F9FAFB)}

.html-hub-page .section-label{display:inline-flex;align-items:center;gap:6px;padding:0;background:transparent;border:none;border-radius:0;font-size:var(--mk-eyebrow);font-weight:600;color:#5B21B6;text-transform:uppercase;letter-spacing:var(--mk-eyebrow-ls);margin-bottom:14px}
.html-hub-page .section-label.green{color:var(--green)}
.html-hub-page .section-label.purple{color:var(--purple)}
.html-hub-page .section-label.blue{color:var(--blue)}
.html-hub-page .section-label.amber{color:var(--amber)}
.html-hub-page .section-label.dark{color:rgba(255,255,255,.8)}

.html-hub-page .section h2{font-size:var(--mk-section-h2);font-weight:700;line-height:var(--mk-section-h2-lh);letter-spacing:var(--mk-section-h2-track);margin:0 auto 14px;color:#111827;max-width:22ch;text-wrap:balance}
.html-hub-page .section h3{font-size:17px;font-weight:600;margin-bottom:8px;color:#111827}
.html-hub-page .section-sub{font-size:var(--mk-section-lead);color:var(--mk-text-desc,#64748B);max-width:min(720px,100%);line-height:var(--mk-section-lead-lh);margin-bottom:40px;font-weight:400}
/* Visible entity definition (same rhythm as .section-sub; slightly stronger for extraction / scan) */
.html-hub-page .hub-entity-definition{color:var(--gray-800);font-weight:500;margin-bottom:20px}
.html-hub-page .section-dark h2{color:#fff}
.html-hub-page .section-dark .section-sub{color:rgba(255,255,255,.65)}

/* Cards */
.html-hub-page .card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}
/* compare_strip: exactly four cards in one row (missed-booking-protection “Gap” section) */
.html-hub-page .hub-center-stack .card-grid.card-grid--cols-4{
  grid-template-columns:repeat(4,minmax(0,1fr));
  max-width:1100px;
  width:100%;
}
@media(max-width:1100px){
  .html-hub-page .hub-center-stack .card-grid.card-grid--cols-4{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
}
@media(max-width:560px){
  .html-hub-page .hub-center-stack .card-grid.card-grid--cols-4{
    grid-template-columns:1fr;
  }
}
.html-hub-page .card{background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);padding:26px 24px;transition:box-shadow .2s,transform .2s,border-color .2s;box-shadow:var(--mk-shadow-soft,none)}
.html-hub-page .card:hover{box-shadow:var(--mk-shadow-hover,var(--shadow));transform:translateY(-2px);border-color:rgba(196,181,253,.55)}
.html-hub-page .card-icon{font-size:28px;margin-bottom:14px}
.html-hub-page .card h3{font-size:var(--mk-card-title);font-weight:600;margin-bottom:8px;color:#111827;line-height:1.35}
.html-hub-page .card p{font-size:14px;color:var(--mk-text-desc,#64748B);line-height:var(--mk-body-lh,1.68);font-weight:400}
.html-hub-page .leak-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.html-hub-page .leak-grid--cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}
@media(max-width:1100px){
  .html-hub-page .leak-grid--cols-4{grid-template-columns:repeat(2,minmax(0,1fr))}
}
/* After .leak-grid--cols-4 so compare “3 per row” wins if both classes ever appear */
.html-hub-page .leak-grid.hub-grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
@media(max-width:640px){
  .html-hub-page .leak-grid.hub-grid-cols-3{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:480px){
  .html-hub-page .leak-grid.hub-grid-cols-3{grid-template-columns:1fr}
}
/* Lighter leak / stat cards — homepage-aligned */
.html-hub-page .leak-card{background:#fff;border:1px solid var(--border);border-radius:22px;padding:22px 20px;box-shadow:var(--mk-shadow-soft,0 10px 28px rgba(124,58,237,.06));transition:transform .2s,box-shadow .2s,border-color .2s}
.html-hub-page .leak-card:hover{transform:translateY(-2px);box-shadow:var(--mk-shadow-hover,0 16px 36px rgba(124,58,237,.10));border-color:rgba(196,181,253,.55)}
.html-hub-page .leak-icon{font-size:26px;margin-bottom:10px;text-align:center}
.html-hub-page .leak-card h3{font-size:16px;font-weight:600;line-height:1.35;margin-bottom:8px;letter-spacing:-.25px;text-align:center;color:#111827}
.html-hub-page .leak-card-stat{font-size:13px;font-weight:700;line-height:1.5;text-align:center;color:#1f2937;margin:0 0 10px;padding:0 2px}
.html-hub-page .leak-card p{font-size:14px;color:var(--mk-text-desc,#64748B);line-height:1.68;font-weight:400;text-align:center;margin-left:auto;margin-right:auto}
.html-hub-page .card-stat{font-size:13px;font-weight:700;line-height:1.5;color:#1f2937;margin:0 0 10px}

.html-hub-page .card-accent{border-top:3px solid var(--purple)}
.html-hub-page .card-green{border-top:3px solid var(--green)}
.html-hub-page .card-purple{border-top:3px solid var(--purple)}
.html-hub-page--green .card-accent{border-top-color:var(--green)}

.html-hub-page .section-dark .card{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1)}
.html-hub-page .section-dark .card h3{color:#fff;text-align:center}
.html-hub-page .section-dark .card p{color:rgba(255,255,255,.65)}
.html-hub-page .section-dark .card-icon{
  opacity:.95;
  display:flex;
  justify-content:center;
  align-items:center;
  text-align:center;
  width:100%;
}

/* Scenario */
.html-hub-page .scenario-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.html-hub-page .scenario-grid--2x2{grid-template-columns:repeat(2,minmax(0,1fr));max-width:1100px;margin-left:auto;margin-right:auto;gap:16px}
@media(max-width:700px){
  .html-hub-page .scenario-grid--2x2{grid-template-columns:1fr}
}
.html-hub-page .scenario{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:24px 26px;display:grid;grid-template-columns:44px 1fr;gap:16px;align-items:start;transition:box-shadow .2s}
.html-hub-page .scenario:hover{box-shadow:var(--shadow)}
.html-hub-page .scenario-icon{width:44px;height:44px;border-radius:0;background:transparent;border:none;box-shadow:none;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.html-hub-page .scenario h3{font-size:15px;font-weight:700;margin-bottom:4px;color:var(--navy)}
.html-hub-page .scenario-stat{font-size:12px;font-weight:700;line-height:1.45;color:#1f2937;margin:0 0 8px}
.html-hub-page .scenario p{font-size:13px;color:var(--gray-600);line-height:1.5}
.html-hub-page .scenario .who{font-size:12px;color:var(--purple);font-weight:600;margin-top:6px}
.html-hub-page .section-purple-soft .scenario{background:#fff}
.html-hub-page .scenario p a{color:var(--purple);font-weight:600;text-decoration:none}
.html-hub-page .scenario p a:hover{text-decoration:underline}

/* Intent + stats */
.html-hub-page .intent-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.html-hub-page .intent-item{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;display:flex;align-items:center;gap:10px;font-size:14px;font-weight:600;color:var(--gray-800)}
.html-hub-page .intent-item span{font-size:18px}
.html-hub-page--landing-width .intent-grid{grid-template-columns:repeat(4,minmax(0,1fr));max-width:1100px;margin-left:auto;margin-right:auto}
@media(max-width:960px){
  .html-hub-page--landing-width .intent-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:520px){
  .html-hub-page--landing-width .intent-grid{grid-template-columns:1fr}
}
.html-hub-page .stat-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:24px;margin-top:48px}
.html-hub-page .stat{text-align:center}
.html-hub-page .stat-num{font-size:40px;font-weight:800;color:var(--purple);letter-spacing:-1px}
.html-hub-page .stat-label{font-size:13px;color:var(--gray-600);margin-top:4px}

/* Flow */
.html-hub-page .flow-visual{background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);padding:40px 24px;display:flex;align-items:center;justify-content:center;gap:0;flex-wrap:wrap;margin-bottom:48px;overflow:hidden}
.html-hub-page .flow-step{text-align:center;padding:20px 16px;flex:1;min-width:140px}
.html-hub-page .flow-step .icon{font-size:32px;margin-bottom:10px;line-height:1;display:flex;align-items:center;justify-content:center;min-height:40px}
.html-hub-page .flow-step .icon img.flow-step-logo-img{width:40px;height:40px;object-fit:contain;display:block}
.html-hub-page .flow-step .label{font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px}
.html-hub-page .flow-step .sub{font-size:12px;color:var(--gray-600)}
.html-hub-page .flow-arrow{font-size:24px;color:var(--purple);padding:0 8px;align-self:center;flex-shrink:0}
.html-hub-page .flow-badge{display:inline-block;padding:4px 12px;border-radius:var(--radius-pill);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-top:8px}
.html-hub-page .badge-green{background:var(--green-bg);color:var(--green)}
.html-hub-page .badge-purple{background:var(--purple-bg);color:var(--purple)}

/* Objections */
.html-hub-page .objection-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.html-hub-page .objection{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:24px 26px}
.html-hub-page .objection .q{font-size:15px;font-weight:700;color:var(--navy);margin-bottom:10px;display:flex;gap:10px}
.html-hub-page .objection .q::before{content:'💬';flex-shrink:0}
.html-hub-page .objection .a{font-size:13px;color:var(--gray-600);line-height:1.6}

/* Use cases */
.html-hub-page .use-case-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.html-hub-page .use-case{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:20px 22px;display:flex;align-items:flex-start;gap:14px}
.html-hub-page .use-case .uc-icon{font-size:22px;flex-shrink:0;margin-top:2px}
.html-hub-page .use-case h4{font-size:14px;font-weight:700;margin-bottom:4px;color:var(--navy)}
.html-hub-page .use-case p{font-size:13px;color:var(--gray-600);line-height:1.5}
.html-hub-page .use-case a{color:var(--purple);font-weight:600;text-decoration:none}
.html-hub-page .use-case a:hover{text-decoration:underline}

/* Pillars */
.html-hub-page .pillar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px}
.html-hub-page .pillar{background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);padding:28px;position:relative;overflow:hidden}
.html-hub-page .pillar::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:var(--purple)}
.html-hub-page .pillar-icon{font-size:28px;margin-bottom:14px}
.html-hub-page .pillar h3{font-size:17px;font-weight:700;margin-bottom:8px;color:var(--navy)}
.html-hub-page .pillar p{font-size:14px;color:var(--gray-600);line-height:1.6}

/* Principles (trust) */
.html-hub-page .principles{display:flex;flex-direction:column;gap:0;border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden}
.html-hub-page .principle{padding:22px 26px;border-bottom:1px solid var(--border);display:flex;gap:16px;align-items:flex-start;background:#fff}
.html-hub-page .principle:last-child{border-bottom:none}
.html-hub-page .principle:hover{background:var(--gray-100)}
.html-hub-page .principle .p-icon{font-size:22px;flex-shrink:0;margin-top:2px}
.html-hub-page .principle h4{font-size:15px;font-weight:700;margin-bottom:4px;color:var(--navy)}
.html-hub-page .principle p{font-size:13px;color:var(--gray-600);line-height:1.55}

/* Category / tools / steps */
.html-hub-page .category-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.html-hub-page .category-card{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:24px}
.html-hub-page .category-card .cat-icon{font-size:24px;margin-bottom:12px}
.html-hub-page .category-card h3{font-size:16px;font-weight:700;margin-bottom:8px;color:var(--navy)}
.html-hub-page .category-card p{font-size:13px;color:var(--gray-600);line-height:1.5}
.html-hub-page .category-card ul{margin-top:10px;padding-left:0;list-style:none;display:flex;flex-direction:column;gap:6px}
.html-hub-page .category-card li{font-size:12px;color:var(--gray-600);display:flex;align-items:center;gap:6px}
.html-hub-page .category-card li::before{content:'·';color:var(--purple);font-size:16px;font-weight:700}

.html-hub-page .tool-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px}
.html-hub-page .tool-card{background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);padding:26px 24px;text-decoration:none;color:#111827;transition:box-shadow .2s,border-color .2s,transform .2s;display:block;position:relative;text-align:center;box-shadow:var(--mk-shadow-soft,none);cursor:pointer}
.html-hub-page .tool-card:hover{border-color:rgba(167,139,250,.55);box-shadow:var(--mk-shadow-hover,var(--shadow-lg));transform:translateY(-2px)}
.html-hub-page .tool-card:focus-visible{outline:2px solid var(--purple);outline-offset:3px}
.html-hub-page .tool-card .tool-logo{width:48px;height:48px;border-radius:10px;background:var(--gray-100);display:flex;align-items:center;justify-content:center;font-size:22px;margin:0 auto 16px;overflow:hidden}
.html-hub-page .tool-card .tool-logo img{max-width:100%;max-height:100%;object-fit:contain;padding:4px}
.html-hub-page .tool-card h3{font-size:var(--mk-card-title);font-weight:600;margin-bottom:8px;color:#111827}
.html-hub-page .tool-card p{font-size:13px;color:var(--mk-text-desc,#64748B);line-height:1.55;margin-bottom:14px;font-weight:400}
.html-hub-page .status-badge{display:inline-block;padding:4px 10px;border-radius:var(--radius-pill);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.html-hub-page .status-live{background:var(--green-bg);color:var(--green)}
.html-hub-page .status-workflow{background:var(--purple-bg);color:var(--purple)}
.html-hub-page .status-soon{background:var(--gray-100);color:var(--gray-600)}
.html-hub-page .tool-arrow{position:absolute;top:20px;right:20px;color:var(--purple);font-size:16px;opacity:0;transition:opacity .2s}
.html-hub-page .tool-card:hover .tool-arrow{opacity:1}

/* Step cards: narrower columns, taller min-height (~+20% vertical rhythm vs flat 24px padding) */
.html-hub-page .steps{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(200px,min(248px,100%)));
  justify-content:center;
  gap:24px;
  counter-reset:step;
}
/* Four steps — centered block (works-with Getting Started) */
.html-hub-page .steps.steps--centered-4{
  grid-template-columns:repeat(4,minmax(0,200px));
  justify-content:center;
  max-width:920px;
  margin-left:auto;
  margin-right:auto;
}
@media(max-width:1100px){
  .html-hub-page .steps.steps--centered-4{
    grid-template-columns:repeat(2,minmax(0,1fr));
    max-width:640px;
  }
}
@media(max-width:520px){
  .html-hub-page .steps.steps--centered-4{
    grid-template-columns:1fr;
    max-width:100%;
  }
}
.html-hub-page .step{
  position:relative;
  display:flex;
  flex-direction:column;
  min-height:13.2rem;
  padding:29px 22px 31px;
  background:#fff;
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  box-sizing:border-box;
}
.html-hub-page .step::before{counter-increment:step;content:counter(step);position:absolute;top:-14px;left:20px;background:var(--purple);color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800}
/* Center step number badge on top of each card (works-with Getting Started, trust rollout, etc.) */
.html-hub-page .steps.steps--centered-4 .step::before{
  left:50%;
  transform:translateX(-50%);
}
/* Works-with Getting Started — cards without circular step counter */
.html-hub-page .steps.steps--no-numbers{counter-reset:none}
.html-hub-page .steps.steps--no-numbers .step::before{display:none;content:none}
.html-hub-page .steps.steps--no-numbers .step h4{padding-top:0}
.html-hub-page .step h4{font-size:15px;font-weight:700;margin-bottom:8px;padding-top:8px;color:var(--navy)}
.html-hub-page .step h4:last-child{margin-bottom:0}
.html-hub-page .step p{font-size:13px;color:var(--gray-600);line-height:1.5;margin-top:0}
.html-hub-page .step p:last-child{margin-bottom:0}
.html-hub-page .step-track-mobile-nav{display:none}
.html-hub-page .step-track-mobile-nav-btn{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:84px;padding:8px 12px;border-radius:999px;
  border:1px solid var(--border);background:#fff;color:var(--gray-700);
  font-size:12px;font-weight:700;white-space:nowrap;
  transition:all .2s ease
}
.html-hub-page .step-track-mobile-nav-btn.is-active{background:var(--purple);border-color:var(--purple);color:#fff}
.html-hub-page .step:target{
  border-color:#c4b5fd;
  box-shadow:0 0 0 3px rgba(139,92,246,.12)
}
@media(max-width:640px){
  .html-hub-page .step-track-mobile-nav{
    display:flex;gap:8px;overflow-x:auto;padding:2px 2px 6px;margin:0 0 12px;
    justify-content:flex-start;
    -webkit-overflow-scrolling:touch;
    scroll-snap-type:x proximity;
  }
  .html-hub-page .steps,
  .html-hub-page .steps.steps--centered-4{
    display:flex;
    gap:12px;
    overflow-x:auto;
    scroll-snap-type:x mandatory;
    padding:2px 2px 6px;
    max-width:100%;
    justify-content:flex-start;
    touch-action:pan-x pinch-zoom;
    overscroll-behavior-x:contain;
  }
  .html-hub-page .step{
    min-width:78%;
    max-width:min(340px,92vw);
    scroll-snap-align:center;
  }
}

.html-hub-page .concern-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.html-hub-page .concern{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:22px 24px;display:flex;gap:14px}
.html-hub-page .concern .q-icon{font-size:20px;flex-shrink:0;margin-top:2px}
.html-hub-page .concern h4{font-size:14px;font-weight:700;margin-bottom:6px;color:var(--navy)}
.html-hub-page .concern p{font-size:13px;color:var(--gray-600);line-height:1.5}

/* Compare table */
.html-hub-page .compare-table-wrap{border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;overflow-x:auto}
.html-hub-page .compare-table{width:100%;border-collapse:collapse;min-width:700px}
.html-hub-page .compare-table th{padding:14px 16px;font-size:12px;font-weight:700;text-align:center;background:var(--navy);color:#fff}
.html-hub-page .compare-table th:first-child{text-align:left;background:var(--gray-100);color:var(--navy)}
.html-hub-page .compare-table th.rb-col{background:var(--purple);color:#fff}
.html-hub-page .compare-table td{padding:13px 16px;font-size:13px;text-align:center;border-top:1px solid var(--border);color:var(--gray-600)}
.html-hub-page .compare-table td:first-child{text-align:left;font-weight:600;color:var(--navy);background:var(--gray-100)}
.html-hub-page .compare-table tr:hover td{background:#FAFAFA}
.html-hub-page .compare-table tr:hover td:first-child{background:var(--gray-100)}
.html-hub-page .compare-table .td-rb{background:rgba(124,58,237,.04)!important;font-weight:600;color:var(--purple)!important}
.html-hub-page .compare-table .check{color:var(--green);font-weight:700}
.html-hub-page .compare-table .cross{color:var(--red);font-weight:700}
.html-hub-page .compare-table .partial{color:var(--amber);font-weight:700}
.html-hub-page .section-sub--compare-matrix{margin-bottom:32px}
.html-hub-page .compare-matrix-footnotes{max-width:980px;margin:14px auto 0;text-align:left}
.html-hub-page .compare-matrix-footnotes p{margin:6px 0 0;font-size:12px;line-height:1.55;color:var(--gray-600)}

/* Situation grid */
.html-hub-page .situation-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.html-hub-page .situation-grid.hub-grid-cols-3{
  grid-template-columns:repeat(3,minmax(0,1fr));
}
@media(max-width:900px){
  .html-hub-page .situation-grid.hub-grid-cols-3{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:560px){
  .html-hub-page .situation-grid.hub-grid-cols-3{grid-template-columns:1fr}
}
.html-hub-page .situation{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:22px 24px}
.html-hub-page .situation .if{font-size:12px;color:var(--purple);font-weight:600;text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px}
.html-hub-page .situation h4{font-size:14px;font-weight:700;margin-bottom:8px;color:var(--navy)}
.html-hub-page .situation p{font-size:13px;color:var(--gray-600);line-height:1.5}
.html-hub-page .situation .go{font-size:13px;font-weight:600;margin-top:10px}
.html-hub-page .situation .go a{color:var(--purple);text-decoration:none;font-weight:600}
.html-hub-page .situation .go a:hover{text-decoration:underline}

/* Split expectations (trust HTML) — centered block like other landing rails */
.html-hub-page .expect-split-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:20px;
  max-width:900px;
  width:100%;
  margin-left:auto;
  margin-right:auto;
  box-sizing:border-box;
}
.html-hub-page .expect-split-card{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:24px}
.html-hub-page .expect-split-card--good{border-color:var(--green-border);background:#fff}
.html-hub-page .expect-split-head{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px}
.html-hub-page .expect-split-head--good{color:var(--green)}
.html-hub-page .expect-split-head--team{color:var(--gray-400)}
.html-hub-page .expect-split-card ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px}
.html-hub-page .expect-split-card li{font-size:14px;color:var(--gray-700);display:flex;gap:10px;align-items:flex-start}
.html-hub-page .expect-split-card li span:first-child{flex-shrink:0;color:var(--green);font-weight:700}
.html-hub-page .expect-split-card--team li span:first-child{color:var(--gray-400)}

/* Industry + articles */
.html-hub-page .industry-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.html-hub-page .industry-card{background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);padding:22px 20px;text-align:center;text-decoration:none;color:#111827;transition:box-shadow .2s,border-color .2s,transform .2s;display:block;box-shadow:var(--mk-shadow-soft,none);cursor:pointer}
.html-hub-page .industry-card:hover{border-color:rgba(167,139,250,.55);box-shadow:var(--mk-shadow-hover,var(--shadow-lg));transform:translateY(-2px)}
.html-hub-page .industry-card:focus-visible{outline:2px solid var(--purple);outline-offset:3px}
.html-hub-page .industry-card .emoji{font-size:30px;margin-bottom:10px;line-height:1}
.html-hub-page .industry-card h3{font-size:15px;font-weight:600;margin-bottom:6px;color:#111827}
.html-hub-page .industry-card p{font-size:12px;color:var(--mk-text-desc,#64748B);line-height:1.5;font-weight:400}
.html-hub-page .industry-card .arrow{font-size:13px;color:var(--purple);font-weight:600;margin-top:10px;display:block;transition:transform .2s ease}
.html-hub-page .industry-card:hover .arrow{transform:translateX(3px)}

.html-hub-page .article-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.html-hub-page .article-link{display:flex;align-items:center;gap:12px;padding:16px 18px;background:#fff;border:1px solid var(--border);border-radius:var(--radius);text-decoration:none;color:var(--navy);font-size:14px;font-weight:500;transition:all .2s}
.html-hub-page .article-link:hover{border-color:var(--purple);color:var(--purple)}
.html-hub-page .article-link::before{content:'→';color:var(--purple);font-weight:700;font-size:16px;flex-shrink:0}
.html-hub-page--green .article-link:hover{border-color:var(--green);color:var(--green)}
.html-hub-page--green .article-link::before{color:var(--green)}

/* FAQ */
.html-hub-page .faq-list{display:flex;flex-direction:column;border:1px solid var(--border);border-radius:20px;overflow:hidden;box-shadow:none}
.html-hub-page .faq-item{border-bottom:1px solid var(--border)}
.html-hub-page .faq-item:last-child{border-bottom:none}
.html-hub-page .faq-q{width:100%;background:none;border:none;padding:20px 24px;text-align:left;font-family:inherit;font-size:15px;font-weight:600;color:var(--navy);cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:12px}
.html-hub-page .faq-q:hover{background:var(--gray-100)}
.html-hub-page .faq-icon{font-size:20px;color:var(--purple);transition:transform .25s;flex-shrink:0}
.html-hub-page .faq-icon--green{color:var(--green)}
.html-hub-page .faq-a{padding:0 24px;max-height:0;overflow:hidden;transition:max-height .35s ease}
.html-hub-page .faq-a p{font-size:14px;color:var(--mk-text-desc,#64748B);line-height:var(--mk-body-lh,1.68);padding-bottom:20px;font-weight:400}
.html-hub-page .faq-item.open .faq-a{max-height:1200px}
.html-hub-page .faq-item.open .faq-icon{transform:rotate(45deg)}

/* CTA — default hub (navy band) */
.html-hub-page .cta-band{background:var(--navy);padding:72px 24px;text-align:center}
.html-hub-page .cta-band h2{color:#fff;margin-bottom:12px;font-size:clamp(26px,4vw,38px);font-weight:700;letter-spacing:-.5px}
.html-hub-page .cta-band p{color:rgba(255,255,255,.78);margin-bottom:32px;max-width:500px;margin-left:auto;margin-right:auto;line-height:1.65;font-weight:400}
.html-hub-page .cta-inner{max-width:600px;margin:0 auto}
.html-hub-page .cta-group{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.html-hub-page .cta-band .btn-outline-light{color:#fff;border-color:rgba(255,255,255,.3);background:transparent}
.html-hub-page .cta-band .btn-outline-light:hover{background:rgba(255,255,255,.1);color:#fff}

/* CTA — marketing-home style (gradient banner, primary/secondary like .btn-white / .btn-ghost-w) */
.html-hub-page .hub-cta-outer{padding:0 48px 72px;display:flex;justify-content:center;background:#fff}
.html-hub-page .hub-cta-inner{width:100%;max-width:1100px}
.html-hub-page .hub-cta-banner{
  border-radius:var(--radius-lg);
  background:linear-gradient(125deg,#6D28D9 0%,#8B5CF6 55%,#A78BFA 100%);
  padding:52px 56px;
  display:grid;
  grid-template-columns:1fr auto;
  gap:32px 40px;
  align-items:center;
  position:relative;
  overflow:hidden;
}
.html-hub-page .hub-cta-banner::before{
  content:"";
  position:absolute;
  right:-30px;
  top:-40px;
  width:280px;
  height:280px;
  background:rgba(255,255,255,.07);
  border-radius:50%;
  pointer-events:none;
}
.html-hub-page .hub-cta-text{position:relative;z-index:2}
.html-hub-page .hub-cta-text h2{
  font-size:clamp(22px,2.4vw,32px);
  font-weight:700;
  color:#fff;
  letter-spacing:-.65px;
  margin:0 0 8px;
  line-height:1.2;
}
.html-hub-page .hub-cta-text p{
  font-size:14px;
  color:rgba(255,255,255,.82);
  line-height:1.65;
  max-width:380px;
  margin:0;
  font-weight:400;
}
.html-hub-page .hub-cta-actions{
  display:flex;
  flex-direction:column;
  gap:10px;
  position:relative;
  z-index:2;
  min-width:210px;
}
.html-hub-page .hub-cta-btn-white{
  background:#fff;
  color:#5b21b6;
  padding:12px 24px;
  border-radius:var(--radius-pill);
  font-size:14.5px;
  font-weight:600;
  text-decoration:none;
  display:inline-flex;
  align-items:center;
  gap:8px;
  justify-content:center;
  white-space:nowrap;
  transition:transform .15s,box-shadow .2s;
  font-family:inherit;
  box-sizing:border-box;
  border:none;
  cursor:pointer;
  box-shadow:0 4px 16px rgba(17,24,39,.08);
}
.html-hub-page .hub-cta-btn-white .hub-cta-btn-white-arrow{width:16px;height:16px;flex-shrink:0;color:#5b21b6;transition:transform .2s ease}
.html-hub-page .hub-cta-btn-white .demo-cta-phone{width:16px;height:16px;flex-shrink:0}
.html-hub-page .hub-cta-btn-white .demo-cta-phone path{fill:#FACC15}
.html-hub-page .hub-cta-btn-white:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(17,24,39,.1)}
.html-hub-page .hub-cta-btn-white:hover .hub-cta-btn-white-arrow{transform:translateX(3px)}
.html-hub-page .hub-cta-btn-ghost{
  background:rgba(255,255,255,.12);
  color:#fff;
  padding:12px 24px;
  border-radius:var(--radius-pill);
  font-size:14px;
  font-weight:600;
  text-decoration:none;
  text-align:center;
  border:1px solid rgba(255,255,255,.32);
  transition:background .2s,border-color .2s;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-family:inherit;
  box-sizing:border-box;
  cursor:pointer;
}
.html-hub-page .hub-cta-btn-ghost:hover{background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.45)}
@media(max-width:960px){
  .html-hub-page .hub-cta-outer{padding:0 22px 64px}
  .html-hub-page .hub-cta-banner{grid-template-columns:1fr;padding:32px 26px;gap:24px}
  .html-hub-page .hub-cta-actions{width:100%;min-width:0}
}
@media(max-width:640px){
  .html-hub-page .hub-cta-banner{padding:28px 20px;gap:20px}
  .html-hub-page .hub-cta-btn-white,
  .html-hub-page .hub-cta-btn-ghost{width:100%;justify-content:center}
}

/* Topic links — pill row; no band background/border (inherits page surface) */
.html-hub-page .html-hub-topic-nav{
  background:transparent;
  padding:56px 24px 72px;
}
.html-hub-page .html-hub-topic-nav-inner{
  max-width:1100px;
  margin:0 auto;
  text-align:center;
}
.html-hub-page .html-hub-topic-nav-eyebrow{
  font-size:var(--mk-eyebrow);
  font-weight:600;
  letter-spacing:var(--mk-eyebrow-ls);
  text-transform:uppercase;
  color:#94A3B8;
  margin:0 0 18px;
}
.html-hub-page .html-hub-topic-nav-list{
  display:flex;
  flex-wrap:wrap;
  justify-content:center;
  align-items:center;
  gap:10px;
  list-style:none;
  margin:0;
  padding:0;
}
.html-hub-page .html-hub-topic-nav-list li{display:inline-flex;flex-shrink:0}
/* Hub pills: one weight/size so short labels (e.g. Works with) do not read heavier than wrapped long labels */
.html-hub-page .html-hub-topic-nav-list a{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:10px 18px;
  border-radius:var(--radius-pill);
  font-size:15px;
  font-weight:500;
  line-height:1.35;
  text-align:center;
  color:var(--gray-700);
  text-decoration:none;
  border:1px solid var(--border);
  background:#fff;
  box-shadow:0 1px 2px rgba(15,23,42,.04);
  transition:border-color .2s,color .2s,box-shadow .2s,transform .15s;
  flex-shrink:0;
  max-width:min(100%,22em);
}
.html-hub-page .html-hub-topic-nav-list a:hover{
  border-color:#C4B5FD;
  color:var(--purple);
  box-shadow:0 4px 16px rgba(124,58,237,.1);
  transform:translateY(-1px);
}
.html-hub-page--landing-width .html-hub-topic-nav{padding-left:48px;padding-right:48px}
@media(max-width:640px){
  .html-hub-page .html-hub-topic-nav{padding:44px 20px 56px}
  .html-hub-page--landing-width .html-hub-topic-nav{padding-left:24px;padding-right:24px}
  .html-hub-page .html-hub-topic-nav-list a{padding:10px 16px;font-size:14px}
}

/* Text sections (legacy prose blocks) */
.html-hub-page .hub-prose-section p{font-size:clamp(15px,1.8vw,18px);color:var(--gray-600);line-height:1.65;margin-bottom:16px;max-width:720px}

@media(max-width:960px){
  .html-hub-page .leak-grid:not(.hub-grid-cols-3){grid-template-columns:1fr}
}
@media(max-width:768px){
  .html-hub-page .scenario-grid,.html-hub-page .objection-grid{grid-template-columns:1fr}
  .html-hub-page .industry-grid{grid-template-columns:repeat(2,1fr)}
  .html-hub-page .expect-split-grid{grid-template-columns:1fr}
  .html-hub-page .section{padding:56px 20px}
  .html-hub-page .hero{padding:56px 20px 72px}
}

/*
 * /compare — hard lock 3 cards per row on desktop (must be last: wins over any cascade).
 * Fixes 4+2 layouts from auto-fill or .leak-grid--cols-4 leaking in devtools builds.
 */
.hub-compare-index .leak-grid.hub-compare-3up,
.hub-compare-index .alt-link-grid.hub-compare-3up,
.hub-compare-index .situation-grid.hub-compare-3up{
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:16px!important;
}
@media(max-width:640px){
  .hub-compare-index .leak-grid.hub-compare-3up,
  .hub-compare-index .alt-link-grid.hub-compare-3up,
  .hub-compare-index .situation-grid.hub-compare-3up{
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
  }
}
@media(max-width:480px){
  .hub-compare-index .leak-grid.hub-compare-3up,
  .hub-compare-index .alt-link-grid.hub-compare-3up,
  .hub-compare-index .situation-grid.hub-compare-3up{
    grid-template-columns:1fr!important;
  }
}

/* /compare index — hero accent: same purple as legacy .hl text-on-pill, no pill (title uses strong.hub-compare-hero-accent). */
.hub-compare-index h1.hero-h .hub-compare-hero-accent{
  color:var(--purple);
  font-weight:800;
}
`;
