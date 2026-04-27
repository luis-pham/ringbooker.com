'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';
import { MarketingFaqAccordion, type MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import {
  CALL_FORWARDING_COUNTRY_GROUPS,
  CALL_FORWARDING_OTHER_COUNTRIES,
  CALL_FORWARDING_PROVIDERS,
  type ProviderCountryCode,
  type ProviderRecord,
} from '@/lib/marketing/call-forwarding-providers';

const FAQ_ITEMS: MarketingFaqItem[] = [
  { q: 'Will customers see a different number?', a: 'No. Your public business number stays the same. RingBooker works through forwarding behind the scenes.' },
  { q: 'Should I forward all calls or only missed calls?', a: 'Most teams start with missed, busy, or after-hours forwarding so staff can still answer normal calls first.' },
  { q: 'Can I use RingBooker after hours only?', a: 'Yes. Most providers support time-based routing so RingBooker handles off-hours calls only.' },
  { q: 'Can I turn call forwarding off?', a: 'Yes. Disable forwarding in provider settings or deactivation flow, then verify with one test call.' },
  { q: 'What if my provider is not listed?', a: 'Many systems still support call forwarding. RingBooker can help your team test setup before go-live.' },
  { q: 'Will this affect my Google Business Profile number?', a: 'No listing change is required when you keep your published number and only add forwarding.' },
  { q: 'Are RingBooker and these phone providers affiliated?', a: 'No. Provider names and logos are used for identification only. RingBooker is not affiliated with or endorsed by these providers unless stated otherwise.' },
];

function track(event: string, payload?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const w = window as Window & { dataLayer?: Array<Record<string, unknown>> };
  if (!Array.isArray(w.dataLayer)) return;
  w.dataLayer.push({ event, ...payload });
}

function verificationLabel(status: ProviderRecord['verificationStatus']) {
  if (status === 'verified_official') return 'Official source verified';
  if (status === 'partial') return 'Some details may vary by plan or device';
  return 'Check with your provider before using exact settings';
}
function setupVerificationLabel(status: ProviderRecord['setupInstructions']['verificationStatus']) {
  if (status === 'official_verified') return 'Official provider docs checked';
  if (status === 'skipcalls_sourced') return 'SkipCalls-sourced setup reference';
  return 'Needs official provider verification';
}

function providerInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

function ProviderCard({
  provider,
  active,
  onSelect,
}: {
  provider: ProviderRecord;
  active: boolean;
  onSelect: (provider: ProviderRecord) => void;
}) {
  return (
    <article
      className={`group cursor-pointer rounded-2xl border bg-white p-4 transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
        active
          ? 'border-violet-300 bg-violet-50/50 shadow-[0_20px_40px_-8px_rgba(17,24,39,0.06),0_8px_16px_-6px_rgba(17,24,39,0.04)]'
          : 'border-slate-200/90 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_20px_40px_-8px_rgba(17,24,39,0.06),0_8px_16px_-6px_rgba(17,24,39,0.04)]'
      }`}
      onClick={() => onSelect(provider)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(provider);
        }
      }}
      aria-label={`View setup for ${provider.name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900">{provider.name}</div>
        </div>
        {provider.logo.src && (provider.logo.usageStatus === 'approved_official' || provider.logo.usageStatus === 'likely_ok') ? (
          <img src={provider.logo.src} alt={provider.logo.alt} className="h-8 w-16 shrink-0 object-contain" />
        ) : (
          <span className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-500" aria-hidden>
            {providerInitials(provider.name)}
          </span>
        )}
      </div>
      <span className="mt-3 inline-flex items-center text-sm font-semibold text-violet-700 transition group-hover:text-violet-800">
        View setup
      </span>
    </article>
  );
}

function SetupGuidePanel({
  provider,
  onBack,
  isMobile,
}: {
  provider: ProviderRecord;
  onBack: () => void;
  isMobile: boolean;
}) {
  const [open, setOpen] = useState<Record<'no-answer' | 'busy' | 'after-hours' | 'all-calls', boolean>>({
    'no-answer': true,
    busy: false,
    'after-hours': false,
    'all-calls': false,
  });

  return (
    <section id="provider-guide" className="mt-10 border-t border-slate-200 pt-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 pb-2">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Setup guide</p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">How to forward {provider.name} calls to RingBooker</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{provider.country}</span>
            <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700">{provider.marketGroup === 'business_voip' ? 'Business phone & VoIP' : 'Country provider'}</span>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">{verificationLabel(provider.verificationStatus)}</span>
          </div>
        </div>
        <button type="button" onClick={onBack} className="min-h-10 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400">
          Back to providers
        </button>
      </div>

      <div className="space-y-8">
        <div>
          <h4 className="text-lg font-bold text-slate-900">Before you start</h4>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-slate-600">
            {provider.beforeYouStart.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-lg font-bold text-slate-900">Setup options</h4>
          <div className="mt-3 space-y-3">
            {[
              { id: 'all-calls' as const, match: 'all_calls', fallbackTitle: 'Forward all calls' },
              { id: 'no-answer' as const, match: 'no_answer', fallbackTitle: 'Forward missed / no-answer calls' },
              { id: 'busy' as const, match: 'busy', fallbackTitle: 'Forward busy calls' },
              { id: 'after-hours' as const, match: 'after_hours', fallbackTitle: 'Forward after-hours calls' },
              { id: 'after-hours' as const, match: 'unreachable', fallbackTitle: 'Forward unreachable calls' },
              { id: 'after-hours' as const, match: 'dashboard_rule', fallbackTitle: 'Dashboard or app routing rule' },
            ].map((option, idx) => {
              const data = provider.setupInstructions.options.find((o) => o.type === option.match);
              if (!data) return null;
              const opened = open[option.id];
              return (
                <section key={`${option.id}-${idx}`} className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-600"
                    onClick={() => setOpen((prev) => ({ ...prev, [option.id]: !prev[option.id] }))}
                    aria-expanded={opened}
                  >
                    <span className="text-sm font-bold text-slate-900">{data.label || option.fallbackTitle}</span>
                    <span className="text-slate-500" aria-hidden>{opened ? '−' : '+'}</span>
                  </button>
                  {opened ? (
                    <div className="border-t border-slate-200 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-700">When to use it</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{data.notes[0] ?? 'Use this option when this forwarding condition matches your call flow.'}</p>
                      {data.activationCode ? <p className="mt-2 text-xs text-slate-500">Activation code: <span className="font-semibold text-slate-700">{data.activationCode}</span></p> : null}
                      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-600">
                        {data.activationSteps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                      {data.deactivationCode ? <p className="mt-3 text-xs text-slate-500">Deactivation code: <span className="font-semibold text-slate-700">{data.deactivationCode}</span></p> : null}
                      {data.deactivationSteps.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-500">
                          {data.deactivationSteps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        Open your provider&apos;s call forwarding, call divert, or call handling settings and enter your RingBooker forwarding number.
                      </p>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="text-lg font-bold text-slate-900">Test your setup</h4>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-[15px] leading-7 text-slate-600">
            {provider.setupInstructions.testingSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="text-lg font-bold text-slate-900">Turn forwarding off</h4>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px] leading-7 text-slate-600">
              {provider.turnOffSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-900">Troubleshooting</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-7 text-slate-600">
              {provider.setupInstructions.troubleshooting.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <h4 className="text-base font-bold text-slate-900">Need help testing your forwarding setup?</h4>
          <p className="mt-1 text-sm leading-6 text-slate-600">RingBooker can help your team validate routing before go-live.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/contact"
              className="inline-flex min-h-10 items-center rounded-full bg-gradient-to-br from-violet-700 via-violet-600 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-[0_6px_22px_rgba(91,33,182,0.2)] transition hover:-translate-y-px hover:brightness-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
              onClick={() => track('call_forwarding_setup_cta_clicked', { provider: provider.id })}
            >
              Get guided setup
            </Link>
            <Link
              href="/demo"
              className="inline-flex min-h-10 items-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-violet-500 hover:text-violet-700"
              onClick={() => track('call_forwarding_demo_clicked', { source: isMobile ? 'mobile_guide' : 'guide' })}
            >
              Try a live demo
            </Link>
          </div>
        </div>

        {provider.setupInstructions.verificationStatus !== 'official_verified' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
            <p className="font-semibold">Source note: {setupVerificationLabel(provider.setupInstructions.verificationStatus)}</p>
            <p className="mt-1">
              These instructions are based on publicly available call forwarding references and should be tested with your provider before going live.
            </p>
          </div>
        ) : null}

        <details className="rounded-xl border border-slate-200 p-4 text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold text-slate-700">Sources & last checked area</summary>
          <ul className="mt-2 list-disc pl-4">
            {provider.setupInstructions.sourceUrls.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}

export function CurrentNumberCallForwardingTool() {
  const [filter, setFilter] = useState<'popular' | 'voip' | 'other'>('popular');
  const [otherCountry, setOtherCountry] = useState<'UK' | 'NZ' | 'IE'>('UK');
  const [selected, setSelected] = useState<ProviderRecord | null>(null);
  const [suggestedCountry, setSuggestedCountry] = useState<'UK' | 'NZ' | 'IE' | null>(null);
  const findRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const lang = navigator.language.toLowerCase();
    if (lang.includes('en-gb')) setSuggestedCountry('UK');
    if (lang.includes('en-nz')) setSuggestedCountry('NZ');
    if (lang.includes('en-ie')) setSuggestedCountry('IE');
  }, []);

  const filtered = useMemo(() => CALL_FORWARDING_PROVIDERS, []);

  const byCountry = (countryCode: ProviderCountryCode) => filtered.filter((p) => p.countryCode === countryCode);
  const popularVisible = filter === 'popular';
  const voipVisible = filter === 'voip';
  const otherVisible = filter === 'other';

  useEffect(() => {
    if (!selected || !detailRef.current) return;
    detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selected]);

  return (
    <main className="bg-[radial-gradient(ellipse_84%_58%_at_50%_0%,#ede9fe_0%,#ffffff_66%)] pb-28 pt-28 md:pb-16">
      <section className="mx-auto max-w-6xl px-6">
        <div className="text-center">
        <p className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-violet-700">
          Current Number Setup
        </p>
        <h1 className="mx-auto mt-4 max-w-4xl text-[clamp(34px,5vw,56px)] font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900">Call Forwarding Setup Guides</h1>
        <p className="mx-auto mt-4 max-w-3xl text-[17px] leading-[1.72] text-[#64748B]">
          Keep your current number. Choose your provider and see how to forward missed, busy, or after-hours calls to RingBooker.
        </p>
        <ul className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-600">
          {['Keep your public number', 'Forward only selected calls', 'Test before going live'].map((line) => (
            <li key={line} className="inline-flex items-center gap-2">
              <span className="text-emerald-600" aria-hidden>
                ✓
              </span>
              {line}
            </li>
          ))}
        </ul>
        </div>
      </section>

      <section ref={findRef} id="find-setup" className="mx-auto mt-24 max-w-6xl px-6">
        <div className="md:p-2">
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => setFilter('popular')} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === 'popular' ? 'bg-violet-700 text-white' : 'border border-slate-300 text-slate-700'}`}>Popular countries</button>
            <button type="button" onClick={() => setFilter('voip')} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === 'voip' ? 'bg-violet-700 text-white' : 'border border-slate-300 text-slate-700'}`}>Business phone &amp; VoIP</button>
            <button type="button" onClick={() => setFilter('other')} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === 'other' ? 'bg-violet-700 text-white' : 'border border-slate-300 text-slate-700'}`}>Other countries</button>
          </div>

          {selected ? (
            <div className="sticky top-[72px] z-20 mt-4 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 md:hidden">
              <div className="flex items-center gap-2">
                <span>{selected.name} guide selected</span>
              </div>
            </div>
          ) : null}

          {suggestedCountry ? (
            <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                Looks like you may be in {CALL_FORWARDING_OTHER_COUNTRIES.find((c) => c.code === suggestedCountry)?.label}. View providers?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(91,33,182,0.2)] transition hover:-translate-y-px hover:brightness-[1.04]"
                  onClick={() => {
                    setFilter('other');
                    setOtherCountry(suggestedCountry);
                    track('call_forwarding_country_selected', { country: suggestedCountry, source: 'suggestion' });
                  }}
                >
                  View providers
                </button>
                <button type="button" className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold">
                  Choose manually
                </button>
              </div>
            </div>
          ) : null}

          {popularVisible ? (
            <div className="mt-8 space-y-10">
              {CALL_FORWARDING_COUNTRY_GROUPS.map((group) => {
                const items = byCountry(group.code);
                if (items.length === 0) return null;
                return (
                  <section key={group.code}>
                    <h3 className="text-xl font-bold tracking-tight text-slate-900">{group.label}</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {items.map((provider) => (
                        <ProviderCard
                          key={provider.id}
                          provider={provider}
                          active={selected?.id === provider.id}
                          onSelect={(p) => {
                            setSelected(p);
                            track('call_forwarding_provider_selected', { provider: p.id, country: p.countryCode ?? 'multi' });
                          }}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null}

          {voipVisible ? (
            <section className="mt-10">
              <h3 className="mb-3 text-xl font-bold tracking-tight text-slate-900">Business phone &amp; VoIP systems</h3>
              <p className="text-sm text-slate-600">
                Already using a virtual number or cloud phone system? Choose your provider to see how to route calls to RingBooker.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {filtered
                  .filter((p) => p.marketGroup === 'business_voip')
                  .map((provider) => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      active={selected?.id === provider.id}
                      onSelect={(p) => {
                        setSelected(p);
                        track('call_forwarding_voip_provider_selected', { provider: p.id });
                      }}
                    />
                  ))}
              </div>
            </section>
          ) : null}

          {otherVisible ? (
            <section className="mt-10">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">Choose another country</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {CALL_FORWARDING_OTHER_COUNTRIES.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      setOtherCountry(country.code);
                      track('call_forwarding_country_selected', { country: country.code, source: 'selector' });
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${otherCountry === country.code ? 'bg-violet-700 text-white shadow-[0_4px_14px_rgba(91,33,182,0.22)]' : 'border border-slate-300 text-slate-700 hover:border-violet-200'}`}
                  >
                    {country.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {filtered
                  .filter((p) => p.marketGroup === 'secondary_country' && p.countryCode === otherCountry)
                  .map((provider) => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      active={selected?.id === provider.id}
                      onSelect={(p) => {
                        setSelected(p);
                        track('call_forwarding_provider_selected', { provider: p.id, country: p.countryCode ?? 'multi' });
                      }}
                    />
                  ))}
              </div>
            </section>
          ) : null}

          <div ref={detailRef}>{selected ? <SetupGuidePanel provider={selected} onBack={() => setSelected(null)} isMobile /> : null}</div>
          <p className="mt-8 text-xs leading-5 text-slate-500">
            Provider names and logos are used for identification only. RingBooker is not affiliated with or endorsed by these providers unless stated otherwise.
          </p>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-6">
        <MarketingFaqAccordion items={FAQ_ITEMS} embedded eyebrow="FAQ" title="Call forwarding setup questions" subtitle={null} openFirstItem />
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-6 md:hidden">
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_20px_40px_-8px_rgba(17,24,39,0.06),0_8px_16px_-6px_rgba(17,24,39,0.04)]">
          <h2 className="mb-4 mx-auto max-w-[22ch] text-3xl font-bold tracking-tight text-slate-900 md:text-[clamp(28px,3.35vw,42px)]">Cover missed calls without changing your number</h2>
          <p className="text-[15px] leading-[1.68] text-[#64748B]">
            RingBooker helps appointment-based businesses answer after-hours, busy, and unanswered calls while keeping their current public number.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Explore <Link href="/current-number" className="underline underline-offset-2">current number guide</Link>, <Link href="/how-it-works" className="underline underline-offset-2">how it works</Link>, <Link href="/works-with" className="underline underline-offset-2">works with</Link>, <Link href="/trust" className="underline underline-offset-2">trust</Link>, and pages for <Link href="/industries/nail-salon" className="underline underline-offset-2">nail salons</Link>, <Link href="/industries/hair-salon" className="underline underline-offset-2">hair salons</Link>, <Link href="/industries/med-spa" className="underline underline-offset-2">med spas</Link>, and <Link href="/industries/spa" className="underline underline-offset-2">day spas</Link>.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/demo" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-br from-violet-700 via-violet-600 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-[0_8px_28px_rgba(91,33,182,0.22),0_2px_8px_rgba(91,33,182,0.12)] transition hover:-translate-y-0.5 hover:brightness-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600" onClick={() => track('call_forwarding_demo_clicked', { source: 'final_cta' })}>
              <DemoCtaPhoneIcon width={16} height={16} />
              Try a live demo
            </Link>
            <Link href="/current-number" className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:text-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">
              View current number guide
            </Link>
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-6px_20px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800"
            onClick={() => findRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Find provider
          </button>
          <Link
            href="/demo"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-gradient-to-br from-violet-700 via-violet-600 to-violet-600 px-4 text-sm font-bold text-white shadow-[0_8px_28px_rgba(91,33,182,0.22),0_2px_8px_rgba(91,33,182,0.12)] transition hover:-translate-y-0.5 hover:brightness-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
            onClick={() => track('call_forwarding_demo_clicked', { source: 'sticky_mobile' })}
          >
            Try demo
          </Link>
        </div>
      </div>

    </main>
  );
}
