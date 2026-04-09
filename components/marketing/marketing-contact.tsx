import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import Script from 'next/script';

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
  --orange:#F59E0B;
  --red:#EF4444;
  --r-pill:999px;
  --r-lg:24px;
  --r-md:16px;
  --r-sm:12px;
  --shadow:0 16px 48px rgba(17,24,39,.07);
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Mona Sans Variable',sans-serif;color:var(--text-dark);background:var(--bg);overflow-x:hidden;font-size:16px;line-height:1.6}
a{text-decoration:none;color:inherit}
nav{position:sticky;top:0;left:0;right:0;z-index:100;background:rgba(255,255,255,0.92);backdrop-filter:blur(14px);border-bottom:1px solid rgba(229,231,235,0.7);height:68px;display:flex;align-items:center;justify-content:center;padding:0 48px}
.nav-inner{width:100%;max-width:1100px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.nav-logo{display:flex;align-items:center;gap:11px;font-weight:800;font-size:19px;color:var(--text-dark)}
.nav-logo-icon{position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nav-ripple{position:absolute;border-radius:50%;background:#8B5CF6}
.nav-ripple-3{width:38px;height:38px;opacity:.1}
.nav-ripple-2{width:30px;height:30px;opacity:.18}
.nav-ripple-core{width:24px;height:24px;background:var(--purple);border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;z-index:1}
.nav-ripple-core svg{width:13px;height:13px;fill:#fff}
.nav-links{display:flex;align-items:center;gap:28px;flex-wrap:wrap}
.nav-links a{font-size:14.5px;font-weight:500;color:var(--text-gray);transition:color .2s}
.nav-links a:hover,.nav-links a.active{color:var(--text-dark)}
.nav-actions{display:flex;align-items:center;gap:10px}
.nav-signin{padding:9px 16px;border-radius:var(--r-pill);border:1px solid var(--border);font-size:14px;font-weight:600;color:#374151;background:#fff;transition:border-color .2s,color .2s,background .2s}
.nav-signin:hover{border-color:#d1d5db;color:var(--text-dark);background:#f9fafb}
.nav-cta{background:var(--text-dark);color:#fff;padding:10px 22px;border-radius:var(--r-pill);font-size:14px;font-weight:600;display:flex;align-items:center;gap:7px;transition:background .2s,transform .15s;white-space:nowrap}
.nav-cta:hover{background:#1f2937;transform:scale(1.03)}
.hero-page{padding:88px 48px 48px;display:flex;justify-content:center;background:radial-gradient(ellipse 80% 55% at 50% 0%,#EDE9FE 0%,#FDF4FF 45%,#fff 72%)}
.hero-inner{width:100%;max-width:1100px;display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center}
.hero-copy h1{font-size:clamp(40px,5vw,62px);font-weight:800;line-height:1.05;letter-spacing:-2px;margin-bottom:18px}
.hero-copy p{font-size:17px;color:var(--text-gray);max-width:620px;margin-bottom:28px}
.badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.88);border:1px solid rgba(139,92,246,0.28);border-radius:var(--r-pill);padding:7px 18px;font-size:14px;font-weight:600;color:var(--purple-dark);margin-bottom:22px;backdrop-filter:blur(8px)}
.pulse-dot{width:7px;height:7px;background:var(--purple);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
.hero-actions{display:flex;gap:12px;flex-wrap:wrap}
.btn-dark,.btn-outline,.btn-white{padding:14px 24px;border-radius:var(--r-pill);font-size:15px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:all .2s}
.btn-dark{background:var(--text-dark);color:#fff}
.btn-dark:hover{background:#1f2937;transform:translateY(-1px)}
.btn-outline{border:1.5px solid var(--border);color:var(--text-dark);background:#fff}
.btn-outline:hover{border-color:var(--purple);color:var(--purple)}
.hero-card,.card{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow)}
.hero-card{padding:24px}
.card{padding:26px}
.section{padding:88px 48px}
.section.gray{background:var(--bg-gray)}
.container{max-width:1100px;margin:0 auto}
.sec-label{font-size:12.5px;font-weight:700;color:var(--purple);letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;text-align:center}
.sec-title{font-size:clamp(32px,4vw,48px);font-weight:800;line-height:1.12;letter-spacing:-1.4px;text-align:center;margin-bottom:12px}
.sec-sub{font-size:16px;color:var(--text-gray);text-align:center;margin:0 auto 44px;line-height:1.65;max-width:720px}
.grid-2,.grid-3,.grid-4{display:grid;gap:18px}
.grid-2{grid-template-columns:repeat(2,1fr)}
.grid-3{grid-template-columns:repeat(3,1fr)}
.grid-4{grid-template-columns:repeat(4,1fr)}
.metric-card{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:24px;box-shadow:var(--shadow)}
.metric-card h3{font-size:14px;color:var(--text-gray);font-weight:600;margin-bottom:14px}
.metric-value{font-size:34px;font-weight:800;letter-spacing:-1.3px}
.metric-sub{margin-top:8px;font-size:14px;color:var(--text-gray)}
.flow-step{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:24px;box-shadow:var(--shadow);position:relative}
.step-no{width:34px;height:34px;border-radius:50%;background:var(--purple-ultra);border:1px solid #d8ccfe;color:var(--purple-dark);display:flex;align-items:center;justify-content:center;font-weight:800;margin-bottom:18px}
.flow-step h3{font-size:18px;font-weight:800;margin-bottom:8px}
.flow-step p{font-size:14px;color:var(--text-gray)}
.demo-shot{background:linear-gradient(180deg,#fff 0%,#faf7ff 100%);border:1px dashed #cab8ff;border-radius:24px;min-height:280px;padding:24px;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--text-gray)}
.demo-shot.tall{min-height:420px}
.transcript{background:#111827;color:#fff;border-radius:24px;padding:24px;box-shadow:0 18px 42px rgba(17,24,39,.22)}
.transcript .line{padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.transcript .line:last-child{border-bottom:none}
.transcript .who{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#a78bfa;font-weight:700;margin-bottom:6px}
.transcript p{font-size:14px;line-height:1.7;color:rgba(255,255,255,.9)}
.plan-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:stretch}
.plan{background:#fff;border-radius:var(--r-lg);padding:28px 24px;border:1.5px solid var(--border);position:relative;display:flex;flex-direction:column;box-shadow:var(--shadow)}
.plan.star{border-color:var(--purple);box-shadow:0 0 0 4px rgba(139,92,246,.08),var(--shadow)}
.plan-badge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--purple);color:#fff;font-size:14px;font-weight:700;padding:5px 18px;border-radius:var(--r-pill);white-space:nowrap}
.plan h3{font-size:18px;margin-bottom:4px}
.plan p{font-size:14px;color:var(--text-gray);margin-bottom:16px}
.plan-price{font-size:44px;font-weight:800;letter-spacing:-2px;margin-bottom:12px}
.plan-price span{font-size:14px;font-weight:500;color:var(--text-gray)}
.plan ul{list-style:none;display:flex;flex-direction:column;gap:10px;flex:1;margin-bottom:24px}
.plan li{display:flex;gap:8px;font-size:14px;line-height:1.5}
.plan li::before{content:'✓';color:var(--purple);font-weight:800}
.band{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.note-box{padding:22px;border-radius:22px;background:#fff;border:1px solid var(--border);box-shadow:var(--shadow)}
.note-box h4{font-size:15px;margin-bottom:10px}
.note-box p,.note-box li{font-size:13.5px;color:var(--text-gray);line-height:1.65}
.note-box ul{padding-left:18px}
.formshell{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:28px;box-shadow:var(--shadow)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.field{display:flex;flex-direction:column;gap:8px}
.field label{font-size:14px;font-weight:700;color:var(--text-dark)}
.field input,.field textarea,.field select{width:100%;border:1px solid var(--border);border-radius:14px;padding:14px 15px;font:inherit;color:var(--text-dark);background:#fff}
.field textarea{min-height:120px;resize:vertical}
.field.full{grid-column:1/-1}
.helper{font-size:14px;color:var(--text-light)}
.quote-box{background:linear-gradient(135deg,#f5f3ff,#fff);border:1px solid var(--border);border-radius:24px;padding:24px}
.quote-box h3{font-size:24px;line-height:1.2;letter-spacing:-.8px;margin-bottom:10px}
.quote-box p{font-size:14px;color:var(--text-gray);margin-bottom:18px}
.mini-list{display:grid;gap:12px}
.mini-item{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #f0edf9}
.mini-item:last-child{border-bottom:none}
.mini-icon{width:36px;height:36px;border-radius:12px;background:var(--purple-ultra);display:flex;align-items:center;justify-content:center;flex-shrink:0}
footer{background:var(--bg-gray);border-top:1px solid var(--border);padding:42px 48px 30px}
.footer-inner{max-width:1100px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap}
.footer-links{display:flex;gap:18px;flex-wrap:wrap;color:var(--text-gray);font-size:14px}
.footer-copy{font-size:14px;color:var(--text-light)}
@media(max-width:960px){
  nav{padding:0 22px}
  .nav-links{display:none}
  .hero-page,.section,footer{padding-left:22px;padding-right:22px}
  .hero-inner,.grid-2,.grid-3,.grid-4,.band,.plan-grid,.form-grid{grid-template-columns:1fr}
}
.legacy-marketing > nav,
.legacy-marketing > footer,
.legacy-marketing > .topbar{display:none !important}
`,
];

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
    const helpNeed = document.getElementById('contactHelpNeed')?.value?.trim() ?? '';
    const bestTime = document.getElementById('contactBestTime')?.value?.trim() ?? '';
    const website = document.getElementById('contactWebsite')?.value?.trim() ?? '';

    if (!fullName || !businessName || !email || !phoneNumber || !businessType || !currentSetup || !helpNeed || !bestTime) {
      setHelper('Please complete all required fields.', 'error');
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

export const templateTitle = "Book a RingBooker Demo";

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
        <div className="legacy-marketing">
          <nav>
            <div className="nav-inner">
              <a href="/" className="nav-logo">
                <div className="nav-logo-icon">
                  <div className="nav-ripple nav-ripple-3" />
                  <div className="nav-ripple nav-ripple-2" />
                  <div className="nav-ripple-core">
                    <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
                  </div>
                </div>
                <span>RingBooker</span>
              </a>
              <div className="nav-links">
                <a href="/#features">Features</a>
                <a href="/demo">Live Demo</a>
                <a href="/pricing">Pricing</a>
                <a href="/how-it-works">How It Works</a>
                <a href="/contact" className="active">Contact</a>
              </div>
              <div className="nav-actions">
                <a href="/user/login" className="nav-signin">Sign In</a>
                <a href="/user/signup" className="nav-cta">Start Free Trial →</a>
              </div>
            </div>
          </nav>

          <section className="hero-page">
            <div className="hero-inner">
              <div className="hero-copy">
                <div className="badge"><span className="pulse-dot" />Talk to sales or book a walkthrough</div>
                <h1>Book a RingBooker demo for your business.</h1>
                <p>Share your call flow and current setup. We will show exactly how RingBooker fits your front-desk workflow.</p>
              </div>
              <div className="hero-card">
                <div className="quote-box">
                  <h3>The faster way to qualify leads.</h3>
                  <p>Use this page as your main conversion endpoint from ads, outreach, or homepage CTA traffic.</p>
                  <div className="mini-list">
                    <div className="mini-item"><div className="mini-icon">💅</div><div><strong>Nail shops</strong><div className="helper">Peak-hour calls and walk-in pressure</div></div></div>
                    <div className="mini-item"><div className="mini-icon">✂</div><div><strong>Hair salons</strong><div className="helper">Stylist-specific scheduling and updates</div></div></div>
                    <div className="mini-item"><div className="mini-icon">🧖</div><div><strong>Spa / beauty clinic</strong><div className="helper">Service-heavy call routing and follow-up</div></div></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="section" id="book-demo">
            <div className="container">
              <div className="grid-2">
                <div className="formshell">
                  <h3 style={{ marginBottom: 8 }}>Book a demo</h3>
                  <p className="sub">Submit your business details and our team will follow up with a tailored walkthrough.</p>
                  <form id="contactRequestForm">
                    <div className="form-grid">
                      <div className="field"><label htmlFor="contactFullName">Full name</label><input id="contactFullName" placeholder="Jane Nguyen" required /></div>
                      <div className="field"><label htmlFor="contactBusinessName">Business name</label><input id="contactBusinessName" placeholder="Luxe Hair Studio" required /></div>
                      <div className="field"><label htmlFor="contactEmail">Email</label><input id="contactEmail" type="email" placeholder="jane@luxehair.com" required /></div>
                      <div className="field"><label htmlFor="contactPhoneNumber">Phone number</label><input id="contactPhoneNumber" placeholder="+1 (714) 555-0100" required /></div>
                      <div className="field">
                        <label htmlFor="contactBusinessType">Business type</label>
                        <select id="contactBusinessType" required defaultValue="nail_shop">
                          <option value="nail_shop">Nail shop</option>
                          <option value="hair_salon">Hair salon</option>
                          <option value="spa">Spa</option>
                          <option value="med_spa">Med spa</option>
                          <option value="beauty_clinic">Beauty clinic</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="contactCurrentSetup">Current setup</label>
                        <select id="contactCurrentSetup" required defaultValue="missed_calls_often">
                          <option value="missed_calls_often">We miss calls often</option>
                          <option value="owner_answers_calls">User answers calls</option>
                          <option value="receptionist_answers_calls">Receptionist answers calls</option>
                          <option value="voicemail_after_hours">Voicemail after hours</option>
                        </select>
                      </div>
                      <div className="field full">
                        <label htmlFor="contactHelpNeed">What do you want help with most?</label>
                        <textarea
                          id="contactHelpNeed"
                          required
                          placeholder="Example: We miss too many calls during busy hours and need AI to answer, book, and send confirmation texts."
                          defaultValue=""
                        />
                      </div>
                      <div className="field full"><label htmlFor="contactBestTime">Best time for a demo</label><input id="contactBestTime" placeholder="Weekdays after 3 PM PST" required /></div>
                      <div className="field full" style={{ display: 'none' }}><label htmlFor="contactWebsite">Website</label><input id="contactWebsite" autoComplete="off" tabIndex={-1} /></div>
                      <div className="field full"><div id="contactTurnstileMount" /></div>
                    </div>
                    <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button id="contactSubmitButton" type="submit" className="btn-dark">Submit request</button>
                      <span className="helper" id="contactHelper">Protected by captcha and multi-layer rate limits.</span>
                    </div>
                  </form>
                </div>

                <div className="card">
                  <h3 style={{ marginBottom: 10 }}>What happens after you submit</h3>
                  <div className="mini-list">
                    <div className="mini-item"><div className="mini-icon">1</div><div><strong>Quick qualification</strong><div className="helper">We review business type, call volume, and setup needs.</div></div></div>
                    <div className="mini-item"><div className="mini-icon">2</div><div><strong>Live walkthrough</strong><div className="helper">We show how RingBooker handles calls, booking, and follow-up.</div></div></div>
                    <div className="mini-item"><div className="mini-icon">3</div><div><strong>Trial or rollout</strong><div className="helper">Start on standard plans or map custom implementation.</div></div></div>
                  </div>
                  <div className="note-box" style={{ marginTop: 18 }}>
                    <h4>Good fit right now</h4>
                    <p>Nail shops, hair salons, spas, med spas, and beauty clinics that need stronger call coverage without extra front-desk headcount.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <footer>
            <div className="footer-inner">
              <div className="footer-copy">© 2026 RingBooker. AI phone agent for booking-heavy businesses.</div>
              <div className="footer-links">
                <a href="/demo">Live Demo</a>
                <a href="/pricing">Pricing</a>
                <a href="/how-it-works">How It Works</a>
                <a href="/contact">Contact</a>
                <a href="/user/login">Sign In</a>
              </div>
            </div>
          </footer>
        </div>
        <MarketingFooter />
      </>

    </MarketingLayout>
  );
}
