import Script from 'next/script';

import { MarketingFaqAccordion, type MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { buildFaqPageJsonLd } from '@/lib/seo/faq-page-jsonld';

const styles: string[] = [
  String.raw`
:root{
  --purple:var(--mk-brand-purple,#8B5CF6);
  --purple-dark:var(--mk-brand-purple-dark,#7C3AED);
  --purple-light:var(--mk-brand-purple-soft,#EDE9FE);
  --purple-ultra:var(--mk-brand-purple-wash,#F5F3FF);
  --text-dark:var(--mk-text-strong,#111827);
  --text-gray:var(--mk-text-muted,#64748B);
  --text-light:var(--mk-text-soft,#94A3B8);
  --bg:var(--mk-bg-page,#fff);
  --bg-gray:var(--mk-bg-section,#F9FAFB);
  --border:var(--mk-border-soft,#E8ECF1);
  --green:var(--mk-brand-green,#10B981);
  --r-pill:var(--mk-radius-pill,999px);
  --r-lg:var(--mk-radius-card,22px);
  --shadow:var(--mk-shadow-soft,0 20px 40px -8px rgba(17,24,39,.06),0 8px 16px -6px rgba(17,24,39,.04));
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Mona Sans Variable',sans-serif;color:var(--text-dark);background:var(--bg);overflow-x:hidden;font-size:var(--mk-font-body);line-height:var(--mk-leading-body)}
a{text-decoration:none;color:inherit}
.contact-page{background:#fff}
.hero-page{padding:112px 48px 72px;background:radial-gradient(ellipse 80% 55% at 50% 0%,#EDE9FE 0%,#FDF4FF 45%,#fff 74%)}
.container{max-width:var(--mk-container-tight,1100px);margin:0 auto}
.contact-grid{display:grid;grid-template-columns:.86fr 1.14fr;gap:34px;align-items:start}
.hero-copy{padding-top:18px}
.badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.88);border:1px solid rgba(139,92,246,0.28);border-radius:var(--r-pill);padding:7px 18px;font-size:var(--mk-eyebrow);font-weight:700;line-height:1.2;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;color:var(--purple-dark);margin-bottom:22px;backdrop-filter:blur(8px)}
.pulse-dot{width:7px;height:7px;background:var(--purple);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
.hero-copy h1{font-size:var(--mk-hero-title);font-weight:800;line-height:var(--mk-hero-title-lh);letter-spacing:var(--mk-hero-title-track);margin-bottom:18px}
.hero-copy p{font-size:var(--mk-hero-lead);color:var(--mk-text-desc,#64748B);max-width:540px;margin-bottom:24px;line-height:var(--mk-hero-lead-lh);font-weight:400}
.trust-list{display:grid;gap:10px;margin-top:22px;max-width:520px}
.trust-item{
  display:flex;
  gap:10px;
  align-items:flex-start;
  border:none;
  background:transparent;
  border-radius:0;
  padding:0;
  box-shadow:none;
}
.trust-item::before{content:'✓';color:#10B981;font-weight:700;line-height:1.2;flex-shrink:0;margin-top:1px}
.trust-icon{width:36px;height:36px;border-radius:13px;background:var(--purple-ultra);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.mini-icon{width:36px;height:36px;border-radius:50%;background:var(--purple);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;font-weight:700;box-shadow:0 6px 18px rgba(124,58,237,.24)}
.trust-item strong{display:block;font-size:var(--mk-body);margin-bottom:2px}
.trust-item span{display:block;font-size:var(--mk-body-sm);color:var(--text-gray);line-height:1.55}
.formshell{margin-top:18px;background:#fff;border:1px solid var(--border);border-radius:var(--mk-radius-panel,28px);padding:28px;box-shadow:var(--mk-shadow-soft,0 20px 40px -8px rgba(17,24,39,.06),0 8px 16px -6px rgba(17,24,39,.04)),0 1px 3px rgba(0,0,0,.04)}
.form-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:22px}
.form-head h2{font-size:var(--mk-article-h2);line-height:var(--mk-article-h2-lh);letter-spacing:var(--mk-article-h2-track);margin-bottom:7px}
.form-head p{font-size:var(--mk-body);color:var(--text-gray);line-height:var(--mk-body-lh)}
.form-chip{display:inline-flex;align-items:center;border-radius:999px;background:#ecfdf5;color:#047857;padding:7px 11px;font-size:12px;font-weight:700;white-space:nowrap}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}
.field{display:flex;flex-direction:column;gap:8px}
.field label{font-size:var(--mk-meta);font-weight:700;color:var(--text-dark)}
.field input,.field textarea,.field select{width:100%;border:1px solid var(--border);border-radius:var(--mk-radius-input,16px);padding:14px 15px;font:inherit;color:var(--text-dark);background:#fff}
.field input:focus,.field textarea:focus,.field select:focus{outline:none;border-color:#c4b5fd;box-shadow:var(--mk-focus-ring,0 0 0 4px rgba(139,92,246,.08))}
.field textarea{min-height:96px;resize:vertical}
.field.full{grid-column:1/-1}
.helper{font-size:var(--mk-meta);color:var(--text-light);line-height:1.55}
.contact-honeypot{display:none}
.contact-form-actions{margin-top:18px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.btn-dark,.btn-outline{padding:14px 24px;border-radius:var(--r-pill);font-size:var(--mk-btn);font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:all .2s;border:none;cursor:pointer}
.btn-dark{background:var(--text-dark);color:#fff}
.btn-dark:hover{background:#1f2937;transform:translateY(-1px)}
.btn-dark:disabled{opacity:.6;cursor:not-allowed;transform:none}
.btn-outline{border:1.5px solid var(--border);color:var(--text-dark);background:#fff}
.section{padding:64px 48px 82px}
@media(max-width:960px){
  .hero-page,.section{padding-left:22px;padding-right:22px}
  .hero-page{padding-top:calc(69px + 28px + env(safe-area-inset-top,0px));padding-bottom:52px}
  .contact-grid,.form-grid{grid-template-columns:1fr}
  .hero-copy{padding-top:0}
  .trust-list{display:none}
  .formshell{margin-top:0;padding:22px;border-radius:26px}
  .form-head{display:block}
  .form-chip{margin-top:12px}
  .btn-dark{width:100%}
}
@media(max-width:640px){
  .section{padding-top:var(--mk-space-section-y-mobile,56px);padding-bottom:64px}
  .hero-copy h1{font-size:clamp(30px,8vw,40px)}
  .hero-copy p{font-size:16px}
  .formshell{padding:20px;border-radius:var(--mk-radius-card,22px)}
  .contact-form-actions{flex-direction:column;align-items:stretch}
  .contact-form-actions > *{width:100%}
}
`,
];

const CONTACT_FAQ_ITEMS: MarketingFaqItem[] = [
  {
    q: 'What happens after I submit this form?',
    a: 'We review your business type and main call issue, then reach out to schedule a walkthrough focused on after-hours, overflow, and missed-call recovery on your current number.',
  },
  {
    q: 'Do I need a new phone number?',
    a: 'No. RingBooker is designed to work with your existing business number through call forwarding. A dedicated RingBooker line remains optional.',
  },
  {
    q: 'Will this replace my booking software?',
    a: 'No. RingBooker sits on the phone layer and works alongside your booking workflow. Square Appointments is live today; other tools can start with summaries and handoff.',
  },
  {
    q: 'Is the demo high pressure?',
    a: 'No. The walkthrough is practical: we confirm your setup, show how calls are handled, and you choose whether to start a trial or pause until you are ready.',
  },
  {
    q: 'Which business types do you support?',
    a: 'Nail salons, hair salons, day spas, med spas, and beauty or aesthetic clinics — anywhere phone calls still drive bookings and missed rings mean lost revenue.',
  },
];

const contactFaqJsonLd = buildFaqPageJsonLd(CONTACT_FAQ_ITEMS);
const contactBreadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://ringbooker.com/' },
    { '@type': 'ListItem', position: 2, name: 'Contact', item: 'https://ringbooker.com/contact' },
  ],
};

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';

