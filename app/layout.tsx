import type { Metadata } from 'next';
import './globals.css';
import { siteConfig } from '@/lib/site';

export const metadata: Metadata = {
  title: {
    default: 'RingBooker | AI Phone Agent for Salons and Booking-Heavy Businesses',
    template: '%s | RingBooker',
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  category: 'business software',
  openGraph: {
    title: 'RingBooker | AI Phone Agent for Salons and Booking-Heavy Businesses',
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RingBooker | AI Phone Agent for Salons and Booking-Heavy Businesses',
    description: siteConfig.description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
