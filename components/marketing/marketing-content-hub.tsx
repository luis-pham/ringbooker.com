import Image from 'next/image';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';

import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';
import { HtmlHubFaq } from '@/components/marketing/html-hub-faq';
import { HTML_HUB_SCOPED_CSS } from '@/components/marketing/html-hub-scoped-css';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { siteConfig } from '@/lib/site';

export type ContentHubSection = {
  heading: string;
  content: string[];
};

export type ContentHubIndustryCard = {
  emoji: string;
  title: string;
  body: string;
  href: string;
};

export type ContentHubResourceLink = {
  href: string;
  label: string;
};

export type ContentHubFaq = { q: string; a: string };

/** `compare_table_matrix` — matches static `html/compare.html` check / cross / partial cells */
export type CompareMatrixCell = { tone: 'check' | 'cross' | 'partial'; label: string };

export type ContentHubVariant =
  | 'purple'
  | 'green'
  | 'blue'
  | 'amber'
  | 'teal'
  | 'hair'
  | 'medSpa'
  | 'beautyClinic'
  | 'trust';

/** Optional layout/copy metadata so React hubs match static `html/*.html` section wrappers. */
export type HubBlockHtmlMeta = {
  section?: 'default' | 'alt' | 'dark' | 'purple-soft' | 'green-soft' | 'blue-soft' | 'leak';
  eyebrow?: string;
  eyebrowTone?: 'purple' | 'green' | 'dark' | 'amber' | 'blue';
  /** `feature_scenarios` only — principles list (trust) vs scenario cards vs use-case list (current number). */
  featureLayout?: 'scenarios' | 'principles' | 'use_cases';
  /** `pillar_cards` — pillar grid (trust) vs purple top-border cards (current number). */
  pillarStyle?: 'pillar' | 'purple-grid';
  /** `card_grid` — top border accent */
  cardAccent?: 'purple' | 'green';
  /** `card_grid` — cards match marketing-home Missed-Call Recovery (`.leak-card`) */
  cardGridStyle?: 'default' | 'leak';
  /** `card_grid` + `leak` — `4` = one row on wide screens */
  leakGridColumns?: 3 | 4;
  /** `feature_scenarios` (scenario cards) — two columns × two rows on wide screens */
  scenarioGrid2x2?: boolean;
  /** `step_track` — four step cards in a centered row (wide screens) */
  stepsCentered4?: boolean;
  /** `card_grid` + `leak` — optional label above first row of cards */
  aboveCardsEyebrow?: string;
  /** `card_grid` + `leak` — label between first and second row (e.g. after `midCardSplit` cards) */
  betweenRowsEyebrow?: string;
  /** Split index for `betweenRowsEyebrow` (default 3) */
  midCardSplit?: number;
  /** `leak` card grid, `alt_link_grid`, `situation_grid` — force 3 columns on wide viewports (2 → 1 on smaller) */
  hubGridCols3?: boolean;
  /** `compare_strip` — four cards in one row on wide screens (2 → 1 on smaller) */
  compareStripGridCols4?: boolean;
};

/** Rich sections aligned with legacy HTML hub templates (cards, grids, flows). */
type ContentHubBlockCore =
  | {
      kind: 'card_grid';
      heading: string;
      /** Plain definition under the heading (visible, not accordion) — e.g. for entity / AI citation. */
      definition?: string;
      sub?: string;
      cards: { icon: string; title: string; body: string; /** Optional data point / citation line above body */ stat?: string }[];
    }
  | {
      kind: 'scenario_grid';
      heading: string;
      sub?: string;
      items: {
        icon: string;
        title: string;
        body: string;
        tag?: string;
        /** Optional cited data line (shown under title, above body). */
        stat?: string;
      }[];
    }
  | {
      kind: 'intent_stats';
      heading: string;
      sub?: string;
      intents: { emoji: string; label: string }[];
      stats: { value: string; label: string }[];
    }
  | {
      kind: 'compare_strip';
      heading: string;
      sub?: string;
      cards: { icon: string; title: string; body: string }[];
      footerLink?: { href: string; label: string };
    }
  | {
      kind: 'alt_link_grid';
      heading: string;
      sub?: string;
      links: { href: string; title: string; body: string }[];
    }
  | {
      kind: 'feature_scenarios';
      heading: string;
      sub?: string;
      items: { icon: string; title: string; body: string; link?: { href: string; label: string } }[];
    }
  | {
      kind: 'flow';
      heading: string;
      sub?: string;
      steps: {
        icon?: string;
        /** Raster/SVG under `/public` — shown instead of `icon` when set (e.g. RingBooker logo). */
        iconSrc?: string;
        label: string;
        line: string;
        badge?: string;
        badgeStyle?: 'green' | 'purple';
      }[];
    }
  | {
      kind: 'objections';
      heading: string;
      sub?: string;
      items: { q: string; a: string }[];
    }
  | {
      kind: 'pillar_cards';
      heading: string;
      sub?: string;
      cards: { icon: string; title: string; body: string }[];
    }
  | {
      kind: 'tool_strip';
      heading: string;
      sub?: string;
      /** `logoSrc` = real asset under `/public` (same as industry vertical heroes). `logo` = emoji fallback. */
      tools: {
        href: string;
        title: string;
        body: string;
        status: string;
        statusKind?: 'live' | 'workflow' | 'soon';
        logoSrc?: string;
        logo?: string;
      }[];
    }
  | {
      kind: 'step_track';
      heading: string;
      sub?: string;
      steps: { title: string; body: string }[];
    }
  | {
      kind: 'compare_table_matrix';
      heading: string;
      sub?: string;
      /** First column = criterion; remaining = one header each (last column is RingBooker). */
      headers: string[];
      rows: { criterion: string; cells: CompareMatrixCell[] }[];
      /** Optional footnotes shown under the table. */
      footnotes?: string[];
    }
  | {
      kind: 'split_expectations';
      heading: string;
      sub?: string;
      left: { title: string; items: string[] };
      right: { title: string; items: string[] };
    }
  | {
      kind: 'situation_grid';
      heading: string;
      sub?: string;
      items: { prefix: string; title: string; body: string; cta: { href: string; label: string } }[];
    };

