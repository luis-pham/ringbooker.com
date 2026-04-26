'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';
import { MarketingFaqAccordion, type MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import {
  CALL_FORWARDING_COUNTRY_GROUPS,
  CALL_FORWARDING_OTHER_COUNTRIES,
  CALL_FORWARDING_PROVIDERS,
  type ProviderCountry,
  type ProviderRecord,
  type SetupKey,
} from '@/lib/marketing/call-forwarding-providers';

const FAQ_ITEMS: MarketingFaqItem[] = [
  { q: 'Will customers see a different number?', a: 'No. Your public business number stays the same. RingBooker works through forwarding behind the scenes.' },
  { q: 'Should I forward all calls or only missed calls?', a: 'Most teams start with missed, busy, or after-hours forwarding so staff can still answer normal calls first.' },
  { q: 'Can I use RingBooker after hours only?', a: 'Yes. Most providers support time-based routing so RingBooker handles off-hours calls only.' },
  { q: 'Can I turn call forwarding off?', a: 'Yes. Disable forwarding in provider settings or deactivation flow, then verify with one test call.' },
  { q: 'What if my provider is not listed?', a: 'Many systems still support call forwarding. RingBooker can help your team test setup before go-live.' },
  { q: 'Will this affect my Google Business Profile number?', a: 'No listing change is required when you keep your published number and only add forwarding.' },
];

function track(event: string, payload?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const w = window as Window & { dataLayer?: Array<Record<string, unknown>> };
  if (!Array.isArray(w.dataLayer)) return;
  w.dataLayer.push({ event, ...payload });
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
    <article className={`rounded-2xl border bg-white p-4 shadow-sm transition ${active ? 'border-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.12)]' : 'border-slate-200 hover:border-violet-300 hover:shadow-md'}`}>
      <div className="text-sm font-bold text-slate-900">{provider.name}</div>
      <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {provider.providerType}
      </span>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{provider.bestFor}</p>
      <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-600">{provider.ringbookerRecommendation}</p>
      <button
        type="button"
        onClick={() => onSelect(provider)}
        className="mt-4 inline-flex min-h-10 items-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-violet-500 hover:text-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500"
      >
        View setup
      </button>
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
  const [open, setOpen] = useState<Record<SetupKey, boolean>>({
    'no-answer': true,
    busy: false,
    'after-hours': false,
    'all-calls': false,
  });

  return (
    <section id="provider-guide" className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Setup guide</p>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">How to forward {provider.name} calls to RingBooker</h3>
          <div className="mt-2 flex items-center gap-2">
            {provider.country ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{provider.country}</span> : null}
            <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700">{provider.marketGroup === 'business-voip' ? 'Business phone & VoIP' : 'Country provider'}</span>
          </div>
        </div>
        <button type="button" onClick={onBack} className="min-h-10 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400">
          Back to providers
        </button>
      </div>

      <div className="space-y-8">
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <h4 className="text-base font-bold text-violet-900">Recommended setup for salons and spas</h4>
          <p className="mt-1 text-[15px] leading-7 text-violet-900">{provider.ringbookerRecommendation}</p>
        </div>

        <div>
          <h4 className="text-lg font-bold text-slate-900">Before you start</h4>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-slate-600">
            {provider.beforeYouStart.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-lg font-bold text-slate-900">General setup steps</h4>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-[15px] leading-7 text-slate-600">
            {provider.generalSetupSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div>
          <h4 className="text-lg font-bold text-slate-900">Setup options</h4>
          <div className="mt-3 space-y-3">
            {provider.setupOptions.map((option) => {
              const opened = open[option.id];
              return (
                <section key={option.id} className="rounded-xl border border-slate-200">
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    onClick={() => setOpen((prev) => ({ ...prev, [option.id]: !prev[option.id] }))}
                    aria-expanded={opened}
                  >
                    <span className="text-sm font-bold text-slate-900">{option.title}</span>
                    <span className="text-slate-500" aria-hidden>{opened ? '−' : '+'}</span>
                  </button>
                  {opened ? (
                    <div className="border-t border-slate-200 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-700">When to use it</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{option.whenToUse}</p>
                      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-600">
                        {option.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">{option.note}</p>
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
            {provider.testingSteps.map((step) => (
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
              {provider.troubleshooting.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-base font-bold text-slate-900">Need help testing your forwarding setup?</h4>
          <p className="mt-1 text-sm leading-6 text-slate-600">RingBooker can help your team validate routing before go-live.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/contact"
              className="inline-flex min-h-10 items-center rounded-full bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800"
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

        {provider.verificationStatus !== 'verified_official_docs' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
            <p className="font-semibold">Verification status: {provider.verificationStatus.replaceAll('_', ' ')}</p>
            <p className="mt-1">{provider.disclaimer}</p>
          </div>
        ) : null}

        <details className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold text-slate-700">Sources & last checked area</summary>
          <ul className="mt-2 list-disc pl-4">
            {provider.sourceUrls.map((url) => (
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
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'popular' | 'voip' | 'other'>('popular');
  const [otherCountry, setOtherCountry] = useState<'UK' | 'NZ' | 'IE'>('UK');
  const [selected, setSelected] = useState<ProviderRecord | null>(null);
  const [suggestedCountry, setSuggestedCountry] = useState<'UK' | 'NZ' | 'IE' | null>(null);
  const [searchTracked, setSearchTracked] = useState(false);
  const findRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const lang = navigator.language.toLowerCase();
    if (lang.includes('en-gb')) setSuggestedCountry('UK');
    if (lang.includes('en-nz')) setSuggestedCountry('NZ');
    if (lang.includes('en-ie')) setSuggestedCountry('IE');
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      CALL_FORWARDING_PROVIDERS.filter((p) => {
        if (!q) return true;
        const haystack = [p.name, p.providerType, p.country ?? '', p.category, p.marketGroup, ...p.aliases].join(' ').toLowerCase();
        return haystack.includes(q);
      }),
    [q],
  );

  const byCountry = (country: ProviderCountry) => filtered.filter((p) => p.country === country);
  const popularVisible = filter === 'popular' || q.length > 0;
  const voipVisible = filter === 'voip' || q.length > 0;
  const otherVisible = filter === 'other' || q.length > 0;

  useEffect(() => {
    if (!selected || !detailRef.current) return;
    detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selected]);

  return (
    <main className="bg-[radial-gradient(ellipse_84%_58%_at_50%_0%,#ede9fe_0%,#ffffff_66%)] pb-28 pt-28 md:pb-16">
      <section className="mx-auto max-w-6xl px-6">
        <div className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[1.15fr_.85fr] md:p-10">
          <div>
            <p className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.09em] text-violet-700">
              Current Number Setup
            </p>
            <h1 className="mt-4 text-[clamp(34px,5vw,56px)] font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900">Call Forwarding Setup Guides</h1>
            <p className="mt-4 text-[17px] leading-8 text-slate-600">
              Keep your current salon, spa, or clinic number. Choose your country or phone provider to see how to forward missed, busy, overflow, or after-hours calls to RingBooker.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-violet-700 px-6 py-3 text-sm font-extrabold text-white hover:bg-violet-800"
                onClick={() => findRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <DemoCtaPhoneIcon width={16} height={16} />
                Find my provider
              </button>
              <a href="#how-it-works" className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-800 hover:border-violet-500 hover:text-violet-700">
                See how it works
              </a>
            </div>
            <ul className="mt-5 space-y-1 text-sm text-slate-600 md:flex md:gap-5 md:space-y-0">
              <li>Keep your current public number</li>
              <li>Forward only selected calls</li>
              <li>Test before going live</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Forwarding flow</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800">Current number</div>
              <div className="text-center text-xs text-slate-500">Missed / busy / after-hours</div>
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm font-semibold text-violet-800">RingBooker answers</div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto mt-14 max-w-6xl px-6">
        <p className="text-center text-xs font-bold uppercase tracking-[0.12em] text-slate-500">How it works</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            'Client calls your current number',
            'Your team answers if available',
            'Missed, busy, or after-hours calls forward to RingBooker',
            'RingBooker answers and sends the details',
          ].map((step, i) => (
            <article key={step} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">{i + 1}</span>
              <p className="text-[15px] leading-7 text-slate-700">{step}</p>
            </article>
          ))}
        </div>
      </section>

      <section ref={findRef} id="find-setup" className="mx-auto mt-16 max-w-6xl px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Find your setup</h2>
          <p className="mt-2 text-[15px] leading-7 text-slate-600">Search by provider, country, or phone system.</p>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!searchTracked && e.target.value.trim().length > 0) {
                track('call_forwarding_search_used');
                setSearchTracked(true);
              }
            }}
            placeholder="Search provider, country, or phone system"
            className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-violet-300 focus:border-violet-500 focus:ring-4"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setFilter('popular')} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === 'popular' ? 'bg-violet-700 text-white' : 'border border-slate-300 text-slate-700'}`}>Popular countries</button>
            <button type="button" onClick={() => setFilter('voip')} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === 'voip' ? 'bg-violet-700 text-white' : 'border border-slate-300 text-slate-700'}`}>Business phone &amp; VoIP</button>
            <button type="button" onClick={() => setFilter('other')} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === 'other' ? 'bg-violet-700 text-white' : 'border border-slate-300 text-slate-700'}`}>Other countries</button>
          </div>

          {selected ? (
            <div className="sticky top-[72px] z-20 mt-4 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 md:hidden">
              <div className="flex items-center justify-between gap-2">
                <span>{selected.name} guide selected</span>
                <button type="button" className="rounded-full border border-violet-300 px-3 py-1 text-xs" onClick={() => setSelected(null)}>
                  Back to providers
                </button>
              </div>
            </div>
          ) : null}

          {suggestedCountry ? (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                Looks like you may be in {CALL_FORWARDING_OTHER_COUNTRIES.find((c) => c.code === suggestedCountry)?.label}. View providers?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
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
            <div className="mt-8 space-y-8">
              {CALL_FORWARDING_COUNTRY_GROUPS.map((group) => {
                const items = byCountry(group.code);
                if (items.length === 0) return null;
                return (
                  <section key={group.code} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-xl font-extrabold tracking-tight text-slate-900">{group.label}</h3>
                    <p className="mt-1 text-sm text-slate-600">{group.description}</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {items.map((provider) => (
                        <ProviderCard
                          key={provider.id}
                          provider={provider}
                          active={selected?.id === provider.id}
                          onSelect={(p) => {
                            setSelected(p);
                            track('call_forwarding_provider_selected', { provider: p.id, country: p.country });
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
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-xl font-extrabold tracking-tight text-slate-900">Business phone &amp; VoIP systems</h3>
              <p className="mt-1 text-sm text-slate-600">
                Already using a virtual number or cloud phone system? Choose your provider to see how to route calls to RingBooker.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filtered
                  .filter((p) => p.marketGroup === 'business-voip')
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
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-xl font-extrabold tracking-tight text-slate-900">Choose another country</h3>
              <p className="mt-1 text-sm text-slate-600">RingBooker can support more phone providers. Choose a country to view common local providers.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CALL_FORWARDING_OTHER_COUNTRIES.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      setOtherCountry(country.code);
                      track('call_forwarding_country_selected', { country: country.code, source: 'selector' });
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${otherCountry === country.code ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-700'}`}
                  >
                    {country.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filtered
                  .filter((p) => p.marketGroup === 'other-country' && p.country === otherCountry)
                  .map((provider) => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      active={selected?.id === provider.id}
                      onSelect={(p) => {
                        setSelected(p);
                        track('call_forwarding_provider_selected', { provider: p.id, country: p.country });
                      }}
                    />
                  ))}
              </div>
            </section>
          ) : null}

          {filtered.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <p className="text-sm leading-7 text-slate-700">
                Don&apos;t see your provider? Many phone systems support call forwarding. RingBooker can help you test your setup before you go live.
              </p>
              <Link href="/contact" className="mt-3 inline-flex min-h-10 items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-black">
                Get guided setup
              </Link>
            </div>
          ) : null}

          <div ref={detailRef}>{selected ? <SetupGuidePanel provider={selected} onBack={() => setSelected(null)} isMobile /> : null}</div>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-6xl px-6">
        <MarketingFaqAccordion items={FAQ_ITEMS} embedded eyebrow="FAQ" title="Call forwarding setup questions" subtitle={null} openFirstItem />
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Cover missed calls without changing your number</h2>
          <p className="mt-2 text-[15px] leading-7 text-slate-600">
            RingBooker helps appointment-based businesses answer after-hours, busy, and unanswered calls while keeping their current public number.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/demo" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-violet-700 px-6 py-3 text-sm font-extrabold text-white hover:bg-violet-800" onClick={() => track('call_forwarding_demo_clicked', { source: 'final_cta' })}>
              <DemoCtaPhoneIcon width={16} height={16} />
              Try a live demo
            </Link>
            <Link href="/current-number" className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-800 hover:border-violet-500 hover:text-violet-700">
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
          <Link href="/demo" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-violet-700 px-4 text-sm font-bold text-white" onClick={() => track('call_forwarding_demo_clicked', { source: 'sticky_mobile' })}>
            Try demo
          </Link>
        </div>
      </div>
    </main>
  );
}
