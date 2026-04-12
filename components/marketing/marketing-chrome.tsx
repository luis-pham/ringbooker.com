import { DemoPickerLazy } from '@/components/marketing/demo-picker-lazy';
import { siteConfig } from '@/lib/site';

type MarketingHeaderProps = {
  active?: 'demo' | 'pricing' | 'how-it-works' | 'contact';
};

const socialIconPaths = {
  twitter:
    'M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z',
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
.mk-nav{position:fixed;top:0;left:0;right:0;z-index:1000;background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-bottom:1px solid rgba(229,231,235,.7);height:68px;display:flex;align-items:center;justify-content:center;padding:0 48px}
.mk-nav-inner{width:100%;max-width:1160px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.mk-nav-logo{display:flex;align-items:center;gap:11px;font-weight:800;font-size:19px;color:#111827;text-decoration:none}
.mk-nav-logo-icon{position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.mk-nav-ripple{position:absolute;border-radius:50%;background:#8B5CF6}
.mk-nav-ripple-3{width:38px;height:38px;opacity:.1}
.mk-nav-ripple-2{width:30px;height:30px;opacity:.18}
.mk-nav-ripple-core{width:24px;height:24px;background:#8B5CF6;border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;z-index:1}
.mk-nav-ripple-core svg{width:13px;height:13px;fill:#fff}
.mk-nav-links{display:flex;align-items:center;gap:28px;flex-wrap:wrap}
.mk-nav-links a{font-size:14.5px;font-weight:500;color:#6B7280;text-decoration:none;transition:color .2s}
.mk-nav-links a:hover,.mk-nav-links a.active{color:#111827}
.mk-nav-actions{display:flex;align-items:center;gap:10px;white-space:nowrap}
.mk-nav-signin{padding:9px 16px;border-radius:999px;border:1px solid #E5E7EB;font-size:14px;font-weight:600;color:#374151;text-decoration:none;background:#fff;transition:border-color .2s,color .2s,background .2s}
.mk-nav-signin:hover{border-color:#D1D5DB;color:#111827;background:#F9FAFB}
.mk-nav-cta{background:#111827;color:#fff;padding:10px 22px;border-radius:999px;font-size:14px;font-weight:600;display:flex;align-items:center;gap:7px;transition:background .2s,transform .15s;white-space:nowrap;text-decoration:none}
.mk-nav-cta:hover{background:#1f2937;transform:scale(1.03)}
.mk-footer{background:#F9FAFB;border-top:1px solid #E5E7EB;padding:60px 48px 32px}
.mk-footer-inner{max-width:1100px;margin:0 auto}
.mk-footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:50px}
.mk-footer-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:17px;margin-bottom:14px}
.mk-footer-logo{width:34px;height:34px}
.mk-footer-logo .mk-nav-ripple-3{width:34px;height:34px}
.mk-footer-logo .mk-nav-ripple-2{width:26px;height:26px}
.mk-footer-logo .mk-nav-ripple-core{width:21px;height:21px}
.mk-footer-logo .mk-nav-ripple-core svg{width:11px;height:11px}
.mk-footer-desc{font-size:13.5px;color:#6B7280;line-height:1.65;margin-bottom:20px}
.mk-footer-social{display:flex;gap:10px}
.mk-soc-btn{width:36px;height:36px;border-radius:50%;border:1px solid #E5E7EB;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;text-decoration:none}
.mk-soc-btn:hover{border-color:#8B5CF6;background:#F5F3FF}
.mk-soc-btn svg{width:14px;height:14px;fill:#6B7280}
.mk-soc-btn:hover svg{fill:#8B5CF6}
.mk-footer-col h4{font-size:11.5px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:.07em;margin-bottom:16px}
.mk-footer-col a{display:block;font-size:13.5px;color:#6B7280;text-decoration:none;margin-bottom:10px;transition:color .2s}
.mk-footer-col a:hover{color:#111827}
.mk-footer-bottom{border-top:1px solid #E5E7EB;padding-top:22px;display:flex;justify-content:space-between;align-items:center}
.mk-footer-bottom p{font-size:14px;color:#9CA3AF}
/* ─── DEMO DROPDOWN ─── */
.mk-demo-dd{position:relative;display:inline-flex;align-items:center}
.mk-demo-dd-link{display:inline-flex;align-items:center;gap:4px;font-size:14.5px;font-weight:500;color:#6B7280;text-decoration:none;transition:color .2s;cursor:pointer;background:none;border:none;padding:0;font-family:inherit}
.mk-demo-dd-link:hover,.mk-demo-dd-link.active{color:#111827}
.mk-demo-caret{font-size:10px;opacity:.55;transition:transform .2s;display:inline-block;margin-top:1px;margin-left:2px}
.mk-demo-dd:hover .mk-demo-caret{transform:rotate(180deg)}
.mk-demo-menu{position:absolute;top:100%;left:50%;transform:translateX(-50%) translateY(-4px);padding-top:12px;opacity:0;pointer-events:none;transition:opacity .18s,transform .18s;z-index:200}
.mk-demo-menu-inner{background:#fff;border:1px solid #E5E7EB;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.12);padding:8px;min-width:210px}
.mk-demo-dd:hover .mk-demo-menu{opacity:1;pointer-events:all;transform:translateX(-50%) translateY(0)}
.mk-demo-item{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:10px;font-size:13.5px;font-weight:600;color:#374151;text-decoration:none;transition:background .15s,color .15s;white-space:nowrap}
.mk-demo-item:hover{background:#F5F3FF;color:#7C3AED}
.mk-demo-item-icon{font-size:16px;width:22px;text-align:center;flex-shrink:0}

/* ─── DEMO PICKER MODAL ─── */
.dpm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:dpmFadeIn .2s ease}
@keyframes dpmFadeIn{from{opacity:0}to{opacity:1}}
.dpm-dialog{background:#fff;border-radius:28px;padding:36px 32px 28px;max-width:560px;width:100%;box-shadow:0 24px 80px rgba(0,0,0,.2);position:relative;animation:dpmSlideUp .25s cubic-bezier(.22,1,.36,1)}
@keyframes dpmSlideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
.dpm-close{position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:50%;border:1px solid #E5E7EB;background:#F9FAFB;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6B7280;transition:all .15s}
.dpm-close:hover{background:#F3F4F6;color:#111827}
.dpm-eyebrow{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8B5CF6;margin-bottom:8px}
.dpm-title{font-size:20px;font-weight:800;color:#111827;letter-spacing:-.4px;margin-bottom:6px;line-height:1.3}
.dpm-sub{font-size:14px;color:#6B7280;margin-bottom:22px;line-height:1.6}
.dpm-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:20px}
.dpm-card{display:flex;flex-direction:column;gap:2px;padding:14px 14px 28px;border-radius:16px;border:1.5px solid color-mix(in srgb,var(--dpm-accent,#8B5CF6) 25%,#E5E7EB);background:color-mix(in srgb,var(--dpm-accent,#8B5CF6) 5%,#fff);text-decoration:none;transition:all .15s;position:relative;overflow:hidden}
.dpm-card-nail-salon{--dpm-accent:#7C3AED}
.dpm-card-hair-salon{--dpm-accent:#B45309}
.dpm-card-day-spa{--dpm-accent:#0D9488}
.dpm-card-med-spa{--dpm-accent:#4F46E5}
.dpm-card-beauty-clinic{--dpm-accent:#A21CAF}
.dpm-card:hover{border-color:var(--dpm-accent,#8B5CF6);background:color-mix(in srgb,var(--dpm-accent,#8B5CF6) 10%,#fff);transform:translateY(-1px);box-shadow:0 6px 20px color-mix(in srgb,var(--dpm-accent,#8B5CF6) 15%,transparent)}
.dpm-icon{font-size:22px;margin-bottom:5px;display:block}
.dpm-label{font-size:14px;font-weight:800;color:#111827;display:block}
.dpm-card-sub{font-size:11.5px;color:#6B7280;line-height:1.4;display:block}
.dpm-arrow{position:absolute;bottom:12px;right:12px;font-size:13px;font-weight:800;color:var(--dpm-accent,#8B5CF6);opacity:0;transition:.15s;transform:translateX(-4px)}
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

@media(max-width:960px){
  .mk-nav{padding:0 22px}
  .mk-nav-links{display:none}
  .mk-nav-signin{display:none}
  .mk-footer{padding-left:22px;padding-right:22px}
  .mk-footer-grid{grid-template-columns:1fr}
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
          <a href="/#industries">
            Industries
          </a>
          <div className="mk-demo-dd">
            <a href="/demo" className={`mk-demo-dd-link${active === 'demo' ? ' active' : ''}`}>
              Live Demo <span className="mk-demo-caret">▾</span>
            </a>
            <div className="mk-demo-menu">
              <div className="mk-demo-menu-inner">
                <a href="/demo/nail-salon" className="mk-demo-item"><span className="mk-demo-item-icon">💅</span>Nail Salon</a>
                <a href="/demo/hair-salon" className="mk-demo-item"><span className="mk-demo-item-icon">✂️</span>Hair Salon</a>
                <a href="/demo/day-spa" className="mk-demo-item"><span className="mk-demo-item-icon">🧖</span>Day Spa</a>
                <a href="/demo/med-spa" className="mk-demo-item"><span className="mk-demo-item-icon">💉</span>Med Spa</a>
                <a href="/demo/beauty-clinic" className="mk-demo-item"><span className="mk-demo-item-icon">✨</span>Beauty Clinic</a>
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
        <div className="mk-nav-actions">
          <a href="/user/login" className="mk-nav-signin">
            Sign In
          </a>
          <a href="/user/signup" className="mk-nav-cta">
            Start Free Trial →
          </a>
        </div>
      </div>
    </nav>
  );
}

export function MarketingFooter() {
  const socialLinks = [
    { label: 'Twitter', href: siteConfig.socialLinks.twitter, icon: socialIconPaths.twitter },
    { label: 'LinkedIn', href: siteConfig.socialLinks.linkedin, icon: socialIconPaths.linkedin },
    { label: 'Facebook', href: siteConfig.socialLinks.facebook, icon: socialIconPaths.facebook },
    { label: 'Instagram', href: siteConfig.socialLinks.instagram, icon: socialIconPaths.instagram },
    { label: 'YouTube', href: siteConfig.socialLinks.youtube, icon: socialIconPaths.youtube },
  ].filter((link) => link.href);

  return (
    <>
    <footer className="mk-footer">
      <div className="mk-footer-inner">
        <div className="mk-footer-grid">
          <div>
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
              AI phone answering service for salons, nail shops, spas, med spas, and appointment-based businesses. Stop losing after-hours and overflow calls to voicemail.
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
          <div className="mk-footer-col">
            <h4>Product</h4>
            <a href="/#features">Features</a>
            <a href="/#industries">Industries</a>
            <a href="/demo" data-demo-picker>Live Demo</a>
            <a href="/pricing">Pricing</a>
            <a href="/how-it-works">How It Works</a>
            <a href="/user/login">Sign In</a>
          </div>
          <div className="mk-footer-col">
            <h4>Resources</h4>
            <a href="/blog">Blog</a>
            <a href="/after-hours-calls">After-Hours Calls</a>
            <a href="/missed-call-recovery">Missed-Call Recovery</a>
            <a href="/demo" data-demo-picker>Live Demo</a>
            <a href="/pricing">Pricing</a>
            <a href="/faq">FAQ</a>
          </div>
          <div className="mk-footer-col">
            <h4>Company</h4>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
            <a href="/refund">Refund Policy</a>
            <a href="/contact">Support</a>
            <a href="/contact">Contact</a>
            <a href="/user/login">Sign In</a>
          </div>
        </div>
        <div className="mk-footer-bottom">
          <p>© 2025 RingBooker — All rights reserved.</p>
          <p>Built for salon users 💜</p>
        </div>
      </div>
    </footer>
    <DemoPickerLazy />
    </>
  );
}
