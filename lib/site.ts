import type { Metadata } from 'next';
import { generateCanonical } from '@/lib/seo';

/** Short tagline under the RingBooker logo in marketing footers (`MarketingFooter`). */
export const marketingFooterTagline =
  'AI receptionist and call recovery for nail salons, hair salons, spas, med spas, and beauty clinics — after-hours, peak-hour overflow, and missed-call follow-up on your current number.';

export const siteConfig = {
  name: 'RingBooker',
  url: 'https://ringbooker.com',
  description:
    'RingBooker is an AI receptionist for salons and spas that answers overflow and after-hours calls on your current number, recovers missed bookings, and sends SMS follow-ups.',
  keywords: [
    'AI phone agent for salons',
    'AI receptionist and answering service for salons',
    'after hours call answering for salons',
    'missed call recovery for salons',
    'nail salon answering service',
    'salon answering service',
    'AI receptionist for nail salon',
    'hair salon phone booking software',
    'spa answering service',
    'appointment booking AI',
    'voice AI for salons',
    'RingBooker',
  ],
  socialLinks: {
    linkedin: process.env.NEXT_PUBLIC_LINKEDIN_URL?.trim() || 'https://www.linkedin.com/company/ringbooker',
    twitter: process.env.NEXT_PUBLIC_TWITTER_URL?.trim() || 'https://x.com/ringbooker',
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL?.trim() || 'https://www.facebook.com/ringbooker',
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() || '',
    youtube: process.env.NEXT_PUBLIC_YOUTUBE_URL?.trim() || 'https://www.youtube.com/@ringbooker',
  },
};

/** Open Graph / X / LinkedIn default preview. Path under `public/` or full `https://` URL. Override with `NEXT_PUBLIC_SITE_OG_IMAGE`. For large link previews, use a 1200×630 PNG/JPG/WebP. */
export const defaultSiteOgImage =
  process.env.NEXT_PUBLIC_SITE_OG_IMAGE?.trim() || '/images/og_ringbooker.jpg';

export function absoluteOgImageUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = siteConfig.url.replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

export function siteOgImageEntry(urlOrPath: string) {
  const url = urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://') ? urlOrPath : urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  return {
    url,
    width: 1200,
    height: 630,
    alt: `${siteConfig.name} — AI receptionist and answering service for salons & spas`,
  };
}

export function buildAlternates(path = '/'): Metadata['alternates'] {
  const { alternates } = generateCanonical(path);
  return {
    canonical: alternates.canonical,
  };
}

/**
 * Collapses repeated trailing brand suffixes (e.g. legacy double-append from layout template).
 */
export function normalizeSeoTitle(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(\s*\|\s*RingBooker)+$/i, ' | RingBooker');
}

/**
 * Single source of truth for `<title>` when using `buildMetadata`:
 * - Appends `| RingBooker` once when missing (so root `title.template` is not relied on).
 * - Skips append when the title is brand-first (`RingBooker | …`) or already ends with `| RingBooker`.
 */
export function finalizeDocumentTitle(raw: string): string {
  const brand = siteConfig.name;
  let t = raw.replace(/\s+/g, ' ').trim();
  if (t.toLowerCase() === brand.toLowerCase()) {
    return `${brand} | AI receptionist and answering service for beauty businesses`;
  }
  if (new RegExp(`^${brand}\\s*\\|`, 'i').test(t)) {
    return normalizeSeoTitle(t);
  }
  if (new RegExp(`\\|\\s*${brand}\\s*$`, 'i').test(t)) {
    return normalizeSeoTitle(t);
  }
  return normalizeSeoTitle(`${t} | ${brand}`);
}

export function buildMetadata({
  title,
  description,
  path = '/',
  image,
}: {
  title: string;
  description: string;
  path?: string;
  /** Page-specific preview; absolute URL or path under `public/`. Defaults to `defaultSiteOgImage`. */
  image?: string;
}): Metadata {
  const url = new URL(path, siteConfig.url).toString();
  const shareSrc = image?.trim() || defaultSiteOgImage;
  const ogImages = [siteOgImageEntry(shareSrc)];
  const documentTitle = finalizeDocumentTitle(title);

  return {
    // Bypass root `title.template` so we never append "| RingBooker" twice when the string already includes the brand.
    title: { absolute: documentTitle },
    description,
    keywords: siteConfig.keywords,
    metadataBase: new URL(siteConfig.url),
    alternates: buildAlternates(path),
    openGraph: {
      title: documentTitle,
      description,
      url,
      siteName: siteConfig.name,
      locale: 'en_US',
      type: 'website',
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: documentTitle,
      description,
      images: [shareSrc],
    },
  };
}

export const marketingNav = [
  { href: '/#features', label: 'Features' },
  { href: '/demo', label: 'Demo' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/faq', label: 'FAQ' },
];

export const footerNav = {
  product: [
    { href: '/', label: 'Home' },
    { href: '/demo', label: 'Demo' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/how-it-works', label: 'How It Works' },
    { href: '/missed-booking-protection/after-hours-calls', label: 'After-Hours Calls' },
    { href: '/missed-booking-protection/peak-hour-overflow-calls', label: 'Peak-Hour Overflow' },
    { href: '/missed-booking-protection/missed-call-recovery', label: 'Missed-Call Recovery' },
  ],
  company: [
    { href: '/contact', label: 'Book Demo' },
    { href: '/user/login', label: 'User Login' },
    { href: '/admin/login', label: 'Admin Login' },
  ],
  legal: [
    { href: '/privacy', label: 'Privacy' },
    { href: '/terms', label: 'Terms' },
  ],
};
