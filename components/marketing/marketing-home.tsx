import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { HomePricingToggleClient } from '@/components/marketing/home-pricing-toggle-client';

const HOME_FAQS = [
  {
    q: 'Can RingBooker work with my current salon phone number?',
    a: 'Yes. RingBooker works by forwarding your existing number, so callers keep dialing the same number they already know. You can also use a new RingBooker number if you prefer.',
  },
  {
    q: 'Does RingBooker replace my booking software?',
    a: 'No. RingBooker works alongside Square Appointments today and is designed to support tools like Vagaro, Booksy, and Mindbody as integrations expand. It handles the phone layer while your booking workflow stays familiar.',
  },
  {
    q: 'Can it handle reschedule and cancellation calls?',
    a: 'Yes. RingBooker can collect the caller intent, confirm the service and time, handle simple reschedules or cancellations based on your rules, and send a summary when a human follow-up is needed.',
  },
  {
    q: 'What happens if a caller wants to speak to a real person?',
    a: 'RingBooker can offer a callback, route the request, and send your team a call summary so the caller does not have to repeat everything.',
  },
  {
    q: "Will my customers know they're talking to AI?",
    a: 'RingBooker is designed to be transparent and helpful. It can introduce itself as your virtual assistant, speak naturally, and hand off gracefully when a human is needed.',
  },
  {
    q: 'Can RingBooker text missed callers automatically?',
    a: 'Yes. Missed-call text back and smart callback workflows help recover callers who hang up, call after hours, or reach you during a busy service window.',
  },
  {
    q: 'Does it work for nail salons with Vietnamese-speaking owners?',
    a: 'Yes. RingBooker supports Vietnamese onboarding help and can be configured for English and Vietnamese call flows, summaries, and salon-specific scripts.',
  },
  {
    q: 'Can it answer calls after hours and on weekends?',
    a: 'Yes. RingBooker can answer after-hours and weekend calls, capture booking intent, send confirmations, and make sure your team sees what happened when you are back online.',
  },
];

const homeFaqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: HOME_FAQS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.a,
    },
  })),
};

const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'RingBooker',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '79',
    priceCurrency: 'USD',
  },
  description:
    'AI phone answering service for nail salons, hair salons, spas, and med spas. Answers after-hours and overflow calls, recovers missed bookings, and handles reschedules on your current number.',
};

