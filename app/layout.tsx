import type { Metadata } from 'next';
import './globals.css';

import { GoogleTagManager } from '@/components/analytics/google-tag-manager';
import { buildAlternates, siteConfig } from '@/lib/site';

const socialProfileUrls = Object.values(siteConfig.socialLinks).filter(Boolean);

export const metadata: Metadata = {
  title: {
    default: 'RingBooker | AI Phone Answering for Busy Salons & Spas',
    template: '%s | RingBooker',
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  metadataBase: new URL(siteConfig.url),
  alternates: buildAlternates('/'),
  applicationName: siteConfig.name,
  category: 'business software',
  openGraph: {
    title: 'RingBooker | AI Phone Answering for Busy Salons & Spas',
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RingBooker | AI Phone Answering for Busy Salons & Spas',
    description: siteConfig.description,
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${siteConfig.url}/#organization`,
  name: 'RingBooker',
  url: siteConfig.url,
  logo: {
    '@type': 'ImageObject',
    url: `${siteConfig.url}/images/logo.png`,
    width: 512,
    height: 512,
  },
  description: siteConfig.description,
  foundingDate: '2024',
  areaServed: 'US',
  knowsAbout: [
    'AI phone answering for salons',
    'Missed call recovery for beauty businesses',
    'After-hours call answering',
    'Appointment booking automation',
    'Voice AI for small businesses',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    url: `${siteConfig.url}/contact`,
    availableLanguage: ['English', 'Vietnamese'],
  },
  sameAs: socialProfileUrls,
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${siteConfig.url}/#website`,
  url: siteConfig.url,
  name: 'RingBooker',
  description: siteConfig.description,
  publisher: { '@id': `${siteConfig.url}/#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${siteConfig.url}/blog?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
};

const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': `${siteConfig.url}/#software`,
  name: 'RingBooker',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: siteConfig.url,
  description: siteConfig.description,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free 14-day trial, no credit card required',
  },
  provider: { '@id': `${siteConfig.url}/#organization` },
  featureList: [
    'AI phone answering on existing business number',
    '24/7 after-hours call coverage',
    'Bilingual English and Vietnamese support',
    'Booking intent capture and SMS confirmation',
    'Reschedule and cancellation handling',
    'No-show reduction reminders',
    'Square Appointments integration',
    'Call transcripts and dashboard',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
        />
      </head>
      <body>
        <GoogleTagManager />
        {children}
      </body>
    </html>
  );
}
