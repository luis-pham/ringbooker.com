import { DemoPickerLazy } from '@/components/marketing/demo-picker-lazy';
import { MarketingMobileNav } from '@/components/marketing/marketing-mobile-nav';
import { NavActionsClient } from '@/components/marketing/nav-actions-client';
import { MARKETING_DEMO_NAV_ITEMS } from '@/lib/marketing-demo-nav';
import { MARKETING_INDUSTRY_NAV_ITEMS } from '@/lib/marketing-industry-nav';
import { siteConfig } from '@/lib/site';

type MarketingHeaderProps = {
  active?: 'demo' | 'pricing' | 'how-it-works' | 'contact' | 'industry';
};

const socialIconPaths = {
  /** X (Twitter) logo, 24×24 viewBox */
  twitter:
    'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  linkedin:
    'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  instagram:
    'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z',
  facebook:
    'M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.49 0-1.956.93-1.956 1.886v2.265h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z',
  youtube:
    'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.016 3.016 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
} as const;

export function MarketingChromeStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
.mk-nav{position:fixed;top:0;left:0;right:0;z-index:1000;background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-bottom:1px solid color-mix(in srgb,var(--mk-border-soft,#e8ecf1) 82%,transparent);height:68px;display:flex;align-items:center;justify-content:center;padding:0 48px}
.mk-nav-inner{width:100%;max-width:var(--mk-container,1160px);display:flex;align-items:center;justify-content:space-between;gap:20px}
.mk-nav-logo{display:flex;align-items:center;gap:11px;font-weight:700;font-size:19px;color:var(--mk-text-strong,#111827);text-decoration:none}
.mk-nav-logo-icon{position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.mk-nav-ripple{position:absolute;border-radius:50%;background:var(--mk-brand-purple,#8B5CF6)}
.mk-nav-ripple-3{width:38px;height:38px;opacity:.1}
.mk-nav-ripple-2{width:30px;height:30px;opacity:.18}
.mk-nav-ripple-core{width:24px;height:24px;background:var(--mk-brand-purple,#8B5CF6);border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;z-index:1}
.mk-nav-ripple-core svg{width:13px;height:13px;fill:#fff}
.mk-nav-links{display:flex;align-items:center;gap:28px;flex-wrap:wrap}
.mk-nav-links a{font-size:14.5px;font-weight:500;color:var(--mk-text-muted,#64748b);text-decoration:none;transition:color .2s}
.mk-nav-links a:hover,.mk-nav-links a.active{color:var(--mk-text-strong,#111827)}
.mk-nav-actions{display:flex;align-items:center;gap:10px;white-space:nowrap}
.mk-nav-signin{padding:9px 16px;border-radius:var(--mk-radius-pill,999px);border:1px solid var(--mk-border-soft,#E8ECF1);font-size:14px;font-weight:600;color:var(--mk-text-body,#334155);text-decoration:none;background:#fff;transition:border-color .2s,color .2s,background .2s,box-shadow .2s}
.mk-nav-signin:hover{border-color:var(--mk-border-strong,#d6dde6);color:var(--mk-text-strong,#111827);background:var(--mk-bg-soft,#F8FAFC);box-shadow:var(--mk-shadow-soft)}
.mk-nav-cta{background:linear-gradient(135deg,var(--mk-brand-purple-deep,#5B21B6) 0%,var(--mk-brand-purple-dark,#7C3AED) 48%,var(--mk-brand-purple,#8B5CF6) 100%);color:#fff;padding:10px 22px;border-radius:var(--mk-radius-pill,999px);font-size:14px;font-weight:700;display:flex;align-items:center;gap:7px;transition:filter .2s,transform .15s,box-shadow .2s;white-space:nowrap;text-decoration:none;box-shadow:var(--mk-shadow-brand);border:none}
.mk-nav-cta .demo-cta-phone{flex-shrink:0}
.mk-nav-cta:hover{filter:brightness(1.04);transform:translateY(-1px);box-shadow:var(--mk-shadow-brand-hover)}
.mk-nav-cta:focus-visible{outline:2px solid var(--mk-brand-purple-dark,#7C3AED);outline-offset:2px}
.mk-footer{background:var(--mk-bg-section,#F9FAFB);border-top:1px solid var(--mk-border-soft,#E8ECF1);padding:60px 48px 32px}
.mk-footer-inner{max-width:var(--mk-container-tight,1100px);margin:0 auto}
.mk-footer-brand-block{max-width:440px;margin-bottom:48px}
.mk-footer-links{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:48px;margin-bottom:50px}
.mk-footer-brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px;margin-bottom:14px}
.mk-footer-logo{width:34px;height:34px}
.mk-footer-logo .mk-nav-ripple-3{width:34px;height:34px}
.mk-footer-logo .mk-nav-ripple-2{width:26px;height:26px}
.mk-footer-logo .mk-nav-ripple-core{width:21px;height:21px}
.mk-footer-logo .mk-nav-ripple-core svg{width:11px;height:11px}
.mk-footer-desc{font-size:13.5px;color:var(--mk-text-muted,#64748b);line-height:1.65;margin-bottom:20px}
.mk-footer-social{display:flex;gap:10px}
.mk-soc-btn{width:36px;height:36px;border-radius:50%;border:1px solid var(--mk-border-soft,#E8ECF1);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;text-decoration:none}
.mk-soc-btn:hover{border-color:var(--mk-brand-purple,#8B5CF6);background:var(--mk-brand-purple-wash,#F5F3FF)}
.mk-soc-btn svg{width:14px;height:14px;fill:var(--mk-text-muted,#64748b)}
.mk-soc-btn:hover svg{fill:var(--mk-brand-purple,#8B5CF6)}
.mk-footer-col h4{font-size:11.5px;font-weight:700;color:var(--mk-text-strong,#111827);text-transform:uppercase;letter-spacing:.07em;margin-bottom:16px}
.mk-footer-col a{display:block;font-size:14px;color:var(--mk-text-muted,#64748b);text-decoration:none;margin-bottom:10px;transition:color .2s;line-height:1.45}
.mk-footer-col a:hover{color:var(--mk-text-strong,#111827)}
.mk-footer-bottom{border-top:1px solid var(--mk-border-soft,#E8ECF1);padding-top:22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px 28px}
.mk-footer-bottom p,.mk-footer-copy,.mk-footer-tagline{font-size:14px;color:var(--mk-text-soft,#94a3b8);margin:0}
.mk-footer-bottom-right{display:flex;align-items:center;flex-wrap:wrap;gap:10px 22px}
.mk-footer-legal{display:inline-flex;align-items:center;flex-wrap:wrap;gap:4px 10px}
.mk-footer-legal a{font-size:13.5px;color:var(--mk-text-soft,#94a3b8);text-decoration:none;transition:color .2s;white-space:nowrap}
.mk-footer-legal a:hover{color:var(--mk-text-strong,#111827)}
.mk-footer-legal-sep{color:var(--mk-border-strong,#d6dde6);font-size:13px;user-select:none}
/* ─── DEMO DROPDOWN ─── */
.mk-demo-dd{position:relative;display:inline-flex;align-items:center}
.mk-demo-dd-link{display:inline-flex;align-items:center;gap:4px;font-size:14.5px;font-weight:500;color:var(--mk-text-muted,#64748b);text-decoration:none;transition:color .2s;cursor:pointer;background:none;border:none;padding:0;font-family:inherit}
.mk-demo-dd-link:hover,.mk-demo-dd-link.active{color:var(--mk-text-strong,#111827)}
.mk-demo-caret{width:10px;height:10px;opacity:.55;transition:transform .2s;display:inline-block;margin-top:1px;margin-left:2px;flex-shrink:0}
.mk-demo-caret svg{display:block;width:10px;height:10px}
.mk-demo-dd:hover .mk-demo-caret{transform:rotate(180deg)}
.mk-demo-menu{position:absolute;top:100%;left:50%;transform:translateX(-50%) translateY(-4px);padding-top:12px;opacity:0;pointer-events:none;transition:opacity .18s,transform .18s;z-index:200}
.mk-demo-menu-inner{background:#fff;border:1px solid var(--mk-border-soft,#E8ECF1);border-radius:var(--mk-radius-input,16px);box-shadow:var(--mk-shadow-soft),0 1px 3px rgba(0,0,0,.04);padding:8px;min-width:210px}
.mk-demo-dd:hover .mk-demo-menu{opacity:1;pointer-events:all;transform:translateX(-50%) translateY(0)}
.mk-demo-item{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:12px;font-size:13.5px;font-weight:600;color:var(--mk-text-body,#334155);text-decoration:none;transition:background .15s,color .15s;white-space:nowrap}
.mk-demo-item:hover{background:var(--mk-brand-purple-wash,#F5F3FF);color:var(--mk-brand-purple-dark,#7C3AED)}
.mk-demo-item-icon{font-size:16px;width:22px;text-align:center;flex-shrink:0}

/* ─── MOBILE HAMBURGER + FULL-WIDTH MENU (≤960px) ─── */
.mk-nav-right{display:flex;align-items:center;gap:10px;flex-shrink:0}
.mk-nav-burger{display:none;align-items:center;justify-content:center;width:42px;height:42px;border-radius:12px;border:1px solid var(--mk-border-soft,#E8ECF1);background:#fff;color:var(--mk-text-body,#334155);cursor:pointer;transition:border-color .15s,background .15s,transform .12s}
.mk-nav-burger:hover{border-color:var(--mk-border-strong,#d6dde6);background:var(--mk-bg-soft,#F8FAFC)}
.mk-nav-burger:active{transform:scale(.97)}
.mk-drawer-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.48);backdrop-filter:blur(6px);z-index:5000;animation:mkDrFade .2s ease}
@keyframes mkDrFade{from{opacity:0}to{opacity:1}}
.mk-drawer-panel{position:fixed;inset:0;width:100%;max-width:100%;min-height:100dvh;background:#fff;z-index:5010;display:flex;flex-direction:column;animation:mkDrReveal .28s cubic-bezier(.22,1,.36,1)}
@keyframes mkDrReveal{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
.mk-drawer-head{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:calc(14px + env(safe-area-inset-top,0)) calc(20px + env(safe-area-inset-right,0)) 16px calc(20px + env(safe-area-inset-left,0));border-bottom:1px solid var(--mk-border-soft,#E8ECF1);background:linear-gradient(180deg,#fff 0%,var(--mk-bg-soft,#FAFBFC) 100%)}
.mk-drawer-head-logo{flex:1;min-width:0;margin-right:4px}
.mk-drawer-close{flex-shrink:0;width:44px;height:44px;border-radius:14px;border:1px solid var(--mk-border-soft,#E8ECF1);background:#fff;color:var(--mk-text-body,#334155);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;font-family:inherit;transition:background .15s,border-color .15s,color .15s,transform .12s}
.mk-drawer-close:hover{background:var(--mk-brand-purple-wash,#F5F3FF);border-color:color-mix(in srgb,var(--mk-brand-purple,#8B5CF6) 25%,#E8ECF1);color:var(--mk-brand-purple-deep,#5B21B6)}
.mk-drawer-close:active{transform:scale(.96)}
.mk-drawer-nav{flex:1;overflow-y:auto;display:flex;flex-direction:column;-webkit-overflow-scrolling:touch;padding:4px 0 8px}
.mk-drawer-navlink{display:flex;align-items:center;justify-content:space-between;width:100%;box-sizing:border-box;padding:18px calc(22px + env(safe-area-inset-right,0)) 18px calc(22px + env(safe-area-inset-left,0));border:none;border-bottom:1px solid #F0F2F5;background:#fff;font-size:17px;font-weight:600;color:var(--mk-text-body,#334155);text-decoration:none;font-family:inherit;letter-spacing:-.02em;line-height:1.25;transition:background .14s,color .14s;min-height:56px;text-align:left;cursor:pointer}
.mk-drawer-navlink:hover,.mk-drawer-navlink:focus-visible{background:#FAF5FF;color:var(--mk-brand-purple-deep,#5B21B6);outline:none}
.mk-drawer-navlink.active{background:linear-gradient(90deg,rgba(124,58,237,.08) 0%,transparent 100%);color:var(--mk-text-strong,#111827);font-weight:700;box-shadow:inset 3px 0 0 var(--mk-brand-purple-dark,#7C3AED)}
.mk-drawer-navlink-label{flex:1;min-width:0}
.mk-drawer-navlink-chevron{width:9px;height:9px;margin-left:12px;flex-shrink:0;border-right:2px solid #D1D5DB;border-bottom:2px solid #D1D5DB;transform:rotate(-45deg) translate(0,-1px);transition:border-color .14s}
.mk-drawer-navlink:hover .mk-drawer-navlink-chevron,.mk-drawer-navlink:focus-visible .mk-drawer-navlink-chevron{border-color:#A78BFA}
.mk-drawer-navlink.active .mk-drawer-navlink-chevron{border-color:#7C3AED}
.mk-drawer-foot{flex-shrink:0;padding:20px calc(20px + env(safe-area-inset-right,0)) calc(22px + env(safe-area-inset-bottom,0)) calc(20px + env(safe-area-inset-left,0));border-top:1px solid var(--mk-border-soft,#E8ECF1);background:linear-gradient(180deg,var(--mk-bg-soft,#FAFBFC) 0%,#F4F5F7 100%);display:flex;flex-direction:column;gap:12px}
.mk-drawer-btn-demo{width:100%;box-sizing:border-box;padding:16px 18px;border-radius:14px;border:none;background:linear-gradient(135deg,var(--mk-brand-purple-deep,#5B21B6) 0%,var(--mk-brand-purple-dark,#7C3AED) 48%,var(--mk-brand-purple,#8B5CF6) 100%);color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;letter-spacing:-.02em;transition:transform .12s,box-shadow .15s,filter .15s;box-shadow:var(--mk-shadow-brand);display:flex;align-items:center;justify-content:center;gap:10px}
.mk-drawer-btn-demo:hover{filter:brightness(1.04);transform:translateY(-1px);box-shadow:var(--mk-shadow-brand-hover)}
.mk-drawer-btn-demo:active{transform:translateY(0)}
.mk-drawer-btn-demo:focus-visible{outline:2px solid var(--mk-brand-purple-dark,#7C3AED);outline-offset:2px}
.mk-drawer-btn-cta{width:100%;box-sizing:border-box;padding:14px 18px;border-radius:14px;background:transparent;color:var(--mk-text-strong,#111827);font-size:14px;font-weight:600;text-align:center;text-decoration:none;letter-spacing:-.02em;border:2px solid var(--mk-border-soft,#E8ECF1);transition:border-color .15s,background .15s,transform .12s}
.mk-drawer-btn-cta:hover{border-color:#C4B5FD;background:#FAF5FF;color:var(--mk-brand-purple-deep,#5B21B6)}
.mk-drawer-btn-cta:active{transform:scale(.99)}
.mk-drawer-signin{text-align:center;padding:10px;font-size:14px;font-weight:600;color:var(--mk-text-muted,#64748b);text-decoration:none;transition:color .15s}
.mk-drawer-signin:hover{color:var(--mk-text-strong,#111827)}

/* ─── DEMO PICKER MODAL ─── */
.dpm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:dpmFadeIn .2s ease}
@keyframes dpmFadeIn{from{opacity:0}to{opacity:1}}
.dpm-dialog{background:#fff;border-radius:var(--mk-radius-panel,28px);padding:36px 32px 28px;max-width:560px;width:100%;box-shadow:0 24px 64px rgba(17,24,39,.12),0 8px 24px rgba(17,24,39,.06);position:relative;animation:dpmSlideUp .25s cubic-bezier(.22,1,.36,1)}
@keyframes dpmSlideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
.dpm-close{position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:50%;border:1px solid var(--mk-border-soft,#E8ECF1);background:var(--mk-bg-soft,#F9FAFB);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--mk-text-muted,#64748b);transition:all .15s}
.dpm-close:hover{background:#F3F4F6;color:var(--mk-text-strong,#111827)}
.dpm-eyebrow{display:flex;align-items:center;gap:6px;font-size:var(--mk-eyebrow);font-weight:600;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;color:var(--mk-brand-purple-deep,#5B21B6);margin-bottom:8px}
.dpm-eyebrow .demo-cta-phone{flex-shrink:0}
.dpm-title{font-size:20px;font-weight:700;color:var(--mk-text-strong,#111827);letter-spacing:-.4px;margin-bottom:6px;line-height:1.3}
.dpm-sub{font-size:14px;color:var(--mk-text-desc,#64748B);margin-bottom:22px;line-height:1.6}
.dpm-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:20px}
.dpm-card{display:flex;flex-direction:column;gap:2px;padding:14px 14px 28px;border-radius:16px;border:1.5px solid color-mix(in srgb,var(--dpm-accent,#8B5CF6) 25%,#E5E7EB);background:color-mix(in srgb,var(--dpm-accent,#8B5CF6) 5%,#fff);text-decoration:none;transition:all .15s;position:relative;overflow:hidden}
.dpm-card-nail-salon{--dpm-accent:#7C3AED}
.dpm-card-hair-salon{--dpm-accent:#B45309}
.dpm-card-day-spa{--dpm-accent:#0D9488}
.dpm-card-med-spa{--dpm-accent:#4F46E5}
.dpm-card-beauty-clinic{--dpm-accent:#A21CAF}
.dpm-card:hover{border-color:var(--dpm-accent,#8B5CF6);background:color-mix(in srgb,var(--dpm-accent,#8B5CF6) 10%,#fff);transform:translateY(-1px);box-shadow:0 6px 20px color-mix(in srgb,var(--dpm-accent,#8B5CF6) 15%,transparent)}
.dpm-icon{font-size:22px;margin-bottom:5px;display:block}
.dpm-label{font-size:14px;font-weight:700;color:#111827;display:block}
.dpm-card-sub{font-size:11.5px;color:#6B7280;line-height:1.4;display:block}
.dpm-arrow{position:absolute;bottom:12px;right:12px;font-size:13px;font-weight:700;color:var(--dpm-accent,#8B5CF6);opacity:0;transition:.15s;transform:translateX(-4px)}
.dpm-card:hover .dpm-arrow{opacity:1;transform:translateX(0)}
.dpm-note{font-size:12px;color:#9CA3AF;text-align:center;line-height:1.5}
@media(max-width:480px){
  .dpm-dialog{padding:22px 16px 18px;border-radius:22px}
  .dpm-head{margin-bottom:0}
  .dpm-title{font-size:17px;margin-bottom:4px}
  .dpm-sub{display:none}
  .dpm-grid{grid-template-columns:1fr 1fr;gap:7px;margin-bottom:14px}
  .dpm-card{padding:12px 10px;gap:3px;padding-bottom:12px}
  .dpm-card-sub{display:none}
  .dpm-icon{font-size:20px;margin-bottom:2px}
  .dpm-label{font-size:13px}
  .dpm-arrow{display:none}
}

/* ─── AUTHENTICATED NAV: avatar + dropdown ─── */
.mk-avatar-dd{position:relative;display:inline-flex;align-items:center}
.mk-avatar-btn{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--mk-brand-purple-dark,#7C3AED),#4F46E5);color:#fff;font-size:12px;font-weight:700;border:2px solid rgba(255,255,255,.9);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .18s,box-shadow .18s;letter-spacing:.02em;box-shadow:0 2px 8px rgba(124,58,237,.22)}
.mk-avatar-btn:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(124,58,237,.32)}
.mk-avatar-btn:focus-visible{outline:2px solid var(--mk-brand-purple-dark,#7C3AED);outline-offset:2px}
.mk-avatar-menu{position:absolute;top:calc(100% + 10px);right:0;min-width:230px;opacity:0;pointer-events:none;transition:opacity .17s,transform .17s;transform:translateY(-6px);z-index:400}
.mk-avatar-menu.open{opacity:1;pointer-events:all;transform:translateY(0)}
.mk-avatar-menu-inner{background:#fff;border:1px solid var(--mk-border-soft,#E8ECF1);border-radius:18px;box-shadow:0 16px 48px rgba(17,24,39,.13);overflow:hidden}
.mk-avatar-head{padding:14px 16px;background:#FAFAFA;border-bottom:1px solid #F3F4F6}
.mk-avatar-name{font-size:13px;font-weight:700;color:var(--mk-text-strong,#111827);line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px}
.mk-avatar-email{font-size:11.5px;color:var(--mk-text-muted,#64748b);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px}
.mk-avatar-plan{display:inline-flex;align-items:center;margin-top:7px;padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;background:var(--mk-brand-purple-wash,#F5F3FF);color:var(--mk-brand-purple-deep,#5B21B6);border:1px solid rgba(196,181,253,.45)}
.mk-avatar-items{padding:5px}
.mk-avatar-item{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:12px;font-size:13.5px;font-weight:500;color:var(--mk-text-body,#334155);text-decoration:none;transition:background .13s,color .13s;cursor:pointer;border:none;background:none;width:100%;text-align:left;font-family:inherit;line-height:1.2}
.mk-avatar-item span{font-size:14px;width:18px;text-align:center;flex-shrink:0}
.mk-avatar-item:hover{background:var(--mk-brand-purple-wash,#F5F3FF);color:var(--mk-brand-purple-dark,#7C3AED)}
.mk-avatar-sep{height:1px;background:#F3F4F6;margin:2px 0}
.mk-avatar-upgrade{color:var(--mk-brand-purple-dark,#7C3AED);font-weight:700}
.mk-avatar-upgrade:hover{background:var(--mk-brand-purple-wash,#F5F3FF);color:#6D28D9}
.mk-avatar-signout{color:var(--mk-text-muted,#64748b)}
.mk-avatar-signout:hover{background:#FFF1F2;color:#DC2626}
/* upgrade secondary CTA */
.mk-nav-upgrade{padding:9px 16px;border-radius:999px;border:1.5px solid rgba(139,92,246,.4);font-size:13.5px;font-weight:700;color:var(--mk-brand-purple-dark,#7C3AED);background:rgba(245,243,255,.8);text-decoration:none;transition:border-color .15s,background .15s;white-space:nowrap}
.mk-nav-upgrade:hover{border-color:var(--mk-brand-purple,#8B5CF6);background:var(--mk-brand-purple-soft,#EDE9FE)}
/* loading skeleton */
.mk-nav-skel{height:36px;width:130px;border-radius:999px;background:linear-gradient(90deg,#F3F4F6 25%,#E9EAEB 50%,#F3F4F6 75%);background-size:200% 100%;animation:mkSkel 1.4s infinite}
@keyframes mkSkel{0%{background-position:200% 0}100%{background-position:-200% 0}}

@media(max-width:960px){
  .mk-nav{padding:0 22px}
  .mk-nav-links{display:none}
  .mk-nav-signin{display:none}
  .mk-nav-burger{display:inline-flex}
  /* visitor trial + auth primary CTA live in drawer / avatar; keep bar minimal */
  .mk-nav-cta-hide-sm{display:none !important}
  .mk-footer{padding-left:22px;padding-right:22px}
  .mk-footer-links{grid-template-columns:repeat(2,minmax(0,1fr));gap:32px 28px}
  .mk-footer-bottom{flex-direction:column;align-items:flex-start}
  .mk-avatar-menu{right:0;min-width:260px}
  /* hide upgrade pill on mobile to keep nav clean */
  .mk-nav-upgrade{display:none}
}
`,
      }}
    />
  );
}

export function MarketingHeader({ active }: MarketingHeaderProps) {
  return (
    <nav className="mk-nav">
      <div className="mk-nav-inner">
        <a href="/" className="mk-nav-logo">
          <div className="mk-nav-logo-icon">
            <div className="mk-nav-ripple mk-nav-ripple-3" />
            <div className="mk-nav-ripple mk-nav-ripple-2" />
            <div className="mk-nav-ripple-core">
              <svg viewBox="0 0 24 24">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
            </div>
          </div>
          <span>RingBooker</span>
        </a>
        <div className="mk-nav-links">
          <a href="/#features">
            Features
          </a>
          <div className="mk-demo-dd">
            <a
              href="/#industries"
              className={`mk-demo-dd-link${active === 'industry' ? ' active' : ''}`}
            >
              Industries{' '}
              <span className="mk-demo-caret" aria-hidden>
                <svg viewBox="0 0 10 10">
                  <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </a>
            <div className="mk-demo-menu">
              <div className="mk-demo-menu-inner">
                {MARKETING_INDUSTRY_NAV_ITEMS.map((item) => (
                  <a key={item.href} href={item.href} className="mk-demo-item">
                    <span className="mk-demo-item-icon">{item.icon}</span>
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div className="mk-demo-dd">
            <a href="/demo" className={`mk-demo-dd-link${active === 'demo' ? ' active' : ''}`}>
              Live Demo{' '}
              <span className="mk-demo-caret" aria-hidden>
                <svg viewBox="0 0 10 10">
                  <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </a>
            <div className="mk-demo-menu">
              <div className="mk-demo-menu-inner">
                {MARKETING_DEMO_NAV_ITEMS.map((item) => (
                  <a key={item.href} href={item.href} className="mk-demo-item">
                    <span className="mk-demo-item-icon">{item.icon}</span>
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
          <a href="/pricing" className={active === 'pricing' ? 'active' : undefined}>
            Pricing
          </a>
          <a href="/how-it-works" className={active === 'how-it-works' ? 'active' : undefined}>
            How It Works
          </a>
          <a href="/contact" className={active === 'contact' ? 'active' : undefined}>
            Contact
          </a>
        </div>
        <div className="mk-nav-right">
          <MarketingMobileNav active={active} />
          <NavActionsClient />
        </div>
      </div>
    </nav>
  );
}

export function MarketingFooter() {
  const socialLinks = [
    { label: 'YouTube', href: siteConfig.socialLinks.youtube, icon: socialIconPaths.youtube },
    { label: 'LinkedIn', href: siteConfig.socialLinks.linkedin, icon: socialIconPaths.linkedin },
    { label: 'X', href: siteConfig.socialLinks.twitter, icon: socialIconPaths.twitter },
    { label: 'Facebook', href: siteConfig.socialLinks.facebook, icon: socialIconPaths.facebook },
    { label: 'Instagram', href: siteConfig.socialLinks.instagram, icon: socialIconPaths.instagram },
  ].filter((link) => link.href);

  return (
    <>
    <footer className="mk-footer">
      <div className="mk-footer-inner">
        <div className="mk-footer-brand-block">
          <div className="mk-footer-brand">
            <div className="mk-nav-logo-icon mk-footer-logo">
              <div className="mk-nav-ripple mk-nav-ripple-3" />
              <div className="mk-nav-ripple mk-nav-ripple-2" />
              <div className="mk-nav-ripple-core">
                <svg viewBox="0 0 24 24">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
              </div>
            </div>
            RingBooker
          </div>
          <p className="mk-footer-desc">
            AI phone answering and call recovery for nail salons, hair salons, spas, med spas, and beauty clinics — after-hours, peak-hour overflow, and missed-call follow-up on your current number.
          </p>
          {socialLinks.length > 0 ? (
            <div className="mk-footer-social">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  className="mk-soc-btn"
                  href={link.href}
                  aria-label={`${siteConfig.name} on ${link.label}`}
                  rel="me noopener noreferrer"
                  target="_blank"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={link.icon} />
                  </svg>
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <nav className="mk-footer-links" aria-label="Footer">
          <div className="mk-footer-col">
            <h4>Product</h4>
            <a href="/#features">Features</a>
            <a href="/pricing">Pricing</a>
            <a href="/how-it-works">How It Works</a>
            <a href="/demo" data-demo-picker>
              Live Demo
            </a>
            <a href="/user/login">Sign In</a>
          </div>
          <div className="mk-footer-col">
            <h4>Solutions</h4>
            <a href="/missed-booking-protection">Missed Booking Protection</a>
            <a href="/current-number">Current Number</a>
            <a href="/works-with">Works With</a>
            <a href="/compare">Compare</a>
            <a href="/trust">Trust</a>
          </div>
          <div className="mk-footer-col">
            <h4>Industries</h4>
            {MARKETING_INDUSTRY_NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
          <div className="mk-footer-col">
            <h4>Resources</h4>
            <a href="/blog">Blog</a>
            <a href="/current-number/call-forwarding">Call Forwarding Guides</a>
            <a href="/faq">FAQ</a>
            <a href="/contact">Contact</a>
          </div>
        </nav>
        <div className="mk-footer-bottom">
          <p className="mk-footer-copy">© 2025 RingBooker — All rights reserved.</p>
          <div className="mk-footer-bottom-right">
            <nav className="mk-footer-legal" aria-label="Legal">
              <a href="/privacy">Privacy Policy</a>
              <span className="mk-footer-legal-sep" aria-hidden="true">
                ·
              </span>
              <a href="/terms">Terms of Service</a>
              <span className="mk-footer-legal-sep" aria-hidden="true">
                ·
              </span>
              <a href="/refund">Refund Policy</a>
            </nav>
            <p className="mk-footer-tagline">Built for salon users 💜</p>
          </div>
        </div>
      </div>
    </footer>
    <DemoPickerLazy />
    </>
  );
}
