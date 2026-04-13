import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';

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
body{font-family:'Mona Sans Variable',sans-serif;color:var(--text-dark);background:var(--bg);overflow-x:hidden;font-size:16px;line-height:1.6}
a{text-decoration:none;color:inherit}
.pricing-page{background:#fff}
.hero-page{padding:88px 48px 54px;background:radial-gradient(ellipse 80% 55% at 50% 0%,#EDE9FE 0%,#FDF4FF 45%,#fff 74%)}
.container{max-width:1100px;margin:0 auto}
.hero-copy{max-width:980px;margin:0 auto;text-align:center}
.badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.88);border:1px solid rgba(139,92,246,0.28);border-radius:var(--r-pill);padding:7px 18px;font-size:14px;font-weight:700;color:var(--purple-dark);margin-bottom:22px;backdrop-filter:blur(8px)}
.pulse-dot{width:7px;height:7px;background:var(--purple);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
.hero-copy h1{font-size:clamp(40px,5vw,64px);font-weight:800;line-height:1.04;letter-spacing:-2.2px;margin-bottom:18px}
.hero-copy p{font-size:17px;color:var(--text-gray);max-width:780px;margin:0 auto 28px;line-height:1.75}
.hero-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:24px}
.btn-dark,.btn-outline{padding:14px 24px;border-radius:var(--r-pill);font-size:15px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:all .2s}
.btn-dark{background:var(--text-dark);color:#fff}
.btn-dark:hover{background:#1f2937;transform:translateY(-1px)}
.btn-outline{border:1.5px solid var(--border);color:var(--text-dark);background:#fff}
.btn-outline:hover{border-color:var(--purple);color:var(--purple)}
.btn-demo-live{background:linear-gradient(135deg,#5B21B6 0%,#7C3AED 48%,#8B5CF6 100%);color:#fff;padding:15px 28px;border-radius:var(--r-pill);font-size:15px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:filter .2s,transform .15s,box-shadow .2s;border:none;box-shadow:0 10px 32px rgba(91,33,182,.32)}
.btn-demo-live:hover{filter:brightness(1.06);transform:translateY(-1px);box-shadow:0 14px 40px rgba(91,33,182,.38)}
.btn-trial-soft{padding:12px 22px;border-radius:var(--r-pill);font-size:14px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:all .2s;border:1.5px solid var(--border);color:var(--text-dark);background:transparent}
.btn-trial-soft:hover{border-color:var(--purple);color:var(--purple)}
.trust-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:24px auto 0;max-width:980px}
.trust-pill{display:flex;align-items:center;justify-content:center;gap:9px;border:1px solid rgba(139,92,246,.14);background:rgba(255,255,255,.82);border-radius:18px;padding:12px 13px;font-size:13.5px;font-weight:800;color:#374151;box-shadow:0 10px 28px rgba(17,24,39,.04)}
.trust-pill span{font-size:18px}
.section{padding:88px 48px}
.section.gray{background:var(--bg-gray)}
.section.tight{padding-top:64px}
.sec-label{font-size:12.5px;font-weight:800;color:var(--purple);letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;text-align:center}
.sec-title{font-size:clamp(32px,4vw,48px);font-weight:800;line-height:1.12;letter-spacing:-1.4px;text-align:center;margin-bottom:12px}
.sec-sub{font-size:16px;color:var(--text-gray);text-align:center;margin:0 auto 44px;line-height:1.7;max-width:740px}
.pt-toggle{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 auto 30px;width:max-content;padding:6px;border:1px solid var(--border);border-radius:999px;background:#fff;box-shadow:var(--shadow)}
.pt-btn{padding:10px 18px;border-radius:999px;border:none;background:transparent;font:inherit;font-size:14px;font-weight:800;color:var(--text-gray);cursor:pointer;transition:all .2s}
.pt-btn.on{background:var(--purple);color:#fff;box-shadow:0 8px 20px rgba(139,92,246,.35)}
.pt-save{display:inline-flex;align-items:center;gap:6px;margin-left:6px;font-size:13px;font-weight:800;color:var(--green)}
.plan-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:stretch}
.plan{background:#fff;border-radius:var(--r-lg);padding:28px 24px;border:1.5px solid var(--border);position:relative;display:flex;flex-direction:column;box-shadow:var(--shadow);transition:transform .2s,box-shadow .2s,border-color .2s}
.plan:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,.08);border-color:#d8ccfe}
.plan.star{background:linear-gradient(180deg,#f8f5ff 0%,#ffffff 78%);border-color:var(--purple);box-shadow:0 0 0 4px rgba(139,92,246,.08),var(--shadow)}
.plan-badge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--purple);color:#fff;font-size:14px;font-weight:800;padding:5px 18px;border-radius:var(--r-pill);white-space:nowrap}
.plan-top{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}
.plan-icon,.feature-icon{width:42px;height:42px;border-radius:15px;background:var(--purple-ultra);display:flex;align-items:center;justify-content:center;font-size:21px;flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(139,92,246,.08)}
.plan-kicker{font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--purple)}
.plan h3{font-size:22px;line-height:1.15;letter-spacing:-.5px;margin-bottom:6px}
.plan p{font-size:14px;color:var(--text-gray);margin-bottom:16px;line-height:1.65}
.plan-price{font-size:44px;font-weight:900;letter-spacing:-2px;margin-bottom:4px}
.plan-price span{font-size:14px;font-weight:600;color:var(--text-gray);letter-spacing:0}
.plan-note{font-size:13px;color:var(--text-light);margin-bottom:18px}
.plan ul{list-style:none;display:flex;flex-direction:column;gap:10px;flex:1;margin-bottom:24px}
.plan li{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.5;color:#374151}
.benefit-icon{width:21px;flex-shrink:0;text-align:center}
.self-grid,.feature-grid,.upgrade-grid,.faq-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.self-card,.feature-card,.upgrade-card,.faq-card{background:#fff;border:1px solid var(--border);border-radius:22px;padding:22px;box-shadow:var(--shadow)}
.self-card{text-align:center}
.self-card .feature-icon,.feature-card .feature-icon{margin:0 auto 13px}
.self-card h3,.feature-card h3,.upgrade-card h3,.faq-card h3{font-size:16px;font-weight:900;line-height:1.3;letter-spacing:-.25px;margin-bottom:8px}
.self-card p,.feature-card p,.upgrade-card p,.faq-card p{font-size:14px;color:var(--text-gray);line-height:1.65}
.feature-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
.feature-card{text-align:center}
.upgrade-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.upgrade-card{display:flex;gap:14px;align-items:flex-start}
.line-choice{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:stretch}
.line-card{border-radius:28px;padding:28px;border:1px solid var(--border);background:#fff;box-shadow:var(--shadow)}
.line-card.recommended{background:linear-gradient(180deg,#fbfaff 0%,#fff 82%);border-color:#c4b5fd;box-shadow:0 0 0 4px rgba(139,92,246,.06),var(--shadow)}
.line-card-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}
.pill{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:900}
.pill.optional{background:#f8fafc;color:#475569;border:1px solid #e2e8f0}
.line-card h3{font-size:22px;line-height:1.2;letter-spacing:-.6px;margin-bottom:9px}
.line-card p{font-size:14.5px;color:var(--text-gray);line-height:1.72}
.expect-band{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.note-box{padding:24px;border-radius:24px;background:#fff;border:1px solid var(--border);box-shadow:var(--shadow)}
.note-box h3{font-size:18px;margin-bottom:12px}
.note-box ul{list-style:none;display:grid;gap:10px}
.note-box li{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--text-gray);line-height:1.6}
.note-box li::before{content:"✓";color:var(--purple);font-weight:900}
.faq-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.cta-box{border-radius:34px;padding:42px;background:linear-gradient(135deg,#111827 0%,#24133f 52%,#4c1d95 100%);color:#fff;display:grid;grid-template-columns:1.15fr .85fr;gap:28px;align-items:center;box-shadow:0 24px 70px rgba(17,24,39,.24)}
.cta-box h2{font-size:clamp(30px,4vw,46px);line-height:1.1;letter-spacing:-1.3px;margin-bottom:12px}
.cta-box p{color:rgba(255,255,255,.78);line-height:1.75}
.cta-actions{display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap}
.cta-box .btn-outline{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.22);color:#fff}
.cta-box .btn-outline:hover{border-color:rgba(255,255,255,.45);color:#fff}
.cta-box .btn-dark{background:#fff;color:#111827}
.cta-box .btn-trial-soft{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.28);color:#fff}
.cta-box .btn-trial-soft:hover{border-color:rgba(255,255,255,.45);color:#fff}
@media(max-width:960px){
  .hero-page,.section{padding-left:22px;padding-right:22px}
  .trust-row,.plan-grid,.self-grid,.feature-grid,.upgrade-grid,.line-choice,.expect-band,.faq-grid,.cta-box{grid-template-columns:1fr}
  .hero-page{padding-top:70px}
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

export const templateTitle = "RingBooker Pricing";

const plans = [
  {
    name: 'Starter',
    kicker: 'Small team',
    icon: '📞',
    description: 'For smaller salons, spas, and clinics that need reliable after-hours and overflow call coverage.',
    priceId: 'pricing-starter-price',
    price: '$79',
    note: 'Best when you want the core booking recovery layer live quickly.',
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
    description: 'For busier teams that need stronger follow-up, caller context, and provider-aware handling.',
    priceId: 'pricing-pro-price',
    price: '$149',
    note: 'Best for multi-provider teams with higher call volume and repeat clients.',
    cta: 'Start free trial',
    href: '/user/signup',
    featured: true,
    benefits: [
      ['✅', 'Everything in Starter'],
      ['⏰', 'Reminder SMS and stronger follow-up'],
      ['🧠', 'Returning caller context and preferences'],
      ['✂️', 'Preferred stylist or provider continuity'],
      ['🌐', 'Bilingual summaries where available'],
      ['📊', 'Weekly performance summary'],
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
                <h1>Plans for recovering more booking calls on your current number.</h1>
                <p>RingBooker handles after-hours and overflow calls, reschedules, cancellations, and missed-call text back without replacing your booking software. Most businesses keep their current number; a dedicated RingBooker line is optional.</p>
                <div className="hero-actions">
                  <a className="btn-demo-live" href="/demo" data-demo-picker>Try a live demo call</a>
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
              <p className="sec-sub">Starter covers the core missed-call problem. Professional adds more context and follow-up. Custom is for complex routing, higher volume, and multi-location rollouts.</p>
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
              <p className="sec-sub">The core product stays focused: recover phone demand that would otherwise become voicemail, abandoned calls, or missed booking opportunities.</p>
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
            <div className="container">
              <div className="sec-label">FAQ</div>
              <h2 className="sec-title">Pricing questions, answered plainly.</h2>
              <div className="faq-grid">
                <div className="faq-card"><h3>Do I need a new number?</h3><p>No. Current-number setup is the primary path. A dedicated RingBooker line is available only if you prefer a separate line.</p></div>
                <div className="faq-card"><h3>Do I need to change booking software?</h3><p>No. RingBooker works alongside your current booking tools. It captures the call context and helps move routine scheduling requests forward.</p></div>
                <div className="faq-card"><h3>Which plan is right for me?</h3><p>Start with Starter if your main issue is missed after-hours or overflow calls. Choose Professional if you need stronger follow-up, caller context, and provider continuity.</p></div>
                <div className="faq-card"><h3>Can it handle reschedules and cancellations?</h3><p>Yes, for routine cases. RingBooker can understand the request, capture context, confirm next steps, and escalate edge cases when a person should step in.</p></div>
                <div className="faq-card"><h3>What happens when a caller needs a real person?</h3><p>RingBooker keeps a human path clear and can hand off the context so your team does not have to restart the conversation.</p></div>
                <div className="faq-card"><h3>Is this just a generic AI receptionist?</h3><p>No. RingBooker is positioned for beauty and wellness phone booking recovery: salons, spas, med spas, clinics, and appointment-heavy teams.</p></div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <div className="cta-box">
                <div>
                  <h2>Stop letting booking calls leak after hours or during busy windows.</h2>
                  <p>Keep your current number, keep your booking tools, and add RingBooker as the phone layer that helps recover missed demand.</p>
                </div>
                <div className="cta-actions">
                  <a className="btn-demo-live" href="/demo" data-demo-picker>Try a live demo call</a>
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
