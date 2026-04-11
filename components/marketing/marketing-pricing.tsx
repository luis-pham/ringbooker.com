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
.hero-inner{width:100%;max-width:1100px;display:flex;justify-content:center}
.hero-copy h1{font-size:clamp(40px,5vw,62px);font-weight:800;line-height:1.05;letter-spacing:-2px;margin-bottom:18px}
.hero-copy{width:100%;max-width:980px;text-align:center}
.hero-copy p{font-size:17px;color:var(--text-gray);max-width:none;margin-bottom:28px}
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
.pt-toggle{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 auto 28px;width:max-content;padding:6px;border:1px solid var(--border);border-radius:999px;background:#fff;box-shadow:var(--shadow)}
.pt-btn{padding:10px 18px;border-radius:999px;border:none;background:transparent;font:inherit;font-size:14px;font-weight:700;color:var(--text-gray);cursor:pointer;transition:all .2s}
.pt-btn.on{background:var(--purple);color:#fff;box-shadow:0 8px 20px rgba(139,92,246,.35)}
.pt-save{display:inline-flex;align-items:center;gap:6px;margin-left:6px;font-size:13px;font-weight:700;color:var(--green)}
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
.plan{background:#fff;border-radius:var(--r-lg);padding:28px 24px;border:1.5px solid var(--border);position:relative;display:flex;flex-direction:column;box-shadow:var(--shadow);transition:transform .2s,box-shadow .2s,border-color .2s}
.plan:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,.08);border-color:#d8ccfe}
.plan.star{background:linear-gradient(180deg,#f8f5ff 0%,#ffffff 78%);border-color:var(--purple);box-shadow:0 0 0 4px rgba(139,92,246,.08),var(--shadow)}
.plan-badge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--purple);color:#fff;font-size:14px;font-weight:700;padding:5px 18px;border-radius:var(--r-pill);white-space:nowrap}
.plan h3{font-size:18px;margin-bottom:4px}
.plan p{font-size:14px;color:var(--text-gray);margin-bottom:16px}
.plan-price{font-size:44px;font-weight:800;letter-spacing:-2px;margin-bottom:12px}
.plan-price span{font-size:14px;font-weight:500;color:var(--text-gray)}
.plan ul{list-style:none;display:flex;flex-direction:column;gap:10px;flex:1;margin-bottom:24px}
.plan li{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.5}
.plan li::before{
  width:20px;
  margin-top:0;
  flex-shrink:0;
}
.plan-grid .plan:nth-child(1) li:nth-child(1)::before{content:"📞"}
.plan-grid .plan:nth-child(1) li:nth-child(2)::before{content:"📅"}
.plan-grid .plan:nth-child(1) li:nth-child(3)::before{content:"📶"}
.plan-grid .plan:nth-child(1) li:nth-child(4)::before{content:"☎️"}
.plan-grid .plan:nth-child(1) li:nth-child(5)::before{content:"🔀"}
.plan-grid .plan:nth-child(1) li:nth-child(6)::before{content:"💬"}
.plan-grid .plan:nth-child(1) li:nth-child(7)::before{content:"↩️"}
.plan-grid .plan:nth-child(1) li:nth-child(8)::before{content:"📝"}
.plan-grid .plan:nth-child(2) li:nth-child(1)::before{content:"✅"}
.plan-grid .plan:nth-child(2) li:nth-child(2)::before{content:"⏰"}
.plan-grid .plan:nth-child(2) li:nth-child(3)::before{content:"🧠"}
.plan-grid .plan:nth-child(2) li:nth-child(4)::before{content:"✂️"}
.plan-grid .plan:nth-child(2) li:nth-child(5)::before{content:"🌐"}
.plan-grid .plan:nth-child(2) li:nth-child(6)::before{content:"📊"}
.plan-grid .plan:nth-child(2) li:nth-child(7)::before{content:"📈"}
.plan-grid .plan:nth-child(2) li:nth-child(8)::before{content:"⚡"}
.plan-grid .plan:nth-child(3) li:nth-child(1)::before{content:"🏬"}
.plan-grid .plan:nth-child(3) li:nth-child(2)::before{content:"🧭"}
.plan-grid .plan:nth-child(3) li:nth-child(3)::before{content:"🔌"}
.plan-grid .plan:nth-child(3) li:nth-child(4)::before{content:"📈"}
.plan-grid .plan:nth-child(3) li:nth-child(5)::before{content:"🤝"}
.plan-grid .plan:nth-child(3) li:nth-child(6)::before{content:"🛠️"}
.band{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.band-spaced{margin-top:22px}
.note-box{padding:22px;border-radius:22px;background:#fff;border:1px solid var(--border);box-shadow:var(--shadow)}
.note-box h4{font-size:15px;margin-bottom:10px}
.note-box p,.note-box li{font-size:13.5px;color:var(--text-gray);line-height:1.65}
.note-box ul{list-style:none;padding-left:0;display:grid;gap:8px}
.note-box li{display:flex;gap:9px;align-items:flex-start}
.note-box li::before{
  width:18px;
  margin-top:0;
  flex-shrink:0;
}
.band .note-box:first-child li:nth-child(1)::before{content:"📞"}
.band .note-box:first-child li:nth-child(2)::before{content:"📅"}
.band .note-box:first-child li:nth-child(3)::before{content:"💬"}
.band .note-box:first-child li:nth-child(4)::before{content:"⏰"}
.band .note-box:first-child li:nth-child(5)::before{content:"↩️"}
.band .note-box:first-child li:nth-child(6)::before{content:"☎️"}
.band .note-box:last-child li:nth-child(1)::before{content:"💳"}
.band .note-box:last-child li:nth-child(2)::before{content:"🏢"}
.band .note-box:last-child li:nth-child(3)::before{content:"🤖"}
.band .note-box:last-child li:nth-child(4)::before{content:"🔌"}
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
    starterPrice.innerHTML = monthly ? '$79<span>/ month</span>' : '$63<span>/ month</span>';
    proPrice.innerHTML = monthly ? '$149<span>/ month</span>' : '$119<span>/ month</span>';
  };

  monthlyButton.addEventListener('click', () => setMode('monthly'));
  annualButton.addEventListener('click', () => setMode('annual'));
})();
`,
];

export const templateTitle = "RingBooker Pricing";

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
      <div className="legacy-marketing">
        <nav><div className="nav-inner"><a href="/" className="nav-logo"><div className="nav-logo-icon"><div className="nav-ripple nav-ripple-3" /><div className="nav-ripple nav-ripple-2" /><div className="nav-ripple-core"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></div></div><span>RingBooker</span></a><div className="nav-links"><a href="/#features">Features</a><a href="/demo">Live Demo</a><a href="/pricing" className="active">Pricing</a><a href="/how-it-works">How It Works</a><a href="/contact">Contact</a></div><div className="nav-actions"><a href="/user/login" className="nav-signin">Sign In</a><a href="/user/signup" className="nav-cta">Start Free Trial →</a></div></div></nav><section className="hero-page"><div className="hero-inner"><div className="hero-copy"><div className="badge"><span className="pulse-dot" />Flexible plans for growing salons</div><h1>Clear pricing for salons getting started with AI phone booking.</h1><p>Two core plans for MVP, plus a custom path for multi-location or higher-volume setups. Subscription billing runs through Paddle.</p></div></div></section><section className="section gray"><div className="container"><div className="sec-label">Plans</div><h2 className="sec-title">Choose the right setup for your salon.</h2><p className="sec-sub">Keep the MVP offer simple, believable, and easy to sell.</p><div className="pt-toggle"><button className="pt-btn on" id="pricing-tog-m" type="button">Monthly</button><button className="pt-btn" id="pricing-tog-a" type="button">Annual</button><span className="pt-save">Save 20%</span></div><div className="plan-grid"><div className="plan"><h3>Starter</h3><p>For smaller salons starting with AI phone coverage.</p><div className="plan-price" id="pricing-starter-price">$79 <span>/ month</span></div><ul><li>AI answers calls 24/7</li><li>Books appointments automatically</li><li>Handles multiple calls at once</li><li>1 new business number included</li><li>Or forward your current number</li><li>SMS booking confirmation</li><li>Missed-call text back</li><li>Basic call logs</li></ul><a className="btn-outline" href="/user/signup">Start free trial</a></div><div className="plan star"><div className="plan-badge">Most popular</div><h3>Professional</h3><p>Best for busy salons that want stronger follow-up.</p><div className="plan-price" id="pricing-pro-price">$149 <span>/ month</span></div><ul><li>Everything in Starter</li><li>Reminder SMS</li><li>Returning customer memory</li><li>Preferred stylist handling</li><li>Bilingual user summaries</li><li>Weekly performance summary</li><li>Advanced call insights</li><li>Priority support</li></ul><a className="btn-dark" href="/user/signup">Start free trial</a></div><div className="plan"><h3>Custom</h3><p>For multi-location or more complex workflows.</p><div className="plan-price">Let’s talk</div><ul><li>Multi-location setup</li><li>Custom call flows</li><li>Custom integrations</li><li>Higher call volume planning</li><li>Concierge onboarding</li><li>Priority implementation support</li></ul><a className="btn-outline" href="/contact">Book a demo</a></div></div><div className="band band-spaced"><div className="note-box"><h4>Included now</h4><ul><li>AI answers calls</li><li>Appointment booking</li><li>SMS confirmation</li><li>Reminder SMS</li><li>Missed-call text back</li><li>New number or forwarding</li></ul></div><div className="note-box"><h4>Not included yet</h4><ul><li>Customer deposit/payment collection</li><li>Advanced enterprise routing by default</li><li>Full self-serve onboarding automation</li><li>Complex custom integrations in base plans</li></ul></div></div></div></section><footer><div className="footer-inner"><div className="footer-copy">© 2026 RingBooker. AI phone agent for booking-heavy businesses.</div><div className="footer-links"><a href="/demo">Live Demo</a><a href="/pricing">Pricing</a><a href="/how-it-works">How It Works</a><a href="/contact">Contact</a><a href="/user/login">Sign In</a></div></div></footer>
      </div>
        <MarketingFooter />
      </>

    </MarketingLayout>
  );
}