const styles: string[] = [
  String.raw`
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
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
  --r-pill:999px;
  --r-lg:24px;
  --r-md:16px;
  --r-sm:12px;
}
html{scroll-behavior:smooth}
body{font-family:'Mona Sans Variable',sans-serif;color:var(--text-dark);background:var(--bg);overflow-x:hidden;font-size:16px;line-height:1.6}

/* ─── NAV ─── */
nav{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(255,255,255,0.92);backdrop-filter:blur(14px);border-bottom:1px solid rgba(229,231,235,0.7);height:68px;display:flex;align-items:center;justify-content:center;padding:0 48px}
.nav-inner{width:100%;max-width:1100px;display:flex;align-items:center;justify-content:space-between}
.nav-logo{display:flex;align-items:center;gap:11px;font-weight:800;font-size:19px;color:var(--text-dark);text-decoration:none}
.nav-logo-icon{position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nav-ripple{position:absolute;border-radius:50%;background:#8B5CF6}
.nav-ripple-3{width:38px;height:38px;opacity:.1}
.nav-ripple-2{width:30px;height:30px;opacity:.18}
.nav-ripple-core{width:24px;height:24px;background:var(--purple);border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;z-index:1}
.nav-ripple-core svg{width:13px;height:13px;fill:#fff}
.nav-links{display:flex;align-items:center;gap:32px}
.nav-links a{font-size:14.5px;font-weight:500;color:var(--text-gray);text-decoration:none;transition:color .2s}
.nav-links a:hover{color:var(--text-dark)}
.nav-actions{display:flex;align-items:center;gap:10px}
.nav-signin{padding:9px 16px;border-radius:var(--r-pill);border:1px solid var(--border);font-size:14px;font-weight:600;color:#374151;text-decoration:none;transition:border-color .2s,color .2s,background .2s}
.nav-signin:hover{border-color:#d1d5db;color:var(--text-dark);background:#f9fafb}
.nav-cta{background:var(--text-dark);color:#fff;padding:10px 22px;border-radius:var(--r-pill);font-size:14px;font-weight:600;text-decoration:none;display:flex;align-items:center;gap:7px;transition:background .2s,transform .15s}
.nav-cta:hover{background:#1f2937;transform:scale(1.03)}

/* ─── HERO ─── */
.hero{min-height:100vh;padding:100px 48px 60px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;background:radial-gradient(ellipse 80% 55% at 50% 0%,#EDE9FE 0%,#FDF4FF 45%,#fff 72%)}
.hero-blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:.3;pointer-events:none}
.hero-blob-1{width:560px;height:560px;background:#C4B5FD;top:-200px;left:-140px}
.hero-blob-2{width:460px;height:460px;background:#F9A8D4;top:-100px;right:-120px}
.hero-inner{position:relative;z-index:2;text-align:center;max-width:820px;width:100%}
.hero-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.88);border:1px solid rgba(139,92,246,0.28);border-radius:var(--r-pill);padding:7px 18px;font-size:14px;font-weight:600;color:var(--purple-dark);margin-bottom:28px;backdrop-filter:blur(8px)}
.pulse-dot{width:7px;height:7px;background:var(--purple);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
h1.hero-h{font-size:clamp(42px,6vw,68px);font-weight:800;line-height:1.08;letter-spacing:-2.5px;color:var(--text-dark);margin-bottom:20px}
h1.hero-h .hl{display:inline-block;background:var(--purple);color:#fff;border-radius:var(--r-pill);padding:2px 22px;margin:0 4px}
.hero-sub{font-size:17.5px;color:var(--text-gray);line-height:1.72;max-width:540px;margin:0 auto 36px}
	.hero-btns{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin-bottom:0}
	.btn-dark{background:var(--text-dark);color:#fff;padding:14px 30px;border-radius:var(--r-pill);font-size:15px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:10px;transition:transform .15s,background .2s}
	.btn-dark:hover{background:#1f2937;transform:scale(1.03)}
	.btn-dark svg{width:16px;height:16px;fill:#fff}
	.btn-outline{background:transparent;color:var(--text-dark);padding:14px 26px;border-radius:var(--r-pill);font-size:15px;font-weight:600;text-decoration:none;border:1.5px solid var(--border);display:inline-flex;align-items:center;gap:8px;transition:all .2s}
	.btn-outline:hover{border-color:var(--purple);color:var(--purple)}

	/* ─── SEO PROOF + OBJECTION BLOCKS ─── */
	.proofbar{padding:28px 48px 56px;background:#fff}
	.proofbar-inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
	.proof-item{display:flex;align-items:center;gap:12px;border:1px solid #E9D5FF;background:linear-gradient(145deg,#fff 0%,#FBFAFF 100%);border-radius:20px;padding:15px 16px;font-size:13.5px;font-weight:800;color:#3F2A68;line-height:1.35;box-shadow:0 10px 28px rgba(124,58,237,.06);transition:transform .2s,box-shadow .2s,border-color .2s}
	.proof-item:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(124,58,237,.10);border-color:#DDD6FE}
	.proof-icon{width:34px;height:34px;min-width:34px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.5)}
	.proof-purple{background:#EDE9FE}
	.proof-green{background:#D1FAE5}
	.proof-amber{background:#FEF3C7}
	.proof-pink{background:#FCE7F3}
	.leak-section{padding:88px 48px;background:linear-gradient(180deg,#fff,#F9FAFB)}
	.leak-inner,.compare-inner{max-width:1100px;margin:0 auto}
	.leak-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
	.leak-card{background:#fff;border:1px solid var(--border);border-radius:22px;padding:22px;box-shadow:0 10px 30px rgba(17,24,39,.04)}
	.leak-icon{font-size:26px;margin-bottom:10px}
	.leak-card h3{font-size:17px;line-height:1.35;margin-bottom:8px;letter-spacing:-.3px}
	.leak-card p{font-size:14px;color:var(--text-gray);line-height:1.7}
	.compare-section{padding:88px 48px;background:linear-gradient(180deg,#F9FAFB 0%,#fff 100%);color:var(--text-dark)}
	.compare-grid{display:grid;gap:0;margin-top:42px;border:1px solid #E5E7EB;border-radius:24px;background:#fff;overflow:hidden;box-shadow:0 14px 38px rgba(17,24,39,.05)}
	.compare-row{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #EEF2F7}
	.compare-row:last-child{border-bottom:none}
	.compare-cell{padding:18px 22px;background:#fff}
	.compare-cell.bad{background:#FFFCFC;border-right:1px solid #F1F5F9}
	.compare-cell.good{background:#FBFFFD}
	.compare-eyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;margin-bottom:7px;color:#9CA3AF}
	.compare-cell.good .compare-eyebrow{color:#059669}
	.compare-cell.bad .compare-eyebrow{color:#EF4444}
	.compare-cell p{font-size:14.5px;line-height:1.7;color:#4B5563}
	.compare-cell.good p{color:#064E3B}

	/* ─── HERO VISUAL ─── */
.hero-visual{position:relative;margin-top:56px;height:580px;display:flex;align-items:center;justify-content:center}

/* floating cards */
.fc{position:absolute;background:#fff;border-radius:var(--r-md);padding:14px 18px;box-shadow:0 8px 28px rgba(0,0,0,.09);z-index:4;opacity:0}
.fc-1{top:30px;left:-60px;animation:fc-enter-left .7s cubic-bezier(.22,1,.36,1) .2s forwards,flt 4s ease-in-out 1s infinite}
.fc-2{top:40px;right:-50px;animation:fc-enter-right .7s cubic-bezier(.22,1,.36,1) .4s forwards,flt 4s ease-in-out 1.3s infinite}
.fc-3{bottom:100px;left:-80px;animation:fc-enter-left .7s cubic-bezier(.22,1,.36,1) .6s forwards,flt 4s ease-in-out 1.8s infinite}
.fc-4{bottom:120px;right:-60px;animation:fc-enter-right .7s cubic-bezier(.22,1,.36,1) .8s forwards,flt 4s ease-in-out 2.1s infinite}
@keyframes fc-enter-left{0%{opacity:0;transform:translateX(-40px) translateY(12px)}100%{opacity:1;transform:translateX(0) translateY(0)}}
@keyframes fc-enter-right{0%{opacity:0;transform:translateX(40px) translateY(12px)}100%{opacity:1;transform:translateX(0) translateY(0)}}
@keyframes flt{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.fc-big{font-size:26px;font-weight:800;color:var(--purple)}
.fc-big.green{color:#10B981}
.fc-sm{font-size:11px;color:var(--text-gray);margin-top:2px}
.fc-tag{display:inline-flex;align-items:center;gap:5px;background:var(--purple-ultra);color:var(--purple-dark);font-size:11px;font-weight:600;padding:3px 8px;border-radius:var(--r-pill);margin-top:5px}
.fc-tag.g{background:#D1FAE5;color:#065F46}
.wv{display:flex;align-items:center;gap:2px;height:24px}
.wv span{width:3px;background:var(--purple);border-radius:2px;animation:wwave 1s ease-in-out infinite}
.wv span:nth-child(1){height:7px}.wv span:nth-child(2){height:16px;animation-delay:.1s}.wv span:nth-child(3){height:22px;animation-delay:.2s}.wv span:nth-child(4){height:13px;animation-delay:.3s}.wv span:nth-child(5){height:19px;animation-delay:.4s}.wv span:nth-child(6){height:9px;animation-delay:.5s}.wv span:nth-child(7){height:14px;animation-delay:.6s}
@keyframes wwave{0%,100%{transform:scaleY(.55);opacity:.55}50%{transform:scaleY(1);opacity:1}}

/* ─── PHONE FRAME ─── */
.phone-wrap{position:relative;z-index:3}
.phone-frame{width:272px;height:540px;background:#0d0d0d;border-radius:48px;padding:12px;box-shadow:0 48px 90px rgba(0,0,0,.26),0 0 0 1px rgba(255,255,255,.06) inset}
.phone-screen{background:#1a1a2e;border-radius:38px;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;position:relative}

/* status bar */
.p-status-bar{padding:14px 20px 8px;display:flex;justify-content:space-between;align-items:center;position:relative;z-index:2}
.p-time-txt{font-size:14px;font-weight:700;color:#fff}
.p-icons-txt{font-size:10px;color:rgba(255,255,255,.7);letter-spacing:.5px}

/* voice call screen */
.vc-bg{position:absolute;inset:0;background:linear-gradient(160deg,#1a0533 0%,#2d1b69 40%,#1a0d3a 100%)}
.vc-glow{position:absolute;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(139,92,246,.35) 0%,transparent 70%);top:50%;left:50%;transform:translate(-50%,-60%);animation:glow-pulse 3s ease-in-out infinite}
@keyframes glow-pulse{0%,100%{opacity:.7;transform:translate(-50%,-60%) scale(1)}50%{opacity:1;transform:translate(-50%,-60%) scale(1.15)}}

.vc-content{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;flex:1;padding:10px 20px 20px}
.vc-label{font-size:11px;font-weight:600;color:rgba(255,255,255,.5);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}
.vc-name{font-size:18px;font-weight:700;color:#fff;margin-bottom:4px}
.vc-timer{font-size:14px;color:rgba(255,255,255,.45);margin-bottom:20px;font-variant-numeric:tabular-nums}

/* AI avatar with rings */
.vc-avatar-wrap{position:relative;margin-bottom:18px}
.vc-ring{position:absolute;border-radius:50%;border:1px solid rgba(139,92,246,.3);top:50%;left:50%;transform:translate(-50%,-50%);animation:ring-expand 2.5s ease-out infinite}
.vc-ring-1{width:80px;height:80px;animation-delay:0s}
.vc-ring-2{width:108px;height:108px;animation-delay:.5s}
.vc-ring-3{width:136px;height:136px;animation-delay:1s}
@keyframes ring-expand{0%{opacity:.7;transform:translate(-50%,-50%) scale(.85)}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}
.vc-avatar{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#A855F7);display:flex;align-items:center;justify-content:center;position:relative;z-index:2;box-shadow:0 0 0 3px rgba(139,92,246,.4)}
.vc-avatar svg{width:30px;height:30px;fill:#fff}

/* waveform */
.vc-wave{display:flex;align-items:center;justify-content:center;gap:2.5px;height:28px;margin-bottom:12px}
.vc-wave span{width:3px;background:rgba(167,139,250,.7);border-radius:2px;animation:vc-wv .8s ease-in-out infinite}
.vc-wave span:nth-child(1){height:8px}.vc-wave span:nth-child(2){height:18px;animation-delay:.07s}.vc-wave span:nth-child(3){height:24px;animation-delay:.14s}.vc-wave span:nth-child(4){height:14px;animation-delay:.21s}.vc-wave span:nth-child(5){height:20px;animation-delay:.28s}.vc-wave span:nth-child(6){height:10px;animation-delay:.35s}.vc-wave span:nth-child(7){height:16px;animation-delay:.42s}.vc-wave span:nth-child(8){height:24px;animation-delay:.49s}.vc-wave span:nth-child(9){height:12px;animation-delay:.56s}
@keyframes vc-wv{0%,100%{transform:scaleY(.45);opacity:.5}50%{transform:scaleY(1);opacity:1}}

/* call controls */
.vc-controls{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:0}
.vc-ctrl{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:default}
.vc-ctrl-mute{background:rgba(255,255,255,.12)}
.vc-ctrl-mute svg{width:18px;height:18px;fill:rgba(255,255,255,.7)}
.vc-ctrl-end{width:54px;height:54px;background:#EF4444;box-shadow:0 4px 16px rgba(239,68,68,.4)}
.vc-ctrl-end svg{width:22px;height:22px;fill:#fff}
.vc-ctrl-spk{background:rgba(255,255,255,.12)}
.vc-ctrl-spk svg{width:18px;height:18px;fill:rgba(255,255,255,.7)}

/* live badge */
.vc-live-badge{display:flex;align-items:center;gap:5px;background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3);border-radius:var(--r-pill);padding:3px 10px;font-size:10px;font-weight:700;color:#10B981;margin-bottom:10px}
.live-dot{width:6px;height:6px;border-radius:50%;background:#10B981;animation:pulse 1.5s infinite}

/* ─── TRUSTED ─── */
.trusted{padding:40px 48px 60px;text-align:center}
.trusted-label{font-size:13.5px;color:var(--text-light);font-weight:500;margin-bottom:28px}
.logo-row{display:flex;align-items:center;justify-content:center;gap:48px;flex-wrap:wrap}
.logo-item{display:flex;align-items:center;gap:8px;font-size:14.5px;font-weight:700;color:#C4C9D4;transition:color .2s;cursor:default}
.logo-item:hover{color:#6B7280}
.logo-ico{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px}

/* ─── SECTION SHARED ─── */
.sec-label{font-size:12.5px;font-weight:700;color:var(--purple);letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px;text-align:center}
.sec-title{font-size:clamp(32px,4vw,48px);font-weight:800;line-height:1.12;letter-spacing:-1.6px;text-align:center;margin-bottom:14px}
.sec-sub{font-size:16px;color:var(--text-gray);text-align:center;margin-bottom:52px;line-height:1.65}
.emphasis-5min{color:var(--purple-dark);font-weight:800}

/* ─── FEATURES GRID ─── */
.features{padding:88px 48px;background:var(--bg-gray)}
.feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:1100px;margin:0 auto}
.feat-card{background:#fff;border-radius:var(--r-lg);padding:30px 26px;border:1px solid var(--border);transition:transform .2s,box-shadow .2s;text-align:center;display:flex;flex-direction:column;align-items:center}
.feat-card:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,.07)}
.feat-ico{width:48px;height:48px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:22px}
.fi-y{background:#FEF3C7}.fi-g{background:#D1FAE5}.fi-p{background:#EDE9FE}
.feat-card h3{font-size:16.5px;font-weight:700;margin-bottom:10px;color:var(--text-dark)}
.feat-card p{font-size:13.5px;color:var(--text-gray);line-height:1.65;text-align:left;width:100%}

/* ─── DEEP SECTIONS ─── */
.deep-section{padding:88px 48px 0}
.deep-wrap{padding:0 48px;max-width:1200px;margin:0 auto}
.deep-s1{padding:40px 0 27px;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
.deep-s1 .d-text h2,.deep-s2-outer .d-text h2,.deep-s3-outer .d-text h2{font-size:clamp(20px,2vw,27px);font-weight:800;line-height:1.18;letter-spacing:-.7px;margin-bottom:16px}
.deep-s1 .d-text p,.deep-s2-outer .d-text p,.deep-s3-outer .d-text p{font-size:14.5px;color:var(--text-gray);line-height:1.72;margin-bottom:24px}
.checklist{list-style:none;display:flex;flex-direction:column;gap:12px;margin-bottom:30px}
.checklist li{display:flex;align-items:center;gap:11px;font-size:13.5px;font-weight:600;color:var(--text-dark)}
.ck-ico{width:22px;height:22px;min-width:22px;display:flex;align-items:center;justify-content:center}
.ck-ico svg{display:none}
.ck-ico::before{font-size:17px;line-height:1}
.deep-s1 .checklist li:nth-child(1) .ck-ico::before{content:"🌙"}
.deep-s1 .checklist li:nth-child(2) .ck-ico::before{content:"💲"}
.deep-s1 .checklist li:nth-child(3) .ck-ico::before{content:"💬"}
.deep-s2-outer .checklist li:nth-child(1) .ck-ico::before{content:"📲"}
.deep-s2-outer .checklist li:nth-child(2) .ck-ico::before{content:"⏰"}
.deep-s2-outer .checklist li:nth-child(3) .ck-ico::before{content:"↩️"}
.deep-s3-outer .checklist li:nth-child(1) .ck-ico::before{content:"👩‍🎤"}
.deep-s3-outer .checklist li:nth-child(2) .ck-ico::before{content:"⭐"}
.deep-s3-outer .checklist li:nth-child(3) .ck-ico::before{content:"🔁"}
.chart-wrap{background:#fff;border-radius:var(--r-lg);overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.06);border:1px solid var(--border)}
.chart-inner{padding:24px 28px 0}
.chart-tiny-label{font-size:14px;color:var(--text-gray);font-weight:500;margin-bottom:2px}
.chart-big-row{display:flex;align-items:baseline;gap:12px;margin-bottom:20px}
.chart-big{font-size:36px;font-weight:800;letter-spacing:-1px}
.chart-badge{background:var(--purple-ultra);color:var(--purple-dark);font-size:14px;font-weight:700;padding:4px 12px;border-radius:var(--r-pill)}
.linechart-svg-wrap{position:relative;height:140px;margin:0 -1px}
.linechart-svg-wrap svg{width:100%;height:100%}
.x-labels{display:flex;justify-content:space-between;padding:10px 28px 20px;font-size:14px;color:var(--text-light);font-weight:500}
.deep-s2-outer{background:#EDF9F4;border-radius:var(--r-lg);padding:60px 52px;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
.convo-card{background:#fff;border-radius:var(--r-lg);padding:26px 26px 30px;box-shadow:0 4px 24px rgba(0,0,0,.06);position:relative}
.convo-avatars{display:flex;margin-bottom:20px}
.convo-avatar{width:38px;height:38px;border-radius:50%;border:2.5px solid #fff;margin-right:-10px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff}
.convo-avatar:nth-child(1){background:linear-gradient(135deg,#C4B5FD,#93C5FD)}
.convo-avatar:nth-child(2){background:linear-gradient(135deg,#FCA5A5,#FCD34D)}
.convo-avatar:nth-child(3){background:linear-gradient(135deg,#6EE7B7,#60A5FA)}
.convo-quote{font-size:21px;font-weight:800;color:var(--text-dark);line-height:1.25;margin-bottom:18px}
.convo-wave{height:50px;width:100%;opacity:.15}
.convo-wave path{fill:none;stroke:var(--text-dark);stroke-width:1.5px}
.deep-s3-outer{background:#FEF9EC;border-radius:var(--r-lg);padding:60px 52px;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
.donut-card{background:#fff;border-radius:var(--r-lg);padding:30px 26px;display:flex;flex-direction:column;align-items:center;box-shadow:0 4px 24px rgba(0,0,0,.05)}
.donut-label-top{font-size:14px;color:var(--text-gray);font-weight:500;align-self:flex-start;margin-bottom:18px}
.donut-svg-wrap{position:relative;width:190px;height:190px}
.donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.donut-pct{font-size:38px;font-weight:800;letter-spacing:-1.5px}
.donut-sub{font-size:14px;color:var(--text-gray);margin-top:2px}

/* ─── TESTIMONIALS ─── */
.testimonials{padding:88px 48px}
.test-inner{max-width:1100px;margin:0 auto}
.test-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:48px}
.test-col{display:flex;flex-direction:column;gap:16px}
.test-card{background:var(--bg-gray);border-radius:var(--r-lg);padding:26px;border:1px solid var(--border)}
.test-qq{font-size:24px;color:var(--purple);font-weight:800;line-height:1;margin-bottom:10px}
.test-card p{font-size:13.5px;color:var(--text-dark);line-height:1.72;margin-bottom:16px}
.test-card p.lg{font-size:16px;font-weight:600}
.test-author{display:flex;align-items:center;gap:10px}
.test-av{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--purple),#EC4899);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff}
.test-name{font-size:14px;font-weight:700;color:var(--text-dark)}
.test-role{font-size:14px;color:var(--text-light)}

/* ─── PRICING ─── */
.pricing{padding:88px 48px;background:var(--bg-gray)}
.pricing-inner{max-width:1100px;margin:0 auto}
.price-toggle{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:44px}
.pt-btn{padding:10px 24px;border-radius:var(--r-pill);font-size:14px;font-weight:600;border:none;cursor:pointer;transition:all .2s;font-family:inherit}
.pt-btn.on{background:var(--purple);color:#fff}
.pt-btn:not(.on){background:transparent;color:var(--text-gray)}
.save-tag{background:#111;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:var(--r-pill)}
.price-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:stretch}
.plan{background:#fff;border-radius:var(--r-lg);padding:26px 22px;border:1.5px solid var(--border);position:relative;display:flex;flex-direction:column;height:100%;transition:transform .2s,box-shadow .2s,border-color .2s}
.plan:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,.08);border-color:#d8ccfe}
.plan.star{background:linear-gradient(180deg,#f8f5ff 0%,#ffffff 78%);border-color:var(--purple);box-shadow:0 0 0 4px rgba(139,92,246,.08)}
.plan-badge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--purple);color:#fff;font-size:14px;font-weight:700;padding:5px 18px;border-radius:var(--r-pill);white-space:nowrap}
.plan-name{font-size:16.5px;font-weight:700;margin-bottom:5px}
.plan-desc{font-size:12.5px;color:var(--text-gray);margin-bottom:16px;line-height:1.5}
.plan-price{font-size:40px;font-weight:800;letter-spacing:-2px;margin-bottom:5px}
.plan-price span{font-size:14px;font-weight:500;color:var(--text-gray);letter-spacing:0}
.plan-div{height:1px;background:var(--border);margin:16px 0}
.plan-feats{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:22px;flex:1}
.plan-feats li{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:var(--text-dark);line-height:1.45}
.price-grid .plan-feats li::before{color:inherit;font-weight:700;margin-top:0;flex-shrink:0}
.price-grid .plan:nth-child(1) .plan-feats li:nth-child(1)::before{content:"📞"}
.price-grid .plan:nth-child(1) .plan-feats li:nth-child(2)::before{content:"📅"}
.price-grid .plan:nth-child(1) .plan-feats li:nth-child(3)::before{content:"📶"}
.price-grid .plan:nth-child(1) .plan-feats li:nth-child(4)::before{content:"☎️"}
.price-grid .plan:nth-child(1) .plan-feats li:nth-child(5)::before{content:"🔀"}
.price-grid .plan:nth-child(1) .plan-feats li:nth-child(6)::before{content:"💬"}
.price-grid .plan:nth-child(1) .plan-feats li:nth-child(7)::before{content:"↩️"}
.price-grid .plan:nth-child(1) .plan-feats li:nth-child(8)::before{content:"📝"}
.price-grid .plan:nth-child(1) .plan-feats li:nth-child(9)::before{content:"🇻🇳"}
.price-grid .plan:nth-child(2) .plan-feats li:nth-child(1)::before{content:"✅"}
.price-grid .plan:nth-child(2) .plan-feats li:nth-child(2)::before{content:"⏰"}
.price-grid .plan:nth-child(2) .plan-feats li:nth-child(3)::before{content:"🧠"}
.price-grid .plan:nth-child(2) .plan-feats li:nth-child(4)::before{content:"✂️"}
.price-grid .plan:nth-child(2) .plan-feats li:nth-child(5)::before{content:"🌐"}
.price-grid .plan:nth-child(2) .plan-feats li:nth-child(6)::before{content:"📊"}
.price-grid .plan:nth-child(2) .plan-feats li:nth-child(7)::before{content:"📈"}
.price-grid .plan:nth-child(2) .plan-feats li:nth-child(8)::before{content:"⚡"}
.price-grid .plan:nth-child(3) .plan-feats li:nth-child(1)::before{content:"🏬"}
.price-grid .plan:nth-child(3) .plan-feats li:nth-child(2)::before{content:"🧭"}
.price-grid .plan:nth-child(3) .plan-feats li:nth-child(3)::before{content:"🔌"}
.price-grid .plan:nth-child(3) .plan-feats li:nth-child(4)::before{content:"🤝"}
.price-grid .plan:nth-child(3) .plan-feats li:nth-child(5)::before{content:"📈"}
.price-grid .plan:nth-child(3) .plan-feats li:nth-child(6)::before{content:"🛠️"}
.plan-btn{width:100%;padding:12px;border-radius:var(--r-pill);font-size:14px;font-weight:700;text-align:center;display:block;transition:all .2s;cursor:pointer;border:none;font-family:inherit;margin-top:auto}
.pb-outline{background:transparent;border:1.5px solid var(--border);color:var(--text-dark)}
.pb-outline:hover{border-color:var(--purple);color:var(--purple)}
.pb-dark{background:var(--text-dark);color:#fff}
.pb-dark:hover{background:#1f2937}
.roi-strip{background:#fff;border-radius:var(--r-lg);padding:26px;margin-top:24px;border:1px solid var(--border);display:grid;grid-template-columns:repeat(3,1fr)}
.roi-item{padding:10px 18px;text-align:center}
.roi-item:not(:last-child){border-right:1px solid var(--border)}
.roi-num{font-size:23px;font-weight:800;color:var(--purple-dark)}
.roi-lbl{font-size:14px;color:var(--text-gray);margin-top:4px;line-height:1.4}


/* ─── HOW IT WORKS ─── */
.industries{padding:56px 48px 26px;background:#fff}
.industries-inner{max-width:1100px;margin:0 auto}
.industries-carousel{position:relative;max-width:1100px;margin:0 auto}
.industries-track{
  display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;
  -ms-overflow-style:none;padding-bottom:4px;scroll-behavior:smooth;
}
.industries-track::-webkit-scrollbar{display:none}
.industry-card{
  flex:0 0 calc((100% - 36px) / 4);display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:18px;border:1px solid #e8ebf2;background:#fff;
  box-shadow:0 6px 20px rgba(17,24,39,.04);transition:box-shadow .28s ease,border-color .28s ease,transform .2s ease;
  scroll-snap-align:start;text-decoration:none;
}
.industry-card:hover{border-color:#d9cffd;box-shadow:0 14px 30px rgba(124,58,237,.12)}
.industry-card:hover{transform:none}
.industry-thumb{position:relative;width:100%;aspect-ratio:1/1;border-radius:14px;overflow:hidden;background:#f7f5ff}
.industry-thumb img{width:100%;height:100%;display:block;object-fit:cover;transition:transform .28s ease}
.industry-card:hover .industry-thumb img{transform:scale(1.04)}
.industry-tag{position:absolute;left:8px;top:8px;padding:4px 8px;border-radius:999px;font-size:10px;letter-spacing:.04em;text-transform:uppercase;font-weight:800;background:rgba(17,24,39,.72);color:#fff;backdrop-filter:blur(4px)}
.industry-title{font-size:15px;font-weight:800;line-height:1.3;color:#111827}
.industry-sub{font-size:12px;line-height:1.5;color:#6b7280}
.industry-link{font-size:13px;color:#6d28d9;font-weight:700}
.industries-controls{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:18px}
.industries-nav-btn{
  width:36px;height:36px;border-radius:999px;border:1px solid #ddd6fe;background:#fff;color:#6d28d9;
  display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(124,58,237,.10);position:relative;z-index:2;
}
.industries-nav-btn:hover{background:#f5f3ff}
.industries-nav-btn[hidden]{display:none}
.industries-dots{display:flex;justify-content:center;gap:8px}
.industry-dot{width:10px;height:10px;border-radius:999px;background:#d1d5db;border:none;cursor:pointer;transition:all .2s ease}
.industry-dot.active{width:26px;background:#8b5cf6}
.home-carousel{position:relative}
.home-carousel-controls{display:none;align-items:center;justify-content:center;gap:12px;margin-top:18px}
.home-carousel-nav-btn{
  width:36px;height:36px;border-radius:999px;border:1px solid #ddd6fe;background:#fff;color:#6d28d9;
  display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(124,58,237,.10);
}
.home-carousel-nav-btn:hover{background:#f5f3ff}
.home-carousel-nav-btn[hidden]{display:none}
.home-carousel-dots{display:flex;justify-content:center;gap:8px}
.home-carousel-dot{width:10px;height:10px;border-radius:999px;background:#d1d5db;border:none;cursor:pointer;transition:all .2s ease}
.home-carousel-dot.active{width:26px;background:#8b5cf6}
.steps-section{padding:88px 48px;background:#fff}
.steps-inner{max-width:1100px;margin:0 auto}
.steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:44px}
.step-card{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:28px 24px;box-shadow:0 10px 30px rgba(17,24,39,.05);transition:transform .2s,box-shadow .2s,border-color .2s}
.step-card:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,.07);border-color:#d8ccfe}
.step-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.step-icon{width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:21px;background:linear-gradient(145deg,#F5F3FF 0%,#EDE9FE 100%);border:1px solid #d8ccfe}
.step-num{min-width:42px;height:30px;border-radius:999px;background:var(--purple-ultra);color:var(--purple-dark);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;padding:0 10px}
.step-card h3{font-size:20px;font-weight:800;letter-spacing:-.45px;margin-bottom:9px}
.step-card p{font-size:13.5px;color:var(--text-gray);line-height:1.7}

/* ─── REAL CALL FLOW ─── */
.flow-section{padding:22px 48px 88px;background:#fff}
.flow-inner{max-width:1100px;margin:0 auto;background:linear-gradient(135deg,#fbf9ff,#fff);border:1px solid var(--border);border-radius:32px;padding:34px}
.flow-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:24px;align-items:stretch}
.flow-list{display:flex;flex-direction:column;gap:14px}
.flow-row{display:flex;gap:14px;align-items:flex-start;padding:14px 16px;border-radius:18px;background:#fff;border:1px solid var(--border)}
.flow-dot{width:34px;height:34px;min-width:34px;border-radius:12px;background:var(--purple-ultra);color:var(--purple-dark);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800}
.flow-row h4{font-size:15px;margin-bottom:4px}
.flow-row p{font-size:14px;color:var(--text-gray);line-height:1.6}
.demo-shot{border-radius:24px;border:1.5px dashed #C4B5FD;background:linear-gradient(135deg,#f7f2ff,#fff);min-height:420px;padding:22px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
.demo-shot::before{content:"";position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:50%;background:rgba(139,92,246,.08)}
.demo-badge{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid rgba(139,92,246,.22);border-radius:999px;padding:8px 12px;font-size:11px;font-weight:700;color:var(--purple-dark);width:fit-content;position:relative;z-index:1}
.demo-window{background:#fff;border-radius:22px;border:1px solid var(--border);box-shadow:0 16px 36px rgba(17,24,39,.08);padding:18px;position:relative;z-index:1}
.demo-window h4{font-size:16px;margin-bottom:10px}
.demo-window p{font-size:14px;color:var(--text-gray);line-height:1.65}
.demo-lines{display:flex;flex-direction:column;gap:10px;margin-top:18px}
.demo-line{height:12px;border-radius:999px;background:linear-gradient(90deg,#ede9fe,#f5f3ff)}
.demo-line.sm{width:42%}.demo-line.md{width:68%}.demo-line.lg{width:88%}
.demo-note{font-size:14px;color:var(--text-light);font-weight:600;letter-spacing:.03em;position:relative;z-index:1}

/* ─── MVP SCOPE ─── */
.scope-section{padding:0 48px 88px;background:#fff}
.scope-inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:20px}
.scope-card{border-radius:28px;padding:28px;border:1px solid var(--border)}
.scope-card h3{font-size:22px;letter-spacing:-.6px;margin-bottom:8px}
.scope-card p{font-size:13.5px;color:var(--text-gray);line-height:1.7;margin-bottom:18px}
.scope-card.ok{background:linear-gradient(180deg,#f7f2ff 0%,#fff 100%)}
.scope-card.later{background:linear-gradient(180deg,#fff9ef 0%,#fff 100%)}
.scope-list{list-style:none;display:flex;flex-direction:column;gap:10px}
.scope-list li{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.6}
.scope-icon{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0;margin-top:1px}
.scope-icon.ok{background:#ede9fe;color:var(--purple-dark)}
.scope-icon.later{background:#fff7ed;color:#c2410c}

/* ─── USER PREVIEW ─── */
.user-preview{padding:36px 48px 88px;background:var(--bg-gray)}
.user-preview-inner{max-width:1100px;margin:0 auto}
.user-grid{display:grid;grid-template-columns:.95fr 1.05fr;gap:24px;align-items:center}
.user-copy p{font-size:14.5px;color:var(--text-gray);line-height:1.75;margin-bottom:24px}
.user-shot{border-radius:28px;background:linear-gradient(180deg,#ffffff,#f8fafc);padding:14px;box-shadow:0 20px 50px rgba(17,24,39,.10);border:1px solid rgba(139,92,246,.14)}
.user-shell{position:relative;background:linear-gradient(135deg,#f7f2ff 0%,#ffffff 55%,#f5f3ff 100%);border-radius:22px;overflow:hidden;aspect-ratio:16/9;min-height:auto;border:1px solid #E5E7EB;display:block}



.user-brand .mini-logo{position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center}
.user-brand .mini-logo:before,.user-brand .mini-logo:after{content:"";position:absolute;border-radius:50%;background:#8B5CF6}
.user-brand .mini-logo:before{width:30px;height:30px;opacity:.12}
.user-brand .mini-logo:after{width:22px;height:22px;opacity:.2}
.user-brand .mini-core{width:16px;height:16px;border-radius:50%;background:#8B5CF6;position:relative;z-index:1}

.user-nav div{padding:10px 12px;border-radius:14px;background:#fff;border:1px solid #E5E7EB;font-size:12.5px;font-weight:600;color:#6B7280}
.user-nav div.active{background:#ede9fe;color:#7C3AED;border-color:#ddd6fe}





.user-stat strong{display:block;font-size:22px;letter-spacing:-.8px;margin-bottom:4px}
.user-stat span{font-size:14px;color:#6B7280}
.user-preview-img{
  width:100%;
  height:100%;
  display:block;
  object-fit:cover;
  border-radius:22px;
}



.user-table-row:last-child{border-bottom:none}


@media(max-width:960px){
  .steps-grid,.flow-grid,.scope-inner,.user-grid{grid-template-columns:1fr}
  .user-shell{aspect-ratio:16/10}
  .industry-card{flex-basis:calc((100% - 12px) / 2)}
  .steps-section,.flow-section,.scope-section,.user-preview,.industries{padding-left:22px;padding-right:22px}
  .home-carousel-track{
    display:flex;
    gap:12px;
    overflow-x:auto;
    scroll-snap-type:x mandatory;
    scrollbar-width:none;
    -ms-overflow-style:none;
    scroll-behavior:smooth;
    padding:6px 2px 10px;
  }
  .home-carousel-track::-webkit-scrollbar{display:none}
  .home-carousel-slide{scroll-snap-align:start}
  .home-carousel-controls{display:flex}
  .home-carousel-track .step-card,
  .home-carousel-track .test-card,
  .home-carousel-track .plan{
    margin:0;
    box-sizing:border-box;
    transform:none;
  }
  .home-carousel-track .step-card{flex:0 0 calc((100% - 12px) / 2)}
  .home-carousel-track .test-card{flex:0 0 calc((100% - 12px) / 2)}
  .home-carousel-track .plan{flex:0 0 calc((100% - 12px) / 2);height:auto}
  .home-carousel-track .step-card:hover,
  .home-carousel-track .test-card:hover,
  .home-carousel-track .plan:hover{transform:none}
}

@media(max-width:640px){
  .industry-card{flex-basis:100%}
  .industries-controls{justify-content:center}
  .home-carousel-track .step-card,
  .home-carousel-track .test-card,
  .home-carousel-track .plan{flex-basis:100%}
  .home-carousel-controls{justify-content:center}
}


.user-image-placeholder{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;text-align:center}
.user-image-badge{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid rgba(139,92,246,.20);border-radius:999px;padding:8px 12px;font-size:11px;font-weight:700;color:var(--purple-dark);margin-bottom:16px;box-shadow:0 10px 24px rgba(17,24,39,.06)}
.user-image-icon{width:74px;height:74px;border-radius:22px;background:linear-gradient(135deg,#ede9fe,#f5f3ff);border:1px solid #ddd6fe;display:flex;align-items:center;justify-content:center;color:var(--purple-dark);font-size:30px;font-weight:800;margin-bottom:16px}
.user-image-title{font-size:20px;font-weight:800;letter-spacing:-.5px;margin-bottom:8px}
.user-image-copy{max-width:420px;font-size:13.5px;color:var(--text-gray);line-height:1.7}
.user-image-corners::before,.user-image-corners::after{content:"";position:absolute;width:120px;height:120px;border-radius:50%;background:rgba(139,92,246,.08);filter:blur(4px)}
.user-image-corners::before{top:-36px;right:-36px}
.user-image-corners::after{bottom:-42px;left:-42px}

/* ─── FAQ ─── */
.faq-section{padding:88px 48px;max-width:760px;margin:0 auto}
.faq-section h2{font-size:clamp(28px,3.2vw,42px);font-weight:800;letter-spacing:-1.2px;margin-bottom:10px}
.faq-section .sub{font-size:15px;color:var(--text-gray);margin-bottom:40px;line-height:1.6}
.faq-item{border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:10px;overflow:hidden}
.faq-q{width:100%;background:none;border:none;padding:18px 24px;font-size:14.5px;font-weight:600;color:var(--text-dark);text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-family:inherit;transition:background .2s;gap:12px}
.faq-q:hover{background:var(--bg-gray)}
.faq-plus{width:24px;height:24px;min-width:24px;border-radius:50%;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;transition:transform .3s,background .2s,border-color .2s}
.faq-plus svg{width:12px;height:12px;fill:var(--text-gray);transition:fill .2s}
.faq-item[open] .faq-plus{transform:rotate(45deg);background:var(--purple);border-color:var(--purple)}
.faq-item[open] .faq-plus svg{fill:#fff}
.faq-a{max-height:0;overflow:hidden;transition:max-height .3s ease}
.faq-a p{padding:0 24px 18px;font-size:14px;color:var(--text-gray);line-height:1.72}
.faq-item[open] .faq-a{max-height:220px}
.faq-q{list-style:none}
.faq-q::-webkit-details-marker{display:none}

/* ─── CTA BANNER ─── */
.cta-outer{padding:0 48px 88px;display:flex;justify-content:center}
.cta-inner{width:100%;max-width:1100px}
.cta-banner{border-radius:var(--r-lg);background:linear-gradient(125deg,#6D28D9 0%,#8B5CF6 55%,#A78BFA 100%);padding:52px 56px;display:grid;grid-template-columns:1fr auto auto;gap:32px 40px;overflow:visible;position:relative;align-items:center;min-height:420px}
.cta-banner::before{content:"";position:absolute;right:-30px;top:-40px;width:280px;height:280px;background:rgba(255,255,255,.07);border-radius:50%}
.cta-text{position:relative;z-index:2}
.cta-text h2{font-size:clamp(22px,2.4vw,32px);font-weight:800;color:#fff;letter-spacing:-.7px;margin-bottom:8px;line-height:1.2}
.cta-text p{font-size:14px;color:rgba(255,255,255,.75);line-height:1.65;max-width:380px}
.cta-actions{display:flex;flex-direction:column;gap:10px;position:relative;z-index:2;min-width:210px}
.btn-white{background:#fff;color:var(--purple-dark);padding:13px 26px;border-radius:var(--r-pill);font-size:14.5px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;transition:transform .15s;justify-content:center}
.btn-white:hover{transform:scale(1.04)}
.btn-ghost-w{background:rgba(255,255,255,.14);color:#fff;padding:13px 26px;border-radius:var(--r-pill);font-size:14px;font-weight:600;text-decoration:none;text-align:center;border:1px solid rgba(255,255,255,.28);transition:background .2s;display:block}
.btn-ghost-w:hover{background:rgba(255,255,255,.22)}
/* cta phone — taller + overflow visible */
.cta-phone-wrap{position:relative;z-index:3;overflow:visible;height:320px;width:190px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.cta-phone{width:190px;height:370px;background:#0d0d0d;border-radius:34px;padding:9px;box-shadow:0 16px 40px rgba(0,0,0,.35);position:relative;left:auto;bottom:auto}
.cta-phone-screen{background:#1a1a2e;border-radius:26px;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;position:relative}
.cta-vc-bg{position:absolute;inset:0;background:linear-gradient(160deg,#1a0533,#2d1b69 40%,#1a0d3a)}
.cta-vc-content{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;flex:1;padding:12px 14px 14px}
.cta-vc-status{display:flex;justify-content:space-between;width:100%;margin-bottom:10px}
.cta-vc-status span{font-size:10px;color:rgba(255,255,255,.6);font-weight:600}
.cta-vc-label{font-size:9px;color:rgba(255,255,255,.45);letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px}
.cta-vc-name{font-size:14px;font-weight:700;color:#fff;margin-bottom:2px}
.cta-vc-timer{font-size:11px;color:rgba(255,255,255,.4);margin-bottom:14px}
.cta-vc-avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#A855F7);display:flex;align-items:center;justify-content:center;margin-bottom:12px;box-shadow:0 0 0 3px rgba(139,92,246,.35)}
.cta-vc-avatar svg{width:22px;height:22px;fill:#fff}
.cta-vc-wave{display:flex;align-items:center;justify-content:center;gap:2px;height:20px;margin-bottom:12px}
.cta-vc-wave span{width:2.5px;background:rgba(167,139,250,.7);border-radius:2px;animation:vc-wv .8s ease-in-out infinite}
.cta-vc-wave span:nth-child(1){height:6px}.cta-vc-wave span:nth-child(2){height:14px;animation-delay:.08s}.cta-vc-wave span:nth-child(3){height:18px;animation-delay:.16s}.cta-vc-wave span:nth-child(4){height:10px;animation-delay:.24s}.cta-vc-wave span:nth-child(5){height:16px;animation-delay:.32s}.cta-vc-wave span:nth-child(6){height:8px;animation-delay:.4s}.cta-vc-wave span:nth-child(7){height:12px;animation-delay:.48s}
.cta-sub-wrap{background:rgba(255,255,255,.08);border-radius:10px;padding:8px 10px;width:100%;margin-bottom:12px;border:1px solid rgba(255,255,255,.1)}
.cta-sub-txt{font-size:9.5px;color:#fff;font-weight:500;line-height:1.4}
.cta-vc-ctrl{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:auto}
.cta-ctrl{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.12)}
.cta-ctrl svg{width:14px;height:14px;fill:rgba(255,255,255,.7)}
.cta-ctrl-end{width:44px;height:44px;background:#EF4444;box-shadow:0 3px 12px rgba(239,68,68,.4)}
.cta-ctrl-end svg{width:18px;height:18px;fill:#fff}

/* ─── FOOTER ─── */
footer{background:var(--bg-gray);border-top:1px solid var(--border);padding:60px 48px 32px}
.footer-inner{max-width:1100px;margin:0 auto}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:50px}
.footer-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:17px;margin-bottom:14px}
.footer-desc{font-size:13.5px;color:var(--text-gray);line-height:1.65;margin-bottom:20px}
.footer-social{display:flex;gap:10px}
.soc-btn{width:36px;height:36px;border-radius:50%;border:1px solid var(--border);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;text-decoration:none}
.soc-btn:hover{border-color:var(--purple);background:var(--purple-ultra)}
.soc-btn svg{width:14px;height:14px;fill:var(--text-gray)}
.soc-btn:hover svg{fill:var(--purple)}
.footer-col h4{font-size:11.5px;font-weight:700;color:var(--text-dark);text-transform:uppercase;letter-spacing:.07em;margin-bottom:16px}
.footer-col a{display:block;font-size:13.5px;color:var(--text-gray);text-decoration:none;margin-bottom:10px;transition:color .2s}
.footer-col a:hover{color:var(--text-dark)}
.footer-bottom{border-top:1px solid var(--border);padding-top:22px;display:flex;justify-content:space-between;align-items:center}
.footer-bottom p{font-size:14px;color:var(--text-light)}

/* ─── REVEAL ─── */
.reveal{opacity:1;transform:none}
.reveal.vis{opacity:1;transform:none}

/* ─── RESPONSIVE ─── */
@media(max-width:960px){
  .proofbar-inner,.leak-grid,.compare-row,.feat-grid,.deep-s1,.deep-s2-outer,.deep-s3-outer,.test-grid,.price-grid,.footer-grid{grid-template-columns:1fr}
  .cta-banner{grid-template-columns:1fr;padding:32px 26px}
  .cta-phone-wrap{display:none}
  nav .nav-links{display:none}
  nav,footer,.hero,.proofbar,.leak-section,.compare-section,.features,.trusted,.testimonials,.pricing,.faq-section,.cta-outer,.deep-section,.deep-wrap{padding-left:22px;padding-right:22px}
  .hero-visual{height:480px}
  .phone-frame{width:230px;height:460px}
  .fc{display:none}
  .roi-strip{grid-template-columns:1fr}
  .roi-item:not(:last-child){border-right:none;border-bottom:1px solid var(--border)}
}
.legacy-marketing > nav,
.legacy-marketing > footer,
.legacy-marketing > .topbar{display:none !important}

/* Font floor: raise all small text under 14px (except hero badge) */
.legacy-marketing .fc-sm,
.legacy-marketing .fc-tag,
.legacy-marketing .vc-live-badge,
.legacy-marketing .trusted-label,
.legacy-marketing .sec-label,
.legacy-marketing .feat-card p,
.legacy-marketing .checklist li,
.legacy-marketing .test-card p,
.legacy-marketing .plan-desc,
.legacy-marketing .plan-feats li,
.legacy-marketing .save-tag,
.legacy-marketing .industry-tag,
.legacy-marketing .industry-sub,
.legacy-marketing .industry-link,
.legacy-marketing .step-num,
.legacy-marketing .step-card p,
.legacy-marketing .demo-badge,
.legacy-marketing .scope-card p,
.legacy-marketing .scope-list li,
.legacy-marketing .user-nav div,
.legacy-marketing .user-image-badge,
.legacy-marketing .user-image-copy,
.legacy-marketing .footer-col h4,
.legacy-marketing .footer-desc,
.legacy-marketing .footer-col a{
  font-size:14px !important;
}
`,
];