export type ContentHubBlock = ContentHubBlockCore & { html?: HubBlockHtmlMeta };

export type MarketingContentHubProps = {
  variant?: ContentHubVariant;
  badge: string;
  title: ReactNode;
  intro: string;
  /** Visible plain text under intro — entity / how-it-works (optional). */
  heroEntityDefinition?: string;
  pills?: string[];
  /** Optional hero CTAs (e.g. demo + how-it-works) */
  heroActions?: ReactNode;
  sections: ContentHubSection[];
  /** Visual blocks (cards, grids, flows) — rendered after text sections, before industry cards. */
  hubBlocks?: ContentHubBlock[];
  industryHeading?: string;
  industrySub?: string;
  industryCards?: ContentHubIndustryCard[];
  resourceHeading?: string;
  resourceSub?: string;
  resourceLinks?: ContentHubResourceLink[];
  faqs: ContentHubFaq[];
  cta?: {
    title: string;
    subtitle: string;
    primary: { href: string; label: string };
    secondary?: { href: string; label: string };
  };
  articleJsonLd?: Record<string, unknown>;
  /** Breadcrumb: label for current page (home is implied) */
  breadcrumbLabel?: string;
  /** FAQ strip label (static HTML `section-label`) */
  faqEyebrow?: string | null;
  /** FAQ main heading */
  faqTitle?: ReactNode;
  /** FAQ accent color for + icon */
  faqAccent?: 'purple' | 'green';
  /** Extra section classes on FAQ wrapper (e.g. `section-alt` on current-number HTML) */
  faqSectionClass?: string;
  industryEyebrow?: string;
  resourceEyebrow?: string;
  /** `landing` = same hero shell as marketing home (blobs, `hero-h` + `.hl`, `hero-btns`). */
  heroLayout?: 'hub' | 'landing';
  /** Extra classes on `<main>` (e.g. `hub-compare-index` for /compare grid locks). */
  mainExtraClassName?: string;
  /**
   * Emits WebPage + BreadcrumbList JSON-LD (`path` must match `buildMetadata` canonical).
   * Use the same `description` as the page meta description for consistency.
   */
  seoHub?: {
    path: string;
    webPageName: string;
    description: string;
  };
};

/** Default primary/secondary CTAs — class names match static hub HTML (`btn`, `btn-purple`, `btn-lg`). */
export function ContentHubHeroActionsDefault() {
  return (
    <>
      <Link href="/demo" className="btn btn-purple btn-lg">
        Try a live demo
      </Link>
      <Link href="/how-it-works" className="btn btn-outline btn-lg">
        How it works
      </Link>
    </>
  );
}

/** Same CTA targets as default; classes match marketing home hero (`btn-hero-live`, `btn-outline`). */
export function ContentHubHeroActionsHomeStyle() {
  return (
    <>
      <Link href="/demo" className="btn-hero-live" data-demo-picker>
        <DemoCtaPhoneIcon className="btn-hero-live-phone" width={18} height={18} />
        Try a live demo
        <svg className="btn-hero-live-arrow" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
        </svg>
      </Link>
      <Link href="/how-it-works" className="btn-outline btn-hero-trial">
        How it works
      </Link>
    </>
  );
}

function CompareMatrixCellView({ cell }: { cell: CompareMatrixCell }) {
  const cls = cell.tone === 'check' ? 'check' : cell.tone === 'cross' ? 'cross' : 'partial';
  const sym = cell.tone === 'check' ? '✓' : cell.tone === 'cross' ? '✗' : '◐';
  return (
    <>
      <span className={cls} aria-hidden>
        {sym}
      </span>{' '}
      {cell.label}
    </>
  );
}

