import Script from 'next/script';

import { MarketingFaqAccordion, type MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { buildFaqPageJsonLd } from '@/lib/seo/faq-page-jsonld';

const styles: string[] = [
  String.raw`
:root{
  --purple:#8B5CF6;
  --purple-dark:#7C3AED;
  --purple-light:#EDE9FE;
  --purple-ultra:#F5F3FF;
  --text-dark:#111827;
  --text-gray:#6B7280;
  --text-light:#9CA3AF;
  --bg:#fff;
  --bg-gray:#F9FAFB;
  --border:#E5E7EB;
  --green:#10B981;
  --r-pill:999px;
  --r-lg:24px;
  --shadow:0 16px 48px rgba(17,24,39,.07);
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Mona Sans Variable',sans-serif;color:var(--text-dark);background:var(--bg);overflow-x:hidden;font-size:var(--mk-font-body);line-height:var(--mk-leading-body)}
a{text-decoration:none;color:inherit}
.contact-page{background:#fff}
.hero-page{padding:76px 48px 72px;background:radial-gradient(ellipse 80% 55% at 50% 0%,#EDE9FE 0%,#FDF4FF 45%,#fff 74%)}
.container{max-width:1100px;margin:0 auto}
.contact-grid{display:grid;grid-template-columns:.86fr 1.14fr;gap:34px;align-items:start}
.hero-copy{padding-top:18px}
.badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.88);border:1px solid rgba(139,92,246,0.28);border-radius:var(--r-pill);padding:7px 18px;font-size:var(--mk-badge);font-weight:700;color:var(--purple-dark);margin-bottom:22px;backdrop-filter:blur(8px)}
.pulse-dot{width:7px;height:7px;background:var(--purple);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
.hero-copy h1{font-size:var(--mk-hero-title);font-weight:800;line-height:var(--mk-hero-title-lh);letter-spacing:var(--mk-hero-title-track);margin-bottom:18px}
.hero-copy p{font-size:var(--mk-hero-lead);color:var(--text-gray);max-width:540px;margin-bottom:24px;line-height:var(--mk-hero-lead-lh)}
.trust-list{display:grid;gap:12px;margin-top:22px;max-width:520px}
.trust-item{display:flex;gap:12px;align-items:flex-start;border:1px solid rgba(139,92,246,.13);background:rgba(255,255,255,.72);border-radius:18px;padding:14px 15px;box-shadow:0 10px 28px rgba(17,24,39,.04)}
.trust-icon{width:36px;height:36px;border-radius:13px;background:var(--purple-ultra);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.mini-icon{width:36px;height:36px;border-radius:50%;background:var(--purple);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;font-weight:900;box-shadow:0 8px 20px rgba(124,58,237,.28)}
.trust-item strong{display:block;font-size:var(--mk-body);margin-bottom:2px}
.trust-item span{display:block;font-size:var(--mk-body-sm);color:var(--text-gray);line-height:1.55}
.formshell{background:#fff;border:1px solid var(--border);border-radius:30px;padding:28px;box-shadow:0 24px 70px rgba(17,24,39,.11)}
.form-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:22px}
.form-head h2{font-size:var(--mk-article-h2);line-height:var(--mk-article-h2-lh);letter-spacing:var(--mk-article-h2-track);margin-bottom:7px}
.form-head p{font-size:var(--mk-body);color:var(--text-gray);line-height:var(--mk-body-lh)}
.form-chip{display:inline-flex;align-items:center;border-radius:999px;background:#ecfdf5;color:#047857;padding:7px 11px;font-size:12px;font-weight:900;white-space:nowrap}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}
.field{display:flex;flex-direction:column;gap:8px}
.field label{font-size:var(--mk-meta);font-weight:800;color:var(--text-dark)}
.field input,.field textarea,.field select{width:100%;border:1px solid var(--border);border-radius:14px;padding:14px 15px;font:inherit;color:var(--text-dark);background:#fff}
.field input:focus,.field textarea:focus,.field select:focus{outline:none;border-color:#c4b5fd;box-shadow:0 0 0 4px rgba(139,92,246,.08)}
.field textarea{min-height:96px;resize:vertical}
.field.full{grid-column:1/-1}
.helper{font-size:var(--mk-meta);color:var(--text-light);line-height:1.55}
.contact-honeypot{display:none}
.contact-form-actions{margin-top:18px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.btn-dark,.btn-outline{padding:14px 24px;border-radius:var(--r-pill);font-size:var(--mk-btn);font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:all .2s;border:none;cursor:pointer}
.btn-dark{background:var(--text-dark);color:#fff}
.btn-dark:hover{background:#1f2937;transform:translateY(-1px)}
.btn-dark:disabled{opacity:.6;cursor:not-allowed;transform:none}
.btn-outline{border:1.5px solid var(--border);color:var(--text-dark);background:#fff}
.section{padding:58px 48px 82px}
.next-card{border:none;border-radius:30px;background:#fff;box-shadow:none;padding:26px}
.next-title{font-size:var(--mk-article-h2);line-height:1.2;letter-spacing:var(--mk-article-h2-track);text-align:center;margin-bottom:10px}
.next-sub{font-size:var(--mk-btn);color:var(--text-gray);text-align:center;line-height:1.7;max-width:660px;margin:0 auto 24px}
.mini-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.mini-item{border:1px solid var(--border);border-radius:20px;padding:18px;text-align:center;background:#fff}
.mini-icon{margin:0 auto 12px}
.mini-item strong{display:block;font-size:var(--mk-btn);margin-bottom:5px}
.mini-item span{font-size:var(--mk-meta);color:var(--text-gray);line-height:1.55}
.next-steps-mobile-nav{display:none}
.next-steps-mobile-nav a{display:inline-flex;align-items:center;justify-content:center;min-width:84px;padding:8px 12px;border-radius:999px;border:1px solid var(--border);background:#fff;color:var(--text-gray);font-size:12px;font-weight:800;white-space:nowrap}
.mini-item:target{border-color:#c4b5fd;box-shadow:0 0 0 3px rgba(139,92,246,.1)}
.closing-line{margin-top:18px;text-align:center;font-size:var(--mk-body);color:var(--text-gray)}
@media(max-width:960px){
  .hero-page,.section{padding-left:22px;padding-right:22px}
  .hero-page{padding-top:54px;padding-bottom:52px}
  .contact-grid,.form-grid,.mini-grid{grid-template-columns:1fr}
  .hero-copy{padding-top:0}
  .formshell{padding:22px;border-radius:26px}
  .form-head{display:block}
  .form-chip{margin-top:12px}
  .btn-dark{width:100%}
  .next-steps-mobile-nav{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 8px;margin:0 0 12px}
  .mini-grid{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 2px 8px}
  .mini-item{min-width:84%;scroll-snap-align:center}
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
        if (error === 'rate_limited') {
          setHelper('Too many requests. Please wait before submitting again.', 'error');
        } else if (error === 'captcha_failed') {
          setHelper('Captcha verification failed. Please try again.', 'error');
        } else {
          setHelper('Unable to submit right now. Please try again in a moment.', 'error');
        }
      } else {
        form.reset();
        setHelper('Thanks. Your request was received. We will reach out shortly.', 'success');
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
      captchaMount.innerHTML = '<div class="helper">Captcha is not configured here. Local development bypass is active.</div>';
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
                  <div className="badge"><span className="pulse-dot" />Book a RingBooker demo</div>
                  <h1>See How RingBooker Stops Booking Revenue from Leaking</h1>
                  <p>Tell us how calls behave today — after-hours rings, busy Saturday overflow, consult inquiries, reschedules — and we’ll show how RingBooker protects booking revenue with a setup your team can configure in about 15 minutes.</p>
                  <div className="trust-list">
                    <div className="trust-item"><div className="trust-icon">🏪</div><div><strong>Works with your current number</strong><span>Forward the line clients already dial; a dedicated RingBooker number stays optional.</span></div></div>
                    <div className="trust-item"><div className="trust-icon">📅</div><div><strong>No new booking software</strong><span>Square Appointments is live today; other booking tools can start with summaries and handoff while your workflow stays in place.</span></div></div>
                    <div className="trust-item"><div className="trust-icon">💬</div><div><strong>Revenue recovery, not generic chat</strong><span>After-hours answering, overflow coverage, and missed-call text back tuned to recover booking intent.</span></div></div>
                  </div>
                </div>

                <div className="formshell" id="book-demo">
                  <div className="form-head">
                    <div>
                      <h2>Request a walkthrough</h2>
                      <p>Most people finish this in under a minute. We’ll review your setup and focus the call on recovering revenue lost to voicemail, busy lines, and hang-ups.</p>
                    </div>
                    <span className="form-chip">Low-pressure walkthrough</span>
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
                        <input id="contactBestTime" placeholder="Example: Weekdays after 3 PM PST" required />
                      </div>
                      <div className="field full">
                        <label htmlFor="contactHelpNeed">Anything we should know? <span className="helper">(optional)</span></label>
                        <textarea
                          id="contactHelpNeed"
                          placeholder="Example: We miss calls during peak service hours, especially Saturdays."
                          defaultValue=""
                        />
                      </div>
                      <div className="field full contact-honeypot"><label htmlFor="contactWebsite">Website</label><input id="contactWebsite" autoComplete="off" tabIndex={-1} /></div>
                      <div className="field full"><div id="contactTurnstileMount" /></div>
                    </div>
                    <div className="contact-form-actions">
                      <button id="contactSubmitButton" type="submit" className="btn-dark">Submit request →</button>
                      <span className="helper" id="contactHelper">Protected by captcha and rate limits.</span>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <div className="next-card">
                <h2 className="next-title">What happens next</h2>
                <p className="next-sub">We keep it practical: confirm your number and booking setup, walk the recovery flow on a sample call, then map whether Starter or Professional fits your overflow and after-hours volume.</p>
                <div className="next-steps-mobile-nav" role="tablist" aria-label="What happens next steps">
                  <a href="#contact-next-step-1">Step 1</a>
                  <a href="#contact-next-step-2">Step 2</a>
                  <a href="#contact-next-step-3">Step 3</a>
                </div>
                <div className="mini-grid">
                  <div className="mini-item" id="contact-next-step-1"><div className="mini-icon">1</div><strong>We review your setup</strong><span>Business type, main call issue, and current-number needs.</span></div>
                  <div className="mini-item" id="contact-next-step-2"><div className="mini-icon">2</div><strong>You get a tailored walkthrough</strong><span>Focused on the calls your team is actually missing.</span></div>
                  <div className="mini-item" id="contact-next-step-3"><div className="mini-icon">3</div><strong>You choose the next step</strong><span>Start a trial, map a custom setup, or wait until you are ready.</span></div>
                </div>
                <p className="closing-line">Built for nail salons, hair salons, day spas, med spas, and beauty clinics.</p>
              </div>
            </div>
          </section>

          <MarketingFaqAccordion
            items={CONTACT_FAQ_ITEMS}
            eyebrow="Common Questions"
            title="Before you book a walkthrough"
            subtitle={null}
            embedded
          />
        </main>
        <MarketingFooter />
        {contactFaqJsonLd ? (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactFaqJsonLd) }} />
        ) : null}
      </>

    </MarketingLayout>
  );
}
