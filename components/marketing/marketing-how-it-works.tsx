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
.demo-shot-title{display:block;font-size:20px;color:var(--text-dark);margin-bottom:10px}
.demo-shot-copy{max-width:320px}
.demo-shot-inline-title{display:block;color:var(--text-dark);margin-bottom:8px}
.card-title-spaced{margin-bottom:12px}
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

const scripts: string[] = [

];

export const templateTitle = "How RingBooker Works";

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
      <div className="legacy-marketing">
        <nav><div className="nav-inner"><a href="/" className="nav-logo"><div className="nav-logo-icon"><div className="nav-ripple nav-ripple-3" /><div className="nav-ripple nav-ripple-2" /><div className="nav-ripple-core"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></div></div><span>RingBooker</span></a><div className="nav-links"><a href="/#features">Features</a><a href="/demo">Live Demo</a><a href="/pricing">Pricing</a><a href="/how-it-works" className="active">How It Works</a><a href="/contact">Contact</a></div><div className="nav-actions"><a href="/user/login" className="nav-signin">Sign In</a><a href="/user/signup" className="nav-cta">Start Free Trial →</a></div></div></nav><section className="hero-page"><div className="hero-inner"><div className="hero-copy"><div className="badge"><span className="pulse-dot" />Simple setup, clear call flow</div><h1>How RingBooker works from phone call to booked appointment.</h1><p>Show salon users the exact flow: connect a number, add services and hours, let AI answer, then confirm everything by text.</p><div className="hero-actions"><a href="/contact" className="btn-dark">Book setup demo</a><a href="/pricing" className="btn-outline">See pricing</a></div></div><div className="hero-card"><div className="demo-shot tall"><div><strong className="demo-shot-title">Process graphic placeholder</strong><div className="demo-shot-copy">Replace later with a custom diagram or product screenshot showing number → AI → calendar → SMS → dashboard.</div></div></div></div></div></section><section className="section"><div className="container"><div className="sec-label">4 simple steps</div><h2 className="sec-title">A phone-first workflow users can understand fast.</h2><div className="grid-4"><div className="flow-step"><div className="step-no">1</div><h3>Connect your phone line</h3><p>Get a new business number or forward your existing salon number into RingBooker.</p></div><div className="flow-step"><div className="step-no">2</div><h3>Add your business details</h3><p>Set services, prices, hours, calendar, and basic rules the AI should follow on calls.</p></div><div className="flow-step"><div className="step-no">3</div><h3>AI answers and books</h3><p>RingBooker answers every call, checks availability, suggests alternatives, and books the appointment.</p></div><div className="flow-step"><div className="step-no">4</div><h3>SMS and dashboard update</h3><p>The customer receives a text confirmation, and the user sees the result inside the portal.</p></div></div></div></section><section className="section gray"><div className="container"><div className="grid-2"><div className="card"><h3 className="card-title-spaced">What happens on a real call</h3><div className="mini-list"><div className="mini-item"><div className="mini-icon">📞</div><div><strong>Customer calls the salon</strong><div className="helper">RingBooker picks up instantly</div></div></div><div className="mini-item"><div className="mini-icon">🗣</div><div><strong>AI answers naturally</strong><div className="helper">Handles booking questions and interruptions</div></div></div><div className="mini-item"><div className="mini-icon">📅</div><div><strong>Checks live availability</strong><div className="helper">Uses your configured calendar workflow</div></div></div><div className="mini-item"><div className="mini-icon">✉️</div><div><strong>Sends confirmation text</strong><div className="helper">Appointment details go out automatically</div></div></div></div></div><div className="card"><h3 className="card-title-spaced">What the user sees</h3><div className="demo-shot"><div><strong className="demo-shot-inline-title">User dashboard preview placeholder</strong>Swap this with a screenshot of bookings, call outcomes, or settings later.</div></div></div></div></div></section><footer><div className="footer-inner"><div className="footer-copy">© 2026 RingBooker. AI phone agent for booking-heavy businesses.</div><div className="footer-links"><a href="/demo">Live Demo</a><a href="/pricing">Pricing</a><a href="/how-it-works">How It Works</a><a href="/contact">Contact</a><a href="/user/login">Sign In</a></div></div></footer>
      </div>
        <MarketingFooter />
      </>

    </MarketingLayout>
  );
}
