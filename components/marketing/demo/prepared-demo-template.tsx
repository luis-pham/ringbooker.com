'use client';

import { DemoExperience } from '@/components/marketing/demo/demo-experience';
import type { DemoVerticalSlug } from '@/components/marketing/demo-vertical-config';

export type PreparedDemo = {
  slug: string;
  vertical: string;
  businessName: string;
  city: string | null;
  logoUrl?: string | null;
  services: string[];
  staffNames?: string[];
  primaryHours?: string | null;
  secondaryHours?: string | null;
};

type PreparedDemoTemplateProps = {
  demo: PreparedDemo;
  demoPhoneE164?: string | null;
};

export function PreparedDemoTemplate({ demo, demoPhoneE164 }: PreparedDemoTemplateProps) {
  return (
    <DemoExperience
      mode="prepared"
      vertical={demo.vertical as DemoVerticalSlug}
      demoPhoneE164={demoPhoneE164}
      preparedDemoSlug={demo.slug}
      initialBusinessName={demo.businessName}
      initialCity={demo.city}
      initialLogoUrl={demo.logoUrl}
      initialServices={demo.services}
      initialStaffNames={demo.staffNames}
      initialPrimaryHours={demo.primaryHours}
      initialSecondaryHours={demo.secondaryHours}
    />
  );
}