const scripts: string[] = [
  String.raw`
(() => {
  const form = document.getElementById('contactRequestForm');
  const helper = document.getElementById('contactHelper');
  const submitButton = document.getElementById('contactSubmitButton');
  const captchaMount = document.getElementById('contactTurnstileMount');
  if (!form || !helper || !submitButton) return;

  const ensureSessionId = () => {
    const key = 'rb_contact_session_id';
    try {
      const existing = window.localStorage.getItem(key);
      if (existing && existing.length >= 8) return existing;
      const next = (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'session-' + Date.now());
      window.localStorage.setItem(key, next);
      return next;
    } catch {
      return 'session-' + Date.now();
    }
  };

  const getCaptchaToken = () => {
    if (${JSON.stringify(turnstileSiteKey)} && window.__rbContactCaptchaToken) {
      return window.__rbContactCaptchaToken;
    }
    return 'dev-turnstile-bypass';
  };

  const setHelper = (message, tone = 'muted') => {
    helper.textContent = message;
    helper.style.color =
      tone === 'error' ? '#B91C1C' :
      tone === 'success' ? '#166534' :
      '#6B7280';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fullName = document.getElementById('contactFullName')?.value?.trim() ?? '';
    const businessName = document.getElementById('contactBusinessName')?.value?.trim() ?? '';
    const email = document.getElementById('contactEmail')?.value?.trim() ?? '';
    const phoneNumber = document.getElementById('contactPhoneNumber')?.value?.trim() ?? '';
    const businessType = document.getElementById('contactBusinessType')?.value?.trim() ?? '';
    const currentSetup = document.getElementById('contactCurrentSetup')?.value?.trim() ?? '';
    const helpNeed = document.getElementById('contactHelpNeed')?.value?.trim() || 'No extra details provided.';
    const bestTime = document.getElementById('contactBestTime')?.value?.trim() ?? '';
    const website = document.getElementById('contactWebsite')?.value?.trim() ?? '';

    if (!fullName || !businessName || !email || !phoneNumber || !businessType || !currentSetup || !bestTime) {
      setHelper('Please complete the required fields.', 'error');
      return;
    }

    const captchaToken = getCaptchaToken();
    if (!captchaToken) {
      setHelper('Please complete captcha before submitting.', 'error');
      return;
    }

    submitButton.setAttribute('disabled', 'true');
    setHelper('Submitting your request...');
    try {
      const response = await fetch('/api/backend/public/contact/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          businessName,
          email,
          phoneNumber,
          businessType,
          currentSetup,
          helpNeed,
          bestTime,
          captchaToken,
          sessionId: ensureSessionId(),
          website,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        const error = data?.error || 'submit_failed';
        if (typeof data?.message === 'string' && data.message.trim()) {
          setHelper(data.message.trim(), 'error');
        } else if (error === 'rate_limited') {
          setHelper('Too many requests. Please wait before submitting again.', 'error');
        } else if (error === 'captcha_failed') {
          setHelper('Captcha verification failed. Please try again.', 'error');
        } else {
          setHelper('Unable to submit right now. Please try again in a moment.', 'error');
        }
      } else {
        form.reset();
        window.location.assign('/thank-you');
      }
    } catch {
      setHelper('Network error. Please try again.', 'error');
    } finally {
      submitButton.removeAttribute('disabled');
      if (${JSON.stringify(turnstileSiteKey)} && window.turnstile && window.__rbContactTurnstileWidgetId) {
        try {
          window.turnstile.reset(window.__rbContactTurnstileWidgetId);
          window.__rbContactCaptchaToken = '';
        } catch {}
      }
    }
  });

  const renderTurnstile = () => {
    if (!captchaMount) return;
    if (!${JSON.stringify(turnstileSiteKey)}) {
      captchaMount.innerHTML = '';
      window.__rbContactCaptchaToken = 'dev-turnstile-bypass';
      return;
    }
    if (!window.turnstile || captchaMount.dataset.rendered === 'true') return;
    const widgetId = window.turnstile.render(captchaMount, {
      sitekey: ${JSON.stringify(turnstileSiteKey)},
      theme: 'light',
      callback: (token) => {
        window.__rbContactCaptchaToken = token;
      },
      'expired-callback': () => {
        window.__rbContactCaptchaToken = '';
      },
      'error-callback': () => {
        window.__rbContactCaptchaToken = '';
      },
    });
    window.__rbContactTurnstileWidgetId = widgetId;
    captchaMount.dataset.rendered = 'true';
  };

  if (${JSON.stringify(turnstileSiteKey)}) {
    const interval = window.setInterval(() => {
      if (window.turnstile) {
        window.clearInterval(interval);
        renderTurnstile();
      }
    }, 200);
  } else {
    renderTurnstile();
  }

})();
`,
];

