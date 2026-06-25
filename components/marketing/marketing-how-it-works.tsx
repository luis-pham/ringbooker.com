import type { ReactNode } from 'react';

import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';
import { mkSectionTitle } from '@/lib/marketing/section-title';
import { MarketingFaqAccordion, type MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { MarketingTablerIcon } from '@/components/marketing/marketing-tabler-icon';

export type MarketingHowItWorksContent = {
  hero: {
    eyebrow: string;
    h1: string;
    subtitle: string;
    cta_primary: { label: string; href: string };
    cta_secondary: { label: string; href: string };
  };
  summary_card: {
    label: string;
    heading: string;
    items: string[];
  };
  sections: Array<{
    id: string;
    heading: string;
    subtitle?: string;
    cards?: string[];
    steps?: Array<{ number: number; title: string }>;
    items?: string[];
  }>;
  faq: {
    heading: string;
    items: MarketingFaqItem[];
  };
  final_cta: {
    heading: string;
    cta_primary: { label: string; href: string };
    cta_secondary: { label: string; href: string };
  };
};

const styles: string[] = [
  String.raw`:root{--purple:var(--mk-brand-purple,#8B5CF6);--purple-dark:var(--mk-brand-purple-dark,#7C3AED);--purple-light:var(--mk-brand-purple-soft,#EDE9FE);--purple-ultra:var(--mk-brand-purple-wash,#F5F3FF);--text-dark:var(--mk-text-strong,#111827);--text-gray:var(--mk-text-muted,#64748B);--text-light:var(--mk-text-soft,#94A3B8);--bg:var(--mk-bg-page,#fff);--bg-gray:var(--mk-bg-section,#F9FAFB);--border:var(--mk-border-soft,#E8ECF1);--green:var(--mk-brand-green,#10B981);--orange:var(--mk-brand-amber,#F59E0B);--red:var(--mk-brand-red,#EF4444);--r-pill:var(--mk-radius-pill,999px);--r-lg:var(--mk-radius-card,22px);--r-md:var(--mk-radius-input,16px);--shadow:var(--mk-card-shadow,0 1px 2px rgba(17,24,39,.04))}*{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}body{font-family:'Mona Sans Variable',sans-serif;color:var(--text-dark);background:var(--bg);overflow-x:hidden;font-size:var(--mk-font-body);line-height:var(--mk-leading-body)}a{text-decoration:none;color:inherit}.hiw-page{background:#fff}.hiw-page .hero-eyebrow{color:var(--mk-hero-eyebrow,#64748b)}.hiw-hero{padding:112px 48px 72px;background:radial-gradient(ellipse 80% 55% at 50% 0%,#EDE9FE 0%,#FDF4FF 45%,#fff 72%);overflow:hidden}.hiw-container{width:100%;max-width:var(--mk-container-tight,1100px);margin:0 auto}.hiw-hero-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(340px,.95fr);gap:42px;align-items:center}.hiw-dot{width:7px;height:7px;background:var(--purple);border-radius:50%;animation:hiwPulse 2s infinite}@keyframes hiwPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}.hiw-hero h1{font-size:var(--mk-hero-title);font-weight:600;line-height:var(--mk-hero-title-lh);letter-spacing:var(--mk-hero-title-track);margin-bottom:18px}.hiw-hero p{font-size:var(--mk-hero-lead);color:var(--mk-text-desc,#64748B);max-width:650px;margin-bottom:26px;line-height:var(--mk-hero-lead-lh);font-weight:400}.hiw-actions{display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:12px;width:100%}.hiw-btn-dark{padding:15px 32px;border-radius:var(--r-pill);font-size:var(--mk-btn-lg);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:transform .15s,background .2s,box-shadow .2s;box-sizing:border-box;text-decoration:none;cursor:pointer;font-family:inherit;color:#fff;border:none}.hiw-btn-dark svg{width:16px;height:16px;flex-shrink:0}.hiw-btn-dark .demo-cta-phone{width:18px;height:18px}.hiw-btn-dark .hiw-btn-dark-arrow{color:#fff;flex-shrink:0}.hiw-btn-outline{display:inline-flex;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;text-decoration:none;cursor:pointer;font-family:inherit}.hiw-summary{background:#fff;border:1px solid rgba(196,181,253,.35);border-radius:28px;padding:26px;box-shadow:var(--mk-card-shadow,var(--shadow));position:relative;overflow:hidden;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.hiw-summary:hover{transform:translateY(-1px);box-shadow:var(--mk-card-shadow-hover,var(--shadow));border-color:rgba(139,92,246,.28)}.hiw-summary::before{content:"";position:absolute;top:-70px;right:-70px;width:190px;height:190px;border-radius:50%;background:rgba(139,92,246,.08)}.hiw-summary-label{font-size:var(--mk-eyebrow);font-weight:600;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;color:#5B21B6;margin-bottom:12px;position:relative}.hiw-summary h2{font-size:var(--mk-article-h2);font-weight:500;line-height:var(--mk-article-h2-lh);letter-spacing:var(--mk-article-h2-track);margin-bottom:14px;position:relative}.hiw-summary h2 em,.hiw-cta-box h2 em,.hiw-no-replace h2 em{font-style:italic;font-weight:500;color:#7c3aed}.hiw-cta-box h2 em,.hiw-no-replace h2 em{color:#c4b5fd}.hiw-summary-list{display:grid;gap:11px;position:relative}.hiw-summary-item{display:flex;gap:10px;align-items:flex-start;font-size:var(--mk-body);color:#374151;line-height:1.55}.hiw-summary-icon{width:24px;height:24px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;background:transparent;border:none;box-shadow:none}.hiw-section{padding:86px 48px}.hiw-section.gray{background:var(--bg-gray)}.hiw-label{font-size:var(--mk-eyebrow);font-weight:600;color:#5B21B6;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;margin-bottom:12px}.hiw-title{font-size:var(--mk-section-h2);font-weight:500;line-height:var(--mk-section-h2-lh);letter-spacing:var(--mk-section-h2-track);margin:0 0 14px;text-wrap:balance}.hiw-sub{font-size:var(--mk-section-lead);color:var(--mk-text-desc,#64748B);margin:0 0 42px;line-height:var(--mk-section-lead-lh);max-width:760px;font-weight:400}.hiw-grid-2,.hiw-grid-3{display:grid;gap:18px}.hiw-grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}.hiw-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}.hiw-card{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:24px;box-shadow:var(--shadow);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.hiw-card:hover{transform:translateY(-1px);box-shadow:var(--mk-card-shadow-hover,var(--shadow));border-color:var(--mk-card-border-hover,rgba(167,139,250,.42))}.hiw-card.recommended{border-color:#c4b5fd;background:linear-gradient(180deg,#fbfaff 0%,#fff 82%);box-shadow:0 0 0 4px rgba(139,92,246,.06),var(--shadow)}.hiw-card.recommended:hover{border-color:#a78bfa;box-shadow:0 0 0 4px rgba(139,92,246,.08),var(--mk-card-shadow-hover,var(--shadow))}.hiw-setup-grid .hiw-card{border:1px solid var(--mk-border-soft,var(--border));box-shadow:var(--mk-card-shadow,var(--shadow))}.hiw-setup-grid .hiw-card:hover{border-color:var(--mk-card-border-hover,rgba(167,139,250,.42));box-shadow:var(--mk-card-shadow-hover,var(--shadow))}.hiw-setup-grid .hiw-card.recommended{border:1px solid rgba(196,181,253,.35);background:linear-gradient(180deg,#fbfaff 0%,#fff 82%);box-shadow:var(--mk-card-shadow,var(--shadow))}.hiw-setup-grid .hiw-card.recommended:hover{border-color:var(--mk-border-brand,rgba(139,92,246,.28));box-shadow:var(--mk-card-shadow-hover,var(--shadow))}.hiw-card-top{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}.hiw-pill{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:500}.hiw-pill.optional{background:#f8fafc;color:#475569;border:1px solid #e2e8f0}.hiw-icon{width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:21px;background:transparent;border:none;box-shadow:none}.hiw-card h3{font-size:var(--mk-card-title,16px);font-weight:500;line-height:1.38;letter-spacing:-.2px;margin-bottom:9px}.hiw-card p{font-size:var(--mk-body-md);color:var(--mk-text-desc,#64748B);line-height:1.72}.hiw-list{list-style:none;display:grid;gap:10px;margin-top:16px}.hiw-list li{display:flex;gap:10px;font-size:var(--mk-body);color:#374151;line-height:1.55}.hiw-list li::before{content:"✓";width:20px;height:20px;color:var(--purple-dark);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0;margin-top:1px;background:transparent;border:none;box-shadow:none}.hiw-grid-3.hiw-flow{gap:24px}@media(min-width:961px){.hiw-grid-3.hiw-flow{grid-template-columns:repeat(3,minmax(0,1fr));width:100%}}.hiw-grid-3.hiw-flow .hiw-step{position:relative;display:flex;flex-direction:column;box-sizing:border-box;min-height:13.2rem;padding:29px 22px 31px;background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--mk-card-shadow,var(--shadow));transition:border-color .2s ease,box-shadow .2s ease,transform .2s ease}@media (hover:hover) and (pointer:fine){.hiw-grid-3.hiw-flow .hiw-step:hover{border-color:rgba(167,139,250,.45);box-shadow:var(--mk-card-shadow-hover,var(--shadow));transform:translateY(-1px)}}.hiw-grid-3.hiw-flow .hiw-step h3{font-size:15px;font-weight:500;line-height:1.35;letter-spacing:-.2px;margin:0 0 8px;color:var(--text-dark);text-align:left}.hiw-grid-3.hiw-flow .hiw-step p{font-size:13px;color:var(--mk-text-muted,#4B5563);line-height:1.58;margin:0;text-align:left}.hiw-grid-3.hiw-flow .hiw-step-marker{display:flex;align-items:center;justify-content:center;align-self:center;flex-shrink:0;width:36px;height:36px;margin:0 auto 18px;border-radius:50%;background:var(--purple);color:#fff;font-size:14px;font-weight:500;line-height:1;box-shadow:0 8px 22px rgba(124,58,237,.22)}.hiw-steps-mobile-nav{display:none}.hiw-steps-mobile-nav a{display:inline-flex;align-items:center;justify-content:center;min-width:84px;padding:8px 12px;border-radius:999px;border:1px solid var(--border);background:#fff;color:var(--text-gray);font-size:12px;font-weight:500;white-space:nowrap;transition:all .2s ease}.hiw-steps-mobile-nav a.is-active{background:var(--purple);border-color:var(--purple);color:#fff}.hiw-step:target{border-color:#c4b5fd;box-shadow:0 0 0 3px rgba(139,92,246,.12)}.hiw-handle-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.hiw-handle{background:#fff;border:1px solid var(--border);border-radius:22px;padding:22px 20px;text-align:center;box-shadow:var(--mk-card-shadow,var(--shadow));transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.hiw-handle:hover{transform:translateY(-1px);box-shadow:var(--mk-card-shadow-hover,var(--shadow));border-color:var(--mk-card-border-hover,rgba(167,139,250,.42))}.hiw-handle-icon{width:48px;height:48px;margin:0 auto 14px;background:transparent;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:none;border:none}.hiw-handle-icon.green{background:transparent}.hiw-handle-icon.amber{background:transparent}.hiw-handle-icon.pink{background:transparent}.hiw-handle-icon.blue{background:transparent}.hiw-handle-icon.slate{background:transparent}.hiw-handle strong{display:block;font-size:16px;font-weight:500;letter-spacing:-.25px;margin-bottom:7px}.hiw-handle p{font-size:14px;color:var(--text-gray);line-height:1.65}.hiw-no-replace{background:#111827;color:#fff;border-radius:32px;padding:36px;display:grid;grid-template-columns:1fr 1.05fr;gap:30px;align-items:start;box-shadow:0 24px 70px rgba(17,24,39,.22)}.hiw-label.hiw-label-trust{margin-bottom:20px}.hiw-label.hiw-label-experience{margin-bottom:20px}.hiw-no-replace h2{font-size:var(--mk-section-h2);font-weight:500;line-height:var(--mk-section-h2-lh);letter-spacing:var(--mk-section-h2-track);margin-bottom:12px}.hiw-no-replace p{color:rgba(255,255,255,.74);font-size:var(--mk-section-lead);line-height:var(--mk-section-lead-lh);font-weight:400}.hiw-trust-list{display:grid;gap:12px}.hiw-trust-item{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);border-radius:18px;padding:15px;transition:transform .2s ease,background .2s ease,border-color .2s ease}.hiw-trust-item:hover{transform:translateY(-2px);background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.18)}.hiw-trust-item strong{display:block;margin-bottom:4px;font-size:var(--mk-body-md);font-weight:500;line-height:1.45;color:#fff}.hiw-trust-item span,.hiw-call-step p{font-size:var(--mk-body,14px);line-height:var(--mk-body-lh,1.68);font-weight:400}.hiw-trust-item span{display:block;color:rgba(255,255,255,.72)}.hiw-experience{display:grid;grid-template-columns:.9fr 1.1fr;gap:20px;align-items:stretch}.hiw-call-card{background:linear-gradient(160deg,#1a0533 0%,#2d1b69 44%,#1a0d3a 100%);border-radius:30px;padding:26px;color:#fff;box-shadow:0 24px 70px rgba(45,27,105,.22);overflow:hidden;position:relative}.hiw-call-card::after{content:"";position:absolute;right:-50px;top:-50px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,.06)}.hiw-live{display:inline-flex;align-items:center;gap:7px;padding:6px 11px;border-radius:999px;background:rgba(16,185,129,.16);color:#86efac;border:1px solid rgba(16,185,129,.25);font-size:12px;font-weight:500;margin-bottom:24px;position:relative}.hiw-call-card h3{font-size:24px;font-weight:500;line-height:1.18;letter-spacing:-.7px;margin-bottom:10px;position:relative}.hiw-call-card p{font-size:var(--mk-section-lead);color:rgba(255,255,255,.74);line-height:var(--mk-section-lead-lh);font-weight:400;position:relative}.hiw-call-steps{display:grid;gap:12px}.hiw-call-step{display:flex;gap:13px;align-items:flex-start;background:#fff;border:1px solid var(--border);border-radius:20px;padding:18px;box-shadow:0 10px 30px rgba(17,24,39,.04);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.hiw-call-step:hover{transform:translateY(-2px);box-shadow:0 18px 36px -10px rgba(17,24,39,.12);border-color:#d1d5db}.hiw-call-step span{width:30px;height:30px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:transparent;border:none;box-shadow:none}.hiw-call-step strong{display:block;margin-bottom:3px;font-size:var(--mk-body-md);font-weight:500;line-height:1.45}.hiw-call-step p{margin:0;color:var(--text-gray)}.hiw-trust-caller-stack .hiw-caller-after-trust{padding-top:86px;margin-top:0}.hiw-faq-cta-lower .hiw-cta-box{margin-top:48px}.hiw-cta-box{max-width:1100px;margin:0 auto;background:#0d0d0d;color:#fff;border:none;border-radius:32px;padding:42px;display:grid;grid-template-columns:1fr auto;gap:28px;align-items:center;box-shadow:none}.hiw-cta-box h2{font-size:clamp(28px,3.6vw,42px);font-weight:500;line-height:1.12;letter-spacing:-1.2px;margin-bottom:10px}.hiw-cta-box p{color:rgba(255,255,255,.82);font-size:16px;line-height:1.7;max-width:650px}.hiw-cta-box .hiw-actions{display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:center;gap:20px 28px;min-width:0}.hiw-cta-box .hiw-cta-btn-white{padding:12px 24px;border-radius:var(--r-pill);font-size:14.5px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;transition:transform .15s,background .2s;border:none;box-shadow:none;cursor:pointer;font-family:inherit;box-sizing:border-box}.hiw-cta-box .hiw-cta-btn-white:hover{transform:translateY(-1px);box-shadow:none}.hiw-cta-box .hiw-cta-btn-white .demo-cta-phone{width:16px;height:16px;flex-shrink:0}.hiw-cta-box .hiw-cta-btn-white .demo-cta-phone path{fill:#FACC15}.hiw-cta-box .hiw-cta-btn-white-arrow{width:16px;height:16px;flex-shrink:0;color:#5b21b6;transition:transform .2s ease}.hiw-cta-box .hiw-cta-btn-white:hover .hiw-cta-btn-white-arrow{transform:translateX(3px)}.hiw-cta-box .hiw-cta-btn-ghost{background:rgba(255,255,255,.12);color:#fff;padding:12px 24px;border-radius:var(--r-pill);font-size:14px;font-weight:600;text-decoration:none;text-align:center;border:1px solid rgba(255,255,255,.32);box-shadow:none;transition:background .2s,border-color .2s,transform .15s;display:inline-flex;align-items:center;justify-content:center;font-family:inherit;box-sizing:border-box}.hiw-cta-box .hiw-cta-btn-ghost:hover{background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.45);transform:translateY(-1px);box-shadow:none}.legacy-marketing>nav,.legacy-marketing>footer,.legacy-marketing>.topbar{display:none !important}@media(max-width:960px){.hiw-hero,.hiw-section{padding-left:22px;padding-right:22px}.hiw-hero-grid,.hiw-grid-2,.hiw-grid-3,.hiw-handle-grid,.hiw-no-replace,.hiw-experience,.hiw-cta-box{grid-template-columns:1fr}.hiw-grid-3.hiw-flow .hiw-step{max-width:400px;width:100%;margin-left:auto;margin-right:auto}.hiw-hero{padding-top:calc(69px + 28px + env(safe-area-inset-top,0px));padding-bottom:52px}.hiw-summary{padding:22px}.hiw-no-replace,.hiw-cta-box{padding:28px}.hiw-cta-box{gap:18px}}@media(max-width:640px){.hiw-hero{padding-bottom:46px}.hiw-hero h1{font-size:clamp(30px,8vw,40px)}.hiw-actions,.hiw-faq-cta-lower .hiw-actions{flex-direction:column;align-items:stretch}.hiw-hero .hiw-btn-dark,.hiw-hero .hiw-btn-outline{width:100%;justify-content:center}.hiw-cta-box .hiw-cta-btn-white,.hiw-cta-box .hiw-cta-btn-ghost{width:100%;justify-content:center;white-space:normal}.hiw-section{padding-top:var(--mk-space-section-y-mobile,56px);padding-bottom:64px}.hiw-trust-caller-stack .hiw-caller-after-trust{padding-top:var(--mk-space-section-y-mobile,56px)}.hiw-sub{margin-bottom:32px}.hiw-summary{padding:20px}.hiw-steps-mobile-nav{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 8px;margin:0 0 12px}.hiw-steps-mobile-nav{justify-content:center}.hiw-grid-3.hiw-flow{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 2px 8px;touch-action:pan-x pinch-zoom;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}.hiw-grid-3.hiw-flow .hiw-step{flex:0 0 auto;min-width:78%;max-width:min(340px,92vw);scroll-snap-align:center}.hiw-grid-3.hiw-flow .hiw-step-marker{display:none}.hiw-no-replace,.hiw-cta-box{padding:24px 20px}}`,
];

const scripts: string[] = [
  String.raw`
(() => {
  const nav = document.querySelector('.hiw-steps-mobile-nav');
  const scroller = document.querySelector('.hiw-grid-3.hiw-flow');
  if (!nav || !scroller) return;
  const buttons = Array.from(nav.querySelectorAll('a'));
  const cards = Array.from(scroller.querySelectorAll('.hiw-step'));
  if (!buttons.length || !cards.length) return;

  const setActive = (idx) => {
    buttons.forEach((btn, i) => btn.classList.toggle('is-active', i === idx));
  };

  const updateActiveByScroll = () => {
    const scrollerRect = scroller.getBoundingClientRect();
    const centerX = scrollerRect.left + scroller.clientWidth / 2;
    let bestIdx = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    cards.forEach((card, i) => {
      const r = card.getBoundingClientRect();
      const cardCenter = r.left + r.width / 2;
      const dist = Math.abs(cardCenter - centerX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    });
    setActive(bestIdx);
  };

  buttons.forEach((btn, i) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      cards[i]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      setActive(i);
    });
  });

  let raf = 0;
  scroller.addEventListener('scroll', () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(updateActiveByScroll);
  }, { passive: true });
  setActive(0);
  updateActiveByScroll();
})();
`,
];

export const templateTitle =
  'How It Works — Recover Lost Bookings, Keep Your Number | RingBooker';

function getHowItWorksSection(content: MarketingHowItWorksContent, id: string) {
  return content.sections.find((section) => section.id === id);
}

function renderHeroTitle(title: string) {
  const [first, second] = title.split('. ');
  if (!first || !second) return title;
  return (
    <>
      {first}.
      <br />
      {second}
    </>
  );
}

function renderSummaryHeading(heading: string) {
  const [before, accent] = heading.split('. ');
  if (!before || !accent) return heading;
  return mkSectionTitle(`${before}.`, accent);
}

function renderHowSectionHeading(id: string, heading?: string): ReactNode {
  if (!heading) return null;
  if (id === 'setup-paths') return mkSectionTitle('Choose how', 'RingBooker starts.');
  if (id === 'three-step-flow') {
    return (
      <>
        A phone-first <em>workflow</em>
        <br />
        your team can understand quickly.
      </>
    );
  }
  if (id === 'what-it-handles') {
    return (
      <>
        Built for the calls
        <br />
        that usually <em>leak</em> bookings.
      </>
    );
  }
  if (id === 'trust-boundary') return mkSectionTitle('What RingBooker', 'does not replace.');
  return heading;
}

function renderFinalCtaHeading(heading: string) {
  if (heading === 'See the revenue recovery flow on a real call.') {
    return mkSectionTitle('See the', 'revenue recovery flow on a real call.');
  }
  return heading;
}

export function MarketingHowItWorksTemplate({ content }: { content: MarketingHowItWorksContent }) {
  const setupPaths = getHowItWorksSection(content, 'setup-paths');
  const threeStepFlow = getHowItWorksSection(content, 'three-step-flow');
  const whatItHandles = getHowItWorksSection(content, 'what-it-handles');
  const trustBoundary = getHowItWorksSection(content, 'trust-boundary');
  const callerExperience = getHowItWorksSection(content, 'caller-experience');
  const layoutChildren: ReactNode = (
    <>
        <MarketingChromeStyles />
        <MarketingHeader active="how-it-works" />
        <main className="legacy-marketing hiw-page">
          <section className="hiw-hero">
            <div className="hiw-container">
              <nav aria-label="Breadcrumb" style={{ marginBottom: 12, fontSize: 14, lineHeight: 1.35, color: 'var(--mk-text-soft,#94a3b8)', textAlign: 'left' }}>
                <a href="/" style={{ color: 'var(--mk-text-soft,#94a3b8)', textDecoration: 'none', fontWeight: 400 }}>Home</a>
                <span style={{ margin: '0 6px' }}>›</span>
                <span style={{ color: 'var(--mk-text-soft,#94a3b8)', fontWeight: 400 }}>How It Works</span>
              </nav>
              <p className="hero-eyebrow">{content.hero.eyebrow}</p>
            </div>
            <div className="hiw-container hiw-hero-grid">
              <div>
                <h1>
                  {renderHeroTitle(content.hero.h1)}
                </h1>
                <p>
                  {content.hero.subtitle}
                </p>
                <div className="hiw-actions">
                  <a href={content.hero.cta_primary.href} className="hiw-btn-dark" data-demo-picker>
                    <DemoCtaPhoneIcon className="btn-hero-live-phone" width={18} height={18} />
                    {content.hero.cta_primary.label}
                    <svg className="hiw-btn-dark-arrow" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                    </svg>
                  </a>
                  <a href={content.hero.cta_secondary.href} className="hiw-btn-outline">
                    {content.hero.cta_secondary.label}
                  </a>
                </div>
              </div>
              <aside className="hiw-summary" aria-label="RingBooker summary">
                <div className="hiw-summary-label">{content.summary_card.label}</div>
                <h2>{renderSummaryHeading(content.summary_card.heading)}</h2>
                <div className="hiw-summary-list">
                  {content.summary_card.items.map((item, index) => (
                    <div key={item} className="hiw-summary-item">
                      <span className="hiw-summary-icon">{index + 1}</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </section>

          <section className="hiw-section">
            <div className="hiw-container">
              <div className="hiw-label">Setup paths</div>
              <h2 className="hiw-title">{renderHowSectionHeading('setup-paths', setupPaths?.heading)}</h2>
              <p className="hiw-sub">{setupPaths?.subtitle}</p>
              <div className="hiw-grid-2 hiw-setup-grid">
                <article className="hiw-card recommended">
                  <div className="hiw-card-top">
                    <div className="hiw-icon">
                      <MarketingTablerIcon icon="ti-phone" style={{ color: 'var(--purple)' }} />
                    </div>
                    <span className="hiw-pill">Recommended</span>
                  </div>
                  <h3>{setupPaths?.cards?.[0]}</h3>
                  <p>Most salons and clinics keep the number customers already know. Calls can be forwarded to RingBooker for after-hours coverage, overflow, or missed-call recovery without migrating your booking system.</p>
                  <ul className="hiw-list">
                    <li>Best for existing businesses with an established phone number.</li>
                    <li>Customers keep calling the same number.</li>
                    <li>Your team keeps control of when RingBooker answers.</li>
                  </ul>
                </article>
                <article className="hiw-card">
                  <div className="hiw-card-top">
                    <div className="hiw-icon">
                      <MarketingTablerIcon icon="ti-phone-call" style={{ color: 'var(--purple)' }} />
                    </div>
                    <span className="hiw-pill optional">Optional</span>
                  </div>
                  <h3>{setupPaths?.cards?.[1]}</h3>
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
              <h2 className="hiw-title">{renderHowSectionHeading('three-step-flow', threeStepFlow?.heading)}</h2>
              <p className="hiw-sub">RingBooker sits between the caller and your team: it captures intent and summaries so you recover bookings faster — without migrating calendars or changing the number clients already dial.</p>
              <div className="hiw-steps-mobile-nav" role="tablist" aria-label="How it works steps">
                <a href="#hiw-step-1" className="is-active">Step 1</a>
                <a href="#hiw-step-2">Step 2</a>
                <a href="#hiw-step-3">Step 3</a>
              </div>
              <div className="hiw-grid-3 hiw-flow">
                <article className="hiw-step" id="hiw-step-1">
                  <span className="hiw-step-marker" aria-hidden>
                    {threeStepFlow?.steps?.[0]?.number}
                  </span>
                  <h3>{threeStepFlow?.steps?.[0]?.title}</h3>
                  <p>
                    Forward your current business number{' '}
                    <a href="/current-number/call-forwarding" style={{ color: '#5B21B6', textDecoration: 'underline' }}>
                      (see setup guides for 20+ carriers)
                    </a>{' '}
                    for after-hours or overflow coverage, or add a dedicated RingBooker line if that fits your rollout better.
                  </p>
                </article>
                <article className="hiw-step" id="hiw-step-2">
                  <span className="hiw-step-marker" aria-hidden>
                    {threeStepFlow?.steps?.[1]?.number}
                  </span>
                  <h3>{threeStepFlow?.steps?.[1]?.title}</h3>
                  <p>Tell RingBooker your services, business hours, staff or provider preferences, booking rules, escalation path, and what should be confirmed by SMS.</p>
                </article>
                <article className="hiw-step" id="hiw-step-3">
                  <span className="hiw-step-marker" aria-hidden>
                    {threeStepFlow?.steps?.[2]?.number}
                  </span>
                  <h3>{threeStepFlow?.steps?.[2]?.title}</h3>
                  <p>RingBooker answers, captures intent, helps with routine booking calls, texts confirmations or callbacks, and gives your team the context when a human should step in.</p>
                </article>
              </div>
            </div>
          </section>

          <section className="hiw-section">
            <div className="hiw-container">
              <div className="hiw-label">What it handles</div>
              <h2 className="hiw-title">{renderHowSectionHeading('what-it-handles', whatItHandles?.heading)}</h2>
              <p className="hiw-sub">RingBooker targets the phone moments that cost salons and clinics revenue: busy service windows, after-hours buying intent, peak overflow, reschedules, cancellations, and callers who hang up instead of leaving voicemail.</p>
              <div className="hiw-handle-grid">
                <div className="hiw-handle"><div className="hiw-handle-icon amber"><MarketingTablerIcon icon="ti-moon" style={{ color: 'var(--purple)' }} /></div><strong>{whatItHandles?.items?.[0]}</strong><p>Answer when the front desk is closed and capture booking intent before the caller tries another business.</p></div>
                <div className="hiw-handle"><div className="hiw-handle-icon blue"><MarketingTablerIcon icon="ti-phone" style={{ color: 'var(--purple)' }} /></div><strong>{whatItHandles?.items?.[1]}</strong><p>Step in when your team is with a client, at the chair, in a treatment room, or handling another call.</p></div>
                <div className="hiw-handle"><div className="hiw-handle-icon green"><MarketingTablerIcon icon="ti-calendar" style={{ color: 'var(--purple)' }} /></div><strong>{whatItHandles?.items?.[2]}</strong><p>Collect service, timing, customer details, and preferences needed to move the booking forward.</p></div>
                <div className="hiw-handle"><div className="hiw-handle-icon pink"><MarketingTablerIcon icon="ti-refresh" style={{ color: 'var(--purple)' }} /></div><strong>{whatItHandles?.items?.[3]}</strong><p>Understand the caller’s change request, preserve context, and help your team recover the slot where appropriate.</p></div>
                <div className="hiw-handle"><div className="hiw-handle-icon"><MarketingTablerIcon icon="ti-message-circle" style={{ color: 'var(--purple)' }} /></div><strong>{whatItHandles?.items?.[4]}</strong><p>Text callers back when they hang up, call after hours, or reach you during a busy window.</p></div>
                <div className="hiw-handle"><div className="hiw-handle-icon slate"><MarketingTablerIcon icon="ti-handshake" style={{ color: 'var(--purple)' }} /></div><strong>{whatItHandles?.items?.[5]}</strong><p>Escalate special cases with context so your team does not have to restart the conversation.</p></div>
              </div>
            </div>
          </section>

          <section className="hiw-section gray hiw-trust-caller-stack">
            <div className="hiw-container">
              <div className="hiw-label hiw-label-trust">Trust boundary</div>
              <div className="hiw-no-replace">
                <div>
                  <h2 className="hiw-title">{renderHowSectionHeading('trust-boundary', trustBoundary?.heading)}</h2>
                  <p>This page is intentionally clear because phone routing and booking workflows are sensitive. RingBooker is a recovery layer, not a forced migration.</p>
                </div>
                <div className="hiw-trust-list">
                  <div className="hiw-trust-item"><strong>{trustBoundary?.items?.[0]}</strong><span>You can keep your current number. A dedicated RingBooker number is optional.</span></div>
                  <div className="hiw-trust-item"><strong>{trustBoundary?.items?.[1]}</strong><span>RingBooker works alongside your current booking workflow instead of replacing your calendar or booking platform.</span></div>
                  <div className="hiw-trust-item"><strong>{trustBoundary?.items?.[2]}</strong><span>Your team decides the coverage rules, escalation path, business hours, and what needs human follow-up.</span></div>
                  <div className="hiw-trust-item"><strong>{trustBoundary?.items?.[3]}</strong><span>Complex, sensitive, or policy-heavy calls should be handed off with context rather than forced through a loop.</span></div>
                </div>
              </div>
            </div>
            <div className="hiw-caller-after-trust">
              <div className="hiw-container">
                <div className="hiw-label hiw-label-experience">Caller experience</div>
              </div>
              <div className="hiw-container hiw-experience">
                <div className="hiw-call-card">
                  <h3>{callerExperience?.heading}</h3>
                  <p>Callers get a natural answer, a clear next step, and a text confirmation or callback path when needed. The goal is not to pretend to be human. The goal is to keep the booking conversation alive.</p>
                </div>
                <div className="hiw-call-steps">
                  <div className="hiw-call-step"><span><MarketingTablerIcon icon="ti-speakerphone" style={{ color: 'var(--purple)' }} /></span><div><strong>{callerExperience?.items?.[0]}</strong><p>RingBooker keeps the call moving without long silence or generic phone-tree friction.</p></div></div>
                  <div className="hiw-call-step"><span><MarketingTablerIcon icon="ti-message-circle" style={{ color: 'var(--purple)' }} /></span><div><strong>{callerExperience?.items?.[1]}</strong><p>Important outcomes can be followed by SMS so callers know what happened next.</p></div></div>
                  <div className="hiw-call-step"><span><MarketingTablerIcon icon="ti-handshake" style={{ color: 'var(--purple)' }} /></span><div><strong>{callerExperience?.items?.[2]}</strong><p>If the caller needs a real person, RingBooker collects context and creates a cleaner callback path.</p></div></div>
                </div>
              </div>
            </div>
          </section>

          <section className="hiw-section hiw-faq-cta-lower">
            <div className="hiw-container">
              <MarketingFaqAccordion
                items={content.faq.items}
                embedded
                title={content.faq.heading}
                subtitle="Short answers for owners and managers comparing call recovery options — current number, no forced booking migration, and what happens on real salon and clinic calls."
              />
              <div className="hiw-cta-box">
                <div>
                  <h2>{renderFinalCtaHeading(content.final_cta.heading)}</h2>
                  <p>Try a live demo or talk through how RingBooker covers after-hours intent, peak-hour overflow, reschedules, cancellations, and missed-call text back on your line — still the number clients already use.</p>
                </div>
                <div className="hiw-actions">
                  <a href={content.final_cta.cta_primary.href} className="hiw-cta-btn-white" data-demo-picker>
                    <DemoCtaPhoneIcon width={16} height={16} />
                    {content.final_cta.cta_primary.label}
                    <svg className="hiw-cta-btn-white-arrow" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                    </svg>
                  </a>
                  <a href={content.final_cta.cta_secondary.href} className="hiw-cta-btn-ghost">
                    {content.final_cta.cta_secondary.label}
                  </a>
                </div>
              </div>
            </div>
          </section>
        </main>
        <MarketingFooter />
    </>
  );

  return (
    <MarketingLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="marketing-how-it-works"
      children={layoutChildren}
    />
  );
}
