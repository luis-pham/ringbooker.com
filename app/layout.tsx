import type { Metadata, Viewport } from 'next';
import './globals.css';
import '@fontsource-variable/mona-sans';
import './marketing-typography.css';

import { GoogleTagManagerBody, GoogleTagManagerHead } from '@/components/analytics/google-tag-manager';
import { getUserPortalThemeBootstrapInlineScript } from '@/lib/user-portal-theme';
import { defaultSiteOgImage, siteConfig, siteOgImageEntry } from '@/lib/site';

const socialProfileUrls = Object.values(siteConfig.socialLinks).filter(Boolean);

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: 'AI Receptionist & Answering Service for Salons | RingBooker',
    template: '%s | RingBooker',
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  category: 'business software',
  openGraph: {
    title: 'AI Receptionist & Answering Service for Salons | RingBooker',
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: 'en_US',
    type: 'website',
    images: [siteOgImageEntry(defaultSiteOgImage)],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Receptionist & Answering Service for Salons | RingBooker',
    description: siteConfig.description,
    images: [defaultSiteOgImage],
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
    url: `${siteConfig.url}/images/logo.webp`,
    width: 512,
    height: 512,
  },
  description: siteConfig.description,
  foundingDate: '2026',
  areaServed: 'US',
  knowsAbout: [
    'AI receptionist and answering service for salons',
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
  availableLanguage: [
    { '@type': 'Language', name: 'English' },
    { '@type': 'Language', name: 'Spanish' },
    { '@type': 'Language', name: 'Korean' },
    { '@type': 'Language', name: 'Chinese' },
    { '@type': 'Language', name: 'Vietnamese' },
  ],
  offers: {
    '@type': 'Offer',
    price: '79',
    priceCurrency: 'USD',
    description: 'Plans start at $79 per month. Free 14-day trial, no credit card required.',
  },
  provider: { '@id': `${siteConfig.url}/#organization` },
  featureList: [
    'AI receptionist and answering service on existing business number',
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
          dangerouslySetInnerHTML={{
            __html: getUserPortalThemeBootstrapInlineScript(),
          }}
        />
        <GoogleTagManagerHead />
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
        <GoogleTagManagerBody />
        {children}
      </body>
    </html>
  );
}
