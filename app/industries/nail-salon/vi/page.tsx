import type { Metadata } from 'next';

import { MarketingNailSalonVietnameseTemplate } from '@/components/marketing/marketing-vertical';
import { VI_NAIL_SALON_LANDING_SEO } from '@/lib/marketing/industry-landings';
import { buildMetadata } from '@/lib/site';

const pageMetadata = buildMetadata(VI_NAIL_SALON_LANDING_SEO);

export const revalidate = 3600;

export const metadata: Metadata = {
  ...pageMetadata,
  alternates: {
    canonical: VI_NAIL_SALON_LANDING_SEO.path,
    languages: {
      vi: VI_NAIL_SALON_LANDING_SEO.path,
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
