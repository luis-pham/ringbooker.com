'use client';

import { MarketingVerticalDemoTemplate } from '@/components/marketing/marketing-vertical-demo';
import type { DemoVerticalSlug } from '@/components/marketing/demo-vertical-config';

export type PreparedDemo = {
  slug: string;
  vertical: string;
  businessName: string;
  city: string | null;
  services: string[];
};

// The attribution cookie (rb_ref) is set server-side in middleware (HttpOnly +
// HMAC-signed) on every /try/<slug> request — see middleware.ts.
export function TryDemoClient({ demo, demoPhoneE164 }: { demo: PreparedDemo; demoPhoneE164: string | null }) {
  // Identical UI + post-call results to the public /demo/<vertical> page, seeded
  // with this salon's name/services and flagged for sales tracking.
  return (
    <MarketingVerticalDemoTemplate
      vertical={demo.vertical as DemoVerticalSlug}
      demoPhoneE164={demoPhoneE164}
      preparedDemoSlug={demo.slug}
      initialBusinessName={demo.businessName}
      initialCity={demo.city}
      initialServices={demo.services}
    />
  );
}
