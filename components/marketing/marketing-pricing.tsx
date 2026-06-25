import { Fragment } from 'react';
import { IconCheck } from '@tabler/icons-react';

import { MarketingFaqAccordion, type MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { loadPageContent } from '@/lib/content';

const trialNoChargeCopyVerified = process.env.NEXT_PUBLIC_PADDLE_TRIAL_CONFIG_VERIFIED === 'true';

type PricingCompareValue = boolean | string;

type PricingFaqContent = {
  q: string;
  a: string;
  trial_verified_extra?: string;
};

type PricingPlanContent = {
  id: string;
  name: string;
  description: string;
  price_monthly?: number;
  price_annual?: number;
  annual_billed_label?: string;
  price_label?: string;
  cta_label: string;
  cta_href: string;
  cta_subnote?: string;
  popular: boolean;
  popular_label?: string;
  tax_note?: string;
  benefits: string[];
};

type PricingCompareGroup = {
  group: string;
  rows: Array<{
    feature: string;
    starter: PricingCompareValue;
    professional: PricingCompareValue;
    custom: PricingCompareValue;
  }>;
};

export type PricingPageContent = {
  meta: {
    title: string;
    description: string;
    canonical: string;
  };
  schema: {
    provider: {
      name: string;
      url: string;
      description: string;
      telephone: string;
      email: string;
      same_as: string[];
    };
    page_name: string;
    page_description: string;
  };
  breadcrumb: {
    home_label: string;
    home_href: string;
    current_label: string;
  };
  hero: {
    eyebrow: string;
    h1: string;
    subtitle: string;
    trust: string[];
    toggle_monthly_label: string;
    toggle_annual_label: string;
    toggle_save_label: string;
  };
  plans: PricingPlanContent[];
  compare: {
    eyebrow: string;
    heading_line_1: string;
    heading_emphasis: string;
    heading_line_2: string;
    subtitle: string;
    table_headers: string[];
  };
  compare_groups: PricingCompareGroup[];
  faq_section: {
    title: string;
  };
  faq: PricingFaqContent[];
  footer_note?: string;
};

const defaultPricingContent = loadPageContent<PricingPageContent>('pricing').frontmatter;

const styles: string[] = [
  String.raw`:root{--purple:var(--mk-brand-purple,#8B5CF6);--purple-dark:var(--mk-brand-purple-dark,#7C3AED);--purple-light:var(--mk-brand-purple-soft,#EDE9FE);--purple-ultra:var(--mk-brand-purple-wash,#F5F3FF);--text-dark:var(--mk-text-strong,#111827);--text-gray:var(--mk-text-muted,#64748B);--text-light:var(--mk-text-soft,#94A3B8);--bg:var(--mk-bg-page,#fff);--bg-gray:var(--mk-bg-section,#F9FAFB);--border:var(--mk-border-soft,#E8ECF1);--green:var(--mk-brand-green,#10B981);--r-pill:var(--mk-radius-pill,999px);--r-lg:var(--mk-radius-card,22px);--shadow:var(--mk-card-shadow,var(--mk-shadow-soft,0 1px 2px rgba(17,24,39,.04)))}*{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}body{font-family:'Mona Sans Variable',sans-serif;color:var(--text-dark);background:var(--bg);overflow-x:hidden;font-size:var(--mk-font-body);line-height:var(--mk-leading-body)}a{text-decoration:none;color:inherit}.pricing-page{background:#fff}.pricing-hero-plans{padding:calc(112px + env(safe-area-inset-top,0px)) 48px 72px;background:linear-gradient(180deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.08) 28%,rgba(255,255,255,0.42) 46%,rgba(255,255,255,0.82) 62%,rgba(255,255,255,0.98) 76%,#ffffff 88%,#ffffff 100%),radial-gradient(ellipse 96% 78% at 50% -22%,#EDE9FE 0%,#EDE9FE 14%,#F5F0FF 34%,#FDF4FF 52%,rgba(253,244,255,0.65) 72%,rgba(255,255,255,0.99) 94%,#ffffff 100%)}.pricing-plans-inner{margin-top:0;padding-top:0}.container{max-width:var(--mk-container-tight,1100px);margin:0 auto}.hero-copy{max-width:var(--mk-container-tight,1100px);margin:0 auto 28px;text-align:left}.pricing-plans-inner .sec-label{margin-bottom:12px}.pricing-plans-inner .sec-title{margin-bottom:14px}.pricing-plans-inner .sec-sub{margin:0 auto 28px;max-width:min(740px,100%)}.pricing-plans-inner .pt-toggle{margin:0 auto 36px}.pulse-dot{width:7px;height:7px;background:var(--purple);border-radius:50%;animation:pulse 2s infinite}@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}.hero-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:24px}.btn-dark,.btn-outline{padding:14px 24px;border-radius:var(--r-pill);font-size:var(--mk-btn);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:all .2s}.btn-dark{background:var(--text-dark);color:#fff}.btn-dark:hover{background:#1f2937;transform:translateY(-1px)}.btn-outline{border:1.5px solid var(--border);color:var(--text-dark);background:#fff}.btn-outline:hover{border-color:var(--purple);color:var(--purple)}.btn-demo-live{color:#fff;padding:15px 28px;border-radius:var(--r-pill);font-size:var(--mk-btn-lg,16px);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:transform .15s,background .2s,box-shadow .2s;border:none}.btn-trial-soft{display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:transform .15s,background .2s,border-color .2s,color .2s}.section{padding:var(--mk-space-section-y,88px) 48px}.section.gray{background:var(--bg-gray)}.section.tight{padding-top:64px}.sec-label{font-size:var(--mk-eyebrow);font-weight:600;color:#5B21B6;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;margin-bottom:12px}.sec-title{font-size:var(--mk-section-h2);font-weight:500;line-height:var(--mk-section-h2-lh);letter-spacing:var(--mk-section-h2-track);margin-bottom:14px;text-wrap:balance}.sec-sub{font-size:var(--mk-section-lead);color:var(--mk-text-desc,#64748B);margin:0 0 40px;line-height:var(--mk-section-lead-lh);max-width:740px;font-weight:400}.pt-toggle{display:flex;align-items:center;justify-content:center;gap:8px;width:max-content;padding:6px;border:1px solid var(--border);border-radius:999px;background:#fff;box-shadow:var(--shadow)}.pt-btn{padding:10px 18px;border-radius:999px;border:none;background:transparent;font:inherit;font-size:var(--mk-btn-sm);font-weight:600;color:var(--text-gray);cursor:pointer;transition:all .2s}.pt-btn.on{background:var(--purple);color:#fff;box-shadow:0 6px 18px rgba(124,58,237,.28)}.save-badge{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:#16a34a;background:none;border:none;padding:0;white-space:nowrap;max-width:0;opacity:0;transform:translateX(-8px);overflow:hidden;margin-left:0;pointer-events:none;transition:opacity .22s ease,transform .22s ease,max-width .28s ease,margin-left .22s ease}.save-badge.is-visible{max-width:200px;opacity:1;transform:translateX(0);margin-left:6px;pointer-events:auto}.save-dot{width:6px;height:6px;border-radius:50%;background:#16a34a;flex-shrink:0}@media(prefers-reduced-motion:reduce){.save-badge{transition:none}.save-badge:not(.is-visible){display:none}.save-badge.is-visible{display:inline-flex}}.plan-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:stretch}.plan{background:#fff;border-radius:var(--r-lg);padding:24px 20px;border:1px solid var(--border);position:relative;display:flex;flex-direction:column;height:100%;box-shadow:var(--mk-card-shadow,var(--shadow));transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.plan:hover{transform:translateY(-1px);box-shadow:var(--mk-card-shadow-hover,var(--shadow));border-color:var(--mk-card-border-hover,rgba(167,139,250,.42))}.plan.star{background:linear-gradient(180deg,#faf9ff 0%,#fff 85%);border-color:rgba(167,139,250,.55);box-shadow:var(--mk-card-shadow,var(--shadow))}.plan.star:hover{border-color:rgba(167,139,250,.65);box-shadow:var(--mk-card-shadow-hover,var(--shadow))}.plan-badge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--purple);color:#fff;font-size:var(--mk-eyebrow);font-weight:600;letter-spacing:var(--mk-eyebrow-ls);text-transform:uppercase;padding:5px 16px;border-radius:var(--r-pill);white-space:nowrap;box-shadow:0 4px 12px rgba(124,58,237,.2)}.feature-icon{width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:21px;flex-shrink:0;background:transparent;box-shadow:none;border:none}.plan-name{font-size:var(--mk-card-title);font-weight:600;margin-bottom:5px;color:var(--text-dark)}.plan-desc{font-size:14px;color:var(--mk-text-desc,#64748B);margin-bottom:16px;line-height:1.55;font-weight:400}.plan-price{font-size:38px;font-weight:500;letter-spacing:-1.5px;margin-bottom:5px;color:var(--text-dark)}.plan-price-custom{font-size:var(--mk-card-title);font-weight:600;letter-spacing:0;line-height:1.35}.plan-price .plan-price-period{font-size:var(--mk-body);font-weight:500;color:var(--text-gray);letter-spacing:0}.plan-price .plan-price-billed{display:block;font-size:13px;font-weight:500;color:var(--mk-text-desc,#64748B);letter-spacing:0;line-height:1.45;margin-top:4px}.plan-cta-subnote{font-size:12px;color:var(--mk-text-desc,#64748B);text-align:center;margin:8px 0 0;font-weight:400;line-height:1.45}.plan-div{height:1px;background:var(--border);margin:16px 0}.plan-feats{list-style:none;display:flex;flex-direction:column;gap:9px;flex:1;margin-bottom:22px}.plan-feats li{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:#475569;line-height:1.45;font-weight:400}.plan-grid .plan-feats li::before{content:"";width:5px;height:5px;border-radius:50%;background:linear-gradient(135deg,#C4B5FD,#A78BFA);margin-top:6px;flex-shrink:0;box-shadow:0 0 0 1px rgba(139,92,246,.2)}.plan-btn{width:100%;padding:12px;border-radius:var(--r-pill);font-size:var(--mk-btn-sm);font-weight:600;text-align:center;display:block;transition:all .2s;cursor:pointer;border:none;font-family:inherit;margin-top:auto}.pb-outline{background:transparent;border:1px solid var(--border);color:var(--text-dark)}.pb-outline:hover{border-color:rgba(139,92,246,.45);color:var(--purple-dark);background:rgba(245,243,255,.4)}.pb-dark{background:var(--text-dark);color:#fff}.pb-dark:hover{background:#1f2937;transform:translateY(-1px)}.self-grid,.feature-grid,.upgrade-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.self-card,.feature-card,.upgrade-card{background:#fff;border:1px solid var(--border);border-radius:var(--mk-radius-card,22px);padding:var(--mk-space-card,22px);box-shadow:var(--mk-card-shadow,var(--shadow));transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.self-card:hover,.feature-card:hover,.upgrade-card:hover{transform:translateY(-1px);box-shadow:var(--mk-card-shadow-hover,var(--shadow));border-color:var(--mk-card-border-hover,rgba(167,139,250,.42))}.self-card{text-align:center}.self-card .feature-icon,.feature-card .feature-icon{margin:0 auto 13px}.self-card h3,.feature-card h3,.upgrade-card h3{font-size:var(--mk-card-title,16px);font-weight:500;line-height:1.3;letter-spacing:-.25px;margin-bottom:8px}.self-card p,.feature-card p,.upgrade-card p{font-size:14px;color:var(--text-gray);line-height:1.65}.feature-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.feature-card{text-align:center}.upgrade-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.upgrade-card{display:flex;gap:14px;align-items:flex-start}.line-choice{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:stretch}.line-card{border-radius:28px;padding:28px;border:1px solid var(--border);background:#fff;box-shadow:var(--mk-card-shadow,var(--shadow));transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.line-card:hover{transform:translateY(-1px);box-shadow:var(--mk-card-shadow-hover,var(--shadow));border-color:var(--mk-card-border-hover,rgba(167,139,250,.42))}.line-card.recommended{background:linear-gradient(180deg,#fbfaff 0%,#fff 82%);border-color:#c4b5fd;box-shadow:0 0 0 4px rgba(139,92,246,.06),var(--mk-card-shadow,var(--shadow))}.line-card.recommended:hover{border-color:#a78bfa;box-shadow:0 0 0 4px rgba(139,92,246,.08),var(--mk-card-shadow-hover,var(--shadow))}.line-card-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}.plan-icon{display:inline-flex;align-items:center;justify-content:center;font-size:21px;line-height:1}.pill{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:500}.pill.optional{background:#f8fafc;color:#475569;border:1px solid #e2e8f0}.line-card h3{font-size:var(--mk-card-title,16px);font-weight:500;line-height:1.38;letter-spacing:-.2px;margin-bottom:9px}.line-card p{font-size:14.5px;color:var(--text-gray);line-height:1.72}.expect-band{display:grid;grid-template-columns:1fr 1fr;gap:18px}.note-box{padding:24px;border-radius:var(--mk-radius-card,22px);background:#fff;border:1px solid var(--border);box-shadow:var(--mk-card-shadow,var(--shadow));transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.note-box:hover{transform:translateY(-1px);box-shadow:var(--mk-card-shadow-hover,var(--shadow));border-color:var(--mk-card-border-hover,rgba(167,139,250,.42))}.note-box h3{font-size:18px;font-weight:500;margin-bottom:12px}.note-box ul{list-style:none;display:grid;gap:10px}.note-box li{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--text-gray);line-height:1.6}.note-box li::before{content:"✓";color:var(--purple);font-weight:900}.pricing-foot{margin-top:28px;font-size:13px;line-height:1.6;color:var(--mk-text-desc,#64748B);text-align:center;font-weight:400;max-width:760px;margin-left:auto;margin-right:auto}.compare-section{margin-top:0}.compare-wrap{margin:0 -8px;padding:0 8px}.pricing-compare-frame{border-radius:var(--r-lg);border:1px solid var(--border);background:#fff;box-shadow:none;overflow:hidden}.pricing-compare-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}.compare-table{width:100%;min-width:720px;border-collapse:separate;border-spacing:0;border:none;border-radius:0;background:#fff;box-shadow:none;font-size:14px}.compare-table th,.compare-table td{padding:22px 26px;border-bottom:1px solid var(--border);vertical-align:middle}.compare-table tr:last-child td{border-bottom:none}.compare-table thead th{background:#fff;font-weight:500;color:var(--text-dark);text-align:left}.compare-table thead th:not(:first-child){text-align:center}.compare-table td:first-child{font-weight:500;color:#334155;text-align:left}.compare-table tbody tr:not(.compare-group):hover td{background:var(--bg-gray)}.compare-table .compare-group td{background:var(--bg-gray);font-weight:500;color:#5B21B6;font-size:13px;letter-spacing:.02em;text-transform:uppercase}.compare-yes{text-align:center;font-weight:500;color:var(--green)}.compare-dash{text-align:center;color:var(--text-light);font-weight:600}.compare-val{font-size:14px;line-height:1.45}@media(max-width:960px){.pricing-hero-plans,.section{padding-left:22px;padding-right:22px}.plan-grid,.self-grid,.feature-grid,.upgrade-grid,.line-choice,.expect-band{grid-template-columns:1fr}.pricing-hero-plans{padding-top:calc(69px + 28px + env(safe-area-inset-top,0px));padding-bottom:64px}.hero-copy{margin-bottom:22px}.pricing-plans-inner .sec-sub{margin-bottom:24px}.pricing-plans-inner .pt-toggle{margin-bottom:28px}.hero-actions{justify-content:flex-start}.pt-toggle{width:100%;max-width:380px}.pt-btn{flex:1}}@media(max-width:640px){.hero-copy{margin-bottom:18px}.pricing-plans-inner .sec-sub{margin-bottom:20px}.pricing-plans-inner .pt-toggle{margin-bottom:24px}.hero-actions{flex-direction:column;align-items:stretch}.btn-dark,.btn-outline{width:100%}.section{padding-top:var(--mk-space-section-y-mobile,56px);padding-bottom:64px}.sec-sub{margin-bottom:0}.plan{padding:22px 18px;box-shadow:0 1px 2px rgba(17,24,39,.04)}.plan:hover{transform:none;box-shadow:0 1px 2px rgba(17,24,39,.04)}.plan.star,.plan.star:hover{box-shadow:0 0 0 1px rgba(139,92,246,.08)}.pt-toggle{max-width:none}}`,
  String.raw`.pricing-hero-copy{max-width:560px}.pricing-hero-eyebrow{font-size:12px;font-weight:500;color:#7F77DD;letter-spacing:.1em;text-transform:uppercase;margin-bottom:16px}.pricing-hero-title{font-size:42px;font-weight:500;color:#1a1833;line-height:1.12;letter-spacing:-.01em;margin:0 0 16px;text-wrap:balance}.pricing-hero-subtitle{font-size:16px;color:var(--mk-text-desc,#64748B);line-height:1.65;margin:0 0 32px;max-width:480px;font-weight:400}.pricing-hero-trust{display:flex;align-items:center;gap:20px;margin-bottom:32px;flex-wrap:wrap}.pricing-hero-trust-item{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#534AB7;font-weight:500;line-height:1.4}.pricing-hero-trust-item svg{width:14px;height:14px;color:#7F77DD;flex:0 0 auto}.pricing-hero-trust-separator{width:4px;height:4px;border-radius:50%;background:#AFA9EC;flex:0 0 auto}.pricing-hero-toggle-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.pricing-hero-toggle{background:rgba(255,255,255,.7);border:.5px solid #AFA9EC;border-radius:24px;padding:4px;gap:4px;box-shadow:none;margin:0;width:max-content}.pricing-hero-toggle .pt-btn{padding:6px 18px;border-radius:20px;color:#888780;font-weight:500}.pricing-hero-toggle .pt-btn.on{background:#7F77DD;color:#fff;border-radius:20px;box-shadow:none}.pricing-hero-save{font-size:12px;color:#534AB7;background:#EEEDFE;padding:4px 10px;border-radius:20px}.pricing-hero-save.is-visible{margin-left:0}@media(max-width:960px){.pricing-hero-copy{max-width:100%}.pricing-hero-title{font-size:34px}.pricing-hero-toggle{width:max-content;max-width:none}.pricing-hero-toggle .pt-btn{flex:0 0 auto}}@media(max-width:640px){.pricing-hero-title{font-size:28px}.pricing-hero-subtitle{font-size:15px;margin-bottom:26px}.pricing-hero-trust{gap:10px 14px;margin-bottom:26px}.pricing-hero-trust-separator{display:none}.pricing-hero-toggle-row{align-items:flex-start;flex-direction:column}.pricing-hero-toggle{width:auto}.pricing-hero-toggle .pt-btn{padding:6px 16px}}`,
];

function buildPricingScripts(content: PricingPageContent): string[] {
  const starterPlan = content.plans.find((plan) => plan.id === 'starter');
  const professionalPlan = content.plans.find((plan) => plan.id === 'professional');
  const starterMonthlyHtml = starterPlan?.price_monthly
    ? `$${starterPlan.price_monthly}<span class="plan-price-period">/ month</span>`
    : '';
  const starterAnnualHtml = starterPlan?.price_annual
    ? `$${starterPlan.price_annual}<span class="plan-price-period">/mo</span><span class="plan-price-billed">${starterPlan.annual_billed_label ?? ''}</span>`
    : starterMonthlyHtml;
  const professionalMonthlyHtml = professionalPlan?.price_monthly
    ? `$${professionalPlan.price_monthly}<span class="plan-price-period">/ month</span>`
    : '';
  const professionalAnnualHtml = professionalPlan?.price_annual
    ? `$${professionalPlan.price_annual}<span class="plan-price-period">/mo</span><span class="plan-price-billed">${professionalPlan.annual_billed_label ?? ''}</span>`
    : professionalMonthlyHtml;

  return [
    String.raw`
function setPricingPageMode(mode) {
  const monthly = mode === 'monthly';
  const monthlyButton = document.getElementById('pricing-tog-m');
  const annualButton = document.getElementById('pricing-tog-a');
  const starterPrice = document.getElementById('pricing-starter-price');
  const proPrice = document.getElementById('pricing-pro-price');
  if (!monthlyButton || !annualButton || !starterPrice || !proPrice) return false;
  monthlyButton.classList.toggle('on', monthly);
  annualButton.classList.toggle('on', !monthly);
  const saveBadge = document.getElementById('pricing-pt-save-badge');
  if (saveBadge) saveBadge.classList.toggle('is-visible', !monthly);
  starterPrice.innerHTML = monthly
    ? ${JSON.stringify(starterMonthlyHtml)}
    : ${JSON.stringify(starterAnnualHtml)};
  proPrice.innerHTML = monthly
    ? ${JSON.stringify(professionalMonthlyHtml)}
    : ${JSON.stringify(professionalAnnualHtml)};
  return true;
}
window.__ringbookerPricingSetMode = setPricingPageMode;

document.addEventListener('click', (event) => {
  const target = event.target && event.target.closest
    ? event.target.closest('#pricing-tog-m,#pricing-tog-a')
    : null;
  if (!target) return;
  event.preventDefault();
  setPricingPageMode(target.id === 'pricing-tog-a' ? 'annual' : 'monthly');
});

function initPricingPageToggle() {
  if (setPricingPageMode('monthly')) return;
  requestAnimationFrame(initPricingPageToggle);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPricingPageToggle);
} else {
  initPricingPageToggle();
}
`,
  ];
}

export const templateTitle = defaultPricingContent.meta.title;

function getPlanPriceId(plan: PricingPlanContent) {
  if (plan.id === 'starter') return 'pricing-starter-price';
  if (plan.id === 'professional') return 'pricing-pro-price';
  return undefined;
}

function ComparePlanCell({ value }: { value: PricingCompareValue }) {
  if (value === true) {
    return <td className="compare-yes">✓</td>;
  }
  if (value === false) {
    return <td className="compare-dash">—</td>;
  }
  return (
    <td className="compare-val" style={{ textAlign: 'center', fontWeight: 500, color: '#475569' }}>
      {value}
    </td>
  );
}

function buildPricingFaqItems(content: PricingPageContent): MarketingFaqItem[] {
  return content.faq.map((item) => ({
    q: item.q,
    a: `${item.a}${trialNoChargeCopyVerified && item.trial_verified_extra ? item.trial_verified_extra : ''}`,
  }));
}

export function MarketingPricingTemplate({ content = defaultPricingContent }: { content?: PricingPageContent }) {
  const faqItems = buildPricingFaqItems(content);

  return (
    <MarketingLayout
      styles={styles}
      scripts={buildPricingScripts(content)}
      scriptPrefix="marketing-pricing"
    >
      <>
        <MarketingChromeStyles />
        <MarketingHeader active="pricing" />
        <main className="pricing-page">
          <section className="pricing-hero-plans">
            <div className="container">
              <div className="hero-copy">
                <nav aria-label="Breadcrumb" style={{ marginBottom: 12, fontSize: 14, lineHeight: 1.35, color: 'var(--mk-text-soft,#94a3b8)', textAlign: 'left' }}>
                  <a href={content.breadcrumb.home_href} style={{ color: 'var(--mk-text-soft,#94a3b8)', textDecoration: 'none', fontWeight: 400 }}>{content.breadcrumb.home_label}</a>
                  <span style={{ margin: '0 6px' }}>›</span>
                  <span style={{ color: 'var(--mk-text-soft,#94a3b8)', fontWeight: 400 }}>{content.breadcrumb.current_label}</span>
                </nav>
                <div className="pricing-hero-copy">
                  <div className="pricing-hero-eyebrow">{content.hero.eyebrow}</div>
                  <h1 className="pricing-hero-title">{content.hero.h1}</h1>
                  <p className="pricing-hero-subtitle">
                    {content.hero.subtitle}
                  </p>
                  <div className="pricing-hero-trust" aria-label="Pricing highlights">
                    {content.hero.trust.map((item, index) => (
                      <Fragment key={item}>
                        {index > 0 ? <span className="pricing-hero-trust-separator" aria-hidden /> : null}
                        <span className="pricing-hero-trust-item">
                          <IconCheck aria-hidden size={14} stroke={2.2} />
                          {item}
                        </span>
                      </Fragment>
                    ))}
                  </div>
                  <div className="pricing-hero-toggle-row">
                    <div className="pt-toggle pricing-hero-toggle" aria-label="Billing cycle">
                      <button className="pt-btn on" id="pricing-tog-m" type="button">{content.hero.toggle_monthly_label}</button>
                      <button className="pt-btn" id="pricing-tog-a" type="button">{content.hero.toggle_annual_label}</button>
                    </div>
                    <span className="save-badge pricing-hero-save" id="pricing-pt-save-badge">
                      {content.hero.toggle_save_label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pricing-plans-inner">
                <div className="plan-grid">
                  {content.plans.map((plan) => {
                    const priceId = getPlanPriceId(plan);

                    return (
                    <div className={`plan ${plan.popular ? 'star' : ''}`} key={plan.id}>
                      {plan.popular && plan.popular_label ? <div className="plan-badge">{plan.popular_label}</div> : null}
                      <div className="plan-name">{plan.name}</div>
                      <div className="plan-desc">{plan.description}</div>
                      <div className={`plan-price ${priceId ? '' : 'plan-price-custom'}`} id={priceId}>
                        {priceId && plan.price_monthly ? (
                          <>
                            ${plan.price_monthly}
                            <span className="plan-price-period">/ month</span>
                          </>
                        ) : (
                          plan.price_label
                        )}
                      </div>
                      {priceId && plan.tax_note ? <p className="plan-cta-subnote">{plan.tax_note}</p> : null}
                      <div className="plan-div" />
                      <ul className="plan-feats">
                        {plan.benefits.map((benefit) => (
                          <li key={benefit}>{benefit}</li>
                        ))}
                      </ul>
                      <a className={`plan-btn ${plan.popular ? 'pb-dark' : 'pb-outline'}`} href={plan.cta_href}>{plan.cta_label}</a>
                      {plan.cta_subnote ? (
                        <p className="plan-cta-subnote">{plan.cta_subnote}</p>
                      ) : null}
                    </div>
                    );
                  })}
                </div>

              </div>
            </div>
          </section>

          <section className="section gray pricing-compare-lower">
            <div className="container">
              <div className="compare-section">
                <div className="sec-label">{content.compare.eyebrow}</div>
                <h2 className="sec-title">
                  {content.compare.heading_line_1}
                  <br />
                  <em>{content.compare.heading_emphasis}</em> {content.compare.heading_line_2}
                </h2>
                <p className="sec-sub" style={{ marginBottom: 28 }}>
                  {content.compare.subtitle}
                </p>
                <div className="compare-wrap">
                  <div className="pricing-compare-frame">
                    <div className="pricing-compare-scroll">
                      <table className="compare-table">
                    <thead>
                      <tr>
                        {content.compare.table_headers.map((header) => (
                          <th key={header} scope="col">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {content.compare_groups.map((group) => (
                        <Fragment key={group.group}>
                          <tr className="compare-group">
                            <td colSpan={4}>{group.group}</td>
                          </tr>
                          {group.rows.map((row) => (
                            <tr key={`${group.group}-${row.feature}`}>
                              <td>{row.feature}</td>
                              <ComparePlanCell value={row.starter} />
                              <ComparePlanCell value={row.professional} />
                              <ComparePlanCell value={row.custom} />
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="section pricing-faq-cta">
            <div className="container">
              <MarketingFaqAccordion
                items={faqItems}
                wide
                title={content.faq_section.title}
                subtitle={null}
              />
            </div>
          </section>
        </main>
        <MarketingFooter />
      </>
    </MarketingLayout>
  );
}
