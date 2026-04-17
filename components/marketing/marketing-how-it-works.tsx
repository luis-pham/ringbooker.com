import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';
import { MarketingFaqAccordion } from '@/components/marketing/marketing-faq-accordion';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';

const HOW_IT_WORKS_FAQS = [
  {
    q: 'Do I need a new phone number to use RingBooker?',
    a: 'No. Most businesses start by forwarding their current business number to RingBooker for after-hours and overflow coverage. A dedicated RingBooker number is optional if you want a separate booking line.',
  },
  {
    q: 'Does RingBooker replace my booking software?',
    a: 'No. RingBooker is a phone answering and booking recovery layer. It works alongside your existing booking tools and call workflow instead of replacing your booking platform.',
  },
  {
    q: 'What kinds of calls can RingBooker handle?',
    a: 'RingBooker is built for nail salons, hair salons, spas, med spas, and clinics: after-hours calls, peak-hour overflow, routine booking requests, reschedules, cancellations, missed-call text back, and clean human handoff when a caller needs special help.',
  },
  {
    q: 'What happens if the caller needs a real person?',
    a: 'RingBooker can collect context, offer a callback path, and summarize the call so your team can follow up without making the caller repeat everything.',
  },
];

const howItWorksFaqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: HOW_IT_WORKS_FAQS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.a,
    },
  })),
};

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
  --shadow:0 16px 48px rgba(17,24,39,.07);
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Mona Sans Variable',sans-serif;color:var(--text-dark);background:var(--bg);overflow-x:hidden;font-size:16px;line-height:1.6}
a{text-decoration:none;color:inherit}
.hiw-page{background:#fff}
.hiw-hero{padding:76px 48px 72px;background:radial-gradient(ellipse 80% 55% at 50% 0%,#EDE9FE 0%,#FDF4FF 45%,#fff 72%);overflow:hidden}
.hiw-container{width:100%;max-width:1100px;margin:0 auto}
.hiw-hero-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(340px,.95fr);gap:42px;align-items:center}
.hiw-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.9);border:1px solid rgba(139,92,246,.26);border-radius:var(--r-pill);padding:7px 18px;font-size:14px;font-weight:700;color:var(--purple-dark);margin-bottom:20px;backdrop-filter:blur(8px)}
.hiw-dot{width:7px;height:7px;background:var(--purple);border-radius:50%;animation:hiwPulse 2s infinite}
@keyframes hiwPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
.hiw-hero h1{font-size:clamp(40px,5vw,62px);font-weight:800;line-height:1.04;letter-spacing:-2px;margin-bottom:18px}
.hiw-hero p{font-size:17px;color:var(--text-gray);max-width:650px;margin-bottom:26px;line-height:1.75}
.hiw-actions{display:flex;gap:12px;flex-wrap:wrap}
.hiw-btn-dark,.hiw-btn-outline{padding:14px 24px;border-radius:var(--r-pill);font-size:15px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:all .2s}
.hiw-btn-dark{background:var(--text-dark);color:#fff}
.hiw-btn-dark:hover{background:#1f2937;transform:translateY(-1px)}
.hiw-btn-outline{border:1.5px solid var(--border);color:var(--text-dark);background:#fff}
.hiw-btn-outline:hover{border-color:var(--purple);color:var(--purple)}
.hiw-summary{background:#fff;border:1px solid rgba(139,92,246,.18);border-radius:28px;padding:26px;box-shadow:0 24px 70px rgba(124,58,237,.12);position:relative;overflow:hidden;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.hiw-summary:hover{transform:translateY(-2px);box-shadow:0 28px 80px rgba(124,58,237,.18);border-color:rgba(139,92,246,.28)}
.hiw-summary::before{content:"";position:absolute;top:-70px;right:-70px;width:190px;height:190px;border-radius:50%;background:rgba(139,92,246,.08)}
.hiw-summary-label{font-size:12.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--purple-dark);margin-bottom:12px;position:relative}
.hiw-summary h2{font-size:24px;font-weight:800;line-height:1.18;letter-spacing:-.8px;margin-bottom:14px;position:relative}
.hiw-summary-list{display:grid;gap:11px;position:relative}
.hiw-summary-item{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:#374151;line-height:1.55}
.hiw-summary-icon{width:24px;height:24px;border-radius:9px;background:var(--purple-ultra);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px}
.hiw-section{padding:86px 48px}
.hiw-section.gray{background:var(--bg-gray)}
.hiw-label{font-size:12.5px;font-weight:800;color:var(--purple);letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;text-align:center}
.hiw-title{font-size:clamp(32px,4vw,48px);font-weight:800;line-height:1.12;letter-spacing:-1.4px;text-align:center;margin:0 auto 12px;max-width:820px}
.hiw-sub{font-size:16px;color:var(--text-gray);text-align:center;margin:0 auto 42px;line-height:1.7;max-width:760px}
.hiw-grid-2,.hiw-grid-3{display:grid;gap:18px}
.hiw-grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.hiw-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.hiw-card{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:24px;box-shadow:var(--shadow);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.hiw-card:hover{transform:translateY(-2px);box-shadow:0 20px 40px -8px rgba(17,24,39,.12),0 8px 16px -6px rgba(17,24,39,.08);border-color:#d1d5db}
.hiw-card.recommended{border-color:#c4b5fd;background:linear-gradient(180deg,#fbfaff 0%,#fff 82%);box-shadow:0 0 0 4px rgba(139,92,246,.06),var(--shadow)}
.hiw-card.recommended:hover{border-color:#a78bfa;box-shadow:0 20px 48px -8px rgba(124,58,237,.2),0 0 0 4px rgba(139,92,246,.08)}
.hiw-card-top{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}
.hiw-pill{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:900}
.hiw-pill.optional{background:#f8fafc;color:#475569;border:1px solid #e2e8f0}
.hiw-icon{width:42px;height:42px;border-radius:15px;background:var(--purple-ultra);display:flex;align-items:center;justify-content:center;font-size:21px}
.hiw-card h3{font-size:20px;font-weight:800;line-height:1.25;letter-spacing:-.5px;margin-bottom:9px}
.hiw-card p{font-size:14.5px;color:var(--text-gray);line-height:1.72}
.hiw-list{list-style:none;display:grid;gap:10px;margin-top:16px}
.hiw-list li{display:flex;gap:10px;font-size:14px;color:#374151;line-height:1.55}
.hiw-list li::before{content:"✓";width:20px;height:20px;border-radius:50%;background:var(--purple-ultra);color:var(--purple-dark);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0;margin-top:1px}
.hiw-flow{counter-reset:hiwStep}
.hiw-step{position:relative}
.hiw-step::before{counter-increment:hiwStep;content:counter(hiwStep);width:36px;height:36px;border-radius:50%;background:var(--purple);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;margin:0 auto 18px;box-shadow:0 12px 24px rgba(139,92,246,.24)}
.hiw-handle-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.hiw-handle{background:#fff;border:1px solid var(--border);border-radius:22px;padding:22px 20px;text-align:center;box-shadow:0 10px 30px rgba(17,24,39,.04);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.hiw-handle:hover{transform:translateY(-2px);box-shadow:0 20px 40px -8px rgba(17,24,39,.1),0 8px 16px -6px rgba(17,24,39,.06);border-color:#d1d5db}
.hiw-handle-icon{width:48px;height:48px;border-radius:18px;margin:0 auto 14px;background:var(--purple-ultra);display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:inset 0 0 0 1px rgba(139,92,246,.08)}
.hiw-handle-icon.green{background:#D1FAE5}
.hiw-handle-icon.amber{background:#FEF3C7}
.hiw-handle-icon.pink{background:#FCE7F3}
.hiw-handle-icon.blue{background:#DBEAFE}
.hiw-handle-icon.slate{background:#F1F5F9}
.hiw-handle strong{display:block;font-size:16px;font-weight:800;letter-spacing:-.25px;margin-bottom:7px}
.hiw-handle p{font-size:14px;color:var(--text-gray);line-height:1.65}
.hiw-no-replace{background:#111827;color:#fff;border-radius:32px;padding:36px;display:grid;grid-template-columns:1fr 1.05fr;gap:30px;align-items:start;box-shadow:0 24px 70px rgba(17,24,39,.22)}
.hiw-no-replace h2{font-size:clamp(28px,3.6vw,42px);font-weight:800;line-height:1.12;letter-spacing:-1.2px;margin-bottom:12px}
.hiw-no-replace p{color:rgba(255,255,255,.74);line-height:1.75}
.hiw-trust-list{display:grid;gap:12px}
.hiw-trust-item{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);border-radius:18px;padding:15px;transition:transform .2s ease,background .2s ease,border-color .2s ease}
.hiw-trust-item:hover{transform:translateY(-2px);background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.18)}
.hiw-trust-item strong{display:block;margin-bottom:4px}
.hiw-trust-item span{display:block;color:rgba(255,255,255,.72);font-size:14px;line-height:1.6}
.hiw-experience{display:grid;grid-template-columns:.9fr 1.1fr;gap:20px;align-items:stretch}
.hiw-call-card{background:linear-gradient(160deg,#1a0533 0%,#2d1b69 44%,#1a0d3a 100%);border-radius:30px;padding:26px;color:#fff;box-shadow:0 24px 70px rgba(45,27,105,.22);overflow:hidden;position:relative}
.hiw-call-card::after{content:"";position:absolute;right:-50px;top:-50px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,.06)}
.hiw-live{display:inline-flex;align-items:center;gap:7px;padding:6px 11px;border-radius:999px;background:rgba(16,185,129,.16);color:#86efac;border:1px solid rgba(16,185,129,.25);font-size:12px;font-weight:900;margin-bottom:24px;position:relative}
.hiw-call-card h3{font-size:24px;font-weight:800;line-height:1.18;letter-spacing:-.7px;margin-bottom:10px;position:relative}
.hiw-call-card p{font-size:14.5px;color:rgba(255,255,255,.78);line-height:1.75;position:relative}
.hiw-call-steps{display:grid;gap:12px}
.hiw-call-step{display:flex;gap:13px;align-items:flex-start;background:#fff;border:1px solid var(--border);border-radius:20px;padding:18px;box-shadow:0 10px 30px rgba(17,24,39,.04);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.hiw-call-step:hover{transform:translateY(-2px);box-shadow:0 18px 36px -10px rgba(17,24,39,.12);border-color:#d1d5db}
.hiw-call-step span{width:30px;height:30px;border-radius:12px;background:var(--purple-ultra);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.hiw-call-step strong{display:block;margin-bottom:3px}
.hiw-call-step p{font-size:14px;color:var(--text-gray);line-height:1.6}
.hiw-cta{padding:78px 48px;background:#fff}
.hiw-cta-box{max-width:1100px;margin:0 auto;background:linear-gradient(135deg,#7C3AED 0%,#A855F7 100%);color:#fff;border-radius:32px;padding:42px;display:grid;grid-template-columns:1fr auto;gap:28px;align-items:center;box-shadow:0 24px 70px rgba(124,58,237,.24)}
.hiw-cta h2{font-size:clamp(28px,3.6vw,42px);font-weight:800;line-height:1.12;letter-spacing:-1.2px;margin-bottom:10px}
.hiw-cta p{color:rgba(255,255,255,.82);font-size:16px;line-height:1.7;max-width:650px}
.hiw-cta .hiw-btn-dark{background:#fff;color:#111827}
.legacy-marketing > nav,
.legacy-marketing > footer,
.legacy-marketing > .topbar{display:none !important}
@media(max-width:960px){
  .hiw-hero,.hiw-section,.hiw-cta{padding-left:22px;padding-right:22px}
  .hiw-hero-grid,.hiw-grid-2,.hiw-grid-3,.hiw-handle-grid,.hiw-no-replace,.hiw-experience,.hiw-cta-box{grid-template-columns:1fr}
  .hiw-hero{padding-top:54px;padding-bottom:52px}
  .hiw-summary{padding:22px}
  .hiw-no-replace,.hiw-cta-box{padding:28px}
  .hiw-cta-box{gap:18px}
}
@media(max-width:640px){
  .hiw-hero{padding-bottom:46px}
  .hiw-hero h1{font-size:40px}
  .hiw-actions,.hiw-cta .hiw-actions{flex-direction:column;align-items:stretch}
  .hiw-btn-dark,.hiw-btn-outline{width:100%}
  .hiw-section{padding-top:68px;padding-bottom:68px}
}
`,
];

const scripts: string[] = [];

export const templateTitle =
  'How RingBooker Works on Your Current Number | Recover After-Hours and Missed Call Revenue';

export function MarketingHowItWorksTemplate() {
  return (
    <MarketingLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="marketing-how-it-works"
    >
      <>
        <MarketingChromeStyles />
        <MarketingHeader active="how-it-works" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howItWorksFaqJsonLd) }}
        />
        <main className="legacy-marketing hiw-page">
          <section className="hiw-hero">
            <div className="hiw-container hiw-hero-grid">
              <div>
                <div className="hiw-badge"><span className="hiw-dot" />How RingBooker works</div>
                <h1>How RingBooker Recovers Lost Bookings Without Changing Your Number</h1>
                <p>
                  Forward from your existing line: RingBooker is a booking recovery layer that answers after-hours calls, covers peak-hour overflow, sends missed-call text back, and captures intent so missed rings are less likely to become lost revenue — without a new booking system and without reprinting your number everywhere.
                </p>
                <div className="hiw-actions">
                  <a href="/demo" className="hiw-btn-dark" data-demo-picker>
                    <DemoCtaPhoneIcon width={18} height={18} />
                    Try a Live Demo Call
                  </a>
                  <a href="/contact" className="hiw-btn-outline">Talk through setup</a>
                </div>
              </div>
              <aside className="hiw-summary" aria-label="RingBooker summary">
                <div className="hiw-summary-label">Plain-language summary</div>
                <h2>Keep your number. Stop revenue leaking to voicemail.</h2>
                <div className="hiw-summary-list">
                  <div className="hiw-summary-item"><span className="hiw-summary-icon">1</span><span>Most businesses forward their current line to RingBooker for after-hours, overflow, or missed-call coverage.</span></div>
                  <div className="hiw-summary-item"><span className="hiw-summary-icon">2</span><span>A dedicated RingBooker number is available if you want a separate booking line.</span></div>
                  <div className="hiw-summary-item"><span className="hiw-summary-icon">3</span><span>RingBooker handles routine call work and keeps human handoff clear when the booking or consult needs a person.</span></div>
                </div>
              </aside>
            </div>
          </section>

          <section className="hiw-section">
            <div className="hiw-container">
              <div className="hiw-label">Setup paths</div>
              <h2 className="hiw-title">Choose how RingBooker starts.</h2>
              <p className="hiw-sub">Current number is the primary path. A new dedicated line is optional for businesses that want a separate number for campaigns, overflow, or testing.</p>
              <div className="hiw-grid-2">
                <article className="hiw-card recommended">
                  <div className="hiw-card-top">
                    <div className="hiw-icon">📞</div>
                    <span className="hiw-pill">Recommended</span>
                  </div>
                  <h3>Use your current business number</h3>
                  <p>Most salons and clinics keep the number customers already know. Calls can be forwarded to RingBooker for after-hours coverage, overflow, or missed-call recovery without migrating your booking system.</p>
                  <ul className="hiw-list">
                    <li>Best for existing businesses with an established phone number.</li>
                    <li>Customers keep calling the same number.</li>
                    <li>Your team keeps control of when RingBooker answers.</li>
                  </ul>
                </article>
                <article className="hiw-card">
                  <div className="hiw-card-top">
                    <div className="hiw-icon">☎️</div>
                    <span className="hiw-pill optional">Optional</span>
                  </div>
                  <h3>Add a dedicated RingBooker number</h3>
                  <p>If you want a separate booking line, campaign number, or pilot setup, RingBooker can provide a dedicated number. This is an option, not a requirement.</p>
                  <ul className="hiw-list">
                    <li>Useful for testing before routing your main line.</li>
                    <li>Useful for separate locations or marketing campaigns.</li>
                    <li>Can run alongside your existing number strategy.</li>
                  </ul>
                </article>
              </div>
            </div>
          </section>

          <section className="hiw-section gray">
            <div className="hiw-container">
              <div className="hiw-label">3-step flow</div>
              <h2 className="hiw-title">A phone-first workflow your team can understand quickly.</h2>
              <p className="hiw-sub">RingBooker sits between the caller and your team: it captures intent and summaries so you recover bookings faster — without migrating calendars or changing the number clients already dial.</p>
              <div className="hiw-grid-3 hiw-flow">
                <article className="hiw-card hiw-step">
                  <h3>Connect coverage</h3>
                  <p>Forward your current business number for after-hours or overflow coverage, or add a dedicated RingBooker line if that fits your rollout better.</p>
                </article>
                <article className="hiw-card hiw-step">
                  <h3>Add services, hours, and rules</h3>
                  <p>Tell RingBooker your services, business hours, staff or provider preferences, booking rules, escalation path, and what should be confirmed by SMS.</p>
                </article>
                <article className="hiw-card hiw-step">
                  <h3>Recover calls and hand off context</h3>
                  <p>RingBooker answers, captures intent, helps with routine booking calls, texts confirmations or callbacks, and gives your team the context when a human should step in.</p>
                </article>
              </div>
            </div>
          </section>

          <section className="hiw-section">
            <div className="hiw-container">
              <div className="hiw-label">What it handles</div>
              <h2 className="hiw-title">Built for the calls that usually leak bookings.</h2>
              <p className="hiw-sub">RingBooker targets the phone moments that cost salons and clinics revenue: busy service windows, after-hours buying intent, peak overflow, reschedules, cancellations, and callers who hang up instead of leaving voicemail.</p>
              <div className="hiw-handle-grid">
                <div className="hiw-handle"><div className="hiw-handle-icon amber">🌙</div><strong>After-hours calls</strong><p>Answer when the front desk is closed and capture booking intent before the caller tries another business.</p></div>
                <div className="hiw-handle"><div className="hiw-handle-icon blue">📞</div><strong>Overflow calls</strong><p>Step in when your team is with a client, at the chair, in a treatment room, or handling another call.</p></div>
                <div className="hiw-handle"><div className="hiw-handle-icon green">📅</div><strong>Booking requests</strong><p>Collect service, timing, customer details, and preferences needed to move the booking forward.</p></div>
                <div className="hiw-handle"><div className="hiw-handle-icon pink">🔄</div><strong>Reschedules and cancellations</strong><p>Understand the caller’s change request, preserve context, and help your team recover the slot where appropriate.</p></div>
                <div className="hiw-handle"><div className="hiw-handle-icon">💬</div><strong>Missed-call text back</strong><p>Text callers back when they hang up, call after hours, or reach you during a busy window.</p></div>
                <div className="hiw-handle"><div className="hiw-handle-icon slate">🤝</div><strong>Human handoff</strong><p>Escalate special cases with context so your team does not have to restart the conversation.</p></div>
              </div>
            </div>
          </section>

          <section className="hiw-section gray">
            <div className="hiw-container">
              <div className="hiw-no-replace">
                <div>
                  <div className="hiw-label">Trust boundary</div>
                  <h2>What RingBooker does not replace.</h2>
                  <p>This page is intentionally clear because phone routing and booking workflows are sensitive. RingBooker is a recovery layer, not a forced migration.</p>
                </div>
                <div className="hiw-trust-list">
                  <div className="hiw-trust-item"><strong>Your current number</strong><span>You can keep your current number. A dedicated RingBooker number is optional.</span></div>
                  <div className="hiw-trust-item"><strong>Your booking tools</strong><span>RingBooker works alongside your current booking workflow instead of replacing your calendar or booking platform.</span></div>
                  <div className="hiw-trust-item"><strong>Your team’s control</strong><span>Your team decides the coverage rules, escalation path, business hours, and what needs human follow-up.</span></div>
                  <div className="hiw-trust-item"><strong>Human-only situations</strong><span>Complex, sensitive, or policy-heavy calls should be handed off with context rather than forced through a loop.</span></div>
                </div>
              </div>
            </div>
          </section>

          <section className="hiw-section">
            <div className="hiw-container hiw-experience">
              <div className="hiw-call-card">
                <div className="hiw-live"><span className="hiw-dot" />Caller experience</div>
                <h3>No dead-end voicemail when a booking call matters.</h3>
                <p>Callers get a natural answer, a clear next step, and a text confirmation or callback path when needed. The goal is not to pretend to be human. The goal is to keep the booking conversation alive.</p>
              </div>
              <div className="hiw-call-steps">
                <div className="hiw-call-step"><span>🗣</span><div><strong>Answers naturally and quickly</strong><p>RingBooker keeps the call moving without long silence or generic phone-tree friction.</p></div></div>
                <div className="hiw-call-step"><span>💬</span><div><strong>Confirms by text</strong><p>Important outcomes can be followed by SMS so callers know what happened next.</p></div></div>
                <div className="hiw-call-step"><span>🤝</span><div><strong>Hands off gracefully</strong><p>If the caller needs a real person, RingBooker collects context and creates a cleaner callback path.</p></div></div>
              </div>
            </div>
          </section>

          <section className="hiw-section gray">
            <div className="hiw-container">
              <MarketingFaqAccordion
                items={HOW_IT_WORKS_FAQS}
                embedded
                title="Common setup questions."
                subtitle="Short answers for owners and managers comparing call recovery options — current number, no forced booking migration, and what happens on real salon and clinic calls."
              />
            </div>
          </section>

          <section className="hiw-cta">
            <div className="hiw-cta-box">
              <div>
                <h2>See the revenue recovery flow on a real call.</h2>
                <p>Try a live demo or talk through how RingBooker covers after-hours intent, peak-hour overflow, reschedules, cancellations, and missed-call text back on your line — still the number clients already use.</p>
              </div>
              <div className="hiw-actions">
                <a href="/demo" className="hiw-btn-dark" data-demo-picker>
                  <DemoCtaPhoneIcon width={18} height={18} />
                  Try a Live Demo Call
                </a>
                <a href="/contact" className="hiw-btn-outline">Talk to us</a>
              </div>
            </div>
          </section>
        </main>
        <MarketingFooter />
      </>
    </MarketingLayout>
  );
}