function defaultSectionForKind(kind: ContentHubBlockCore['kind']): NonNullable<HubBlockHtmlMeta['section']> {
  switch (kind) {
    case 'compare_table_matrix':
    case 'scenario_grid':
    case 'tool_strip':
      return 'alt';
    case 'alt_link_grid':
      return 'default';
    case 'compare_strip':
      return 'dark';
    case 'feature_scenarios':
    case 'split_expectations':
      return 'purple-soft';
    default:
      return 'default';
  }
}

function sectionOuterClass(html: HubBlockHtmlMeta | undefined, kind: ContentHubBlockCore['kind']): string {
  const mode =
    html?.section ??
    (kind === 'card_grid' && html?.cardGridStyle === 'leak' ? 'leak' : defaultSectionForKind(kind));
  const map: Record<string, string> = {
    default: 'section',
    alt: 'section section-alt',
    dark: 'section section-dark',
    'purple-soft': 'section section-purple-soft',
    'green-soft': 'section section-green-soft',
    'blue-soft': 'section section-blue-soft',
    leak: 'section section-leak',
  };
  return map[mode] ?? 'section';
}

function HubEyebrow({ html }: { html?: HubBlockHtmlMeta }) {
  if (!html?.eyebrow) return null;
  const tone = html.eyebrowTone ?? 'purple';
  const cls =
    tone === 'green'
      ? 'section-label green'
      : tone === 'dark'
        ? 'section-label dark'
        : tone === 'amber'
          ? 'section-label amber'
          : tone === 'blue'
            ? 'section-label blue'
            : 'section-label';
  return <div className={cls}>{html.eyebrow}</div>;
}

