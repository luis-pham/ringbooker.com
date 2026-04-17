import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';
import { MarketingFaqAccordion, type MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';

const PRICING_FAQ_ITEMS: MarketingFaqItem[] = [
  {
    q: 'Do I need a new number?',
    a: 'No. Current-number setup is the primary path. A dedicated RingBooker line is available only if you prefer a separate line.',
  },
  {
    q: 'Do I need to change booking software?',
    a: 'No. RingBooker works alongside your current booking tools. It captures the call context and helps move routine scheduling requests forward.',
  },
  {
    q: 'Which plan is right for me?',
    a: 'Start with Starter if your main issue is missed after-hours or overflow calls. Choose Professional if you need stronger follow-up, caller context, and provider preference capture.',
  },
  {
    q: 'Can it handle reschedules and cancellations?',
    a: 'Yes, for routine cases. RingBooker can understand the request, capture context, confirm next steps, and escalate edge cases when a person should step in.',
  },
  {
    q: 'What happens when a caller needs a real person?',
    a: 'RingBooker keeps a human path clear and can hand off the context so your team does not have to restart the conversation.',
  },
  {
    q: 'Is this a generic AI receptionist for any business?',
    a: 'No. RingBooker is AI phone answering and call recovery for nail salons, hair salons, day spas, med spas, and beauty clinics — after-hours intent, overflow, consult calls, and missed-call follow-up, not a broad SMB chatbot.',
  },
];

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
.pricing-page{background:#fff}
.hero-page{padding:76px 48px 72px;background:radial-gradient(ellipse 80% 55% at 50% 0%,#EDE9FE 0%,#FDF4FF 45%,#fff 74%)}
.container{max-width:1100px;margin:0 auto}
.hero-copy{max-width:980px;margin:0 auto;text-align:center}
.badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.88);border:1px solid rgba(139,92,246,0.28);border-radius:var(--r-pill);padding:7px 18px;font-size:var(--mk-badge);font-weight:700;color:var(--purple-dark);margin-bottom:22px;backdrop-filter:blur(8px)}
.pulse-dot{width:7px;height:7px;background:var(--purple);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
.hero-copy h1{font-size:var(--mk-hero-title);font-weight:800;line-height:var(--mk-hero-title-lh);letter-spacing:var(--mk-hero-title-track);margin-bottom:18px}
.hero-copy p{font-size:var(--mk-hero-lead);color:var(--text-gray);max-width:780px;margin:0 auto 28px;line-height:var(--mk-hero-lead-lh)}
.hero-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:24px}
.btn-dark,.btn-outline{padding:14px 24px;border-radius:var(--r-pill);font-size:var(--mk-btn);font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:all .2s}
.btn-dark{background:var(--text-dark);color:#fff}
.btn-dark:hover{background:#1f2937;transform:translateY(-1px)}
.btn-outline{border:1.5px solid var(--border);color:var(--text-dark);background:#fff}
.btn-outline:hover{border-color:var(--purple);color:var(--purple)}
.btn-demo-live{background:linear-gradient(135deg,#5B21B6 0%,#7C3AED 48%,#8B5CF6 100%);color:#fff;padding:15px 28px;border-radius:var(--r-pill);font-size:var(--mk-btn);font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:filter .2s,transform .15s,box-shadow .2s;border:none;box-shadow:0 10px 32px rgba(91,33,182,.32)}
.btn-demo-live:hover{filter:brightness(1.06);transform:translateY(-1px);box-shadow:0 14px 40px rgba(91,33,182,.38)}
.btn-trial-soft{padding:12px 22px;border-radius:var(--r-pill);font-size:var(--mk-btn-sm);font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:all .2s;border:1.5px solid var(--border);color:var(--text-dark);background:transparent}
.btn-trial-soft:hover{border-color:var(--purple);color:var(--purple)}
.trust-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:24px auto 0;max-width:980px}
.trust-pill{display:flex;align-items:center;justify-content:center;gap:9px;border:1px solid rgba(139,92,246,.14);background:rgba(255,255,255,.82);border-radius:18px;padding:12px 13px;font-size:var(--mk-body);font-weight:800;color:#374151;box-shadow:0 10px 28px rgba(17,24,39,.04);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.trust-pill:hover{transform:translateY(-2px);box-shadow:0 16px 36px -6px rgba(17,24,39,.1);border-color:rgba(139,92,246,.22)}
.trust-pill span{font-size:18px}
.section{padding:88px 48px}
.section.gray{background:var(--bg-gray)}
.section.tight{padding-top:64px}
.sec-label{font-size:var(--mk-eyebrow);font-weight:800;color:var(--purple);letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;margin-bottom:12px;text-align:center}
.sec-title{font-size:var(--mk-section-h2);font-weight:800;line-height:var(--mk-section-h2-lh);letter-spacing:var(--mk-section-h2-track);text-align:center;margin-bottom:12px}
.sec-sub{font-size:var(--mk-section-lead);color:var(--text-gray);text-align:center;margin:0 auto 44px;line-height:var(--mk-section-lead-lh);max-width:740px}
.pt-toggle{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 auto 30px;width:max-content;padding:6px;border:1px solid var(--border);border-radius:999px;background:#fff;box-shadow:var(--shadow)}
.pt-btn{padding:10px 18px;border-radius:999px;border:none;background:transparent;font:inherit;font-size:var(--mk-btn-sm);font-weight:800;color:var(--text-gray);cursor:pointer;transition:all .2s}
.pt-btn.on{background:var(--purple);color:#fff;box-shadow:0 8px 20px rgba(139,92,246,.35)}
.pt-save{display:inline-flex;align-items:center;gap:6px;margin-left:6px;font-size:13px;font-weight:800;color:var(--green)}
.plan-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:stretch}
.plan{background:#fff;border-radius:var(--r-lg);padding:28px 24px;border:1.5px solid var(--border);position:relative;display:flex;flex-direction:column;box-shadow:var(--shadow);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.plan:hover{transform:translateY(-2px);box-shadow:0 20px 40px -8px rgba(17,24,39,.12),0 8px 16px -6px rgba(17,24,39,.08);border-color:#d8ccfe}
.plan.star{background:linear-gradient(180deg,#f8f5ff 0%,#ffffff 78%);border-color:var(--purple);box-shadow:0 0 0 4px rgba(139,92,246,.08),var(--shadow)}
.plan.star:hover{border-color:#7c3aed;box-shadow:0 20px 48px -8px rgba(124,58,237,.18),0 0 0 4px rgba(139,92,246,.1)}
.plan-badge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--purple);color:#fff;font-size:var(--mk-badge);font-weight:800;padding:5px 18px;border-radius:var(--r-pill);white-space:nowrap}
.plan-top{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}
.plan-icon,.feature-icon{width:42px;height:42px;border-radius:15px;background:var(--purple-ultra);display:flex;align-items:center;justify-content:center;font-size:21px;flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(139,92,246,.08)}
.plan-kicker{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--purple)}
.plan h3{font-size:22px;font-weight:800;line-height:1.15;letter-spacing:-.5px;margin-bottom:6px}
.plan p{font-size:var(--mk-body);color:var(--text-gray);margin-bottom:16px;line-height:var(--mk-body-lh)}
.plan-price{font-size:44px;font-weight:800;letter-spacing:-2px;margin-bottom:4px}
.plan-price span{font-size:var(--mk-body);font-weight:600;color:var(--text-gray);letter-spacing:0}
.plan-note{font-size:13px;color:var(--text-light);margin-bottom:18px}
.plan ul{list-style:none;display:flex;flex-direction:column;gap:10px;flex:1;margin-bottom:24px}
.plan li{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.5;color:#374151}
.benefit-icon{width:21px;flex-shrink:0;text-align:center}
.self-grid,.feature-grid,.upgrade-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.self-card,.feature-card,.upgrade-card{background:#fff;border:1px solid var(--border);border-radius:22px;padding:22px;box-shadow:var(--shadow);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.self-card:hover,.feature-card:hover,.upgrade-card:hover{transform:translateY(-2px);box-shadow:0 20px 40px -8px rgba(17,24,39,.1),0 8px 16px -6px rgba(17,24,39,.06);border-color:#d1d5db}
.self-card{text-align:center}
.self-card .feature-icon,.feature-card .feature-icon{margin:0 auto 13px}
.self-card h3,.feature-card h3,.upgrade-card h3{font-size:16px;font-weight:800;line-height:1.3;letter-spacing:-.25px;margin-bottom:8px}
.self-card p,.feature-card p,.upgrade-card p{font-size:14px;color:var(--text-gray);line-height:1.65}
.feature-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
.feature-card{text-align:center}
.upgrade-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.upgrade-card{display:flex;gap:14px;align-items:flex-start}
.line-choice{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:stretch}
.line-card{border-radius:28px;padding:28px;border:1px solid var(--border);background:#fff;box-shadow:var(--shadow);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.line-card:hover{transform:translateY(-2px);box-shadow:0 20px 40px -8px rgba(17,24,39,.1),0 8px 16px -6px rgba(17,24,39,.06);border-color:#d1d5db}
.line-card.recommended{background:linear-gradient(180deg,#fbfaff 0%,#fff 82%);border-color:#c4b5fd;box-shadow:0 0 0 4px rgba(139,92,246,.06),var(--shadow)}
.line-card.recommended:hover{border-color:#a78bfa;box-shadow:0 20px 48px -8px rgba(124,58,237,.16),0 0 0 4px rgba(139,92,246,.08)}
.line-card-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}
.pill{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:900}
.pill.optional{background:#f8fafc;color:#475569;border:1px solid #e2e8f0}
.line-card h3{font-size:22px;font-weight:800;line-height:1.2;letter-spacing:-.6px;margin-bottom:9px}
.line-card p{font-size:14.5px;color:var(--text-gray);line-height:1.72}
.expect-band{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.note-box{padding:24px;border-radius:24px;background:#fff;border:1px solid var(--border);box-shadow:var(--shadow);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.note-box:hover{transform:translateY(-2px);box-shadow:0 20px 40px -8px rgba(17,24,39,.1),0 8px 16px -6px rgba(17,24,39,.06);border-color:#d1d5db}
.note-box h3{font-size:18px;font-weight:800;margin-bottom:12px}
.note-box ul{list-style:none;display:grid;gap:10px}
.note-box li{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--text-gray);line-height:1.6}
.note-box li::before{content:"✓";color:var(--purple);font-weight:900}
.cta-box{border-radius:34px;padding:42px;background:linear-gradient(135deg,#111827 0%,#24133f 52%,#4c1d95 100%);color:#fff;display:grid;grid-template-columns:1.15fr .85fr;gap:28px;align-items:center;box-shadow:0 24px 70px rgba(17,24,39,.24)}
.cta-box h2{font-size:clamp(30px,4vw,46px);font-weight:800;line-height:1.1;letter-spacing:-1.3px;margin-bottom:12px}
.cta-box p{color:rgba(255,255,255,.78);line-height:1.75}
.cta-actions{display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap}
.cta-box .btn-outline{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.22);color:#fff}
.cta-box .btn-outline:hover{border-color:rgba(255,255,255,.45);color:#fff}
.cta-box .btn-dark{background:#fff;color:#111827}
.cta-box .btn-trial-soft{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.28);color:#fff}
.cta-box .btn-trial-soft:hover{border-color:rgba(255,255,255,.45);color:#fff}
@media(max-width:960px){
  .hero-page,.section{padding-left:22px;padding-right:22px}
  .trust-row,.plan-grid,.self-grid,.feature-grid,.upgrade-grid,.line-choice,.expect-band,.cta-box{grid-template-columns:1fr}
  /* Clear fixed .mk-nav (68px + 1px border) + breathing room — matches topic hub mobile rhythm */
  .hero-page{padding-top:calc(69px + 28px + env(safe-area-inset-top,0px));padding-bottom:52px}
  .hero-copy{text-align:left}
  .hero-copy h1{font-size:40px}
  .hero-copy p{margin-left:0;margin-right:0}
  .hero-actions{justify-content:flex-start}
  .trust-pill{justify-content:flex-start}
  .pt-toggle{width:100%;max-width:380px}
  .pt-btn{flex:1}
  .pt-save{display:none}
  .cta-actions{justify-content:flex-start}
}
`,
];

const scripts: string[] = [
  String.raw`
(() => {
  const monthlyButton = document.getElementById('pricing-tog-m');
  const annualButton = document.getElementById('pricing-tog-a');
  const starterPrice = document.getElementById('pricing-starter-price');
  const proPrice = document.getElementById('pricing-pro-price');
  if (!monthlyButton || !annualButton || !starterPrice || !proPrice) return;

  const setMode = (mode) => {
    const monthly = mode === 'monthly';
    monthlyButton.classList.toggle('on', monthly);
    annualButton.classList.toggle('on', !monthly);
    starterPrice.innerHTML = monthly ? '$79 <span>/ month</span>' : '$63 <span>/ month</span>';
    proPrice.innerHTML = monthly ? '$149 <span>/ month</span>' : '$119 <span>/ month</span>';
  };

  monthlyButton.addEventListener('click', () => setMode('monthly'));
  annualButton.addEventListener('click', () => setMode('annual'));
})();
`,
];

export const templateTitle =
  'Salon Call Recovery Pricing | After-Hours, Peak-Hour & Missed-Call Revenue Protection';

const plans = [
  {
    name: 'Starter',
    kicker: 'Small team',
    icon: '📞',
    description: 'For smaller salons, spas, and clinics that need reliable after-hours and overflow call coverage.',
    priceId: 'pricing-starter-price',
    price: '$79',
    note: 'Best when you want core after-hours, overflow, and missed-call recovery live quickly.',
    cta: 'Start free trial',
    href: '/user/signup',
    featured: false,
    benefits: [
      ['🏪', 'Works with your current business number'],
      ['🌙', 'After-hours and overflow call answering'],
      ['📅', 'Booking request capture and confirmation'],
      ['🔁', 'Basic reschedule and cancellation handling'],
      ['💬', 'Missed-call text back'],
      ['☎️', 'Optional dedicated RingBooker line'],
      ['📝', 'Basic call logs and summaries'],
    ],
  },
  {
    name: 'Professional',
    kicker: 'Busy location',
    icon: '⚡',
    description: 'For busier teams that need stronger follow-up, caller context, and provider preference capture.',
    priceId: 'pricing-pro-price',
    price: '$149',
    note: 'Best for multi-provider teams with higher call volume and repeat clients.',
    cta: 'Start free trial',
    href: '/user/signup',
    featured: true,
    benefits: [
      ['✅', 'Everything in Starter'],
      ['⏰', 'Reminder SMS and stronger follow-up'],
      ['🧠', 'Returning caller notes and preferences'],
      ['✂️', 'Preferred stylist or provider context'],
      ['🌐', 'Bilingual workflows where configured'],
      ['📊', 'Call recovery insights'],
      ['📈', 'Advanced call insights'],
      ['⚡', 'Priority support'],
    ],
  },
  {
    name: 'Custom',
    kicker: 'Advanced setup',
    icon: '🏬',
    description: 'For multi-location groups, higher-volume call flows, or businesses with custom routing needs.',
    priceId: undefined,
    price: 'Let’s talk',
    note: 'Best when you need implementation planning before rollout.',
    cta: 'Book a demo',
    href: '/contact',
    featured: false,
    benefits: [
      ['🏬', 'Multi-location setup'],
      ['🧭', 'Custom call flows and routing rules'],
      ['🔌', 'Custom integration planning'],
      ['📈', 'Higher call volume planning'],
      ['🤝', 'Concierge onboarding'],
      ['🛠️', 'Priority implementation support'],
    ],
  },
];

const everyPlanFeatures = [
  ['🌙', 'After-hours calls', 'Answer callers when the front desk is closed.'],
  ['📞', 'Overflow coverage', 'Step in when staff are busy with clients.'],
  ['📅', 'Booking requests', 'Capture service, timing, and caller details.'],
  ['🔁', 'Reschedules', 'Handle routine change requests with context.'],
  ['✕', 'Cancellations', 'Confirm cancellations and protect recovery opportunities.'],
  ['💬', 'Missed-call text back', 'Follow up when callers hang up or reach a busy window.'],
  ['🏪', 'Current number', 'Use your existing business number first.'],
  ['☎️', 'Optional line', 'Add a dedicated RingBooker line if preferred.'],
];

export function MarketingPricingTemplate() {
  return (
    <MarketingLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="marketing-pricing"
    >
      <>
        <MarketingChromeStyles />
        <MarketingHeader active="pricing" />
        <main className="pricing-page">
          <section className="hero-page">
            <div className="container">
              <div className="hero-copy">
                <div className="badge"><span className="pulse-dot" />Pricing for booking call recovery</div>
                <h1>Pricing for Missed-Call Recovery and Revenue Protection</h1>
                <p>
                  You are not paying for generic AI — you are paying to reduce missed bookings and revenue leakage. Every plan includes the same ladder: missed calls → missed bookings → lost revenue, and RingBooker → recovered bookings → protected revenue. After-hours answering, peak-hour overflow, and missed-call text back stay centered on your current number, with no booking migration.
                </p>
                <div className="hero-actions">
                  <a className="btn-demo-live" href="/demo" data-demo-picker>
                    <DemoCtaPhoneIcon width={18} height={18} />
                    Try a live demo call
                  </a>
                  <a className="btn-trial-soft" href="/user/signup">Start free trial →</a>
                </div>
                <div className="trust-row">
                  <div className="trust-pill"><span>🏪</span> Current number first</div>
                  <div className="trust-pill"><span>🌙</span> After-hours + overflow</div>
                  <div className="trust-pill"><span>📅</span> No booking migration</div>
                  <div className="trust-pill"><span>☎️</span> Optional dedicated line</div>
                </div>
              </div>
            </div>
          </section>

          <section className="section gray">
            <div className="container">
              <div className="sec-label">Plans</div>
              <h2 className="sec-title">Choose the right level of call recovery.</h2>
              <p className="sec-sub">Starter protects revenue from the most common leaks: after-hours, overflow, and silent hang-ups. Professional adds caller context and stronger follow-up for busier desks. Custom is for complex routing, higher volume, and multi-location rollouts.</p>
              <div className="pt-toggle">
                <button className="pt-btn on" id="pricing-tog-m" type="button">Monthly</button>
                <button className="pt-btn" id="pricing-tog-a" type="button">Annual</button>
                <span className="pt-save">Save 20%</span>
              </div>

              <div className="plan-grid">
                {plans.map((plan) => (
                  <div className={`plan ${plan.featured ? 'star' : ''}`} key={plan.name}>
                    {plan.featured ? <div className="plan-badge">Most popular</div> : null}
                    <div className="plan-top">
                      <div>
                        <div className="plan-kicker">{plan.kicker}</div>
                        <h3>{plan.name}</h3>
                      </div>
                      <div className="plan-icon">{plan.icon}</div>
                    </div>
                    <p>{plan.description}</p>
                    <div className="plan-price" id={plan.priceId}>{plan.price} {plan.priceId ? <span>/ month</span> : null}</div>
                    <div className="plan-note">{plan.note}</div>
                    <ul>
                      {plan.benefits.map(([icon, benefit]) => (
                        <li key={benefit}><span className="benefit-icon">{icon}</span>{benefit}</li>
                      ))}
                    </ul>
                    <a className={plan.featured ? 'btn-dark' : 'btn-outline'} href={plan.href}>{plan.cta}</a>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="section tight">
            <div className="container">
              <div className="sec-label">Best fit</div>
              <h2 className="sec-title">Who each plan is for.</h2>
              <p className="sec-sub">Pick based on call volume and operational complexity, not on whether you want a new number. Current-number setup is available across plans.</p>
              <div className="self-grid">
                <div className="self-card"><div className="feature-icon">💅</div><h3>Starter</h3><p>Solo owners and smaller beauty teams that mainly need after-hours, overflow, and missed-call recovery.</p></div>
                <div className="self-card"><div className="feature-icon">✂️</div><h3>Professional</h3><p>Busy salons, spas, med spas, and clinics with multiple providers, repeat clients, and more follow-up needs.</p></div>
                <div className="self-card"><div className="feature-icon">🏬</div><h3>Custom</h3><p>Multi-location teams or advanced workflows that need custom routing, onboarding, or integration planning.</p></div>
              </div>
            </div>
          </section>

          <section className="section gray">
            <div className="container">
              <div className="sec-label">Every plan</div>
              <h2 className="sec-title">What RingBooker handles in every plan.</h2>
              <p className="sec-sub">The product stays focused on beauty-industry phone behavior: turn more rings into recovered bookings and fewer dead-end voicemails — without asking you to replace your calendar stack.</p>
              <div className="feature-grid">
                {everyPlanFeatures.map(([icon, title, body]) => (
                  <div className="feature-card" key={title}><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{body}</p></div>
                ))}
              </div>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <div className="sec-label">Upgrade path</div>
              <h2 className="sec-title">What changes as you upgrade.</h2>
              <p className="sec-sub">Upgrading is less about “more AI” and more about better context, stronger follow-up, and more operational control as your call volume grows.</p>
              <div className="upgrade-grid">
                <div className="upgrade-card"><div className="feature-icon">🧠</div><div><h3>More caller context</h3><p>Professional adds returning caller memory and preference handling so repeat clients feel less like a cold start.</p></div></div>
                <div className="upgrade-card"><div className="feature-icon">✂️</div><div><h3>Provider and stylist continuity</h3><p>Preserve preferred stylist, technician, provider, or treatment context when the caller asks for someone specific.</p></div></div>
                <div className="upgrade-card"><div className="feature-icon">🌐</div><div><h3>Bilingual summaries</h3><p>Where available, summaries help your team understand call outcomes faster across English and bilingual call scenarios.</p></div></div>
                <div className="upgrade-card"><div className="feature-icon">📊</div><div><h3>Better performance visibility</h3><p>Professional and Custom help you see patterns in missed calls, booking demand, and follow-up opportunities.</p></div></div>
                <div className="upgrade-card"><div className="feature-icon">🧭</div><div><h3>Custom routing</h3><p>Custom supports more complex call flows, multi-location rules, and implementation planning.</p></div></div>
                <div className="upgrade-card"><div className="feature-icon">🤝</div><div><h3>Onboarding support</h3><p>Custom adds higher-touch rollout help for teams that need more setup guidance before going live.</p></div></div>
              </div>
            </div>
          </section>

          <section className="section gray">
            <div className="container">
              <div className="sec-label">Number setup</div>
              <h2 className="sec-title">Current number first. Dedicated line if you prefer.</h2>
              <p className="sec-sub">RingBooker is a phone booking recovery layer, not a phone system replacement. Your deployment choice should match how callers already reach your business.</p>
              <div className="line-choice">
                <div className="line-card recommended">
                  <div className="line-card-head"><div className="plan-icon">🏪</div><span className="pill">Recommended</span></div>
                  <h3>Use your current business number</h3>
                  <p>Most businesses start here. RingBooker can support after-hours and overflow coverage while customers keep calling the number they already know.</p>
                </div>
                <div className="line-card">
                  <div className="line-card-head"><div className="plan-icon">☎️</div><span className="pill optional">Optional</span></div>
                  <h3>Add a dedicated RingBooker line</h3>
                  <p>If you want a separate booking or campaign line, RingBooker can provide one. It is a deployment option, not a requirement.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <div className="expect-band">
                <div className="note-box">
                  <h3>Included now</h3>
                  <ul>
                    <li>AI phone answering for after-hours and overflow calls</li>
                    <li>Booking request capture and SMS confirmation</li>
                    <li>Reschedule and cancellation handling for routine calls</li>
                    <li>Missed-call text back and caller summaries</li>
                    <li>Current-number setup or optional dedicated line</li>
                  </ul>
                </div>
                <div className="note-box">
                  <h3>What RingBooker does not replace</h3>
                  <ul>
                    <li>Your existing booking software or calendar workflow</li>
                    <li>Your team’s control over special cases and human handoff</li>
                    <li>Complex medical or policy-sensitive decisions</li>
                    <li>Payment/deposit collection in the base call recovery flow</li>
                    <li>Custom integrations unless scoped into the right plan</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="section gray">
            <MarketingFaqAccordion
              items={PRICING_FAQ_ITEMS}
              title="Pricing questions, answered plainly."
              subtitle={null}
            />
          </section>

          <section className="section">
            <div className="container">
              <div className="cta-box">
                <div>
                  <h2>Stop letting booking calls leak after hours or during busy windows.</h2>
                  <p>Keep your current number, keep your booking tools, and add RingBooker as the phone layer that turns more calls into recovered bookings and protected revenue.</p>
                </div>
                <div className="cta-actions">
                  <a className="btn-demo-live" href="/demo" data-demo-picker>
                    <DemoCtaPhoneIcon width={18} height={18} />
                    Try a live demo call
                  </a>
                  <a className="btn-trial-soft" href="/user/signup">Start free trial →</a>
                </div>
              </div>
            </div>
          </section>
        </main>
        <MarketingFooter />
      </>
    </MarketingLayout>
  );
}
