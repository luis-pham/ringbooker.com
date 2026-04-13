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
}: {
  title: string;
  description: string;
  path?: string;
}): Metadata {
  const url = new URL(path, siteConfig.url).toString();

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
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
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
