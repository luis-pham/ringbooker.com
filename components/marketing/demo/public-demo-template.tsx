'use client';

import { DemoExperience } from '@/components/marketing/demo/demo-experience';
import type { DemoVerticalSlug } from '@/components/marketing/demo-vertical-config';

type PublicDemoTemplateProps = {
  vertical: DemoVerticalSlug;
  demoPhoneE164?: string | null;
};

export function PublicDemoTemplate({ vertical, demoPhoneE164 }: PublicDemoTemplateProps) {
  return (
    <DemoExperience
      mode="public"
      vertical={vertical}
      demoPhoneE164={demoPhoneE164}
    />
  );
}
