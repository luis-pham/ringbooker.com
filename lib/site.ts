import type { Metadata } from 'next';

export const siteConfig = {
  name: 'RingBooker',
  url: 'https://ringbooker.com',
  description:
    'RingBooker is an AI phone agent for nail salons, hair salons, and booking-heavy service businesses. It answers calls, books appointments, sends confirmation texts, and reduces missed calls.',
  keywords: [
    'AI phone agent for salons',
    'salon answering service',
    'AI receptionist for nail salon',
    'hair salon phone booking software',
    'missed call recovery for salons',
    'appointment booking AI',
    'voice AI for salons',
    'RingBooker',
  ],
};

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
    alternates: { canonical: path },
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
