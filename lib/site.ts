import type { Metadata } from 'next';

export const siteConfig = {
  name: 'RingBooker',
  url: 'https://ringbooker.com',
  description:
    'RingBooker is an AI phone answering service for salons, nail shops, spas, and med spas. It answers after-hours and overflow calls on your current number, recovers missed bookings, handles reschedules, and sends SMS follow-ups.',
  keywords: [
    'AI phone agent for salons',
    'AI phone answering service for salons',
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
  process.env.NEXT_PUBLIC_SITE_OG_IMAGE?.trim() || '/images/shop_panel.webp';

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
    alt: `${siteConfig.name} — AI phone answering for salons & spas`,
  };
}

export function buildAlternates(path = '/'): Metadata['alternates'] {
  return {
    canonical: path,
    languages: {
      'en-US': path,
      'x-default': path,
    },
  };
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

  return {
    title,
    description,
    keywords: siteConfig.keywords,
    metadataBase: new URL(siteConfig.url),
    alternates: buildAlternates(path),
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      locale: 'en_US',
      type: 'website',
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title,
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
    { href: '/after-hours-calls', label: 'After-Hours Calls' },
    { href: '/missed-call-recovery', label: 'Missed-Call Recovery' },
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