function HubBlocksRenderer({ blocks }: { blocks: ContentHubBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        const key = `${block.kind}-${i}`;
        const shell = (inner: ReactNode) => (
          <section className={sectionOuterClass(block.html, block.kind)} key={key}>
            <div className="section-inner">{inner}</div>
          </section>
        );

        switch (block.kind) {
          case 'card_grid': {
            const cardClass =
              block.html?.cardAccent === 'green' ? 'card card-green' : 'card card-accent';
            if (block.html?.cardGridStyle === 'leak') {
              const useCols4 =
                block.html?.leakGridColumns === 4 && !block.html?.hubGridCols3;
              const leakGridClass =
                (useCols4 ? 'leak-grid leak-grid--cols-4' : 'leak-grid') +
                (block.html?.hubGridCols3 ? ' hub-grid-cols-3 hub-compare-3up' : '');
              const split = block.html?.midCardSplit ?? 3;
              const betweenEyebrow = block.html?.betweenRowsEyebrow;
              const aboveEyebrow = block.html?.aboveCardsEyebrow;
              const cards = block.cards;
              const useSplit =
                Boolean(betweenEyebrow) && split > 0 && split < cards.length;
              const firstCards = useSplit ? cards.slice(0, split) : cards;
              const restCards = useSplit ? cards.slice(split) : [];

              const leakGrid = (items: typeof cards) => (
                <div className={leakGridClass}>
                  {items.map((c) => (
                    <article className="leak-card" key={c.title}>
                      <div className="leak-icon" aria-hidden>
                        {c.icon}
                      </div>
                      <h3>{c.title}</h3>
                      {c.stat ? <p className="leak-card-stat">{c.stat}</p> : null}
                      <p>{c.body}</p>
                    </article>
                  ))}
                </div>
              );

              return shell(
                <>
                  <HubEyebrow html={block.html} />
                  <h2>{block.heading}</h2>
                  {block.definition ? (
                    <p className="section-sub hub-entity-definition">{block.definition}</p>
                  ) : null}
                  {block.sub ? <p className="section-sub">{block.sub}</p> : null}
                  {aboveEyebrow ? (
                    <div className="section-label section-label--between-rows">{aboveEyebrow}</div>
                  ) : null}
                  {leakGrid(firstCards)}
                  {betweenEyebrow && restCards.length > 0 ? (
                    <div className="section-label section-label--between-rows">{betweenEyebrow}</div>
                  ) : null}
                  {restCards.length > 0 ? leakGrid(restCards) : null}
                </>,
              );
            }
            return shell(
              <>
                <HubEyebrow html={block.html} />
                <h2>{block.heading}</h2>
                {block.definition ? (
                  <p className="section-sub hub-entity-definition">{block.definition}</p>
                ) : null}
                {block.sub ? <p className="section-sub">{block.sub}</p> : null}
                <div className="card-grid">
                  {block.cards.map((c) => (
                    <div className={cardClass} key={c.title}>
                      <div className="card-icon" aria-hidden>
                        {c.icon}
                      </div>
                      <h3>{c.title}</h3>
                      {c.stat ? <p className="card-stat">{c.stat}</p> : null}
                      <p>{c.body}</p>
                    </div>
                  ))}
                </div>
              </>,
            );
          }
          case 'scenario_grid':
            return shell(
              <>
                <HubEyebrow html={block.html} />
                <h2>{block.heading}</h2>
                {block.sub ? <p className="section-sub">{block.sub}</p> : null}
                <div className="scenario-grid">
                  {block.items.map((s) => (
                    <div className="scenario" key={s.title}>
                      <div className="scenario-icon" aria-hidden>
                        {s.icon}
                      </div>
                      <div>
                        <h3>{s.title}</h3>
                        {s.stat ? <p className="scenario-stat">{s.stat}</p> : null}
                        <p>{s.body}</p>
                        {s.tag ? <div className="who">{s.tag}</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </>,
            );
          case 'intent_stats':
            return shell(
              <>
                <HubEyebrow html={block.html} />
                <h2>{block.heading}</h2>
                {block.sub ? <p className="section-sub">{block.sub}</p> : null}
                <div className="intent-grid">
                  {block.intents.map((x) => (
                    <div className="intent-item" key={x.label}>
                      <span aria-hidden>{x.emoji}</span> {x.label}
                    </div>
                  ))}
                </div>
                <div className="stat-row">
                  {block.stats.map((s) => (
                    <div className="stat" key={s.label}>
                      <div className="stat-num">{s.value}</div>
                      <div className="stat-label">{s.label}</div>
                    </div>
                  ))}
                </div>
              </>,
            );
          case 'compare_strip':
            return shell(
              <div className="hub-center-stack">
                <HubEyebrow html={block.html} />
                <h2>{block.heading}</h2>
                {block.sub ? <p className="section-sub">{block.sub}</p> : null}
                <div
                  className={`card-grid${block.html?.compareStripGridCols4 ? ' card-grid--cols-4' : ''}`}
                >
                  {block.cards.map((c) => (
                    <div className="card" key={c.title}>
                      <div className="card-icon" aria-hidden>
                        {c.icon}
                      </div>
                      <h3>{c.title}</h3>
                      <p>{c.body}</p>
                    </div>
                  ))}
                </div>
                {block.footerLink ? (
                  <div style={{ marginTop: 36, textAlign: 'center' }}>
                    <Link href={block.footerLink.href} className="btn btn-purple btn-lg">
                      {block.footerLink.label}
                    </Link>
                  </div>
                ) : null}
              </div>,
            );
          case 'alt_link_grid':
            return shell(
              <div className="hub-center-stack">
                <HubEyebrow html={block.html} />
                <h2>{block.heading}</h2>
                {block.sub ? <p className="section-sub section-sub--alt-link-grid">{block.sub}</p> : null}
                <div
                  className={`alt-link-grid${block.html?.hubGridCols3 ? ' hub-grid-cols-3 hub-compare-3up' : ''}`}
                >
                  {block.links.map((l) => (
                    <Link href={l.href} className="alt-link-card" key={l.href}>
                      <h4>
                        {l.title} <span>Read Guide →</span>
                      </h4>
                      <p>{l.body}</p>
                    </Link>
                  ))}
                </div>
              </div>,
            );
          case 'feature_scenarios': {
            const layout = block.html?.featureLayout ?? 'scenarios';
            if (layout === 'principles') {
              return shell(
                <>
                  <HubEyebrow html={block.html} />
                  <h2>{block.heading}</h2>
                  {block.sub ? <p className="section-sub">{block.sub}</p> : null}
                  <div className="principles">
                    {block.items.map((s) => (
                      <div className="principle" key={s.title}>
                        <div className="p-icon" aria-hidden>
                          {s.icon}
                        </div>
                        <div>
                          <h4>{s.title}</h4>
                          <p>
                            {s.body}
                            {s.link ? (
                              <>
                                {' '}
                                <Link href={s.link.href}>{s.link.label}</Link>
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>,
              );
            }
            if (layout === 'use_cases') {
              return shell(
                <>
                  <HubEyebrow html={block.html} />
                  <h2>{block.heading}</h2>
                  {block.sub ? <p className="section-sub">{block.sub}</p> : null}
                  <div className="use-case-list">
                    {block.items.map((s) => (
                      <div className="use-case" key={s.title}>
                        <div className="uc-icon" aria-hidden>
                          {s.icon}
                        </div>
                        <div>
                          <h4>{s.title}</h4>
                          <p>
                            {s.body}
                            {s.link ? (
                              <>
                                {' '}
                                <Link href={s.link.href}>{s.link.label}</Link>
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>,
              );
            }
            const scenarioGridClass =
              block.html?.scenarioGrid2x2 === true ? 'scenario-grid scenario-grid--2x2' : 'scenario-grid';
            return shell(
              <>
                <HubEyebrow html={block.html} />
                <h2>{block.heading}</h2>
                {block.sub ? <p className="section-sub">{block.sub}</p> : null}
                <div className={scenarioGridClass}>
                  {block.items.map((s) => (
                    <div className="scenario" key={s.title}>
                      <div className="scenario-icon" aria-hidden>
                        {s.icon}
                      </div>
                      <div>
                        <h3>{s.title}</h3>
                        <p>
                          {s.body}
                          {s.link ? (
                            <>
                              {' '}
                              <Link href={s.link.href}>{s.link.label}</Link>
                            </>
                          ) : null}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>,
            );
          }
          case 'flow':
            return shell(
              <>
                <HubEyebrow html={block.html} />
                <h2>{block.heading}</h2>
                {block.sub ? <p className="section-sub">{block.sub}</p> : null}
                <div className="flow-visual">
                  {block.steps.map((s, j) => (
                    <Fragment key={s.label}>
                      <div className="flow-step">
                        <div className="icon" aria-hidden>
                          {s.iconSrc ? (
                            <Image
                              src={s.iconSrc}
                              alt={`${s.label} — step icon`}
                              width={40}
                              height={40}
                              className="flow-step-logo-img"
                            />
                          ) : (
                            s.icon
                          )}
                        </div>
                        <div className="label">{s.label}</div>
                        <div className="sub">{s.line}</div>
                        {s.badge ? (
                          <span
                            className={`flow-badge ${s.badgeStyle === 'purple' ? 'badge-purple' : 'badge-green'}`}
                          >
                            {s.badge}
                          </span>
                        ) : null}
                      </div>
                      {j < block.steps.length - 1 ? (
                        <div className="flow-arrow" aria-hidden>
                          <svg viewBox="0 0 16 16" width={12} height={12}>
                            <path
                              d="M3 8h9M8.5 3.5 13 8l-4.5 4.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      ) : null}
                    </Fragment>
                  ))}
                </div>
              </>,
            );
          case 'objections':
            return shell(
              <>
                <HubEyebrow html={block.html} />
                <h2>{block.heading}</h2>
                {block.sub ? <p className="section-sub">{block.sub}</p> : null}
                <div className="objection-grid">
                  {block.items.map((o) => (
                    <div className="objection" key={o.q}>
                      <div className="q">{o.q}</div>
                      <p className="a">{o.a}</p>
                    </div>
                  ))}
                </div>
              </>,
            );
          case 'pillar_cards': {
            const ps = block.html?.pillarStyle ?? 'pillar';
            if (ps === 'purple-grid') {
              return shell(
                <>
                  <HubEyebrow html={block.html} />
                  <h2>{block.heading}</h2>
                  {block.sub ? <p className="section-sub">{block.sub}</p> : null}
                  <div className="card-grid">
                    {block.cards.map((c) => (
                      <div className="card card-purple" key={c.title}>
                        <div className="card-icon" aria-hidden>
                          {c.icon}
                        </div>
                        <h3>{c.title}</h3>
                        <p>{c.body}</p>
                      </div>
                    ))}
                  </div>
                </>,
              );
            }
            return shell(
              <>
                <HubEyebrow html={block.html} />
                <h2>{block.heading}</h2>
                {block.sub ? <p className="section-sub">{block.sub}</p> : null}
                <div className="pillar-grid">
                  {block.cards.map((c) => (
                    <div className="pillar" key={c.title}>
                      <div className="pillar-icon" aria-hidden>
                        {c.icon}
                      </div>
                      <h3>{c.title}</h3>
                      <p>{c.body}</p>
                    </div>
                  ))}
                </div>
              </>,
            );
          }
          case 'tool_strip':
            return shell(
              <>
                <HubEyebrow html={block.html} />
                <h2>{block.heading}</h2>
                {block.sub ? <p className="section-sub">{block.sub}</p> : null}
                <div className="tool-grid">
                  {block.tools.map((t) => (
                    <Link href={t.href} className="tool-card" key={t.href}>
                      <span className="tool-arrow" aria-hidden>
                        <svg viewBox="0 0 16 16" width={12} height={12}>
                          <path
                            d="M3 8h9M8.5 3.5 13 8l-4.5 4.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <div className="tool-logo">
                        {t.logoSrc ? (
                          <Image
                            src={t.logoSrc}
                            alt={`${t.title} logo`}
                            width={40}
                            height={40}
                            className="h-10 w-10 object-contain"
                          />
                        ) : (
                          t.logo
                        )}
                      </div>
                      <h3>{t.title}</h3>
                      <p>{t.body}</p>
                      <span
                        className={
                          t.statusKind === 'live'
                            ? 'status-badge status-live'
                            : t.statusKind === 'soon'
                              ? 'status-badge status-soon'
                              : 'status-badge status-workflow'
                        }
                      >
                        {t.status}
                      </span>
                    </Link>
                  ))}
                </div>
              </>,
            );
          case 'step_track':
            return shell(
              <>
                <HubEyebrow html={block.html} />
                <h2>{block.heading}</h2>
                {block.sub ? <p className="section-sub">{block.sub}</p> : null}
                <div className="step-track-mobile-nav" role="tablist" aria-label={`${block.heading} steps`}>
                  {block.steps.map((s, idx) => (
                    <a
                      key={`${s.title}-nav`}
                      href={`#hub-step-${i}-${idx + 1}`}
                      className={`step-track-mobile-nav-btn${idx === 0 ? ' is-active' : ''}`}
                      data-step-nav-btn
                    >
                      Step {idx + 1}
                    </a>
                  ))}
                </div>
                <div
                  className={
                    block.html?.stepsCentered4 ? 'steps steps--centered-4' : 'steps'
                  }
                  data-step-scroller
                >
                  {block.steps.map((s, idx) => (
                    <div className="step" key={s.title} id={`hub-step-${i}-${idx + 1}`} data-step-card>
                      <h4>{s.title}</h4>
                      <p>{s.body}</p>
                    </div>
                  ))}
                </div>
              </>,
            );
          case 'compare_table_matrix':
            return shell(
              <div className="compare-matrix-block hub-center-stack">
                <HubEyebrow html={block.html} />
                <h2>{block.heading}</h2>
                {block.sub ? (
                  <p className="section-sub section-sub--compare-matrix">{block.sub}</p>
                ) : null}
                <div className="compare-table-wrap">
                  <table className="compare-table">
                    <thead>
                      <tr>
                        {block.headers.map((h, hi) => (
                          <th key={h} className={hi === block.headers.length - 1 ? 'rb-col' : undefined}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row) => (
                        <tr key={row.criterion}>
                          <td>{row.criterion}</td>
                          {row.cells.map((cell, ci) => (
                            <td key={ci} className={ci === row.cells.length - 1 ? 'td-rb' : undefined}>
                              <CompareMatrixCellView cell={cell} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {block.footnotes && block.footnotes.length > 0 ? (
                  <div className="compare-matrix-footnotes" aria-label="Comparison notes">
                    {block.footnotes.map((note, idx) => (
                      <p key={`${idx}-${note.slice(0, 24)}`}>{note}</p>
                    ))}
                  </div>
                ) : null}
              </div>,
            );
          case 'split_expectations':
            return shell(
              <>
                <HubEyebrow html={block.html} />
                <h2>{block.heading}</h2>
                {block.sub ? <p className="section-sub">{block.sub}</p> : null}
                <div className="expect-split-grid">
                  <div className="expect-split-card expect-split-card--good">
                    <div className="expect-split-head expect-split-head--good">{block.left.title}</div>
                    <ul>
                      {block.left.items.map((line) => (
                        <li key={line}>
                          <span aria-hidden>✓</span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="expect-split-card expect-split-card--team">
                    <div className="expect-split-head expect-split-head--team">{block.right.title}</div>
                    <ul>
                      {block.right.items.map((line) => (
                        <li key={line}>
                          <span aria-hidden>
                            <svg viewBox="0 0 16 16" width={12} height={12}>
                              <path
                                d="M3 8h9M8.5 3.5 13 8l-4.5 4.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>,
            );
          case 'situation_grid':
            return shell(
              <>
                <HubEyebrow html={block.html} />
                <h2>{block.heading}</h2>
                {block.sub ? <p className="section-sub">{block.sub}</p> : null}
                <div
                  className={`situation-grid${block.html?.hubGridCols3 ? ' hub-grid-cols-3 hub-compare-3up' : ''}`}
                >
                  {block.items.map((s) => (
                    <div className="situation" key={s.title}>
                      <div className="if">{s.prefix}</div>
                      <h4>{s.title}</h4>
                      <p>{s.body}</p>
                      <div className="go">
                        <Link href={s.cta.href}>{s.cta.label}</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </>,
            );
          default:
            return null;
        }
      })}
    </>
  );
}

function htmlHubPageClass(variant: ContentHubVariant, heroLayout: 'hub' | 'landing' = 'hub'): string {
  const base =
    variant === 'green'
      ? 'html-hub-page html-hub-page--green'
      : variant === 'blue'
        ? 'html-hub-page html-hub-page--blue'
        : variant === 'amber'
          ? 'html-hub-page html-hub-page--amber'
          : variant === 'teal'
            ? 'html-hub-page html-hub-page--teal'
            : variant === 'hair'
              ? 'html-hub-page html-hub-page--hair'
              : variant === 'medSpa'
                ? 'html-hub-page html-hub-page--med-spa'
                : variant === 'beautyClinic'
                  ? 'html-hub-page html-hub-page--beauty-clinic'
                  : variant === 'trust'
                    ? 'html-hub-page html-hub-page--trust'
                    : 'html-hub-page html-hub-page--purple';
  return heroLayout === 'landing' ? `${base} html-hub-page--landing-width` : base;
}

function HubBreadcrumb({ label }: { label: string }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <Link href="/">Home</Link>
      <span>›</span>
      <span>{label}</span>
    </nav>
  );
}

export function MarketingContentHub({
  variant = 'purple',
  badge,
  title,
  intro,
  heroEntityDefinition,
  pills = [],
  heroActions,
  sections,
  hubBlocks = [],
  industryHeading,
  industrySub,
  industryCards,
  industryEyebrow,
  resourceHeading,
  resourceSub,
  resourceLinks,
  resourceEyebrow,
  faqs,
  faqEyebrow,
  faqTitle = 'Frequently Asked Questions',
  faqAccent,
  faqSectionClass = '',
  cta,
  articleJsonLd,
  breadcrumbLabel,
  heroLayout = 'hub',
  mainExtraClassName,
  seoHub,
}: MarketingContentHubProps) {
  const faqAccentResolved = faqAccent ?? (variant === 'green' || variant === 'teal' ? 'green' : 'purple');

  const faqMainEntity = faqs.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.a,
    },
  }));

  const hubSeoJsonLd =
    seoHub != null
      ? (() => {
          const base = siteConfig.url.replace(/\/$/, '');
          const path = seoHub.path.startsWith('/') ? seoHub.path : `/${seoHub.path}`;
          const pageUrl = `${base}${path}`;
          const graph: Record<string, unknown>[] = [
            {
              '@type': 'WebPage',
              '@id': `${pageUrl}#webpage`,
              url: pageUrl,
              name: seoHub.webPageName,
              description: seoHub.description,
              isPartOf: {
                '@type': 'WebSite',
                name: siteConfig.name,
                url: `${base}/`,
              },
            },
          ];
          if (breadcrumbLabel) {
            graph.push({
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'Home',
                  item: `${base}/`,
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: breadcrumbLabel,
                  item: pageUrl,
                },
              ],
            });
          }
          if (faqs.length > 0) {
            graph.push({
              '@type': 'FAQPage',
              '@id': `${pageUrl}#faqpage`,
              isPartOf: { '@id': `${pageUrl}#webpage` },
              mainEntity: faqMainEntity,
            });
          }
          return {
            '@context': 'https://schema.org',
            '@graph': graph,
          };
        })()
      : null;

  /** Standalone FAQPage only when there is no `seoHub` graph (hubs merge FAQ into `hubSeoJsonLd`). */
  const faqJsonLd =
    faqs.length > 0 && seoHub == null
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqMainEntity,
        }
      : null;

  return (
    <>
      <MarketingChromeStyles />
      <MarketingHeader />
      <main
        className={[htmlHubPageClass(variant, heroLayout), mainExtraClassName].filter(Boolean).join(' ')}
      >
        {heroLayout === 'landing' ? (
          <header className="hero hero--landing">
            <div className="hero-blob hero-blob-1" aria-hidden />
            <div className="hero-blob hero-blob-2" aria-hidden />
            <div className="hero-landing-shell">
              {breadcrumbLabel ? <HubBreadcrumb label={breadcrumbLabel} /> : null}
              <div className="hero-inner">
                <div className="pill-badge">{badge}</div>
                <h1 className="hero-h">{title}</h1>
                <p className="hero-sub">{intro}</p>
                {heroEntityDefinition ? (
                  <p className="hero-entity-definition">{heroEntityDefinition}</p>
                ) : null}
                {heroActions ? <div className="hero-btns">{heroActions}</div> : null}
                {pills.length > 0 ? (
                  <div className="hero-tags">
                    {pills.map((p) => (
                      <span className="hero-tag" key={p}>
                        {p}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </header>
        ) : (
          <header className="hero">
            <div className="hero-inner">
              {breadcrumbLabel ? <HubBreadcrumb label={breadcrumbLabel} /> : null}
              <div className="pill-badge">{badge}</div>
              <h1>{title}</h1>
              <p className="hero-sub">{intro}</p>
              {heroEntityDefinition ? (
                <p className="hero-entity-definition">{heroEntityDefinition}</p>
              ) : null}
              {heroActions ? <div className="hero-ctas">{heroActions}</div> : null}
              {pills.length > 0 ? (
                <div className="hero-tags">
                  {pills.map((p) => (
                    <span className="hero-tag" key={p}>
                      {p}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </header>
        )}

        {sections.map((section) => (
          <section className="section" key={section.heading}>
            <div className="section-inner hub-prose-section">
              <h2>{section.heading}</h2>
              {section.content.map((paragraph) => (
                <p key={paragraph.slice(0, 48)}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}

        {hubBlocks.length > 0 ? <HubBlocksRenderer blocks={hubBlocks} /> : null}

        {industryCards && industryCards.length > 0 ? (
          <section className="section">
            <div className="section-inner">
              {industryEyebrow ? <div className="section-label">{industryEyebrow}</div> : null}
              {industryHeading ? <h2>{industryHeading}</h2> : null}
              {industrySub ? <p className="section-sub">{industrySub}</p> : null}
              <div className="industry-grid">
                {industryCards.map((c) => (
                  <Link key={c.href} href={c.href} className="industry-card">
                    <div className="emoji" aria-hidden>
                      {c.emoji}
                    </div>
                    <h3>{c.title}</h3>
                    <p>{c.body}</p>
                    <span className="arrow">Explore →</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {resourceLinks && resourceLinks.length > 0 ? (
          <section className="section section-alt">
            <div className="section-inner">
              {resourceEyebrow ? <div className="section-label">{resourceEyebrow}</div> : null}
              {resourceHeading ? <h2>{resourceHeading}</h2> : null}
              {resourceSub ? <p className="section-sub">{resourceSub}</p> : null}
              <div className="article-list">
                {resourceLinks.map((l) => (
                  <Link key={l.href} href={l.href} className="article-link">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {faqs.length > 0 ? (
          <section className={`section ${faqSectionClass}`.trim()}>
            <div className="section-inner section-inner--narrow">
              {faqEyebrow !== null ? (
                <div className="section-label">
                  {faqEyebrow === undefined || faqEyebrow === '' ? 'Common Questions' : faqEyebrow}
                </div>
              ) : null}
              <h2>{faqTitle}</h2>
              <HtmlHubFaq items={faqs} accent={faqAccentResolved} />
            </div>
          </section>
        ) : null}

        {cta ? (
          heroLayout === 'landing' ? (
            <div className="hub-cta-outer">
              <div className="hub-cta-inner">
                <div className="hub-cta-banner">
                  <div className="hub-cta-text">
                    <h2>{cta.title}</h2>
                    <p>{cta.subtitle}</p>
                  </div>
                  <div className="hub-cta-actions">
                    <Link
                      href={cta.primary.href}
                      className="hub-cta-btn-white"
                      {...(cta.primary.href.startsWith('/demo') ? { 'data-demo-picker': true } : {})}
                    >
                      {cta.primary.href.startsWith('/demo') ? (
                        <DemoCtaPhoneIcon width={16} height={16} />
                      ) : (
                        <svg className="hub-cta-btn-white-arrow" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                          <path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                        </svg>
                      )}
                      {cta.primary.href.startsWith('/demo')
                        ? cta.primary.label.replace(/\s*→\s*$/, '').trim()
                        : cta.primary.label}
                    </Link>
                    {cta.secondary ? (
                      <Link href={cta.secondary.href} className="hub-cta-btn-ghost">
                        {cta.secondary.label}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="cta-band">
              <div className="cta-inner">
                <h2>{cta.title}</h2>
                <p>{cta.subtitle}</p>
                <div className="cta-group">
                  <Link href={cta.primary.href} className="btn btn-purple btn-lg">
                    {cta.primary.label}
                  </Link>
                  {cta.secondary ? (
                    <Link href={cta.secondary.href} className="btn btn-outline-light btn-lg">
                      {cta.secondary.label}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          )
        ) : null}

        <nav className="html-hub-topic-nav" aria-label="Related topic hubs">
          <div className="html-hub-topic-nav-inner">
            <p className="html-hub-topic-nav-eyebrow">Explore related hubs</p>
            <ul className="html-hub-topic-nav-list" role="list">
              <li>
                <Link href="/missed-booking-protection">Missed Booking Protection</Link>
              </li>
              <li>
                <Link href="/current-number">Current Number</Link>
              </li>
              <li>
                <Link href="/works-with">Works With</Link>
              </li>
              <li>
                <Link href="/compare">Compare</Link>
              </li>
              <li>
                <Link href="/trust">Trust &amp; Reliability</Link>
              </li>
            </ul>
          </div>
        </nav>
      </main>
      <MarketingFooter />
      {hubSeoJsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(hubSeoJsonLd) }} />
      ) : null}
      {articleJsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      ) : null}
      {faqJsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      ) : null}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(() => {
  const wrappers = document.querySelectorAll('.step-track-mobile-nav');
  wrappers.forEach((nav) => {
    const root = nav.parentElement;
    if (!root) return;
    const buttons = Array.from(nav.querySelectorAll('[data-step-nav-btn]'));
    const scroller = root.querySelector('[data-step-scroller]');
    const cards = scroller ? Array.from(scroller.querySelectorAll('[data-step-card]')) : [];
    if (!scroller || buttons.length === 0 || cards.length === 0) return;

    const setActive = (idx) => {
      buttons.forEach((btn, i) => btn.classList.toggle('is-active', i === idx));
    };

    const updateActiveByScroll = () => {
      const centerX = scroller.scrollLeft + scroller.clientWidth / 2;
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      cards.forEach((card, i) => {
        const cardCenter = card.offsetLeft + card.clientWidth / 2;
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
    updateActiveByScroll();
  });
})();
`,
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: HTML_HUB_SCOPED_CSS }} />
    </>
  );
}
