import type { Metadata } from 'next';

import { MarketingNailSalonVietnameseTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

const PAGE_PATH = '/industries/nail-salon/vi';
const PAGE_TITLE = 'Lễ Tân AI Cho Tiệm Nail | Square & Vagaro | RingBooker';
const PAGE_DESCRIPTION = 'RingBooker là lễ tân AI cho tiệm nail — đọc website tự động, tích hợp Square và Vagaro, trả lời tiếng Việt. Setup 15 phút.';
const pageMetadata = buildMetadata({ title: PAGE_TITLE, description: PAGE_DESCRIPTION, path: PAGE_PATH });

export const revalidate = 3600;

export const metadata: Metadata = {
  ...pageMetadata,
  alternates: {
    canonical: PAGE_PATH,
    languages: {
      vi: PAGE_PATH,
      en: '/industries/nail-salon',
      'en-US': '/industries/nail-salon',
      'x-default': '/industries/nail-salon',
    },
  },
  openGraph: {
    ...pageMetadata.openGraph,
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
  },
};

export default async function VietnameseNailSalonPage() {
  return <MarketingNailSalonVietnameseTemplate />;
}
