'use client';

import { PreparedDemoTemplate, type PreparedDemo } from '@/components/marketing/demo/prepared-demo-template';

export type { PreparedDemo };

// The attribution cookie (rb_ref) is set server-side in middleware (HttpOnly +
// HMAC-signed) on every /try/<slug> request — see middleware.ts.
export function TryDemoClient({ demo, demoPhoneE164 }: { demo: PreparedDemo; demoPhoneE164: string | null }) {
  // Sales-prepared demos use their own container, seeded with this salon's data
  // and flagged for sales tracking.
  return <PreparedDemoTemplate demo={demo} demoPhoneE164={demoPhoneE164} />;
}