const scripts: string[] = [
  String.raw`
// Scroll reveal
const obs = new IntersectionObserver(es => es.forEach(e => {
  if(e.isIntersecting) e.target.classList.add('vis')
}), { threshold:.1, rootMargin:'0px 0px -40px 0px' })
document.querySelectorAll('.reveal').forEach(el => obs.observe(el))

// Pricing toggle
function setPrice(m) {
  const mo = m === 'monthly'
  const monthlyToggle = document.getElementById('tog-m')
  const annualToggle = document.getElementById('tog-a')
  const starterPrice = document.getElementById('ps')
  const proPrice = document.getElementById('pp')
  if (!monthlyToggle || !annualToggle || !starterPrice || !proPrice) return
  monthlyToggle.classList.toggle('on', mo)
  annualToggle.classList.toggle('on', !mo)
  starterPrice.innerHTML = mo ? '$79<span>/ month</span>' : '$63<span>/ month</span>'
  proPrice.innerHTML = mo ? '$149<span>/ month</span>' : '$119<span>/ month</span>'
}
window.__ringbookerSetPrice = setPrice

// Voice call timer
let secs = 24
setInterval(() => {
  secs++
  const m = String(Math.floor(secs/60)).padStart(2,'0')
  const s = String(secs%60).padStart(2,'0')
  const el = document.getElementById('vc-timer')
  if(el) el.textContent = m + ':' + s
}, 1000)

// Waveform trigger
const wfEl = document.getElementById('wfbig')
if(wfEl) {
  const wfObs = new IntersectionObserver(es => {
    es.forEach(e => { if(e.isIntersecting) wfEl.classList.add('playing') })
  }, { threshold:.4 })
  wfObs.observe(wfEl)
}

`,
  String.raw`
const setPriceSafe = (mode) => {
  const fn = window.__ringbookerSetPrice
  if (typeof fn === 'function') fn(mode)
}
document.getElementById('tog-m')?.addEventListener('click', () => setPriceSafe('monthly'))
document.getElementById('tog-a')?.addEventListener('click', () => setPriceSafe('annual'))
document.addEventListener('click', (event) => {
  const target = event.target && event.target.closest ? event.target.closest('#tog-m,#tog-a') : null
  if (!target) return
  event.preventDefault()
  setPriceSafe(target.id === 'tog-a' ? 'annual' : 'monthly')
})
setPriceSafe('monthly')
`,
  String.raw`
(() => {
  try {
    const initCarousel = ({
      rootId,
      trackSelector,
      cardSelector,
      prevId,
      nextId,
      dotsId,
      dotClassName,
    }) => {
      const root = document.getElementById(rootId)
      if (!root) return
      const track = root.querySelector(trackSelector)
      const cards = Array.from(root.querySelectorAll(cardSelector))
      const prevBtn = document.getElementById(prevId)
      const nextBtn = document.getElementById(nextId)
      const dotsHost = document.getElementById(dotsId)
      if (!track || !cards.length || !dotsHost) return

      let dots = []
      let active = 0

      const cardStep = () => {
        const style = window.getComputedStyle(track)
        const gap = Number.parseFloat(style.columnGap || style.gap || '0') || 0
        return cards[0].getBoundingClientRect().width + gap
      }

      const maxIndex = () => {
        const step = cardStep()
        if (!step) return 0
        const scrollable = Math.max(0, track.scrollWidth - track.clientWidth)
        return Math.max(0, Math.ceil(scrollable / step))
      }

      const updateDots = () => {
        dots.forEach((dot, index) => {
          dot.classList.toggle('active', index === active)
          dot.setAttribute('aria-current', index === active ? 'true' : 'false')
        })
        if (prevBtn) prevBtn.hidden = active <= 0
        if (nextBtn) nextBtn.hidden = active >= maxIndex()
        dotsHost.hidden = false
      }

      const setActive = (nextIndex, smooth = true) => {
        active = Math.max(0, Math.min(nextIndex, maxIndex()))
        track.scrollTo({ left: cardStep() * active, behavior: smooth ? 'smooth' : 'auto' })
        updateDots()
      }

      const renderDots = () => {
        dotsHost.innerHTML = ''
        const count = maxIndex() + 1
        for (let i = 0; i < count; i += 1) {
          const dot = document.createElement('button')
          dot.type = 'button'
          dot.className = dotClassName
          dot.setAttribute('aria-label', 'Go to slide ' + String(i + 1))
          dot.addEventListener('click', () => setActive(i))
          dotsHost.appendChild(dot)
        }
        dots = Array.from(dotsHost.querySelectorAll('.' + dotClassName))
        updateDots()
      }

      const syncFromScroll = () => {
        const step = cardStep()
        if (!step) return
        active = Math.max(0, Math.min(Math.round(track.scrollLeft / step), maxIndex()))
        updateDots()
      }

      prevBtn?.addEventListener('click', () => setActive(active - 1))
      nextBtn?.addEventListener('click', () => setActive(active + 1))
      track.addEventListener('scroll', syncFromScroll, { passive: true })
      window.addEventListener('resize', () => {
        renderDots()
        setActive(active, false)
      })

      requestAnimationFrame(() => {
        renderDots()
        setActive(0, false)
      })
    }

    initCarousel({
      rootId: 'industriesCarousel',
      trackSelector: '.industries-track',
      cardSelector: '.industry-card',
      prevId: 'industriesPrev',
      nextId: 'industriesNext',
      dotsId: 'industriesDots',
      dotClassName: 'industry-dot',
    })

    initCarousel({
      rootId: 'howCarousel',
      trackSelector: '.home-carousel-track',
      cardSelector: '.step-card',
      prevId: 'howPrev',
      nextId: 'howNext',
      dotsId: 'howDots',
      dotClassName: 'home-carousel-dot',
    })

    initCarousel({
      rootId: 'usersCarousel',
      trackSelector: '.home-carousel-track',
      cardSelector: '.test-card',
      prevId: 'usersPrev',
      nextId: 'usersNext',
      dotsId: 'usersDots',
      dotClassName: 'home-carousel-dot',
    })

    initCarousel({
      rootId: 'pricingCarousel',
      trackSelector: '.home-carousel-track',
      cardSelector: '.plan',
      prevId: 'pricingPrev',
      nextId: 'pricingNext',
      dotsId: 'pricingDots',
      dotClassName: 'home-carousel-dot',
    })
  } catch (error) {
    console.error('Home carousels init failed', error)
  }
})();
`,
];

