import Script from 'next/script';

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
      --blue:#3B82F6;
      --r-pill:999px;
      --r-lg:24px;
      --r-md:16px;
      --r-sm:12px;
      --shadow:0 16px 48px rgba(17,24,39,.08);
    }
    *{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth}
    body{font-family:'Mona Sans Variable',sans-serif;color:var(--text-dark);background:var(--bg);font-size:16px;line-height:1.6;overflow-x:hidden}
    a{text-decoration:none;color:inherit}
    button,input,select,textarea{font:inherit}
    nav{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-bottom:1px solid rgba(229,231,235,.7);height:68px;display:flex;align-items:center;justify-content:center;padding:0 48px}
    .nav-inner{width:100%;max-width:1160px;display:flex;align-items:center;justify-content:space-between;gap:20px}
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
    .nav-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}
    .nav-signin{padding:9px 16px;border-radius:var(--r-pill);border:1px solid var(--border);font-size:14px;font-weight:600;color:#374151;background:#fff;transition:border-color .2s,color .2s,background .2s}
    .nav-signin:hover{border-color:#d1d5db;color:var(--text-dark);background:#f9fafb}
    .nav-demo-live{background:linear-gradient(135deg,#5B21B6 0%,#7C3AED 48%,#8B5CF6 100%);color:#fff;padding:10px 22px;border-radius:var(--r-pill);font-size:14px;font-weight:800;display:flex;align-items:center;gap:7px;transition:filter .2s,transform .15s,box-shadow .2s;white-space:nowrap;box-shadow:0 6px 22px rgba(91,33,182,.28)}
    .nav-demo-live:hover{filter:brightness(1.06);transform:scale(1.03)}
    .nav-trial-outline{background:transparent;color:#374151;padding:10px 20px;border-radius:var(--r-pill);font-size:14px;font-weight:600;border:1.5px solid var(--border);display:flex;align-items:center;gap:7px;transition:border-color .2s,color .2s,background .2s,transform .15s;white-space:nowrap}
    .nav-trial-outline:hover{border-color:var(--purple);color:var(--purple-dark);background:#faf5ff}

    .hero{padding:84px 48px 28px;display:flex;justify-content:center;background:radial-gradient(ellipse 80% 55% at 50% 0%,#EDE9FE 0%,#FDF4FF 45%,#fff 72%)}
    .hero-inner{width:100%;max-width:960px;text-align:center}
    .badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.9);border:1px solid rgba(139,92,246,.28);border-radius:var(--r-pill);padding:7px 18px;font-size:14px;font-weight:600;color:var(--purple-dark);margin-bottom:18px;backdrop-filter:blur(8px)}
    .pulse-dot{width:7px;height:7px;background:var(--purple);border-radius:50%;animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(1.45)}}
    .hero h1{font-size:clamp(34px,5vw,54px);font-weight:800;line-height:1.06;letter-spacing:-1.8px;margin-bottom:14px}
    .hero p{font-size:16px;color:var(--text-gray);max-width:700px;margin:0 auto 22px}
    .hero-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
    .btn-dark,.btn-outline,.btn-red{padding:14px 22px;border-radius:var(--r-pill);font-size:15px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:all .2s;border:none;cursor:pointer;background:#fff}
    .btn-dark{background:var(--text-dark);color:#fff}
    .btn-dark:hover{background:#1f2937;transform:translateY(-1px)}
    .btn-outline{border:1.5px solid var(--border);color:var(--text-dark);background:#fff}
    .btn-outline:hover{border-color:var(--purple);color:var(--purple)}
    .btn-red{background:var(--red);color:#fff}

    .section{padding:28px 48px 84px}
    .section.gray{background:var(--bg-gray)}
    .container{max-width:1160px;margin:0 auto}
    .sec-label{font-size:12.5px;font-weight:700;color:var(--purple);letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;text-align:center}
    .sec-title{font-size:clamp(30px,4vw,46px);font-weight:800;line-height:1.12;letter-spacing:-1.4px;text-align:center;margin-bottom:12px}
    .sec-sub{font-size:16px;color:var(--text-gray);text-align:center;margin:0 auto 44px;line-height:1.65;max-width:760px}

    .panel,.card{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow)}
    .panel{padding:24px;height:100%}
    .card{padding:24px}

    .demo-layout{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:stretch}
    .demo-column{min-width:0;transition:opacity .28s ease,transform .32s ease,filter .28s ease}
    .demo-mobile-back{display:none}
    .form-title{font-size:24px;font-weight:800;letter-spacing:-.7px;margin-bottom:6px}
    .form-sub{font-size:14px;color:var(--text-gray);margin-bottom:18px}
    .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .field{display:flex;flex-direction:column;gap:8px}
    .field.full{grid-column:1 / -1}
    .field-honeypot{display:none}
    .field label{font-size:14px;font-weight:700;color:var(--text-dark)}
    .field input,.field select,.field textarea{width:100%;border:1px solid var(--border);border-radius:14px;padding:14px 15px;color:var(--text-dark);background:#fff}
    .field textarea{min-height:90px;resize:vertical}
    .helper{font-size:14px;color:var(--text-light)}
    .stack-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px;margin-bottom:12px}

    .call-card{overflow:hidden;padding:0;height:100%}
    .call-header{padding:18px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:14px;background:linear-gradient(180deg,#fff 0%,#fcfbff 100%)}
    .call-title h3{font-size:18px;font-weight:800;letter-spacing:-.4px;margin-bottom:4px}
    .call-title p{font-size:14px;color:var(--text-gray)}
    .status-pill{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;font-size:14px;font-weight:800;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;white-space:nowrap}
    .status-pill.live{background:#ecfdf5;color:#047857;border-color:#a7f3d0}
    .status-dot{width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.9}

    .live-stage{min-height:640px}
    .phone-stage{background:linear-gradient(160deg,#1a0533 0%,#2d1b69 40%,#1a0d3a 100%);padding:22px;position:relative;color:#fff;display:flex;flex-direction:column}
    .phone-stage::before{content:'';position:absolute;inset:auto auto -80px -80px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.05)}
    .phone-stage::after{content:'';position:absolute;top:-70px;right:-70px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.05)}
    .phone-top{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:rgba(255,255,255,.7);margin-bottom:16px;position:relative;z-index:1}
    .live-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:rgba(16,185,129,.16);border:1px solid rgba(16,185,129,.25);font-size:10px;font-weight:800;color:#86efac;margin-bottom:18px;position:relative;z-index:1}
    .phone-center{position:relative;z-index:1;text-align:center;padding-top:8px}
    .call-label{font-size:11px;color:rgba(255,255,255,.5);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px}
    .shop-name{font-size:18px;font-weight:800;margin-bottom:4px}
    .caller-line{font-size:14px;color:rgba(255,255,255,.7);margin-bottom:18px}
    .avatar-wrap{position:relative;width:112px;height:112px;margin:0 auto 18px}
    .ring{position:absolute;border-radius:50%;border:1px solid rgba(139,92,246,.34);top:50%;left:50%;transform:translate(-50%,-50%);animation:ringExpand 2.6s ease-out infinite}
    .ring.r2{animation-delay:.45s}.ring.r3{animation-delay:.9s}
    .ring.r1{width:78px;height:78px}.ring.r2{width:100px;height:100px}.ring.r3{width:122px;height:122px}
    @keyframes ringExpand{0%{opacity:.75;transform:translate(-50%,-50%) scale(.82)}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}
    .avatar{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#A855F7);display:flex;align-items:center;justify-content:center;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);box-shadow:0 0 0 4px rgba(139,92,246,.32)}
    .avatar svg{width:30px;height:30px;fill:#fff}
    .wave{display:flex;align-items:center;justify-content:center;gap:3px;height:30px;margin-bottom:18px}
    .wave span{width:3px;background:rgba(196,181,253,.82);border-radius:2px;animation:wave 1s ease-in-out infinite}
    .wave span:nth-child(1){height:10px}.wave span:nth-child(2){height:22px;animation-delay:.08s}.wave span:nth-child(3){height:28px;animation-delay:.16s}.wave span:nth-child(4){height:16px;animation-delay:.24s}.wave span:nth-child(5){height:26px;animation-delay:.32s}.wave span:nth-child(6){height:12px;animation-delay:.40s}.wave span:nth-child(7){height:18px;animation-delay:.48s}.wave span:nth-child(8){height:26px;animation-delay:.56s}
    @keyframes wave{0%,100%{transform:scaleY(.45);opacity:.45}50%{transform:scaleY(1);opacity:1}}
    .phone-summary{margin-top:16px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.08);border-radius:18px;padding:16px;text-align:left;backdrop-filter:blur(10px)}
    .phone-summary h4{font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.72);margin-bottom:8px}
    .phone-summary p{font-size:13px;color:rgba(255,255,255,.82);line-height:1.7}
    .signal-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
    .signal-pill{
      display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:14px;
      border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);
      color:rgba(255,255,255,.72);font-size:12px;font-weight:700;transition:all .2s ease;
    }
    .signal-pill::before{
      content:'';width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.4;flex-shrink:0;
    }
    .signal-pill.active{
      background:rgba(139,92,246,.22);border-color:rgba(196,181,253,.32);color:#fff;transform:translateY(-1px);
    }
    .signal-pill.active::before{opacity:1;box-shadow:0 0 0 6px rgba(167,139,250,.14)}
    .demo-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:18px}
    .demo-step{
      border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);border-radius:16px;padding:12px 10px;
      text-align:center;transition:all .2s ease;
    }
    .demo-step strong{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.52);margin-bottom:6px}
    .demo-step span{display:block;font-size:12px;font-weight:700;color:rgba(255,255,255,.78)}
    .demo-step.active{background:rgba(139,92,246,.22);border-color:rgba(196,181,253,.35);transform:translateY(-2px)}
    .demo-step.active strong,.demo-step.active span{color:#fff}
    .demo-step.done{background:rgba(16,185,129,.18);border-color:rgba(134,239,172,.25)}
    .demo-step.done strong,.demo-step.done span{color:#d1fae5}

    .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
    .info-card{background:#fff;border:1px solid var(--border);border-radius:24px;padding:24px;box-shadow:var(--shadow);transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease}
    .info-card:hover{transform:translateY(-3px);border-color:#ddd6fe;box-shadow:0 18px 40px rgba(124,58,237,.12)}
    .info-card-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:8px}
    .info-icon{width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#f5f3ff;color:#6d28d9;border:1px solid #ddd6fe;flex-shrink:0}
    .info-icon svg{width:18px;height:18px;fill:currentColor}
    .info-card h3{font-size:18px;line-height:1.28;margin:0}
    .info-card p,.info-card li{font-size:14px;color:var(--text-gray);line-height:1.65}
    .info-card ul{padding-left:18px}

    footer{background:var(--bg-gray);border-top:1px solid var(--border);padding:42px 48px 30px}
    .footer-inner{max-width:1160px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap}
    .footer-links{display:flex;gap:18px;flex-wrap:wrap;color:var(--text-gray);font-size:14px}
    .footer-copy{font-size:14px;color:var(--text-light)}

    @media (max-width: 1080px){
      .demo-layout,.grid-3{grid-template-columns:1fr}
      .phone-stage{min-height:unset}
    }
    @media (max-width: 960px){
      nav{padding:0 22px}
      .nav-links{display:none}
      .hero,.section,footer{padding-left:22px;padding-right:22px}
      .form-grid{grid-template-columns:1fr}
      .call-header{align-items:flex-start;flex-direction:column}
      .panel,.card,.info-card{padding:20px}
      .hero{padding-top:72px}
      .hero h1{font-size:34px;letter-spacing:-1.2px}
      .hero p{font-size:15px}
      .demo-steps{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
    @media (max-width: 640px){
      .demo-layout .demo-column.monitor-column{display:none}
      .demo-layout.mobile-live-active .demo-column{
        animation:demoMonitorEnter .32s ease;
      }
      .demo-layout.mobile-live-active .demo-column.form-column{display:none}
      .demo-layout.mobile-live-active .demo-column.monitor-column{display:block;grid-column:1 / -1}
      .demo-layout:not(.mobile-live-active) .demo-column.form-column{
        animation:demoFormReturn .28s ease;
      }
      .btn-dark,.btn-outline,.btn-red{width:100%}
      .hero-actions,.stack-actions{flex-direction:column}
      .live-stage{min-height:unset}
      .phone-stage,.transcript-stage{padding:16px}
      .call-header{padding:16px}
      .status-pill{width:100%;justify-content:center}
      .hero{padding-bottom:20px}
      .section{padding-top:20px}
      .demo-mobile-back{
        display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px;
        padding:11px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.14);
        background:rgba(255,255,255,.08);color:#fff;font-size:13px;font-weight:700;cursor:pointer;
      }
    }
    @keyframes demoMonitorEnter{
      0%{opacity:0;transform:translateY(14px) scale(.985);filter:blur(4px)}
      100%{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}
    }
    @keyframes demoFormReturn{
      0%{opacity:.2;transform:translateY(-10px);filter:blur(3px)}
      100%{opacity:1;transform:translateY(0);filter:blur(0)}
    }
    .legacy-marketing > nav,
    .legacy-marketing > footer,
    .legacy-marketing > .topbar{display:none !important}
  `,
];

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';

const scripts: string[] = [
  `
    const startButtons = [document.getElementById('startCall'), document.getElementById('startCallTop')];
    const endCall = document.getElementById('endCall');
    const status = document.getElementById('callStatus');
    const stageShop = document.getElementById('stageShopName');
    const stagePhone = document.getElementById('stagePhone');
    const helper = document.getElementById('demoHelper');
    const captchaMount = document.getElementById('turnstileMount');
    const liveSummary = document.getElementById('liveSummary');
    const demoLayout = document.getElementById('demoLayout');
    const mobileBackButton = document.getElementById('demoMobileBack');
    const signalCaller = document.getElementById('signalCaller');
    const signalAgent = document.getElementById('signalAgent');
    const signalThinking = document.getElementById('signalThinking');
    const signalLookup = document.getElementById('signalLookup');
    const stepRequested = document.getElementById('demoStepRequested');
    const stepDialing = document.getElementById('demoStepDialing');
    const stepLive = document.getElementById('demoStepLive');
    const stepDone = document.getElementById('demoStepDone');

    let pollTimer = null;
    let activePreview = null;
    let pending = false;

    function ensureSessionId(){
      const key = 'rb_demo_session_id';
      let current = window.localStorage.getItem(key);
      if (!current) {
        current = 'demo_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        window.localStorage.setItem(key, current);
      }
      return current;
    }

    function setStatus(text, live=false){
      status.className = live ? 'status-pill live' : 'status-pill';
      status.innerHTML = '<span class="status-dot"></span>' + text;
    }

    function clearPoll(){
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    }

    function isMobileViewport(){
      return window.matchMedia('(max-width: 640px)').matches;
    }

    function setMobileLiveView(active){
      if (!demoLayout) return;
      demoLayout.classList.toggle('mobile-live-active', !!active);
      if (active && isMobileViewport()) {
        requestAnimationFrame(() => {
          const monitor = document.getElementById('demoMonitorCard');
          if (monitor) {
            monitor.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }
    }

    function setSummary(text){
      if (liveSummary) {
        liveSummary.textContent = text;
      }
    }

    function setSignalState(activeKey){
      const signals = {
        caller: signalCaller,
        agent: signalAgent,
        thinking: signalThinking,
        lookup: signalLookup,
      };
      Object.entries(signals).forEach(([key, element]) => {
        if (!element) return;
        element.classList.toggle('active', key === activeKey);
      });
    }

    function applyLiveSignal(liveState){
      switch (liveState) {
        case 'caller_speaking':
          setSignalState('caller');
          break;
        case 'ai_agent_speaking':
          setSignalState('agent');
          break;
        case 'thinking':
        case 'preparing':
          setSignalState('thinking');
          break;
        case 'looking_up_info':
          setSignalState('lookup');
          break;
        default:
          setSignalState('');
      }
    }

    function setStepState(step, state){
      if (!step) return;
      step.classList.remove('active', 'done');
      if (state === 'active') step.classList.add('active');
      if (state === 'done') step.classList.add('done');
    }

    function setProgress(stage){
      setStepState(stepRequested, stage === 'queued' ? 'active' : (stage === 'dialing' || stage === 'live' || stage === 'completed' ? 'done' : ''));
      setStepState(stepDialing, stage === 'dialing' ? 'active' : (stage === 'live' || stage === 'completed' ? 'done' : ''));
      setStepState(stepLive, stage === 'live' ? 'active' : (stage === 'completed' ? 'done' : ''));
      setStepState(stepDone, stage === 'completed' ? 'active' : '');
      if (stage === 'failed') {
        setStepState(stepRequested, 'done');
        setStepState(stepDialing, '');
        setStepState(stepLive, '');
        setStepState(stepDone, '');
      }
    }

    function updateUiFromStatus(payload){
      const call = payload.call;
      if (payload.stage === 'failed') {
        setStatus('Demo failed');
      } else if (payload.stage === 'completed') {
        setStatus('Demo complete');
      } else if (payload.stage === 'live') {
        setStatus('Call live', true);
      } else if (payload.stage === 'dialing') {
        setStatus('Dialing prospect…');
      } else {
        setStatus('Preparing demo call…');
      }
      setProgress(payload.stage);

      if (call?.callerPhone) {
        stagePhone.textContent = call.callerPhone;
      }
      applyLiveSignal(call?.demoLiveState);
      if (payload.stage === 'live') {
        setSummary('Connected now. Watch the call states update while the AI demo runs.');
      } else if (payload.stage === 'completed') {
        applyLiveSignal(call?.demoLiveState ?? 'completed');
        setSummary('Demo complete.');
      } else if (payload.stage === 'failed') {
        applyLiveSignal(call?.demoLiveState ?? 'failed');
        setSummary('Demo could not connect.');
      } else if (payload.stage === 'dialing') {
        applyLiveSignal(call?.demoLiveState ?? 'caller_speaking');
        setSummary('Dialing your phone now.');
      } else {
        applyLiveSignal(call?.demoLiveState ?? 'preparing');
        setSummary('Preparing the live demo call.');
      }
    }

    async function pollStatus(){
      if (!activePreview) return;
      try {
        const response = await fetch('/api/backend/public/demo/status/' + encodeURIComponent(activePreview.requestId) + '?token=' + encodeURIComponent(activePreview.previewToken));
        const body = await response.json();
        if (!body.ok) {
          helper.textContent = 'Unable to refresh demo status right now.';
          return;
        }
        updateUiFromStatus(body);
        if (body.stage === 'completed' || body.stage === 'failed') {
          pending = false;
          startButtons.forEach(btn => { if (btn) btn.disabled = false; });
          return;
        }
      } catch (error) {
        helper.textContent = 'Live demo status refresh failed. The call may still be running.';
      }
      clearPoll();
      pollTimer = setTimeout(pollStatus, 2200);
    }

    function getCaptchaToken(){
      if (${JSON.stringify(turnstileSiteKey)} && window.__rbDemoCaptchaToken) {
        return window.__rbDemoCaptchaToken;
      }
      return 'dev-turnstile-bypass';
    }

    async function startDemo(){
      if (pending) return;
      pending = true;
      startButtons.forEach(btn => { if (btn) btn.disabled = true; });
      clearPoll();

      const shop = document.getElementById('shopName').value.trim() || 'Luxe Hair Studio';
      const phone = document.getElementById('phoneNumber').value.trim() || '+1 (714) 555-0199';
      const scenario = document.getElementById('scenario').value;
      const staff = document.getElementById('staffName').value.trim() || 'Sophia';
      const notes = document.getElementById('notes').value.trim();
      const businessType = document.getElementById('businessType').value;
      const website = document.getElementById('websiteField').value.trim();

      stageShop.textContent = shop;
      stagePhone.textContent = phone;
      setSummary('Submitting your live demo request…');
      setStatus('Preparing demo call…');
      setProgress('queued');
      setSignalState('thinking');
      setMobileLiveView(true);
      helper.textContent = ${JSON.stringify(turnstileSiteKey)}
        ? 'Captcha verified, requesting a live outbound call.'
        : 'Turnstile is not configured in this environment. Using local development bypass.';

      try {
        const response = await fetch('/api/backend/public/demo/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shopName: shop,
            phoneNumber: phone,
            businessType,
            scenario,
            staffName: staff,
            notes,
            captchaToken: getCaptchaToken(),
            sessionId: ensureSessionId(),
            website,
          }),
        });
        const body = await response.json();
        if (!body.ok) {
          pending = false;
          startButtons.forEach(btn => { if (btn) btn.disabled = false; });
          setMobileLiveView(false);
          helper.textContent = 'Unable to start live demo: ' + (body.error || 'unknown_error');
          setStatus('Ready for demo');
          setProgress('');
          setSignalState('');
          setSummary('We could not start the live demo call.');
          return;
        }

        activePreview = {
          requestId: body.requestId,
          previewToken: body.previewToken,
        };
        helper.textContent = 'Live demo call requested. Watch this panel while your phone rings.';
        setStatus('Dialing prospect…');
        setSignalState('caller');
        setSummary('Outbound demo call requested.');
        await pollStatus();
      } catch (error) {
        pending = false;
        startButtons.forEach(btn => { if (btn) btn.disabled = false; });
        setMobileLiveView(false);
        helper.textContent = 'Network error while requesting the live demo call.';
        setStatus('Ready for demo');
        setProgress('');
        setSignalState('');
        setSummary('Network error while requesting the live demo call.');
      }
    }

    function stopDemo(){
      clearPoll();
      pending = false;
      startButtons.forEach(btn => { if (btn) btn.disabled = false; });
      helper.textContent = 'Preview stopped on this page.';
      setStatus('Preview stopped', false);
      setProgress('');
      setSignalState('');
      setSummary('Preview stopped.');
      setMobileLiveView(false);
    }

    function renderTurnstile(){
      if (!captchaMount) return;
      if (!${JSON.stringify(turnstileSiteKey)}) {
        captchaMount.innerHTML = '<div class="helper">Turnstile is not configured for this environment. Local development bypass is active.</div>';
        return;
      }
      if (!window.turnstile || captchaMount.dataset.rendered === 'true') return;
      window.turnstile.render(captchaMount, {
        sitekey: ${JSON.stringify(turnstileSiteKey)},
        theme: 'light',
        callback: function(token){
          window.__rbDemoCaptchaToken = token;
        },
        'error-callback': function(){
          helper.textContent = 'Captcha verification failed. Please try again.';
        },
        'expired-callback': function(){
          window.__rbDemoCaptchaToken = null;
          helper.textContent = 'Captcha expired. Please verify again.';
        }
      });
      captchaMount.dataset.rendered = 'true';
    }

    startButtons.forEach(btn => {
      if (btn) btn.addEventListener('click', startDemo);
    });
    if (endCall) {
      endCall.addEventListener('click', stopDemo);
    }
    if (mobileBackButton) {
      mobileBackButton.addEventListener('click', function(){
        stopDemo();
      });
    }
    renderTurnstile();
    if (${JSON.stringify(turnstileSiteKey)}) {
      const timer = setInterval(() => {
        if (window.turnstile) {
          renderTurnstile();
          clearInterval(timer);
        }
      }, 400);
    }
  `,
];

export const templateTitle = "RingBooker Demo — Live AI Call Experience";

export function MarketingDemoTemplate() {
  return (
    <MarketingLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="marketing-demo"
    >
      <>
        {turnstileSiteKey ? (
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
        ) : null}
        <MarketingChromeStyles />
        <MarketingHeader active="demo" />
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
              <a href="/demo" className="active">Live Demo</a>
              <a href="/pricing">Pricing</a>
              <a href="/how-it-works">How It Works</a>
              <a href="/contact">Contact</a>
            </div>
            <div className="nav-actions">
              <a href="/user/login" className="nav-signin">Sign In</a>
              <a href="/demo" className="nav-demo-live" data-demo-picker>
                Try Live Demo →
              </a>
              <a href="/user/signup" className="nav-trial-outline">
                Start Free Trial →
              </a>
            </div>
          </div>
        </nav>
        <section className="hero">
          <div className="hero-inner">
            <div className="badge"><span className="pulse-dot" />Interactive live phone demo</div>
            <h1>Let prospects request a real AI call.</h1>
            <p>They enter their salon name and phone number, RingBooker calls them, and the website shows the live call status while the AI demo runs over the phone.</p>
            
          </div>
        </section>
        <section className="section" id="demo">
          <div className="container">
            <div className="demo-layout" id="demoLayout">
              <div className="panel demo-column form-column">
                <div className="form-title">Request your live demo call</div>
                <div className="form-sub">Fill in a few fields. RingBooker will call your number and greet you like a real customer call.</div>
                <div className="form-grid">
                  <div className="field full">
                    <label>Shop / salon name</label>
                    <input id="shopName" type="text" defaultValue="Luxe Hair Studio" />
                  </div>
                  <div className="field">
                    <label>Your phone number</label>
                    <input id="phoneNumber" type="text" defaultValue="+1 (714) 555-0199" />
                  </div>
                  <div className="field">
                    <label>Business type</label>
                    <select id="businessType">
                      <option>Hair Salon</option>
                      <option>Nail Salon</option>
                      <option>Spa</option>
                      <option>Clinic</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Demo scenario</label>
                    <select id="scenario">
                      <option>Book a new appointment</option>
                      <option>Ask pricing and availability</option>
                      <option>Reschedule an appointment</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Preferred stylist / technician</label>
                    <input id="staffName" type="text" defaultValue="Sophia" />
                  </div>
                  <div className="field full">
                    <label>Notes for the AI</label>
                    <textarea id="notes" defaultValue={"Please greet me as a new customer and offer an evening slot if available."} />
                  </div>
                  <div className="field full field-honeypot">
                    <label>Website</label>
                    <input id="websiteField" type="text" autoComplete="off" tabIndex={-1} />
                  </div>
                  <div className="field full">
                    <label>Human verification</label>
                    <div id="turnstileMount" />
                  </div>
                </div>
                <div className="stack-actions">
                  <button className="btn-dark" id="startCall">Start demo call</button>
                  <button className="btn-red" id="endCall">Stop preview</button>
                </div>
                <div className="helper" id="demoHelper">Protected by captcha, phone cooldowns, and public demo rate limits before RingBooker places any live outbound call.</div>
              </div>
              <div className="call-card card demo-column monitor-column" id="demoMonitorCard">
                <div className="call-header">
                  <div className="call-title">
                    <h3>Live call monitor</h3>
                    <p>Short live states only, without transcript clutter.</p>
                  </div>
                  <div className="status-pill" id="callStatus"><span className="status-dot" />Ready for demo</div>
                </div>
                <div className="live-stage">
                  <div className="phone-stage">
                    <button type="button" className="demo-mobile-back" id="demoMobileBack">← Back to demo form</button>
                    <div className="phone-top"><span>9:41</span><span>Live demo call</span></div>
                  <div className="live-badge"><span className="status-dot" />Outbound demo call</div>
                    <div className="phone-center">
                      <div className="call-label">Calling now</div>
                      <div className="shop-name" id="stageShopName">Luxe Hair Studio</div>
                      <div className="caller-line" id="stagePhone">+1 (714) 555-0199</div>
                      <div className="avatar-wrap">
                        <div className="ring r1" />
                        <div className="ring r2" />
                        <div className="ring r3" />
                        <div className="avatar">
                          <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" /></svg>
                        </div>
                      </div>
                      <div className="wave" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /></div>
                    </div>
                    <div className="demo-steps" aria-label="Live demo call progress">
                      <div className="demo-step" id="demoStepRequested"><strong>Step 1</strong><span>Requested</span></div>
                      <div className="demo-step" id="demoStepDialing"><strong>Step 2</strong><span>Dialing</span></div>
                      <div className="demo-step" id="demoStepLive"><strong>Step 3</strong><span>Live</span></div>
                      <div className="demo-step" id="demoStepDone"><strong>Step 4</strong><span>Complete</span></div>
                    </div>
                    <div className="phone-summary">
                      <h4>Live state</h4>
                      <p id="liveSummary">Start a demo call to see concise live call states here.</p>
                      <div className="signal-list" aria-label="Live demo state signals">
                        <div className="signal-pill" id="signalCaller">Caller speaking</div>
                        <div className="signal-pill" id="signalAgent">AI agent speaking</div>
                        <div className="signal-pill" id="signalThinking">Thinking</div>
                        <div className="signal-pill" id="signalLookup">Looking up info</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="section gray" id="how">
          <div className="container">
            <div className="sec-label">How this demo works</div>
            <h2 className="sec-title">A real phone call, not a fake simulator.</h2>
            <p className="sec-sub">Prospects submit their number, receive a real outbound call, and watch concise live call states on the page.</p>
            <div className="grid-3">
              <div className="info-card">
                <div className="info-card-head">
                  <div className="info-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.11 0 2-.89 2-2V5c0-1.1-.89-2-2-2Zm-1 8h-5v5h-2v-5H6V9h5V4h2v5h5v2Z" /></svg>
                  </div>
                  <h3>1. Submit demo details</h3>
                </div>
                <p>The form captures salon name, phone number, business type, and selected scenario with abuse protection enabled.</p>
              </div>
              <div className="info-card">
                <div className="info-card-head">
                  <div className="info-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
                  </div>
                  <h3>2. RingBooker dials instantly</h3>
                </div>
                <p>The backend requests Telnyx outbound calling and attaches call media to the AI voice runtime for live handling.</p>
              </div>
              <div className="info-card">
                <div className="info-card-head">
                  <div className="info-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6h-2V5H5v10h6v2H5a2 2 0 0 1-2-2V5Zm18.71 10.29-2-2a1 1 0 0 0-1.42 0l-3.5 3.5-1.09-1.09a1 1 0 0 0-1.41 0l-2 2A1 1 0 0 0 11 20h10a1 1 0 0 0 .71-1.71ZM16 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /></svg>
                  </div>
                  <h3>3. Live monitor updates</h3>
                </div>
                <p>The browser shows live call states like caller speaking, AI speaking, thinking, and lookup while the phone call is in progress.</p>
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
