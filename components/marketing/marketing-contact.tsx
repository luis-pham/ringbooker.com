import Script from 'next/script';

import { MarketingContactBody } from '@/components/marketing/marketing-contact-body';
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
.contact-hero-reflow{padding:112px 48px 72px;background:radial-gradient(ellipse 80% 55% at 50% 0%,#EDE9FE 0%,#FDF4FF 45%,#fff 72%);overflow:hidden}
.contact-custom-shell{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:60px;
  max-width:960px;
  margin:0 auto;
  align-items:start;
  padding:40px 0;
  box-sizing:border-box;
}
.contact-value-col{min-width:0}
.contact-breadcrumb--shell{grid-column:1/-1;margin-bottom:4px}
.contact-breadcrumb{margin-bottom:12px;font-size:14px;line-height:1.35;color:var(--mk-text-soft,#94a3b8)}
.contact-breadcrumb a{color:var(--mk-text-soft,#94a3b8);text-decoration:none;font-weight:400}
.contact-breadcrumb-sep{margin:0 6px}
.contact-value-h1{
  font-size:var(--mk-hero-title);
  font-weight:600;
  line-height:var(--mk-hero-title-lh);
  letter-spacing:var(--mk-hero-title-track);
  color:var(--text-dark);
  margin:0 0 18px;
  text-wrap:balance;
}
.contact-value-sub{
  font-size:var(--mk-hero-lead);
  line-height:var(--mk-hero-lead-lh);
  font-weight:400;
  color:var(--mk-text-desc,#64748b);
  margin:0 0 26px;
  max-width:min(36rem,100%);
}
.contact-value-checklist{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:16px}
.contact-value-check-item{display:flex;gap:12px;align-items:flex-start}
.contact-value-check-icon{
  flex-shrink:0;width:24px;height:24px;border-radius:999px;background:#7c3aed;color:#fff;
  font-size:11px;font-weight:500;display:flex;align-items:center;justify-content:center;line-height:1;margin-top:3px;
}
.contact-value-check-item strong{
  display:block;
  font-size:var(--mk-card-title);
  font-weight:600;
  line-height:1.35;
  letter-spacing:-.015em;
  color:var(--text-dark);
  margin-bottom:4px;
}
.contact-value-check-desc{
  display:block;
  font-size:var(--mk-body);
  font-weight:400;
  line-height:var(--mk-body-lh);
  color:var(--mk-text-muted);
}
.contact-form-card{
  background:#fff;border-radius:16px;padding:28px;
  box-shadow:0 4px 24px rgba(0,0,0,.06);
  border:1px solid var(--border);
  min-width:0;
}
.contact-form-title-sr{
  position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;
}
.contact-step-panels{display:flex;flex-direction:column;gap:18px}
.contact-step-panel[hidden]{display:none !important}
.contact-step-indicator{margin-bottom:4px}
.contact-step-indicator__nodes{display:flex;align-items:center;gap:10px;max-width:200px}
.contact-step-dot{
  width:28px;height:28px;border-radius:999px;border:2px solid #e5e7eb;background:#fff;color:#9ca3af;
  font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;
}
.contact-step-dot.active{background:#7c3aed;border-color:#7c3aed;color:#fff}
.contact-step-dot.done{background:#fff;border-color:#7c3aed;color:#7c3aed}
.contact-step-line{flex:1;height:2px;background:#e5e7eb;border-radius:2px;min-width:24px}
.contact-step-line.done{background:#7c3aed}
.contact-step-heading{margin:0 0 6px;font-size:18px;font-weight:600;color:#111827;letter-spacing:-.02em}
.contact-step-lead{margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.55}
.contact-field-row{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:12px;
  margin-bottom:12px;
}
.contact-field{display:flex;flex-direction:column;gap:5px;margin-bottom:0}
.contact-field--full{grid-column:1/-1;margin-bottom:12px}
.contact-field label{
  font-size:12px;font-weight:500;color:#374151;display:flex;align-items:center;gap:4px;
}
.optional-tag{font-size:11px;color:#9ca3af;font-weight:400}
.contact-field input,.contact-field select,.contact-field textarea{
  width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:9px;font-size:14px;font-family:'Inter',sans-serif;
  color:#111;background:#fff;transition:border .15s;box-sizing:border-box;
}
.contact-field input:focus,.contact-field select:focus,.contact-field textarea:focus{
  outline:none;border-color:#7c3aed;box-shadow:0 0 0 3px #ede9fe;
}
.contact-field textarea{resize:none;height:80px;min-height:80px}
.contact-field-error{font-size:12px;color:#b91c1c;margin-top:2px}
.contact-step-nav{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;flex-wrap:wrap}
.contact-step-nav--1{margin-top:18px;padding-top:4px}
.contact-step-nav--2{margin-top:16px;padding-top:12px;border-top:1px solid #f3f4f6}
.contact-step-label{font-size:13px;color:#374151;font-weight:500}
.contact-step-label--muted{color:#9ca3af;font-weight:400}
.contact-btn-continue{
  appearance:none;border:none;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:600;
  background:#7c3aed;color:#fff;cursor:pointer;font-family:inherit;
}
.contact-btn-continue:hover{background:#6d28d9}
.contact-btn-back{
  appearance:none;border:1px solid #e5e7eb;background:#fff;border-radius:10px;padding:10px 16px;font-size:14px;font-weight:500;color:#374151;cursor:pointer;font-family:inherit;
}
.contact-btn-back:hover{background:#f9fafb}
.contact-advanced-block{margin-top:8px;padding-top:10px;border-top:1px solid #f3f4f6}
.contact-advanced-toggle{
  display:block;width:100%;text-align:left;background:none;border:none;padding:0;font-size:13px;color:#7c3aed;font-weight:500;cursor:pointer;font-family:inherit;
}
.contact-advanced-fields{margin-top:14px;display:flex;flex-direction:column;gap:0}
.contact-btn-submit{
  width:100%;margin-top:16px;height:48px;border-radius:10px;border:none;background:#111;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;
}
.contact-btn-submit:hover{background:#1f2937}
.contact-btn-submit:disabled{opacity:.55;cursor:not-allowed}
.contact-trust-foot{margin-top:10px;text-align:center;font-size:11px;color:#9ca3af}
.contact-helper-block{margin-top:12px;font-size:13px;color:#6b7280;line-height:1.45}
.contact-honeypot{display:none}
.contact-turnstile-label{font-size:12px;font-weight:500;color:#374151;margin-bottom:5px;display:block}
.contact-turnstile-frame{min-height:72px;min-width:240px;border:1px dashed var(--border);border-radius:12px;padding:10px;background:#fafafa;display:flex;align-items:center;justify-content:center;margin-bottom:4px}
.contact-turnstile-hint{font-size:12px;color:var(--text-light);line-height:1.45;margin-top:6px}
.section{padding:64px 48px 82px}
@media(max-width:960px){
  .contact-hero-reflow,.section{padding-left:22px;padding-right:22px}
  .contact-hero-reflow{padding-top:calc(69px + 28px + env(safe-area-inset-top,0px));padding-bottom:52px}
}
@media(max-width:767px){
  .contact-custom-shell{grid-template-columns:1fr;gap:28px}
  .contact-value-col{display:none}
  .contact-form-card{padding:22px}
}
@media(max-width:640px){
  .section{padding-top:var(--mk-space-section-y-mobile,56px);padding-bottom:64px}
  .contact-field-row{grid-template-columns:1fr}
}
.container{max-width:var(--mk-container-tight,1100px);margin:0 auto}
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
  const hintEl = document.getElementById('contactTurnstileHint');
  const heroTitle = document.getElementById('contactHeroTitle');
  const heroSubtitle = document.getElementById('contactHeroSubtitle');
  const formTitle = document.getElementById('contactFormTitle');
  const enterpriseFields = document.getElementById('enterpriseContactFields');
  if (!form || !helper || !submitButton) return;

  const allowedIntents = new Set(['demo', 'enterprise', 'sales', 'support', 'general']);
  const allowedPlans = new Set(['starter', 'professional', 'enterprise', 'unknown']);
  const queryParams = new URLSearchParams(window.location.search);
  const rawIntent = (queryParams.get('intent') || '').trim().toLowerCase();
  const contactIntent = allowedIntents.has(rawIntent) ? rawIntent : 'general';
  const rawPlan = (queryParams.get('plan') || '').trim().toLowerCase();
  const planInterest = allowedPlans.has(rawPlan) ? rawPlan : (contactIntent === 'enterprise' ? 'enterprise' : 'unknown');
  const contactSource = (queryParams.get('source') || '').trim().slice(0, 120);

  const applyContactIntentCopy = () => {
    if (contactIntent === 'enterprise') {
      if (heroTitle) heroTitle.textContent = 'Talk to us about a Custom setup';
      if (heroSubtitle) heroSubtitle.textContent = 'Tell us about your locations, call volume, and routing needs. We’ll help plan your RingBooker setup.';
      if (formTitle) formTitle.textContent = 'Talk to us about a Custom setup';
      submitButton.textContent = 'Send Custom setup request';
      if (enterpriseFields) enterpriseFields.style.display = 'contents';
      return;
    }
    if (contactIntent === 'demo') {
      if (heroTitle) heroTitle.textContent = 'See How RingBooker Recovers Missed Bookings';
      if (heroSubtitle) heroSubtitle.textContent = 'Tell us how your calls work today—after-hours, overflow, reschedules, or consults—and we’ll show how RingBooker fits your workflow in about 15 minutes.';
      if (formTitle) formTitle.textContent = 'Request a demo';
      submitButton.textContent = 'Request demo';
      if (enterpriseFields) enterpriseFields.style.display = 'none';
      return;
    }
    if (heroTitle) heroTitle.textContent = 'Contact RingBooker';
    if (heroSubtitle) heroSubtitle.textContent = 'Send us a note and we’ll route it to the right RingBooker team member.';
    if (formTitle) formTitle.textContent = 'Contact RingBooker';
    submitButton.textContent = 'Send message';
    if (enterpriseFields) enterpriseFields.style.display = 'none';
  };
  applyContactIntentCopy();

  const mountContactTurnstile = () => {
    if (!captchaMount) return;
    if (!${JSON.stringify(turnstileSiteKey)}) {
      captchaMount.innerHTML = '';
      window.__rbContactCaptchaToken = 'dev-turnstile-bypass';
      return;
    }
    if (!window.turnstile) return;
    if (window.__rbContactTurnstileWidgetId) {
      try {
        window.turnstile.remove(window.__rbContactTurnstileWidgetId);
      } catch (e) {}
      window.__rbContactTurnstileWidgetId = null;
    }
    captchaMount.innerHTML = '';
    captchaMount.dataset.rendered = 'false';
    try {
      const widgetId = window.turnstile.render(captchaMount, {
        sitekey: ${JSON.stringify(turnstileSiteKey)},
        theme: 'light',
        callback: (token) => {
          window.__rbContactCaptchaToken = token;
          if (hintEl) hintEl.textContent = '';
        },
        'expired-callback': () => {
          window.__rbContactCaptchaToken = '';
        },
        'error-callback': () => {
          window.__rbContactCaptchaToken = '';
          if (hintEl) {
            hintEl.textContent = 'Verification could not load. Try disabling ad blockers or allow challenges.cloudflare.com.';
          }
        },
      });
      window.__rbContactTurnstileWidgetId = widgetId;
      captchaMount.dataset.rendered = 'true';
    } catch (e) {
      if (hintEl) hintEl.textContent = 'Verification widget failed to start. Please refresh the page.';
    }
  };

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
    if (!${JSON.stringify(turnstileSiteKey)}) {
      return 'dev-turnstile-bypass';
    }
    return typeof window.__rbContactCaptchaToken === 'string' ? window.__rbContactCaptchaToken : '';
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

    const step2Panel = document.querySelector('.contact-step-panel[data-contact-step="2"]');
    if (step2Panel && step2Panel.hasAttribute('hidden')) {
      setHelper('Continue to step 2 to complete verification and send your request.', 'error');
      return;
    }

    const fullName = document.getElementById('contactFullName')?.value?.trim() ?? '';
    const businessName = document.getElementById('contactBusinessName')?.value?.trim() ?? '';
    const email = document.getElementById('contactEmail')?.value?.trim() ?? '';
    const phoneNumber = document.getElementById('contactPhoneNumber')?.value?.trim() ?? '';
    const businessType = document.getElementById('contactBusinessType')?.value?.trim() ?? '';
    const currentSetup = document.getElementById('contactCurrentSetup')?.value?.trim() ?? '';
    const helpNeed = document.getElementById('contactHelpNeed')?.value?.trim() || 'No extra details provided.';
    const bestTime = document.getElementById('contactBestTime')?.value?.trim() ?? '';
    const website = document.getElementById('contactWebsite')?.value?.trim() ?? '';
    const numberOfLocationsRaw = document.getElementById('contactNumberOfLocations')?.value?.trim() ?? '';
    const numberOfLocations = numberOfLocationsRaw ? Number(numberOfLocationsRaw) : null;
    const locationsText = document.getElementById('contactLocationsText')?.value?.trim() ?? '';
    const mainContact = document.getElementById('contactMainContact')?.value?.trim() ?? '';
    const currentPhoneProvider = document.getElementById('contactCurrentPhoneProvider')?.value?.trim() ?? '';
    const currentBookingSoftware = document.getElementById('contactCurrentBookingSoftware')?.value?.trim() ?? '';
    const currentCrm = document.getElementById('contactCurrentCrm')?.value?.trim() ?? '';
    const estimatedMonthlyCallVolume = document.getElementById('contactEstimatedMonthlyCallVolume')?.value?.trim() ?? '';
    const languagesNeeded = document.getElementById('contactLanguagesNeeded')?.value?.trim() ?? '';
    const routingRules = document.getElementById('contactRoutingRules')?.value?.trim() ?? '';
    const escalationRules = document.getElementById('contactEscalationRules')?.value?.trim() ?? '';
    const integrationRequirements = document.getElementById('contactIntegrationRequirements')?.value?.trim() ?? '';
    const preferredGoLiveTimeline = document.getElementById('contactPreferredGoLiveTimeline')?.value?.trim() ?? '';

    if (!fullName || !businessName || !email || !phoneNumber || !businessType || !currentSetup || !bestTime) {
      setHelper('Please complete the required fields.', 'error');
      return;
    }

    const captchaToken = getCaptchaToken();
    if (!captchaToken) {
      setHelper('Please complete human verification (checkbox above), or wait for it to load.', 'error');
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
          intent: contactIntent,
          source: contactSource,
          planInterest,
          locationCount: numberOfLocations,
          estimatedCallVolume: estimatedMonthlyCallVolume,
          bookingSoftware: currentBookingSoftware,
          routingNeeds: routingRules,
          goLiveTimeline: preferredGoLiveTimeline,
          captchaToken,
          sessionId: ensureSessionId(),
          website,
          numberOfLocations,
          locationsText,
          mainContact,
          currentPhoneProvider,
          currentBookingSoftware,
          currentCrm,
          estimatedMonthlyCallVolume,
          languagesNeeded,
          routingRules,
          escalationRules,
          integrationRequirements,
          preferredGoLiveTimeline,
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
          mountContactTurnstile();
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

  let initialTurnstileBooted = false;
  const bootInitialTurnstile = () => {
    if (initialTurnstileBooted || !window.turnstile) return;
    initialTurnstileBooted = true;
    mountContactTurnstile();
  };

  if (${JSON.stringify(turnstileSiteKey)}) {
    let hintTimer = window.setTimeout(() => {
      if (captchaMount && captchaMount.dataset.rendered !== 'true' && hintEl && !hintEl.textContent) {
        hintEl.textContent = 'If no checkbox appears, allow Cloudflare scripts or try another browser.';
      }
    }, 8000);
    const interval = window.setInterval(() => {
      if (window.turnstile) {
        window.clearInterval(interval);
        window.clearTimeout(hintTimer);
        bootInitialTurnstile();
      }
    }, 200);
  } else {
    mountContactTurnstile();
  }

})();
`,
];

export const templateTitle = 'Book a Demo — Recover Missed Bookings | RingBooker';

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
          <MarketingContactBody />

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