export const templateTitle = 'RingBooker — AI Phone Answering Service for Salons, Nail Shops & Spas';

export function MarketingHomeTemplate() {
  return (
    <MarketingLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="marketing-home"
    >
      <>
        <MarketingChromeStyles />
        <MarketingHeader />
        <HomePricingToggleClient />
        <div className="legacy-marketing">
        {/* NAV */}
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
              RingBooker
            </a>
            <div className="nav-links">
              <a href="#features">Features</a>
              <a href="/demo">Live Demo</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="nav-actions">
              <a href="/user/login" className="nav-signin">Sign In</a>
              <a href="/user/signup" className="nav-cta">Start Free Trial →</a>
            </div>
          </div>
        </nav>
        {/* HERO */}
        <section className="hero">
          <div className="hero-blob hero-blob-1" />
          <div className="hero-blob hero-blob-2" />
          <div className="hero-inner">
            <div className="hero-badge">
              <span className="pulse-dot" />
              After-hours &amp; overflow call answering for salons
            </div>
            <h1 className="hero-h">Never Miss a<br /><span className="hl">Booking Call</span> on Your Current Number.</h1>
            <p className="hero-sub">RingBooker answers after-hours and overflow calls for nail salons, hair salons, spas, and clinics — recovering missed bookings, handling reschedules, and texting callers back. No new number. No new software.</p>
            <div className="hero-btns">
              <a href="/user/signup" className="btn-dark">
                Start 14-Day Free Trial
                <svg viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" /></svg>
              </a>
              <a href="/demo" className="btn-outline">📞 Hear a Live Demo Call</a>
            </div>
            {/* HERO VISUAL */}
            <div className="hero-visual">
              {/* Floating cards */}
              <div className="fc fc-1">
                <div className="fc-big">62%</div>
                <div className="fc-sm">Calls missed without AI</div>
                <div className="fc-tag">📞 Recovered by RingBooker</div>
              </div>
              <div className="fc fc-2">
                <div className="fc-big green">+$3,700</div>
                <div className="fc-sm">Revenue recovered/mo</div>
                <div className="fc-tag g">📈 avg beauty business</div>
              </div>
              <div className="fc fc-3" style={{minWidth: 170}}>
                <div style={{fontSize: 11, color: 'var(--text-light)', marginBottom: 6}}>🎙 AI Phone Agent Active</div>
                <div className="wv"><span /><span /><span /><span /><span /><span /><span /></div>
                <div style={{fontSize: 11, color: 'var(--text-light)', marginTop: 5}}>Booking appointment…</div>
              </div>
              <div className="fc fc-4">
                <div className="fc-big">24/7</div>
                <div className="fc-sm">Always answering</div>
                <div className="fc-tag">✓ Never offline</div>
              </div>
              {/* PHONE with voice call UI */}
              <div className="phone-wrap">
                <div className="phone-frame">
                  <div className="phone-screen">
                    <div className="vc-bg" />
                    <div className="vc-glow" />
                    <div className="vc-content">
                      {/* Status bar */}
                      <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 16}}>
                        <span style={{fontSize: 14, fontWeight: 700, color: '#fff'}}>9:41</span>
                        <span style={{fontSize: 10, color: 'rgba(255,255,255,.6)'}}>▲⬛</span>
                      </div>
                      {/* Live badge */}
                      <div className="vc-live-badge">
                        <span className="live-dot" />
                        AI Phone Agent Answering
                      </div>
                      <div className="vc-label">Incoming Call</div>
                      <div className="vc-name">Luxe Hair Studio</div>
                      <div className="vc-timer" id="vc-timer">00:24</div>
                      {/* AI Avatar with pulse rings */}
                      <div className="vc-avatar-wrap">
                        <div className="vc-ring vc-ring-1" />
                        <div className="vc-ring vc-ring-2" />
                        <div className="vc-ring vc-ring-3" />
                        <div className="vc-avatar">
                          <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" /></svg>
                        </div>
                      </div>
                      {/* Waveform */}
                      <div className="vc-wave">
                        <span /><span /><span /><span /><span /><span /><span /><span /><span />
                      </div>
                      {/* Controls */}
                      <div className="vc-controls">
                        <div className="vc-ctrl vc-ctrl-mute">
                          <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" /></svg>
                        </div>
                        <div className="vc-ctrl vc-ctrl-end">
                          <svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" transform="rotate(135 12 12)" /></svg>
                        </div>
                        <div className="vc-ctrl vc-ctrl-spk">
                          <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="proofbar" aria-label="RingBooker setup proof points">
          <div className="proofbar-inner">
            {[
              ['☎️', 'Keep your current phone number', 'proof-purple'],
              ['🔌', 'Works with Square, Vagaro, Booksy & existing booking tools', 'proof-green'],
              ['⚡', 'Live in about 15 minutes — no tech setup', 'proof-amber'],
              ['💅', 'Built for nail salons, hair salons, spas, and clinics', 'proof-pink'],
            ].map(([icon, item, tone]) => (
              <div className="proof-item" key={item}>
                <span className={`proof-icon ${tone}`}>{icon}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="leak-section" id="missed-calls">
          <div className="leak-inner">
            <div className="sec-label">Missed-Call Recovery</div>
            <h2 className="sec-title reveal">Your team is great. But your phone is leaking bookings every day.</h2>
            <p className="sec-sub reveal">RingBooker covers the moments your front desk cannot: after hours, during services, at lunch, on weekends, and when two callers ring at once.</p>
            <div className="leak-grid">
              {[
                ['💅', 'Your team is with a client', 'RingBooker answers without forcing your staff to pause a manicure, color service, treatment, or consultation.'],
                ['🌙', 'Calls come in after hours', 'Capture booking intent when the salon is closed, then send confirmations or summaries for the next business day.'],
                ['🔄', 'Reschedule and cancellation calls pile up', 'Handle routine changes without burying your team in voicemail and manual follow-up.'],
                ['📵', 'Callers do not leave messages', 'Missed-call text back gives silent callers an easy way to continue instead of calling your competitor.'],
                ['☎️', 'Two calls ring at the same time', 'Overflow handling keeps the second caller from hearing a busy line or waiting too long.'],
                ['🗓️', 'Online booking did not replace phone calls', 'Some customers still want to talk. RingBooker meets them on the channel they already use.'],
              ].map(([icon, title, body]) => (
                <article className="leak-card reveal" key={title}>
                  <div className="leak-icon">{icon}</div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="compare-section" id="ai-phone-agent-differences">
          <div className="compare-inner">
            <div className="sec-label">Why It Feels Different</div>
            <h2 className="sec-title reveal">Most AI phone agents frustrate callers. RingBooker is designed not to.</h2>
            <p className="sec-sub reveal">The product is built around real salon call behavior: short questions, interruptions, booking changes, and callers who just want a clear next step.</p>
            <div className="compare-grid">
              {[
                ['Endless loops when the caller asks something unexpected.', 'A two-strike fallback, callback offer, and clean handoff when the request needs a human.'],
                ['Pretends to be a real person and breaks trust.', 'Can introduce itself transparently as your virtual assistant while staying warm and useful.'],
                ['Asks seven questions before helping.', 'Asks only what is needed to book, reschedule, cancel, or summarize the request.'],
                ['No context when the team follows up.', 'Call summaries and intent notes help your team continue without making the caller repeat everything.'],
                ['Dead-end voicemail after the caller hangs up.', 'Missed-call text back and smart callback workflows keep the booking alive.'],
              ].map(([bad, good]) => (
                <div className="compare-row" key={bad}>
                  <div className="compare-cell bad">
                    <div className="compare-eyebrow">Generic AI phone agent</div>
                    <p>{bad}</p>
                  </div>
                  <div className="compare-cell good">
                    <div className="compare-eyebrow">RingBooker</div>
                    <p>{good}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="industries" id="industries">
          <div className="industries-inner">
            <div className="sec-label">Industries</div>
            <h2 className="sec-title">Pick your industry and see exactly how RingBooker fits.</h2>
            <p className="sec-sub">Each page is tailored to real call patterns, booking flow, and conversion goals for that business type.</p>
            <div className="industries-carousel" id="industriesCarousel">
              <div className="industries-track">
              <a href="/nail-salon" className="industry-card" data-index={0}>
                <div className="industry-thumb" aria-hidden="true">
                  <img src="/images/nail.jpeg" alt="" loading="lazy" />
                  <span className="industry-tag">Nail</span>
                </div>
                <div className="industry-title">Nail Salon</div>
                <div className="industry-sub">Built for manicure, pedicure, and gel services with heavy walk-in and peak-hour calls.</div>
                <div className="industry-link">Explore this page →</div>
              </a>
              <a href="/hair-salon" className="industry-card" data-index={1}>
                <div className="industry-thumb" aria-hidden="true">
                  <img src="/images/hair_shop.jpeg" alt="" loading="lazy" />
                  <span className="industry-tag">Hair</span>
                </div>
                <div className="industry-title">Hair Salon</div>
                <div className="industry-sub">Designed for cuts, color, and stylist-led schedules where calls arrive during active service.</div>
                <div className="industry-link">Explore this page →</div>
              </a>
              <a href="/spa" className="industry-card" data-index={2}>
                <div className="industry-thumb" aria-hidden="true">
                  <img src="/images/spa.jpeg" alt="" loading="lazy" />
                  <span className="industry-tag">Spa</span>
                </div>
                <div className="industry-title">Spa / Day Spa</div>
                <div className="industry-sub">Treatment-heavy bookings and after-hours availability.</div>
                <div className="industry-link">Explore this page →</div>
              </a>
              <a href="/med-spa" className="industry-card" data-index={3}>
                <div className="industry-thumb" aria-hidden="true">
                  <img src="/images/med_spa.jpeg" alt="" loading="lazy" />
                  <span className="industry-tag">Med Spa</span>
                </div>
                <div className="industry-title">Med Spa</div>
                <div className="industry-sub">Consultation-driven calls with high-ticket conversion.</div>
                <div className="industry-link">Explore this page →</div>
              </a>
              <a href="/beauty-clinic" className="industry-card" data-index={4}>
                <div className="industry-thumb" aria-hidden="true">
                  <img src="/images/beauty_clinic.jpeg" alt="" loading="lazy" />
                  <span className="industry-tag">Clinic</span>
                </div>
                <div className="industry-title">Beauty / Aesthetic Clinic</div>
                <div className="industry-sub">Consultation, follow-up, and treatment scheduling workflows.</div>
                <div className="industry-link">Explore this page →</div>
              </a>
              </div>
              <div className="industries-controls" aria-label="Industries carousel controls">
                <button type="button" id="industriesPrev" className="industries-nav-btn" aria-label="Previous industry">‹</button>
                <div className="industries-dots" id="industriesDots" aria-label="Industries carousel indicators" />
                <button type="button" id="industriesNext" className="industries-nav-btn" aria-label="Next industry">›</button>
              </div>
            </div>
          </div>
        </section>
        {/* HOW IT WORKS */}
        <section className="steps-section" id="how-it-works">
          <div className="steps-inner">
            <div className="sec-label">How It Works</div>
            <h2 className="sec-title reveal">Get your AI phone agent live<br />in three simple steps.</h2>
            <p className="sec-sub reveal">Built for busy beauty businesses that want to go live in about <span className="emphasis-5min">5 minutes</span>, not get stuck in more software complexity.</p>
            <div className="home-carousel" id="howCarousel">
              <div className="steps-grid home-carousel-track">
                <div className="step-card reveal home-carousel-slide">
                  <div className="step-head">
                    <div className="step-icon">☎️</div>
                    <div className="step-num">Step 01</div>
                  </div>
                  <h3>Forward your existing number (or get a new one).</h3>
                  <p>Keep the number your clients already know. RingBooker can sit behind your current front-desk line or use a new number if you prefer.</p>
                </div>
                <div className="step-card reveal home-carousel-slide">
                  <div className="step-head">
                    <div className="step-icon">🗓️</div>
                    <div className="step-num">Step 02</div>
                  </div>
                  <h3>Tell RingBooker your services, hours, and what to say.</h3>
                  <p>Set your booking rules, service menu, business hours, caller scripts, and handoff rules so the AI follows your front-desk style.</p>
                </div>
                <div className="step-card reveal home-carousel-slide">
                  <div className="step-head">
                    <div className="step-icon">🤖</div>
                    <div className="step-num">Step 03</div>
                  </div>
                  <h3>RingBooker handles calls, confirms bookings, and texts your clients — automatically.</h3>
                  <p>After-hours and overflow callers get help right away, while your team gets the call summary and next action in the dashboard.</p>
                </div>
              </div>
              <div className="home-carousel-controls" aria-label="How it works carousel controls">
                <button type="button" id="howPrev" className="home-carousel-nav-btn" aria-label="Previous step">‹</button>
                <div className="home-carousel-dots" id="howDots" aria-label="How it works carousel indicators" />
                <button type="button" id="howNext" className="home-carousel-nav-btn" aria-label="Next step">›</button>
              </div>
            </div>
          </div>
        </section>
        {/* FEATURES GRID */}
        <section className="features" id="features">
          <div className="sec-label">Core Features</div>
          <h2 className="sec-title reveal">Built for beauty businesses.<br />Trained to book.</h2>
          <p className="sec-sub reveal">Everything you need to stop losing clients to voicemail.</p>
          <div className="feat-grid">
            <div className="feat-card reveal">
              <div className="feat-ico fi-y">📞</div>
              <h3>After-Hours &amp; Overflow Call Answering.</h3>
              <p>Answers calls when your team is busy, closed, already on another line, or serving a client.</p>
            </div>
            <div className="feat-card reveal">
              <div className="feat-ico fi-g">📅</div>
              <h3>Reschedule, Cancel &amp; Confirm Call Handling.</h3>
              <p>Handles common booking changes based on your rules and sends the caller a clear confirmation.</p>
            </div>
            <div className="feat-card reveal">
              <div className="feat-ico fi-p">⚡</div>
              <h3>Missed-Call Text Back &amp; Smart Callback.</h3>
              <p>Texts callers who hang up or reach you after hours, then queues the right follow-up for your team.</p>
            </div>
            <div className="feat-card reveal">
              <div className="feat-ico fi-y">↩️</div>
              <h3>Works With Your Current Number &amp; Booking Tools.</h3>
              <p>Forward your front-desk line and keep using the booking workflow you already know, with Square live today and more integrations expanding.</p>
            </div>
            <div className="feat-card reveal">
              <div className="feat-ico fi-g">📲</div>
              <h3>Call Summary &amp; Intent Dashboard for You.</h3>
              <p>Every call becomes a transcript, summary, and outcome so you can see what happened without replaying voicemail.</p>
            </div>
            <div className="feat-card reveal">
              <div className="feat-ico fi-p">📊</div>
              <h3>Human Handoff When the Caller Needs It.</h3>
              <p>If the request is complex, RingBooker collects context, offers a callback, and hands the conversation back cleanly.</p>
            </div>
          </div>
        </section>
        {/* DEEP SECTION 1 — Line chart */}
        <section className="deep-section">
          <div style={{textAlign: 'center', marginBottom: 4}}><div className="sec-label">24/7 Availability</div></div>
          <h2 className="sec-title reveal" style={{marginBottom: 60}}>Fill your calendar while<br />you do what you do best.</h2>
          <div className="deep-wrap" style={{padding: 0}}>
            <div className="deep-s1 reveal">
              {/* Chart */}
              <div className="chart-wrap">
                <div className="chart-inner">
                  <div className="chart-tiny-label">Bookings Captured.</div>
                  <div className="chart-big-row">
                    <div className="chart-big">5.2K</div>
                    <div className="chart-badge">↑ +30%</div>
                  </div>
                </div>
                <div className="linechart-svg-wrap">
                  <svg viewBox="0 0 600 140" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="lg1" x1={0} y1={0} x2={0} y2={1}>
                        <stop offset="0%" stopColor="#FB923C" stopOpacity=".35" />
                        <stop offset="100%" stopColor="#FB923C" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <path d="M0,120 C40,115 60,100 90,85 C120,70 130,40 160,30 C185,22 200,55 230,60 C260,65 270,45 300,50 C330,55 340,30 370,18 C390,10 405,35 430,38 C450,40 460,28 480,22 L480,140 L0,140 Z" fill="url(#lg1)" />
                    <path d="M0,120 C40,115 60,100 90,85 C120,70 130,40 160,30 C185,22 200,55 230,60 C260,65 270,45 300,50 C330,55 340,30 370,18 C390,10 405,35 430,38 C450,40 460,28 480,22" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx={480} cy={22} r={6} fill="#fff" stroke="#F97316" strokeWidth="2.5" />
                    <text x={494} y={27} fontSize={11} fill="#374151" fontFamily="Mona Sans Variable, sans-serif" fontWeight={600}>5.2K +30%</text>
                  </svg>
                </div>
                <div className="x-labels">
                  <span>01</span><span>05</span><span>10</span><span style={{fontWeight: 700, color: '#111'}}>15</span><span>20</span>
                </div>
              </div>
              {/* Text */}
              <div className="d-text">
                <h2>81% of bookings happen<br />outside business hours.</h2>
                <p>While you're serving a client or sleeping, your phone keeps ringing. RingBooker is always on — answering calls, checking your calendar, and filling your appointment book automatically.</p>
                <ul className="checklist">
                  <li><span className="ck-ico"><svg viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></span>Books appointments at 2am on weekends</li>
                  <li><span className="ck-ico"><svg viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></span>Answers pricing &amp; services questions instantly</li>
                  <li><span className="ck-ico"><svg viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></span>Sends SMS recap to you after every call</li>
                </ul>
                <a href="/user/signup" className="btn-dark" style={{width: 'fit-content'}}>Get Started Now <svg viewBox="0 0 24 24" style={{width: 15, height: 15, fill: '#fff'}}><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" /></svg></a>
              </div>
            </div>
          </div>
        </section>
        {/* DEEP SECTION 2 — Confirmation */}
        <section style={{padding: '27px 48px'}}>
          <div className="deep-wrap" style={{padding: 0}}>
            <div className="deep-s2-outer reveal">
              <div className="d-text">
                <h2>Every caller gets an instant<br />SMS confirmation.</h2>
                <p>The moment a booking is confirmed, your client receives a text with their date, time, stylist name, and directions — automatically. No manual work. No follow-up needed.</p>
                <ul className="checklist">
                  <li><span className="ck-ico"><svg viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></span>Date, time, stylist, and directions in one SMS</li>
                  <li><span className="ck-ico"><svg viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></span>Automatic reminder 24 hours before appointment</li>
                  <li><span className="ck-ico"><svg viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></span>Missed call recovery — AI texts back anyone who hung up</li>
                </ul>
                <a href="/user/signup" className="btn-dark" style={{width: 'fit-content'}}>Get Started Now <svg viewBox="0 0 24 24" style={{width: 15, height: 15, fill: '#fff'}}><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" /></svg></a>
              </div>
              <div className="convo-card">
                <div className="convo-avatars">
                  <div className="convo-avatar">J</div>
                  <div className="convo-avatar">S</div>
                  <div className="convo-avatar">M</div>
                </div>
                <div className="convo-quote">I want to book my<br />Saturday appointment.</div>
                <svg className="convo-wave" viewBox="0 0 400 52" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0,26 C20,20 30,35 50,28 C70,21 80,38 100,30 C120,22 130,36 150,29 C170,22 185,40 200,32 C215,24 225,38 245,30 C265,22 278,36 300,29 C322,22 335,38 355,30 C375,22 388,34 400,28" stroke="#9CA3AF" strokeWidth="1.5" fill="none" />
                </svg>
              </div>
            </div>
          </div>
        </section>
        {/* DEEP SECTION 3 — Client memory */}
        <section style={{padding: '0 48px 27px'}}>
          <div className="deep-wrap" style={{padding: 0}}>
            <div className="deep-s3-outer reveal">
              <div className="donut-card">
                <div className="donut-label-top">Call-to-Booking Rate.</div>
                <div className="donut-svg-wrap">
                  <svg viewBox="0 0 190 190" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="dg1" x1={0} y1={0} x2={1} y2={1}><stop offset="0%" stopColor="#7C3AED" /><stop offset="100%" stopColor="#A78BFA" /></linearGradient>
                      <linearGradient id="dg2" x1={0} y1={1} x2={1} y2={0}><stop offset="0%" stopColor="#F97316" /><stop offset="100%" stopColor="#FBBF24" /></linearGradient>
                    </defs>
                    <circle cx={95} cy={95} r={72} fill="none" stroke="#F3F4F6" strokeWidth={16} />
                    <circle cx={95} cy={95} r={72} fill="none" stroke="url(#dg1)" strokeWidth={16} strokeDasharray="344 108" strokeDashoffset={0} strokeLinecap="round" transform="rotate(-90 95 95)" />
                    <circle cx={95} cy={95} r={72} fill="none" stroke="url(#dg2)" strokeWidth={16} strokeDasharray="81 371" strokeDashoffset={-362} strokeLinecap="round" transform="rotate(-90 95 95)" />
                    <circle cx={95} cy={23} r={6} fill="#fff" stroke="#7C3AED" strokeWidth={2} />
                    <circle cx={95} cy={167} r={6} fill="#fff" stroke="#F97316" strokeWidth={2} />
                  </svg>
                  <div className="donut-center">
                    <div className="donut-pct">76%</div>
                    <div className="donut-sub">calls booked</div>
                  </div>
                </div>
                <div style={{fontSize: 14, color: 'var(--text-gray)', marginTop: 12, fontWeight: 500}}>vs 23% industry average</div>
              </div>
              <div className="d-text">
                <h2>Your business memory.<br />Every client, every preference.</h2>
                <p>RingBooker remembers which stylist each client prefers, their last service, and their usual slot — so every call feels personal, not robotic. Build loyalty that keeps chairs full.</p>
                <ul className="checklist">
                  <li><span className="ck-ico"><svg viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></span>Remembers stylist preference per client</li>
                  <li><span className="ck-ico"><svg viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></span>Flags VIP returning customers automatically</li>
                  <li><span className="ck-ico"><svg viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></span>Suggests rebooking at the right interval</li>
                </ul>
                <a href="/user/signup" className="btn-dark" style={{width: 'fit-content'}}>Get Started Now <svg viewBox="0 0 24 24" style={{width: 15, height: 15, fill: '#fff'}}><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" /></svg></a>
              </div>
            </div>
          </div>
        </section>
        {/* TESTIMONIALS */}
        <section className="testimonials" id="testimonials">
          <div className="test-inner">
            <div className="sec-label" style={{textAlign: 'center'}}>Real Business Users</div>
            <h2 className="sec-title reveal">Beauty teams that<br />speak volumes.</h2>
            <div className="home-carousel reveal" id="usersCarousel">
              <div className="test-grid home-carousel-track">
                <div className="test-card home-carousel-slide">
                  <div className="test-qq">"</div>
                  <p className="lg">I used to stop mid-color to answer the phone. Now my team stays focused and the bookings still happen.</p>
                  <div className="test-author">
                    <div className="test-av">SP</div>
                    <div><div className="test-name">Sarah P.</div><div className="test-role">Nail Salon Owner — NYC</div></div>
                  </div>
                </div>
                <div className="test-card home-carousel-slide">
                  <div className="test-qq">"</div>
                  <p>Saturday mornings were a mess — three calls and one person at the desk. Now RingBooker handles the overflow and we do not lose callers.</p>
                  <div className="test-author">
                    <div className="test-av">MT</div>
                    <div><div className="test-name">Michael T.</div><div className="test-role">Hair Salon — Chicago</div></div>
                  </div>
                </div>
                <div className="test-card home-carousel-slide">
                  <div className="test-qq">"</div>
                  <p>We kept our existing number, took about 15 minutes to set up, and clients still reach us the way they always have.</p>
                  <div className="test-author">
                    <div className="test-av">JK</div>
                    <div><div className="test-name">Jenny K.</div><div className="test-role">Day Spa — Dallas</div></div>
                  </div>
                </div>
                <div className="test-card home-carousel-slide">
                  <div className="test-qq">"</div>
                  <p>After-hours used to be a black hole. Now missed callers get a text back and we know exactly who needs a callback.</p>
                  <div className="test-author">
                    <div className="test-av">LR</div>
                    <div><div className="test-name">Lisa R.</div><div className="test-role">Med Spa — LA</div></div>
                  </div>
                </div>
              </div>
              <div className="home-carousel-controls" aria-label="Users carousel controls">
                <button type="button" id="usersPrev" className="home-carousel-nav-btn" aria-label="Previous user story">‹</button>
                <div className="home-carousel-dots" id="usersDots" aria-label="User stories carousel indicators" />
                <button type="button" id="usersNext" className="home-carousel-nav-btn" aria-label="Next user story">›</button>
              </div>
            </div>
          </div>
        </section>
        {/* USER DASHBOARD PREVIEW */}
        <section className="user-preview">
          <div className="user-preview-inner">
            <div className="user-grid">
              <div className="user-copy">
                <div className="sec-label" style={{textAlign: 'left'}}>User Dashboard</div>
                <h2 style={{fontSize: 'clamp(30px,4vw,44px)', lineHeight: '1.12', letterSpacing: '-1.2px', marginBottom: 14}}>See calls, bookings, and settings in one place.</h2>
                <p>Your user portal gives you a clear view of every booking, call outcome, reminder, and business setting — without needing to learn a complicated system.</p>
                <a href="/user/signup" className="btn-dark" style={{width: 'fit-content'}}>Start Free Trial <svg viewBox="0 0 24 24" style={{width: 15, height: 15, fill: '#fff'}}><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" /></svg></a>
              </div>
              <div className="user-shot">
                <div className="user-shell user-image-corners">
                  <img src="images/shop_panel.jpg" alt="RingBooker user dashboard preview" className="user-preview-img" />
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* PRICING */}
        <section className="pricing" id="pricing">
          <div className="pricing-inner">
            <div className="sec-label" style={{textAlign: 'center'}}>Pricing</div>
            <h2 className="sec-title reveal">Simple, transparent pricing.</h2>
            <p className="sec-sub reveal">A fraction of what a human receptionist costs at $2,500–$3,500/month.</p>
            <div className="price-toggle">
              <button className="pt-btn on" id="tog-m" type="button">Monthly</button>
              <button className="pt-btn" id="tog-a" type="button">Annual</button>
              <span className="save-tag">SAVE 20%</span>
            </div>
            <div className="home-carousel" id="pricingCarousel">
            <div className="price-grid home-carousel-track reveal">
              <div className="plan home-carousel-slide">
                <div className="plan-name">Starter</div>
                <div className="plan-desc">For small beauty businesses getting started with an AI phone agent.</div>
                <div className="plan-price" id="ps">$79<span>/month</span></div>
                <div className="plan-div" />
                <ul className="plan-feats">
                  <li>AI answers calls 24/7</li>
                  <li>Books appointments automatically</li>
                  <li>Handles multiple simultaneous calls</li>
                  <li>1 US business number included</li>
                  <li>Or forward your existing number</li>
                  <li>SMS booking confirmation</li>
                  <li>Missed-call text back</li>
                  <li>Basic call logs</li>
                  <li>Vietnamese onboarding support</li>
                </ul>
                <a className="plan-btn pb-outline" href="/user/signup">Start Free Trial →</a>
              </div>
              <div className="plan star home-carousel-slide">
                <div className="plan-badge">⭐ Most Popular</div>
                <div className="plan-name">Professional</div>
                <div className="plan-desc">Best for busy beauty teams that want stronger follow-up and visibility.</div>
                <div className="plan-price" id="pp">$149<span>/month</span></div>
                <div className="plan-div" />
                <ul className="plan-feats">
                  <li>Everything in Starter</li>
                  <li>Reminder SMS before appointments</li>
                  <li>Returning customer memory</li>
                  <li>Preferred stylist handling</li>
                  <li>Bilingual user summaries</li>
                  <li>Weekly performance summary</li>
                  <li>Advanced call insights</li>
                  <li>Priority support</li>
                </ul>
                <a className="plan-btn pb-dark" href="/user/signup">Start Free Trial →</a>
              </div>
              <div className="plan home-carousel-slide">
                <div className="plan-name">Custom</div>
                <div className="plan-desc">For multi-location businesses, higher call volume, or custom workflows.</div>
                <div className="plan-price" style={{fontSize: 30, letterSpacing: '-1px'}}>Custom<span>/contact us</span></div>
                <div className="plan-div" />
                <ul className="plan-feats">
                  <li>Multi-location setup</li>
                  <li>Custom call flows</li>
                  <li>Custom integrations</li>
                  <li>Concierge onboarding</li>
                  <li>Higher call volume</li>
                  <li>Tailored implementation support</li>
                </ul>
                <a className="plan-btn pb-outline" href="/contact">Contact Sales →</a>
              </div>
            </div>
              <div className="home-carousel-controls" aria-label="Pricing carousel controls">
                <button type="button" id="pricingPrev" className="home-carousel-nav-btn" aria-label="Previous pricing plan">‹</button>
                <div className="home-carousel-dots" id="pricingDots" aria-label="Pricing carousel indicators" />
                <button type="button" id="pricingNext" className="home-carousel-nav-btn" aria-label="Next pricing plan">›</button>
              </div>
            </div>
            <div className="roi-strip reveal">
              <div className="roi-item">
                <div className="roi-num">$2,351</div>
                <div className="roi-lbl">Saved vs human receptionist/mo</div>
              </div>
              <div className="roi-item">
                <div className="roi-num">$3,700</div>
                <div className="roi-lbl">Avg revenue recovered from missed calls</div>
              </div>
              <div className="roi-item">
                <div className="roi-num">2,300%+</div>
                <div className="roi-lbl">Estimated ROI on Professional plan</div>
              </div>
            </div>
          </div>
        </section>
        {/* FAQ */}
        <section className="faq-section" id="faq">
          <div className="sec-label">FAQ</div>
          <h2 className="reveal">Frequently asked<br />questions.</h2>
          <p className="sub reveal">Everything you need to know before getting started.</p>
          {HOME_FAQS.map((faq) => (
            <details className="faq-item" key={faq.q}>
              <summary className="faq-q">{faq.q}<div className="faq-plus"><svg viewBox="0 0 24 24"><path d="M19 13H13v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg></div></summary>
              <div className="faq-a"><p>{faq.a}</p></div>
            </details>
          ))}
        </section>
        {/* CTA BANNER */}
        <div className="cta-outer">
          <div className="cta-inner">
            <div className="cta-banner reveal">
              <div className="cta-text">
                <h2>Every unanswered call is a booking<br />your competitor just got.</h2>
                <p>RingBooker answers 24/7 — so you never lose another client to voicemail, a busy signal, or a missed ring.</p>
              </div>
              <div className="cta-actions">
                <a href="#pricing" className="btn-white">
                  <svg viewBox="0 0 24 24" style={{width: 16, height: 16, fill: 'var(--purple-dark)'}}><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" /></svg>
                  Get 14 Days Free
                </a>
                <a href="/demo" className="btn-ghost-w">📞 Try a Live Demo</a>
              </div>
              {/* CTA Phone — voice call UI */}
              <div className="cta-phone-wrap">
                <div className="cta-phone">
                  <div className="cta-phone-screen">
                    <div className="cta-vc-bg" />
                    <div className="cta-vc-content">
                      <div className="cta-vc-status">
                        <span>9:41</span>
                        <span>▲⬛</span>
                      </div>
                      <div className="vc-live-badge" style={{fontSize: 9, padding: '2px 8px', marginBottom: 8}}>
                        <span className="live-dot" />
                        AI Answering
                      </div>
                      <div className="cta-vc-label">Active Call</div>
                      <div className="cta-vc-name">Luxe Hair Studio</div>
                      <div className="cta-vc-timer">00:47</div>
                      <div className="cta-vc-avatar">
                        <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" /></svg>
                      </div>
                      <div className="cta-vc-wave">
                        <span /><span /><span /><span /><span /><span /><span />
                      </div>
                      <div className="cta-sub-wrap">
                        <div className="cta-sub-txt">Saturday 2pm with Maria is confirmed! You'll get a text shortly.</div>
                      </div>
                      <div className="cta-vc-ctrl">
                        <div className="cta-ctrl">
                          <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" /></svg>
                        </div>
                        <div className="cta-ctrl cta-ctrl-end">
                          <svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" transform="rotate(135 12 12)" /></svg>
                        </div>
                        <div className="cta-ctrl">
                          <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* FOOTER */}
        <footer>
          <div className="footer-inner">
            <div className="footer-grid">
              <div>
                <div className="footer-brand">
                  <div className="nav-logo-icon" style={{position: 'relative', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                    <div style={{position: 'absolute', width: 34, height: 34, borderRadius: '50%', background: '#8B5CF6', opacity: '.1'}} />
                    <div style={{position: 'absolute', width: 26, height: 26, borderRadius: '50%', background: '#8B5CF6', opacity: '.18'}} />
                    <div style={{position: 'absolute', width: 21, height: 21, borderRadius: '50%', background: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1}}>
                      <svg viewBox="0 0 24 24" style={{width: 11, height: 11, fill: '#fff'}}><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
                    </div>
                  </div>
                  RingBooker
                </div>
                <p className="footer-desc">AI phone answering service built for nail shops, hair salons, spas, med spas, and beauty clinics. Stop losing after-hours and overflow calls to voicemail.</p>
                <div className="footer-social">
                  <a className="soc-btn" href="#"><svg viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" /></svg></a>
                  <a className="soc-btn" href="#"><svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg></a>
                  <a className="soc-btn" href="#"><svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg></a>
                </div>
              </div>
              <div className="footer-col">
                <h4>Product</h4>
                <a href="#features">Features</a>
                <a href="/demo">Live Demo</a>
                <a href="#pricing">Pricing</a>
                <a href="#how-it-works">How It Works</a>
              </div>
              <div className="footer-col">
                <h4>Resources</h4>
                <a href="/after-hours-calls">After-Hours Calls</a>
                <a href="/missed-call-recovery">Missed-Call Recovery</a>
                <a href="/demo">Live Demo</a>
                <a href="#pricing">Pricing</a>
                <a href="#faq">FAQ</a>
                <a href="/contact">Contact Us</a>
                <a href="/user/login">Sign In</a>
              </div>
              <div className="footer-col">
                <h4>Company</h4>
                <a href="/privacy">Privacy Policy</a>
                <a href="/terms">Terms of Service</a>
                <a href="/contact">Support</a>
                <a href="/contact">Contact</a>
                <a href="/user/login">Sign In</a>
              </div>
            </div>
            <div className="footer-bottom">
              <p>© 2025 RingBooker — All rights reserved.</p>
              <p>Built for beauty & wellness teams 💜</p>
            </div>
          </div>
        </footer>
      </div>
        <MarketingFooter />
      </>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqJsonLd) }} />

    </MarketingLayout>
  );
}