export const templateTitle = 'Book a RingBooker Demo | See How to Recover Missed Bookings and Revenue';

export function MarketingContactTemplate() {
  return (
    <MarketingLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="marketing-contact"
    >
      <>
        <MarketingChromeStyles />
        {turnstileSiteKey ? (
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
        ) : null}
        <MarketingHeader active="contact" />
        <main className="contact-page">
          <section className="hero-page">
            <div className="container">
              <div className="contact-grid">
                <div className="hero-copy">
                  <nav aria-label="Breadcrumb" style={{ marginBottom: 12, fontSize: 14, lineHeight: 1.35, color: 'var(--mk-text-soft,#94a3b8)' }}>
                    <a href="/" style={{ color: 'var(--mk-text-soft,#94a3b8)', textDecoration: 'none', fontWeight: 400 }}>Home</a>
                    <span style={{ margin: '0 6px' }}>›</span>
                    <span style={{ color: 'var(--mk-text-soft,#94a3b8)', fontWeight: 400 }}>Contact</span>
                  </nav>
                  <div className="badge">Book a demo</div>
                  <h1>See How RingBooker Recovers Missed Bookings</h1>
                  <p>Tell us how your calls work today—after-hours, overflow, reschedules, or consults—and we&apos;ll show how RingBooker fits your workflow in about 15 minutes.</p>
                  <div className="trust-list">
                    <div className="trust-item"><div><strong>Keep your current number</strong><span>Forward the number clients already call.</span></div></div>
                    <div className="trust-item"><div><strong>No new booking software</strong><span>Works with your current workflow.</span></div></div>
                    <div className="trust-item"><div><strong>Built for booking recovery</strong><span>Covers after-hours, overflow, and missed calls.</span></div></div>
                  </div>
                </div>

                <div className="formshell" id="book-demo">
                  <div className="form-head">
                    <div>
                      <h2>Request a demo</h2>
                    </div>
                    <span className="form-chip">Low-pressure demo</span>
                  </div>
                  <form id="contactRequestForm">
                    <div className="form-grid">
                      <div className="field"><label htmlFor="contactFullName">Full name</label><input id="contactFullName" placeholder="Jane Nguyen" required /></div>
                      <div className="field"><label htmlFor="contactBusinessName">Business name</label><input id="contactBusinessName" placeholder="Luxe Hair Studio" required /></div>
                      <div className="field"><label htmlFor="contactEmail">Email</label><input id="contactEmail" type="email" placeholder="jane@luxehair.com" required /></div>
                      <div className="field"><label htmlFor="contactPhoneNumber">Phone number</label><input id="contactPhoneNumber" placeholder="+1 (714) 555-0100" required /></div>
                      <div className="field">
                        <label htmlFor="contactBusinessType">Business type</label>
                        <select id="contactBusinessType" required defaultValue="nail_shop">
                          <option value="nail_shop">Nail salon</option>
                          <option value="hair_salon">Hair salon</option>
                          <option value="spa">Day spa</option>
                          <option value="med_spa">Med spa</option>
                          <option value="beauty_clinic">Beauty clinic</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="contactCurrentSetup">Main need</label>
                        <select id="contactCurrentSetup" required defaultValue="after_hours_overflow">
                          <option value="after_hours_overflow">After-hours or overflow calls</option>
                          <option value="missed_call_text_back">Missed-call text back</option>
                          <option value="reschedules_cancellations">Reschedules or cancellations</option>
                          <option value="current_number_setup">Use my current number</option>
                          <option value="custom_workflow">Custom workflow or multi-location</option>
                        </select>
                      </div>
                      <div className="field full">
                        <label htmlFor="contactBestTime">Best time to reach you</label>
                        <input id="contactBestTime" placeholder="Weekdays after 3 PM PST" required />
                      </div>
                      <div className="field full">
                        <label htmlFor="contactHelpNeed">Anything else? <span className="helper">(optional)</span></label>
                        <textarea
                          id="contactHelpNeed"
                          placeholder="We miss calls during peak hours, especially Saturdays."
                          defaultValue=""
                        />
                      </div>
                      <div className="field full contact-honeypot"><label htmlFor="contactWebsite">Website</label><input id="contactWebsite" autoComplete="off" tabIndex={-1} /></div>
                      <div className="field full"><div id="contactTurnstileMount" /></div>
                    </div>
                    <div className="contact-form-actions">
                      <button id="contactSubmitButton" type="submit" className="btn-dark">Request demo</button>
                      <span className="helper" id="contactHelper">Protected by captcha and rate limits.</span>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <MarketingFaqAccordion
                items={CONTACT_FAQ_ITEMS}
                eyebrow="Common Questions"
                title="Before you book a walkthrough"
                subtitle={null}
                embedded
              />
            </div>
          </section>
        </main>
        <MarketingFooter />
        {contactFaqJsonLd ? (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactFaqJsonLd) }} />
        ) : null}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactBreadcrumbJsonLd) }} />
      </>

    </MarketingLayout>
  );
}
